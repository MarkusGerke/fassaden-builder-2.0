/**
 * Mehrgeschossige Fallrohre (Gebäude-Fixture) + optionale Nischen-Cutouts.
 */
import * as THREE from 'three'
import { STUDIO_MASONRY } from './constants'
import {
  findVerticalAlignedWalls,
  isStudioWall,
  studioFacadeOutwardDepth,
  studioWallOuterSpine,
  wallStartPoint,
  wallAlongDelta,
} from './walls'
import { createId } from '../utils/id'
import { hydrateOpening } from '../utils/hydrate'
import type {
  Building,
  DownpipeFixture,
  DownpipeFoot,
  DownpipeMount,
  FacadeState,
  Opening,
  Wall,
} from '../types/facade'
import { cloneBuilding, cloneWall } from '../types/facade'
import { normalizeRoof } from './roof'

/** Titanzink / QUARTZ-ZINC hellgrau. */
export const DEFAULT_DOWNPIPE_COLOR = '#8E8A88'
export const DEFAULT_DOWNPIPE_DIAMETER_CM = 8
export const DEFAULT_DOWNPIPE_SURFACE_GAP_CM = 3
export const DEFAULT_DOWNPIPE_NICHE_WIDTH_CM = 16
export const DEFAULT_DOWNPIPE_NICHE_DEPTH_CM = 12
/** Auslaufschuh: 72° zum Gehweg, horizontale Ausladung. */
export const DEFAULT_DOWNPIPE_SHOE_OUT_CM = 40
export const DEFAULT_DOWNPIPE_SHOE_ANGLE_DEG = 72
/** Rinnenprofil in roof.ts: drop 4 + Höhe 6 → Boden eaveY − 10. */
export const GUTTER_BOTTOM_DROP_CM = 10

export const DOWNPIPE_METALNESS = 0.55
export const DOWNPIPE_ROUGHNESS = 0.45
/** Rohrschellen-Abstand entlang der Achse (cm). */
export const DOWNPIPE_CLAMP_SPACING_CM = 200

export function normalizeDownpipe(raw: Partial<DownpipeFixture> & Pick<DownpipeFixture, 'id' | 'anchorWallId'>): DownpipeFixture {
  const diameterCm = clamp(
    Number.isFinite(raw.diameterCm) ? Number(raw.diameterCm) : DEFAULT_DOWNPIPE_DIAMETER_CM,
    4,
    24,
  )
  const mount: DownpipeMount = raw.mount === 'niche' ? 'niche' : 'surface'
  const foot: DownpipeFoot = raw.foot === 'ground' ? 'ground' : 'shoe'
  const localX = snapMasonry(Number.isFinite(raw.localX) ? Number(raw.localX) : 0)
  return {
    id: raw.id,
    anchorWallId: raw.anchorWallId,
    localX,
    diameterCm,
    mount,
    nicheWidthCm: snapMasonry(
      Number.isFinite(raw.nicheWidthCm) ? Number(raw.nicheWidthCm) : DEFAULT_DOWNPIPE_NICHE_WIDTH_CM,
    ),
    nicheDepthCm: clamp(
      Number.isFinite(raw.nicheDepthCm) ? Number(raw.nicheDepthCm) : DEFAULT_DOWNPIPE_NICHE_DEPTH_CM,
      4,
      48,
    ),
    foot,
    color:
      typeof raw.color === 'string' && raw.color.trim()
        ? raw.color.trim()
        : DEFAULT_DOWNPIPE_COLOR,
    breakDecor: raw.breakDecor === false ? false : true,
    nicheOpeningIds: raw.nicheOpeningIds ? { ...raw.nicheOpeningIds } : undefined,
  }
}

export function createDownpipeFixture(
  anchorWallId: string,
  localX: number,
  partial?: Partial<DownpipeFixture>,
): DownpipeFixture {
  return normalizeDownpipe({
    id: createId(),
    anchorWallId,
    localX,
    diameterCm: DEFAULT_DOWNPIPE_DIAMETER_CM,
    mount: 'surface',
    foot: 'shoe',
    color: DEFAULT_DOWNPIPE_COLOR,
    ...partial,
  })
}

