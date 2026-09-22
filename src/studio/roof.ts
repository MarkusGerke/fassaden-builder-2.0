import * as THREE from 'three'
import type {
  Building,
  DownpipeFixture,
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
  appendEaveBoxSkirtToArrays,
  buildRoofEnvelope,
  buildRoofEnvelopeGeometry,
  complementIntervals,
  edgeCompassLabel,
  edgeCutIntervals,
  edgeOutwardXZ,
  intersectConvexPolygons,
  isRoofKind,
  orientRingCcw,
  ROOF_SLAB_THICKNESS_CM,
  roofEdgeKey,
  roofSlabVerticalCm,
  roofEnvelopeHeightAt,
  yawToDirXZ,
  type RoofEaveCut,
  type RoofEnvelope,
  type XZ,
} from './roofForms'
import { isStudioWall, wallEndPoint, wallHasPanels, wallStartPoint } from './walls'

export type { RoofConfig, RoofTileProfile }
export {
  ROOF_KIND_LABELS,
  ROOF_KINDS,
  roofKindUsesPitch,
  roofKindUsesRidgeDir,
  roofKindUsesRidgeRise,
  roofPitchDegFromRidgeRise,
  roofKindUsesBoxedEave,
} from './roofForms'

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
  const edgeOverhangCm = normalizeEdgeOverhangCm(base.edgeOverhangCm)
  const overhangCompass = normalizeOverhangCompass(base.overhangCompass)
  const ridgeRiseCm =
    base.ridgeRiseCm !== undefined && Number.isFinite(base.ridgeRiseCm)
      ? snap8(clamp(base.ridgeRiseCm, 40, 600))
      : undefined
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
    ...(ridgeRiseCm !== undefined ? { ridgeRiseCm } : {}),
    ...(edgeOverhangCm ? { edgeOverhangCm } : {}),
    ...(overhangCompass ? { overhangCompass } : {}),
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

const COMPASS_DIRS = new Set(['N', 'O', 'S', 'W'])

function normalizeEdgeOverhangCm(
  raw?: Record<string, number> | null,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (!Number.isFinite(val)) continue
    out[key] = snap8(clamp(val, 0, 120))
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeOverhangCompass(
  raw?: Partial<Record<'N' | 'O' | 'S' | 'W', number>> | null,
): Partial<Record<'N' | 'O' | 'S' | 'W', number>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Partial<Record<'N' | 'O' | 'S' | 'W', number>> = {}
  for (const dir of COMPASS_DIRS) {
    const val = raw[dir as 'N' | 'O' | 'S' | 'W']
    if (val === undefined || !Number.isFinite(val)) continue
    out[dir as 'N' | 'O' | 'S' | 'W'] = snap8(clamp(val, 0, 120))
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Wirksamer Überstand (cm) für eine Traufkante. */
export function effectiveEdgeOverhangCm(edge: RoofEdgeInfo, roof: RoofConfig): number {
  const direct = roof.edgeOverhangCm?.[edge.key]
  if (direct !== undefined) return direct
  const compass = roof.overhangCompass?.[edge.compass as 'N' | 'O' | 'S' | 'W']
  if (compass !== undefined) return compass
  return roof.overhang
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
  const run = pitchRun(riseCm, pitchDeg)
  return offsetPolygonXZ(poly, -run)
}

/** Mansarde: Stirnseiten bleiben auf der Wand, nur vorne/hinten laufen ein. */
function insetMansard(
  poly: Array<{ x: number; z: number }>,
  riseCm: number,
  pitchDeg: number,
  roof: RoofConfig,
): Array<{ x: number; z: number }> {
  const run = pitchRun(riseCm, pitchDeg)
  const ends = ridgeEndEdgeMask(poly, ridgeAxisDir(roof, poly))
  return offsetPolygonPerEdge(
    poly,
    ends.map((end) => (end ? 0 : -run)),
  )
}

function pitchRun(riseCm: number, pitchDeg: number): number {
  const rad = (pitchDeg * Math.PI) / 180
  return riseCm / Math.tan(Math.max(0.15, rad))
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
  /** Wirksam bündig (Rinne/Giebel): `flush`, oder `auto` und Wand ohne Paneele. Unabhängig vom Traufüberstand. */
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
    const sideFlush = ridgeEndEdgeMask(outer, ridgeAxisDir(roof, outer))[i] === true
    const flush = sideFlush || mode === 'flush' || (mode === 'auto' && autoFlush)
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

/** Traufüberstand nur bei explizit bündiger Kante aus — sonst Kante/Kompass/Fallback. */
export function overhangPerEdge(
  edges: RoofEdgeInfo[],
  roofOrOverhang: RoofConfig | number,
): number[] {
  if (typeof roofOrOverhang === 'number') {
    const overhang = roofOrOverhang
    return edges.map((edge) => (edge.mode === 'flush' ? 0 : overhang))
  }
  const roof = roofOrOverhang
  return edges.map((edge) => (edge.mode === 'flush' ? 0 : effectiveEdgeOverhangCm(edge, roof)))
}

/** Firstachse: gespeicherter Winkel, sonst die längste Ringkante. */
function ridgeAxisDir(roof: RoofConfig, ring: XZ[]): XZ {
  if (roof.ridgeDeg !== null && roof.ridgeDeg !== undefined) return yawToDirXZ(roof.ridgeDeg)
  let best = { x: 1, z: 0 }
  let bestLen = -1
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > bestLen) {
      bestLen = len
      best = { x: (b.x - a.x) / (len || 1), z: (b.z - a.z) / (len || 1) }
    }
  }
  return best
}

/** Stirnkanten der Firstachse (links/rechts zur Fassade): immer wandbündig, ohne Schräge. */
function ridgeEndEdgeMask(ring: XZ[], d: XZ): boolean[] {
  let tMin = Infinity
  let tMax = -Infinity
  for (const p of ring) {
    const t = d.x * p.x + d.z * p.z
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length]!
    const ta = d.x * a.x + d.z * a.z
    const tb = d.x * b.x + d.z * b.z
    return (
      (Math.abs(ta - tMin) < 0.5 && Math.abs(tb - tMin) < 0.5) ||
      (Math.abs(ta - tMax) < 0.5 && Math.abs(tb - tMax) < 0.5)
    )
  })
}

