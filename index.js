import { chromium } from 'playwright'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { writeFileSync } from 'fs'
import { createEvent } from 'ics'
import { config } from './staticFiles.js'
import { notify } from './lib/ntfy.js'

dayjs.extend(customParseFormat)

const bookTennis = async () => {
  const DRY_RUN_MODE = process.argv.includes('--dry-run')
  if (DRY_RUN_MODE) {
    console.log('----- DRY RUN START -----')
    console.log('Script lancé en mode DRY RUN. Afin de tester votre configuration, une recherche va être lancé mais AUCUNE réservation ne sera réalisée')
  }

  console.log(`${dayjs().format()} - Starting searching tennis`)

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false', // bascule par ENV
    slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
    timeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-dev-tools',
      '--single-process',
      '--disable-popup-blocking',
      '--disable-background-networking',
    ]
  })

  console.log(`${dayjs().format()} - Browser started`)

  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    // (optionnel) trace
    if (process.env.TRACE === 'true') {
      await context.tracing.start({ screenshots: true, snapshots: true })
    }

    await page.route('https://captcha.liveidentity.com/captcha/public/frontend/api/v3/captcha-invisible/invisible-captcha-infos', (route) => route.abort())
    await page.route('https://captcha.liveidentity.com/captcha/public/frontend/api/v3/captchas**', (route) => route.abort())
    page.setDefaultTimeout(60000)
    await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennis&view=start&full=1')

    await page.click('#button_suivi_inscription')
    await page.fill('#username', config?.account?.email || process.env.ACCOUNT_EMAIL)
    await page.fill('#password', config?.account?.password || process.env.ACCOUNT_PASSWORD)
    await page.click('#form-login >> button')

    console.log(`${dayjs().format()} - User connected`)

    // wait for login redirection before continue
    await page.waitForSelector('.main-informations')

    try {
      const locations = !Array.isArray(config.locations) ? Object.keys(config.locations) : config.locations
      let reserved = false
      locationsLoop:
      for (const location of locations) {
        console.log(`${dayjs().format()} - Search at ${location}`)
        await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&view=recherche_creneau#!')

        // select tennis location
        await page.locator('.tokens-input-text').pressSequentially(`${location} `)
        await page.waitForSelector(`.tokens-suggestions-list-element >> text="${location}"`)
        await page.click(`.tokens-suggestions-list-element >> text="${location}"`)

        // select date
        await page.click('#when')
        const date = config.date ? dayjs(config.date, 'D/MM/YYYY') : dayjs().add(6, 'days')
        await page.waitForSelector(`[dateiso="${date.format('DD/MM/YYYY')}"]`)
        await page.click(`[dateiso="${date.format('DD/MM/YYYY')}"]`)
        await page.waitForSelector('.date-picker', { state: 'hidden' })

        await page.click('#rechercher')

        // wait until the results page is fully loaded before continue
        await page.waitForLoadState('domcontentloaded')

        let selectedHour
        hoursLoop:
        for (const hour of config.hours) {
          const dateDeb = `[datedeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
          if (await page.$(dateDeb)) {
            if (await page.isHidden(dateDeb)) {
              await page.click(`#head${location.replaceAll(' ', '')}${hour}h .panel-title`)
            }

            const courtNumbers = !Array.isArray(config.locations) ? config.locations[location] : []
            const slots = await page.$$(dateDeb)
            for (const slot of slots) {
              const bookSlotButton = `[courtid="${await slot.getAttribute('courtid')}"]${dateDeb}`
              if (courtNumbers.length > 0) {
                const courtName = (await (await page.$(`.court:left-of(${bookSlotButton})`)).innerText()).trim()
                if (!courtNumbers.includes(parseInt(courtName.match(/Court N°(\d+)/)[1]))) {
                  continue
                }
              }

              const [priceType, courtType] = (await (await page.$(`.price-description:left-of(${bookSlotButton})`)).innerHTML()).split('<br>')
              if (!config.priceType.includes(priceType) || !config.courtType.includes(courtType)) {
                continue
              }
              selectedHour = hour
              await page.click(bookSlotButton)

              break hoursLoop
            }
          }
        }

        if (await page.title() !== 'Paris | TENNIS - Reservation') {
          console.log(`${dayjs().format()} - Failed to find reservation for ${location}`)
          continue
        }

        await page.waitForSelector('.order-steps-infos h2 >> text="1 / 3 - Validation du court"')

        for (const [i, player] of config.players.entries()) {
          if (i > 0) {
            await page.click('.addPlayer')
          }
          await page.waitForSelector(`[name="player${i + 1}"]`)
          await page.fill(`[name="player${i + 1}"] >> nth=0`, player.lastName)
          await page.fill(`[name="player${i + 1}"] >> nth=1`, player.firstName)
        }

        await page.keyboard.press('Enter')

        await page.waitForSelector('#order_select_payment_form #paymentMode', { state: 'attached' })
        const paymentMode = await page.$('#order_select_payment_form #paymentMode')
        await paymentMode.evaluate(el => {
          el.removeAttribute('readonly')
          el.style.display = 'block'
        })
        await paymentMode.fill('existingTicket')

        if (DRY_RUN_MODE) {
          console.log(`${dayjs().format()} - Fausse réservation faite : ${location}`)
          console.log(`pour le ${date.format('YYYY/MM/DD')} à ${selectedHour}h`)
          console.log('----- DRY RUN END -----')
          console.log('Pour réellement réserver un crénau, relancez le script sans le paramètre --dry-run')

          await page.click('#previous')
          await page.click('#btnCancelBooking')

          break locationsLoop
        }

        const submit = await page.$('#order_select_payment_form #envoyer')
        submit.evaluate(el => el.classList.remove('hide'))
        await submit.click()

        await page.waitForSelector('.confirmReservation')

        // Extract reservation details
        const address = (await (await page.$('.address')).textContent()).trim().replace(/( ){2,}/g, ' ')
        const dateStr = (await (await page.$('.date')).textContent()).trim().replace(/( ){2,}/g, ' ')
        const court = (await (await page.$('.court')).textContent()).trim().replace(/( ){2,}/g, ' ')

        console.log(`${dayjs().format()} - Réservation faite : ${address}`)
        console.log(`pour le ${dateStr}`)
        console.log(`sur le ${court}`)

        const [day, month, year] = [date.date(), date.month() + 1, date.year()]
        const hourMatch = dateStr.match(/(\d{2})h/)
        const hour = hourMatch ? Number(hourMatch[1]) : 12
        const start = [year, month, day, hour, 0]
        const duration = { hours: 1, minutes: 0 }
        const event = {
          start,
          duration,
          title: 'Réservation Tennis',
          description: `Court: ${court}\nAdresse: ${address}`,
          location: address,
          status: 'CONFIRMED',
        }
        createEvent(event, async (error, value) => {
          if (error) {
            console.log('ICS creation error:', error)
            return
          }

          writeFileSync(`${process.env.OUTPUT_DIR ?? '.'}/event.ics`, value)
          if (config.ntfy?.enable === true || process.env.NTFY_TOPIC) {
            await notify(Buffer.from(value, 'utf8'), 'event.ics',
              `Confirmation pour le ${date.format('DD/MM/YYYY')} - ${hour}h`, {
              domain: config?.ntfy?.domain || process.env.NTFY_DOMAIN,
              topic: config?.ntfy?.topic || process.env.NTFY_TOPIC,
            })
          }
        })
        reserved = true
        break
      }

      if (!reserved && (config.ntfy?.enable === true || process.env.NTFY_TOPIC)) {
        await notify(null, null, 'Aucun creneau disponible pour aujourd\'hui.', {
          domain: config?.ntfy?.domain || process.env.NTFY_DOMAIN,
          topic: config?.ntfy?.topic || process.env.NTFY_TOPIC,
        })
      }
    } catch (e) {
      console.log(e)
      const screenshot = await page.screenshot({ path: `${process.env.IMG_DIR ?? 'img'}/failure.png` })

      if (config.ntfy?.enable === true || process.env.NTFY_TOPIC) {
        await notify(screenshot, 'failure.png', 'Erreur lors de l\'execution du programme.', {
          domain: config?.ntfy?.domain || process.env.NTFY_DOMAIN,
          topic: config?.ntfy?.topic || process.env.NTFY_TOPIC,
        })
      }
    }

  } catch (e) {
    console.log('ERROR:', e)
    await page.screenshot({ path: `${process.env.IMG_DIR ?? 'img'}/failure.png` })
  }
  finally {
    try {
      if (process.env.TRACE === 'true') {
        await context.tracing.stop({ path: `${process.env.OUTPUT_DIR ?? 'out'}/trace.zip` })
        console.log("TRACE saved → out/trace.zip")
      }
    } catch (e) {
      console.log("Failed to save trace:", e)
    }

    await browser.close()
  }

}

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  bookTennis()
}

export { bookTennis }