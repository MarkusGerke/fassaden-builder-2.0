import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { resolveProfile } from '../profiles/registry'
import type { ProfileSectionPoint } from '../profiles/types'
import type { FacadeState, Opening, OpeningEdge, ProfileCornerJoin, SurfaceFinish, Wall } from '../types/facade'
import { resolveCladding } from '../meshes/catalog'
import { CLADDING_OFFSET_V1 } from '../constants/presets'
import {
  findAdjacentWall,
  isStudioWall,
  plinthProfileForwardBoost,
  plinthMiterEnds,
  corniceMiterEnds,
  studioFacadeOutwardLocalZ,
  wallEndPoint,
  wallHasPanels,
  wallStartPoint,
  PROFILE_BACK_CLEARANCE_CM,
} from '../studio/walls'
import { topBareBandForWall } from './wallLabel'
import {
  ARCH_MESH_SEGMENTS,
  openingPanelClearance,
  normalizeOpeningArch,
  openingArchPolyline,
  openingCutsWall,
  openingShowsGlazing,
  openingActsAsWindow,
  normalizeRevealFrame,
  openingMaskXRangesAtY,
  openingMaskYRangesAtX,
  openingMaskPolyline,
} from './openingGeometry'
import { resolveArchRiseForOpening } from './archForms'
import { miterInsetCm } from '../studio/floorPlan'
import { studioPlinthActive } from '../studio/constants'
import { wallCornice, wallHasCornice } from './cornice'
import { wallHasTrimBands, wallTrimBands } from './trimBands'
import { defaultOpeningTrimForProfile, normalizeOpeningSillOuter, outerSillUsesProfile, resolveOuterSillLayout } from './openings'
import { isWindowTrimProfile } from '../profiles/windowTrim'
import { trimSectionScales, profileSectionNativeExtents } from './profileSectionExtents'
import { basementWindowEnabled } from '../studio/basementWindow'
import { getAllWalls, getVisibleWalls } from './buildings'

export interface Vec2 {
  x: number
  y: number
}

export interface ProfilePath {
  profileId: string
  wallId: string
  openingId?: string
  points: Vec2[]
  closed: boolean
  outward: Vec2[]
  zOffset: number
  /**
   * Wenn true: Punkte liegen im Wand-Lokalraum (Wandmitte = Ursprung).
   * Das Mesh muss mit studioWallTransform positioniert und rotiert werden.
   */
  localSpace?: boolean
  /**
   * Vorzeichen der forward-Richtung: +1 = nach außen (panelFlip false),
   * −1 = nach innen (panelFlip true, Außenseite bei z=0).
   */
  forwardSign?: number
  cornerJoin?: ProfileCornerJoin
  /** Obergrenze für Gehrungs-Aufweitung an Ecken (Default 2). */
  miterScaleMax?: number
  offsetForward?: number
  rotationDeg?: number
  flipOutward?: boolean
  flipForward?: boolean
  color?: string
  /** Reflexion; fehlt → Wand-Profil-Oberfläche. */
  finish?: SurfaceFinish
  /** Skalierung des Querschnitts (Gesims). */
  sectionScale?: number
  /**
   * Horizontaler Gehrungsfaktor am Start/Ende (tan(φ/2)).
   * Sweep-X-Versatz = |lokales z| × Faktor — dieselbe Plan-Kante z = 0 wie `wallLocalX`.
   */
  planMiterStart?: number
  planMiterEnd?: number
  /**
   * @deprecated Sweep nutzt |z| × tan direkt. Feld wird ignoriert (Kompatibilität).
   */
  planMiterForwardBias?: number
  capStart?: boolean
  capEnd?: boolean
  /** Extra forward-Tiefe (cm) für Profilsweep — z. B. Sockelüberdeckung ohne Verschiebung. */
  forwardBoost?: number
  /**
   * Separate Vorwärts-Skalierung (Sockel: SVG-Breite = Tiefe).
   * Fehlt der Wert, gilt `sectionScale` für beide Achsen.
   */
  sectionScaleForward?: number
  /**
   * Sockel-Sturz: Querschnitt erst ab dieser Höhe (cm, nach sectionScale).
   * Pfad-Y liegt auf derselben Höhe — Profil umschließt Öffnungen unter der Sockeloberkante.
   * @deprecated 3D clippt den Sweep an der Öffnungsmaske (`clipOpeningMask`).
   */
  sectionClipBelowCm?: number
  /**
   * Sockelprofil: SVG-Sweep entlang der Wand; 3D zieht das Öffnungsvolumen ab
   * (gleiche Kontur wie Mauerwerk/Box-Sockel).
   */
  clipOpeningMask?: boolean
  /** Sohlbänke nutzen eigene 3D-Platzierung bzw. Querschnittsanker. */
  role?: 'sillOuter' | 'sillInner' | 'plinthProfile' | 'trimBand'
  /** Zierband-ID (für Picking / Selektion). */
  bandId?: string
  /** Gesims/Zierband auf nackter Wandfläche ohne Paneel-Vorstand. */
  useWallOuterFace?: boolean
}

interface RawSegment {
  profileId: string
  wallId: string
  a: Vec2
  b: Vec2
  outward: Vec2
  zOffset: number
}

const EPS = 0.05

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface RawSegmentExt extends RawSegment {
  edge?: OpeningEdge
  localSpace?: boolean
  forwardSign?: number
  openingId?: string
  cornerJoin?: ProfileCornerJoin
  offsetForward?: number
  rotationDeg?: number
  flipOutward?: boolean
  flipForward?: boolean
  color?: string
  finish?: SurfaceFinish
  forwardBoost?: number
  sectionScale?: number
  sectionScaleForward?: number
}

const ADJACENT_EDGES: Record<OpeningEdge, OpeningEdge[]> = {
  top: ['left', 'right'],
  bottom: ['left', 'right'],
  left: ['top', 'bottom'],
  right: ['top', 'bottom'],
}

function edgesMayJoin(a?: OpeningEdge, b?: OpeningEdge): boolean {
  if (!a || !b) return true
  if (a === b) return true
  return ADJACENT_EDGES[a].includes(b)
}

function openingTrimOffsets(opening: Opening): { ox: number; oy: number } {
  return {
    ox: opening.trim?.offsetX ?? 0,
    oy: opening.trim?.offsetY ?? 0,
  }
}

function openingEdgeSegment(
  wall: Wall,
  opening: Opening,
  edge: OpeningEdge,
): Omit<RawSegment, 'profileId' | 'zOffset' | 'wallId'> {
  const { ox, oy } = openingTrimOffsets(opening)
  // Studio: lokaler Raum (Wandmitte = 0/0). Modul: Welt-XY (wall.x + opening.x).
  const x = isStudioWall(wall)
    ? opening.x - wall.width / 2 + ox
    : wall.x + opening.x + ox
  const y = isStudioWall(wall)
    ? opening.y - wall.height / 2 + oy
    : wall.y + opening.y + oy
  const panel = wall.panel
  const plinthH =
    isStudioWall(wall) && panel && studioPlinthActive(panel) ? (panel.plinthHeight ?? 0) : 0
  const plinthTopY = isStudioWall(wall) ? -wall.height / 2 + plinthH + oy : wall.y + plinthH + oy
  const baseY = isStudioWall(wall)
    ? opening.type === 'door' && plinthH > 0.5
      ? plinthTopY
      : -wall.height / 2 + oy
    : wall.y + oy
  const width = opening.width
  const height = opening.height
  const bottomY =
    opening.type === 'door' && plinthH > 0.5 ? Math.max(y, plinthTopY) : y

  const arch = normalizeOpeningArch(opening.arch)
  const form = arch.form ?? 'rect'
  const rise = form === 'rect' ? 0 : resolveArchRiseForOpening(form, width, height, arch.riseCm)
  const springLocalY = y + height - rise

  switch (edge) {
    case 'top':
      return {
        a: { x, y: arch.enabled ? springLocalY : y + height },
        b: { x: x + width, y: arch.enabled ? springLocalY : y + height },
        outward: { x: 0, y: 1 },
      }
    case 'bottom':
      return {
        a: { x, y: bottomY },
        b: { x: x + width, y: bottomY },
        outward: { x: 0, y: -1 },
      }
    case 'left':
      return {
        a: { x, y: opening.type === 'door' ? baseY : y },
        b: { x, y: arch.enabled ? springLocalY : y + height },
        outward: { x: -1, y: 0 },
      }
    case 'right':
      return {
        a: { x: x + width, y: opening.type === 'door' ? baseY : y },
        b: { x: x + width, y: arch.enabled ? springLocalY : y + height },
        outward: { x: 1, y: 0 },
      }
  }
}

