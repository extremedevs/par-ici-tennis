import { db, must } from '@/lib/supabase'
import { formatDate, formatDateTime, parisDate } from '@/lib/dates'
import { STATUS } from '@/lib/status'
import { logout } from './actions'

export const dynamic = 'force-dynamic'

function slot(run) {
  return [
    run.target_date && formatDate(run.target_date),
    run.hour != null && `${run.hour}h`,
    run.location,
    run.court,
  ].filter(Boolean).join(' · ')
}

export default async function Home() {
  const today = parisDate()
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const runs = await must(db().from('runs')
    .select('id, created_at, account, status, target_date, hour, location, court, address, message')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000))

  // runs are sorted newest first, so each account's first run is its latest
  const accounts = new Map()
  for (const run of runs) {
    if (!accounts.has(run.account)) accounts.set(run.account, [])
    accounts.get(run.account).push(run)
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">🎾 Par ici tennis</span>
        <form action={logout}><button type="submit" className="link">Déconnexion</button></form>
      </header>
      <main className="container">
        <h1>Résultats du {formatDate(today)}</h1>
        {accounts.size === 0 && (
          <p className="muted">Aucun résultat reçu sur les 30 derniers jours. Vérifie <code>TRACKER_URL</code> et <code>TRACKER_TOKEN</code> sur la Lambda.</p>
        )}

        <div className="grid">
          {[...accounts].map(([account, accountRuns]) => {
            const latest = accountRuns[0]
            const ranToday = parisDate(latest.created_at) === today
            const status = STATUS[latest.status]
            const latestSlot = slot(latest)
            const upcoming = accountRuns.filter((r) => r.status === 'booked' && r.target_date >= today)

            return (
              <article key={account} className={`card ${ranToday ? status.className : ''}`}>
                <h2>{account}</h2>
                {ranToday ? (
                  <>
                    <p className="status">{status.icon} {status.label}</p>
                    {latest.status !== 'error' && latestSlot && <p>{latestSlot}</p>}
                    {latest.address && <p className="muted">{latest.address}</p>}
                    {latest.message && <pre className="message">{latest.message}</pre>}
                  </>
                ) : (
                  <p className="status">⏳ Pas encore de résultat aujourd’hui</p>
                )}

                {upcoming.length > 0 && (
                  <>
                    <h3>Matchs à venir</h3>
                    <ul className="list">
                      {upcoming.map((r) => <li key={r.id}>{slot(r)}</li>)}
                    </ul>
                  </>
                )}

                <details>
                  <summary>Historique ({accountRuns.length})</summary>
                  <ul className="list">
                    {accountRuns.map((r) => (
                      <li key={r.id}>
                        <span className="muted small">{formatDateTime(r.created_at)}</span>{' '}
                        {STATUS[r.status].icon} {STATUS[r.status].label}
                        {r.status === 'booked' && ` — ${slot(r)}`}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            )
          })}
        </div>
      </main>
    </>
  )
}
