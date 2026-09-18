import * as THREE from 'three'
import type {
  Building,
  FacadeState,
  Opening,
  RoofConfig,
  RoofCrossGable,
  RoofDormer,
  RoofEdgeMode,
  RoofKind,
  RoofSkylight,
  RoofTileProfile,
  StudioPanelConfig,
  StudioPanelPattern,
  Wall,
} from '../types/facade'
import { normalizeRoofDormerKind } from '../types/facade'
import { DEFAULT_WALL_COLOR } from '../constants/colorPalettes'
import { getActiveBuilding } from '../utils/buildings'
import { floorIndex, storeyTopY } from '../utils/layers'
import {
  planFacesWithHoles,
  planHasClosedRing,
  planNodeWorld,
  polygonAreaXZ,
  type FloorPlan,
} from './floorPlan'
import { layoutPanelTiles } from './panelLayout'
import { MASONRY_KIND_PATTERNS, PANEL_KIND_PATTERNS } from './constants'
import {
  buildRoofEnvelope,
  buildRoofEnvelopeGeometry,
  complementIntervals,
  edgeCompassLabel,
  intersectConvexPolygons,
  isRoofKind,
  orientRingCcw,
  roofEdgeKey,
  roofSlabVerticalCm,
  yawToDirXZ,
  type RoofEaveCut,
  type RoofEnvelope,
  type XZ,
} from './roofForms'
import { isStudioWall, wallEndPoint, wallHasPanels, wallStartPoint } from './walls'

export type { RoofConfig, RoofTileProfile }
export { ROOF_KIND_LABELS, ROOF_KINDS, roofKindUsesPitch, roofKindUsesRidgeDir } from './roofForms'

const TILE_PATTERNS: StudioPanelPattern[] = [
  ...PANEL_KIND_PATTERNS.filter((p) => p !== 'strip'),
  ...MASONRY_KIND_PATTERNS,
]

/** Firstrichtung / Pult-Hochseite: 45er-Raster (Wand-Yaw). */
export const ROOF_RIDGE_STEP_DEG = 45
export const ROOF_PITCH_MIN = 10
export const ROOF_PITCH_MAX = 75
export const ROOF_HALF_HIP_MIN = 0
export const ROOF_HALF_HIP_MAX = 400

export const DEFAULT_ROOF: RoofConfig = {
  enabled: false,
  kind: 'mansard',
  pitch: 45,
  ridgeDeg: null,
  halfHipHeight: 120,
  /** MVP Formen: immer glatt — Ziegel kommen in einer späteren Stufe. */
  covering: 'smooth',
  crossGables: [],
  skylights: [],
  dormers: [],
  pitchLower: 70,
  pitchUpper: 30,
  overhang: 40,
  ridgeHeight: 280,
  tileColor: '#8b3a2a',
  gutter: true,
  gutterColor: '#8E8A88',
  tileWidth: 32,
  tileHeight: 24,
  tileJoint: 0.8,
  tilePattern: 'runningBond',
  tileProfile: 'pantile',
  tileProjectDepth: 3,
  tileTaper: 0.85,
  tileTaperDepth: 1.5,
}

