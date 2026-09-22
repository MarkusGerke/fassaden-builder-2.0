import { createGalleryRng } from '../gallery/galleryRandom'
import { BAY_WINDOW_PRESETS, bayMouthWidthCm, type BayWindowPreset } from '../studio/bayWindow'
import { HAUSWAND_REGELWERK } from './constants'
import {
  alignOgWindowsAboveEgDoors,
  applyOgTreatmentForGate288,
  bayMouthSpan,
  buildAlignedOgWindows,
  buildAlignedWindowSpecs,
  collectEgOpenings,
  finalizeHauswandPlanLayout,
  findEgGate288,
  findOg96WindowPair,
  HAUSWAND_END_MARGIN_MIN_CM,
  HAUSWAND_FACADE_WINDOW_WIDTHS_CM,
  HAUSWAND_MAX_WINDOWS_IN_A_ROW,
  HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
  HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
  HAUSWAND_WINDOW_GAP_CM,
  layoutHauswandWindowXs,
  openingPlacementBlockSpan,
  openingSpan,
  planBays,
  sanitizeOgWindowGaps,
  spansOverlap,
  standardWindowAtX,
  withOptionalBasementWindows,
  type CmSpan,
} from './hauswandFacadeLayout'
import {
  hauswandAxisGroupWidthCm,
  hauswandAxisOpeningXCm,
  hauswandWidthCm,
  HAUSWAND_DOOR_HEIGHT_CM,
  HAUSWAND_END_MARGIN_CM,
  HAUSWAND_ENTRANCE_DOOR_WIDTH_CM,
  HAUSWAND_GATE_WIDTH_CM,
  HAUSWAND_NARROW_DOOR_WIDTH_CM,
  HAUSWAND_WINDOW_WIDTH_CM,
} from './hauswandGrid'
import type {
  HauswandBayPlan,
  HauswandEgGroup,
  HauswandEgType,
  HauswandOpeningSpec,
  HauswandPlan,
  HauswandRegelwerk,
} from './hauswandTypes'

const EPS = 0.5

export function parseHauswandSeed(input: string | number): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0
  const s = String(input).trim()
  if (/^\d+$/.test(s)) return Number(s) >>> 0
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Neuer 32-bit-Seed für UI-Zufall (wie Galerie `newGalleryRandomSeed`). */
export function randomHauswandSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0
}

function pickWeighted(rng: () => number, weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return entries[0]?.[0] ?? ''
  let r = rng() * total
  for (const [key, w] of entries) {
    r -= w
    if (r <= 0) return key
  }
  return entries[entries.length - 1]![0]
}

function pickIntWeighted(rng: () => number, weights: Record<string, number>): number {
  return Number.parseInt(pickWeighted(rng, weights), 10)
}

function blockedSpansFromEgGroups(groups: HauswandEgGroup[]): CmSpan[] {
  return groups.flatMap((g) => g.openings.map((o) => openingPlacementBlockSpan(o)))
}

