/**
 * Virtuelle Wand-ID für Gaubenfenster — gleiche Opening-Pipeline wie Fassadenfenster.
 * Format: `__rdw:{buildingId}:{dormerId}`
 */
import type { Building, FacadeState, Opening, OpeningRef, RoofDormer, Wall } from '../types/facade'
import { normalizeRoof } from './roof'

export const ROOF_DORMER_WALL_PREFIX = '__rdw:'

export function roofDormerWallId(buildingId: string, dormerId: string): string {
  return `${ROOF_DORMER_WALL_PREFIX}${buildingId}:${dormerId}`
}

export function parseRoofDormerWallId(
  wallId: string | null | undefined,
): { buildingId: string; dormerId: string } | null {
  if (!wallId || !wallId.startsWith(ROOF_DORMER_WALL_PREFIX)) return null
  const rest = wallId.slice(ROOF_DORMER_WALL_PREFIX.length)
  const i = rest.indexOf(':')
  if (i <= 0 || i >= rest.length - 1) return null
  return { buildingId: rest.slice(0, i), dormerId: rest.slice(i + 1) }
}

export function isRoofDormerWallId(wallId: string | null | undefined): boolean {
  return Boolean(parseRoofDormerWallId(wallId))
}

export function partitionOpeningRefs(refs: OpeningRef[]): {
  wallRefs: OpeningRef[]
  dormerRefs: OpeningRef[]
} {
  const wallRefs: OpeningRef[] = []
  const dormerRefs: OpeningRef[] = []
  for (const ref of refs) {
    if (isRoofDormerWallId(ref.wallId)) dormerRefs.push(ref)
    else wallRefs.push(ref)
  }
  return { wallRefs, dormerRefs }
}

/** Synthetische Frontwand der Gaube — Maße = Gaubenfront, eine Öffnung = Gaubenfenster. */
export function syntheticRoofDormerWall(
  building: Building,
  dormer: RoofDormer,
  window: Opening,
): Wall {
  return {
    id: roofDormerWallId(building.id, dormer.id),
    buildingId: building.id,
    kind: 'studio',
    width: dormer.widthCm,
    height: Math.max(48, dormer.heightCm),
    depth: dormer.wallThicknessCm ?? 20,
    x: 0,
    y: 0,
    openings: [window],
    profiles: [],
    neighbors: {},
    wallColor: dormer.wallColor,
  }
}

export function findRoofDormerWall(
  state: FacadeState,
  wallId: string,
): Wall | undefined {
  const parsed = parseRoofDormerWallId(wallId)
  if (!parsed) return undefined
  const building = state.buildings.find((b) => b.id === parsed.buildingId)
  if (!building) return undefined
  const roof = normalizeRoof(building.roof)
  const dormer = roof.dormers?.find((d) => d.id === parsed.dormerId)
  if (!dormer || dormer.hidden || dormer.window?.hidden) return undefined
  const win = dormer.window
  if (!win) return undefined
  return syntheticRoofDormerWall(building, dormer, win)
}

export function findBuildingForRoofDormerWall(
  state: FacadeState,
  wallId: string,
): Building | undefined {
  const parsed = parseRoofDormerWallId(wallId)
  if (!parsed) return undefined
  return state.buildings.find((b) => b.id === parsed.buildingId)
}
