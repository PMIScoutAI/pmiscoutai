// utils/rateLimitMiddleware.js
// Rate Limiting Middleware con Feature Flag per rollback sicuro

/**
 * CONFIGURAZIONE RATE LIMITING
 *
 * Feature Flag: RATE_LIMITING_ENABLED (default: false per sicurezza)
 *
 * Limiti iniziali (MOLTO PERMISSIVI per non impattare utenti):
 * - Utenti autenticati: 50 richieste/ora
 * - IP non autenticati: 10 richieste/ora
 * - Endpoint critici AI: 20 richieste/ora (utenti autenticati)
 *
 * ROLLBACK: Impostare RATE_LIMITING_ENABLED=false per disabilitare
 */

// Storage in-memory per tracking richieste
const requestStore = new Map();

// Configurazione limiti per tipo di endpoint
const LIMITS = {
  // Endpoint che chiamano OpenAI o servizi costosi
  AI_ENDPOINTS: {
    authenticated: 20,  // 20 richieste/ora per utenti loggati
    unauthenticated: 3, // 3 richieste/ora per IP non autenticati
    window: 60 * 60 * 1000 // 1 ora in millisecondi
  },

  // Endpoint standard (upload, calcoli)
  STANDARD_ENDPOINTS: {
    authenticated: 50,  // 50 richieste/ora
    unauthenticated: 10, // 10 richieste/ora
    window: 60 * 60 * 1000
  },

  // Endpoint di lettura (GET)
  READ_ENDPOINTS: {
    authenticated: 100, // 100 richieste/ora
    unauthenticated: 20, // 20 richieste/ora
    window: 60 * 60 * 1000
  }
};

// Classificazione endpoint
const ENDPOINT_CATEGORIES = {
  AI: [
    '/api/generate-alerts',
    '/api/analyze-xbrl',
    '/api/analyze-pdf',
    '/api/extract-with-doc-ai'
  ],
  STANDARD: [
    '/api/start-checkup',
    '/api/start-checkup-hd',
    '/api/valuta-pmi/calculate',
    '/api/valuta-pmi/upload',
    '/api/banking-analysis'
  ],
  READ: [
    '/api/get-session-complete',
    '/api/get-session-hd',
    '/api/user-analyses',
    '/api/user-contracts',
    '/api/market-rates'
  ]
};

/**
 * Cleanup automatico: rimuove entry vecchie ogni 5 minuti
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, data] of requestStore.entries()) {
    if (now - data.windowStart > data.windowMs) {
      requestStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[RateLimit] 🧹 Pulizia automatica: ${cleaned} entry rimosse, ${requestStore.size} attive`);
  }
}, 5 * 60 * 1000); // Ogni 5 minuti

/**
 * Estrae identificativo univoco per tracking (email o IP)
 */
function getIdentifier(req) {
  // Prova a estrarre email da query (per GET) o body (se disponibile)
  const email = req.query?.email || req.body?.email;

  if (email) {
    return { type: 'user', id: email };
  }

  // Fallback su IP address
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
              req.headers['x-real-ip'] ||
              req.connection?.remoteAddress ||
              'unknown';

  return { type: 'ip', id: ip };
}

/**
 * Determina categoria endpoint e limiti applicabili
 */
function getEndpointLimits(pathname) {
  if (ENDPOINT_CATEGORIES.AI.includes(pathname)) {
    return { category: 'AI', limits: LIMITS.AI_ENDPOINTS };
  }

  if (ENDPOINT_CATEGORIES.STANDARD.includes(pathname)) {
    return { category: 'STANDARD', limits: LIMITS.STANDARD_ENDPOINTS };
  }

  if (ENDPOINT_CATEGORIES.READ.includes(pathname)) {
    return { category: 'READ', limits: LIMITS.READ_ENDPOINTS };
  }

  // Default: usa limiti standard
  return { category: 'STANDARD', limits: LIMITS.STANDARD_ENDPOINTS };
}

/**
 * Middleware principale di Rate Limiting
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object|null} - Ritorna oggetto errore se limite superato, null se ok
 */
