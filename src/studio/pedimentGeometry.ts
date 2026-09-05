import * as THREE from 'three'
import type { Opening, OpeningPediment, Wall } from '../types/facade'
import { resolveProfile } from '../profiles/registry'
import {
  createProfileSweepGeometry,
  createSimpleProfileBarGeometry,
  scaleProfileSectionAxes,
  type ProfilePath,
} from '../utils/profilePaths'
import { trimSectionScales } from '../utils/profileSectionExtents'
import {
  isStudioWall,
  studioProfileAnchorLocalZ,
  windowDepthForwardSign,
} from './walls'
import { studioWorkModeTileLocalZ } from './panelGeometry'
import { pedimentBaseLiftCm } from './openingProfileLift'
import {
  pedimentFormIsClosed,
  pedimentFormPoints,
  pedimentSegmentOutwards,
  pedimentSpanLocal,
  pedimentGableLayout,
  pedimentTympanumPoints,
  type PedimentVec2,
} from './pediment'

function pedimentLocalLayout(wall: Wall, opening: Opening, pediment: OpeningPediment) {
  const lift = pedimentBaseLiftCm(wall, opening, pediment)
  const layout = pedimentGableLayout(opening, pediment, lift)
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  return {
    ...layout,
    x0: layout.x0 - halfW,
    x1: layout.x1 - halfW,
    gableLeft: layout.gableLeft - halfW,
    gableRight: layout.gableRight - halfW,
    midX: layout.midX - halfW,
    yBase: layout.yBase - halfH,
  }
}

function makePedimentPath(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
  points: PedimentVec2[],
  closed: boolean,
): ProfilePath | null {
  if (points.length < 2) return null
  const studio = isStudioWall(wall)
  const profile = resolveProfile(pediment.profileId, undefined)
  const scales = profile?.section
    ? trimSectionScales(
        {
          scale: pediment.scale ?? 1,
          extentOutCm: pediment.extentOutCm,
          extentForwardCm: pediment.extentForwardCm,
        },
        profile.section,
      )
    : { outward: pediment.scale ?? 1, forward: pediment.scale ?? 1 }
  return {
    profileId: pediment.profileId,
    wallId: wall.id,
    openingId: opening.id,
    points,
    closed,
    outward: pedimentSegmentOutwards(points, closed),
    zOffset: 0,
    localSpace: studio,
    forwardSign: studio ? windowDepthForwardSign(wall) : 1,
    cornerJoin: 'miter',
    miterScaleMax: 2,
    color: pediment.color,
    sectionScale: scales.outward,
    sectionScaleForward: scales.forward,
    offsetForward: pediment.offsetForward ?? 0,
    capStart: !closed,
    capEnd: !closed,
  }
}

/**
 * Offene Formen: ein Sweep. Geschlossenes Dreieck: Closed-Loop mit Gehrung.
 * Geschlossenes Segment: Giebelbogen + Sturz getrennt — sonst sprengt der flache
 * Bogenfuß die Gehrung. Profil-Outward jeweils weg vom Tympanon.
 */
export function buildPedimentProfilePaths(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
): ProfilePath[] {
  if (!pediment.enabled || (opening.type !== 'window' && opening.type !== 'door')) return []
  if (opening.type === 'window' && opening.basementWindow?.enabled) return []
  const localLayout = pedimentLocalLayout(wall, opening, pediment)
  const form = pediment.form
  const closed = pedimentFormIsClosed(form)
  const points = pedimentFormPoints(form, localLayout)
  if (form === 'segmentClosed') {
    const gable = makePedimentPath(wall, opening, pediment, points, false)
    const lintel = makePedimentPath(
      wall,
      opening,
      pediment,
      [
        { x: localLayout.x1, y: localLayout.yBase },
        { x: localLayout.x0, y: localLayout.yBase },
      ],
      false,
    )
    return [gable, lintel].filter((path): path is ProfilePath => Boolean(path))
  }
  const path = makePedimentPath(wall, opening, pediment, points, closed)
  return path ? [path] : []
}

/** Erster Sweep-Pfad (Kompatibilität / einfache Aufrufer). */
export function buildPedimentProfilePath(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
): ProfilePath | null {
  return buildPedimentProfilePaths(wall, opening, pediment)[0] ?? null
}

function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null
  if (geometries.length === 1) return geometries[0]!
  const positions: number[] = []
  const normals: number[] = []
  for (const geo of geometries) {
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    if (!pos) continue
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      else normals.push(0, 0, 1)
    }
    geo.dispose()
  }
  if (positions.length < 9) return null
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.computeVertexNormals()
  return merged
}

