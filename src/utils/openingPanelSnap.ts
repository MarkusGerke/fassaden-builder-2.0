/**
 * Öffnungen an echte Paneel-/Mauerwerksfugen ausrichten (Laibung bündig mit Steinkante).
 * Nutzt dasselbe Cut-Raster wie `layoutPanelTiles` (Referenzlagen, ohne Öffnungs-Blocker) —
 * keine zweite Ideal-Gitter-Logik, Verband bleibt unverändert.
 *
 * Gestapelte Etagen mit **unterschiedlicher** Modulbreite (z. B. 24er Ziegel / 48er Paneel):
 * Snap auf dem gemeinsamen LCM der Modul-Einheiten, damit Laibungen auf beiden
 * Fassaden bündig sitzen können — ohne den Verband zu dehnen.
 */
import type { Opening, Wall } from '../types/facade'
import {
  DEFAULT_STUDIO_PANEL,
  normalizeStudioPanel,
  STUDIO_MASONRY,
} from '../studio/constants'
import {
  masonryPatternCuts,
  patternModuleUnit,
  visiblePanelRowRange,
} from '../studio/panelLayout'

const EPS = 0.05
/** Plan-Toleranz für „gleiche Fassaden-Stapel“ (Origin/Breite/Yaw). */
const STACK_EPS = 1.5

function headerSize(stretcher: number): number {
  return Math.max(STUDIO_MASONRY, stretcher / 2)
}

