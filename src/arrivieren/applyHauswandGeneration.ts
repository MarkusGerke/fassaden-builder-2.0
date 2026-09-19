import type { FacadeState, RoofConfig, Wall } from '../types/facade'
import { WALL_DEPTH, WALL_HEIGHT, UPPER_STOREY_WALL_DEPTH } from '../constants/presets'
import { getActiveBuilding, updateActiveBuilding } from '../utils/buildings'
import { createOpening } from '../utils/openings'
import { duplicateStorey, removeStorey } from '../utils/walls'
import { floorIndex } from '../utils/layers'
import { createId } from '../utils/id'
import { insertBayAsWallSegment } from '../studio/baySegment'
import {
  createStudioWall,
  findVerticalAlignedWalls,
  isStudioWall,
  normalizeStudioWall,
  stretchSingleStudioWall,
  wallAlongDelta,
} from '../studio/walls'
import { normalizeYawDeg } from '../studio/compass'
import { facadeOutward } from '../studio/elevation'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from '../studio/constants'
import { finalizeStudioGeometry } from '../studio/planGeometry'
import { syncFloorPlansFromWalls } from '../studio/floorPlan'
import { DEFAULT_ROOF, normalizeRoof, ROOF_KINDS } from '../studio/roof'
import { createGalleryRng } from '../gallery/galleryRandom'
import type { HauswandOpeningSpec, HauswandPlan } from './hauswandTypes'
import { resolveBayPresetFromPlan } from './generateHauswand'
import { HAUSWAND_WALL_HEIGHT_CM } from './hauswandGrid'
import { planBays, windowsContinuedOnBayFront } from './hauswandFacadeLayout'

const EPS = 0.5

/**
 * Gründerzeit-Vorderhaus-Tiefe (Berliner Mietshaus / Straßenflügel): typisch ca. 12–14 m
 * (zwei Zimmer + Flur). 8er-Raster, Bibliothek-Logik.
 */
export const HAUSWAND_DEPTH_OPTIONS_CM = [1200, 1280, 1320, 1360, 1440] as const
export const HAUSWAND_DEFAULT_DEPTH_CM = 1320

function bareHauswandPanel() {
  return normalizeStudioPanel({
    ...DEFAULT_STUDIO_PANEL,
    enabled: false,
    plinthEnabled: false,
    plinthHeight: 0,
    plinthDepth: 0,
  })
}

function cloneStyleWall(_source: Wall): Partial<Wall> {
  return {
    yawDeg: _source.yawDeg ?? 0,
    panelFlip: _source.panelFlip ?? true,
    planLinked: _source.planLinked ?? true,
    originX: _source.originX ?? _source.x,
    originZ: _source.originZ ?? 0,
    wallColor: _source.wallColor,
    wallFinish: _source.wallFinish,
    panel: bareHauswandPanel(),
    cornice: undefined,
    trimBands: [],
    labels: [],
    label: undefined,
    awnings: [],
    claddingZones: undefined,
    claddingColor: undefined,
    claddingFinish: undefined,
  }
}

/** Erker und Fassade: keine Paneele, Sockel, Gesimse, Zierbänder. */
export function stripHauswandWallDecor(wall: Wall): Wall {
  const openings = (wall.openings ?? []).map((o) => {
    // Schenkel: Außenbänke stecken sonst durch die Frontwand (v2.0.508)
    if (wall.bayRole === 'side') {
      return { ...o, sillOuter: undefined, sillInner: undefined, trim: undefined }
    }
    return o
  })
  return {
    ...wall,
    openings,
    panel: bareHauswandPanel(),
    cornice: undefined,
    trimBands: [],
    labels: [],
    label: undefined,
    awnings: [],
    claddingZones: undefined,
    claddingColor: undefined,
    claddingFinish: undefined,
    profiles: [],
  }
}