/**
 * Kantenmodi bei Form- oder Firstrichtungswechsel.
 * Stirnseiten der aktuellen Achse sind bündig; Traufen behalten den Überstand.
 * Pult: nur die tiefe Traufe trägt Überstand und Rinne.
 */
export function edgeModesForRoofKind(
  building: Building,
  kind: RoofKind,
  roof: RoofConfig,
): Record<string, RoofEdgeMode> {
  const outer = roofOuterRing(building)
  if (!outer || outer.length < 3) return {}
  const modes: Record<string, RoofEdgeMode> = {}
  const markFlush = (index: number) => {
    const a = outer[index]!
    const b = outer[(index + 1) % outer.length]!
    modes[roofEdgeKey(a, b)] = 'flush'
  }
  if (kind === 'shed') {
    const high =
      roof.ridgeDeg !== null && roof.ridgeDeg !== undefined
        ? yawToDirXZ(roof.ridgeDeg)
        : (() => {
            let bestI = 0
            let bestLen = -1
            for (let i = 0; i < outer.length; i += 1) {
              const a = outer[i]!
              const b = outer[(i + 1) % outer.length]!
              const len = Math.hypot(b.x - a.x, b.z - a.z)
              if (len > bestLen) {
                bestLen = len
                bestI = i
              }
            }
            const out = edgeOutwardXZ(outer[bestI]!, outer[(bestI + 1) % outer.length]!)
            return { x: -out.x, z: -out.z }
          })()
    let low = 0
    let bestDot = -Infinity
    for (let i = 0; i < outer.length; i += 1) {
      const out = edgeOutwardXZ(outer[i]!, outer[(i + 1) % outer.length]!)
      const dot = -(out.x * high.x + out.z * high.z)
      if (dot > bestDot) {
        bestDot = dot
        low = i
      }
    }
    for (let i = 0; i < outer.length; i += 1) {
      if (i !== low) markFlush(i)
    }
    return modes
  }
  const ends = ridgeEndEdgeMask(outer, ridgeAxisDir(roof, outer))
  for (let i = 0; i < outer.length; i += 1) {
    if (ends[i]) markFlush(i)
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
  underside = false,
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
    normals.push(0, underside ? -1 : 1, 0)
    uvs.push(px / 32, pz / 32)
  }
  if (indexAttr) {
    if (underside) {
      for (let i = 0; i + 2 < indexAttr.count; i += 3) {
        indices.push(base + indexAttr.getX(i + 2), base + indexAttr.getX(i + 1), base + indexAttr.getX(i))
      }
    } else {
      for (let i = 0; i < indexAttr.count; i += 1) {
        indices.push(base + indexAttr.getX(i))
      }
    }
  }
  shapeGeo.dispose()
}

function appendRidgeSkirt(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  poly: Array<{ x: number; z: number }>,
  yTop: number,
  drop: number,
) {
  const n = poly.length
  const yBot = yTop - drop
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    const A = new THREE.Vector3(a.x, yTop, a.z)
    const B = new THREE.Vector3(b.x, yTop, b.z)
    const C = new THREE.Vector3(b.x, yBot, b.z)
    const D = new THREE.Vector3(a.x, yBot, a.z)
    const out = edgeOutwardXZ(a, b)
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(B, A),
      new THREE.Vector3().subVectors(C, A),
    )
    if (nrm.x * out.x + nrm.z * out.z >= 0) appendQuad(positions, normals, uvs, indices, A, B, C, D)
    else appendQuad(positions, normals, uvs, indices, A, D, C, B)
  }
}

/** Halbrunde Rinne, oben offen. Außendurchmesser 12 cm, Wand 5 mm. Vorderer Wulst 18 mm. */
export const GUTTER_OUTER_DIAMETER_CM = 12
export const GUTTER_WALL_CM = 0.5
export const GUTTER_BEAD_RADIUS_CM = 0.9
const GUTTER_ARC_SEGMENTS = 12
const GUTTER_BEAD_SEGMENTS = 8
/** Rinneneisen: Abstand, Abstand zu Ende und Stutzen, Bandbreite, Blechstärke. */
const GUTTER_BRACKET_SPACING_CM = 60
const GUTTER_BRACKET_CLEAR_CM = 10
const GUTTER_BRACKET_WIDTH_CM = 2.5
const GUTTER_BRACKET_THICK_CM = 0.45
/** Luft zwischen Rinneneisen und Rinne bzw. Stirnbrett — keine deckungsgleiche Fläche. */
const GUTTER_BRACKET_GAP_CM = 0.4