export function hydrateDownpipes(building: Building): Building {
  const list = building.downpipes
  if (!list || list.length === 0) {
    return { ...building, downpipes: list ?? [] }
  }
  return {
    ...building,
    downpipes: list.map((dp) =>
      normalizeDownpipe({
        ...dp,
        id: dp.id || createId(),
        anchorWallId: dp.anchorWallId,
      }),
    ),
  }
}

/** Anker + vertikal ausgerichtete Wände, nach Fuß-Y sortiert. */
export function downpipeStackWalls(building: Building, dp: DownpipeFixture): Wall[] {
  const anchor = building.walls.find((w) => w.id === dp.anchorWallId)
  if (!anchor || !isStudioWall(anchor)) return []
  const others = findVerticalAlignedWalls(anchor, building.walls, building.wallHeight)
  return [anchor, ...others]
    .filter((w) => !w.hidden)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
}

export interface DownpipeWorldPose {
  /** Rohrachse in Welt-XZ (Mittelachse). */
  x: number
  z: number
  outward: { x: number; z: number }
  radiusCm: number
  yTop: number
  yBottom: number
  /** y am Rinnenboden (für Ablaufstutzen), sonst null. */
  gutterBottomY: number | null
}

export function resolveDownpipePose(building: Building, dp: DownpipeFixture): DownpipeWorldPose | null {
  const stack = downpipeStackWalls(building, dp)
  if (stack.length === 0) return null
  const anchor = stack.find((w) => w.id === dp.anchorWallId) ?? stack[0]!
  const localX = Math.max(0, Math.min(anchor.width, dp.localX))
  const spine = studioWallOuterSpine(anchor)
  const along = wallAlongDelta(anchor.yawDeg ?? 0, localX)
  const start = wallStartPoint(anchor)
  // Planlinie / Außenkante ohne Paneel-Vorstand
  let faceX = start.x + along.x
  let faceZ = start.z + along.z
  if (!(anchor.panelFlip ?? true)) {
    faceX += spine.outward.x * anchor.depth
    faceZ += spine.outward.z * anchor.depth
  }
  const panelOut = studioFacadeOutwardDepth(anchor)
  faceX += spine.outward.x * panelOut
  faceZ += spine.outward.z * panelOut

  const radiusCm = Math.max(2, dp.diameterCm / 2)
  let offsetOut = 0
  if (dp.mount === 'surface') {
    offsetOut = DEFAULT_DOWNPIPE_SURFACE_GAP_CM + radiusCm
  } else {
    const nicheDepth = dp.nicheDepthCm ?? DEFAULT_DOWNPIPE_NICHE_DEPTH_CM
    // Rohrmitte in der Nische: von Außenfläche nach innen
    offsetOut = -(nicheDepth / 2)
  }

  const x = faceX + spine.outward.x * offsetOut
  const z = faceZ + spine.outward.z * offsetOut

  const yBottomWall = Math.min(...stack.map((w) => w.y ?? 0))
  const yTopWall = Math.max(...stack.map((w) => (w.y ?? 0) + w.height))

  const roof = normalizeRoof(building.roof)
  const floors = building.floors?.length ?? 1
  const eaveY = floors * building.wallHeight
  const hasGutter = Boolean(roof.enabled && roof.gutter)
  const yTop = hasGutter ? Math.max(yTopWall, eaveY - 2) : yTopWall
  const yBottom =
    dp.foot === 'ground' ? Math.min(0, yBottomWall) - 8 : Math.min(0, yBottomWall)

  return {
    x,
    z,
    outward: spine.outward,
    radiusCm,
    yTop,
    yBottom,
    gutterBottomY: hasGutter ? eaveY - GUTTER_BOTTOM_DROP_CM : null,
  }
}