function pickHostWall(building: ReturnType<typeof getActiveBuilding>): Wall | null {
  const candidates = building.walls.filter(
    (w) =>
      isStudioWall(w) &&
      !w.bayParentId &&
      !w.bayRole &&
      (w.y ?? 0) < EPS &&
      !w.endPiece &&
      !w.endPieceParentId &&
      w.role !== 'interior',
  )
  if (candidates.length === 0) return null
  // Straßenfassade: Öffnungen, sonst Außennormale ≈ −Z (Yaw 0 / panelFlip true)
  const withOpenings = candidates.filter((w) => (w.openings?.length ?? 0) > 0)
  const pool =
    withOpenings.length > 0
      ? withOpenings
      : candidates.filter((w) => {
          const o = facadeOutward(w.yawDeg ?? 0, w.panelFlip ?? true)
          return o.z < -0.5
        })
  const use = pool.length > 0 ? pool : candidates
  return use.reduce((best, w) => (w.width > best.width ? w : best), use[0]!)
}

function stackIdsForHost(host: Wall, walls: Wall[], wallHeight: number): Set<string> {
  const stacked = findVerticalAlignedWalls(host, walls, wallHeight)
  return new Set([host.id, ...stacked.map((w) => w.id)])
}

function bayMemberIdsToRemove(walls: Wall[], stackIds: Set<string>): Set<string> {
  const remove = new Set<string>()
  for (const id of stackIds) {
    const w = walls.find((item) => item.id === id)
    if (!w?.bayWindow?.wallIds?.length) continue
    for (const bid of w.bayWindow.wallIds) remove.add(bid)
  }
  for (const w of walls) {
    if (w.bayParentId && stackIds.has(w.bayParentId)) remove.add(w.id)
    if (w.bayRole) remove.add(w.id)
  }
  return remove
}

function rebuildFacadeStack(
  building: ReturnType<typeof getActiveBuilding>,
  host: Wall,
  storeys: number,
  widthCm: number,
): Wall[] {
  const wallHeight = building.wallHeight || WALL_HEIGHT
  const style = cloneStyleWall(host)
  // Arrivieren ersetzt die gesamte Fassade — keine Alt-Studio-Wände behalten (sonst Überlagerung)
  const kept = building.walls.filter((w) => !isStudioWall(w))

  const stack: Wall[] = []
  for (let floor = 0; floor < storeys; floor += 1) {
    const y = floor * wallHeight
    const depth = floor === 0 ? building.wallDepth || WALL_DEPTH : UPPER_STOREY_WALL_DEPTH
    stack.push(
      normalizeStudioWall({
        ...createStudioWall(style.originX ?? 0, y),
        id: floor === 0 ? host.id : createId(),
        ...style,
        width: widthCm,
        height: wallHeight,
        depth,
        y,
        storeyIndex: floor,
        openings: [],
        profiles: [],
      }),
    )
  }
  return [...kept, ...stack]
}

/** Gebäude-Tiefe aus Seed (8er), Gründerzeit-Vorderhaus ~12–14 m. */
export function pickHauswandDepthCm(seed: number): number {
  const rng = createGalleryRng(seed ^ 0xde07)
  const opts = HAUSWAND_DEPTH_OPTIONS_CM
  return opts[Math.floor(rng() * opts.length) % opts.length]!
}

/** Zufälliges Dach ohne Gauben/Zwerchgiebel/Dachfenster. First immer O–W (`ridgeDeg` 90). */
export function pickHauswandRoof(seed: number): RoofConfig {
  const rng = createGalleryRng(seed ^ 0x60f7)
  const kind = ROOF_KINDS[Math.floor(rng() * ROOF_KINDS.length) % ROOF_KINDS.length]!
  return normalizeRoof({
    ...DEFAULT_ROOF,
    enabled: true,
    kind,
    /** 90° = O–W-Firstachse (siehe roofForms `resolveRidgeDir`). */
    ridgeDeg: 90,
    dormers: [],
    crossGables: [],
    skylights: [],
  })
}

/**
 * Seiten- + Rückwände „nach hinten“ (Rechteck), Außenkante = Planlinie (`panelFlip` wie Front).
 * Pro Etage drei Wände; nackt wie die Straßenfassade.
 */
