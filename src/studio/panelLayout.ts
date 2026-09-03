import type { EndBossPattern, Opening, StudioPanelConfig, StudioPanelPattern, Wall } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, panelKindForPattern, STUDIO_MASONRY, STUDIO_TILE, clampHideRows, normalizeStudioPanel, studioPlinthActive } from './constants'
import {
  findCollinearDockWall,
  panelMiterEnds,
  studioPanelFaceLocalZ,
  studioWindowDepthForwardSign,
  turningAdjacentWalls,
  wallHasPanels,
} from './walls'
import { studioMiterLocalX } from './wallMiterX'
import {
  maskXSpanAtY,
  openingArchGeom,
  openingArchSpringY,
  openingCutsWall,
  openingMasonryRect,
  openingStadiumGeom,
} from '../utils/openingGeometry'
import {
  claddingZonesForWall,
  clipTilesToZoneRect,
  effectivePanelForZone,
  openingCladdingMaskInflateForLayout,
} from './facadeLayers'

export interface PanelTile {
  x: number
  y: number
  width: number
  height: number
  /** Extrusionstiefe (cm); bei alternateFloors pro Ebene. */
  depth?: number
  /** Trapez-Vorstand (cm); überschreibt panel.taperDepth. */
  taperDepth?: number
  /** Trapez-Faktor; überschreibt panel.taper. */
  taper?: number
  /** Zurückgesetzte Ebene (Z-Fighting polygonOffset). */
  recessed?: boolean
  /** Schräge Kante für diagonalen Läuferverband. */
  shearX?: number
  /**
   * Dock-Fuge 1+1: Bossen-Chamfer an dieser Seite behalten
   * (nicht wie 0,5+0,5 die Innenseite auf Chamfer 0 setzen).
   */
  keepBossChamferStart?: boolean
  keepBossChamferEnd?: boolean
  /**
   * Dock-Fuge 0,5+0,5: Innenseiten-Trapez auf 0 — visuell ein Stein.
   * Die Kachel bleibt in der eigenen Wand (kein Überstand).
   */
  flattenDockStart?: boolean
  flattenDockEnd?: boolean
}

const MIN_TILE = 0.05
const CLIP_EPS = 0.05
/** Nicht über ganze Felder zwischen zwei Fenstern ziehen — nur Rest an der Laibung. */
/** Nicht über ganze Felder zwischen zwei Fenstern ziehen — nur echte Raster-Lücken (≤ 8 cm). */
const MAX_JAMB_SEAL = STUDIO_MASONRY
/** Harte Obergrenze gegen Endlosschleifen (0-Schritt, NaN, riesige Wände). */
const MAX_CUTS = 512
/** Längste Dock-Kette, entlang der ein Wandanfang dem Vorgänger-Ende folgt. */
const MAX_DOCK_CHAIN = 12

type BrickKind = 'S' | 'H'

/** Binder-Kopf: halbe Läuferlänge, mindestens Rastermaß. */
function headerSize(stretcher: number): number {
  return Math.max(STUDIO_MASONRY, stretcher / 2)
}

/** Versatz zwischen Schichten — siehe Wikipedia/BauNetz (Mauerwerksverband). */
type CourseOffset =
  | 'halfStretcher' /** Läuferverband mittler: ½ Steinlänge */
  | 'halfHeader' /** Kopfverband / Zierverbände: ½ Binderbreite */
  | 'halfUnit' /** Flämisch: ½ Kopf + ½ Stein = (S+H)/2 */
  | 'shiftHeader' /** Kreuzverband: Verschiebekopf = 1 Binderbreite */
  | 'third' /** Schleppender Läuferverband: ⅓ Steinlänge */
  | 'quarter' /** Schleppender Läuferverband: ¼ Steinlänge */

interface CourseSpec {
  sequence?: BrickKind[]
  brickW?: number
  offset?: CourseOffset
  stretcher?: boolean
}

function courseSpec(
  pattern: StudioPanelPattern,
  rowIndex: number,
  stretcher: number,
): CourseSpec {
  const header = headerSize(stretcher)
  switch (pattern) {
    case 'runningBond':
      return {
        brickW: stretcher,
        offset: rowIndex % 2 === 1 ? 'halfStretcher' : undefined,
        stretcher: true,
      }
    case 'runningBondThird':
      return {
        brickW: stretcher,
        offset: rowIndex % 3 !== 0 ? 'third' : undefined,
        stretcher: true,
      }
    case 'runningBondQuarter':
      return {
        brickW: stretcher,
        offset: rowIndex % 4 !== 0 ? 'quarter' : undefined,
        stretcher: true,
      }
    case 'runningBondDiagonal':
      return {
        brickW: stretcher,
        offset: rowIndex % 4 !== 0 ? 'quarter' : undefined,
        stretcher: true,
      }
    case 'headerBond':
      return {
        brickW: header,
        offset: rowIndex % 2 === 1 ? 'halfHeader' : undefined,
        stretcher: false,
      }
    case 'englishBond':
      return {
        brickW: rowIndex % 2 === 0 ? stretcher : header,
        stretcher: rowIndex % 2 === 0,
      }
    case 'englishCrossBond':
      return {
        brickW: rowIndex % 2 === 0 ? stretcher : header,
        offset:
          rowIndex % 2 === 0 && Math.floor(rowIndex / 2) % 2 === 1 ? 'shiftHeader' : undefined,
        stretcher: rowIndex % 2 === 0,
      }
    case 'gothicBond':
      return {
        sequence: rowIndex % 2 === 0 ? ['H', 'S'] : ['S', 'H'],
        offset: rowIndex % 2 === 1 ? 'halfHeader' : undefined,
      }
    case 'markishBond':
      return {
        sequence: ['S', 'S', 'H'],
        offset: rowIndex % 2 === 1 ? 'halfHeader' : undefined,
      }
    case 'silesianBond':
      return {
        sequence: ['S', 'S', 'S', 'H'],
        offset: rowIndex % 2 === 1 ? 'halfHeader' : undefined,
      }
    case 'flemishBond':
      return {
        sequence: rowIndex % 2 === 0 ? ['S', 'H'] : ['H', 'S'],
        offset: 'halfUnit',
      }
    case 'dutchBond': {
      const cycle = rowIndex % 4
      if (cycle < 3) {
        return {
          brickW: header,
          offset: cycle === 1 ? 'halfHeader' : undefined,
          stretcher: false,
        }
      }
      return { sequence: ['S', 'H'], stretcher: true }
    }
    default:
      return { brickW: stretcher, stretcher: true }
  }
}

function resolveOffset(
  offset: CourseSpec['offset'],
  stretcher: number,
  header: number,
  rowIndex: number,
): number | undefined {
  if (offset === undefined) return undefined
  switch (offset) {
    case 'halfStretcher':
      return stretcher / 2
    case 'halfHeader':
      return header / 2
    case 'halfUnit':
      return (stretcher + header) / 2
    case 'shiftHeader':
      return header
    case 'third':
      return ((rowIndex % 3) * stretcher) / 3
    case 'quarter':
      return ((rowIndex % 4) * stretcher) / 4
    default:
      return undefined
  }
}

/** Schnitte von 0 bis `length`. Winzige Reste am Ende werden mit der vorherigen Kachel verschmolzen. */
function buildCuts(
  length: number,
  step: number,
  firstInterior: number | undefined,
  minLast: number,
): number[] {
  if (!Number.isFinite(length) || length <= MIN_TILE) return [0, Math.max(0, length)]
  if (!Number.isFinite(step) || step <= MIN_TILE) return [0, length]
  const cuts: number[] = [0]
  if (
    firstInterior !== undefined &&
    firstInterior > MIN_TILE &&
    firstInterior < length - minLast
  ) {
    cuts.push(firstInterior)
  }
  const start = firstInterior ?? 0
  for (let pos = start + step, n = 0; pos < length - minLast && n < MAX_CUTS; pos += step, n += 1) {
    cuts.push(pos)
  }
  cuts.push(length)
  if (cuts.length >= 3 && cuts[cuts.length - 1] - cuts[cuts.length - 2] <= minLast) {
    cuts.splice(cuts.length - 2, 1)
  }
  return cuts
}

type XSpan = { x0: number; x1: number }