export function createPedimentSweepGeometry(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
  opts?: { simpleBar?: boolean },
): THREE.BufferGeometry | null {
  const paths = buildPedimentProfilePaths(wall, opening, pediment)
  if (paths.length === 0) return null
  const profile = resolveProfile(pediment.profileId, undefined)
  if (!profile?.section) return null
  const parts: THREE.BufferGeometry[] = []
  for (const path of paths) {
    if (path.points.length < 2) continue
    const forwardSign = path.forwardSign ?? 1
    const section = scaleProfileSectionAxes(
      profile.section,
      path.sectionScale ?? 1,
      path.sectionScaleForward ?? path.sectionScale ?? 1,
    )
    const zBase = isStudioWall(wall)
      ? opts?.simpleBar
        ? studioWorkModeTileLocalZ(wall) + (path.offsetForward ?? 0) * forwardSign
        : studioProfileAnchorLocalZ(wall, path.offsetForward ?? 0)
      : wall.depth + (path.offsetForward ?? 0) * forwardSign
    parts.push(
      opts?.simpleBar
        ? createSimpleProfileBarGeometry(path, section, zBase, forwardSign, { flushBack: true })
        : createProfileSweepGeometry(path, section, zBase, forwardSign),
    )
  }
  return mergeBufferGeometries(parts)
}

/** Flache Tympanon-Platte hinter geschlossener Verdachung (kein Mauerwerk durchscheinend). */
export function createPedimentSealedBackGeometry(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
): THREE.BufferGeometry | null {
  if (!pediment.enabled || !pediment.sealedBack) return null
  if (!pedimentFormIsClosed(pediment.form)) return null
  if (opening.type !== 'window' && opening.type !== 'door') return null
  if (opening.type === 'window' && opening.basementWindow?.enabled) return null

  const local = pedimentLocalLayout(wall, opening, pediment)
  const pts = pedimentTympanumPoints(pediment.form, local)
  if (pts.length < 3) return null

  const shape = new THREE.Shape()
  shape.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i += 1) {
    shape.lineTo(pts[i]!.x, pts[i]!.y)
  }
  shape.closePath()

  const depth = 1.2
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  })
  // Platte knapp hinter dem Profil an der Wandfläche (kein Mauerwerk durchs Tympanon).
  const forwardSign = isStudioWall(wall) ? windowDepthForwardSign(wall) : 1
  const faceZ = isStudioWall(wall)
    ? studioProfileAnchorLocalZ(wall, pediment.offsetForward ?? 0)
    : wall.depth
  // Extrude +Z: bei positivem Forward an der Fläche starten und nach innen; sonst spiegeln.
  if (forwardSign >= 0) {
    geo.translate(0, 0, faceZ - depth - 0.3)
  } else {
    geo.scale(1, 1, -1)
    geo.translate(0, 0, faceZ + depth + 0.3)
  }
  return geo
}

function buildConsolePath(
  wall: Wall,
  opening: Opening,
  x: number,
  yBottom: number,
  yTop: number,
  profileId: string,
  color?: string,
): ProfilePath {
  const studio = isStudioWall(wall)
  return {
    profileId,
    wallId: wall.id,
    openingId: opening.id,
    points: [
      { x, y: yBottom },
      { x, y: yTop },
    ],
    closed: false,
    outward: [
      { x: 0, y: 1 },
      { x: 0, y: 1 },
    ],
    zOffset: 0,
    localSpace: studio,
    forwardSign: studio ? windowDepthForwardSign(wall) : 1,
    cornerJoin: 'miter',
    color,
    sectionScale: 1,
    capStart: true,
    capEnd: true,
  }
}

export function createPedimentConsoleGeometries(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
  opts?: { simpleBar?: boolean },
): THREE.BufferGeometry[] {
  const consoles = pediment.consoles
  if (!pediment.enabled || !consoles?.enabled || (opening.type !== 'window' && opening.type !== 'door')) {
    return []
  }
  if (opening.type === 'window' && opening.basementWindow?.enabled) return []
  const width = consoles.width ?? 16
  const height = consoles.height ?? 64
  const wallOffset = consoles.wallOffset ?? 0
  const profileId = consoles.profileId ?? 'traufgesims70x150'
  const profile = resolveProfile(profileId, undefined)
  if (!profile?.section) return []

  const { x0, x1, yBase } = pedimentSpanLocal(
    wall,
    opening,
    pediment,
    pedimentBaseLiftCm(wall, opening, pediment),
  )
  const forwardSign = isStudioWall(wall) ? windowDepthForwardSign(wall) : 1
  const zBase = isStudioWall(wall)
    ? opts?.simpleBar
      ? studioWorkModeTileLocalZ(wall)
      : studioProfileAnchorLocalZ(wall)
    : wall.depth
  const section = scaleProfileSectionAxes(profile.section, 1, 1)
  const yTop = yBase - wallOffset
  const yBottom = yTop - height
  const result: THREE.BufferGeometry[] = []
  const makeGeo = opts?.simpleBar
    ? (path: ProfilePath, sec: typeof section, z: number, sign: number) =>
        createSimpleProfileBarGeometry(path, sec, z, sign, { flushBack: true })
    : createProfileSweepGeometry

  for (const xStart of [x0, x1 - width]) {
    const path = buildConsolePath(
      wall,
      opening,
      xStart,
      yBottom,
      yTop,
      profileId,
      pediment.color,
    )
    const geo = makeGeo(path, section, zBase, forwardSign)
    if (geo) result.push(geo)
  }
  return result
}
