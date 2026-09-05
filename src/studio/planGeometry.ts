import type { Building, FacadeState, Wall } from '../types/facade'
import { cloneWall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { getActiveBuilding } from '../utils/buildings'
import { floorIndex } from '../utils/layers'
import { finalizeWallLayout, updateGlobalDepth } from '../utils/walls'
import {
  isValidPlanLine,
  syncFloorPlansFromWalls,
  planNodeWorld,
  edgeLengthCm,
  wallYawDegFromSegment,
  wallYawDegFromWorld,
  assignMiters,
  extractPlanRings,
  type FloorPlan,
  type PlanEdge,
  type PlanNode,
} from './floorPlan'
import { PLAN_GRID } from './constants'
import { normalizeYawDeg } from './compass'
import {
  alignOpeningElementsToWallFront,
  isStudioWall,
  isWallPlanLinked,
  miterAtWallEnd,
  normalizeStudioWall,
  panelFlipForExteriorNormal,
  sealNearWallEndGaps,
  studioWallOuterSpine,
  translateStudioCorner,
  wallAlongDelta,
  wallStartPoint,
  wallEndPoint,
  pointsMeet,
} from './walls'

const MITER_MATCH_EPS = 2
const WALL_TO_PLAN_MATCH_CM = 96

function yawMatches(a: number, b: number): boolean {
  const delta = Math.abs((((a - b) % 360) + 360) % 360)
  return delta < 2 || Math.abs(delta - 180) < 2
}

function intersectInfiniteXZ(
  p: { x: number; z: number },
  d: { x: number; z: number },
  q: { x: number; z: number },
  e: { x: number; z: number },
): { x: number; z: number } | null {
  const denom = d.x * e.z - d.z * e.x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / denom
  return { x: p.x + d.x * t, z: p.z + d.z * t }
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

function wallMidpoint(wall: Wall): { x: number; z: number } {
  const a = wallStartPoint(wall)
  const b = wallEndPoint(wall)
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
}

function remapAlongX(
  oldWall: Wall,
  newOrigin: { x: number; z: number },
  newYaw: number,
  newWidth: number,
  x: number,
  span: number,
): number {
  const start = wallStartPoint(oldWall)
  const alongOld = wallAlongDelta(oldWall.yawDeg ?? 0, 1)
  const world = { x: start.x + alongOld.x * x, z: start.z + alongOld.z * x }
  const alongNew = wallAlongDelta(newYaw, 1)
  const t = (world.x - newOrigin.x) * alongNew.x + (world.z - newOrigin.z) * alongNew.z
  return Math.max(0, Math.min(Math.max(0, newWidth - span), t))
}

function poseOnOuterSegment(
  from: { x: number; z: number },
  to: { x: number; z: number },
  desiredOut: { x: number; z: number },
): { originX: number; originZ: number; yawDeg: number; width: number; panelFlip: true } {
  const width = Math.hypot(to.x - from.x, to.z - from.z)
  let yaw = wallYawDegFromWorld(from, to)
  if (panelFlipForExteriorNormal(yaw, desiredOut)) {
    return { originX: from.x, originZ: from.z, yawDeg: yaw, width, panelFlip: true }
  }
  yaw = normalizeYawDeg(yaw + 180)
  return { originX: to.x, originZ: to.z, yawDeg: yaw, width, panelFlip: true }
}

function applyOuterPose(oldWall: Wall, pose: ReturnType<typeof poseOnOuterSegment>, depth: number): Wall {
  const origin = { x: pose.originX, z: pose.originZ }
  const next: Wall = {
    ...cloneWall(oldWall),
    originX: pose.originX,
    originZ: pose.originZ,
    x: pose.originX,
    yawDeg: pose.yawDeg,
    width: pose.width,
    depth,
    panelFlip: true,
  }
  next.openings = next.openings.map((opening) => ({
    ...opening,
    x: remapAlongX(oldWall, origin, pose.yawDeg, pose.width, opening.x, opening.width),
  }))
  if (next.label && next.label.x != null) {
    next.label = {
      ...next.label,
      x: remapAlongX(oldWall, origin, pose.yawDeg, pose.width, next.label.x, 0),
    }
  }
  return normalizeStudioWall(next)
}

function matchWallToPlanEdge(
  from: PlanNode,
  to: PlanNode,
  walls: Wall[],
  used: Set<string>,
): Wall | undefined {
  const a = planNodeWorld(from)
  const b = planNodeWorld(to)
  const yaw = wallYawDegFromSegment(from, to)
  let best: Wall | undefined
  let bestDist = WALL_TO_PLAN_MATCH_CM
  for (const wall of walls) {
    if (used.has(wall.id) || !isStudioWall(wall) || !isWallPlanLinked(wall)) continue
    if (!yawMatches(wall.yawDeg ?? 0, yaw)) continue
    const dist = distPointToSeg(wallMidpoint(wall), a, b)
    if (dist < bestDist) {
      bestDist = dist
      best = wall
    }
  }
  return best
}

/** Außenkante in derselben Richtung wie die Plan-Kante — sonst wird aus 1056 cm ein 40-cm-Stummel. */
function orientSpineToPlanEdge(
  spine: { start: { x: number; z: number }; end: { x: number; z: number }; outward: { x: number; z: number } },
  from: { x: number; z: number },
  to: { x: number; z: number },
): { start: { x: number; z: number }; end: { x: number; z: number }; outward: { x: number; z: number } } {
  const edge = { x: to.x - from.x, z: to.z - from.z }
  const dir = { x: spine.end.x - spine.start.x, z: spine.end.z - spine.start.z }
  if (edge.x * dir.x + edge.z * dir.z < 0) {
    return { start: spine.end, end: spine.start, outward: spine.outward }
  }
  return spine
}

function fitLoopWalls(
  segs: Array<{
    wall: Wall
    outward: { x: number; z: number }
    from: { x: number; z: number }
    to: { x: number; z: number }
  }>,
  closed: boolean,
  depth: number,
  byId: Map<string, Wall>,
) {
  if (segs.length === 0) return
  const spines = segs.map((seg) =>
    orientSpineToPlanEdge(studioWallOuterSpine(seg.wall), seg.from, seg.to),
  )
  const dirOf = (s: (typeof spines)[0]) => ({ x: s.end.x - s.start.x, z: s.end.z - s.start.z })
  const cornerCount = closed ? segs.length : segs.length + 1
  const corners: Array<{ x: number; z: number }> = []
  for (let i = 0; i < cornerCount; i += 1) {
    if (!closed && i === 0) {
      corners.push(spines[0]!.start)
      continue
    }
    if (!closed && i === segs.length) {
      corners.push(spines[segs.length - 1]!.end)
      continue
    }
    const prevIdx = closed ? (i - 1 + segs.length) % segs.length : i - 1
    const curIdx = closed ? i : i
    const a = spines[prevIdx]!
    const b = spines[curIdx]!
    const hit = intersectInfiniteXZ(a.start, dirOf(a), b.start, dirOf(b))
    if (hit && Number.isFinite(hit.x) && Number.isFinite(hit.z)) {
      corners.push(hit)
    } else {
      corners.push(closed ? b.start : i === 0 ? a.start : b.start)
    }
  }
  for (let i = 0; i < segs.length; i += 1) {
    const from = corners[i]!
    const to = corners[i + 1] ?? corners[0]!
    const newWidth = Math.hypot(to.x - from.x, to.z - from.z)
    const oldWidth = segs[i]!.wall.width
    // Gegenläufiger Walk ohne Orientierung lieferte ~Wandstärke statt der Fassade.
    if (newWidth < 1 || (oldWidth > depth * 2 && newWidth < oldWidth * 0.5)) continue
    const pose = poseOnOuterSegment(from, to, segs[i]!.outward)
    byId.set(segs[i]!.wall.id, applyOuterPose(segs[i]!.wall, pose, depth))
  }
}

/**
 * Verknüpfte Wände auf die Außenkante setzen (Origin = Außenecke, Dicke nach innen).
 * Repariert Ecken, die nach einer Tiefenänderung nicht mehr zusammenlaufen.
 */
export function fitBuildingWallsToOuterSpine(building: Building, depth?: number): Building {
  const nextDepth = depth ?? building.wallDepth ?? WALL_DEPTH
  const byId = new Map(building.walls.map((wall) => [wall.id, cloneWall(wall)]))
  const floors = building.floors ?? []
  const used = new Set<string>()

  for (let fi = 0; fi < Math.max(floors.length, 1); fi += 1) {
    const plan = floors[fi]
    const floorWalls = [...byId.values()].filter(
      (wall) => isStudioWall(wall) && floorIndex(wall, building.wallHeight) === fi,
    )
    const rings = plan?.nodes.length ? extractPlanRings(plan) : []
    for (const ring of rings) {
      const n = ring.nodes.length
      const edgeCount = ring.closed ? n : n - 1
      const segs: Array<{
        wall: Wall
        outward: { x: number; z: number }
        from: { x: number; z: number }
        to: { x: number; z: number }
      }> = []
      for (let i = 0; i < edgeCount; i += 1) {
        const from = ring.nodes[i]!
        const to = ring.nodes[(i + 1) % n]!
        const wall = matchWallToPlanEdge(from, to, floorWalls, used)
        if (!wall) continue
        used.add(wall.id)
        segs.push({
          wall,
          outward: studioWallOuterSpine(wall).outward,
          from: planNodeWorld(from),
          to: planNodeWorld(to),
        })
      }
      fitLoopWalls(segs, ring.closed, nextDepth, byId)
    }
  }

  for (const wall of byId.values()) {
    if (!isStudioWall(wall) || used.has(wall.id)) continue
    const oldDepth = wall.depth
    const delta = oldDepth - nextDepth
    if (!(wall.panelFlip ?? true) && Math.abs(delta) > 1e-6) {
      const out = studioWallOuterSpine(wall).outward
      const originX = (wall.originX ?? wall.x) + out.x * delta
      const originZ = (wall.originZ ?? 0) + out.z * delta
      byId.set(
        wall.id,
        normalizeStudioWall({ ...wall, originX, originZ, x: originX, depth: nextDepth }),
      )
    } else {
      byId.set(wall.id, normalizeStudioWall({ ...wall, depth: nextDepth }))
    }
  }

  return {
    ...building,
    wallDepth: nextDepth,
    walls: building.walls.map((wall) => byId.get(wall.id) ?? wall),
  }
}

export function fitStateWallsToOuterSpine(state: FacadeState, depthByBuilding?: Map<string, number>): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      fitBuildingWallsToOuterSpine(building, depthByBuilding?.get(building.id)),
    ),
  }
}

