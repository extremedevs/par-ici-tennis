'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { roleCookie, roleForPassword, sessionToken } from '@/lib/auth'

export async function login(formData) {
  const role = roleForPassword(String(formData.get('password') || ''))
  if (!role) redirect(`/login?error=1${formData.get('admin') ? '&admin=1' : ''}`)

  const store = await cookies()
  store.set(roleCookie(role), await sessionToken(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect(role === 'admin' && formData.get('admin') ? '/admin' : '/')
}
