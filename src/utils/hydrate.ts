/**
 * Kanonische Feldkataloge für Walls/Openings.
 * Hydrate füllt fehlende Nested-Configs mit Feature AUS / neutralen Defaults —
 * Optik alter Projekte bleibt gleich, UI-Sektionen werden sichtbar.
 */
import type {
  FacadeState,
  Opening,
  OpeningTrimConfig,
  Wall,
  WallCorniceConfig,
  WallLabelConfig,
} from '../types/facade'
import { cloneWall } from '../types/facade'
import {
  DEFAULT_CEILING_COLOR,
  DEFAULT_GLASS_COLOR,
  DEFAULT_INTERIOR_COLOR,
  defaultOpeningFrameColor,
} from '../constants/colorPalettes'
import {
  DEFAULT_NICHE_DEPTH_CM,
  normalizeOpeningArch,
  normalizeOpeningFill,
  normalizePanelClearance,
  normalizeRevealFrame,
} from './openingGeometry'
import {
  DEFAULT_GLASS_TRANSMISSION,
  PREVIOUS_GLASS_TRANSMISSION_DEFAULTS,
  openingGlassConfig,
} from './glassConfig'
import { defaultOpeningPediment, normalizeOpeningPediment } from '../studio/pediment'
import { defaultOpeningStairs, syncStairsToDoorWidth } from '../studio/stairs'
import { defaultOpeningRollerShutter, normalizeOpeningRollerShutter } from '../studio/rollerShutter'
import { gruenderzeitConfigForOpening } from '../windows/gruenderzeit'
import {
  normalizeOpeningDoor,
  normalizeOpeningGuard,
  normalizeOpeningInteriorShade,
} from '../windows/openingExtras'
import { normalizeOpeningMotion } from './openingMotion'
import { normalizeStudioPanel, DEFAULT_STUDIO_PANEL } from '../studio/constants'
import { NEUTRAL_WALL_LABEL, nudgeWallLabelOffOpenings } from './wallLabel'
import { normalizeWallTrimBand } from './trimBands'

/** Vorstand der Außenbank über die äußere Fassadenfläche (cm). Hartes Maximum. */
export const OUTER_SILL_MAX_CM = 16
export const OUTER_SILL_DEFAULT_CM = 16
/** @deprecated Alias — bleibt 16 cm, nicht mehr Paneel+16. */
export const OUTER_SILL_PAST_FACADE_CM = OUTER_SILL_DEFAULT_CM

/**
 * Frühere Code-Defaults der Außenbank-Tiefe. Werte, die noch genau einem davon
 * entsprechen, gelten als „nicht vom Nutzer überschrieben“.
 */
export const PREVIOUS_OUTER_SILL_DEPTH_DEFAULTS = [20, 32, 36, 40, 48] as const

/**
 * Wenn ein gespeicherter Wert noch dem alten Default entspricht, den neuen setzen.
 * Weicht er ab, hat der Nutzer überschrieben — unverändert lassen.
 */
export function replaceUnchangedDefault<T>(
  value: T | undefined,
  previousDefaults: readonly T[],
  nextDefault: T,
): T {
  if (value === undefined) return nextDefault
  if (previousDefaults.some((item) => Object.is(item, value))) return nextDefault
  return value
}

export function clampOuterSillDepth(depth: number | undefined): number {
  const n = typeof depth === 'number' && Number.isFinite(depth) ? depth : OUTER_SILL_DEFAULT_CM
  return Math.max(2, Math.min(OUTER_SILL_MAX_CM, n))
}

/**
 * Standard-Tiefe der Fensterbank: 16 cm Vorstand vor der äußeren Fassadenfläche.
 */
export function defaultOuterSillDepth(_wall?: {
  depth?: number
  panel?: { enabled?: boolean; projectDepth?: number; taperDepth?: number } | null
}): number {
  void _wall
  return OUTER_SILL_DEFAULT_CM
}

/** Neutrales Trim (kein Fensterprofil-Offset), Feature-neutral. */
export const HYDRATE_OPENING_TRIM: OpeningTrimConfig = {
  offsetX: 0,
  offsetY: 0,
  offsetForward: 0,
  rotationDeg: 0,
  flipOutward: false,
  flipForward: false,
  cornerJoin: 'miter',
  scale: 1,
}

const NEUTRAL_CORNICE: WallCorniceConfig = {
  enabled: false,
  edge: 'top',
  scale: 1,
  profileId: 'fensterprofil32x120',
  rotationDeg: 0,
  flipOutward: false,
  flipForward: false,
  offsetForward: 0,
}

function isStudioKind(wall: Wall): boolean {
  return wall.kind === 'studio'
}

