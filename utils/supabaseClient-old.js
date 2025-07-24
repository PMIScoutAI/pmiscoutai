import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funzione helper per ottenere l'utente corrente da Outseta
export const getCurrentOutsetaUser = () => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => resolve(user))
        .catch(error => reject(error))
    } else {
      reject(new Error('Outseta non disponibile'))
    }
  })
}

// Funzione per ottenere o creare l'utente nel database Supabase
export const getOrCreateSupabaseUser = async (outsetaUser) => {
  try {
    // Prima cerca se l'utente esiste già
    const { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('outseta_user_id', outsetaUser.Uid)
      .single()

    if (existingUser && !searchError) {
      return { data: existingUser, error: null }
    }

    // Se non esiste, lo crea
    const newUser = {
      outseta_user_id: outsetaUser.Uid,
      email: outsetaUser.Email,
      first_name: outsetaUser.FirstName || '',
      last_name: outsetaUser.LastName || '',
      full_name: `${outsetaUser.FirstName || ''} ${outsetaUser.LastName || ''}`.trim(),
      subscription_plan: 'free', // Default
      subscription_status: 'active'
    }

    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single()

    return { data: createdUser, error: createError }
  } catch (error) {
    return { data: null, error }
  }
}

// Funzione per ottenere le aziende di un utente
export const getUserCompanies = async (userId) => {
  return supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
}

// Funzione per ottenere le sessioni di un utente con dettagli azienda
export const getUserSessions = async (userId) => {
  return supabase
    .from('checkup_sessions')
    .select(`
      *,
      companies (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
}

// Funzione per ottenere una sessione specifica con azienda e risultati
export const getSessionWithResults = async (sessionId) => {
  return supabase
    .from('checkup_sessions')
    .select(`
      *,
      companies (*),
      analysis_results (*)
    `)
    .eq('id', sessionId)
    .single()
}

// Funzione per creare una nuova azienda
export const createCompany = async (userId, companyData) => {
  const newCompany = {
    user_id: userId,
    ...companyData
  }

  return supabase
    .from('companies')
    .insert(newCompany)
    .select()
    .single()
}

// Funzione per creare una nuova sessione
export const createCheckupSession = async (sessionData) => {
  return supabase
    .from('checkup_sessions')
    .insert(sessionData)
    .select()
    .single()
}

// Funzione per aggiornare lo stato di una sessione
export const updateSessionStatus = async (sessionId, updates) => {
  return supabase
    .from('checkup_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()
}

// Funzione per sottoscriversi ai cambiamenti in tempo reale di una sessione
export const subscribeToSession = (sessionId, callback) => {
  return supabase
    .channel(`session_${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'checkup_sessions',
        filter: `id=eq.${sessionId}`
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'analysis_results',
        filter: `session_id=eq.${sessionId}`
      },
      callback
    )
    .subscribe()
}
