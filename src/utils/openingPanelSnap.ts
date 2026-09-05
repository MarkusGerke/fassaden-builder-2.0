/**
 * Öffnungen immer bündig oder zentriert zu Fugen/Ziegeln/Paneelen — kein festes 8-cm-Raster.
 *
 * Snap-Ziele für die linke Laibung `x`:
 * 1. Bündig an Fuge — `x` = Cut
 * 2. Zentriert auf Stein — Fenstermitte auf Steinmitte (Mitte zwischen zwei Cuts)
 * 3. Wandmitte — `x` = wall.width/2 − width/2 (wichtig bei 45°-Längen)
 *
 * Drag: nur Fugen-bündig + Wandmitte; immer nächster Kandidat (kein Freilauf).
 *       Freie Position ließ Öffnungen zwischen Halbstein-Fugen stehen → Stummel.
 * Nudge: volles Raster (Fuge + Steinmitte + Wandmitte).
 * Breite: rechte Laibung ebenfalls auf eine Fuge, damit beide Kanten aufgehen.
 *
 * Gestapelte Etagen mit unterschiedlichem Modul: gemeinsame Cuts (LCM), sonst echte Lagen-Cuts.
 * Multi-Zone (`claddingZones` mit rect): Cuts aus dem Modul der Zone an Öffnungs-Mitte-Y.
 */
import type { Opening, Wall } from '../types/facade'
import {
  DEFAULT_STUDIO_PANEL,
  normalizeStudioPanel,
  STUDIO_MASONRY,
} from '../studio/constants'
import { effectivePanelAtY } from '../studio/facadeLayers'
import {
  masonryPatternCuts,
  patternModuleUnit,
  visiblePanelRowRange,
} from '../studio/panelLayout'

const EPS = 0.05
const STACK_EPS = 1.5
/** Magnet: Vorschlag nahe Wandmitte → bevorzugt exakt zentrieren (45°-Längen). */
const WALL_CENTER_MAGNET_CM = STUDIO_MASONRY
/**
 * @deprecated v2.0.82: Drag rastet immer auf die nächste Fuge; Konstante bleibt
 * für Tests/Doku (früher Freilauf außerhalb dieses Radius).
 */
export const DRAG_SNAP_MAGNET_CM = 7

function headerSize(stretcher: number): number {
  return Math.max(STUDIO_MASONRY, stretcher / 2)
}

function uniqueSorted(values: number[], max?: number): number[] {
  const out: number[] = []
  for (const v of [...values].sort((a, b) => a - b)) {
    if (!Number.isFinite(v)) continue
    if (max != null && (v < -EPS || v > max + EPS)) continue
    const clamped = max != null ? Math.max(0, Math.min(max, v)) : v
    if (out.length === 0 || clamped - out[out.length - 1]! > EPS) out.push(clamped)
  }
  return out
}

