import { supabase } from '@/lib/supabase'

export const config = {
  api: { bodyParser: true },
  maxDuration: 60,
  runtime: 'nodejs'
}

const PLATFORMS = ['Spotify', 'TikTok', 'YouTube', 'Instagram Reels', 'Music Publications']
const CLAUDE_TIMEOUT_MS = 25_000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== STARTING TREND COLLECTION ===')

    const body = req.body || {}
    const genreFilter = body.genre || null

    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (genreError) throw new Error(`Supabase error: ${genreError.message}`)
    if (!genres || genres.length === 0) {
      return res.status(200).json({ success: true, message: 'No genres found' })
    }

    // If a genre name was passed in the request body, process only that one.
    // Otherwise default to the first genre (safe fallback for manual testing).
    const genresToProcess = genreFilter
      ? genres.filter(g => g.name.toLowerCase() === genreFilter.toLowerCase())
      : [genres[0]]

    if (genresToProcess.length === 0) {
      return res.status(404).json({ error: `Genre not found: ${genreFilter}` })
    }

    const genreResults = []

    for (const genre of genresToProcess) {
      console.log(`Processing genre: ${genre.name}`)

      const results = await Promise.allSettled(
        PLATFORMS.map(platform => researchTrendsForPlatform(genre.name, platform))
      )

      const allTrends = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allTrends.push(...result.value)
        } else {
          console.error('Platform fetch failed:', result.reason?.message)
        }
      }

      console.log(`Got ${allTrends.length} trends for ${genre.name}`)

      if (allTrends.length > 0) {
        const { error: insertError } = await supabase
          .from('trends')
          .insert(
            allTrends.map(trend => ({
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
          console.error(`Insert error for ${genre.name}:`, insertError)
        }
      }

      genreResults.push({
        genre: genre.name,
        trendsProcessed: allTrends.length
      })
    }

    return res.status(200).json({
      success: true,
      results: genreResults,
      totalGenres: genreResults.length
    })

  } catch (error) {
    console.error('Handler error:', error.message)
    return res.status(500).json({ error: error.message })
  }
}

async function researchTrendsForPlatform(genre, platform) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it in Vercel dashboard: Settings > Environment Variables.'
    )
  }

  console.log(`Fetching trends: ${genre} / ${platform}`)

  const prompt = `You are a music industry trend analyst. Analyze current trends in the "${genre}" genre on ${platform}.

Return ONLY raw valid JSON — no markdown, no backticks, no explanation.

{
  "trends": [
    {
      "trend_name": "Short trend name",
      "trend_description": "Under 50 words describing the trend",
      "is_growing": true,
      "data_value": 5000
    }
  ]
}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text?.trim() ?? ''

  let parsed
  try {
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    console.error(`JSON parse failed for ${platform}. Raw response:`, raw.slice(0, 200))
    return []
  }

  const trends = Array.isArray(parsed.trends) ? parsed.trends : []
  console.log(`  ${platform}: ${trends.length} trends`)

  return trends.map(t => ({
    platform,
    trend_name: t.trend_name ?? 'Unknown',
    trend_description: t.trend_description ?? '',
    is_growing: Boolean(t.is_growing),
    data_value: Number(t.data_value) || 0
  }))
}