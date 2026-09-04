import { WALL_DEPTH, WINDOW_RECESS, WINDOW_TRIM_DEFAULT_OFFSET_FORWARD } from '../constants/presets'
import type { CladdingZone, FacadeState, Opening, StudioPanelConfig, Wall } from '../types/facade'
import { cloneWall, emptyNeighbors } from '../types/facade'
import {
  findBuildingForWall,
  getActiveBuilding,
  mapAllWalls,
  updateActiveBuilding,
  updateBuilding,
} from '../utils/buildings'
import { normalizeWallCornice, wallHasCornice } from '../utils/cornice'
import { createId } from '../utils/id'
import { hydrateWall } from '../utils/hydrate'
import {
  clampOpeningToWall,
  clampStudioWallDimensions,
  openingFitsWithinWall,
} from '../utils/validation'
import { floorIndex } from '../utils/layers'
import { ensureWindowSills } from '../utils/openings'
import { getWall, rebuildBuildingNeighbors } from '../utils/walls'
import {
  DEFAULT_PANEL_CLEARANCE_DEPTH_CM,
  PANEL_CLEARANCE_DEPTH_MAX,
  openingPanelClearance,
  openingPanelClearanceDepthCm,
} from '../utils/openingGeometry'
import { normalizeYawDeg } from './compass'
import { facadeOutward } from './elevation'
import { wallHasArcBay } from './arcWall'
import { syncStairsToDoorWidth } from './stairs'
import {
  DEFAULT_STUDIO_PANEL,
  PLINTH_OVERHANG,
  PLAN_GRID,
  STUDIO_DEFAULT_HEIGHT,
  STUDIO_DEFAULT_WIDTH,
  STUDIO_MASONRY,
  STUDIO_WALL_WIDTH_STEP,
  isDiagonalPlanYaw,
  wallWidthStepCm,
  normalizeStudioPanel,
  studioPlinthActive,
} from './constants'
import {
  applyTwoHorizontalCladdingZones,
  clearPersistedCladdingZones,
  isTwoHorizontalBandCladding,
  readTwoHorizontalBandOptions,
  type TwoHorizontalBandOptions,
} from './facadeLayers'

export function isStudioWall(wall: Wall): boolean {
  return wall.kind === 'studio'
}

export function normalizeStudioWall(wall: Wall): Wall {
  const dims = clampStudioWallDimensions(wall)
  const cloned = cloneWall(wall)
  return {
    ...cloned,
    kind: 'studio',
    ...dims,
    originX: wall.originX ?? wall.x,
    originZ: wall.originZ ?? 0,
    yawDeg: wall.yawDeg ?? 0,
    panelFlip: wall.panelFlip ?? true,
    miterStart: wall.miterStart ?? 0,
    miterEnd: wall.miterEnd ?? 0,
    panel: normalizeStudioPanel(wall.panel),
    cornice: wall.cornice ? normalizeWallCornice(wall.cornice) : wall.cornice,
    openings: cloned.openings
      .filter((opening) => openingFitsWithinWall(opening, dims))
      .map((opening) => {
        const clamped = ensureWindowSills(clampOpeningToWall(opening, dims, STUDIO_MASONRY))
        return clamped.type === 'door' && clamped.stairs?.enabled
          ? { ...clamped, stairs: syncStairsToDoorWidth(clamped.stairs, clamped) }
          : clamped
      }),
  }
}

export function createStudioWall(x = 0, y = 0): Wall {
  return hydrateWall(
    normalizeStudioWall({
      id: createId(),
      kind: 'studio',
      x,
      y,
      width: STUDIO_DEFAULT_WIDTH,
      height: STUDIO_DEFAULT_HEIGHT,
      depth: WALL_DEPTH,
      originX: x,
      originZ: 0,
      yawDeg: 0,
      panelFlip: true,
      panel: { ...DEFAULT_STUDIO_PANEL },
      openings: [],
      profiles: [],
      neighbors: emptyNeighbors(),
    }),
  )
}

export function addStudioWall(state: FacadeState): FacadeState {
  return updateActiveBuilding(state, (building) => {
    const bounds = building.walls.reduce(
      (acc, wall) => ({
        maxX: Math.max(acc.maxX, wall.x + wall.width),
        maxY: Math.max(acc.maxY, wall.y + wall.height),
      }),
      { maxX: 0, maxY: 0 },
    )
    const next = createStudioWall(bounds.maxX + 32, 0)
    return {
      ...building,
      walls: [...building.walls.map(cloneWall), next],
    }
  })
}

/** Dupliziert eine Studio-Wand um ein Grundriss-Gittermaß senkrecht zur Wand. */
export function duplicateStudioWallAtGrid(state: FacadeState, wallId: string): FacadeState {
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  const wall = building.walls.find((item) => item.id === wallId)
  if (!wall || !isStudioWall(wall)) return state

  const openingIdMap = new Map<string, string>()
  const openings = wall.openings.map((opening) => {
    const nextId = createId()
    openingIdMap.set(opening.id, nextId)
    return { ...opening, id: nextId }
  })

  const perp = wallAlongDelta((wall.yawDeg ?? 0) + 90, PLAN_GRID)
  const cloned = normalizeStudioWall({
    ...cloneWall(wall),
    id: createId(),
    originX: (wall.originX ?? wall.x) + perp.x,
    originZ: (wall.originZ ?? 0) + perp.z,
    x: wall.x + perp.x,
    neighbors: emptyNeighbors(),
    planLinked: false,
    groupId: undefined,
    openings,
    profiles: wall.profiles.map((profile) => ({
      ...profile,
      openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
    })),
    buildingId: building.id,
  })

  return updateBuilding(state, building.id, (b) =>
    rebuildBuildingNeighbors({ ...b, walls: [...b.walls.map(cloneWall), cloned] }),
  )
}

export function resizeStudioWall(wall: Wall, deltaWidth: number, deltaHeight: number): Wall {
  const next = normalizeStudioWall({
    ...cloneWall(wall),
    width: wall.width + deltaWidth,
    height: wall.height + deltaHeight,
  })
  return next
}

export function resizeStudioWalls(
  state: FacadeState,
  wallIds: string[],
  deltaWidth: number,
  deltaHeight: number,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    return resizeStudioWall(wall, deltaWidth, deltaHeight)
  })
}

/**
 * Verschiebt alle Wand-Endpunkte an einer Ecke (alle Etagen). Lückenfrei verbundene Wände bleiben verbunden.
 */
export function translateStudioCorner(
  state: FacadeState,
  oldPoint: { x: number; z: number },
  newPoint: { x: number; z: number },
  excludeWallId?: string | string[],
  buildingId?: string,
): FacadeState {
  const delta = { x: newPoint.x - oldPoint.x, z: newPoint.z - oldPoint.z }
  if (Math.hypot(delta.x, delta.z) < 1e-6) return state

  const exclude = new Set(
    excludeWallId == null ? [] : Array.isArray(excludeWallId) ? excludeWallId : [excludeWallId],
  )
  const targetBuildingId =
    buildingId ??
    (exclude.size > 0
      ? findBuildingForWall(state, [...exclude][0]!)?.id
      : undefined) ??
    getActiveBuilding(state).id

  return updateBuilding(state, targetBuildingId, (building) => ({
    ...building,
    walls: building.walls.map((wall) => {
      if (!isStudioWall(wall)) return cloneWall(wall)
      if (exclude.has(wall.id)) return cloneWall(wall)
      if (!isWallPlanLinked(wall)) return cloneWall(wall)
      let next = cloneWall(wall)
      let changed = false
      const start = wallStartPoint(next)
      const end = wallEndPoint(next)
      if (pointsMeet(start, oldPoint)) {
        next.originX = start.x + delta.x
        next.originZ = start.z + delta.z
        next.x = next.originX ?? next.x
        changed = true
      }
      if (pointsMeet(end, oldPoint)) {
        const along = wallAlongDelta(next.yawDeg ?? 0, next.width)
        next.originX = end.x + delta.x - along.x
        next.originZ = end.z + delta.z - along.z
        next.x = next.originX ?? next.x
        changed = true
      }
      return changed ? normalizeStudioWall(next) : next
    }),
  }))
}

export function stretchSingleStudioWall(wall: Wall, side: 'start' | 'end', deltaCm: number): Wall {
  const yaw = wall.yawDeg ?? 0
  const unit = wallAlongDelta(yaw, 1)
  const deltaVec =
    side === 'start'
      ? { x: -unit.x * deltaCm, z: -unit.z * deltaCm }
      : { x: unit.x * deltaCm, z: unit.z * deltaCm }
  let updated = cloneWall(wall)
  if (side === 'start') {
    updated.originX = (updated.originX ?? updated.x) + deltaVec.x
    updated.originZ = (updated.originZ ?? 0) + deltaVec.z
    updated.x = updated.originX ?? updated.x
    updated.width += deltaCm
    updated.openings = updated.openings.map((opening) => ({
      ...opening,
      x: opening.x + deltaCm,
    }))
  } else {
    updated.width += deltaCm
  }
  return normalizeStudioWall(updated)
}

/**
 * Verlängert eine Studio-Fassade an der Start- oder Endseite und zieht
 * verbundene Wände aller Etagen mit (ohne Lücken).
 * Unverknüpfte Wände (`planLinked: false`) ändern nur sich selbst.
 */
export function stretchStudioFacade(
  state: FacadeState,
  wallId: string,
  side: 'start' | 'end',
  deltaCm: number,
): FacadeState {
  if (deltaCm === 0) return state
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  const target = building.walls.find((wall) => wall.id === wallId)
  if (!target || !isStudioWall(target)) return state

  if (!isWallPlanLinked(target)) {
    return updateBuilding(state, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) =>
        wall.id === wallId && isStudioWall(wall)
          ? stretchSingleStudioWall(wall, side, deltaCm)
          : cloneWall(wall),
      ),
    }))
  }

  const yaw = target.yawDeg ?? 0
  const unit = wallAlongDelta(yaw, 1)
  const deltaVec =
    side === 'start'
      ? { x: -unit.x * deltaCm, z: -unit.z * deltaCm }
      : { x: unit.x * deltaCm, z: unit.z * deltaCm }
  const corner = side === 'start' ? wallStartPoint(target) : wallEndPoint(target)
  const newCorner = { x: corner.x + deltaVec.x, z: corner.z + deltaVec.z }

  const stacked = findVerticalAlignedWalls(target, building.walls, building.wallHeight)
  const stretchIds = new Set([wallId, ...stacked.map((item) => item.id)])

  const next = updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((wall) => {
      if (!isStudioWall(wall)) return cloneWall(wall)
      if (!stretchIds.has(wall.id)) return cloneWall(wall)
      return stretchSingleStudioWall(wall, side, deltaCm)
    }),
  }))

  return translateStudioCorner(next, corner, newCorner, [...stretchIds], building.id)
}

/**
 * Verschiebung entlang der Wandachse: Bewegung in der XZ-Ebene → signed Δ-Breite.
 * Ende greifen: + entlang Yaw; Start greifen: + entgegen der Yaw.
 */
export function alongWidthDeltaFromMove(
  yawDeg: number,
  wallEnd: 'start' | 'end',
  dx: number,
  dz: number,
): number {
  const unit = wallAlongDelta(yawDeg, 1)
  const ulen = Math.hypot(unit.x, unit.z) || 1
  const along = (dx * unit.x + dz * unit.z) / ulen
  return wallEnd === 'end' ? along : -along
}

function shortestSignedYawDeltaDeg(fromDeg: number, toDeg: number): number {
  let delta = normalizeYawDeg(toDeg - fromDeg)
  if (delta > 180) delta -= 360
  return delta
}

/**
 * Neue Wand an einem Ende: Yaw relativ zur Quellwand auf ±45° oder ±90°.
 * Kollinear (0°/180°) → `null` (keine Abzweigung, Original bleibt).
 */
export function snapBranchYawDeg(
  parentYawDeg: number,
  wallEnd: 'start' | 'end',
  dx: number,
  dz: number,
): number | null {
  if (Math.hypot(dx, dz) < 0.5) return null
  const awayYaw = normalizeYawDeg(parentYawDeg + (wallEnd === 'start' ? 180 : 0))
  const dragYaw = normalizeYawDeg((Math.atan2(-dz, dx) * 180) / Math.PI)
  const rel = shortestSignedYawDeltaDeg(awayYaw, dragYaw)
  const options = [-90, -45, 0, 45, 90, 180, -180]
  let best = options[0]!
  let bestDist = Infinity
  for (const option of options) {
    const dist = Math.abs(rel - option)
    if (dist < bestDist) {
      bestDist = dist
      best = option
    }
  }
  if (Math.abs(best) < 1 || Math.abs(Math.abs(best) - 180) < 1) return null
  return normalizeYawDeg(awayYaw + best)
}

