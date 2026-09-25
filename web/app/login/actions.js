'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, safeEqual, sessionToken } from '@/lib/auth'

export async function login(formData) {
  const expected = process.env.APP_PASSWORD
  if (!expected || !safeEqual(String(formData.get('password') || ''), expected)) {
    redirect('/login?error=1')
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect('/')
}
