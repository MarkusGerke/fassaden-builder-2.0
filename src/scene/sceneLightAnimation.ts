/**
 * Laufzeit-Animationen für Bibliotheks-Lichter (z. B. Blaulicht-Doppelblitz).
 */

export type SceneLightAnimationId = 'none' | 'blaulicht'

/** ECE R65: Gruppenfrequenz 2…4 Hz — Doppelblitz bei ~2 Hz (500 ms Zyklus). */
export const BLAULICHT_CYCLE_MS = 500
/** Erster Blitz an. */
export const BLAULICHT_FLASH_ON_MS = 48
/** Pause zwischen den beiden Blitzen. */
export const BLAULICHT_FLASH_GAP_MS = 52
/** Zweiter Blitz an. */
export const BLAULICHT_FLASH2_ON_MS = 48
/** Restintensität im Dunkeln (LED-Restglühen / Streulicht). */
export const BLAULICHT_DARK_FACTOR = 0.02
/** Blitz mindestens so lang, dass er bei niedriger FPS noch in einem Frame sichtbar ist. */
export const BLAULICHT_FLASH_MAX_MS = 140

export function normalizeSceneLightAnimation(raw: unknown): SceneLightAnimationId {
  if (raw === 'blaulicht') return 'blaulicht'
  return 'none'
}

/**
 * Multiplikator 0…1 für die Lichtleistung zur Zeit `timeMs`.
 * `phaseOffsetMs`: Versatz im Zyklus (mehrere Blaulichter gleichmäßig verteilt).
 * `none` → immer 1.
 */
/** Blitzdauer an Frame-Zeit anpassen — bei ~6 FPS bleiben 48 ms-Impulse sonst unsichtbar. */
export function blaulichtFlashDurationMs(frameMs = 16): number {
  const dt = Number.isFinite(frameMs) && frameMs > 0 ? frameMs : 16
  return Math.max(BLAULICHT_FLASH_ON_MS, Math.min(BLAULICHT_FLASH_MAX_MS, dt * 0.9))
}

/**
 * Blink-Muster nur bei eingeschaltetem Licht — beim Ausblenden nur noch `fadeFactor` (keine 3–4 Blitze).
 */
export function sceneLightAnimationFactorWhenLit(
  enabled: boolean,
  animation: SceneLightAnimationId | undefined,
  timeMs: number,
  phaseOffsetMs = 0,
  frameMs = 16,
): number {
  if (!enabled) return 1
  return sceneLightAnimationFactor(animation, timeMs, phaseOffsetMs, frameMs)
}

export function sceneLightAnimationFactor(
  animation: SceneLightAnimationId | undefined,
  timeMs: number,
  phaseOffsetMs = 0,
  frameMs = 16,
): number {
  if (animation !== 'blaulicht') return 1
  const shifted = timeMs + phaseOffsetMs
  const t = ((shifted % BLAULICHT_CYCLE_MS) + BLAULICHT_CYCLE_MS) % BLAULICHT_CYCLE_MS
  const flashOn = blaulichtFlashDurationMs(frameMs)
  const flash1End = flashOn
  const gapEnd = flash1End + BLAULICHT_FLASH_GAP_MS
  const flash2End = gapEnd + flashOn
  if (t < flash1End || (t >= gapEnd && t < flash2End)) return 1
  return BLAULICHT_DARK_FACTOR
}

/** Gleichmäßiger Phasenversatz: Licht `index` von `count` (0-basiert). */
export function blaulichtPhaseOffsetMs(index: number, count: number): number {
  if (count <= 1 || index < 0) return 0
  return (index / count) * BLAULICHT_CYCLE_MS
}

/**
 * Phasen-Map für alle aktiven Blaulichter (gleicher Abstand im Zyklus).
 * Reihenfolge = Array-Reihenfolge der gefilterten Lichter.
 */
export function blaulichtPhaseOffsetsById(
  lights: ReadonlyArray<{ id: string; enabled?: boolean; animation?: SceneLightAnimationId }>,
): Map<string, number> {
  const blinking = lights.filter(
    (item) => item.enabled !== false && item.animation === 'blaulicht',
  )
  const map = new Map<string, number>()
  blinking.forEach((item, index) => {
    map.set(item.id, blaulichtPhaseOffsetMs(index, blinking.length))
  })
  return map
}

export function sceneLightsNeedLiveFrames(
  lights: ReadonlyArray<{ enabled?: boolean; animation?: SceneLightAnimationId }>,
): boolean {
  return lights.some((item) => item.enabled !== false && item.animation === 'blaulicht')
}
