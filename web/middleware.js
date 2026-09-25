import { NextResponse } from 'next/server'
import { SESSION_COOKIE, isValidSession } from '@/lib/auth'

export async function middleware(request) {
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next()
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // /api/runs uses its own bearer token
  matcher: ['/((?!login|api/runs|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
