/**
 * Erker als Wandsegment einsetzen und entlang der Fassade verschieben.
 * Doku: docs/bay-windows.md
 */
import type { FacadeState, Opening, Wall } from '../types/facade'
import { createId } from '../utils/id'
import { findBuildingForWall, updateBuilding } from '../utils/buildings'
import { BAY_SLIDE_STEP_CM, STUDIO_WALL_WIDTH_STEP } from './constants'
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
 * Aktuell gespeicherte Verlängerung nach unten (cm) für die Erker-Gruppe des Seeds.
 */
export function bayDropCm(walls: Wall[], seedId: string): number {
  const host = bayHostWall(walls, seedId)
  const drop = host?.bayWindow?.dropCm
  return typeof drop === 'number' && Number.isFinite(drop) ? Math.max(0, drop) : 0
}

/**
 * Freiraum unter dem Erker-Fuß bis zur nächsten Wandoberkante darunter (cm).
 * `Infinity`, wenn darunter nichts ist (z. B. EG über dem Boden).
 */
export function bayDropClearanceCm(walls: Wall[], seedId: string): number {
  const host = bayHostWall(walls, seedId)
  if (!host) return 0
  const memberIds = new Set(bayMemberIds(walls, seedId) ?? [host.id])
  const members = walls.filter((w) => memberIds.has(w.id))
  if (members.length === 0) return 0
  const foot = Math.min(...members.map((w) => w.y ?? 0))
  let maxBelowTop = -Infinity
  for (const other of walls) {
    if (memberIds.has(other.id) || other.hidden) continue
    const top = (other.y ?? 0) + other.height
    if (top > foot + 0.5) continue
    maxBelowTop = Math.max(maxBelowTop, top)
  }
  if (!Number.isFinite(maxBelowTop)) return Number.POSITIVE_INFINITY
  return Math.max(0, foot - maxBelowTop)
}

/** Maximal erlaubter Drop-Zielwert (aktueller Drop + Freiraum darunter). */
export function bayDropMaxCm(walls: Wall[], seedId: string): number {
  const current = bayDropCm(walls, seedId)
  const clearance = bayDropClearanceCm(walls, seedId)
  if (!Number.isFinite(clearance)) return Number.POSITIVE_INFINITY
  return Math.max(0, current + clearance)
}

/**
 * Entfernt Erker-Drop von Geschoss-Klonen: Höhe/Öffnungen/Schrift zurück auf Etagenmaß,
 * `dropCm: 0`. Quelle bleibt unverändert; Klone stehen immer auf der Etage ohne Rock.
 */
export function stripBayDropFromStoreyClone(source: Wall, clone: Wall, dropCm: number): Wall {
  const drop = Math.max(0, Math.round(dropCm))
  if (drop <= 0) {
    if (!clone.bayWindow) return clone
    return {
      ...clone,
      bayWindow: { ...clone.bayWindow, dropCm: 0 },
    }
  }
  const openings = clone.openings.map((o) => ({
    ...o,
    y: Math.max(0, (o.y ?? 0) - drop),
  }))
  let label = clone.label
  if (label && typeof label.y === 'number') {
    label = { ...label, y: Math.max(0, label.y - drop) }
  }
  const labels = clone.labels?.map((item) =>
    typeof item.y === 'number' ? { ...item, y: Math.max(0, item.y - drop) } : { ...item },
  )
  let bayWindow = clone.bayWindow
  if (bayWindow) {
    bayWindow = { ...bayWindow, dropCm: 0 }
  }
  const next: Wall = {
    ...clone,
    height: Math.max(1, clone.height - drop),
    openings,
    label,
    labels,
    bayWindow,
  }
  return isStudioWall(next) ? normalizeStudioWall(next, { keepOpenings: true }) : next
}

