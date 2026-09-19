import {
  DOOR_HEIGHT,
  WINDOW_HEIGHT,
  WINDOW_SILL_Y,
  WINDOW_WIDTH_PRESETS,
} from '../constants/presets'

/** Fensterbreite pro Achse (cm) — wie Regelwerk / 2.0-Standard. */
export const HAUSWAND_WINDOW_WIDTH_CM = WINDOW_WIDTH_PRESETS[1] ?? 96

/** Rand- und Zwischenpfeiler (cm). */
export const HAUSWAND_PIER_CM = 48

/** Achsenabstand: Pfeiler + Fenster. */
export const HAUSWAND_AXIS_PITCH_CM = HAUSWAND_WINDOW_WIDTH_CM + HAUSWAND_PIER_CM

/** Gesamtbreite bei n Achsen à 96 cm mit 48 cm Pfeilern. */
export function hauswandWidthCm(axes: number): number {
  if (!Number.isFinite(axes) || axes < 1) return HAUSWAND_PIER_CM
  return axes * HAUSWAND_AXIS_PITCH_CM + HAUSWAND_PIER_CM
}

/** Linker Rand der Öffnung auf Achse i (0-basiert). */
export function hauswandAxisOpeningXCm(axisIndex: number): number {
  return HAUSWAND_PIER_CM + axisIndex * HAUSWAND_AXIS_PITCH_CM
}

/** Breite einer Gruppe aus `axisCount` ganzen Achsen. */
export function hauswandAxisGroupWidthCm(axisCount: number): number {
  if (axisCount < 1) return 0
  return (
    axisCount * HAUSWAND_WINDOW_WIDTH_CM + Math.max(0, axisCount - 1) * HAUSWAND_PIER_CM
  )
}

export const HAUSWAND_WALL_HEIGHT_CM = WINDOW_HEIGHT
export const HAUSWAND_STANDARD_WINDOW_HEIGHT_CM = 192
export const HAUSWAND_STANDARD_WINDOW_SILL_Y_CM = WINDOW_SILL_Y
export const HAUSWAND_DOOR_HEIGHT_CM = DOOR_HEIGHT
