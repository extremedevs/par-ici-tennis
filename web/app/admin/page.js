import Link from 'next/link'
import { awsConfigured, getSchedule, listAccounts } from '@/lib/aws'
import { PLAY_DAY_LABELS, locationsToText, runDaysToPlayDays } from '@/lib/account-form'
import { setScheduleEnabled } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!awsConfigured()) {
    return (
      <div className="card stack">
        <h1>Configuration AWS manquante</h1>
        <p>Ajoute dans Vercel : <code>PIT_AWS_ACCESS_KEY_ID</code>, <code>PIT_AWS_SECRET_ACCESS_KEY</code>, <code>LAMBDA_ARN</code> et <code>SCHEDULER_ROLE_ARN</code> (voir <code>web/README.md</code>).</p>
      </div>
    )
  }

  const accounts = await listAccounts()
  const schedules = await Promise.all(accounts.map(({ id }) => getSchedule(id)))

  return (
    <>
      <div className="row between">
        <h1>Comptes ({accounts.length})</h1>
        <Link href="/admin/accounts/new" className="button primary">+ Nouveau compte</Link>
      </div>
      <p className="muted small">1 compte = 1 réservation possible par jour. Chaque compte a son planning qui lance la Lambda à 7h59 (heure de Paris).</p>

      {accounts.length === 0 && <p className="muted">Aucun compte dans <code>/par-ici-tennis/accounts/</code>.</p>}

      <div className="grid">
        {accounts.map(({ id, config }, i) => {
          const schedule = schedules[i]
          const playDays = schedule ? runDaysToPlayDays(schedule.runDays) : []
          const state = !schedule ? 'Pas de planning' : schedule.enabled ? 'Actif' : 'En pause'

          return (
            <article key={id} className={`card ${schedule?.enabled ? 'ok' : ''}`}>
              <div className="row between">
                <h2>{config.name || id}</h2>
                <span className={`badge ${schedule?.enabled ? 'ok' : ''}`}>{state}</span>
              </div>
              <p className="muted small">{config.account?.email}</p>
              <p>{locationsToText(config.locations).split('\n').join(' · ')}</p>
              <p className="muted">
                {(config.hours || []).map((h) => `${h}h`).join(', ')}
                {config.date ? ` · date fixe ${config.date}` : playDays.length > 0 && ` · joue ${Object.keys(PLAY_DAY_LABELS).filter((d) => playDays.includes(d)).map((d) => PLAY_DAY_LABELS[d]).join(', ')}`}
              </p>
              <div className="row">
                <Link href={`/admin/accounts/${id}`} className="button">Modifier</Link>
                {schedule && (
                  <form action={setScheduleEnabled.bind(null, id, !schedule.enabled)}>
                    <button type="submit">{schedule.enabled ? 'Mettre en pause' : 'Activer'}</button>
                  </form>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
