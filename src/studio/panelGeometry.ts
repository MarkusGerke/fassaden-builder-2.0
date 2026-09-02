import * as THREE from 'three'
import type { Opening, StudioPanelConfig, Wall } from '../types/facade'
import {
  ARCH_MESH_SEGMENTS,
  archFanPolys,
  archJambHoleRects,
  archJambPolysFromSpec,
  archVoussoirCount,
  archVoussoirPolys,
  archVoussoirPolysFromSpec,
  buildSemicircularArchSpec,
  clipPolysMinusArches,
  clipRectMinusBox,
  flushClipPartsToOpeningJambs,
  mergeNarrowClipParts,
  minClipRemnantWidth,
  normalizeOpeningFill,
  openingArchGeom,
  openingArchVoussoirsEnabled,
  openingClipRects,
  openingCutsWall,
  openingHasCurvedMask,
  openingHasRoundMask,
  openingIsConch,
  openingMaskPolyline,
  openingWallFaceMaskPolyline,
  openingMasonryRect,
  openingPanelClearance,
  openingPanelClearanceFinish,
  type OpeningPoly,
} from '../utils/openingGeometry'
import { STUDIO_MASONRY, panelKindForPattern, studioPlinthActive } from './constants'
import { basementWindowEnabled } from './basementWindow'
import { studioMiterLocalX } from './wallMiterX'
import { WINDOW_RECESS, WALL_DEPTH } from '../constants/presets'
import { layoutPanelTiles, visiblePanelRowRect, isCollinearDock, type PanelTile } from './panelLayout'
import { topBareBandForWall } from '../utils/wallLabel'
import { pickTileColorIndex } from './tileColors'
import {
  findAdjacentWall,
  findCollinearDockWall,
  isStudioWall,
  panelMiterEnds,
  plinthMiterEnds,
  studioClearanceRecessInwardOfWall,
  studioClearanceRecessZ,
  studioOpeningRevealInnerZ,
  studioOpeningRevealOuterZ,
  studioPanelFaceLocalZ,
  studioFacadeOutwardLocalZ,
  studioWallInnerLocalZ,
  studioWallOuterLocalZ,
  studioWallTransform,
  studioWindowDepthForwardSign,
  turningAdjacentWalls,
  wallHasPanels,
  wallSpanAlongYaw,
  isWallPlanLinked,
  pointsMeet,
  wallEndPoint,
  wallStartPoint,
} from './walls'
import { facadeOutward } from './elevation'
import { innerFaceRingWorld, planNodeWorld, type PlanNode } from './floorPlan'
import {
  arcWallLocalPoint,
  ARC_WALL_MESH_STRIPS,
  wallHasArcBay,
} from './arcWall'

/**
 * Extra-Spiel Paneel zu Wandloch: 0, damit Maske und Mauerwerk dieselbe Kontur haben.
 * Ein positives Maß legte früher einen Wandstreifen (Rechteck um den Bogen) frei.
 */
const PANEL_OPENING_CLEARANCE = 0
/** Reste schmaler als Rastermaß → beim Clippen verwerfen (kein „ausgefranzter“ Streifen). */
const MIN_PANEL_REMNANT = STUDIO_MASONRY
const CLIP_EPS = 0.05

interface Rect {
  x: number
  y: number
  width: number
  height: number
  depth?: number
  taperDepth?: number
  taper?: number
  recessed?: boolean
  bottomArc?: { x: number; y: number }[]
  topArc?: { x: number; y: number }[]
  /** Keilstein-/Fächer-Umriss; hat Vorrang vor Rechteck/`bottomArc`. */
  outline?: { x: number; y: number }[]
  polar?: OpeningPoly['polar']
  spandrelStrip?: OpeningPoly['spandrelStrip']
  /** Ursprungsfeld vor dem Öffnungs-Clip (Bossen-Diamant bleibt rastertreu). */
  sourceX?: number
  sourceY?: number
  sourceWidth?: number
  sourceHeight?: number
  /** Dock 1+1: Chamfer an Start/Ende erzwingen. */
  keepBossChamferStart?: boolean
  keepBossChamferEnd?: boolean
  /** Dock 0,5+0,5: Chamfer der Dock-Innenseite auf 0. */
  flattenDockStart?: boolean
  flattenDockEnd?: boolean
}

/** Rückseite an der Wandfläche, Vorderseite um `depth` nach außen. */
function panelDepthZs(
  wall: Wall,
  _panel: StudioPanelConfig,
  depth: number,
): { flip: boolean; backZ: number; bodyFrontZ: number } {
  const flip = wall.panelFlip ?? true
  const backZ = flip ? 0 : wall.depth
  const bodyFrontZ = flip ? -depth : wall.depth + depth
  return { flip, backZ, bodyFrontZ }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function openingHoles(opening: Opening, inflate = 0): Rect[] {
  return openingClipRects(opening, inflate + openingPanelClearance(opening)).map((r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }))
}

/**
 * Paneel-Loch an Fugen ausrichten:
 * - Y: jede getroffene Zeile wird ganz aufgenommen (keine halben Steinhöhen).
 * - X bleibt am Öffnungsmaß — Steine werden an der Laibung geschnitten, nicht aufgefressen.
 */
function snapHoleToTileGrid(
  hole: Rect,
  tiles: Rect[],
  minRemnant = MIN_PANEL_REMNANT,
  snapXRemnant = true,
): Rect {
  let x0 = hole.x
  let y0 = hole.y
  let x1 = hole.x + hole.width
  let y1 = hole.y + hole.height

  for (let iter = 0; iter < 64; iter += 1) {
    const current: Rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    let changed = false
    for (const tile of tiles) {
      if (!rectsOverlap(tile, current)) continue
      if (tile.y < y0 - CLIP_EPS) {
        y0 = tile.y
        changed = true
      }
      if (tile.y + tile.height > y1 + CLIP_EPS) {
        y1 = tile.y + tile.height
        changed = true
      }
      if (snapXRemnant) {
        const left = x0 - tile.x
        const right = tile.x + tile.width - x1
        if (left > CLIP_EPS && left < minRemnant) {
          x0 = tile.x
          changed = true
        }
        if (right > CLIP_EPS && right < minRemnant) {
          x1 = tile.x + tile.width
          changed = true
        }
      }
    }
    if (!changed) break
  }

  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }
}

function isViableTilePart(_original: Rect, part: Rect): boolean {
  if (part.width <= CLIP_EPS || part.height <= CLIP_EPS) return false
  return true
}

function snapOpeningHolesToTileGrid(
  wall: Wall,
  _panel: StudioPanelConfig,
  tiles: PanelTile[],
): Rect[] {
  // X nie aufweiten: Reste an der Laibung bleiben stehen, Steine gehen bis an die Öffnung.
  // Freiraum: exakte Kontur (wie ein Profilrahmen), kein Zeilen-Snap.
  const visible = wall.openings.filter((opening) => !opening.hidden)
  const holes: Rect[] = []
  for (const opening of visible) {
    // Stadion/Kreis-Ausschnitt: nur Band-Clip (keine Rechtecklöcher).
    // Bogenformen: Körper unter der Kämpferlinie als Rechteckloch + Band-Clip für die Krone
    // (`openingClipRects`). Früher wurden alle curved masks übersprungen — dann hing der
    // Körper nur am Band-Clip; bei Nicht-Rundbogen blieb Mauerwerk in der Öffnung.
    if (openingHasRoundMask(opening)) continue
    const raw = openingHoles(opening, PANEL_OPENING_CLEARANCE)
    holes.push(...raw)
    // Bogen: kein Y-Snap auf ganze Schichten — sonst frisst der Snap die Kämpferzone.
    if (openingHasCurvedMask(opening, PANEL_OPENING_CLEARANCE)) continue
    if (openingPanelClearance(opening) > 0) continue
    for (const hole of raw) {
      const next = snapHoleToTileGrid(hole, tiles, MIN_PANEL_REMNANT, false)
      if (next.width > CLIP_EPS && next.height > CLIP_EPS) holes.push(next)
    }
  }
  return holes
}

function clipTileAgainstHoles(tile: Rect, holes: Rect[]): Rect[] {
  const seeded: Rect = {
    ...tile,
    sourceX: tile.sourceX ?? tile.x,
    sourceY: tile.sourceY ?? tile.y,
    sourceWidth: tile.sourceWidth ?? tile.width,
    sourceHeight: tile.sourceHeight ?? tile.height,
  }
  let parts: Rect[] = [seeded]
  for (const hole of holes) {
    parts = parts.flatMap((part) => clipRectMinusBox(part, hole, CLIP_EPS, 1))
  }
  return parts.filter((part) => isViableTilePart(tile, part))
}

function clipTileAgainstOpenings(
  tile: PanelTile,
  openings: Opening[],
  inflate = 0,
): OpeningPoly[] {
  const rects = clipTileAgainstHoles(
    tile,
    openings.flatMap((opening) =>
      // Stadion: nur Band-Clip. Bogen: Körper-Rechteck aus openingClipRects + Band-Clip.
      openingHasRoundMask(opening) ? [] : openingHoles(opening, inflate),
    ),
  )
  return clipPolysMinusArches(rects, openings, inflate)
}

function v3(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z)
}

function addQuad(
  positions: number[],
  normals: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  const base = positions.length / 3
  for (const v of [a, b, c, d]) {
    positions.push(v.x, v.y, v.z)
    normals.push(0, 0, 0)
  }
  indices.push(base, base + 3, base + 2, base, base + 2, base + 1)
}

/** Rest über der Kurve: wenn die Kurve über dem Stein liegt, ist die Spalte das Fensterloch. */
function bottomArcHasStone(arcY: number, yTop: number, eps = 0.05): boolean {
  return arcY < yTop - eps
}

/** Rest unter der Kurve: wenn die Kurve unter dem Stein liegt, ist die Spalte das Fensterloch. */
function topArcHasStone(arcY: number, yBot: number, eps = 0.05): boolean {
  return arcY > yBot + eps
}

/**
 * Wand-X im zentrierten Lokalraum.
 * Feld: `wallX − halfW` (Öffnungen unverzerrt). Gehrung nur als Clamp auf die
 * Bilderrahmen-Ebenen — Steine in der Keilzone nutzen wallX außerhalb 0…width.
 */
function wallLocalX(
  wall: Wall,
  wallX: number,
  z: number,
  _panelDepth?: number,
  _panelBackZ?: number,
  miterStartEnabled = true,
  miterEndEnabled = true,
): number {
  if (wallHasArcBay(wall)) {
    const innerZ = studioWallInnerLocalZ(wall)
    const outerZ = studioWallOuterLocalZ(wall)
    const span = outerZ - innerZ
    const t = Math.abs(span) < 1e-6 ? 0 : Math.max(0, Math.min(1, (z - innerZ) / span))
    const zDepth = (1 - t) * Math.max(wall.depth, 1e-6)
    return arcWallLocalPoint(wall, wallX, 0, zDepth).x
  }
  return studioMiterLocalX(wall, wallX, z, miterStartEnabled, miterEndEnabled)
}

/** Rechteck unter der Kämpferlinie — Laibung ohne Bogenkappe. */
function openingJambBodyRects(wall: Wall): Rect[] {
  const out: Rect[] = []
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const rect = openingMasonryRect(opening, PANEL_OPENING_CLEARANCE)
    const geom = openingArchGeom(opening, PANEL_OPENING_CLEARANCE)
    const height = geom ? Math.max(0, geom.springY - rect.y) : rect.height
    if (height > 0.5) out.push({ x: rect.x, y: rect.y, width: rect.width, height })
  }
  return out
}

/** Gehrungs-Flags plus: deckt am Wandende eine Nachbarwand **mit Paneelen** die Stirn ab? */
interface PanelMiter {
  start: boolean
  end: boolean
  coverStart?: boolean
  coverEnd?: boolean
}

function panelMiterWithReturnCover(wall: Wall, allWalls: Wall[]): PanelMiter {
  const miter = panelMiterEnds(wall, allWalls)
  return {
    ...miter,
    coverStart: miter.start && turningAdjacentWalls(wall, 'start', allWalls).some(wallHasPanels),
    coverEnd: miter.end && turningAdjacentWalls(wall, 'end', allWalls).some(wallHasPanels),
  }
}

/**
 * Stirnfläche weglassen — nur an der gehrten Wandecke, an der die Nachbarwand selbst
 * Paneele hat (ihre Steine treffen auf der Gehrungsebene). Ohne Paneel-Nachbar (Putzwand)
 * und an Laibungen bleibt die Stirn: sonst schaut man in den offenen Stein (Kerbe/Treppe
 * im Render, v2.0.30–2.0.33). Zeichnung filtert Tiefenkanten ohnehin
 * (`filterStudioDrawingSegment`).
 */
function hidePanelReturnFace(
  wall: Wall,
  miter: PanelMiter,
  wallX: number,
  y0: number,
  y1: number,
  end: 'start' | 'end',
  jambs: Rect[],
): boolean {
  void y0
  void y1
  void jambs
  if (end === 'start' && wallX <= 1e-4) return miter.coverStart === true
  if (end === 'end' && wallX >= wall.width - 1e-4) return miter.coverEnd === true
  return false
}

/** Bossen-Seite nicht einziehen: Wandende und vertikale Laibung bleiben eine Gerade. */
function flushBossSide(
  wall: Wall,
  wallX: number,
  y0: number,
  y1: number,
  end: 'start' | 'end',
  jambs: Rect[],
): boolean {
  if (end === 'start' && wallX <= 1e-4) return true
  if (end === 'end' && wallX >= wall.width - 1e-4) return true
  for (const hole of jambs) {
    if (y1 <= hole.y + CLIP_EPS || y0 >= hole.y + hole.height - CLIP_EPS) continue
    if (end === 'start' && Math.abs(wallX - (hole.x + hole.width)) <= 1.5) return true
    if (end === 'end' && Math.abs(wallX - hole.x) <= 1.5) return true
  }
  return false
}

/** Lokalpunkt (Wand-X entlang Yaw, Tiefe Z) → Welt-XZ (wie Mesh-Transform). */
export function studioWallPointWorld(
  wall: Wall,
  wallX: number,
  localZ: number,
): { x: number; z: number } {
  const localX = wallLocalX(wall, wallX, localZ)
  const t = studioWallTransform(wall)
  const cos = Math.cos(t.rotationY)
  const sin = Math.sin(t.rotationY)
  return {
    x: t.position.x + localX * cos + localZ * sin,
    z: t.position.z - localX * sin + localZ * cos,
  }
}

/** Innenkante der Wand (panelFlip + wall.depth) in Welt-XZ — entlang der Planlinie versetzt. */
export function studioWallInnerEdgeWorld(wall: Wall): {
  start: { x: number; z: number }
  end: { x: number; z: number }
} {
  const flip = wall.panelFlip ?? true
  const start = wallStartPoint(wall)
  const end = wallEndPoint(wall)
  if (!flip) {
    return { start, end }
  }
  const outward = facadeOutward(wall.yawDeg ?? 0, flip)
  const inward = { x: -outward.x, z: -outward.z }
  const d = wall.depth
  return {
    start: { x: start.x + inward.x * d, z: start.z + inward.z * d },
    end: { x: end.x + inward.x * d, z: end.z + inward.z * d },
  }
}

function intersectLinesXZ(
  a0: { x: number; z: number },
  a1: { x: number; z: number },
  b0: { x: number; z: number },
  b1: { x: number; z: number },
): { x: number; z: number } | null {
  const dax = a1.x - a0.x
  const daz = a1.z - a0.z
  const dbx = b1.x - b0.x
  const dbz = b1.z - b0.z
  const denom = dax * dbz - daz * dbx
  if (Math.abs(denom) < 1e-9) return null
  const t = ((b0.x - a0.x) * dbz - (b0.z - a0.z) * dbx) / denom
  return { x: a0.x + dax * t, z: a0.z + daz * t }
}

function distPointToSeg(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.z - a.z)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

function yawMatchesDeg(a: number, b: number): boolean {
  const delta = Math.abs((((a - b) % 360) + 360) % 360)
  return delta < 2 || Math.abs(delta - 180) < 2
}

function findWallForPlanEdge(from: PlanNode, to: PlanNode, walls: Wall[]): Wall | undefined {
  const a = planNodeWorld(from)
  const b = planNodeWorld(to)
  const yaw = (Math.atan2(-(b.z - a.z), b.x - a.x) * 180) / Math.PI
  const yawN = ((yaw % 360) + 360) % 360
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  let best: Wall | undefined
  let bestDist = 96
  for (const wall of walls) {
    if (!yawMatchesDeg(wall.yawDeg ?? 0, yawN)) continue
    const start = wallStartPoint(wall)
    const end = wallEndPoint(wall)
    const wallMid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }
    const dist = Math.min(distPointToSeg(wallMid, a, b), distPointToSeg(mid, start, end))
    if (dist < bestDist) {
      bestDist = dist
      best = wall
    }
  }
  return best
}

/**
 * Innenring aus den tatsächlichen Studio-Wand-Innenkanten (panelFlip, Gehrung, wall.depth).
 * Fallback: `innerFaceRingWorld`, wenn Kanten nicht eindeutig zugeordnet werden können.
 */