export function normalizeRoof(raw?: Partial<RoofConfig> | null): RoofConfig {
  const base = { ...DEFAULT_ROOF, ...raw }
  const pattern = TILE_PATTERNS.includes(base.tilePattern as StudioPanelPattern)
    ? (base.tilePattern as StudioPanelPattern)
    : DEFAULT_ROOF.tilePattern
  const profile: RoofTileProfile = base.tileProfile === 'barrel' ? 'barrel' : 'pantile'
  const kind: RoofKind = isRoofKind(base.kind) ? base.kind : 'mansard'
  // Gespeicherte Wahl bleibt erhalten (Rückwechsel zur Mansarde behält Ziegel);
  // wirksam ist `roofEffectiveCovering` — Ziegel gibt es bisher nur für die Mansarde.
  const covering: RoofConfig['covering'] = base.covering === 'smooth' ? 'smooth' : 'tiles'
  const ridgeDeg =
    typeof base.ridgeDeg === 'number' && Number.isFinite(base.ridgeDeg)
      ? ((Math.round(base.ridgeDeg / ROOF_RIDGE_STEP_DEG) * ROOF_RIDGE_STEP_DEG) % 360 + 360) % 360
      : null
  const edgeModes = normalizeEdgeModes(base.edgeModes)
  const crossGables = normalizeCrossGables(base.crossGables)
  const skylights = normalizeSkylights(base.skylights)
  const dormers = normalizeDormers(base.dormers)
  return {
    enabled: Boolean(base.enabled),
    hidden: Boolean(base.hidden),
    kind,
    pitch: clamp(base.pitch, ROOF_PITCH_MIN, ROOF_PITCH_MAX),
    ridgeDeg,
    halfHipHeight: snap8(clamp(base.halfHipHeight, ROOF_HALF_HIP_MIN, ROOF_HALF_HIP_MAX)),
    covering,
    ...(edgeModes ? { edgeModes } : {}),
    ...(crossGables.length > 0 ? { crossGables } : {}),
    ...(skylights.length > 0 ? { skylights } : {}),
    ...(dormers.length > 0 ? { dormers } : {}),
    ...(typeof base.gableColor === 'string' && base.gableColor ? { gableColor: base.gableColor } : {}),
    pitchLower: clamp(base.pitchLower, 45, 80),
    pitchUpper: clamp(base.pitchUpper, 10, 45),
    overhang: clamp(base.overhang, 0, 120),
    ridgeHeight: clamp(base.ridgeHeight, 80, 600),
    tileColor: typeof base.tileColor === 'string' && base.tileColor ? base.tileColor : DEFAULT_ROOF.tileColor,
    gutter: base.gutter !== false,
    gutterColor:
      typeof base.gutterColor === 'string' && base.gutterColor
        ? base.gutterColor
        : DEFAULT_ROOF.gutterColor,
    tileWidth: snap8(clamp(base.tileWidth, 8, 96)),
    tileHeight: snap8(clamp(base.tileHeight, 8, 96)),
    tileJoint: clamp(base.tileJoint, 0, 4),
    tilePattern: pattern,
    tileProfile: profile,
    tileProjectDepth: clamp(base.tileProjectDepth, 0.5, 12),
    tileTaper: clamp(base.tileTaper, 0.2, 1),
    tileTaperDepth: clamp(base.tileTaperDepth, 0, 8),
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/**
 * Wirksame Eindeckung. MVP Dachformen (v2.0.473): **immer glatt** —
 * die Ziegel-Pipeline (`addTiledFacet` / ~10⁵ Vertices) bleibt im Code,
 * wird aber nicht mehr aufgerufen, bis die Formen stimmen.
 */
export const ROOF_TILES_ENABLED = false

export function roofEffectiveCovering(_roof: RoofConfig): RoofConfig['covering'] {
  if (!ROOF_TILES_ENABLED) return 'smooth'
  return _roof.kind === 'mansard' ? _roof.covering : 'smooth'
}

function normalizeEdgeModes(
  raw: unknown,
): Record<string, RoofEdgeMode> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, RoofEdgeMode> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'free' || value === 'flush') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeCrossGables(raw: unknown): RoofCrossGable[] {
  if (!Array.isArray(raw)) return []
  const out: RoofCrossGable[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const edgeKey = typeof (item as RoofCrossGable).edgeKey === 'string' ? (item as RoofCrossGable).edgeKey : ''
    if (!edgeKey) continue
    out.push({
      edgeKey,
      widthCm: snap8(clamp((item as RoofCrossGable).widthCm, 80, 2000)),
      depthCm: snap8(clamp((item as RoofCrossGable).depthCm, 40, 1200)),
    })
  }
  return out
}

function normalizeSkylights(raw: unknown): RoofSkylight[] {
  if (!Array.isArray(raw)) return []
  const out: RoofSkylight[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = typeof (item as RoofSkylight).id === 'string' ? (item as RoofSkylight).id : ''
    if (!id) continue
    const x = Number((item as RoofSkylight).x)
    const z = Number((item as RoofSkylight).z)
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue
    out.push({
      id,
      x,
      z,
      widthCm: snap8(clamp(Number((item as RoofSkylight).widthCm) || 80, 40, 400)),
      heightCm: snap8(clamp(Number((item as RoofSkylight).heightCm) || 120, 40, 400)),
      ...((item as RoofSkylight).hidden ? { hidden: true } : {}),
    })
  }
  return out
}

function normalizeDormers(raw: unknown): RoofDormer[] {
  if (!Array.isArray(raw)) return []
  const out: RoofDormer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = typeof (item as RoofDormer).id === 'string' ? (item as RoofDormer).id : ''
    if (!id) continue
    const x = Number((item as RoofDormer).x)
    const z = Number((item as RoofDormer).z)
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue
    const kind = normalizeRoofDormerKind((item as RoofDormer).kind)
    const raw = item as Partial<RoofDormer>
    const optNum = (v: unknown, min: number, max: number, snap = false): number | undefined => {
      const n = Number(v)
      if (!Number.isFinite(n)) return undefined
      const c = clamp(n, min, max)
      return snap ? snap8(c) : Math.round(c)
    }
    const optColor = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v : undefined
    const window = normalizeDormerWindow(raw.window)
    out.push({
      id,
      kind,
      x,
      z,
      widthCm: snap8(clamp(Number(raw.widthCm) || 160, 80, 1200)),
      depthCm: snap8(clamp(Number(raw.depthCm) || 400, 40, 1200)),
      heightCm: snap8(clamp(Number(raw.heightCm) || 140, 24, 400)),
      ...(optNum(raw.roofPitchDeg, 3, 75) !== undefined ? { roofPitchDeg: optNum(raw.roofPitchDeg, 3, 75) } : {}),
      ...(optNum(raw.overhangCm, 0, 64) !== undefined ? { overhangCm: optNum(raw.overhangCm, 0, 64) } : {}),
      ...(optNum(raw.wallThicknessCm, 8, 40) !== undefined
        ? { wallThicknessCm: optNum(raw.wallThicknessCm, 8, 40) }
        : {}),
      ...(optNum(raw.riseCm, 8, 600) !== undefined ? { riseCm: optNum(raw.riseCm, 8, 600) } : {}),
      ...(optNum(raw.cheekTiltDeg, 15, 45) !== undefined ? { cheekTiltDeg: optNum(raw.cheekTiltDeg, 15, 45) } : {}),
      ...(raw.eaveBreak ? { eaveBreak: true } : {}),
      ...(raw.hidden ? { hidden: true } : {}),
      ...(window ? { window } : {}),
      ...(optColor(raw.wallColor) ? { wallColor: optColor(raw.wallColor) } : {}),
      ...(optColor(raw.roofColor) ? { roofColor: optColor(raw.roofColor) } : {}),
      ...(optColor(raw.trimColor) ? { trimColor: optColor(raw.trimColor) } : {}),
    })
  }
  return out
}

/** Gauben-Fenster: nur Plausibilität (Typ, Maße); Feldkatalog wie Wand-Öffnungen. */
function normalizeDormerWindow(raw: unknown): Opening | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Partial<Opening>
  const width = Number(o.width)
  const height = Number(o.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) return undefined
  return {
    ...(o as Opening),
    id: typeof o.id === 'string' && o.id ? o.id : 'dormer-window',
    type: o.type === 'door' ? 'door' : 'window',
    x: Number.isFinite(Number(o.x)) ? Number(o.x) : 0,
    y: Number.isFinite(Number(o.y)) ? Math.max(0, Number(o.y)) : 0,
    width: Math.round(width),
    height: Math.round(height),
  }
}

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}

export function facadeHasRoofablePlan(state: FacadeState): boolean {
  const building = getActiveBuilding(state)
  const floors = building.floors
  if (!floors || floors.length === 0) return false
  return planHasClosedRing(floors[floors.length - 1])
}

export function topClosedOuterRing(plan: FloorPlan): Array<{ x: number; z: number }> | null {
  const faces = planFacesWithHoles(plan)
  if (faces.length === 0) return null
  let best = faces[0]
  let bestArea = polygonAreaXZ(best.outer.map(planNodeWorld))
  for (let i = 1; i < faces.length; i += 1) {
    const area = polygonAreaXZ(faces[i].outer.map(planNodeWorld))
    if (area > bestArea) {
      bestArea = area
      best = faces[i]
    }
  }
  return best.outer.map(planNodeWorld)
}

export function topRoofFaceWorld(plan: FloorPlan): {
  outer: Array<{ x: number; z: number }>
  holes: Array<Array<{ x: number; z: number }>>
} | null {
  const faces = planFacesWithHoles(plan)
  if (faces.length === 0) return null
  let best = faces[0]
  let bestArea = polygonAreaXZ(best.outer.map(planNodeWorld))
  for (let i = 1; i < faces.length; i += 1) {
    const area = polygonAreaXZ(faces[i].outer.map(planNodeWorld))
    if (area > bestArea) {
      bestArea = area
      best = faces[i]
    }
  }
  return {
    outer: best.outer.map(planNodeWorld),
    holes: best.holes.map((hole) => hole.map(planNodeWorld)),
  }
}

