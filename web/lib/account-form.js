import { WEEK_DAYS } from './aws'

export const PRICE_TYPES = ['Tarif plein', 'Tarif réduit']
export const COURT_TYPES = ['Découvert', 'Couvert']
export const PLAY_DAY_LABELS = { MON: 'Lun', TUE: 'Mar', WED: 'Mer', THU: 'Jeu', FRI: 'Ven', SAT: 'Sam', SUN: 'Dim' }
export const MAX_PLAYERS = 3

// The script books D+6 when it runs, so playing on day X means running on X+1
const shiftDay = (day, offset) => WEEK_DAYS[(WEEK_DAYS.indexOf(day) + offset + 7) % 7]
export const playDaysToRunDays = (days) => days.map((d) => shiftDay(d, 1))
export const runDaysToPlayDays = (days) => days.map((d) => shiftDay(d, -1))

// "Suzanne Lenglen: 5, 7" lines <-> config.locations (array, or object when courts are set)
export function locationsToText(locations = []) {
  if (Array.isArray(locations)) return locations.join('\n')
  return Object.entries(locations).map(([name, courts]) => (courts.length ? `${name}: ${courts.join(', ')}` : name)).join('\n')
}

function textToLocations(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const parsed = lines.map((line) => {
    const [name, courts = ''] = line.split(':')
    return [name.trim(), courts.split(',').map((c) => Number.parseInt(c, 10)).filter(Number.isInteger)]
  })
  return parsed.some(([, courts]) => courts.length) ? Object.fromEntries(parsed) : parsed.map(([name]) => name)
}

// config.date is D/MM/YYYY, <input type="date"> is YYYY-MM-DD
export function configDateToInput(date) {
  const [d, m, y] = (date || '').split('/')
  return y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ''
}

function inputDateToConfig(value) {
  const [y, m, d] = value.split('-')
  return `${Number(d)}/${m}/${y}`
}

// Build the account config from the form, keeping unknown keys of the previous config.
// Returns { error } or { id, config, runDays, enabled }.
export function parseAccountForm(formData, existing) {
  const get = (name) => String(formData.get(name) || '').trim()

  const id = existing ? existing.id : get('id').toLowerCase()
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return { error: 'Identifiant : lettres minuscules, chiffres et tirets uniquement.' }

  const email = get('email')
  const password = get('password') || existing?.config.account?.password
  if (!email || !password) return { error: 'Email et mot de passe tennis.paris.fr obligatoires.' }

  const locations = textToLocations(get('locations'))
  const hours = get('hours').split(/[\s,]+/).filter((h) => /^\d{1,2}$/.test(h))
  const priceType = formData.getAll('priceType').filter((t) => PRICE_TYPES.includes(t))
  const courtType = formData.getAll('courtType').filter((t) => COURT_TYPES.includes(t))
  if (!(Array.isArray(locations) ? locations : Object.keys(locations)).length || !hours.length || !priceType.length || !courtType.length) {
    return { error: 'Au moins un lieu, une heure, un tarif et un type de court.' }
  }

  const players = Array.from({ length: MAX_PLAYERS }, (_, i) => ({ lastName: get(`player${i}Last`), firstName: get(`player${i}First`) }))
    .filter((p) => p.lastName && p.firstName)

  const name = get('name') || id
  const topic = get('ntfyTopic')
  const previous = existing?.config ?? {}
  const config = {
    ...previous,
    name,
    account: { email, password },
    locations,
    hours,
    priceType,
    courtType,
    players,
    ntfy: { ...previous.ntfy, enable: Boolean(topic), topic, title: name },
  }
  if (get('date')) config.date = inputDateToConfig(get('date'))
  else delete config.date

  const playDays = formData.getAll('playDays').filter((d) => d in PLAY_DAY_LABELS)
  return { id, config, runDays: playDaysToRunDays(playDays), enabled: formData.get('enabled') === 'on' }
}