function xzCross(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return a.x * b.z - a.z * b.x
}

function unitXZ(v: { x: number; z: number }): { x: number; z: number } {
  const len = Math.hypot(v.x, v.z) || 1
  return { x: v.x / len, z: v.z / len }
}

/**
 * Lage einer Abzweig-Wand: Paneele auf derselben Bandseite wie die Quelle
 * (`along × outward` gleiches Vorzeichen). Am Start endet die neue Wand an der Fuge.
 * `panelFlip` bleibt das der Quelle — Segment ggf. um 180° drehen.
 */
export function poseAngledWallFromEnd(
  source: Wall,
  wallEnd: 'start' | 'end',
  yawDeg: number,
  widthCm: number,
): { originX: number; originZ: number; yawDeg: number; panelFlip: boolean } {
  const joint = wallEnd === 'start' ? wallStartPoint(source) : wallEndPoint(source)
  const preferredFlip = source.panelFlip ?? true
  const srcAlong = unitXZ(wallAlongDelta(source.yawDeg ?? 0, 1))
  const nOut = facadeOutward(source.yawDeg ?? 0, preferredFlip)
  const srcSide = Math.sign(xzCross(srcAlong, nOut)) || 1

  // `yawDeg` ist die Richtung von der Fuge weg (snapBranchYawDeg).
  let yaw = normalizeYawDeg(yawDeg)
  let originX = joint.x
  let originZ = joint.z
  if (wallEnd === 'start') {
    const away = wallAlongDelta(yaw, widthCm)
    originX += away.x
    originZ += away.z
    yaw = normalizeYawDeg(yaw + 180)
  }

  const along = unitXZ(wallAlongDelta(yaw, 1))
  const outTrue = facadeOutward(yaw, true)
  const sideTrue = Math.sign(xzCross(along, outTrue)) || 1
  let flip = sideTrue === srcSide
  if (flip !== preferredFlip) {
    const far = wallAlongDelta(yaw, widthCm)
    originX += far.x
    originZ += far.z
    yaw = normalizeYawDeg(yaw + 180)
    flip = preferredFlip
  }
  return { originX, originZ, yawDeg: yaw, panelFlip: flip }
}

function wallEndAtPoint(wall: Wall, pt: { x: number; z: number }): 'start' | 'end' | null {
  if (pointsMeet(wallStartPoint(wall), pt)) return 'start'
  if (pointsMeet(wallEndPoint(wall), pt)) return 'end'
  return null
}

function linkedStudioWallsAtPoint(pt: { x: number; z: number }, walls: Wall[], y: number): Wall[] {
  return walls.filter((wall) => {
    if (!isStudioWall(wall) || !isWallPlanLinked(wall)) return false
    if (Math.abs((wall.y ?? 0) - y) > 1) return false
    return wallEndAtPoint(wall, pt) !== null
  })
}

function isProtectedFromPoseReverse(wall: Wall): boolean {
  return Boolean(
    wall.bayWindow || wall.bayParentId || wall.arcBay || wall.endPiece || wall.endPieceParentId,
  )
}

function ribbonSide(wall: Wall): number {
  const along = unitXZ(wallAlongDelta(wall.yawDeg ?? 0, 1))
  const out = facadeOutward(wall.yawDeg ?? 0, wall.panelFlip ?? true)
  return Math.sign(xzCross(along, out)) || 1
}

function setRibbonSide(wall: Wall, want: number): Wall {
  if (ribbonSide(wall) === want) return wall
  return alignOpeningElementsToWallFront({ ...wall, panelFlip: !(wall.panelFlip ?? true) })
}

/** 180°-Pose: dasselbe Fußprint, Welt-Außenseite bleibt, Öffnungen bleiben am Ort. */
function reverseWallKeepWorldOutward(wall: Wall): Wall {
  const finish = wallEndPoint(wall)
  const width = wall.width
  const yaw = normalizeYawDeg((wall.yawDeg ?? 0) + 180)
  const openings = wall.openings.map((opening) => ({
    ...opening,
    x: width - opening.x - opening.width,
  }))
  const label = wall.label
    ? { ...wall.label, x: width - (wall.label.x ?? 0) }
    : wall.label
  const endPiece = wall.endPiece
    ? {
        ...wall.endPiece,
        side: wall.endPiece.side === 'start' ? ('end' as const) : ('start' as const),
      }
    : wall.endPiece
  return {
    ...wall,
    originX: finish.x,
    originZ: finish.z,
    x: finish.x,
    yawDeg: yaw,
    panelFlip: !(wall.panelFlip ?? true),
    miterStart: wall.miterEnd ?? 0,
    miterEnd: wall.miterStart ?? 0,
    openings,
    label,
    endPiece,
  }
}

function matchRibbonToNeighbor(
  wall: Wall,
  neighbor: Wall,
  joint: { x: number; z: number },
): Wall {
  const wallAt = wallEndAtPoint(wall, joint)
  const neighborAt = wallEndAtPoint(neighbor, joint)
  if (!wallAt || !neighborAt) return wall
  const sequential =
    (wallAt === 'end' && neighborAt === 'start') || (wallAt === 'start' && neighborAt === 'end')
  const want = sequential ? ribbonSide(neighbor) : -ribbonSide(neighbor)
  return setRibbonSide(wall, want)
}

function planLinkedNeighbors(
  wall: Wall,
  walls: Wall[],
): { other: Wall; joint: { x: number; z: number }; wallAt: 'start' | 'end'; otherAt: 'start' | 'end' }[] {
  const found: {
    other: Wall
    joint: { x: number; z: number }
    wallAt: 'start' | 'end'
    otherAt: 'start' | 'end'
  }[] = []
  for (const end of ['start', 'end'] as const) {
    const joint = end === 'start' ? wallStartPoint(wall) : wallEndPoint(wall)
    const meeting = linkedStudioWallsAtPoint(joint, walls, wall.y ?? 0)
    for (const other of meeting) {
      if (other.id === wall.id) continue
      const otherAt = wallEndAtPoint(other, joint)
      if (!otherAt) continue
      found.push({ other, joint, wallAt: end, otherAt })
    }
  }
  return found
}

/**
 * Bestandsprojekte: Kette vom Samen aus so orientieren, dass Nachbarn Ende→Start
 * anschließen. Jede Wand höchstens einmal umkehren — sonst oszilliert eine Abzweig-Wand
 * zwischen zwei Fugen (Start/Start hier, nach 180° Start/Start am anderen Ende).
 * Idempotent bei schon sequenzieller Topologie; kein Eingriff in Nutzer-Flips.
 */
export function repairBuildingPlanLinkedWalls(walls: Wall[]): Wall[] {
  let next = walls
  const visited = new Set<string>()
  for (const seed of walls) {
    if (!isStudioWall(seed) || !isWallPlanLinked(seed) || visited.has(seed.id)) continue
    const queue = [seed.id]
    visited.add(seed.id)
    while (queue.length > 0) {
      const currentId = queue.shift()!
      const current = next.find((item) => item.id === currentId)
      if (!current) continue
      for (const link of planLinkedNeighbors(current, next)) {
        if (visited.has(link.other.id)) continue
        let other = next.find((item) => item.id === link.other.id) ?? link.other
        if (link.wallAt === wallEndAtPoint(other, link.joint) && !isProtectedFromPoseReverse(other)) {
          const reversed = reverseWallKeepWorldOutward(other)
          const matched = matchRibbonToNeighbor(reversed, current, link.joint)
          next = next.map((item) => (item.id === matched.id ? matched : item))
        }
        visited.add(other.id)
        queue.push(other.id)
      }
    }
  }
  return next
}

/** Alle Gebäude: invertierte Plan-Fugen (zwei Starts / zwei Enden) einmalig korrigieren. */
export function repairPlanLinkedWallFronts(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: repairBuildingPlanLinkedWalls(building.walls),
    })),
  }
}

/** Magnet entlang der Abzweig: ein Rasterschritt der Zugrichtung (48 cm bzw. 48√2). */
export const BRANCH_CLOSE_MAGNET_CM = PLAN_GRID
/** Exakte Ecken / achsparallele Stoßpunkte (cm). */
const CORNER_EPS = 2
/**
 * Quer-Toleranz am Abzweig-Strahl für Endpunkte (cm).
 * Bei langen 45°-Wänden reichen winzige Winkel-/Rasterreste, um CORNER_EPS zu sprengen.
 * Länge wird weiterhin als Projektion `t` entlang des Strahls gesetzt.
 */
const BRANCH_CLOSE_PERP_EPS = 24
/**
 * Join-Toleranz wenn mind. eine Wand diagonal ist (cm).
 * Nach Längen-Snap bleibt der Querversatz bis BRANCH_CLOSE_PERP_EPS;
 * Gehrung/Nachbarschaft müssen denselben Near-Miss noch treffen.
 * Achsparallele Paare behalten CORNER_EPS — 90°-Tests unverändert.
 */
const DIAGONAL_JOIN_EPS = BRANCH_CLOSE_PERP_EPS

export type BranchCloseSnap = {
  widthCm: number
  split?: { wallId: string; atCm: number }
  /**
   * Exakte Ziel-Ecke (Endpunkt-Snap). Die Abzweig wird darauf ausgerichtet
   * (Yaw kann minimal von 45°/90° abweichen), damit kein sichtbarer Versatz bleibt.
   */
  meet?: { x: number; z: number }
}

function rayHitSegment(
  origin: { x: number; z: number },
  dir: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): { tRay: number; tSeg: number } | null {
  const sx = b.x - a.x
  const sz = b.z - a.z
  const det = dir.x * sz - dir.z * sx
  if (Math.abs(det) < 1e-8) return null
  const ox = a.x - origin.x
  const oz = a.z - origin.z
  return {
    tRay: (ox * sz - oz * sx) / det,
    tSeg: (ox * dir.z - oz * dir.x) / det,
  }
}

function partitionOpeningsAt(openings: Opening[], atCm: number): { first: Opening[]; second: Opening[] } {
  const first: Opening[] = []
  const second: Opening[] = []
  for (const opening of openings) {
    const x0 = opening.x
    const x1 = opening.x + opening.width
    if (x1 <= atCm + 0.5) first.push(opening)
    else if (x0 >= atCm - 0.5) second.push({ ...opening, x: opening.x - atCm })
    else {
      const left = Math.max(0, atCm - x0)
      const right = Math.max(0, x1 - atCm)
      if (left >= right) first.push(opening)
      else second.push({ ...opening, x: opening.x - atCm })
    }
  }
  return { first, second }
}

/** Teilt eine Studio-Wand am Maß `atCm` vom Start; beide Stücke mindestens 48 cm. */
export function splitStudioWallAt(wall: Wall, atCm: number): [Wall, Wall] | null {
  if (!isStudioWall(wall) || isProtectedFromPoseReverse(wall)) return null
  if (atCm < STUDIO_WALL_WIDTH_STEP - 0.5 || wall.width - atCm < STUDIO_WALL_WIDTH_STEP - 0.5) {
    return null
  }
  const start = wallStartPoint(wall)
  const along = wallAlongDelta(wall.yawDeg ?? 0, atCm)
  const { first: firstOpenings, second: secondOpenings } = partitionOpeningsAt(wall.openings, atCm)
  const firstIds = new Set(firstOpenings.map((item) => item.id))
  const secondIds = new Set(secondOpenings.map((item) => item.id))
  const labelX = wall.label?.x ?? 0
  const first = normalizeStudioWall({
    ...cloneWall(wall),
    width: atCm,
    openings: firstOpenings,
    profiles: wall.profiles.filter((item) => firstIds.has(item.openingId)),
    label: wall.label && labelX <= atCm ? wall.label : undefined,
    miterEnd: 0,
    planLinked: true,
  })
  const second = normalizeStudioWall({
    ...cloneWall(wall),
    id: createId(),
    originX: start.x + along.x,
    originZ: start.z + along.z,
    x: start.x + along.x,
    width: wall.width - atCm,
    openings: secondOpenings,
    profiles: wall.profiles.filter((item) => secondIds.has(item.openingId)),
    label: wall.label && labelX > atCm ? { ...wall.label, x: labelX - atCm } : undefined,
    miterStart: 0,
    planLinked: true,
    endPiece: undefined,
  })
  return [first, second]
}