/** Halbrunde Rinne mit Gehrung entlang ausgewählter Traufkanten. Oberkante = übergebenes Y. */
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
  const yTop = eaveY

  for (const path of segments) {
    if (path.length < 2) continue
    const endsMeet =
      Math.hypot(path[0].x - path[path.length - 1].x, path[0].z - path[path.length - 1].z) < 1e-3
    // Voller Ring ohne doppelten Startpunkt: letzte Kante nicht fallen lassen, sonst
    // fehlt eine Seite und die beiden Enden stehen offen.
    const fullRing = edgeActive.every(Boolean) && !hasGaps && path.length === n
    const closed = path.length >= 3 && (endsMeet || fullRing)
    const pts = endsMeet ? path.slice(0, -1) : path
    if (pts.length < 2) continue
    sweepGutterPath(positions, normals, uvs, indices, pts, closed, yTop)
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

/**
 * Halbkreis, oben offen. Rückseite liegt am Ursprung (Dachkante),
 * der Bogen hängt nach außen und unten. Zwei Bögen = 5 mm Wand.
 */
function gutterProfile(outward: THREE.Vector3, origin: THREE.Vector3, yTop: number): THREE.Vector3[] {
  const len = outward.length() || 1
  const o = outward.clone().multiplyScalar(1 / len)
  const scale = len
  const outerR = GUTTER_OUTER_DIAMETER_CM / 2
  const innerR = outerR - GUTTER_WALL_CM
  const center = new THREE.Vector3(origin.x, yTop, origin.z).addScaledVector(o, outerR * scale)
  const seg = GUTTER_ARC_SEGMENTS
  const at = (radius: number, angle: number) =>
    center
      .clone()
      .addScaledVector(o, Math.cos(angle) * radius * scale)
      .add(new THREE.Vector3(0, -Math.sin(angle) * radius, 0))
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= seg; i += 1) pts.push(at(outerR, Math.PI - (Math.PI * i) / seg))
  for (let i = 0; i <= seg; i += 1) pts.push(at(innerR, (Math.PI * i) / seg))
  return pts
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

  const rings: THREE.Vector3[][] = frames.map((f) => gutterProfile(f.outward, f.origin, yTop))

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
  if (!closed && rings.length >= 2) {
    const startOut = new THREE.Vector3().subVectors(frames[0]!.origin, frames[1]!.origin)
    const last = frames.length - 1
    const endOut = new THREE.Vector3().subVectors(frames[last]!.origin, frames[last - 1]!.origin)
    capHalfRound(positions, normals, uvs, indices, rings[0]!, startOut)
    capHalfRound(positions, normals, uvs, indices, rings[last]!, endOut)
  }
  appendGutterBead(positions, normals, uvs, indices, frames, closed, yTop)
}

/** Abschluss der offenen Rinnenenden: Ring aus Außen- und Innenbogen. */
function capHalfRound(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  ring: THREE.Vector3[],
  outward: THREE.Vector3,
) {
  const seg = GUTTER_ARC_SEGMENTS
  if (ring.length < 2 * (seg + 1)) return
  for (let i = 0; i < seg; i += 1) {
    const o0 = ring[i]!
    const o1 = ring[i + 1]!
    const innerFront = ring[2 * seg - i]!
    const innerBack = ring[2 * seg + 1 - i]!
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(o1, o0),
      new THREE.Vector3().subVectors(innerFront, o0),
    )
    if (nrm.dot(outward) >= 0) appendQuad(positions, normals, uvs, indices, o0, o1, innerFront, innerBack)
    else appendQuad(positions, normals, uvs, indices, o0, innerBack, innerFront, o1)
  }
  // Der Ring schließt nur die Blechstärke. Der Hohlraum braucht einen Halbkreis,
  // sonst sieht man in die beiden Enden hinein.
  const innerStart = ring[seg + 1]!
  const innerEnd = ring[2 * seg + 1]!
  const center = new THREE.Vector3().addVectors(innerStart, innerEnd).multiplyScalar(0.5)
  for (let i = 0; i < seg; i += 1) {
    const a = ring[seg + 1 + i]!
    const b = ring[seg + 2 + i]!
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(a, center),
      new THREE.Vector3().subVectors(b, center),
    )
    if (nrm.dot(outward) >= 0) appendTri(positions, normals, uvs, indices, center, a, b)
    else appendTri(positions, normals, uvs, indices, center, b, a)
  }
}

/** Vorderer Wulst, tangential an der Außenkante. Berührt die Rinne nur längs einer Linie. */
function appendGutterBead(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  frames: Array<{ outward: THREE.Vector3; origin: THREE.Vector3 }>,
  closed: boolean,
  yTop: number,
) {
  const rings = frames.map((frame) => {
    const len = frame.outward.length() || 1
    const o = frame.outward.clone().multiplyScalar(1 / len)
    const center = frame.origin.clone()
    center.y = yTop
    center.addScaledVector(o, (GUTTER_OUTER_DIAMETER_CM + GUTTER_BEAD_RADIUS_CM) * len)
    const up = new THREE.Vector3(0, 1, 0)
    const ring: THREE.Vector3[] = []
    for (let i = 0; i < GUTTER_BEAD_SEGMENTS; i += 1) {
      const ang = (i / GUTTER_BEAD_SEGMENTS) * Math.PI * 2
      ring.push(
        center
          .clone()
          .addScaledVector(o, Math.cos(ang) * GUTTER_BEAD_RADIUS_CM)
          .addScaledVector(up, Math.sin(ang) * GUTTER_BEAD_RADIUS_CM),
      )
    }
    return { center, ring }
  })
  const count = rings.length
  const segCount = closed ? count : count - 1
  for (let i = 0; i < segCount; i += 1) {
    const j = (i + 1) % count
    const r0 = rings[i]!.ring
    const r1 = rings[j]!.ring
    for (let k = 0; k < GUTTER_BEAD_SEGMENTS; k += 1) {
      const k2 = (k + 1) % GUTTER_BEAD_SEGMENTS
      appendQuad(positions, normals, uvs, indices, r0[k]!, r1[k]!, r1[k2]!, r0[k2]!)
    }
  }
  if (closed) return
  const cap = (ring: THREE.Vector3[], center: THREE.Vector3, facing: THREE.Vector3) => {
    for (let k = 0; k < GUTTER_BEAD_SEGMENTS; k += 1) {
      const a = ring[k]!
      const b = ring[(k + 1) % GUTTER_BEAD_SEGMENTS]!
      const nrm = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(a, center),
        new THREE.Vector3().subVectors(b, center),
      )
      if (nrm.dot(facing) >= 0) appendTri(positions, normals, uvs, indices, center, a, b)
      else appendTri(positions, normals, uvs, indices, center, b, a)
    }
  }
  const startFace = new THREE.Vector3().subVectors(frames[0]!.origin, frames[1]!.origin)
  const last = frames.length - 1
  const endFace = new THREE.Vector3().subVectors(frames[last]!.origin, frames[last - 1]!.origin)
  cap(rings[0]!.ring, rings[0]!.center, startFace)
  cap(rings[last]!.ring, rings[last]!.center, endFace)
}

