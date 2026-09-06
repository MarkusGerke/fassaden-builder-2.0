/**
 * 3D-Pick-Hilfen: Decke vs. Fassade (keine Auswahl durch Okkluder / Prioritätsregeln).
 */

/** Unsichtbare Schatten-/Soffit-Meshes dürfen keine Objektwahl auslösen. */
export function isNonPickableIndoorKind(kind: string | undefined): boolean {
  return (
    kind === 'sunCeilingOccluder' ||
    kind === 'baySoffit' ||
    kind === 'bayMouthSunOccluder' ||
    kind === 'pointLightRoomOccluder' ||
    kind === 'openingShadowTunnel'
  )
}

/**
 * Sichtbare Geschossplatte (Decke oder Boden) — wählbar als selectedCeiling.
 * Schatten-Okkluder und Soffits sind ausgeschlossen.
 */
export function isSelectableCeilingKind(
  kind: string | undefined,
  indoorRole: string | undefined,
): boolean {
  if (isNonPickableIndoorKind(kind)) return false
  return (
    indoorRole === 'ceiling' ||
    indoorRole === 'floor' ||
    kind === 'ceiling' ||
    kind === 'floor'
  )
}

/**
 * Decke nur wählen, wenn sie klar näher ist als Wand/Paneel/Öffnung.
 * Bei Gleichstand (±eps) gewinnt die Fassade — sonst stehlen Deckenkanten an der
 * Wandebene die Auswahl auf oberen Etagen (Symptom: kurz orange, dann abgewählt).
 */
export function ceilingBeatsFacadeMesh(
  ceilingDistance: number,
  nearestFacadeMeshDistance: number,
  eps = 12,
): boolean {
  if (!Number.isFinite(nearestFacadeMeshDistance)) return true
  return ceilingDistance < nearestFacadeMeshDistance - eps
}
