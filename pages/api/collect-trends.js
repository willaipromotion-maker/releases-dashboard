import { supabase } from '@/lib/supabase'

export const config = {
  api: { bodyParser: true },
  maxDuration: 60,
  runtime: 'nodejs'
}

const PLATFORMS = ['Spotify', 'TikTok', 'YouTube', 'Instagram Reels']
const CLAUDE_TIMEOUT_MS = 25_000

// Flip this to true once web search is enabled
const IS_VERIFIED = false
const DATA_SOURCE = 'training_data'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const authHeader = req.headers['authorization']
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    console.log('=== STARTING TREND COLLECTION ===')

    const genreFilter = req.method === 'GET'
      ? (req.query.genre || null)
      : (req.body?.genre || null)

    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (genreError) throw new Error(`Supabase error: ${genreError.message}`)
    if (!genres || genres.length === 0) {
      return res.status(200).json({ success: true, message: 'No genres found' })
    }

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
        const now = new Date().toISOString()

        // Delete all active trends for this genre
        // trend_history is unaffected — history persists forever
        const { error: deleteError } = await supabase
          .from('trends')
          .delete()
          .eq('genre_id', genre.id)

        if (deleteError) {
          console.error(`Delete error for ${genre.name}:`, deleteError)
          continue
        }

        // Insert today's fresh trends
        const { data: insertedTrends, error: insertError } = await supabase
          .from('trends')
          .insert(
            allTrends.map(trend => ({
              genre_id: genre.id,
              platform: trend.platform,
              trend_name: trend.trend_name,
              trend_description: trend.trend_description,
              is_growing: trend.is_growing,
              data_value: trend.data_value,
              is_verified: IS_VERIFIED,
              last_updated: now
            }))
          )
          .select()

        if (insertError) {
          console.error(`Insert error for ${genre.name}:`, insertError)
          continue
        }

        // Log every trend to trend_history with all fields needed for
        // historical queries — trend_name, genre_id, platform are stored
        // directly so history is queryable even after a trend leaves the
        // active trends table
        if (insertedTrends && insertedTrends.length > 0) {
          const { error: historyError } = await supabase
            .from('trend_history')
            .insert(
              insertedTrends.map(trend => ({
                trend_id: trend.id,
                trend_name: trend.trend_name,
                genre_id: genre.id,
                platform: trend.platform,
                data_value: trend.data_value,
                is_verified: IS_VERIFIED,
                data_source: DATA_SOURCE,
                recorded_at: now
              }))
            )

          if (historyError) {
            console.error(`History insert error for ${genre.name}:`, historyError)
          }
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

  const prompt = `You are a music industry trend analyst focused on independent and emerging artists. Analyze current trends in the "${genre}" genre on ${platform}.

Return ONLY raw valid JSON — no markdown, no backticks, no explanation.

Rules:
- Return only trends that are genuinely relevant and distinct — as many or as few as actually apply, up to a maximum of 8 per platform
- Use consistent, standardized trend names that are identical across platforms when referring to the same trend (e.g. always "Bedroom Pop" never "Bedroom Pop Revival" or "Bedroom Pop Aesthetics", always "Shoegaze" never "Shoegaze Revival")
- Every trend must be unique within this platform — no two trends should overlap in meaning
- trend_description must match is_growing: if true, describe it as rising or gaining traction; if false, describe it as declining or losing momentum
- Focus on what is actionable and useful for an independent artist deciding what to create or post today
- Keep trend_description under 50 words

{
  "trends": [
    {
      "trend_name": "Standardized Trend Name",
      "trend_description": "Under 50 words. Must match is_growing direction. Relevant to independent artists.",
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
        max_tokens: 1500,
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