function replaceSplitWall(walls: Wall[], wallId: string, atCm: number): Wall[] {
  const index = walls.findIndex((item) => item.id === wallId)
  if (index < 0) return walls
  const parts = splitStudioWallAt(walls[index]!, atCm)
  if (!parts) return walls
  return [...walls.slice(0, index), parts[0], parts[1], ...walls.slice(index + 1)]
}

/**
 * Zieht die Abzweig-Länge auf eine Ecke oder Wandmitte (T-Stoß), wenn der Treffer
 * entlang des 45°/90°-Strahls höchstens 48 cm von der aktuellen Breite liegt.
 */
export function snapBranchClose(
  joint: { x: number; z: number },
  awayYawDeg: number,
  widthCm: number,
  walls: Wall[],
  opts: { floorY: number; excludeIds: Iterable<string> },
): BranchCloseSnap | null {
  const dir = unitXZ(wallAlongDelta(awayYawDeg, 1))
  const exclude = new Set(opts.excludeIds)
  const step = wallWidthStepCm(awayYawDeg)
  const minT = step - 0.5
  const perpEps = isDiagonalPlanYaw(awayYawDeg)
    ? Math.max(BRANCH_CLOSE_PERP_EPS, widthCm * 0.02)
    : CORNER_EPS
  let bestDist = Infinity
  let bestWidth = 0
  let bestRank = 9
  let bestSplit: { wallId: string; atCm: number } | undefined
  let bestMeet: { x: number; z: number } | undefined

  const consider = (
    t: number,
    rank: number,
    split?: { wallId: string; atCm: number },
    meet?: { x: number; z: number },
  ) => {
    if (t < minT) return
    const dist = Math.abs(t - widthCm)
    if (dist > step + 1e-6) return
    if (dist < bestDist - 0.5 || (Math.abs(dist - bestDist) <= 0.5 && rank < bestRank)) {
      bestDist = dist
      bestWidth = t
      bestRank = rank
      bestSplit = split
      bestMeet = meet
    }
  }

  for (const wall of walls) {
    if (exclude.has(wall.id) || !isStudioWall(wall)) continue
    if (Math.abs((wall.y ?? 0) - opts.floorY) > 1) continue
    for (const pt of [wallStartPoint(wall), wallEndPoint(wall)]) {
      if (pointsMeet(pt, joint)) continue
      const vx = pt.x - joint.x
      const vz = pt.z - joint.z
      const t = vx * dir.x + vz * dir.z
      const perp = Math.hypot(vx - dir.x * t, vz - dir.z * t)
      if (perp > perpEps) continue
      // Länge entlang des Wunsch-Strahls; `meet` zieht den Endpunkt exakt auf die Ecke.
      consider(t, 0, undefined, pt)
    }
  }

  for (const wall of walls) {
    if (exclude.has(wall.id) || !isStudioWall(wall)) continue
    if (isProtectedFromPoseReverse(wall)) continue
    if (Math.abs((wall.y ?? 0) - opts.floorY) > 1) continue
    const hit = rayHitSegment(joint, dir, wallStartPoint(wall), wallEndPoint(wall))
    if (!hit || hit.tSeg <= 0.02 || hit.tSeg >= 0.98) continue
    const atCm = hit.tSeg * wall.width
    if (atCm < minT || wall.width - atCm < minT) continue
    consider(hit.tRay, 1, { wallId: wall.id, atCm })
  }

  if (bestDist === Infinity) return null
  const snap: BranchCloseSnap = bestSplit
    ? { widthCm: bestWidth, split: bestSplit }
    : { widthCm: bestWidth }
  if (bestMeet) snap.meet = bestMeet
  return snap
}

/** Freies Ende der Abzweig-Wand trifft eine andere Wand als die Quelle. */
export function branchClosesAgainstWalls(branch: Wall, sourceId: string, walls: Wall[]): boolean {
  for (const end of ['start', 'end'] as const) {
    if (findAdjacentWalls(branch, end, walls).some((item) => item.id !== sourceId)) return true
  }
  return false
}

/**
 * Hängt eine neue Studio-Wand im gegebenen Winkel an Start oder Ende der Quelle.
 * Quellenbreite und -lage bleiben unverändert; beide Wände sind `planLinked`.
 * Nahe Ecken oder eine getroffene Wand schließen den Pfad (Gehrung / T-Stoß).
 */
export function attachAngledWallFromEnd(
  state: FacadeState,
  sourceId: string,
  wallEnd: 'start' | 'end',
  yawDeg: number,
  widthCm: number,
  newId: string,
): FacadeState {
  const building = findBuildingForWall(state, sourceId)
  if (!building) return state
  const source = building.walls.find((item) => item.id === sourceId)
  if (!source || !isStudioWall(source)) return state
  if (building.walls.some((item) => item.id === newId)) return state

  const joint = wallEnd === 'start' ? wallStartPoint(source) : wallEndPoint(source)
  const step = wallWidthStepCm(yawDeg)
  const requested = Math.max(step, widthCm)
  const close = snapBranchClose(joint, yawDeg, requested, building.walls, {
    floorY: source.y,
    excludeIds: [sourceId, newId],
  })
  const width = Math.max(step, close?.widthCm ?? requested)
  let pose = poseAngledWallFromEnd(source, wallEnd, yawDeg, width)
  let wall = buildStudioWallAt({
    originX: pose.originX,
    originZ: pose.originZ,
    y: source.y,
    yawDeg: pose.yawDeg,
    width,
    panelFlip: pose.panelFlip,
    styleFrom: source,
  })
  // Ecken-Snap: freies Ende exakt auf Ziel (Yaw ggf. leicht korrigiert).
  if (close?.meet) {
    const freeEnd: 'start' | 'end' =
      pointsMeet({ x: pose.originX, z: pose.originZ }, joint) ? 'end' : 'start'
    const pulled = poseWallEndAt(wall, freeEnd, close.meet, { lockYaw: false })
    if (pulled) {
      wall = pulled
      pose = {
        originX: pulled.originX ?? pulled.x,
        originZ: pulled.originZ ?? 0,
        yawDeg: pulled.yawDeg ?? yawDeg,
        panelFlip: pose.panelFlip,
      }
    }
  }
  wall = {
    ...wall,
    id: newId,
    planLinked: true,
    panelFlip: pose.panelFlip,
    buildingId: source.buildingId ?? building.id,
  }
  const ids = new Set([sourceId, newId])
  let walls = [
    ...building.walls.map((item) =>
      ids.has(item.id) && isStudioWall(item) ? { ...cloneWall(item), planLinked: true } : cloneWall(item),
    ),
    wall,
  ]
  if (close?.split) walls = replaceSplitWall(walls, close.split.wallId, close.split.atCm)
  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls,
  }))
}

/**
 * Wie {@link attachAngledWallFromEnd}, aber an allen übereinander liegenden Wänden
 * (gleicher Fußabdriff, andere Etage) — z. B. EG-Abzweig zieht OG mit.
 */
export function attachAngledWallFromEndForVerticalStack(
  state: FacadeState,
  sourceId: string,
  wallEnd: 'start' | 'end',
  yawDeg: number,
  widthCm: number,
  newId: string,
): FacadeState {
  const building = findBuildingForWall(state, sourceId)
  if (!building) return state
  const source = building.walls.find((item) => item.id === sourceId)
  if (!source || !isStudioWall(source)) return state

  let next = attachAngledWallFromEnd(state, sourceId, wallEnd, yawDeg, widthCm, newId)
  for (const upper of findVerticalAlignedWalls(source, building.walls, building.wallHeight)) {
    next = attachAngledWallFromEnd(next, upper.id, wallEnd, yawDeg, widthCm, createId())
  }
  return next
}

/**
 * Zieht ein Wandende auf eine Zielposition. `lockYaw`: nur entlang der aktuellen Achse
 * (0°). Sonst darf die Wand um das andere Ende auf 45°/90° schwenken.
 */
export function poseWallEndAt(
  wall: Wall,
  wallEnd: 'start' | 'end',
  targetCorner: { x: number; z: number },
  opts?: { lockYaw?: boolean },
): Wall | null {
  if (!isStudioWall(wall)) return null
  const fixed = wallEnd === 'start' ? wallEndPoint(wall) : wallStartPoint(wall)
  const lockYaw = opts?.lockYaw !== false
  let mx = targetCorner.x
  let mz = targetCorner.z
  if (lockYaw) {
    const unit = wallAlongDelta(wall.yawDeg ?? 0, 1)
    const ulen = Math.hypot(unit.x, unit.z) || 1
    const ux = unit.x / ulen
    const uz = unit.z / ulen
    if (wallEnd === 'end') {
      const along = (mx - fixed.x) * ux + (mz - fixed.z) * uz
      mx = fixed.x + ux * along
      mz = fixed.z + uz * along
    } else {
      const along = (fixed.x - mx) * ux + (fixed.z - mz) * uz
      mx = fixed.x - ux * along
      mz = fixed.z - uz * along
    }
  }
  const from = wallEnd === 'end' ? fixed : { x: mx, z: mz }
  const to = wallEnd === 'end' ? { x: mx, z: mz } : fixed
  const dx = to.x - from.x
  const dz = to.z - from.z
  const width = Math.hypot(dx, dz)
  const yawDeg = normalizeYawDeg((Math.atan2(-dz, dx) * 180) / Math.PI)
  if (width < wallWidthStepCm(yawDeg) - 0.01) return null
  return normalizeStudioWall({
    ...cloneWall(wall),
    originX: from.x,
    originZ: from.z,
    x: from.x,
    yawDeg,
    width,
  })
}

export function applyWallGripCornerTarget(
  state: FacadeState,
  wallId: string,
  wallEnd: 'start' | 'end',
  targetCorner: { x: number; z: number },
  opts?: { lockYaw?: boolean },
): FacadeState {
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  const wall = building.walls.find((item) => item.id === wallId)
  if (!wall || !isStudioWall(wall)) return state

  const oldCorner = wallEnd === 'start' ? wallStartPoint(wall) : wallEndPoint(wall)
  const posed = poseWallEndAt(wall, wallEnd, targetCorner, opts)
  if (!posed) return state
  const newCorner = wallEnd === 'start' ? wallStartPoint(posed) : wallEndPoint(posed)

  const next = updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((item) => (item.id === wallId ? posed : cloneWall(item))),
  }))
  return translateStudioCorner(next, oldCorner, newCorner, wallId, building.id)
}

/** Rasterschritt senkrecht zur Wand (Front): 48 cm achsparallel, sonst Diagonale. */
export function frontMoveStepCm(wall: Wall): number {
  const out = facadeOutward(wall.yawDeg ?? 0, wall.panelFlip ?? true)
  return wallWidthStepCm(normalizeYawDeg((Math.atan2(-out.z, out.x) * 180) / Math.PI))
}

/** Kollinear verknüpfte Nachbarn derselben Etage (eine Fassadenflucht). */
export function expandCollinearPlanLinkedIds(walls: Wall[], seedIds: string[]): string[] {
  const selected = new Set(seedIds)
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    const wall = walls.find((item) => item.id === id)
    if (!wall || !isStudioWall(wall) || !isWallPlanLinked(wall)) continue
    for (const end of ['start', 'end'] as const) {
      const adj = findCollinearDockWall(wall, end, walls)
      if (adj && isWallPlanLinked(adj) && !selected.has(adj.id)) {
        selected.add(adj.id)
        queue.push(adj.id)
      }
    }
  }
  return [...selected]
}

/** Verknüpfte 45°-Nachbarn, die nicht zur Auswahl gehören. */
export function unselectedLinkedDiagonalWalls(walls: Wall[], selectedIds: Iterable<string>): Wall[] {
  const selected = new Set(selectedIds)
  const scope = expandCollinearPlanLinkedIds(walls, [...selected])
  const found = new Map<string, Wall>()
  for (const id of scope) {
    const wall = walls.find((item) => item.id === id)
    if (!wall || !isStudioWall(wall) || !isWallPlanLinked(wall)) continue
    for (const end of ['start', 'end'] as const) {
      for (const adj of findAdjacentWalls(wall, end, walls)) {
        if (selected.has(adj.id) || !isDiagonalPlanYaw(adj.yawDeg ?? 0)) continue
        found.set(adj.id, adj)
      }
    }
  }
  return [...found.values()]
}

/**
 * Rückwand fürs Extrudieren: von der alten Ecke `from` zur neuen Ecke `to`,
 * Stil der bewegten Wand; Außenseite zeigt vom Segment weg (Richtung des gegriffenen Endes).
 */
