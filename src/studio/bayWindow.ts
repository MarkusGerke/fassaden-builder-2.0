import type { Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { createId } from '../utils/id'
import { normalizeYawDeg } from './compass'
import {
  arcOuterBulgeZ,
  partialEllipseArcLength,
} from './arcWall'
import {
  createStudioWall,
  isStudioWall,
  normalizeStudioWall,
  panelFlipForExteriorNormal,
  wallAlongDelta,
  wallEndPoint,
  wallStartPoint,
} from './walls'

/** Vordere Brüstung bei Balkon/Loggia (cm). */
export const BAY_PARAPET_HEIGHT_CM = 96
export const BAY_PARAPET_DEPTH_CM = 16

/** Geometrische Grundform der Baugruppe. */
export type BayShape = 'rect' | 'angled45' | 'round'

/** Semantik in Bibliothek / Persistenz. */
export type BayKind = 'bay' | 'balcony' | 'loggia'

export interface BayWindowPreset {
  id: string
  label: string
  frontWidthCm: number
  depthCm: number
  shape: BayShape
  /** Default `bay` für Alt-Presets ohne Feld. */
  kind?: BayKind
}

/** Ghost-Vorschau: feine Ellipsen-Polylinie (eine logische Wand beim Ablegen). */
export const ROUND_BAY_FACETS = 32

export const BAY_WINDOW_PRESETS: BayWindowPreset[] = [
  // Erker: nur die beiden Bühnen-Formen (384er Front; 90° bzw. 45° nach hinten).
  { id: 'bay-384-rect', label: 'Erker 384', frontWidthCm: 384, depthCm: 144, shape: 'rect', kind: 'bay' },
  { id: 'bay-384-45', label: 'Erker 384 (45°)', frontWidthCm: 384, depthCm: 144, shape: 'angled45', kind: 'bay' },
  { id: 'balcony-192', label: 'Balkon 192', frontWidthCm: 192, depthCm: 96, shape: 'rect', kind: 'balcony' },
  { id: 'balcony-384', label: 'Balkon 384', frontWidthCm: 384, depthCm: 96, shape: 'rect', kind: 'balcony' },
  { id: 'loggia-192', label: 'Loggia 192', frontWidthCm: 192, depthCm: 144, shape: 'rect', kind: 'loggia' },
  { id: 'loggia-384', label: 'Loggia 384', frontWidthCm: 384, depthCm: 144, shape: 'rect', kind: 'loggia' },
]

export function bayPresetKind(preset: Pick<BayWindowPreset, 'kind'>): BayKind {
  return preset.kind ?? 'bay'
}

/** Ausrichtung nach außen senkrecht zur Wand (CCW). */
function outwardYaw(wall: Wall): number {
  return normalizeYawDeg((wall.yawDeg ?? 0) + ((wall.panelFlip ?? true) ? 90 : -90))
}

export function outwardYawDeg(yawDeg: number, panelFlip: boolean): number {
  return normalizeYawDeg(yawDeg + (panelFlip ? 90 : -90))
}

function copyWallOptics(from: Wall, to: Wall): Wall {
  return {
    ...to,
    panelFlip: to.panelFlip ?? from.panelFlip ?? true,
    wallColor: from.wallColor,
    interiorColor: from.interiorColor,
    claddingColor: from.claddingColor,
    profileColor: from.profileColor,
    panel: from.panel ? { ...from.panel } : to.panel,
    cornice: from.cornice ? { ...from.cornice } : to.cornice,
    height: to.height ?? from.height,
    depth: to.depth ?? from.depth ?? WALL_DEPTH,
  }
}

function outwardNormalFromPanelFlip(yawDeg: number, panelFlip: boolean): { x: number; z: number } {
  const yawRad = (yawDeg * Math.PI) / 180
  if (panelFlip) return { x: -Math.sin(yawRad), z: -Math.cos(yawRad) }
  return { x: Math.sin(yawRad), z: Math.cos(yawRad) }
}

export { panelFlipForExteriorNormal } from './walls'

function mkChildWall(
  parent: Wall,
  origin: { x: number; z: number },
  wallYaw: number,
  width: number,
  role: NonNullable<Wall['bayRole']>,
  opts?: { panelFlip?: boolean; height?: number; depth?: number; y?: number },
): Wall {
  const panelFlip = opts?.panelFlip ?? parent.panelFlip ?? true
  return copyWallOptics(
    parent,
    normalizeStudioWall({
      ...createStudioWall(origin.x, opts?.y ?? parent.y),
      id: createId(),
      originX: origin.x,
      originZ: origin.z,
      x: origin.x,
      yawDeg: wallYaw,
      width,
      height: opts?.height ?? parent.height,
      depth: opts?.depth ?? parent.depth ?? WALL_DEPTH,
      panelFlip,
      bayParentId: parent.id,
      bayRole: role,
      planLinked: true,
    }),
  )
}

function yawFromSegment(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return normalizeYawDeg((Math.atan2(-(b.z - a.z), b.x - a.x) * 180) / Math.PI)
}

function dist2(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Planlinie = Außenkante (nicht Mittellinie). Kein zusätzlicher half-depth-Versatz —
 * der würde Erker um eine halbe Wandstärke zu weit nach außen setzen und Gehrungen zerstören.
 */
function attachPointOnParent(
  parent: Wall,
  alongCm: number,
): { x: number; z: number } {
  const yaw = parent.yawDeg ?? 0
  const start = wallStartPoint(parent)
  const along = wallAlongDelta(yaw, alongCm)
  return { x: start.x + along.x, z: start.z + along.z }
}

function buildUShapeWalls(
  parent: Wall,
  preset: BayWindowPreset,
  attachAlongCenter: number | undefined,
  inward: boolean,
): { parent: Wall; walls: Wall[] } | null {
  const W = preset.frontWidthCm
  const D = preset.depthCm
  const angled = preset.shape === 'angled45'
  // 45°: Front = W, Ansatz am Parent = W+2D (Schenkel tragen je D entlang der Fassade).
  // 90°: Front = Ansatz = W (Schenkel senkrecht nach hinten).
  const attachW = angled ? W + 2 * D : W
  const center = attachAlongCenter ?? parent.width / 2
  const leftX = center - attachW / 2
  const rightX = center + attachW / 2
  if (leftX < -1 || rightX > parent.width + 1) return null

  const yaw = parent.yawDeg ?? 0
  const outSign = inward ? -1 : 1
  const out = wallAlongDelta(outwardYaw(parent), outSign)
  const along = wallAlongDelta(yaw, 1)

  // Ansatzpunkte auf der Parent-Planlinie (Außenkante).
  const leftAttach = attachPointOnParent(parent, leftX)
  const rightAttach = attachPointOnParent(parent, rightX)

  // Front-Ecken: 384er Wand „in der Mitte“, Schenkel gehen nach hinten zum Parent.
  const frontLeft = angled
    ? {
        x: leftAttach.x + along.x * D + out.x * D,
        z: leftAttach.z + along.z * D + out.z * D,
      }
    : {
        x: leftAttach.x + out.x * D,
        z: leftAttach.z + out.z * D,
      }
  const frontRight = angled
    ? {
        x: rightAttach.x - along.x * D + out.x * D,
        z: rightAttach.z - along.z * D + out.z * D,
      }
    : {
        x: rightAttach.x + out.x * D,
        z: rightAttach.z + out.z * D,
      }

  const isParapet = bayPresetKind(preset) === 'balcony' || bayPresetKind(preset) === 'loggia'

  // Wie manuell gezeichnet: Planlinie von Ecke zu Ecke, Außennormale vom Erker weg.
  const leftYaw = yawFromSegment(leftAttach, frontLeft)
  const frontYaw = yawFromSegment(frontLeft, frontRight)
  const rightYaw = yawFromSegment(rightAttach, frontRight)

  const leftAlong = wallAlongDelta(leftYaw, 1)
  const rightAlong = wallAlongDelta(rightYaw, 1)
  // Linke Außennormale: von der Erker-Innenfläche weg (nach links außen).
  const leftOut = { x: leftAlong.z, z: -leftAlong.x }
  // Rechte Außennormale: nach rechts außen.
  const rightOut = { x: -rightAlong.z, z: rightAlong.x }
  const frontOut = { x: out.x, z: out.z }

  const leftLen = dist2(leftAttach, frontLeft)
  const rightLen = dist2(rightAttach, frontRight)
  const frontLen = dist2(frontLeft, frontRight)

  const leftSide = mkChildWall(parent, leftAttach, leftYaw, leftLen, 'side', {
    panelFlip: panelFlipForExteriorNormal(leftYaw, leftOut),
  })
  const rightSide = mkChildWall(parent, rightAttach, rightYaw, rightLen, 'side', {
    panelFlip: panelFlipForExteriorNormal(rightYaw, rightOut),
  })
  const front = mkChildWall(parent, frontLeft, frontYaw, frontLen, 'front', {
    panelFlip: panelFlipForExteriorNormal(frontYaw, frontOut),
    height: isParapet ? BAY_PARAPET_HEIGHT_CM : parent.height,
    depth: isParapet ? BAY_PARAPET_DEPTH_CM : undefined,
  })

  const kind = bayPresetKind(preset)
  const updatedParent: Wall = {
    ...parent,
    bayWindow: {
      frontWidthCm: W,
      depthCm: D,
      shape: angled ? 'angled45' : 'rect',
      kind,
      wallIds: [leftSide.id, front.id, rightSide.id],
    },
  }
  leftSide.bayParentId = parent.id
  rightSide.bayParentId = parent.id
  front.bayParentId = parent.id

  return { parent: updatedParent, walls: [leftSide, front, rightSide] }
}

/**
 * Ellipsenbogen (kein Kreis): Halbachsen a = W/2 entlang der Wand, b = D nach außen.
 * φ von 0…π → Scheitel bei D, Endpunkte auf der Sehne.
 */
export function roundBayArcPoints(
  originX: number,
  originZ: number,
  yawDeg: number,
  panelFlip: boolean,
  frontWidthCm: number,
  depthCm: number,
  facets = ROUND_BAY_FACETS,
  inward = false,
): { x: number; z: number }[] {
  const W = Math.max(8, frontWidthCm)
  const D = Math.max(8, depthCm)
  const a = W / 2
  const b = D
  const along = wallAlongDelta(yawDeg, 1)
  const outSign = inward ? -1 : 1
  const out = wallAlongDelta(outwardYawDeg(yawDeg, panelFlip), outSign)
  const mid = {
    x: originX + along.x * a,
    z: originZ + along.z * a,
  }
  const pts: { x: number; z: number }[] = []
  for (let i = 0; i <= facets; i += 1) {
    const t = i / facets
    const phi = Math.PI * t
    const alongDist = -a * Math.cos(phi)
    const outDist = b * Math.sin(phi)
    pts.push({
      x: mid.x + along.x * alongDist + out.x * outDist,
      z: mid.z + along.z * alongDist + out.z * outDist,
    })
  }
  return pts
}

function buildRoundBayWalls(
  parent: Wall,
  preset: BayWindowPreset,
  attachAlongCenter: number | undefined,
  inward: boolean,
): { parent: Wall; walls: Wall[] } | null {
  const W = preset.frontWidthCm
  const D = preset.depthCm
  const center = attachAlongCenter ?? parent.width / 2
  const leftX = center - W / 2
  const rightX = center + W / 2
  if (leftX < -1 || rightX > parent.width + 1) return null

  const yaw = parent.yawDeg ?? 0
  const leftOrigin = attachPointOnParent(parent, leftX)
  const arcLength = partialEllipseArcLength(W / 2, D, Math.PI)
  const exteriorOut = wallAlongDelta(outwardYaw(parent), inward ? -1 : 1)
  const arcWall = mkChildWall(parent, leftOrigin, yaw, arcLength, 'arc', {
    panelFlip: panelFlipForExteriorNormal(yaw, exteriorOut),
  })
  arcWall.arcBay = { frontWidthCm: W, depthCm: D, inward }
  arcWall.planLinked = true
  const kind = bayPresetKind(preset)
  const updatedParent: Wall = {
    ...parent,
    bayWindow: {
      frontWidthCm: W,
      depthCm: D,
      shape: 'round',
      kind,
      wallIds: [arcWall.id],
    },
  }
  arcWall.bayParentId = parent.id
  arcWall.bayWindow = {
    frontWidthCm: W,
    depthCm: D,
    shape: 'round',
    kind,
    wallIds: [arcWall.id],
  }
  return { parent: updatedParent, walls: [arcWall] }
}

/**
 * Erzeugt Baugruppen-Wände an der Parent-Wand (Mitte oder freier Abschnitt).
 * Stile werden von der Parent-Wand übernommen.
 */
export function buildBayWindowWalls(
  parent: Wall,
  preset: BayWindowPreset,
  attachAlongCenter?: number,
): { parent: Wall; walls: Wall[] } | null {
  if (!isStudioWall(parent)) return null
  const inward = bayPresetKind(preset) === 'loggia'
  if (preset.shape === 'round') {
    return buildRoundBayWalls(parent, preset, attachAlongCenter, inward)
  }
  return buildUShapeWalls(parent, preset, attachAlongCenter, inward)
}

export function wallHasBay(wall: Wall): boolean {
  return Boolean(wall.bayWindow?.wallIds?.length)
}

export function isBayChildWall(wall: Wall): boolean {
  return Boolean(wall.bayParentId)
}

/** Alle Wand-IDs einer Erker-/Balkon-Baugruppe (Parent + Schenkel), falls zutreffend. */
export function bayWallSelectionIds(
  walls: Wall[],
  wallId: string,
): string[] | null {
  const wall = walls.find((item) => item.id === wallId)
  if (!wall) return null
  if (wall.bayParentId) {
    const parent = walls.find((item) => item.id === wall.bayParentId)
    const childIds = parent?.bayWindow?.wallIds
    if (parent && childIds?.length) {
      return [parent.id, ...childIds]
    }
  }
  if (wall.bayWindow?.wallIds?.length) {
    return [wall.id, ...wall.bayWindow.wallIds]
  }
  return null
}

export function bayWindowGhostSegments(
  originX: number,
  originZ: number,
  yawDeg: number,
  panelFlip: boolean,
  preset: BayWindowPreset,
): Array<{ ax: number; az: number; bx: number; bz: number }> {
  const W = preset.frontWidthCm
  const D = preset.depthCm
  const inward = bayPresetKind(preset) === 'loggia'
  if (preset.shape === 'round') {
    const pts = roundBayArcPoints(originX, originZ, yawDeg, panelFlip, W, D, ROUND_BAY_FACETS, inward)
    const segs: Array<{ ax: number; az: number; bx: number; bz: number }> = []
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]!
      const b = pts[i + 1]!
      segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z })
    }
    return segs
  }
  if (preset.shape === 'angled45') {
    const attachW = W + 2 * D
    const along = wallAlongDelta(yawDeg, attachW)
    const left = { x: originX, z: originZ }
    const right = { x: originX + along.x, z: originZ + along.z }
    const sideLen = D / Math.cos(Math.PI / 4)
    const leftDir = wallAlongDelta(
      normalizeYawDeg(yawDeg + (inward ? -45 : 45)),
      inward ? -sideLen : sideLen,
    )
    const rightDir = wallAlongDelta(
      normalizeYawDeg(yawDeg + (inward ? -135 : 135)),
      inward ? -sideLen : sideLen,
    )
    const leftOut = { x: left.x + leftDir.x, z: left.z + leftDir.z }
    const rightOut = { x: right.x + rightDir.x, z: right.z + rightDir.z }
    return [
      { ax: left.x, az: left.z, bx: leftOut.x, bz: leftOut.z },
      { ax: leftOut.x, az: leftOut.z, bx: rightOut.x, bz: rightOut.z },
      { ax: right.x, az: right.z, bx: rightOut.x, bz: rightOut.z },
    ]
  }
  const along = wallAlongDelta(yawDeg, W)
  const left = { x: originX, z: originZ }
  const right = { x: originX + along.x, z: originZ + along.z }
  const out = wallAlongDelta(outwardYawDeg(yawDeg, panelFlip), inward ? -D : D)
  const leftOut = { x: left.x + out.x, z: left.z + out.z }
  const rightOut = { x: right.x + out.x, z: right.z + out.z }
  return [
    { ax: left.x, az: left.z, bx: leftOut.x, bz: leftOut.z },
    { ax: leftOut.x, az: leftOut.z, bx: rightOut.x, bz: rightOut.z },
    { ax: right.x, az: right.z, bx: rightOut.x, bz: rightOut.z },
  ]
}