/** Versetzt ein CCW-Polygon gleichmäßig (positiv = außen). */
export function offsetPolygonXZ(
  pts: Array<{ x: number; z: number }>,
  distance: number,
): Array<{ x: number; z: number }> {
  return offsetPolygonPerEdge(
    pts,
    pts.map(() => distance),
  )
}

/**
 * Per-Kanten-Offset: `edgeDist[i]` gilt für Kante pts[i]→pts[i+1].
 * Vertex i = Schnitt der Parallelen von Kante i−1 und Kante i.
 */
export function offsetPolygonPerEdge(
  pts: Array<{ x: number; z: number }>,
  edgeDist: number[],
): Array<{ x: number; z: number }> {
  const n = pts.length
  if (n < 3) return pts.map((p) => ({ ...p }))
  const result: Array<{ x: number; z: number }> = []
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const dIn = edgeDist[(i - 1 + n) % n] ?? 0
    const dOut = edgeDist[i] ?? 0
    const lineIn = parallelLine(prev, curr, dIn)
    const lineOut = parallelLine(curr, next, dOut)
    const hit = intersectLines(lineIn, lineOut)
    result.push(hit ?? { x: curr.x, z: curr.z })
  }
  return result
}

function parallelLine(
  a: { x: number; z: number },
  b: { x: number; z: number },
  distance: number,
): { ox: number; oz: number; dx: number; dz: number } {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const dx = (b.x - a.x) / len
  const dz = (b.z - a.z) / len
  // CCW Außen-Normale
  const nx = dz
  const nz = -dx
  return {
    ox: a.x + nx * distance,
    oz: a.z + nz * distance,
    dx,
    dz,
  }
}

function intersectLines(
  a: { ox: number; oz: number; dx: number; dz: number },
  b: { ox: number; oz: number; dx: number; dz: number },
): { x: number; z: number } | null {
  const det = a.dx * b.dz - a.dz * b.dx
  if (Math.abs(det) < 1e-8) {
    return { x: a.ox, z: a.oz }
  }
  const t = ((b.ox - a.ox) * b.dz - (b.oz - a.oz) * b.dx) / det
  return { x: a.ox + a.dx * t, z: a.oz + a.dz * t }
}

function insetByPitch(
  poly: Array<{ x: number; z: number }>,
  riseCm: number,
  pitchDeg: number,
): Array<{ x: number; z: number }> {
  const rad = (pitchDeg * Math.PI) / 180
  const run = riseCm / Math.tan(Math.max(0.15, rad))
  return offsetPolygonXZ(poly, -run)
}

/** Wand ohne Paneele → Dach bündig, keine Rinne an dieser Kante. */
export function wallIsBareForRoof(wall: Wall): boolean {
  if (!isStudioWall(wall)) return false
  return !wallHasPanels(wall)
}

function edgeMatchesWall(
  a: { x: number; z: number },
  b: { x: number; z: number },
  wall: Wall,
): boolean {
  const s = wallStartPoint(wall)
  const e = wallEndPoint(wall)
  const tol = 16
  const forward =
    Math.hypot(a.x - s.x, a.z - s.z) <= tol && Math.hypot(b.x - e.x, b.z - e.z) <= tol
  const reverse =
    Math.hypot(a.x - e.x, a.z - e.z) <= tol && Math.hypot(b.x - s.x, b.z - s.z) <= tol
  return forward || reverse
}

function findWallForEdge(
  building: Building,
  a: { x: number; z: number },
  b: { x: number; z: number },
  topFloor: number,
): Wall | null {
  const edgeLen = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const edx = (b.x - a.x) / edgeLen
  const edz = (b.z - a.z) / edgeLen
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }

  let best: Wall | null = null
  let bestScore = Infinity

  for (const wall of building.walls) {
    if (!isStudioWall(wall)) continue
    if (floorIndex(wall, building.wallHeight) !== topFloor) continue
    if (edgeMatchesWall(a, b, wall)) return wall

    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    const wLen = Math.hypot(e.x - s.x, e.z - s.z) || 1
    const wdx = (e.x - s.x) / wLen
    const wdz = (e.z - s.z) / wLen
    // Parallel (Richtung oder Gegenrichtung)
    const parallel = Math.abs(edx * wdx + edz * wdz)
    if (parallel < 0.92) continue
    const dist = pointToSegmentDist(mid, s, e)
    // Länge ähnlich (gegen kurze Nachbarstücke)
    const lenRatio = Math.min(edgeLen, wLen) / Math.max(edgeLen, wLen)
    if (dist < 28 && lenRatio > 0.55 && dist < bestScore) {
      bestScore = dist
      best = wall
    }
  }
  return best
}

function pointToSegmentDist(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz || 1
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t))
}

/** Traufkante des obersten Rings für UI und Geometrie. */
export interface RoofEdgeInfo {
  key: string
  index: number
  a: XZ
  b: XZ
  lengthCm: number
  /** Kompass der Außenseite (N, S/O, …). */
  compass: string
  /** Anzeige: Kompass + Laufnummer bei gleicher Richtung + Länge. */
  label: string
  wallId?: string
  /** Gespeicherter Modus (fehlend = `auto`). */
  mode: RoofEdgeMode
  /** Wirksam bündig: `flush`, oder `auto` und Wand ohne Paneele. */
  flush: boolean
}

/** Plan-Außenring der obersten Etage, CCW orientiert (Indizes stabil für `flush`). */
export function roofOuterRing(building: Building): XZ[] | null {
  const floors = building.floors
  if (!floors || floors.length === 0) return null
  const face = topRoofFaceWorld(floors[floors.length - 1])
  if (!face || face.outer.length < 3) return null
  return orientRingCcw(face.outer)
}

export function roofEdgeModeFor(roof: RoofConfig, key: string): RoofEdgeMode {
  return roof.edgeModes?.[key] ?? 'auto'
}

export function listRoofEdges(building: Building, roof: RoofConfig): RoofEdgeInfo[] {
  const outer = roofOuterRing(building)
  if (!outer) return []
  return listRoofEdgesForRing(building, roof, outer)
}

