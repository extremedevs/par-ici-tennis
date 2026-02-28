import { bookTennis } from './index.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const waitUntil8AM = () => {
  if (process.env.SKIP_WAIT === 'true') {
    console.log('SKIP_WAIT=true — skipping wait until 8 AM')
    return Promise.resolve()
  }
  const now = dayjs().tz('Europe/Paris')
  const target = now.hour(8).minute(0).second(0).millisecond(0)
  const waitMs = target.diff(now)
  if (waitMs <= 0) return Promise.resolve()
  console.log(`Waiting ${waitMs}ms until 8:00 AM Paris time (${target.format()})`)
  return new Promise(resolve => setTimeout(resolve, waitMs))
}

// Handler Lambda
export const handler = async (event = {}) => {
  // Flags adaptés Lambda
  process.env.HEADLESS = process.env.HEADLESS ?? 'true'
  process.env.BLOCK_CAPTCHA = process.env.BLOCK_CAPTCHA ?? 'false'
  // Ecrire dans /tmp (stockage éphémère Lambda)
  process.env.OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/tmp'
  process.env.IMG_DIR = process.env.IMG_DIR ?? '/tmp'

  // Attendre 8h00 pile (heure Paris) — Lambda schedulée à 7h59
  await waitUntil8AM()

  // Appel de ton job (scraping / réservation)
  await bookTennis()

  // Retour JSON simple
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}