/**
 * Rastereinheit des Verbands: kleinste Stein-Teilbreite, die im Muster vorkommt
 * (½ Läufer, ⅓, ¼, ½ Binder). Alle Lagen einer Wand nutzen dieselbe Einheit —
 * sonst driften die Stoßfugen zwischen den Lagen. `null` = kein Raster (wild).
 */
export function patternModuleUnit(
  pattern: StudioPanelPattern,
  stretcher: number,
  header: number,
): number | null {
  switch (pattern) {
    case 'runningBondThird':
      return stretcher / 3
    case 'runningBondQuarter':
    case 'runningBondDiagonal':
      return stretcher / 4
    case 'headerBond':
    case 'englishBond':
    case 'englishCrossBond':
    case 'gothicBond':
    case 'markishBond':
    case 'silesianBond':
    case 'flemishBond':
    case 'dutchBond':
      return header / 2
    case 'wildBond':
      return null
    default:
      return stretcher / 2
  }
}

/**
 * Vielfaches, in dem die Feldlänge in Einheiten aufgehen muss. Verbände mit Läufer-
 * **und** Binderlagen (Einheit ½ Binder) brauchen eine gerade Einheitenzahl — sonst
 * endet die Läuferlage mit einem ¼-Stein statt mit 1 / 0,5.
 */
export function patternModuleGranularity(
  pattern: StudioPanelPattern,
  stretcher: number,
  header: number,
): number {
  switch (pattern) {
    case 'englishBond':
    case 'englishCrossBond':
    case 'gothicBond':
    case 'markishBond':
    case 'silesianBond':
    case 'flemishBond':
    case 'dutchBond': {
      const unit = patternModuleUnit(pattern, stretcher, header)
      if (unit == null || unit <= MIN_TILE) return 1
      return Math.max(1, Math.round(stretcher / 2 / unit))
    }
    default:
      return 1
  }
}

/**
 * Eine Lage im Modulraster: das Feld ist N Einheiten lang (Steine minimal gedehnt oder
 * gestaucht, damit es exakt aufgeht), ein Stein = k Einheiten, Endstücke ganze
 * Einheiten (½ Stein, ⅓, ¼ …) — nie 1,5er oder Splitter. Die inneren Fugen liegen auf
 * dem Lagen-Raster `phase + j·k`; der Versatz zur Nachbarlage bleibt dadurch exakt.
 *
 * `startForce`/`endForce` (cm): erzwungene Endsteine (Ecke Verband, 45°-Ecke, Bossen).
 * `startAlt` = die erzwungene Breite wechselt selbst je Lage und gibt die Phase vor
 * (kein zusätzlicher Halbstein dahinter).
 */
export function moduleCourseCuts(
  length: number,
  step: number,
  unit: number,
  phaseW: number,
  startForce: number | null = null,
  startAlt = false,
  endForce: number | null = null,
  endAlt = false,
  /** Einheitenzahl des Feldes auf dieses Vielfache runden (Läufer+Binder-Verbände: 2). */
  nMultiple = 1,
): number[] {
  if (!Number.isFinite(length) || length <= MIN_TILE) return [0, Math.max(length, 0)]
  if (step <= MIN_TILE || unit <= MIN_TILE) return [0, length]
  const k = Math.max(1, Math.round(step / unit))
  const m = Math.max(1, Math.round(nMultiple))
  const n = Math.max(m, Math.round(length / (unit * m)) * m)
  const u = length / n
  const toUnits = (w: number | null) =>
    w != null && w > MIN_TILE ? Math.max(1, Math.round(w / unit)) : 0
  let sF = toUnits(startForce)
  let eF = toUnits(endForce)
  if (sF >= n) sF = 0
  if (eF >= n) eF = 0
  if (sF + eF >= n) {
    const cuts = sF > 0 && eF > 0 ? [0, sF * u, length] : [0, length]
    return uniqueSortedCuts(cuts, length)
  }

  const phaseUnits = Math.round(Math.max(0, phaseW) / unit) % k
  let phase: number
  if (sF > 0) phase = startAlt ? sF % k : (sF + phaseUnits) % k
  else phase = phaseUnits

  const cuts: number[] = [0]
  if (sF > 0) cuts.push(sF)
  const endBound = n - eF
  let g = phase
  while (g <= sF) g += k
  let lastGrid = sF
  while (g < endBound) {
    cuts.push(g)
    lastGrid = g
    g += k
  }
  const remnant = endBound - lastGrid
  if (eF > 0 && endAlt && remnant > 0 && remnant < k) {
    // Kein Reststück direkt vor einem lagenweise wechselnden Endstein (45°-Ecke, Dock):
    // Endbreiten exakt, das Feld nur volle Steine — minimal gedehnt. Start + Ende haben
    // je Lage dieselbe Einheiten-Parität, darum bleibt die Dehnung lagenübergreifend gleich.
    const seq: number[] = []
    if (sF > 0) seq.push(sF)
    const lead = sF > 0 && startAlt ? 0 : phaseUnits
    if (lead > 0) seq.push(lead)
    const used = seq.reduce((a, b) => a + b, 0) + eF
    const fulls = Math.max(0, Math.round((n - used) / k))
    for (let i = 0; i < fulls; i += 1) seq.push(k)
    seq.push(eF)
    const total = seq.reduce((a, b) => a + b, 0)
    const scale = length / total
    const out: number[] = [0]
    let pos = 0
    for (const w of seq) {
      pos += w
      out.push(pos * scale)
    }
    return uniqueSortedCuts(out, length)
  }
  if (eF > 0) cuts.push(endBound)
  cuts.push(n)
  return uniqueSortedCuts(
    cuts.map((c) => c * u),
    length,
  )
}

/**
 * Pfeiler-Felder einer Lage: nur die Mauer **zwischen** den Laibungen
 * (Wandanfang ↔ Laibung ↔ Laibung ↔ Wandende). Die Öffnung selbst ist kein Feld —
 * Steine dort würden nur skaliert und später verworfen.
 */
function courseFields(
  length: number,
  blockers: XSpan[],
): Array<{ x0: number; x1: number; first: boolean; last: boolean }> {
  const spans = blockers
    .map((b) => ({
      x0: Math.max(0, Math.min(b.x0, b.x1)),
      x1: Math.min(length, Math.max(b.x0, b.x1)),
    }))
    .filter((b) => b.x1 - b.x0 > MIN_TILE)
    .sort((a, b) => a.x0 - b.x0)
  const fields: Array<{ x0: number; x1: number }> = []
  let cursor = 0
  for (const b of spans) {
    if (b.x0 - cursor > MIN_TILE) fields.push({ x0: cursor, x1: b.x0 })
    cursor = Math.max(cursor, b.x1)
  }
  if (length - cursor > MIN_TILE) fields.push({ x0: cursor, x1: length })
  return fields.map((f) => ({
    ...f,
    first: f.x0 <= MIN_TILE,
    last: f.x1 >= length - MIN_TILE,
  }))
}

/**
 * Wandweites Verband-Raster auf ein Pfeiler-Feld schneiden: innere Fugen bleiben auf
 * dem globalen Raster (gleichmäßig über die ganze Wand), Endstücke an der Laibung
 * nehmen den Rest bis x0/x1.
 */
function pierceWallCutsToField(wallCuts: number[], fieldX0: number, fieldX1: number): number[] {
  const len = fieldX1 - fieldX0
  if (len <= MIN_TILE) return [0, Math.max(0, len)]
  const local: number[] = [0]
  for (const c of wallCuts) {
    if (c > fieldX0 + MIN_TILE && c < fieldX1 - MIN_TILE) local.push(c - fieldX0)
  }
  local.push(len)
  return uniqueSortedCuts(local, len)
}

/**
 * Stummel an der Laibung (Öffnung nicht auf dem Halbstein-Raster) mit dem
 * Nachbarstein verschmelzen. Kleinster sinnvoller Ankerstein = Verbandmodul
 * (Läufer: ½ Stein). Halbsteine an Wandende und Versatzlage bleiben.
 */
function absorbJambSlivers(
  cuts: number[],
  minCloser: number,
  edges: { start: boolean; end: boolean },
): number[] {
  if (cuts.length < 3 || minCloser <= MIN_TILE) return cuts
  const out = [...cuts]
  if (edges.start && out[1]! - out[0]! < minCloser - MIN_TILE) out.splice(1, 1)
  if (edges.end && out.length >= 3 && out[out.length - 1]! - out[out.length - 2]! < minCloser - MIN_TILE) {
    out.splice(out.length - 2, 1)
  }
  return out
}