function buildReturnWall(
  moved: Wall,
  from: { x: number; z: number },
  to: { x: number; z: number },
  end: 'start' | 'end',
): Wall | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const width = Math.hypot(dx, dz)
  if (width < 1) return null
  const yawDeg = normalizeYawDeg((Math.atan2(-dz, dx) * 180) / Math.PI)
  if (width < wallWidthStepCm(yawDeg) - 0.01) return null
  const along = wallAlongDelta(moved.yawDeg ?? 0, 1)
  const wantX = end === 'start' ? -along.x : along.x
  const wantZ = end === 'start' ? -along.z : along.z
  const flipTrue = facadeOutward(yawDeg, true)
  const flipFalse = facadeOutward(yawDeg, false)
  const panelFlip =
    flipTrue.x * wantX + flipTrue.z * wantZ >= flipFalse.x * wantX + flipFalse.z * wantZ
  const wall = buildStudioWallAt({
    originX: from.x,
    originZ: from.z,
    y: moved.y,
    yawDeg,
    width,
    panelFlip,
    styleFrom: moved,
  })
  return { ...wall, panelFlip, planLinked: true, openings: [], profiles: [] }
}

/**
 * Verschiebt die gewählten Wände entlang der Front der Samenwand.
 * 90°-Nachbarn werden am Stoß mitgezogen (gestreckt), 45°-Wände müssen in `moveIds` liegen.
 */
export function offsetStudioWallsAlongFront(
  state: FacadeState,
  seedId: string,
  moveIds: string[],
  distanceCm: number,
  opts?: {
    singleFloor?: boolean
    /** `false`: nur die Seeds (+ Etagen), nicht die kollineare Flucht (Default `true`). */
    collinear?: boolean
    /**
     * Extrudieren: Wo ein bewegtes Wandende nur kollineare (nicht bewegte) Nachbarn hat,
     * entsteht eine neue 90°-Rückwand zwischen alter und neuer Ecke (Default `false`).
     */
    returnWalls?: boolean
  },
): FacadeState {
  if (Math.abs(distanceCm) < 0.5) return state
  const building = findBuildingForWall(state, seedId)
  if (!building) return state
  const seed = building.walls.find((item) => item.id === seedId)
  if (!seed || !isStudioWall(seed)) return state
  const out = facadeOutward(seed.yawDeg ?? 0, seed.panelFlip ?? true)
  const dx = out.x * distanceCm
  const dz = out.z * distanceCm
  const collinear = opts?.collinear !== false
  const expand = (ids: string[]) => (collinear ? expandCollinearPlanLinkedIds(building.walls, ids) : ids)
  const moveSet = new Set(expand(moveIds))
  if (!opts?.singleFloor) {
    for (const id of [...moveSet]) {
      const item = building.walls.find((w) => w.id === id)
      if (!item || !isStudioWall(item)) continue
      for (const upper of findVerticalAlignedWalls(item, building.walls, building.wallHeight)) {
        moveSet.add(upper.id)
        for (const linked of expand([upper.id])) {
          moveSet.add(linked)
        }
      }
    }
  }
  type Fix = { wallId: string; end: 'start' | 'end'; point: { x: number; z: number } }
  const fixes: Fix[] = []
  const returnWalls: Wall[] = []
  const returnKeys = new Set<string>()
  const outLen = Math.hypot(out.x, out.z) || 1
  for (const id of moveSet) {
    const wall = building.walls.find((item) => item.id === id)
    if (!wall || !isStudioWall(wall)) continue
    for (const end of ['start', 'end'] as const) {
      const pt = end === 'start' ? wallStartPoint(wall) : wallEndPoint(wall)
      const nextPt = { x: pt.x + dx, z: pt.z + dz }
      let neighbors = 0
      let bridged = 0
      for (const other of building.walls) {
        if (moveSet.has(other.id) || !isStudioWall(other)) continue
        if (Math.abs((other.y ?? 0) - (wall.y ?? 0)) > 1) continue
        const meetsStart = pointsMeet(wallStartPoint(other), pt)
        const meetsEnd = pointsMeet(wallEndPoint(other), pt)
        if (!meetsStart && !meetsEnd) continue
        neighbors += 1
        // Nachbar kann der Bewegung folgen, wenn seine Achse einen Anteil in Front-Richtung hat.
        const u = wallAlongDelta(other.yawDeg ?? 0, 1)
        const ulen = Math.hypot(u.x, u.z) || 1
        if (Math.abs((u.x * out.x + u.z * out.z) / (ulen * outLen)) > 0.2) bridged += 1
        if (meetsStart) fixes.push({ wallId: other.id, end: 'start', point: nextPt })
        if (meetsEnd) fixes.push({ wallId: other.id, end: 'end', point: nextPt })
      }
      if (!opts?.returnWalls || neighbors === 0 || bridged > 0) continue
      const key = `${Math.round(wall.y ?? 0)}|${Math.round(pt.x)},${Math.round(pt.z)}`
      if (returnKeys.has(key)) continue
      returnKeys.add(key)
      const returnWall = buildReturnWall(wall, pt, nextPt, end)
      if (returnWall) returnWalls.push(returnWall)
    }
  }
  let next = updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: [
      ...b.walls.map((wall) => {
        if (!moveSet.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
        return {
          ...cloneWall(wall),
          originX: (wall.originX ?? wall.x) + dx,
          originZ: (wall.originZ ?? 0) + dz,
          x: wall.x + dx,
        }
      }),
      ...returnWalls,
    ],
  }))
  const posed = new Map<string, Wall>()
  for (const fix of fixes) {
    const current =
      posed.get(fix.wallId) ?? next.buildings.find((b) => b.id === building.id)?.walls.find((w) => w.id === fix.wallId)
    if (!current) continue
    const updated = poseWallEndAt(current, fix.end, fix.point, { lockYaw: true })
    if (updated) posed.set(fix.wallId, updated)
  }
  if (posed.size > 0) {
    next = updateBuilding(next, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) => posed.get(wall.id) ?? cloneWall(wall)),
    }))
  }
  return next
}

export function updateStudioPanel(
  state: FacadeState,
  wallIds: string[],
  patch: Partial<StudioPanelConfig>,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    const panel = normalizeStudioPanel({ ...(wall.panel ?? DEFAULT_STUDIO_PANEL), ...patch })
    let next: Wall = { ...cloneWall(wall), panel }
    // Paneele aus → persistierte Zonen verwerfen (Fallback auf wall.panel).
    if (panel.enabled === false || panel.pattern === 'none') {
      next = { ...next, claddingZones: undefined }
      return next
    }
    // Zwei Horizontal-Bänder: Zone-Panels an Wand-Panel anbinden (unteres Modul = panelWidth).
    if (isTwoHorizontalBandCladding(next)) {
      const bands = readTwoHorizontalBandOptions(next)
      next = applyTwoHorizontalCladdingZones(next, {
        ...bands,
        lowerPanelWidth: panel.panelWidth,
      })
    }
    return next
  })
}

/** Persistierte Verkleidungszonen setzen oder löschen. */
export function updateWallCladdingZones(
  state: FacadeState,
  wallIds: string[],
  zones: CladdingZone[] | undefined,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    if (!zones || zones.length === 0) {
      return { ...cloneWall(wall), claddingZones: undefined }
    }
    return { ...cloneWall(wall), claddingZones: zones.map((z) => ({ ...z, rect: z.rect ? { ...z.rect } : undefined, panel: z.panel ? { ...z.panel } : undefined })) }
  })
}

/** Zwei Horizontal-Bänder an/aus bzw. Maße setzen. */
export function updateTwoHorizontalCladdingBands(
  state: FacadeState,
  wallIds: string[],
  options: TwoHorizontalBandOptions | null,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    const cloned = cloneWall(wall)
    if (!options) return clearPersistedCladdingZones(cloned)
    return applyTwoHorizontalCladdingZones(cloned, options)
  })
}

export interface WallTransform {
  position: { x: number; y: number; z: number }
  rotationY: number
}

/** Horizontaler Einheitsvektor „Bildschirm rechts“ (XZ), z. B. aus `camera`-Quaternion. */
export type ViewerHorizontal = { x: number; z: number }

/**
 * Nutzer „links/rechts“ → ± entlang der Wandachse (Start→Ende / layout +X).
 * +1 = Richtung Wandende, −1 = Richtung Wandstart — abhängig von Blickrichtung.
 */
export function viewerSideToAlongSign(
  wall: Wall,
  side: 'left' | 'right',
  viewerRightX: number,
  viewerRightZ: number,
): 1 | -1 {
  const along = wallAlongDelta(wall.yawDeg ?? 0, 1)
  const len = Math.hypot(along.x, along.z) || 1
  const dot = (along.x / len) * viewerRightX + (along.z / len) * viewerRightZ
  const plusAlongIsViewerRight = dot > 0
  if (side === 'right') return plusAlongIsViewerRight ? 1 : -1
  return plusAlongIsViewerRight ? -1 : 1
}

/** Versatz entlang der Wandkante (lokales +X nach Three.js rotation.y). */
export function wallAlongDelta(yawDeg: number, distance: number): { x: number; z: number } {
  const yawRad = (yawDeg * Math.PI) / 180
  return {
    x: distance * Math.cos(yawRad),
    z: -distance * Math.sin(yawRad),
  }
}

/** Lokale Z-Koordinate: 0 = Außenseite, positiv = nach innen. */
export function studioOutwardLocalZ(wall: Wall, insetFromOutward = 0): number {
  if (wall.panelFlip ?? true) return insetFromOutward
  return wall.depth - insetFromOutward
}

/**
 * Vorstand der Außenfläche in cm ab der Wandkante (Steintiefe + Trapez-Vorstand).
 * 0 wenn keine Paneele aktiv sind.
 */
export function studioFacadeOutwardDepth(wall: Wall): number {
  if (!wallHasPanels(wall)) return 0
  const panel = wall.panel ?? DEFAULT_STUDIO_PANEL
  const projectDepth = Math.max(0, panel.projectDepth ?? 0)
  const taperDepth = Math.max(0, panel.taperDepth ?? 0)
  return projectDepth + taperDepth
}

/**
 * Lokale Z-Koordinate der äußersten Fassadenfläche (Paneel + Trapez).
 * Anker für Fensterprofile, Gesims und weiteren Fassadenschmuck.
 */
export function studioFacadeOutwardLocalZ(wall: Wall): number {
  const outward = studioFacadeOutwardDepth(wall)
  if (wall.panelFlip ?? true) return -outward
  return wall.depth + outward
}

/**
 * Paneelfront ohne Bossen-Trapez (nur Steintiefe). Profile sitzen auf dieser Fläche,
 * Bosse stehen davor.
 */
export function studioPanelFaceLocalZ(wall: Wall): number {
  const project = wallHasPanels(wall)
    ? Math.max(0, (wall.panel ?? DEFAULT_STUDIO_PANEL).projectDepth ?? 0)
    : 0
  if (wall.panelFlip ?? true) return -project
  return wall.depth + project
}

/**
 * Sweep-Anker für Gesims/Fensterprofile: auf der äußeren Paneel-/Bossenfläche.
 * Negatives `offsetForward` (historisch −4) zieht nicht hinter diese Fläche.
 * Zusätzlich `PROFILE_FACE_BIAS_CM` nach vorn — sonst liegt die Profil-Rückseite
 * (forward = 0) koplanar auf den Paneelen und z-fightet (weiße Zacken im Mauerwerk).
 * 1,5 cm liegt klar über der Depth-Auflösung der Perspektivkamera.
 */
export const PROFILE_FACE_BIAS_CM = 1.5

/**
 * Mindest-Forward der Querschnitts-Fußplatte bei Öffnungsprofilen (cm).
 * Die SVG-Kante bei forward=0 wird angehoben — kein koplanares Blatt auf dem Stein.
 */
export const PROFILE_BACK_CLEARANCE_CM = 1.2

/** Laibung beginnt leicht hinter der Paneelfront — Steine besitzen die Lochkante. */
export const REVEAL_OUTER_INSET_CM = 0.6
/**
 * Mit Freiraum: nur Mini-Inset gegen Z-Fight mit der Freiraum-Front.
 * 0,6 cm ließ eine Lichtspalte zwischen Kappe und Laibung (helle Kante im Schatten).
 */
export const REVEAL_CLEARANCE_INSET_CM = 0.12

export function studioProfileAnchorLocalZ(wall: Wall, offsetForward = 0): number {
  const face = wallHasPanels(wall) ? studioPanelFaceLocalZ(wall) : studioWallOuterLocalZ(wall)
  const sign = studioWindowDepthForwardSign(wall)
  const extra = offsetForward * sign
  const clamped = sign >= 0 ? Math.max(face, face + extra) : Math.min(face, face + extra)
  return clamped + sign * PROFILE_FACE_BIAS_CM
}