export function innerFaceRingFromWalls(
  outerNodes: PlanNode[],
  walls: Wall[],
  fallbackDepth = WALL_DEPTH,
): Array<{ x: number; z: number }> {
  const count = outerNodes.length
  if (count < 3) return []
  const studioWalls = walls.filter(
    (wall) => isStudioWall(wall) && !wall.hidden && isWallPlanLinked(wall),
  )
  if (studioWalls.length === 0) return innerFaceRingWorld(outerNodes, fallbackDepth)

  const result: Array<{ x: number; z: number }> = []
  for (let i = 0; i < count; i += 1) {
    const prev = outerNodes[(i - 1 + count) % count]
    const curr = outerNodes[i]!
    const next = outerNodes[(i + 1) % count]!
    const wallIn = findWallForPlanEdge(prev, curr, studioWalls)
    const wallOut = findWallForPlanEdge(curr, next, studioWalls)
    if (wallIn && wallOut) {
      const edgeIn = studioWallInnerEdgeWorld(wallIn)
      const edgeOut = studioWallInnerEdgeWorld(wallOut)
      const hit = intersectLinesXZ(edgeIn.start, edgeIn.end, edgeOut.start, edgeOut.end)
      if (hit) {
        result.push(hit)
        continue
      }
    }
    const wall = wallOut ?? wallIn
    if (!wall) return innerFaceRingWorld(outerNodes, fallbackDepth)
    const edge = studioWallInnerEdgeWorld(wall)
    const currWorld = planNodeWorld(curr)
    const forward =
      pointsMeet(wallStartPoint(wall), currWorld) &&
      pointsMeet(wallEndPoint(wall), planNodeWorld(next))
    result.push(forward ? edge.start : edge.end)
  }
  return result
}

/** 45°-Gehrung an Öffnungskanten: Vorderkante vom Loch weg, nicht hinein. */
function applyOpeningMiterX(
  wallX: number,
  z: number,
  holes: Rect[],
  chamfer: number,
  backZ: number,
): number {
  let x = wallX
  const t = Math.min(1, Math.max(0, (z - backZ) / Math.max(chamfer, 1e-6)))
  for (const hole of holes) {
    const left = hole.x
    const right = hole.x + hole.width
    if (Math.abs(wallX - left) <= chamfer + 1e-4 && wallX <= left + 1e-4) {
      x = Math.min(x, left - t * chamfer)
    }
    if (Math.abs(wallX - right) <= chamfer + 1e-4 && wallX >= right - 1e-4) {
      x = Math.max(x, right + t * chamfer)
    }
  }
  return x
}

function applyOpeningMiterY(
  wallY: number,
  z: number,
  holes: Rect[],
  chamfer: number,
  backZ: number,
): number {
  let y = wallY
  const t = Math.min(1, Math.max(0, (z - backZ) / Math.max(chamfer, 1e-6)))
  for (const hole of holes) {
    const bottom = hole.y
    const top = hole.y + hole.height
    if (Math.abs(wallY - bottom) <= chamfer + 1e-4 && wallY <= bottom + 1e-4) {
      y = Math.min(y, bottom - t * chamfer)
    }
    if (Math.abs(wallY - top) <= chamfer + 1e-4 && wallY >= top - 1e-4) {
      y = Math.max(y, top + t * chamfer)
    }
  }
  return y
}

function makePanelPointFn(
  wall: Wall,
  coordAt: (wx: number, wy: number, z: number) => { x: number; y: number },
): (wx: number, wy: number, z: number) => THREE.Vector3 {
  if (!wallHasArcBay(wall)) {
    return (wx: number, wy: number, z: number) => {
      const { x, y } = coordAt(wx, wy, z)
      return v3(x, y, z)
    }
  }
  const outerZ = studioWallOuterLocalZ(wall)
  const innerZ = studioWallInnerLocalZ(wall)
  const span = outerZ - innerZ || 1
  return (wx: number, wy: number, z: number) => {
    const t = Math.max(0, Math.min(1, (z - innerZ) / span))
    const zDepth = (1 - t) * Math.max(wall.depth, 1e-6)
    const pt = arcWallLocalPoint(wall, wx, wy, zDepth)
    return v3(pt.x, pt.y, pt.z)
  }
}

function makeCoordAt(
  wall: Wall,
  panel: StudioPanelConfig,
  miter: { start: boolean; end: boolean },
  holes: Rect[],
  projectDepth: number,
  backZ: number,
): (wx: number, wy: number, z: number) => { x: number; y: number } {
  const openingMiter = panel.openingJoin === 'miter'
  const halfH = wall.height / 2
  return (wx: number, wy: number, z: number) => {
    let wallX = wx
    let wallY = wy
    if (openingMiter && holes.length > 0) {
      wallX = applyOpeningMiterX(wx, z, holes, projectDepth, backZ)
      wallY = applyOpeningMiterY(wy, z, holes, projectDepth, backZ)
    }
    const x = wallLocalX(wall, wallX, z, projectDepth, backZ, miter.start, miter.end)
    return { x, y: wallY - halfH }
  }
}

/**
 * Steinwürfel: Quader von backZ bis bodyFrontZ, volle Kachel-XY.
 * Die Gehrung liegt auf der 45°-Ebene; wallLocalX berechnet den X-Versatz
 * über das echte Z, damit die Kante an der Wandecke bündig abschneidet.
 * Trapez-Pyramidenstumpf: nur wenn taperDepth > 0, sitzt auf der Steinfront.
 * Mörtel wird separat in createStudioMortarGeometry erzeugt.
 */

/** Extrudiert einen geschlossenen Wand-XY-Umriss (Keilstein/Fächer) als Steinquader. */
function triangulateOutlineRing(
  outline: { x: number; y: number }[],
): number[][] {
  const contour = outline.map((pt) => new THREE.Vector2(pt.x, pt.y))
  try {
    return THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    return []
  }
}

function extrudeOutlinePoly(
  outline: { x: number; y: number }[],
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  backZ: number,
  frontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
  opts?: { skipFront?: boolean },
) {
  const n = outline.length
  if (n < 3) return
  const front = outline.map((pt) => p(pt.x, pt.y, frontZ))
  const back = outline.map((pt) => p(pt.x, pt.y, backZ))
  const tris = triangulateOutlineRing(outline)
  if (tris.length > 0) {
    for (const tri of tris) {
      const ia = tri[0]!
      const ib = tri[1]!
      const ic = tri[2]!
      if (!opts?.skipFront) {
        addTri(positions, normals, indices, front[ia]!, front[ib]!, front[ic]!)
      }
      addTri(positions, normals, indices, back[ia]!, back[ic]!, back[ib]!)
    }
  } else {
    for (let i = 1; i < n - 1; i += 1) {
      if (!opts?.skipFront) {
        addTri(positions, normals, indices, front[0], front[i], front[i + 1])
      }
      addTri(positions, normals, indices, back[0], back[i + 1], back[i])
    }
  }
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    addQuad(positions, normals, indices, back[i], back[j], front[j], front[i])
  }
}

/** Zwickel: Front trianguliert (keine Innenkanten in der Zeichnung), Seiten am Umriss. */
function extrudeSpandrelStrip(
  strip: NonNullable<OpeningPoly['spandrelStrip']>,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  backZ: number,
  frontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const inner = [...strip.inner].sort((a, b) => a.y - b.y)
  if (inner.length < 2) return
  const xO = strip.xOuter
  const usable: { x: number; y: number }[] = []
  for (const pt of inner) {
    const last = usable[usable.length - 1]
    if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 0.03) usable.push(pt)
  }
  if (usable.length < 2) return
  const first = usable[0]!
  const last = usable[usable.length - 1]!
  const outline: { x: number; y: number }[] = [
    { x: xO, y: first.y },
    { x: xO, y: last.y },
    ...[...usable].reverse(),
  ]
  const cleaned: { x: number; y: number }[] = []
  for (const pt of outline) {
    const prev = cleaned[cleaned.length - 1]
    if (!prev || Math.hypot(prev.x - pt.x, prev.y - pt.y) > 0.04) cleaned.push(pt)
  }
  if (cleaned.length >= 3) {
    const a = cleaned[0]!
    const b = cleaned[cleaned.length - 1]!
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.04) cleaned.pop()
  }
  if (cleaned.length < 3) return

  const contour = cleaned.map((pt) => new THREE.Vector2(pt.x, pt.y))
  let tris: number[][] = []
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    tris = []
  }
  const front = cleaned.map((pt) => p(pt.x, pt.y, frontZ))
  const back = cleaned.map((pt) => p(pt.x, pt.y, backZ))
  if (tris.length > 0) {
    for (const tri of tris) {
      const ia = tri[0]!
      const ib = tri[1]!
      const ic = tri[2]!
      addTri(positions, normals, indices, front[ia]!, front[ib]!, front[ic]!)
      addTri(positions, normals, indices, back[ia]!, back[ic]!, back[ib]!)
    }
    for (let i = 0; i < cleaned.length; i += 1) {
      const j = (i + 1) % cleaned.length
      addQuad(positions, normals, indices, back[i]!, back[j]!, front[j]!, front[i]!)
    }
    return
  }

  for (let i = 0; i < usable.length - 1; i += 1) {
    const a = usable[i]!
    const b = usable[i + 1]!
    if (Math.abs(a.x - xO) < 0.08 && Math.abs(b.x - xO) < 0.08) continue
    const oa = p(xO, a.y, frontZ)
    const ob = p(xO, b.y, frontZ)
    const ia = p(a.x, a.y, frontZ)
    const ib = p(b.x, b.y, frontZ)
    addQuad(positions, normals, indices, oa, ia, ib, ob)
    addQuad(
      positions,
      normals,
      indices,
      p(xO, a.y, backZ),
      p(xO, b.y, backZ),
      p(b.x, b.y, backZ),
      p(a.x, a.y, backZ),
    )
    addQuad(positions, normals, indices, ia, p(a.x, a.y, backZ), p(b.x, b.y, backZ), ib)
  }
  addQuad(
    positions,
    normals,
    indices,
    p(xO, first.y, frontZ),
    p(xO, last.y, frontZ),
    p(xO, last.y, backZ),
    p(xO, first.y, backZ),
  )
  addQuad(
    positions,
    normals,
    indices,
    p(xO, first.y, frontZ),
    p(xO, first.y, backZ),
    p(first.x, first.y, backZ),
    p(first.x, first.y, frontZ),
  )
  addQuad(
    positions,
    normals,
    indices,
    p(xO, last.y, frontZ),
    p(last.x, last.y, frontZ),
    p(last.x, last.y, backZ),
    p(xO, last.y, backZ),
  )
}

function addTri(
  positions: number[],
  normals: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  const base = positions.length / 3
  for (const v of [a, b, c]) {
    positions.push(v.x, v.y, v.z)
    normals.push(0, 0, 0)
  }
  indices.push(base, base + 1, base + 2)
}

function extrudeStone(
  rect: Rect,
  wall: Wall,
  panel: StudioPanelConfig,
  miter: { start: boolean; end: boolean },
  positions: number[],
  normals: number[],
  indices: number[],
  holes: Rect[] = [],
  zRange?: { back: number; front: number },
) {
  const projectDepth = rect.depth ?? panel.projectDepth
  if (!zRange && projectDepth <= 1e-6) return

  const zs = panelDepthZs(wall, panel, Math.max(projectDepth, 1e-6))
  const backZ = zRange?.back ?? zs.backZ
  const bodyFrontZ = zRange?.front ?? zs.bodyFrontZ

  const x0 = rect.x
  const x1 = rect.x + rect.width
  const y0Wall = rect.y
  const y1Wall = rect.y + rect.height
  const outline = rect.outline ?? (rect as OpeningPoly).outline
  const arc = rect.bottomArc ?? (rect as OpeningPoly).bottomArc
  const topArc = rect.topArc ?? (rect as OpeningPoly).topArc
  const strip = rect.spandrelStrip ?? (rect as OpeningPoly).spandrelStrip
  // Rechteck-Gehrung würde Bogen-Umriss-Punkte an der Kämpferlinie verzerren.
  const miterHoles =
    (outline && outline.length >= 3) ||
    (arc && arc.length >= 2) ||
    (topArc && topArc.length >= 2) ||
    Boolean(strip)
      ? []
      : holes
  const coordAt = makeCoordAt(wall, panel, miter, miterHoles, projectDepth, backZ)

  const p = makePanelPointFn(wall, coordAt)

  if (strip) {
    extrudeSpandrelStrip(strip, p, backZ, bodyFrontZ, positions, normals, indices)
    return
  }

  if (outline && outline.length >= 3) {
    // Polar- oder Outline-Boss übernimmt die sichtbare Front — sonst Doppelkante / Rechteck im Keil.
    const skipFront = Math.max(0, rect.taperDepth ?? panel.taperDepth ?? 0) > 1e-6
    extrudeOutlinePoly(outline, p, backZ, bodyFrontZ, positions, normals, indices, { skipFront })
    return
  }

  // Mit Bossen: Körper und Boss teilen dieselbe Restkontur.
  // Bogenkante nie als Outline-Fächer (füllt Sehnen-Kerben / das Loch).
  const taperOn = Math.max(0, rect.taperDepth ?? panel.taperDepth ?? 0) > 1e-6

  if (arc && arc.length >= 2) {
    const skipFront = taperOn
    const first = arc.find((pt) => bottomArcHasStone(pt.y, y1Wall))
    const last = [...arc].reverse().find((pt) => bottomArcHasStone(pt.y, y1Wall))
    if (first) {
      addQuad(
        positions,
        normals,
        indices,
        p(first.x, y1Wall, backZ),
        p(first.x, Math.max(first.y, y0Wall), backZ),
        p(first.x, Math.max(first.y, y0Wall), bodyFrontZ),
        p(first.x, y1Wall, bodyFrontZ),
      )
    }
    if (last && last !== first) {
      addQuad(
        positions,
        normals,
        indices,
        p(last.x, Math.max(last.y, y0Wall), backZ),
        p(last.x, y1Wall, backZ),
        p(last.x, y1Wall, bodyFrontZ),
        p(last.x, Math.max(last.y, y0Wall), bodyFrontZ),
      )
    }
    for (let i = 0; i < arc.length - 1; i += 1) {
      const a = arc[i]
      const b = arc[i + 1]
      if (!bottomArcHasStone(a.y, y1Wall) || !bottomArcHasStone(b.y, y1Wall)) continue
      const ay = Math.max(a.y, y0Wall)
      const by = Math.max(b.y, y0Wall)
      const af = p(a.x, ay, bodyFrontZ)
      const bf = p(b.x, by, bodyFrontZ)
      const at = p(a.x, y1Wall, bodyFrontZ)
      const bt = p(b.x, y1Wall, bodyFrontZ)
      if (!skipFront) {
        addQuad(positions, normals, indices, af, bf, bt, at)
      }
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, ay, backZ),
        p(b.x, by, backZ),
        bf,
        af,
      )
    }
    return
  }

  if (topArc && topArc.length >= 2) {
    const skipFront = taperOn
    const first = topArc.find((pt) => topArcHasStone(pt.y, y0Wall))
    const last = [...topArc].reverse().find((pt) => topArcHasStone(pt.y, y0Wall))
    if (first) {
      addQuad(
        positions,
        normals,
        indices,
        p(first.x, y0Wall, backZ),
        p(first.x, y0Wall, bodyFrontZ),
        p(first.x, Math.min(first.y, y1Wall), bodyFrontZ),
        p(first.x, Math.min(first.y, y1Wall), backZ),
      )
    }
    if (last && last !== first) {
      addQuad(
        positions,
        normals,
        indices,
        p(last.x, y0Wall, bodyFrontZ),
        p(last.x, y0Wall, backZ),
        p(last.x, Math.min(last.y, y1Wall), backZ),
        p(last.x, Math.min(last.y, y1Wall), bodyFrontZ),
      )
    }
    for (let i = 0; i < topArc.length - 1; i += 1) {
      const a = topArc[i]
      const b = topArc[i + 1]
      if (!topArcHasStone(a.y, y0Wall) || !topArcHasStone(b.y, y0Wall)) continue
      const ay = Math.min(a.y, y1Wall)
      const by = Math.min(b.y, y1Wall)
      if (!skipFront) {
        addQuad(
          positions,
          normals,
          indices,
          p(a.x, y0Wall, bodyFrontZ),
          p(b.x, y0Wall, bodyFrontZ),
          p(b.x, by, bodyFrontZ),
          p(a.x, ay, bodyFrontZ),
        )
      }
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, ay, backZ),
        p(b.x, by, backZ),
        p(b.x, by, bodyFrontZ),
        p(a.x, ay, bodyFrontZ),
      )
    }
    return
  }

  const blb = p(x0, y0Wall, backZ)
  const brb = p(x1, y0Wall, backZ)
  const trb = p(x1, y1Wall, backZ)
  const tlb = p(x0, y1Wall, backZ)
  const blf = p(x0, y0Wall, bodyFrontZ)
  const brf = p(x1, y0Wall, bodyFrontZ)
  const trf = p(x1, y1Wall, bodyFrontZ)
  const tlf = p(x0, y1Wall, bodyFrontZ)

  // Vorderfläche (Steinfront) und vier Seiten — Rückseite liegt in der Wand
  addQuad(positions, normals, indices, blf, brf, trf, tlf)
  addQuad(positions, normals, indices, blb, brb, brf, blf)  // unten
  addQuad(positions, normals, indices, trb, tlb, tlf, trf)  // oben
  const jambs = openingJambBodyRects(wall)
  if (!hidePanelReturnFace(wall, miter, x0, y0Wall, y1Wall, 'start', jambs)) {
    addQuad(positions, normals, indices, tlb, blb, blf, tlf)  // linke Seite
  }
  if (!hidePanelReturnFace(wall, miter, x1, y0Wall, y1Wall, 'end', jambs)) {
    addQuad(positions, normals, indices, brb, trb, trf, brf)  // rechte Seite
  }
}