function applyPlanSegmentMiters(
  walls: Wall[],
  segment: { from: PlanNode; to: PlanNode; miterStart: number; miterEnd: number },
  floorIdx: number,
  wallHeight: number,
): Wall[] {
  const fromWorld = planNodeWorld(segment.from)
  const toWorld = planNodeWorld(segment.to)
  const yaw = wallYawDegFromSegment(segment.from, segment.to)
  const length = edgeLengthCm(segment.from, segment.to)

  const match = (forward: boolean) =>
    walls.find((wall) => {
      if (!isStudioWall(wall) || !isWallPlanLinked(wall)) return false
      if (floorIndex(wall, wallHeight) !== floorIdx) return false
      const start = wallStartPoint(wall)
      const end = wallEndPoint(wall)
      if (forward) {
        return (
          pointsMeet(start, fromWorld) &&
          pointsMeet(end, toWorld) &&
          (wall.yawDeg ?? 0) === yaw &&
          Math.abs(wall.width - length) < MITER_MATCH_EPS
        )
      }
      return (
        pointsMeet(start, toWorld) &&
        pointsMeet(end, fromWorld) &&
        yawMatches(wall.yawDeg ?? 0, (yaw + 180) % 360) &&
        Math.abs(wall.width - length) < MITER_MATCH_EPS
      )
    })

  let wall = match(true)
  let miterStart = segment.miterStart
  let miterEnd = segment.miterEnd
  if (!wall) {
    wall = match(false)
    if (wall) {
      miterStart = segment.miterEnd
      miterEnd = segment.miterStart
    }
  }
  if (!wall) return walls
  return walls.map((item) =>
    item.id === wall!.id ? { ...item, miterStart, miterEnd } : item,
  )
}

