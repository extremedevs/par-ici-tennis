import { login } from './actions'

export const metadata = { title: 'Connexion · Par ici tennis' }

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams

  return (
    <main className="login">
      <form action={login} className="card stack">
        <h1>🎾 Par ici tennis</h1>
        <label className="field">
          <span>Mot de passe</span>
          <input type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && <p className="error">Mot de passe incorrect.</p>}
        <button type="submit" className="primary">Se connecter</button>
      </form>
    </main>
  )
}
