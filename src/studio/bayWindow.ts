import type { Opening, Wall } from '../types/facade'
import { WALL_DEPTH, WINDOW_HEIGHT, WINDOW_SILL_Y } from '../constants/presets'
import { createId } from '../utils/id'
import { createOpening } from '../utils/openings'
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

/** Fenster auf Erker-Wänden: Außenrand ≥ 24 cm, Abstand untereinander ≥ 48 cm. */
export const BAY_OPENING_MIN_MARGIN_CM = 24
export const BAY_OPENING_MIN_GAP_CM = 48
/** Standard-Fenster auf der Front (cm). */
export const BAY_FRONT_WINDOW_WIDTH_CM = 96
/** Erker-Tiefen in der Bibliothek (cm) — steuern die Schenkel-Fensterbreite. */
export const BAY_LIBRARY_DEPTHS_CM = [96, 144] as const
/** Frontbreiten in der Bibliothek (cm). */
export const BAY_LIBRARY_FRONTS_CM = [192, 288, 384, 576] as const

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
  /** Kurztext unter der Bibliothek-Karte (ohne Gruppenüberschrift). */
  cardLabel?: string
  /** Gruppenzeile in der Bibliothek, z. B. „90° · Tiefe 96“. */
  libraryGroup?: string
}

/** Ghost-Vorschau: feine Ellipsen-Polylinie (eine logische Wand beim Ablegen). */
export const ROUND_BAY_FACETS = 32

function buildBayLibraryPresets(): BayWindowPreset[] {
  const bays: BayWindowPreset[] = []
  for (const shape of ['rect', 'angled45'] as const) {
    const angleLabel = shape === 'rect' ? '90°' : '45°'
    const shapeKey = shape === 'rect' ? 'rect' : '45'
    for (const depthCm of BAY_LIBRARY_DEPTHS_CM) {
      for (const frontWidthCm of BAY_LIBRARY_FRONTS_CM) {
        bays.push({
          id: `bay-f${frontWidthCm}-d${depthCm}-${shapeKey}`,
          label: `Erker ${angleLabel} ${frontWidthCm}/${depthCm}`,
          cardLabel: String(frontWidthCm),
          libraryGroup: `${angleLabel} · Tiefe ${depthCm}`,
          frontWidthCm,
          depthCm,
          shape,
          kind: 'bay',
        })
      }
    }
  }
  return bays
}

export const BAY_WINDOW_PRESETS: BayWindowPreset[] = [
  ...buildBayLibraryPresets(),
  { id: 'balcony-192', label: 'Balkon 192', frontWidthCm: 192, depthCm: 96, shape: 'rect', kind: 'balcony' },
  { id: 'balcony-384', label: 'Balkon 384', frontWidthCm: 384, depthCm: 96, shape: 'rect', kind: 'balcony' },
  { id: 'loggia-192', label: 'Loggia 192', frontWidthCm: 192, depthCm: 144, shape: 'rect', kind: 'loggia' },
  { id: 'loggia-384', label: 'Loggia 384', frontWidthCm: 384, depthCm: 144, shape: 'rect', kind: 'loggia' },
]

/** Schenkel-Fenster: bei Tiefe 96 → 48 cm breit, ab 144 → 96 cm. */
export function baySideWindowWidthCm(depthCm: number): number {
  return depthCm >= 144 - 0.5 ? BAY_FRONT_WINDOW_WIDTH_CM : 48
}

/** Maximale Fensteranzahl bei Außenrand ≥ 24 und Abstand ≥ 48. */
export function maxBayWindowsOnWall(
  wallWidthCm: number,
  windowWidthCm: number,
  minMargin = BAY_OPENING_MIN_MARGIN_CM,
  minGap = BAY_OPENING_MIN_GAP_CM,
): number {
  if (windowWidthCm <= 0 || wallWidthCm < windowWidthCm + 2 * minMargin - 0.5) return 0
  let n = 1
  while (true) {
    const next = n + 1
    const need = next * windowWidthCm + (next - 1) * minGap + 2 * minMargin
    if (need > wallWidthCm + 0.5) return n
    n = next
  }
}

