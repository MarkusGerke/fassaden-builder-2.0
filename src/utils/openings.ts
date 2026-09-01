import type {
  FacadeState,
  GruenderzeitWindowConfig,
  Opening,
  OpeningEdge,
  OpeningMotion,
  OpeningPediment,
  OpeningRef,
  OpeningSillInner,
  OpeningSillOuter,
  OpeningStairs,
  OpeningRollerShutter,
  OpeningTrimConfig,
  SurfaceFinish,
  Wall,
  WallDimensions,
} from '../types/facade'
import { cloneWall } from '../types/facade'
import { DEFAULT_GLASS_COLOR, defaultOpeningFrameColor } from '../constants/colorPalettes'
import {
  DEFAULT_GLASS_IOR,
  DEFAULT_GLASS_ROUGHNESS,
  DEFAULT_GLASS_THICKNESS_CM,
  DEFAULT_GLASS_TRANSMISSION,
} from './glassConfig'
import { createId } from './id'
import { DEFAULT_NICHE_DEPTH_CM } from './openingGeometry'
import { GRID_SIZE, WALL_HEIGHT, WALL_DEPTH, WINDOW_SILL_Y, WINDOW_TRIM_DEFAULT_OFFSET_FORWARD } from '../constants/presets'
import { STUDIO_MASONRY } from '../studio/constants'
import { viewerSideToAlongSign } from '../studio/walls'
import { defaultOpeningStairs, normalizeOpeningStairs, stairTopY } from '../studio/stairs'
import { normalizeOpeningPediment } from '../studio/pediment'
import { normalizeOpeningRollerShutter } from '../studio/rollerShutter'
import { blenderWindowName } from '../blender/windowModels'
import {
  clampGruenderzeitForBasement,
  defaultGruenderzeitConfig,
  normalizeGruenderzeitConfig,
} from '../windows/gruenderzeit'
import { basementWindowEnabled } from '../studio/basementWindow'
import { isSillOuterProfile, isWindowTrimProfile } from '../profiles/windowTrim'
import { findBuildingForWall, findWall, getAllWalls, mapAllWalls, updateBuilding } from './buildings'
import { snapToGrid } from './grid'
import { clampOuterSillDepth, defaultOuterSillDepth, hydrateOpening } from './hydrate'

export { defaultOuterSillDepth, clampOuterSillDepth }
import { normalizeOpeningMotion } from './openingMotion'
import {
  clampOpeningToWall,
  OPENING_MIN_GAP,
  openingsTooClose,
  validateOpeningPlacement,
} from './validation'

/** Sucht von links nach rechts die erste freie X-Position für eine Öffnung. */
export function findOpeningSlot(
  wall: Wall,
  width: number,
  height: number,
  type: Opening['type'],
): number | null {
  const isStudio = wall.kind === 'studio'
  const sizeGrid = isStudio ? STUDIO_MASONRY : GRID_SIZE
  const posGrid = isStudio ? STUDIO_MASONRY : GRID_SIZE
  const margin = 0
  const MIN_GAP = OPENING_MIN_GAP

  const snappedWidth = snapToGrid(width, sizeGrid)
  const maxX = wall.width - margin - snappedWidth

  for (let x = margin; x <= maxX; x += posGrid) {
    const candidate: Opening = {
      id: '__slot_check__',
      type,
      width: snappedWidth,
      height: snapToGrid(height, sizeGrid),
      x,
      y: type === 'door' ? 0 : WINDOW_SILL_Y,
    }
    const hasConflict = wall.openings.some((existing) => {
      const gapLeft = candidate.x - (existing.x + existing.width)
      const gapRight = existing.x - (candidate.x + candidate.width)
      return gapLeft < MIN_GAP && gapRight < MIN_GAP
    })
    if (!hasConflict && x >= 0 && x + snappedWidth <= wall.width) {
      return x
    }
  }
  return null
}

export function openingsOverlap(a: Opening, b: Opening): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function findOverlappingOpenings(wall: Wall, candidate: Opening): Opening[] {
  return wall.openings.filter(
    (existing) => existing.id !== candidate.id && openingsOverlap(existing, candidate),
  )
}

export type OpeningInsertIssue =
  | { kind: 'invalid'; message: string }
  | { kind: 'overlap'; message: string; overlapping: Opening[] }

export function assessOpeningInsert(wall: Wall, candidate: Opening): OpeningInsertIssue | null {
  const validation = validateOpeningPlacement(candidate, wall)
  if (!validation.valid) {
    return { kind: 'invalid', message: validation.message ?? 'Ungültige Öffnung.' }
  }

  const overlapping = findOverlappingOpenings(wall, candidate)
  if (overlapping.length > 0) {
    return {
      kind: 'overlap',
      message:
        'Die neue Öffnung überlappt mit bestehenden Öffnungen und kann so nicht eingefügt werden.',
      overlapping,
    }
  }

  return null
}

