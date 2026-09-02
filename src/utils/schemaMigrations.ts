/**
 * Fassaden-Schema-Leiter (getrennt von APP_VERSION).
 * Beim Laden: migrateFacadeSchema → hydrateFacadeState → clampFacadeState.
 */
import type { FacadeState, Opening, Wall } from '../types/facade'
import { cloneFacadeState, cloneWall } from '../types/facade'
import { repairPlanLinkedWallFronts } from '../studio/walls'
import { getAllWalls, mapAllWalls } from './buildings'
import { migrateOpeningPanelFan } from './openingGeometry'
import { alignOpeningToMasonry, wallUsesOpeningMasonrySnap } from './openingPanelSnap'
import {
  DEFAULT_CEILING_COLOR,
  DEFAULT_INTERIOR_COLOR,
  isTransparentGlass,
  PREVIOUS_CEILING_COLOR_DEFAULTS,
} from '../constants/colorPalettes'
import {
  DEFAULT_GLASS_TRANSMISSION,
  PREVIOUS_GLASS_TRANSMISSION_DEFAULTS,
} from './glassConfig'
import {
  OUTER_SILL_DEFAULT_CM,
  PREVIOUS_OUTER_SILL_DEPTH_DEFAULTS,
  clampOuterSillDepth,
  replaceUnchangedDefault,
} from './hydrate'

/** Aktuelle Persistenz-Schema-Version (steigt nur bei Datenmodell-Änderungen). */
export const FACADE_SCHEMA_VERSION = 14

/** Unterste Version, die Hash-/Datei-Imports ohne gespeicherte schemaVersion annehmen. */
export const FACADE_SCHEMA_IMPORT_BASE = 7

export type SchemaMigration = {
  from: number
  to: number
  id: string
  apply: (state: FacadeState) => FacadeState
}

export { migrateOpeningPanelFan }

function migratePanelFanFacade(state: FacadeState): FacadeState {
  return mapAllWalls(state, (wall: Wall) => {
    const cloned = cloneWall(wall)
    return {
      ...cloned,
      openings: cloned.openings.map(migrateOpeningPanelFan),
    }
  })
}

/**
 * Alter Building-Default windowDepthOffset −24 meinte „in der Laibung“;
 * 24 cm sind jetzt Basisversatz → 0.
 */
export function migrateWindowDepthOffsetNeg24(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      windowDepthOffset:
        building.windowDepthOffset === -24 ? 0 : building.windowDepthOffset,
      walls: building.walls.map((wall) => {
        const cloned = cloneWall(wall)
        return {
          ...cloned,
          openings: cloned.openings.map((opening) =>
            opening.depthOffset === -24 ? { ...opening, depthOffset: 0 } : opening,
          ),
        }
      }),
    })),
  }
}

/** Alte Sockelprofil-ID `sockelStandard` → `sockelprofil`. */
export function migratePlinthSockelStandard(state: FacadeState): FacadeState {
  return mapAllWalls(state, (wall: Wall) => {
    if (!wall.panel || wall.panel.plinthProfileId !== 'sockelStandard') return cloneWall(wall)
    return {
      ...cloneWall(wall),
      panel: { ...wall.panel, plinthProfileId: 'sockelprofil' },
    }
  })
}

function migrateOpeningUnchangedDefaults(opening: Opening): Opening {
  let next: Opening = { ...opening }
  if (next.sillOuter && typeof next.sillOuter.depth === 'number') {
    next = {
      ...next,
      sillOuter: {
        ...next.sillOuter,
        depth: clampOuterSillDepth(
          replaceUnchangedDefault(
            next.sillOuter.depth,
            PREVIOUS_OUTER_SILL_DEPTH_DEFAULTS,
            OUTER_SILL_DEFAULT_CM,
          ),
        ),
      },
    }
  }
  if (next.glassMode === 'physical') {
    next = {
      ...next,
      glassTransmission: replaceUnchangedDefault(
        next.glassTransmission,
        PREVIOUS_GLASS_TRANSMISSION_DEFAULTS,
        DEFAULT_GLASS_TRANSMISSION,
      ),
    }
  }
  return next
}

/**
 * Neue Code-Defaults auf Bestands-Elemente: nur wenn der gespeicherte Wert
 * noch dem alten Default entspricht (Nutzer-Override bleibt).
 */
export function migrateUnchangedOpeningDefaults(state: FacadeState): FacadeState {
  return mapAllWalls(state, (wall: Wall) => {
    const cloned = cloneWall(wall)
    return {
      ...cloned,
      openings: cloned.openings.map(migrateOpeningUnchangedDefaults),
    }
  })
}

function hexKey(color: string | undefined): string | undefined {
  if (typeof color !== 'string') return undefined
  const t = color.trim().toLowerCase()
  return t.length > 0 ? t : undefined
}