function profileZOffset(wall: Wall): number {
  // Studio-Wände: Anker über studioProfileAnchorLocalZ — kein Legacy-V1-Offset.
  if (isStudioWall(wall)) return 0
  return resolveCladding(wall)?.variant === 'v1' ? CLADDING_OFFSET_V1 : 0
}

function collectSegments(state: FacadeState): RawSegmentExt[] {
  const segments: RawSegmentExt[] = []
  const walls = getVisibleWalls(state)

  for (const wall of walls) {
    const zOffset = profileZOffset(wall)
    const studio = isStudioWall(wall)
    const forwardSign = studio ? (wall.panelFlip ? -1 : 1) : 1

    for (const assignment of wall.profiles) {
      const profile = resolveProfile(assignment.profileId, state.customProfiles)
      if (!profile?.projecting) continue
      const opening = wall.openings.find((item) => item.id === assignment.openingId)
      if (!opening || opening.hidden) continue
      if (
        !openingCutsWall(opening) &&
        !openingShowsGlazing(opening) &&
        !normalizeRevealFrame(opening.revealFrame).enabled
      ) {
        continue
      }
      if (basementWindowEnabled(opening)) continue
      if (
        assignment.edge === 'bottom' &&
        openingActsAsWindow(opening) &&
        opening.y > 0 &&
        opening.sillOuter?.enabled !== false
      ) {
        continue
      }
      if (opening.type === 'door' && assignment.edge === 'bottom') continue
      const trim = opening.trim
      const trimDefaults = isWindowTrimProfile(assignment.profileId)
        ? defaultOpeningTrimForProfile(assignment.profileId)
        : undefined
      const offsetForward = trim?.offsetForward ?? trimDefaults?.offsetForward ?? 0
      const forwardBoost = isStudioWall(wall) ? plinthProfileForwardBoost(wall, opening) : 0
      const scales = profile.section
        ? trimSectionScales(trim ?? trimDefaults, profile.section)
        : { outward: trim?.scale ?? 1, forward: trim?.scale ?? 1 }
      const common = {
        profileId: assignment.profileId,
        wallId: wall.id,
        edge: assignment.edge,
        zOffset,
        localSpace: studio,
        forwardSign,
        openingId: opening.id,
        cornerJoin: trim?.cornerJoin ?? trimDefaults?.cornerJoin ?? 'miter',
        offsetForward,
        rotationDeg: trim?.rotationDeg ?? 0,
        flipOutward: trim?.flipOutward ?? false,
        flipForward: trim?.flipForward ?? false,
        color: trim?.color ?? wall.profileColor,
        finish: trim?.finish ?? wall.profileFinish,
        forwardBoost,
        sectionScale: scales.outward,
        sectionScaleForward: scales.forward,
      }
      // Dekorative Öffnungsprofile folgen automatisch der Wandöffnungsform (`Opening.arch`).
      const arch = normalizeOpeningArch(opening.arch)
      if (assignment.edge === 'top' && arch.enabled) {
        const { ox, oy } = openingTrimOffsets(opening)
        const pts = openingArchPolyline(opening)
        for (let i = 0; i < pts.length - 1; i += 1) {
          const ax = isStudioWall(wall) ? pts[i].x - wall.width / 2 + ox : wall.x + pts[i].x + ox
          const ay = isStudioWall(wall) ? pts[i].y - wall.height / 2 + oy : wall.y + pts[i].y + oy
          const bx = isStudioWall(wall) ? pts[i + 1].x - wall.width / 2 + ox : wall.x + pts[i + 1].x + ox
          const by = isStudioWall(wall) ? pts[i + 1].y - wall.height / 2 + oy : wall.y + pts[i + 1].y + oy
          const cx = opening.x + opening.width / 2
          const cy = opening.y + opening.height / 2
          // Outward = Lot auf die Sehne, vom Öffnungsmittelpunkt weg (nicht Radial vom Rundbogen-Zentrum).
          let oxN = pts[i].y - pts[i + 1].y
          let oyN = pts[i + 1].x - pts[i].x
          const nLen = Math.hypot(oxN, oyN) || 1
          oxN /= nLen
          oyN /= nLen
          const midX = (pts[i].x + pts[i + 1].x) / 2
          const midY = (pts[i].y + pts[i + 1].y) / 2
          if (oxN * (midX - cx) + oyN * (midY - cy) < 0) {
            oxN = -oxN
            oyN = -oyN
          }
          segments.push({
            a: { x: ax, y: ay },
            b: { x: bx, y: by },
            outward: { x: oxN, y: oyN },
            ...common,
          })
        }
      } else {
        const edge = openingEdgeSegment(wall, opening, assignment.edge)
        segments.push({ ...edge, ...common })
      }
    }
  }

  return segments
}

function reverseSegment(segment: RawSegmentExt): RawSegmentExt {
  return {
    ...segment,
    a: segment.b,
    b: segment.a,
  }
}

function pathSegsToProfilePath(pathSegs: RawSegmentExt[]): ProfilePath {
  const closed = dist(pathSegs[0].a, pathSegs[pathSegs.length - 1].b) < EPS
  const points = [pathSegs[0].a, ...pathSegs.map((segment) => segment.b)]
  if (closed) points.pop()

  // Offener Bogen-Sturz (viele Top-Segmente): Stirnkappen wären horizontale
  // 12-cm-Scheiben auf Kämpferhöhe, die seitlich in den Ziegel greifen.
  const archTopOpen =
    !closed &&
    pathSegs.length > 1 &&
    pathSegs.every((segment) => segment.edge === 'top') &&
    Boolean(pathSegs[0].openingId)

  return {
    profileId: pathSegs[0].profileId,
    wallId: pathSegs[0].wallId,
    openingId: pathSegs[0].openingId,
    points,
    closed,
    outward: pathSegs.map((segment) => segment.outward),
    zOffset: pathSegs[0].zOffset,
    localSpace: pathSegs[0].localSpace,
    forwardSign: pathSegs[0].forwardSign,
    cornerJoin: pathSegs[0].cornerJoin,
    offsetForward: pathSegs[0].offsetForward,
    rotationDeg: pathSegs[0].rotationDeg,
    flipOutward: pathSegs[0].flipOutward,
    flipForward: pathSegs[0].flipForward,
    color: pathSegs[0].color,
    finish: pathSegs[0].finish,
    forwardBoost: pathSegs[0].forwardBoost,
    sectionScale: pathSegs[0].sectionScale,
    sectionScaleForward: pathSegs[0].sectionScaleForward,
    ...(archTopOpen ? { capStart: false, capEnd: false } : {}),
  }
}

/**
 * Verkettet Segmente wie bisher (gleiche Windung / sichtbare Vorderseiten),
 * aber nur an echten Öffnungsecken — nicht über fehlende Kanten hinweg.
 */
function chainPaths(segments: RawSegmentExt[]): ProfilePath[] {
  const remaining = [...segments]
  const paths: ProfilePath[] = []

  while (remaining.length > 0) {
    const pathSegs = [remaining.pop()!]
    let grew = true

    while (grew) {
      grew = false
      const start = pathSegs[0]
      const end = pathSegs[pathSegs.length - 1]
      const startPt = start.a
      const endPt = end.b

      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i]
        if (candidate.profileId !== start.profileId) continue

        const joinEnd = edgesMayJoin(end.edge, candidate.edge)
        const joinStart = edgesMayJoin(start.edge, candidate.edge)

        if (joinEnd && dist(candidate.a, endPt) < EPS) {
          pathSegs.push(candidate)
        } else if (joinEnd && dist(candidate.b, endPt) < EPS) {
          pathSegs.push(reverseSegment(candidate))
        } else if (joinStart && dist(candidate.b, startPt) < EPS) {
          pathSegs.unshift(candidate)
        } else if (joinStart && dist(candidate.a, startPt) < EPS) {
          pathSegs.unshift(reverseSegment(candidate))
        } else {
          continue
        }

        remaining.splice(i, 1)
        grew = true
        break
      }
    }

    if (pathSegs.length === 0) continue
    const path = pathSegsToProfilePath(pathSegs)
    if (path.points.length >= 2) paths.push(path)
  }

  return paths
}

function groupOpeningSegments(segments: RawSegmentExt[]): RawSegmentExt[][] {
  const groups = new Map<string, RawSegmentExt[]>()
  for (const segment of segments) {
    const key = [
      segment.wallId,
      segment.openingId ?? '',
      segment.profileId,
      segment.zOffset,
      segment.localSpace ? 1 : 0,
      segment.forwardSign ?? 1,
      segment.cornerJoin ?? 'miter',
      segment.offsetForward ?? 0,
      segment.rotationDeg ?? 0,
      segment.flipOutward ? 1 : 0,
      segment.flipForward ? 1 : 0,
      segment.color ?? '',
      segment.forwardBoost ?? 0,
    ].join('|')
    const list = groups.get(key) ?? []
    list.push(segment)
    groups.set(key, list)
  }
  return [...groups.values()]
}