export function insertOpeningReplacingOverlaps(
  state: FacadeState,
  wallId: string,
  opening: Opening,
  replaceIds: string[],
): FacadeState {
  const wall = findWall(state, wallId)
  const donorId = wall?.openings.find(
    (item) => replaceIds.includes(item.id) && item.type === opening.type,
  )?.id
  const donorProfiles = donorId
    ? (wall?.profiles.filter((profile) => profile.openingId === donorId) ?? [])
    : []
  let next = state
  for (const id of replaceIds) {
    next = removeOpening(next, wallId, id)
  }
  next = addOpening(next, wallId, opening)
  if (donorProfiles.length === 0) return next
  return mapWall(next, wallId, (current) => ({
    ...cloneWall(current),
    profiles: [
      ...current.profiles.filter((profile) => profile.openingId !== opening.id),
      ...donorProfiles.map((profile) => ({ ...profile, openingId: opening.id })),
    ],
  }))
}

function openingGridForWall(wall: Wall): number | undefined {
  return wall.kind === 'studio' ? STUDIO_MASONRY : undefined
}

/** Platzierungsraster für Studio-Öffnungs-Positionen (Drag/Nudge). Maße bleiben am Mauerwerksraster. */
function openingPositionStep(wall: Wall): number {
  return wall.kind === 'studio' ? STUDIO_MASONRY : 8
}

/** Raster für die Mitte: halbes Maß-Raster, damit ±8 cm Breite je 4 cm links/rechts geht. */
export function openingCenterGrid(grid: number = GRID_SIZE): number {
  return Math.max(1, grid / 2)
}

/** X-Position, damit eine Breitenänderung um die bisherige Mitte zentriert bleibt. */
export function centeredOpeningX(
  opening: Pick<Opening, 'x' | 'width'>,
  newWidth: number,
  grid: number = GRID_SIZE,
): number {
  const centerX = opening.x + opening.width / 2
  return snapToGrid(centerX - newWidth / 2, openingCenterGrid(grid))
}

function mapWall(
  state: FacadeState,
  wallId: string,
  updater: (wall: Wall) => Wall,
): FacadeState {
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((wall) =>
      wall.id === wallId ? updater(wall) : cloneWall(wall),
    ),
  }))
}

export function ensureWindowSills(opening: Opening): Opening {
  if (opening.type !== 'window' || opening.y <= 0) return opening
  return {
    ...opening,
    sillInner: opening.sillInner ?? {
      enabled: true,
      depth: 16,
      thickness: 4,
      color: '#ffffff',
    },
    sillOuter: opening.sillOuter ?? {
      enabled: true,
      mode: 'board',
      scale: 1,
      depth: defaultOuterSillDepth(),
      thickness: 4,
      angleDeg: 5,
      rotationDeg: 0,
      flipOutward: false,
      flipForward: false,
      overhang: 16,
    },
  }
}

export interface OuterSillLayout {
  xLeft: number
  xRight: number
  yTop: number
  yBottom: number
  depth: number
  thickness: number
  angleDeg: number
  width: number
}

export function snapSillOverhang(value: number | undefined): number {
  const v = Number.isFinite(value) ? (value as number) : 16
  return Math.max(0, Math.min(96, Math.round(v / STUDIO_MASONRY) * STUDIO_MASONRY))
}

export function resolveSillOverhang(
  raw?: { overhang?: number; overhangLeft?: number; overhangRight?: number; width?: number } | null,
  openingWidth?: number,
): number {
  if (!raw) return 16
  if (raw?.overhang !== undefined) return snapSillOverhang(raw.overhang)
  const left = raw?.overhangLeft
  const right = raw?.overhangRight
  if (left !== undefined || right !== undefined) {
    return snapSillOverhang(left ?? right ?? 16)
  }
  if (raw?.width !== undefined && openingWidth !== undefined) {
    return snapSillOverhang(Math.max(0, (raw.width - openingWidth) / 2))
  }
  return 16
}

export function normalizeOpeningSillInner(raw?: Partial<OpeningSillInner> | null): OpeningSillInner {
  return {
    enabled: raw?.enabled !== false,
    overhang: resolveSillOverhang(raw),
    depth: Math.max(1, raw?.depth ?? 16),
    thickness: Math.max(0.5, raw?.thickness ?? 4),
    color: '#ffffff',
    profileId: raw?.profileId,
    scale: raw?.scale,
    rotationDeg: raw?.rotationDeg,
    flipOutward: raw?.flipOutward,
    flipForward: raw?.flipForward,
  }
}

export function normalizeOpeningSillOuter(
  raw?: Partial<OpeningSillOuter> | null,
): OpeningSillOuter {
  const profileId = raw?.profileId
  const hasProfile =
    profileId && profileId !== 'none' && profileId !== '' && isSillOuterProfile(profileId)
  const mode: 'board' | 'profile' =
    raw?.mode ?? (hasProfile ? 'profile' : 'board')
  const resolvedMode = raw?.mode ?? (profileId === 'none' || profileId === '' || !hasProfile ? 'board' : mode)
  return {
    enabled: raw?.enabled !== false,
    mode: resolvedMode,
    profileId: resolvedMode === 'profile' && hasProfile ? profileId : undefined,
    color: raw?.color,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : undefined,
    scale: raw?.scale ?? 1,
    flipForward: raw?.flipForward ?? false,
    rotationDeg: raw?.rotationDeg ?? 0,
    flipOutward: raw?.flipOutward ?? false,
    cornerJoin: raw?.cornerJoin ?? 'miter',
    overhang: resolveSillOverhang(raw),
    depth: clampOuterSillDepth(raw?.depth ?? defaultOuterSillDepth()),
    thickness: Math.max(0.5, raw?.thickness ?? 4),
    angleDeg: Math.max(0, Math.min(30, raw?.angleDeg ?? 5)),
  }
}

