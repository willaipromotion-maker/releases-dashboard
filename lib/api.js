import { supabase } from './supabase'

// Get all trends grouped by genre
export async function getTrendsByGenre() {
  try {
    const { data, error } = await supabase
      .from('trends')
      .select('*, genres(name)')
      .order('last_updated', { ascending: false })

    if (error) throw error
    
    // Group by genre
    const grouped = {}
    data.forEach(trend => {
      const genreName = trend.genres.name
      if (!grouped[genreName]) {
        grouped[genreName] = []
      }
      grouped[genreName].push(trend)
    })
    
    return grouped
  } catch (error) {
    console.error('Error fetching trends:', error)
    return {}
  }
}

// Get trends for a specific genre
export async function getTrendsByGenreName(genreName) {
  try {
    const { data, error } = await supabase
      .from('genres')
      .select('id')
      .eq('name', genreName)
      .single()

    if (error) throw error

    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .eq('genre_id', data.id)
      .order('last_updated', { ascending: false })

    if (trendsError) throw trendsError
    return trends
  } catch (error) {
    console.error('Error fetching genre trends:', error)
    return []
  }
}

// Get all genres
export async function getGenres() {
  try {
    const { data, error } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching genres:', error)
    return []
  }
}