/**
 * Bossen-Chamfer an Wandende unterdrücken?
 * Streifen an kollinearer Dock-Fuge, und Kacheln die (historisch) über die Fuge
 * spannen. 0,5+0,5 glättet über `flattenDock*` in der eigenen Wand — ohne Überstand.
 * 1+1 behält das volle Trapez (`keepBossChamfer*`).
 */
function shouldSuppressBossChamferAtEnd(
  wall: Wall,
  allWalls: Wall[],
  end: 'start' | 'end',
  tileWidth: number,
  panel: StudioPanelConfig,
  rectX: number,
): boolean {
  const crosses =
    (end === 'start' && rectX < -0.2) ||
    (end === 'end' && rectX + tileWidth > wall.width + 0.2)
  if (panel.pattern === 'strip') {
    const atWallEnd =
      end === 'start' ? rectX <= 1e-4 : rectX + tileWidth >= wall.width - 1e-4
    if (!atWallEnd && !crosses) return false
    const adj = findCollinearDockWall(wall, end, allWalls) ?? findAdjacentWall(wall, end, allWalls)
    if (!adj) return false
    const join = end === 'start' ? panel.endBossStartJoin : panel.endBossEndJoin
    return join !== 'miter'
  }
  // runningBond / Mauerwerk: nur übergespannte Merges glätten
  if (!crosses) return false
  const adj = findCollinearDockWall(wall, end, allWalls) ?? findAdjacentWall(wall, end, allWalls)
  if (!adj) return false
  const join = end === 'start' ? panel.endBossStartJoin : panel.endBossEndJoin
  if (join === 'miter') return false
  return true
}

function almostSamePoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps = 1e-4,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < eps
}

function dropClosedDuplicate(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length >= 2 && almostSamePoint(pts[0], pts[pts.length - 1])) {
    return pts.slice(0, -1)
  }
  return pts
}

function cleanRing(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const stripped = dropClosedDuplicate(pts)
  const out: { x: number; y: number }[] = []
  for (const p of stripped) {
    const last = out[out.length - 1]
    if (!last || !almostSamePoint(last, p)) out.push({ x: p.x, y: p.y })
  }
  if (out.length >= 2 && almostSamePoint(out[0], out[out.length - 1])) out.pop()
  return out
}

function ringArea(pts: { x: number; y: number }[]): number {
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return area / 2
}

function ringCcw(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  return ringArea(pts) < 0 ? [...pts].reverse() : pts
}

/** Geschlossener Wand-XY-Ring (CCW, ohne doppelten Schlussvertex). */
function ringFromTile(rect: Rect): { x: number; y: number }[] | null {
  if (rect.outline && rect.outline.length >= 3) {
    const ring = ringCcw(cleanRing(rect.outline))
    return ring.length >= 3 ? ring : null
  }
  const y0 = rect.y
  const y1 = rect.y + rect.height
  const bottom = rect.bottomArc
  const top = rect.topArc
  if (bottom && bottom.length >= 2 && top && top.length >= 2) {
    const ring = ringCcw(cleanRing([...bottom, ...[...top].reverse()]))
    return ring.length >= 3 ? ring : null
  }
  if (bottom && bottom.length >= 2) {
    const ring = ringCcw(
      cleanRing([
        ...bottom,
        { x: bottom[bottom.length - 1].x, y: y1 },
        { x: bottom[0].x, y: y1 },
      ]),
    )
    return ring.length >= 3 ? ring : null
  }
  if (top && top.length >= 2) {
    const ring = ringCcw(
      cleanRing([
        { x: top[0].x, y: y0 },
        { x: top[top.length - 1].x, y: y0 },
        ...[...top].reverse(),
      ]),
    )
    return ring.length >= 3 ? ring : null
  }
  return null
}

function ringBounds(pts: { x: number; y: number }[]): {
  x: number
  y: number
  w: number
  h: number
} {
  let x0 = pts[0].x
  let y0 = pts[0].y
  let x1 = pts[0].x
  let y1 = pts[0].y
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

type Pt2 = { x: number; y: number }

function polarWedgePts(
  polar: NonNullable<OpeningPoly['polar']>,
  rInner: number,
  rOuter: number,
  t0: number,
  t1: number,
  segs: number,
): Pt2[] {
  const n = Math.max(1, segs)
  const pts: Pt2[] = []
  for (let s = 0; s <= n; s += 1) {
    const t = t0 + (t1 - t0) * (s / n)
    pts.push({ x: polar.cx + Math.cos(t) * rInner, y: polar.cy + Math.sin(t) * rInner })
  }
  for (let s = 0; s <= n; s += 1) {
    const t = t1 + (t0 - t1) * (s / n)
    pts.push({ x: polar.cx + Math.cos(t) * rOuter, y: polar.cy + Math.sin(t) * rOuter })
  }
  return pts
}

/**
 * Bossen am Keilstein: konzentrisch eingesetzter Keil (radiale Fugen bleiben radial).
 * Chamfer begrenzt, damit die Front den Keil füllt — kein Mini-Rechteck in der Mitte.
 */
function extrudePolarFrustum(
  polar: NonNullable<OpeningPoly['polar']>,
  chamfer: number,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  baseZ: number,
  frontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
): boolean {
  if (chamfer <= 1e-6) return false
  const rMid = (polar.rInner + polar.rOuter) * 0.5
  const ringT = polar.rOuter - polar.rInner
  const span = Math.abs(polar.t0 - polar.t1)
  // Boss soll den Keil füllen: Rücksprung max. ~22 % der Ringstärke / 18 % des Winkels.
  const cRad = Math.min(chamfer, Math.max(0.8, ringT * 0.22))
  const dTheta = Math.min(cRad / Math.max(1, rMid), span * 0.18)
  const rIn = polar.rInner + cRad
  const rOut = polar.rOuter - cRad
  if (rOut - rIn < 0.8) return false
  const a0 = polar.t0 > polar.t1 ? polar.t0 - dTheta : polar.t0 + dTheta
  const a1 = polar.t0 > polar.t1 ? polar.t1 + dTheta : polar.t1 - dTheta
  if (Math.abs(a0 - a1) < 0.02) return false
  const segs = Math.max(4, Math.min(6, Math.ceil((span / Math.PI) * 12)))
  const outer = polarWedgePts(polar, polar.rInner, polar.rOuter, polar.t0, polar.t1, segs)
  const inner = polarWedgePts(polar, rIn, rOut, a0, a1, segs)
  if (outer.length !== inner.length || outer.length < 4) return false

  // Front als Radialstreifen (Quads) — kein Fächer vom ersten Punkt (Zeichnung: X-Linien).
  const nArc = segs + 1
  for (let s = 0; s < segs; s += 1) {
    const i0 = s
    const i1 = s + 1
    const o0 = nArc + (segs - s)
    const o1 = nArc + (segs - s - 1)
    // inner arc i0→i1, outer arc o1→o0 (gegenläufig abgetastet)
    addQuad(
      positions,
      normals,
      indices,
      p(inner[i0]!.x, inner[i0]!.y, frontZ),
      p(inner[i1]!.x, inner[i1]!.y, frontZ),
      p(inner[o1]!.x, inner[o1]!.y, frontZ),
      p(inner[o0]!.x, inner[o0]!.y, frontZ),
    )
  }
  for (let i = 0; i < outer.length; i += 1) {
    const j = (i + 1) % outer.length
    addQuad(
      positions,
      normals,
      indices,
      p(outer[i]!.x, outer[i]!.y, baseZ),
      p(outer[j]!.x, outer[j]!.y, baseZ),
      p(inner[j]!.x, inner[j]!.y, frontZ),
      p(inner[i]!.x, inner[i]!.y, frontZ),
    )
  }
  return true
}

function sourceRectOf(rect: Rect): { x: number; y: number; width: number; height: number } {
  if (
    rect.sourceWidth != null &&
    rect.sourceWidth > CLIP_EPS &&
    rect.sourceHeight != null &&
    rect.sourceHeight > CLIP_EPS
  ) {
    return {
      x: rect.sourceX ?? rect.x,
      y: rect.sourceY ?? rect.y,
      width: rect.sourceWidth,
      height: rect.sourceHeight,
    }
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

function isOpeningCut(rect: Rect): boolean {
  if (rect.outline && rect.outline.length >= 3) return false
  if ((rect.bottomArc && rect.bottomArc.length >= 2) || (rect.topArc && rect.topArc.length >= 2)) {
    return true
  }
  const s = sourceRectOf(rect)
  return (
    Math.abs(rect.x - s.x) > 0.04 ||
    Math.abs(rect.y - s.y) > 0.04 ||
    Math.abs(rect.width - s.width) > 0.04 ||
    Math.abs(rect.height - s.height) > 0.04
  )
}

function rectAsRing(rect: Rect): Pt2[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
}

function lineIntersect(a1: Pt2, a2: Pt2, b1: Pt2, b2: Pt2): Pt2 | null {
  const dax = a2.x - a1.x
  const day = a2.y - a1.y
  const dbx = b2.x - b1.x
  const dby = b2.y - b1.y
  const det = dax * dby - day * dbx
  if (Math.abs(det) < 1e-9) return null
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / det
  return { x: a1.x + t * dax, y: a1.y + t * day }
}

/** Konvexer Ring (alle Außenwinkel gleiche Orientierung). */
function ringIsConvex(ring: Pt2[]): boolean {
  const n = ring.length
  if (n < 3) return false
  let sign = 0
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    const c = ring[(i + 2) % n]!
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) < 1e-8) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/**
 * Gleichmäßiger Kanteneinzug (wie Wand-Bossen): parallele Kanten, gleiche Fase.
 * 1:1-Vertex-Zuordnung — kein cleanRing/Resample (sonst verdrehen die Schrägseiten).
 */
function insetRing(ring: Pt2[], dist: number): Pt2[] | null {
  if (ring.length < 3 || dist <= 1e-6) return null
  const src = ringCcw(cleanRing(ring))
  const n = src.length
  if (n < 3) return null
  const off: { a: Pt2; b: Pt2 }[] = []
  for (let i = 0; i < n; i += 1) {
    const a = src[i]!
    const b = src[(i + 1) % n]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const len = Math.hypot(ex, ey) || 1
    const nx = -ey / len
    const ny = ex / len
    off.push({
      a: { x: a.x + nx * dist, y: a.y + ny * dist },
      b: { x: b.x + nx * dist, y: b.y + ny * dist },
    })
  }
  const out: Pt2[] = []
  const maxMiter = dist * 2.5
  for (let i = 0; i < n; i += 1) {
    const prev = off[(i - 1 + n) % n]!
    const cur = off[i]!
    const vertex = src[i]!
    const hit = lineIntersect(prev.a, prev.b, cur.a, cur.b)
    if (hit) {
      const d = Math.hypot(hit.x - vertex.x, hit.y - vertex.y)
      if (d <= maxMiter) {
        out.push(hit)
        continue
      }
      // Miter klemmen — Vertex-Zahl bleibt, keine Zacken aus Bisector-Fallback.
      const t = maxMiter / d
      out.push({
        x: vertex.x + (hit.x - vertex.x) * t,
        y: vertex.y + (hit.y - vertex.y) * t,
      })
      continue
    }
    const px = vertex.x - src[(i - 1 + n) % n]!.x
    const py = vertex.y - src[(i - 1 + n) % n]!.y
    const qx = src[(i + 1) % n]!.x - vertex.x
    const qy = src[(i + 1) % n]!.y - vertex.y
    const lp = Math.hypot(px, py) || 1
    const lq = Math.hypot(qx, qy) || 1
    let nx = -py / lp + -qy / lq
    let ny = px / lp + qx / lq
    const nl = Math.hypot(nx, ny) || 1
    nx /= nl
    ny /= nl
    out.push({ x: vertex.x + nx * dist, y: vertex.y + ny * dist })
  }
  if (out.length !== n) return null
  const a0 = Math.abs(ringArea(src))
  const a1 = Math.abs(ringArea(out))
  if (a1 < 1 || a1 < a0 * 0.12) return null
  // Selbstüberschneidung / Umdrehung → unbrauchbar für EdgesGeometry.
  if (Math.sign(ringArea(out)) !== Math.sign(ringArea(src)) && Math.abs(ringArea(src)) > 1e-6) {
    return null
  }
  return out
}

/**
 * Bogenpolylinie ausdünnen (Douglas-Peucker), Endpunkte bleiben.
 * Wenige Stützpunkte → saubere Fase; zu viele → gezackter „zweiter Extrados“.
 */
function sparsePolyline(pts: Pt2[], maxN: number, tol = 1.6): Pt2[] {
  if (pts.length === 0) return []
  if (pts.length <= 2) return pts.map((p) => ({ x: p.x, y: p.y }))
  const keep = new Array(pts.length).fill(false)
  keep[0] = true
  keep[pts.length - 1] = true
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i0, i1] = stack.pop()!
    const a = pts[i0]!
    const b = pts[i1]!
    let bestI = -1
    let bestD = tol
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    for (let i = i0 + 1; i < i1; i += 1) {
      const p = pts[i]!
      let d: number
      if (len2 < 1e-12) d = Math.hypot(p.x - a.x, p.y - a.y)
      else {
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
        d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
      }
      if (d > bestD) {
        bestD = d
        bestI = i
      }
    }
    if (bestI >= 0) {
      keep[bestI] = true
      stack.push([i0, bestI], [bestI, i1])
    }
  }
  let out = pts.filter((_, i) => keep[i]).map((p) => ({ x: p.x, y: p.y }))
  const cap = Math.max(2, maxN)
  if (out.length > cap) {
    const picked: Pt2[] = []
    for (let i = 0; i < cap; i += 1) {
      const idx = Math.round((i * (out.length - 1)) / (cap - 1))
      picked.push({ x: out[idx]!.x, y: out[idx]!.y })
    }
    out = picked
  }
  return out
}

/**
 * Paneel-Rest: Clip-Kontur 1:1 (Körper = Boss).
 * Bogenpunkte kommen vom Extrados der Keilsteine — nicht auf 4 Sehnen-Punkte ausdünnen
 * (die Sehne eines groben Polygons liegt im Voussoir-Ring).
 */
function remnantOutline(rect: Rect): Pt2[] | null {
  const fromTile = ringFromTile(rect)
  if (fromTile && fromTile.length >= 3) {
    // Bogen-Silhouette (topArc/bottomArc) nie auf wenige Sehnen ausdünnen:
    // wandbreite Streifen mit mehreren Öffnungen würden sonst zu Diagonal-/Trapez-Chaos.
    const hasArc =
      (rect.bottomArc != null && rect.bottomArc.length >= 2) ||
      (rect.topArc != null && rect.topArc.length >= 2)
    if (hasArc) return fromTile
    return fromTile.length > 16 ? simplifyClosedRing(fromTile, 16, 0.4) : fromTile
  }
  if (rect.width > CLIP_EPS && rect.height > CLIP_EPS) {
    return ringCcw(rectAsRing(rect))
  }
  return null
}

/** Geschlossenen Ring ausdünnen, Ecken mit großer Abweichung behalten. */
function simplifyClosedRing(ring: Pt2[], maxN: number, tol: number): Pt2[] {
  const src = ringCcw(cleanRing(ring))
  if (src.length <= maxN) return src
  // Offene Kette = Ring + Start, DP, Schluss entfernen.
  const open = [...src, src[0]!]
  const sparse = sparsePolyline(open, maxN + 1, tol)
  if (sparse.length >= 2 && almostSamePoint(sparse[0]!, sparse[sparse.length - 1]!)) {
    sparse.pop()
  }
  const out = ringCcw(cleanRing(sparse))
  return out.length >= 3 ? out : src.slice(0, maxN)
}

/**
 * Bossen als paralleler Einzug der Restform (Trapez → kleineres Trapez).
 * Gleiche Fase wie volle Wandsteine — Vertex-Paare 1:1, kein unabhängiges Resample.
 */
function pinInsetXToFlushPlanes(
  outerX: number,
  outerY: number,
  insetX: number,
  wall: Wall | undefined,
  jambs: Rect[] | undefined,
): number {
  if (!wall) return insetX
  if (outerX <= 1e-4 || outerX >= wall.width - 1e-4) return outerX
  if (!jambs) return insetX
  for (const hole of jambs) {
    if (outerY < hole.y - 1.5 || outerY > hole.y + hole.height + 1.5) continue
    if (Math.abs(outerX - hole.x) <= 1.5 || Math.abs(outerX - (hole.x + hole.width)) <= 1.5) {
      return outerX
    }
  }
  return insetX
}

