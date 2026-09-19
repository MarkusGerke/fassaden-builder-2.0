import { createGalleryRng } from '../gallery/galleryRandom'
import { BAY_WINDOW_PRESETS, type BayWindowPreset } from '../studio/bayWindow'
import { HAUSWAND_REGELWERK } from './constants'
import {
  hauswandAxisGroupWidthCm,
  hauswandAxisOpeningXCm,
  hauswandWidthCm,
  HAUSWAND_DOOR_HEIGHT_CM,
  HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
  HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
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

function standardWindowAtAxis(axisIndex: number, windowWidthCm: number): HauswandOpeningSpec {
  return {
    x: hauswandAxisOpeningXCm(axisIndex, windowWidthCm),
    width: windowWidthCm,
    height: HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
    y: HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
    type: 'window',
  }
}

function doorGroup(axisStart: number, axisCount: number, windowWidthCm: number): HauswandEgGroup {
  return {
    axisStart,
    axisCount,
    openings: [
      {
        x: hauswandAxisOpeningXCm(axisStart, windowWidthCm),
        width: hauswandAxisGroupWidthCm(axisCount, windowWidthCm),
        height: HAUSWAND_DOOR_HEIGHT_CM,
        y: 0,
        type: 'door',
      },
    ],
  }
}

function windowGroup(axisStart: number, axisCount: number, windowWidthCm: number): HauswandEgGroup {
  const openings: HauswandOpeningSpec[] = []
  for (let a = axisStart; a < axisStart + axisCount; a += 1) {
    openings.push(standardWindowAtAxis(a, windowWidthCm))
  }
  return { axisStart, axisCount, openings }
}

function fillRemainingWithWindows(
  axes: number,
  used: boolean[],
  windowWidthCm: number,
): HauswandEgGroup[] {
  const groups: HauswandEgGroup[] = []
  let a = 0
  while (a < axes) {
    if (used[a]) {
      a += 1
      continue
    }
    const start = a
    while (a < axes && !used[a]) a += 1
    groups.push(windowGroup(start, a - start, windowWidthCm))
  }
  return groups
}

function buildEgGroups(
  egType: HauswandEgType,
  axes: number,
  rng: () => number,
  windowWidthCm: number,
): HauswandEgGroup[] {
  const used = Array.from({ length: axes }, () => false)

  if (egType === 'residentialWindows') {
    return [windowGroup(0, axes, windowWidthCm)]
  }

  if (egType === 'entrance') {
    const doorAxis = Math.floor(rng() * axes)
    used[doorAxis] = true
    return [doorGroup(doorAxis, 1, windowWidthCm), ...fillRemainingWithWindows(axes, used, windowWidthCm)]
  }

  if (egType === 'driveway') {
    const span = rng() < 0.45 ? 2 : 3
    const maxStart = Math.max(0, axes - span)
    const start = Math.floor(rng() * (maxStart + 1))
    for (let i = start; i < start + span; i += 1) used[i] = true
    return [doorGroup(start, span, windowWidthCm), ...fillRemainingWithWindows(axes, used, windowWidthCm)]
  }

  if (egType === 'shopWindow') {
    const span = Math.min(2, axes)
    const maxStart = Math.max(0, axes - span)
    const start = Math.floor(rng() * (maxStart + 1))
    for (let i = start; i < start + span; i += 1) used[i] = true
    const w = hauswandAxisGroupWidthCm(span, windowWidthCm)
    const group: HauswandEgGroup = {
      axisStart: start,
      axisCount: span,
      openings: [
        {
          x: hauswandAxisOpeningXCm(start, windowWidthCm),
          width: w,
          height: HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
          y: HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
          type: 'window',
        },
      ],
    }
    return [group, ...fillRemainingWithWindows(axes, used, windowWidthCm)]
  }

  // shopfrontGroup — Tür + Schaufenster (Stub ohne Säulen)
  const doorSpan = 1
  const shopSpan = Math.min(2, axes - doorSpan)
  let doorStart = Math.floor(rng() * Math.max(1, axes - doorSpan - shopSpan + 1))
  if (doorStart + doorSpan + shopSpan > axes) doorStart = 0
  const shopStart = doorStart + doorSpan
  for (let i = doorStart; i < doorStart + doorSpan; i += 1) used[i] = true
  for (let i = shopStart; i < shopStart + shopSpan; i += 1) used[i] = true
  const shopWidth = hauswandAxisGroupWidthCm(shopSpan, windowWidthCm)
  return [
    doorGroup(doorStart, doorSpan, windowWidthCm),
    {
      axisStart: shopStart,
      axisCount: shopSpan,
      openings: [
        {
          x: hauswandAxisOpeningXCm(shopStart, windowWidthCm),
          width: shopWidth,
          height: HAUSWAND_STANDARD_WINDOW_HEIGHT_CM,
          y: HAUSWAND_STANDARD_WINDOW_SILL_Y_CM,
          type: 'window',
        },
      ],
    },
    ...fillRemainingWithWindows(axes, used, windowWidthCm),
  ]
}

function bayPresetFor(shape: HauswandBayPlan['shape'], axisSpan: number): BayWindowPreset {
  const frontWidthCm = axisSpan >= 2 ? 384 : 192
  const depthCm = 96
  if (shape === 'round') {
    const match = BAY_WINDOW_PRESETS.find(
      (p) => p.shape === 'round' && p.frontWidthCm === frontWidthCm,
    )
    if (match) return match
    return {
      id: `arrivieren-round-f${frontWidthCm}`,
      label: `Erker rund ${frontWidthCm}`,
      frontWidthCm,
      depthCm,
      shape: 'round',
      kind: 'bay',
    }
  }
  const shapeKey = shape === 'angled45' ? '45' : 'rect'
  const id = `bay-f${frontWidthCm}-d${depthCm}-${shapeKey}`
  const match = BAY_WINDOW_PRESETS.find((p) => p.id === id)
  if (match) return match
  return {
    id,
    label: `Erker ${frontWidthCm}/${depthCm}`,
    frontWidthCm,
    depthCm,
    shape: shape === 'angled45' ? 'angled45' : 'rect',
    kind: 'bay',
  }
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

function buildBayPlan(
  storeys: number,
  axes: number,
  rng: () => number,
  rules: HauswandRegelwerk,
  windowWidthCm: number,
): HauswandBayPlan | null {
  const gate = rules.weights.bayPresence.gate
  if (storeys < gate.minStoreys || axes < gate.minAxes) return null
  if (pickWeighted(rng, { none: rules.weights.bayPresence.none, present: rules.weights.bayPresence.present }) !== 'present') {
    return null
  }
  const axisSpan = pickIntWeighted(rng, rules.weights.bayAxisSpan)
  const span = axisSpan === 2 ? 2 : 1
  const shape = pickWeighted(rng, rules.weights.bayShapeWhenPresent) as HauswandBayPlan['shape']
  const axisStart = pickBayPlacement(rng, axes, span, rules.weights.bayHorizontalPlacement)
  const preset = bayPresetFor(shape, span)
  const groupWidth = hauswandAxisGroupWidthCm(span, windowWidthCm)
  const centerLocalXCm = hauswandAxisOpeningXCm(axisStart, windowWidthCm) + groupWidth / 2
  return {
    shape,
    axisStart,
    axisSpan: span,
    centerLocalXCm,
    presetId: preset.id,
  }
}

function axisBlockedByBay(axis: number, bay: HauswandBayPlan | null): boolean {
  if (!bay) return false
  return axis >= bay.axisStart && axis < bay.axisStart + bay.axisSpan
}

function buildOgWindows(axes: number, bay: HauswandBayPlan | null, windowWidthCm: number): HauswandOpeningSpec[] {
  const out: HauswandOpeningSpec[] = []
  for (let a = 0; a < axes; a += 1) {
    if (axisBlockedByBay(a, bay)) continue
    out.push(standardWindowAtAxis(a, windowWidthCm))
  }
  return out
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
  'storeys' | 'axes' | 'widthCm' | 'egType' | 'bay' | 'seed'
>): string {
  const parts = [
    `${plan.storeys} Geschoss${plan.storeys === 1 ? '' : 'e'}`,
    `${plan.axes} Achsen`,
    `${plan.widthCm} cm`,
    `EG ${EG_LABEL[plan.egType]}`,
  ]
  if (plan.bay) {
    parts.push(
      `Erker ${BAY_LABEL[plan.bay.shape]} Achse${plan.bay.axisSpan > 1 ? 'n' : ''} ${plan.bay.axisStart + 1}${plan.bay.axisSpan > 1 ? `–${plan.bay.axisStart + plan.bay.axisSpan}` : ''}`,
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
  const windowWidthCm = Number.parseInt(pickWeighted(rng, { '96': 0.92, '144': 0.08 }), 10)
  const widthCm = hauswandWidthCm(axes, windowWidthCm)
  const bay = buildBayPlan(storeys, axes, rng, rules, windowWidthCm)
  const egGroups = buildEgGroups(egType, axes, rng, windowWidthCm)
  const ogWindowByAxis = buildOgWindows(axes, bay, windowWidthCm)

  const plan: HauswandPlan = {
    seed,
    storeys,
    axes,
    windowWidthCm,
    widthCm,
    egType,
    egGroups,
    ogWindowByAxis,
    bay,
    snapshotDe: '',
  }
  plan.snapshotDe = formatHauswandSnapshotDe(plan)
  return plan
}

export function resolveBayPresetFromPlan(bay: HauswandBayPlan): BayWindowPreset {
  const fromLib = BAY_WINDOW_PRESETS.find((p) => p.id === bay.presetId)
  if (fromLib) return fromLib
  return bayPresetFor(bay.shape, bay.axisSpan)
}

export function hauswandDrivewayCount(egType: HauswandEgType): number {
  return egType === 'driveway' ? 1 : 0
}
