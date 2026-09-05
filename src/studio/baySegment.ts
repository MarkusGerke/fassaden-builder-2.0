/**
 * Erker als Wandsegment einsetzen und entlang der Fassade verschieben.
 * Doku: docs/bay-windows.md
 */
import type { FacadeState, Wall } from '../types/facade'
import { createId } from '../utils/id'
import { findBuildingForWall, updateBuilding } from '../utils/buildings'
import { STUDIO_WALL_WIDTH_STEP } from './constants'
import {
  bayMouthWidthCm,
  bayPresetKind,
  bayWallSelectionIds,
  buildBayWindowAtPose,
  type BayWindowPreset,
} from './bayWindow'
import { syncFloorPlansFromWalls } from './floorPlan'
import { finalizeStudioGeometry } from './planGeometry'
import {
  createStudioWall,
  findAdjacentWall,
  findCollinearDockWall,
  isStudioWall,
  linkStudioWalls,
  mergeCollinearDockedWalls,
  normalizeStudioWall,
  stretchSingleStudioWall,
  wallAlongDelta,
  wallEndPoint,
  wallStartPoint,
} from './walls'
import { splitWallStackRange, wallSplitRangeAt, type WallSplitRange } from './wallSplit'

const EPS = 0.5

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    openings: wall.openings.map((o) => ({ ...o })),
    panel: wall.panel ? { ...wall.panel } : wall.panel,
    cornice: wall.cornice ? { ...wall.cornice } : wall.cornice,
  }
}

function translateWallXZ(wall: Wall, dx: number, dz: number): Wall {
  const ox = (wall.originX ?? wall.x) + dx
  const oz = (wall.originZ ?? 0) + dz
  return normalizeStudioWall(
    {
      ...cloneWall(wall),
      originX: ox,
      originZ: oz,
      x: ox,
    },
    { keepOpenings: true },
  )
}

