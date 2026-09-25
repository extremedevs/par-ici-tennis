const TZ = 'Europe/Paris'

// YYYY-MM-DD in Paris time
export function parisDate(ts = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts))
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function formatDateTime(ts) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(new Date(ts))
}

