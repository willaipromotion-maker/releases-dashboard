import { supabase } from '@/lib/supabase'

export const config = {
  api: { bodyParser: false },
  maxDuration: 300,
  runtime: 'nodejs'
}

export default async function handler(req, res) {
  // Vercel crons send GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Basic security: verify the request is coming from Vercel's cron scheduler
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('=== CRON: STARTING FULL TREND COLLECTION ===')

  const { data: genres, error: genreError } = await supabase
    .from('genres')
    .select('*')
    .order('name')

  if (genreError) {
    console.error('Failed to fetch genres:', genreError.message)
    return res.status(500).json({ error: `Supabase error: ${genreError.message}` })
  }

  if (!genres || genres.length === 0) {
    return res.status(200).json({ success: true, message: 'No genres found' })
  }

  console.log(`Processing ${genres.length} genres`)

  const results = []

  for (const genre of genres) {
    console.log(`--- Starting genre: ${genre.name} ---`)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/collect-trends`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre: genre.name })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const trendsProcessed = data.results?.[0]?.trendsProcessed ?? 0
      console.log(`✓ ${genre.name}: ${trendsProcessed} trends`)
      results.push({ genre: genre.name, status: 'success', trendsProcessed })

    } catch (error) {
      // Log the failure but continue to next genre
      console.error(`✗ ${genre.name}: ${error.message}`)
      results.push({ genre: genre.name, status: 'failed', error: error.message })
    }
  }

  const succeeded = results.filter(r => r.status === 'success').length
  const failed = results.filter(r => r.status === 'failed').length

  console.log(`=== CRON COMPLETE: ${succeeded} succeeded, ${failed} failed ===`)

  return res.status(200).json({
    success: true,
    summary: { succeeded, failed, total: genres.length },
    results
  })
}