export function outerSillUsesProfile(sill: OpeningSillOuter): boolean {
  return sill.mode === 'profile' && Boolean(sill.profileId)
}

export function resolveOuterSillLayout(opening: Opening, sill: OpeningSillOuter): OuterSillLayout {
  const normalized = normalizeOpeningSillOuter(sill)
  const overhang = normalized.overhang ?? 16
  const width = opening.width + overhang * 2
  const depth = normalized.depth ?? 16
  const thickness = normalized.thickness ?? 4
  const angleDeg = normalized.angleDeg ?? 5
  const xLeft = opening.x - overhang
  const xRight = xLeft + width
  const yTop = opening.y
  const yBottom = opening.y - thickness
  return { xLeft, xRight, yTop, yBottom, depth, thickness, angleDeg, width }
}

export function openingHasProfile(
  wall: Wall,
  openingId: string,
  profileId?: string,
): boolean {
  return wall.profiles.some(
    (profile) =>
      profile.openingId === openingId &&
      (profileId === undefined || profile.profileId === profileId),
  )
}

export function createOpening(
  type: Opening['type'],
  width: number,
  height: number,
  wall: WallDimensions & {
    kind?: Wall['kind']
    openings?: Opening[]
    panel?: Wall['panel']
    buildingId?: string
  },
  at?: { x: number; y?: number },
  opts?: { donorWalls?: Array<{ openings?: Opening[] }> },
): Opening {
  const sizeGrid = wall.kind === 'studio' ? STUDIO_MASONRY : undefined
  const posGrid = wall.kind === 'studio' ? STUDIO_MASONRY : undefined
  const snappedWidth = snapToGrid(width, sizeGrid)
  const snappedHeight = snapToGrid(height, sizeGrid)

  let x: number
  if (at) {
    x = snapToGrid(at.x, posGrid)
  } else if (wall.openings && wall.openings.length > 0) {
    const slot = findOpeningSlot(wall as Wall, snappedWidth, snappedHeight, type)
    x = slot !== null ? slot : snapToGrid((wall.width - snappedWidth) / 2, posGrid)
  } else {
    x = snapToGrid((wall.width - snappedWidth) / 2, posGrid)
  }

  const y =
    at?.y !== undefined
      ? snapToGrid(at.y, posGrid)
      : type === 'door' || type === 'cutout'
        ? 0
        : type === 'conch'
          ? WINDOW_SILL_Y
          : WINDOW_SILL_Y

  const donor = donorOpeningForStyle(wall, type, opts?.donorWalls)

  if (type === 'cutout') {
    return hydrateOpening(
      clampOpeningToWall(
        inheritOpeningStyles(
          {
            id: createId(),
            type,
            width: snappedWidth,
            height: snappedHeight,
            x,
            y,
            cutoutShape: 'rect',
            fill: { mode: 'niche', nicheDepthCm: DEFAULT_NICHE_DEPTH_CM },
          },
          donor,
        ),
        wall,
        sizeGrid,
      ),
      wall,
    )
  }

  if (type === 'conch') {
    const rise = Math.min(snappedWidth / 2, snappedHeight)
    return hydrateOpening(
      clampOpeningToWall(
        inheritOpeningStyles(
          {
            id: createId(),
            type,
            width: snappedWidth,
            height: snappedHeight,
            x,
            y,
            fill: { mode: 'niche', nicheDepthCm: Math.max(DEFAULT_NICHE_DEPTH_CM, rise) },
            arch: { enabled: true, form: 'round', riseCm: rise },
          },
          donor,
        ),
        wall,
        sizeGrid,
      ),
      wall,
    )
  }

  return hydrateOpening(
    clampOpeningToWall(
      inheritOpeningStyles(
        {
          id: createId(),
          type,
          width: snappedWidth,
          height: snappedHeight,
          x,
          y,
          windowModel: type === 'window' ? blenderWindowName(snappedWidth, snappedHeight) : undefined,
          gruenderzeit: defaultGruenderzeitConfig(snappedWidth, snappedHeight, type),
          frameColor: defaultOpeningFrameColor(type),
          glassColor: DEFAULT_GLASS_COLOR,
          glassMode: 'tint',
          glassIor: DEFAULT_GLASS_IOR,
          glassRoughness: DEFAULT_GLASS_ROUGHNESS,
          glassTransmission: DEFAULT_GLASS_TRANSMISSION,
          glassThickness: DEFAULT_GLASS_THICKNESS_CM,
          sillInner:
            type === 'window'
              ? {
                  enabled: true,
                  depth: 16,
                  thickness: 4,
                  color: '#ffffff',
                }
              : undefined,
          sillOuter:
            type === 'window'
              ? {
                  enabled: true,
                  mode: 'board' as const,
                  scale: 1,
                  depth: defaultOuterSillDepth(wall),
                  thickness: 4,
                  angleDeg: 5,
                  rotationDeg: 0,
                  flipOutward: false,
                  flipForward: false,
                  overhang: 16,
                }
              : undefined,
        },
        donor,
      ),
      wall,
      sizeGrid,
    ),
    wall,
  )
}

