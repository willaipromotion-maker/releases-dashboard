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
        const { error: upsertError } = await supabase
          .from('trends')
          .upsert(
            trendData.map(trend => ({
              genre_id: genre.id,
              platform: trend.platform,
              trend_name: trend.trend_name,
              trend_description: trend.trend_description,
              is_growing: trend.is_growing,
              data_value: trend.data_value,
              last_updated: new Date().toISOString()
            })),
            {
              onConflict: 'genre_id,trend_name'
            }
          )

        if (upsertError) {
          console.error(`Database error for ${genre.name}:`, upsertError)
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
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const prompt = `
You are a music industry trend analyst.

Research current, real trends for the "${genre}" genre across:
- Spotify
- TikTok
- Instagram Reels
- YouTube
- Music publications

Return valid JSON with this structure:

{
  "trends": [
    {
      "platform": "Spotify",
      "trend_name": "Brief trend name",
      "trend_description": "Explanation including why it works and examples",
      "is_growing": true,
      "data_value": 8500
    }
  ]
}

Include 3-5 trends per platform.
`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        response_format: { type: 'json' },
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Claude API error:', responseData)
      throw new Error(`Claude API ${response.status}`)
    }

    if (!responseData.content || !responseData.content.length) {
      throw new Error('Unexpected Claude response format')
    }

    let parsedData
    try {
      parsedData = JSON.parse(responseData.content[0].text)
    } catch (parseError) {
      console.error('Invalid JSON from Claude:', responseData.content[0].text)
      throw new Error('Claude returned invalid JSON')
    }

    console.log('Token usage:', responseData.usage)

    return Array.isArray(parsedData.trends) ? parsedData.trends : []

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Claude request timed out for ${genre}`)
    } else {
      console.error(`Claude error for ${genre}:`, error.message)
    }
    return []
  }
}