function uniqueSorted(values: number[], max: number): number[] {
  const out: number[] = []
  for (const v of [...values].sort((a, b) => a - b)) {
    if (v < -EPS || v > max + EPS) continue
    const clamped = Math.max(0, Math.min(max, v))
    if (out.length === 0 || clamped - out[out.length - 1]! > EPS) out.push(clamped)
  }
  if (out.length === 0 || out[0]! > EPS) out.unshift(0)
  if (out[out.length - 1]! < max - EPS) out.push(max)
  return out
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function lcmInt(a: number, b: number): number {
  const aa = Math.abs(Math.round(a))
  const bb = Math.abs(Math.round(b))
  if (!aa || !bb) return aa || bb || 1
  return (aa / gcdInt(aa, bb)) * bb
}

function normYaw(yawDeg: number): number {
  return ((yawDeg % 360) + 360) % 360
}

/** Studio-Wand mit Vertikal-Modul (kein Streifen / Wildverband / aus). */
export function wallUsesOpeningMasonrySnap(wall: Wall): boolean {
  if (wall.kind !== 'studio') return false
  const raw = wall.panel
  if (!raw || raw.enabled === false) return false
  const panel = normalizeStudioPanel(raw)
  if (panel.pattern === 'none' || panel.pattern === 'strip' || panel.pattern === 'wildBond') {
    return false
  }
  const header = headerSize(panel.panelWidth)
  return patternModuleUnit(panel.pattern, panel.panelWidth, header) != null
}

/** Feinste Vertikal-Fugen-Einheit der Wand (cm), z. B. ½ Läufer. */
export function wallMasonryModuleUnitCm(wall: Wall): number | null {
  if (!wallUsesOpeningMasonrySnap(wall)) return null
  const panel = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  const header = headerSize(panel.panelWidth)
  const unit = patternModuleUnit(panel.pattern, panel.panelWidth, header)
  return unit != null && unit > EPS ? unit : null
}

/**
 * Gleiche Fassadenfläche über Etagen: gleicher Building, Yaw, Origin, Breite.
 * (Duplizierte Geschosse teilen den Fußabdruck.)
 */
export function masonryFacadeStack(wall: Wall, allWalls: Wall[]): Wall[] {
  if (!wallUsesOpeningMasonrySnap(wall)) return [wall]
  const ox = wall.originX ?? wall.x ?? 0
  const oz = wall.originZ ?? 0
  const yaw = normYaw(wall.yawDeg ?? 0)
  const peers = allWalls.filter((other) => {
    if (!wallUsesOpeningMasonrySnap(other)) return false
    if (wall.buildingId != null && other.buildingId != null && wall.buildingId !== other.buildingId) {
      return false
    }
    if (Math.abs(normYaw(other.yawDeg ?? 0) - yaw) > 0.5) return false
    const oox = other.originX ?? other.x ?? 0
    const ooz = other.originZ ?? 0
    if (Math.abs(oox - ox) > STACK_EPS || Math.abs(ooz - oz) > STACK_EPS) return false
    if (Math.abs(other.width - wall.width) > STACK_EPS) return false
    return true
  })
  return peers.length > 0 ? peers : [wall]
}

/**
 * Gemeinsamer Snap-Schritt (cm) für einen Fassadenstapel:
 * LCM der Modul-Einheiten — z. B. 12 (24er) und 24 (48er) → 24.
 */
export function commonMasonrySnapStepCm(walls: Wall[]): number | null {
  let step: number | null = null
  for (const w of walls) {
    const u = wallMasonryModuleUnitCm(w)
    if (u == null) continue
    const ui = Math.max(1, Math.round(u))
    step = step == null ? ui : lcmInt(step, ui)
  }
  return step
}

function regularJambCuts(length: number, step: number): number[] {
  if (length <= EPS || step <= EPS) return [0, Math.max(0, length)]
  const cuts: number[] = [0]
  const n = Math.max(1, Math.floor((length + EPS) / step))
  for (let i = 1; i < n; i += 1) cuts.push(i * step)
  if (cuts[cuts.length - 1]! < length - EPS) cuts.push(length)
  else cuts[cuts.length - 1] = length
  return uniqueSorted(cuts, length)
}

function wallOwnJambCuts(wall: Wall, allWalls: Wall[]): number[] {
  const panel = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  const even = masonryPatternCuts(wall, panel, allWalls, 0)
  const odd = masonryPatternCuts(wall, panel, allWalls, 1)
  return uniqueSorted([...even, ...odd], wall.width)
}

/**
 * Vertikale Fugen als Snap-Ziele.
 * Eine Wand / gleiches Modul: echte Cuts (inkl. Forced-Ends).
 * Gestapelte Etagen mit **verschiedenem** Modul: LCM-Raster (immer beidseitig einpassbar).
 */
export function openingMasonryJambXs(wall: Wall, allWalls: Wall[] = [wall]): number[] {
  const stack = masonryFacadeStack(wall, allWalls)
  const own = wallOwnJambCuts(wall, allWalls)
  if (stack.length <= 1) return own

  const units = stack
    .map((w) => wallMasonryModuleUnitCm(w))
    .filter((u): u is number => u != null)
    .map((u) => Math.round(u))
  const distinct = new Set(units)
  if (distinct.size <= 1) return own

  const step = commonMasonrySnapStepCm(stack)
  if (step == null || step <= EPS) return own
  return regularJambCuts(wall.width, step)
}

/** Horizontale Schichtgrenzen (Ziegel-Ebenen) als Snap-Ziele. */
export function openingMasonryCourseYs(wall: Wall): number[] {
  const panel = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  const { rowCuts } = visiblePanelRowRange(wall.height, panel)
  return uniqueSorted(rowCuts, wall.height)
}

function nearestCut(cuts: number[], value: number): number {
  let best = cuts[0] ?? value
  let bestD = Math.abs(best - value)
  for (const c of cuts) {
    const d = Math.abs(c - value)
    if (d < bestD) {
      best = c
      bestD = d
    }
  }
  return best
}

function adjacentCut(cuts: number[], value: number, dir: 1 | -1): number {
  if (dir > 0) {
    for (const c of cuts) {
      if (c > value + EPS) return c
    }
    return value
  }
  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    const c = cuts[i]!
    if (c < value - EPS) return c
  }
  return value
}

/**
 * Beste linke Fuge: Nähe zu `proposedX`, und rechte Kante (`+width`) möglichst auch auf Fuge.
 */
function bestLeftForWidth(cuts: number[], proposedX: number, width: number): number {
  if (cuts.length < 2 || width <= EPS) return nearestCut(cuts, proposedX)
  let best = nearestCut(cuts, proposedX)
  let bestScore = Infinity
  for (const left of cuts) {
    const rightTarget = left + width
    if (rightTarget > cuts[cuts.length - 1]! + EPS) continue
    const right = nearestCut(cuts, rightTarget)
    const score = Math.abs(left - proposedX) + Math.abs(right - rightTarget) * 0.75
    if (score < bestScore) {
      bestScore = score
      best = left
    }
  }
  return best
}