function uniqueSortedCuts(values: number[], max: number): number[] {
  const out = uniqueSorted(values, max)
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
export function wallUsesOpeningMasonrySnap(wall: Pick<Wall, 'kind' | 'panel'>): boolean {
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

/** Raster für neue/geänderte Öffnungsmaße: Halbstein (o. ä.), nicht pauschal 8 cm. */
export function studioOpeningSnapGridCm(wall: { kind?: Wall['kind']; panel?: Wall['panel'] }): number {
  if (wall.kind !== 'studio') return STUDIO_MASONRY
  if (!wallUsesOpeningMasonrySnap({ kind: 'studio', panel: wall.panel })) return STUDIO_MASONRY
  return wallMasonryModuleUnitCm({ kind: 'studio', panel: wall.panel } as Wall) ?? STUDIO_MASONRY
}

/** Paneel für Snap-Cuts: bei Zonen-Rects am `atY`, sonst `wall.panel`. */
function snapPanelForWall(wall: Wall, atY?: number) {
  if (atY != null && Number.isFinite(atY)) {
    return effectivePanelAtY(wall, atY)
  }
  return normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
}

/** Feinste Vertikal-Fugen-Einheit der Wand (cm), z. B. ½ Läufer. Optional Y-bewusst. */
export function wallMasonryModuleUnitCm(wall: Wall, atY?: number): number | null {
  if (!wallUsesOpeningMasonrySnap(wall)) return null
  const panel = snapPanelForWall(wall, atY)
  const header = headerSize(panel.panelWidth)
  const unit = patternModuleUnit(panel.pattern, panel.panelWidth, header)
  return unit != null && unit > EPS ? unit : null
}

/**
 * Gleiche Fassadenfläche über Etagen: gleicher Building, Yaw, Origin, Breite.
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
  return uniqueSortedCuts(cuts, length)
}

function wallOwnJambCuts(wall: Wall, allWalls: Wall[], atY?: number): number[] {
  const panel = snapPanelForWall(wall, atY)
  const even = masonryPatternCuts(wall, panel, allWalls, 0)
  const odd = masonryPatternCuts(wall, panel, allWalls, 1)
  return uniqueSortedCuts([...even, ...odd], wall.width)
}

/**
 * Vertikale Fugen (Cuts) als Basis für Laibungs-/Mitten-Kandidaten.
 * `atY`: Öffnungsmitte (oder Laibungsband) — bei Multi-Zone das Modul dieser Höhe.
 */
export function openingMasonryJambXs(
  wall: Wall,
  allWalls: Wall[] = [wall],
  atY?: number,
): number[] {
  const stack = masonryFacadeStack(wall, allWalls)
  const own = wallOwnJambCuts(wall, allWalls, atY)
  if (stack.length <= 1) return own

  const units = stack
    .map((w) => wallMasonryModuleUnitCm(w, w.id === wall.id ? atY : undefined))
    .filter((u): u is number => u != null)
    .map((u) => Math.round(u))
  const distinct = new Set(units)
  if (distinct.size <= 1) return own

  let step: number | null = null
  for (const ui of units) {
    const n = Math.max(1, ui)
    step = step == null ? n : lcmInt(step, n)
  }
  if (step == null || step <= EPS) return own
  return regularJambCuts(wall.width, step)
}

/** Horizontale Schichtgrenzen. Optional Y-bewusst (Zonen-`panelHeight`). */
export function openingMasonryCourseYs(wall: Wall, atY?: number): number[] {
  const panel = snapPanelForWall(wall, atY ?? wall.height / 2)
  const { rowCuts } = visiblePanelRowRange(wall.height, panel)
  return uniqueSortedCuts(rowCuts, wall.height)
}

export type OpeningPlacementCandidateKind = 'full' | 'drag'

/**
 * Erlaubte linke Laibungs-X.
 * - `full` (Nudge/Align): Fugen-bündig, auf Steinmitte zentriert, Wandmitte
 * - `drag`: nur Fugen-bündig + Wandmitte (keine Steinmitten — weniger Springen)
 * Nur Positionen, bei denen die Öffnung vollständig auf der Wand liegt.
 */
export function openingPlacementCandidateXs(
  wall: Wall,
  allWalls: Wall[],
  width: number,
  atY?: number,
  kind: OpeningPlacementCandidateKind = 'full',
): number[] {
  const maxX = Math.max(0, wall.width - width)
  const cuts = openingMasonryJambXs(wall, allWalls, atY)
  const xs: number[] = []

  // 1) Bündig an Fuge (linke Laibung auf Cut)
  for (const c of cuts) {
    if (c >= -EPS && c <= maxX + EPS) xs.push(c)
  }

  // 2) Zentriert auf Stein/Paneel — nur Nudge/Align
  if (kind === 'full') {
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const a = cuts[i]!
      const b = cuts[i + 1]!
      if (b - a <= EPS) continue
      const mid = (a + b) / 2
      const x = mid - width / 2
      if (x >= -EPS && x <= maxX + EPS) xs.push(x)
    }
  }

  // 3) Wandmitte (auch wenn nicht auf dem Fugenraster — 45°-Längen)
  const wallCenterX = wall.width / 2 - width / 2
  if (wallCenterX >= -EPS && wallCenterX <= maxX + EPS) {
    xs.push(wallCenterX)
  }

  return uniqueSorted(xs)
}

/**
 * Y-Kandidaten.
 * - `full`: Schicht-bündig, Schichtmitte, Wand-vertikal-Mitte
 * - `drag`: nur Schicht-bündig + Wandmitte (keine Schichtmitten)
 */
export function openingPlacementCandidateYs(
  wall: Wall,
  height: number,
  atY?: number,
  kind: OpeningPlacementCandidateKind = 'full',
): number[] {
  const maxY = Math.max(0, wall.height - height)
  const cuts = openingMasonryCourseYs(wall, atY)
  const ys: number[] = []
  for (const c of cuts) {
    if (c >= -EPS && c <= maxY + EPS) ys.push(c)
  }
  if (kind === 'full') {
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const a = cuts[i]!
      const b = cuts[i + 1]!
      if (b - a <= EPS) continue
      const mid = (a + b) / 2
      const y = mid - height / 2
      if (y >= -EPS && y <= maxY + EPS) ys.push(y)
    }
  }
  const wallCenterY = wall.height / 2 - height / 2
  if (wallCenterY >= -EPS && wallCenterY <= maxY + EPS) ys.push(wallCenterY)
  return uniqueSorted(ys)
}

