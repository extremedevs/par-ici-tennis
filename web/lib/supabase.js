import { createClient } from '@supabase/supabase-js'

let client

// Server-side only: uses the service_role key, never import from a client component
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis')
    }
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

// Throw on Supabase errors so failures are not silently ignored
export async function must(query) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}