/** Baut eine zusammengeführte BufferGeometry für Rohr + Fuß + Schellen + optionalen Stutzen. */
export function buildDownpipeGeometry(
  building: Building,
  dp: DownpipeFixture,
): THREE.BufferGeometry | null {
  const pose = resolveDownpipePose(building, dp)
  if (!pose) return null

  const parts: THREE.BufferGeometry[] = []
  const radial = 16

  const mainH = Math.max(1, pose.yTop - pose.yBottom)
  const main = new THREE.CylinderGeometry(pose.radiusCm, pose.radiusCm, mainH, radial, 1, false)
  main.translate(pose.x, pose.yBottom + mainH / 2, pose.z)
  parts.push(main)

  if (dp.foot === 'shoe') {
    const shoe = buildShoeGeometry(pose)
    if (shoe) parts.push(shoe)
  }

  if (pose.gutterBottomY != null && pose.gutterBottomY < pose.yTop - 1) {
    // Ablaufstutzen: von Rinnenboden leicht nach unten zum Rohr (überlappt Kopf)
    const stubTop = pose.gutterBottomY + 2
    const stubBot = Math.min(pose.yTop, pose.gutterBottomY - 4)
    if (stubTop > stubBot + 1) {
      const stubH = stubTop - stubBot
      const stub = new THREE.CylinderGeometry(
        pose.radiusCm * 0.95,
        pose.radiusCm * 0.95,
        stubH,
        radial,
        1,
        false,
      )
      stub.translate(pose.x, stubBot + stubH / 2, pose.z)
      parts.push(stub)
    }
  }

  for (const clamp of buildClampGeometries(pose, dp)) {
    parts.push(clamp)
  }

  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}

function buildShoeGeometry(pose: DownpipeWorldPose): THREE.BufferGeometry | null {
  const angleRad = (DEFAULT_DOWNPIPE_SHOE_ANGLE_DEG * Math.PI) / 180
  const outLen = DEFAULT_DOWNPIPE_SHOE_OUT_CM
  // Knickpunkt etwas über Boden
  const knuckleY = pose.yBottom + 12
  const ox = pose.outward.x
  const oz = pose.outward.z
  // Richtung schräg nach unten und nach außen
  const dirY = -Math.sin(angleRad)
  const dirH = Math.cos(angleRad)
  const endX = pose.x + ox * outLen * dirH
  const endZ = pose.z + oz * outLen * dirH
  const endY = knuckleY + outLen * dirY

  const midX = (pose.x + endX) / 2
  const midY = (knuckleY + endY) / 2
  const midZ = (pose.z + endZ) / 2
  const len = Math.hypot(endX - pose.x, endY - knuckleY, endZ - pose.z)
  if (len < 1) return null

  const cyl = new THREE.CylinderGeometry(pose.radiusCm, pose.radiusCm, len, 12, 1, false)
  const quat = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const target = new THREE.Vector3(endX - pose.x, endY - knuckleY, endZ - pose.z).normalize()
  quat.setFromUnitVectors(up, target)
  cyl.applyQuaternion(quat)
  cyl.translate(midX, midY, midZ)

  // kurzer Vertikalstutzen bis Knick
  const dropH = Math.max(4, knuckleY - pose.yBottom)
  const drop = new THREE.CylinderGeometry(pose.radiusCm, pose.radiusCm, dropH, 12, 1, false)
  drop.translate(pose.x, pose.yBottom + dropH / 2, pose.z)

  return mergeGeometries([drop, cyl])
}

/** Rohrschellen: Ring ums Rohr + Lasche zur Wand (Aufsatz und Nische). */
function buildClampGeometries(
  pose: DownpipeWorldPose,
  dp: DownpipeFixture,
): THREE.BufferGeometry[] {
  const towardWallX = -pose.outward.x
  const towardWallZ = -pose.outward.z
  const gapToWall =
    dp.mount === 'surface'
      ? DEFAULT_DOWNPIPE_SURFACE_GAP_CM
      : Math.max(1.5, (dp.nicheDepthCm ?? DEFAULT_DOWNPIPE_NICHE_DEPTH_CM) / 2 - pose.radiusCm)

  const yStart = pose.yBottom + (dp.foot === 'shoe' ? 90 : 70)
  const yEnd = pose.yTop - 55
  const ys: number[] = []
  if (yEnd - yStart < 30) {
    ys.push((yStart + yEnd) / 2)
  } else {
    for (let y = yStart; y <= yEnd + 0.01; y += DOWNPIPE_CLAMP_SPACING_CM) {
      ys.push(y)
    }
    const last = ys[ys.length - 1]!
    if (yEnd - last > 40) ys.push(yEnd)
  }

  const out: THREE.BufferGeometry[] = []
  const ringMajor = pose.radiusCm + 0.35
  const ringTube = 0.55
  for (const y of ys) {
    const ring = new THREE.TorusGeometry(ringMajor, ringTube, 8, 20)
    ring.rotateX(Math.PI / 2)
    ring.translate(pose.x, y, pose.z)
    out.push(ring)

    const strapLen = gapToWall + 1.8
    const strap = new THREE.BoxGeometry(1.5, 2.0, strapLen)
    const yaw = Math.atan2(towardWallX, towardWallZ)
    strap.rotateY(yaw)
    const midX = pose.x + towardWallX * (pose.radiusCm + strapLen / 2)
    const midZ = pose.z + towardWallZ * (pose.radiusCm + strapLen / 2)
    strap.translate(midX, y, midZ)
    out.push(strap)
  }
  return out
}