function attachHauswandEnvelopeWalls(
  walls: Wall[],
  hostId: string,
  facadeWidthCm: number,
  depthCm: number,
  storeys: number,
  wallHeight: number,
): Wall[] {
  const host = walls.find((w) => w.id === hostId)
  if (!host || !isStudioWall(host)) return walls
  const stack = [host, ...findVerticalAlignedWalls(host, walls, wallHeight)].sort(
    (a, b) => (a.y ?? 0) - (b.y ?? 0),
  )
  const flip = host.panelFlip ?? true
  const frontYaw = host.yawDeg ?? 0
  const along = wallAlongDelta(frontYaw, 1)
  const out = facadeOutward(frontYaw, flip)
  const inward = { x: -out.x, z: -out.z }
  const ox = host.originX ?? host.x
  const oz = host.originZ ?? 0
  const W = facadeWidthCm
  const D = depthCm

  const frontStart = { x: ox, z: oz }
  const frontEnd = { x: ox + along.x * W, z: oz + along.z * W }
  const rightYaw = normalizeYawDeg(frontYaw + 270)
  const backYaw = normalizeYawDeg(frontYaw + 180)
  const leftYaw = normalizeYawDeg(frontYaw + 90)
  const rightOrigin = frontEnd
  const backOrigin = { x: frontEnd.x + inward.x * D, z: frontEnd.z + inward.z * D }
  const leftOrigin = { x: frontStart.x + inward.x * D, z: frontStart.z + inward.z * D }

  const extras: Wall[] = []
  for (let floor = 0; floor < storeys; floor += 1) {
    const front = stack[floor] ?? stack[0]!
    const y = floor * wallHeight
    const wallDepth = floor === 0 ? host.depth : UPPER_STOREY_WALL_DEPTH
    const style = cloneStyleWall(front)
    for (const side of [
      { origin: rightOrigin, yawDeg: rightYaw, width: D },
      { origin: backOrigin, yawDeg: backYaw, width: W },
      { origin: leftOrigin, yawDeg: leftYaw, width: D },
    ] as const) {
      extras.push(
        stripHauswandWallDecor(
          normalizeStudioWall({
            ...createStudioWall(side.origin.x, y),
            id: createId(),
            ...style,
            originX: side.origin.x,
            originZ: side.origin.z,
            x: side.origin.x,
            yawDeg: side.yawDeg,
            width: side.width,
            height: front.height || wallHeight,
            depth: wallDepth,
            y,
            storeyIndex: floor,
            panelFlip: flip,
            planLinked: true,
            openings: [],
            profiles: [],
          }),
        ),
      )
    }
  }
  return [...walls, ...extras]
}

function countBuildingStoreys(building: ReturnType<typeof getActiveBuilding>): number {
  const h = building.wallHeight || WALL_HEIGHT
  let maxFi = 0
  for (const w of building.walls) {
    if (!isStudioWall(w)) continue
    maxFi = Math.max(maxFi, floorIndex(w, h))
  }
  return Math.max(1, maxFi + 1, building.floors?.length ?? 1)
}

function adjustStoreyCount(state: FacadeState, hostId: string, target: number): FacadeState {
  let next = state
  let guard = 0
  while (countBuildingStoreys(getActiveBuilding(next)) < target && guard < 8) {
    const fi = countBuildingStoreys(getActiveBuilding(next)) - 1
    next = duplicateStorey(next, fi, { copyOpenings: false, wallIds: [hostId] })
    guard += 1
  }
  guard = 0
  while (countBuildingStoreys(getActiveBuilding(next)) > target && guard < 8) {
    const fi = countBuildingStoreys(getActiveBuilding(next)) - 1
    next = removeStorey(next, fi)
    guard += 1
  }
  return next
}

function wallInHostStack(wall: Wall, hostId: string, walls: Wall[], wallHeight: number): boolean {
  const host = walls.find((w) => w.id === hostId)
  if (!host) return false
  if (wall.id === hostId) return true
  return findVerticalAlignedWalls(host, walls, wallHeight).some((s) => s.id === wall.id)
}