/** Öffnungsmitte Y für Zonen-Auswahl (Fallback: Wandmitte). */
function openingCenterY(
  opening: Pick<Opening, 'y' | 'height'>,
  proposedY?: number,
): number {
  const y = proposedY != null && Number.isFinite(proposedY) ? proposedY : opening.y
  return y + opening.height / 2
}

function nearestValue(values: number[], target: number): number {
  if (values.length === 0) return target
  let best = values[0]!
  let bestD = Math.abs(best - target)
  for (const v of values) {
    const d = Math.abs(v - target)
    if (d < bestD) {
      best = v
      bestD = d
    }
  }
  return best
}

/** Nächster Kandidat nur innerhalb des Magnet-Radius; sonst freie Position. */
function magnetNearest(values: number[], target: number, magnetCm: number): number {
  if (values.length === 0) return target
  const best = nearestValue(values, target)
  if (Math.abs(best - target) <= magnetCm + EPS) return best
  return target
}

function adjacentValue(values: number[], current: number, dir: 1 | -1): number {
  if (values.length === 0) return current
  if (dir > 0) {
    for (const v of values) {
      if (v > current + EPS) return v
    }
    return current
  }
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i]!
    if (v < current - EPS) return v
  }
  return current
}

/**
 * Nudge um `minTravelCm`: so viele Kandidaten weiter, bis die zurückgelegte Strecke
 * ≥ dem gewünschten 8·n-Schritt ist (ein Fugen-Sprung kann größer sein als 8 cm).
 */
function adjacentValueByTravel(
  values: number[],
  current: number,
  dir: 1 | -1,
  minTravelCm: number,
): number {
  if (values.length === 0) return current
  const need = Math.max(EPS, Math.abs(minTravelCm))
  let x = current
  let traveled = 0
  for (let guard = 0; guard < values.length + 2; guard += 1) {
    if (traveled >= need - EPS) break
    const next = adjacentValue(values, x, dir)
    const step = Math.abs(next - x)
    if (step <= EPS) break
    traveled += step
    x = next
  }
  return x
}

/**
 * Nächster X-Kandidat; nahe Wandmitte mit Magnet auf exakte Zentrierung.
 * `magnetCm`: wenn gesetzt (Drag), nur innerhalb Radius einrasten — sonst freie Position.
 */
function nearestPlacementX(
  candidates: number[],
  proposedX: number,
  width: number,
  wallWidth: number,
  magnetCm?: number,
): number {
  const wallCenterX = wallWidth / 2 - width / 2
  const proposedCenter = proposedX + width / 2
  if (
    wallCenterX >= -EPS &&
    wallCenterX <= wallWidth - width + EPS &&
    Math.abs(proposedCenter - wallWidth / 2) <= WALL_CENTER_MAGNET_CM
  ) {
    return wallCenterX
  }
  if (magnetCm != null) {
    return magnetNearest(candidates, proposedX, magnetCm)
  }
  return nearestValue(candidates, proposedX)
}

/** Breite so snappen, dass rechte Laibung auf einer Fuge liegt (linke bleibt).
 * Wählt die Fuge mit kleinstem |Breite − Soll| — nicht „nächster Cut“, der 96 oft zu 104 aufbläht.
 */
