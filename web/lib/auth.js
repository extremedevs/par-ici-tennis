// Edge-compatible helpers (used by middleware and route handlers)

export const SESSION_COOKIE = 'pit_session'

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

// Session cookie value = HMAC(APP_PASSWORD), changing the password logs everyone out
export async function sessionToken() {
  const secret = process.env.APP_PASSWORD
  if (!secret) return null
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode('par-ici-tennis-session')))
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isValidSession(value) {
  const expected = await sessionToken()
  return Boolean(expected) && safeEqual(value, expected)
}

export function bearerMatches(request, secret) {
  const header = request.headers.get('authorization') || ''
  return Boolean(secret) && header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)
}
