import type { Opening, OpeningPediment, Wall } from '../types/facade'
import { resolveProfile } from '../profiles/registry'
import {
  scaleProfileSectionAxes,
  transformProfileSection,
} from '../utils/profilePaths'
import { trimSectionScales } from '../utils/profileSectionExtents'

/**
 * Höhe des oberen Öffnungsprofils (cm), um die die Verdachung nach oben rutscht.
 * Identisch zur Mesh-Skalierung: `extentOutCm` / `extentForwardCm` / `scale`.
 */
export function openingTopProfileLiftCm(wall: Wall, opening: Opening): number {
  const assignments = wall.profiles.filter(
    (assignment) => assignment.openingId === opening.id && assignment.edge === 'top',
  )
  if (assignments.length === 0) return 0
  const trim = opening.trim
  let maxOut = 0
  for (const assignment of assignments) {
    const profile = resolveProfile(assignment.profileId, undefined)
    if (!profile?.section?.length) continue
    const scales = trimSectionScales(trim, profile.section)
    const section = scaleProfileSectionAxes(
      transformProfileSection(
        profile.section,
        trim?.rotationDeg ?? 0,
        trim?.flipOutward ?? false,
        trim?.flipForward ?? false,
      ),
      scales.outward,
      scales.forward,
    )
    for (const point of section) {
      if (point.outward > maxOut) maxOut = point.outward
    }
  }
  return maxOut
}

/**
 * Gesamt-Anhebung der Verdachung: Sturzprofil + optionaler Nutzer-Versatz.
 * Ohne Profil bleibt nur `offsetUp` (sonst 0 = an der Fensterkante).
 */
export function pedimentBaseLiftCm(
  wall: Wall,
  opening: Opening,
  pediment?: OpeningPediment,
): number {
  const profileLift = openingTopProfileLiftCm(wall, opening)
  const extra = Number.isFinite(pediment?.offsetUp) ? pediment!.offsetUp! : 0
  const oy = opening.trim?.offsetY ?? 0
  // Negatives offsetUp senkt unter den Sturz (nicht mit max(0) auffressen).
  return profileLift + extra + oy
}