export function snapOpeningWidthToMasonryJambs(
  wall: Wall,
  allWalls: Wall[],
  x: number,
  width: number,
  atY?: number,
): number {
  if (!wallUsesOpeningMasonrySnap(wall)) return width
  const cuts = openingMasonryJambXs(wall, allWalls, atY)
  if (cuts.length < 2) return width
  const left = nearestValue(cuts, x)
  let bestW = width
  let bestErr = Infinity
  for (const right of cuts) {
    if (right <= left + EPS) continue
    const w = right - left
    if (w > wall.width + EPS) continue
    const err = Math.abs(w - width)
    // Bei Gleichstand: exakte Sollbreite, sonst kleinere Abweichung nach innen (nicht aufblasen).
    if (
      err < bestErr - EPS ||
      (Math.abs(err - bestErr) <= EPS && (Math.abs(w - width) < Math.abs(bestW - width) || w < bestW))
    ) {
      bestErr = err
      bestW = w
    }
  }
  const out = Math.max(STUDIO_MASONRY, bestW)
  // #region agent log
  fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6b426'},body:JSON.stringify({sessionId:'c6b426',runId:'pre-fix',hypothesisId:'A',location:'openingPanelSnap.ts:snapOpeningWidthToMasonryJambs',message:'width snap result',data:{xIn:x,left,targetWidth:width,bestW:out,bestErr,cutCount:cuts.length,sampleCuts:cuts.filter((c)=>c>=left-0.1&&c<=left+200).slice(0,16),hasExactTarget:cuts.some((r)=>Math.abs(r-left-width)<=EPS),flushForTarget:openingFlushWidthPlacementXs(wall,allWalls,width,atY).length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return out
}

/** Linke Laibungen, bei denen `x` und `x+width` auf Fugen liegen (Sollbreite bleibt). */
export function openingFlushWidthPlacementXs(
  wall: Wall,
  allWalls: Wall[],
  width: number,
  atY?: number,
): number[] {
  if (!wallUsesOpeningMasonrySnap(wall) || width <= EPS) return []
  const cuts = openingMasonryJambXs(wall, allWalls, atY)
  const maxX = Math.max(0, wall.width - width)
  const xs: number[] = []
  for (const left of cuts) {
    if (left < -EPS || left > maxX + EPS) continue
    const right = left + width
    if (cuts.some((c) => Math.abs(c - right) <= EPS)) xs.push(left)
  }
  return uniqueSorted(xs)
}

export interface OpeningMasonrySnapResult {
  x: number
  y: number
  width: number
  height: number
}

export type OpeningMasonryMoveMode = 'drag' | 'nudge'

/**
 * Position an Kandidaten (Fuge / Steinmitte / Wandmitte).
 * - `drag`: Fugen-bündig + Wandmitte, immer nächster Kandidat; Breite so dass beide Laibungen auf Fugen liegen
 * - `nudge`: nächster/vorheriger Kandidat aus dem vollen Raster
 */
