'use client'

import { useEffect, useState } from 'react'
import { getTrendsByGenre, getGenres } from '@/lib/api'

export default function Home() {
  const [trends, setTrends] = useState({})
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const genreData = await getGenres()
        setGenres(genreData)
        
        const trendsData = await getTrendsByGenre()
        setTrends(trendsData)
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
    return <div className="loading">Loading trends...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>Music Trends Dashboard</h1>
          <p>Real-time trends across Spotify, TikTok, and Instagram Reels</p>
        </div>
      </header>

      <main className="container">
        {genres.length === 0 ? (
          <p>No genres available yet.</p>
        ) : (
          genres.map(genre => (
            <section key={genre.id} className="genre-section">
              <h2>{genre.name}</h2>
              
              {trends[genre.name] && trends[genre.name].length > 0 ? (
                <ul className="trends-list">
                  {trends[genre.name].map(trend => (
                    <li key={trend.id} className="trend-item">
                      <h3>{trend.trend_name}</h3>
                      <span className="trend-platform">{trend.platform}</span>
                      <span className={`trend-status ${trend.is_growing ? 'growing' : 'declining'}`}>
                        {trend.is_growing ? '📈 Growing' : '📉 Declining'}
                      </span>
                      {trend.trend_description && (
                        <p className="trend-description">{trend.trend_description}</p>
                      )}
                      <small style={{ color: '#999' }}>
                        Updated: {new Date(trend.last_updated).toLocaleDateString()}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No trends for {genre.name} yet.</p>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  )
}