function hydrateSills(
  opening: Opening,
  wall?: { depth?: number; panel?: Wall['panel'] },
): Opening {
  if (opening.type !== 'window' || opening.y <= 0) {
    return {
      ...opening,
      sillInner: opening.sillInner,
      sillOuter: opening.sillOuter,
    }
  }
  const outerDefault = {
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
  return {
    ...opening,
    sillInner: opening.sillInner ?? {
      enabled: true,
      depth: 16,
      thickness: 4,
      color: '#ffffff',
    },
    sillOuter: opening.sillOuter
      ? {
          ...opening.sillOuter,
          depth: clampOuterSillDepth(
            replaceUnchangedDefault(
              opening.sillOuter.depth,
              PREVIOUS_OUTER_SILL_DEPTH_DEFAULTS,
              OUTER_SILL_DEFAULT_CM,
            ),
          ),
        }
      : outerDefault,
  }
}

/**
 * Vervollständigt eine Öffnung auf den aktuellen Feldkatalog.
 * Fehlende Features: enabled false / neutrale Defaults (keine Optik-Änderung).
 */
export function hydrateOpening(
  opening: Opening,
  wall?: Pick<Wall, 'panel' | 'kind'> | Pick<Wall, 'width' | 'height' | 'depth' | 'panel' | 'kind'>,
): Opening {
  let next: Opening = { ...opening }

  if (next.type === 'cutout') {
    next.fill = normalizeOpeningFill(next.fill ?? { mode: 'niche' })
    if (!next.cutoutShape) next.cutoutShape = 'rect'
    next.revealFrame = normalizeRevealFrame(next.revealFrame)
    next.panelClearance = normalizePanelClearance(next.panelClearance)
    next.arch = normalizeOpeningArch(next.arch)
    next.hidden = Boolean(next.hidden)
    next.needsReview =
      typeof next.needsReview === 'string' && next.needsReview.trim()
        ? next.needsReview.trim()
        : undefined
    return next
  }

  if (next.type === 'conch') {
    const depth = Math.max(1, next.fill?.nicheDepthCm ?? DEFAULT_NICHE_DEPTH_CM)
    next.fill = { mode: 'niche', nicheDepthCm: depth }
    next.cutoutShape = undefined
    next.revealFrame = normalizeRevealFrame(next.revealFrame)
    next.panelClearance = normalizePanelClearance(next.panelClearance)
    // Konche: immer Rundbogen-Maske; Stich = halbe Breite (volle Halbkreis-Krone).
    const rise = Math.min(next.width / 2, next.height)
    next.arch = normalizeOpeningArch({
      enabled: true,
      form: 'round',
      riseCm: rise,
      voussoirs: false,
      jambs: false,
    })
    next.hidden = Boolean(next.hidden)
    next.needsReview =
      typeof next.needsReview === 'string' && next.needsReview.trim()
        ? next.needsReview.trim()
        : undefined
    return next
  }

  next.revealFrame = normalizeRevealFrame(next.revealFrame)
  next.panelClearance = normalizePanelClearance(next.panelClearance)
  next.fill = normalizeOpeningFill(next.fill)
  next.arch = normalizeOpeningArch(next.arch)
  // glazingArch: Legacy, ignoriert — Blendrahmen folgt immer Opening.arch.form; nicht auf false setzen.

  next.frameColor = next.frameColor ?? defaultOpeningFrameColor(next.type)
  next.frameFinish =
    next.frameFinish === 'glossy' || next.frameFinish === 'metal' ? next.frameFinish : 'matte'
  next.glassColor = next.glassColor ?? DEFAULT_GLASS_COLOR
  const glass = openingGlassConfig(next)
  next.glassMode = next.glassMode === 'physical' ? 'physical' : 'tint'
  next.glassIor = next.glassIor ?? glass.ior
  next.glassRoughness = next.glassRoughness ?? glass.roughness
  next.glassTransmission = replaceUnchangedDefault(
    next.glassTransmission ?? glass.transmission,
    PREVIOUS_GLASS_TRANSMISSION_DEFAULTS,
    DEFAULT_GLASS_TRANSMISSION,
  )
  next.glassThickness = next.glassThickness ?? glass.thickness

  next.trim = { ...HYDRATE_OPENING_TRIM, ...next.trim }
  next.gruenderzeit = gruenderzeitConfigForOpening(next)
  if (next.type === 'window' || next.type === 'door') {
    next.motion = normalizeOpeningMotion(next.motion, next.type)
    next.pediment = normalizeOpeningPediment(next.pediment ?? defaultOpeningPediment())
    next.rollerShutter = normalizeOpeningRollerShutter(
      next.rollerShutter ?? defaultOpeningRollerShutter(),
    )
    next.guard = normalizeOpeningGuard(next.guard)
    next.interiorShade = normalizeOpeningInteriorShade(next.interiorShade)
  }

  if (next.type === 'door') {
    next.stairs = syncStairsToDoorWidth(next.stairs ?? defaultOpeningStairs(next), next)
    next.door = normalizeOpeningDoor(next.door)
  }

  if (next.type === 'window') {
    next.basementWindow = next.basementWindow
      ? { enabled: Boolean(next.basementWindow.enabled), grilleHeight: next.basementWindow.grilleHeight ?? 0.5 }
      : { enabled: false, grilleHeight: 0.5 }
  }

  next = hydrateSills(next, wall)
  next.hidden = Boolean(next.hidden)
  next.needsReview =
    typeof next.needsReview === 'string' && next.needsReview.trim()
      ? next.needsReview.trim()
      : undefined
  return next
}

/** Vervollständigt eine Wand inkl. Öffnungen. */
export function hydrateWall(wall: Wall): Wall {
  const cloned = cloneWall(wall)
  const openings = cloned.openings.map((opening) => hydrateOpening(opening, cloned))

  let panel = cloned.panel
  if (isStudioKind(cloned)) {
    panel = normalizeStudioPanel(cloned.panel ?? DEFAULT_STUDIO_PANEL)
  }

  const cornice: WallCorniceConfig | undefined = cloned.cornice
    ? {
        ...NEUTRAL_CORNICE,
        ...cloned.cornice,
        enabled: Boolean(cloned.cornice.enabled),
      }
    : isStudioKind(cloned)
      ? { ...NEUTRAL_CORNICE }
      : cloned.cornice

  const wallForLabel = { ...cloned, openings }
  const label: WallLabelConfig | undefined = isStudioKind(cloned)
    ? nudgeWallLabelOffOpenings(
        wallForLabel,
        cloned.label
          ? { ...NEUTRAL_WALL_LABEL, ...cloned.label, enabled: Boolean(cloned.label.enabled) }
          : { ...NEUTRAL_WALL_LABEL },
      )
    : cloned.label

  const bayWindow = cloned.bayWindow
    ? {
        frontWidthCm: cloned.bayWindow.frontWidthCm,
        depthCm: cloned.bayWindow.depthCm,
        shape:
          cloned.bayWindow.shape === 'angled45' || cloned.bayWindow.shape === 'round'
            ? cloned.bayWindow.shape
            : ('rect' as const),
        kind:
          cloned.bayWindow.kind === 'balcony' || cloned.bayWindow.kind === 'loggia'
            ? cloned.bayWindow.kind
            : ('bay' as const),
        wallIds: Array.isArray(cloned.bayWindow.wallIds)
          ? cloned.bayWindow.wallIds.map(String)
          : [],
      }
    : undefined

  return {
    ...cloned,
    planLinked: cloned.planLinked !== false,
    panelFlip: cloned.panelFlip ?? true,
    originX: cloned.originX ?? cloned.x,
    originZ: cloned.originZ ?? 0,
    yawDeg: cloned.yawDeg ?? 0,
    miterStart: cloned.miterStart ?? 0,
    miterEnd: cloned.miterEnd ?? 0,
    wallFinish: cloned.wallFinish === 'glossy' || cloned.wallFinish === 'metal' ? cloned.wallFinish : 'matte',
    claddingFinish:
      cloned.claddingFinish === 'glossy' || cloned.claddingFinish === 'metal'
        ? cloned.claddingFinish
        : 'matte',
    profileFinish:
      cloned.profileFinish === 'glossy' || cloned.profileFinish === 'metal'
        ? cloned.profileFinish
        : 'matte',
    panel,
    cornice,
    trimBands: cloned.trimBands?.map((band) => normalizeWallTrimBand(band)),
    label,
    openings,
    profiles: cloned.profiles.map((p) => ({ ...p })),
    bayWindow,
    arcBay: cloned.arcBay
      ? {
          frontWidthCm: cloned.arcBay.frontWidthCm,
          depthCm: cloned.arcBay.depthCm,
          inward: Boolean(cloned.arcBay.inward),
        }
      : undefined,
    interiorColor: cloned.interiorColor ?? DEFAULT_INTERIOR_COLOR,
    hidden: Boolean(cloned.hidden),
    needsReview:
      typeof cloned.needsReview === 'string' && cloned.needsReview.trim()
        ? cloned.needsReview.trim()
        : undefined,
  }
}

/** Hydriert alle Gebäude/Wände/Öffnungen eines FacadeState. */
export function hydrateFacadeState(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      bareWalls: building.bareWalls ?? false,
      floors: (building.floors ?? []).map((plan) => ({
        ...plan,
        ceilingColor: plan.ceilingColor ?? DEFAULT_CEILING_COLOR,
      })),
      walls: building.walls.map(hydrateWall),
      groups: (building.groups ?? []).map((g) => ({ ...g })),
    })),
  }
}

/** Prüft, ob eine Öffnung den kanonischen Feldkatalog hat (für Tests). */
export function openingHasCanonicalFields(opening: Opening): boolean {
  if (opening.type === 'cutout' || opening.type === 'conch') {
    return Boolean(opening.fill && opening.revealFrame && opening.panelClearance && opening.arch)
  }
  if (!opening.revealFrame || !opening.panelClearance || !opening.fill || !opening.arch) return false
  if (!opening.trim || !opening.gruenderzeit) return false
  if (opening.frameColor == null || opening.glassColor == null || opening.glassMode == null) return false
  if (opening.type === 'window' || opening.type === 'door') {
    if (!opening.pediment) return false
  }
  if (opening.type === 'door' && !opening.stairs) return false
  if (opening.type === 'window' && opening.y > 0 && (!opening.sillInner || !opening.sillOuter)) return false
  if (opening.type === 'window' && !opening.basementWindow) return false
  if ((opening.type === 'window' || opening.type === 'door') && !opening.motion) return false
  return true
}
