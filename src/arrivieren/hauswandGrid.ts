import {
  DOOR_HEIGHT,
  WINDOW_HEIGHT,
  WINDOW_SILL_Y,
  WINDOW_WIDTH_PRESETS,
} from '../constants/presets'

/** Fensterbreite pro Achse (cm) — wie Regelwerk / 2.0-Standard. */
export const HAUSWAND_WINDOW_WIDTH_CM = WINDOW_WIDTH_PRESETS[1] ?? 96

/** Historischer Pfeiler (48) — Endrand der Fassade ist 96 cm. */
export const HAUSWAND_PIER_CM = 48
/** Außenrand links/rechts vor der ersten bzw. nach der letzten Öffnung. */
export const HAUSWAND_END_MARGIN_CM = 96
/** Lichter Abstand zwischen Fenstern (cm) — fest 96. */
export const HAUSWAND_INTER_WINDOW_GAP_CM = 96

/**
 * Gesamtbreite bei n Achsen: Rand 96 | Fenster | 96 | … | Rand 96
 * = n × (Fensterbreite + 96) + 96.
 */
export function hauswandWidthCm(axes: number, windowWidthCm: number = HAUSWAND_WINDOW_WIDTH_CM): number {
  if (!Number.isFinite(axes) || axes < 1) return HAUSWAND_END_MARGIN_CM * 2
  const win = Number.isFinite(windowWidthCm) && windowWidthCm > 0 ? windowWidthCm : HAUSWAND_WINDOW_WIDTH_CM
  return axes * (win + HAUSWAND_INTER_WINDOW_GAP_CM) + HAUSWAND_END_MARGIN_CM
}

/** Achsenabstand für Standard-96er (Kompatibilität). */
export const HAUSWAND_AXIS_PITCH_CM = HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_INTER_WINDOW_GAP_CM

/** Linker Rand der Öffnung auf Achse i (0-basiert), optional Fensterbreite. */
export function hauswandAxisOpeningXCm(axisIndex: number, windowWidthCm: number = HAUSWAND_WINDOW_WIDTH_CM): number {
  const pitch = windowWidthCm + HAUSWAND_INTER_WINDOW_GAP_CM
  return HAUSWAND_END_MARGIN_CM + axisIndex * pitch
}

/** Breite einer Gruppe aus `axisCount` ganzen Achsen (Fenster + 96er-Zwischenräume). */
export function hauswandAxisGroupWidthCm(
  axisCount: number,
  windowWidthCm: number = HAUSWAND_WINDOW_WIDTH_CM,
): number {
  if (axisCount < 1) return 0
  return (
    axisCount * windowWidthCm + Math.max(0, axisCount - 1) * HAUSWAND_INTER_WINDOW_GAP_CM
  )
}

export const HAUSWAND_WALL_HEIGHT_CM = WINDOW_HEIGHT
export const HAUSWAND_STANDARD_WINDOW_HEIGHT_CM = 192
export const HAUSWAND_STANDARD_WINDOW_SILL_Y_CM = WINDOW_SILL_Y
export const HAUSWAND_DOOR_HEIGHT_CM = DOOR_HEIGHT
/** Eingangstür (1 Achse, Raster-zentriert). */
export const HAUSWAND_ENTRANCE_DOOR_WIDTH_CM = 144
/** Tor / breite Einfahrt (typisch 2 Achsen inkl. Zwischenpfeiler). */
export const HAUSWAND_GATE_WIDTH_CM = 288
/** Schmale Tür (96 cm) — z. B. EG zu OG-Fensterpaar. */
export const HAUSWAND_NARROW_DOOR_WIDTH_CM = 96
