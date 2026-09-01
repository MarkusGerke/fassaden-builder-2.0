/** Normalisiert WheelEvent.deltaY (Zeilen/Seiten → Pixel). */
export function normalizedWheelDeltaY(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  let dy = deltaY
  if (deltaMode === 1) dy *= 16
  else if (deltaMode === 2) dy *= Math.max(1, viewportHeight)
  return dy
}

/** Exponentieller Zoom-Faktor aus akkumuliertem Wheel-Delta (1 = keine Änderung). */
export function wheelZoomFactorFromDelta(deltaY: number, sensitivity = 0.001): number {
  return Math.exp(-deltaY * sensitivity)
}

/** Pan-Offsets so anpassen, dass der Punkt unter (nx, ny) fix bleibt. */
export function zoomPanOffsetsAtCursor(opts: {
  nx: number
  ny: number
  factor: number
  panX: number
  panY: number
  halfW: number
  halfH: number
}): { panX: number; panY: number } {
  const { nx, ny, factor, panX, panY, halfW, halfH } = opts
  const cursorPanX = panX + nx * halfW
  const cursorPanY = panY + ny * halfH
  const halfWNew = halfW / factor
  const halfHNew = halfH / factor
  return {
    panX: cursorPanX - nx * halfWNew,
    panY: cursorPanY - ny * halfHNew,
  }
}

/** Doppelklick-Zoom: feste Vergrößerung pro Klick. */
export const DBLCLICK_ZOOM_FACTOR = 2

/** Dauer der animierten Doppelklick-Zoom-Transition (ms). */
export const DBLCLICK_ZOOM_DURATION_MS = 280

/** Ease-out für Zoom-Animationen (0…1 → 0…1). */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
