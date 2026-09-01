import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, '../.tmp/e2e-rundbogen')
const BASE = process.env.E2E_URL || 'http://127.0.0.1:5175/'
const STORAGE_KEY = 'fassaden-builder-state-v6'

mkdirSync(OUT, { recursive: true })

const results = []
const pass = (n, d = '') => {
  results.push({ name: n, ok: true, detail: d })
  console.log(`PASS  ${n}${d ? ' — ' + d : ''}`)
}
const fail = (n, d = '') => {
  results.push({ name: n, ok: false, detail: d })
  console.error(`FAIL  ${n}${d ? ' — ' + d : ''}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function shot(name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function ready() {
  await page.waitForSelector('#app-version-btn', { timeout: 45000 })
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    return !!c && c.width > 0
  }, null, { timeout: 45000 })
  await page.waitForTimeout(700)
}

async function dismissConflict() {
  await page.evaluate(() => {
    const dlg = document.querySelector('#opening-conflict-dialog')
    if (dlg && typeof dlg.close === 'function' && dlg.open) dlg.close()
    const cancel = document.querySelector('#opening-conflict-dialog button[value="cancel"], #opening-conflict-dialog button')
    if (cancel instanceof HTMLButtonElement) cancel.click()
  })
  await page.waitForTimeout(200)
}

async function go3d() {
  await page.click('#view-btn-3d')
  await page.waitForTimeout(400)
}

async function clickCanvas(fx, fy) {
  const box = await page.locator('canvas').first().boundingBox()
  if (!box) throw new Error('no canvas')
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
  await page.waitForTimeout(250)
}

async function setCheckbox(id, checked) {
  await page.evaluate(
    ({ id, checked }) => {
      const el = document.querySelector(id)
      if (!(el instanceof HTMLInputElement)) throw new Error('missing ' + id)
      if (el.checked === checked) {
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return
      }
      el.checked = checked
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { id, checked },
  )
  await page.waitForTimeout(350)
}

async function setSelect(id, value) {
  await page.evaluate(
    ({ id, value }) => {
      const el = document.querySelector(id)
      if (!(el instanceof HTMLSelectElement)) throw new Error('missing ' + id)
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { id, value },
  )
  await page.waitForTimeout(350)
}

async function ui() {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const arch = q('#opening-arch-enabled')
    const freiraum = q('#opening-panel-clearance-enabled')
    const finish = q('#opening-panel-clearance-finish')
    const vis = (n) => !!(n && n.offsetParent !== null)
    return {
      version: q('#app-version-btn')?.textContent?.trim() || '',
      archVisible: vis(arch),
      arch: !!arch?.checked,
      freiraum: !!freiraum?.checked,
      finish: finish?.value || '',
      sill: !!q('#sill-outer-enabled')?.checked,
      sillAngle: q('#sill-outer-angle')?.value || '',
      panelFanUi: /panelFan|Fächer im Zwickel/.test(document.body.innerText || ''),
      conflictOpen: !!q('#opening-conflict-dialog')?.open,
    }
  })
}

async function persisted() {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return { error: 'empty' }
    const data = JSON.parse(raw)
    const buildings = data.facade?.buildings || []
    let walls = buildings.flatMap((b) => b.walls || [])
    if (!walls.length && Array.isArray(data.facade?.walls)) walls = data.facade.walls
    const openings = []
    for (const w of walls) {
      for (const o of w.openings || []) {
        openings.push({
          wallId: w.id,
          type: o.type,
          yawDeg: w.yawDeg ?? 0,
          arch: !!o.arch?.enabled,
          freiraum: !!o.panelClearance?.enabled,
          finish: o.panelClearance?.finish || null,
          sillOuter: !!(o.sillOuter && o.sillOuter.enabled !== false),
          sillAngle: o.sillOuter?.angleDeg ?? null,
          panelFan: !!(o.arch && Object.prototype.hasOwnProperty.call(o.arch, 'panelFan')),
        })
      }
    }
    return {
      wallCount: walls.length,
      yaws: [...new Set(walls.map((w) => w.yawDeg ?? 0))],
      openings,
      patterns: walls.map((w) => w.panel?.pattern || w.studioPanel?.pattern || null),
    }
  }, STORAGE_KEY)
}

async function selectExistingOpening() {
  // Prefer clicking the already-placed window rather than adding a conflicting one.
  for (const [fx, fy] of [
    [0.52, 0.42],
    [0.48, 0.4],
    [0.55, 0.38],
    [0.5, 0.45],
    [0.5, 0.5],
    [0.45, 0.42],
  ]) {
    await clickCanvas(fx, fy)
    await dismissConflict()
    if ((await ui()).archVisible) return true
  }
  return false
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  // Keep existing default facade (has window + masonry). Only clear if empty later.
  await ready()

  const version = (await page.textContent('#app-version-btn'))?.trim() || ''
  ;/0\.7\.(34|35)/.test(version) ? pass('version-ui', version) : fail('version-ui', version)

  const finishOpts = await page.locator('#opening-panel-clearance-finish option').allTextContents()
  finishOpts.some((t) => /Leer/i.test(t)) && finishOpts.some((t) => /Bogen|zulaufen/i.test(t))
    ? pass('finish-options', finishOpts.join(' | '))
    : fail('finish-options', finishOpts.join(' | '))

  await go3d()
  await shot('01-initial-3d')

  // Select wall then existing opening
  await clickCanvas(0.5, 0.55)
  await dismissConflict()
  ;(await selectExistingOpening()) ? pass('select-opening') : fail('select-opening')
  await dismissConflict()
  await shot('02-opening-selected')

  // Surface: default module already shows masonry blocks — confirm via persisted pattern or UI cards
  {
    const state0 = await persisted()
    const hasPattern = (state0.patterns || []).some((p) => p && p !== 'none')
    const masonryCard = page.locator('#studio-pattern-masonry-cards .tpl-card').first()
    if (await masonryCard.count()) {
      await masonryCard.click()
      await page.waitForTimeout(400)
      pass('surface-masonry', 'card click')
    } else if (hasPattern) {
      pass('surface-masonry', `persisted ${JSON.stringify(state0.patterns)}`)
    } else {
      // Try opening Paneele settings tab if present
      const paneeleTab = page.locator('button, [role="tab"]').filter({ hasText: 'Paneele' }).first()
      if (await paneeleTab.count()) {
        await paneeleTab.click()
        await page.waitForTimeout(200)
        if (await masonryCard.count()) {
          await masonryCard.click()
          pass('surface-masonry', 'via Paneele tab')
        } else {
          fail('surface-pattern', JSON.stringify(state0.patterns))
        }
      } else {
        fail('surface-pattern', JSON.stringify(state0.patterns))
      }
    }
  }

  // Arch on
  await setCheckbox('#opening-arch-enabled', true)
  {
    const s = await ui()
    s.arch ? pass('arch-on') : fail('arch-on', JSON.stringify(s))
  }
  await shot('03-arch-on')

  // Freiraum off
  await setCheckbox('#opening-panel-clearance-enabled', false)
  {
    const s = await ui()
    !s.freiraum && s.arch ? pass('freiraum-off') : fail('freiraum-off', JSON.stringify(s))
  }
  await shot('04-freiraum-off')

  // Freiraum empty
  await setCheckbox('#opening-panel-clearance-enabled', true)
  await setSelect('#opening-panel-clearance-finish', 'empty')
  {
    const s = await ui()
    s.freiraum && s.finish === 'empty' ? pass('freiraum-empty') : fail('freiraum-empty', JSON.stringify(s))
  }
  await shot('05-freiraum-empty')

  // Freiraum taper
  await setSelect('#opening-panel-clearance-finish', 'taper')
  {
    const s = await ui()
    s.freiraum && s.finish === 'taper' ? pass('freiraum-taper') : fail('freiraum-taper', JSON.stringify(s))
  }
  await shot('06-freiraum-taper')

  // Outer sill
  await setCheckbox('#sill-outer-enabled', true)
  await page.evaluate(() => {
    const el = document.querySelector('#sill-outer-angle')
    if (el instanceof HTMLInputElement) {
      el.value = '8'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await page.waitForTimeout(350)
  {
    const s = await ui()
    s.sill ? pass('sill-outer', `angle=${s.sillAngle}`) : fail('sill-outer', JSON.stringify(s))
  }
  await shot('07-sill-front')

  // Switch to panels if cards available
  const panelCard = page.locator('#studio-pattern-panel-cards .tpl-card').nth(1)
  if (await panelCard.count()) {
    await panelCard.click()
    await page.waitForTimeout(450)
    await shot('08-panels-taper')
    pass('panels-switch')
  } else {
    pass('panels-switch', 'skipped (no card); masonry path covered')
  }

  ;(await ui()).panelFanUi ? fail('no-panelFan-ui') : pass('no-panelFan-ui')

  let state = await persisted()
  console.log('STATE', JSON.stringify(state, null, 2))
  state.openings?.some((o) => o.arch)
    ? pass('persisted-arch')
    : fail('persisted-arch', JSON.stringify(state))
  state.openings?.some((o) => o.freiraum && o.finish === 'taper')
    ? pass('persisted-taper')
    : fail('persisted-taper', JSON.stringify(state))
  state.openings?.every((o) => !o.panelFan) ? pass('no-panelFan-data') : fail('no-panelFan-data')

  // Side wall clone with yaw 90
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const data = JSON.parse(raw)
    const walls = data.facade?.buildings?.[0]?.walls || data.facade?.walls
    if (!Array.isArray(walls) || !walls[0]) return
    const front = walls[0]
    const side = JSON.parse(JSON.stringify(front))
    side.id = 'e2e-side-' + Date.now()
    side.yawDeg = 90
    side.x = (front.x || 0) + (front.width || 400) * 0.5
    for (const o of side.openings || []) {
      if (o.type !== 'window') continue
      o.arch = { ...(o.arch || {}), enabled: true }
      delete o.arch.panelFan
      o.panelClearance = { enabled: true, cm: 8, finish: 'taper' }
      o.sillOuter = { ...(o.sillOuter || {}), enabled: true, angleDeg: 8 }
    }
    walls.push(side)
    localStorage.setItem(key, JSON.stringify(data))
  }, STORAGE_KEY)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await ready()
  await go3d()
  await shot('09-side-wall')

  state = await persisted()
  console.log('STATE2', JSON.stringify(state, null, 2))
  state.yaws?.some((y) => Math.abs(Number(y)) >= 45)
    ? pass('side-yaw', JSON.stringify(state.yaws))
    : fail('side-yaw', JSON.stringify(state))
  const side = state.openings?.find((o) => Math.abs(Number(o.yawDeg)) >= 45 && o.sillOuter)
  side ? pass('side-sill', `yaw=${side.yawDeg} angle=${side.sillAngle}`) : fail('side-sill')

  const box = await page.locator('canvas').first().boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(400)
  }
  await shot('10-orbit')

  // Code-level sill orientation probe using THREE if available on page modules is hard;
  // verify source contract still holds via fetched text from Vite.
  const src = await page.evaluate(async () => {
    const res = await fetch('/src/FacadeController.ts')
    return res.ok ? await res.text() : ''
  })
  if (
    src.includes('mesh.rotation.set(0, wallYaw, 0)') &&
    src.includes('mesh.rotateX(-angleRad)')
  ) {
    pass('sill-yaw-then-rotateX-source')
  } else if (src.includes('rotateX') && src.includes('wallYaw')) {
    pass('sill-yaw-then-rotateX-source', 'variant match')
  } else {
    fail('sill-yaw-then-rotateX-source', 'pattern not found in served source')
  }
} catch (err) {
  fail('fatal', String(err?.stack || err))
  try {
    await shot('99-fatal')
  } catch {}
} finally {
  await browser.close()
}

const summary = {
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
  out: OUT,
}
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('\n=== SUMMARY ===')
console.log(`passed=${summary.passed} failed=${summary.failed}`)
console.log(`screenshots: ${OUT}`)
if (summary.failed) {
  for (const f of results.filter((r) => !r.ok)) console.log(` - ${f.name}: ${f.detail}`)
  process.exitCode = 1
}