function listRoofEdgesForRing(building: Building, roof: RoofConfig, outer: XZ[]): RoofEdgeInfo[] {
  const topFloor = (building.floors?.length ?? 1) - 1
  const n = outer.length
  const edges: RoofEdgeInfo[] = []
  const compassCount = new Map<string, number>()
  for (let i = 0; i < n; i += 1) {
    const a = outer[i]
    const b = outer[(i + 1) % n]
    const lengthCm = Math.hypot(b.x - a.x, b.z - a.z)
    const wall = findWallForEdge(building, a, b, topFloor)
    const key = roofEdgeKey(a, b)
    const mode = roofEdgeModeFor(roof, key)
    const autoFlush = Boolean(wall && wallIsBareForRoof(wall))
    const flush = mode === 'flush' || (mode === 'auto' && autoFlush)
    const compass = edgeCompassLabel(a, b)
    compassCount.set(compass, (compassCount.get(compass) ?? 0) + 1)
    edges.push({
      key,
      index: i,
      a,
      b,
      lengthCm,
      compass,
      label: '',
      wallId: wall?.id,
      mode,
      flush,
    })
  }
  const seen = new Map<string, number>()
  for (const edge of edges) {
    const total = compassCount.get(edge.compass) ?? 1
    const nth = (seen.get(edge.compass) ?? 0) + 1
    seen.set(edge.compass, nth)
    const suffix = total > 1 ? ` ${nth}` : ''
    edge.label = `${edge.compass}${suffix} · ${Math.round(edge.lengthCm)} cm`
  }
  return edges
}

export function overhangPerEdge(edges: RoofEdgeInfo[], overhang: number): number[] {
  return edges.map((edge) => (edge.flush ? 0 : overhang))
}

/**
 * Kantenmodi beim Formwechsel: Sattel/Krüppelwalm → Giebelenden bündig;
 * Walm/Mansarde/Pult → gespeicherte Bündig-Modi löschen (leeres Objekt).
 */
export function edgeModesForRoofKind(
  building: Building,
  kind: RoofKind,
  roof: RoofConfig,
): Record<string, RoofEdgeMode> {
  if (kind !== 'gable' && kind !== 'halfHip') return {}
  const outer = roofOuterRing(building)
  if (!outer || outer.length < 3) return {}
  let d: XZ
  if (roof.ridgeDeg === null || roof.ridgeDeg === undefined) {
    let best = { x: 1, z: 0 }
    let bestLen = -1
    for (let i = 0; i < outer.length; i += 1) {
      const a = outer[i]!
      const b = outer[(i + 1) % outer.length]!
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len > bestLen) {
        bestLen = len
        best = { x: (b.x - a.x) / (len || 1), z: (b.z - a.z) / (len || 1) }
      }
    }
    d = best
  } else {
    d = yawToDirXZ(roof.ridgeDeg)
  }
  let tMin = Infinity
  let tMax = -Infinity
  for (const p of outer) {
    const t = d.x * p.x + d.z * p.z
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  const modes: Record<string, RoofEdgeMode> = {}
  const n = outer.length
  for (let i = 0; i < n; i += 1) {
    const a = outer[i]!
    const b = outer[(i + 1) % n]!
    const ta = d.x * a.x + d.z * a.z
    const tb = d.x * b.x + d.z * b.z
    if (
      (Math.abs(ta - tMin) < 0.5 && Math.abs(tb - tMin) < 0.5) ||
      (Math.abs(ta - tMax) < 0.5 && Math.abs(tb - tMax) < 0.5)
    ) {
      modes[roofEdgeKey(a, b)] = 'flush'
    }
  }
  return modes
}

function appendTri(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  const base = positions.length / 3
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const normal = new THREE.Vector3().crossVectors(ab, ac).normalize()
  for (const v of [a, b, c]) {
    positions.push(v.x, v.y, v.z)
    normals.push(normal.x, normal.y, normal.z)
    uvs.push(v.x / 32, v.z / 32)
  }
  indices.push(base, base + 1, base + 2)
}

function appendQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  appendTri(positions, normals, uvs, indices, a, b, c)
  appendTri(positions, normals, uvs, indices, a, c, d)
}

function buildCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  poly: Array<{ x: number; z: number }>,
  y: number,
  holes: Array<Array<{ x: number; z: number }>> = [],
) {
  if (poly.length < 3) return
  const shape = new THREE.Shape()
  shape.moveTo(poly[0].x, poly[0].z)
  for (let i = 1; i < poly.length; i += 1) {
    shape.lineTo(poly[i].x, poly[i].z)
  }
  shape.closePath()
  for (const hole of holes) {
    if (hole.length < 3) continue
    const path = new THREE.Path()
    path.moveTo(hole[0].x, hole[0].z)
    for (let i = hole.length - 1; i >= 1; i -= 1) {
      path.lineTo(hole[i].x, hole[i].z)
    }
    path.closePath()
    shape.holes.push(path)
  }
  const shapeGeo = new THREE.ShapeGeometry(shape)
  const posAttr = shapeGeo.getAttribute('position')
  const indexAttr = shapeGeo.index
  const base = positions.length / 3
  for (let i = 0; i < posAttr.count; i += 1) {
    const px = posAttr.getX(i)
    const pz = posAttr.getY(i)
    positions.push(px, y, pz)
    normals.push(0, 1, 0)
    uvs.push(px / 32, pz / 32)
  }
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 1) {
      indices.push(base + indexAttr.getX(i))
    }
  }
  shapeGeo.dispose()
}