function unitXZ(
  from: { x: number; z: number },
  to: { x: number; z: number },
): { dx: number; dz: number } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz) || 1
  return { dx: dx / length, dz: dz / length }
}

function pointsClose(
  a: { x: number; z: number },
  b: { x: number; z: number },
): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) <= 2
}

function cornicePlanMiterTan(wall: Wall, adjacent: Wall, end: 'start' | 'end'): number {
  const stored = end === 'start' ? (wall.miterStart ?? 0) : (wall.miterEnd ?? 0)
  const depth = Math.max(wall.depth, 1e-6)
  if (Math.abs(stored) > 0.05) return stored / depth

  const start = wallStartPoint(wall)
  const finish = wallEndPoint(wall)
  const corner = end === 'start' ? start : finish
  const alongWall = end === 'start' ? finish : start
  const outgoing = unitXZ(corner, alongWall)

  const adjStart = wallStartPoint(adjacent)
  const adjEnd = wallEndPoint(adjacent)
  const adjOther = pointsClose(corner, adjStart) ? adjEnd : adjStart
  const incoming = unitXZ(adjOther, corner)
  return Math.abs(miterInsetCm(incoming, outgoing, 1))
}

/** Sweep: x += z × planMiter mit planMiter = −tan(Knick/2) (vorzeichenbehaftet). */
function pictureFramePlanMiter(tan: number, _end?: 'start' | 'end'): number {
  return -tan
}

function corniceEndJoin(
  wall: Wall,
  end: 'start' | 'end',
  walls: Wall[],
): { miter: number; cap: boolean } {
  const edge = wallCornice(wall).edge ?? 'top'
  if (isStudioWall(wall)) {
    const allowed = corniceMiterEnds(wall, walls)
    const canMiter = end === 'start' ? allowed.start : allowed.end
    if (!canMiter) return { miter: 0, cap: true }
    const adjacent = findAdjacentWall(wall, end, walls)
    if (!adjacent) return { miter: 0, cap: true }
    return {
      miter: cornicePlanMiterTan(wall, adjacent, end),
      cap: !wallHasCornice(adjacent, edge),
    }
  }
  const side = end === 'start' ? 'left' : 'right'
  const adjacentId = wall.neighbors[side]
  const adjacent = adjacentId ? walls.find((item) => item.id === adjacentId) : undefined
  if (!adjacent || !wallHasCornice(adjacent, edge)) return { miter: 0, cap: true }
  return { miter: 0, cap: false }
}

function buildCornicePaths(state: FacadeState): ProfilePath[] {
  const paths: ProfilePath[] = []
  const allWalls = getAllWalls(state)
  const visibleIds = new Set(getVisibleWalls(state).map((wall) => wall.id))

  for (const wall of allWalls) {
    if (!visibleIds.has(wall.id)) continue
    if (!wallHasCornice(wall)) continue
    const cornice = wallCornice(wall)
    const profile = resolveProfile(cornice.profileId ?? 'traufgesims70x150', state.customProfiles)
    if (!profile?.projecting || !profile.section) continue

    const studio = isStudioWall(wall)
    const edgeY = studio
      ? cornice.edge === 'bottom'
        ? -wall.height / 2
        : wall.height / 2
      : cornice.edge === 'bottom'
        ? wall.y
        : wall.y + wall.height
    const x0 = studio ? -wall.width / 2 : wall.x
    const x1 = studio ? wall.width / 2 : wall.x + wall.width
    const start = corniceEndJoin(wall, 'start', allWalls)
    const end = corniceEndJoin(wall, 'end', allWalls)
    const topBare = topBareBandForWall(wall)
    const useWallOuterFace =
      !wallHasPanels(wall) ||
      (cornice.edge === 'top' && topBare !== null)

    paths.push({
      profileId: cornice.profileId ?? 'traufgesims70x150',
      wallId: wall.id,
      points: [
        { x: x0, y: edgeY },
        { x: x1, y: edgeY },
      ],
      closed: false,
      outward: [{ x: 0, y: cornice.edge === 'bottom' ? 1 : -1 }],
      zOffset: profileZOffset(wall),
      localSpace: studio,
      forwardSign: studio ? (wall.panelFlip ? -1 : 1) : 1,
      cornerJoin: 'none',
      color: cornice.color ?? wall.profileColor,
      finish: cornice.finish ?? wall.profileFinish,
      sectionScale: cornice.scale,
      sectionScaleForward: cornice.sectionScaleForward ?? cornice.scale,
      rotationDeg: cornice.rotationDeg ?? 0,
      flipOutward: cornice.flipOutward ?? false,
      flipForward: cornice.flipForward ?? false,
      offsetForward: cornice.offsetForward ?? 0,
      planMiterStart: pictureFramePlanMiter(start.miter, 'start'),
      planMiterEnd: pictureFramePlanMiter(end.miter, 'end'),
      capStart: start.cap,
      capEnd: end.cap,
      useWallOuterFace,
    })
  }

  return paths
}

function openingFrameProfileOutwardCm(
  wall: Wall,
  opening: Opening,
  customProfiles: FacadeState['customProfiles'],
): number {
  let extra = 0
  for (const assignment of wall.profiles) {
    if (assignment.openingId !== opening.id) continue
    const profile = resolveProfile(assignment.profileId, customProfiles)
    if (!profile?.section) continue
    const scales = trimSectionScales(opening.trim, profile.section)
    extra = Math.max(extra, profileSectionNativeExtents(profile.section).outward * scales.outward)
  }
  return extra
}

function unionXRanges(ranges: Array<{ x0: number; x1: number }>): Array<{ x0: number; x1: number }> {
  const sorted = [...ranges].sort((a, b) => a.x0 - b.x0)
  const out: Array<{ x0: number; x1: number }> = []
  for (const range of sorted) {
    const last = out[out.length - 1]
    if (!last || range.x0 > last.x1 + 0.5) {
      out.push({ x0: range.x0, x1: range.x1 })
    } else {
      last.x1 = Math.max(last.x1, range.x1)
    }
  }
  return out
}

/**
 * Zierband-Löcher: Öffnungsmaske auf Bandhöhe (Bogen/Stadion wie Paneele),
 * plus Aufweitung um Rahmenprofil-Outward.
 */
export function trimBandOpeningXHoles(
  wall: Wall,
  bandYLocal: number,
  bandOutwardCm = 0,
  hangDown = true,
  customProfiles?: FacadeState['customProfiles'],
): Array<{ x0: number; x1: number }> {
  const yLo = hangDown ? bandYLocal - Math.max(0, bandOutwardCm) : bandYLocal
  const yHi = hangDown ? bandYLocal : bandYLocal + Math.max(0, bandOutwardCm)
  const holes: Array<{ x0: number; x1: number }> = []
  for (const opening of wall.openings) {
    if (opening.hidden) continue
    const clearance = openingPanelClearance(opening)
    const inflate = clearance + openingFrameProfileOutwardCm(wall, opening, customProfiles)
    let y0 = opening.y - inflate
    let y1 = opening.y + opening.height + inflate
    if (opening.type === 'door' && opening.stairs?.enabled) {
      y0 = -inflate
      y1 = opening.y + opening.height + inflate
    }
    if (yHi < y0 - 0.5 || yLo > y1 + 0.5) continue
    const spanLo = Math.max(yLo, y0)
    const spanHi = Math.min(yHi, y1)
    const samples = Math.max(1, Math.ceil((spanHi - spanLo) / 2))
    for (let s = 0; s <= samples; s += 1) {
      const y = samples === 0 ? bandYLocal : spanLo + ((spanHi - spanLo) * s) / samples
      for (const range of openingMaskXRangesAtY(opening, y, inflate)) {
        holes.push({
          x0: Math.max(0, range.x0),
          x1: Math.min(wall.width, range.x1),
        })
      }
    }
    if (opening.type === 'door' && opening.stairs?.enabled && yLo < opening.y) {
      const gapX = inflate > 0.05 ? inflate : PLINTH_OPENING_GAP
      holes.push({
        x0: Math.max(0, opening.x - gapX),
        x1: Math.min(wall.width, opening.x + opening.width + gapX),
      })
    }
  }
  return unionXRanges(holes.filter((hole) => hole.x1 - hole.x0 > 0.5))
}

