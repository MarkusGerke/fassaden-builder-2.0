/**
 * Shift+Klick-Bereichsauswahl für Wände:
 * - gleiche Etage: kürzerer Pfad entlang der Grundriss-Nachbarschaft
 * - gleiche Fassadenseite (Yaw) über Etagen: nur diese Seite inkl. Zwischenetagen
 * - sonst über Etagen: pro Etage kürzerer Pfad zwischen den passenden Vertretern
 * Erker nur, wenn eine Erker-Wand auf dem Pfad/Streifen liegt — keine Auto-Expansion der Gruppe.
 */
import type { Wall } from '../types/facade'
import { floorIndex } from '../utils/layers'
import { normalizeYawDeg } from './compass'
import { findAdjacentWalls, isStudioWall, wallEndPoint, wallStartPoint } from './walls'

function yawDeltaAbsDeg(a: number, b: number): number {
  const d = Math.abs(normalizeYawDeg(a) - normalizeYawDeg(b))
  return Math.min(d, 360 - d)
}

function sameFacadeYaw(a: number, b: number): boolean {
  return yawDeltaAbsDeg(a, b) <= 2
}

function wallMidXZ(wall: Wall): { x: number; z: number } {
  const a = wallStartPoint(wall)
  const b = wallEndPoint(wall)
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return dx * dx + dz * dz
}

function wallsOnFloor(walls: Wall[], floor: number, wallHeight: number): Wall[] {
  return walls.filter((wall) => floorIndex(wall, wallHeight) === floor)
}

/** Ungerichteter Nachbargraph einer Etage (Dock-Geometrie, auch ohne planLinked). */
function floorAdjacency(floorWalls: Wall[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, [])
  }
  for (const wall of floorWalls) {
    ensure(wall.id)
    for (const end of ['start', 'end'] as const) {
      for (const other of findAdjacentWalls(wall, end, floorWalls, { ignorePlanLink: true })) {
        ensure(other.id)
        if (!adj.get(wall.id)!.includes(other.id)) adj.get(wall.id)!.push(other.id)
        if (!adj.get(other.id)!.includes(wall.id)) adj.get(other.id)!.push(wall.id)
      }
    }
  }
  return adj
}

/** Kürzester Pfad (wenigste Wände) zwischen zwei Knoten. */
function shortestWallPath(adj: Map<string, string[]>, fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId]
  if (!adj.has(fromId) || !adj.has(toId)) return null
  const prev = new Map<string, string | null>()
  const queue = [fromId]
  prev.set(fromId, null)
  while (queue.length > 0) {
    const id = queue.shift()!
    if (id === toId) break
    for (const next of adj.get(id) ?? []) {
      if (prev.has(next)) continue
      prev.set(next, id)
      queue.push(next)
    }
  }
  if (!prev.has(toId)) return null
  const path: string[] = []
  let cur: string | null = toId
  while (cur) {
    path.push(cur)
    cur = prev.get(cur) ?? null
  }
  path.reverse()
  return path
}

/** Vertreter auf einer Etage: gleiche Yaw bevorzugt, sonst räumlich nächste Studio-Wand. */
function representativeOnFloor(
  floorWalls: Wall[],
  template: Wall,
): Wall | undefined {
  if (floorWalls.length === 0) return undefined
  const mid = wallMidXZ(template)
  const yaw = template.yawDeg ?? 0
  const sameYaw = floorWalls.filter((wall) => sameFacadeYaw(wall.yawDeg ?? 0, yaw))
  const pool = sameYaw.length > 0 ? sameYaw : floorWalls
  let best = pool[0]!
  let bestD = dist2(wallMidXZ(best).x, wallMidXZ(best).z, mid.x, mid.z)
  for (const wall of pool) {
    const m = wallMidXZ(wall)
    const d = dist2(m.x, m.z, mid.x, mid.z)
    if (d < bestD) {
      best = wall
      bestD = d
    }
  }
  return best
}

function pathOnFloor(floorWalls: Wall[], fromId: string, toId: string): string[] {
  const adj = floorAdjacency(floorWalls)
  return shortestWallPath(adj, fromId, toId) ?? [fromId, toId].filter((id, i, arr) => arr.indexOf(id) === i)
}

/**
 * IDs für Shift-Bereich zwischen zwei Wänden (gleiches Haus vorausgesetzt).
 * `wallHeight` = Building.wallHeight für floorIndex.
 * Erker-Schenkel nur, wenn sie auf dem Pfad/Yaw-Streifen liegen — kein Gruppen-Expand.
 */
export function wallIdsForShiftRange(
  walls: Wall[],
  fromId: string,
  toId: string,
  wallHeight: number,
): string[] {
  const from = walls.find((wall) => wall.id === fromId)
  const to = walls.find((wall) => wall.id === toId)
  if (!from || !to) return [toId]

  const floorFrom = floorIndex(from, wallHeight)
  const floorTo = floorIndex(to, wallHeight)
  const yawFrom = from.yawDeg ?? 0
  const yawTo = to.yawDeg ?? 0

  if (floorFrom === floorTo) {
    const floorWalls = wallsOnFloor(walls, floorFrom, wallHeight)
    return pathOnFloor(floorWalls, fromId, toId)
  }

  const lo = Math.min(floorFrom, floorTo)
  const hi = Math.max(floorFrom, floorTo)
  const selected = new Set<string>([fromId, toId])

  if (sameFacadeYaw(yawFrom, yawTo)) {
    // Gleiche Fassadenseite: nur Wände mit dieser Yaw auf den Etagen dazwischen (+ Enden).
    const facadeYaw = yawFrom
    for (const wall of walls) {
      const fi = floorIndex(wall, wallHeight)
      if (fi < lo || fi > hi) continue
      if (!sameFacadeYaw(wall.yawDeg ?? 0, facadeYaw)) continue
      selected.add(wall.id)
    }
    return [...selected]
  }

  // Unterschiedliche Seiten über Etagen: pro Etage kürzerer Umlauf zwischen Vertretern.
  for (let fi = lo; fi <= hi; fi += 1) {
    const floorWalls = wallsOnFloor(walls, fi, wallHeight)
    if (floorWalls.length === 0) continue
    const fromRep =
      fi === floorFrom ? from : representativeOnFloor(floorWalls, from)
    const toRep = fi === floorTo ? to : representativeOnFloor(floorWalls, to)
    if (!fromRep || !toRep) continue
    for (const id of pathOnFloor(floorWalls, fromRep.id, toRep.id)) selected.add(id)
  }
  return [...selected]
}

/** Studio-Wände eines Gebäudes (für Aufrufer, die nur Building-Wände haben). */
export function studioWallsForRange(walls: Wall[]): Wall[] {
  return walls.filter((wall) => isStudioWall(wall) && !wall.hidden)
}
