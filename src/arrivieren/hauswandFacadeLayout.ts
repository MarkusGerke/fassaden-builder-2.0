import { BAY_WINDOW_PRESETS, bayMouthWidthCm, type BayWindowPreset } from '../studio/bayWindow'
import type { HauswandBayPlan, HauswandEgGroup, HauswandOpeningSpec, HauswandPlan } from './hauswandTypes'
import {
  HAUSWAND_DOOR_HEIGHT_CM,
  HAUSWAND_END_MARGIN_CM,
  HAUSWAND_ENTRANCE_DOOR_WIDTH_CM,
  HAUSWAND_GATE_WIDTH_CM,
  HAUSWAND_NARROW_DOOR_WIDTH_CM,
  HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
  HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
  HAUSWAND_WINDOW_WIDTH_CM,
  hauswandWidthCm,
} from './hauswandGrid'

const EPS = 0.5

/** Lichter Abstand zwischen zwei Fassadenfenstern (Raster-Ziel). */
export const HAUSWAND_WINDOW_GAP_CM = 96
/** Mindestabstand Fenster ↔ Erker-Mund. */
export const HAUSWAND_WINDOW_BAY_GAP_CM = 48
/** Maximaler Abstand Öffnung ↔ Erker-Mund. */
export const HAUSWAND_WINDOW_BAY_GAP_MAX_CM = 128

export const HAUSWAND_END_MARGIN_MIN_CM = HAUSWAND_END_MARGIN_CM
/** Max. leerer Abstand zwischen Öffnungen / Rand — nie größer (v2.0.507: 128). */
export const HAUSWAND_END_MARGIN_MAX_CM = 128
export const HAUSWAND_OPENING_MIN_GAP_CM = 48
export const HAUSWAND_DOOR_MIN_GAP_CM = 24
/** Mehr als so viele Fenster in Folge → Erker dazwischen. */
export const HAUSWAND_MAX_WINDOWS_IN_A_ROW = 4

export const HAUSWAND_NARROW_WINDOW_WIDTH_CM = 48
/** Abstand 48er ↔ 96er auf 45°-Erker-Spalte. */
export const HAUSWAND_ANGLED45_SIDE_GAP_CM = 64
export const HAUSWAND_BASEMENT_WINDOW_HEIGHT_CM = 64
export const HAUSWAND_BASEMENT_WINDOW_WIDTH_CM = 48
export const HAUSWAND_SHOP_WINDOW_HEIGHT_CM = 256
/** Schaufenster 256 cm hoch: 64 cm Abstand vom Erdboden. */
export const HAUSWAND_SHOP_WINDOW_SILL_Y_CM = 64

/** Erker-Frontbreiten (kein 192 mehr). */
export const HAUSWAND_BAY_FRONT_WIDTHS_CM = [288, 384] as const

export const HAUSWAND_FACADE_WINDOW_WIDTHS_CM = [48, 96, 144] as const

export interface CmSpan {
  start: number
  end: number
}

export function spansOverlap(a: CmSpan, b: CmSpan): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS
}

export function openingSpan(o: Pick<HauswandOpeningSpec, 'x' | 'width'>): CmSpan {
  return { start: o.x, end: o.x + o.width }
}

export function openingPlacementBlockSpan(o: HauswandOpeningSpec): CmSpan {
  const span = openingSpan(o)
  if (o.type !== 'door') return span
  return {
    start: span.start - HAUSWAND_OPENING_MIN_GAP_CM,
    end: span.end + HAUSWAND_OPENING_MIN_GAP_CM,
  }
}

function presetForBayPlan(bay: HauswandBayPlan): BayWindowPreset {
  const fromLib = BAY_WINDOW_PRESETS.find((p) => p.id === bay.presetId)
  if (fromLib) return fromLib
  const parsed = /^bay-f(\d+)-d(\d+)-(rect|45)$/.exec(bay.presetId)
  const frontWidthCm = parsed
    ? Number(parsed[1])
    : bay.axisSpan >= 2
      ? 384
      : 288
  const depthCm = parsed ? Number(parsed[2]) : 96
  const shapeKey = bay.shape === 'angled45' ? '45' : 'rect'
  return {
    id: bay.presetId,
    label: bay.presetId,
    frontWidthCm,
    depthCm,
    shape: bay.shape === 'angled45' ? 'angled45' : 'rect',
    kind: 'bay',
  }
}

export function planBays(plan: Pick<HauswandPlan, 'bay' | 'bays'>): HauswandBayPlan[] {
  if (plan.bays?.length) return plan.bays
  return plan.bay ? [plan.bay] : []
}

export function bayMouthSpan(bay: HauswandBayPlan): CmSpan {
  const preset = presetForBayPlan(bay)
  const mouth = bayMouthWidthCm(preset)
  const start = bay.centerLocalXCm - mouth / 2
  return { start, end: start + mouth }
}

export function bayMouthSpansForPlan(plan: Pick<HauswandPlan, 'bay' | 'bays'>): CmSpan[] {
  return planBays(plan).map((b) => bayMouthSpan(b))
}

export function bayMouthSpanForPlan(plan: Pick<HauswandPlan, 'bay' | 'bays'>): CmSpan | null {
  return bayMouthSpansForPlan(plan)[0] ?? null
}

export function windowGapForWidth(_winW: number): number {
  return HAUSWAND_WINDOW_GAP_CM
}

/**
 * Fenster-Positionen: 96 cm Rand, 96 cm zwischen Fenstern, 48–96 cm zum Erker.
 * `throughBayColumn`: Fenster in der Erker-Spalte mitplanen (EG / oberstes OG).
 */
export function layoutHauswandWindowXs(
  wallWidthCm: number,
  bayMouth: CmSpan | CmSpan[] | null,
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
  opts?: { throughBayColumn?: boolean },
): number[] {
  const mouths = [...(Array.isArray(bayMouth) ? bayMouth : bayMouth ? [bayMouth] : [])]
  const gap = windowGapForWidth(winW)
  const maxRight = wallWidthCm - HAUSWAND_END_MARGIN_MIN_CM
  const through = opts?.throughBayColumn === true
  const xs: number[] = []
  let x = HAUSWAND_END_MARGIN_MIN_CM
  while (x + winW <= maxRight + EPS) {
    const span = { start: x, end: x + winW }
    const blocked = mouths.some((m) => {
      if (through) return false
      if (spansOverlap(span, m)) return true
      // Mindestabstand Erker ↔ Fenster: 48 cm (nie bündig)
      if (span.end <= m.start + EPS) return m.start - span.end < HAUSWAND_WINDOW_BAY_GAP_CM - EPS
      if (span.start >= m.end - EPS) return span.start - m.end < HAUSWAND_WINDOW_BAY_GAP_CM - EPS
      return false
    })
    if (!blocked) xs.push(x)
    x += winW + gap
  }
  return xs
}

export function standardWindowAtX(
  x: number,
  width: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandOpeningSpec {
  return {
    x,
    width,
    height: HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
    y: HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
    type: 'window',
  }
}

export function windowXCenteredOnHost(host: Pick<HauswandOpeningSpec, 'x' | 'width'>, winW = HAUSWAND_WINDOW_WIDTH_CM): number {
  return host.x + (host.width - winW) / 2
}

export function collectEgOpenings(groups: HauswandEgGroup[]): HauswandOpeningSpec[] {
  return groups.flatMap((g) => g.openings)
}

export function findOg96WindowPair(windows: HauswandOpeningSpec[]): { firstX: number; secondX: number } | null {
  const wins = windows
    .filter((w) => w.type === 'window' && w.width === HAUSWAND_WINDOW_WIDTH_CM)
    .sort((a, b) => a.x - b.x)
  for (let i = 0; i < wins.length - 1; i += 1) {
    const a = wins[i]!
    const b = wins[i + 1]!
    const gap = b.x - (a.x + HAUSWAND_WINDOW_WIDTH_CM)
    if (Math.abs(gap - HAUSWAND_WINDOW_GAP_CM) < EPS) {
      return { firstX: a.x, secondX: b.x }
    }
  }
  return null
}

function minGapBetween(a: HauswandOpeningSpec, b: HauswandOpeningSpec): number {
  if (a.type === 'door' && b.type === 'door') return HAUSWAND_DOOR_MIN_GAP_CM
  // Tür ↔ Schaufenster: 24–96 (Minimum hier; Max separat)
  if (
    (a.type === 'door' && b.role === 'shop') ||
    (b.type === 'door' && a.role === 'shop')
  ) {
    return HAUSWAND_DOOR_MIN_GAP_CM
  }
  if (a.type === 'door' || b.type === 'door') return HAUSWAND_OPENING_MIN_GAP_CM
  // Fenster ↔ Fenster / Schaufenster: immer ≥ 96 cm
  return HAUSWAND_WINDOW_GAP_CM
}

function clearGapBetween(a: HauswandOpeningSpec, b: HauswandOpeningSpec): number {
  if (a.x <= b.x) return b.x - (a.x + a.width)
  return a.x - (b.x + b.width)
}

function openingsShareVerticalBand(a: HauswandOpeningSpec, b: HauswandOpeningSpec): boolean {
  return !(a.y + a.height <= b.y + EPS || b.y + b.height <= a.y + EPS)
}

export function openingsHaveOverlap(openings: HauswandOpeningSpec[]): boolean {
  for (let i = 0; i < openings.length; i += 1) {
    for (let j = i + 1; j < openings.length; j += 1) {
      const a = openings[i]!
      const b = openings[j]!
      if (!openingsShareVerticalBand(a, b)) continue
      // Bündige Kante (Ende == Start) zählt nicht als Überlagerung
      const as = openingSpan(a)
      const bs = openingSpan(b)
      if (Math.abs(as.end - bs.start) < EPS || Math.abs(bs.end - as.start) < EPS) continue
      if (spansOverlap(as, bs)) return true
    }
  }
  return false
}

export function openingsSatisfyMinGaps(openings: HauswandOpeningSpec[]): boolean {
  const sorted = [...openings].sort((a, b) => a.x - b.x || a.y - b.y)
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i]!
      const b = sorted[j]!
      if (!openingsShareVerticalBand(a, b)) continue
      if (spansOverlap(openingSpan(a), openingSpan(b))) return false
      if (clearGapBetween(a, b) < minGapBetween(a, b) - EPS) return false
      // Weitere Öffnungen weiter rechts können noch überlappen — weiter prüfen
    }
  }
  return true
}