/**
 * Kurzes Rinneneisen: Lasche am Stirnbrett, Band unter dem Halbrund, Nase über dem Wulst.
 * Liegt 0,4 cm neben Rinne und Stirnbrett.
 */
function bracketCenterline(): Array<{ u: number; v: number }> {
  const radius = GUTTER_OUTER_DIAMETER_CM / 2
  const halfT = GUTTER_BRACKET_THICK_CM / 2
  const cradle = radius + GUTTER_BRACKET_GAP_CM + halfT
  const tabU = GUTTER_BRACKET_GAP_CM + halfT + 0.4
  const thetaBack = Math.acos(Math.max(-1, Math.min(1, (tabU - radius) / cradle)))
  const pts: Array<{ u: number; v: number }> = [
    { u: tabU, v: 0 },
    { u: tabU, v: -Math.sin(thetaBack) * cradle },
  ]
  const thetaFront = 0.55
  const steps = 7
  for (let i = 1; i <= steps; i += 1) {
    const theta = thetaBack + ((thetaFront - thetaBack) * i) / steps
    pts.push({ u: radius + Math.cos(theta) * cradle, v: -Math.sin(theta) * cradle })
  }
  const beadU = GUTTER_OUTER_DIAMETER_CM + GUTTER_BEAD_RADIUS_CM
  const nose = GUTTER_BEAD_RADIUS_CM + GUTTER_BRACKET_GAP_CM + halfT
  for (const deg of [230, 190, 150, 110, 70, 35]) {
    const ang = (deg * Math.PI) / 180
    pts.push({ u: beadU + Math.cos(ang) * nose, v: Math.sin(ang) * nose })
  }
  return pts
}

function appendGutterBracket(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  at: XZ,
  outward: XZ,
  yTop: number,
) {
  const path = bracketCenterline()
  const o = new THREE.Vector3(outward.x, 0, outward.z)
  const tangent = new THREE.Vector3(outward.z, 0, -outward.x)
  const up = new THREE.Vector3(0, 1, 0)
  const halfW = GUTTER_BRACKET_WIDTH_CM / 2
  const halfT = GUTTER_BRACKET_THICK_CM / 2
  const stations: THREE.Vector3[][] = []
  for (let i = 0; i < path.length; i += 1) {
    const prev = path[Math.max(0, i - 1)]!
    const next = path[Math.min(path.length - 1, i + 1)]!
    let du = next.u - prev.u
    let dv = next.v - prev.v
    const plen = Math.hypot(du, dv) || 1
    du /= plen
    dv /= plen
    let nu = -dv
    let nv = du
    const point = path[i]!
    if (nu * (point.u - 6) + nv * point.v < 0) {
      nu = -nu
      nv = -nv
    }
    const center = new THREE.Vector3(at.x, yTop, at.z)
      .addScaledVector(o, point.u)
      .addScaledVector(up, point.v)
    const nrm = o.clone().multiplyScalar(nu).addScaledVector(up, nv)
    stations.push([
      center.clone().addScaledVector(nrm, halfT).addScaledVector(tangent, halfW),
      center.clone().addScaledVector(nrm, halfT).addScaledVector(tangent, -halfW),
      center.clone().addScaledVector(nrm, -halfT).addScaledVector(tangent, -halfW),
      center.clone().addScaledVector(nrm, -halfT).addScaledVector(tangent, halfW),
    ])
  }
  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = stations[i]!
    const b = stations[i + 1]!
    for (let k = 0; k < 4; k += 1) {
      const k2 = (k + 1) % 4
      appendQuad(positions, normals, uvs, indices, a[k]!, a[k2]!, b[k2]!, b[k]!)
    }
  }
}

function gutterOutletTs(building: Building, eave: XZ[], edgeActive: boolean[]): number[][] {
  const out: number[][] = eave.map(() => [])
  const roof = normalizeRoof(building.roof)
  const base = roofBase(building, roof)
  if (!base || !roof.gutter) return out
  const n = Math.min(eave.length, base.edges.length)
  for (const dp of building.downpipes ?? []) {
    const wall = building.walls.find((item) => item.id === dp.anchorWallId)
    if (!wall) continue
    const edgeIndex = base.edges.findIndex((edge) => edgeMatchesWall(edge.a, edge.b, wall))
    if (edgeIndex < 0 || edgeIndex >= n || !edgeActive[edgeIndex]) continue
    const a = eave[edgeIndex]!
    const b = eave[(edgeIndex + 1) % eave.length]!
    const start = wallStartPoint(wall)
    const end = wallEndPoint(wall)
    const tWall = wall.width > 1 ? Math.max(0, Math.min(1, dp.localX / wall.width)) : 0.5
    const wx = start.x + (end.x - start.x) * tWall
    const wz = start.z + (end.z - start.z) * tWall
    const abx = b.x - a.x
    const abz = b.z - a.z
    const len2 = abx * abx + abz * abz || 1
    const t = Math.max(0, Math.min(1, ((wx - a.x) * abx + (wz - a.z) * abz) / len2))
    out[edgeIndex]!.push(t)
  }
  return out
}