function appendAlignedEgWindows(
  groups: HauswandEgGroup[],
  wallWidthCm: number,
  axes: number,
  bay: HauswandBayPlan | HauswandBayPlan[] | null,
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandEgGroup[] {
  const windows = buildAlignedWindowSpecs(wallWidthCm, bay, blockedSpansFromEgGroups(groups), winW)
  if (!windows.length) return groups
  return [...groups, { axisStart: 0, axisCount: axes, openings: windows }]
}

function entranceDoorAtAxis(axisIndex: number, winW: number = HAUSWAND_WINDOW_WIDTH_CM): HauswandOpeningSpec {
  const slotX = hauswandAxisOpeningXCm(axisIndex, winW)
  return {
    x: slotX,
    width: HAUSWAND_ENTRANCE_DOOR_WIDTH_CM,
    height: HAUSWAND_DOOR_HEIGHT_CM,
    y: 0,
    type: 'door',
  }
}

function gateAtAxisStart(axisStart: number, winW: number = HAUSWAND_WINDOW_WIDTH_CM): HauswandOpeningSpec {
  return {
    x: hauswandAxisOpeningXCm(axisStart, winW),
    width: HAUSWAND_GATE_WIDTH_CM,
    height: HAUSWAND_DOOR_HEIGHT_CM,
    y: 0,
    type: 'door',
  }
}

function entranceDoorGroup(axisStart: number, winW: number = HAUSWAND_WINDOW_WIDTH_CM): HauswandEgGroup {
  return {
    axisStart,
    axisCount: 1,
    openings: [entranceDoorAtAxis(axisStart, winW)],
  }
}

function gateGroup(axisStart: number, winW: number = HAUSWAND_WINDOW_WIDTH_CM): HauswandEgGroup {
  return {
    axisStart,
    axisCount: 2,
    openings: [gateAtAxisStart(axisStart, winW)],
  }
}

function buildEgFromOgWindowPair(
  pair: { firstX: number; secondX: number },
  rng: () => number,
): HauswandEgGroup[] {
  if (rng() < 0.5) {
    return [
      {
        axisStart: 0,
        axisCount: 2,
        openings: [
          {
            x: pair.firstX,
            width: HAUSWAND_GATE_WIDTH_CM,
            height: HAUSWAND_DOOR_HEIGHT_CM,
            y: 0,
            type: 'door',
          },
        ],
      },
    ]
  }
  return [
    {
      axisStart: 0,
      axisCount: 2,
      openings: [
        {
          x: pair.firstX,
          width: HAUSWAND_NARROW_DOOR_WIDTH_CM,
          height: HAUSWAND_DOOR_HEIGHT_CM,
          y: 0,
          type: 'door',
        },
        standardWindowAtX(pair.secondX),
      ],
    },
  ]
}

function pickUnusedAxisSpan(axes: number, used: boolean[], span: number): number | null {
  if (span < 1 || span > axes) return null
  for (let start = 0; start <= axes - span; start += 1) {
    let ok = true
    for (let a = start; a < start + span; a += 1) {
      if (used[a]) ok = false
    }
    if (ok) return start
  }
  return null
}

function buildEgGroups(
  egType: HauswandEgType,
  axes: number,
  wallWidthCm: number,
  bay: HauswandBayPlan | HauswandBayPlan[] | null,
  rng: () => number,
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandEgGroup[] {
  const used = Array.from({ length: axes }, () => false)

  if (egType === 'residentialWindows') {
    const doorAxis = Math.floor(rng() * axes)
    used[doorAxis] = true
    return appendAlignedEgWindows([entranceDoorGroup(doorAxis, winW)], wallWidthCm, axes, bay, winW)
  }

  if (egType === 'entrance') {
    const doorAxis = Math.floor(rng() * axes)
    used[doorAxis] = true
    return appendAlignedEgWindows([entranceDoorGroup(doorAxis, winW)], wallWidthCm, axes, bay, winW)
  }

  if (egType === 'driveway') {
    const gateSpan = 2
    const maxStart = Math.max(0, axes - gateSpan)
    const start = Math.floor(rng() * (maxStart + 1))
    for (let i = start; i < start + gateSpan; i += 1) used[i] = true
    return appendAlignedEgWindows([gateGroup(start, winW)], wallWidthCm, axes, bay, winW)
  }

  if (egType === 'shopWindow') {
    const doorAxis = Math.floor(rng() * axes)
    used[doorAxis] = true
    const span = Math.min(2, Math.max(1, axes - 1))
    const shopStart = pickUnusedAxisSpan(axes, used, span)
    const groups: HauswandEgGroup[] = [entranceDoorGroup(doorAxis, winW)]
    if (shopStart !== null) {
      for (let i = shopStart; i < shopStart + span; i += 1) used[i] = true
      const w = hauswandAxisGroupWidthCm(span, winW)
      groups.push({
        axisStart: shopStart,
        axisCount: span,
        openings: [
          {
            x: hauswandAxisOpeningXCm(shopStart, winW),
            width: w,
            height: HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
            y: HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
            type: 'window',
            role: 'shop',
          },
        ],
      })
    }
    return appendAlignedEgWindows(groups, wallWidthCm, axes, bay, winW)
  }

  // shopfrontGroup — Tür + Schaufenster (Stub ohne Säulen)
  const doorSpan = 1
  const shopSpan = Math.min(2, axes - doorSpan)
  let doorStart = Math.floor(rng() * Math.max(1, axes - doorSpan - shopSpan + 1))
  if (doorStart + doorSpan + shopSpan > axes) doorStart = 0
  const shopStart = doorStart + doorSpan
  for (let i = doorStart; i < doorStart + doorSpan; i += 1) used[i] = true
  for (let i = shopStart; i < shopStart + shopSpan; i += 1) used[i] = true
  const shopWidth = hauswandAxisGroupWidthCm(shopSpan, winW)
  return appendAlignedEgWindows(
    [
      entranceDoorGroup(doorStart, winW),
      {
        axisStart: shopStart,
        axisCount: shopSpan,
        openings: [
          {
            x: hauswandAxisOpeningXCm(shopStart, winW),
            width: shopWidth,
            height: HAUSWAND_SHOP_WINDOW_HEIGHT_CM,
            y: HAUSWAND_SHOP_WINDOW_SILL_Y_CM,
            type: 'window',
            role: 'shop',
          },
        ],
      },
    ],
    wallWidthCm,
    axes,
    bay,
    winW,
  )
}

function bayPresetFor(
  shape: HauswandBayPlan['shape'],
  frontWidthCm: number,
): BayWindowPreset {
  const depthCm = 96
  const fw = frontWidthCm >= 384 ? 384 : 288
  const shapeKey = shape === 'angled45' ? '45' : 'rect'
  const id = `bay-f${fw}-d${depthCm}-${shapeKey}`
  const match = BAY_WINDOW_PRESETS.find((p) => p.id === id)
  if (match) return match
  return {
    id,
    label: `Erker ${fw}/${depthCm}`,
    frontWidthCm: fw,
    depthCm,
    shape: shape === 'angled45' ? 'angled45' : 'rect',
    kind: 'bay',
  }
}

function pickBayFrontWidthCm(
  rng: () => number,
  rules: HauswandRegelwerk,
): 288 | 384 {
  const weights =
    (rules.weights as { bayFrontWidthCm?: Record<string, number> }).bayFrontWidthCm ?? {
      '288': 0.55,
      '384': 0.45,
    }
  const picked = Number.parseInt(pickWeighted(rng, weights), 10)
  return picked >= 384 ? 384 : 288
}

function pickBayPlacement(
  rng: () => number,
  axes: number,
  span: number,
  weights: HauswandRegelwerk['weights']['bayHorizontalPlacement'],
): number {
  const mode = pickWeighted(rng, weights)
  const maxStart = Math.max(0, axes - span)
  if (mode === 'leftThird') return Math.min(maxStart, Math.floor(axes / 3))
  if (mode === 'rightThird') return Math.max(0, maxStart - Math.floor(axes / 3))
  return Math.floor((axes - span) / 2)
}

function bayFromCenter(
  shape: Exclude<HauswandBayPlan['shape'], 'round'>,
  frontWidthCm: 288 | 384,
  axes: number,
  wallWidthCm: number,
  centerLocalXCm: number,
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
): HauswandBayPlan {
  const preset = bayPresetFor(shape, frontWidthCm)
  const mouth = bayMouthWidthCm(preset)
  const half = mouth / 2
  const pitch = winW + HAUSWAND_WINDOW_GAP_CM
  let snappedStart = Math.round((centerLocalXCm - half) / pitch) * pitch
  if (snappedStart < HAUSWAND_END_MARGIN_CM) snappedStart = HAUSWAND_END_MARGIN_CM
  if (snappedStart + mouth > wallWidthCm - HAUSWAND_END_MARGIN_CM) {
    snappedStart = Math.max(HAUSWAND_END_MARGIN_CM, wallWidthCm - HAUSWAND_END_MARGIN_CM - mouth)
  }
  const clampedCenter = Math.max(half, Math.min(wallWidthCm - half, snappedStart + half))
  const span = frontWidthCm >= 384 ? 2 : 1
  const groupWidth = hauswandAxisGroupWidthCm(span, winW)
  let axisStart = 0
  for (let a = 0; a <= Math.max(0, axes - span); a += 1) {
    const groupCenter = hauswandAxisOpeningXCm(a, winW) + groupWidth / 2
    if (Math.abs(groupCenter - clampedCenter) < groupWidth / 2 + EPS) {
      axisStart = a
      break
    }
  }
  return {
    shape,
    axisStart,
    axisSpan: span,
    centerLocalXCm: clampedCenter,
    presetId: preset.id,
  }
}

function mouthsLeaveGap(a: HauswandBayPlan, b: HauswandBayPlan): boolean {
  const ma = bayMouthSpan(a)
  const mb = bayMouthSpan(b)
  if (spansOverlap(ma, mb)) return false
  const gap = ma.start < mb.start ? mb.start - ma.end : ma.start - mb.end
  return gap >= 48 - EPS
}

function buildBays(
  storeys: number,
  axes: number,
  wallWidthCm: number,
  rng: () => number,
  rules: HauswandRegelwerk,
  winW: number = HAUSWAND_WINDOW_WIDTH_CM,
  force = false,
): HauswandBayPlan[] {
  const gate = rules.weights.bayPresence.gate
  if (storeys < gate.minStoreys || axes < gate.minAxes) return []
  if (
    !force &&
    pickWeighted(rng, { none: rules.weights.bayPresence.none, present: rules.weights.bayPresence.present }) !==
      'present'
  ) {
    return []
  }
  // Erker nur 288 oder 384 (kein 192)
  const frontWidthCm = pickBayFrontWidthCm(rng, rules)
  const span = frontWidthCm >= 384 ? 2 : 1
  const shapeWeights = Object.fromEntries(
    Object.entries(rules.weights.bayShapeWhenPresent).filter(([key]) => key !== 'round'),
  )
  const shape = pickWeighted(rng, shapeWeights) as Exclude<HauswandBayPlan['shape'], 'round'>
  // Pro Fassade höchstens ein Erker (288/384-Münder überlappen sonst leicht)
  const count = 1
  const firstStart = pickBayPlacement(rng, axes, span, rules.weights.bayHorizontalPlacement)
  const groupWidth = hauswandAxisGroupWidthCm(span, winW)
  const first = bayFromCenter(
    shape,
    frontWidthCm,
    axes,
    wallWidthCm,
    hauswandAxisOpeningXCm(firstStart, winW) + groupWidth / 2,
    winW,
  )
  return [first]
}

/** Mehr als 4 Fenster ohne Erker-Unterbrechung → Erker in die Mitte der Serie (ggf. mehrere). */
function ensureBayBreaksLongWindowRuns(
  storeys: number,
  axes: number,
  wallWidthCm: number,
  bays: HauswandBayPlan[],
  ogWindows: HauswandOpeningSpec[],
  rng: () => number,
  rules: HauswandRegelwerk,
  winW: number,
): HauswandBayPlan[] {
  const gate = rules.weights.bayPresence.gate
  if (storeys < gate.minStoreys || axes < gate.minAxes) return bays
  void rng

  let result = [...bays]
  const shape = (result[0]?.shape ?? 'rect') as Exclude<HauswandBayPlan['shape'], 'round'>
  const frontWidthCm: 288 | 384 = result[0]?.presetId.includes('-f384-') ? 384 : 288

  for (let guard = 0; guard < 4; guard += 1) {
    const mouths = result.map((b) => bayMouthSpan(b))
    const wins = (
      ogWindows.length
        ? ogWindows
        : layoutHauswandWindowXs(wallWidthCm, mouths, winW).map((x) => standardWindowAtX(x, winW))
    )
      .filter((o) => o.type === 'window' && o.width === winW)
      .filter((o) => !mouths.some((m) => spansOverlap({ start: o.x, end: o.x + o.width }, m)))
      .sort((a, b) => a.x - b.x)

    let runStart = 0
    let best = { start: 0, len: 1 }
    for (let i = 1; i < wins.length; i += 1) {
      const gap = wins[i]!.x - (wins[i - 1]!.x + wins[i - 1]!.width)
      const mid = (wins[i - 1]!.x + wins[i - 1]!.width + wins[i]!.x) / 2
      const throughBay = mouths.some((m) => mid >= m.start - 1 && mid <= m.end + 1)
      if (throughBay) {
        runStart = i
        continue
      }
      if (Math.abs(gap - HAUSWAND_WINDOW_GAP_CM) < EPS) {
        const len = i - runStart + 1
        if (len > best.len) best = { start: runStart, len }
      } else {
        runStart = i
      }
    }
    if (best.len <= HAUSWAND_MAX_WINDOWS_IN_A_ROW) break

    const mid = wins[best.start + Math.floor(best.len / 2)]!
    const center = mid.x + mid.width / 2
    const next = bayFromCenter(shape, frontWidthCm, axes, wallWidthCm, center, winW)
    // Ein Erker: bestehende Position auf Serienmitte setzen statt zweiten zu stapeln
    result = [next]
    break
  }
  return result
}

const EG_LABEL: Record<HauswandEgType, string> = {
  entrance: 'Eingang',
  driveway: 'Einfahrt',
  shopWindow: 'Schaufenster',
  shopfrontGroup: 'Ladengruppe',
  residentialWindows: 'Wohnfenster',
}

const BAY_LABEL: Record<HauswandBayPlan['shape'], string> = {
  rect: 'rechteckig',
  angled45: '45°',
  round: 'rund',
}

export function formatHauswandSnapshotDe(plan: Pick<
  HauswandPlan,
  'storeys' | 'axes' | 'widthCm' | 'egType' | 'bay' | 'bays' | 'seed' | 'windowWidthCm'
>): string {
  const parts = [
    `${plan.storeys} Geschoss${plan.storeys === 1 ? '' : 'e'}`,
    `${plan.axes} Achsen`,
    `${plan.widthCm} cm`,
    `Fenster ${plan.windowWidthCm ?? 96}×192`,
    `EG ${EG_LABEL[plan.egType]}`,
  ]
  const bays = plan.bays?.length ? plan.bays : plan.bay ? [plan.bay] : []
  if (bays.length) {
    const first = bays[0]!
    const front = first.presetId.match(/-f(\d+)-/)?.[1] ?? (first.axisSpan > 1 ? '384' : '288')
    parts.push(
      `${bays.length}× Erker ${BAY_LABEL[first.shape]} ${front}`,
    )
  } else {
    parts.push('ohne Erker')
  }
  parts.push(`Seed ${plan.seed}`)
  return parts.join(' · ')
}

export function generateHauswand(
  seedInput: string | number,
  rules: HauswandRegelwerk = HAUSWAND_REGELWERK,
): HauswandPlan {
  const seed = parseHauswandSeed(seedInput)
  const rng = createGalleryRng(seed)
  const storeys = pickIntWeighted(rng, rules.weights.storeys)
  const axes = pickIntWeighted(rng, rules.weights.axes)
  const egType = pickWeighted(rng, rules.weights.egType) as HauswandEgType
  // Fassadenbreite: kein 48er (nur 96 / gelegentlich 144). 48er nur auf 45°-Erker-Front.
  const windowWidthCm = Number.parseInt(
    pickWeighted(rng, { '96': 0.92, '144': 0.08 }),
    10,
  ) as (typeof HAUSWAND_FACADE_WINDOW_WIDTHS_CM)[number]
  const widthCm = hauswandWidthCm(axes, windowWidthCm)
  let bays = buildBays(storeys, axes, widthCm, rng, rules, windowWidthCm)
  let ogWindowByAxis = buildAlignedOgWindows({ widthCm, bay: bays[0] ?? null, bays, windowWidthCm })
  bays = ensureBayBreaksLongWindowRuns(
    storeys,
    axes,
    widthCm,
    bays,
    ogWindowByAxis,
    rng,
    rules,
    windowWidthCm,
  )
  if (bays.length) {
    ogWindowByAxis = buildAlignedOgWindows({ widthCm, bay: bays[0] ?? null, bays, windowWidthCm })
  }
  const ogPair = windowWidthCm === HAUSWAND_WINDOW_WIDTH_CM && storeys >= 2
    ? findOg96WindowPair(ogWindowByAxis)
    : null

  let egGroups: HauswandEgGroup[]
  if (ogPair) {
    egGroups = buildEgFromOgWindowPair(ogPair, rng)
    egGroups = appendAlignedEgWindows(egGroups, widthCm, axes, bays, windowWidthCm)
  } else {
    egGroups = buildEgGroups(egType, axes, widthCm, bays, rng, windowWidthCm)
  }

  const gate288 = findEgGate288(egGroups)
  if (gate288) {
    const canBay = storeys >= rules.weights.bayPresence.gate.minStoreys && axes >= rules.weights.bayPresence.gate.minAxes
    const useBay = canBay && (bays.length > 0 || axes > HAUSWAND_MAX_WINDOWS_IN_A_ROW || rng() < 0.35)
    if (useBay && canBay) {
      const shape = bays[0]?.shape ?? (pickWeighted(rng, { rect: 0.55, angled45: 0.45 }) as 'rect' | 'angled45')
      const frontWidthCm: 288 | 384 = bays[0]?.presetId.includes('-f384-')
        ? 384
        : bays[0]
          ? 288
          : pickBayFrontWidthCm(rng, rules)
      bays = [
        bayFromCenter(shape, frontWidthCm, axes, widthCm, gate288.x + gate288.width / 2, windowWidthCm),
      ]
      ogWindowByAxis = buildAlignedOgWindows({ widthCm, bay: bays[0] ?? null, bays, windowWidthCm })
    } else if (!bays.length) {
      bays = []
    }
  }

  let plan: HauswandPlan = {
    seed,
    storeys,
    axes,
    widthCm,
    egType,
    egGroups,
    ogWindowByAxis,
    bay: bays[0] ?? null,
    bays,
    windowWidthCm,
    snapshotDe: '',
  }
  if (gate288) {
    plan = applyOgTreatmentForGate288(plan, plan.bays.length ? 'bay' : 'windows')
  }
  plan = finalizeHauswandPlanLayout(plan)
  // Nach Finalize: Serien >4 mit Erker (wenn erlaubt) oder 144er-Fenster durchbrechen
  plan = breakLongWindowRunsWithBayOrWide(plan, rng, rules)
  plan = withOptionalBasementWindows(plan, rng() < 0.3)
  plan.snapshotDe = formatHauswandSnapshotDe(plan)
  return plan
}

/** Nach Finalize: längste Fenster-Serie >4 → Erker in die Mitte, sonst 144er. */
function breakLongWindowRunsWithBayOrWide(
  plan: HauswandPlan,
  rng: () => number,
  rules: HauswandRegelwerk,
): HauswandPlan {
  const winW = plan.windowWidthCm ?? HAUSWAND_WINDOW_WIDTH_CM
  const mouths = planBays(plan).map((b) => bayMouthSpan(b))
  const egDoors = collectEgOpenings(plan.egGroups).filter((o) => o.type === 'door')
  const wins = [...plan.ogWindowByAxis]
    .filter((o) => o.type === 'window' && o.width >= HAUSWAND_WINDOW_WIDTH_CM - EPS)
    .filter((o) => !mouths.some((m) => spansOverlap({ start: o.x, end: o.x + o.width }, m)))
    .sort((a, b) => a.x - b.x)

  const isDoorColumn = (o: HauswandOpeningSpec) =>
    egDoors.some((d) => spansOverlap(openingSpan(o), openingSpan(d)))

  let runStart = 0
  let best = { start: 0, len: 0 }
  for (let i = 0; i < wins.length; i += 1) {
    // Türspalte unterbricht die Serie (wie Erker-Mund) — sonst zählt
    // Fenster-über-Tür mit und erzwingt unnötig einen 144er (Seed 405147048).
    if (isDoorColumn(wins[i]!)) {
      runStart = i + 1
      continue
    }
    if (i === runStart) {
      if (1 > best.len) best = { start: runStart, len: 1 }
      continue
    }
    const gap = wins[i]!.x - (wins[i - 1]!.x + wins[i - 1]!.width)
    const mid = (wins[i - 1]!.x + wins[i - 1]!.width + wins[i]!.x) / 2
    const throughBay = mouths.some((m) => mid >= m.start - 1 && mid <= m.end + 1)
    const prevDoor = isDoorColumn(wins[i - 1]!)
    if (throughBay || prevDoor) {
      runStart = i
      if (1 > best.len) best = { start: runStart, len: 1 }
      continue
    }
    if (gap + EPS >= 48 && gap <= HAUSWAND_WINDOW_GAP_CM + 64) {
      const len = i - runStart + 1
      if (len > best.len) best = { start: runStart, len }
    } else {
      runStart = i
      if (1 > best.len) best = { start: runStart, len: 1 }
    }
  }
  if (best.len <= HAUSWAND_MAX_WINDOWS_IN_A_ROW) return plan

  const midWin = wins[best.start + Math.floor(best.len / 2)]!
  const gate = rules.weights.bayPresence.gate
  const canBay =
    plan.storeys >= gate.minStoreys &&
    plan.axes >= gate.minAxes &&
    planBays(plan).length === 0

  // Auf Achsenbreite zurück (Finalize ignoriert aufgeblähte width, Erker-Center sonst außerhalb)
  const wallW = hauswandWidthCm(plan.axes, winW)
  const frac = plan.widthCm > EPS ? (midWin.x + midWin.width / 2) / plan.widthCm : 0.5
  const center = Math.max(144, Math.min(wallW - 144, frac * wallW))

  if (canBay) {
    const shape = pickWeighted(rng, { rect: 0.55, angled45: 0.45 }) as 'rect' | 'angled45'
    const frontWidthCm = pickBayFrontWidthCm(rng, rules)
    const bay = bayFromCenter(shape, frontWidthCm, plan.axes, wallW, center, winW)
    return finalizeHauswandPlanLayout({
      ...plan,
      widthCm: wallW,
      bays: [bay],
      bay,
      ogWindowByAxis: [],
    })
  }

  // Kein Erker-Gate: 144er ohne Full-Rebuild (Finalize würde ihn löschen).
  // Zwei benachbarte 96er der längsten Serie → ein 144 (Rasterlücken bleiben ≥96).
  // Auf plan.widthCm arbeiten; Türspalte meiden, danach EG-Flucht + Endfenster.
  if (Math.abs(midWin.width - HAUSWAND_WINDOW_WIDTH_CM) < 1 && best.len >= 2) {
    const wide = 144
    const W = plan.widthCm
    const eg = collectEgOpenings(plan.egGroups)
    const mouths = planBays(plan).map((b) => bayMouthSpan(b))
    const margin = HAUSWAND_END_MARGIN_MIN_CM

    const doorClearanceOk = (px: number) =>
      !eg.some((d) => {
        if (d.type !== 'door') return false
        // Abstand Tür↔144 ≥96 (Platz für zentriertes OG-Fenster über der Tür)
        const blocked = {
          start: d.x - HAUSWAND_WINDOW_GAP_CM,
          end: d.x + d.width + HAUSWAND_WINDOW_GAP_CM,
        }
        return spansOverlap({ start: px, end: px + wide }, blocked)
      })

    const clampX = (px: number) =>
      Math.max(margin, Math.min(W - margin - wide, Math.round(px / 8) * 8))

    /** Paar (i, i+1) in der Serie → 144 mittig in der kombinierten Spanne. */
    const pairToX = (i: number): number | null => {
      if (i < best.start || i + 1 >= best.start + best.len) return null
      const a = wins[i]!
      const b = wins[i + 1]!
      if (isDoorColumn(a) || isDoorColumn(b)) return null
      const spanStart = a.x
      const spanEnd = b.x + b.width
      const px = clampX(spanStart + (spanEnd - spanStart - wide) / 2)
      if (!doorClearanceOk(px)) return null
      return px
    }

    const midIdx = best.start + Math.floor(best.len / 2)
    let x: number | null = null
    // Paare um die Serienmitte (mid-1|mid, mid|mid+1), dann weiter außen
    for (let radius = 0; radius < best.len && x == null; radius += 1) {
      for (const i of [midIdx - 1 - radius, midIdx + radius, midIdx - radius, midIdx + 1 + radius]) {
        const px = pairToX(i)
        if (px != null) {
          x = px
          break
        }
      }
    }
    if (x == null) return plan

    const wideSpan = { start: x, end: x + wide }
    let og = plan.ogWindowByAxis
      .filter((o) => o.x >= -EPS && o.x + o.width <= W + EPS)
      .filter((o) => !spansOverlap(openingSpan(o), wideSpan))
      .concat([standardWindowAtX(x, wide)])

    og = alignOgWindowsAboveEgDoors(og, eg, winW)
    if (!og.some((o) => Math.abs(o.width - wide) < 1 && Math.abs(o.x - x) < 1)) {
      // Align hat den 144er verworfen (sollte mit doorClearance selten sein)
      if (!doorClearanceOk(x)) return { ...plan, widthCm: W, egGroups: plan.egGroups }
      og = [
        ...og.filter((o) => !spansOverlap(openingSpan(o), wideSpan)),
        standardWindowAtX(x, wide),
      ]
    }

    const firstX = margin
    const lastX = W - margin - winW
    if (!og.some((w) => Math.abs(w.x - firstX) < 1)) {
      og = [standardWindowAtX(firstX, winW), ...og]
    }
    if (!og.some((w) => Math.abs(w.x - lastX) < 1)) {
      og = [...og, standardWindowAtX(lastX, winW)]
    }
    og = sanitizeOgWindowGaps(og, mouths)

    return {
      ...plan,
      widthCm: W,
      ogWindowByAxis: og,
      egGroups: plan.egGroups,
    }
  }
  return plan
}

export function resolveBayPresetFromPlan(bay: HauswandBayPlan): BayWindowPreset {
  const fromLib = BAY_WINDOW_PRESETS.find((p) => p.id === bay.presetId)
  if (fromLib) return fromLib
  const front = bay.presetId.includes('-f384-') ? 384 : 288
  return bayPresetFor(bay.shape, front)
}

export function hauswandDrivewayCount(egType: HauswandEgType): number {
  return egType === 'driveway' ? 1 : 0
}

/** Mindestens eine Eingangstür (96 / 144) oder ein Tor 288×320 im EG-Plan. */
export function hauswandPlanHasEntrance(plan: Pick<HauswandPlan, 'egGroups'>): boolean {
  for (const group of plan.egGroups) {
    for (const o of group.openings) {
      if (o.type !== 'door') continue
      const isNarrow =
        o.width === HAUSWAND_NARROW_DOOR_WIDTH_CM && o.height === HAUSWAND_DOOR_HEIGHT_CM
      const isDoor =
        o.width === HAUSWAND_ENTRANCE_DOOR_WIDTH_CM && o.height === HAUSWAND_DOOR_HEIGHT_CM
      const isGate = o.width === HAUSWAND_GATE_WIDTH_CM && o.height === HAUSWAND_DOOR_HEIGHT_CM
      if (isNarrow || isDoor || isGate) return true
    }
  }
  return false
}
