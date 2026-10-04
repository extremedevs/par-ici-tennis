import Link from 'next/link'
import { logout } from '../actions'

export const metadata = { title: 'Admin · Par ici tennis' }

export default function AdminLayout({ children }) {
  return (
    <>
      <header className="topbar">
        <Link href="/admin" className="brand">🎾 Admin</Link>
        <nav className="row">
          <Link href="/">Résultats</Link>
          <form action={logout}><button type="submit" className="link">Déconnexion</button></form>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  )
}
