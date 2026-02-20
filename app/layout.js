import './globals.css'

export const metadata = {
  title: 'Music Trends Dashboard',
  description: 'Real-time music industry trends for independent artists',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}