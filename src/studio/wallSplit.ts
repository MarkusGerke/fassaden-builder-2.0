/**
 * Wandsegment aus bestehender Wand herauslösen („Wände“-Bibliothek ohne Auswahl):
 * Hover zeigt ein Segment gewählter Breite auf der Wand (Raster entlang der Wand),
 * Klick teilt die Wand — auf allen Etagen mit gleichem Fußabdruck — in
 * `links | Segment | rechts`. Öffnungen bleiben an Ort und Stelle.
 *
 * Doku: docs/ux.md („Wandsegment herauslösen“).
 */
import type { FacadeState, Wall } from '../types/facade'
import { findBuildingForWall, updateBuilding } from '../utils/buildings'
import { STUDIO_WALL_WIDTH_STEP, wallWidthStepCm } from './constants'
import {
  collinearChainFromEnd,
  findCollinearDockWall,
  findVerticalAlignedWalls,
  isStudioWall,
  mergeCollinearDockedWalls,
  splitStudioWallAt,
  stretchSingleStudioWall,
  wallAlongDelta,
  wallEndPoint,
  wallStartPoint,
} from './walls'

export interface WallSplitRange {
  /** Segmentanfang vom Wandstart (cm). */
  startCm: number
  /** Segmentende vom Wandstart (cm). */
  endCm: number
}

const EPS = 0.5

/**
 * Segment der Breite `segmentCm` um die Hover-Position `localX` (cm vom Wandstart),
 * auf das Richtungs-Raster gerastet und in die Wand geklemmt.
 * `null`, wenn das Segment nicht in die Wand passt.
 */
export function wallSplitRangeAt(wall: Wall, localX: number, segmentCm: number): WallSplitRange | null {
  if (!isStudioWall(wall) || !(segmentCm > 0) || !Number.isFinite(localX)) return null
  const step = wallWidthStepCm(wall.yawDeg ?? 0)
  if (segmentCm > wall.width + EPS) return null
  const maxStart = wall.width - segmentCm
  let start = Math.round((localX - segmentCm / 2) / step) * step
  if (start > maxStart) start = Math.floor(maxStart / step) * step
  if (start < 0) start = 0
  if (start > maxStart + EPS) start = maxStart
  return { startCm: start, endCm: start + segmentCm }
}

/**
 * Teilt eine Wand in bis zu drei kollineare Stücke; das mittlere ist `[startCm, endCm]`.
 * Gibt `null` zurück, wenn nichts zu teilen ist (Segment = ganze Wand) oder ein Reststück
 * kürzer als ein Rasterschritt würde bzw. die Wand geschützt ist (Erker/Endstück).
 */
export function splitStudioWallRange(
  wall: Wall,
  range: WallSplitRange,
): { parts: Wall[]; middleId: string } | null {
  if (!isStudioWall(wall)) return null
  const startCm = Math.max(0, Math.min(range.startCm, wall.width))
  const endCm = Math.max(0, Math.min(range.endCm, wall.width))
  if (endCm - startCm < STUDIO_WALL_WIDTH_STEP - EPS) return null
  const atStart = startCm <= EPS
  const atEnd = wall.width - endCm <= EPS
  if (atStart && atEnd) return null
  if (atStart) {
    const parts = splitStudioWallAt(wall, endCm)
    return parts ? { parts: [parts[0], parts[1]], middleId: parts[0].id } : null
  }
  if (atEnd) {
    const parts = splitStudioWallAt(wall, startCm)
    return parts ? { parts: [parts[0], parts[1]], middleId: parts[1].id } : null
  }
  const first = splitStudioWallAt(wall, startCm)
  if (!first) return null
  const second = splitStudioWallAt(first[1], endCm - startCm)
  if (!second) return null
  return { parts: [first[0], second[0], second[1]], middleId: second[0].id }
}

function yawDeltaAbs(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360
  return Math.min(d, 360 - d)
}

/**
 * Wand plus alle Etagen mit gleichem Fußabdruck (gleicher Ursprung, gleiche Richtung).
 * Die Seed-Wand steht vorne.
 */
export function wallSplitStack(wall: Wall, walls: Wall[], wallHeight: number): Wall[] {
  const yaw = wall.yawDeg ?? 0
  const others = findVerticalAlignedWalls(wall, walls, wallHeight).filter(
    (other) => yawDeltaAbs(yaw, other.yawDeg ?? 0) <= 2,
  )
  return [wall, ...others]
}