function trimBandMiterEnds(wall: Wall, walls: Wall[]): { start: boolean; end: boolean } {
  const join = wall.panel?.cornerJoin ?? 'miter'
  const startAdj = findAdjacentWall(wall, 'start', walls)
  const endAdj = findAdjacentWall(wall, 'end', walls)
  if (join === 'none') {
    return {
      start: Boolean(startAdj && wallHasTrimBands(startAdj)),
      end: Boolean(endAdj && wallHasTrimBands(endAdj)),
    }
  }
  return {
    start: Boolean(startAdj),
    end: Boolean(endAdj),
  }
}

function buildTrimBandPaths(state: FacadeState): ProfilePath[] {
  const paths: ProfilePath[] = []
  const allWalls = getAllWalls(state)
  const visibleIds = new Set(getVisibleWalls(state).map((wall) => wall.id))

  for (const wall of allWalls) {
    if (!visibleIds.has(wall.id)) continue
    if (!wallHasTrimBands(wall)) continue
    const studio = isStudioWall(wall)
    const miterEnds = trimBandMiterEnds(wall, allWalls)
    for (const band of wallTrimBands(wall)) {
      if (band.enabled === false) continue
      const profile = resolveProfile(band.profileId ?? 'traufgesims70x150', state.customProfiles)
      if (!profile?.projecting || !profile.section) continue
      const yLocal = Math.max(0, Math.min(wall.height, band.yFromBottom))
      const edgeY = studio ? yLocal - wall.height / 2 : wall.y + yLocal
      const xStart = studio ? -wall.width / 2 : wall.x
      const xEnd = studio ? wall.width / 2 : wall.x + wall.width
      const nativeOut = profile.section
        ? profileSectionNativeExtents(profile.section).outward * (band.scale ?? 1)
        : 0
      const hangDown = !(band.flipOutward ?? false)
      const holes = studio
        ? trimBandOpeningXHoles(wall, yLocal, nativeOut, hangDown, state.customProfiles).map(
            (hole) => ({
              x0: hole.x0 - wall.width / 2,
              x1: hole.x1 - wall.width / 2,
            }),
          )
        : trimBandOpeningXHoles(wall, yLocal, nativeOut, hangDown, state.customProfiles)
      const spans = subtractXRanges(xStart, xEnd, holes)
      const startAdj =
        miterEnds.start && spans[0] && spans[0].x0 <= xStart + 0.5
          ? findAdjacentWall(wall, 'start', allWalls)
          : undefined
      const endAdj =
        miterEnds.end && spans[spans.length - 1] && spans[spans.length - 1]!.x1 >= xEnd - 0.5
          ? findAdjacentWall(wall, 'end', allWalls)
          : undefined
      const startMiter = startAdj ? cornicePlanMiterTan(wall, startAdj, 'start') : 0
      const endMiter = endAdj ? cornicePlanMiterTan(wall, endAdj, 'end') : 0
      const topBare = topBareBandForWall(wall)
      const useWallOuterFace =
        !wallHasPanels(wall) || (topBare !== null && yLocal >= topBare.yMin - 0.5)

      for (const span of spans) {
        const atStart = span.x0 <= xStart + 0.5
        const atEnd = span.x1 >= xEnd - 0.5
        paths.push({
          profileId: band.profileId ?? 'traufgesims70x150',
          wallId: wall.id,
          role: 'trimBand',
          bandId: band.id,
          points: [
            { x: span.x0, y: edgeY },
            { x: span.x1, y: edgeY },
          ],
          closed: false,
          outward: [{ x: 0, y: -1 }],
          zOffset: profileZOffset(wall),
          localSpace: studio,
          forwardSign: studio ? (wall.panelFlip ? -1 : 1) : 1,
          cornerJoin: 'none',
          color: band.color ?? wall.profileColor,
          sectionScale: band.scale,
          sectionScaleForward: band.sectionScaleForward ?? band.scale ?? 1,
          rotationDeg: band.rotationDeg ?? 0,
          flipOutward: band.flipOutward ?? false,
          flipForward: band.flipForward ?? false,
          offsetForward: band.offsetForward ?? 0,
          planMiterStart: atStart && startAdj ? pictureFramePlanMiter(startMiter, 'start') : 0,
          planMiterEnd: atEnd && endAdj ? pictureFramePlanMiter(endMiter, 'end') : 0,
          capStart: !startAdj || !atStart,
          capEnd: !endAdj || !atEnd,
          useWallOuterFace,
        })
      }
    }
  }
  return paths
}

function subtractXRanges(
  start: number,
  end: number,
  holes: Array<{ x0: number; x1: number }>,
): Array<{ x0: number; x1: number }> {
  let spans = [{ x0: start, x1: end }]
  const sorted = [...holes].sort((a, b) => a.x0 - b.x0)
  for (const hole of sorted) {
    const next: typeof spans = []
    for (const span of spans) {
      const cut0 = Math.max(span.x0, hole.x0)
      const cut1 = Math.min(span.x1, hole.x1)
      if (cut1 <= cut0) {
        next.push(span)
        continue
      }
      if (cut0 > span.x0 + 0.5) next.push({ x0: span.x0, x1: cut0 })
      if (cut1 < span.x1 - 0.5) next.push({ x0: cut1, x1: span.x1 })
    }
    spans = next
  }
  return spans.filter((span) => span.x1 - span.x0 > 1)
}

const PLINTH_OPENING_GAP = 1

/** Öffnungs-Rechteck im Sockel (inkl. Freiraum), Wand-Koordinaten. */
function plinthOpeningClipRect(
  wall: Wall,
  opening: Opening,
): { x0: number; x1: number; y0: number; y1: number } | null {
  if (opening.hidden) return null
  let y = opening.y
  let height = opening.height
  if (opening.type === 'door' && opening.stairs?.enabled) {
    height = opening.y + opening.height
    y = 0
  }
  const clearance = openingPanelClearance(opening)
  const gapX = clearance > 0.05 ? clearance : PLINTH_OPENING_GAP
  const gapY = clearance > 0.05 ? clearance : 0
  return {
    x0: Math.max(0, opening.x - gapX),
    x1: Math.min(wall.width, opening.x + opening.width + gapX),
    y0: y - gapY,
    y1: y + height + gapY,
  }
}

/** Öffnungen im Sockelstreifen (y = 0 … plinthH) als X-Löcher (Wand-X 0…width). */
function plinthOpeningXHoles(wall: Wall, plinthH: number): Array<{ x0: number; x1: number }> {
  const holes: Array<{ x0: number; x1: number }> = []
  for (const opening of wall.openings) {
    const rect = plinthOpeningClipRect(wall, opening)
    if (!rect) continue
    if (rect.y0 >= plinthH || rect.y1 <= 0) continue
    // Volle Bounding-Breite: erhöhte Füll-Spannen (Sturz/Zwickel) setzen die Bogenform zurück.
    holes.push({ x0: rect.x0, x1: rect.x1 })
  }
  return holes
}

/** Sichtbare Sockel-X-Spannen zwischen Öffnungen (volle Profilhöhe). */
export function plinthVisibleXSpans(wall: Wall, plinthH: number): Array<{ x0: number; x1: number }> {
  return subtractXRanges(0, wall.width, plinthOpeningXHoles(wall, plinthH))
}

/**
 * Erhöhte Sockel-Füllungen über/neben der Öffnungsmaske (Sturz + Bogenzwickel).
 * Y-Samples: überall in der Öffnungs-AABB, wo die Maske enger ist als das Rechteck
 * (oder darüber leer), entsteht eine Füll-Spanne — einmal pro X bis zur Sockeloberkante.
 */
export function plinthLintelSpans(
  wall: Wall,
  plinthH: number,
): Array<{ x0: number; x1: number; y0: number }> {
  const spans: Array<{ x0: number; x1: number; y0: number }> = []
  const step = 4
  for (const opening of wall.openings) {
    const rect = plinthOpeningClipRect(wall, opening)
    if (!rect) continue
    if (rect.y0 >= plinthH || rect.y1 <= 0) continue
    if (rect.y1 >= plinthH - 0.5) continue
    if (rect.x1 - rect.x0 < 1) continue

    const clearance = openingPanelClearance(opening)
    const inflate = clearance > 0.05 ? clearance : PLINTH_OPENING_GAP
    const filledX: Array<{ x0: number; x1: number }> = []

    for (let y = 0; y < plinthH - 0.5; y += step) {
      const ySample = Math.min(y + step * 0.5, plinthH - 0.25)
      if (ySample < rect.y0 - 0.25) continue

      const rawHoles = openingMaskXRangesAtY(opening, ySample, inflate)
        .map((h) => ({
          x0: Math.max(rect.x0, Math.max(0, h.x0)),
          x1: Math.min(rect.x1, Math.min(wall.width, h.x1)),
        }))
        .filter((h) => h.x1 - h.x0 > 0.5)

      // Maske trifft → Loch. Keine X-Ranges (über dem Scheitel / außerhalb) → fest.
      const solids = subtractXRanges(rect.x0, rect.x1, rawHoles)
      for (const solid of solids) {
        if (solid.x1 - solid.x0 < 1) continue
        const uncovered = subtractXRanges(solid.x0, solid.x1, filledX)
        for (const piece of uncovered) {
          if (piece.x1 - piece.x0 < 1) continue
          spans.push({ x0: piece.x0, x1: piece.x1, y0: Math.max(0, y) })
          filledX.push({ x0: piece.x0, x1: piece.x1 })
        }
      }
    }
  }
  return spans
}

