import { supabase } from '@/lib/supabase'

// ===============================
// Main Cron Handler
// ===============================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Starting trend data collection...')

    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (genreError) throw genreError
    if (!genres || genres.length === 0) {
      return res.status(200).json({ success: true, message: 'No genres found' })
    }

    const results = []

    for (const genre of genres) {
      console.log(`Collecting trends for: ${genre.name}`)

      const trendData = await collectTrendsForGenre(genre.name)

      if (trendData.length > 0) {
        const { error: insertError } = await supabase
          .from('trends')
          .insert(
            trendData.map(trend => ({
              genre_id: genre.id,
              platform: trend.platform,
              trend_name: trend.trend_name,
              trend_description: trend.trend_description,
              is_growing: trend.is_growing,
              data_value: trend.data_value,
              last_updated: new Date().toISOString()
            }))
          )
      
        if (insertError) {
          console.error(`Database error for ${genre.name}:`, insertError)
          results.push({
            genre: genre.name,
            status: 'db_error'
          })
        } else {
          results.push({
            genre: genre.name,
            trendsProcessed: trendData.length,
            status: 'success'
          })
        }
      } else {
        results.push({
          genre: genre.name,
          trendsProcessed: 0,
          status: 'no_data'
        })
      }
    }

    console.log('Trend collection complete')

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Fatal trend collection error:', error)
    return res.status(500).json({
      error: 'Failed to collect trends',
      details: error.message
    })
  }
}

// ===============================
// Claude Trend Research
// ===============================
async function collectTrendsForGenre(genre) {
  try {
    return await researchTrendsWithClaude(genre)
  } catch (error) {
    console.error(`Trend research failed for ${genre}:`, error)
    return []
  }
}

async function researchTrendsWithClaude(genre) {
  // MOCK DATA FOR TESTING - Remove this after debugging
  const mockTrends = {
    "trends": [
      {
        "platform": "Spotify",
        "trend_name": "Hyperpop Melodic",
        "trend_description": "Hyperpop artists are getting added to mainstream playlists",
        "is_growing": true,
        "data_value": 8500
      },
      {
        "platform": "TikTok",
        "trend_name": "Vocal Layering",
        "trend_description": "Heavy vocal stacking in 15-30 second clips",
        "is_growing": true,
        "data_value": 7200
      },
      {
        "platform": "Instagram Reels",
        "trend_name": "Lo-Fi Beats",
        "trend_description": "Lo-fi production dominating short-form video",
        "is_growing": true,
        "data_value": 6800
      },
      {
        "platform": "YouTube",
        "trend_name": "Production Tutorials",
        "trend_description": "Behind-the-scenes production content getting views",
        "is_growing": true,
        "data_value": 7500
      },
      {
        "platform": "Industry Discussion",
        "trend_name": "Bedroom Pop Revival",
        "trend_description": "Music publications highlighting bedroom producer success",
        "is_growing": true,
        "data_value": 6500
      }
    ]
  }
  
  console.log(`Returning mock trends for ${genre}`)
  return mockTrends.trends
}