/** Z-Koordinate knapp vor der Außenfläche (Auswahl-Overlay). */
export function studioFacadeSelectionLocalZ(wall: Wall, offsetCm = 2): number {
  const facadeZ = studioFacadeOutwardLocalZ(wall)
  if (wall.panelFlip ?? true) return facadeZ - offsetCm
  return facadeZ + offsetCm
}

/** Vorstand der Sockelfront über die Paneelfläche (cm), inkl. Überhang. */
export function studioPlinthFrontOffsetForward(wall: Wall, panel?: StudioPanelConfig): number {
  const p = panel ?? wall.panel ?? DEFAULT_STUDIO_PANEL
  if (!studioPlinthActive(p)) return 0
  return (p.plinthOffsetForward ?? 0) + (p.plinthDepth ?? 8) + PLINTH_OVERHANG
}

/**
 * Zusätzliche Profiltiefe (forward) — entfernt: Türprofile enden auf der Sockeloberkante.
 */
export function plinthProfileForwardBoost(_wall: Wall, _opening: Opening): number {
  return 0
}

/**
 * Äußeres Ende der 3D-Leibung (lokales Z): Paneelfront, und Profilebene
 * falls das Fenster-/Türprofil weiter außen sitzt.
 * WINDOW_RECESS (24 cm Fenstertiefe) bleibt unberührt — nur die Leibungswandung.
 * Mit Freiraum: bündig mit der Vertiefungskante (Vorstand vor der Wand, folgt „Tiefe“).
 */
export function studioOpeningRevealOuterZ(wall: Wall, opening?: Opening): number {
  const flip = wall.panelFlip ?? true
  const facadeZ = studioFacadeOutwardLocalZ(wall)
  const recessZ = opening ? studioClearanceRecessZ(wall, opening) : null
  const sign = studioWindowDepthForwardSign(wall)
  if (recessZ != null) {
    // Freiraum-Front besitzt die Kante; nur Mini-Inset (keine Lichtspalte).
    return recessZ - sign * REVEAL_CLEARANCE_INSET_CM
  }
  if (!opening) return facadeZ
  const hasOpeningProfile = wall.profiles.some((profile) => profile.openingId === opening.id)
  let outer = facadeZ
  if (hasOpeningProfile) {
    const offset = opening.trim?.offsetForward ?? WINDOW_TRIM_DEFAULT_OFFSET_FORWARD
    const profileZ = facadeZ + offset * sign
    outer = flip ? Math.min(facadeZ, profileZ) : Math.max(facadeZ, profileZ)
  }
  // Paneel besitzt die Frontkante; Laibung startet knapp dahinter (kein Z-Fight).
  if (wallHasPanels(wall)) {
    return outer - sign * REVEAL_OUTER_INSET_CM
  }
  return outer
}

/** Wandkörper-Außenkante (ohne Paneel-Vorstand). */
export function studioWallOuterLocalZ(wall: Wall): number {
  return wall.panelFlip ?? true ? 0 : wall.depth
}

/**
 * Sichtbare Außenhaut des Wandkörpers (leicht nach innen versetzt wenn Paneele an,
 * damit kein Z-Fight mit Mörtel/Stein — vgl. `createStudioWallGeometry`).
 */
export function studioWallOuterFaceLocalZ(wall: Wall): number {
  const outerZ = studioWallOuterLocalZ(wall)
  if (!wallHasPanels(wall)) return outerZ
  return outerZ - studioWindowDepthForwardSign(wall) * 0.15
}

/** Wandkörper-Innenseite. */
export function studioWallInnerLocalZ(wall: Wall): number {
  return wall.panelFlip ?? true ? wall.depth : 0
}

/**
 * Z der Freiraum-Front: Vorstand vor der Wandaußenkante (positiv) oder
 * Vertiefung in die Wand (negativ). Null wenn Freiraum aus.
 */
export function studioClearanceRecessZ(wall: Wall, opening: Opening): number | null {
  if (openingPanelClearance(opening) < 0.05) return null
  const panel = wall.panel ?? DEFAULT_STUDIO_PANEL
  const panelsOn = wallHasPanels(wall)
  const project = panelsOn ? Math.max(0, panel.projectDepth ?? 0) : 0
  const depth = openingPanelClearanceDepthCm(
    opening,
    panelsOn ? project : DEFAULT_PANEL_CLEARANCE_DEPTH_CM,
  )
  const face = studioPanelFaceLocalZ(wall)
  const outer = studioWallOuterLocalZ(wall)
  const inner = studioWallInnerLocalZ(wall)
  const sign = studioWindowDepthForwardSign(wall)
  const recess = outer + sign * depth
  const outwardLimit = panelsOn ? face : outer + sign * PANEL_CLEARANCE_DEPTH_MAX
  if (sign >= 0) return Math.max(inner, Math.min(outwardLimit, recess))
  return Math.min(inner, Math.max(outwardLimit, recess))
}

/** True wenn die Freiraum-Front hinter der Wandaußenkante liegt (Vertiefung). */
export function studioClearanceRecessInwardOfWall(wall: Wall, opening: Opening): boolean {
  const recessZ = studioClearanceRecessZ(wall, opening)
  if (recessZ == null) return false
  const outer = studioWallOuterLocalZ(wall)
  const sign = studioWindowDepthForwardSign(wall)
  return sign >= 0 ? recessZ < outer - 0.35 : recessZ > outer + 0.35
}

/** Innere Leibungskante: Wandinnenseite (panelFlip-abhängig, nicht immer `wall.depth`). */
export function studioOpeningRevealInnerZ(wall: Wall): number {
  return studioWallInnerLocalZ(wall)
}

/** Vorzeichen für Fenstertiefe: +depthOffset = zur Außenseite (−Z bei panelFlip, +Z sonst). */
export function studioWindowDepthForwardSign(wall: Wall): number {
  return wall.panelFlip ?? true ? -1 : 1
}

export function windowDepthForwardSign(wall: Wall): number {
  if (isStudioWall(wall)) return studioWindowDepthForwardSign(wall)
  return 1
}

/**
 * Flügel-Vorzeichen für `rotation.y = yaw+π`.
 * Positiver Winkel öffnet ins Gebäudeinnere (nicht nach außen / in die Leibung).
 */
export function leafOpenSignForWall(wall: Wall): number {
  if (!isStudioWall(wall)) return 1
  return wall.panelFlip ?? true ? 1 : -1
}

/**
 * Brett-Außenbank: Ursprung an der Wandaußenkante, Platte nach außen.
 * translateZ schiebt die Box-Geometrie, localZ ist der Mesh-Pivot (kein Schweben).
 */
export function outerSillBoardPose(wall: Wall, depth: number): {
  translateZ: number
  localZ: number
  /** `rotateX(angleRad * tiltX)` senkt die Tropfkante. */
  tiltX: number
} {
  const outward = isStudioWall(wall) ? windowDepthForwardSign(wall) : 1
  const outerWallZ = isStudioWall(wall)
    ? wallHasPanels(wall)
      ? studioFacadeOutwardLocalZ(wall)
      : studioWallOuterLocalZ(wall)
    : wall.depth
  return {
    translateZ: outward * (depth / 2),
    localZ: outerWallZ,
    tiltX: outward,
  }
}

/**
 * Pivot-Z des Fensters im Wand-Lokalraum.
 * Anker ist die Wandkörper-Außenkante (z=0 bei panelFlip, sonst z=depth), nicht die Paneelfront.
 * Nach rotation.y = yaw+π zeigt Mesh-+Z nach außen; die Front liegt bei originZ − boxMaxZ.
 * Die Front sitzt WINDOW_RECESS (24 cm) hinter der Außenkante, plus windowDepthOffset.
 */
export function studioWindowOriginZ(
  wall: Wall,
  boxMaxZ: number,
  depthOffset = 0,
): number {
  const flip = wall.panelFlip ?? false
  const outerZ = flip ? 0 : wall.depth
  const inward = flip ? 1 : -1
  const frontZ =
    outerZ +
    inward * WINDOW_RECESS +
    depthOffset * studioWindowDepthForwardSign(wall)
  return frontZ + boxMaxZ
}

/** Sehnen-/Planlänge für Positionierung (Bogen-Wand: Sehne, sonst `wall.width`). */
export function wallSpanAlongYaw(wall: Wall): number {
  if (wallHasArcBay(wall) && wall.arcBay?.frontWidthCm) return wall.arcBay.frontWidthCm
  return wall.width
}

/** Welt-Transform für Studio-Wände mit Yaw und Grundriss-Ursprung. */
export function studioWallTransform(wall: Wall): WallTransform {
  const yawDeg = wall.yawDeg ?? 0
  const originX = wall.originX ?? wall.x
  const originZ = wall.originZ ?? 0
  const centerAlong = wallSpanAlongYaw(wall) / 2
  const centerY = wall.y + wall.height / 2
  const along = wallAlongDelta(yawDeg, centerAlong)

  if (wall.yawDeg === undefined && wall.originX === undefined && wall.originZ === undefined) {
    return {
      position: { x: wall.x + wall.width / 2, y: centerY, z: 0 },
      rotationY: 0,
    }
  }

  return {
    position: {
      x: originX + along.x,
      y: centerY,
      z: originZ + along.z,
    },
    rotationY: (yawDeg * Math.PI) / 180,
  }
}

export function wallStartPoint(wall: Wall): { x: number; z: number } {
  return { x: wall.originX ?? wall.x, z: wall.originZ ?? 0 }
}

export function wallEndPoint(wall: Wall): { x: number; z: number } {
  const start = wallStartPoint(wall)
  const along = wallAlongDelta(wall.yawDeg ?? 0, wallSpanAlongYaw(wall))
  return { x: start.x + along.x, z: start.z + along.z }
}

/**
 * Ungegehrte Außenkante in Welt-XZ.
 * `panelFlip` true: Planlinie = Außenkante. false: Origin liegt innen, Außenkante um `depth` nach außen.
 */
export function studioWallOuterSpine(wall: Wall): {
  start: { x: number; z: number }
  end: { x: number; z: number }
  outward: { x: number; z: number }
} {
  const flip = wall.panelFlip ?? true
  const start = wallStartPoint(wall)
  const end = wallEndPoint(wall)
  const outward = facadeOutward(wall.yawDeg ?? 0, flip)
  if (flip) return { start, end, outward }
  const d = wall.depth
  return {
    start: { x: start.x + outward.x * d, z: start.z + outward.z * d },
    end: { x: end.x + outward.x * d, z: end.z + outward.z * d },
    outward,
  }
}

/** Wand um die Mitte drehen; Start/Ende wandern, Mittelpunkt bleibt. */
export function rotateStudioWallAroundCenter(wall: Wall, nextYawDeg: number): Wall {
  const yaw = wall.yawDeg ?? 0
  const normalized = normalizeYawDeg(nextYawDeg)
  if (Math.abs(normalized - yaw) < 1e-6) return wall
  const start = wallStartPoint(wall)
  const end = wallEndPoint(wall)
  const cx = (start.x + end.x) / 2
  const cz = (start.z + end.z) / 2
  const backAlong = wallAlongDelta(normalized, -wall.width / 2)
  const originX = cx + backAlong.x
  const originZ = cz + backAlong.z
  return {
    ...wall,
    yawDeg: normalized,
    originX,
    originZ,
    x: originX,
  }
}

/** True, wenn am Wandende kein Nachbar anknüpft. */
export function wallEndIsFree(wall: Wall, end: 'start' | 'end', walls: Wall[]): boolean {
  return !findAdjacentWall(wall, end, walls)
}

export const END_PIECE_ARM_LENGTH_CM = 48
export const END_PIECE_DEFAULT_ANGLE_DEG = 90
export type EndPieceHand = 'left' | 'right'

export interface WorldSegment {
  ax: number
  az: number
  bx: number
  bz: number
}

export function clampEndPieceAngle(angleDeg: number): number {
  const snapped = Math.round(angleDeg / 10) * 10
  return Math.max(40, Math.min(140, snapped))
}

/** Nach innen, senkrecht zur Fassadenaußenseite. */
export function inwardYawDeg(yawDeg: number, panelFlip: boolean): number {
  return normalizeYawDeg(yawDeg + (panelFlip ? -90 : 90))
}

/** Links/rechts von außen: bei panelFlip liegt links am Start. */
export function endPieceSideForHand(panelFlip: boolean, hand: EndPieceHand): 'start' | 'end' {
  const leftIsStart = panelFlip !== false
  if (hand === 'left') return leftIsStart ? 'start' : 'end'
  return leftIsStart ? 'end' : 'start'
}