/** Gehrungen aus Grundriss (`assignMiters` + `building.wallDepth`) und Nachbar-Geometrie. */
export function syncBuildingWallMiters(building: Building): Wall[] {
  const depth = building.wallDepth ?? WALL_DEPTH
  let walls = building.walls.map(cloneWall)
  const floors = building.floors ?? []
  const hasPlan = floors.some((plan) => plan.nodes.length > 0)

  if (hasPlan) {
    for (let fi = 0; fi < floors.length; fi += 1) {
      const plan = floors[fi]
      if (!plan?.nodes.length) continue
      for (const ring of extractPlanRings(plan)) {
        const segments = assignMiters(ring.nodes, ring.closed, depth)
        for (const segment of segments) {
          walls = applyPlanSegmentMiters(walls, segment, fi, building.wallHeight)
        }
      }
    }
  }

  const source = walls
  return walls.map((wall) => {
    if (!isStudioWall(wall) || !isWallPlanLinked(wall)) {
      return { ...wall, miterStart: 0, miterEnd: 0 }
    }
    return {
      ...wall,
      miterStart: miterAtWallEnd(wall, 'start', source),
      miterEnd: miterAtWallEnd(wall, 'end', source),
    }
  })
}

/** Prüft, ob ein Knoten an (gx,gz) gezogen werden darf (45°/90°-Kanten). */
export function canMovePlanNode(plan: FloorPlan, nodeId: string, gx: number, gz: number): boolean {
  const node = plan.nodes.find((item) => item.id === nodeId)
  if (!node) return false
  if (node.gx === gx && node.gz === gz) return true
  if (plan.nodes.some((item) => item.id !== nodeId && item.gx === gx && item.gz === gz)) return false
  for (const edge of plan.edges) {
    if (edge.fromId === nodeId) {
      const to = plan.nodes.find((item) => item.id === edge.toId)
      if (to && !isValidPlanLine(gx, gz, to.gx, to.gz)) return false
    }
    if (edge.toId === nodeId) {
      const from = plan.nodes.find((item) => item.id === edge.fromId)
      if (from && !isValidPlanLine(from.gx, from.gz, gx, gz)) return false
    }
  }
  return true
}

