// Edge-compatible helpers (used by middleware, route handlers and server actions)

export const SESSION_COOKIE = 'pit_session'
export const ADMIN_COOKIE = 'pit_admin'

// viewer: read-only dashboard, admin: also manages AWS accounts and schedules
const ROLES = {
  viewer: { secretEnv: 'APP_PASSWORD', cookie: SESSION_COOKIE, label: 'par-ici-tennis-session' },
  admin: { secretEnv: 'ADMIN_PASSWORD', cookie: ADMIN_COOKIE, label: 'par-ici-tennis-admin' },
}

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

async function computeToken(secret, label) {
  if (!secret) return null
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(label)))
}

const tokens = {}

// Cookie value = HMAC(password), changing a password logs out that role.
// Passwords are fixed per deployment, so compute each token once per instance.
export function sessionToken(role = 'viewer') {
  const { secretEnv, label } = ROLES[role]
  return (tokens[role] ??= computeToken(process.env[secretEnv], label))
}

export const roleCookie = (role) => ROLES[role].cookie

// Admin first: the admin password also opens the dashboard
export function roleForPassword(password) {
  return ['admin', 'viewer'].find((role) => {
    const expected = process.env[ROLES[role].secretEnv]
    return expected && safeEqual(password, expected)
  })
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isValidSession(value, role = 'viewer') {
  return safeEqual(value, await sessionToken(role))
}

// cookies: anything with get(name)?.value (request.cookies or next/headers cookies())
export async function hasRole(cookies, role) {
  return isValidSession(cookies.get(roleCookie(role))?.value, role)
}

export function bearerMatches(request, secret) {
  const header = request.headers.get('authorization') || ''
  return Boolean(secret) && header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)
}
