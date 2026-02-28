import { bookTennis } from './index.js'

// Handler Lambda
export const handler = async (event = {}) => {
  // Flags adaptés Lambda
  process.env.HEADLESS = process.env.HEADLESS ?? 'true'
  process.env.BLOCK_CAPTCHA = process.env.BLOCK_CAPTCHA ?? 'false'
  // Ecrire dans /tmp (stockage éphémère Lambda)
  process.env.OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/tmp'
  process.env.IMG_DIR = process.env.IMG_DIR ?? '/tmp'

  // Appel de ton job (scraping / réservation)
  await bookTennis()

  // Retour JSON simple
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}