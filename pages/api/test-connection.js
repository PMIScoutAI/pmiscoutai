import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('sector_benchmarks_italy')
      .select('*')
      .limit(1)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(200).json({ 
      success: true, 
      message: 'Connessione funziona!',
      data: data 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