export function endPieceReturnPanelFlip(frontFlip: boolean, hand: EndPieceHand): boolean {
  return hand === 'left' ? !frontFlip : frontFlip
}

export function copyStudioWallStyle(from: Wall, to: Wall): Wall {
  return {
    ...to,
    panelFlip: from.panelFlip ?? to.panelFlip,
    wallColor: from.wallColor,
    interiorColor: from.interiorColor,
    claddingColor: from.claddingColor,
    profileColor: from.profileColor,
    panel: from.panel ? { ...from.panel } : to.panel,
    cornice: from.cornice ? { ...from.cornice } : to.cornice,
    height: from.height,
    depth: from.depth,
  }
}

export function buildStudioWallAt(opts: {
  originX: number
  originZ: number
  y: number
  yawDeg: number
  width: number
  panelFlip: boolean
  styleFrom?: Wall
}): Wall {
  const wall = normalizeStudioWall({
    ...createStudioWall(opts.originX, opts.y),
    id: createId(),
    originX: opts.originX,
    originZ: opts.originZ,
    x: opts.originX,
    yawDeg: opts.yawDeg,
    width: opts.width,
    panelFlip: opts.panelFlip,
    ...(opts.styleFrom
      ? { height: opts.styleFrom.height, depth: opts.styleFrom.depth }
      : {}),
  })
  return opts.styleFrom ? copyStudioWallStyle(opts.styleFrom, wall) : wall
}

function styledArmBase(parent: Wall, origin: { x: number; z: number }, existing?: Wall): Wall {
  return existing
    ? normalizeStudioWall({ ...existing, width: END_PIECE_ARM_LENGTH_CM })
    : buildStudioWallAt({
        originX: origin.x,
        originZ: origin.z,
        y: parent.y,
        yawDeg: parent.yawDeg ?? 0,
        width: END_PIECE_ARM_LENGTH_CM,
        panelFlip: parent.panelFlip ?? true,
        styleFrom: parent,
      })
}

/** 48-cm-Rücksprung nach hinten an der linken oder rechten Außenseite. */
export function buildEndPieceReturnWall(
  parent: Wall,
  hand: EndPieceHand,
  angleDeg: number,
  existing?: Wall,
): Wall {
  const panelFlip = parent.panelFlip ?? true
  const side = endPieceSideForHand(panelFlip, hand)
  const pt = side === 'start' ? wallStartPoint(parent) : wallEndPoint(parent)
  const inward = inwardYawDeg(parent.yawDeg ?? 0, panelFlip)
  const yaw = normalizeYawDeg(inward + (clampEndPieceAngle(angleDeg) - 90))
  const base = styledArmBase(parent, pt, existing)
  return {
    ...base,
    originX: pt.x,
    originZ: pt.z,
    x: pt.x,
    y: parent.y,
    yawDeg: yaw,
    width: END_PIECE_ARM_LENGTH_CM,
    panelFlip: endPieceReturnPanelFlip(panelFlip, hand),
    endPieceParentId: parent.id,
    endPieceArmIndex: 0,
  }
}

/**
 * L-förmiges Endstück ohne Parent: Front 48 cm + Rücksprung 48 cm.
 * Außenseite: vorne und links bzw. vorne und rechts.
 */
export function buildStandaloneEndPieceWalls(opts: {
  originX: number
  originZ: number
  y: number
  yawDeg: number
  panelFlip: boolean
  hand: EndPieceHand
  angleDeg?: number
  styleFrom?: Wall
}): { front: Wall; ret: Wall } {
  const front = buildStudioWallAt({
    originX: opts.originX,
    originZ: opts.originZ,
    y: opts.y,
    yawDeg: opts.yawDeg,
    width: END_PIECE_ARM_LENGTH_CM,
    panelFlip: opts.panelFlip,
    styleFrom: opts.styleFrom,
  })
  const ret = buildEndPieceReturnWall(front, opts.hand, opts.angleDeg ?? END_PIECE_DEFAULT_ANGLE_DEG)
  const groupedFront: Wall = {
    ...front,
    endPiece: {
      side: endPieceSideForHand(opts.panelFlip, opts.hand),
      hand: opts.hand,
      angleDeg: clampEndPieceAngle(opts.angleDeg ?? END_PIECE_DEFAULT_ANGLE_DEG),
      armWallIds: [ret.id],
    },
  }
  return { front: groupedFront, ret: { ...ret, endPieceParentId: groupedFront.id } }
}

export function endPieceGhostSegments(
  originX: number,
  originZ: number,
  yawDeg: number,
  panelFlip: boolean,
  hand: EndPieceHand,
): WorldSegment[] {
  const along = wallAlongDelta(yawDeg, END_PIECE_ARM_LENGTH_CM)
  const frontEnd = { x: originX + along.x, z: originZ + along.z }
  const side = endPieceSideForHand(panelFlip, hand)
  const corner = side === 'start' ? { x: originX, z: originZ } : frontEnd
  const back = wallAlongDelta(inwardYawDeg(yawDeg, panelFlip), END_PIECE_ARM_LENGTH_CM)
  return [
    { ax: originX, az: originZ, bx: frontEnd.x, bz: frontEnd.z },
    { ax: corner.x, az: corner.z, bx: corner.x + back.x, bz: corner.z + back.z },
  ]
}

/** @deprecated Zwei-Schenkel-Variante für alte Saves; neue Platzierung nutzt einen Rücksprung. */
export function buildEndPieceArmWalls(
  parent: Wall,
  side: 'start' | 'end',
  angleDeg: number,
  existingArms?: [Wall | undefined, Wall | undefined],
): [Wall, Wall] {
  const hand: EndPieceHand =
    parent.endPiece?.hand ?? (endPieceSideForHand(parent.panelFlip ?? true, 'left') === side ? 'left' : 'right')
  const ret = buildEndPieceReturnWall(parent, hand, angleDeg, existingArms?.[0])
  const continuation = buildEndPieceReturnWall(parent, hand, 90, existingArms?.[1])
  const alongYaw = side === 'start' ? normalizeYawDeg((parent.yawDeg ?? 0) + 180) : parent.yawDeg ?? 0
  const pt = side === 'start' ? wallStartPoint(parent) : wallEndPoint(parent)
  const extra: Wall = {
    ...continuation,
    originX: pt.x,
    originZ: pt.z,
    x: pt.x,
    yawDeg: alongYaw,
    panelFlip: parent.panelFlip ?? true,
    endPieceArmIndex: 1,
  }
  return [ret, extra]
}

export function endPieceArmsCollide(
  walls: Wall[],
  parent: Wall,
  arms: Wall[],
  excludeIds?: Iterable<string>,
): boolean {
  const exclude = new Set(excludeIds ?? [])
  exclude.add(parent.id)
  for (const arm of arms) exclude.add(arm.id)
  for (const arm of arms) {
    if (studioWallsCollideIdentical(walls, arm, exclude)) return true
  }
  return false
}

const SEGMENT_OVERLAP_EPS = 2

function projectAlongAxis(
  px: number,
  pz: number,
  originX: number,
  originZ: number,
  ux: number,
  uz: number,
): number {
  return (px - originX) * ux + (pz - originZ) * uz
}

/**
 * True, wenn zwei Studio-Wände auf derselben Etage denselben oder stark überlappenden
 * Grundriss-Segment belegen (1:1-Überlagerung / kollinearer Overlap).
 */
export function studioWallsCollideIdentical(
  walls: Wall[],
  candidate: {
    id?: string
    originX?: number
    originZ?: number
    x?: number
    y: number
    yawDeg?: number
    width: number
  },
  excludeIds?: Iterable<string>,
): boolean {
  const exclude = new Set(excludeIds ?? [])
  if (candidate.id) exclude.add(candidate.id)
  const cStart = {
    x: candidate.originX ?? candidate.x ?? 0,
    z: candidate.originZ ?? 0,
  }
  const cYaw = candidate.yawDeg ?? 0
  const cAlong = wallAlongDelta(cYaw, candidate.width)
  const cLen = candidate.width
  if (cLen < 1e-6) return false
  const cUx = cAlong.x / cLen
  const cUz = cAlong.z / cLen
  const cT0 = 0
  const cT1 = cLen

  for (const wall of walls) {
    if (!isStudioWall(wall) || exclude.has(wall.id)) continue
    if (Math.abs(wall.y - candidate.y) > 1e-3) continue
    const wStart = wallStartPoint(wall)
    const wEnd = wallEndPoint(wall)
    const wYaw = wall.yawDeg ?? 0
    // Parallel (gleiche oder 180°-Achse)?
    const yawDiff = Math.abs(((wYaw - cYaw) % 180 + 180) % 180)
    if (yawDiff > 1 && yawDiff < 179) continue
    // Abstand vom Kandidaten-Ursprung zur Wand-Achse
    const lateral = (wStart.x - cStart.x) * -cUz + (wStart.z - cStart.z) * cUx
    if (Math.abs(lateral) > SEGMENT_OVERLAP_EPS) continue
    const tA = projectAlongAxis(wStart.x, wStart.z, cStart.x, cStart.z, cUx, cUz)
    const tB = projectAlongAxis(wEnd.x, wEnd.z, cStart.x, cStart.z, cUx, cUz)
    const wT0 = Math.min(tA, tB)
    const wT1 = Math.max(tA, tB)
    const overlap = Math.min(cT1, wT1) - Math.max(cT0, wT0)
    if (overlap > SEGMENT_OVERLAP_EPS) return true
  }
  return false
}

export function wallHasPanels(wall: Wall): boolean {
  const panel = wall.panel
  if (!panel) return false
  return panel.enabled !== false && panel.pattern !== 'none'
}

export function pointsMeet(
  a: { x: number; z: number },
  b: { x: number; z: number },
  eps = CORNER_EPS,
): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) <= eps
}

/** Join-Epsilon: größer, sobald mind. eine Wand diagonal ist. */
function joinEpsForWalls(a: Wall, b: Wall): number {
  return isDiagonalPlanYaw(a.yawDeg ?? 0) || isDiagonalPlanYaw(b.yawDeg ?? 0)
    ? DIAGONAL_JOIN_EPS
    : CORNER_EPS
}

/** Fehlt `planLinked`, gilt die Wand als verknüpft (Bestandsprojekte). */
export function isWallPlanLinked(wall: Wall): boolean {
  return wall.planLinked !== false
}

export function wallsShareEndpoint(a: Wall, b: Wall): boolean {
  const aStart = wallStartPoint(a)
  const aEnd = wallEndPoint(a)
  const bStart = wallStartPoint(b)
  const bEnd = wallEndPoint(b)
  const eps = joinEpsForWalls(a, b)
  return (
    pointsMeet(aStart, bStart, eps) ||
    pointsMeet(aStart, bEnd, eps) ||
    pointsMeet(aEnd, bStart, eps) ||
    pointsMeet(aEnd, bEnd, eps)
  )
}

function yawDeltaAbsDeg(a: number, b: number): number {
  const delta = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(delta, 360 - delta)
}

function wallsCollinearYaw(a: Wall, b: Wall): boolean {
  const diff = yawDeltaAbsDeg(a.yawDeg ?? 0, b.yawDeg ?? 0)
  return diff < 2 || Math.abs(diff - 180) < 2
}

/** Alle Nachbarwände am Start oder Ende derselben Etage (T-Stoß: mehrere). */
export function findAdjacentWalls(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
  opts?: { ignorePlanLink?: boolean },
): Wall[] {
  const pt = end === 'start' ? wallStartPoint(wall) : wallEndPoint(wall)
  const requireLink = !opts?.ignorePlanLink
  if (requireLink && isStudioWall(wall) && !isWallPlanLinked(wall)) return []
  const found: Wall[] = []
  for (const other of walls) {
    if (other.id === wall.id) continue
    if (requireLink && isStudioWall(other) && !isWallPlanLinked(other)) continue
    if (Math.abs((other.y ?? 0) - (wall.y ?? 0)) > 1) continue
    const eps = joinEpsForWalls(wall, other)
    if (pointsMeet(pt, wallStartPoint(other), eps) || pointsMeet(pt, wallEndPoint(other), eps)) {
      found.push(other)
    }
  }
  return found
}

/** Nachbarwand am Start oder Ende derselben Etage. */
export function findAdjacentWall(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
  opts?: { ignorePlanLink?: boolean },
): Wall | undefined {
  return findAdjacentWalls(wall, end, walls, opts)[0]
}