/**
 * Gerade Läuferlage: volle Steine exakt `step` ab x=0; Restbreite nur am **Ende**.
 * So bleiben Fugen bei 24er- und 48er-Modul auf demselben Raster (Vielfache),
 * statt durch symmetrische End-Aufweitung gegeneinander zu laufen.
 */
function buildStretcherCuts(length: number, step: number): number[] {
  if (length <= MIN_TILE) return [0, Math.max(length, 0)]
  if (step <= MIN_TILE) return [0, length]
  const n = Math.max(1, Math.floor((length + MIN_TILE) / step))
  if (n === 1) return [0, length]
  const cuts: number[] = [0]
  for (let i = 1; i <= n; i += 1) {
    const x = i * step
    if (x >= length - MIN_TILE) break
    cuts.push(x)
  }
  cuts.push(length)
  return uniqueSortedCuts(cuts, length)
}

/**
 * Versatzlage: Startstück `firstW` (½/⅓/¼), dann volle Läufer exakt `step`,
 * Restbreite nur am Ende — gleiche Phasenlage wie die Gerade ab x=0.
 */
function buildOffsetStretcherCuts(length: number, step: number, firstW = step / 2): number[] {
  if (length <= MIN_TILE) return [0, Math.max(length, 0)]
  if (step <= MIN_TILE) return [0, length]
  const startW = Math.min(Math.max(firstW, MIN_TILE), step - MIN_TILE)
  if (length <= startW + MIN_TILE) return [0, length]
  if (length <= startW * 2 + MIN_TILE) return [0, length / 2, length]
  const cuts: number[] = [0, startW]
  let x = startW
  while (x + step < length - MIN_TILE) {
    x += step
    cuts.push(x)
  }
  cuts.push(length)
  return uniqueSortedCuts(cuts, length)
}

/** Versatz in eine Endstückbreite im offenen Intervall (0, step) wickeln. */
function courseEndWidth(offset: number | undefined, step: number): number | undefined {
  if (offset === undefined || !Number.isFinite(offset) || step <= MIN_TILE) return undefined
  const wrapped = ((offset % step) + step) % step
  if (wrapped <= MIN_TILE || step - wrapped <= MIN_TILE) return undefined
  return wrapped
}

/** Gemischte Steinfolge S=Läufer, H=Binder in einer Lage. */
export function buildMixedCourseCuts(
  length: number,
  stretcher: number,
  header: number,
  sequence: BrickKind[],
  rowOffset = 0,
): number[] {
  if (sequence.length === 0) return buildStretcherCuts(length, stretcher)
  const unit = sequence.reduce((sum, kind) => sum + (kind === 'S' ? stretcher : header), 0)
  if (unit <= MIN_TILE) return [0, length]

  const cuts: number[] = [0]
  let pos = ((rowOffset % unit) + unit) % unit
  if (pos > MIN_TILE && pos < length - MIN_TILE) cuts.push(pos)

  let guard = 0
  while (pos < length - MIN_TILE && guard < MAX_CUTS) {
    guard += 1
    const prevPos = pos
    for (const kind of sequence) {
      const step = kind === 'S' ? stretcher : header
      if (!Number.isFinite(step) || step <= MIN_TILE) break
      if (pos + step >= length - MIN_TILE) break
      pos += step
      if (pos > MIN_TILE && pos < length - MIN_TILE) cuts.push(pos)
    }
    if (pos === prevPos || pos >= length - MIN_TILE) break
  }
  cuts.push(length)

  if (cuts.length >= 3 && cuts[cuts.length - 1] - cuts[cuts.length - 2] <= MIN_TILE) {
    cuts.splice(cuts.length - 2, 1)
  }
  return cuts
}

export function isCollinearDock(wall: Wall, adj: Wall | undefined): boolean {
  if (!adj) return false
  const norm = (deg: number) => ((deg % 360) + 360) % 360
  const a = norm(wall.yawDeg ?? 0)
  const b = norm(adj.yawDeg ?? 0)
  const diff = Math.abs(a - b)
  return diff < 2 || Math.abs(diff - 180) < 2
}

export { findCollinearDockWall } from './walls'

const DOCK_SMALL_STONE_MAX = 0.49

function firstSegmentWidth(colCuts: number[]): number {
  if (colCuts.length < 2) return 0
  return colCuts[1]! - colCuts[0]!
}

function lastSegmentWidth(colCuts: number[]): number {
  if (colCuts.length < 2) return 0
  return colCuts[colCuts.length - 1]! - colCuts[colCuts.length - 2]!
}

function yawDeltaAbsDeg(a: number, b: number): number {
  const delta = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(delta, 360 - delta)
}

function isDiagonalTurn(wall: Wall, adj: Wall): boolean {
  const d = yawDeltaAbsDeg(wall.yawDeg ?? 0, adj.yawDeg ?? 0)
  return Math.abs(d - 45) < 10 || Math.abs(d - 135) < 10
}

function snapMasonryCm(value: number): number {
  return Math.max(STUDIO_MASONRY, Math.round(value / STUDIO_MASONRY) * STUDIO_MASONRY)
}

/**
 * Front minus Plan an einem Ende (cm), gemessen an der Endkante.
 * Positiv = Front länger als die Plan-Kante.
 */
export function frontMiterLengthenCm(wall: Wall, end: 'start' | 'end'): number {
  const z = studioPanelFaceLocalZ(wall)
  const halfW = wall.width / 2
  if (end === 'start') {
    return -halfW - studioMiterLocalX(wall, 0, z, true, true)
  }
  return studioMiterLocalX(wall, wall.width, z, true, true) - halfW
}

function yawDeg360(yaw: number): number {
  return ((yaw % 360) + 360) % 360
}

/**
 * Welche Wand an einer 45°-Ecke in geraden Lagen den 0,5-Stein bekommt.
 * Plan-stabil (Yaw, dann Origin) — nicht `wall.id`: neue UUIDs nach
 * Etage-Duplizieren / Stil-Kopie würden sonst 0,5 und 1 tauschen.
 */
function diagonalBondWallIsFirst(wall: Wall, adj: Wall): boolean {
  const yawA = yawDeg360(wall.yawDeg ?? 0)
  const yawB = yawDeg360(adj.yawDeg ?? 0)
  if (Math.abs(yawA - yawB) > 0.05) return yawA < yawB
  const ax = wall.originX ?? wall.x
  const az = wall.originZ ?? 0
  const bx = adj.originX ?? adj.x
  const bz = adj.originZ ?? 0
  if (Math.abs(ax - bx) > 0.05) return ax < bx
  if (Math.abs(az - bz) > 0.05) return az < bz
  return wall.width < adj.width
}

/**
 * An 45°-Ecken: komplementär 0,5 und 1 Stein auf der **Front** (pro Lage getauscht).
 * Halbstein = exakt ½ des (ggf. gerasterten) Läufers — nicht `snapMasonryCm(header)`:
 * bei 24 cm würde 12 auf 16 snappen und der Versatz auf ~⅓ abrutschen.
 */
function diagonalBondEndWidth(
  wall: Wall,
  adj: Wall,
  panel: StudioPanelConfig,
  rowIndex: number,
): number {
  const full = snapMasonryCm(panel.panelWidth)
  const header = full / 2
  const aFirst = diagonalBondWallIsFirst(wall, adj)
  const even = rowIndex % 2 === 0
  return aFirst === even ? header : full
}

function mapFrontCutsToPlan(
  wall: Wall,
  frontCuts: number[],
  faceZ: number,
  miter: { start: boolean; end: boolean },
): number[] {
  const halfW = wall.width / 2
  const x0 = studioMiterLocalX(wall, 0, faceZ, miter.start, miter.end)
  const mapped = frontCuts.map((c) => x0 + c + halfW)
  if (mapped.length === 0) return [0, wall.width]
  return uniqueSortedCuts(mapped, mapped[mapped.length - 1]!, mapped[0]!)
}

