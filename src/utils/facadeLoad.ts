import type { FacadeState } from '../types/facade'
import { clampFacadeState } from './walls'
import { finalizeStudioGeometry, fitStateWallsToOuterSpine, buildingNeedsOuterSpineFit } from '../studio/planGeometry'
import { repairPlanLinkedWallFronts } from '../studio/walls'
import {
  FACADE_SCHEMA_IMPORT_BASE,
  FACADE_SCHEMA_VERSION,
  migrateFacadeSchema,
} from './schemaMigrations'

/**
 * Gemeinsame Load-Pipeline für localStorage, Hash und Datei-Import:
 * migrateFacadeSchema → hydrate → clamp → Bestands-Repair → Außenkante-Fit → finalize.
 */
export function applyFacadeLoadPipeline(
  facade: FacadeState,
  fromVersion: number = FACADE_SCHEMA_IMPORT_BASE,
): { facade: FacadeState; schemaVersion: number } {
  const migrated = migrateFacadeSchema(facade, fromVersion)
  const clamped = clampFacadeState(migrated.facade)
  const repaired = repairPlanLinkedWallFronts(clamped)
  const fitted = repaired.buildings.some(buildingNeedsOuterSpineFit)
    ? fitStateWallsToOuterSpine(repaired)
    : repaired
  return {
    facade: finalizeStudioGeometry(fitted),
    schemaVersion: Math.max(migrated.schemaVersion, FACADE_SCHEMA_VERSION),
  }
}