function facadeOriginX(host: Wall): number {
  return host.originX ?? host.x
}

function facadePiecesOnFloor(
  walls: Wall[],
  host: Wall,
  fi: number,
  wallHeight: number,
  facadeWidth: number,
): Wall[] {
  const origin = facadeOriginX(host)
  const facadeEnd = origin + facadeWidth
  const hostZ = host.originZ ?? 0
  const hostYaw = normalizeYawDeg(host.yawDeg ?? 0)
  return walls.filter((w) => {
    if (!isStudioWall(w) || w.bayRole || w.bayParentId) return false
    if (floorIndex(w, wallHeight) !== fi) return false
    // Nur Straßenfassade (gleiche Yaw + Z-Lage), nicht Seiten-/Rückwände
    if (normalizeYawDeg(w.yawDeg ?? 0) !== hostYaw) return false
    if (Math.abs((w.originZ ?? 0) - hostZ) > 2) return false
    const start = w.originX ?? w.x
    const end = start + w.width
    return start < facadeEnd - EPS && end > origin + EPS
  })
}

function localXOnWall(wall: Wall, host: Wall, facadeX: number): number {
  const offset = (wall.originX ?? wall.x) - facadeOriginX(host)
  return facadeX - offset
}

function openingFitsWall(wall: Wall, spec: HauswandOpeningSpec, host: Wall): number | null {
  const localX = localXOnWall(wall, host, spec.x)
  if (localX < -EPS || localX + spec.width > wall.width + EPS) return null
  if (spec.y < -EPS || spec.y + spec.height > wall.height + EPS) return null
  return localX
}

function applySpecsToWall(
  wall: Wall,
  specs: HauswandOpeningSpec[],
  host: Wall,
): Wall {
  const openings = [...wall.openings]
  for (const spec of specs) {
    const localX = openingFitsWall(wall, spec, host)
    if (localX === null) continue
    openings.push(
      createOpening(spec.type, spec.width, spec.height, wall, {
        x: localX,
        y: spec.y,
      }),
    )
  }
  return { ...wall, openings }
}

function resizeStackToWidth(walls: Wall[], hostId: string, wallHeight: number, targetWidth: number): Wall[] {
  const host = walls.find((w) => w.id === hostId)
  if (!host) return walls
  const ids = stackIdsForHost(host, walls, wallHeight)
  const delta = targetWidth - host.width
  if (Math.abs(delta) < EPS) return walls
  return walls.map((wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return wall
    return stretchSingleStudioWall(wall, 'end', delta)
  })
}

function syncFloorsArray(building: ReturnType<typeof getActiveBuilding>, storeys: number) {
  const floors = [...(building.floors ?? [])]
  while (floors.length < storeys) {
    floors.push({ nodes: [], edges: [] })
  }
  while (floors.length > storeys) floors.pop()
  return floors
}

function applyBayFrontWindows(state: FacadeState, plan: HauswandPlan): FacadeState {
  const bays = planBays(plan)
  if (!bays.length) return state
  return updateActiveBuilding(state, (b) => ({
    ...b,
    walls: b.walls.map((wall) => {
      if (wall.bayRole !== 'front') return wall
      const bay = bays.find((item) => {
        const mouthStart = item.centerLocalXCm - (wall.width / 2)
        return Math.abs((wall.x ?? 0) - mouthStart) < 80 || Math.abs((wall.originX ?? wall.x) - item.centerLocalXCm + wall.width / 2) < 80
      }) ?? bays[0]!
      const specs = windowsContinuedOnBayFront(bay, plan.ogWindowByAxis)
      let openings = wall.openings.filter((o) => o.type !== 'window')
      for (const spec of specs) {
        if (spec.x < -EPS || spec.x + spec.width > wall.width + EPS) continue
        openings.push(
          createOpening(spec.type, spec.width, spec.height, wall, {
            x: spec.x,
            y: spec.y,
          }),
        )
      }
      return { ...wall, openings }
    }),
  }))
}