function turningAdjacentWalls(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
  opts?: { ignorePlanLink?: boolean },
): Wall[] {
  return findAdjacentWalls(wall, end, walls, opts).filter((adj) => !wallsCollinearYaw(wall, adj))
}

export { turningAdjacentWalls }

/** Andere Etagen: gleicher Ursprung und gleiche Yaw (Breite darf abweichen). */
export function findVerticalAlignedWalls(wall: Wall, walls: Wall[], wallHeight: number): Wall[] {
  const fi = floorIndex(wall, wallHeight)
  const ax = wall.originX ?? wall.x
  const az = wall.originZ ?? 0
  return walls.filter((other) => {
    if (other.id === wall.id || !isStudioWall(other)) return false
    if (floorIndex(other, wallHeight) === fi) return false
    if (Math.abs((other.originX ?? other.x) - ax) > 2) return false
    if (Math.abs((other.originZ ?? 0) - az) > 2) return false
    const yawDiff = yawDeltaAbsDeg(wall.yawDeg ?? 0, other.yawDeg ?? 0)
    if (yawDiff > 2 && Math.abs(yawDiff - 180) > 2) return false
    return true
  })
}

/** Kollinearer Dock-Nachbar — rein geometrisch, ohne planLinked-Voraussetzung. */
export function findCollinearDockWall(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
): Wall | undefined {
  return findAdjacentWalls(wall, end, walls, { ignorePlanLink: true }).find((adj) =>
    wallsCollinearYaw(wall, adj),
  )
}

/** Kollineare Wand-IDs ab der ersten Nachbarwand in Richtung `end` (ohne `wall` selbst). */
export function collinearChainFromEnd(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
  excludeIds?: Set<string>,
): string[] {
  const exclude = excludeIds ?? new Set<string>()
  const ids: string[] = []
  let current: Wall = wall
  let fromEnd: 'start' | 'end' = end

  while (true) {
    const neighbor = findCollinearDockWall(current, fromEnd, walls)
    if (!neighbor || exclude.has(neighbor.id) || ids.includes(neighbor.id)) break
    ids.push(neighbor.id)
    const joint = fromEnd === 'start' ? wallStartPoint(current) : wallEndPoint(current)
    const neighborAtStart = pointsMeet(
      joint,
      wallStartPoint(neighbor),
      joinEpsForWalls(current, neighbor),
    )
    current = neighbor
    fromEnd = neighborAtStart ? 'end' : 'start'
  }
  return ids
}

function wallUnitDir(wall: Wall): { dx: number; dz: number } {
  const delta = wallAlongDelta(wall.yawDeg ?? 0, 1)
  const len = Math.hypot(delta.x, delta.z) || 1
  return { dx: delta.x / len, dz: delta.z / len }
}

function miterInsetAgainstNeighbor(wall: Wall, end: 'start' | 'end', adj: Wall): number {
  const joint = end === 'start' ? wallStartPoint(wall) : wallEndPoint(wall)
  const along = wallUnitDir(wall)
  const incoming = end === 'start' ? { dx: -along.dx, dz: -along.dz } : along
  const adjAlong = wallUnitDir(adj)
  const outgoing = pointsMeet(wallStartPoint(adj), joint, joinEpsForWalls(wall, adj))
    ? adjAlong
    : { dx: -adjAlong.dx, dz: -adjAlong.dz }
  const depth = wall.depth ?? WALL_DEPTH
  const cross = incoming.dx * outgoing.dz - incoming.dz * outgoing.dx
  const dot = incoming.dx * outgoing.dx + incoming.dz * outgoing.dz
  const turn = Math.atan2(cross, dot)
  if (Math.abs(turn) < 1e-6) return 0
  if (Math.abs(Math.abs(turn) - Math.PI) < 0.05) return 0
  const inset = depth * Math.tan(turn / 2)
  const limit = depth * 4
  // Vorzeichen behalten: tan(Knick/2) steuert Kürzen vs. Verlängern an der Front
  // (90° außen kürzer, 45° stumpfe Außenecke länger — Bilderrahmen).
  return Math.max(-limit, Math.min(limit, inset))
}

/**
 * Gehrungsversatz am Wandende aus der Nachbar-Geometrie.
 * Unabhängig von der Ring-Laufrichtung im Grundriss — so bleiben 90°-Ecken
 * nach dem Verknüpfen zweier Bibliothek-Wände geschnitten.
 * Am T-Stoß zählt der knickende Nachbar, nicht das kollineare Gegenstück.
 */
export function miterAtWallEnd(wall: Wall, end: 'start' | 'end', walls: Wall[]): number {
  if (!isWallPlanLinked(wall)) return 0
  let best = 0
  let bestAbs = 0
  for (const adj of findAdjacentWalls(wall, end, walls)) {
    if (!isWallPlanLinked(adj)) continue
    const inset = miterInsetAgainstNeighbor(wall, end, adj)
    if (Math.abs(inset) > bestAbs) {
      bestAbs = Math.abs(inset)
      best = inset
    }
  }
  return best
}

function wallsMatchingFootprint(a: Wall, b: Wall): boolean {
  if (!isStudioWall(a) || !isStudioWall(b)) return false
  const ax = a.originX ?? a.x
  const az = a.originZ ?? 0
  const bx = b.originX ?? b.x
  const bz = b.originZ ?? 0
  if (Math.abs(ax - bx) > 2 || Math.abs(az - bz) > 2) return false
  const yawDiff = yawDeltaAbsDeg(a.yawDeg ?? 0, b.yawDeg ?? 0)
  if (yawDiff > 2 && Math.abs(yawDiff - 180) > 2) return false
  return Math.abs(a.width - b.width) <= 2
}

/** Wände auf anderen Etagen mit gleichem Fußabdruck (Origin, Yaw, Breite). */
export function findVerticalStackWalls(wall: Wall, walls: Wall[], wallHeight: number): Wall[] {
  const fi = floorIndex(wall, wallHeight)
  return walls.filter((other) => {
    if (other.id === wall.id || !isStudioWall(other)) return false
    if (floorIndex(other, wallHeight) === fi) return false
    return wallsMatchingFootprint(wall, other)
  })
}

/**
 * Erweitert die Seed-Wände um plan-verknüpfte Nachbarn und optional vertikale Stapel
 * (gleicher Fußabdriff auf allen Etagen). `singleFloor: true` = nur die aktuelle Etage.
 * `planLinked: false` = nur Seeds (+ Etagen), nicht den ganzen Grundriss-Ring.
 */
export function expandWallMoveIds(
  walls: Wall[],
  seedIds: string[],
  wallHeight: number,
  opts?: { singleFloor?: boolean; planLinked?: boolean },
): string[] {
  let ids = [...seedIds]
  if (!opts?.singleFloor) {
    const stacked = new Set(ids)
    for (const id of ids) {
      const wall = walls.find((item) => item.id === id)
      if (!wall || !isStudioWall(wall)) continue
      for (const other of findVerticalAlignedWalls(wall, walls, wallHeight)) {
        stacked.add(other.id)
      }
    }
    ids = [...stacked]
  }
  if (opts?.planLinked === false) return ids
  return expandPlanLinkedWallIds(walls, ids)
}

/** Alle plan-verknüpften Wände derselben zusammenhängenden Gruppe (für gemeinsames Verschieben). */
export function expandPlanLinkedWallIds(walls: Wall[], seedIds: string[]): string[] {
  const selected = new Set(seedIds)
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    const wall = walls.find((item) => item.id === id)
    if (!wall || !isStudioWall(wall) || !isWallPlanLinked(wall)) continue
    for (const end of ['start', 'end'] as const) {
      for (const adj of findAdjacentWalls(wall, end, walls)) {
        if (!selected.has(adj.id)) {
          selected.add(adj.id)
          queue.push(adj.id)
        }
      }
    }
  }
  return [...selected]
}

function outwardNormalFromPanelFlip(yawDeg: number, panelFlip: boolean): { x: number; z: number } {
  return facadeOutward(yawDeg, panelFlip)
}

/** panelFlip so wählen, dass die Außenfläche zur gewünschten Welt-Richtung zeigt. */
export function panelFlipForExteriorNormal(
  wallYawDeg: number,
  desiredOutward: { x: number; z: number },
): boolean {
  const len = Math.hypot(desiredOutward.x, desiredOutward.z) || 1
  const nx = desiredOutward.x / len
  const nz = desiredOutward.z / len
  const trueN = outwardNormalFromPanelFlip(wallYawDeg, true)
  const falseN = outwardNormalFromPanelFlip(wallYawDeg, false)
  const dotT = trueN.x * nx + trueN.z * nz
  const dotF = falseN.x * nx + falseN.z * nz
  return dotT >= dotF
}

function rotateOutward90(v: { x: number; z: number }, ccw: boolean): { x: number; z: number } {
  return ccw ? { x: -v.z, z: v.x } : { x: v.z, z: -v.x }
}

/** Senkrecht zur Nachbar-Außenseite an einer Ecke — zeigt nach links/rechts der Erkerfront. */
export function outwardPerpendicularAtCorner(
  neighbor: Wall,
  hand: 'left' | 'right',
): { x: number; z: number } {
  const nOut = facadeOutward(neighbor.yawDeg ?? 0, neighbor.panelFlip ?? true)
  return rotateOutward90(nOut, hand === 'left')
}

/**
 * Beim Andocken: kollinear Front bündig; an 90°-Ecken Außenseite der neuen Wand nach außen;
 * Winkel > 91° → Segment um 180° drehen.
 */
export function adjustDockOrientation(
  segmentYawDeg: number,
  panelFlip: boolean,
  neighbor: Wall | undefined,
  opts?: { facadeYaw?: number },
): { yawDeg: number; panelFlip: boolean } {
  if (!neighbor || !isStudioWall(neighbor)) {
    if (opts?.facadeYaw !== undefined) {
      const target = normalizeYawDeg(opts.facadeYaw)
      return {
        yawDeg: segmentYawDeg,
        panelFlip: panelFlipForExteriorNormal(segmentYawDeg, facadeOutward(target, true)),
      }
    }
    return { yawDeg: segmentYawDeg, panelFlip }
  }
  const neighborYaw = neighbor.yawDeg ?? 0
  let yawDeg = segmentYawDeg
  let flip = panelFlip
  let diff = ((yawDeg - neighborYaw + 540) % 360) - 180
  if (Math.abs(diff) > 91) {
    yawDeg = normalizeYawDeg(yawDeg + 180)
    diff = ((yawDeg - neighborYaw + 540) % 360) - 180
  }
  if (Math.abs(diff) > 30 && Math.abs(diff) < 150) {
    const nOut = facadeOutward(neighborYaw, neighbor.panelFlip ?? true)
    const delta = wallAlongDelta(yawDeg, 1)
    const segLen = Math.hypot(delta.x, delta.z) || 1
    const segDx = delta.x / segLen
    const segDz = delta.z / segLen
    const d = nOut.x * segDx + nOut.z * segDz
    const cand = { x: nOut.x - segDx * d, z: nOut.z - segDz * d }
    const len = Math.hypot(cand.x, cand.z)
    if (len > 1e-6) {
      flip = panelFlipForExteriorNormal(yawDeg, { x: cand.x / len, z: cand.z / len })
    }
  } else if (Math.abs(diff) <= 30) {
    // Kollinear (auch nach 180°-Korrektur): dieselbe Welt-Front wie der Nachbar.
    flip = panelFlipForExteriorNormal(
      yawDeg,
      facadeOutward(neighborYaw, neighbor.panelFlip ?? true),
    )
  }
  return { yawDeg, panelFlip: flip }
}

/**
 * Übernimmt die Blick-/Frontseite der Nachbarwand, ohne Yaw/Ursprung zu ändern.
 * Kollinear: gleiche Welt-Außennormale. An Ecken: Außenseite vom Nachbar weg.
 */
export function inheritWallFrontFromNeighbor(wall: Wall, neighbor: Wall): Wall {
  if (!isStudioWall(wall) || !isStudioWall(neighbor)) return wall
  const yaw = wall.yawDeg ?? 0
  const nYaw = neighbor.yawDeg ?? 0
  let desired = facadeOutward(nYaw, neighbor.panelFlip ?? true)
  const diff = ((yaw - nYaw + 540) % 360) - 180
  if (Math.abs(diff) > 30 && Math.abs(diff) < 150) {
    const delta = wallAlongDelta(yaw, 1)
    const segLen = Math.hypot(delta.x, delta.z) || 1
    const segDx = delta.x / segLen
    const segDz = delta.z / segLen
    const d = desired.x * segDx + desired.z * segDz
    const cand = { x: desired.x - segDx * d, z: desired.z - segDz * d }
    const len = Math.hypot(cand.x, cand.z)
    if (len > 1e-6) desired = { x: cand.x / len, z: cand.z / len }
  }
  const panelFlip = panelFlipForExteriorNormal(yaw, desired)
  if (panelFlip === (wall.panelFlip ?? true)) return wall
  return { ...wall, panelFlip }
}