/** Geschlossenes U-Profil mit Gehrung entlang ausgewählter Traufkanten. */
function buildGutterGeometry(
  eave: Array<{ x: number; z: number }>,
  eaveY: number,
  edgeActive: boolean[],
  gaps: Array<Array<[number, number]>> = [],
): THREE.BufferGeometry | null {
  const n = eave.length
  if (n < 2) return null
  const segments: Array<Array<{ x: number; z: number }>> = []
  let current: Array<{ x: number; z: number }> = []
  const hasGaps = gaps.some((g) => g && g.length > 0)
  const flush = () => {
    if (current.length >= 2) segments.push(current)
    current = []
  }
  for (let i = 0; i < n; i += 1) {
    if (!edgeActive[i]) {
      flush()
      continue
    }
    const a = eave[i]
    const b = eave[(i + 1) % n]
    const edgeGaps = gaps[i] ?? []
    if (edgeGaps.length === 0) {
      if (current.length === 0) current.push({ ...a })
      current.push({ ...b })
      continue
    }
    // Traufdurchbruch: Rinne nur in den Reststücken, Kette dort unterbrechen.
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    for (const [t0, t1] of complementIntervals(edgeGaps)) {
      if (t0 > 1e-6) {
        flush()
        current.push(at(t0))
      } else if (current.length === 0) {
        current.push({ ...a })
      }
      current.push(t1 < 1 - 1e-6 ? at(t1) : { ...b })
      if (t1 < 1 - 1e-6) flush()
    }
  }
  // Geschlossener Ring: alle Kanten aktiv → ein Polygon
  if (edgeActive.every(Boolean) && !hasGaps) {
    segments.length = 0
    segments.push(eave.map((p) => ({ ...p })))
  } else if (current.length >= 2) {
    segments.push(current)
  }
  // Offene Ketten am Ring-Wrap zusammenführen
  if (
    edgeActive[0] &&
    edgeActive[n - 1] &&
    !(edgeActive.every(Boolean) && !hasGaps) &&
    segments.length >= 2
  ) {
    const first = segments[0]
    const last = segments[segments.length - 1]
    if (
      Math.hypot(last[last.length - 1].x - first[0].x, last[last.length - 1].z - first[0].z) < 1e-3
    ) {
      segments[0] = [...last.slice(0, -1), ...first]
      segments.pop()
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const w = 8
  const h = 6
  const drop = 4
  const lip = 2
  const yTop = eaveY - drop
  const yBot = yTop - h

  for (const path of segments) {
    if (path.length < 2) continue
    const closed =
      path.length >= 3 &&
      Math.hypot(path[0].x - path[path.length - 1].x, path[0].z - path[path.length - 1].z) < 1e-3
    const pts = closed ? path.slice(0, -1) : path
    if (pts.length < 2) continue
    sweepGutterPath(positions, normals, uvs, indices, pts, closed, yTop, yBot, w, lip)
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Querschnitt: innen Lippe → außen → Boden → innen unten (geschlossen). */
function gutterProfile(
  outward: THREE.Vector3,
  origin: THREE.Vector3,
  yTop: number,
  yBot: number,
  w: number,
  lip: number,
): THREE.Vector3[] {
  const o = outward.clone().normalize()
  const base = new THREE.Vector3(origin.x, yTop, origin.z)
  return [
    base.clone().addScaledVector(o, -lip),
    base.clone().addScaledVector(o, w),
    new THREE.Vector3(origin.x, yBot, origin.z).addScaledVector(o, w),
    new THREE.Vector3(origin.x, yBot, origin.z).addScaledVector(o, -lip),
  ]
}

function edgeFrame(
  a: { x: number; z: number },
  b: { x: number; z: number },
): { tangent: THREE.Vector3; outward: THREE.Vector3 } {
  const tangent = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
  // CCW Außen
  const outward = new THREE.Vector3(tangent.z, 0, -tangent.x)
  return { tangent, outward }
}

function miterOutward(
  prevOut: THREE.Vector3,
  nextOut: THREE.Vector3,
): THREE.Vector3 {
  const m = prevOut.clone().add(nextOut)
  if (m.lengthSq() < 1e-8) return nextOut.clone()
  m.normalize()
  const cosHalf = Math.max(0.25, m.dot(nextOut))
  return m.multiplyScalar(1 / cosHalf)
}

function sweepGutterPath(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  pts: Array<{ x: number; z: number }>,
  closed: boolean,
  yTop: number,
  yBot: number,
  w: number,
  lip: number,
) {
  const count = pts.length
  const frames: Array<{ outward: THREE.Vector3; origin: THREE.Vector3 }> = []
  for (let i = 0; i < count; i += 1) {
    const prev = pts[(i - 1 + count) % count]
    const curr = pts[i]
    const next = pts[(i + 1) % count]
    let outward: THREE.Vector3
    if (!closed && i === 0) {
      outward = edgeFrame(curr, next).outward
    } else if (!closed && i === count - 1) {
      outward = edgeFrame(prev, curr).outward
    } else {
      const a = edgeFrame(prev, curr).outward
      const b = edgeFrame(curr, next).outward
      outward = miterOutward(a, b)
    }
    frames.push({
      outward,
      origin: new THREE.Vector3(curr.x, 0, curr.z),
    })
  }

  const rings: THREE.Vector3[][] = frames.map((f) =>
    gutterProfile(f.outward, f.origin, yTop, yBot, w, lip),
  )

  const ringCount = closed ? count : count
  const segCount = closed ? count : count - 1
  for (let i = 0; i < segCount; i += 1) {
    const j = (i + 1) % ringCount
    const r0 = rings[i]
    const r1 = rings[j]
    for (let k = 0; k < r0.length; k += 1) {
      const k2 = (k + 1) % r0.length
      appendQuad(positions, normals, uvs, indices, r0[k], r1[k], r1[k2], r0[k2])
    }
  }
  if (!closed) {
    // Endkappen
    capRing(positions, normals, uvs, indices, rings[0], true)
    capRing(positions, normals, uvs, indices, rings[rings.length - 1], false)
  }
}

function capRing(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  ring: THREE.Vector3[],
  flip: boolean,
) {
  if (ring.length < 3) return
  const a = ring[0]
  const b = ring[1]
  const c = ring[2]
  const d = ring[3]
  if (flip) appendQuad(positions, normals, uvs, indices, a, d, c, b)
  else appendQuad(positions, normals, uvs, indices, a, b, c, d)
}

function roofPanelConfig(roof: RoofConfig): StudioPanelConfig {
  return {
    panelWidth: roof.tileWidth,
    panelHeight: roof.tileHeight,
    joint: roof.tileJoint,
    pattern: roof.tilePattern,
    cornerJoin: 'miter',
    projectDepth: roof.tileProjectDepth,
    taper: roof.tileTaper,
    taperDepth: roof.tileTaperDepth,
    enabled: true,
  }
}

function fakeWall(width: number, height: number): Wall {
  return {
    id: 'roof-facet',
    kind: 'studio',
    width: Math.max(8, width),
    height: Math.max(8, height),
    depth: 32,
    x: 0,
    y: 0,
    openings: [],
    profiles: [],
    neighbors: {},
  }
}

function profileOffset(profile: RoofTileProfile, u: number, tileIndex: number): number {
  const t = Math.max(0, Math.min(1, u))
  if (profile === 'barrel') {
    const wave = Math.sin(Math.PI * t)
    return tileIndex % 2 === 0 ? wave : -wave * 0.65
  }
  // Pantile: S-Kurve (Mulde + Wulst)
  return Math.sin(Math.PI * 2 * t) * 0.55 + Math.sin(Math.PI * t) * 0.35
}

function addTiledFacet(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  L0: THREE.Vector3,
  L1: THREE.Vector3,
  U1: THREE.Vector3,
  U0: THREE.Vector3,
  roof: RoofConfig,
) {
  const width = L0.distanceTo(L1)
  const height = L0.distanceTo(U0)
  if (width < 4 || height < 4) {
    appendQuad(positions, normals, uvs, indices, L0, L1, U1, U0)
    return
  }

  const wall = fakeWall(width, height)
  const tiles = layoutPanelTiles(wall, roofPanelConfig(roof), [])
  const along = new THREE.Vector3().subVectors(L1, L0)
  const up = new THREE.Vector3().subVectors(U0, L0)
  const normal = new THREE.Vector3().crossVectors(along, up).normalize()
  if (normal.lengthSq() < 1e-8) {
    appendQuad(positions, normals, uvs, indices, L0, L1, U1, U0)
    return
  }

  const depth = roof.tileProjectDepth
  const taperDepth = roof.tileTaperDepth
  const taper = Math.max(0.005, Math.min(1, roof.tileTaper))
  const samples = 3

  const pointOnFacet = (u: number, v: number) => {
    const lo = new THREE.Vector3().lerpVectors(L0, L1, u)
    const hi = new THREE.Vector3().lerpVectors(U0, U1, u)
    return new THREE.Vector3().lerpVectors(lo, hi, v)
  }

  let tileIndex = 0
  for (const tile of tiles) {
    const u0 = tile.x / width
    const u1 = (tile.x + tile.width) / width
    const v0 = tile.y / height
    const v1 = (tile.y + tile.height) / height
    // Wie Paneele: Inset in cm aus Kachelmaß × (1−taper), nicht nur UV-Anteil
    const insetU = Math.min((tile.width / 2) * (1 - taper), tile.width * 0.45) / width
    const insetV = Math.min((tile.height / 2) * (1 - taper), tile.height * 0.45) / height
    const cols: THREE.Vector3[] = []
    const colsFront: THREE.Vector3[] = []
    const colsTip: THREE.Vector3[] = []

    for (let s = 0; s <= samples; s += 1) {
      const fu = s / samples
      const u = u0 + (u1 - u0) * fu
      const amp = profileOffset(roof.tileProfile, fu, tileIndex) * depth * 0.85
      const p0 = pointOnFacet(u, v0)
      const p1 = pointOnFacet(u, v1)
      cols.push(p0.clone(), p1.clone())
      const nOff = normal.clone().multiplyScalar(depth + amp)
      colsFront.push(p0.clone().add(nOff), p1.clone().add(nOff))
      if (taperDepth > 1e-4) {
        const uu = THREE.MathUtils.clamp(u, u0 + insetU, u1 - insetU)
        const tipAmp = profileOffset(roof.tileProfile, fu, tileIndex) * depth * 0.35
        const tipN = normal.clone().multiplyScalar(depth + taperDepth + tipAmp)
        const t0 = pointOnFacet(uu, v0 + insetV).add(tipN)
        const t1 = pointOnFacet(uu, v1 - insetV).add(tipN)
        colsTip.push(t0, t1)
      }
    }

    // Seitenwände + Front als Streifen
    for (let s = 0; s < samples; s += 1) {
      const i = s * 2
      const j = (s + 1) * 2
      // Unterseite (Dachhaut) weglassen — darunter liegt die Konstruktion
      // Front
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        colsFront[i],
        colsFront[j],
        colsFront[j + 1],
        colsFront[i + 1],
      )
      // Seiten längs (unten→front)
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        cols[i],
        colsFront[i],
        colsFront[i + 1],
        cols[i + 1],
      )
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        cols[j],
        cols[j + 1],
        colsFront[j + 1],
        colsFront[j],
      )
    }
    // Stirnflächen an u0/u1
    appendQuad(
      positions,
      normals,
      uvs,
      indices,
      cols[0],
      cols[1],
      colsFront[1],
      colsFront[0],
    )
    const last = samples * 2
    appendQuad(
      positions,
      normals,
      uvs,
      indices,
      cols[last],
      colsFront[last],
      colsFront[last + 1],
      cols[last + 1],
    )

    if (colsTip.length === colsFront.length) {
      for (let s = 0; s < samples; s += 1) {
        const i = s * 2
        const j = (s + 1) * 2
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsFront[i],
          colsFront[j],
          colsTip[j],
          colsTip[i],
        )
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsFront[i + 1],
          colsTip[i + 1],
          colsTip[j + 1],
          colsFront[j + 1],
        )
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsTip[i],
          colsTip[j],
          colsTip[j + 1],
          colsTip[i + 1],
        )
      }
    }

    tileIndex += 1
  }
}