/** Vorlage für Stile einer neuen Öffnung: gleicher Typ, sonst irgendeine Öffnung der Wand bzw. des Hauses. */
export function donorOpeningForStyle(
  wall: { openings?: Opening[] },
  type: Opening['type'],
  houseWalls?: Array<{ openings?: Opening[] }>,
): Opening | undefined {
  const sameType = wall.openings?.filter((item) => item.type === type)
  if (sameType && sameType.length > 0) return sameType[sameType.length - 1]
  if (wall.openings && wall.openings.length > 0) return wall.openings[wall.openings.length - 1]
  if (houseWalls) {
    for (let i = houseWalls.length - 1; i >= 0; i -= 1) {
      const openings = houseWalls[i]?.openings
      if (!openings?.length) continue
      const typed = openings.filter((item) => item.type === type)
      if (typed.length > 0) return typed[typed.length - 1]
      return openings[openings.length - 1]
    }
  }
  return undefined
}

export function inheritOpeningStyles(base: Opening, donor?: Opening): Opening {
  if (!donor) return base
  return {
    ...base,
    frameColor: donor.frameColor ?? base.frameColor,
    frameFinish: donor.frameFinish ?? base.frameFinish,
    revealExteriorColor: donor.revealExteriorColor ?? base.revealExteriorColor,
    revealInteriorColor: donor.revealInteriorColor ?? base.revealInteriorColor,
    glassColor: donor.glassColor ?? base.glassColor,
    glassMode: donor.glassMode ?? base.glassMode,
    glassIor: donor.glassIor ?? base.glassIor,
    glassRoughness: donor.glassRoughness ?? base.glassRoughness,
    glassTransmission: donor.glassTransmission ?? base.glassTransmission,
    glassThickness: donor.glassThickness ?? base.glassThickness,
    trim: donor.trim ? { ...donor.trim } : base.trim,
    gruenderzeit: donor.gruenderzeit ? { ...donor.gruenderzeit } : base.gruenderzeit,
    sillInner: donor.sillInner ? { ...donor.sillInner } : base.sillInner,
    sillOuter: donor.sillOuter ? { ...donor.sillOuter } : base.sillOuter,
    pediment: donor.pediment ? { ...donor.pediment } : base.pediment,
    stairs: donor.stairs ? { ...donor.stairs } : base.stairs,
    rollerShutter: donor.rollerShutter ? { ...donor.rollerShutter } : base.rollerShutter,
    basementWindow: donor.basementWindow ? { ...donor.basementWindow } : base.basementWindow,
    arch: donor.arch ? { ...donor.arch } : base.arch,
    fill: donor.fill ? { ...donor.fill } : base.fill,
    panelClearance: donor.panelClearance ? { ...donor.panelClearance } : base.panelClearance,
    revealFrame: donor.revealFrame ? { ...donor.revealFrame } : base.revealFrame,
    depthOffset: donor.depthOffset ?? base.depthOffset,
    cutoutShape: donor.cutoutShape ?? base.cutoutShape,
  }
}

export function addOpening(
  state: FacadeState,
  wallId: string,
  opening: Opening,
): FacadeState {
  return mapWall(state, wallId, (wall) => {
    const houseWalls = getAllWalls(state).filter(
      (item) => item.buildingId === wall.buildingId && item.id !== wall.id,
    )
    const donor = donorOpeningForStyle(wall, opening.type, houseWalls)
    const cloned = cloneWall(wall)
    delete cloned.presetId
    cloned.openings = [...wall.openings, clampOpeningToWall(opening, wall, openingGridForWall(wall))]
    if (donor && wall.openings.some((item) => item.id === donor.id)) {
      const extras = wall.profiles
        .filter((profile) => profile.openingId === donor.id)
        .map((profile) => ({ ...profile, openingId: opening.id }))
      if (extras.length > 0) cloned.profiles = [...wall.profiles, ...extras]
    }
    return cloned
  })
}

export function replaceOpeningWithPreset(
  state: FacadeState,
  wallId: string,
  openingId: string,
  preset: { type: 'door' | 'window'; width: number; height: number; y?: number; basementWindow?: boolean },
): FacadeState {
  return replaceOpeningsWithPreset(state, [{ wallId, openingId }], preset)
}