export interface BayOpeningLayout {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Fenster auf einer Wand zentriert packen: Abstand untereinander = 48 cm,
 * Rest gleichmäßig als Außenränder (≥ 24 cm).
 */
export function layoutBayOpeningsOnWall(
  wallWidthCm: number,
  windowWidthCm: number,
  opts?: { count?: number; height?: number; sillY?: number; minMargin?: number; minGap?: number },
): BayOpeningLayout[] {
  const height = opts?.height ?? WINDOW_HEIGHT
  const sillY = opts?.sillY ?? WINDOW_SILL_Y
  const minMargin = opts?.minMargin ?? BAY_OPENING_MIN_MARGIN_CM
  const minGap = opts?.minGap ?? BAY_OPENING_MIN_GAP_CM
  const max = maxBayWindowsOnWall(wallWidthCm, windowWidthCm, minMargin, minGap)
  const count = Math.min(opts?.count ?? max, max)
  if (count <= 0) return []
  const content = count * windowWidthCm + (count - 1) * minGap
  const margin = (wallWidthCm - content) / 2
  if (margin < minMargin - 0.5) return []
  const out: BayOpeningLayout[] = []
  for (let i = 0; i < count; i += 1) {
    out.push({
      x: margin + i * (windowWidthCm + minGap),
      y: sillY,
      width: windowWidthCm,
      height,
    })
  }
  return out
}

export function layoutBayFrontOpenings(frontWidthCm: number): BayOpeningLayout[] {
  return layoutBayOpeningsOnWall(frontWidthCm, BAY_FRONT_WINDOW_WIDTH_CM)
}

export function layoutBaySideOpenings(sideWidthCm: number, depthCm: number): BayOpeningLayout[] {
  return layoutBayOpeningsOnWall(sideWidthCm, baySideWindowWidthCm(depthCm), { count: 1 })
}

function openingsFromLayouts(wall: Wall, layouts: BayOpeningLayout[]): Opening[] {
  return layouts.map((layout) =>
    createOpening('window', layout.width, layout.height, wall, { x: layout.x, y: layout.y }),
  )
}

/** Echte, nachträglich editierbare Fenster auf Front- und Schenkelwänden. */
export function applyBayPresetOpenings(walls: Wall[], preset: BayWindowPreset): Wall[] {
  if (bayPresetKind(preset) !== 'bay') return walls
  return walls.map((wall) => {
    if (wall.bayRole === 'front') {
      return { ...wall, openings: openingsFromLayouts(wall, layoutBayFrontOpenings(wall.width)) }
    }
    if (wall.bayRole === 'side') {
      return {
        ...wall,
        openings: openingsFromLayouts(wall, layoutBaySideOpenings(wall.width, preset.depthCm)),
      }
    }
    return wall
  })
}

export function bayPresetKind(preset: Pick<BayWindowPreset, 'kind'>): BayKind {
  return preset.kind ?? 'bay'
}

/** Ansatzbreite am Parent / ersetzten Segment (Mundöffnung). */
export function bayMouthWidthCm(preset: Pick<BayWindowPreset, 'frontWidthCm' | 'depthCm' | 'shape'>): number {
  if (preset.shape === 'angled45') return preset.frontWidthCm + 2 * preset.depthCm
  return preset.frontWidthCm
}

/**
 * Preset so skalieren, dass die Mundöffnung `mouthCm` ist.
 * 90°/rund: Front = Mund. 45°: Schenkeltiefe bleibt, Front = Mund − 2×Tiefe.
 */
export function scaleBayPresetToMouthWidth(
  preset: BayWindowPreset,
  mouthCm: number,
): BayWindowPreset | null {
  if (!Number.isFinite(mouthCm) || mouthCm < 8 - 0.5) return null
  const mouth = Math.max(8, Math.round(mouthCm / 8) * 8)
  if (preset.shape === 'angled45') {
    const front = mouth - 2 * preset.depthCm
    if (front < 8 - 0.5) return null
    return { ...preset, frontWidthCm: Math.round(front / 8) * 8 }
  }
  return { ...preset, frontWidthCm: mouth }
}

/** Mindest-Segmentbreite für dieses Preset (45°: 2×Tiefe + 8 cm Front). */
export function bayMinMouthWidthCm(preset: Pick<BayWindowPreset, 'depthCm' | 'shape'>): number {
  if (preset.shape === 'angled45') return 2 * preset.depthCm + 8
  return 8
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

/** ±90° zur Laufrichtung, Richtung weg vom Erker-Schwerpunkt (Außenseite). */
function exteriorNormalAwayFromCentroid(
  along: { x: number; z: number },
  wallMid: { x: number; z: number },
  bayCentroid: { x: number; z: number },
): { x: number; z: number } {
  const away = { x: wallMid.x - bayCentroid.x, z: wallMid.z - bayCentroid.z }
  const cw = { x: along.z, z: -along.x }
  const ccw = { x: -along.z, z: along.x }
  const dotCw = cw.x * away.x + cw.z * away.z
  const dotCcw = ccw.x * away.x + ccw.z * away.z
  return dotCw >= dotCcw ? cw : ccw
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
  const angled = preset.shape === 'angled45'
  // 45°: Schenkel fest (Tiefe D entlang Fassade + nach außen) → Front = Ansatz − 2D.
  // 90°: Front = Ansatz = W (Schenkel senkrecht nach hinten, Länge D).
  const attachW = angled ? preset.frontWidthCm + 2 * preset.depthCm : preset.frontWidthCm
  const W = preset.frontWidthCm
  const D = preset.depthCm
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

  // Wie manuell gezeichnet (Vorlage v2.0.224): Planlinie im Umlauf Mund → Front → Mund.
  // Linker Schenkel Ansatz→Front, Front links→rechts, rechter Schenkel Front→Ansatz.
  // So haben alle drei Wände dasselbe `panelFlip`; kein Schenkelpaar teilt den Yaw,
  // und `unifyGroupFrontOrientation` kann keinen Schenkel nach innen kippen.
  const leftYaw = yawFromSegment(leftAttach, frontLeft)
  const frontYaw = yawFromSegment(frontLeft, frontRight)
  const rightYaw = yawFromSegment(frontRight, rightAttach)

  const leftAlong = wallAlongDelta(leftYaw, 1)
  const rightAlong = wallAlongDelta(rightYaw, 1)
  // Außennormale = Laufrichtung ±90°, zur Seite weg vom Erker-Zentrum.
  // Fest CW (az,-ax) ist nur bei panelFlip=true (Vorsprung −Z bei yaw 0) richtig;
  // bei panelFlip=false zeigt CW auf die Innenseite (Paneele innen).
  const bayCentroid = {
    x: (leftAttach.x + rightAttach.x + frontLeft.x + frontRight.x) / 4,
    z: (leftAttach.z + rightAttach.z + frontLeft.z + frontRight.z) / 4,
  }
  const leftMid = {
    x: (leftAttach.x + frontLeft.x) / 2,
    z: (leftAttach.z + frontLeft.z) / 2,
  }
  const rightMid = {
    x: (frontRight.x + rightAttach.x) / 2,
    z: (frontRight.z + rightAttach.z) / 2,
  }
  const leftOut = exteriorNormalAwayFromCentroid(leftAlong, leftMid, bayCentroid)
  const rightOut = exteriorNormalAwayFromCentroid(rightAlong, rightMid, bayCentroid)
  const frontOut = { x: out.x, z: out.z }

  const leftLen = dist2(leftAttach, frontLeft)
  const rightLen = dist2(rightAttach, frontRight)
  const frontLen = dist2(frontLeft, frontRight)

  const leftSide = mkChildWall(parent, leftAttach, leftYaw, leftLen, 'side', {
    panelFlip: panelFlipForExteriorNormal(leftYaw, leftOut),
  })
  const rightSide = mkChildWall(parent, frontRight, rightYaw, rightLen, 'side', {
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

  const withOpenings = applyBayPresetOpenings([leftSide, front, rightSide], preset)
  return { parent: updatedParent, walls: withOpenings }
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

/** `bayWindow`-Meta der Baugruppe — auch wenn nur ein Schenkel ausgewählt ist. */
export function bayMetaForWall(
  walls: Wall[],
  wall: Wall,
): NonNullable<Wall['bayWindow']> | null {
  if (wall.bayWindow?.wallIds?.length) return wall.bayWindow
  if (wall.bayParentId) {
    const parent = walls.find((item) => item.id === wall.bayParentId)
    if (parent?.bayWindow?.wallIds?.length) return parent.bayWindow
  }
  return null
}

/**
 * Alle Wand-IDs einer Erker-/Balkon-Baugruppe (die Flächen der Baugruppe).
 * Dedupliziert — bei Standalone-Erker ist die Front Host und steht bereits in `wallIds`.
 */
export function bayWallSelectionIds(
  walls: Wall[],
  wallId: string,
): string[] | null {
  const wall = walls.find((item) => item.id === wallId)
  if (!wall) return null
  const host =
    wall.bayWindow?.wallIds?.length
      ? wall
      : wall.bayParentId
        ? walls.find((item) => item.id === wall.bayParentId)
        : undefined
  const raw = host?.bayWindow?.wallIds
  if (!raw?.length) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    if (seen.has(id)) continue
    if (!walls.some((item) => item.id === id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.length > 0 ? out : null
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
    // Schenkel zeigen zur Außenseite (panelFlip) — bei Loggia nach innen.
    const outSign = (panelFlip ? 1 : -1) * (inward ? -1 : 1)
    const leftDir = wallAlongDelta(normalizeYawDeg(yawDeg + outSign * 45), sideLen)
    const rightDir = wallAlongDelta(normalizeYawDeg(yawDeg + outSign * 135), sideLen)
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
  const attachW = bayMouthWidthCm(preset)
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

/**
 * Bibliothek-Vorschau: Erker von draußen schräg oben-rechts (Isometrie).
 * Beide Schenkel sichtbar; Dachfläche kennzeichnet den Vorsprung.
 */
export function bayWindowPreviewSvg(preset: BayWindowPreset): string {
  const W = preset.frontWidthCm
  const D = preset.depthCm
  const angled = preset.shape === 'angled45'
  const kind = bayPresetKind(preset)
  const inward = kind === 'loggia'
  const H = kind === 'balcony' || kind === 'loggia' ? 88 : 176
  const zOut = inward ? -1 : 1

  const sideLen = angled ? D / Math.cos(Math.PI / 4) : D
  const L0 = { x: 0, z: 0 }
  const R0 = { x: angled ? W + 2 * D : W, z: 0 }
  const L1 = angled ? { x: D, z: zOut * D } : { x: 0, z: zOut * D }
  const R1 = angled ? { x: D + W, z: zOut * D } : { x: W, z: zOut * D }

  // Axonometrie von vorne-rechts-oben. Koeffizienten ≠ 1:1, damit 45°-Schenkel nicht kollabieren.
  const project = (x: number, y: number, z: number) => ({
    X: x * 0.92 - z * 0.55,
    Y: -y * 0.9 + x * 0.18 + z * 0.42,
  })

  type Pt = { X: number; Y: number }
  type XZ = { x: number; z: number }
  const samples: Pt[] = []

  const path = (pts: Pt[], fill: string, stroke = '#4a453e') => {
    for (const p of pts) samples.push(p)
    const d =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.X.toFixed(1)} ${p.Y.toFixed(1)}`).join(' ') + ' Z'
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>`
  }

  const centroid = {
    x: (L0.x + R0.x + L1.x + R1.x) / 4,
    z: (L0.z + R0.z + L1.z + R1.z) / 4,
  }

  const outwardXZ = (a: XZ, b: XZ): XZ => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len
    const uz = dz / len
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
    const away = { x: mid.x - centroid.x, z: mid.z - centroid.z }
    const cw = { x: uz, z: -ux }
    const ccw = { x: -uz, z: ux }
    return cw.x * away.x + cw.z * away.z >= ccw.x * away.x + ccw.z * away.z ? cw : ccw
  }

  const wallFace = (
    a: XZ,
    b: XZ,
    faceFill: string,
    windows: BayOpeningLayout[],
    wallLenCm: number,
  ): string => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len
    const uz = dz / len
    const n = outwardXZ(a, b)
    const face = [
      project(a.x, 0, a.z),
      project(b.x, 0, b.z),
      project(b.x, H, b.z),
      project(a.x, H, a.z),
    ]
    const parts = [path(face, faceFill)]
    const yScale = H / 456
    for (const win of windows) {
      const t0 = Math.max(0, Math.min(1, win.x / wallLenCm))
      const t1 = Math.max(0, Math.min(1, (win.x + win.width) / wallLenCm))
      const y0 = Math.max(8, win.y * yScale)
      const y1 = Math.min(H - 8, (win.y + win.height) * yScale)
      if (y1 <= y0 + 4) continue
      const e = 1.2
      parts.push(
        path(
          [
            project(a.x + ux * t0 * len + n.x * e, y0, a.z + uz * t0 * len + n.z * e),
            project(a.x + ux * t1 * len + n.x * e, y0, a.z + uz * t1 * len + n.z * e),
            project(a.x + ux * t1 * len + n.x * e, y1, a.z + uz * t1 * len + n.z * e),
            project(a.x + ux * t0 * len + n.x * e, y1, a.z + uz * t0 * len + n.z * e),
          ],
          '#8ebfd4',
          '#3d5a6a',
        ),
      )
    }
    return parts.join('')
  }

  const isBay = kind === 'bay'
  const frontWins = isBay ? layoutBayFrontOpenings(W) : []
  const sideWinsL = isBay ? layoutBaySideOpenings(sideLen, D) : []
  const sideWinsR = (isBay ? layoutBaySideOpenings(sideLen, D) : []).map((win) => ({
    ...win,
    x: Math.max(0, sideLen - win.x - win.width),
  }))

  const fillFacade = '#6e675f'
  const fillLeft = '#9a9186'
  const fillFront = '#e8e0d4'
  const fillRight = '#c4b9ac'
  const fillRoof = '#f3ebe0'

  const pad = Math.max(64, W * 0.16)
  const facade = [
    project(L0.x - pad, 0, 0),
    project(R0.x + pad, 0, 0),
    project(R0.x + pad, H, 0),
    project(L0.x - pad, H, 0),
  ]
  const roof = [
    project(L0.x, H, L0.z),
    project(L1.x, H, L1.z),
    project(R1.x, H, R1.z),
    project(R0.x, H, R0.z),
  ]

  // Painter: Fassade → linker Schenkel → Front → rechter Schenkel → Dach.
  const body = [
    path(facade, fillFacade, '#3a3631'),
    wallFace(L0, L1, fillLeft, sideWinsL, sideLen),
    wallFace(L1, R1, fillFront, frontWins, W),
    wallFace(R1, R0, fillRight, sideWinsR, sideLen),
    path(roof, fillRoof, '#5a554c'),
  ].join('')

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of samples) {
    minX = Math.min(minX, p.X)
    minY = Math.min(minY, p.Y)
    maxX = Math.max(maxX, p.X)
    maxY = Math.max(maxY, p.Y)
  }
  const m = 10
  const vbW = Math.max(8, maxX - minX) + m * 2
  const vbH = Math.max(8, maxY - minY) + m * 2
  return `<svg viewBox="${(minX - m).toFixed(1)} ${(minY - m).toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`
}