/**
 * Gehrungen an verknüpften Studio-Wänden aus Nachbar-Endpunkten.
 * Nicht über den Grundriss-Walk: der kann die Wand entgegen der `yawDeg` durchlaufen,
 * dann findet der Startpunkt-Vergleich keine Wand und die Ecke bleibt stumpf.
 * Alle Gebäude — sonst bleiben inaktive Häuser nach dem Load stumpf.
 */
export function recomputeStudioWallMiters(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: syncBuildingWallMiters(building),
    })),
  }
}

/** Fensterbänke folgen `panelFlip` — abgeleitet, jedes Load, ohne die Front zu drehen. */
export function alignStudioOpeningsToWallFronts(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: building.walls.map(alignOpeningElementsToWallFront),
    })),
  }
}

export function finalizeStudioGeometry(state: FacadeState): FacadeState {
  const sealed = sealNearWallEndGaps(state)
  const synced = syncFloorPlansFromWalls(sealed)
  const aligned = alignStudioOpeningsToWallFronts(synced)
  const miters = recomputeStudioWallMiters(aligned)
  return finalizeWallLayout(miters)
}

/** Wandstärke setzen und verknüpfte Ringe auf die Außenkante legen. */
export function applyGlobalWallDepth(state: FacadeState, depth: number): FacadeState {
  const next = updateGlobalDepth(state, depth)
  const active = getActiveBuilding(next)
  return {
    ...next,
    buildings: next.buildings.map((building) =>
      building.id === active.id ? fitBuildingWallsToOuterSpine(building, active.wallDepth) : building,
    ),
  }
}

export function buildingNeedsOuterSpineFit(building: Building): boolean {
  const linked = building.walls.filter((wall) => isStudioWall(wall) && isWallPlanLinked(wall) && !wall.hidden)
  const innerOrigin = linked.filter((wall) => wall.panelFlip === false)
  // Mehrheit innen: Altstand nach „Wandstärke an der Außenkante“. Einzeln gedrehtes
  // panelFlip (Front umkehren) nicht jedes Load zurücksetzen.
  // Keine Heuristik über „unverbundene Ringe“: freistehende planLinked-Wände, Endstücke
  // oder knappe Ecken würden sonst bei jedem Hard-Reload erneut fitten und Origins
  // verschieben — auch wenn panelFlip schon true ist.
  return innerOrigin.length >= 2 && innerOrigin.length * 2 >= linked.length
}