function uniqueSortedCuts(cuts: number[], end: number, start = 0): number[] {
  const next = [...new Set(cuts.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b)
  if (next.length === 0 || Math.abs(next[0]! - start) > 0.0005) next.unshift(Math.round(start * 1000) / 1000)
  if (next.length === 0 || Math.abs(next[next.length - 1]! - end) > 0.0005) {
    next.push(Math.round(end * 1000) / 1000)
  }
  if (next.length >= 3 && next[next.length - 1]! - next[next.length - 2]! <= MIN_TILE) {
    next.splice(next.length - 2, 1)
  }
  return next
}

/**
 * Läuferverband mit Forced-Enden (z. B. 45° komplementär 0,5/1).
 * Endbreiten bleiben exakt; das Feld dazwischen nur volle Läufer
 * (Restbreite gleichmäßig auf die Feldsteine). Kein zusätzlicher
 * Halbstein nach dem Forced-Start — der Versatz steckt schon in den Enden.
 *
 * Freies Ende: natürliche Phase (1 bzw. 0,5). Beide Forced-Enden bzw.
 * Forced+Natur müssen je Lage dieselbe Summenbreite haben (0,5+1 = 1+0,5),
 * sonst driftet die Feldsteinbreite und der Versatz von 0,5 weg.
 */
function buildRunningBondWithForcedEnds(
  length: number,
  step: number,
  offset: number | undefined,
  startForce: number | null,
  endForce: number | null,
): number[] {
  if (length <= MIN_TILE) return [0, Math.max(length, 0)]
  if (step <= MIN_TILE) return [0, length]
  const natural = courseEndWidth(offset, step) ?? step
  const clampEnd = (w: number) => Math.min(Math.max(w, MIN_TILE), length * 0.49)
  const startW = clampEnd(
    startForce != null && startForce > MIN_TILE ? startForce : natural,
  )
  const endW = clampEnd(endForce != null && endForce > MIN_TILE ? endForce : natural)
  if (startW + endW >= length - MIN_TILE) return [0, length / 2, length]
  const field = length - startW - endW
  if (field <= MIN_TILE) return uniqueSortedCuts([0, startW, length - endW, length], length)
  // Gleiche Feldsteinbreite über alle Lagen: n aus Soll-step, brick = field/n.
  const n = Math.max(1, Math.round(field / step))
  const brick = field / n
  const cuts: number[] = [0, startW]
  for (let i = 1; i < n; i += 1) cuts.push(startW + i * brick)
  cuts.push(length - endW)
  cuts.push(length)
  return uniqueSortedCuts(cuts, length)
}

function wrapSequenceForcedEnds(
  cuts: number[],
  length: number,
  startW: number | null,
  endW: number | null,
): number[] {
  const useStart = startW != null && startW > MIN_TILE && startW < length - MIN_TILE
  const useEnd = endW != null && endW > MIN_TILE && endW < length - MIN_TILE
  if (!useStart && !useEnd) return cuts
  const startBound = useStart ? startW! : 0
  const endBound = useEnd ? length - endW! : length
  const interior = cuts.filter((c) => c > startBound + MIN_TILE && c < endBound - MIN_TILE)
  const next = [0]
  if (useStart) next.push(startBound)
  next.push(...interior)
  if (useEnd) next.push(endBound)
  next.push(length)
  return next
}

function isFullStoneWidth(width: number, panelWidth: number): boolean {
  return width >= panelWidth - 1
}

function isSmallStoneWidth(width: number, panelWidth: number): boolean {
  return width > MIN_TILE && width < panelWidth * DOCK_SMALL_STONE_MAX
}

/**
 * Binder-Kopf (~½ Läufer) an der Dock-Fuge.
 * Versatzlagen verteilen Restbreite auf beide Enden — deshalb nicht nur ±1,5 cm um headerSize,
 * sonst bleiben echte 0,5er mit ein paar cm Überhang getrennt.
 * Nicht Reststein (<0,49) und nicht voller 1er.
 */
function isHalfStoneWidth(width: number, panelWidth: number): boolean {
  if (isFullStoneWidth(width, panelWidth)) return false
  if (isSmallStoneWidth(width, panelWidth)) return false
  const header = headerSize(panelWidth)
  if (header >= panelWidth - 1) return false
  return width <= panelWidth * 0.75 + 0.5
}

type DockRowTileOpts = {
  /** 0,5+0,5: Kachel bündig an der Fuge, Chamfer der Innenseite 0. */
  flattenStart?: boolean
  flattenEnd?: boolean
  /** 1+1: normale Mörtelfuge plus volles Bossen-Trapez. */
  jointStart?: boolean
  jointEnd?: boolean
}

function dockHalfHalfMerge(
  adjW: number,
  ourW: number,
  adjPanelWidth: number,
  panelWidth: number,
): boolean {
  return isHalfStoneWidth(adjW, adjPanelWidth) && isHalfStoneWidth(ourW, panelWidth)
}

function dockHalfMergeAtJoint(
  adjEndPattern: EndBossPattern | undefined,
  ourPattern: EndBossPattern | undefined,
  rowIndex: number,
  adjPanelWidth: number,
  panelWidth: number,
  header: number,
): boolean {
  if (!adjEndPattern || adjEndPattern === 'off' || !ourPattern || ourPattern === 'off') return false
  const adjHeader = headerSize(adjPanelWidth)
  const adjEndW = endBossStoneWidth(adjEndPattern, rowIndex, adjPanelWidth, adjHeader)
  const ourW = endBossStoneWidth(ourPattern, rowIndex, panelWidth, header)
  if (adjEndW !== header || ourW !== header) return false
  if (adjEndPattern === 'full' || ourPattern === 'full') return false
  if (header >= panelWidth - MIN_TILE) return false
  return true
}

function endBossStoneWidth(
  pattern: EndBossPattern,
  rowIndex: number,
  panelWidth: number,
  header: number,
): number | null {
  if (pattern === 'off') return null
  if (pattern === 'full') return panelWidth
  if (pattern === 'half') return header
  return rowIndex % 2 === 0 ? panelWidth : header
}

function buildCourseCuts(
  length: number,
  step: number,
  offset: number | undefined,
  cornerStart: boolean,
  cornerEnd: boolean,
  headerW: number,
): number[] {
  if (!cornerStart && !cornerEnd) {
    const endW = courseEndWidth(offset, step)
    return endW !== undefined
      ? buildOffsetStretcherCuts(length, step, endW)
      : buildStretcherCuts(length, step)
  }

  const minLast = MIN_TILE
  const startBound = cornerStart ? headerW : 0
  const endBound = cornerEnd ? length - headerW : length
  const field = endBound - startBound

  if (field <= MIN_TILE) {
    return buildCuts(length, step, offset, minLast)
  }

  const cuts: number[] = [0]
  if (cornerStart && headerW > MIN_TILE && headerW < length - MIN_TILE) {
    cuts.push(headerW)
  }

  const fieldEndW = courseEndWidth(offset, step)
  const fieldCuts =
    fieldEndW !== undefined
      ? buildOffsetStretcherCuts(field, step, fieldEndW)
      : buildStretcherCuts(field, step)
  for (let i = 1; i < fieldCuts.length - 1; i += 1) {
    cuts.push(startBound + fieldCuts[i])
  }

  if (cornerEnd && headerW > MIN_TILE && length - headerW > MIN_TILE) {
    const endCut = length - headerW
    if (endCut - cuts[cuts.length - 1] > MIN_TILE) {
      cuts.push(endCut)
    }
  }

  cuts.push(length)
  if (cuts.length >= 3 && cuts[cuts.length - 1] - cuts[cuts.length - 2] <= MIN_TILE) {
    cuts.splice(cuts.length - 2, 1)
  }
  return cuts
}

function computeRowColCuts(
  wall: Wall,
  panel: StudioPanelConfig,
  rowIndex: number,
  allWalls: Wall[],
  bondCornerW: number,
  /** Laibungskörper dieser Zeile (Plan-X) — Felder werden getrennt im Modulraster gelegt. */
  blockers: XSpan[] = [],
  /** Rekursionstiefe entlang einer Dock-Kette (Start folgt dem Ende des Vorgängers). */
  depth = 0,
): number[] {
  panel = normalizeStudioPanel(panel)
  const { panelWidth, pattern, cornerJoin } = panel
  const header = headerSize(panelWidth)
  const bondCorners = cornerJoin === 'bond'
  const startAdj = findCollinearDockWall(wall, 'start', allWalls)
  const endAdj = findCollinearDockWall(wall, 'end', allWalls)
  const hasStartCorner = bondCorners && Boolean(startAdj && wallHasPanels(startAdj))
  const hasEndCorner = bondCorners && Boolean(endAdj && wallHasPanels(endAdj))

  const spec = courseSpec(pattern, rowIndex, panelWidth)
  const offset = resolveOffset(spec.offset, panelWidth, header, rowIndex)
  const stretcherCourse = spec.stretcher !== false
  const startTurn = turningAdjacentWalls(wall, 'start', allWalls)
  const endTurn = turningAdjacentWalls(wall, 'end', allWalls)
  const startDiag = startTurn.find((adj) => wallHasPanels(adj) && isDiagonalTurn(wall, adj))
  const endDiag = endTurn.find((adj) => wallHasPanels(adj) && isDiagonalTurn(wall, adj))
  const cornerStart = bondCorners && hasStartCorner && stretcherCourse && !startDiag
  const cornerEnd = bondCorners && hasEndCorner && stretcherCourse && !endDiag

  const miters = panelMiterEnds(wall, allWalls)
  const taper = Math.max(0, panel.taperDepth ?? 0)
  const faceZ = studioPanelFaceLocalZ(wall) + taper * studioWindowDepthForwardSign(wall)
  const faceLeft = studioMiterLocalX(wall, 0, faceZ, miters.start, miters.end)
  const faceRight = studioMiterLocalX(wall, wall.width, faceZ, miters.start, miters.end)
  const faceLen = Math.max(MIN_TILE, faceRight - faceLeft)
  // Front-Layout nur wenn die sichtbare Front LÄNGER ist als der Plan
  // (Innen-Origin / Keilzone). Bei Außenkante + projectDepth ist faceLen kürzer —
  // Raster bleibt auf wall.width, sonst Stummel und zerstörter Verband.
  const useFrontLayout =
    (miters.start || miters.end || Boolean(startDiag) || Boolean(endDiag)) &&
    faceLen > wall.width + 0.5
  const layoutLen = useFrontLayout ? faceLen : wall.width
  const halfW = wall.width / 2
  const planToLayout = (x: number) => (useFrontLayout ? x - (faceLeft + halfW) : x)

  const brickW = spec.brickW ?? panelWidth
  const unit = patternModuleUnit(pattern, panelWidth, header)
  const granularity = patternModuleGranularity(pattern, panelWidth, header)
  const endDock = Boolean(endAdj && isCollinearDock(wall, endAdj) && wallHasPanels(endAdj))

  // Erzwungene Endsteine (Layout-cm). 45°-Knick und „abwechselnd“ wechseln selbst je
  // Lage (geben die Phase vor); Ecke Verband und feste Bossen sind konstant.
  // 90°-Gehrung / Außenkante: natürlicher Verband, keine Forced-Ends (Stummel).
  let startForce: number | null = null
  let startAlt = false
  let endForce: number | null = null
  let endAlt = false
  if (startDiag) {
    startForce = diagonalBondEndWidth(wall, startDiag, panel, rowIndex)
    startAlt = true
  } else if (cornerStart) {
    startForce = bondCornerW
  } else if (!startAdj && startTurn.length === 0 && panel.endBossStart && panel.endBossStart !== 'off') {
    startForce = endBossStoneWidth(panel.endBossStart, rowIndex, panelWidth, header)
    startAlt = panel.endBossStart === 'alternate'
  } else if (
    startAdj &&
    isCollinearDock(wall, startAdj) &&
    wallHasPanels(startAdj) &&
    depth < MAX_DOCK_CHAIN
  ) {
    // Dock-Kette: unser erster Stein spiegelt den letzten des Vorgängers (0,5+0,5 wird
    // visuell ein Stein, 1+1 eine Fuge) — so wechselt die Fuge an der Dock-Naht je Lage
    // statt in jeder Lage übereinander zu stehen.
    const adjPanel = normalizeStudioPanel(startAdj.panel ?? DEFAULT_STUDIO_PANEL)
    const adjCuts = rowColCutsWithOpenings(startAdj, adjPanel, rowIndex, allWalls, bondCornerW, depth + 1)
    const adjEndW = lastSegmentWidth(adjCuts)
    if (adjEndW > MIN_TILE) {
      startForce = adjEndW
      startAlt = true
    }
  }
  if (endDiag) {
    endForce = diagonalBondEndWidth(wall, endDiag, panel, rowIndex)
    endAlt = true
  } else if (cornerEnd) {
    endForce = bondCornerW
  } else if (!endAdj && endTurn.length === 0 && panel.endBossEnd && panel.endBossEnd !== 'off') {
    endForce = endBossStoneWidth(panel.endBossEnd, rowIndex, panelWidth, header)
    endAlt = panel.endBossEnd === 'alternate'
  }

  const fields = courseFields(
    layoutLen,
    blockers.map((b) => ({ x0: planToLayout(b.x0), x1: planToLayout(b.x1) })),
  )

  // Wandweites Verbandmuster (klassisch 1/1/1 bzw. 0,5/1/…/0,5) — Fugen bleiben
  // über alle Pfeiler hinweg auf demselben Raster. Pro Feld nur an der Laibung
  // abschneiden; Ecken/Dock-Forced-Ends greifen am ersten/letzten Feld.
  let wallPatternCuts: number[] | null = null
  if (!spec.sequence && unit != null) {
    if (startForce != null || endForce != null) {
      // Forced-Ends (45°, Dock, Bossen): freie Seite = natürlicher Verband (1 bzw. 0,5),
      // Forced-Ende exakt. Beide Enden gesetzt → komplementär 0,5/1.
      wallPatternCuts = buildRunningBondWithForcedEnds(
        layoutLen,
        brickW,
        offset,
        startForce,
        endForce,
      )
    } else if (endDock) {
      const phaseW = courseEndWidth(offset, brickW)
      const fromEnd =
        phaseW !== undefined
          ? buildOffsetStretcherCuts(layoutLen, brickW, phaseW)
          : buildStretcherCuts(layoutLen, brickW)
      wallPatternCuts = fromEnd.map((c) => layoutLen - c).reverse()
    } else {
      const phaseW = courseEndWidth(offset, brickW)
      wallPatternCuts =
        phaseW !== undefined
          ? buildOffsetStretcherCuts(layoutLen, brickW, phaseW)
          : buildStretcherCuts(layoutLen, brickW)
    }
  }

  const merged: number[] = [0]
  for (const field of fields) {
    const len = field.x1 - field.x0
    const sF = field.first ? startForce : null
    const eF = field.last ? endForce : null
    let cuts: number[]
    if (spec.sequence) {
      const raw = buildMixedCourseCuts(len, panelWidth, header, spec.sequence, offset ?? 0)
      cuts = wrapSequenceForcedEnds(raw, len, sF, eF)
    } else if (unit == null) {
      cuts = buildCourseCuts(len, brickW, offset, sF != null, eF != null, bondCornerW)
    } else if (wallPatternCuts) {
      cuts = pierceWallCutsToField(wallPatternCuts, field.x0, field.x1)
      if (unit != null) {
        cuts = absorbJambSlivers(cuts, unit, { start: !field.first, end: !field.last })
      }
    } else {
      const phaseW = courseEndWidth(offset, brickW) ?? brickW
      cuts = moduleCourseCuts(len, brickW, unit, phaseW, sF, startAlt, eF, endAlt, granularity)
    }
    // Feldanfang mit aufnehmen — sonst fehlt die Laibungs-Kante und der nächste
    // Stein wird über die Öffnung hinweg bis zum ersten Rasterpunkt gelegt.
    if (field.x0 > MIN_TILE) merged.push(field.x0)
    for (let i = 1; i < cuts.length; i += 1) merged.push(field.x0 + cuts[i]!)
  }
  let colCuts = uniqueSortedCuts(merged, layoutLen)

  if (useFrontLayout) {
    colCuts = mapFrontCutsToPlan(wall, colCuts, faceZ, miters)
  }

  if (startAdj && isCollinearDock(wall, startAdj)) {
    const adjPanel = normalizeStudioPanel(startAdj.panel ?? DEFAULT_STUDIO_PANEL)
    if (
      dockHalfMergeAtJoint(
        adjPanel.endBossEnd,
        panel.endBossStart,
        rowIndex,
        adjPanel.panelWidth,
        panelWidth,
        header,
      )
    ) {
      if (colCuts.length >= 2 && colCuts[1]! <= header + MIN_TILE) {
        colCuts[1] = header
      }
    }
  }
  if (endAdj && isCollinearDock(wall, endAdj)) {
    const adjPanel = normalizeStudioPanel(endAdj.panel ?? DEFAULT_STUDIO_PANEL)
    if (
      dockHalfMergeAtJoint(
        panel.endBossEnd,
        adjPanel.endBossStart,
        rowIndex,
        panelWidth,
        adjPanel.panelWidth,
        header,
      )
    ) {
      const lastW = colCuts[colCuts.length - 1]! - colCuts[colCuts.length - 2]!
      if (colCuts.length >= 2 && lastW <= header + MIN_TILE) {
        colCuts[colCuts.length - 2] = wall.width - header
      }
    }
  }

  return colCuts
}

/**
 * Wandweites Vertikal-Fugenraster einer Lage **ohne** Öffnungs-Blocker.
 * Für Öffnungs-Snap an echte Steinfugen (Laibung bündig mit Cut), nicht am Ideal-8-cm.
 */
export function masonryPatternCuts(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[],
  rowIndex: number,
): number[] {
  panel = normalizeStudioPanel(panel)
  const projectDepth = panel.projectDepth ?? DEFAULT_STUDIO_PANEL.projectDepth
  const bondCornerW = Math.max(
    STUDIO_MASONRY,
    Math.round(projectDepth / STUDIO_MASONRY) * STUDIO_MASONRY,
  )
  return computeRowColCuts(wall, panel, rowIndex, allWalls, bondCornerW, [])
}

/**
 * Laibungskörper, die die Zeile `y…yEnd` als X-Blocker brauchen.
 * Zeilen, die nur Kopf oder Sohlbank anschneiden, werden **nicht** blockiert —
 * sonst fehlen die Mittelsteine ober-/unterhalb des Sturzes (Rechteckfenster).
 * Wie bei der Bogenkappe: Steine legen, Öffnungs-Clip liefert den Rest.
 */
function rowJambBlockers(holes: JambHole[], y: number, yEnd: number): JambHole[] {
  return holes.filter((h) => {
    if (h.height <= CLIP_EPS) return false
    if (yEnd <= h.y + CLIP_EPS || y >= h.y + h.height - CLIP_EPS) return false
    const straddlesHead = y < h.y - CLIP_EPS && yEnd > h.y + CLIP_EPS
    const straddlesSill = y < h.y + h.height - CLIP_EPS && yEnd > h.y + h.height + CLIP_EPS
    if (straddlesHead || straddlesSill) return false
    return true
  })
}

/** Zeilen-Schnitte einer Wand inkl. ihrer eigenen Laibungsfelder (für Dock-Nachbarn). */
function rowColCutsWithOpenings(
  wall: Wall,
  panel: StudioPanelConfig,
  rowIndex: number,
  allWalls: Wall[],
  bondCornerW: number,
  depth: number,
): number[] {
  panel = normalizeStudioPanel(panel)
  const { rowCuts } = visiblePanelRowRange(wall.height, panel)
  const y0 = rowCuts[rowIndex]
  const y1 = rowCuts[rowIndex + 1]
  const blockers: XSpan[] =
    y0 != null && y1 != null
      ? rowJambBlockers(openingJambSealHoles(wall), y0 + panel.joint / 2, y1 - panel.joint / 2).map(
          (h) => ({ x0: h.x, x1: h.x + h.width }),
        )
      : []
  return computeRowColCuts(wall, panel, rowIndex, allWalls, bondCornerW, blockers, depth)
}

function tilesAlongRow(
  cuts: number[],
  y: number,
  height: number,
  joint: number,
  wallWidth: number,
  shearX = 0,
  dock: DockRowTileOpts = {},
): PanelTile[] {
  const tiles: PanelTile[] = []
  const last = cuts.length - 2
  if (last < 0) return tiles
  const spanStart = cuts[0]!
  const spanEnd = cuts[cuts.length - 1]!
  const endBound = Number.isFinite(spanEnd) ? spanEnd : wallWidth
  for (let i = 0; i <= last; i += 1) {
    const x = i === 0 ? (dock.jointStart ? spanStart + joint / 2 : spanStart) : cuts[i]! + joint / 2
    const xEnd = i === last ? (dock.jointEnd ? endBound - joint / 2 : endBound) : cuts[i + 1]! - joint / 2
    const width = xEnd - x
    if (width <= MIN_TILE) continue
    const tile: PanelTile = { x, y, width, height, shearX: shearX !== 0 ? shearX : undefined }
    if (i === 0 && dock.jointStart) tile.keepBossChamferStart = true
    if (i === last && dock.jointEnd) tile.keepBossChamferEnd = true
    if (i === 0 && dock.flattenStart) tile.flattenDockStart = true
    if (i === last && dock.flattenEnd) tile.flattenDockEnd = true
    tiles.push(tile)
  }
  if (tiles.length === 0) return tiles
  if (!dock.jointStart) {
    tiles[0]!.width += tiles[0]!.x - spanStart
    tiles[0]!.x = spanStart
  }
  const edge = tiles[tiles.length - 1]!
  if (!dock.jointEnd) {
    edge.width = endBound - edge.x
  }
  return tiles.filter((tile) => tile.width > MIN_TILE)
}

function dockRowTileOpts(
  wall: Wall,
  panelWidth: number,
  _joint: number,
  colCuts: number[],
  rowIndex: number,
  allWalls: Wall[],
  bondCornerW: number,
): DockRowTileOpts {
  const opts: DockRowTileOpts = {}
  const startAdj = findCollinearDockWall(wall, 'start', allWalls)
  const endAdj = findCollinearDockWall(wall, 'end', allWalls)

  if (startAdj && isCollinearDock(wall, startAdj)) {
    const adjPanel = normalizeStudioPanel(startAdj.panel ?? DEFAULT_STUDIO_PANEL)
    const adjCuts = rowColCutsWithOpenings(startAdj, adjPanel, rowIndex, allWalls, bondCornerW, 1)
    const adjEndW = lastSegmentWidth(adjCuts)
    const ourStartW = firstSegmentWidth(colCuts)
    if (dockHalfHalfMerge(adjEndW, ourStartW, adjPanel.panelWidth, panelWidth)) {
      opts.flattenStart = true
    } else {
      opts.jointStart = true
    }
  }

  if (endAdj && isCollinearDock(wall, endAdj)) {
    const adjPanel = normalizeStudioPanel(endAdj.panel ?? DEFAULT_STUDIO_PANEL)
    const adjCuts = rowColCutsWithOpenings(endAdj, adjPanel, rowIndex, allWalls, bondCornerW, 1)
    const adjStartW = firstSegmentWidth(adjCuts)
    const ourEndW = lastSegmentWidth(colCuts)
    if (dockHalfHalfMerge(ourEndW, adjStartW, panelWidth, adjPanel.panelWidth)) {
      opts.flattenEnd = true
    } else {
      opts.jointEnd = true
    }
  }

  return opts
}

/** Deterministischer PRNG für Wilden Verband. */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function layoutWildBondRow(
  wallWidth: number,
  y: number,
  height: number,
  joint: number,
  stretcher: number,
  header: number,
  rowIndex: number,
  seed: string,
): PanelTile[] {
  const rand = seededRandom(`${seed}:${rowIndex}`)
  const cuts: number[] = [0]
  let pos = 0
  let lastKind: BrickKind = rand() > 0.5 ? 'S' : 'H'
  let guard = 0
  while (pos < wallWidth - MIN_TILE && guard < MAX_CUTS) {
    guard += 1
    const kind: BrickKind = rand() > 0.35 ? lastKind : lastKind === 'S' ? 'H' : 'S'
    const step = kind === 'S' ? stretcher : header
    if (!Number.isFinite(step) || step <= MIN_TILE) break
    const next = Math.min(wallWidth, pos + step)
    if (next - pos <= MIN_TILE) break
    if (next < wallWidth - MIN_TILE) cuts.push(next)
    pos = next
    lastKind = kind
  }
  cuts.push(wallWidth)
  return tilesAlongRow(cuts, y, height, joint, wallWidth)
}

/**
 * Paneel-/Mauerwerk-Raster startet immer am Wandfuß (Y=0).
 * Der Sockel überlagert die unteren Reihen; `clipTilesAbovePlinth` entfernt sie.
 * Sockelhöhe verschiebt die Paneel-Y-Koordinaten nicht.
 */
function masonryOriginY(_panel: StudioPanelConfig): number {
  return 0
}

export function panelCourseCount(wallHeight: number, panel: StudioPanelConfig): number {
  panel = normalizeStudioPanel(panel)
  const { rowCuts } = visiblePanelRowRange(wallHeight, panel)
  return Math.max(0, rowCuts.length - 1)
}

export function visiblePanelRowRange(
  wallHeight: number,
  panel: StudioPanelConfig,
): { firstVisibleRow: number; lastVisibleRow: number; rowCuts: number[] } {
  panel = normalizeStudioPanel(panel)
  const y0 = masonryOriginY(panel)
  const masonryH = Math.max(0, wallHeight - y0)
  const localCuts = buildCuts(masonryH, panel.panelHeight, undefined, panel.joint / 2 + MIN_TILE)
  const rowCuts = localCuts.map((y) => y + y0)
  const lastRow = rowCuts.length - 2
  const totalRows = lastRow + 1
  const hideBottom = clampHideRows(panel.hideRowsBottom, totalRows)
  const hideTop = clampHideRows(panel.hideRowsTop, totalRows)
  const maxHideTop = Math.max(0, totalRows - hideBottom - 1)
  const effectiveHideTop = Math.min(hideTop, maxHideTop)
  const firstVisibleRow = Math.min(hideBottom, totalRows)
  const lastVisibleRow = Math.max(firstVisibleRow - 1, lastRow - effectiveHideTop)
  return { firstVisibleRow, lastVisibleRow, rowCuts }
}

/** Rechteck für Mörtel/LOD: nur sichtbare Paneel-Reihen; null = keine Paneele. */
export function visiblePanelRowRect(
  wall: Wall,
  panel: StudioPanelConfig,
): { x: number; y: number; width: number; height: number } | null {
  if (!wall || panel.enabled === false || panel.pattern === 'none') return null
  panel = normalizeStudioPanel(panel)
  const { firstVisibleRow, lastVisibleRow, rowCuts } = visiblePanelRowRange(wall.height, panel)
  if (firstVisibleRow > lastVisibleRow) return null
  const y = rowCuts[firstVisibleRow] ?? 0
  const yEnd = rowCuts[lastVisibleRow + 1] ?? wall.height
  const height = yEnd - y
  if (height <= MIN_TILE) return null
  return { x: 0, y, width: wall.width, height }
}

export function splitTilesAtOpenings(
  tiles: PanelTile[],
  _openings: unknown[],
  _clearance = 0,
): PanelTile[] {
  return tiles
}

export function layoutPanelTiles(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
): PanelTile[] {
  if (!wall || !Number.isFinite(wall.width) || !Number.isFinite(wall.height)) return []
  const stored = wall.claddingZones
  // Ohne persistierte Zonen: klassischer Ein-Panel-Pfad (Aufruf-`panel` ist maßgeblich).
  if (!stored || stored.length === 0) {
    return layoutPanelTilesForPanel(wall, panel, allWalls)
  }
  const out: PanelTile[] = []
  for (const zone of claddingZonesForWall(wall)) {
    if (zone.kind === 'none') continue
    const zPanel = effectivePanelForZone(wall, zone, panel)
    let tiles = layoutPanelTilesForPanel(wall, zPanel, allWalls)
    tiles = clipTilesToZoneRect(tiles, zone)
    out.push(...tiles)
  }
  return out
}

/** Eine Zone / ein Panel — interne Implementierung. */
function layoutPanelTilesForPanel(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[],
): PanelTile[] {
  panel = normalizeStudioPanel(panel)
  const { panelWidth, joint, pattern } = panel
  if (panel.enabled === false || pattern === 'none') return []
  const tiles: PanelTile[] = []
  const { firstVisibleRow, lastVisibleRow, rowCuts } = visiblePanelRowRange(wall.height, panel)
  const lastRow = rowCuts.length - 2
  const projectDepth = panel.projectDepth ?? DEFAULT_STUDIO_PANEL.projectDepth
  const bondCornerW = Math.max(STUDIO_MASONRY, Math.round(projectDepth / STUDIO_MASONRY) * STUDIO_MASONRY)
  const header = headerSize(panelWidth)
  const startAdj = findCollinearDockWall(wall, 'start', allWalls)
  const endAdj = findCollinearDockWall(wall, 'end', allWalls)
  const jambHoles = openingJambSealHoles(wall)

  for (let rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
    if (rowIndex < firstVisibleRow || rowIndex > lastVisibleRow) continue
    const y = rowCuts[rowIndex] + joint / 2
    const yEnd = rowCuts[rowIndex + 1] - joint / 2
    const height = yEnd - y
    if (height <= MIN_TILE) continue
    const rowHoles = rowJambBlockers(jambHoles, y, yEnd)

    if (pattern === 'strip') {
      const raised = panel.projectDepth ?? DEFAULT_STUDIO_PANEL.projectDepth
      const recessed = panel.recessedProjectDepth ?? DEFAULT_STUDIO_PANEL.recessedProjectDepth ?? 0
      const isRaised = panel.alternateFloors !== true || rowIndex % 2 === 0
      const depth = panel.alternateFloors === true ? (isRaised ? raised : recessed) : undefined
      const taperDepth = isRaised
        ? panel.taperDepth ?? 0
        : panel.recessedTaperDepth ?? DEFAULT_STUDIO_PANEL.recessedTaperDepth ?? 0
      const taper = isRaised
        ? panel.taper
        : panel.recessedTaper ?? DEFAULT_STUDIO_PANEL.recessedTaper ?? 1
      let x = 0
      let width = wall.width
      if (startAdj && isCollinearDock(wall, startAdj)) {
        x -= joint
        width += joint
      }
      if (endAdj && isCollinearDock(wall, endAdj)) {
        width += joint
      }
      tiles.push({
        x,
        y,
        width,
        height,
        depth,
        taperDepth,
        taper,
        recessed: panel.alternateFloors === true && !isRaised,
      })
      continue
    }

    if (pattern === 'wildBond') {
      tiles.push(
        ...layoutWildBondRow(wall.width, y, height, joint, panelWidth, header, rowIndex, wall.id),
      )
      continue
    }

    const blockers: XSpan[] = rowHoles.map((h) => ({ x0: h.x, x1: h.x + h.width }))
    const colCuts = computeRowColCuts(wall, panel, rowIndex, allWalls, bondCornerW, blockers)
    const dockOpts = dockRowTileOpts(
      wall,
      panelWidth,
      joint,
      colCuts,
      rowIndex,
      allWalls,
      bondCornerW,
    )
    const shearX = pattern === 'runningBondDiagonal' ? panelWidth * 0.12 * (rowIndex % 2 === 0 ? 1 : -1) : 0
    const rowTiles = tilesAlongRow(colCuts, y, height, joint, wall.width, shearX, dockOpts)
    // Feld-Schnitte werden zu einer Cut-Liste gemerged; zwischen Feldende und nächstem
    // Feldanfang liegt die Öffnung — tilesAlongRow würde dort einen Stein spawnen.
    // Jeden Stein mit X-Überlappung zur Laibung verwerfen (nicht nur „ganz innen“).
    tiles.push(
      ...rowTiles.filter((tile) => !tileOverlapsJambHoles(tile, rowHoles, y, yEnd)),
    )
  }

  return clipTilesAbovePlinth(
    sealTilesToOpeningJambs(
      mergeNarrowPanelGaps(splitTilesAtOpenings(tiles, wall.openings), wall, panel),
      jambHoles,
      panelWidth,
    ),
    panel,
  )
}

/** True, wenn der Stein die Laibungsfläche in X schneidet (Öffnungs-Phantomsteine). */
function tileOverlapsJambHoles(
  tile: PanelTile,
  holes: JambHole[],
  rowY: number,
  rowYEnd: number,
): boolean {
  for (const h of holes) {
    if (h.height <= CLIP_EPS) continue
    if (rowYEnd <= h.y + CLIP_EPS || rowY >= h.y + h.height - CLIP_EPS) continue
    const overlap =
      Math.min(tile.x + tile.width, h.x + h.width) - Math.max(tile.x, h.x)
    if (overlap > CLIP_EPS) return true
  }
  return false
}

type JambHole = { x: number; y: number; width: number; height: number }

/**
 * Sockelzone: Steine/Paneele unter der Sockeloberkante entfernen — nicht kürzen,
 * sonst bleibt eine abgeschnittene unterste Reihe.
 */
function clipTilesAbovePlinth(tiles: PanelTile[], panel: StudioPanelConfig): PanelTile[] {
  if (!studioPlinthActive(panel)) return tiles
  const plinthH = panel.plinthHeight ?? 0
  if (plinthH < 0.5) return tiles
  return tiles.filter((tile) => tile.y >= plinthH - CLIP_EPS && tile.y + tile.height > plinthH + CLIP_EPS)
}

/**
 * Laibungskörper je Öffnung (Plan-XY) unter der Kämpferlinie — Grundlage für Feld-Layout
 * (Stoßfugen 0,5/1 an der Laibung) und für das Siegeln der Nachbarsteine.
 * Bogenkappe nicht enthalten: dort dockt das Raster am Bogen/Extrados.
 */
function openingJambSealHoles(wall: Wall): JambHole[] {
  return wall.openings
    .filter((opening) => !opening.hidden && openingCutsWall(opening))
    .map((opening) => {
      const clearance = openingCladdingMaskInflateForLayout(opening)
      const rect = openingMasonryRect(opening, clearance)
      const geom = openingArchGeom(opening, clearance)
      const stadium = openingStadiumGeom(opening, clearance)
      if (stadium) {
        if (!stadium.vertical) return { x: rect.x, y: rect.y, width: rect.width, height: 0 }
        const y0 = stadium.y0 + stadium.r
        const y1 = stadium.y1 - stadium.r
        return { x: stadium.x0, y: y0, width: stadium.x1 - stadium.x0, height: Math.max(0, y1 - y0) }
      }
      const springY = geom?.springY ?? openingArchSpringY(opening, clearance)
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        /** Siegel nur bis zur Kämpferlinie (ohne Bogenkappe). */
        height: springY != null ? Math.max(0, springY - rect.y) : rect.height,
      }
    })
}

