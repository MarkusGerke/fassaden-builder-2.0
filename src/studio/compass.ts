/** Himmelsrichtungen aus Wand-Yaw (Fassade nach außen). */
const CARDINALS = ['N', 'N/W', 'W', 'S/W', 'S', 'S/O', 'O', 'N/O'] as const

export function normalizeYawDeg(yawDeg: number): number {
  return ((yawDeg % 360) + 360) % 360
}

/** Raste Yaw auf 45°-Schritte (N, N/W, W, …). */
export function snapYawTo45(yawDeg: number): number {
  return normalizeYawDeg(Math.round(normalizeYawDeg(yawDeg) / 45) * 45)
}

function yawDelta(a: number, b: number): number {
  const d = Math.abs(normalizeYawDeg(a) - normalizeYawDeg(b))
  return Math.min(d, 360 - d)
}

/**
 * Gitterachse für Bibliothek-Wand entlang der gewählten Kompass-Fassade.
 * 0°/180° (N/S) → Achse x (O–W), 90°/270° (W/O) → Achse z (N–S).
 */
export function wallDockAxisFromFacadeYaw(facadeYaw: number): 'x' | 'z' {
  const y = snapYawTo45(facadeYaw)
  if (y === 0 || y === 180) return 'x'
  if (y === 90 || y === 270) return 'z'
  const toX = Math.min(yawDelta(y, 0), yawDelta(y, 180))
  const toZ = Math.min(yawDelta(y, 90), yawDelta(y, 270))
  return toX <= toZ ? 'x' : 'z'
}

/** Raste Yaw auf 1°-Schritte (Feindrehung in den Einstellungen). */
export function snapYawTo1(yawDeg: number): number {
  return normalizeYawDeg(Math.round(normalizeYawDeg(yawDeg)))
}

/** Raste Yaw auf 10°-Schritte (Legacy, z. B. ältere Docs/Tests). */
export function snapYawTo10(yawDeg: number): number {
  return normalizeYawDeg(Math.round(normalizeYawDeg(yawDeg) / 10) * 10)
}

/**
 * Yaw aus einem Klick auf den Kompass-SVG (ViewBox 0…88, Mitte 44,44).
 * 0° = N (oben), 90° = W (links), gegen den Uhrzeigersinn — Fassade nach außen.
 */
export function yawFromCompassSvgPoint(x: number, y: number, cx = 44, cy = 44): number {
  const dx = x - cx
  const dy = y - cy
  // SVG: +Y nach unten. Gegen Uhrzeigersinn: N=0, W=90, S=180, O=270.
  const deg = (Math.atan2(-dx, -dy) * 180) / Math.PI
  return snapYawTo45(deg)
}

/**
 * Beschriftung der Wandansicht: 0° = N, 90° = W, 180° = S, 270° = O,
 * 45°-Schritte als N/O, N/W, …
 */
export function wallCompassLabel(yawDeg: number): string {
  const yaw = normalizeYawDeg(yawDeg)
  const exact: Record<number, string> = {
    0: 'N',
    45: 'N/W',
    90: 'W',
    135: 'S/W',
    180: 'S',
    225: 'S/O',
    270: 'O',
    315: 'N/O',
  }
  if (exact[yaw]) return exact[yaw]
  const snapped = Math.round(yaw / 45) % 8
  return CARDINALS[snapped] ?? `${Math.round(yaw)}°`
}

/** Blickrichtung in der XZ-Ebene: 0° = nach Norden (−Z), 90° = nach Osten (+X). */
export function lookHeadingDeg(lookX: number, lookZ: number): number {
  return (Math.atan2(lookX, -lookZ) * 180) / Math.PI
}

/**
 * Fassade, die der Kamera zugewandt ist.
 * lookHeadingDeg ist CW (0=N, 90=O); Wand-Yaw ist CCW (0=N, 90=W).
 * Deshalb 180 − heading, nicht heading + 180 (sonst spiegeln O/W und S/O↔S/W).
 */
export function viewedFacadeYaw(lookX: number, lookZ: number): number {
  return normalizeYawDeg(180 - lookHeadingDeg(lookX, lookZ))
}

export function viewedFacadeLabel(lookX: number, lookZ: number): string {
  return wallCompassLabel(viewedFacadeYaw(lookX, lookZ))
}

export function headingCompassLabel(headingDeg: number): string {
  return wallCompassLabel(headingDeg)
}

/**
 * Solar-Azimut (CW: 0=N, 90=O) → Wand-Yaw (CCW: 0=N, 90=W).
 * Sonne aus Osten (90°) trifft die Ost-Fassade (Wand-Yaw 270°).
 */
export function solarAzimuthToWallYaw(solarAzDeg: number): number {
  return normalizeYawDeg(360 - solarAzDeg)
}

/** Wand-Yaw (CCW) → Solar-Azimut (CW). */
export function wallYawToSolarAzimuth(wallYawDeg: number): number {
  return normalizeYawDeg(360 - wallYawDeg)
}

/** Kürzester Bogen zwischen zwei Winkeln (Grad, 0…360). */
export function lerpYawDeg(fromDeg: number, toDeg: number, t: number): number {
  const a = normalizeYawDeg(fromDeg)
  const b = normalizeYawDeg(toDeg)
  let delta = b - a
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return normalizeYawDeg(a + delta * t)
}