function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let indexOffset = 0
  for (const geo of parts) {
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    const uv = geo.getAttribute('uv')
    const idx = geo.getIndex()
    if (!pos) continue
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      else normals.push(0, 1, 0)
      if (uv) uvs.push(uv.getX(i), uv.getY(i))
      else uvs.push(0, 0)
    }
    if (idx) {
      for (let i = 0; i < idx.count; i += 1) indices.push(idx.getX(i) + indexOffset)
    } else {
      for (let i = 0; i < pos.count; i += 1) indices.push(indexOffset + i)
    }
    indexOffset += pos.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  out.setIndex(indices)
  out.computeVertexNormals()
  out.computeBoundingSphere()
  return out
}

/** Nischen-/Schmuck-Cutout für eine Etagenwand (eckig, volle Höhe). */
export function makeDownpipeNicheOpening(
  wall: Wall,
  dp: DownpipeFixture,
  openingId?: string,
): Opening {
  const width = dp.nicheWidthCm ?? DEFAULT_DOWNPIPE_NICHE_WIDTH_CM
  const depth = dp.nicheDepthCm ?? DEFAULT_DOWNPIPE_NICHE_DEPTH_CM
  const x = snapMasonry(dp.localX - width / 2)
  const niche = dp.mount === 'niche'
  return hydrateOpening(
    {
      id: openingId ?? createId(),
      type: 'cutout',
      cutoutShape: 'rect',
      width,
      height: wall.height,
      x: Math.max(0, Math.min(wall.width - width, x)),
      y: 0,
      fill: niche
        ? { mode: 'niche', nicheDepthCm: depth }
        : { mode: 'flush' },
    },
    wall,
  )
}

/** Ob gekoppelte Cutouts existieren sollen (Nische immer; Aufsatz nur bei Schmuck-Durchbruch). */
export function downpipeNeedsDecorOpenings(dp: DownpipeFixture): boolean {
  return dp.mount === 'niche' || dp.breakDecor !== false
}

/**
 * Cutout-IDs, die Schmuck (Gesims/Zierband/Sockel) **nicht** unterbrechen sollen
 * (Nische an, aber breakDecor aus).
 */
export function downpipeOpeningsSkippingDecorBreak(state: FacadeState): Set<string> {
  const skip = new Set<string>()
  for (const building of state.buildings) {
    for (const dp of building.downpipes ?? []) {
      if (dp.breakDecor !== false) continue
      for (const id of Object.values(dp.nicheOpeningIds ?? {})) skip.add(id)
    }
  }
  return skip
}

export function findDownpipeByOpeningId(
  state: FacadeState,
  openingId: string,
): { buildingId: string; downpipeId: string } | null {
  for (const building of state.buildings) {
    for (const dp of building.downpipes ?? []) {
      for (const id of Object.values(dp.nicheOpeningIds ?? {})) {
        if (id === openingId) {
          return { buildingId: building.id, downpipeId: dp.id }
        }
      }
    }
  }
  return null
}

/**
 * Synchronisiert gekoppelte Cutouts über die vertikale Wandkette.
 * Nische → Wandloch; Aufsatz + breakDecor → flush (nur Schmuck-Durchbruch).
 * Sonst werden gekoppelte Cutouts entfernt.
 */