function appendGutterBrackets(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  building: Building,
  eave: XZ[],
  yTop: number,
  edgeActive: boolean[],
  gaps: Array<Array<[number, number]>>,
) {
  const outlets = gutterOutletTs(building, eave, edgeActive)
  const n = eave.length
  for (let i = 0; i < n; i += 1) {
    if (!edgeActive[i]) continue
    const a = eave[i]!
    const b = eave[(i + 1) % n]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < GUTTER_BRACKET_CLEAR_CM * 2 + 8) continue
    const outward = edgeOutwardXZ(a, b)
    const avoid = outlets[i] ?? []
    for (const [t0, t1] of complementIntervals(gaps[i] ?? [])) {
      const d0 = t0 * len + GUTTER_BRACKET_CLEAR_CM
      const d1 = t1 * len - GUTTER_BRACKET_CLEAR_CM
      if (d1 - d0 < 8) continue
      const spots: number[] = []
      if (d1 - d0 <= GUTTER_BRACKET_SPACING_CM) spots.push((d0 + d1) / 2)
      else {
        for (let d = d0; d <= d1 + 0.01; d += GUTTER_BRACKET_SPACING_CM) spots.push(Math.min(d, d1))
      }
      for (const dist of spots) {
        const t = dist / len
        if (avoid.some((ot) => Math.abs(ot - t) * len < GUTTER_BRACKET_CLEAR_CM)) continue
        appendGutterBracket(
          positions,
          normals,
          uvs,
          indices,
          { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
          outward,
          yTop,
        )
      }
    }
  }
}

/** Rinnenboden an dieser Wand, wenn dort eine Rinne hängt. Sonst null (Giebel, bündig, Rinne aus). */
export function gutterMouthOnWall(
  building: Building,
  wallId: string,
  at: { x: number; z: number },
): { yTop: number; x: number; z: number; outward: { x: number; z: number } } | null {
  const roof = normalizeRoof(building.roof)
  if (!roof.enabled || !roof.gutter) return null
  const base = roofBase(building, roof)
  if (!base) return null
  const wall = building.walls.find((item) => item.id === wallId)
  if (!wall) return null
  const edge = base.edges.find((item) => edgeMatchesWall(item.a, item.b, wall))
  if (!edge || (base.edgeOverhang[edge.index] ?? 0) < 1) return null
  if (roof.kind !== 'mansard') {
    const env = buildRoofEnvelope({
      kind: roof.kind,
      outer: base.outer,
      eave: base.eave,
      eaveY: base.eaveY,
      wallTopY: base.wallTopY,
      flush: base.edges.map((item) => item.flush),
      roof,
    })
    if (!env?.isEave[edge.index]) return null
  }
  const a = base.eave[edge.index]!
  const b = base.eave[(edge.index + 1) % base.eave.length]!
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz || 1
  const t = Math.max(0, Math.min(1, ((at.x - a.x) * abx + (at.z - a.z) * abz) / len2))
  const px = a.x + abx * t
  const pz = a.z + abz * t
  const out = edgeOutwardXZ(a, b)
  const olen = Math.hypot(out.x, out.z) || 1
  const ox = out.x / olen
  const oz = out.z / olen
  const yTop = roof.kind === 'mansard' ? base.eaveY : gutterRimY(base, roof)
  return {
    yTop,
    x: px + ox * (GUTTER_OUTER_DIAMETER_CM / 2),
    z: pz + oz * (GUTTER_OUTER_DIAMETER_CM / 2),
    outward: { x: ox, z: oz },
  }
}

function gutterRimY(base: NonNullable<ReturnType<typeof roofBase>>, roof: RoofConfig): number {
  const env = buildRoofEnvelope({
    kind: roof.kind,
    outer: base.outer,
    eave: base.eave,
    eaveY: base.eaveY,
    wallTopY: base.wallTopY,
    flush: base.edges.map((item) => item.flush),
    roof,
  })
  if (!env) return base.eaveY - roofSlabVerticalCm(roof.pitch)
  const tips: number[] = []
  for (let i = 0; i < env.eave.length; i += 1) {
    if (!env.isEave[i]) continue
    const a = env.eave[i]!
    const b = env.eave[(i + 1) % env.eave.length]!
    tips.push(roofEnvelopeHeightAt(env, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }))
  }
  const tipY = tips.length > 0 ? tips.reduce((sum, y) => sum + y, 0) / tips.length : env.eaveY
  return tipY
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

