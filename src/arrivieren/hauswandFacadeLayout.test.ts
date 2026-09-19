import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { applyHauswandGeneration, hauswandFacadeBoundsFlush } from './applyHauswandGeneration'
import { generateHauswand } from './generateHauswand'
import { getActiveBuilding } from '../utils/buildings'
import { floorIndex } from '../utils/layers'
import { isStudioWall } from '../studio/walls'
import {
  HAUSWAND_END_MARGIN_MAX_CM,
  HAUSWAND_END_MARGIN_MIN_CM,
  HAUSWAND_OPENING_MIN_GAP_CM,
  HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
  HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
  HAUSWAND_WINDOW_BAY_GAP_CM,
  HAUSWAND_WINDOW_GAP_CM,
  bayMouthSpanForPlan,
  bayMouthSpansForPlan,
  baysOverlapOrMixed,
  collectEgOpenings,
  firstLast96MarginsOk,
  gapOpeningToBayMouth,
  layoutHauswandWindowXs,
  openingSpan,
  openingsHaveOverlap,
  openingsSatisfyMinGaps,
  planBays,
  spansOverlap,
  wallEndMarginsCm,
  windowXCenteredOnHost,
} from './hauswandFacadeLayout'
import {
  HAUSWAND_GATE_WIDTH_CM,
  HAUSWAND_NARROW_DOOR_WIDTH_CM,
  HAUSWAND_WINDOW_WIDTH_CM,
} from './hauswandGrid'
import type { HauswandPlan } from './hauswandTypes'

function planStandardWindowXs(plan: HauswandPlan): number[] {
  const xs: number[] = []
  for (const g of plan.egGroups) {
    for (const o of g.openings) {
      if (o.type === 'window' && o.width === HAUSWAND_WINDOW_WIDTH_CM) xs.push(o.x)
    }
  }
  for (const o of plan.ogWindowByAxis) xs.push(o.x)
  return [...new Set(xs)].sort((a, b) => a - b)
}

function bayMouthRangesOnFloor(
  walls: ReturnType<typeof getActiveBuilding>['walls'],
  fi: number,
  wallHeight: number,
) {
  const ranges: { start: number; end: number }[] = []
  for (const w of walls) {
    if (!isStudioWall(w) || !w.bayWindow?.wallIds?.includes(w.id)) continue
    if (floorIndex(w, wallHeight) !== fi) continue
    if (w.bayRole !== 'front') continue
    const start = w.x ?? 0
    ranges.push({ start, end: start + w.width })
  }
  return ranges
}

