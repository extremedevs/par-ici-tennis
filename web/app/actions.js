'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, SESSION_COOKIE } from '@/lib/auth'

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(ADMIN_COOKIE)
  redirect('/login')
}