/**
 * Steine, die vor der Laibung enden, bis an die Clip-Kante ziehen.
 * Verhindert Mörtel-/Wandstreifen links und rechts der Öffnung.
 */
function sealTilesToOpeningJambs(
  tiles: PanelTile[],
  holes: JambHole[],
  panelWidth = Infinity,
): PanelTile[] {
  if (tiles.length === 0) return tiles
  if (holes.length === 0) return tiles
  const maxStone = Number.isFinite(panelWidth) ? panelWidth + 0.5 : Infinity

  const rowMap = new Map<number, PanelTile[]>()
  for (const tile of tiles) {
    const key = rowKey(tile.y)
    const row = rowMap.get(key) ?? []
    row.push({ ...tile })
    rowMap.set(key, row)
  }

  const out: PanelTile[] = []
  for (const row of rowMap.values()) {
    row.sort((a, b) => a.x - b.x)
    const y = row[0].y
    const y1 = y + row[0].height
    for (const hole of holes) {
      if (hole.height <= CLIP_EPS) continue
      if (y1 <= hole.y + CLIP_EPS || y >= hole.y + hole.height - CLIP_EPS) continue
      const left = hole.x
      const right = hole.x + hole.width
      const coversLeft = row.some(
        (tile) => tile.x < left - CLIP_EPS && tile.x + tile.width > left - CLIP_EPS,
      )
      if (!coversLeft) {
        const candidates = row.filter((tile) => tile.x + tile.width <= left + CLIP_EPS && tile.x < left)
        if (candidates.length > 0) {
          const tile = candidates.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b))
          const gap = left - (tile.x + tile.width)
          const nextW = Math.min(left - tile.x, maxStone)
          if (gap > CLIP_EPS && gap <= MAX_JAMB_SEAL && nextW > tile.width) tile.width = nextW
        }
      }
      const coversRight = row.some(
        (tile) => tile.x < right + CLIP_EPS && tile.x + tile.width > right + CLIP_EPS,
      )
      if (!coversRight) {
        const candidates = row.filter((tile) => tile.x >= right - CLIP_EPS)
        if (candidates.length > 0) {
          const tile = candidates.reduce((a, b) => (a.x < b.x ? a : b))
          const gap = tile.x - right
          const grow = Math.min(gap, Math.max(0, maxStone - tile.width))
          if (gap > CLIP_EPS && gap <= MAX_JAMB_SEAL && grow > CLIP_EPS) {
            tile.width += grow
            tile.x = right
          }
        }
      }
    }
    out.push(...row)
  }
  return out
}

