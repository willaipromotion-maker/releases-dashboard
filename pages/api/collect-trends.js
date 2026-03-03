import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: genres } = await supabase.from('genres').select('*').limit(1)
    const genre = genres[0]

    const mockTrends = [
      {
        platform: 'Spotify',
        trend_name: 'Melodic Rap',
        trend_description: 'Rap with sung hooks and emotional delivery',
        is_growing: true,
        data_value: 8500
      },
      {
        platform: 'TikTok',
        trend_name: 'Viral Challenges',
        trend_description: 'Dance and lip-sync challenges',
        is_growing: true,
        data_value: 9200
      },
      {
        platform: 'Instagram Reels',
        trend_name: 'Aesthetic Shorts',
        trend_description: 'Mood and lifestyle content',
        is_growing: true,
        data_value: 7800
      }
    ]

    const { error: insertError } = await supabase
      .from('trends')
      .insert(
        mockTrends.map(trend => ({
          genre_id: genre.id,
          platform: trend.platform,
          trend_name: trend.trend_name,
          trend_description: trend.trend_description,
          is_growing: trend.is_growing,
          data_value: trend.data_value,
          last_updated: new Date().toISOString()
        }))
      )

    return res.status(200).json({
      success: true,
      genre: genre.name,
      trendsProcessed: mockTrends.length
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}