function extrudeInsetRingFrustum(
  ring: Pt2[],
  chamfer: number,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  baseZ: number,
  frontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
  flush?: { wall: Wall; jambs: Rect[] },
): boolean {
  if (chamfer <= 1e-6 || ring.length < 3) return false
  const outerSrc = ringCcw(cleanRing(ring))
  if (outerSrc.length < 3) return false
  const b = ringBounds(outerSrc)
  const minSide = Math.min(b.w, b.h)
  if (minSide < 3.5) return false
  const convex = ringIsConvex(outerSrc)

  const tryChamfers = [
    Math.min(chamfer, minSide * 0.45 - 0.05),
    Math.min(chamfer, minSide * 0.32),
    Math.min(chamfer * 0.65, minSide * 0.22),
  ].filter((c, i, arr) => c > 0.35 && arr.indexOf(c) === i)

  let oPts = outerSrc
  let iPts: Pt2[] | null = null
  for (const c of tryChamfers) {
    // Konkave Bogen-Reste (Streifen mit Kerbe): Schwerpunkt-Einzug erzeugt
    // Sehnen/Diagonalen in der Zeichnung — nur echter paralleler Offset.
    if (!convex) break
    const edge = insetRing(outerSrc, c)
    if (edge && edge.length === outerSrc.length) {
      iPts = edge
      break
    }
  }
  if (!iPts || iPts.length !== oPts.length) return false
  if (flush) {
    iPts = iPts.map((pt, i) => ({
      x: pinInsetXToFlushPlanes(oPts[i]!.x, oPts[i]!.y, pt.x, flush.wall, flush.jambs),
      y: pt.y,
    }))
  }

  const front = iPts.map((pt) => p(pt.x, pt.y, frontZ))
  const contour = iPts.map((pt) => new THREE.Vector2(pt.x, pt.y))
  let tris: number[][] = []
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    tris = []
  }
  if (tris.length > 0) {
    for (const tri of tris) {
      addTri(positions, normals, indices, front[tri[0]!]!, front[tri[1]!]!, front[tri[2]!]!)
    }
  } else {
    for (let i = 1; i < front.length - 1; i += 1) {
      addTri(positions, normals, indices, front[0]!, front[i]!, front[i + 1]!)
    }
  }

  for (let i = 0; i < oPts.length; i += 1) {
    const j = (i + 1) % oPts.length
    addQuad(
      positions,
      normals,
      indices,
      p(oPts[i]!.x, oPts[i]!.y, baseZ),
      p(oPts[j]!.x, oPts[j]!.y, baseZ),
      p(iPts[j]!.x, iPts[j]!.y, frontZ),
      p(iPts[i]!.x, iPts[i]!.y, frontZ),
    )
  }
  return true
}

function fillRingFront(
  ring: Pt2[],
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  z: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  if (ring.length < 3) return
  const front = ring.map((pt) => p(pt.x, pt.y, z))
  const contour = ring.map((pt) => new THREE.Vector2(pt.x, pt.y))
  let tris: number[][] = []
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    tris = []
  }
  if (tris.length > 0) {
    for (const tri of tris) {
      addTri(positions, normals, indices, front[tri[0]!]!, front[tri[1]!]!, front[tri[2]!]!)
    }
  } else {
    for (let i = 1; i < front.length - 1; i += 1) {
      addTri(positions, normals, indices, front[0]!, front[i]!, front[i + 1]!)
    }
  }
}

/** Bossen-Einzug eines monotonen Bogen-Bands (Streifen/Ziegel an der Kurve). */
function offsetArcIntoBand(
  arc: { x: number; y: number }[],
  dist: number,
  towardTop: boolean,
): { x: number; y: number }[] {
  const n = arc.length
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n; i += 1) {
    const prev = arc[Math.max(0, i - 1)]!
    const cur = arc[i]!
    const next = arc[Math.min(n - 1, i + 1)]!
    const e1x = cur.x - prev.x
    const e1y = cur.y - prev.y
    const e2x = next.x - cur.x
    const e2y = next.y - cur.y
    const l1 = Math.hypot(e1x, e1y) || 1
    const l2 = Math.hypot(e2x, e2y) || 1
    let nx = -e1y / l1 + -e2y / l2
    let ny = e1x / l1 + e2x / l2
    const nl = Math.hypot(nx, ny) || 1
    nx /= nl
    ny /= nl
    if (towardTop && ny < 0) {
      nx = -nx
      ny = -ny
    }
    if (!towardTop && ny > 0) {
      nx = -nx
      ny = -ny
    }
    out.push({ x: cur.x + nx * dist, y: cur.y + ny * dist })
  }
  return out
}

function fillMonotoneArcFront(
  rect: Rect,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  z: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const bottom = rect.bottomArc
  const top = rect.topArc
  const y0 = rect.y
  const y1 = rect.y + rect.height
  if (bottom && bottom.length >= 2) {
    for (let i = 0; i < bottom.length - 1; i += 1) {
      const a = bottom[i]!
      const b = bottom[i + 1]!
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, a.y, z),
        p(b.x, b.y, z),
        p(b.x, y1, z),
        p(a.x, y1, z),
      )
    }
    return
  }
  if (top && top.length >= 2) {
    for (let i = 0; i < top.length - 1; i += 1) {
      const a = top[i]!
      const b = top[i + 1]!
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, y0, z),
        p(b.x, y0, z),
        p(b.x, b.y, z),
        p(a.x, a.y, z),
      )
    }
  }
}

/**
 * Bossen entlang bottomArc/topArc: paralleler Einzug des Bands, Segment-Quads.
 * Kein Fächer und kein konvexer Ring-Offset (der füllt die Kerbe).
 */
function extrudeMonotoneArcBoss(
  rect: Rect,
  chamfer: number,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  baseZ: number,
  frontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
): boolean {
  if (chamfer <= 0.35) return false
  const bottom = rect.bottomArc
  const top = rect.topArc
  const y0 = rect.y
  const y1 = rect.y + rect.height
  if (bottom && bottom.length >= 3 && !(top && top.length >= 2)) {
    const innerY1 = y1 - chamfer
    if (innerY1 - y0 < 1) return false
    const inner = offsetArcIntoBand(bottom, chamfer, true).map((pt) => ({
      x: pt.x,
      y: Math.min(innerY1 - 0.05, pt.y),
    }))
    if (inner.length !== bottom.length) return false
    if (innerY1 - Math.max(...inner.map((pt) => pt.y)) < 0.4) return false
    for (let i = 0; i < bottom.length - 1; i += 1) {
      const a = inner[i]!
      const b = inner[i + 1]!
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, a.y, frontZ),
        p(b.x, b.y, frontZ),
        p(b.x, innerY1, frontZ),
        p(a.x, innerY1, frontZ),
      )
      addQuad(
        positions,
        normals,
        indices,
        p(bottom[i]!.x, bottom[i]!.y, baseZ),
        p(bottom[i + 1]!.x, bottom[i + 1]!.y, baseZ),
        p(b.x, b.y, frontZ),
        p(a.x, a.y, frontZ),
      )
    }
    addQuad(
      positions,
      normals,
      indices,
      p(bottom[0]!.x, y1, baseZ),
      p(bottom[bottom.length - 1]!.x, y1, baseZ),
      p(inner[inner.length - 1]!.x, innerY1, frontZ),
      p(inner[0]!.x, innerY1, frontZ),
    )
    addQuad(
      positions,
      normals,
      indices,
      p(bottom[0]!.x, bottom[0]!.y, baseZ),
      p(bottom[0]!.x, y1, baseZ),
      p(inner[0]!.x, innerY1, frontZ),
      p(inner[0]!.x, inner[0]!.y, frontZ),
    )
    const last = bottom.length - 1
    addQuad(
      positions,
      normals,
      indices,
      p(bottom[last]!.x, y1, baseZ),
      p(bottom[last]!.x, bottom[last]!.y, baseZ),
      p(inner[last]!.x, inner[last]!.y, frontZ),
      p(inner[last]!.x, innerY1, frontZ),
    )
    return true
  }
  if (top && top.length >= 3 && !(bottom && bottom.length >= 2)) {
    const innerY0 = y0 + chamfer
    if (y1 - innerY0 < 1) return false
    const inner = offsetArcIntoBand(top, chamfer, false).map((pt) => ({
      x: pt.x,
      y: Math.max(innerY0 + 0.05, pt.y),
    }))
    if (inner.length !== top.length) return false
    if (Math.min(...inner.map((pt) => pt.y)) - innerY0 < 0.4) return false
    for (let i = 0; i < top.length - 1; i += 1) {
      const a = inner[i]!
      const b = inner[i + 1]!
      addQuad(
        positions,
        normals,
        indices,
        p(a.x, innerY0, frontZ),
        p(b.x, innerY0, frontZ),
        p(b.x, b.y, frontZ),
        p(a.x, a.y, frontZ),
      )
      addQuad(
        positions,
        normals,
        indices,
        p(top[i]!.x, top[i]!.y, baseZ),
        p(top[i + 1]!.x, top[i + 1]!.y, baseZ),
        p(b.x, b.y, frontZ),
        p(a.x, a.y, frontZ),
      )
    }
    addQuad(
      positions,
      normals,
      indices,
      p(top[0]!.x, y0, baseZ),
      p(inner[0]!.x, innerY0, frontZ),
      p(inner[inner.length - 1]!.x, innerY0, frontZ),
      p(top[top.length - 1]!.x, y0, baseZ),
    )
    addQuad(
      positions,
      normals,
      indices,
      p(top[0]!.x, y0, baseZ),
      p(top[0]!.x, top[0]!.y, baseZ),
      p(inner[0]!.x, inner[0]!.y, frontZ),
      p(inner[0]!.x, innerY0, frontZ),
    )
    const last = top.length - 1
    addQuad(
      positions,
      normals,
      indices,
      p(top[last]!.x, top[last]!.y, baseZ),
      p(top[last]!.x, y0, baseZ),
      p(inner[last]!.x, innerY0, frontZ),
      p(inner[last]!.x, inner[last]!.y, frontZ),
    )
    return true
  }
  return false
}

/** Trapez-Boss der Restkontur; false = kein Boss (kein Diamant-Fallback). */
function extrudeRemnantTrapezoidBoss(
  rect: Rect,
  chamfer: number,
  p: (wx: number, wy: number, z: number) => THREE.Vector3,
  bodyFrontZ: number,
  taperFrontZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
  flush?: { wall: Wall; jambs: Rect[] },
): boolean {
  const ring = remnantOutline(rect)
  if (!ring) return false
  return extrudeInsetRingFrustum(
    ring,
    chamfer,
    p,
    bodyFrontZ,
    taperFrontZ,
    positions,
    normals,
    indices,
    flush,
  )
}

/**
 * Trapez-Pyramidenstumpf: sitzt auf der Steinfront (bodyFrontZ) und ragt
 * taperDepth nach außen. Kantenrücksprung in cm aus panelWidth/panelHeight × (1−taper),
 * damit volle Steine und Reststücke an Öffnungen denselben Schrägwinkel haben
 * (nicht proportional zur Restgröße). Nur erzeugt wenn taperDepth > 0.
 */
function extrudeFrustum(
  rect: Rect,
  wall: Wall,
  panel: StudioPanelConfig,
  miter: { start: boolean; end: boolean },
  allWalls: Wall[],
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const projectDepth = rect.depth ?? panel.projectDepth
  const taperDepth = Math.max(0, rect.taperDepth ?? panel.taperDepth ?? 0)
  if (taperDepth <= 1e-6) return

  const taper = Math.max(0.005, Math.min(1, rect.taper ?? panel.taper ?? 1))
  const { flip, backZ, bodyFrontZ } = panelDepthZs(wall, panel, Math.max(projectDepth, 1e-6))
  const halfH = wall.height / 2
  const taperFrontZ = flip ? bodyFrontZ - taperDepth : bodyFrontZ + taperDepth
  // Gehrung bis zur Bossen-Front: sonst wandert die Kante bei taperDepth-Änderung nicht mit.
  const facadeDepth = Math.max(projectDepth + taperDepth, 1e-6)
  const chamfer = Math.max(0, (Math.min(panel.panelWidth, panel.panelHeight) / 2) * (1 - taper))
  const coordAt = makeCoordAt(wall, panel, miter, [], facadeDepth, backZ)
  const p = makePanelPointFn(wall, coordAt)

  // Keilstein/Fächer: Bossen folgen dem radialen Keil — nie Diamant im Voussoir.
  if (rect.spandrelStrip) {
    extrudeSpandrelStrip(rect.spandrelStrip, p, bodyFrontZ, taperFrontZ, positions, normals, indices)
    return
  }
  // 0,5+0,5: Innenseite flach (in der eigenen Wand). 1+1: volles Trapez.
  let atStart = shouldSuppressBossChamferAtEnd(wall, allWalls, 'start', rect.width, panel, rect.x)
  let atEnd = shouldSuppressBossChamferAtEnd(wall, allWalls, 'end', rect.width, panel, rect.x)
  const joint = panel.joint ?? 0.8
  if (rect.flattenDockStart && rect.x <= 0.6) atStart = true
  if (rect.flattenDockEnd && rect.x + rect.width >= wall.width - 0.6) atEnd = true
  if (rect.keepBossChamferStart && rect.x <= joint / 2 + 0.6) atStart = false
  if (rect.keepBossChamferEnd && rect.x + rect.width >= wall.width - joint / 2 - 0.6) {
    atEnd = false
  }
  const jambs = openingJambBodyRects(wall)
  const x0Flush = rect.x
  const x1Flush = rect.x + rect.width
  const y0Flush = rect.y
  const y1Flush = rect.y + rect.height
  if (
    !rect.keepBossChamferStart &&
    flushBossSide(wall, x0Flush, y0Flush, y1Flush, 'start', jambs)
  ) {
    atStart = true
  }
  if (
    !rect.keepBossChamferEnd &&
    flushBossSide(wall, x1Flush, y0Flush, y1Flush, 'end', jambs)
  ) {
    atEnd = true
  }
  const remnantFlush = { wall, jambs }

  if (rect.outline && rect.outline.length >= 3) {
    const polar = rect.polar
    if (polar) {
      if (!extrudePolarFrustum(polar, chamfer, p, bodyFrontZ, taperFrontZ, positions, normals, indices)) {
        extrudeStone(rect, wall, panel, miter, positions, normals, indices, [], {
          back: bodyFrontZ,
          front: taperFrontZ,
        })
      }
      return
    }
    // Outline-Reste (L/Zwickel): nur Trapez der Kontur — nie Rechteck-Diamant.
    if (!extrudeRemnantTrapezoidBoss(rect, chamfer, p, bodyFrontZ, taperFrontZ, positions, normals, indices, remnantFlush)) {
      const ring = remnantOutline(rect)
      if (ring) fillRingFront(ring, p, bodyFrontZ, positions, normals, indices)
    }
    return
  }

  // Zugeschnittene Steine: Bogenkante als Band-Boss; sonst paralleler Einzug.
  if (isOpeningCut(rect) || Boolean(rect.bottomArc?.length) || Boolean(rect.topArc?.length)) {
    if (extrudeMonotoneArcBoss(rect, chamfer, p, bodyFrontZ, taperFrontZ, positions, normals, indices)) {
      return
    }
    if (extrudeRemnantTrapezoidBoss(rect, chamfer, p, bodyFrontZ, taperFrontZ, positions, normals, indices, remnantFlush)) {
      return
    }
    fillMonotoneArcFront(rect, p, bodyFrontZ, positions, normals, indices)
    return
  }

  let x0 = rect.x
  let x1 = rect.x + rect.width
  const dockPad = panel.joint ?? 0.8
  if (atStart && (panel.pattern === 'strip' || x0 < -0.2)) {
    x0 -= dockPad
  }
  if (atEnd && (panel.pattern === 'strip' || x1 > wall.width + 0.2)) {
    x1 += dockPad
  }
  const y0 = rect.y - halfH
  const y1 = rect.y + rect.height - halfH

  const minFront = 0.05
  // Isotroper Kantenrücksprung — gleiche Maße an allen vier Seiten (Bossenprofil, kein Stretch).
  const inset = Math.min(chamfer, rect.width / 2 - minFront / 2, rect.height / 2 - minFront / 2)
  const insetX = Math.max(0, inset)
  const insetY = Math.max(0, inset)

  let tx0 = atStart ? x0 : x0 + insetX
  let tx1 = atEnd ? x1 : x1 - insetX
  if (tx1 - tx0 < minFront) {
    const mid = (x0 + x1) / 2
    tx0 = mid - minFront / 2
    tx1 = mid + minFront / 2
  }

  let ty0 = rect.y + insetY
  let ty1 = rect.y + rect.height - insetY
  if (ty1 - ty0 < minFront) {
    const mid = rect.y + rect.height / 2
    ty0 = mid - minFront / 2
    ty1 = mid + minFront / 2
  }
  const fy0 = ty0 - halfH
  const fy1 = ty1 - halfH

  const xAt = (wx: number, z: number) =>
    wallLocalX(wall, wx, z, facadeDepth, backZ, miter.start, miter.end)

  // Basisquad (Steinfront)
  const bx0 = xAt(x0, bodyFrontZ), bx1 = xAt(x1, bodyFrontZ)
  const bb0 = v3(bx0, y0, bodyFrontZ), bb1 = v3(bx1, y0, bodyFrontZ)
  const bt1 = v3(bx1, y1, bodyFrontZ), bt0 = v3(bx0, y1, bodyFrontZ)

  // Bossen-Einzug an gegherten Wandenden entlang der Front (auch wallX < 0 in der Keilzone).
  const tileAtWallStart = x0 <= 1e-4
  const tileAtWallEnd = x1 >= wall.width - 1e-4 || x1 >= wall.width - 1e-4
  const fx0 =
    !atStart && tileAtWallStart && miter.start
      ? xAt(x0, taperFrontZ) + insetX
      : xAt(tx0, taperFrontZ)
  const fx1 =
    !atEnd && tileAtWallEnd && miter.end
      ? xAt(x1, taperFrontZ) - insetX
      : xAt(tx1, taperFrontZ)
  const fb0 = v3(fx0, fy0, taperFrontZ), fb1 = v3(fx1, fy0, taperFrontZ)
  const ft1 = v3(fx1, fy1, taperFrontZ), ft0 = v3(fx0, fy1, taperFrontZ)

  // Vorderfläche des Trapez
  addQuad(positions, normals, indices, fb0, fb1, ft1, ft0)
  addQuad(positions, normals, indices, bb0, bb1, fb1, fb0)   // unten
  addQuad(positions, normals, indices, bt1, bt0, ft0, ft1)   // oben
  if (!atStart && !hidePanelReturnFace(wall, miter, x0, rect.y, rect.y + rect.height, 'start', jambs)) {
    addQuad(positions, normals, indices, bt0, bb0, fb0, ft0)   // links
  }
  if (!atEnd && !hidePanelReturnFace(wall, miter, x1, rect.y, rect.y + rect.height, 'end', jambs)) {
    addQuad(positions, normals, indices, bb1, bt1, ft1, fb1)   // rechts
  }
}