function buildTiledBands(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  lower: Array<{ x: number; z: number }>,
  upper: Array<{ x: number; z: number }>,
  y0: number,
  y1: number,
  roof: RoofConfig,
  smooth = false,
  openingHoles: XZ[][] = [],
) {
  const n = Math.min(lower.length, upper.length)
  if (n < 3) return
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const L0 = new THREE.Vector3(lower[i].x, y0, lower[i].z)
    const L1 = new THREE.Vector3(lower[j].x, y0, lower[j].z)
    const U1 = new THREE.Vector3(upper[j].x, y1, upper[j].z)
    const U0 = new THREE.Vector3(upper[i].x, y1, upper[i].z)
    if (smooth) {
      const poly: XZ[] = [lower[i], lower[j], upper[j], upper[i]]
      const holes: XZ[][] = []
      for (const foot of openingHoles) {
        if (foot.length < 3) continue
        const hit = intersectConvexPolygons(poly, foot)
        if (hit.length >= 3) holes.push(hit)
      }
      if (holes.length === 0) {
        appendQuad(positions, normals, uvs, indices, L0, L1, U1, U0)
      } else {
        // Bilineare Höhe über dem Facetten-Quad in XZ
        const heightAt = (p: XZ) => {
          // Projektion auf Facette: u entlang lower, v lower→upper
          const abx = lower[j].x - lower[i].x
          const abz = lower[j].z - lower[i].z
          const len2 = abx * abx + abz * abz || 1
          let u = ((p.x - lower[i].x) * abx + (p.z - lower[i].z) * abz) / len2
          u = Math.max(0, Math.min(1, u))
          const lo = { x: lower[i].x + abx * u, z: lower[i].z + abz * u }
          const hi = {
            x: upper[i].x + (upper[j].x - upper[i].x) * u,
            z: upper[i].z + (upper[j].z - upper[i].z) * u,
          }
          const run = Math.hypot(hi.x - lo.x, hi.z - lo.z) || 1
          let v = ((p.x - lo.x) * (hi.x - lo.x) + (p.z - lo.z) * (hi.z - lo.z)) / (run * run)
          v = Math.max(0, Math.min(1, v))
          return y0 + (y1 - y0) * v
        }
        appendLiftedPolygonWithHoles(positions, normals, uvs, indices, poly, heightAt, holes)
      }
    } else {
      addTiledFacet(positions, normals, uvs, indices, L0, L1, U1, U0, roof)
    }
  }
}