/** Baugruppe als eigenständige Form (ohne Parent-Wand), Optik optional von einer Vorlage. */
export function buildBayWindowAtPose(
  pose: {
    originX: number
    originZ: number
    y: number
    yawDeg: number
    panelFlip: boolean
    height?: number
  },
  preset: BayWindowPreset,
  styleFrom?: Wall,
): Wall[] {
  const kind = bayPresetKind(preset)
  const needsBackWall = kind === 'balcony' || kind === 'loggia'
  const height = pose.height ?? styleFrom?.height ?? virtualHeight(styleFrom)
  const depth = styleFrom?.depth ?? WALL_DEPTH
  const attachW =
    preset.shape === 'angled45' ? preset.frontWidthCm + 2 * preset.depthCm : preset.frontWidthCm
  const virtual: Wall = {
    ...createStudioWall(pose.originX, pose.y),
    id: createId(),
    originX: pose.originX,
    originZ: pose.originZ,
    x: pose.originX,
    yawDeg: pose.yawDeg,
    panelFlip: pose.panelFlip,
    width: attachW,
    height,
    depth: needsBackWall ? depth : 0,
    panel: styleFrom?.panel ? { ...styleFrom.panel } : undefined,
    cornice: styleFrom?.cornice ? { ...styleFrom.cornice } : undefined,
    wallColor: styleFrom?.wallColor,
    interiorColor: styleFrom?.interiorColor,
    claddingColor: styleFrom?.claddingColor,
    profileColor: styleFrom?.profileColor,
    bayRole: needsBackWall ? 'back' : undefined,
    planLinked: true,
  }
  const built = buildBayWindowWalls(virtual, preset, attachW / 2)
  if (!built) return []
  const host =
    needsBackWall
      ? virtual
      : built.walls.find((wall) => wall.bayRole === 'front' || wall.bayRole === 'arc') ??
        built.walls[Math.floor(built.walls.length / 2)] ??
        built.walls[0]!
  const bayMeta = {
    frontWidthCm: preset.frontWidthCm,
    depthCm: preset.depthCm,
    shape: preset.shape,
    kind,
    wallIds: needsBackWall
      ? [virtual.id, ...built.walls.map((w) => w.id)]
      : built.walls.map((w) => w.id),
  }
  const wallsOut: Wall[] = []
  if (needsBackWall) {
    wallsOut.push({
      ...virtual,
      bayParentId: undefined,
      bayWindow: bayMeta,
    })
  }
  for (const wall of built.walls) {
    const withDepth = {
      ...wall,
      depth: wall.bayRole === 'front' && (kind === 'balcony' || kind === 'loggia')
        ? BAY_PARAPET_DEPTH_CM
        : depth,
      planLinked: true,
      bayParentId: host.id,
    }
    if (!needsBackWall && wall.id === host.id) {
      wallsOut.push({
        ...withDepth,
        bayParentId: undefined,
        bayWindow: bayMeta,
      })
    } else {
      wallsOut.push(withDepth)
    }
  }
  return wallsOut
}

function virtualHeight(styleFrom?: Wall): number {
  return styleFrom?.height ?? 456
}