/**
 * Querschnitt ab `clipBelowCm` (bereits skaliert): Sockel-Sturz über einer Öffnung.
 * Outward wird so verschoben, dass der Sweep-Pfad auf der Sturzunterkante sitzt.
 */
export function clipProfileSectionAboveCm(
  section: ProfileSectionPoint[],
  clipBelowCm: number,
): ProfileSectionPoint[] {
  if (!(clipBelowCm > 0.05) || section.length < 2) return section
  const maxOut = section.reduce((m, p) => Math.max(m, p.outward), 0)
  if (clipBelowCm >= maxOut - 0.05) return []

  const first = section[0]!
  const last = section[section.length - 1]!
  const closed =
    Math.hypot(first.outward - last.outward, first.forward - last.forward) < 0.05
  const pts = closed ? section.slice(0, -1) : section
  if (pts.length < 2) return []

  const samples: ProfileSectionPoint[] = []
  const push = (outward: number, forward: number) => {
    const prev = samples[samples.length - 1]
    if (prev && Math.abs(prev.outward - outward) < 1e-6 && Math.abs(prev.forward - forward) < 1e-6) {
      return
    }
    samples.push({ outward, forward })
  }

  const above = (p: ProfileSectionPoint) => p.outward >= clipBelowCm - 1e-6
  const edgeCount = pts.length
  for (let i = 0; i < edgeCount; i += 1) {
    const a = pts[i]!
    const b = pts[(i + 1) % edgeCount]!
    const aOk = above(a)
    const bOk = above(b)
    if (aOk && bOk) {
      push(a.outward - clipBelowCm, a.forward)
    } else if (aOk && !bOk) {
      push(a.outward - clipBelowCm, a.forward)
      const denom = b.outward - a.outward
      const t = Math.abs(denom) < 1e-9 ? 0 : (clipBelowCm - a.outward) / denom
      push(0, a.forward + t * (b.forward - a.forward))
    } else if (!aOk && bOk) {
      const denom = b.outward - a.outward
      const t = Math.abs(denom) < 1e-9 ? 0 : (clipBelowCm - a.outward) / denom
      push(0, a.forward + t * (b.forward - a.forward))
    }
  }

  if (samples.length < 2) return []
  if (closed) {
    const s0 = samples[0]!
    const sN = samples[samples.length - 1]!
    if (Math.hypot(s0.outward - sN.outward, s0.forward - sN.forward) > 1e-4) {
      samples.push({ ...s0 })
    }
  }
  return samples
}

function mergeYRanges(ranges: Array<{ y0: number; y1: number }>): Array<{ y0: number; y1: number }> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.y0 - b.y0)
  const out: Array<{ y0: number; y1: number }> = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.y0 <= last.y1 + 0.25) last.y1 = Math.max(last.y1, cur.y1)
    else out.push({ ...cur })
  }
  return out
}

function plinthOpeningInflate(opening: Opening): number {
  const clearance = openingPanelClearance(opening)
  return clearance > 0.05 ? clearance : PLINTH_OPENING_GAP
}

/** Öffnungslöcher im Sockelstreifen auf Wand-X (Y von 0 = Boden). */
export function plinthHoleYRangesAtX(wall: Wall, x: number, plinthH: number): Array<{ y0: number; y1: number }> {
  const ranges: Array<{ y0: number; y1: number }> = []
  for (const opening of wall.openings) {
    if (opening.hidden) continue
    const inflate = plinthOpeningInflate(opening)
    const probe =
      opening.type === 'door' && opening.stairs?.enabled
        ? { ...opening, y: 0, height: opening.y + opening.height }
        : opening
    for (const hole of openingMaskYRangesAtX(probe, x, inflate)) {
      const y0 = Math.max(0, hole.y0)
      const y1 = Math.min(plinthH, hole.y1)
      if (y1 - y0 > 0.25) ranges.push({ y0, y1 })
    }
  }
  return mergeYRanges(ranges)
}

function clipSectionByOutward(
  section: ProfileSectionPoint[],
  y: number,
  keep: 'le' | 'ge',
): ProfileSectionPoint[] {
  if (section.length < 2) return []
  const first = section[0]!
  const last = section[section.length - 1]!
  const closed =
    Math.hypot(first.outward - last.outward, first.forward - last.forward) < 0.05
  const pts = closed ? section.slice(0, -1) : section
  if (pts.length < 2) return []
  const inside = (p: ProfileSectionPoint) =>
    keep === 'le' ? p.outward <= y + 1e-7 : p.outward >= y - 1e-7
  const lerp = (a: ProfileSectionPoint, b: ProfileSectionPoint) => {
    const denom = b.outward - a.outward
    const t = Math.abs(denom) < 1e-9 ? 0 : (y - a.outward) / denom
    return {
      outward: y,
      forward: a.forward + t * (b.forward - a.forward),
    }
  }
  const out: ProfileSectionPoint[] = []
  const n = pts.length
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const aIn = inside(a)
    const bIn = inside(b)
    if (aIn) out.push(a)
    if (aIn !== bIn) out.push(lerp(a, b))
  }
  if (out.length < 2) return []
  if (closed) {
    const s0 = out[0]!
    const sN = out[out.length - 1]!
    if (Math.hypot(s0.outward - sN.outward, s0.forward - sN.forward) > 1e-4) {
      out.push({ ...s0 })
    }
  }
  return out
}

/**
 * Sockel-Querschnitt minus horizontale Loch-Bänder (Öffnungsmaske auf diesem X).
 * `outward` bleibt Höhe über dem Boden — der Sweep-Pfad bleibt auf der Sohle.
 */
function sectionHeight(section: ProfileSectionPoint[]): number {
  let min = Infinity
  let max = -Infinity
  for (const p of section) {
    min = Math.min(min, p.outward)
    max = Math.max(max, p.outward)
  }
  return max - min
}

function keepSectionPiece(section: ProfileSectionPoint[]): boolean {
  return section.length >= 3 && sectionHeight(section) > 0.5
}

export function clipProfileSectionMinusYHoles(
  section: ProfileSectionPoint[],
  holes: Array<{ y0: number; y1: number }>,
): ProfileSectionPoint[][] {
  if (section.length < 2) return []
  if (holes.length === 0) return [section]
  let pieces: ProfileSectionPoint[][] = [section]
  for (const hole of holes) {
    const next: ProfileSectionPoint[][] = []
    for (const piece of pieces) {
      const below = clipSectionByOutward(piece, hole.y0, 'le')
      const above = clipSectionByOutward(piece, hole.y1, 'ge')
      if (keepSectionPiece(below)) next.push(below)
      if (keepSectionPiece(above)) next.push(above)
    }
    pieces = next
  }
  return pieces
}

const PLINTH_CSG_Z_PAD = 4

export type PlinthOpeningDiscardSpec = {
  texture: THREE.DataTexture
  wallWidth: number
  wallHeight: number
  plinthH: number
}

function openProfileRing(section: ProfileSectionPoint[]): ProfileSectionPoint[] {
  if (section.length < 3) return section
  const a = section[0]!
  const b = section[section.length - 1]!
  if (Math.hypot(a.outward - b.outward, a.forward - b.forward) < 0.05) {
    return section.slice(0, -1)
  }
  return section
}

function plinthIntersectingOpenings(wall: Wall, plinthH: number): Opening[] {
  const out: Opening[] = []
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const rect = plinthOpeningClipRect(wall, opening)
    if (!rect) continue
    if (rect.y0 >= plinthH - 0.25 || rect.y1 <= 0.25) continue
    if (opening.type === 'door' && opening.stairs?.enabled) {
      out.push({ ...opening, y: 0, height: opening.y + opening.height })
    } else {
      out.push(opening)
    }
  }
  return out
}

function evenOddContains(poly: Array<{ x: number; y: number }>, x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const yi = poly[i]!.y
    const yj = poly[j]!.y
    const xi = poly[i]!.x
    const xj = poly[j]!.x
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside
    }
  }
  return inside
}