function appendLiftedPolygonWithHoles(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  poly: XZ[],
  heightAt: (p: XZ) => number,
  holes: XZ[][],
) {
  if (poly.length < 3) return
  const contour = poly.map((p) => new THREE.Vector2(p.x, p.z))
  const holeContours = holes
    .filter((h) => h.length >= 3)
    .map((h) => h.map((p) => new THREE.Vector2(p.x, p.z)))
  let tris: number[][]
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, holeContours)
  } catch {
    tris = THREE.ShapeUtils.triangulateShape(contour, [])
  }
  const flat = [...poly, ...holes.filter((h) => h.length >= 3).flat()]
  for (const tri of tris) {
    const pa = flat[tri[0]]
    const pb = flat[tri[1]]
    const pc = flat[tri[2]]
    if (!pa || !pb || !pc) continue
    const a = new THREE.Vector3(pa.x, heightAt(pa), pa.z)
    const b = new THREE.Vector3(pb.x, heightAt(pb), pb.z)
    const c = new THREE.Vector3(pc.x, heightAt(pc), pc.z)
    appendTri(positions, normals, uvs, indices, a, b, c)
  }
}

function buildRidgeTiles(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  ridge: Array<{ x: number; z: number }>,
  y: number,
  roof: RoofConfig,
) {
  const n = ridge.length
  if (n < 2) return
  const R = Math.max(2, roof.tileProjectDepth * 1.2)
  const step = Math.max(8, roof.tileWidth)
  for (let i = 0; i < n; i += 1) {
    const a = ridge[i]
    const b = ridge[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const dx = (b.x - a.x) / len
    const dz = (b.z - a.z) / len
    const ox = dz
    const oz = -dx
    const count = Math.max(1, Math.floor(len / step))
    for (let k = 0; k < count; k += 1) {
      const t0 = k / count
      const t1 = (k + 1) / count
      const samples = 8
      for (let s = 0; s < samples; s += 1) {
        const a0 = (Math.PI * s) / samples
        const a1 = (Math.PI * (s + 1)) / samples
        const p00 = new THREE.Vector3(
          a.x + dx * len * t0 + ox * Math.cos(a0) * R,
          y + Math.sin(a0) * R,
          a.z + dz * len * t0 + oz * Math.cos(a0) * R,
        )
        const p10 = new THREE.Vector3(
          a.x + dx * len * t1 + ox * Math.cos(a0) * R,
          y + Math.sin(a0) * R,
          a.z + dz * len * t1 + oz * Math.cos(a0) * R,
        )
        const p11 = new THREE.Vector3(
          a.x + dx * len * t1 + ox * Math.cos(a1) * R,
          y + Math.sin(a1) * R,
          a.z + dz * len * t1 + oz * Math.cos(a1) * R,
        )
        const p01 = new THREE.Vector3(
          a.x + dx * len * t0 + ox * Math.cos(a1) * R,
          y + Math.sin(a1) * R,
          a.z + dz * len * t0 + oz * Math.cos(a1) * R,
        )
        appendQuad(positions, normals, uvs, indices, p00, p10, p11, p01)
      }
    }
  }
}

export interface RoofBuildResult {
  roof: THREE.BufferGeometry
  gutter: THREE.BufferGeometry | null
  /** Giebel-/Füllwände über der Traufe (nur Sattel/Walm/Krüppelwalm/Pult). */
  gable: THREE.BufferGeometry | null
  tileColor: string
  gutterColor: string
  gableColor: string
}

interface RoofSinks {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
  gutterPositions: number[]
  gutterNormals: number[]
  gutterUvs: number[]
  gutterIndices: number[]
  gablePositions: number[]
  gableNormals: number[]
  gableUvs: number[]
  gableIndices: number[]
}

/** Gemeinsame Vorbereitung: Traufhöhe, Ring, Kanten, Überstand. */
function roofBase(building: Building, roof: RoofConfig): {
  outer: XZ[]
  holes: XZ[][]
  eave: XZ[]
  eaveY: number
  wallTopY: number
  edges: RoofEdgeInfo[]
  edgeOverhang: number[]
} | null {
  const floors = building.floors
  if (!floors || floors.length === 0) return null
  const face = topRoofFaceWorld(floors[floors.length - 1])
  if (!face || face.outer.length < 3) return null
  const outer = orientRingCcw(face.outer)
  const edges = listRoofEdgesForRing(building, roof, outer)
  const edgeOverhang = overhangPerEdge(edges, roof.overhang)
  // Traufe: Ebenen am Wandring (`outer`). An der Wandlinie y≈eaveY, Spitze tiefer um oh·tan
  // (Neigung verlängert nach außen — v2.0.481). eaveY = wallTop + tv → Soffit an Wand = wallTop.
  // v2.0.505 zog zusätzlich oh·tan ab → Doppelzählung, Dach/Gesims verzerrt (revert v2.0.506).
  const topFloor = floors.length - 1
  const wallTopY = storeyTopY(building, topFloor)
  const pitchForSlab = roof.kind === 'mansard' ? roof.pitchLower : roof.pitch
  const slabLift = roofSlabVerticalCm(pitchForSlab)
  const eaveY = wallTopY + slabLift
  return {
    outer,
    holes: face.holes,
    eave: offsetPolygonPerEdge(outer, edgeOverhang),
    eaveY,
    wallTopY,
    edges,
    edgeOverhang,
  }
}

/**
 * Envelope-Dach (Sattel/Walm/Krüppelwalm/Pult) für UI-Abfragen wie Firsthöhe
 * oder Kantenrollen — ohne Geometrie. `null` bei Mansarde oder fehlendem Ring.
 */
export function roofEnvelopeForBuilding(building: Building, rawRoof?: Partial<RoofConfig> | null): RoofEnvelope | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  if (roof.kind === 'mansard') return null
  const base = roofBase(building, roof)
  if (!base) return null
  return buildRoofEnvelope({
    kind: roof.kind,
    outer: base.outer,
    eave: base.eave,
    eaveY: base.eaveY,
    wallTopY: base.wallTopY,
    flush: base.edges.map((e) => e.flush),
    roof,
  })
}

/** Firsthöhe über Traufe (cm) — Mansarde: `ridgeHeight`, sonst aus dem Envelope. */
export function roofRidgeHeightCm(building: Building, rawRoof?: Partial<RoofConfig> | null): number {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  if (roof.kind === 'mansard') return roof.ridgeHeight
  const env = roofEnvelopeForBuilding(building, roof)
  return env ? Math.max(0, env.ridgeY - env.eaveY) : 0
}

/**
 * Berliner Mansarde: Ziegel (oder glatte Bänder) auf den Mänteln, Firstziegel,
 * optional gehrungene Rinne. Bündige Kanten: Überstand 0, keine Rinne.
 */