function computeVertexNormals(positions: number[], indices: number[], normals: number[]) {
  for (let i = 0; i < normals.length; i += 1) normals[i] = 0
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3
    const ib = indices[i + 1] * 3
    const ic = indices[i + 2] * 3
    const ax = positions[ia]
    const ay = positions[ia + 1]
    const az = positions[ia + 2]
    const bx = positions[ib]
    const by = positions[ib + 1]
    const bz = positions[ib + 2]
    const cx = positions[ic]
    const cy = positions[ic + 1]
    const cz = positions[ic + 2]
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    for (const idx of [indices[i], indices[i + 1], indices[i + 2]]) {
      normals[idx * 3] += nx
      normals[idx * 3 + 1] += ny
      normals[idx * 3 + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2])
    if (len > 1e-6) {
      normals[i] /= len
      normals[i + 1] /= len
      normals[i + 2] /= len
    }
  }
}

/** Prozedurale Studio-Paneele als eine BufferGeometry (Wand-Lokalraum, zentriert). */
export function createStudioPanelGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
  precomputedTiles?: PanelTile[],
): THREE.BufferGeometry {
  if (panel.pattern === 'none' || panel.enabled === false) {
    return new THREE.BufferGeometry()
  }
  const tiles = precomputedTiles ?? layoutPanelTiles(wall, panel, allWalls)
  return buildStudioPanelGeometry(wall, panel, tiles, allWalls, tiles)
}

/**
 * LOD-Mittelstufe: eine extrudierte Fassadenplatte (ein „Stein“ über die ganze Wand),
 * ohne Mauerwerksraster — wenige Vertices statt tausender Ziegel.
 */
export function createStudioPanelLowGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
): THREE.BufferGeometry {
  if (panel.enabled === false || panel.pattern === 'none') {
    return new THREE.BufferGeometry()
  }
  const band = visiblePanelRowRect(wall, panel)
  if (!band) return new THREE.BufferGeometry()
  const tiles = [band]
  return buildStudioPanelGeometry(wall, panel, tiles, allWalls)
}

/**
 * Paneele nach Farbstufe gruppiert (Zufallsvarianz).
 * Eine Geometry pro Index; leere Stufen werden weggelassen.
 */
export function createStudioPanelGeometriesByColorIndex(
  wall: Wall,
  panel: StudioPanelConfig,
  stageCount: number,
  seedKey: string,
  allWalls: Wall[] = [],
  precomputedTiles?: PanelTile[],
): Array<{ stageIndex: number; geometry: THREE.BufferGeometry }> {
  if (panel.pattern === 'none' || panel.enabled === false || stageCount <= 1) {
    return [{ stageIndex: 0, geometry: createStudioPanelGeometry(wall, panel, allWalls, precomputedTiles) }]
  }
  const tiles = precomputedTiles ?? layoutPanelTiles(wall, panel, allWalls)
  if (tiles.length === 0) return [{ stageIndex: 0, geometry: new THREE.BufferGeometry() }]
  // Clip/Merge/Flush einmal über die ganze Wand, dann Reste nach Ursprungsstein einfärben.
  const parts = prepareStudioPanelParts(wall, panel, tiles, tiles)
  const buckets = bucketPartsByColorIndex(parts.rects, seedKey, stageCount)
  const out: Array<{ stageIndex: number; geometry: THREE.BufferGeometry }> = []
  let archParts = parts.ringAndFan
  for (let i = 0; i < stageCount; i += 1) {
    if (buckets[i].length === 0) continue
    out.push({
      stageIndex: i,
      geometry: extrudeStudioPanelParts(
        wall,
        panel,
        { rects: buckets[i], ringAndFan: archParts, holes: parts.holes },
        allWalls,
      ),
    })
    archParts = []
  }
  return out.length > 0
    ? out
    : [{ stageIndex: 0, geometry: new THREE.BufferGeometry() }]
}

/** Farbstufe eines Steins aus dem Ursprungsfeld (`sourceX/Y`, vor dem Öffnungs-Clip). */
function tileColorBucketIndex(
  part: { x: number; y: number; sourceX?: number; sourceY?: number },
  seedKey: string,
  stageCount: number,
): number {
  const x = part.sourceX ?? part.x
  const y = part.sourceY ?? part.y
  const stableIdx = Math.round((x + 1) * 128 + (y + 1) * 0.5)
  return pickTileColorIndex(seedKey, stableIdx, stageCount)
}

function bucketPartsByColorIndex<T extends { x: number; y: number; sourceX?: number; sourceY?: number }>(
  parts: T[],
  seedKey: string,
  stageCount: number,
): T[][] {
  const buckets: T[][] = Array.from({ length: stageCount }, () => [])
  for (const part of parts) {
    buckets[tileColorBucketIndex(part, seedKey, stageCount)].push(part)
  }
  return buckets
}

/** Geschnittene Steine + Bogen-/Keilstein-Teile einer Wand (vor der Extrusion). */
interface StudioPanelParts {
  rects: OpeningPoly[]
  ringAndFan: OpeningPoly[]
  holes: Rect[]
}

function buildStudioPanelGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  allWalls: Wall[],
  layoutTiles?: PanelTile[],
): THREE.BufferGeometry {
  if (tiles.length === 0) return new THREE.BufferGeometry()
  return extrudeStudioPanelParts(
    wall,
    panel,
    prepareStudioPanelParts(wall, panel, tiles, layoutTiles),
    allWalls,
  )
}

/**
 * Öffnungs-Clip, Rest-Verschmelzung und Laibungs-Flush über **alle** Steine der Wand.
 * Farbstufen teilen erst danach auf (`createStudioPanelGeometriesByColorIndex`) — sonst
 * sieht der Clip je Stufe nur einen Teil der Reihe: Reste fallen weg (Treppen-Ecke),
 * Flush zieht Steine über fremde Stufen (Streifen).
 */
function prepareStudioPanelParts(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  layoutTiles?: PanelTile[],
): StudioPanelParts {
  const holes = snapOpeningHolesToTileGrid(wall, panel, layoutTiles ?? tiles)
  const joint = panel.joint ?? 0.8
  const kind = panelKindForPattern(panel.pattern)

  // Raster läuft bis an die Öffnungsmaske. Bei Keilstein-Ring ist die Maske der Extrados.
  let rects: OpeningPoly[] = clipPolysMinusArches(
    tiles.flatMap((tile) => clipTileAgainstHoles(tile, holes)),
    wall.openings,
    PANEL_OPENING_CLEARANCE,
    panel.panelHeight,
    { panelWidth: panel.panelWidth, joint },
  )
  rects = mergeNarrowClipParts(rects, minClipRemnantWidth(panel.panelWidth))
  rects = flushClipPartsToOpeningJambs(rects, wall.openings, PANEL_OPENING_CLEARANCE)
  const voussoirWork: { spec: NonNullable<ReturnType<typeof buildSemicircularArchSpec>> }[] = []
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    if (!openingArchVoussoirsEnabled(opening)) continue
    const spec = buildSemicircularArchSpec(opening, {
      panelWidth: panel.panelWidth,
      panelHeight: panel.panelHeight,
      joint,
      inflate: PANEL_OPENING_CLEARANCE,
    })
    if (!spec) continue
    voussoirWork.push({ spec })
    if (spec.jambs) {
      for (const hole of archJambHoleRects(spec)) {
        rects = rects.flatMap((part) => clipRectMinusBox(part, hole))
      }
    }
  }

  const ringAndFan: OpeningPoly[] = []
  for (const { spec } of voussoirWork) {
    ringAndFan.push(...archVoussoirPolysFromSpec(spec))
    if (spec.jambs) {
      ringAndFan.push(...archJambPolysFromSpec(spec))
    }
    if (spec.spandrel === 'rect') {
      const y0 = spec.cy + spec.rOuter
      const y1 = wall.height
      if (y1 - y0 > 1) {
        const cover: OpeningPoly = {
          x: spec.cx - spec.rOuter,
          y: y0,
          width: spec.rOuter * 2,
          height: y1 - y0,
        }
        rects = rects.flatMap((part) => clipRectMinusBox(part, cover))
        ringAndFan.push(cover)
      }
    }
  }

  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const holeGeom = openingArchGeom(opening, PANEL_OPENING_CLEARANCE)
    if (!holeGeom) continue

    const clearanceCm = openingPanelClearance(opening)
    const voussoirsOn = openingArchVoussoirsEnabled(opening)
    let ringT = 0
    if (voussoirsOn) {
      const spec = voussoirWork.find(
        (w) => Math.abs(w.spec.cx - holeGeom.cx) < 0.01 && Math.abs(w.spec.cy - holeGeom.cy) < 0.01,
      )?.spec
      ringT = spec ? spec.rOuter - spec.rInner : 0
    }

    if (clearanceCm < 0.05) continue
    if (openingPanelClearanceFinish(opening) !== 'taper') continue

    const count = archVoussoirCount(holeGeom, panel.panelWidth)
    if (kind === 'masonry' && !voussoirsOn) {
      ringAndFan.push(...archVoussoirPolys(holeGeom, count, clearanceCm, joint))
    } else {
      const maxY = holeGeom.cy + holeGeom.r + ringT + clearanceCm
      ringAndFan.push(
        ...archFanPolys(holeGeom, ringT, panel.panelHeight, panel.panelWidth, maxY, joint),
      )
    }
  }

  rects = flushClipPartsToOpeningJambs(rects, wall.openings, PANEL_OPENING_CLEARANCE)
  return { rects, ringAndFan, holes }
}

