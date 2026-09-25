import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/auth'
import { db, must } from '@/lib/supabase'
import { STATUS } from '@/lib/status'

export const dynamic = 'force-dynamic'

const STATUSES = Object.keys(STATUS)
const text = (v, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// Called by the booking Lambda at the end of each run (lib/tracker.js)
export async function POST(request) {
  if (!bearerMatches(request, process.env.TRACKER_TOKEN)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const account = text(payload.account, 100)
  if (!account || !STATUSES.includes(payload.status)) {
    return NextResponse.json({ error: `account and status (${STATUSES.join(', ')}) are required` }, { status: 400 })
  }
  const hour = Number.parseInt(payload.hour, 10)

  await must(db().from('runs').insert({
    account,
    status: payload.status,
    target_date: /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : null,
    hour: hour >= 0 && hour <= 23 ? hour : null,
    location: text(payload.location),
    court: text(payload.court),
    address: text(payload.address),
    message: text(payload.message, 2000),
  }))

  return new NextResponse(null, { status: 201 })
}
