// Run statuses sent by the booking Lambda (keep in sync with the SQL check constraint)
export const STATUS = {
  booked: { icon: '✅', label: 'Réservé', className: 'ok' },
  dry_run: { icon: '🧪', label: 'Dry-run OK', className: 'info' },
  not_found: { icon: '😕', label: 'Aucun créneau', className: 'warn' },
  error: { icon: '⚠️', label: 'Erreur', className: 'danger' },
}