/** Ersetzt alle genannten Öffnungen durch das Preset; Platzierung mittelaxial zum jeweiligen Vorgänger. */
export function replaceOpeningsWithPreset(
  state: FacadeState,
  refs: OpeningRef[],
  preset: { type: 'door' | 'window'; width: number; height: number; y?: number; basementWindow?: boolean },
): FacadeState {
  if (refs.length === 0) return state

  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  let next = state
  for (const [wallId, openingIds] of byWall) {
    next = mapWall(next, wallId, (wall) => {
      const grid = openingGridForWall(wall)
      return {
        ...cloneWall(wall),
        openings: wall.openings.map((opening) => {
          if (!openingIds.has(opening.id)) return opening
          const width = snapToGrid(preset.width, grid)
          const height = snapToGrid(preset.height, grid)
          const centerY = opening.y + opening.height / 2
          const x = centeredOpeningX(opening, width, grid)
          const y =
            preset.type === 'door'
              ? 0
              : preset.y !== undefined
                ? snapToGrid(preset.y, grid)
                : snapToGrid(centerY - height / 2, grid)
          return clampOpeningToWall(
            {
              ...opening,
              type: preset.type,
              width,
              height,
              x,
              y,
              windowModel:
                preset.type === 'window' ? blenderWindowName(width, height) : undefined,
              gruenderzeit: defaultGruenderzeitConfig(width, height, preset.type),
              frameColor: opening.frameColor ?? defaultOpeningFrameColor(preset.type),
              glassColor: opening.glassColor ?? DEFAULT_GLASS_COLOR,
              sillInner:
                preset.type === 'window'
                  ? {
                      enabled: !preset.basementWindow,
                      depth: 16,
                      thickness: 4,
                      profileId: 'fensterprofil32x120',
                      rotationDeg: 0,
                      flipOutward: false,
                      flipForward: true,
                    }
                  : undefined,
              sillOuter:
                preset.type === 'window'
                  ? {
                      enabled: !preset.basementWindow,
                      mode: 'board' as const,
                      scale: 1,
                      depth: defaultOuterSillDepth(wall),
                      thickness: 4,
                      angleDeg: 5,
                      rotationDeg: 0,
                      flipOutward: false,
                      flipForward: false,
                      overhang: 16,
                    }
                  : undefined,
              basementWindow:
                preset.type === 'window'
                  ? { enabled: Boolean(preset.basementWindow), grilleHeight: 0.5 }
                  : undefined,
              stairs: preset.type === 'door' ? opening.stairs : undefined,
            },
            wall,
            grid,
          )
        }),
      }
    })
  }
  return next
}

export function removeOpening(
  state: FacadeState,
  wallId: string,
  id: string,
): FacadeState {
  return mapWall(state, wallId, (wall) => ({
    ...cloneWall(wall),
    openings: wall.openings.filter((opening) => opening.id !== id),
    profiles: wall.profiles.filter((profile) => profile.openingId !== id),
  }))
}

export function duplicateOpenings(
  state: FacadeState,
  refs: OpeningRef[],
  preferredSide: 'left' | 'right' = 'right',
  opts?: { viewerRight?: { x: number; z: number } },
): { state: FacadeState; newRefs: OpeningRef[]; failed: boolean } {
  if (refs.length === 0) return { state, newRefs: [], failed: false }

  const byWall = new Map<string, string[]>()
  for (const ref of refs) {
    const list = byWall.get(ref.wallId) ?? []
    list.push(ref.openingId)
    byWall.set(ref.wallId, list)
  }

  const newRefs: OpeningRef[] = []
  let anyFailed = false
  const sideOrder: Array<'left' | 'right'> =
    preferredSide === 'left' ? ['left', 'right'] : ['right', 'left']

  const nextState = mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)

    const idSet = new Set(openingIds)
    const additions: Opening[] = []
    const profileAdditions: Wall['profiles'] = []
    const grid = openingGridForWall(wall)

    for (const opening of wall.openings) {
      if (!idSet.has(opening.id)) continue
      const nextId = createId()
      const snappedWidth = snapToGrid(opening.width, grid)
      const wallWithAdditions = { ...wall, openings: [...wall.openings, ...additions] }
      const gap = snappedWidth + 32

      let duplicate: Opening | null = null
      let issue: OpeningInsertIssue | null = { kind: 'invalid', message: 'pending' }

      for (const side of sideOrder) {
        const vr = opts?.viewerRight ?? { x: -1, z: 0 }
        const sign = viewerSideToAlongSign(wall, side, vr.x, vr.z)
        const x = sign > 0 ? opening.x + gap : opening.x - gap
        duplicate = clampOpeningToWall({ ...opening, id: nextId, x }, wall, grid)
        issue = assessOpeningInsert(wallWithAdditions, duplicate)
        if (!issue) break
      }

      // Fallback: findOpeningSlot
      if (issue) {
        const slot = findOpeningSlot(wallWithAdditions as Wall, opening.width, opening.height, opening.type)
        if (slot !== null) {
          duplicate = clampOpeningToWall(
            { ...opening, id: nextId, x: slot },
            wall,
            grid,
          )
          issue = assessOpeningInsert(wallWithAdditions, duplicate)
        }
      }

      if (issue || !duplicate) {
        anyFailed = true
        continue
      }

      additions.push(duplicate)
      newRefs.push({ wallId: wall.id, openingId: nextId })
      for (const profile of wall.profiles) {
        if (profile.openingId !== opening.id) continue
        profileAdditions.push({ ...profile, openingId: nextId })
      }
    }

    if (additions.length === 0) return cloneWall(wall)

    return {
      ...cloneWall(wall),
      openings: [...wall.openings, ...additions],
      profiles: [...wall.profiles, ...profileAdditions],
    }
  })

  return {
    state: nextState,
    newRefs,
    failed: anyFailed || newRefs.length === 0,
  }
}