/** Wendet einen Hauswand-Plan auf das aktive Gebäude an (eine Fassaden-Stapelwand). */
export function applyHauswandGeneration(state: FacadeState, plan: HauswandPlan): FacadeState {
  const building = getActiveBuilding(state)
  let host = pickHostWall(building)
  let next = state

  if (!host) {
    const created = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: createId(),
      width: plan.widthCm,
      height: building.wallHeight || HAUSWAND_WALL_HEIGHT_CM,
      depth: building.wallDepth || WALL_DEPTH,
      panelFlip: true,
      planLinked: true,
    })
    next = updateActiveBuilding(state, (b) => ({
      ...b,
      walls: [...b.walls, created],
      floors: syncFloorsArray(b, plan.storeys),
    }))
    host = created
  }

  const hostId = host.id

  next = updateActiveBuilding(next, (b) => {
    const h = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)!
    return {
      ...b,
      walls: rebuildFacadeStack(b, h, plan.storeys, plan.widthCm),
      floors: syncFloorsArray(b, plan.storeys),
    }
  })

  next = adjustStoreyCount(next, hostId, plan.storeys)

  next = updateActiveBuilding(next, (b) => ({
    ...b,
    walls: resizeStackToWidth(b.walls, hostId, b.wallHeight, plan.widthCm),
  }))

  next = updateActiveBuilding(next, (b) => ({
    ...b,
    walls: b.walls.map((wall) => {
      if (!wallInHostStack(wall, hostId, b.walls, b.wallHeight)) return wall
      return { ...wall, openings: [], profiles: [] }
    }),
  }))

  const bays = planBays(plan)
  for (const bay of bays) {
    const preset = resolveBayPresetFromPlan(bay)
    for (let fi = 1; fi <= plan.storeys - 2; fi += 1) {
      const b = getActiveBuilding(next)
      const floorHost = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)
      if (!floorHost) continue
      const pieces = facadePiecesOnFloor(b.walls, floorHost, fi, b.wallHeight, plan.widthCm).sort(
        (a, c) => c.width - a.width,
      )
      const floorWall = pieces[0]
      if (!floorWall) continue
      // centerLocalXCm ist Fassaden-lokal → auf Wandstück umrechnen
      const facadeOrigin = facadeOriginX(floorHost)
      const wallOrigin = floorWall.originX ?? floorWall.x
      const localCenter = bay.centerLocalXCm - (wallOrigin - facadeOrigin)
      const inserted = insertBayAsWallSegment(next, floorWall.id, preset, localCenter, {
        singleFloor: true,
      })
      if (inserted) next = inserted.state
    }
  }

  // Nach Erker: alle Etagen auf exakt plan.widthCm — keine Überstände / Fehlbreiten
  next = updateActiveBuilding(next, (b) => {
    const floorHost = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)
    if (!floorHost) return b
    const origin = facadeOriginX(floorHost)
    const walls = b.walls.map((wall) => {
      if (!isStudioWall(wall) || wall.bayRole || wall.bayParentId) return wall
      const fi = floorIndex(wall, b.wallHeight)
      const onFacade = facadePiecesOnFloor(b.walls, floorHost, fi, b.wallHeight, plan.widthCm).some(
        (w) => w.id === wall.id,
      )
      if (!onFacade) return wall
      // Volle Etage ohne Erker: Breite erzwingen
      const pieces = facadePiecesOnFloor(b.walls, floorHost, fi, b.wallHeight, plan.widthCm)
      if (pieces.length === 1 && pieces[0]!.id === wall.id && Math.abs(wall.width - plan.widthCm) > EPS) {
        return stretchSingleStudioWall(wall, 'end', plan.widthCm - wall.width)
      }
      // Reststücke: nur innerhalb [origin, origin+width]
      const start = wall.originX ?? wall.x
      const end = start + wall.width
      const right = origin + plan.widthCm
      if (start < origin - EPS || end > right + EPS) {
        const clampedStart = Math.max(origin, start)
        const clampedEnd = Math.min(right, end)
        const newW = Math.max(8, clampedEnd - clampedStart)
        return {
          ...wall,
          originX: clampedStart,
          x: clampedStart,
          width: newW,
        }
      }
      return wall
    })
    return { ...b, walls }
  })

  next = updateActiveBuilding(next, (b) => {
    const floorHost = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)!
    const eg = plan.egGroups.flatMap((g) => g.openings)
    return {
      ...b,
      walls: b.walls.map((wall) => {
        if (wall.bayRole || wall.bayParentId) return wall
        const fi = floorIndex(wall, b.wallHeight)
        const onFacade = facadePiecesOnFloor(b.walls, floorHost, fi, b.wallHeight, plan.widthCm).some(
          (w) => w.id === wall.id,
        )
        if (!onFacade) return wall
        const cleared = { ...wall, openings: [], profiles: [] }
        if (fi === 0) return applySpecsToWall(cleared, eg, floorHost)
        if (fi >= 1 && fi <= plan.storeys - 1) return applySpecsToWall(cleared, plan.ogWindowByAxis, floorHost)
        return cleared
      }),
    }
  })

  next = applyBayFrontWindows(next, plan)

  // Erker + Fassadenreste: nackte Wand (Bibliothek-Erker würden sonst Läufer/Sockel holen)
  next = updateActiveBuilding(next, (b) => {
    const floorHost = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)
    if (!floorHost) return b
    return {
      ...b,
      walls: b.walls.map((wall) => {
        const onFacade = facadePiecesOnFloor(b.walls, floorHost, floorIndex(wall, b.wallHeight), b.wallHeight, plan.widthCm).some(
          (w) => w.id === wall.id,
        )
        const isBay = Boolean(wall.bayRole || wall.bayParentId || wall.bayWindow)
        if (!onFacade && !isBay) return wall
        if (!wallInHostStack(wall, hostId, b.walls, b.wallHeight) && !isBay) return wall
        return stripHauswandWallDecor(wall)
      }),
    }
  })

  // Rechteck-Grundriss: Seiten + Rückwand (Gründerzeit-Tiefe), dann Dach ohne Gauben
  const depthCm = pickHauswandDepthCm(plan.seed)
  next = updateActiveBuilding(next, (b) => ({
    ...b,
    walls: attachHauswandEnvelopeWalls(
      b.walls,
      hostId,
      plan.widthCm,
      depthCm,
      plan.storeys,
      b.wallHeight || WALL_HEIGHT,
    ),
    roof: pickHauswandRoof(plan.seed),
  }))

  next = syncFloorPlansFromWalls(next)

  return finalizeStudioGeometry(next)
}