function prepareCsgSolid(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const merged = mergeVertices(geo.clone(), 1e-3)
  merged.deleteAttribute('uv')
  merged.clearGroups()
  if (!merged.getAttribute('normal')) merged.computeVertexNormals()
  return merged
}

function createOpeningCutterGeometry(
  wall: Wall,
  opening: Opening,
  z0: number,
  z1: number,
): THREE.BufferGeometry | null {
  const inflate = plinthOpeningInflate(opening)
  const poly = openingMaskPolyline(opening, inflate, ARCH_MESH_SEGMENTS)
  if (poly.length < 3) return null
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const pts = poly.map((p) => new THREE.Vector2(p.x - halfW, p.y - halfH))
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse()
  const shape = new THREE.Shape()
  shape.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i += 1) {
    shape.lineTo(pts[i]!.x, pts[i]!.y)
  }
  shape.closePath()
  const depth = z1 - z0
  if (!(depth > 0.5)) return null
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, z0)
  geo.clearGroups()
  geo.deleteAttribute('uv')
  return geo
}

function countInteriorOpeningSamples(
  geo: THREE.BufferGeometry,
  wall: Wall,
  openings: Opening[],
  inset = 8,
): number {
  const pos = geo.getAttribute('position')
  if (!pos || openings.length === 0) return 0
  const index = geo.index
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const polys = openings.map((opening) =>
    openingMaskPolyline(opening, plinthOpeningInflate(opening), ARCH_MESH_SEGMENTS),
  )
  const triCount = index ? index.count / 3 : pos.count / 3
  const bary = [
    [1 / 3, 1 / 3, 1 / 3],
    [0.6, 0.2, 0.2],
    [0.2, 0.6, 0.2],
    [0.2, 0.2, 0.6],
  ]
  const vert = (i: number) => {
    const vi = index ? index.getX(i) : i
    return {
      x: pos.getX(vi) + halfW,
      y: pos.getY(vi) + halfH,
    }
  }
  let hits = 0
  for (let t = 0; t < triCount; t += 1) {
    const i0 = t * 3
    const a = vert(i0)
    const b = vert(i0 + 1)
    const c = vert(i0 + 2)
    for (const w of bary) {
      const x = a.x * w[0]! + b.x * w[1]! + c.x * w[2]!
      const y = a.y * w[0]! + b.y * w[1]! + c.y * w[2]!
      for (let k = 0; k < openings.length; k += 1) {
        const opening = openings[k]!
        if (
          x > opening.x + inset &&
          x < opening.x + opening.width - inset &&
          y > opening.y + inset &&
          y < opening.y + opening.height - inset &&
          evenOddContains(polys[k]!, x, y)
        ) {
          hits += 1
          break
        }
      }
    }
  }
  return hits
}

function subtractOpeningVolumes(
  sweep: THREE.BufferGeometry,
  wall: Wall,
  openings: Opening[],
): THREE.BufferGeometry | null {
  sweep.computeBoundingBox()
  const box = sweep.boundingBox
  if (!box) return null
  const z0 = box.min.z - PLINTH_CSG_Z_PAD
  const z1 = box.max.z + PLINTH_CSG_Z_PAD
  if (!(z1 > z0 + 0.5)) return null

  const evaluator = new Evaluator()
  evaluator.useGroups = false
  evaluator.attributes = ['position', 'normal']
  ;(evaluator as Evaluator & { useCDTClipping: boolean }).useCDTClipping = true

  let currentGeo = prepareCsgSolid(sweep)
  let current = new Brush(currentGeo)
  current.updateMatrixWorld()

  for (const opening of openings) {
    const cutterRaw = createOpeningCutterGeometry(wall, opening, z0, z1)
    if (!cutterRaw) continue
    const cutterGeo = prepareCsgSolid(cutterRaw)
    cutterRaw.dispose()
    const cutter = new Brush(cutterGeo)
    cutter.updateMatrixWorld()
    const next = evaluator.evaluate(current, cutter, SUBTRACTION)
    if (currentGeo !== next.geometry) currentGeo.dispose()
    cutterGeo.dispose()
    currentGeo = next.geometry
    current = next
  }

  const pos = currentGeo.getAttribute('position')
  if (!pos || pos.count < 24) {
    currentGeo.dispose()
    return null
  }
  // 16 cm im Inneren: Schnittflächen an der Maske dürfen 8-cm-Randstreifen treffen.
  if (countInteriorOpeningSamples(currentGeo, wall, openings, 16) > 0) {
    currentGeo.dispose()
    return null
  }
  currentGeo.computeVertexNormals()
  return currentGeo
}

function buildPlinthOpeningDiscardSpec(
  wall: Wall,
  plinthH: number,
  openings: Opening[],
): PlinthOpeningDiscardSpec | null {
  if (openings.length === 0) return null
  const w = Math.max(1, Math.min(1024, Math.round(wall.width)))
  const h = Math.max(1, Math.min(512, Math.round(plinthH)))
  const data = new Uint8Array(w * h * 4)
  const polys = openings.map((opening) =>
    openingMaskPolyline(opening, plinthOpeningInflate(opening), ARCH_MESH_SEGMENTS),
  )
  for (let py = 0; py < h; py += 1) {
    const y = ((py + 0.5) / h) * plinthH
    for (let px = 0; px < w; px += 1) {
      const x = ((px + 0.5) / w) * wall.width
      let hole = false
      for (let k = 0; k < openings.length; k += 1) {
        if (evenOddContains(polys[k]!, x, y)) {
          hole = true
          break
        }
      }
      const i = (py * w + px) * 4
      const v = hole ? 255 : 0
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  texture.needsUpdate = true
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.flipY = false
  texture.generateMipmaps = false
  return { texture, wallWidth: wall.width, wallHeight: wall.height, plinthH }
}

function injectPlinthDiscardShader(
  shader: {
    vertexShader: string
    fragmentShader: string
    uniforms: Record<string, { value: unknown }>
  },
  spec: PlinthOpeningDiscardSpec,
) {
  shader.uniforms.uPlinthHole = { value: spec.texture }
  shader.uniforms.uPlinthHoleSize = { value: new THREE.Vector2(spec.wallWidth, spec.plinthH) }
  shader.uniforms.uWallHalf = { value: new THREE.Vector2(spec.wallWidth / 2, spec.wallHeight / 2) }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPlinthLocal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlinthLocal = transformed;')
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vPlinthLocal;
uniform sampler2D uPlinthHole;
uniform vec2 uPlinthHoleSize;
uniform vec2 uWallHalf;`,
    )
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
{
  float wallX = vPlinthLocal.x + uWallHalf.x;
  float wallY = vPlinthLocal.y + uWallHalf.y;
  vec2 uv = vec2(wallX / max(uPlinthHoleSize.x, 1e-4), wallY / max(uPlinthHoleSize.y, 1e-4));
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    if (texture2D(uPlinthHole, uv).r > 0.5) discard;
  }
}`,
    )
}

/** Fragment-Discard in der Öffnungsmaske (Fallback, wenn CSG scheitert). */
export function applyPlinthOpeningFragmentDiscard(
  mesh: THREE.Mesh,
  spec: PlinthOpeningDiscardSpec,
) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const mat of materials) {
    if (!(mat instanceof THREE.MeshStandardMaterial)) continue
    mat.customProgramCacheKey = () => 'plinth-opening-discard-v1'
    mat.onBeforeCompile = (shader) => injectPlinthDiscardShader(shader, spec)
    mat.needsUpdate = true
  }
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.customProgramCacheKey = () => 'plinth-opening-discard-depth-v1'
  depth.onBeforeCompile = (shader) => injectPlinthDiscardShader(shader, spec)
  depth.needsUpdate = true
  mesh.customDepthMaterial = depth
}

export function disposePlinthOpeningDiscard(geometry: THREE.BufferGeometry) {
  const spec = geometry.userData.plinthOpeningDiscard as PlinthOpeningDiscardSpec | undefined
  spec?.texture.dispose()
  geometry.userData.plinthOpeningDiscard = undefined
}

/**
 * SVG-Sockel als voller Sweep (wie Gesims), Öffnung als 3D-Volumen abgezogen.
 * Fallback: ungeschnittener Sweep + Fragment-Discard in der Maske.
 */
export function createPlinthProfileSweepGeometry(
  path: ProfilePath,
  section: ProfileSectionPoint[],
  zBase: number,
  forwardSign: number,
  wall: Wall,
  plinthH: number,
): THREE.BufferGeometry {
  const ring = openProfileRing(section)
  if (ring.length < 2 || path.points.length < 2) {
    return createProfileSweepGeometry(path, section, zBase, forwardSign)
  }
  const sweep = createProfileSweepGeometry(path, ring, zBase, forwardSign)
  const openings = plinthIntersectingOpenings(wall, plinthH)
  if (openings.length === 0) return sweep

  try {
    const cut = subtractOpeningVolumes(sweep, wall, openings)
    if (cut) {
      sweep.dispose()
      cut.userData.plinthCsg = true
      return cut
    }
  } catch (err) {
    console.warn('Sockel-CSG fehlgeschlagen, nutze Masken-Discard', err)
  }

  const spec = buildPlinthOpeningDiscardSpec(wall, plinthH, openings)
  if (spec) sweep.userData.plinthOpeningDiscard = spec
  return sweep
}