function distPoint(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Welches Ende von `wall` liegt näher an `point`? */
function nearerEnd(wall: Wall, point: { x: number; z: number }): 'start' | 'end' {
  const ds = distPoint(wallStartPoint(wall), point)
  const de = distPoint(wallEndPoint(wall), point)
  return ds <= de ? 'start' : 'end'
}

/** Host-Wand einer Erker-Gruppe (trägt `bayWindow`). */
export function bayHostWall(walls: Wall[], seedId: string): Wall | null {
  const seed = walls.find((w) => w.id === seedId)
  if (!seed) return null
  if (seed.bayWindow?.wallIds?.length) return seed
  if (seed.bayParentId) {
    const parent = walls.find((w) => w.id === seed.bayParentId)
    if (parent?.bayWindow?.wallIds?.length) return parent
  }
  return null
}

export function bayMemberIds(walls: Wall[], seedId: string): string[] | null {
  return bayWallSelectionIds(walls, seedId)
}

/**
 * Ersetzt eine Wand durch den Erker in Preset-Größe.
 * Liegt die Wandbreite nahe der Mundöffnung, bleibt das Preset unverändert.
 * Sonst wird die Front an die Wandbreite angepasst (Notfall für Passungen).
 */
export function replaceWallWithBayPreset(
  state: FacadeState,
  wallId: string,
  preset: BayWindowPreset,
): { state: FacadeState; bayWallIds: string[] } | null {
  const building = findBuildingForWall(state, wallId)
  const wall = building?.walls.find((w) => w.id === wallId)
  if (!building || !wall || !isStudioWall(wall)) return null
  const mouth = bayMouthWidthCm(preset)
  if (wall.width + EPS < mouth) return null

  const builtPreset =
    Math.abs(wall.width - mouth) <= EPS
      ? preset
      : preset.shape === 'angled45'
        ? {
            ...preset,
            frontWidthCm: Math.max(8, Math.round((wall.width - 2 * preset.depthCm) / 8) * 8),
          }
        : { ...preset, frontWidthCm: Math.round(wall.width / 8) * 8 }

  const walls = buildBayWindowAtPose(
    {
      originX: wall.originX ?? wall.x,
      originZ: wall.originZ ?? 0,
      y: wall.y,
      yawDeg: wall.yawDeg ?? 0,
      panelFlip: wall.panelFlip ?? true,
      height: wall.height,
    },
    builtPreset,
    wall,
  )
  if (walls.length === 0) return null

  const groupId = createId()
  const grouped = walls.map((item) => ({ ...item, groupId }))
  const others = building.walls.filter((item) => item.id !== wall.id)
  const groups = [
    ...(building.groups ?? []).filter((group) => group.id !== wall.groupId),
    { id: groupId, name: builtPreset.label, memberWallIds: grouped.map((item) => item.id) },
  ]
  let next = updateBuilding(state, building.id, {
    walls: others.concat(grouped),
    groups,
  })
  const linkIds = grouped.map((item) => item.id)
  for (const other of others) {
    if (!isStudioWall(other)) continue
    if (Math.abs((other.y ?? 0) - (wall.y ?? 0)) > EPS) continue
    linkIds.push(other.id)
  }
  next = linkStudioWalls(next, linkIds)
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  return { state: next, bayWallIds: grouped.map((item) => item.id) }
}

/**
 * Erker in Preset-Mundbreite an `localX` als Segment einsetzen:
 * Wand → links | Erker | rechts (über Etagen-Stapel).
 */
export function insertBayAsWallSegment(
  state: FacadeState,
  wallId: string,
  preset: BayWindowPreset,
  localX: number,
): { state: FacadeState; bayWallIds: string[]; range: WallSplitRange } | null {
  const building = findBuildingForWall(state, wallId)
  const wall = building?.walls.find((w) => w.id === wallId)
  if (!building || !wall || !isStudioWall(wall)) return null
  const mouth = bayMouthWidthCm(preset)
  if (mouth > wall.width + EPS) return null

  if (mouth >= wall.width - EPS) {
    const replaced = replaceWallWithBayPreset(state, wallId, preset)
    if (!replaced) return null
    return {
      state: replaced.state,
      bayWallIds: replaced.bayWallIds,
      range: { startCm: 0, endCm: wall.width },
    }
  }

  const range = wallSplitRangeAt(wall, localX, mouth)
  if (!range) return null
  const split = splitWallStackRange(state, wallId, range)
  if (!split) return null

  let next = split.state
  const allBayIds: string[] = []
  for (const midId of split.middleIds) {
    const replaced = replaceWallWithBayPreset(next, midId, preset)
    if (!replaced) return null
    next = replaced.state
    allBayIds.push(...replaced.bayWallIds)
  }
  return { state: next, bayWallIds: allBayIds, range }
}

/** Preset so skalieren, dass die Mundöffnung die gesamte Wandbreite füllt. */
export function bayPresetFittedToWallWidth(
  preset: BayWindowPreset,
  wallWidthCm: number,
): BayWindowPreset | null {
  if (!Number.isFinite(wallWidthCm) || wallWidthCm < 8 - EPS) return null
  const mouth = Math.max(8, Math.round(wallWidthCm / 8) * 8)
  if (preset.shape === 'angled45') {
    const front = mouth - 2 * preset.depthCm
    if (front < 8 - EPS) return null
    return { ...preset, frontWidthCm: Math.round(front / 8) * 8 }
  }
  return { ...preset, frontWidthCm: mouth }
}

interface BaySlideContext {
  memberIds: string[]
  leftRemnantId: string
  leftStretchEnd: 'start' | 'end'
  rightRemnantId: string
  rightStretchEnd: 'start' | 'end'
  facadeYaw: number
  /** Punkt am linken Mund (zum Bestimmen der Richtung). */
  leftAttach: { x: number; z: number }
}

function resolveBaySlideContext(walls: Wall[], seedId: string): BaySlideContext | null {
  const host = bayHostWall(walls, seedId)
  if (!host?.bayWindow?.wallIds?.length) return null
  const memberIds = bayWallSelectionIds(walls, host.id) ?? [host.id, ...host.bayWindow.wallIds]
  const memberSet = new Set(memberIds)
  const orderedSides = host.bayWindow.wallIds
    .map((id) => walls.find((w) => w.id === id))
    .filter((w): w is Wall => Boolean(w && w.bayRole === 'side'))
  if (orderedSides.length < 2) return null
  const leftSide = orderedSides[0]!
  const rightSide = orderedSides[orderedSides.length - 1]!
  const leftAttach = wallStartPoint(leftSide)
  const rightAttach = wallEndPoint(rightSide)

  const leftRemRaw =
    findAdjacentWall(leftSide, 'start', walls, { ignorePlanLink: true }) ??
    findCollinearDockWall(leftSide, 'start', walls)
  const rightRemRaw =
    findAdjacentWall(rightSide, 'end', walls, { ignorePlanLink: true }) ??
    findCollinearDockWall(rightSide, 'end', walls)
  if (!leftRemRaw || !rightRemRaw) return null
  if (memberSet.has(leftRemRaw.id) || memberSet.has(rightRemRaw.id)) return null
  if (!isStudioWall(leftRemRaw) || !isStudioWall(rightRemRaw)) return null

  const leftStretchEnd = nearerEnd(leftRemRaw, leftAttach)
  const rightStretchEnd = nearerEnd(rightRemRaw, rightAttach)
  return {
    memberIds,
    leftRemnantId: leftRemRaw.id,
    leftStretchEnd,
    rightRemnantId: rightRemRaw.id,
    rightStretchEnd,
    facadeYaw: leftRemRaw.yawDeg ?? 0,
    leftAttach,
  }
}

/**
 * Verschiebt den Erker entlang der Fassade: Mundbreite bleibt,
 * linkes Reststück und rechtes Reststück tauschen Länge.
 * Braucht Reststücke links und rechts (nicht am Wandende).
 */
export function slideBaySegmentAlong(
  state: FacadeState,
  seedWallId: string,
  deltaAlongCm: number,
): FacadeState | null {
  if (Math.abs(deltaAlongCm) < 0.25) return state
  const building = findBuildingForWall(state, seedWallId)
  if (!building) return null
  const ctx = resolveBaySlideContext(building.walls, seedWallId)
  if (!ctx) return null

  const left = building.walls.find((w) => w.id === ctx.leftRemnantId)
  const right = building.walls.find((w) => w.id === ctx.rightRemnantId)
  if (!left || !right || !isStudioWall(left) || !isStudioWall(right)) return null

  const step = STUDIO_WALL_WIDTH_STEP
  let delta = Math.round(deltaAlongCm / step) * step
  if (delta === 0) return state

  const stretchAmountForDockMove = (
    remnant: Wall,
    dockEnd: 'start' | 'end',
    worldAlong: number,
  ): number => {
    const rem = wallAlongDelta(remnant.yawDeg ?? 0, 1)
    const fac = wallAlongDelta(ctx.facadeYaw, 1)
    const align = rem.x * fac.x + rem.z * fac.z
    // end +amt → Endpunkt += rem*amt; start +amt → Startpunkt += -rem*amt
    return dockEnd === 'end' ? worldAlong * align : -worldAlong * align
  }

  // Delta so begrenzen, dass beide Reste ≥ Rasterschritt bleiben.
  for (let guard = 0; guard < 8; guard += 1) {
    const leftAmt = stretchAmountForDockMove(left, ctx.leftStretchEnd, delta)
    const rightAmt = stretchAmountForDockMove(right, ctx.rightStretchEnd, delta)
    const leftOk = left.width + leftAmt >= step - EPS
    const rightOk = right.width + rightAmt >= step - EPS
    if (leftOk && rightOk) break
    const maxLeft = leftOk ? Math.abs(delta) : Math.max(0, left.width - step)
    const maxRight = rightOk ? Math.abs(delta) : Math.max(0, right.width - step)
    const maxAbs = Math.min(maxLeft, maxRight, Math.abs(delta))
    const next = Math.round((Math.sign(delta) * maxAbs) / step) * step
    if (next === delta || next === 0) {
      delta = next
      break
    }
    delta = next
  }
  if (delta === 0) return state

  const leftAmt = stretchAmountForDockMove(left, ctx.leftStretchEnd, delta)
  const rightAmt = stretchAmountForDockMove(right, ctx.rightStretchEnd, delta)
  if (left.width + leftAmt < step - EPS || right.width + rightAmt < step - EPS) return state

  const along = wallAlongDelta(ctx.facadeYaw, delta)
  const memberSet = new Set(ctx.memberIds)
  const nextWalls = building.walls.map((wall) => {
    if (memberSet.has(wall.id)) return translateWallXZ(wall, along.x, along.z)
    if (wall.id === left.id) return stretchSingleStudioWall(wall, ctx.leftStretchEnd, leftAmt)
    if (wall.id === right.id) return stretchSingleStudioWall(wall, ctx.rightStretchEnd, rightAmt)
    return cloneWall(wall)
  })

  let next = updateBuilding(state, building.id, { walls: nextWalls })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  return next
}

/** Ob die Auswahl eine eingebettete Erker-Gruppe mit Reststücken links/rechts ist. */
export function canSlideBaySegment(walls: Wall[], seedWallId: string): boolean {
  return resolveBaySlideContext(walls, seedWallId) != null
}

/** Projektion eines Welt-Deltas auf die Fassaden-Richtung des Erkers. */
export function baySlideDeltaFromWorldMove(
  walls: Wall[],
  seedWallId: string,
  dx: number,
  dz: number,
): number | null {
  const ctx = resolveBaySlideContext(walls, seedWallId)
  if (!ctx) return null
  const unit = wallAlongDelta(ctx.facadeYaw, 1)
  return dx * unit.x + dz * unit.z
}

function yawFromPoints(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const deg = (Math.atan2(-(b.z - a.z), b.x - a.x) * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

function bayMouthAnchors(
  walls: Wall[],
  host: Wall,
): {
  leftAttach: { x: number; z: number }
  rightAttach: { x: number; z: number }
  facadeYaw: number
  styleFrom: Wall
  memberIds: string[]
} | null {
  const memberIds = bayWallSelectionIds(walls, host.id)
  if (!memberIds?.length || !host.bayWindow?.wallIds?.length) return null
  const memberSet = new Set(memberIds)
  const orderedSides = host.bayWindow.wallIds
    .map((id) => walls.find((w) => w.id === id))
    .filter((w): w is Wall => Boolean(w && w.bayRole === 'side'))
  if (orderedSides.length < 2) return null
  const leftAttach = wallStartPoint(orderedSides[0]!)
  const rightAttach = wallEndPoint(orderedSides[orderedSides.length - 1]!)
  const front =
    walls.find((w) => memberSet.has(w.id) && w.bayRole === 'front') ??
    walls.find((w) => memberSet.has(w.id) && w.bayRole === 'arc') ??
    host
  return {
    leftAttach,
    rightAttach,
    facadeYaw: yawFromPoints(leftAttach, rightAttach),
    styleFrom: front,
    memberIds,
  }
}

/**
 * Erker entfernen und durch eine flache Wand über die Mundöffnung ersetzen.
 * Angrenzende kollineare Reststücke werden verschmolzen.
 */
export function flattenBayToFlatWall(
  state: FacadeState,
  seedWallId: string,
): { state: FacadeState; flatWallId: string } | null {
  const building = findBuildingForWall(state, seedWallId)
  if (!building) return null
  const host = bayHostWall(building.walls, seedWallId)
  if (!host) return null
  const anchors = bayMouthAnchors(building.walls, host)
  if (!anchors) return null

  const { leftAttach, rightAttach, facadeYaw, styleFrom, memberIds } = anchors
  const memberSet = new Set(memberIds)
  const width = Math.hypot(rightAttach.x - leftAttach.x, rightAttach.z - leftAttach.z)
  if (width < EPS) return null

  const flatId = createId()
  const flat = normalizeStudioWall(
    {
      ...createStudioWall(leftAttach.x, styleFrom.y),
      id: flatId,
      originX: leftAttach.x,
      originZ: leftAttach.z,
      x: leftAttach.x,
      yawDeg: facadeYaw,
      panelFlip: styleFrom.panelFlip ?? true,
      width,
      height: styleFrom.height,
      depth: styleFrom.depth,
      wallColor: styleFrom.wallColor,
      interiorColor: styleFrom.interiorColor,
      claddingColor: styleFrom.claddingColor,
      profileColor: styleFrom.profileColor,
      panel: styleFrom.panel ? { ...styleFrom.panel } : undefined,
      cornice: styleFrom.cornice ? { ...styleFrom.cornice } : undefined,
      planLinked: true,
      openings: [],
    },
    { keepOpenings: true },
  )

  const groups = (building.groups ?? [])
    .map((group) => ({
      ...group,
      memberWallIds: group.memberWallIds.filter((id) => !memberSet.has(id)),
    }))
    .filter((group) => group.memberWallIds.length > 0)

  let nextWalls = building.walls.filter((w) => !memberSet.has(w.id))
  nextWalls.push(flat)

  let next = updateBuilding(state, building.id, { walls: nextWalls, groups })
  const linkIds = nextWalls.filter((w) => isStudioWall(w)).map((w) => w.id)
  next = linkStudioWalls(next, linkIds)

  const afterFlat = findBuildingForWall(next, flatId)?.walls ?? []
  const flatLive = afterFlat.find((w) => w.id === flatId)
  if (!flatLive) return null
  const leftRem =
    findAdjacentWall(flatLive, 'start', afterFlat, { ignorePlanLink: true }) ??
    findCollinearDockWall(flatLive, 'start', afterFlat)
  const rightRem =
    findAdjacentWall(flatLive, 'end', afterFlat, { ignorePlanLink: true }) ??
    findCollinearDockWall(flatLive, 'end', afterFlat)

  let keepId = flatId
  if (leftRem && isStudioWall(leftRem)) {
    const merged = mergeCollinearDockedWalls(next, keepId, leftRem.id)
    if (merged) next = merged
  }
  const wallsAfterLeft = findBuildingForWall(next, keepId)?.walls ?? []
  if (rightRem && isStudioWall(rightRem) && wallsAfterLeft.some((w) => w.id === rightRem.id)) {
    const merged = mergeCollinearDockedWalls(next, keepId, rightRem.id)
    if (merged) next = merged
  }

  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  const surviving = findBuildingForWall(next, keepId)?.walls.find((w) => w.id === keepId)
  if (!surviving) return null
  return { state: next, flatWallId: surviving.id }
}

/**
 * Vorhandenen Erker durch ein anderes Preset ersetzen (Mundzentrum bleibt).
 * Reststücke links/rechts werden bei anderer Mundbreite angepasst.
 */
export function swapBayPreset(
  state: FacadeState,
  seedWallId: string,
  preset: BayWindowPreset,
): { state: FacadeState; bayWallIds: string[] } | null {
  if (bayPresetKind(preset) !== 'bay') return null
  const building = findBuildingForWall(state, seedWallId)
  if (!building) return null
  const host = bayHostWall(building.walls, seedWallId)
  if (!host) return null
  const anchors = bayMouthAnchors(building.walls, host)
  if (!anchors) return null

  const { leftAttach, rightAttach, facadeYaw, styleFrom, memberIds } = anchors
  const memberSet = new Set(memberIds)
  const mouthOld = Math.hypot(rightAttach.x - leftAttach.x, rightAttach.z - leftAttach.z)
  const mouthNew = bayMouthWidthCm(preset)
  const along = wallAlongDelta(facadeYaw, 1)
  const mid = {
    x: (leftAttach.x + rightAttach.x) / 2,
    z: (leftAttach.z + rightAttach.z) / 2,
  }
  const newLeft = {
    x: mid.x - along.x * (mouthNew / 2),
    z: mid.z - along.z * (mouthNew / 2),
  }
  const newRight = {
    x: mid.x + along.x * (mouthNew / 2),
    z: mid.z + along.z * (mouthNew / 2),
  }

  const ctx = resolveBaySlideContext(building.walls, seedWallId)
  let nextWalls = building.walls.filter((w) => !memberSet.has(w.id)).map(cloneWall)

  if (ctx && Math.abs(mouthNew - mouthOld) > EPS) {
    const left = nextWalls.find((w) => w.id === ctx.leftRemnantId)
    const right = nextWalls.find((w) => w.id === ctx.rightRemnantId)
    if (!left || !right) return null
    const leftDockMove =
      (newLeft.x - leftAttach.x) * along.x + (newLeft.z - leftAttach.z) * along.z
    const rightDockMove =
      (newRight.x - rightAttach.x) * along.x + (newRight.z - rightAttach.z) * along.z
    const remAlong = wallAlongDelta(ctx.facadeYaw, 1)
    const align = remAlong.x * along.x + remAlong.z * along.z
    const leftAmt =
      ctx.leftStretchEnd === 'end' ? leftDockMove * align : -leftDockMove * align
    const rightAmt =
      ctx.rightStretchEnd === 'end' ? rightDockMove * align : -rightDockMove * align
    const step = STUDIO_WALL_WIDTH_STEP
    if (left.width + leftAmt < step - EPS || right.width + rightAmt < step - EPS) return null
    nextWalls = nextWalls.map((w) => {
      if (w.id === left.id) return stretchSingleStudioWall(w, ctx.leftStretchEnd, leftAmt)
      if (w.id === right.id) return stretchSingleStudioWall(w, ctx.rightStretchEnd, rightAmt)
      return w
    })
  }

  const built = buildBayWindowAtPose(
    {
      originX: newLeft.x,
      originZ: newLeft.z,
      y: styleFrom.y,
      yawDeg: facadeYaw,
      panelFlip: styleFrom.panelFlip ?? true,
      height: styleFrom.height,
    },
    preset,
    styleFrom,
  )
  if (built.length === 0) return null

  const groupId = createId()
  const grouped = built.map((item) => ({ ...item, groupId }))
  const groups = [
    ...(building.groups ?? [])
      .map((group) => ({
        ...group,
        memberWallIds: group.memberWallIds.filter((id) => !memberSet.has(id)),
      }))
      .filter((group) => group.memberWallIds.length > 0),
    { id: groupId, name: preset.label, memberWallIds: grouped.map((item) => item.id) },
  ]

  nextWalls = nextWalls.concat(grouped)
  let next = updateBuilding(state, building.id, { walls: nextWalls, groups })
  const linkIds = nextWalls.filter((w) => isStudioWall(w)).map((w) => w.id)
  next = linkStudioWalls(next, linkIds)
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  return { state: next, bayWallIds: grouped.map((item) => item.id) }
}