export function syncDownpipeNiches(building: Building, dp: DownpipeFixture): {
  building: Building
  downpipe: DownpipeFixture
} {
  const next = cloneBuilding(building)
  const stack = downpipeStackWalls(next, dp)
  const prevIds = { ...(dp.nicheOpeningIds ?? {}) }

  if (!downpipeNeedsDecorOpenings(dp)) {
    const removeIds = new Set(Object.values(prevIds))
    next.walls = next.walls.map((wall) => {
      if (!removeIds.size) return wall
      const filtered = wall.openings.filter((o) => !removeIds.has(o.id))
      if (filtered.length === wall.openings.length) return wall
      const cloned = cloneWall(wall)
      cloned.openings = filtered
      return cloned
    })
    return { building: next, downpipe: { ...dp, nicheOpeningIds: undefined } }
  }

  const nicheOpeningIds: Record<string, string> = {}
  const keepIds = new Set<string>()

  for (const wall of stack) {
    const existingId = prevIds[wall.id]
    const opening = makeDownpipeNicheOpening(wall, dp, existingId)
    nicheOpeningIds[wall.id] = opening.id
    keepIds.add(opening.id)

    next.walls = next.walls.map((w) => {
      if (w.id !== wall.id) return w
      const cloned = cloneWall(w)
      const without = cloned.openings.filter(
        (o) => o.id !== opening.id && o.id !== existingId && !Object.values(prevIds).includes(o.id),
      )
      // Nur eigene alte Nische dieser Wand entfernen
      const cleaned = without.filter((o) => {
        if (prevIds[wall.id] && o.id === prevIds[wall.id]) return false
        return true
      })
      cloned.openings = [...cleaned.filter((o) => o.id !== opening.id), opening]
      return cloned
    })
  }

  // Alte IDs anderer Wände entfernen
  const obsolete = Object.entries(prevIds)
    .filter(([wallId]) => !nicheOpeningIds[wallId])
    .map(([, id]) => id)
  if (obsolete.length > 0) {
    const obsoleteSet = new Set(obsolete)
    next.walls = next.walls.map((wall) => {
      const filtered = wall.openings.filter((o) => !obsoleteSet.has(o.id))
      if (filtered.length === wall.openings.length) return wall
      const cloned = cloneWall(wall)
      cloned.openings = filtered
      return cloned
    })
  }

  return {
    building: next,
    downpipe: { ...dp, nicheOpeningIds },
  }
}

/** Patch + Nischen-Sync für ein Fallrohr im Gebäude. */
export function upsertDownpipeInBuilding(
  building: Building,
  dp: DownpipeFixture,
): Building {
  const normalized = normalizeDownpipe(dp)
  const { building: withNiches, downpipe } = syncDownpipeNiches(building, normalized)
  const list = [...(withNiches.downpipes ?? [])]
  const idx = list.findIndex((d) => d.id === downpipe.id)
  if (idx >= 0) list[idx] = downpipe
  else list.push(downpipe)
  return { ...withNiches, downpipes: list }
}

export function removeDownpipeFromBuilding(building: Building, downpipeId: string): Building {
  const existing = building.downpipes?.find((d) => d.id === downpipeId)
  if (!existing) return building
  const cleared = syncDownpipeNiches(building, {
    ...existing,
    mount: 'surface',
    breakDecor: false,
  }).building
  return {
    ...cleared,
    downpipes: (cleared.downpipes ?? []).filter((d) => d.id !== downpipeId),
  }
}

export function patchDownpipeInFacade(
  state: FacadeState,
  buildingId: string,
  downpipeId: string,
  patch: Partial<DownpipeFixture>,
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((b) => {
      if (b.id !== buildingId) return b
      const current = b.downpipes?.find((d) => d.id === downpipeId)
      if (!current) return b
      return upsertDownpipeInBuilding(b, { ...current, ...patch, id: downpipeId })
    }),
  }
}

export function addDownpipeToFacade(
  state: FacadeState,
  buildingId: string,
  dp: DownpipeFixture,
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((b) => {
      if (b.id !== buildingId) return b
      return upsertDownpipeInBuilding(b, dp)
    }),
  }
}

export function deleteDownpipeFromFacade(
  state: FacadeState,
  buildingId: string,
  downpipeId: string,
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((b) => {
      if (b.id !== buildingId) return b
      return removeDownpipeFromBuilding(b, downpipeId)
    }),
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function snapMasonry(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n / STUDIO_MASONRY) * STUDIO_MASONRY
}

/** Bibliotheks-ID für Fallrohr-Platzierung (kein Opening-Preset). */
export const DOWNPIPE_LIBRARY_PRESET_ID = 'downpipe-dn80'

export function isDownpipeLibraryPresetId(id: string | null | undefined): boolean {
  return id === DOWNPIPE_LIBRARY_PRESET_ID
}