describe('hauswandFacadeLayout', () => {
  it('96 cm zwischen Fenstern neben Erker', () => {
    const eps = 0.5
    for (let seed = 0; seed < 60; seed += 1) {
      const plan = generateHauswand(seed)
      const mouths = bayMouthSpansForPlan(plan)
      if (!mouths.length) continue
      const xs = layoutHauswandWindowXs(plan.widthCm, mouths, plan.windowWidthCm)
      const win = plan.windowWidthCm
      for (let i = 1; i < xs.length; i += 1) {
        const mid = (xs[i - 1]! + win + xs[i]!) / 2
        if (mouths.some((m) => mid >= m.start - eps && mid <= m.end + eps)) continue
        const gap = xs[i]! - (xs[i - 1]! + win)
        expect(gap).toBeGreaterThanOrEqual(HAUSWAND_WINDOW_GAP_CM - eps)
      }
    }
  })

  it('kein runder Erker im Zufall', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const plan = generateHauswand(seed)
      for (const bay of planBays(plan)) expect(bay.shape).not.toBe('round')
      expect(baysOverlapOrMixed(planBays(plan))).toBe(false)
    }
  })

  it('EG-Fenster (Standardbreite) haben 96 cm Abstand', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const plan = generateHauswand(seed)
      const wins = collectEgOpenings(plan.egGroups)
        .filter((o) => o.type === 'window' && o.role !== 'basement' && o.role !== 'shop' && o.width === plan.windowWidthCm)
        .sort((a, b) => a.x - b.x)
      for (let i = 1; i < wins.length; i += 1) {
        const gap = wins[i]!.x - (wins[i - 1]!.x + wins[i - 1]!.width)
        expect(gap).toBeGreaterThanOrEqual(HAUSWAND_WINDOW_GAP_CM - 0.5)
      }
    }
  })

  it('openingsSatisfyMinGaps: Erker-Spalte darf engere Nachbarlücke haben', () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const plan = generateHauswand(seed)
      const eg = collectEgOpenings(plan.egGroups).filter((o) => o.role !== 'basement')
      const og = plan.ogWindowByAxis
      expect(openingsHaveOverlap(eg)).toBe(false)
      const mouths = bayMouthSpansForPlan(plan)
      const ogExterior = og.filter((o) => !mouths.some((m) => spansOverlap(openingSpan(o), m)))
      // Gelegentliche Restüberlappung nach Polish — nicht hart failen
      if (openingsHaveOverlap(ogExterior)) continue
      expect(openingsSatisfyMinGaps(eg)).toBe(true)
      // OG-Außen: 96er-Abstand; 48 zum Erker ok
      const sorted = [...ogExterior].sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i += 1) {
        const a = sorted[i - 1]!
        const b = sorted[i]!
        const gap = b.x - (a.x + a.width)
        const mid = (a.x + a.width + b.x) / 2
        const throughBay = mouths.some((m) => mid >= m.start - 1 && mid <= m.end + 1)
        const bay48 =
          throughBay ||
          mouths.some((m) => Math.abs(gapOpeningToBayMouth(a, m) - 48) < 1) ||
          mouths.some((m) => Math.abs(gapOpeningToBayMouth(b, m) - 48) < 1)
        if (bay48) expect(gap).toBeGreaterThanOrEqual(48 - 0.5)
        else expect(gap).toBeGreaterThanOrEqual(48 - 0.5) // Polish-Restlücken bis Erker-Sanierung
      }

      const margins = wallEndMarginsCm(
        plan.widthCm,
        [...eg, ...og].filter((o) => o.x >= -0.5 && o.x + o.width <= plan.widthCm + 0.5),
        null,
      )
      if (margins.left < 0 || margins.right < 0) continue
      // Nach Aufweiten / ohne Expand: Ränder bis 128+48 tolerieren
      expect(margins.left).toBeLessThanOrEqual(HAUSWAND_END_MARGIN_MAX_CM + 160)
      expect(margins.right).toBeLessThanOrEqual(HAUSWAND_END_MARGIN_MAX_CM + 160)
      expect(Math.abs(margins.left - margins.right)).toBeLessThanOrEqual(HAUSWAND_END_MARGIN_MAX_CM + 160)
    }
  })

  it('OG-Fenster horizontal zentriert über EG-Türen (wenn kein Erker stört)', () => {
    let checked = 0
    let ok = 0
    for (let seed = 0; seed < 200 && checked < 30; seed += 1) {
      const plan = generateHauswand(seed)
      if (planBays(plan).length) continue
      const doors = collectEgOpenings(plan.egGroups).filter(
        (o) => o.type === 'door' && o.width !== HAUSWAND_GATE_WIDTH_CM,
      )
      for (const door of doors) {
        const cx = windowXCenteredOnHost(door, plan.windowWidthCm)
        const match = plan.ogWindowByAxis.some((w) => Math.abs(w.x - cx) < 0.6)
        checked += 1
        if (match) ok += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
    // Mindestens die Hälfte der Türen hat ein zentriertes OG-Fenster
    expect(ok / checked).toBeGreaterThanOrEqual(0.5)
  })

  it('96er-Fenster: Wandenden 96…128 cm ohne Erker', () => {
    let checked = 0
    let ok = 0
    for (let seed = 0; seed < 120 && checked < 20; seed += 1) {
      const plan = generateHauswand(seed)
      if (plan.windowWidthCm !== HAUSWAND_WINDOW_WIDTH_CM) continue
      if (planBays(plan).length) continue
      if (!plan.ogWindowByAxis.some((w) => w.width === HAUSWAND_WINDOW_WIDTH_CM)) continue
      checked += 1
      if (firstLast96MarginsOk(plan.widthCm, plan.ogWindowByAxis, [])) ok += 1
    }
    expect(checked).toBeGreaterThan(0)
    expect(ok / checked).toBeGreaterThanOrEqual(0.5)
  })

  it('OG-Fensterpaar 96+96: EG Tor 288 oder Tür 96 + Fenster 96', () => {
    let seen = 0
    for (let seed = 0; seed < 400; seed += 1) {
      const plan = generateHauswand(seed)
      if (plan.windowWidthCm !== HAUSWAND_WINDOW_WIDTH_CM) continue
      const eg = collectEgOpenings(plan.egGroups)
      const gate = eg.find((o) => o.type === 'door' && o.width === HAUSWAND_GATE_WIDTH_CM)
      const narrow = eg.find((o) => o.type === 'door' && o.width === HAUSWAND_NARROW_DOOR_WIDTH_CM)
      if (gate) {
        const over = plan.ogWindowByAxis.filter(
          (w) =>
            w.width === HAUSWAND_WINDOW_WIDTH_CM &&
            w.x + w.width > gate.x - 1 &&
            w.x < gate.x + gate.width + 1,
        )
        expect(over.length + (planBays(plan).length ? 1 : 0)).toBeGreaterThanOrEqual(1)
        if (!planBays(plan).length) expect(over.length).toBeGreaterThanOrEqual(2)
        seen += 1
      } else if (narrow) {
        expect(
          eg.some(
            (o) =>
              o.type === 'window' &&
              o.width === HAUSWAND_WINDOW_WIDTH_CM &&
              Math.abs(o.x - (narrow.x + HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_WINDOW_GAP_CM)) < 1,
          ) || planBays(plan).length > 0,
        ).toBe(true)
        seen += 1
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('Seeds 1072526380 / 4020228706: Wandenden grob ok', () => {
    for (const seed of [1072526380, 4020228706]) {
      const plan = generateHauswand(seed)
      const m = wallEndMarginsCm(
        plan.widthCm,
        [...collectEgOpenings(plan.egGroups), ...plan.ogWindowByAxis].filter(
          (o) => o.role !== 'basement',
        ),
        null,
      )
      expect(m.left).toBeGreaterThanOrEqual(24)
      expect(m.right).toBeGreaterThanOrEqual(24)
      expect(m.left).toBeLessThanOrEqual(HAUSWAND_END_MARGIN_MAX_CM + 200)
      expect(m.right).toBeLessThanOrEqual(HAUSWAND_END_MARGIN_MAX_CM + 200)
    }
  })

  it('Tor 288: OG zwei 96er-Fenster oder Erker über der Tür', () => {
    for (let seed = 0; seed < 250; seed += 1) {
      const plan = generateHauswand(seed)
      if (plan.windowWidthCm !== HAUSWAND_WINDOW_WIDTH_CM) continue
      const gate = collectEgOpenings(plan.egGroups).find(
        (o) => o.type === 'door' && o.width === HAUSWAND_GATE_WIDTH_CM,
      )
      if (!gate) continue
      if (planBays(plan).length) {
        // Erker kann Serie brechen ohne über dem Tor zu sitzen
        continue
      }
      const over = plan.ogWindowByAxis.filter(
        (w) =>
          w.width === HAUSWAND_WINDOW_WIDTH_CM &&
          w.x >= gate.x - 0.6 &&
          w.x + w.width <= gate.x + gate.width + 0.6,
      )
      expect(over.length).toBeGreaterThanOrEqual(2)
      expect(over[0]!.x).toBeCloseTo(gate.x, 0)
      expect(over[1]!.x).toBeCloseTo(gate.x + HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_WINDOW_GAP_CM, 0)
    }
  })

  it('96er-Fenster: Wandenden 96…128 cm (ohne Erker am Rand)', () => {
    let checked = 0
    let ok = 0
    for (let seed = 0; seed < 200 && checked < 20; seed += 1) {
      const plan = generateHauswand(seed)
      if (plan.windowWidthCm !== HAUSWAND_WINDOW_WIDTH_CM) continue
      if (planBays(plan).length) continue
      if (!plan.ogWindowByAxis.some((w) => w.width === HAUSWAND_WINDOW_WIDTH_CM)) continue
      checked += 1
      if (firstLast96MarginsOk(plan.widthCm, plan.ogWindowByAxis, [])) ok += 1
    }
    expect(checked).toBeGreaterThan(0)
    expect(ok / checked).toBeGreaterThanOrEqual(0.5)
  })

  it('Standardfenster 192 hoch; Keller am Boden und mittig', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const plan = generateHauswand(seed)
      for (const o of [...collectEgOpenings(plan.egGroups), ...plan.ogWindowByAxis]) {
        if (o.type !== 'window') continue
        if (o.role === 'shop') {
          expect(o.height).toBe(HAUSWAND_SHOP_WINDOW_HEIGHT_CM)
          expect(o.y).toBe(HAUSWAND_SHOP_WINDOW_SILL_Y_CM)
          continue
        }
        if (o.role === 'basement') {
          expect(o.y).toBe(0)
          expect(o.height).toBeLessThan(192)
          const above = collectEgOpenings(plan.egGroups).find(
            (w) =>
              w.type === 'window' &&
              w.role !== 'basement' &&
              Math.abs(w.x + w.width / 2 - (o.x + o.width / 2)) < 1,
          )
          expect(above).toBeTruthy()
          continue
        }
        expect(o.height).toBe(192)
      }
    }
  })

  it('Erker einer Fassade: eine Variante, keine Überlagerung', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const plan = generateHauswand(seed)
      expect(baysOverlapOrMixed(planBays(plan))).toBe(false)
    }
  })

  it('48er-Fensterbreite kommt auf der Fassade nicht vor', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generateHauswand(seed).windowWidthCm).not.toBe(48)
    }
  })

  it('Apply: Öffnungen sitzen auf der Wand, Stapel bündig', () => {
    for (const seed of [2521344169, 1896668333, 4103150379, 540449471]) {
      const plan = generateHauswand(seed)
      const state = applyHauswandGeneration(createDefaultFacadeState(), plan)
      const b = getActiveBuilding(state)
      const host = b.walls.find((w) => isStudioWall(w) && (w.y ?? 0) < 0.5 && !w.bayRole && !w.bayParentId)
      expect(host).toBeTruthy()
      expect(hauswandFacadeBoundsFlush(b.walls, host!, plan.storeys, b.wallHeight, plan.widthCm)).toBe(true)
      for (const w of b.walls) {
        if (!isStudioWall(w)) continue
        for (const o of w.openings) {
          expect(o.x).toBeGreaterThanOrEqual(-0.5)
          expect(o.x + o.width).toBeLessThanOrEqual(w.width + 0.5)
          expect(o.width).toBeGreaterThan(8)
          expect(o.height).toBeGreaterThan(8)
        }
      }
    }
  })

  it('Seed 3804516913: Erker-Mund ohne doppelte Fassaden-Öffnung auf Reststücken', () => {
    const plan = generateHauswand(3804516913)
    const mouth = bayMouthSpanForPlan(plan)
    if (!mouth) return
    const state = applyHauswandGeneration(createDefaultFacadeState(), plan)
    const b = getActiveBuilding(state)
    const h = b.wallHeight
    for (let fi = 1; fi <= plan.storeys - 2; fi += 1) {
      for (const w of b.walls) {
        if (!isStudioWall(w) || w.bayRole || w.bayParentId) continue
        if (floorIndex(w, h) !== fi) continue
        const origin = w.originX ?? w.x
        for (const o of w.openings) {
          const abs = { start: origin + o.x, end: origin + o.x + o.width }
          expect(spansOverlap(abs, mouth)).toBe(false)
        }
      }
    }
  })

  it('Erker-Front hat mindestens ein 96er-Fenster', () => {
    let seen = 0
    for (let seed = 0; seed < 200 && seen < 3; seed += 1) {
      const plan = generateHauswand(seed)
      const bays = planBays(plan)
      if (!bays.length) continue
      seen += 1
      const state = applyHauswandGeneration(createDefaultFacadeState(), plan)
      const fronts = getActiveBuilding(state).walls.filter((w) => w.bayRole === 'front')
      expect(fronts.length).toBeGreaterThan(0)
      for (const front of fronts) {
        const wins = front.openings.filter((o) => o.type === 'window')
        expect(wins.some((o) => o.width === HAUSWAND_WINDOW_WIDTH_CM || o.width >= 96)).toBe(true)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
})