/** Unterseite und Rand der Mansardenplatte, damit die Schräge nicht offen ist. */
function appendMansardShell(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  L0: THREE.Vector3,
  L1: THREE.Vector3,
  U1: THREE.Vector3,
  U0: THREE.Vector3,
  shell: 'eave' | 'ridge',
) {
  const drop = ROOF_SLAB_THICKNESS_CM
  const shift = (v: THREE.Vector3, vertical: boolean, ox: number, oz: number) => {
    const p = v.clone()
    if (vertical) {
      p.x -= ox * drop
      p.z -= oz * drop
    } else {
      p.y -= drop
    }
    return p
  }
  const dx = L1.x - L0.x
  const dz = L1.z - L0.z
  const len = Math.hypot(dx, dz) || 1
  const ox = dz / len
  const oz = -dx / len
  // Senkrecht, wenn die Oberkante nicht nach innen verspringt. `run < 1` trifft
  // die Stirn nicht: die Ecken rutschen entlang der Kante, der Abstand in XZ ist groß,
  // die Fläche bleibt trotzdem lotrecht. Dann läge die Unterseite in derselben Ebene.
  const inset0 = (U0.x - L0.x) * ox + (U0.z - L0.z) * oz
  const inset1 = (U1.x - L1.x) * ox + (U1.z - L1.z) * oz
  const vertical = Math.abs(inset0) < 0.5 && Math.abs(inset1) < 0.5
  const b0 = shift(L0, vertical, ox, oz)
  const b1 = shift(L1, vertical, ox, oz)
  const u1 = shift(U1, vertical, ox, oz)
  const u0 = shift(U0, vertical, ox, oz)
  appendQuad(positions, normals, uvs, indices, b0, u0, u1, b1)
  const rim = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    appendQuad(positions, normals, uvs, indices, a, b, c, d)
  }
  if (vertical) {
    rim(L0, L1, b1, b0)
    rim(U0, b0, b1, U1)
    rim(L0, b0, u0, U0)
    rim(L1, U1, u1, b1)
    return
  }
  // Seitenkante einmal (die Nachbarfacette teilt sich L0). Läuft die Kante nach
  // innen, liegt dieser Rand in der lotrechten Stirnebene — die Stirnfläche deckt
  // ihn schon. Sonst zwei Flächen aufeinander (Schachbrett an der Mansardenecke).
  const sdx = U1.x - L1.x
  const sdz = U1.z - L1.z
  const slen = Math.hypot(sdx, sdz) || 1
  const alongOut = Math.abs((sdx * ox + sdz * oz) / slen)
  if (alongOut < 0.92) rim(L1, U1, u1, b1)
  rim(U0, U1, u1, u0)
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
  /** `eave`: unterer Mantel. `ridge`: oberer Mantel. Schließt die Platte. */
  shell: 'eave' | 'ridge' | 'none' = 'none',
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
        if (shell !== 'none') appendMansardShell(positions, normals, uvs, indices, L0, L1, U1, U0, shell)
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
  const edgeOverhang = overhangPerEdge(edges, roof)
  // Traufe: eaveY = Wandoberkante + Plattendicke. Überstand je Kante (`overhangPerEdge`).
  // Kein extra oh·tan auf eaveY (v2.0.506 Doppelzählung).
  const topFloor = floors.length - 1
  const wallTopY = storeyTopY(building, topFloor)
  const pitchForSlab = roof.kind === 'mansard' ? roof.pitchLower : roof.pitch
  // Mansarde: steile untere Neigung bläht `roofSlabVerticalCm` auf (~30 cm bei 70°)
  // und hebt die ganze Haut von der Wand — Traufe direkt auf die Wandkrone.
  const slabLift = roof.kind === 'mansard' ? 0 : roofSlabVerticalCm(pitchForSlab)
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
  if (roof.ridgeRiseCm !== undefined && (roof.kind === 'gable' || roof.kind === 'halfHip')) {
    return roof.ridgeRiseCm
  }
  const env = roofEnvelopeForBuilding(building, roof)
  return env ? Math.max(0, env.ridgeY - env.eaveY) : 0
}

/**
 * Berliner Mansarde: Ziegel (oder glatte Bänder) auf den Mänteln, Firstziegel,
 * optional gehrungene Rinne. Explizit bündige Kanten: Überstand 0; Auto-bündig: keine Rinne trotz Überstand.
 */
function buildMansardRoofForBuilding(
  building: Building,
  roof: RoofConfig,
  sinks: RoofSinks,
  openingHoles: XZ[][] = [],
  eaveCuts: RoofEaveCut[] = [],
): boolean {
  const base = roofBase(building, roof)
  if (!base) return false
  const { positions, normals, uvs, indices } = sinks
  const { outer, eave, eaveY, wallTopY, edgeOverhang, holes } = base
  const smooth = roofEffectiveCovering(roof) === 'smooth'
  const breakRise = roof.ridgeHeight * 0.55
  const upperRise = roof.ridgeHeight - breakRise
  const breakPoly = insetMansard(eave, breakRise, roof.pitchLower, roof)
  const ridgePoly = insetMansard(breakPoly, upperRise, roof.pitchUpper, roof)
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
    outer,
    breakPoly,
    eaveY,
    eaveY + breakRise,
    roof,
    smooth,
    openingHoles,
    'eave',
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
    'ridge',
  )
  const ridgeY = eaveY + roof.ridgeHeight
  buildCap(positions, normals, uvs, indices, ridgePoly, ridgeY, ridgeHoles)
  if (smooth) {
    buildCap(positions, normals, uvs, indices, ridgePoly, ridgeY - ROOF_SLAB_THICKNESS_CM, ridgeHoles, true)
    appendRidgeSkirt(positions, normals, uvs, indices, ridgePoly, ridgeY, ROOF_SLAB_THICKNESS_CM)
  }
  if (!smooth) {
    buildRidgeTiles(positions, normals, uvs, indices, ridgePoly, eaveY + roof.ridgeHeight, roof)
  }

  // Überstand zählt, nicht `edge.flush` (nackte Wand / Stirnmaske lassen den Überstand stehen).
  const edgeActive = base.edges.map((_, i) => edgeOverhang[i]! > 0.5)
  appendMansardSoffit(sinks, base.outer, eave, eaveY, edgeActive, roof, eaveCuts)
  appendGutter(sinks, building, roof, eave, eaveY, edgeActive)
  return true
}