/** Breite so snappen, dass rechte Laibung auf einer Fuge liegt (linke bleibt). */
export function snapOpeningWidthToMasonryJambs(
  wall: Wall,
  allWalls: Wall[],
  x: number,
  width: number,
): number {
  if (!wallUsesOpeningMasonrySnap(wall)) return width
  const cuts = openingMasonryJambXs(wall, allWalls)
  const left = nearestCut(cuts, x)
  const right = nearestCut(cuts, left + width)
  const next = Math.max(STUDIO_MASONRY, right - left)
  return next <= wall.width + EPS ? next : width
}

export interface OpeningMasonrySnapResult {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Position nach Verschiebung an Fugen/Schichten. Kleine Schritte (±8 cm) → nächste Fuge;
 * größere Moves → nächste Fuge zur vorgeschlagenen Position (bevorzugt beidseitig bündig).
 */
export function snapOpeningMoveToMasonry(
  wall: Wall,
  allWalls: Wall[],
  opening: Pick<Opening, 'x' | 'y' | 'width' | 'height' | 'type' | 'stairs'>,
  proposedX: number,
  proposedY: number,
  dx: number,
  dy: number,
): OpeningMasonrySnapResult {
  let { x, y, width, height } = {
    x: proposedX,
    y: proposedY,
    width: opening.width,
    height: opening.height,
  }

  if (!wallUsesOpeningMasonrySnap(wall)) {
    return { x, y, width, height }
  }

  const xs = openingMasonryJambXs(wall, allWalls)
  if (xs.length >= 2) {
    const absDx = Math.abs(dx)
    if (absDx > EPS && absDx <= STUDIO_MASONRY + 0.5) {
      x = adjacentCut(xs, opening.x, dx > 0 ? 1 : -1)
    } else if (absDx > EPS) {
      x = bestLeftForWidth(xs, proposedX, width)
    } else {
      x = nearestCut(xs, opening.x)
    }
  }

  const lockY = opening.type === 'door' && Boolean(opening.stairs?.enabled)
  if (!lockY) {
    const ys = openingMasonryCourseYs(wall)
    if (ys.length >= 2) {
      const absDy = Math.abs(dy)
      if (absDy > EPS && absDy <= STUDIO_MASONRY + 0.5) {
        y = adjacentCut(ys, opening.y, dy > 0 ? 1 : -1)
      } else if (absDy > EPS) {
        y = nearestCut(ys, proposedY)
      } else {
        y = nearestCut(ys, opening.y)
      }
    }
  }

  return { x, y, width, height }
}

/** Einmalige Ausrichtung (Platzieren / Maße ändern): Laibungen auf Fugen, Höhen auf Schichten. */
export function alignOpeningToMasonry(
  wall: Wall,
  allWalls: Wall[],
  opening: Pick<Opening, 'x' | 'y' | 'width' | 'height' | 'type' | 'stairs'>,
  opts?: { snapWidth?: boolean; snapHeight?: boolean },
): OpeningMasonrySnapResult {
  let { x, y, width, height } = opening
  if (!wallUsesOpeningMasonrySnap(wall)) {
    return { x, y, width, height }
  }

  const xs = openingMasonryJambXs(wall, allWalls)
  if (xs.length >= 2) {
    x = bestLeftForWidth(xs, x, width)
    if (opts?.snapWidth !== false) {
      width = snapOpeningWidthToMasonryJambs(wall, allWalls, x, width)
    }
  }

  const lockY = opening.type === 'door' && Boolean(opening.stairs?.enabled)
  if (!lockY) {
    const ys = openingMasonryCourseYs(wall)
    if (ys.length >= 2) {
      y = nearestCut(ys, y)
      if (opts?.snapHeight !== false) {
        const bottom = nearestCut(ys, y + height)
        const h = bottom - y
        if (h >= STUDIO_MASONRY - EPS) height = h
      }
    }
  }

  return { x, y, width, height }
}
