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

/** 3D/Fassade: länger als 2D-Zoom — großer Kameraweg, sonst abrupt. */
export const OBJECT_FOCUS_DURATION_MS = 800

export type Vec3 = { x: number; y: number; z: number }

/** Ease-out für Zoom-Animationen (0…1 → 0…1). */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

/** Ease-in-out für 3D-Objektfokus (0…1 → 0…1). */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

/** Sanfteres Ease-in-out (Sinus) — weniger Ruck in der Mitte als Cubic. */
export function easeInOutSine(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 0.5 - 0.5 * Math.cos(Math.PI * x)
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function vecScale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s }
}

function vecLen(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z)
}

function vecLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerpNumber(a.x, b.x, t),
    y: lerpNumber(a.y, b.y, t),
    z: lerpNumber(a.z, b.z, t),
  }
}

function slerpDir(a: Vec3, b: Vec3, t: number): Vec3 {
  const la = vecLen(a)
  const lb = vecLen(b)
  const na = la > 1e-8 ? vecScale(a, 1 / la) : { x: 0, y: 0, z: 1 }
  const nb = lb > 1e-8 ? vecScale(b, 1 / lb) : { x: 0, y: 0, z: 1 }
  const dot = Math.max(-1, Math.min(1, na.x * nb.x + na.y * nb.y + na.z * nb.z))
  if (dot > 0.9995) {
    const lin = vecLerp(na, nb, t)
    const ll = vecLen(lin)
    return ll > 1e-8 ? vecScale(lin, 1 / ll) : na
  }
  const omega = Math.acos(dot)
  const sinO = Math.sin(omega)
  const s0 = Math.sin((1 - t) * omega) / sinO
  const s1 = Math.sin(t * omega) / sinO
  return { x: na.x * s0 + nb.x * s1, y: na.y * s0 + nb.y * s1, z: na.z * s0 + nb.z * s1 }
}

/**
 * Kamera-Dolly: Ziel linear, Abstand logarithmisch, Blickrichtung per Slerp.
 * Linearer Positions-Lerp wirkt nah am Objekt wie ein Zuschlagen.
 */
export function lerpFocusPose(
  fromPos: Vec3,
  fromTarget: Vec3,
  toPos: Vec3,
  toTarget: Vec3,
  e: number,
): { pos: Vec3; target: Vec3 } {
  const target = vecLerp(fromTarget, toTarget, e)
  const fromOff = vecSub(fromPos, fromTarget)
  const toOff = vecSub(toPos, toTarget)
  const fromLen = Math.max(1e-6, vecLen(fromOff))
  const toLen = Math.max(1e-6, vecLen(toOff))
  const dist = Math.exp(lerpNumber(Math.log(fromLen), Math.log(toLen), e))
  const dir = slerpDir(fromOff, toOff, e)
  return { pos: vecAdd(target, vecScale(dir, dist)), target }
}
