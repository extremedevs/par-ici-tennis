import { login } from './actions'

export const metadata = { title: 'Connexion · Par ici tennis' }

export default async function LoginPage({ searchParams }) {
  const { error, admin } = await searchParams

  return (
    <main className="login">
      <form action={login} className="card stack">
        <h1>🎾 Par ici tennis</h1>
        {admin && <p className="muted">Espace admin : mot de passe administrateur requis.</p>}
        <label className="field">
          <span>Mot de passe</span>
          <input type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {admin && <input type="hidden" name="admin" value="1" />}
        {error && <p className="error">Mot de passe incorrect.</p>}
        <button type="submit" className="primary">Se connecter</button>
      </form>
    </main>
  )
}
