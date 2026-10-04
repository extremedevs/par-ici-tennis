import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccount, getSchedule } from '@/lib/aws'
import {
  COURT_TYPES, MAX_PLAYERS, PLAY_DAY_LABELS, PRICE_TYPES, configDateToInput, locationsToText, runDaysToPlayDays,
} from '@/lib/account-form'
import { deleteAccountAction, saveAccountAction } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function AccountPage({ params, searchParams }) {
  const { id } = await params
  const { error } = await searchParams
  const isNew = id === 'new'

  const [config, schedule] = isNew ? [{}, null] : await Promise.all([getAccount(id), getSchedule(id)])
  if (!config) notFound()

  const playDays = schedule ? runDaysToPlayDays(schedule.runDays) : []
  const players = Array.from({ length: MAX_PLAYERS }, (_, i) => config.players?.[i] ?? {})

  return (
    <div className="stack">
      <p><Link href="/admin">← Comptes</Link></p>
      <h1>{isNew ? 'Nouveau compte' : `Modifier ${config.name || id}`}</h1>
      {error && <p className="flash error">{error}</p>}

      <form action={saveAccountAction.bind(null, isNew ? null : id)} className="card form-grid">
        {isNew && (
          <label className="field">
            <span>Identifiant (SSM, non modifiable)</span>
            <input name="id" required pattern="[a-z0-9-]{1,40}" placeholder="jack" />
          </label>
        )}
        <label className="field">
          <span>Nom affiché (résultats et titre ntfy)</span>
          <input name="name" defaultValue={config.name} placeholder="Jack" />
        </label>

        <h2 className="full">Compte tennis.paris.fr</h2>
        <label className="field">
          <span>Email</span>
          <input type="email" name="email" required defaultValue={config.account?.email} />
        </label>
        <label className="field">
          {/* Never sent back to the browser: empty keeps the stored password */}
          <span>Mot de passe {isNew ? '' : '(vide = inchangé)'}</span>
          <input type="password" name="password" autoComplete="new-password" required={isNew} />
        </label>

        <h2 className="full">Réservation</h2>
        <label className="field full">
          <span>Lieux par ordre de préférence, un par ligne (option : « Lieu: 5, 7 » pour des courts précis)</span>
          <textarea name="locations" rows={4} required defaultValue={locationsToText(config.locations)} placeholder={'Suzanne Lenglen: 5, 7\nValeyre'} />
        </label>
        <label className="field">
          <span>Heures par ordre de préférence</span>
          <input name="hours" required defaultValue={(config.hours || []).join(', ')} placeholder="18, 19, 20" />
        </label>
        <label className="field">
          <span>Date fixe (sinon J+6 à chaque passage)</span>
          <input type="date" name="date" defaultValue={configDateToInput(config.date)} />
        </label>
        <fieldset className="field">
          <legend>Tarif (selon ton carnet)</legend>
          {PRICE_TYPES.map((t) => (
            <label key={t} className="check"><input type="checkbox" name="priceType" value={t} defaultChecked={isNew || config.priceType?.includes(t)} /> {t}</label>
          ))}
        </fieldset>
        <fieldset className="field">
          <legend>Type de court</legend>
          {COURT_TYPES.map((t) => (
            <label key={t} className="check"><input type="checkbox" name="courtType" value={t} defaultChecked={isNew || config.courtType?.includes(t)} /> {t}</label>
          ))}
        </fieldset>

        <h2 className="full">Joueurs (sans toi, {MAX_PLAYERS} max)</h2>
        {players.map((p, i) => (
          <div key={i} className="row full">
            <input name={`player${i}Last`} defaultValue={p.lastName} placeholder="Nom" aria-label={`Nom joueur ${i + 1}`} />
            <input name={`player${i}First`} defaultValue={p.firstName} placeholder="Prénom" aria-label={`Prénom joueur ${i + 1}`} />
          </div>
        ))}

        <h2 className="full">Planning et notifications</h2>
        <fieldset className="field full">
          <legend>Jours où tu joues (la Lambda tourne 6 jours avant, à 7h59)</legend>
          <div className="row wrap">
            {Object.entries(PLAY_DAY_LABELS).map(([day, label]) => (
              <label key={day} className="check"><input type="checkbox" name="playDays" value={day} defaultChecked={playDays.includes(day)} /> {label}</label>
            ))}
          </div>
        </fieldset>
        <label className="check full">
          <input type="checkbox" name="enabled" defaultChecked={isNew || schedule?.enabled} /> Planning actif
        </label>
        <label className="field full">
          <span>Topic ntfy (vide = pas de notification)</span>
          <input name="ntfyTopic" defaultValue={config.ntfy?.topic} />
        </label>

        <button type="submit" className="primary full">Enregistrer</button>
      </form>

      {!isNew && (
        <form action={deleteAccountAction.bind(null, id)} className="card stack">
          <h2>Supprimer le compte</h2>
          <p className="muted small">Supprime le paramètre SSM et le planning. Tape <code>{id}</code> pour confirmer.</p>
          <div className="row">
            <input name="confirm" placeholder={id} aria-label="Confirmation" />
            <button type="submit" className="danger">Supprimer</button>
          </div>
        </form>
      )}
    </div>
  )
}