/**
 * Innenwand und Decke/Boden: Default Weiß.
 * Alte Decken-Fallbacks (#9a8a7a / #8a7a6a) nur ersetzen, wenn sie noch der alte Default sind.
 */
export function migrateIndoorWhiteDefaults(state: FacadeState): FacadeState {
  const previousCeiling = new Set<string>(PREVIOUS_CEILING_COLOR_DEFAULTS)
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      floors: (building.floors ?? []).map((plan) => {
        const key = hexKey(plan.ceilingColor)
        if (!key || previousCeiling.has(key)) {
          return { ...plan, ceilingColor: DEFAULT_CEILING_COLOR }
        }
        return plan
      }),
      walls: building.walls.map((wall) => {
        const cloned = cloneWall(wall)
        return {
          ...cloned,
          interiorColor: cloned.interiorColor ?? DEFAULT_INTERIOR_COLOR,
        }
      }),
    })),
  }
}

function openingsAabbOverlap(
  a: Pick<Opening, 'x' | 'y' | 'width' | 'height'>,
  b: Pick<Opening, 'x' | 'y' | 'width' | 'height'>,
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * Läufer-/Mauerwerksverband: Laibungen und Maße auf Fugen/Schichten (einmalig).
 * Idempotent wenn die Öffnung schon sitzt. Bei Überlappung nach Snap bleibt das Original.
 */
export function migrateAlignMasonryOpenings(state: FacadeState): FacadeState {
  const allWalls = getAllWalls(state)
  return mapAllWalls(state, (wall: Wall) => {
    if (!wallUsesOpeningMasonrySnap(wall)) return cloneWall(wall)
    const cloned = cloneWall(wall)
    const openings: Opening[] = []
    for (const opening of cloned.openings) {
      if (opening.hidden) {
        openings.push(opening)
        continue
      }
      const aligned = alignOpeningToMasonry(wall, allWalls, opening)
      const next: Opening = {
        ...opening,
        x: aligned.x,
        y: aligned.y,
        width: aligned.width,
        height: aligned.height,
      }
      if (openings.some((o) => !o.hidden && openingsAabbOverlap(next, o))) {
        openings.push(opening)
        continue
      }
      if (
        next.arch?.enabled &&
        next.arch.form === 'round' &&
        next.arch.riseCm != null &&
        Math.abs(opening.width / 2 - next.arch.riseCm) < 1.5
      ) {
        next.arch = { ...next.arch, riseCm: Math.min(next.width / 2, next.height) }
      }
      openings.push(next)
    }
    return { ...cloned, openings }
  })
}

/**
 * Schema-Migrationen in Reihenfolge.
 * Fehlende Stufen (from → from+1 ohne Eintrag) werden als No-Op hochgezählt.
 */
export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    from: 8,
    to: 9,
    id: 'panel-fan-to-clearance',
    apply: migratePanelFanFacade,
  },
  {
    from: 9,
    to: 10,
    id: 'depth-offset-neg24-and-sockel-id',
    apply: (state) => migratePlinthSockelStandard(migrateWindowDepthOffsetNeg24(state)),
  },
  {
    from: 10,
    to: 11,
    id: 'repair-linked-wall-inverted-joints',
    apply: repairPlanLinkedWallFronts,
  },
  {
    from: 11,
    to: 12,
    id: 'unchanged-defaults-sill-glass',
    apply: migrateUnchangedOpeningDefaults,
  },
  {
    from: 12,
    to: 13,
    id: 'indoor-white-defaults',
    apply: migrateIndoorWhiteDefaults,
  },
  {
    from: 13,
    to: 14,
    id: 'align-masonry-openings',
    apply: migrateAlignMasonryOpenings,
  },
]

/**
 * Wendet die Schema-Leiter von `fromVersion` bis `FACADE_SCHEMA_VERSION` an.
 */
export function migrateFacadeSchema(
  facade: FacadeState,
  fromVersion: number,
): { facade: FacadeState; schemaVersion: number } {
  let version = Number.isFinite(fromVersion) ? Math.floor(fromVersion) : FACADE_SCHEMA_IMPORT_BASE
  if (version < 1) version = 1
  let state = cloneFacadeState(facade)

  while (version < FACADE_SCHEMA_VERSION) {
    const step = SCHEMA_MIGRATIONS.find((m) => m.from === version)
    if (step) {
      state = step.apply(state)
      version = step.to
    } else {
      version += 1
    }
  }

  return { facade: state, schemaVersion: version }
}

/**
 * True wenn irgendein Element `needsReview` gesetzt hat (Breaking-/Review-Pfad).
 */
export function facadeHasNeedsReview(state: FacadeState): boolean {
  for (const building of state.buildings) {
    for (const wall of building.walls) {
      if (wall.needsReview) return true
      for (const opening of wall.openings) {
        if (opening.needsReview) return true
      }
    }
  }
  return false
}
