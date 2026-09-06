/**
 * Sichtbarkeit von Fassadenschmuck je Haus (Ebenen-Panel → „Fassadenschmuck“).
 * Nur Darstellung — Daten bleiben erhalten.
 */

export type FacadeDecorKind =
  | 'panels'
  | 'plinth'
  | 'cornice'
  | 'trimBands'
  | 'profiles'
  /** Fensterbänke außen + Fensterbretter innen — kein Profil-Schmuck, eigener Schalter. */
  | 'sills'
  | 'labels'

export type FacadeDecorVisibility = Record<FacadeDecorKind, boolean>

export const FACADE_DECOR_KINDS: ReadonlyArray<{
  id: FacadeDecorKind
  label: string
}> = [
  { id: 'panels', label: 'Paneele / Mauerwerk' },
  { id: 'plinth', label: 'Sockel' },
  { id: 'cornice', label: 'Gesimse' },
  { id: 'trimBands', label: 'Zierbänder' },
  { id: 'profiles', label: 'Profile' },
  { id: 'sills', label: 'Fensterbänke / -bretter' },
  { id: 'labels', label: 'Schrift' },
]

export const DEFAULT_FACADE_DECOR: FacadeDecorVisibility = {
  panels: true,
  plinth: true,
  cornice: true,
  trimBands: true,
  profiles: true,
  sills: true,
  labels: true,
}

export function normalizeFacadeDecor(
  raw: Partial<FacadeDecorVisibility> | undefined | null,
): FacadeDecorVisibility {
  return {
    panels: raw?.panels !== false,
    plinth: raw?.plinth !== false,
    cornice: raw?.cornice !== false,
    trimBands: raw?.trimBands !== false,
    profiles: raw?.profiles !== false,
    sills: raw?.sills !== false,
    labels: raw?.labels !== false,
  }
}

export function allFacadeDecorVisible(decor: FacadeDecorVisibility): boolean {
  return FACADE_DECOR_KINDS.every((item) => decor[item.id] !== false)
}

export function withAllFacadeDecor(visible: boolean): FacadeDecorVisibility {
  return {
    panels: visible,
    plinth: visible,
    cornice: visible,
    trimBands: visible,
    profiles: visible,
    sills: visible,
    labels: visible,
  }
}

/** True wenn sich nur `building.facadeDecor` geändert hat (kein Geometrie-Rebuild). */
export function facadeStateDiffersOnlyByFacadeDecor(
  prev: import('../types/facade').FacadeState,
  next: import('../types/facade').FacadeState,
): boolean {
  if (prev.activeBuildingId !== next.activeBuildingId) return false
  if (prev.buildings.length !== next.buildings.length) return false
  if (prev.siteYawDeg !== next.siteYawDeg) return false
  let decorChanged = false
  for (let i = 0; i < next.buildings.length; i += 1) {
    const a = prev.buildings[i]!
    const b = next.buildings[i]!
    if (a.id !== b.id) return false
    const { facadeDecor: da, ...restA } = a
    const { facadeDecor: db, ...restB } = b
    if (JSON.stringify(restA) !== JSON.stringify(restB)) return false
    if (JSON.stringify(normalizeFacadeDecor(da)) !== JSON.stringify(normalizeFacadeDecor(db))) {
      decorChanged = true
    }
  }
  return decorChanged
}
