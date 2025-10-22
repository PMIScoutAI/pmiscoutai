# 🛡️ Rate Limiting - Guida Rollback Rapido

## ⚡ ROLLBACK IMMEDIATO (1 minuto)

Se il rate limiting causa problemi, **seguire questa procedura**:

### 1️⃣ Disabilitare Rate Limiting (Vercel Dashboard)

1. Vai su **Vercel Dashboard** → Progetto `pmiscoutai`
2. Vai su **Settings** → **Environment Variables**
3. Trova la variabile `RATE_LIMITING_ENABLED`
4. **Cambia il valore da `true` a `false`**
5. Clicca **Save**
6. Vai su **Deployments** → Clicca sui 3 puntini del deployment attivo → **Redeploy**

⏱️ **Tempo di rollback**: ~1-2 minuti (tempo di redeploy Vercel)

### 2️⃣ Verifica Rollback

Dopo il redeploy, verifica che:
- ✅ Le richieste passano senza errori 429
- ✅ Gli headers `X-RateLimit-*` non sono più presenti nelle risposte
- ✅ I log non mostrano più `[RateLimit]` messages

---

## 🔍 Come Capire se il Rate Limiting sta Causando Problemi

### Sintomi:

1. **Utenti ricevono errore 429**:
   ```json
   {
     "error": "Rate limit superato",
     "message": "Hai raggiunto il limite di X richieste..."
   }
   ```

2. **Log Vercel mostrano blocchi**:
   ```
   [RateLimit] 🚫 BLOCCATO: user="email@example.com" su /api/generate-alerts
   ```

3. **Headers nelle risposte API**:
   ```
   X-RateLimit-Limit: 20
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1730123456
   ```

### Cosa Fare:

**Se 1-2 utenti legittimi vengono bloccati:**
→ **NON fare rollback**, aumenta i limiti (vedi sezione "Aumentare Limiti")

**Se molti utenti vengono bloccati o il sistema è instabile:**
→ **Fare rollback immediato** (procedura sopra)

---

## 📊 Aumentare i Limiti (Senza Rollback Completo)

Se gli utenti legittimi vengono bloccati, aumenta i limiti invece di disabilitare:

### Modifica `utils/rateLimitMiddleware.js`:

```javascript
// PRIMA (limiti attuali)
AI_ENDPOINTS: {
  authenticated: 20,  // 20 richieste/ora
  unauthenticated: 3,
  window: 60 * 60 * 1000
}

// DOPO (limiti più permissivi)
AI_ENDPOINTS: {
  authenticated: 100,  // 100 richieste/ora
  unauthenticated: 10,
  window: 60 * 60 * 1000
}
```

Poi committa e pusha:
```bash
git add utils/rateLimitMiddleware.js
git commit -m "Increase rate limits for legitimate users"
git push
```

Vercel farà automaticamente redeploy (~2 min).

---

## 🧪 Come Testare il Rate Limiting (Prima di Attivare in Produzione)

### Test Locale:

1. **Avvia in locale**:
   ```bash
   npm run dev
   ```

2. **Abilita rate limiting** aggiungendo al `.env.local`:
   ```
   RATE_LIMITING_ENABLED=true
   ```

3. **Testa con script**:
   ```bash
   # Fai 25 richieste rapide (dovrebbe bloccare dopo 20)
   for i in {1..25}; do
     curl "http://localhost:3000/api/generate-alerts?email=test@test.com"
     echo "Richiesta $i"
   done
   ```

4. **Verifica nei log**:
   - Prime 20 richieste: ✅ OK
   - Dalla 21 in poi: ❌ 429 Too Many Requests

---

## 📈 Monitoraggio Post-Deploy

### Cosa Monitorare:

1. **Log Vercel** (primi 30 minuti):
   - Cerca `[RateLimit] 🚫 BLOCCATO`
   - Se vedi MOLTI blocchi → aumenta limiti o rollback

2. **Feedback Utenti**:
   - Controlla email support per segnalazioni errori 429
   - Se utenti reali bloccati → aumenta limiti

3. **Metriche OpenAI**:
   - Verifica che i costi non aumentino improvvisamente
   - Se aumentano nonostante rate limiting → possibile bypass

### Dashboard Diagnostico (Interno):

Per vedere stato rate limiting in tempo reale, aggiungi questo endpoint diagnostico:

**File: `pages/api/admin/rate-limit-stats.js`** (SOLO per admin!)

```javascript
import { getRateLimitStats } from '../../../utils/rateLimitMiddleware';

export default async function handler(req, res) {
  // 🚨 AGGIUNGI AUTH ADMIN QUI!
  // if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const stats = getRateLimitStats();
  return res.status(200).json(stats);
}
```

Poi visita: `https://tuodominio.com/api/admin/rate-limit-stats`

---

## 🔒 Limiti Attuali Configurati

| Categoria | Autenticati | Non Autenticati | Finestra |
|-----------|-------------|-----------------|----------|
| **AI Endpoints** (OpenAI/Google) | 20 req/h | 3 req/h | 1 ora |
| **Standard** (Upload/Calcoli) | 50 req/h | 10 req/h | 1 ora |
| **Read** (GET) | 100 req/h | 20 req/h | 1 ora |

### Endpoint Classificati:

**AI Endpoints:**
- `/api/generate-alerts`
- `/api/analyze-xbrl`
- `/api/analyze-pdf`
- `/api/extract-with-doc-ai`

**Standard Endpoints:**
- `/api/start-checkup`
- `/api/start-checkup-hd`
- `/api/valuta-pmi/calculate`
- `/api/banking-analysis`

**Read Endpoints:**
- `/api/get-session-complete`
- `/api/user-analyses`
- (tutti i GET)

---

## 📞 Contatti di Emergenza

**In caso di problemi critici:**

1. **Rollback immediato** (vedi sopra)
2. **Notifica il team**
3. **Analizza log Vercel** per capire causa
4. **Ripristina gradualmente** con limiti più alti

---

## ✅ Checklist Pre-Attivazione

Prima di impostare `RATE_LIMITING_ENABLED=true` in produzione:

- [ ] Testato in locale con script
- [ ] Limiti verificati (non troppo bassi per uso reale)
- [ ] Logging funzionante (vedi `[RateLimit]` in console)
- [ ] Procedura rollback testata
- [ ] Team informato dell'attivazione
- [ ] Monitoring attivo per primi 30 minuti

---

## 📝 Note Tecniche

- **Storage**: In-memory (Map) con auto-cleanup ogni 5 minuti
- **Identificatore**: Email utente (se autenticato) o IP address
- **Reset**: Automatico dopo 1 ora dalla prima richiesta
- **Headers**: Standard `X-RateLimit-*` come da RFC 6585

**⚠️ Limitazione**: In-memory storage si resetta ad ogni redeploy Vercel. Per rate limiting persistente tra deploy, considerare Redis (Upstash).

---

**Ultimo aggiornamento**: 2025-10-22
**Versione middleware**: 1.0.0
**Feature flag**: `RATE_LIMITING_ENABLED` (default: `false`)
