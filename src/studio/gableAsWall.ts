/**
 * Giebel als Wand (v2.0.589): Host-Wand für Pick/Kontextmenü, Paneel-Clip
 * in die Dreiecksfläche, Füllwand weglassen wenn Mauerwerk die Fläche deckt.
 */
import type { Building, Wall } from '../types/facade'
import { floorIndex } from '../utils/layers'
import type { PanelTile } from './panelLayout'
import { listRoofEdges, normalizeRoof, roofEnvelopeForBuilding } from './roof'
import { envelopeY } from './roofForms'
import {
  isStudioWall,
  studioWallOuterSpine,
  wallEndPoint,
  wallHasPanels,
  wallStartPoint,
} from './walls'

/** Max. Abstand Punkt→Dachkante in XZ (cm), damit Giebel-Pick die Host-Wand trifft. */
const GABLE_PICK_XZ_CM = 40
/** Mindest-Zusatzhöhe über Geschossrechteck, sonst kein Giebel-Clip. */
const GABLE_EXTRA_MIN_CM = 2
/** Proben für envelopeY leicht vor der Außenkante (cm). */
const GABLE_SAMPLE_OUTSET_CM = 0.5
/** Paneel-Oberkante knapp unter der Dachhaut (cm). */
const GABLE_UNDER_SKIN_CM = 0.5
const MIN_TILE = 0.05
const CLIP_EPS = 0.05

function pointToSegmentDistXZ(
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

/**
 * Vertikale Giebelfüllung → Host-Wand-ID.
 * Waagerechte Untersicht/Deckel (Normalen-Y groß) bleiben Dach.
 */
export function resolveGableHostWallId(
  building: Building,
  point: { x: number; y: number; z: number },
  faceNormal?: { x: number; y: number; z: number },
): string | null {
  if (faceNormal && Math.abs(faceNormal.y) > 0.65) return null
  const roof = normalizeRoof(building.roof)
  if (!roof.enabled) return null
  const edges = listRoofEdges(building, roof)
  if (edges.length === 0) return null
  const env = roofEnvelopeForBuilding(building, roof)

  type Cand = { wallId: string; dist: number; prefer: boolean }
  let best: Cand | null = null
  for (const edge of edges) {
    if (!edge.wallId) continue
    const dist = pointToSegmentDistXZ({ x: point.x, z: point.z }, edge.a, edge.b)
    if (dist > GABLE_PICK_XZ_CM) continue
    const prefer = edge.flush || (env ? !env.isEave[edge.index] : false)
    if (
      !best ||
      (prefer && !best.prefer) ||
      (prefer === best.prefer && dist < best.dist - 1e-6)
    ) {
      best = { wallId: edge.wallId, dist, prefer }
    }
  }
  return best?.wallId ?? null
}

/**
 * Paneel-Layouthöhe und Y-Clip entlang der Giebelschräge für eine Obergeschoss-Wand.
 * `null` wenn kein Dachanstieg (≥ 2 cm) über der Geschosshöhe.
 */
export function gablePanelClipForWall(
  building: Building,
  wall: Wall,
): { extendedHeight: number; maxLocalYAt: (localX: number) => number } | null {
  const roof = normalizeRoof(building.roof)
  if (!roof.enabled || roof.kind === 'mansard') return null
  if (!isStudioWall(wall)) return null
  const topFloor = (building.floors?.length ?? 1) - 1
  if (floorIndex(wall, building.wallHeight) !== topFloor) return null

  const env = roofEnvelopeForBuilding(building, roof)
  if (!env || env.planes.length === 0) return null

  const start = wallStartPoint(wall)
  const end = wallEndPoint(wall)
  const width = Math.max(1e-6, wall.width)
  const { outward } = studioWallOuterSpine(wall)

  const maxLocalYAt = (localX: number): number => {
    const t = Math.max(0, Math.min(1, localX / width))
    const p = {
      x: start.x + (end.x - start.x) * t + outward.x * GABLE_SAMPLE_OUTSET_CM,
      z: start.z + (end.z - start.z) * t + outward.z * GABLE_SAMPLE_OUTSET_CM,
    }
    const roofY = envelopeY(env.planes, p)
    if (!Number.isFinite(roofY)) return wall.height
    return Math.max(0, roofY - wall.y - GABLE_UNDER_SKIN_CM)
  }

  let extendedHeight = wall.height
  const samples = 48
  for (let i = 0; i <= samples; i += 1) {
    extendedHeight = Math.max(extendedHeight, maxLocalYAt((i / samples) * width))
  }
  if (extendedHeight < wall.height + GABLE_EXTRA_MIN_CM) return null
  return { extendedHeight, maxLocalYAt }
}

/**
 * Steine oberhalb der Giebelschräge kürzen oder verwerfen.
 * `wallBaseHeight` = Geschossrechteck vor Extension (nur Kontext / leichte Untergrenze).
 */
export function clipTilesToGableProfile(
  tiles: PanelTile[],
  maxLocalYAt: (localX: number) => number,
  wallBaseHeight: number,
): PanelTile[] {
  const out: PanelTile[] = []
  for (const tile of tiles) {
    const midX = tile.x + tile.width * 0.5
    let cutY = maxLocalYAt(midX)
    // Proben an den Giebelecken können leicht unter der Geschosshöhe liegen.
    if (tile.y < wallBaseHeight - CLIP_EPS) {
      cutY = Math.max(cutY, wallBaseHeight)
    }
    const top = tile.y + tile.height
    if (tile.y >= cutY - CLIP_EPS) continue
    if (top <= cutY + CLIP_EPS) {
      out.push(tile)
      continue
    }
    const height = cutY - tile.y
    if (height <= MIN_TILE) continue
    out.push({ ...tile, height })
  }
  return out
}

/** Ob die Host-Wand Paneele/Mauerwerk hat (dann keine Dach-Giebelfüllung). */
export function wallHasGablePanels(building: Building, wallId: string): boolean {
  const wall = building.walls.find((item) => item.id === wallId)
  return Boolean(wall && wallHasPanels(wall))
}