export function updateOpening(
  state: FacadeState,
  wallId: string,
  id: string,
  patch: Partial<Opening>,
): FacadeState {
  return mapWall(state, wallId, (wall) => ({
    ...cloneWall(wall),
    openings: wall.openings.map((opening) => {
      if (opening.id !== id) return opening
      const grid = openingGridForWall(wall)
      let merged: Opening = { ...opening, ...patch }
      if (patch.width !== undefined && patch.x === undefined) {
        merged = {
          ...merged,
          x: centeredOpeningX(opening, merged.width, grid ?? GRID_SIZE),
        }
      }
      if (patch.type != null && patch.type !== opening.type) {
        merged = hydrateOpening(merged, wall)
      }
      return clampOpeningToWall(merged, wall, grid)
    }),
  }))
}

export function updateOpeningFrameColors(
  state: FacadeState,
  refs: OpeningRef[],
  color: string,
): FacadeState {
  if (refs.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        openingIds.has(opening.id) ? { ...opening, frameColor: color } : opening,
      ),
    }
  })
}

export function updateOpeningRevealColors(
  state: FacadeState,
  refs: OpeningRef[],
  patch: { exterior?: string; interior?: string },
): FacadeState {
  if (refs.length === 0) return state
  if (patch.exterior == null && patch.interior == null) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.has(opening.id)) return opening
        return {
          ...opening,
          ...(patch.exterior != null ? { revealExteriorColor: patch.exterior } : {}),
          ...(patch.interior != null ? { revealInteriorColor: patch.interior } : {}),
        }
      }),
    }
  })
}

export function updateOpeningFrameFinishes(
  state: FacadeState,
  refs: OpeningRef[],
  finish: SurfaceFinish,
): FacadeState {
  if (refs.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        openingIds.has(opening.id) ? { ...opening, frameFinish: finish } : opening,
      ),
    }
  })
}

/** Rahmenfarbe für alle Fenster der gewählten Wände. */
export function updateWindowFrameColorsForWalls(
  state: FacadeState,
  wallIds: string[],
  color: string,
): FacadeState {
  if (wallIds.length === 0) return state
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        opening.type === 'window' || opening.type === 'door' ? { ...opening, frameColor: color } : opening,
      ),
    }
  })
}

export function updateOpeningGlassSettings(
  state: FacadeState,
  refs: OpeningRef[],
  patch: Partial<
    Pick<
      Opening,
      'glassMode' | 'glassIor' | 'glassRoughness' | 'glassTransmission' | 'glassThickness'
    >
  >,
): FacadeState {
  if (refs.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        openingIds.has(opening.id) ? { ...opening, ...patch } : opening,
      ),
    }
  })
}

export function updateOpeningGlassColors(
  state: FacadeState,
  refs: OpeningRef[],
  color: string,
): FacadeState {
  if (refs.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        openingIds.has(opening.id) ? { ...opening, glassColor: color } : opening,
      ),
    }
  })
}

export function updateWindowGlassColorsForWalls(
  state: FacadeState,
  wallIds: string[],
  color: string,
): FacadeState {
  if (wallIds.length === 0) return state
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) =>
        opening.type === 'window' || opening.type === 'door' ? { ...opening, glassColor: color } : opening,
      ),
    }
  })
}

export function assignProfile(
  state: FacadeState,
  wallId: string,
  openingId: string,
  edges: OpeningEdge[],
  profileId: string,
): FacadeState {
  return assignProfilesToOpenings(state, [{ wallId, openingId }], edges, profileId)
}

export const DEFAULT_OPENING_TRIM: OpeningTrimConfig = {
  offsetX: 0,
  offsetY: 0,
  offsetForward: 0,
  rotationDeg: 0,
  flipOutward: false,
  flipForward: false,
  cornerJoin: 'miter',
}

const WINDOW_TRIM_DEFAULTS: Partial<OpeningTrimConfig> = {
  offsetForward: WINDOW_TRIM_DEFAULT_OFFSET_FORWARD,
}

export function defaultOpeningTrimForProfile(profileId: string): OpeningTrimConfig {
  const base = { ...DEFAULT_OPENING_TRIM }
  if (isWindowTrimProfile(profileId)) {
    return { ...base, ...WINDOW_TRIM_DEFAULTS }
  }
  return base
}

export function mergeOpeningTrimForProfile(
  profileId: string,
  existing?: OpeningTrimConfig,
): OpeningTrimConfig {
  const defaults = defaultOpeningTrimForProfile(profileId)
  if (!existing) return defaults
  return {
    ...defaults,
    ...existing,
    offsetForward: existing.offsetForward ?? defaults.offsetForward,
  }
}

export function openingProfileEdges(
  wall: Wall,
  openingId: string,
  profileId?: string,
): OpeningEdge[] {
  return wall.profiles
    .filter(
      (profile) =>
        profile.openingId === openingId &&
        (profileId === undefined || profile.profileId === profileId),
    )
    .map((profile) => profile.edge)
}

