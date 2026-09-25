// Edge-compatible helpers (used by middleware and route handlers)

export const SESSION_COOKIE = 'pit_session'

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

async function computeSessionToken() {
  const secret = process.env.APP_PASSWORD
  if (!secret) return null
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode('par-ici-tennis-session')))
}

let tokenPromise

// Session cookie value = HMAC(APP_PASSWORD), changing the password logs everyone out.
// APP_PASSWORD is fixed per deployment, so compute it once per instance.
export function sessionToken() {
  return (tokenPromise ??= computeSessionToken())
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isValidSession(value) {
  return safeEqual(value, await sessionToken())
}

export function bearerMatches(request, secret) {
  const header = request.headers.get('authorization') || ''
  return Boolean(secret) && header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)
}