function rowKey(y: number): number {
  return Math.round(y * 1000)
}

function overlapsY(opening: Opening, y: number, height: number): boolean {
  return opening.y < y + height && opening.y + opening.height > y
}

function overlapsX(tile: PanelTile, x0: number, x1: number): boolean {
  return tile.x < x1 && tile.x + tile.width > x0
}

export function mergeNarrowPanelGaps(
  tiles: PanelTile[],
  wall: Wall,
  panel: StudioPanelConfig,
): PanelTile[] {
  if (panel.pattern === 'none') return tiles
  const isMasonry = panelKindForPattern(panel.pattern) === 'masonry'
  const defaultMinW = panel.panelWidth - 1e-3
  if (!isMasonry && defaultMinW <= MIN_TILE) return tiles
  const openings = wall.openings.filter((o) => !o.hidden)
  if (openings.length === 0) return tiles

  const rowMap = new Map<number, PanelTile[]>()
  for (const tile of tiles) {
    const key = rowKey(tile.y)
    const row = rowMap.get(key) ?? []
    row.push(tile)
    rowMap.set(key, row)
  }

  const out: PanelTile[] = []
  for (const row of rowMap.values()) {
    const y = row[0].y
    const h = row[0].height
    const rowOpenings = openings.filter((o) => overlapsY(o, y, h))
    if (rowOpenings.length === 0) {
      out.push(...row)
      continue
    }

    let merged = [...row].sort((a, b) => a.x - b.x)
    const midY = y + h * 0.5
    const blocked = rowOpenings
      .filter((o) => openingCutsWall(o))
      .map((o) => {
        const clearance = openingCladdingMaskInflateForLayout(o)
        const span = maskXSpanAtY(o, midY, clearance)
        if (!span) return null
        return { x0: span.x0, x1: span.x1 }
      })
      .filter((b): b is { x0: number; x1: number } => b != null)
      .sort((a, b) => a.x0 - b.x0)
    if (blocked.length === 0) {
      out.push(...row)
      continue
    }

    const gaps: Array<{ x0: number; x1: number }> = []
    const rowMinX = Math.min(0, ...row.map((t) => t.x))
    const rowMaxX = Math.max(wall.width, ...row.map((t) => t.x + t.width))
    let cursor = rowMinX
    for (const block of blocked) {
      if (block.x0 - cursor > CLIP_EPS) gaps.push({ x0: cursor, x1: block.x0 })
      cursor = Math.max(cursor, block.x1)
    }
    if (rowMaxX - cursor > CLIP_EPS) gaps.push({ x0: cursor, x1: rowMaxX })

    const minW = isMasonry
      ? Math.min(...row.map((t) => t.width)) - 1e-3
      : Math.min(defaultMinW, headerSize(panel.panelWidth)) - 1e-3
    if (minW <= MIN_TILE) {
      out.push(...row)
      continue
    }

    for (const gap of gaps) {
      const width = gap.x1 - gap.x0
      if (width >= minW) continue
      const touching = merged.filter((t) => overlapsX(t, gap.x0, gap.x1))
      if (touching.length === 0) continue
      const x0 = Math.min(gap.x0, ...touching.map((t) => t.x))
      const x1 = Math.max(gap.x1, ...touching.map((t) => t.x + t.width))
      merged = merged.filter((t) => !touching.includes(t))
      merged.push({
        x: x0,
        y,
        width: x1 - x0,
        height: h,
        depth: touching[0].depth,
        taperDepth: touching[0].taperDepth,
        taper: touching[0].taper,
        recessed: touching[0].recessed,
        shearX: touching[0].shearX,
        keepBossChamferStart: touching.some((t) => t.keepBossChamferStart),
        keepBossChamferEnd: touching.some((t) => t.keepBossChamferEnd),
        flattenDockStart: touching.some((t) => t.flattenDockStart),
        flattenDockEnd: touching.some((t) => t.flattenDockEnd),
      })
      merged.sort((a, b) => a.x - b.x)
    }
    out.push(...merged)
  }
  return out
}