export function updateOpeningTrim(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<OpeningTrimConfig>,
): FacadeState {
  if (targets.length === 0) return state

  const byWall = new Map<string, string[]>()
  for (const target of targets) {
    const list = byWall.get(target.wallId) ?? []
    list.push(target.openingId)
    byWall.set(target.wallId, list)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.includes(opening.id)) return opening
        return {
          ...opening,
          trim: { ...DEFAULT_OPENING_TRIM, ...opening.trim, ...patch },
        }
      }),
    }
  })
}

export function updateOpeningSills(
  state: FacadeState,
  targets: OpeningRef[],
  patch: { inner?: Partial<OpeningSillInner>; outer?: Partial<OpeningSillOuter> },
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const ids = byWall.get(wall.id)
    if (!ids) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!ids.has(opening.id)) return opening
        return {
          ...opening,
          sillInner: patch.inner
            ? {
                enabled: true,
                depth: 16,
                thickness: 4,
                ...opening.sillInner,
                ...patch.inner,
                color: '#ffffff',
              }
            : opening.sillInner,
          sillOuter: patch.outer
            ? {
                enabled: true,
                profileId: 'fensterprofil32x120',
                scale: 1,
                rotationDeg: 0,
                flipOutward: false,
                flipForward: false,
                ...opening.sillOuter,
                ...patch.outer,
              }
            : opening.sillOuter,
        }
      }),
    }
  })
}

export function updateOpeningStairs(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<OpeningStairs>,
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const ids = byWall.get(wall.id)
    if (!ids) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!ids.has(opening.id) || opening.type !== 'door') return opening
        const merged = { ...defaultOpeningStairs(opening), ...opening.stairs, ...patch }
        const stairs = normalizeOpeningStairs(merged, opening)
        const nextY = stairs.enabled ? stairTopY(stairs) : 0
        const clamped = clampOpeningToWall({ ...opening, y: nextY }, wall, openingGridForWall(wall))
        return {
          ...clamped,
          stairs,
        }
      }),
    }
  })
}

export function updateOpeningRollerShutter(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<OpeningRollerShutter> & {
    motion?: Partial<NonNullable<OpeningRollerShutter['motion']>>
  },
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const ids = byWall.get(wall.id)
    if (!ids) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!ids.has(opening.id)) return opening
        if (opening.type !== 'window' && opening.type !== 'door') return opening
        const prev = normalizeOpeningRollerShutter(opening.rollerShutter)
        const motion = patch.motion
          ? {
              raise: patch.motion.raise ?? prev.motion!.raise,
              lower: patch.motion.lower ?? prev.motion!.lower,
            }
          : prev.motion
        return {
          ...opening,
          rollerShutter: normalizeOpeningRollerShutter({
            ...prev,
            ...patch,
            motion,
          }),
        }
      }),
    }
  })
}

export function updateOpeningPediment(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<OpeningPediment> & {
    consoles?: Partial<NonNullable<OpeningPediment['consoles']>>
  },
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const ids = byWall.get(wall.id)
    if (!ids) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (
          !ids.has(opening.id) ||
          (opening.type !== 'window' && opening.type !== 'door')
        ) {
          return opening
        }
        const { consoles: consolePatch, ...rest } = patch
        const merged = {
          ...opening.pediment,
          ...rest,
          consoles: consolePatch
            ? { ...opening.pediment?.consoles, ...consolePatch }
            : opening.pediment?.consoles,
        }
        return {
          ...opening,
          pediment: normalizeOpeningPediment(merged),
        }
      }),
    }
  })
}

export function updateOpeningGruenderzeit(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<GruenderzeitWindowConfig>,
): FacadeState {
  if (targets.length === 0) return state

  const byWall = new Map<string, string[]>()
  for (const target of targets) {
    const list = byWall.get(target.wallId) ?? []
    list.push(target.openingId)
    byWall.set(target.wallId, list)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.includes(opening.id) || (opening.type !== 'window' && opening.type !== 'door')) {
          return opening
        }
        let gruenderzeit = normalizeGruenderzeitConfig(
          { ...opening.gruenderzeit, ...patch },
          opening.width,
          opening.height,
          opening.type,
        )
        if (basementWindowEnabled(opening)) {
          gruenderzeit = clampGruenderzeitForBasement(gruenderzeit)
        }
        return {
          ...opening,
          gruenderzeit,
        }
      }),
    }
  })
}

export function updateOpeningMotion(
  state: FacadeState,
  targets: OpeningRef[],
  motion: OpeningMotion,
): FacadeState {
  if (targets.length === 0) return state

  const byWall = new Map<string, string[]>()
  for (const target of targets) {
    const list = byWall.get(target.wallId) ?? []
    list.push(target.openingId)
    byWall.set(target.wallId, list)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.includes(opening.id) || (opening.type !== 'window' && opening.type !== 'door')) {
          return opening
        }
        return {
          ...opening,
          motion: normalizeOpeningMotion(motion, opening.type),
        }
      }),
    }
  })
}