function buildMansardRoofForBuilding(
  building: Building,
  roof: RoofConfig,
  sinks: RoofSinks,
  openingHoles: XZ[][] = [],
): boolean {
  const base = roofBase(building, roof)
  if (!base) return false
  const { positions, normals, uvs, indices } = sinks
  const { eave, eaveY, edgeOverhang, holes } = base
  const smooth = roofEffectiveCovering(roof) === 'smooth'
  const breakRise = roof.ridgeHeight * 0.55
  const upperRise = roof.ridgeHeight - breakRise
  const breakPoly = insetByPitch(eave, breakRise, roof.pitchLower)
  const ridgePoly = insetByPitch(breakPoly, upperRise, roof.pitchUpper)
  const ridgeHoles = [
    ...holes
      .map((hole) =>
        insetByPitch(hole, breakRise + upperRise, (roof.pitchLower + roof.pitchUpper) * 0.5),
      )
      .filter((h) => h.length >= 3),
    ...openingHoles,
  ]

  buildTiledBands(
    positions,
    normals,
    uvs,
    indices,
    eave,
    breakPoly,
    eaveY,
    eaveY + breakRise,
    roof,
    smooth,
    openingHoles,
  )
  buildTiledBands(
    positions,
    normals,
    uvs,
    indices,
    breakPoly,
    ridgePoly,
    eaveY + breakRise,
    eaveY + roof.ridgeHeight,
    roof,
    smooth,
    openingHoles,
  )
  buildCap(positions, normals, uvs, indices, ridgePoly, eaveY + roof.ridgeHeight, ridgeHoles)
  if (!smooth) {
    buildRidgeTiles(positions, normals, uvs, indices, ridgePoly, eaveY + roof.ridgeHeight, roof)
  }

  const edgeActive = edgeOverhang.map((d) => d > 0.5)
  appendGutter(sinks, roof, eave, eaveY, edgeActive)
  return true
}

/** Sattel/Walm/Krüppelwalm/Pult: glatte Platte + Füllwände + Rinne an Traufkanten. */
function buildEnvelopeRoofForBuilding(
  building: Building,
  roof: RoofConfig,
  sinks: RoofSinks,
  extraHoles: XZ[][] = [],
  eaveCuts: RoofEaveCut[] = [],
): boolean {
  const base = roofBase(building, roof)
  if (!base) return false
  const env = buildRoofEnvelope({
    kind: roof.kind,
    outer: base.outer,
    eave: base.eave,
    eaveY: base.eaveY,
    wallTopY: base.wallTopY,
    flush: base.edges.map((e) => e.flush),
    roof,
  })
  if (!env) return false
  const built = buildRoofEnvelopeGeometry(env, roof.crossGables ?? [], roof.pitch, extraHoles, eaveCuts)
  appendBufferGeometry(built.roof, sinks.positions, sinks.normals, sinks.uvs, sinks.indices)
  built.roof.dispose()
  if (built.gable) {
    appendBufferGeometry(
      built.gable,
      sinks.gablePositions,
      sinks.gableNormals,
      sinks.gableUvs,
      sinks.gableIndices,
    )
    built.gable.dispose()
  }
  appendGutter(sinks, roof, env.eave, built.gutterEaveY, built.gutterEdgeActive, built.gutterGaps)
  return true
}

function appendGutter(
  sinks: RoofSinks,
  roof: RoofConfig,
  eave: XZ[],
  eaveY: number,
  edgeActive: boolean[],
  gaps: Array<Array<[number, number]>> = [],
) {
  if (!roof.gutter || !edgeActive.some(Boolean)) return
  const gutterGeo = buildGutterGeometry(eave, eaveY, edgeActive, gaps)
  if (!gutterGeo) return
  appendBufferGeometry(
    gutterGeo,
    sinks.gutterPositions,
    sinks.gutterNormals,
    sinks.gutterUvs,
    sinks.gutterIndices,
  )
  gutterGeo.dispose()
}

function buildRoofForBuilding(
  building: Building,
  roof: RoofConfig,
  sinks: RoofSinks,
  openingHoles: XZ[][] = [],
  eaveCuts: RoofEaveCut[] = [],
): boolean {
  if (!roof.enabled) return false
  // Mansarde: nur Löcher (Traufschnitte betreffen die Envelope-Formen; Rinne/Stirn der Mansarde bleiben).
  if (roof.kind === 'mansard') return buildMansardRoofForBuilding(building, roof, sinks, openingHoles)
  return buildEnvelopeRoofForBuilding(building, roof, sinks, openingHoles, eaveCuts)
}

function appendBufferGeometry(
  geo: THREE.BufferGeometry,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
) {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute
  const indexAttr = geo.index
  const base = positions.length / 3
  for (let i = 0; i < posAttr.count; i += 1) {
    positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
    normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i))
    uvs.push(uvAttr.getX(i), uvAttr.getY(i))
  }
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 1) {
      indices.push(base + indexAttr.getX(i))
    }
  }
}

export function buildMansardRoof(
  state: FacadeState,
  raw?: Partial<RoofConfig> | null,
  openingHoles: XZ[][] = [],
  eaveCuts: RoofEaveCut[] = [],
): RoofBuildResult | null {
  const visibleBuildings = state.buildings.filter((building) => !building.hidden)
  if (visibleBuildings.length === 0) return null

  const sinks: RoofSinks = {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    gutterPositions: [],
    gutterNormals: [],
    gutterUvs: [],
    gutterIndices: [],
    gablePositions: [],
    gableNormals: [],
    gableUvs: [],
    gableIndices: [],
  }

  let tileColor = DEFAULT_ROOF.tileColor
  let gutterColor = DEFAULT_ROOF.gutterColor ?? '#8E8A88'
  let gableColor = DEFAULT_WALL_COLOR
  let anyBuilt = false

  for (const building of visibleBuildings) {
    const roof = normalizeRoof(raw ?? building.roof)
    if (buildRoofForBuilding(building, roof, sinks, openingHoles, eaveCuts)) {
      anyBuilt = true
      tileColor = roof.tileColor
      gutterColor = roof.gutterColor ?? gutterColor
      gableColor = roof.gableColor ?? gableColor
    }
  }

  if (!anyBuilt || sinks.positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sinks.positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(sinks.normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(sinks.uvs, 2))
  geo.setIndex(sinks.indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()

  const packGeometry = (
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
  ): THREE.BufferGeometry | null => {
    if (positions.length === 0) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(indices)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }

  return {
    roof: geo,
    gutter: packGeometry(sinks.gutterPositions, sinks.gutterNormals, sinks.gutterUvs, sinks.gutterIndices),
    gable: packGeometry(sinks.gablePositions, sinks.gableNormals, sinks.gableUvs, sinks.gableIndices),
    tileColor,
    gutterColor,
    gableColor,
  }
}