function extrudeStudioPanelParts(
  wall: Wall,
  panel: StudioPanelConfig,
  parts: StudioPanelParts,
  allWalls: Wall[],
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const miter = panelMiterWithReturnCover(wall, allWalls)

  for (const rect of [...parts.rects, ...parts.ringAndFan]) {
    extrudeStone(rect, wall, panel, miter, positions, normals, indices, parts.holes)
    const tileTaperDepth = rect.taperDepth ?? panel.taperDepth ?? 0
    if (tileTaperDepth > 1e-6) {
      extrudeFrustum(rect, wall, panel, miter, allWalls, positions, normals, indices)
    }
  }

  computeVertexNormals(positions, indices, normals)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/** Sockel-Loch: bei Treppe Öffnung von y=0 bis über die Tür schneiden; Freiraum berücksichtigen. */
function plinthClipOpenings(wall: Wall): Opening[] {
  const result: Opening[] = []
  for (const opening of wall.openings) {
    if (opening.hidden) continue
    const clearance = openingPanelClearance(opening)
    const pad = clearance > 0.05 ? clearance : 0
    if (opening.type === 'door' && opening.stairs?.enabled) {
      result.push({
        ...opening,
        x: opening.x - pad,
        width: opening.width + pad * 2,
        y: 0,
        height: opening.y + opening.height,
      })
      continue
    }
    if (pad > 0) {
      result.push({
        ...opening,
        x: opening.x - pad,
        width: opening.width + pad * 2,
      })
      continue
    }
    result.push(opening)
  }
  return result
}

/** Sockelplatte vor den Paneelen, von y=0 bis plinthHeight. */
export function createStudioPlinthGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
): THREE.BufferGeometry | null {
  if (!studioPlinthActive(panel)) return null
  const height = panel.plinthHeight ?? 0
  if (height < 0.5) return null
  const sign = studioWindowDepthForwardSign(wall)
  const offset = (panel.plinthOffsetForward ?? 0) * sign
  const innerZ = studioPanelFaceLocalZ(wall) + offset
  const outerZ = innerZ + (panel.plinthDepth ?? 8) * sign
  const miter = plinthMiterEnds(wall, allWalls)
  const dockStart = Boolean(findCollinearDockWall(wall, 'start', allWalls))
  const dockEnd = Boolean(findCollinearDockWall(wall, 'end', allWalls))
  const clipOpenings = plinthClipOpenings(wall)
  const parts = flushClipPartsToOpeningJambs(
    clipTileAgainstOpenings(
      { x: 0, y: 0, width: wall.width, height },
      clipOpenings,
      PANEL_OPENING_CLEARANCE,
    ),
    clipOpenings,
    PANEL_OPENING_CLEARANCE,
  )
  if (parts.length === 0) return null
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const halfH = wall.height / 2
  const depth = Math.abs(outerZ - innerZ) || panel.plinthDepth || 4
  const xAt = (wx: number, z: number) =>
    wallLocalX(wall, wx, z, depth, innerZ, miter.start, miter.end)
  const p = (wx: number, wy: number, z: number) => v3(xAt(wx, z), wy - halfH, z)

  for (const rect of parts) {
    let x0 = rect.x
    let x1 = rect.x + rect.width
    if (dockStart && x0 <= 0.5) x0 -= 0.6
    if (dockEnd && x1 >= wall.width - 0.5) x1 += 0.6
    const y0 = rect.y
    const y1 = rect.y + rect.height
    const outline = rect.outline
    const bottomArc = rect.bottomArc
    const topArc = rect.topArc

    if (outline && outline.length >= 3) {
      extrudeOutlinePoly(outline, p, innerZ, outerZ, positions, normals, indices)
      continue
    }

    if (bottomArc && bottomArc.length >= 2) {
      const yTop = y1 - halfH
      for (let i = 0; i < bottomArc.length - 1; i += 1) {
        const a = bottomArc[i]!
        const b = bottomArc[i + 1]!
        if (!bottomArcHasStone(a.y, y1) || !bottomArcHasStone(b.y, y1)) continue
        const ya0 = Math.max(a.y, y0) - halfH
        const ya1 = Math.max(b.y, y0) - halfH
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, outerZ), ya0, outerZ),
          v3(xAt(b.x, outerZ), ya1, outerZ),
          v3(xAt(b.x, outerZ), yTop, outerZ),
          v3(xAt(a.x, outerZ), yTop, outerZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, innerZ), yTop, innerZ),
          v3(xAt(b.x, innerZ), yTop, innerZ),
          v3(xAt(b.x, innerZ), ya1, innerZ),
          v3(xAt(a.x, innerZ), ya0, innerZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, innerZ), ya0, innerZ),
          v3(xAt(b.x, innerZ), ya1, innerZ),
          v3(xAt(b.x, outerZ), ya1, outerZ),
          v3(xAt(a.x, outerZ), ya0, outerZ),
        )
      }
      const a0 = bottomArc.find((pt) => bottomArcHasStone(pt.y, y1))
      const aN = [...bottomArc].reverse().find((pt) => bottomArcHasStone(pt.y, y1))
      if (a0 && !(dockStart && rect.x <= 0.5)) {
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a0.x, innerZ), Math.max(a0.y, y0) - halfH, innerZ),
          v3(xAt(a0.x, innerZ), yTop, innerZ),
          v3(xAt(a0.x, outerZ), yTop, outerZ),
          v3(xAt(a0.x, outerZ), Math.max(a0.y, y0) - halfH, outerZ),
        )
      }
      if (aN && aN !== a0 && !(dockEnd && rect.x + rect.width >= wall.width - 0.5)) {
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(aN.x, innerZ), yTop, innerZ),
          v3(xAt(aN.x, innerZ), Math.max(aN.y, y0) - halfH, innerZ),
          v3(xAt(aN.x, outerZ), Math.max(aN.y, y0) - halfH, outerZ),
          v3(xAt(aN.x, outerZ), yTop, outerZ),
        )
      }
      continue
    }

    if (topArc && topArc.length >= 2) {
      const yBot = y0 - halfH
      for (let i = 0; i < topArc.length - 1; i += 1) {
        const a = topArc[i]!
        const b = topArc[i + 1]!
        if (!topArcHasStone(a.y, y0) || !topArcHasStone(b.y, y0)) continue
        const ay = Math.min(a.y, y1) - halfH
        const by = Math.min(b.y, y1) - halfH
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, outerZ), yBot, outerZ),
          v3(xAt(b.x, outerZ), yBot, outerZ),
          v3(xAt(b.x, outerZ), by, outerZ),
          v3(xAt(a.x, outerZ), ay, outerZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, innerZ), ay, innerZ),
          v3(xAt(b.x, innerZ), by, innerZ),
          v3(xAt(b.x, innerZ), yBot, innerZ),
          v3(xAt(a.x, innerZ), yBot, innerZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, innerZ), ay, innerZ),
          v3(xAt(a.x, outerZ), ay, outerZ),
          v3(xAt(b.x, outerZ), by, outerZ),
          v3(xAt(b.x, innerZ), by, innerZ),
        )
      }
      continue
    }

    const ly0 = y0 - halfH
    const ly1 = y1 - halfH
    const blb = v3(xAt(x0, innerZ), ly0, innerZ)
    const brb = v3(xAt(x1, innerZ), ly0, innerZ)
    const trb = v3(xAt(x1, innerZ), ly1, innerZ)
    const tlb = v3(xAt(x0, innerZ), ly1, innerZ)
    const blf = v3(xAt(x0, outerZ), ly0, outerZ)
    const brf = v3(xAt(x1, outerZ), ly0, outerZ)
    const trf = v3(xAt(x1, outerZ), ly1, outerZ)
    const tlf = v3(xAt(x0, outerZ), ly1, outerZ)
    addQuad(positions, normals, indices, blb, tlb, trb, brb)
    addQuad(positions, normals, indices, blf, brf, trf, tlf)
    addQuad(positions, normals, indices, blb, brb, brf, blf)
    addQuad(positions, normals, indices, trb, tlb, tlf, trf)
    const jambs = openingJambBodyRects(wall)
    if (
      !(dockStart && rect.x <= 0.5) &&
      !hidePanelReturnFace(wall, miter, x0, y0, y1, 'start', jambs)
    ) {
      addQuad(positions, normals, indices, tlb, blb, blf, tlf)
    }
    if (
      !(dockEnd && rect.x + rect.width >= wall.width - 0.5) &&
      !hidePanelReturnFace(wall, miter, x1, y0, y1, 'end', jambs)
    ) {
      addQuad(positions, normals, indices, brb, trb, trf, brf)
    }
  }
  computeVertexNormals(positions, indices, normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Mörtel-Geometrie: Eine flache Platte über die gesamte Wandfläche (ohne Öffnungen),
 * Tiefe = jointDepth. Die Steine (projectDepth tiefer) verdecken die Mörtelplatte —
 * nur in den Fugen (Lücken zwischen Steinen) bleibt der Mörtel sichtbar.
 * Liefert null wenn joint = 0 oder jointDepth = 0.
 */
export function createStudioMortarGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
  precomputedTiles?: PanelTile[],
): THREE.BufferGeometry | null {
  const joint = panel.joint ?? 0
  const rawJointDepth = panel.jointDepth ?? 0
  if (joint <= 1e-6 || rawJointDepth <= 1e-6) return null

  const jointDepth = Math.max(0, rawJointDepth)
  const { backZ, bodyFrontZ: mortarFrontZ } = panelDepthZs(wall, panel, jointDepth)
  const projectDepth = Math.max(panel.projectDepth, 1e-6)
  const miter = panelMiterEnds(wall, allWalls)

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  const halfH = wall.height / 2

  // Gleiches gerastertes Loch wie die Paneele, damit Mörtel und Steine zusammenpassen.
  const tiles = precomputedTiles ?? layoutPanelTiles(wall, panel, allWalls)
  const band = visiblePanelRowRect(wall, panel)
  if (!band) return null
  const holes = snapOpeningHolesToTileGrid(wall, panel, tiles)
  const mortarX0 = tiles.length > 0 ? Math.min(...tiles.map((t) => t.x)) : band.x
  const mortarX1 = tiles.length > 0 ? Math.max(...tiles.map((t) => t.x + t.width)) : band.x + band.width
  const mortarBand = { ...band, x: mortarX0, width: Math.max(CLIP_EPS, mortarX1 - mortarX0) }
  const fullRects = flushClipPartsToOpeningJambs(
    mergeNarrowClipParts(
      clipPolysMinusArches(
        clipTileAgainstHoles(mortarBand, holes),
        wall.openings,
        PANEL_OPENING_CLEARANCE,
        panel.panelHeight,
        { dockCartesianAtExtrados: false, panelWidth: panel.panelWidth, joint: panel.joint },
      ),
      minClipRemnantWidth(panel.panelWidth),
    ),
    wall.openings,
    PANEL_OPENING_CLEARANCE,
  )

  const xAt = (wx: number, z: number) =>
    wallLocalX(wall, wx, z, projectDepth, backZ, miter.start, miter.end)

  for (const rect of fullRects) {
    const y1 = rect.y + rect.height
    const outline = rect.outline
    if (outline && outline.length >= 3) {
      const p = (wx: number, wy: number, z: number) => v3(xAt(wx, z), wy - halfH, z)
      extrudeOutlinePoly(outline, p, backZ, mortarFrontZ, positions, normals, indices)
      continue
    }
    const arc = rect.bottomArc

    if (arc && arc.length >= 2) {
      for (let i = 0; i < arc.length - 1; i += 1) {
        const a = arc[i]
        const b = arc[i + 1]
        if (!bottomArcHasStone(a.y, y1) || !bottomArcHasStone(b.y, y1)) continue
        const ya0 = Math.max(a.y, rect.y) - halfH
        const ya1 = Math.max(b.y, rect.y) - halfH
        const yt = y1 - halfH
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, mortarFrontZ), ya0, mortarFrontZ),
          v3(xAt(b.x, mortarFrontZ), ya1, mortarFrontZ),
          v3(xAt(b.x, mortarFrontZ), yt, mortarFrontZ),
          v3(xAt(a.x, mortarFrontZ), yt, mortarFrontZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, backZ), ya0, backZ),
          v3(xAt(b.x, backZ), ya1, backZ),
          v3(xAt(b.x, mortarFrontZ), ya1, mortarFrontZ),
          v3(xAt(a.x, mortarFrontZ), ya0, mortarFrontZ),
        )
      }
      continue
    }

    const topArc = rect.topArc
    if (topArc && topArc.length >= 2) {
      const yBot = rect.y - halfH
      for (let i = 0; i < topArc.length - 1; i += 1) {
        const a = topArc[i]
        const b = topArc[i + 1]
        if (!topArcHasStone(a.y, rect.y) || !topArcHasStone(b.y, rect.y)) continue
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, mortarFrontZ), yBot, mortarFrontZ),
          v3(xAt(b.x, mortarFrontZ), yBot, mortarFrontZ),
          v3(xAt(b.x, mortarFrontZ), Math.min(b.y, y1) - halfH, mortarFrontZ),
          v3(xAt(a.x, mortarFrontZ), Math.min(a.y, y1) - halfH, mortarFrontZ),
        )
        addQuad(
          positions,
          normals,
          indices,
          v3(xAt(a.x, backZ), Math.min(a.y, y1) - halfH, backZ),
          v3(xAt(b.x, backZ), Math.min(b.y, y1) - halfH, backZ),
          v3(xAt(b.x, mortarFrontZ), Math.min(b.y, y1) - halfH, mortarFrontZ),
          v3(xAt(a.x, mortarFrontZ), Math.min(a.y, y1) - halfH, mortarFrontZ),
        )
      }
      continue
    }

    const x0 = rect.x, x1 = rect.x + rect.width
    const y0 = rect.y - halfH, yBot1 = rect.y + rect.height - halfH
    const xb0 = xAt(x0, backZ)
    const xb1 = xAt(x1, backZ)
    const xf0 = xAt(x0, mortarFrontZ)
    const xf1 = xAt(x1, mortarFrontZ)

    // Vorderfläche (sichtbar zwischen Steinen in den Fugen)
    addQuad(
      positions,
      normals,
      indices,
      v3(xf0, y0, mortarFrontZ),
      v3(xf1, y0, mortarFrontZ),
      v3(xf1, yBot1, mortarFrontZ),
      v3(xf0, yBot1, mortarFrontZ),
    )
    // Rückfläche und Seiten für geschlossenes Mesh
    addQuad(positions, normals, indices,
      v3(xb0, y0, backZ), v3(xb0, yBot1, backZ),
      v3(xb1, yBot1, backZ), v3(xb1, y0, backZ),
    )
    addQuad(positions, normals, indices,
      v3(xb0, y0, backZ), v3(xb1, y0, backZ),
      v3(xf1, y0, mortarFrontZ), v3(xf0, y0, mortarFrontZ),
    )
    addQuad(positions, normals, indices,
      v3(xb1, yBot1, backZ), v3(xb0, yBot1, backZ),
      v3(xf0, yBot1, mortarFrontZ), v3(xf1, yBot1, mortarFrontZ),
    )
    addQuad(positions, normals, indices,
      v3(xb0, yBot1, backZ), v3(xb0, y0, backZ),
      v3(xf0, y0, mortarFrontZ), v3(xf0, yBot1, mortarFrontZ),
    )
    addQuad(positions, normals, indices,
      v3(xb1, y0, backZ), v3(xb1, yBot1, backZ),
      v3(xf1, yBot1, mortarFrontZ), v3(xf1, y0, mortarFrontZ),
    )
  }

  computeVertexNormals(positions, indices, normals)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function localY(wallY: number, wall: Wall): number {
  return wallY - wall.height / 2
}

/** Öffnungsmaske im wandzentrierten Lokalraum (für Drag-Ghost auf der Fassadenfläche). */
export function openingDragGhostWallLocalPoints(
  wall: Wall,
  opening: Opening,
  localZ: number,
): { x: number; y: number }[] {
  return openingWallFaceMaskPolyline(opening, 0, ARCH_MESH_SEGMENTS).map((p) => ({
    x: wallLocalX(wall, p.x, localZ),
    y: localY(p.y, wall),
  }))
}

/**
 * ShapeGeometry liegt in XY und blickt standardmäßig nach +Z.
 * `reverse` dreht die Windung, damit die Normale nach außen bzw. in den Raum zeigt.
 */
function wallFaceNormalReverse(wall: Wall, z: number, innerZ: number): boolean {
  const outwardSign = wall.panelFlip ?? true ? -1 : 1
  const isInner = Math.abs(z - innerZ) < 1e-6
  if (isInner) return outwardSign > 0
  return outwardSign < 0
}

/** Test-Hook: korrekte Normalen-Richtung für Außen-/Innenfläche. */
export function studioWallFaceNormalReverse(wall: Wall, z: number): boolean {
  return wallFaceNormalReverse(wall, z, studioWallInnerLocalZ(wall))
}

function appendShapeFace(
  shape: THREE.Shape,
  z: number,
  reverse: boolean,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const geometry = new THREE.ShapeGeometry(shape, ARCH_MESH_SEGMENTS)
  const pos = geometry.getAttribute('position')
  const idx = geometry.getIndex()
  const base = positions.length / 3
  for (let i = 0; i < pos.count; i += 1) {
    positions.push(pos.getX(i), pos.getY(i), z)
    normals.push(0, 0, reverse ? 1 : -1)
  }
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = base + idx.getX(i)
      const b = base + idx.getX(i + 1)
      const c = base + idx.getX(i + 2)
      if (reverse) indices.push(a, c, b)
      else indices.push(a, b, c)
    }
  }
  geometry.dispose()
}

function addArchOpeningHole(path: THREE.Path, wall: Wall, opening: Opening, z: number) {
  appendOpeningContour(path, wall, opening, clearanceWallHoleInflate(wall, opening, z), z, true)
}

function clearanceWallHoleInflate(wall: Wall, opening: Opening, faceZ: number): number {
  if (!studioClearanceRecessInwardOfWall(wall, opening)) return 0
  const panelsOn = wallHasPanels(wall)
  if (panelsOn && openingPanelClearanceFinish(opening) !== 'empty') return 0
  if (panelsOn && openingArchVoussoirsEnabled(opening)) return 0
  const outer = studioWallOuterLocalZ(wall)
  if (Math.abs(faceZ - outer) > 0.05) return 0
  return openingPanelClearance(opening)
}

function appendClearanceRingFaces(
  wall: Wall,
  opening: Opening,
  clearance: number,
  z0: number,
  z1: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const outer = openingMaskPolyline(opening, clearance)
  const inner = openingMaskPolyline(opening, 0)
  if (outer.length < 3 || inner.length !== outer.length) return
  const skipSill = opening.y <= 0.5
  const n = outer.length
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const ao = outer[i]!
    const bo = outer[j]!
    const ai = inner[i]!
    const bi = inner[j]!
    if (skipSill && ao.y <= 0.5 && bo.y <= 0.5) continue
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(wallLocalX(wall, ao.x, z0), localY(ao.y, wall), z0),
      new THREE.Vector3(wallLocalX(wall, bo.x, z0), localY(bo.y, wall), z0),
      new THREE.Vector3(wallLocalX(wall, bi.x, z0), localY(bi.y, wall), z0),
      new THREE.Vector3(wallLocalX(wall, ai.x, z0), localY(ai.y, wall), z0),
    )
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(wallLocalX(wall, ai.x, z1), localY(ai.y, wall), z1),
      new THREE.Vector3(wallLocalX(wall, bi.x, z1), localY(bi.y, wall), z1),
      new THREE.Vector3(wallLocalX(wall, bo.x, z1), localY(bo.y, wall), z1),
      new THREE.Vector3(wallLocalX(wall, ao.x, z1), localY(ao.y, wall), z1),
    )
  }
}

function appendExtrudedRing(
  wall: Wall,
  opening: Opening,
  clearance: number,
  contourZ: number,
  z0: number,
  z1: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const shape = new THREE.Shape()
  appendOpeningContour(shape, wall, opening, clearance, contourZ, false)
  const hole = new THREE.Path()
  appendOpeningContour(hole, wall, opening, 0, contourZ, true)
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.5, z1 - z0),
    bevelEnabled: false,
    curveSegments: ARCH_MESH_SEGMENTS,
  })
  geometry.translate(0, 0, z0)
  const pos = geometry.getAttribute('position')
  const idx = geometry.getIndex()
  const base = positions.length / 3
  for (let i = 0; i < pos.count; i += 1) {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    normals.push(0, 0, 0)
  }
  if (idx) {
    for (let i = 0; i < idx.count; i += 1) indices.push(base + idx.getX(i))
  } else {
    for (let i = 0; i < pos.count; i += 1) indices.push(base + i)
  }
  geometry.dispose()
}

function appendClearanceStepSides(
  wall: Wall,
  opening: Opening,
  clearance: number,
  zOuter: number,
  zRecess: number,
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const poly = openingMaskPolyline(opening, clearance)
  if (poly.length < 3) return
  const skipSill = opening.y <= 0.5
  const n = poly.length
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    if (skipSill && a.y <= 0.5 && b.y <= 0.5) continue
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(wallLocalX(wall, a.x, zOuter), localY(a.y, wall), zOuter),
      new THREE.Vector3(wallLocalX(wall, b.x, zOuter), localY(b.y, wall), zOuter),
      new THREE.Vector3(wallLocalX(wall, b.x, zRecess), localY(b.y, wall), zRecess),
      new THREE.Vector3(wallLocalX(wall, a.x, zRecess), localY(a.y, wall), zRecess),
    )
  }
}

/**
 * Frontverschluss / Rahmen für Freiraum: Band zwischen Öffnung und Clearance-Außenkante.
 * Vor der Wand: Extrusion bis zur Front. In der Wand: Maske in der Außenfläche,
 * Rückwand an der Vertiefung, Stufen-Leibung am Außenrand.
 */