export function rateLimitMiddleware(req, res) {
  // 🚨 FEATURE FLAG: Se disabilitato, passa tutto senza controlli
  const isEnabled = process.env.RATE_LIMITING_ENABLED === 'true';

  if (!isEnabled) {
    // Silenzioso: non logga per non inquinare i log in produzione
    return null; // ✅ Passa senza bloccare
  }

  const pathname = req.url?.split('?')[0]; // Rimuovi query params per matching
  const { type, id } = getIdentifier(req);
  const { category, limits } = getEndpointLimits(pathname);

  // Determina limite applicabile
  const maxRequests = type === 'user' ? limits.authenticated : limits.unauthenticated;
  const windowMs = limits.window;

  // Chiave univoca per tracking
  const key = `${pathname}:${type}:${id}`;
  const now = Date.now();

  // Recupera o inizializza tracking
  let tracker = requestStore.get(key);

  if (!tracker || (now - tracker.windowStart) > windowMs) {
    // Nuova finestra temporale
    tracker = {
      count: 0,
      windowStart: now,
      windowMs: windowMs,
      identifier: id,
      type: type,
      endpoint: pathname,
      category: category
    };
    requestStore.set(key, tracker);
  }

  // Incrementa contatore
  tracker.count++;

  // Calcola remaining e reset time
  const remaining = Math.max(0, maxRequests - tracker.count);
  const resetTime = new Date(tracker.windowStart + windowMs);
  const minutesUntilReset = Math.ceil((tracker.windowStart + windowMs - now) / 1000 / 60);

  // 🔔 Log se utente si avvicina al limite (80%)
  if (tracker.count >= maxRequests * 0.8 && tracker.count < maxRequests) {
    console.warn(
      `[RateLimit] ⚠️ AVVISO LIMITE: ${type}="${id}" su ${pathname} ` +
      `(${tracker.count}/${maxRequests}) - Reset tra ${minutesUntilReset}min`
    );
  }

  // ❌ BLOCCA se limite superato
  if (tracker.count > maxRequests) {
    console.error(
      `[RateLimit] 🚫 BLOCCATO: ${type}="${id}" su ${pathname} ` +
      `(${tracker.count}/${maxRequests} richieste) - Reset: ${resetTime.toISOString()}`
    );

    // Setta headers standard di rate limiting
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
    res.setHeader('Retry-After', minutesUntilReset * 60);

    return {
      error: 'Rate limit superato',
      message: `Hai raggiunto il limite di ${maxRequests} richieste all'ora per questo servizio. Riprova tra ${minutesUntilReset} minuti.`,
      limit: maxRequests,
      remaining: 0,
      reset: resetTime.toISOString(),
      retryAfter: minutesUntilReset * 60
    };
  }

  // ✅ OK - Aggiorna headers informativi
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
  res.setHeader('X-RateLimit-Category', category);

  // Log solo per endpoint AI (non inquinare log per ogni richiesta)
  if (category === 'AI') {
    console.log(
      `[RateLimit] ✅ ${type}="${id}" su ${pathname} ` +
      `(${tracker.count}/${maxRequests}, remaining: ${remaining})`
    );
  }

  return null; // ✅ Passa la richiesta
}

/**
 * Helper per applicare il middleware in modo semplice
 *
 * Uso:
 * ```javascript
 * export default async function handler(req, res) {
 *   const rateLimitError = applyRateLimit(req, res);
 *   if (rateLimitError) return res.status(429).json(rateLimitError);
 *
 *   // ... resto della logica
 * }
 * ```
 */
export function applyRateLimit(req, res) {
  return rateLimitMiddleware(req, res);
}

/**
 * Funzione diagnostica per vedere stato corrente (per debugging)
 * NON esporre in produzione
 */
export function getRateLimitStats() {
  const stats = {
    totalTracked: requestStore.size,
    byCategory: { AI: 0, STANDARD: 0, READ: 0 },
    byType: { user: 0, ip: 0 },
    topUsers: []
  };

  const userCounts = new Map();

  for (const [key, data] of requestStore.entries()) {
    stats.byCategory[data.category] = (stats.byCategory[data.category] || 0) + 1;
    stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

    const count = userCounts.get(data.identifier) || 0;
    userCounts.set(data.identifier, count + data.count);
  }

  // Top 10 utenti per numero richieste
  stats.topUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  return stats;
}

export default rateLimitMiddleware;