export function hauswandFacadeBoundsFlush(
  walls: Wall[],
  host: Wall,
  storeys: number,
  wallHeight: number,
  facadeWidth: number,
): boolean {
  const origin = facadeOriginX(host)
  const right = origin + facadeWidth
  for (let fi = 0; fi < storeys; fi += 1) {
    const pieces = facadePiecesOnFloor(walls, host, fi, wallHeight, facadeWidth)
    for (const w of pieces) {
      const start = w.originX ?? w.x
      const end = start + w.width
      if (start < origin - 2 || end > right + 2) return false
    }
  }
  return true
}

/** True wenn zwei Fassaden-Reststücke derselben Etage in X überlappen. */
export function facadeWallsOverlapOnFloor(
  walls: Wall[],
  host: Wall,
  fi: number,
  wallHeight: number,
  facadeWidth: number,
): boolean {
  const pieces = facadePiecesOnFloor(walls, host, fi, wallHeight, facadeWidth)
    .slice()
    .sort((a, b) => (a.originX ?? a.x) - (b.originX ?? b.x))
  for (let i = 1; i < pieces.length; i += 1) {
    const prev = pieces[i - 1]!
    const cur = pieces[i]!
    const prevEnd = (prev.originX ?? prev.x) + prev.width
    const curStart = cur.originX ?? cur.x
    if (curStart < prevEnd - EPS) return true
  }
  return false
}