export function createStudioClearanceCapGeometry(
  wall: Wall,
  opening: Opening,
  _panel: StudioPanelConfig,
): THREE.BufferGeometry | null {
  if (opening.hidden || !openingCutsWall(opening)) return null
  const clearance = openingPanelClearance(opening)
  if (clearance < 0.05) return null
  const panelsOn = wallHasPanels(wall)
  if (panelsOn && openingPanelClearanceFinish(opening) !== 'empty') return null
  if (panelsOn && openingArchVoussoirsEnabled(opening)) return null

  const recessZ = studioClearanceRecessZ(wall, opening)
  if (recessZ == null) return null
  const wallOuterZ = studioWallOuterLocalZ(wall)
  const sign = studioWindowDepthForwardSign(wall)
  const inward = studioClearanceRecessInwardOfWall(wall, opening)

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  if (inward) {
    const inner = studioWallInnerLocalZ(wall)
    const plateBack =
      sign >= 0
        ? Math.max(inner, recessZ - 2)
        : Math.min(inner, recessZ + 2)
    const z0 = Math.min(recessZ, plateBack)
    const z1 = Math.max(recessZ, plateBack)
    if (opening.y <= 0.5) {
      appendClearanceRingFaces(wall, opening, clearance, z0, z1, positions, normals, indices)
    } else {
      appendExtrudedRing(wall, opening, clearance, recessZ, z0, z1, positions, normals, indices)
    }
    appendClearanceStepSides(wall, opening, clearance, wallOuterZ, recessZ, positions, normals, indices)
  } else {
    if (Math.abs(recessZ - wallOuterZ) < 0.35) return null
    const z0 = Math.min(recessZ, wallOuterZ)
    const z1 = Math.max(recessZ, wallOuterZ)
    appendExtrudedRing(wall, opening, clearance, recessZ, z0, z1, positions, normals, indices)
  }

  if (indices.length < 3) return null
  computeVertexNormals(positions, indices, normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

/** Öffnungskontur (Rechteck, Rundbogen oder Stadion) in Wand-Lokal-XY. */
function appendOpeningContour(
  path: THREE.Shape | THREE.Path,
  wall: Wall,
  opening: Opening,
  inflate: number,
  z: number,
  holeWinding: boolean,
) {
  const pts = openingWallFaceMaskPolyline(opening, inflate).map((p) => ({
    x: wallLocalX(wall, p.x, z),
    y: localY(Math.max(0, p.y), wall),
  }))
  if (pts.length < 3) return
  const seq = holeWinding ? [...pts].reverse() : pts
  path.moveTo(seq[0].x, seq[0].y)
  for (let i = 1; i < seq.length; i += 1) {
    path.lineTo(seq[i].x, seq[i].y)
  }
  // ShapeUtils schließt den Pfad — kein zweites lineTo zum Startpunkt.
}

function studioWallFaceShape(wall: Wall, z: number): THREE.Shape {
  const y0 = localY(0, wall)
  const y1 = localY(wall.height, wall)
  const x0 = wallLocalX(wall, 0, z)
  const x1 = wallLocalX(wall, wall.width, z)
  const shape = new THREE.Shape()
  const groundAll = wall.openings
    .filter((opening) => opening.y === 0 && openingCutsWall(opening) && !openingHasRoundMask(opening))
    .slice()
    .sort((a, b) => a.x - b.x)
  // Notch berührt die Wandkante → Earcut-Diagonale durchs Loch. Dann als Loch behandeln.
  const groundNotches: Opening[] = []
  const groundAsHoles: Opening[] = []
  for (const opening of groundAll) {
    const inflate = clearanceWallHoleInflate(wall, opening, z)
    const masonry = openingMasonryRect(opening, inflate)
    if (masonry.x <= 0.05 || masonry.x + masonry.width >= wall.width - 0.05) {
      groundAsHoles.push(opening)
    } else {
      groundNotches.push(opening)
    }
  }
  const elevated = [
    ...groundAsHoles,
    ...wall.openings.filter(
      (opening) => openingCutsWall(opening) && (opening.y > 0 || openingHasRoundMask(opening)),
    ),
  ]

  shape.moveTo(x0, y0)
  let cursor = 0
  for (const opening of groundNotches) {
    const inflate = clearanceWallHoleInflate(wall, opening, z)
    const masonry = openingMasonryRect(opening, inflate)
    const ox0 = wallLocalX(wall, masonry.x, z)
    if (masonry.x > cursor + 0.05) shape.lineTo(ox0, y0)
    const poly = openingWallFaceMaskPolyline(opening, inflate)
    if (poly.length >= 3) {
      const notch = [poly[0], ...poly.slice(1).reverse()]
      let prevX = Number.NaN
      let prevY = Number.NaN
      for (const p of notch) {
        const nx = wallLocalX(wall, p.x, z)
        const ny = localY(Math.max(0, p.y), wall)
        if (Number.isFinite(prevX) && Math.hypot(nx - prevX, ny - prevY) < 0.05) continue
        shape.lineTo(nx, ny)
        prevX = nx
        prevY = ny
      }
    }
    cursor = masonry.x + masonry.width
  }
  if (cursor < wall.width - 0.05) shape.lineTo(x1, y0)
  shape.lineTo(x1, y1)
  shape.lineTo(x0, y1)
  shape.closePath()

  for (const opening of elevated) {
    const hole = new THREE.Path()
    addArchOpeningHole(hole, wall, opening, z)
    shape.holes.push(hole)
  }
  return shape
}

/** Material 0 = außen/Mörtel/Kanten, Material 1 = Innenwandfläche. */
function wallBodyGeometryWithGroups(
  positions: number[],
  normals: number[],
  indices: number[],
  exteriorIndexCount: number,
): THREE.BufferGeometry {
  computeVertexNormals(positions, indices, normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  const total = indices.length
  const ext = Math.max(0, Math.min(exteriorIndexCount, total))
  if (ext > 0) geometry.addGroup(0, ext, 0)
  if (total > ext) geometry.addGroup(ext, total - ext, 1)
  return geometry
}

/** Teilmenge eines gruppierten Wandkörpers — für Layer-Trennung Außen (0) / Innen (1). */
export function cloneWallGeometryGroup(
  geometry: THREE.BufferGeometry,
  groupIndex: number,
): THREE.BufferGeometry | null {
  const g = geometry.groups[groupIndex]
  if (!g || g.count === 0) return null
  const index = geometry.getIndex()
  if (!index) return null
  const out: number[] = []
  for (let i = g.start; i < g.start + g.count; i += 1) {
    out.push(index.getX(i)!)
  }
  const cloned = new THREE.BufferGeometry()
  cloned.setAttribute('position', geometry.getAttribute('position').clone())
  cloned.setAttribute('normal', geometry.getAttribute('normal').clone())
  cloned.setIndex(out)
  cloned.addGroup(0, out.length, 0)
  return cloned
}

function createArcBayWallGeometry(wall: Wall): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const strips = ARC_WALL_MESH_STRIPS
  const halfH = wall.height / 2
  const yBottom = -halfH
  const yTop = halfH
  const depth = Math.max(wall.depth, 1e-6)

  const outerRing: THREE.Vector3[] = []
  const innerRing: THREE.Vector3[] = []
  for (let i = 0; i <= strips; i += 1) {
    const wallX = (wall.width * i) / strips
    const outer = arcWallLocalPoint(wall, wallX, 0, 0)
    const inner = arcWallLocalPoint(wall, wallX, 0, depth)
    outerRing.push(new THREE.Vector3(outer.x, yBottom, outer.z))
    innerRing.push(new THREE.Vector3(inner.x, yBottom, inner.z))
  }

  for (let i = 0; i < strips; i += 1) {
    const wallX0 = (wall.width * i) / strips
    const wallX1 = (wall.width * (i + 1)) / strips
    const o0 = arcWallLocalPoint(wall, wallX0, 0, 0)
    const o1 = arcWallLocalPoint(wall, wallX1, 0, 0)
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(o0.x, yBottom, o0.z),
      new THREE.Vector3(o1.x, yBottom, o1.z),
      new THREE.Vector3(o1.x, yTop, o1.z),
      new THREE.Vector3(o0.x, yTop, o0.z),
    )
  }

  for (let i = 0; i < strips; i += 1) {
    addQuad(
      positions,
      normals,
      indices,
      outerRing[i]!.clone().setY(yTop),
      outerRing[i + 1]!.clone().setY(yTop),
      innerRing[i + 1]!.clone().setY(yTop),
      innerRing[i]!.clone().setY(yTop),
    )
    addQuad(
      positions,
      normals,
      indices,
      outerRing[i]!,
      innerRing[i]!,
      innerRing[i + 1]!,
      outerRing[i + 1]!,
    )
  }

  const oStart = arcWallLocalPoint(wall, 0, 0, 0)
  const iStart = arcWallLocalPoint(wall, 0, 0, depth)
  const oEnd = arcWallLocalPoint(wall, wall.width, 0, 0)
  const iEnd = arcWallLocalPoint(wall, wall.width, 0, depth)
  addQuad(
    positions,
    normals,
    indices,
    new THREE.Vector3(oStart.x, yBottom, oStart.z),
    new THREE.Vector3(iStart.x, yBottom, iStart.z),
    new THREE.Vector3(iStart.x, yTop, iStart.z),
    new THREE.Vector3(oStart.x, yTop, oStart.z),
  )
  addQuad(
    positions,
    normals,
    indices,
    new THREE.Vector3(iEnd.x, yBottom, iEnd.z),
    new THREE.Vector3(oEnd.x, yBottom, oEnd.z),
    new THREE.Vector3(oEnd.x, yTop, oEnd.z),
    new THREE.Vector3(iEnd.x, yTop, iEnd.z),
  )

  const exteriorIndexCount = indices.length
  for (let i = 0; i < strips; i += 1) {
    const wallX0 = (wall.width * i) / strips
    const wallX1 = (wall.width * (i + 1)) / strips
    const i0 = arcWallLocalPoint(wall, wallX0, 0, depth)
    const i1 = arcWallLocalPoint(wall, wallX1, 0, depth)
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(i1.x, yBottom, i1.z),
      new THREE.Vector3(i0.x, yBottom, i0.z),
      new THREE.Vector3(i0.x, yTop, i0.z),
      new THREE.Vector3(i1.x, yTop, i1.z),
    )
  }

  return wallBodyGeometryWithGroups(positions, normals, indices, exteriorIndexCount)
}

/** Gehrungskörper: Außenkante = gezeichnete Linie, Dicke nach innen, Enden 45°/135°. */
export function createStudioWallGeometry(wall: Wall, allWalls: Wall[] = []): THREE.BufferGeometry {
  if (wallHasArcBay(wall)) {
    return createArcBayWallGeometry(wall)
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const halfH = wall.height / 2
  const outerZ = studioWallOuterLocalZ(wall)
  const innerZ = studioWallInnerLocalZ(wall)
  const panelsOn = wallHasPanels(wall)

  // Außenfläche immer — auch bei Paneelen (z. B. ausgeblendete Reihen). Leicht nach innen versetzt, damit
  // keine Z-Fights mit Mörtel/Steinrücken entstehen (Moiré). Im oberen Freistreifen volle Tiefe — sonst kein Bodenschatten.
  const bareTop = panelsOn ? topBareBandForWall(wall) : null
  const sign = studioWindowDepthForwardSign(wall)
  const insetFaceZ = outerZ - sign * 0.15
  const faceReverse = (z: number) => wallFaceNormalReverse(wall, z, innerZ)
  // Freistreifen oben: volle Tiefe, damit die nackte Wandfläche sichtbar bleibt und Schatten wirft.
  const outerFaceZ = panelsOn && !bareTop ? insetFaceZ : outerZ
  appendShapeFace(studioWallFaceShape(wall, outerFaceZ), outerFaceZ, faceReverse(outerFaceZ), positions, normals, indices)

  const yBottom = -halfH
  const yTop = halfH
  const startOuter = wallLocalX(wall, 0, outerZ)
  const startInner = wallLocalX(wall, 0, innerZ)
  const endOuter = wallLocalX(wall, wall.width, outerZ)
  const endInner = wallLocalX(wall, wall.width, innerZ)

  const startAdj = findCollinearDockWall(wall, 'start', allWalls)
  const endAdj = findCollinearDockWall(wall, 'end', allWalls)
  const hideStartSide = Boolean(startAdj && isCollinearDock(wall, startAdj))
  const hideEndSide = Boolean(endAdj && isCollinearDock(wall, endAdj))

  if (!hideStartSide) {
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(startOuter, yBottom, outerZ),
      new THREE.Vector3(startOuter, yTop, outerZ),
      new THREE.Vector3(startInner, yTop, innerZ),
      new THREE.Vector3(startInner, yBottom, innerZ),
    )
  }
  if (!hideEndSide) {
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(endOuter, yBottom, outerZ),
      new THREE.Vector3(endInner, yBottom, innerZ),
      new THREE.Vector3(endInner, yTop, innerZ),
      new THREE.Vector3(endOuter, yTop, outerZ),
    )
  }
  addQuad(
    positions,
    normals,
    indices,
    new THREE.Vector3(startOuter, yTop, outerZ),
    new THREE.Vector3(endOuter, yTop, outerZ),
    new THREE.Vector3(endInner, yTop, innerZ),
    new THREE.Vector3(startInner, yTop, innerZ),
  )

  const doors = wall.openings.filter((opening) => opening.y === 0)
  if (doors.length === 0) {
    addQuad(
      positions,
      normals,
      indices,
      new THREE.Vector3(startOuter, yBottom, outerZ),
      new THREE.Vector3(endOuter, yBottom, outerZ),
      new THREE.Vector3(endInner, yBottom, innerZ),
      new THREE.Vector3(startInner, yBottom, innerZ),
    )
  }
  // Bei Bodentüren kein separates Bodenquad — vermeidet Stör-Linie an der Schwelle.

  const exteriorIndexCount = indices.length
  appendShapeFace(studioWallFaceShape(wall, innerZ), innerZ, faceReverse(innerZ), positions, normals, indices)
  return wallBodyGeometryWithGroups(positions, normals, indices, exteriorIndexCount)
}

/**
 * Unsichtbarer Öffnungs-Tunnel nur für die Shadow-Map.
 * Reicht von der Fassadenaußenfläche (inkl. Paneel-Vorstand) bis zur Wandinnenseite —
 * sonst leckt Licht durch die Paneeltiefe am Sturz/an den Laibungen (helle Linie über Türen).
 * Nicht in den sichtbaren Wandkörper: sonst Z-Fight mit Laibung/Paneelen.
 */
/** Leichte Aufweitung gegen Shadow-Bias / Peter-Panning an der Kontur (cm). */
const OPENING_SHADOW_TUNNEL_INFLATE_CM = 2.5

export function createStudioOpeningShadowTunnelGeometry(wall: Wall): THREE.BufferGeometry | null {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const facadeZ = studioFacadeOutwardLocalZ(wall)
  const innerZ = studioWallInnerLocalZ(wall)
  const forward = studioWindowDepthForwardSign(wall)
  let quads = 0
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const revealZ = studioOpeningRevealOuterZ(wall, opening)
    const outerZ = forward >= 0 ? Math.max(facadeZ, revealZ) : Math.min(facadeZ, revealZ)
    if (Math.abs(outerZ - innerZ) < 0.35) continue
    const poly = openingMaskPolyline(opening, OPENING_SHADOW_TUNNEL_INFLATE_CM)
    if (poly.length < 3) continue
    const n = poly.length
    for (let i = 0; i < n; i += 1) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      addQuad(
        positions,
        normals,
        indices,
        new THREE.Vector3(wallLocalX(wall, a.x, outerZ), localY(a.y, wall), outerZ),
        new THREE.Vector3(wallLocalX(wall, b.x, outerZ), localY(b.y, wall), outerZ),
        new THREE.Vector3(wallLocalX(wall, b.x, innerZ), localY(b.y, wall), innerZ),
        new THREE.Vector3(wallLocalX(wall, a.x, innerZ), localY(a.y, wall), innerZ),
      )
      quads += 1
    }
    if (openingIsConch(opening)) {
      const fill = normalizeOpeningFill(opening.fill)
      const depth = Math.max(1, fill.nicheDepthCm ?? 10)
      const zOuter = studioOpeningRevealOuterZ(wall, opening)
      const outward = studioWindowDepthForwardSign(wall)
      const backZ = zOuter - outward * depth
      appendOpeningMaskCap(wall, poly, innerZ, positions, normals, indices)
      appendOpeningMaskCap(wall, poly, outerZ, positions, normals, indices)
      if (Math.abs(backZ - innerZ) > 0.35) {
        appendOpeningMaskCap(wall, poly, backZ, positions, normals, indices)
      }
      quads += 3
    } else if (basementWindowEnabled(opening)) {
      appendOpeningMaskCap(wall, poly, innerZ, positions, normals, indices)
      const yCap = opening.y + opening.height + OPENING_SHADOW_TUNNEL_INFLATE_CM
      const x0 = opening.x - OPENING_SHADOW_TUNNEL_INFLATE_CM
      const x1 = opening.x + opening.width + OPENING_SHADOW_TUNNEL_INFLATE_CM
      addQuad(
        positions,
        normals,
        indices,
        new THREE.Vector3(wallLocalX(wall, x0, outerZ), localY(yCap, wall), outerZ),
        new THREE.Vector3(wallLocalX(wall, x1, outerZ), localY(yCap, wall), outerZ),
        new THREE.Vector3(wallLocalX(wall, x1, innerZ), localY(yCap, wall), innerZ),
        new THREE.Vector3(wallLocalX(wall, x0, innerZ), localY(yCap, wall), innerZ),
      )
      quads += 1
    }
  }
  if (quads === 0) return null
  computeVertexNormals(positions, indices, normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

function appendOpeningMaskCap(
  wall: Wall,
  poly: OpeningPoly[],
  z: number,
  positions: number[],
  normals: number[],
  indices: number[],
): void {
  if (poly.length < 3) return
  const shape = new THREE.Shape()
  const first = poly[0]!
  shape.moveTo(wallLocalX(wall, first.x, z), localY(first.y, wall))
  for (let i = 1; i < poly.length; i += 1) {
    const p = poly[i]!
    shape.lineTo(wallLocalX(wall, p.x, z), localY(p.y, wall))
  }
  shape.closePath()
  const cap = new THREE.ShapeGeometry(shape, ARCH_MESH_SEGMENTS)
  const pos = cap.getAttribute('position')
  const idx = cap.getIndex()
  const base = positions.length / 3
  for (let i = 0; i < pos.count; i += 1) {
    positions.push(pos.getX(i), pos.getY(i), z)
    normals.push(0, 0, 0)
  }
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      indices.push(base + idx.getX(i)!, base + idx.getX(i + 1)!, base + idx.getX(i + 2)!)
    }
  }
  cap.dispose()
}