export interface WallStackSplitResult {
  state: FacadeState
  /** Mittelstück der Seed-Wand (zum Auswählen). */
  middleId: string
  /** Mittelstücke aller geteilten Etagen (Seed zuerst). */
  middleIds: string[]
}

/**
 * Teilt `wallId` und alle Etagen mit gleichem Fußabdruck am selben Segment.
 * Etagen, in die das Segment nicht passt (schmalere Wand), bleiben unverändert.
 * `null`, wenn die Seed-Wand selbst nicht geteilt werden kann.
 */
export function splitWallStackRange(
  state: FacadeState,
  wallId: string,
  range: WallSplitRange,
): WallStackSplitResult | null {
  const building = findBuildingForWall(state, wallId)
  const seed = building?.walls.find((item) => item.id === wallId)
  if (!building || !seed || !isStudioWall(seed)) return null
  const seedSplit = splitStudioWallRange(seed, range)
  if (!seedSplit) return null

  const replacements = new Map<string, Wall[]>([[seed.id, seedSplit.parts]])
  const middleIds = [seedSplit.middleId]
  for (const other of wallSplitStack(seed, building.walls, building.wallHeight).slice(1)) {
    const split = splitStudioWallRange(other, range)
    if (!split) continue
    replacements.set(other.id, split.parts)
    middleIds.push(split.middleId)
  }

  const next = updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.flatMap((item) => replacements.get(item.id) ?? [item]),
  }))
  return { state: next, middleId: seedSplit.middleId, middleIds }
}

/**
 * Kandidaten fürs Verschmelzen („Wand verknüpfen“ auf Segmenten):
 * Seeds + Etagen-Stapel; bei **einem** Seed zusätzlich die ganze kollineare Kette
 * an beiden Enden, bei mehreren Seeds nur die Auswahl selbst (+ Stapel).
 */
export function mergeWallSegmentCandidates(state: FacadeState, seedIds: string[]): Set<string> {
  const ids = new Set<string>()
  const first = seedIds[0]
  const building = first ? findBuildingForWall(state, first) : undefined
  if (!building) return ids
  const seeds = seedIds
    .map((id) => building.walls.find((w) => w.id === id))
    .filter((w): w is Wall => Boolean(w && isStudioWall(w)))
  const scope: Wall[] = []
  for (const seed of seeds) {
    for (const w of wallSplitStack(seed, building.walls, building.wallHeight)) {
      if (!scope.some((s) => s.id === w.id)) scope.push(w)
    }
  }
  for (const w of scope) ids.add(w.id)
  if (seeds.length === 1) {
    for (const w of scope) {
      for (const end of ['start', 'end'] as const) {
        for (const id of collinearChainFromEnd(w, end, building.walls)) ids.add(id)
      }
    }
  }
  return ids
}

/** `true`, wenn in der Kandidatenmenge mindestens ein kollinear angedocktes Paar existiert. */
export function canMergeWallSegments(state: FacadeState, seedIds: string[]): boolean {
  const ids = mergeWallSegmentCandidates(state, seedIds)
  const first = seedIds[0]
  const building = first ? findBuildingForWall(state, first) : undefined
  if (!building) return false
  for (const id of ids) {
    const wall = building.walls.find((w) => w.id === id)
    if (!wall || !isStudioWall(wall)) continue
    for (const end of ['start', 'end'] as const) {
      const adj = findCollinearDockWall(wall, end, building.walls)
      if (adj && ids.has(adj.id)) return true
    }
  }
  return false
}

/**
 * Verschmilzt kollinear angedockte Segmente zu einer Wand ohne Schnitte (alle Etagen im Stapel).
 * Rückgabe: neuer Zustand + IDs der verschmolzenen Wände, die aus der Auswahl hervorgehen.
 */