/**
 * Dekoratives Sockelprofil: SVG-Höhe = Sockelhöhe vom Boden, liegt auf der Wand
 * (forward = 0 an der Paneel-/Wandfläche). SVG-Breite = Tiefe. Aussparung an Öffnungen.
 */
function buildPlinthProfilePaths(state: FacadeState): ProfilePath[] {
  const paths: ProfilePath[] = []
  const allWalls = getAllWalls(state)
  const visibleIds = new Set(getVisibleWalls(state).map((wall) => wall.id))

  for (const wall of allWalls) {
    if (!visibleIds.has(wall.id)) continue
    if (!isStudioWall(wall) || !wall.panel || !studioPlinthActive(wall.panel)) continue
    const panel = wall.panel
    const profileId = panel.plinthProfileId ?? 'sockelprofil'
    if (!profileId || profileId === 'sockelStandard') continue
    const profile = resolveProfile(profileId, state.customProfiles)
    if (!profile?.projecting || !profile.section) continue

    const plinthH = panel.plinthHeight ?? 0
    if (plinthH < 0.5) continue
    const nativeH = Math.max(...profile.section.map((p) => p.outward), 0)
    const nativeD = Math.max(...profile.section.map((p) => p.forward), 0)
    const heightScale = nativeH > 1e-6 ? plinthH / nativeH : 1
    const depthCm = panel.plinthDepth && panel.plinthDepth > 0 ? panel.plinthDepth : nativeD || 8
    const depthScale = nativeD > 1e-6 ? depthCm / nativeD : 1
    const floorY = -wall.height / 2
    const halfW = wall.width / 2
    const miterEnds = plinthMiterEnds(wall, allWalls)
    const offsetForward = panel.plinthOffsetForward ?? 0
    const startAdj = miterEnds.start ? findAdjacentWall(wall, 'start', allWalls) : undefined
    const endAdj = miterEnds.end ? findAdjacentWall(wall, 'end', allWalls) : undefined
    const startMiter = startAdj ? cornicePlanMiterTan(wall, startAdj, 'start') : 0
    const endMiter = endAdj ? cornicePlanMiterTan(wall, endAdj, 'end') : 0
    paths.push({
      profileId,
      wallId: wall.id,
      closed: false,
      outward: [{ x: 0, y: 1 }],
      zOffset: 0,
      localSpace: true,
      forwardSign: wall.panelFlip ? -1 : 1,
      cornerJoin: 'none',
      color: panel.plinthProfileColor ?? wall.profileColor,
      sectionScale: heightScale,
      sectionScaleForward: depthScale,
      rotationDeg: panel.plinthProfileRotationDeg ?? 0,
      flipOutward: Boolean(panel.plinthProfileFlipOutward),
      flipForward: Boolean(panel.plinthProfileFlipForward),
      offsetForward,
      role: 'plinthProfile',
      clipOpeningMask: true,
      points: [
        { x: -halfW, y: floorY },
        { x: halfW, y: floorY },
      ],
      planMiterStart: pictureFramePlanMiter(startMiter, 'start'),
      planMiterEnd: pictureFramePlanMiter(endMiter, 'end'),
      capStart: !startAdj,
      capEnd: !endAdj,
    })
  }

  return paths
}

export function buildProfilePaths(state: FacadeState): ProfilePath[] {
  const segments = collectSegments(state)
  const paths: ProfilePath[] = []
  for (const group of groupOpeningSegments(segments)) {
    paths.push(...chainPaths(group))
  }
  paths.push(...buildCornicePaths(state))
  paths.push(...buildTrimBandPaths(state))
  paths.push(...buildPlinthProfilePaths(state))
  paths.push(...buildSillOuterPaths(state))
  // Innenbank: feste weiße Platte ohne Profil (siehe FacadeController.rebuildInnerSills).
  return paths
}

function buildSillOuterPaths(state: FacadeState): ProfilePath[] {
  const paths: ProfilePath[] = []
  for (const wall of getVisibleWalls(state)) {
    const studio = isStudioWall(wall)
    const forwardSign = studio ? (wall.panelFlip ? -1 : 1) : 1
    for (const opening of wall.openings) {
      if (opening.hidden) continue
      const sill = opening.sillOuter
      if (!sill?.enabled || opening.type !== 'window' || opening.y <= 0) continue
      const normalized = normalizeOpeningSillOuter(sill)
      if (!outerSillUsesProfile(normalized)) continue
      const profile = resolveProfile(normalized.profileId!, state.customProfiles)
      if (!profile?.projecting || !profile.section) continue
      const layout = resolveOuterSillLayout(opening, normalized)
      const zOffset = profileZOffset(wall)
      const x0 = studio ? layout.xLeft - wall.width / 2 : wall.x + layout.xLeft
      const x1 = studio ? layout.xRight - wall.width / 2 : wall.x + layout.xRight
      // Oberkante bündig mit Öffnungs-Unterkante — Profil hängt nach unten (outward −Y).
      const yTop = studio ? layout.yTop - wall.height / 2 : wall.y + layout.yTop
      const facadeZ = studio ? studioFacadeOutwardLocalZ(wall) : wall.depth
      // Profil sitzt an der Bankvorderkante (Tropfkante), nicht an der Paneelfassade.
      const outerZ = studio ? ((wall.panelFlip ?? false) ? 0 : wall.depth) : wall.depth
      const zFront = outerZ + forwardSign * layout.depth
      const offsetForward = Math.abs(forwardSign) > 1e-6 ? (zFront - facadeZ) / forwardSign : 0
      paths.push({
        profileId: normalized.profileId!,
        wallId: wall.id,
        openingId: opening.id,
        zOffset,
        localSpace: studio,
        forwardSign,
        cornerJoin: normalized.cornerJoin ?? 'miter',
        color: normalized.color ?? wall.profileColor,
        finish: normalized.finish ?? wall.profileFinish,
        sectionScale: normalized.scale,
        rotationDeg: normalized.rotationDeg ?? 0,
        flipOutward: normalized.flipOutward ?? false,
        flipForward: normalized.flipForward ?? false,
        offsetForward,
        capStart: true,
        capEnd: true,
        role: 'sillOuter',
        points: [
          { x: x0, y: yTop },
          { x: x1, y: yTop },
        ],
        closed: false,
        outward: [{ x: 0, y: -1 }],
      })
    }
  }
  return paths
}

/** Spitze Giebel-/Profil-Ecken würden sonst den Querschnitt aufblähen (Z-Fight / Sliver). */
const PROFILE_MITER_SCALE_MAX = 2

function miterNormal(
  path: ProfilePath,
  index: number,
): { normal: Vec2; scale: number } {
  const count = path.points.length
  const segmentCount = path.closed ? count : count - 1

  if (!path.closed && index === 0) {
    return { normal: path.outward[0], scale: 1 }
  }
  if (!path.closed && index === count - 1) {
    return { normal: path.outward[segmentCount - 1], scale: 1 }
  }

  const segEnding = path.closed
    ? (index - 1 + segmentCount) % segmentCount
    : index - 1

  if (path.cornerJoin === 'none' && segEnding >= 0) {
    return { normal: path.outward[segEnding], scale: 1 }
  }

  const n0 = path.outward[path.closed ? (index - 1 + segmentCount) % segmentCount : index - 1]
  const n1 = path.outward[path.closed ? index % segmentCount : index]
  const mx = n0.x + n1.x
  const my = n0.y + n1.y
  const length = Math.hypot(mx, my)
  if (length < 1e-6) {
    return { normal: n0, scale: 1 }
  }

  const normal = { x: mx / length, y: my / length }
  const denom = normal.x * n0.x + normal.y * n0.y
  if (Math.abs(denom) < 1e-6) {
    return { normal: n0, scale: 1 }
  }
  const scale = Math.min(path.miterScaleMax ?? PROFILE_MITER_SCALE_MAX, Math.abs(1 / denom))
  return { normal, scale }
}

export function rotateProfileSection(
  section: ProfileSectionPoint[],
  rotationDeg: number,
): ProfileSectionPoint[] {
  return transformProfileSection(section, rotationDeg, false, false)
}