/** Leibungsflächen einer Öffnung — Tunnel entlang der Maske, ohne Extra-Lippe/Soffit. */
export function createStudioOpeningRevealGeometry(
  wall: Wall,
  opening: Opening,
): THREE.BufferGeometry | null {
  if (!openingCutsWall(opening)) return null
  if (openingIsConch(opening)) return createStudioConchRevealGeometry(wall, opening)

  const positions: number[] = []
  const normals: number[] = []
  const zOuter = studioOpeningRevealOuterZ(wall, opening)
  let zInner = studioOpeningRevealInnerZ(wall)
  const fill = normalizeOpeningFill(opening.fill)
  if (fill.mode === 'niche') {
    const depth = fill.nicheDepthCm ?? 10
    const outward = studioWindowDepthForwardSign(wall)
    // Nischenboden / Rückwand: nur `depth` cm hinter der Außenkante
    zInner = zOuter - outward * depth
  }
  if (Math.abs(zOuter - zInner) < 0.35) return null

  const poly = openingMaskPolyline(opening, 0, ARCH_MESH_SEGMENTS)
  if (poly.length < 3) return null
  const n = poly.length
  const skipSill = opening.y <= 0.5
  const outerIndices: number[] = []
  const innerIndices: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    if (skipSill && a.y <= 0.5 && b.y <= 0.5) continue
    const zMid = (zOuter + zInner) / 2
    addQuad(
      positions,
      normals,
      outerIndices,
      new THREE.Vector3(wallLocalX(wall, a.x, zOuter), localY(a.y, wall), zOuter),
      new THREE.Vector3(wallLocalX(wall, b.x, zOuter), localY(b.y, wall), zOuter),
      new THREE.Vector3(wallLocalX(wall, b.x, zMid), localY(b.y, wall), zMid),
      new THREE.Vector3(wallLocalX(wall, a.x, zMid), localY(a.y, wall), zMid),
    )
    addQuad(
      positions,
      normals,
      innerIndices,
      new THREE.Vector3(wallLocalX(wall, a.x, zMid), localY(a.y, wall), zMid),
      new THREE.Vector3(wallLocalX(wall, b.x, zMid), localY(b.y, wall), zMid),
      new THREE.Vector3(wallLocalX(wall, b.x, zInner), localY(b.y, wall), zInner),
      new THREE.Vector3(wallLocalX(wall, a.x, zInner), localY(a.y, wall), zInner),
    )
  }

  if (fill.mode === 'niche') {
    const shape = new THREE.Shape()
    const first = poly[0]
    shape.moveTo(wallLocalX(wall, first.x, zInner), localY(first.y, wall))
    for (let i = 1; i < n; i += 1) {
      shape.lineTo(wallLocalX(wall, poly[i].x, zInner), localY(poly[i].y, wall))
    }
    shape.closePath()
    const cap = new THREE.ShapeGeometry(shape, ARCH_MESH_SEGMENTS)
    const pos = cap.getAttribute('position')
    const idx = cap.getIndex()
    const base = positions.length / 3
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), zInner)
      normals.push(0, 0, 0)
    }
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        innerIndices.push(base + idx.getX(i), base + idx.getX(i + 1), base + idx.getX(i + 2))
      }
    }
    cap.dispose()
  }

  computeVertexNormals(positions, [...outerIndices, ...innerIndices], normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  if (outerIndices.length > 0) {
    geometry.addGroup(0, outerIndices.length, 0)
  }
  if (innerIndices.length > 0) {
    geometry.addGroup(outerIndices.length, innerIndices.length, 1)
  }
  geometry.setIndex([...outerIndices, ...innerIndices])
  return geometry
}

/**
 * Konche: Halbzylinder unten + Viertelkugel (Kalotte) oben.
 * Maske = Rechteck mit Halbkreis-Krone (wie Rundbogen, Stich = Breite/2).
 */
function createStudioConchRevealGeometry(
  wall: Wall,
  opening: Opening,
): THREE.BufferGeometry | null {
  const fill = normalizeOpeningFill(opening.fill)
  const depth = Math.max(1, fill.nicheDepthCm ?? 10)
  const zOuter = studioOpeningRevealOuterZ(wall, opening)
  const outward = studioWindowDepthForwardSign(wall)
  const R = Math.min(opening.width / 2, opening.height)
  if (R < 1) return null
  const depthScale = depth / R
  const cx = opening.x + opening.width / 2
  const springY = opening.y + opening.height - R
  const segs = Math.max(16, ARCH_MESH_SEGMENTS)
  const positions: number[] = []
  const normals: number[] = []
  const outerIndices: number[] = []
  const innerIndices: number[] = []

  const pointAt = (wallX: number, wallY: number, into: number) =>
    new THREE.Vector3(
      wallLocalX(wall, wallX, zOuter - outward * into),
      localY(wallY, wall),
      zOuter - outward * into,
    )

  // Unterer Halbzylinder (Höhe > Radius)
  if (springY > opening.y + 0.5) {
    const y0 = opening.y
    const y1 = springY
    for (let i = 0; i < segs; i += 1) {
      const t0 = Math.PI * (i / segs)
      const t1 = Math.PI * ((i + 1) / segs)
      const x0 = cx + Math.cos(t0) * R
      const x1 = cx + Math.cos(t1) * R
      const into0 = Math.sin(t0) * R * depthScale
      const into1 = Math.sin(t1) * R * depthScale
      // Zylinderschale (Innenseite)
      addQuad(
        positions,
        normals,
        innerIndices,
        pointAt(x0, y0, into0),
        pointAt(x1, y0, into1),
        pointAt(x1, y1, into1),
        pointAt(x0, y1, into0),
      )
      // Sohlbank
      addQuad(
        positions,
        normals,
        innerIndices,
        pointAt(x0, y0, 0),
        pointAt(x0, y0, into0),
        pointAt(x1, y0, into1),
        pointAt(x1, y0, 0),
      )
    }
  }

  // Kalotte: Viertelkugel (u = Azimut 0…π, v = Elevation 0…π/2)
  const elevSegs = Math.max(10, Math.ceil(segs / 2))
  for (let i = 0; i < segs; i += 1) {
    const u0 = Math.PI * (i / segs)
    const u1 = Math.PI * ((i + 1) / segs)
    for (let j = 0; j < elevSegs; j += 1) {
      const v0 = (Math.PI / 2) * (j / elevSegs)
      const v1 = (Math.PI / 2) * ((j + 1) / elevSegs)
      const sample = (u: number, v: number) => {
        const wx = cx + Math.cos(u) * R * Math.cos(v)
        const wy = springY + Math.sin(v) * R
        const into = Math.sin(u) * R * Math.cos(v) * depthScale
        return pointAt(wx, wy, into)
      }
      const a = sample(u0, v0)
      const b = sample(u1, v0)
      const c = sample(u1, v1)
      const d = sample(u0, v1)
      addQuad(positions, normals, innerIndices, a, d, c, b)
    }
  }

  // Fassaden-Lippe entlang der Öffnungsmaske (äußere Materialgruppe)
  const poly = openingMaskPolyline(opening, 0, ARCH_MESH_SEGMENTS)
  if (poly.length >= 3) {
    const lip = Math.min(1.5, depth * 0.12)
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      if (opening.y <= 0.5 && a.y <= 0.5 && b.y <= 0.5) continue
      addQuad(
        positions,
        normals,
        outerIndices,
        pointAt(a.x, a.y, 0),
        pointAt(b.x, b.y, 0),
        pointAt(b.x, b.y, lip),
        pointAt(a.x, a.y, lip),
      )
    }
  }

  if (positions.length < 9) return null
  computeVertexNormals(positions, [...outerIndices, ...innerIndices], normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  if (outerIndices.length > 0) geometry.addGroup(0, outerIndices.length, 0)
  if (innerIndices.length > 0) geometry.addGroup(outerIndices.length, innerIndices.length, 1)
  geometry.setIndex([...outerIndices, ...innerIndices])
  return geometry
}

/**
 * Arbeitsdarstellung: Steine und Fugen als Rechtecke, 2 cm vor der Wand.
 * Keine Bogen-Clips, keine ShapeGeometry — nur Achsen-Quads.
 */
const WORK_FLAT_AHEAD_CM = 2

export function studioWorkModeTileLocalZ(wall: Wall): number {
  return studioWallOuterLocalZ(wall) + studioWindowDepthForwardSign(wall) * WORK_FLAT_AHEAD_CM
}

function addWorkFaceQuad(
  wall: Wall,
  miter: { start: boolean; end: boolean },
  faceZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  if (x1 - x0 < CLIP_EPS || y1 - y0 < CLIP_EPS) return
  const halfH = wall.height / 2
  const xAt = (wx: number) => wallLocalX(wall, wx, faceZ, 0, faceZ, miter.start, miter.end)
  addQuad(
    positions,
    normals,
    indices,
    v3(xAt(x0), y0 - halfH, faceZ),
    v3(xAt(x1), y0 - halfH, faceZ),
    v3(xAt(x1), y1 - halfH, faceZ),
    v3(xAt(x0), y1 - halfH, faceZ),
  )
}

function addWorkFaceOutlinePoly(
  wall: Wall,
  miter: { start: boolean; end: boolean },
  faceZ: number,
  positions: number[],
  normals: number[],
  indices: number[],
  outline: Array<{ x: number; y: number }>,
) {
  if (outline.length < 3) return
  const halfH = wall.height / 2
  const xAt = (wx: number) => wallLocalX(wall, wx, faceZ, 0, faceZ, miter.start, miter.end)
  const contour = outline.map((p) => new THREE.Vector2(p.x, p.y))
  const tris = THREE.ShapeUtils.triangulateShape(contour, [])
  for (const [i0, i1, i2] of tris) {
    const a = outline[i0]!
    const b = outline[i1]!
    const c = outline[i2]!
    const va = v3(xAt(a.x), a.y - halfH, faceZ)
    const vb = v3(xAt(b.x), b.y - halfH, faceZ)
    const vc = v3(xAt(c.x), c.y - halfH, faceZ)
    const base = positions.length / 3
    positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z)
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1)
    indices.push(base, base + 1, base + 2)
  }
}

function finishWorkFlatGeometry(
  positions: number[],
  normals: number[],
  indices: number[],
): THREE.BufferGeometry {
  if (positions.length < 9) return new THREE.BufferGeometry()
  computeVertexNormals(positions, indices, normals)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/** Flat-LOD: Öffnungs-Clip wie High-LOD, über alle Steine der Wand. */
function clipFlatPanelTiles(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  layoutTiles?: PanelTile[],
): OpeningPoly[] {
  const joint = Math.max(0, panel.joint ?? 0.8)
  const holes = snapOpeningHolesToTileGrid(wall, panel, layoutTiles ?? tiles)
  let rects: OpeningPoly[] = clipPolysMinusArches(
    tiles.flatMap((tile) => clipTileAgainstHoles(tile, holes)),
    wall.openings,
    PANEL_OPENING_CLEARANCE,
    panel.panelHeight,
    { panelWidth: panel.panelWidth, joint },
  )
  rects = mergeNarrowClipParts(rects, minClipRemnantWidth(panel.panelWidth))
  return flushClipPartsToOpeningJambs(rects, wall.openings, PANEL_OPENING_CLEARANCE)
}

function buildStudioPanelFlatTileGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  allWalls: Wall[],
  layoutTiles?: PanelTile[],
  precomputedRects?: OpeningPoly[],
): THREE.BufferGeometry {
  if (tiles.length === 0 && !precomputedRects) return new THREE.BufferGeometry()
  const faceZ = studioWorkModeTileLocalZ(wall)
  const miter = panelMiterEnds(wall, allWalls)
  const joint = Math.max(0, panel.joint ?? 0.8)
  const halfJ = joint * 0.5
  const rects = precomputedRects ?? clipFlatPanelTiles(wall, panel, tiles, layoutTiles)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  for (const part of rects) {
    if (part.outline && part.outline.length >= 3) {
      addWorkFaceOutlinePoly(wall, miter, faceZ, positions, normals, indices, part.outline)
      continue
    }
    if (part.bottomArc || part.topArc) continue
    const x0 = part.x + halfJ
    const y0 = part.y + halfJ
    const x1 = part.x + part.width - halfJ
    const y1 = part.y + part.height - halfJ
    addWorkFaceQuad(wall, miter, faceZ, positions, normals, indices, x0, y0, x1, y1)
  }
  return finishWorkFlatGeometry(positions, normals, indices)
}

function buildStudioPanelFlatJointGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[],
  tiles: PanelTile[],
): THREE.BufferGeometry | null {
  const joint = Math.max(0, panel.joint ?? 0)
  if (joint <= 1e-6) return null
  const band = visiblePanelRowRect(wall, panel)
  if (!band) return null
  const halfJ = joint * 0.5
  const holes = snapOpeningHolesToTileGrid(wall, panel, tiles)
  let parts: OpeningPoly[] = clipPolysMinusArches(
    clipTileAgainstHoles(band, holes),
    wall.openings,
    PANEL_OPENING_CLEARANCE,
    panel.panelHeight,
    { panelWidth: panel.panelWidth, joint },
  )
  parts = mergeNarrowClipParts(parts, minClipRemnantWidth(panel.panelWidth))
  parts = flushClipPartsToOpeningJambs(parts, wall.openings, PANEL_OPENING_CLEARANCE)
  for (const tile of tiles) {
    const inset = {
      x: tile.x + halfJ,
      y: tile.y + halfJ,
      width: tile.width - joint,
      height: tile.height - joint,
    }
    if (inset.width < CLIP_EPS || inset.height < CLIP_EPS) continue
    parts = parts.flatMap((part) => clipRectMinusBox(part, inset))
  }
  const faceZ = studioWorkModeTileLocalZ(wall)
  const miter = panelMiterEnds(wall, allWalls)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const part of parts) {
    if (part.outline && part.outline.length >= 3) {
      addWorkFaceOutlinePoly(wall, miter, faceZ, positions, normals, indices, part.outline)
      continue
    }
    if (part.bottomArc || part.topArc) continue
    addWorkFaceQuad(
      wall,
      miter,
      faceZ,
      positions,
      normals,
      indices,
      part.x,
      part.y,
      part.x + part.width,
      part.y + part.height,
    )
  }
  const geo = finishWorkFlatGeometry(positions, normals, indices)
  return geo.getAttribute('position')?.count ? geo : null
}

export function createStudioPanelFlatGeometriesByColorIndex(
  wall: Wall,
  panel: StudioPanelConfig,
  stageCount: number,
  seedKey: string,
  allWalls: Wall[] = [],
  precomputedTiles?: PanelTile[],
): Array<{ stageIndex: number; geometry: THREE.BufferGeometry }> {
  if (panel.pattern === 'none' || panel.enabled === false) {
    return [{ stageIndex: 0, geometry: new THREE.BufferGeometry() }]
  }
  const tiles = precomputedTiles ?? layoutPanelTiles(wall, panel, allWalls)
  if (stageCount <= 1) {
    return [
      {
        stageIndex: 0,
        geometry: buildStudioPanelFlatTileGeometry(wall, panel, tiles, allWalls, tiles),
      },
    ]
  }
  // Clip einmal über die ganze Wand, Reste nach Ursprungsstein einfärben (wie High-LOD).
  const rects = clipFlatPanelTiles(wall, panel, tiles, tiles)
  const buckets = bucketPartsByColorIndex(rects, seedKey, stageCount)
  const out: Array<{ stageIndex: number; geometry: THREE.BufferGeometry }> = []
  for (let i = 0; i < stageCount; i += 1) {
    if (buckets[i].length === 0) continue
    out.push({
      stageIndex: i,
      geometry: buildStudioPanelFlatTileGeometry(wall, panel, tiles, allWalls, tiles, buckets[i]),
    })
  }
  return out.length > 0 ? out : [{ stageIndex: 0, geometry: new THREE.BufferGeometry() }]
}

export function createStudioMortarFlatGeometry(
  wall: Wall,
  panel: StudioPanelConfig,
  allWalls: Wall[] = [],
  precomputedTiles?: PanelTile[],
): THREE.BufferGeometry | null {
  const tiles = precomputedTiles ?? layoutPanelTiles(wall, panel, allWalls)
  return buildStudioPanelFlatJointGeometry(wall, panel, allWalls, tiles)
}