/** Verschiebt eine Gebäudeecke (Gitterposition) auf allen Etagen und in allen 3D-Wänden. */
export function movePlanCornerInState(
  state: FacadeState,
  oldGx: number,
  oldGz: number,
  newGx: number,
  newGz: number,
): FacadeState {
  if (oldGx === newGx && oldGz === newGz) return state
  const oldWorld = { x: oldGx * PLAN_GRID, z: oldGz * PLAN_GRID }
  const newWorld = { x: newGx * PLAN_GRID, z: newGz * PLAN_GRID }
  const moved = translateStudioCorner(state, oldWorld, newWorld)
  return finalizeStudioGeometry(moved)
}

/** Verschiebt eine Kante (beide Endpunkte) als starres Segment. */
export function movePlanEdgeInState(
  state: FacadeState,
  floorIndex: number,
  edgeId: string,
  dgx: number,
  dgz: number,
): FacadeState {
  if (dgx === 0 && dgz === 0) return state
  const active = getActiveBuilding(state)
  const plan = active.floors?.[floorIndex]
  if (!plan) return state
  const edge = plan.edges.find((item) => item.id === edgeId)
  if (!edge) return state
  const from = plan.nodes.find((item) => item.id === edge.fromId)
  const to = plan.nodes.find((item) => item.id === edge.toId)
  if (!from || !to) return state

  let next = movePlanCornerInState(state, from.gx, from.gz, from.gx + dgx, from.gz + dgz)
  next = movePlanCornerInState(next, to.gx, to.gz, to.gx + dgx, to.gz + dgz)
  return next
}

/** Studio-Wand zur Plan-Kante auf der Etage (falls vorhanden). */
export function wallIdForPlanEdge(
  state: FacadeState,
  floorIndex: number,
  edge: PlanEdge,
  plan: FloorPlan,
): string | null {
  const from = plan.nodes.find((item) => item.id === edge.fromId)
  const to = plan.nodes.find((item) => item.id === edge.toId)
  if (!from || !to) return null
  const fromWorld = planNodeWorld(from)
  const length = edgeLengthCm(from, to)
  const yaw = wallYawDegFromSegment(from, to)
  const active = getActiveBuilding(state)
  const wallY = floorIndex * active.wallHeight

  for (const wall of active.walls) {
    if (!isStudioWall(wall) || Math.abs(wall.y - wallY) > 1) continue
    const start = wallStartPoint(wall)
    if (
      pointsMeet(start, fromWorld) &&
      (wall.yawDeg ?? 0) === yaw &&
      Math.abs(wall.width - length) < MITER_MATCH_EPS
    ) {
      return wall.id
    }
  }
  return null
}

export function previewPlanNodeMove(
  plan: FloorPlan,
  nodeId: string,
  gx: number,
  gz: number,
): FloorPlan {
  if (!canMovePlanNode(plan, nodeId, gx, gz)) return plan
  return {
    ...plan,
    nodes: plan.nodes.map((node) => (node.id === nodeId ? { ...node, gx, gz } : node)),
  }
}

export function previewPlanEdgeMove(
  plan: FloorPlan,
  edgeId: string,
  dgx: number,
  dgz: number,
): FloorPlan {
  const edge = plan.edges.find((item) => item.id === edgeId)
  if (!edge) return plan
  const from = plan.nodes.find((item) => item.id === edge.fromId)
  const to = plan.nodes.find((item) => item.id === edge.toId)
  if (!from || !to) return plan
  const nextFrom = { gx: from.gx + dgx, gz: from.gz + dgz }
  const nextTo = { gx: to.gx + dgx, gz: to.gz + dgz }
  if (
    !canMovePlanNode(plan, from.id, nextFrom.gx, nextFrom.gz) ||
    !canMovePlanNode(plan, to.id, nextTo.gx, nextTo.gz)
  ) {
    return plan
  }
  return {
    ...plan,
    nodes: plan.nodes.map((node) => {
      if (node.id === from.id) return { ...node, ...nextFrom }
      if (node.id === to.id) return { ...node, ...nextTo }
      return node
    }),
  }
}