export function snapOpeningMoveToMasonry(
  wall: Wall,
  allWalls: Wall[],
  opening: Pick<Opening, 'x' | 'y' | 'width' | 'height' | 'type' | 'stairs'>,
  proposedX: number,
  proposedY: number,
  dx: number,
  dy: number,
  mode: OpeningMasonryMoveMode = 'drag',
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

  const atY = openingCenterY(opening, proposedY)
  const kind: OpeningPlacementCandidateKind = mode === 'drag' ? 'drag' : 'full'
  // Beim Verschieben Breite/Höhe nicht anfassen — sonst wird Bibliothek 96×192 zu 104.
  // Drag: wenn möglich nur Positionen mit beiden Laibungen auf Fugen (Sollbreite).
  const flushXs = openingFlushWidthPlacementXs(wall, allWalls, width, atY)
  const xs =
    mode === 'drag' && flushXs.length > 0
      ? flushXs
      : openingPlacementCandidateXs(wall, allWalls, width, atY, kind)
  if (xs.length > 0) {
    const xBefore = x
    if (mode === 'nudge' && Math.abs(dx) > EPS) {
      x = adjacentValueByTravel(xs, opening.x, dx > 0 ? 1 : -1, dx)
    } else if (Math.abs(dx) > EPS || Math.abs(proposedX - opening.x) > EPS) {
      x = nearestPlacementX(xs, proposedX, width, wall.width)
    } else {
      x = nearestPlacementX(xs, opening.x, width, wall.width)
    }
    // #region agent log
    {
      const wallCenterX = wall.width / 2 - width / 2
      const proposedCenter = proposedX + width / 2
      const magnetHit =
        Math.abs(proposedCenter - wall.width / 2) <= WALL_CENTER_MAGNET_CM &&
        Math.abs(x - wallCenterX) <= EPS
      const jump = Math.abs(x - opening.x)
      if (magnetHit || jump > 24 || mode === 'nudge') {
        fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6b426'},body:JSON.stringify({sessionId:'c6b426',runId:'pre-fix',hypothesisId:magnetHit?'M':'J',location:'openingPanelSnap.ts:snapOpeningMoveToMasonry',message:'move snap x',data:{mode,dx,dy,openingX:opening.x,proposedX,xBefore,xOut:x,width,wallW:wall.width,wallCenterX,flushCount:flushXs.length,candCount:xs.length,usedFlush:mode==='drag'&&flushXs.length>0,magnetHit,jump,distToCenter:Math.abs(proposedCenter-wall.width/2),sampleXs:xs.filter((v)=>Math.abs(v-proposedX)<80).slice(0,12)},timestamp:Date.now()})}).catch(()=>{});
      }
    }
    // #endregion
  }

  const lockY = opening.type === 'door' && Boolean(opening.stairs?.enabled)
  if (!lockY) {
    const ys = openingPlacementCandidateYs(wall, height, atY, kind)
    if (ys.length > 0) {
      if (mode === 'nudge' && Math.abs(dy) > EPS) {
        y = adjacentValueByTravel(ys, opening.y, dy > 0 ? 1 : -1, dy)
      } else if (Math.abs(dy) > EPS || Math.abs(proposedY - opening.y) > EPS) {
        y = nearestValue(ys, proposedY)
      } else {
        y = nearestValue(ys, opening.y)
      }
    }
  }

  return { x, y, width, height }
}

/** Einmalige Ausrichtung: nächster Kandidat (optional Breite/Höhe an Fugen). */
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

  const atY = openingCenterY(opening)
  const snapWidth = opts?.snapWidth === true
  const snapHeight = opts?.snapHeight === true

  const widthIn = width
  const xIn = x
  // Explizite Breitenänderung (snapWidth): Sollbreite halten — nicht auf nächste Fugen-Spannweite
  // aufblasen (96→100/104). Nur Position so wählen, dass möglichst beide Laibungen auf Fugen liegen.

  // Sollbreite halten: Positionen bevorzugen, bei denen beide Laibungen auf Fugen liegen.
  const flushXs = openingFlushWidthPlacementXs(wall, allWalls, width, atY)
  const xs =
    flushXs.length > 0
      ? flushXs
      : openingPlacementCandidateXs(wall, allWalls, width, atY, 'full')
  if (xs.length > 0) x = nearestPlacementX(xs, x, width, wall.width)

  const lockY = opening.type === 'door' && Boolean(opening.stairs?.enabled)
  if (!lockY) {
    if (snapHeight) {
      const ysCuts = openingMasonryCourseYs(wall, atY)
      if (ysCuts.length >= 2) {
        const top = nearestValue(ysCuts, y)
        const bottom = nearestValue(ysCuts, top + height)
        const h = bottom - top
        if (h >= STUDIO_MASONRY - EPS) {
          y = top
          height = h
        }
      }
    }
    const ys = openingPlacementCandidateYs(wall, height, atY, 'full')
    if (ys.length > 0) y = nearestValue(ys, y)
  }

  // #region agent log
  if (snapWidth || Math.abs(width - widthIn) > 0.05) {
    fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6b426'},body:JSON.stringify({sessionId:'c6b426',runId:'post-fix',hypothesisId:'B',location:'openingPanelSnap.ts:alignOpeningToMasonry',message:'align masonry out',data:{snapWidth,snapHeight,xIn,widthIn,xOut:x,widthOut:width,flushCount:flushXs.length,atY,wallWidth:wall.width},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  return { x, y, width, height }
}
