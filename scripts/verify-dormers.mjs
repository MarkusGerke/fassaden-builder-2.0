/**
 * Rauchtest der Gauben-Bedienung: App startet ohne Fehler, Formliste ist gefüllt,
 * alle Felder der rechten Leiste sind vorhanden.
 * Aufruf: `node scripts/verify-dormers.mjs` (Dev-Server läuft, Port über `E2E_URL`).
 */
import { chromium } from 'playwright'

const BASE = process.env.E2E_URL || 'http://127.0.0.1:5178/'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#app-version-btn', { state: 'attached', timeout: 45000 })
await page.waitForFunction(
  () => {
    const el = document.getElementById('app-loading')
    return !el || el.classList.contains('is-done')
  },
  null,
  { timeout: 60000 },
)

const ids = [
  'roof-dormer-width',
  'roof-dormer-height',
  'roof-dormer-depth',
  'roof-dormer-overhang',
  'roof-dormer-wall',
  'roof-dormer-kind',
  'roof-dormer-pitch',
  'roof-dormer-rise',
  'roof-dormer-tilt',
  'roof-dormer-eave-distance',
  'roof-dormer-eave-along',
  'roof-dormer-eave-break',
  'roof-dormer-window-on',
  'roof-dormer-window-width',
  'roof-dormer-window-height',
  'roof-dormer-window-sill',
  'roof-dormer-window-x',
]

const result = await page.evaluate((list) => {
  const select = document.querySelector('#roof-dormer-kind')
  return {
    missing: list.filter((id) => !document.getElementById(id)),
    kinds: select ? [...select.options].map((o) => `${o.value}=${o.textContent}`) : [],
  }
}, ids)

console.log('Fehlende Felder:', result.missing)
console.log('Gaubenformen:', result.kinds.join('\n  '))
console.log('Konsolenfehler:', errors.length ? errors : 'keine')
await browser.close()

if (result.missing.length || result.kinds.length !== 10 || errors.length) process.exit(1)
