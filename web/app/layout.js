import './globals.css'

export const metadata = {
  title: 'Par ici tennis',
  description: 'Résultats des réservations tennis.paris.fr par compte',
  icons: { icon: '/icon.svg' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f7a4d',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