function appendMansardSoffit(
  sinks: RoofSinks,
  outer: XZ[],
  eave: XZ[],
  eaveY: number,
  edgeActive: boolean[],
  roof: RoofConfig,
  eaveCuts: RoofEaveCut[],
): void {
  const blocked = new Set((roof.crossGables ?? []).map((g) => g.edgeKey))
  const n = Math.min(outer.length, eave.length)
  const lerp = (p: XZ, q: XZ, t: number): XZ => ({
    x: p.x + (q.x - p.x) * t,
    z: p.z + (q.z - p.z) * t,
  })
  const dist2 = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z)
  const keyOf = (i: number) => roofEdgeKey(outer[i]!, outer[(i + 1) % outer.length]!)
  const open = (i: number) => Boolean(edgeActive[i]) && !blocked.has(keyOf(i))
  const g = sinks
  const ySoffit = eaveY - ROOF_SLAB_THICKNESS_CM
  const tanL = Math.tan((Math.min(85, Math.max(5, roof.pitchLower)) * Math.PI) / 180)
  const tanU = Math.tan((Math.min(85, Math.max(5, roof.pitchUpper)) * Math.PI) / 180)
  const breakRise = roof.ridgeHeight * 0.55
  const upperRise = Math.max(0, roof.ridgeHeight - breakRise)
  const runL = breakRise / Math.max(0.2, tanL)
  const runU = upperRise / Math.max(0.2, tanU)

  const frameAt = (i: number) => {
    const wallA = outer[i]!
    const wallB = outer[(i + 1) % outer.length]!
    const tipA = eave[i]!
    const tipB = eave[(i + 1) % eave.length]!
    const len = Math.hypot(wallB.x - wallA.x, wallB.z - wallA.z)
    if (len < 0.5) return null
    const out = edgeOutwardXZ(wallA, wallB)
    const along = { x: (wallB.x - wallA.x) / len, z: (wallB.z - wallA.z) / len }
    const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
    const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
    const dist = (midTip.x - midWall.x) * out.x + (midTip.z - midWall.z) * out.z
    if (dist < 1) return null
    return {
      wallA,
      wallB,
      out,
      along,
      p0: { x: wallA.x + out.x * dist, z: wallA.z + out.z * dist },
      p1: { x: wallB.x + out.x * dist, z: wallB.z + out.z * dist },
    }
  }

  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b, a),
      new THREE.Vector3().subVectors(c, a),
    )
    if (nrm.y > 0) appendQuad(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, a, d, c, b)
    else appendQuad(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, a, b, c, d)
  }
  const downTri = (a: XZ, b: XZ, c: XZ) => {
    const A = new THREE.Vector3(a.x, ySoffit, a.z)
    const B = new THREE.Vector3(b.x, ySoffit, b.z)
    const C = new THREE.Vector3(c.x, ySoffit, c.z)
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(B, A),
      new THREE.Vector3().subVectors(C, A),
    )
    if (nrm.lengthSq() < 1e-8) return
    if (nrm.y > 0) appendTri(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, A, C, B)
    else appendTri(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, A, B, C)
  }
  const board = (p: XZ, q: XZ, y0Top: number, y1Top: number, facing: XZ) => {
    if (dist2(p, q) < 1) return
    const P0 = new THREE.Vector3(p.x, y0Top, p.z)
    const P1 = new THREE.Vector3(q.x, y1Top, q.z)
    const Q1 = new THREE.Vector3(q.x, ySoffit, q.z)
    const Q0 = new THREE.Vector3(p.x, ySoffit, p.z)
    const nrm = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(P1, P0),
      new THREE.Vector3().subVectors(Q1, P0),
    )
    if (nrm.x * facing.x + nrm.z * facing.z >= 0) {
      appendQuad(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, P0, P1, Q1, Q0)
    } else {
      appendQuad(g.gablePositions, g.gableNormals, g.gableUvs, g.gableIndices, P0, Q0, Q1, P1)
    }
  }

  for (let i = 0; i < n; i += 1) {
    if (!open(i)) continue
    const fr = frameAt(i)
    if (!fr) continue
    const prev = (i + n - 1) % n
    const next = (i + 1) % n
    const prevFr = blocked.has(keyOf(prev)) ? null : frameAt(prev)
    const nextOpen = open(next)
    const tipA = eave[i]!
    const tipB = eave[(i + 1) % eave.length]!
    const cuts = eaveCuts.length ? edgeCutIntervals(fr.wallA, fr.wallB, eaveCuts) : []
    const topAt = (p: XZ) => {
      const inward = (fr.p0.x - p.x) * fr.out.x + (fr.p0.z - p.z) * fr.out.z
      const d = Math.max(0, inward)
      if (d <= runL) return eaveY + d * tanL
      return eaveY + breakRise + Math.min(d - runL, runU) * tanU
    }
    const cap = (from: XZ, to: XZ, facing: XZ) => {
      if (dist2(from, to) < 1) return
      const inwardOf = (p: XZ) => (fr.p0.x - p.x) * fr.out.x + (fr.p0.z - p.z) * fr.out.z
      const ts = [0, 1]
      const in0 = inwardOf(from)
      const in1 = inwardOf(to)
      if (Math.abs(in0 - in1) > 1e-6) {
        const t = (in0 - runL) / (in0 - in1)
        if (t > 0.02 && t < 0.98) ts.push(t)
      }
      ts.sort((a, b) => a - b)
      for (let s = 0; s + 1 < ts.length; s += 1) {
        const p0 = lerp(from, to, ts[s]!)
        const p1 = lerp(from, to, ts[s + 1]!)
        const y0 = topAt(p0)
        const y1 = topAt(p1)
        if (y0 <= ySoffit + 0.05 && y1 <= ySoffit + 0.05) continue
        board(p0, p1, Math.max(y0, ySoffit), Math.max(y1, ySoffit), facing)
      }
    }
    const away = (wall: XZ, p: XZ, q: XZ): XZ => {
      const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
      const vx = mid.x - wall.x
      const vz = mid.z - wall.z
      const len = Math.hypot(vx, vz) || 1
      return { x: vx / len, z: vz / len }
    }
    const corner = (wall: XZ, perp: XZ, miter: XZ, neighborPerp: XZ) => {
      downTri(wall, perp, neighborPerp)
      downTri(perp, miter, neighborPerp)
      board(perp, miter, eaveY, eaveY, away(wall, perp, miter))
      board(miter, neighborPerp, eaveY, eaveY, away(wall, miter, neighborPerp))
    }
    const faceStart = { x: -fr.along.x, z: -fr.along.z }
    for (const [t0, t1] of complementIntervals(cuts)) {
      if (t1 - t0 < 1e-4) continue
      const w0 = lerp(fr.wallA, fr.wallB, t0)
      const w1 = lerp(fr.wallA, fr.wallB, t1)
      const e0 = lerp(fr.p0, fr.p1, t0)
      const e1 = lerp(fr.p0, fr.p1, t1)
      // 0,4 cm vor der Dachkante, sonst flackert das Stirnbrett über der Rinne.
      const lip = 0.4
      const e0o = { x: e0.x + fr.out.x * lip, z: e0.z + fr.out.z * lip }
      const e1o = { x: e1.x + fr.out.x * lip, z: e1.z + fr.out.z * lip }
      quad(
        new THREE.Vector3(w0.x, ySoffit, w0.z),
        new THREE.Vector3(w1.x, ySoffit, w1.z),
        new THREE.Vector3(e1o.x, ySoffit, e1o.z),
        new THREE.Vector3(e0o.x, ySoffit, e0o.z),
      )
      board(e0o, e1o, eaveY, eaveY, fr.out)
      if (t0 <= 1e-4 && open(prev) && prevFr && dist2(tipA, fr.p0) > 1) {
        corner(fr.wallA, fr.p0, tipA, prevFr.p1)
      } else if (t0 <= 1e-4) {
        cap(fr.wallA, fr.p0, faceStart)
        board(fr.p0, tipA, eaveY, eaveY, away(fr.wallA, fr.p0, tipA))
      } else {
        cap(w0, e0, faceStart)
      }
      if (t1 < 1 - 1e-4) {
        cap(w1, e1, fr.along)
      } else if (!nextOpen) {
        cap(fr.wallB, fr.p1, fr.along)
        board(fr.p1, tipB, eaveY, eaveY, away(fr.wallB, fr.p1, tipB))
      }
    }
  }
}

