'use client'

import { useEffect, useState } from 'react'
import { getTrendsByGenre, getGenres, getTrendHistory } from '@/lib/api'
import ReleasesDashboard from '@/components/ReleasesDashboard'

export default function Home() {
  const [trends, setTrends] = useState({})
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        const [genreData, rawTrends] = await Promise.all([
          getGenres(),
          getTrendsByGenre()
        ])

        setGenres(genreData)

        // Reshape data to match component format:
        // { [genreId]: { [platform]: [ ...trends with history ] } }
        const shaped = {}

        for (const genre of genreData) {
          shaped[genre.id] = {}
          const genreTrends = rawTrends[genre.name] || []

          for (const platform of ['Spotify', 'TikTok', 'YouTube', 'Instagram Reels']) {
            const platformTrends = genreTrends.filter(t => t.platform === platform)

            // Fetch history for each trend in parallel
            const trendsWithHistory = await Promise.all(
              platformTrends.map(async (trend) => ({
                ...trend,
                history: await getTrendHistory(trend.id)
              }))
            )

            shaped[genre.id][platform] = trendsWithHistory
          }
        }

        setTrends(shaped)
      } catch (err) {
        setError('Failed to load trends. Please try again.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0E0C08',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Mono', monospace",
        color: '#5A5448',
        fontSize: '13px',
        letterSpacing: '0.1em'
      }}>
        LOADING TRENDS...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0E0C08',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Mono', monospace",
        color: '#E07070',
        fontSize: '13px'
      }}>
        {error}
      </div>
    )
  }

  return <ReleasesDashboard genres={genres} trends={trends} />
}