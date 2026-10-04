'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { hasRole } from '@/lib/auth'
import { deleteAccount, deleteSchedule, getAccount, getSchedule, saveAccount, saveSchedule } from '@/lib/aws'
import { parseAccountForm } from '@/lib/account-form'

// Server actions are public endpoints: re-check the role besides the middleware
async function requireAdmin() {
  if (!(await hasRole(await cookies(), 'admin'))) redirect('/login?admin=1')
}

const fail = (path, message) => redirect(`${path}?error=${encodeURIComponent(message)}`)

export async function saveAccountAction(existingId, formData) {
  await requireAdmin()
  const formPath = `/admin/accounts/${existingId ?? 'new'}`

  let existing = null
  if (existingId) {
    const config = await getAccount(existingId)
    if (!config) fail('/admin', `Compte ${existingId} introuvable`)
    existing = { id: existingId, config }
  }

  const parsed = parseAccountForm(formData, existing)
  if (parsed.error) fail(formPath, parsed.error)
  if (!existingId && await getAccount(parsed.id)) fail(formPath, `Le compte ${parsed.id} existe déjà`)

  await saveAccount(parsed.id, parsed.config)
  if (parsed.runDays.length) {
    await saveSchedule(parsed.id, { runDays: parsed.runDays, enabled: parsed.enabled })
  } else {
    await deleteSchedule(parsed.id)
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function setScheduleEnabled(id, enabled) {
  await requireAdmin()
  const schedule = await getSchedule(id)
  if (schedule) await saveSchedule(id, { runDays: schedule.runDays, enabled })
  revalidatePath('/admin')
}

export async function deleteAccountAction(id, formData) {
  await requireAdmin()
  if (formData.get('confirm') !== id) fail(`/admin/accounts/${id}`, `Tape « ${id} » pour confirmer la suppression`)
  await deleteSchedule(id)
  await deleteAccount(id)
  revalidatePath('/admin')
  redirect('/admin')
}
