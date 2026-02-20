import { supabase } from '@/lib/supabase'

// This is the main data collection function
// It will be called by Vercel Cron Jobs on a schedule
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Starting trend data collection...')
    
    // Get all genres
    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (genreError) throw genreError

    const results = []

    // Collect trends for each genre
    for (const genre of genres) {
      console.log(`Collecting trends for: ${genre.name}`)
      
      const trendData = await collectTrendsForGenre(genre.name)
      
      // Insert trends into database
      if (trendData && trendData.length > 0) {
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
          console.error(`Error inserting trends for ${genre.name}:`, insertError)
        } else {
          results.push({
            genre: genre.name,
            trendsAdded: trendData.length,
            status: 'success'
          })
        }
      }
    }

    console.log('Trend collection complete:', results)
    
    return res.status(200).json({
      success: true,
      message: 'Trends collected and updated successfully',
      results: results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in trend collection:', error)
    return res.status(500).json({
      error: 'Failed to collect trends',
      details: error.message
    })
  }
}

// Main function that researches trends for a specific genre
async function collectTrendsForGenre(genre) {
  // This function uses Claude API to research trends
  // We'll build the Claude integration next
  
  try {
    const trends = await researchTrendsWithClaude(genre)
    return trends
  } catch (error) {
    console.error(`Error researching trends for ${genre}:`, error)
    return []
  }
}

// Claude-powered research function
async function researchTrendsWithClaude(genre) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set')
  }

  const prompt = `You are a music industry trend analyst. Research and provide current music trends for the "${genre}" genre as of today.

For this genre, identify real, current trends across these platforms:
- Spotify (playlists, production styles, sounds being added)
- TikTok (trending sounds, audio characteristics, video formats)
- Instagram Reels (audio being used, video aesthetics, production style)
- YouTube (trending songs, production characteristics)
- Music publications and industry discussion

Return EXACTLY this JSON format with no other text:
{
  "trends": [
    {
      "platform": "Spotify",
      "trend_name": "Brief trend name",
      "trend_description": "What is this trend, why is it working, what artists/producers are doing it",
      "is_growing": true,
      "data_value": 8500
    }
  ]
}

Include 3-5 trends per platform.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250805',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const responseData = await response.json()
    
    if (!response.ok) {
      console.error('Claude API error details:', responseData)
      throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(responseData)}`)
    }

    const textContent = responseData.content[0].text
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response')
    }

    const parsedData = JSON.parse(jsonMatch[0])
    return parsedData.trends || []
  } catch (error) {
    console.error(`Error calling Claude API for ${genre}:`, error.message)
    return []
  }
}
