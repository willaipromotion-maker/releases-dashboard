import { supabase } from '@/lib/supabase'

// ✅ FIX 1: Raise the Vercel function timeout.
// Requires Vercel Pro (max 60s) or Vercel Enterprise (max 800s).
// On Hobby plan, max is 10s — this alone explains every timeout.
export const config = {
  api: { bodyParser: true },
  maxDuration: 60,        // seconds — remove if on Hobby plan and use the cron workaround below
  runtime: 'nodejs'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['Spotify', 'TikTok', 'YouTube', 'Instagram Reels', 'Music Publications']

// ✅ FIX 2: Generous timeout per individual request (25s).
// Your previous 8s timeout was shorter than a single Claude response can take.
const CLAUDE_TIMEOUT_MS = 25_000

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== STARTING TREND COLLECTION ===')

    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    // ✅ FIX 3: Check the Supabase error object, not just the data.
    if (genreError) throw new Error(`Supabase error: ${genreError.message}`)
    if (!genres || genres.length === 0) {
      return res.status(200).json({ success: true, message: 'No genres found' })
    }

    const genre = genres[0]
    console.log(`Processing genre: ${genre.name}`)

    // ✅ FIX 4: Call all platforms in PARALLEL instead of sequentially.
    // Sequential: 5 platforms x ~10s each = ~50s (always times out).
    // Parallel: all 5 fire at once, done in ~10-15s total.
    const results = await Promise.allSettled(
      PLATFORMS.map(platform => researchTrendsForPlatform(genre.name, platform))
    )

    const allTrends = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTrends.push(...result.value)
      } else {
        // Log failures per platform but don't abort the whole job.
        console.error('Platform fetch failed:', result.reason?.message)
      }
    }

    console.log(`Got ${allTrends.length} total trends across all platforms`)

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
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: `Database insert error: ${insertError.message}` })
      }
    }

    return res.status(200).json({
      success: true,
      genre: genre.name,
      trendsProcessed: allTrends.length,
      platformResults: results.map((r, i) => ({
        platform: PLATFORMS[i],
        status: r.status,
        count: r.status === 'fulfilled' ? r.value.length : 0,
        error: r.status === 'rejected' ? r.reason?.message : undefined
      }))
    })

  } catch (error) {
    console.error('Handler error:', error.message)
    return res.status(500).json({ error: error.message })
  }
}

// ─── Per-platform Claude call ─────────────────────────────────────────────────

async function researchTrendsForPlatform(genre, platform) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // ✅ FIX 5: Fail fast with a clear message if the key is missing.
  // On Vercel, ANTHROPIC_API_KEY must be added in the dashboard under
  // Settings > Environment Variables — .env.local is NOT read by Vercel.
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

  // ✅ FIX 6: Use AbortController for timeout instead of axios.
  // The axios timeout option only covers the initial connection, not the full
  // response stream. AbortController cancels the whole fetch after the deadline.
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
    // ✅ FIX 7: Read the error body so you can actually see what went wrong
    // (e.g. invalid API key, rate limit, bad model name) instead of a silent hang.
    const errorBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text?.trim() ?? ''

  let parsed
  try {
    // Strip accidental markdown fences just in case
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    console.error(`JSON parse failed for ${platform}. Raw response:`, raw.slice(0, 200))
    return []  // ✅ Return empty rather than crashing the whole job
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