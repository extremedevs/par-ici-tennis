import { NextResponse } from 'next/server'
import { hasRole } from '@/lib/auth'

export async function middleware(request) {
  const isAdmin = await hasRole(request.cookies, 'admin')

  if (request.nextUrl.pathname.startsWith('/admin')) {
    return isAdmin ? NextResponse.next() : NextResponse.redirect(new URL('/login?admin=1', request.url))
  }
  if (isAdmin || await hasRole(request.cookies, 'viewer')) {
    return NextResponse.next()
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // /api/runs uses its own bearer token
  matcher: ['/((?!login|api/runs|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