export function mergeWallSegments(
  state: FacadeState,
  seedIds: string[],
): { state: FacadeState; selectedIds: string[] } | null {
  const first = seedIds[0]
  const building = first ? findBuildingForWall(state, first) : undefined
  if (!building) return null
  const ids = mergeWallSegmentCandidates(state, seedIds)
  const selected = new Set(seedIds)
  // Seeds zuerst, damit sie als „keep“ überleben und ihre ID behalten.
  const order = [...seedIds.filter((id) => ids.has(id)), ...[...ids].filter((id) => !seedIds.includes(id))]
  let next = state
  let merged = false
  let progress = true
  while (progress) {
    progress = false
    const walls = (next.buildings.find((b) => b.id === building.id) ?? building).walls
    for (const keepId of order) {
      if (!ids.has(keepId)) continue
      const keep = walls.find((w) => w.id === keepId)
      if (!keep || !isStudioWall(keep)) continue
      for (const end of ['start', 'end'] as const) {
        const adj = findCollinearDockWall(keep, end, walls)
        if (!adj || !ids.has(adj.id) || adj.id === keepId) continue
        const result = mergeCollinearDockedWalls(next, keepId, adj.id)
        if (!result) continue
        next = result
        ids.delete(adj.id)
        if (selected.has(adj.id)) {
          selected.delete(adj.id)
          selected.add(keepId)
        }
        merged = true
        progress = true
        break
      }
      if (progress) break
    }
  }
  if (!merged) return null
  return { state: next, selectedIds: [...selected].filter((id) => ids.has(id)) }
}

/**
 * Greifer + Shift entlang der Wandachse: die Wand (+ Etagen-Stapel) wird an `wallEnd` um
 * `deltaCm` gestreckt und **alles jenseits dieses Wandendes** rückt um `deltaCm` mit —
 * Wände komplett hinter der Ebene werden verschoben, parallele Wände, die die Ebene
 * kreuzen, werden am jenseitigen Ende gestreckt/gekürzt. Schräge Kreuzer bleiben unverändert.
 */
export function shiftWallsBeyondEnd(
  state: FacadeState,
  wallId: string,
  wallEnd: 'start' | 'end',
  deltaCm: number,
): FacadeState {
  if (Math.abs(deltaCm) < 0.5) return state
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  const target = building.walls.find((w) => w.id === wallId)
  if (!target || !isStudioWall(target)) return state
  const stretchIds = new Set(wallSplitStack(target, building.walls, building.wallHeight).map((w) => w.id))
  const along = wallAlongDelta(target.yawDeg ?? 0, 1)
  const alongLen = Math.hypot(along.x, along.z) || 1
  const sign = wallEnd === 'end' ? 1 : -1
  const dirX = (along.x / alongLen) * sign
  const dirZ = (along.z / alongLen) * sign
  const plane = wallEnd === 'end' ? wallEndPoint(target) : wallStartPoint(target)
  const beyond = (q: { x: number; z: number }) => (q.x - plane.x) * dirX + (q.z - plane.z) * dirZ > -1
  const shiftX = dirX * deltaCm
  const shiftZ = dirZ * deltaCm

  const walls = building.walls.map((wall) => {
    if (!isStudioWall(wall)) return wall
    if (stretchIds.has(wall.id)) return stretchSingleStudioWall(wall, wallEnd, deltaCm)
    const startBeyond = beyond(wallStartPoint(wall))
    const endBeyond = beyond(wallEndPoint(wall))
    if (!startBeyond && !endBeyond) return wall
    if (startBeyond && endBeyond) {
      return {
        ...wall,
        originX: (wall.originX ?? wall.x) + shiftX,
        originZ: (wall.originZ ?? 0) + shiftZ,
        x: wall.x + shiftX,
      }
    }
    // Kreuzt die Ebene: nur parallele Wände am jenseitigen Ende anpassen.
    const u = wallAlongDelta(wall.yawDeg ?? 0, 1)
    const ulen = Math.hypot(u.x, u.z) || 1
    const ux = u.x / ulen
    const uz = u.z / ulen
    if (Math.abs(ux * dirZ - uz * dirX) > 0.01) return wall
    const wallDir = ux * dirX + uz * dirZ > 0 ? 1 : -1
    const step = wallWidthStepCm(wall.yawDeg ?? 0)
    if (endBeyond) {
      const width = wall.width + deltaCm * wallDir
      if (width < step - 0.01) return wall
      return { ...wall, width }
    }
    const width = wall.width - deltaCm * wallDir
    if (width < step - 0.01) return wall
    return {
      ...wall,
      originX: (wall.originX ?? wall.x) + shiftX,
      originZ: (wall.originZ ?? 0) + shiftZ,
      x: wall.x + shiftX,
      width,
      openings: wall.openings.map((opening) => ({ ...opening, x: opening.x - deltaCm * wallDir })),
    }
  })
  return updateBuilding(state, building.id, (b) => ({ ...b, walls }))
}