/** Zielwände bekommen die Front der Quell-Nachbarn (Andocken / Verbinden). */
export function inheritFrontsFromNeighbors(
  state: FacadeState,
  targetIds: string[],
  sourceIds: string[],
): FacadeState {
  if (targetIds.length === 0 || sourceIds.length === 0) return state
  const sources = new Set(sourceIds)
  const targets = new Set(targetIds)
  const building = getActiveBuilding(state)
  let changed = false
  const walls = building.walls.map((wall) => {
    if (!targets.has(wall.id) || !isStudioWall(wall)) return wall
    let neighbor: Wall | undefined
    for (const end of ['start', 'end'] as const) {
      const adj =
        findAdjacentWall(wall, end, building.walls, { ignorePlanLink: true }) ??
        findCollinearDockWall(wall, end, building.walls)
      if (adj && sources.has(adj.id)) {
        neighbor = adj
        break
      }
    }
    if (!neighbor) {
      neighbor = building.walls.find((other) => sources.has(other.id) && isStudioWall(other))
    }
    if (!neighbor) return wall
    const aligned = inheritWallFrontFromNeighbor(wall, neighbor)
    if (aligned !== wall) changed = true
    return aligned
  })
  return changed ? updateActiveBuilding(state, { walls }) : state
}

function yawAligned(a: number, b: number, toleranceDeg = 2): boolean {
  const diff = Math.abs(((((a - b) % 360) + 540) % 360) - 180)
  return diff <= toleranceDeg
}

/**
 * Öffnungs-Elemente (Bänke) folgen der Wand-Front: flipForward spiegelt bei panelFlip.
 * Ohne expliziten Nutzer-Override werden die Defaults an die Außenseite angepasst.
 */
export function alignOpeningElementsToWallFront(wall: Wall): Wall {
  if (!isStudioWall(wall)) return wall
  const flip = wall.panelFlip ?? true
  let changed = false
  const openings = wall.openings.map((opening) => {
    if (opening.type !== 'window' && opening.type !== 'door') return opening
    let next = opening
    if (opening.sillInner?.enabled) {
      const desiredForward = !flip
      if (opening.sillInner.flipForward !== desiredForward) {
        next = {
          ...next,
          sillInner: { ...opening.sillInner, flipForward: desiredForward },
        }
        changed = true
      }
    }
    if (opening.sillOuter?.enabled) {
      const desiredForward = !flip
      if (opening.sillOuter.flipForward !== desiredForward) {
        next = {
          ...next,
          sillOuter: { ...opening.sillOuter, flipForward: desiredForward },
        }
        changed = true
      }
    }
    return next
  })
  return changed ? { ...wall, openings } : wall
}

/** Alle Wände einer Baugruppe mit gleicher Yaw-Ausrichtung teilen dieselbe panelFlip. */
export function unifyGroupFrontOrientation(state: FacadeState, seedWallId: string): FacadeState {
  const building = getActiveBuilding(state)
  const seed = building.walls.find((wall) => wall.id === seedWallId)
  if (!seed?.groupId || !isStudioWall(seed)) return state
  const groupId = seed.groupId
  const referenceFlip = seed.panelFlip ?? true
  const referenceYaw = seed.yawDeg ?? 0
  let changed = false
  const walls = building.walls.map((wall) => {
    if (wall.groupId !== groupId || !isStudioWall(wall)) return wall
    if (!yawAligned(wall.yawDeg ?? 0, referenceYaw)) return wall
    if ((wall.panelFlip ?? true) === referenceFlip) return wall
    changed = true
    return alignOpeningElementsToWallFront({ ...wall, panelFlip: referenceFlip })
  })
  return changed ? updateActiveBuilding(state, { walls }) : state
}

/** Nach Front-Änderung: Gruppe + Öffnungen an der Wand ausrichten. */
export function finalizeWallFrontOrientation(state: FacadeState, wallIds: string[]): FacadeState {
  let next = state
  for (const wallId of wallIds) {
    next = unifyGroupFrontOrientation(next, wallId)
    const wall = getWall(next, wallId)
    if (!wall || !isStudioWall(wall)) continue
    const aligned = alignOpeningElementsToWallFront(wall)
    if (aligned !== wall) {
      next = updateActiveBuilding(next, {
        walls: getActiveBuilding(next).walls.map((item) => (item.id === wallId ? aligned : item)),
      })
    }
  }
  return next
}

export function unselectedLinkedNeighbors(walls: Wall[], selectedIds: Iterable<string>): Wall[] {
  const selected = new Set(selectedIds)
  const found = new Map<string, Wall>()
  for (const wall of walls) {
    if (!selected.has(wall.id) || !isStudioWall(wall) || !isWallPlanLinked(wall)) continue
    for (const end of ['start', 'end'] as const) {
      for (const adj of findAdjacentWalls(wall, end, walls)) {
        if (!selected.has(adj.id)) found.set(adj.id, adj)
      }
    }
  }
  return [...found.values()]
}

/** Geometrisch berührende, nicht ausgewählte Wände — unabhängig von der Verknüpfung. */
export function unselectedTouchingWalls(walls: Wall[], selectedIds: Iterable<string>): Wall[] {
  const selected = new Set(selectedIds)
  const found = new Map<string, Wall>()
  for (const wall of walls) {
    if (!selected.has(wall.id) || !isStudioWall(wall)) continue
    for (const end of ['start', 'end'] as const) {
      for (const adj of findAdjacentWalls(wall, end, walls, { ignorePlanLink: true })) {
        if (!selected.has(adj.id)) found.set(adj.id, adj)
      }
    }
  }
  return [...found.values()]
}

export function selectionLockedToUnselected(walls: Wall[], selectedIds: Iterable<string>): boolean {
  return unselectedLinkedNeighbors(walls, selectedIds).length > 0
}

export function unlinkStudioWallsFromUnselected(state: FacadeState, selectedIds: string[]): FacadeState {
  const ids = new Set(selectedIds)
  const building = getActiveBuilding(state)
  const walls = building.walls.map((wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      planLinked: false,
      miterStart: 0,
      miterEnd: 0,
      groupId: undefined,
    }
  })
  const groups = (building.groups ?? [])
    .map((group) => ({
      ...group,
      memberWallIds: group.memberWallIds.filter((id) => !ids.has(id)),
    }))
    .filter((group) => group.memberWallIds.length > 0)
  return updateActiveBuilding(state, { walls, groups })
}

/**
 * Zwei kollinear angedockte Studio-Wände zu einer geometrischen Wand verschmelzen.
 * Nur bei gemeinsamem Endpunkt und gleicher Achse (nicht Gegenrichtung).
 */
export function mergeCollinearDockedWalls(
  state: FacadeState,
  keepId: string,
  absorbId: string,
): FacadeState | null {
  const building = findBuildingForWall(state, keepId)
  if (!building || findBuildingForWall(state, absorbId)?.id !== building.id) return null
  const keep = building.walls.find((wall) => wall.id === keepId)
  const absorb = building.walls.find((wall) => wall.id === absorbId)
  if (!keep || !absorb || !isStudioWall(keep) || !isStudioWall(absorb)) return null
  if (Math.abs((keep.y ?? 0) - (absorb.y ?? 0)) > 1) return null
  if (!wallsCollinearYaw(keep, absorb)) return null

  const kStart = wallStartPoint(keep)
  const kEnd = wallEndPoint(keep)
  const aStart = wallStartPoint(absorb)
  const aEnd = wallEndPoint(absorb)

  let originX = keep.originX ?? keep.x
  let originZ = keep.originZ ?? 0
  let width = keep.width
  let openings = [...keep.openings]

  if (pointsMeet(kEnd, aStart)) {
    width = keep.width + absorb.width
    openings = [...openings, ...absorb.openings.map((opening) => ({ ...opening, x: opening.x + keep.width }))]
  } else if (pointsMeet(kStart, aEnd)) {
    originX = absorb.originX ?? absorb.x
    originZ = absorb.originZ ?? 0
    width = keep.width + absorb.width
    openings = [
      ...absorb.openings,
      ...keep.openings.map((opening) => ({ ...opening, x: opening.x + absorb.width })),
    ]
  } else {
    return null
  }

  const merged: Wall = {
    ...cloneWall(keep),
    originX,
    originZ,
    x: originX,
    width,
    openings,
    planLinked: true,
  }

  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.filter((wall) => wall.id !== absorbId).map((wall) => (wall.id === keepId ? merged : cloneWall(wall))),
  }))
}

export function linkStudioWalls(state: FacadeState, wallIds: string[]): FacadeState {
  const ids = new Set(wallIds)
  const building = getActiveBuilding(state)
  return updateActiveBuilding(state, {
    walls: building.walls.map((wall) => {
      if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
      return { ...cloneWall(wall), planLinked: true }
    }),
  })
}

/**
 * Paneel-Gehrung: bei `miter` wie bisher (Ecke mit Paneelen oder gesetztem Miter).
 * Bei `none` nur stumpf an **freien** Enden — eine andockende Wand (auch ohne
 * eigenes Mauerwerk) bleibt geghert, sonst fehlt an 90°-Ecken die Wandstärke.
 * Gesetztes `miterStart`/`miterEnd` gilt auch ohne gefundenen Nachbarn (gleicher
 * Schnitt wie der Wandkörper).
 */
export function panelMiterEnds(wall: Wall, walls: Wall[]): { start: boolean; end: boolean } {
  const join = wall.panel?.cornerJoin ?? 'miter'
  if (join === 'bond') {
    return { start: false, end: false }
  }
  const startTurn = turningAdjacentWalls(wall, 'start', walls)
  const endTurn = turningAdjacentWalls(wall, 'end', walls)
  const storedStart = Math.abs(wall.miterStart ?? 0) > 0.05
  const storedEnd = Math.abs(wall.miterEnd ?? 0) > 0.05
  if (join === 'none') {
    return {
      start: startTurn.length > 0 || storedStart,
      end: endTurn.length > 0 || storedEnd,
    }
  }
  return {
    start: Boolean(
      storedStart ||
        (startTurn.length > 0 &&
          (startTurn.some(wallHasPanels) || storedStart)),
    ),
    end: Boolean(
      storedEnd ||
        (endTurn.length > 0 && (endTurn.some(wallHasPanels) || storedEnd)),
    ),
  }
}

/**
 * Sockel wie Paneele: `none` nur an freien Enden stumpf, anknüpfender Sockel bleibt geghert.
 */
export function plinthMiterEnds(wall: Wall, walls: Wall[]): { start: boolean; end: boolean } {
  const join = wall.panel?.cornerJoin ?? 'miter'
  const startTurn = turningAdjacentWalls(wall, 'start', walls)
  const endTurn = turningAdjacentWalls(wall, 'end', walls)
  const neighborPlinth = (item: Wall) => Boolean(item.panel && studioPlinthActive(item.panel))
  const storedStart = Math.abs(wall.miterStart ?? 0) > 0.05
  const storedEnd = Math.abs(wall.miterEnd ?? 0) > 0.05
  if (join === 'none') {
    return {
      start: startTurn.some(neighborPlinth) || storedStart,
      end: endTurn.some(neighborPlinth) || storedEnd,
    }
  }
  return {
    start: Boolean(
      startTurn.length > 0 &&
        (startTurn.some(neighborPlinth) || Math.abs(wall.miterStart ?? 0) > 0.05),
    ),
    end: Boolean(
      endTurn.length > 0 &&
        (endTurn.some(neighborPlinth) || Math.abs(wall.miterEnd ?? 0) > 0.05),
    ),
  }
}

/** Gesims-Gehrung analog: `none` nur ohne anknüpfendes Gesims. */
export function corniceMiterEnds(wall: Wall, walls: Wall[]): { start: boolean; end: boolean } {
  const join = wall.panel?.cornerJoin ?? 'miter'
  const startTurn = turningAdjacentWalls(wall, 'start', walls)
  const endTurn = turningAdjacentWalls(wall, 'end', walls)
  if (join === 'none') {
    return {
      start: startTurn.some((item) => wallHasCornice(item)),
      end: endTurn.some((item) => wallHasCornice(item)),
    }
  }
  return {
    start: startTurn.length > 0,
    end: endTurn.length > 0,
  }
}