export function assignProfilesToOpenings(
  state: FacadeState,
  targets: OpeningRef[],
  edges: OpeningEdge[],
  profileId: string,
): FacadeState {
  if (targets.length === 0 || edges.length === 0) return state

  const byWall = new Map<string, string[]>()
  for (const target of targets) {
    const list = byWall.get(target.wallId) ?? []
    list.push(target.openingId)
    byWall.set(target.wallId, list)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)

    let profiles = wall.profiles.filter(
      (profile) =>
        !openingIds.includes(profile.openingId) || !edges.includes(profile.edge),
    )
    for (const openingId of openingIds) {
      for (const edge of edges) {
        profiles.push({ openingId, profileId, edge })
      }
    }

    const openings = wall.openings.map((opening) => {
      if (!openingIds.includes(opening.id)) return opening
      if (!isWindowTrimProfile(profileId)) return opening
      return {
        ...opening,
        trim: mergeOpeningTrimForProfile(profileId, opening.trim),
      }
    })

    return {
      ...cloneWall(wall),
      openings,
      profiles,
    }
  })
}

export function removeProfiles(
  state: FacadeState,
  wallId: string,
  openingId: string,
  edges: OpeningEdge[],
): FacadeState {
  return removeProfilesFromOpenings(state, [{ wallId, openingId }], edges)
}

export function removeProfilesFromOpenings(
  state: FacadeState,
  targets: OpeningRef[],
  edges: OpeningEdge[],
): FacadeState {
  const byWall = new Map<string, string[]>()
  for (const target of targets) {
    const list = byWall.get(target.wallId) ?? []
    list.push(target.openingId)
    byWall.set(target.wallId, list)
  }

  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      profiles: wall.profiles.filter(
        (profile) =>
          !openingIds.includes(profile.openingId) || !edges.includes(profile.edge),
      ),
    }
  })
}

/** Setzt ausgewählte Öffnungen auf Bibliotheks-Defaults; Position, Größe und Typ bleiben. */
export function resetOpenings(state: FacadeState, refs: OpeningRef[]): FacadeState {
  if (refs.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const ref of refs) {
    const set = byWall.get(ref.wallId) ?? new Set<string>()
    set.add(ref.openingId)
    byWall.set(ref.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const ids = byWall.get(wall.id)
    if (!ids) return cloneWall(wall)
    const openings = wall.openings.map((opening) => {
      if (!ids.has(opening.id)) return opening
      const fresh = createOpening(opening.type, opening.width, opening.height, {
        ...wall,
        openings: [],
      })
      return hydrateOpening(
        {
          ...fresh,
          id: opening.id,
          x: opening.x,
          y: opening.y,
          width: opening.width,
          height: opening.height,
          hidden: opening.hidden,
        },
        wall,
      )
    })
    return {
      ...cloneWall(wall),
      openings,
      profiles: wall.profiles.filter((profile) => !ids.has(profile.openingId)),
    }
  })
}

export function collectUsedProfileIds(state: FacadeState): string[] {
  const ids = new Set<string>()
  for (const wall of getAllWalls(state)) {
    for (const profile of wall.profiles) {
      ids.add(profile.profileId)
    }
  }
  return [...ids]
}

export function applyWallOpeningPreset(
  state: FacadeState,
  wallId: string,
  preset: { id: string; type: Opening['type']; width: number; height: number },
): { state: FacadeState; opening: Opening } {
  const wall = findWall(state, wallId)
  if (!wall) {
    return {
      state,
      opening: createOpening(preset.type, preset.width, preset.height, {
        width: preset.width,
        height: WALL_HEIGHT,
        depth: WALL_DEPTH,
      }),
    }
  }

  const opening = createOpening(preset.type, preset.width, preset.height, wall)
  const next = mapWall(state, wallId, (current) => ({
    ...cloneWall(current),
    presetId: preset.id,
    openings: [opening],
    profiles: [],
  }))
  return { state: next, opening }
}

/** Verschiebt eine Öffnung um dx/dy, gerundet auf Platzierungsraster, geclampt auf Wandgrenzen. */
export function moveOpening(
  state: FacadeState,
  wallId: string,
  openingId: string,
  dx: number,
  dy: number,
): FacadeState {
  const MIN_GAP = OPENING_MIN_GAP
  return mapWall(state, wallId, (wall) => {
    const step = openingPositionStep(wall)
    const grid = openingGridForWall(wall)
    const others = wall.openings.filter((o) => o.id !== openingId)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (opening.id !== openingId) return opening
        const newX = Math.round((opening.x + dx) / step) * step
        const newY =
          opening.type === 'door' && opening.stairs?.enabled
            ? stairTopY(normalizeOpeningStairs(opening.stairs, opening))
            : Math.round((opening.y + dy) / step) * step
        const clamped = clampOpeningToWall({ ...opening, x: newX, y: newY }, wall, grid)
        // Mindestabstand zu Nachbarn: wenn Konflikt, Position beibehalten
        const hasConflict = others.some((o) => openingsTooClose(clamped, o, MIN_GAP))
        return hasConflict ? opening : clamped
      }),
    }
  })
}

export function collectOpenings(
  state: FacadeState,
  filter?: Opening['type'],
): OpeningRef[] {
  const refs: OpeningRef[] = []
  for (const wall of getAllWalls(state)) {
    for (const opening of wall.openings) {
      if (filter && opening.type !== filter) continue
      refs.push({ wallId: wall.id, openingId: opening.id })
    }
  }
  return refs
}