/**
 * Erker nach unten verlängern (MVP, item 14): Oberkante bleibt fix, der Fuß aller
 * Erker-Wände (Front/Schenkel/Host) wandert um `dropCm` nach unten.
 * `dropCm` ist der Zielwert (absolut, ≥ 0); die Differenz zum gespeicherten Wert wird angewandt.
 * Nur soweit Freiraum darunter (`bayDropClearanceCm`); sonst wird geklemmt.
 * Öffnungen/Schrift bleiben auf gleicher Welthöhe (lokales `y` wächst mit dem Delta).
 * Sockel und Paneele starten lokal bei `dropCm` (roher Wandblock darunter).
 */
export function applyBayDrop(
  state: FacadeState,
  seedId: string,
  dropCm: number,
): FacadeState | null {
  const building = findBuildingForWall(state, seedId)
  if (!building) return null
  const host = bayHostWall(building.walls, seedId)
  if (!host?.bayWindow) return null
  const memberIds = new Set(bayMemberIds(building.walls, seedId) ?? [host.id])
  const maxDrop = bayDropMaxCm(building.walls, seedId)
  const target = Math.max(
    0,
    Math.round(Number.isFinite(maxDrop) ? Math.min(dropCm, maxDrop) : dropCm),
  )
  const current = bayDropCm(building.walls, seedId)
  const delta = target - current
  if (delta === 0) return state

  const nextWalls = building.walls.map((wall) => {
    if (!memberIds.has(wall.id)) return wall
    const newY = (wall.y ?? 0) - delta
    const newH = Math.max(1, (wall.height ?? 0) + delta)
    const openings = wall.openings.map((o) => ({ ...o, y: (o.y ?? 0) + delta }))
    let label = wall.label
    if (label && typeof label.y === 'number') {
      label = { ...label, y: label.y + delta }
    }
    const labels = wall.labels?.map((item) =>
      typeof item.y === 'number' ? { ...item, y: item.y + delta } : { ...item },
    )
    const next: Wall = normalizeStudioWall(
      { ...cloneWall(wall), y: newY, height: newH, openings, label, labels },
      { keepOpenings: true },
    )
    if (wall.id === host.id && next.bayWindow) {
      next.bayWindow = { ...next.bayWindow, dropCm: target }
    }
    return next
  })

  let next = updateBuilding(state, building.id, { walls: nextWalls })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  return next
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
  opts?: { singleFloor?: boolean },
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
  const split = splitWallStackRange(state, wallId, range, {
    singleFloor: opts?.singleFloor === true,
  })
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
  const seedCtx = resolveBaySlideContext(building.walls, seedWallId)
  if (!seedCtx) return null

  // Etagen-Stapel: Erker anderer Etagen mit gleichem Mund (XZ) gleiten mit — sonst
  // stehen Ober- und Untergeschoss versetzt und die Reststücke passen nicht mehr.
  const contexts = [seedCtx]
  for (const host of stackedBayHosts(building.walls, seedCtx)) {
    const ctx = resolveBaySlideContext(building.walls, host.id)
    if (ctx) contexts.push(ctx)
  }

  const step = BAY_SLIDE_STEP_CM
  const minRemnant = STUDIO_WALL_WIDTH_STEP
  let delta = Math.round(deltaAlongCm / step) * step
  if (delta === 0) return state

  const stretchAmountForDockMove = (
    ctx: BaySlideContext,
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

  const remnantsOf = (ctx: BaySlideContext): { left: Wall; right: Wall } | null => {
    const left = building.walls.find((w) => w.id === ctx.leftRemnantId)
    const right = building.walls.find((w) => w.id === ctx.rightRemnantId)
    if (!left || !right || !isStudioWall(left) || !isStudioWall(right)) return null
    return { left, right }
  }

  // Delta so begrenzen, dass auf allen Etagen beide Reste ≥ Mindestbreite bleiben.
  for (let guard = 0; guard < 8; guard += 1) {
    let maxAbs = Math.abs(delta)
    let allOk = true
    for (const ctx of contexts) {
      const rem = remnantsOf(ctx)
      if (!rem) return null
      const leftAmt = stretchAmountForDockMove(ctx, rem.left, ctx.leftStretchEnd, delta)
      const rightAmt = stretchAmountForDockMove(ctx, rem.right, ctx.rightStretchEnd, delta)
      const leftOk = rem.left.width + leftAmt >= minRemnant - EPS
      const rightOk = rem.right.width + rightAmt >= minRemnant - EPS
      if (!leftOk) {
        allOk = false
        maxAbs = Math.min(maxAbs, Math.max(0, rem.left.width - minRemnant))
      }
      if (!rightOk) {
        allOk = false
        maxAbs = Math.min(maxAbs, Math.max(0, rem.right.width - minRemnant))
      }
    }
    if (allOk) break
    // Abrunden auf den Schritt (nicht runden) — sonst wird der Rest wieder zu klein.
    const next = Math.sign(delta) * Math.floor((maxAbs + EPS) / step) * step
    if (next === delta || next === 0) {
      delta = next
      break
    }
    delta = next
  }
  if (delta === 0) return state

  const plans = contexts.map((ctx) => {
    const rem = remnantsOf(ctx)!
    const leftAmt = stretchAmountForDockMove(ctx, rem.left, ctx.leftStretchEnd, delta)
    const rightAmt = stretchAmountForDockMove(ctx, rem.right, ctx.rightStretchEnd, delta)
    return { ctx, rem, leftAmt, rightAmt, along: wallAlongDelta(ctx.facadeYaw, delta) }
  })
  if (
    plans.some(
      (p) =>
        p.rem.left.width + p.leftAmt < minRemnant - EPS ||
        p.rem.right.width + p.rightAmt < minRemnant - EPS,
    )
  ) {
    return state
  }

  const nextWalls = building.walls.map((wall) => {
    for (const p of plans) {
      if (p.ctx.memberIds.includes(wall.id)) return translateWallXZ(wall, p.along.x, p.along.z)
      if (wall.id === p.rem.left.id) {
        return stretchSingleStudioWall(wall, p.ctx.leftStretchEnd, p.leftAmt)
      }
      if (wall.id === p.rem.right.id) {
        return stretchSingleStudioWall(wall, p.ctx.rightStretchEnd, p.rightAmt)
      }
    }
    return cloneWall(wall)
  })

  let next = updateBuilding(state, building.id, { walls: nextWalls })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  return next
}

/** Erker-Hosts anderer Etagen, deren linker Mundpunkt in XZ auf `ctx.leftAttach` liegt. */
function stackedBayHosts(walls: Wall[], ctx: BaySlideContext): Wall[] {
  const memberSet = new Set(ctx.memberIds)
  const seedY = walls.find((w) => memberSet.has(w.id))?.y ?? 0
  const out: Wall[] = []
  for (const host of walls) {
    if (!host.bayWindow?.wallIds?.length || memberSet.has(host.id)) continue
    if (Math.abs((host.y ?? 0) - seedY) <= 1) continue
    const sides = host.bayWindow.wallIds
      .map((id) => walls.find((w) => w.id === id))
      .filter((w): w is Wall => Boolean(w && w.bayRole === 'side'))
    if (sides.length < 2) continue
    if (distPoint(wallStartPoint(sides[0]!), ctx.leftAttach) > 2) continue
    if (out.some((h) => h.id === host.id)) continue
    out.push(host)
  }
  return out
}

/** Alle Erker-Wand-IDs des Etagen-Stapels (Seed-Etage zuerst). */
export function bayStackWallIds(walls: Wall[], seedWallId: string): string[] | null {
  const ctx = resolveBaySlideContext(walls, seedWallId)
  if (!ctx) return bayWallSelectionIds(walls, seedWallId)
  const ids = [...ctx.memberIds]
  for (const host of stackedBayHosts(walls, ctx)) {
    for (const id of bayWallSelectionIds(walls, host.id) ?? []) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

/** Ob die Auswahl eine eingebettete Erker-Gruppe mit Reststücken links/rechts ist. */
export function canSlideBaySegment(walls: Wall[], seedWallId: string): boolean {
  return resolveBaySlideContext(walls, seedWallId) != null
}

/**
 * Synthetische Wand + Öffnung für Hilfslinien/Abstände beim Erker-Gleiten —
 * wie eine Wandöffnung auf der durchgehenden Fassade (Rest links | Mund | Rest rechts).
 */
export function buildBaySlideGuideModel(
  walls: Wall[],
  seedWallId: string,
): { wall: Wall; opening: Opening; peers: Wall[] } | null {
  const ctx = resolveBaySlideContext(walls, seedWallId)
  if (!ctx) return null
  const left = walls.find((w) => w.id === ctx.leftRemnantId)
  const right = walls.find((w) => w.id === ctx.rightRemnantId)
  const host = bayHostWall(walls, seedWallId)
  if (!left || !right || !host?.bayWindow || !isStudioWall(left) || !isStudioWall(right)) return null
  const mouth = Math.hypot(
    wallStartPoint(right).x - wallEndPoint(left).x,
    wallStartPoint(right).z - wallEndPoint(left).z,
  )
  if (mouth < 1) return null
  const openingId = '__bay_slide__'
  const opening: Opening = {
    id: openingId,
    type: 'window',
    x: left.width,
    y: 0,
    width: mouth,
    height: left.height,
  }
  const remappedRight = right.openings.map((o) => ({
    ...o,
    x: o.x + left.width + mouth,
  }))
  const wall: Wall = {
    ...left,
    width: left.width + mouth + right.width,
    openings: [...left.openings, opening, ...remappedRight],
  }
  const skip = new Set([left.id, right.id, ...ctx.memberIds])
  const peers = walls.filter(
    (w) =>
      isStudioWall(w) &&
      !skip.has(w.id) &&
      Math.abs((w.y ?? 0) - (left.y ?? 0)) < 1,
  )
  return { wall, opening, peers: [wall, ...peers] }
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
  const drop = bayDropCm(building.walls, host.id)
  // Flat-Wand auf Etagenfuß/-höhe (ohne Rock), sonst falscher floorIndex und Deckenloch.
  const remnant = building.walls.find(
    (w) =>
      !memberSet.has(w.id) &&
      isStudioWall(w) &&
      !w.bayParentId &&
      !w.bayRole &&
      !w.bayWindow &&
      Math.abs((w.y ?? 0) + w.height - ((styleFrom.y ?? 0) + styleFrom.height)) < 2,
  )
  const storeyY = remnant?.y ?? (styleFrom.y ?? 0) + drop
  const storeyH = remnant?.height ?? Math.max(1, styleFrom.height - drop)
  const storeyIndex =
    typeof host.storeyIndex === 'number' && Number.isFinite(host.storeyIndex)
      ? Math.max(0, Math.round(host.storeyIndex))
      : typeof styleFrom.storeyIndex === 'number' && Number.isFinite(styleFrom.storeyIndex)
        ? Math.max(0, Math.round(styleFrom.storeyIndex))
        : undefined
  const flat = normalizeStudioWall(
    {
      ...createStudioWall(leftAttach.x, storeyY),
      id: flatId,
      originX: leftAttach.x,
      originZ: leftAttach.z,
      x: leftAttach.x,
      yawDeg: facadeYaw,
      panelFlip: styleFrom.panelFlip ?? true,
      width,
      height: storeyH,
      depth: styleFrom.depth,
      wallColor: styleFrom.wallColor,
      interiorColor: styleFrom.interiorColor,
      claddingColor: styleFrom.claddingColor,
      profileColor: styleFrom.profileColor,
      panel: styleFrom.panel ? { ...styleFrom.panel } : undefined,
      cornice: styleFrom.cornice ? { ...styleFrom.cornice } : undefined,
      planLinked: true,
      openings: [],
      ...(storeyIndex != null ? { storeyIndex } : {}),
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