/**
 * Absenkung des Traufgesims (cm), damit die Oberkante unter der waagerechten
 * Untersicht liegt. 0 an Giebeln und an bündigen Kanten — dort gilt die kleine
 * Kronen-Absenkung. Mansarde: Plattenstärke, nicht Überstand×tan.
 */
export function roofEaveCorniceDropCm(building: Building, wallId: string): number {
  const roof = normalizeRoof(building.roof)
  if (!roof.enabled) return 0
  const edges = listRoofEdges(building, roof)
  const gap = 1
  if (roof.kind === 'mansard') {
    const edge = edges.find((item) => item.wallId === wallId && item.mode !== 'flush')
    if (!edge) return 0
    const oh = overhangPerEdge(edges, roof.overhang)[edge.index] ?? 0
    return oh > 1 ? ROOF_SLAB_THICKNESS_CM + gap : 0
  }
  const env = roofEnvelopeForBuilding(building, roof)
  if (!env) return 0
  const edge = edges.find(
    (item, index) => item.wallId === wallId && item.mode !== 'flush' && Boolean(env.isEave[index]),
  )
  if (!edge) return 0
  const oh = overhangPerEdge(edges, roof.overhang)[edge.index] ?? 0
  if (oh <= 1) return 0
  const pitch = Math.min(85, Math.max(1, roof.pitch ?? 40))
  return oh * Math.tan((pitch * Math.PI) / 180) + gap
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
  appendGutter(sinks, building, roof, env.eave, built.gutterEaveY, built.gutterEdgeActive, built.gutterGaps)
  return true
}

function appendGutter(
  sinks: RoofSinks,
  building: Building,
  roof: RoofConfig,
  eave: XZ[],
  eaveY: number,
  edgeActive: boolean[],
  gaps: Array<Array<[number, number]>> = [],
) {
  if (!roof.gutter || !edgeActive.some(Boolean)) return
  const gutterGeo = buildGutterGeometry(eave, eaveY, edgeActive, gaps)
  if (!gutterGeo) return
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  appendGutterBrackets(positions, normals, uvs, indices, building, eave, eaveY, edgeActive, gaps)
  if (positions.length > 0) {
    const brackets = new THREE.BufferGeometry()
    brackets.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    brackets.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    brackets.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    brackets.setIndex(indices)
    appendBufferGeometry(
      brackets,
      sinks.gutterPositions,
      sinks.gutterNormals,
      sinks.gutterUvs,
      sinks.gutterIndices,
    )
    brackets.dispose()
  }
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
  // Mansarde: Löcher und Traufschnitte (Kastentraufe). Rinne bleibt an der Spitze.
  if (roof.kind === 'mansard') return buildMansardRoofForBuilding(building, roof, sinks, openingHoles, eaveCuts)
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