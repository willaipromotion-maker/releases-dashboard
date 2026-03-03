import { supabase } from '@/lib/supabase'
import axios from 'axios'

export const config = {
  api: { bodyParser: true },
  runtime: 'nodejs'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== STARTING TREND COLLECTION ===')

    const { data: genres } = await supabase
      .from('genres')
      .select('*')
      .order('name')
      .limit(1)

    if (!genres || genres.length === 0) {
      return res.status(200).json({ success: true, message: 'No genres' })
    }

    const genre = genres[0]
    console.log(`Processing: ${genre.name}`)

    const trendData = await researchTrendsWithClaude(genre.name)
    console.log(`Got ${trendData.length} trends`)

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
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: 'Database error' })
      }
    }

    return res.status(200).json({
      success: true,
      genre: genre.name,
      trendsProcessed: trendData.length
    })

  } catch (error) {
    console.error('Error:', error.message)
    return res.status(500).json({ error: error.message })
  }
}

async function researchTrendsWithClaude(genre) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const platforms = ['Spotify', 'TikTok', 'Instagram Reels', 'YouTube', 'Music Publications']
  const allTrends = []

  for (const platform of platforms) {
    console.log(`Platform: ${platform}`)
    
    let hasMore = true
    let iteration = 0

    while (hasMore && iteration < 2) {
      iteration++

      const prompt = `You are a music industry trend analyst. Analyze CURRENT trends in the "${genre}" genre on ${platform}.

Return ONLY raw valid JSON. No markdown, no backticks.

{
  "trends": [
    {
      "trend_name": "Name",
      "trend_description": "Under 50 words",
      "is_growing": true,
      "data_value": 5000
    }
  ],
  "has_more": false
}`

      try {
        console.log(`  Batch ${iteration}...`)

        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 800,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            timeout: 8000
          }
        )

        console.log(`  Success`)

        const responseData = response.data
        let raw = responseData.content[0].text.trim()
        raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim()

        let parsed
        try {
          parsed = JSON.parse(raw)
        } catch (err) {
          console.error(`  Parse error`)
          iteration--
          continue
        }

        const trends = Array.isArray(parsed.trends) ? parsed.trends : []
        hasMore = parsed.has_more === true

        for (const trend of trends) {
          allTrends.push({
            platform,
            trend_name: trend.trend_name,
            trend_description: trend.trend_description,
            is_growing: trend.is_growing,
            data_value: trend.data_value
          })
        }

      } catch (error) {
        console.error(`  Error: ${error.message}`)
        break
      }
    }
  }

  console.log(`Total trends: ${allTrends.length}`)
  return allTrends
}