export function findEgGate288(groups: HauswandEgGroup[]): HauswandOpeningSpec | null {
  for (const o of collectEgOpenings(groups)) {
    if (o.type === 'door' && o.width === HAUSWAND_GATE_WIDTH_CM) return o
  }
  return null
}

export function ogWindowsAboveGate288(gate: HauswandOpeningSpec): HauswandOpeningSpec[] {
  const x2 = gate.x + HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_WINDOW_GAP_CM
  return [standardWindowAtX(gate.x), standardWindowAtX(x2)]
}

export function wallEndMarginsCm(
  wallWidthCm: number,
  openings: HauswandOpeningSpec[],
  bayMouth: CmSpan | null,
): { left: number; right: number } {
  const spans: CmSpan[] = openings.map((o) => openingSpan(o))
  if (bayMouth) spans.push(bayMouth)
  if (!spans.length) {
    const m = wallWidthCm / 2
    return { left: m, right: m }
  }
  const contentStart = Math.min(...spans.map((s) => s.start))
  const contentEnd = Math.max(...spans.map((s) => s.end))
  return { left: contentStart, right: wallWidthCm - contentEnd }
}

function dedupeWindowsByX(windows: HauswandOpeningSpec[]): HauswandOpeningSpec[] {
  const byX = new Map<number, HauswandOpeningSpec>()
  for (const w of windows) {
    byX.set(Math.round(w.x * 10), w)
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

export function alignOgWindowsAboveEgDoors(
  ogWindows: HauswandOpeningSpec[],
  egOpenings: HauswandOpeningSpec[],
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandOpeningSpec[] {
  const doors = egOpenings.filter(
    (o) => o.type === 'door' && o.width !== HAUSWAND_GATE_WIDTH_CM,
  )
  const centered = doors.map((door) => standardWindowAtX(windowXCenteredOnHost(door, winW), winW))
  let windows = ogWindows.filter((w) => w.type === 'window')
  for (const door of doors) {
    windows = windows.filter((w) => !spansOverlap(openingSpan(w), openingSpan(door)))
  }
  const kept: HauswandOpeningSpec[] = [...centered]
  for (const w of dedupeWindowsByX([...windows, ...centered])) {
    const conflicts = kept.some((prev) => {
      if (Math.abs(prev.x - w.x) < EPS) return false
      if (spansOverlap(openingSpan(prev), openingSpan(w))) return true
      const need =
        prev.type === 'window' && w.type === 'window'
          ? HAUSWAND_WINDOW_GAP_CM
          : HAUSWAND_OPENING_MIN_GAP_CM
      return clearGapBetween(prev, w) < need - EPS
    })
    if (!conflicts) kept.push(w)
  }
  return dedupeWindowsByX(kept)
}

export function buildAlignedOgWindows(
  plan: Pick<HauswandPlan, 'widthCm' | 'bay' | 'bays' | 'windowWidthCm'>,
): HauswandOpeningSpec[] {
  const winW = plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM
  const mouths = bayMouthSpansForPlan(plan)
  return layoutHauswandWindowXs(plan.widthCm, mouths, winW).map((x) => standardWindowAtX(x, winW))
}

export function buildAlignedWindowSpecs(
  wallWidthCm: number,
  bay: HauswandBayPlan | HauswandBayPlan[] | null,
  blocked: CmSpan[],
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandOpeningSpec[] {
  const bays = Array.isArray(bay) ? bay : bay ? [bay] : []
  const mouths = bays.map((b) => bayMouthSpan(b))
  const xs = layoutHauswandWindowXs(wallWidthCm, mouths, winW)
  const out: HauswandOpeningSpec[] = []
  for (const x of xs) {
    const span = openingSpan({ x, width: winW })
    if (blocked.some((b) => spansOverlap(span, b))) continue
    out.push(standardWindowAtX(x, winW))
  }
  return out
}

function sanitizeOpeningList(openings: HauswandOpeningSpec[]): HauswandOpeningSpec[] {
  const doors = openings.filter((o) => o.type === 'door')
  const basement = openings.filter((o) => o.role === 'basement')
  let windows = openings.filter((o) => o.type === 'window' && o.role !== 'basement')
  windows = windows.filter((w) => {
    if (doors.some((d) => spansOverlap(openingSpan(d), openingSpan(w)))) return false
    if (doors.some((d) => clearGapBetween(d, w) < minGapBetween(d, w) - EPS)) return false
    return true
  })
  const kept: HauswandOpeningSpec[] = [...doors]
  for (const w of windows.sort((a, b) => a.x - b.x)) {
    const bad = kept.some((prev) => {
      if (spansOverlap(openingSpan(prev), openingSpan(w))) return true
      return clearGapBetween(prev, w) < minGapBetween(prev, w) - EPS
    })
    if (!bad) kept.push(w)
  }
  for (const b of basement) {
    const hitsDoor = doors.some((d) => spansOverlap(openingSpan(d), openingSpan(b)))
    if (!hitsDoor) kept.push(b)
  }
  return kept.sort((a, b) => a.x - b.x)
}

function sanitizeEgGroups(groups: HauswandEgGroup[]): HauswandEgGroup[] {
  const all = sanitizeOpeningList(collectEgOpenings(groups))
  if (!all.length) return []
  const axisCount = groups.reduce((max, g) => Math.max(max, g.axisStart + g.axisCount), 0)
  const axisStart = groups.reduce((min, g) => Math.min(min, g.axisStart), 0)
  return [{ axisStart, axisCount: axisCount || 1, openings: all }]
}

export function basementWindowUnder(host: HauswandOpeningSpec): HauswandOpeningSpec {
  const width = Math.min(HAUSWAND_BASEMENT_WINDOW_WIDTH_CM, host.width)
  return {
    x: host.x + (host.width - width) / 2,
    width,
    height: HAUSWAND_BASEMENT_WINDOW_HEIGHT_CM,
    y: 0,
    type: 'window',
    role: 'basement',
  }
}

function appendBasementWindows(
  groups: HauswandEgGroup[],
  opts?: { enabled?: boolean },
): HauswandEgGroup[] {
  if (opts?.enabled === false) return groups
  const all = collectEgOpenings(groups)
  const hosts = all.filter(
    (o) =>
      o.type === 'window' &&
      o.role !== 'basement' &&
      o.role !== 'shop' &&
      o.height === HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
  )
  const extras = hosts.map((h) => basementWindowUnder(h))
  if (!extras.length) return groups
  return sanitizeEgGroups([...groups, { axisStart: 0, axisCount: 1, openings: extras }])
}

/** Kellerfenster optional anhängen (Zufall ~30 %). */
export function withOptionalBasementWindows(
  plan: HauswandPlan,
  enabled: boolean,
): HauswandPlan {
  const without = sanitizeEgGroups([
    {
      axisStart: 0,
      axisCount: plan.axes,
      openings: collectEgOpenings(plan.egGroups).filter((o) => o.role !== 'basement'),
    },
  ])
  if (!enabled) return { ...plan, egGroups: without }
  return { ...plan, egGroups: appendBasementWindows(without, { enabled: true }) }
}

/** Stellt sicher, dass mindestens eine gültige Eingangstür existiert. */
export function ensureEntranceDoor(
  openings: HauswandOpeningSpec[],
  widthCm: number,
): HauswandOpeningSpec[] {
  const has = openings.some((o) => {
    if (o.type !== 'door') return false
    return (
      (o.width === HAUSWAND_NARROW_DOOR_WIDTH_CM ||
        o.width === HAUSWAND_ENTRANCE_DOOR_WIDTH_CM ||
        o.width === HAUSWAND_GATE_WIDTH_CM) &&
      o.height === HAUSWAND_DOOR_HEIGHT_CM
    )
  })
  if (has) return openings
  const doorW = HAUSWAND_ENTRANCE_DOOR_WIDTH_CM
  const x = Math.max(
    HAUSWAND_END_MARGIN_MIN_CM,
    Math.min(
      Math.round((widthCm - doorW) / 2 / 8) * 8,
      widthCm - HAUSWAND_END_MARGIN_MIN_CM - doorW,
    ),
  )
  return [
    ...openings.filter((o) => {
      if (o.type === 'door') return false
      const g = o.x <= x ? x - (o.x + o.width) : o.x - (x + doorW)
      return g + EPS >= HAUSWAND_DOOR_MIN_GAP_CM || g < -EPS
    }),
    { x, width: doorW, height: HAUSWAND_DOOR_HEIGHT_CM, y: 0, type: 'door' as const },
  ].sort((a, b) => a.x - b.x)
}

/** Schaufenster: Tür links oder rechts mit Abstand 24…96 cm (neben Erker-Mund ≥48). */
export function ensureShopAdjacentDoors(
  openings: HauswandOpeningSpec[],
  widthCm: number,
  mouths: CmSpan[] = [],
): HauswandOpeningSpec[] {
  const doorW = HAUSWAND_NARROW_DOOR_WIDTH_CM
  const doorH = HAUSWAND_DOOR_HEIGHT_CM
  let out = [...openings]
  const shops = out.filter((o) => o.role === 'shop')
  for (const shop of shops) {
    const shopSpan = openingSpan(shop)
    const underBay = mouths.some(
      (m) =>
        Math.abs(m.start - shopSpan.start) < 8 && Math.abs(m.end - shopSpan.end) < 8,
    )
    // Neben Erker-Mund: Tür↔Mund ≥48 ⇒ Shop↔Tür mindestens 48
    const minGap = underBay ? HAUSWAND_WINDOW_BAY_GAP_CM : HAUSWAND_DOOR_MIN_GAP_CM
    const doors = out.filter((o) => o.type === 'door')
    const ok = doors.some((d) => {
      const g =
        d.x + d.width <= shop.x + EPS
          ? shop.x - (d.x + d.width)
          : d.x >= shop.x + shop.width - EPS
            ? d.x - (shop.x + shop.width)
            : -1
      return g + EPS >= minGap && g <= HAUSWAND_WINDOW_GAP_CM + EPS
    })
    if (ok) continue
    const rightX = shop.x + shop.width + minGap
    const leftX = shop.x - minGap - doorW
    let x = rightX
    if (rightX + doorW > widthCm - HAUSWAND_END_MARGIN_MIN_CM + EPS) {
      x = leftX
    }
    if (x < HAUSWAND_END_MARGIN_MIN_CM - EPS) continue
    out = out.filter((o) => {
      if (o === shop || o.type === 'door') return true
      const g = o.x <= x ? x - (o.x + o.width) : o.x - (x + doorW)
      return g + EPS >= HAUSWAND_DOOR_MIN_GAP_CM || g < -EPS
    })
    out.push({
      x,
      width: doorW,
      height: doorH,
      y: 0,
      type: 'door',
    })
  }
  return out.sort((a, b) => a.x - b.x)
}

/** EG: Abstand zwischen Nicht-Tür-Öffnungen ≥ 96 (Schaufenster inklusive). */
export function enforceEgOpeningGaps96(
  openings: HauswandOpeningSpec[],
  widthCm: number,
): HauswandOpeningSpec[] {
  const sorted = [...openings].sort((a, b) => a.x - b.x)
  const kept: HauswandOpeningSpec[] = []
  for (const o of sorted) {
    const bad = kept.some((prev) => {
      if (spansOverlap(openingSpan(prev), openingSpan(o))) return true
      const g = clearGapBetween(prev, o)
      return g + EPS < minGapBetween(prev, o)
    })
    if (!bad) {
      kept.push(o)
      continue
    }
    // Türen/Shops: nach rechts schieben oder Priorität behalten
    if (o.type === 'door' || o.role === 'shop') {
      const prev = kept[kept.length - 1]!
      const need = minGapBetween(prev, o)
      const x = prev.x + prev.width + need
      if (x + o.width <= widthCm - HAUSWAND_END_MARGIN_MIN_CM + EPS) {
        kept.push({ ...o, x })
      } else {
        // Konfliktfenster davor entfernen, Tür/Shop behalten
        while (
          kept.length &&
          kept[kept.length - 1]!.type === 'window' &&
          kept[kept.length - 1]!.role !== 'shop'
        ) {
          const cand = kept[kept.length - 1]!
          const g = clearGapBetween(cand, o)
          if (g + EPS >= minGapBetween(cand, o) && !spansOverlap(openingSpan(cand), openingSpan(o))) {
            break
          }
          kept.pop()
        }
        const stillBad = kept.some((prev) => {
          if (spansOverlap(openingSpan(prev), openingSpan(o))) return true
          return clearGapBetween(prev, o) + EPS < minGapBetween(prev, o)
        })
        if (!stillBad) kept.push(o)
      }
      continue
    }
    // Standardfenster: nie verschieben (EG↔OG-Flucht) — bei Konflikt verwerfen
  }
  return kept
}

/**
 * 45°-Erker-Spalte (Mundbreite): mittig 96, links/rechts 48 mit 64 cm Abstand.
 * Einzige erlaubte 48er auf der Fassadenliste.
 */
export function layoutAngled45BayColumnWindows(mouthWidthCm: number): HauswandOpeningSpec[] {
  const content =
    HAUSWAND_NARROW_WINDOW_WIDTH_CM +
    HAUSWAND_ANGLED45_SIDE_GAP_CM +
    HAUSWAND_WINDOW_WIDTH_CM +
    HAUSWAND_ANGLED45_SIDE_GAP_CM +
    HAUSWAND_NARROW_WINDOW_WIDTH_CM
  if (mouthWidthCm + EPS < content) {
    return [standardWindowAtX((mouthWidthCm - HAUSWAND_WINDOW_WIDTH_CM) / 2)]
  }
  const x0 = (mouthWidthCm - content) / 2
  const leftX = x0
  const centerX = x0 + HAUSWAND_NARROW_WINDOW_WIDTH_CM + HAUSWAND_ANGLED45_SIDE_GAP_CM
  const rightX =
    centerX + HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_ANGLED45_SIDE_GAP_CM
  return [
    standardWindowAtX(leftX, HAUSWAND_NARROW_WINDOW_WIDTH_CM),
    standardWindowAtX(centerX, HAUSWAND_WINDOW_WIDTH_CM),
    standardWindowAtX(rightX, HAUSWAND_NARROW_WINDOW_WIDTH_CM),
  ].sort((a, b) => a.x - b.x)
}

/** 45°-Erker-Frontwand: bei genug Breite dasselbe Muster, sonst nur mittig 96. */
export function layoutAngled45BayFrontWindows(frontWidthCm: number): HauswandOpeningSpec[] {
  const content =
    HAUSWAND_NARROW_WINDOW_WIDTH_CM +
    HAUSWAND_ANGLED45_SIDE_GAP_CM +
    HAUSWAND_WINDOW_WIDTH_CM +
    HAUSWAND_ANGLED45_SIDE_GAP_CM +
    HAUSWAND_NARROW_WINDOW_WIDTH_CM
  if (frontWidthCm + EPS >= content) return layoutAngled45BayColumnWindows(frontWidthCm)
  return [standardWindowAtX((frontWidthCm - HAUSWAND_WINDOW_WIDTH_CM) / 2)]
}

/** Fassadenfenster, die über dem Erker-Mund weiterlaufen (90°-Front = Mundbreite). */
export function windowsContinuedOnBayFront(
  bay: HauswandBayPlan,
  facadeWindows: HauswandOpeningSpec[],
): HauswandOpeningSpec[] {
  const preset = presetForBayPlan(bay)
  if (bay.shape === 'angled45') return layoutAngled45BayFrontWindows(preset.frontWidthCm)
  const mouth = bayMouthSpan(bay)
  const fromFacade = facadeWindows
    .filter((w) => {
      const span = openingSpan(w)
      return span.start >= mouth.start - EPS && span.end <= mouth.end + EPS
    })
    .map((w) => ({ ...w, x: w.x - mouth.start }))
  if (fromFacade.length) return fromFacade
  const winW = Math.min(HAUSWAND_WINDOW_WIDTH_CM, preset.frontWidthCm)
  if (winW + 2 * HAUSWAND_OPENING_MIN_GAP_CM <= preset.frontWidthCm + EPS) {
    return [standardWindowAtX((preset.frontWidthCm - winW) / 2, winW)]
  }
  return [standardWindowAtX(Math.max(0, (preset.frontWidthCm - winW) / 2), winW)]
}

/** Erker-Spalte auf Fassaden-X: Fenster wie auf der Erker-Front (für EG / oberstes OG). */
export function bayColumnFacadeWindows(
  bay: HauswandBayPlan,
  opts?: { useFullMouthWidth?: boolean },
): HauswandOpeningSpec[] {
  const mouth = bayMouthSpan(bay)
  if (opts?.useFullMouthWidth) {
    return [
      {
        x: mouth.start,
        width: mouth.end - mouth.start,
        height: HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
        y: HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
        type: 'window',
      },
    ]
  }
  if (bay.shape === 'angled45') {
    return layoutAngled45BayColumnWindows(mouth.end - mouth.start).map((w) => ({
      ...w,
      x: w.x + mouth.start,
    }))
  }
  return windowsContinuedOnBayFront(bay, []).map((w) => ({
    ...w,
    x: w.x + mouth.start,
  }))
}

/** Lücke Mund → nächste Öffnung (0 wenn Öffnung den Mund berührt/überlappt). */
export function gapOpeningToBayMouth(opening: HauswandOpeningSpec, mouth: CmSpan): number {
  const span = openingSpan(opening)
  if (spansOverlap(span, mouth)) return 0
  if (span.end <= mouth.start + EPS) return mouth.start - span.end
  if (span.start >= mouth.end - EPS) return span.start - mouth.end
  return 0
}

export function baySideGapsOk(
  wallWidthCm: number,
  openings: HauswandOpeningSpec[],
  mouths: CmSpan[],
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): boolean {
  for (const mouth of mouths) {
    const exterior = openings.filter(
      (o) => o.role !== 'basement' && !spansOverlap(openingSpan(o), mouth),
    )
    const left = exterior
      .filter((o) => openingSpan(o).end <= mouth.start + EPS)
      .sort((a, b) => b.x - a.x)[0]
    const right = exterior
      .filter((o) => openingSpan(o).start >= mouth.end - EPS)
      .sort((a, b) => a.x - b.x)[0]
    if (left) {
      const g = gapOpeningToBayMouth(left, mouth)
      if (g < HAUSWAND_WINDOW_BAY_GAP_CM - EPS || g > HAUSWAND_WINDOW_BAY_GAP_MAX_CM + EPS) return false
    } else if (mouth.start > HAUSWAND_END_MARGIN_MIN_CM + winW + EPS) {
      return false
    }
    if (right) {
      const g = gapOpeningToBayMouth(right, mouth)
      if (g < HAUSWAND_WINDOW_BAY_GAP_CM - EPS || g > HAUSWAND_WINDOW_BAY_GAP_MAX_CM + EPS) return false
    } else if (wallWidthCm - mouth.end > HAUSWAND_END_MARGIN_MIN_CM + winW + EPS) {
      return false
    }
  }
  return true
}

export function firstLast96MarginsOk(
  wallWidthCm: number,
  windows: HauswandOpeningSpec[],
  mouths: CmSpan[] = [],
): boolean {
  const wins = windows
    .filter((w) => w.type === 'window' && w.width === HAUSWAND_WINDOW_WIDTH_CM && w.role !== 'basement')
    .sort((a, b) => a.x - b.x)
  if (!wins.length) return true
  const first = wins[0]!
  const last = wins[wins.length - 1]!
  const leftBay = mouths.some((m) => m.start <= HAUSWAND_END_MARGIN_MIN_CM + HAUSWAND_WINDOW_WIDTH_CM)
  const rightBay = mouths.some((m) => m.end >= wallWidthCm - HAUSWAND_END_MARGIN_MIN_CM - HAUSWAND_WINDOW_WIDTH_CM)
  const left = first.x
  const right = wallWidthCm - (last.x + last.width)
  if (!leftBay && (left < HAUSWAND_END_MARGIN_MIN_CM - 24 || left > HAUSWAND_END_MARGIN_MAX_CM + 96)) {
    return false
  }
  if (!rightBay && (right < HAUSWAND_END_MARGIN_MIN_CM - 24 || right > HAUSWAND_END_MARGIN_MAX_CM + 96)) {
    return false
  }
  return true
}

function shiftOpenings(openings: HauswandOpeningSpec[], dx: number): HauswandOpeningSpec[] {
  if (Math.abs(dx) < EPS) return openings
  return openings.map((o) => ({ ...o, x: o.x + dx }))
}

function shiftEgGroups(groups: HauswandEgGroup[], dx: number): HauswandEgGroup[] {
  if (Math.abs(dx) < EPS) return groups
  return groups.map((g) => ({ ...g, openings: shiftOpenings(g.openings, dx) }))
}

/**
 * Linke und rechte Außenabstände der Öffnungen identisch.
 * Breite bleibt unverändert; nur Verschieben. Leerraum nach dem Zentrieren ≤ 96 cm
 * (sonst vorher per Raster füllen). Ausnahme Regenrinne: `opts.asymmetricDownpipe`.
 */
export function ensureSymmetricEndMargins(
  plan: HauswandPlan,
  opts?: { asymmetricDownpipe?: 'left' | 'right' | null },
): HauswandPlan {
  if (opts?.asymmetricDownpipe) return plan
  const eg = collectEgOpenings(plan.egGroups).filter((o) => o.role !== 'basement')
  const og = plan.ogWindowByAxis
  const spans: CmSpan[] = [...eg, ...og].map((o) => openingSpan(o))
  // Erker-Mund nicht in die Außenabstands-Symmetrie der Wandöffnungen einbeziehen
  if (!spans.length) return plan

  const contentStart = Math.min(...spans.map((s) => s.start))
  const contentEnd = Math.max(...spans.map((s) => s.end))
  const contentW = contentEnd - contentStart
  let widthCm = plan.widthCm
  let free = widthCm - contentW
  if (free < -EPS) {
    const overflowLeft = Math.max(0, HAUSWAND_END_MARGIN_MIN_CM - contentStart)
    const overflowRight = Math.max(0, contentEnd - (widthCm - HAUSWAND_END_MARGIN_MIN_CM))
    const dxClamp = overflowLeft - overflowRight
    if (Math.abs(dxClamp) < EPS) return plan
    const baysClamp = planBays(plan).map((b) => ({
      ...b,
      centerLocalXCm: b.centerLocalXCm + dxClamp,
    }))
    return {
      ...plan,
      egGroups: shiftEgGroups(plan.egGroups, dxClamp),
      ogWindowByAxis: shiftOpenings(plan.ogWindowByAxis, dxClamp),
      bays: baysClamp,
      bay: baysClamp[0] ?? null,
    }
  }
  // Mindestens 96 cm Rand je Seite
  if (free < 2 * HAUSWAND_END_MARGIN_MIN_CM - EPS) {
    widthCm = contentW + 2 * HAUSWAND_END_MARGIN_MIN_CM
    free = widthCm - contentW
  }
  // Nie leerer als MAX cm je Seite — nicht unter Achsenraster schrumpfen
  if (free / 2 > HAUSWAND_END_MARGIN_MAX_CM + EPS) {
    const floor = hauswandWidthCm(plan.axes, plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM)
    widthCm = Math.max(floor, contentW + 2 * HAUSWAND_END_MARGIN_MAX_CM)
    free = widthCm - contentW
  }
  const margin = free / 2
  const dx = margin - contentStart
  if (Math.abs(dx) < EPS && Math.abs(widthCm - plan.widthCm) < EPS) return plan
  // Guard: extremes Shifts erzeugen negative Öffnungen
  if (Math.abs(dx) > plan.widthCm + EPS) return plan

  const bays = planBays(plan).map((b) => ({
    ...b,
    centerLocalXCm: b.centerLocalXCm + dx,
  }))
  return {
    ...plan,
    widthCm,
    egGroups: shiftEgGroups(plan.egGroups, dx),
    ogWindowByAxis: shiftOpenings(plan.ogWindowByAxis, dx),
    bays,
    bay: bays[0] ?? null,
  }
}

/** Breite bleibt Achsenraster; Rand; EG fluchtet mit OG; Keller; Erker ausgemittelt. */
export function finalizeHauswandPlanLayout(plan: HauswandPlan): HauswandPlan {
  const winW = plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM
  let widthCm = hauswandWidthCm(plan.axes, winW)
  let bays = planBays(plan)

  let egPreserved = collectEgOpenings(plan.egGroups).filter(
    (o) => o.type === 'door' || o.role === 'shop',
  )

  // 1) Fenster grob legen (Mund vorläufig)
  let mouths = bays.map((b) => bayMouthSpan(b))
  let og = layoutHauswandWindowXs(widthCm, mouths, winW).map((x) => standardWindowAtX(x, winW))
  const gate = findEgGate288([{ axisStart: 0, axisCount: 1, openings: egPreserved }])
  if (gate && !bays.length && winW === HAUSWAND_WINDOW_WIDTH_CM) {
    const over = ogWindowsAboveGate288(gate)
    og = og.filter((w) => !spansOverlap(openingSpan(w), openingSpan(gate)))
    for (const w of over) {
      if (!og.some((o) => Math.abs(o.x - w.x) < EPS)) og.push(w)
    }
    og.sort((a, b) => a.x - b.x)
  }
  og = alignOgWindowsAboveEgDoors(og, egPreserved, winW)

  // 2) Erker ausmitteln, danach Tür-Regel (ganz über / ≥48) erzwingen
  if (bays.length) {
    bays = recenterBaysBetweenOpenings(
      { ...plan, widthCm, bays, bay: bays[0] ?? null },
      [...egPreserved, ...og],
    )
    bays = resolveBaysVersusDoors(
      { ...plan, widthCm, bays, bay: bays[0] ?? null },
      egPreserved.filter((o) => o.type === 'door'),
      winW,
    )
    mouths = bays.map((b) => bayMouthSpan(b))
    og = layoutHauswandWindowXs(widthCm, mouths, winW).map((x) => standardWindowAtX(x, winW))
    og = alignOgWindowsAboveEgDoors(og, egPreserved, winW)
  }

  const firstX = HAUSWAND_END_MARGIN_MIN_CM
  const lastX = widthCm - HAUSWAND_END_MARGIN_MIN_CM - winW
  const endBlocked = (x: number) =>
    mouths.some((m) =>
      spansOverlap(
        { start: x, end: x + winW },
        { start: m.start - HAUSWAND_WINDOW_BAY_GAP_CM, end: m.end + HAUSWAND_WINDOW_BAY_GAP_CM },
      ),
    )
  if (!endBlocked(firstX) && !og.some((w) => Math.abs(w.x - firstX) < 1)) {
    og = [standardWindowAtX(firstX, winW), ...og]
  }
  if (!endBlocked(lastX) && !og.some((w) => Math.abs(w.x - lastX) < 1)) {
    og = [...og, standardWindowAtX(lastX, winW)]
  }
  og = alignOgWindowsAboveEgDoors(og, egPreserved, winW)

  // 3) Nachbarn am Erker mit 48 cm Lücke
  og = ensureBaySideNeighbors48(og, mouths, widthCm, winW)

  // 4) Erker-Spalte (45°: 96+48@64; rect: 96er)
  const doorsOnly = egPreserved.filter((o) => o.type === 'door')
  og = alignOgWindowsAboveEgDoors(
    og.filter((w) => !mouths.some((m) => spansOverlap(openingSpan(w), m))),
    doorsOnly,
    winW,
  )
  for (const bay of bays) {
    for (const w of bayColumnFacadeWindows(bay, { useFullMouthWidth: false })) {
      // 48er nur in 45°-Spalte erlaubt
      if (w.width < HAUSWAND_WINDOW_WIDTH_CM - EPS && bay.shape !== 'angled45') continue
      if (!og.some((o) => Math.abs(o.x - w.x) < EPS && Math.abs(o.width - w.width) < EPS)) og.push(w)
    }
  }
  og = dedupeWindowsByX(og)

  // 5) Leere > 128 füllen (Türen mitverschieben)
  {
    const doorsKeep = egPreserved.filter((o) => o.type === 'door')
    const filled = fillEmptySpansWithWindows(widthCm, [...doorsKeep, ...og], mouths, winW)
    og = filled.openings.filter((o) => o.type === 'window')
    egPreserved = [
      ...filled.openings.filter((o) => o.type === 'door'),
      ...egPreserved.filter((o) => o.role === 'shop'),
    ]
    widthCm = filled.widthCm
    mouths = filled.mouths
    bays = syncBaysToMouths(bays, mouths)
  }

  // 6) EG-Standardfenster bündig mit OG (Shop/Tür bleiben)
  egPreserved = [
    ...egPreserved.filter((o) => o.type === 'door'),
    ...shopsUnderBays(bays, egPreserved.filter((o) => o.type === 'door')),
  ]
  let egWindows = alignEgWindowsToOg(og, egPreserved, mouths, winW)
  let egAll = [...egPreserved, ...egWindows]
  {
    const filled = fillEmptySpansWithWindows(widthCm, egAll, mouths, winW)
    egAll = filled.openings
    widthCm = filled.widthCm
    mouths = filled.mouths
    bays = syncBaysToMouths(bays, mouths)
  }
  // Shop unter Erker nach Shift neu
  const doors = egAll.filter((o) => o.type === 'door')
  egWindows = egAll.filter((o) => o.type === 'window' && o.role !== 'shop' && o.role !== 'basement')
  egPreserved = [...doors, ...shopsUnderBays(bays, doors)]
  // EG nochmals an OG anbinden (nach Aufweiten)
  egWindows = alignEgWindowsToOg(og, egPreserved, mouths, winW)
  let egGroups = sanitizeEgGroups([
    { axisStart: 0, axisCount: plan.axes, openings: [...egPreserved, ...egWindows] },
  ])
  egGroups = appendBasementWindows(egGroups, { enabled: false })

  let next: HauswandPlan = {
    ...plan,
    widthCm,
    bays,
    bay: bays[0] ?? null,
    egGroups,
    ogWindowByAxis: og,
    windowWidthCm: winW,
  }
  next = ensureSymmetricEndMargins(next)
  let mouths2 = bayMouthSpansForPlan(next)
  let og2 = ensureBaySideNeighbors48(
    next.ogWindowByAxis,
    mouths2,
    next.widthCm,
    next.windowWidthCm ?? winW,
  )
  {
    const doorsKeep = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
    const filled = fillEmptySpansWithWindows(
      next.widthCm,
      [...doorsKeep, ...og2],
      mouths2,
      next.windowWidthCm ?? winW,
    )
    og2 = filled.openings.filter((o) => o.type === 'window')
    mouths2 = filled.mouths
    const bays2 = syncBaysToMouths(planBays(next), mouths2)
    next = {
      ...next,
      widthCm: filled.widthCm,
      bays: bays2,
      bay: bays2[0] ?? null,
      egGroups: sanitizeEgGroups([
        {
          axisStart: 0,
          axisCount: plan.axes,
          openings: [
            ...filled.openings.filter((o) => o.type === 'door'),
            ...collectEgOpenings(next.egGroups).filter((o) => o.role === 'shop'),
          ],
        },
      ]),
    }
  }
  // Erker vs. Türen nochmals nach Shift
  {
    const doors2 = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
    const fixed = resolveBaysVersusDoors(next, doors2, next.windowWidthCm ?? winW)
    next = { ...next, bays: fixed, bay: fixed[0] ?? null }
    mouths2 = bayMouthSpansForPlan(next)
  }
  og2 = sanitizeOgWindowGaps(og2, mouths2)
  for (const bay of planBays(next)) {
    for (const w of bayColumnFacadeWindows(bay, { useFullMouthWidth: false })) {
      if (w.width < HAUSWAND_WINDOW_WIDTH_CM - EPS && bay.shape !== 'angled45') continue
      if (!og2.some((o) => Math.abs(o.x - w.x) < EPS && Math.abs(o.width - w.width) < EPS)) {
        og2.push(w)
      }
    }
  }
  // EG final bündig zu OG
  {
    const doors2 = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
    const shops = shopsUnderBays(planBays(next), doors2)
    const egW = alignEgWindowsToOg(dedupeWindowsByX(og2), [...doors2, ...shops], mouths2, winW)
    next = {
      ...next,
      egGroups: appendBasementWindows(
        sanitizeEgGroups([{ axisStart: 0, axisCount: plan.axes, openings: [...doors2, ...shops, ...egW] }]),
        { enabled: false },
      ),
      ogWindowByAxis: dedupeWindowsByX(og2),
    }
  }
  next = ensureSymmetricEndMargins(next)
  {
    const m3 = bayMouthSpansForPlan(next)
    const doorsKeep = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
    const filled = fillEmptySpansWithWindows(
      next.widthCm,
      [...doorsKeep, ...next.ogWindowByAxis],
      m3,
      next.windowWidthCm ?? winW,
    )
    const bays3 = syncBaysToMouths(planBays(next), filled.mouths).filter((b) => {
      const m = bayMouthSpan(b)
      return m.start >= -EPS && m.end <= filled.widthCm + EPS
    })
    const doors3 = filled.openings.filter((o) => o.type === 'door')
    const shops3 = shopsUnderBays(bays3, doors3)
    let ogFinal = sanitizeOgWindowGaps(
      dedupeWindowsByX(filled.openings.filter((o) => o.type === 'window')).filter((w, _i, arr) => {
        const hit = arr.find(
          (o) =>
            o !== w &&
            spansOverlap(openingSpan(o), openingSpan(w)) &&
            !(Math.abs(o.x + o.width - w.x) < EPS || Math.abs(w.x + w.width - o.x) < EPS),
        )
        if (!hit) return true
        return w.width >= hit.width && w.x <= hit.x
      }),
      filled.mouths,
    )
    const egAligned = alignEgWindowsToOg(ogFinal, [...doors3, ...shops3], filled.mouths, winW)
    const egFilled = fillEmptySpansWithWindows(
      filled.widthCm,
      [...doors3, ...shops3, ...egAligned],
      filled.mouths,
      winW,
    )
    const bays4 = syncBaysToMouths(bays3, egFilled.mouths)
    const doors4 = egFilled.openings.filter((o) => o.type === 'door')
    const shops4 = shopsUnderBays(bays4, doors4)
    const egWins = egFilled.openings.filter(
      (o) => o.type === 'window' && o.role !== 'shop' && o.role !== 'basement',
    )
    for (const w of egWins) {
      if (
        !ogFinal.some(
          (o) =>
            Math.abs(o.x - w.x) < 1 ||
            spansOverlap(openingSpan(o), openingSpan(w)),
        )
      ) {
        ogFinal.push(standardWindowAtX(w.x, w.width))
      }
    }
    ogFinal = dedupeWindowsByX(ogFinal)
    next = ensureSymmetricEndMargins({
      ...next,
      widthCm: egFilled.widthCm,
      bays: bays4,
      bay: bays4[0] ?? null,
      ogWindowByAxis: ogFinal,
      egGroups: appendBasementWindows(
        sanitizeEgGroups([
          { axisStart: 0, axisCount: plan.axes, openings: [...doors4, ...shops4, ...egWins] },
        ]),
        { enabled: false },
      ),
    })
  }
  {
    const inWall = planBays(next).filter((b) => {
      const m = bayMouthSpan(b)
      return m.start >= -EPS && m.end <= next.widthCm + EPS
    })
    if (inWall.length !== planBays(next).length) {
      next = { ...next, bays: inWall, bay: inWall[0] ?? null }
    }
  }
  // Breite auf sinnvolles Maß deckeln bevor Polish
  {
    const cap = hauswandWidthCm(plan.axes, winW) * 2
    if (next.widthCm > cap + EPS) {
      next = { ...next, widthCm: hauswandWidthCm(plan.axes, winW) }
    }
  }
  // Final: Shop-Tür, Erker↔Tür, Lücken, EG-Flucht, Eingang
  return polishHauswandPlan(next, winW)
}


/** Schaufenster unter jedem Erker-Mund, sofern keine Tür den Mund schneidet. */
function shopsUnderBays(
  bays: HauswandBayPlan[],
  doors: HauswandOpeningSpec[],
): HauswandOpeningSpec[] {
  const out: HauswandOpeningSpec[] = []
  for (const bay of bays) {
    const mouth = bayMouthSpan(bay)
    if (doors.some((d) => spansOverlap(openingSpan(d), mouth))) continue
    out.push({
      x: mouth.start,
      width: mouth.end - mouth.start,
      height: HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
      y: HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
      type: 'window',
      role: 'shop',
    })
  }
  return out
}

/** Nach Tür/Shop: wenn Lücke zum nächsten > 128, Fenster einfügen (OG+EG). */
function ensureMaxGapAfterPreserved(
  windows: HauswandOpeningSpec[],
  preserved: HauswandOpeningSpec[],
  mouths: CmSpan[],
  widthCm: number,
  winW: number,
): HauswandOpeningSpec[] {
  let out = dedupeWindowsByX(windows)
  const anchors = [...preserved, ...mouths.map((m) => ({ x: m.start, width: m.end - m.start }))]
  for (const a of anchors) {
    const aEnd = a.x + a.width
    const next = [...out, ...preserved]
      .filter((o) => o.x >= aEnd - EPS)
      .sort((b, c) => b.x - c.x)[0]
    const rightLimit = widthCm - HAUSWAND_END_MARGIN_MIN_CM
    const gapEnd = next ? next.x : rightLimit
    const empty = gapEnd - aEnd
    if (empty <= HAUSWAND_END_MARGIN_MAX_CM + EPS) continue
    const x = aEnd + HAUSWAND_WINDOW_GAP_CM
    const fillW =
      empty >= winW + 2 * HAUSWAND_WINDOW_GAP_CM - EPS ? winW : HAUSWAND_WINDOW_WIDTH_CM
    if (x + fillW > gapEnd + EPS && next) {
      // Aufweiten nicht hier — 96er so nah wie möglich
      const x2 = Math.min(x, gapEnd - fillW)
      if (x2 >= aEnd + HAUSWAND_OPENING_MIN_GAP_CM - EPS) {
        out.push(standardWindowAtX(x2, fillW))
      }
      continue
    }
    if (x + fillW <= rightLimit + EPS) {
      const hitsMouth = mouths.some((m) => spansOverlap({ start: x, end: x + fillW }, m))
      if (!hitsMouth) out.push(standardWindowAtX(x, fillW))
    }
  }
  return dedupeWindowsByX(out)
}

/** EG-Standardfenster an OG-Positionen (Shop/Tür/Mund auslassen). */
export function alignEgWindowsToOg(
  og: HauswandOpeningSpec[],
  egPreserved: HauswandOpeningSpec[],
  mouths: CmSpan[],
  winW: number,
): HauswandOpeningSpec[] {
  void winW
  const out: HauswandOpeningSpec[] = []
  for (const w of og) {
    if (w.width < HAUSWAND_WINDOW_WIDTH_CM - EPS) continue // keine 48er im EG
    if (mouths.some((m) => spansOverlap(openingSpan(w), m))) continue
    if (egPreserved.some((p) => spansOverlap(openingSpan(p), openingSpan(w)))) continue
    if (
      egPreserved.some((p) => {
        const g = clearGapBetween(p, w)
        return g + EPS < minGapBetween(p, w) && g >= -EPS
      })
    ) {
      continue
    }
    out.push(standardWindowAtX(w.x, w.width))
  }
  return dedupeWindowsByX(out)
}

/**
 * Erker entweder mittig über einer Tür (Tür vollständig unter Mund)
 * oder klar daneben (≥48 cm) — nie teilweise überlappend.
 */
export function resolveBaysVersusDoors(
  plan: Pick<HauswandPlan, 'widthCm' | 'bay' | 'bays' | 'windowWidthCm'>,
  doors: HauswandOpeningSpec[],
  winW: number,
): HauswandBayPlan[] {
  const widthCm = plan.widthCm
  void winW
  return planBays(plan).map((bay) => {
    const mouthW0 = bayMouthSpan(bay).end - bayMouthSpan(bay).start
    let center = bay.centerLocalXCm
    for (let iter = 0; iter < 4; iter += 1) {
      let changed = false
      for (const door of doors) {
        const d = openingSpan(door)
        const doorW = d.end - d.start
        const mouth = {
          start: center - mouthW0 / 2,
          end: center + mouthW0 / 2,
        }
        const overlap = Math.min(mouth.end, d.end) - Math.max(mouth.start, d.start)
        const gap =
          overlap > EPS
            ? 0
            : d.end <= mouth.start
              ? mouth.start - d.end
              : d.start - mouth.end
        const doorFullyIn = d.start >= mouth.start - EPS && d.end <= mouth.end + EPS
        const clear = overlap <= EPS && gap + EPS >= HAUSWAND_WINDOW_BAY_GAP_CM
        if (doorFullyIn || clear) continue

        let nextCenter = center
        if (mouthW0 + EPS >= doorW) {
          nextCenter = d.start + doorW / 2
        } else if (overlap > EPS || gap < HAUSWAND_WINDOW_BAY_GAP_CM - EPS) {
          if (center >= d.start + doorW / 2) {
            nextCenter = d.end + HAUSWAND_WINDOW_BAY_GAP_CM + mouthW0 / 2
          } else {
            nextCenter = d.start - HAUSWAND_WINDOW_BAY_GAP_CM - mouthW0 / 2
          }
        }
        nextCenter = Math.max(mouthW0 / 2, Math.min(widthCm - mouthW0 / 2, nextCenter))
        nextCenter = Math.round(nextCenter / 8) * 8
        if (Math.abs(nextCenter - center) > EPS) {
          center = nextCenter
          changed = true
        }
      }
      if (!changed) break
    }
    return { ...bay, centerLocalXCm: center }
  })
}

function syncBaysToMouths(
  bays: HauswandBayPlan[],
  mouths: CmSpan[],
): HauswandBayPlan[] {
  return bays.map((b, i) => {
    const m = mouths[i]
    if (!m) return b
    return { ...b, centerLocalXCm: (m.start + m.end) / 2 }
  })
}

/** Nachbarn links/rechts vom Erker-Mund mit bevorzugter Lücke 48 cm. */
function ensureBaySideNeighbors48(
  og: HauswandOpeningSpec[],
  mouths: CmSpan[],
  widthCm: number,
  winW: number,
): HauswandOpeningSpec[] {
  let out = og.filter((w) => !mouths.some((m) => spansOverlap(openingSpan(w), m)))
  for (const mouth of mouths) {
    const leftX = mouth.start - HAUSWAND_WINDOW_BAY_GAP_CM - winW
    const rightX = mouth.end + HAUSWAND_WINDOW_BAY_GAP_CM
    const left = out
      .filter((o) => openingSpan(o).end <= mouth.start + EPS)
      .sort((a, b) => b.x - a.x)[0]
    const right = out
      .filter((o) => openingSpan(o).start >= mouth.end - EPS)
      .sort((a, b) => a.x - b.x)[0]
    const leftGap = left ? gapOpeningToBayMouth(left, mouth) : Infinity
    const rightGap = right ? gapOpeningToBayMouth(right, mouth) : Infinity
    if (
      mouth.start > HAUSWAND_END_MARGIN_MIN_CM + winW + EPS &&
      (leftGap < HAUSWAND_WINDOW_BAY_GAP_CM - EPS || leftGap > HAUSWAND_WINDOW_BAY_GAP_MAX_CM + EPS)
    ) {
      out = out.filter((o) => o !== left)
      if (leftX >= HAUSWAND_END_MARGIN_MIN_CM - EPS) {
        out.push(standardWindowAtX(leftX, winW))
      }
    }
    if (
      widthCm - mouth.end > HAUSWAND_END_MARGIN_MIN_CM + winW + EPS &&
      (rightGap < HAUSWAND_WINDOW_BAY_GAP_CM - EPS || rightGap > HAUSWAND_WINDOW_BAY_GAP_MAX_CM + EPS)
    ) {
      out = out.filter((o) => o !== right)
      if (rightX + winW <= widthCm - HAUSWAND_END_MARGIN_MIN_CM + EPS) {
        out.push(standardWindowAtX(rightX, winW))
      }
    }
    // Auf derselben Mund-Seite: Abstand Fenster↔Erker-Nachbar ≥ 96 (nicht 48)
    const leftNeighbor = out
      .filter((o) => openingSpan(o).end <= mouth.start + EPS)
      .sort((a, b) => b.x - a.x)[0]
    const rightNeighbor = out
      .filter((o) => openingSpan(o).start >= mouth.end - EPS)
      .sort((a, b) => a.x - b.x)[0]
    if (leftNeighbor) {
      out = out.filter((o) => {
        if (o === leftNeighbor) return true
        if (openingSpan(o).end > mouth.start + EPS) return true
        const g = leftNeighbor.x - (o.x + o.width)
        return g + EPS >= HAUSWAND_WINDOW_GAP_CM || g < -EPS
      })
    }
    if (rightNeighbor) {
      out = out.filter((o) => {
        if (o === rightNeighbor) return true
        if (openingSpan(o).start < mouth.end - EPS) return true
        const g = o.x - (rightNeighbor.x + rightNeighbor.width)
        return g + EPS >= HAUSWAND_WINDOW_GAP_CM || g < -EPS
      })
    }
  }
  return dedupeWindowsByX(out)
}

/** Erker zwischen Nachbar-Öffnungen so verschieben, dass Lücken möglichst 48 cm und gleich. */
export function recenterBaysBetweenOpenings(
  plan: HauswandPlan,
  openings: HauswandOpeningSpec[],
): HauswandBayPlan[] {
  const winW = plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM
  const widthCm = plan.widthCm
  return planBays(plan).map((bay) => {
    const mouth = bayMouthSpan(bay)
    const mouthW = mouth.end - mouth.start
    // Nur Öffnungen, die den Mund nicht schneiden
    const exterior = openings.filter(
      (o) => o.role !== 'basement' && !spansOverlap(openingSpan(o), mouth),
    )
    const left = exterior
      .filter((o) => openingSpan(o).end <= mouth.start + EPS)
      .sort((a, b) => b.x - a.x)[0]
    const right = exterior
      .filter((o) => openingSpan(o).start >= mouth.end - EPS)
      .sort((a, b) => a.x - b.x)[0]

    // Wenn kein linker Nachbar: Platz für Randfenster (96) + 48er-Lücke einplanen
    const leftBound = left
      ? openingSpan(left).end + HAUSWAND_WINDOW_BAY_GAP_CM
      : HAUSWAND_END_MARGIN_MIN_CM + winW + HAUSWAND_WINDOW_BAY_GAP_CM
    const rightBound = right
      ? openingSpan(right).start - HAUSWAND_WINDOW_BAY_GAP_CM - mouthW
      : widthCm - HAUSWAND_END_MARGIN_MIN_CM - winW - HAUSWAND_WINDOW_BAY_GAP_CM - mouthW

    let start: number
    if (rightBound < leftBound - EPS) {
      // Zu eng — mittig im verfügbaren Band
      const lo = left ? openingSpan(left).end : HAUSWAND_END_MARGIN_MIN_CM
      const hi = right ? openingSpan(right).start : widthCm - HAUSWAND_END_MARGIN_MIN_CM
      start = lo + Math.max(0, (hi - lo - mouthW) / 2)
    } else {
      start = (leftBound + rightBound) / 2
    }
    start = Math.round(start / 8) * 8
    start = Math.max(
      HAUSWAND_END_MARGIN_MIN_CM,
      Math.min(start, widthCm - HAUSWAND_END_MARGIN_MIN_CM - mouthW),
    )
    return { ...bay, centerLocalXCm: start + mouthW / 2 }
  })
}

export interface FillEmptySpansResult {
  openings: HauswandOpeningSpec[]
  widthCm: number
  mouths: CmSpan[]
}

/**
 * Leere Streifen > 128 cm: Fenster einfügen. **Keine Wand-Aufweitung** (v2.0.508) —
 * sonst explodiert die Breite in Finalize-Schleifen. Passt ein Fenster nicht, bleibt die Lücke.
 */
export function fillEmptySpansWithWindows(
  wallWidthCm: number,
  openings: HauswandOpeningSpec[],
  mouths: CmSpan[],
  winW: number,
): FillEmptySpansResult {
  let widthCm = wallWidthCm
  let mouthsWork = mouths.map((m) => ({ ...m }))
  let out = [...openings]

  for (let pass = 0; pass < 24; pass += 1) {
    if (widthCm > wallWidthCm + (winW + HAUSWAND_WINDOW_GAP_CM) * 3 + EPS) break
    const content = [...out.map((o) => openingSpan(o)), ...mouthsWork].sort(
      (a, b) => a.start - b.start,
    )
    const merged: CmSpan[] = []
    for (const b of content) {
      const last = merged[merged.length - 1]
      if (last && b.start <= last.end + EPS) last.end = Math.max(last.end, b.end)
      else merged.push({ ...b })
    }

    const leftLimit = HAUSWAND_END_MARGIN_MIN_CM
    const rightLimit = widthCm - HAUSWAND_END_MARGIN_MIN_CM
    let cursor = leftLimit
    let did = false

    for (const block of [...merged, { start: rightLimit, end: rightLimit }]) {
      const gapStart = cursor
      const gapEnd = Math.min(block.start, rightLimit)
      const empty = gapEnd - gapStart
      if (empty > HAUSWAND_END_MARGIN_MAX_CM + EPS) {
        const atLeft = Math.abs(gapStart - leftLimit) < EPS
        const atRight = Math.abs(gapEnd - rightLimit) < EPS
        const leftIsBay = mouthsWork.some((m) => Math.abs(m.end - gapStart) < EPS)
        const rightIsBay = mouthsWork.some((m) => Math.abs(m.start - gapEnd) < EPS)
        const leftIsDoor = out.some(
          (o) => o.type === 'door' && Math.abs(o.x + o.width - gapStart) < EPS,
        )
        const rightIsDoor = out.some(
          (o) => o.type === 'door' && Math.abs(o.x - gapEnd) < EPS,
        )
        const leftNeed = atLeft
          ? 0
          : leftIsBay || leftIsDoor
            ? HAUSWAND_WINDOW_BAY_GAP_CM
            : HAUSWAND_WINDOW_GAP_CM
        const rightNeed = atRight
          ? 0
          : rightIsBay || rightIsDoor
            ? HAUSWAND_WINDOW_BAY_GAP_CM
            : HAUSWAND_WINDOW_GAP_CM
        const fillW = Math.max(winW, HAUSWAND_WINDOW_WIDTH_CM)
        const need = fillW + leftNeed + rightNeed
        if (empty < need - EPS) {
          const grow = need - empty
          if (grow > EPS && grow <= winW + HAUSWAND_WINDOW_GAP_CM + EPS) {
            out = out.map((o) => (o.x + EPS >= gapEnd ? { ...o, x: o.x + grow } : o))
            mouthsWork = mouthsWork.map((m) => {
              if (m.start + EPS >= gapEnd) return { start: m.start + grow, end: m.end + grow }
              if (m.end > gapEnd + EPS) return { start: m.start, end: m.end + grow }
              return m
            })
            widthCm += grow
            did = true
            break
          }
          cursor = Math.max(cursor, block.end)
          continue
        }
        const x = gapStart + leftNeed
        const span = { start: x, end: x + fillW }
        const hitsMouth = mouthsWork.some((m) => spansOverlap(span, m))
        const hitsOpen = out.some((o) => {
          const g = o.x <= x ? x - (o.x + o.width) : o.x - (x + fillW)
          const needG =
            o.type === 'door' || o.role === 'shop'
              ? HAUSWAND_WINDOW_BAY_GAP_CM
              : HAUSWAND_WINDOW_GAP_CM
          return g < needG - EPS
        })
        if (!hitsMouth && !hitsOpen) {
          out.push(standardWindowAtX(x, fillW))
          did = true
          break
        }
      }
      cursor = Math.max(cursor, block.end)
    }

    if (!did) {
      const sorted = dedupeWindowsByX(out)
      const kept: HauswandOpeningSpec[] = []
      for (const w of sorted) {
        const bad = kept.some((prev) => {
          if (spansOverlap(openingSpan(prev), openingSpan(w))) return true
          const g = clearGapBetween(prev, w)
          if (g + EPS >= HAUSWAND_WINDOW_GAP_CM) return false
          const aInMouth = mouthsWork.some((m) => spansOverlap(openingSpan(prev), m))
          const bInMouth = mouthsWork.some((m) => spansOverlap(openingSpan(w), m))
          if ((aInMouth || bInMouth) && g + EPS >= HAUSWAND_WINDOW_BAY_GAP_CM) return false
          return g >= -EPS
        })
        if (!bad) kept.push(w)
      }
      if (kept.length !== sorted.length) {
        out = kept
        did = true
      }
    }
    if (!did) break
    out = dedupeWindowsByX(out)
  }

  return { openings: dedupeWindowsByX(out), widthCm, mouths: mouthsWork }
}

/** Entfernt OG-Fenster mit Lücke &lt; 96 zu Nachbarn (Ausnahme: Spalte im Erker-Mund). */
export function sanitizeOgWindowGaps(
  windows: HauswandOpeningSpec[],
  mouths: CmSpan[],
): HauswandOpeningSpec[] {
  const sorted = dedupeWindowsByX(windows)
  const kept: HauswandOpeningSpec[] = []
  for (const w of sorted) {
    const wInMouth = mouths.some((m) => spansOverlap(openingSpan(w), m))
    const bad = kept.some((prev) => {
      if (!openingsShareVerticalBand(prev, w)) return false
      if (spansOverlap(openingSpan(prev), openingSpan(w))) return true
      const g = clearGapBetween(prev, w)
      if (g + EPS >= HAUSWAND_WINDOW_GAP_CM) return false
      const prevInMouth = mouths.some((m) => spansOverlap(openingSpan(prev), m))
      // 48 cm nur wenn eines im Mund (Spaltenfenster) sitzt
      if ((wInMouth || prevInMouth) && g + EPS >= HAUSWAND_WINDOW_BAY_GAP_CM) return false
      // 48er in 45°-Spalte dürfen 64 cm zum mittleren 96er haben
      if (
        (wInMouth || prevInMouth) &&
        (w.width === HAUSWAND_NARROW_WINDOW_WIDTH_CM ||
          prev.width === HAUSWAND_NARROW_WINDOW_WIDTH_CM) &&
        g + EPS >= HAUSWAND_ANGLED45_SIDE_GAP_CM
      ) {
        return false
      }
      return true
    })
    if (!bad) kept.push(w)
  }
  return kept
}

/** Abschluss: OG säubern, Lücken füllen, EG fluchten, Eingang sichern. */
function polishHauswandPlan(plan: HauswandPlan, winW: number): HauswandPlan {
  let next = plan
  const clampOpenings = (ops: HauswandOpeningSpec[], widthCm: number) =>
    ops.filter((o) => o.x >= -EPS && o.x + o.width <= widthCm + EPS)

  // 1) Eingang + Shop-Türen + Erker↔Tür
  let doors = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
  doors = ensureEntranceDoor(doors, next.widthCm).filter((o) => o.type === 'door')
  let mouths = bayMouthSpansForPlan(next)
  let shops = shopsUnderBays(planBays(next), doors)
  doors = ensureShopAdjacentDoors([...doors, ...shops], next.widthCm, mouths).filter(
    (o) => o.type === 'door',
  )
  {
    const bays = resolveBaysVersusDoors(
      { ...next, bays: planBays(next), bay: planBays(next)[0] ?? null },
      doors,
      winW,
    )
    next = { ...next, bays, bay: bays[0] ?? null }
  }
  mouths = bayMouthSpansForPlan(next)
  shops = shopsUnderBays(planBays(next), doors)

  // 2) OG: über Türen, Erker-Nachbarn, Spalte
  let og = clampOpenings(next.ogWindowByAxis, next.widthCm).filter(
    (w) => !mouths.some((m) => spansOverlap(openingSpan(w), m)),
  )
  og = alignOgWindowsAboveEgDoors(og, doors, winW)
  og = ensureBaySideNeighbors48(og, mouths, next.widthCm, winW)
  for (const bay of planBays(next)) {
    for (const w of bayColumnFacadeWindows(bay, { useFullMouthWidth: false })) {
      if (w.width < HAUSWAND_WINDOW_WIDTH_CM - EPS && bay.shape !== 'angled45') continue
      if (!og.some((o) => Math.abs(o.x - w.x) < EPS && Math.abs(o.width - w.width) < EPS)) {
        og.push(w)
      }
    }
  }
  {
    const firstX = HAUSWAND_END_MARGIN_MIN_CM
    const lastX = next.widthCm - HAUSWAND_END_MARGIN_MIN_CM - winW
    const endBlocked = (x: number) =>
      mouths.some((m) =>
        spansOverlap(
          { start: x, end: x + winW },
          { start: m.start - HAUSWAND_WINDOW_BAY_GAP_CM, end: m.end + HAUSWAND_WINDOW_BAY_GAP_CM },
        ),
      )
    if (!endBlocked(firstX) && !og.some((w) => Math.abs(w.x - firstX) < 1)) {
      og.unshift(standardWindowAtX(firstX, winW))
    }
    if (!endBlocked(lastX) && !og.some((w) => Math.abs(w.x - lastX) < 1)) {
      og.push(standardWindowAtX(lastX, winW))
    }
  }
  og = sanitizeOgWindowGaps(dedupeWindowsByX(og), mouths)

  // 3) Fill — Ergebnis übernehmen (fill selbst deckelt Wachstum)
  const widthCap = Math.max(next.widthCm * 2, hauswandWidthCm(plan.axes, winW) * 2)
  {
    const filled = fillEmptySpansWithWindows(
      next.widthCm,
      [...doors, ...shops, ...og],
      mouths,
      winW,
    )
    doors = filled.openings.filter((o) => o.type === 'door')
    const bays = syncBaysToMouths(planBays(next), filled.mouths)
    shops = shopsUnderBays(bays, doors)
    mouths = filled.mouths
    og = sanitizeOgWindowGaps(
      filled.openings.filter((o) => o.type === 'window' && o.role !== 'shop'),
      mouths,
    )
    next = {
      ...next,
      widthCm: Math.round(Math.min(filled.widthCm, widthCap) / 8) * 8,
      bays,
      bay: bays[0] ?? null,
    }
  }

  // 4) Nach Fill: Türen/Nachbarn/Spalte nochmals (ohne weiteres Expand-Fill)
  og = alignOgWindowsAboveEgDoors(
    og.filter((w) => !mouths.some((m) => spansOverlap(openingSpan(w), m))),
    doors,
    winW,
  )
  og = ensureBaySideNeighbors48(og, mouths, next.widthCm, winW)
  for (const bay of planBays(next)) {
    for (const w of bayColumnFacadeWindows(bay, { useFullMouthWidth: false })) {
      if (w.width < HAUSWAND_WINDOW_WIDTH_CM - EPS && bay.shape !== 'angled45') continue
      if (!og.some((o) => Math.abs(o.x - w.x) < EPS && Math.abs(o.width - w.width) < EPS)) {
        og.push(w)
      }
    }
  }
  // Tür-Fenster haben Vorrang vor Konfliktfenstern
  {
    const overDoors = new Set(
      doors
        .filter((d) => d.width !== HAUSWAND_GATE_WIDTH_CM)
        .map((d) => Math.round(windowXCenteredOnHost(d, winW) * 10)),
    )
    og = dedupeWindowsByX(og).filter((w, _i, arr) => {
      if (overDoors.has(Math.round(w.x * 10))) return true
      return !arr.some((o) => {
        if (o === w || !overDoors.has(Math.round(o.x * 10))) return false
        if (spansOverlap(openingSpan(o), openingSpan(w))) return true
        return clearGapBetween(o, w) + EPS < HAUSWAND_WINDOW_GAP_CM
      })
    })
  }
  og = sanitizeOgWindowGaps(dedupeWindowsByX(og), mouths)
  og = clampOpenings(og, next.widthCm)
  doors = clampOpenings(doors, next.widthCm).filter((o) => o.type === 'door')
  doors = ensureEntranceDoor(doors, next.widthCm).filter((o) => o.type === 'door')
  shops = shopsUnderBays(planBays(next), doors)

  // 5) Symmetrie nur wenn Ränder klar aus dem Rahmen laufen
  next = {
    ...next,
    ogWindowByAxis: og,
    egGroups: sanitizeEgGroups([
      { axisStart: 0, axisCount: plan.axes, openings: [...doors, ...shops] },
    ]),
  }
  {
    const before = next.widthCm
    const sym = ensureSymmetricEndMargins(next)
    if (Math.abs(sym.widthCm - before) < before * 0.5 + EPS) {
      const ops = [
        ...collectEgOpenings(sym.egGroups),
        ...sym.ogWindowByAxis,
      ]
      if (ops.every((o) => o.x >= -EPS && o.x + o.width <= sym.widthCm + EPS)) {
        next = sym
      }
    }
  }

  doors = collectEgOpenings(next.egGroups).filter((o) => o.type === 'door')
  doors = ensureEntranceDoor(doors, next.widthCm).filter((o) => o.type === 'door')
  mouths = bayMouthSpansForPlan(next)
  shops = shopsUnderBays(planBays(next), doors)
  // OG über Türen + Erker-Nachbarn erzwingen (kein Sanitize danach, das sie wieder löscht)
  {
    let ogForce = next.ogWindowByAxis.filter(
      (w) => !mouths.some((m) => spansOverlap(openingSpan(w), m)),
    )
    for (const door of doors) {
      if (door.width === HAUSWAND_GATE_WIDTH_CM) continue
      const x = windowXCenteredOnHost(door, winW)
      const w = standardWindowAtX(x, winW)
      ogForce = ogForce.filter((o) => {
        if (Math.abs(o.x - w.x) < EPS) return false
        if (spansOverlap(openingSpan(o), openingSpan(w))) return false
        const g = clearGapBetween(o, w)
        return g + EPS >= HAUSWAND_WINDOW_GAP_CM || g < -EPS
      })
      ogForce.push(w)
    }
    ogForce = ensureBaySideNeighbors48(ogForce, mouths, next.widthCm, winW)
    for (const bay of planBays(next)) {
      for (const col of bayColumnFacadeWindows(bay, { useFullMouthWidth: false })) {
        if (col.width < HAUSWAND_WINDOW_WIDTH_CM - EPS && bay.shape !== 'angled45') continue
        if (
          !ogForce.some(
            (o) => Math.abs(o.x - col.x) < EPS && Math.abs(o.width - col.width) < EPS,
          )
        ) {
          ogForce.push(col)
        }
      }
    }
    next = { ...next, ogWindowByAxis: dedupeWindowsByX(ogForce) }
    // Überlappungen: Tür-Fenster behalten
    {
      const overDoors = new Set(
        doors
          .filter((d) => d.width !== HAUSWAND_GATE_WIDTH_CM)
          .map((d) => Math.round(windowXCenteredOnHost(d, winW) * 10)),
      )
      const sorted = dedupeWindowsByX(next.ogWindowByAxis)
      const kept: HauswandOpeningSpec[] = []
      for (const w of sorted) {
        const isDoorWin = overDoors.has(Math.round(w.x * 10))
        const bad = kept.some((prev) => {
          if (spansOverlap(openingSpan(prev), openingSpan(w))) return true
          const g = clearGapBetween(prev, w)
          if (g + EPS >= HAUSWAND_WINDOW_GAP_CM) return false
          const aM = mouths.some((m) => spansOverlap(openingSpan(prev), m))
          const bM = mouths.some((m) => spansOverlap(openingSpan(w), m))
          if ((aM || bM) && g + EPS >= HAUSWAND_WINDOW_BAY_GAP_CM) return false
          return g >= -EPS
        })
        if (!bad) {
          kept.push(w)
          continue
        }
        if (isDoorWin) {
          // Konfliktfenster davor entfernen
          while (kept.length) {
            const prev = kept[kept.length - 1]!
            if (overDoors.has(Math.round(prev.x * 10))) break
            const g = clearGapBetween(prev, w)
            if (
              !spansOverlap(openingSpan(prev), openingSpan(w)) &&
              g + EPS >= HAUSWAND_WINDOW_GAP_CM
            ) {
              break
            }
            kept.pop()
          }
          const stillBad = kept.some(
            (prev) =>
              spansOverlap(openingSpan(prev), openingSpan(w)) ||
              clearGapBetween(prev, w) + EPS < HAUSWAND_WINDOW_GAP_CM,
          )
          if (!stillBad) kept.push(w)
        }
      }
      next = { ...next, ogWindowByAxis: kept }
    }
  }
  const eg = enforceEgOpeningGaps96(
    [
      ...doors,
      ...shops,
      ...alignEgWindowsToOg(next.ogWindowByAxis, [...doors, ...shops], mouths, winW),
    ],
    next.widthCm,
  )
  // EG nur Positionen die im OG existieren
  const egSynced = eg.filter((o) => {
    if (o.type === 'door' || o.role === 'shop') return true
    return next.ogWindowByAxis.some(
      (w) => Math.abs(w.x - o.x) < 1 && Math.abs(w.width - o.width) < 1,
    )
  })
  return {
    ...next,
    widthCm: Math.round(next.widthCm / 8) * 8,
    egGroups: sanitizeEgGroups([
      {
        axisStart: 0,
        axisCount: plan.axes,
        openings: ensureEntranceDoor(egSynced, next.widthCm).filter(
          (o) => o.role !== 'basement',
        ),
      },
    ]),
  }
}

export function applyOgTreatmentForGate288(
  plan: HauswandPlan,
  mode: 'windows' | 'bay',
): HauswandPlan {
  const gate = findEgGate288(plan.egGroups)
  if (!gate) return plan
  const gateSpan = openingSpan(gate)
  const egOpenings = collectEgOpenings(plan.egGroups)
  const winW = plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM

  if (mode === 'bay' && planBays(plan).length) {
    let og = plan.ogWindowByAxis.filter((w) => !spansOverlap(openingSpan(w), gateSpan))
    og = alignOgWindowsAboveEgDoors(og, egOpenings.filter((o) => o !== gate), winW)
    return { ...plan, ogWindowByAxis: og }
  }

  let og = plan.ogWindowByAxis.filter((w) => !spansOverlap(openingSpan(w), gateSpan))
  for (const w of ogWindowsAboveGate288(gate)) {
    if (!og.some((o) => Math.abs(o.x - w.x) < EPS)) og.push(w)
  }
  const otherEg = egOpenings.filter((o) => !(o.type === 'door' && o.width === HAUSWAND_GATE_WIDTH_CM))
  og = alignOgWindowsAboveEgDoors(og, otherEg, winW)
  return { ...plan, bay: null, bays: [], ogWindowByAxis: dedupeWindowsByX(og) }
}

export function baysOverlapOrMixed(bays: HauswandBayPlan[]): boolean {
  if (bays.length <= 1) return false
  const first = bays[0]!
  for (const b of bays) {
    if (b.shape !== first.shape || b.presetId !== first.presetId || b.axisSpan !== first.axisSpan) return true
  }
  const mouths = bays.map((b) => bayMouthSpan(b)).sort((a, c) => a.start - c.start)
  for (let i = 0; i < mouths.length - 1; i += 1) {
    const a = mouths[i]!
    const c = mouths[i + 1]!
    if (spansOverlap(a, c)) return true
    if (c.start - a.end < HAUSWAND_OPENING_MIN_GAP_CM - EPS) return true
  }
  return false
}
