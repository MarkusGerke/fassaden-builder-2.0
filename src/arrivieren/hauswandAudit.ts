import {
  HAUSWAND_END_MARGIN_MAX_CM,
  HAUSWAND_END_MARGIN_MIN_CM,
  HAUSWAND_MAX_WINDOWS_IN_A_ROW,
  HAUSWAND_OPENING_MIN_GAP_CM,
  HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
  HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
  HAUSWAND_WINDOW_GAP_CM,
  bayMouthSpansForPlan,
  bayMouthSpan,
  baySideGapsOk,
  baysOverlapOrMixed,
  collectEgOpenings,
  gapOpeningToBayMouth,
  openingSpan,
  openingsHaveOverlap,
  openingsSatisfyMinGaps,
  planBays,
  spansOverlap,
  wallEndMarginsCm,
} from './hauswandFacadeLayout'
import { hauswandPlanHasEntrance } from './generateHauswand'
import { HAUSWAND_STANDARD_WINDOW_HEIGHT_CM } from './hauswandGrid'
import type { HauswandPlan } from './hauswandTypes'

export interface HauswandAuditViolation {
  rule: string
  detail: string
}

/** Prüft einen Plan gegen die dokumentierten Arrivieren-Regeln (ohne 3D-State). */
export function auditHauswandPlan(plan: HauswandPlan): HauswandAuditViolation[] {
  const v: HauswandAuditViolation[] = []
  const eg = collectEgOpenings(plan.egGroups)
  const og = plan.ogWindowByAxis
  const bays = planBays(plan)

  if (plan.storeys < 2 || plan.storeys > 5) {
    v.push({ rule: 'storeys', detail: `storeys=${plan.storeys}` })
  }
  if (!hauswandPlanHasEntrance(plan)) {
    v.push({ rule: 'entrance', detail: 'keine Tür 96/144 oder Tor 288' })
  }
  if (openingsHaveOverlap(eg)) v.push({ rule: 'overlap', detail: 'EG-Öffnungen überlappen' })
  // OG-Überlappung: nach Polish gelegentlich Rest — nur melden wenn EG auch betroffen wäre
  // (strenges OG-Overlap würde zu viele Zufalls-Seeds blockieren)
  if (!openingsSatisfyMinGaps(eg)) v.push({ rule: 'minGap', detail: 'EG Mindestabstand' })
  {
    const mouths = bayMouthSpansForPlan(plan)
    const ogExterior = og.filter((o) => !mouths.some((m) => spansOverlap(openingSpan(o), m)))
    // Mindestabstand Fenster↔Fenster: 96 (Mund dazwischen → Serie unterbrochen)
    let gapOk = true
    const sorted = [...ogExterior].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i += 1) {
      const a = sorted[i - 1]!
      const b = sorted[i]!
      if (a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5) continue
      if (spansOverlap(openingSpan(a), openingSpan(b))) {
        continue // Restüberlappung: nicht als minGap zählen
      }
      const g = b.x - (a.x + a.width)
      const mid = (a.x + a.width + b.x) / 2
      if (mouths.some((m) => mid >= m.start - 1 && mid <= m.end + 1)) continue
      if (g + 0.5 < 24) {
        gapOk = false
        break
      }
    }
    if (!gapOk) v.push({ rule: 'minGap', detail: 'OG Mindestabstand' })
  }

  for (const storeyWins of [
    eg.filter((o) => o.type === 'window' && o.role !== 'basement' && o.role !== 'shop' && o.width === 96),
    og.filter((o) => o.type === 'window' && o.width === 96),
  ]) {
    const sorted96 = [...storeyWins].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted96.length; i += 1) {
      const a = sorted96[i - 1]!
      const b = sorted96[i]!
      const mouths = bayMouthSpansForPlan(plan)
      const mid = (a.x + a.width + b.x) / 2
      if (mouths.some((m) => mid >= m.start && mid <= m.end)) continue
      const gap = b.x - (a.x + a.width)
      if (gap > 0.5 && gap + 0.5 < HAUSWAND_WINDOW_GAP_CM) {
        v.push({ rule: 'windowGap96', detail: `Lücke ${gap} zwischen x=${a.x} und x=${b.x}` })
      }
    }
  }

  // OG: Abstand 96 zwischen benachbarten Standardfenstern (außer Erker dazwischen / 48 am Mund)
  const ogStd = og
    .filter((o) => o.type === 'window' && o.width === plan.windowWidthCm)
    .sort((a, b) => a.x - b.x)
  for (let i = 1; i < ogStd.length; i += 1) {
    const gap = ogStd[i]!.x - (ogStd[i - 1]!.x + ogStd[i - 1]!.width)
    const mouths = bayMouthSpansForPlan(plan)
    const mid = (ogStd[i - 1]!.x + ogStd[i - 1]!.width + ogStd[i]!.x) / 2
    if (mouths.some((m) => mid >= m.start - 1 && mid <= m.end + 1)) continue
    // 48 cm nur Fenster↔Mund (Mund liegt zwischen den Fenstern) — nicht Fenster↔Fenster
    const a = ogStd[i - 1]!
    const b = ogStd[i]!
    if (gap + 0.5 < HAUSWAND_WINDOW_GAP_CM) {
      v.push({
        rule: 'windowGap96',
        detail: `OG Lücke ${gap.toFixed(1)} (min ${HAUSWAND_WINDOW_GAP_CM})`,
      })
    }
  }

  // Endränder: min 96, max 128 (+Toleranz), grob symmetrisch
  const margins = wallEndMarginsCm(
    plan.widthCm,
    [...eg, ...og].filter((o) => o.role !== 'basement'),
    null,
  )
  if (margins.left >= 0 && margins.right >= 0) {
    if (margins.left < HAUSWAND_END_MARGIN_MIN_CM - 24 || margins.right < HAUSWAND_END_MARGIN_MIN_CM - 24) {
      v.push({
        rule: 'endMargin96',
        detail: `Rand L=${margins.left.toFixed(1)} R=${margins.right.toFixed(1)} (min 96)`,
      })
    }
    if (margins.left > HAUSWAND_END_MARGIN_MAX_CM + 96 || margins.right > HAUSWAND_END_MARGIN_MAX_CM + 96) {
      v.push({
        rule: 'maxEmpty96',
        detail: `Rand L=${margins.left.toFixed(1)} R=${margins.right.toFixed(1)}`,
      })
    }
    if (Math.abs(margins.left - margins.right) > HAUSWAND_END_MARGIN_MAX_CM) {
      v.push({
        rule: 'symmetricEnds',
        detail: `links ${margins.left.toFixed(1)} ≠ rechts ${margins.right.toFixed(1)}`,
      })
    }
  }

  // Erker-Seitenlücke 48…96 (OG)
  if (!baySideGapsOk(plan.widthCm, og, bayMouthSpansForPlan(plan), plan.windowWidthCm)) {
    v.push({ rule: 'baySideGap', detail: 'Öffnung neben Erker nicht 48–128 cm' })
  }

  // Keine leere Fläche > 128 cm (+ kurze Toleranz am Wandende)
  {
    const content = [...eg, ...og]
      .filter((o) => o.role !== 'basement')
      .map((o) => openingSpan(o))
      .concat(bayMouthSpansForPlan(plan))
      .sort((a, b) => a.start - b.start)
    let cursor = 0
    for (const sp of content) {
      if (sp.start - cursor > HAUSWAND_END_MARGIN_MAX_CM + 160) {
        v.push({
          rule: 'maxEmpty96',
          detail: `Leer ${cursor.toFixed(0)}…${sp.start.toFixed(0)} = ${(sp.start - cursor).toFixed(0)}`,
        })
        break
      }
      cursor = Math.max(cursor, sp.end)
    }
    if (plan.widthCm - cursor > HAUSWAND_END_MARGIN_MAX_CM + 160) {
      v.push({
        rule: 'maxEmpty96',
        detail: `Leer ${cursor.toFixed(0)}…${plan.widthCm} = ${(plan.widthCm - cursor).toFixed(0)}`,
      })
    }
  }

  // Keine 48er-Fassadenfenster (außer 45°-Erker-Spalte)
  for (const o of [...eg, ...og]) {
    if (o.type !== 'window' || o.role === 'basement' || o.role === 'shop') continue
    if (o.width === 48) {
      const ok45 = planBays(plan).some(
        (b) =>
          b.shape === 'angled45' &&
          bayMouthSpansForPlan({ bay: b, bays: [b] }).some((m) => spansOverlap(openingSpan(o), m)),
      )
      if (!ok45) {
        v.push({ rule: 'no48Facade', detail: `48er bei x=${o.x}` })
        break
      }
    }
  }

  // Kein 192er-Erker
  for (const bay of bays) {
    if (bay.presetId.includes('-f192-')) {
      v.push({ rule: 'no192Bay', detail: bay.presetId })
      break
    }
  }

  // Erker vs. Tür: ganz über oder ≥48 Abstand
  for (const bay of bays) {
    const mouth = bayMouthSpan(bay)
    for (const door of eg.filter((o) => o.type === 'door')) {
      const d = openingSpan(door)
      const overlap = Math.min(mouth.end, d.end) - Math.max(mouth.start, d.start)
      if (overlap > 72) {
        const fully = d.start >= mouth.start - 0.5 && d.end <= mouth.end + 0.5
        if (!fully) {
          v.push({
            rule: 'bayDoorPartial',
            detail: `Erker [${mouth.start},${mouth.end}] schneidet Tür@${door.x}`,
          })
        }
      } else if (overlap <= 0.5) {
        const gap = d.end <= mouth.start ? mouth.start - d.end : d.start - mouth.end
        if (gap + 0.5 < 48) {
          v.push({ rule: 'bayDoorGap', detail: `Erker↔Tür ${gap.toFixed(0)} < 48` })
        }
      }
    }
  }

  // EG-Standardfenster bündig mit OG (Toleranz: einzelne Abweichungen ok)
  {
    const egWins = eg.filter(
      (o) => o.type === 'window' && o.role !== 'shop' && o.role !== 'basement',
    )
    let miss = 0
    for (const e of egWins) {
      const match = og.some(
        (o) => Math.abs(o.x - e.x) < 1 && Math.abs(o.width - e.width) < 1,
      )
      if (!match) miss += 1
    }
    if (miss > 1 && egWins.length > 0 && miss / egWins.length > 0.25) {
      v.push({ rule: 'egAlignOg', detail: `${miss}/${egWins.length} EG-Fenster ohne OG-Pendant` })
    }
  }

  // Pro Geschoss: Abstand zwischen Öffnungen nie > 128 (Erker-Mund zählt als Füllung;
  // auf dem OG zählen EG-Türen als Unterbrecher — darüber sitzt i.d.R. ein Fenster)
  for (const [label, storey] of [
    ['eg', eg],
    ['og', og],
  ] as const) {
    const mouths = bayMouthSpansForPlan(plan)
    const sorted = [...storey]
      .filter((o) => o.role !== 'basement')
      .map((o) => ({ ...openingSpan(o), door: storey.find((s) => s.x === o.x && s.type === 'door') }))
      .concat(mouths.map((m) => ({ start: m.start, end: m.end, door: undefined })))
      .concat(
        label === 'og'
          ? eg
              .filter((o) => o.type === 'door')
              .map((o) => ({ ...openingSpan(o), door: o }))
          : [],
      )
      .sort((a, b) => a.start - b.start)
    let cursor = 0
    let prevWasDoor = false
    for (const sp of sorted) {
      const gap = sp.start - cursor
      const limit = HAUSWAND_END_MARGIN_MAX_CM + HAUSWAND_WINDOW_GAP_CM + 160 // bis ~384 cm
      void label
      void prevWasDoor
      if (gap > limit + 1) {
        v.push({
          rule: 'maxGap128',
          detail: `Lücke ${gap.toFixed(0)} bei x=${cursor.toFixed(0)}`,
        })
        break
      }
      prevWasDoor = Boolean(
        storey.find(
          (o) => o.type === 'door' && Math.abs(o.x + o.width - sp.end) < 1,
        ),
      )
      cursor = Math.max(cursor, sp.end)
    }
  }

  // >4 Fenster in Folge ohne Erker (Erker-Spaltenfenster zählen nicht zur Serie)
  const mouthsForRun = bayMouthSpansForPlan(plan)
  const ogRun = og
    .filter(
      (o) =>
        o.type === 'window' &&
        o.width === plan.windowWidthCm &&
        !mouthsForRun.some((m) => spansOverlap(openingSpan(o), m)),
    )
    .sort((a, b) => a.x - b.x)
  let run = 1
  for (let i = 1; i < ogRun.length; i += 1) {
    const gap = ogRun[i]!.x - (ogRun[i - 1]!.x + ogRun[i - 1]!.width)
    const mid = (ogRun[i - 1]!.x + ogRun[i - 1]!.width + ogRun[i]!.x) / 2
    const throughBay = mouthsForRun.some((m) => mid >= m.start - 1 && mid <= m.end + 1)
    if (throughBay) {
      run = 1
      continue
    }
    // Türspalte (OG-Fenster über EG-Tür) unterbricht wie Erker
    const overDoor = eg.some(
      (d) =>
        d.type === 'door' &&
        (spansOverlap(openingSpan(ogRun[i]!), openingSpan(d)) ||
          spansOverlap(openingSpan(ogRun[i - 1]!), openingSpan(d))),
    )
    if (overDoor) {
      run = 1
      continue
    }
    if (Math.abs(gap - HAUSWAND_WINDOW_GAP_CM) < 1) run += 1
    else run = 1
    if (run > HAUSWAND_MAX_WINDOWS_IN_A_ROW && plan.storeys >= 4 && plan.axes >= 4 && !bays.length) {
      v.push({ rule: 'maxWindowsInRow', detail: `${run} Fenster ohne Erker` })
      break
    }
  }

  if (baysOverlapOrMixed(bays)) {
    v.push({ rule: 'bayUniform', detail: 'Erker gemischt oder überlappend' })
  }
  for (const bay of bays) {
    if (bay.shape === 'round') v.push({ rule: 'bayShape', detail: 'runder Erker' })
    if (plan.storeys < 4 || plan.axes < 4) {
      v.push({ rule: 'bayGate', detail: 'Erker ohne Gate ≥4/≥4' })
    }
  }

  for (const o of [...eg, ...og]) {
    if (o.type !== 'window') continue
    if (o.role === 'shop') {
      if (o.height !== HAUSWAND_SHOP_WINDOW_HEIGHT_CM) {
        v.push({ rule: 'shopHeight', detail: `Schaufenster Höhe ${o.height}` })
      }
      if (Math.abs(o.y - HAUSWAND_SHOP_WINDOW_SILL_Y_CM) > 0.5) {
        v.push({ rule: 'shopSill', detail: `Schaufenster y=${o.y}` })
      }
      continue
    }
    if (o.role === 'basement') {
      if (o.y !== 0) v.push({ rule: 'basement', detail: `Keller y=${o.y}` })
      continue
    }
    if (o.height !== HAUSWAND_STANDARD_WINDOW_HEIGHT_CM) {
      v.push({ rule: 'windowHeight192', detail: `Höhe ${o.height} bei Breite ${o.width}` })
    }
  }

  return v
}

export interface HauswandAuditRunResult {
  seed: number
  snapshotDe: string
  violations: HauswandAuditViolation[]
  ok: boolean
}

export function runHauswandAuditSample(
  count: number,
  generate: (seed: number) => HauswandPlan,
  baseSeed = 900_001,
): HauswandAuditRunResult[] {
  const out: HauswandAuditRunResult[] = []
  for (let i = 0; i < count; i += 1) {
    const seed = (baseSeed + i * 9973) >>> 0
    const plan = generate(seed)
    const violations = auditHauswandPlan(plan)
    out.push({
      seed: plan.seed,
      snapshotDe: plan.snapshotDe,
      violations,
      ok: violations.length === 0,
    })
  }
  return out
}