/** Dreht und spiegelt den 2D-Querschnitt, dann setzt den Ursprung wieder auf die Wand-/Öffnungskante. */
export function transformProfileSection(
  section: ProfileSectionPoint[],
  rotationDeg = 0,
  flipOutward = false,
  flipForward = false,
): ProfileSectionPoint[] {
  const turns = ((rotationDeg % 360) + 360) % 360
  const rad = (turns * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const mapped = section.map((point) => {
    const outward = point.outward * cos - point.forward * sin
    const forward = point.outward * sin + point.forward * cos
    return {
      outward: flipOutward ? -outward : outward,
      forward: flipForward ? -forward : forward,
    }
  })
  let minOut = Infinity
  let minFwd = Infinity
  for (const point of mapped) {
    minOut = Math.min(minOut, point.outward)
    minFwd = Math.min(minFwd, point.forward)
  }
  return mapped.map((point) => ({
    outward: point.outward - minOut,
    forward: point.forward - minFwd,
  }))
}

export function transformProfileSectionAnchored(
  section: ProfileSectionPoint[],
  rotationDeg = 0,
  flipOutward = false,
  flipForward = false,
): ProfileSectionPoint[] {
  const turns = ((rotationDeg % 360) + 360) % 360
  const rad = (turns * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const mapped = section.map((point) => {
    const outward = point.outward * cos - point.forward * sin
    const forward = point.outward * sin + point.forward * cos
    return {
      outward: flipOutward ? -outward : outward,
      forward: flipForward ? -forward : forward,
    }
  })
  let minFwd = Infinity
  for (const point of mapped) {
    minFwd = Math.min(minFwd, point.forward)
  }
  return mapped.map((point) => ({
    outward: point.outward,
    forward: point.forward - minFwd,
  }))
}

export function scaleProfileSection(
  section: ProfileSectionPoint[],
  scale: number,
): ProfileSectionPoint[] {
  return scaleProfileSectionAxes(section, scale, scale)
}

export function scaleProfileSectionAxes(
  section: ProfileSectionPoint[],
  outwardScale: number,
  forwardScale: number,
): ProfileSectionPoint[] {
  const out = Number.isFinite(outwardScale) && outwardScale > 0 ? outwardScale : 1
  const fwd = Number.isFinite(forwardScale) && forwardScale > 0 ? forwardScale : 1
  if (out === 1 && fwd === 1) return section
  return section.map((point) => ({
    outward: point.outward * out,
    forward: point.forward * fwd,
  }))
}

export function profileBandPolygon(path: ProfilePath, depth: number): Vec2[] {
  const outers = path.points.map((point, index) => {
    const { normal, scale } = miterNormal(path, index)
    return {
      x: point.x + normal.x * depth * scale,
      y: point.y + normal.y * depth * scale,
    }
  })

  return [...outers, ...path.points.slice().reverse()]
}

/**
 * Arbeitsdarstellung: Profil als einfacher Rechteck-Balken (Bounding der Sektion),
 * statt komplexem SVG-Querschnitt — deutlich billigerer Sweep.
 * `flushBack`: Querschnitt beginnt bei forward=0 ohne PROFILE_BACK_CLEARANCE (bis an die Wand).
 */
export function createSimpleProfileBarGeometry(
  path: ProfilePath,
  section: ProfileSectionPoint[],
  zBase: number,
  forwardSign = 1,
  opts?: { flushBack?: boolean },
): THREE.BufferGeometry {
  let minOut = Infinity
  let maxOut = -Infinity
  let maxFwd = 0
  for (const p of section) {
    minOut = Math.min(minOut, p.outward)
    maxOut = Math.max(maxOut, p.outward)
    maxFwd = Math.max(maxFwd, p.forward)
  }
  if (!Number.isFinite(minOut) || !Number.isFinite(maxOut)) {
    minOut = 0
    maxOut = 6
  }
  const height = Math.max(2, maxOut - minOut)
  const depth = Math.max(1.5, Math.min(maxFwd || height * 0.35, 10))
  const bar: ProfileSectionPoint[] = [
    { outward: minOut, forward: 0 },
    { outward: minOut + height, forward: 0 },
    { outward: minOut + height, forward: depth },
    { outward: minOut, forward: depth },
  ]
  return createProfileSweepGeometry(path, bar, zBase, forwardSign, {
    flushBack: opts?.flushBack !== false,
  })
}

export function createProfileSweepGeometry(
  path: ProfilePath,
  section: ProfileSectionPoint[],
  zBase: number,
  forwardSign = 1,
  opts?: { flushBack?: boolean },
): THREE.BufferGeometry {
  const z = zBase + path.zOffset
  const boost = path.forwardBoost ?? 0
  // Öffnungsprofile: SVG-Fußplatte (forward=0) nicht koplanar auf dem Stein.
  const backClearance =
    opts?.flushBack || !path.openingId ? 0 : PROFILE_BACK_CLEARANCE_CM
  const ring = section.length
  const lastIndex = path.points.length - 1
  const frames = path.points.map((point, index) => {
    const { normal, scale } = miterNormal(path, index)
    let planMiter = 0
    if (index === 0) planMiter = path.planMiterStart ?? 0
    else if (index === lastIndex) planMiter = path.planMiterEnd ?? 0
    return { point, normal, scale, planMiter }
  })

  const positions: number[] = []
  const normals: number[] = []

  const frameCount = frames.length
  const loopCount = path.closed ? frameCount : frameCount - 1

  for (let i = 0; i < loopCount; i += 1) {
    const a = frames[i]
    const b = frames[(i + 1) % frameCount]

    for (let s = 0; s < ring; s += 1) {
      const s1 = (s + 1) % ring
      const quad = [
        vertexAt(a, section[s], z, forwardSign, boost, backClearance),
        vertexAt(b, section[s], z, forwardSign, boost, backClearance),
        vertexAt(b, section[s1], z, forwardSign, boost, backClearance),
        vertexAt(a, section[s1], z, forwardSign, boost, backClearance),
      ]
      pushTriangle(positions, normals, quad[0], quad[1], quad[2])
      pushTriangle(positions, normals, quad[0], quad[2], quad[3])
    }
  }

  if (!path.closed) {
    if (path.capStart !== false) {
      capFrame(positions, normals, frames[0], section, z, false, forwardSign, boost, backClearance)
    }
    if (path.capEnd !== false) {
      capFrame(positions, normals, frames[frameCount - 1], section, z, true, forwardSign, boost, backClearance)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeVertexNormals()
  return geometry
}

function vertexAt(
  frame: { point: Vec2; normal: Vec2; scale: number; planMiter?: number },
  section: ProfileSectionPoint,
  zBase: number,
  forwardSign = 1,
  forwardBoost = 0,
  backClearance = 0,
): THREE.Vector3 {
  const planMiter = frame.planMiter ?? 0
  const fwd =
    Math.max(section.forward, backClearance) + (section.forward > 1e-6 ? forwardBoost : 0)
  const z = zBase + fwd * forwardSign
  // Bilderrahmen: dieselbe Formel wie wallLocalX — z × (−tan), z vorzeichenbehaftet.
  return new THREE.Vector3(
    frame.point.x + frame.normal.x * section.outward * frame.scale + z * planMiter,
    frame.point.y + frame.normal.y * section.outward * frame.scale,
    z,
  )
}

function pushTriangle(
  positions: number[],
  normals: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const normal = new THREE.Vector3().crossVectors(ab, ac).normalize()
  for (const point of [a, b, c]) {
    positions.push(point.x, point.y, point.z)
    normals.push(normal.x, normal.y, normal.z)
  }
}

function capFrame(
  positions: number[],
  normals: number[],
  frame: { point: Vec2; normal: Vec2; scale: number; planMiter?: number },
  section: ProfileSectionPoint[],
  zBase: number,
  reverse: boolean,
  forwardSign = 1,
  forwardBoost = 0,
  backClearance = 0,
) {
  let triangles: number[][] = []
  try {
    const contour = section.map((point) => new THREE.Vector2(point.outward, point.forward * forwardSign))
    triangles = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    triangles = []
  }
  if (triangles.length === 0) {
    for (let i = 1; i < section.length - 1; i += 1) {
      triangles.push([0, i, i + 1])
    }
  }
  for (const [i0, i1, i2] of triangles) {
    const a = vertexAt(frame, section[i0], zBase, forwardSign, forwardBoost, backClearance)
    const b = vertexAt(frame, section[i1], zBase, forwardSign, forwardBoost, backClearance)
    const c = vertexAt(frame, section[i2], zBase, forwardSign, forwardBoost, backClearance)
    if (reverse) {
      pushTriangle(positions, normals, a, c, b)
    } else {
      pushTriangle(positions, normals, a, b, c)
    }
  }
}

