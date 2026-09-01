/** Sonnenstand für Berlin (Näherung nach NOAA-Gleichungen). */

export const BERLIN_LAT_DEG = 52.52
export const BERLIN_LON_DEG = 13.405

/** Referenzjahr ohne Schaltjahr-Sonderfälle in der UI (2001). */
export const SOLAR_REF_YEAR = 2001

export interface SolarPosition {
  /** Azimut: 0 = Nord, 90 = Ost, 180 = Süd, 270 = West (CW). */
  azimuthDeg: number
  /** Elevation über Horizont (Radiant); negativ = unter Horizont. */
  elevationRad: number
}

export interface SolarDayBounds {
  sunrise: number
  sunset: number
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Tag im Jahr 1…365 für Nicht-Schaltjahr. */
export function dayOfYearFromMonthDay(month: number, day: number): number {
  const m = clamp(Math.round(month), 1, 12)
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const d = clamp(Math.round(day), 1, dim[m - 1])
  let doy = d
  for (let i = 0; i < m - 1; i += 1) doy += dim[i]
  return doy
}

export function monthDayFromDayOfYear(dayOfYear: number): { month: number; day: number } {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let rem = clamp(Math.round(dayOfYear), 1, 365)
  for (let m = 1; m <= 12; m += 1) {
    if (rem <= dim[m - 1]) return { month: m, day: rem }
    rem -= dim[m - 1]
  }
  return { month: 12, day: 31 }
}

/** Monat/Tag von `now` (lokal), für das Datumsfeld. */
export function todayMonthDay(now = new Date()): { month: number; day: number } {
  return { month: now.getMonth() + 1, day: now.getDate() }
}

export function dateInputValue(month: number, day: number, year = new Date().getFullYear()): string {
  const { month: m, day: d } = monthDayFromDayOfYear(dayOfYearFromMonthDay(month, day))
  const y = Number.isFinite(year) ? Math.round(year) : new Date().getFullYear()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseDateInput(value: string): { month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null
  return { month, day }
}

/**
 * Sonnenposition (MEZ ohne Sommerzeit — ausreichend für Fassaden-Vorschau).
 * timeHours: lokale Dezimalstunden 0…24.
 */
export function solarPosition(
  dayOfYear: number,
  timeHours: number,
  latDeg = BERLIN_LAT_DEG,
  lonDeg = BERLIN_LON_DEG,
): SolarPosition {
  const doy = clamp(dayOfYear, 1, 365)
  const hour = ((timeHours % 24) + 24) % 24
  const lat = deg2rad(latDeg)

  // Fractional year (radians), NOAA
  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24)

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) -
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  // Time offset (minutes): longitude relative to CET (UTC+1 → 15°E)
  const timeOffset = eqTime + 4 * (lonDeg - 15)
  const trueSolarTime = (hour * 60 + timeOffset + 1440) % 1440
  let hourAngleDeg = trueSolarTime / 4 - 180
  if (hourAngleDeg < -180) hourAngleDeg += 360
  const ha = deg2rad(hourAngleDeg)

  const cosZenith =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)
  const zenith = Math.acos(clamp(cosZenith, -1, 1))
  const elevationRad = Math.PI / 2 - zenith

  const sinAz = (-Math.sin(ha) * Math.cos(decl)) / Math.max(1e-6, Math.sin(zenith))
  const cosAz =
    (Math.sin(decl) - Math.sin(lat) * Math.cos(zenith)) /
    Math.max(1e-6, Math.cos(lat) * Math.sin(zenith))
  let azimuthDeg = rad2deg(Math.atan2(sinAz, cosAz))
  azimuthDeg = ((azimuthDeg % 360) + 360) % 360

  return { azimuthDeg, elevationRad }
}

/** Sonnenauf-/-untergang (Elevation ≈ 0), Dezimalstunden. */
export function solarDayBounds(
  dayOfYear: number,
  latDeg = BERLIN_LAT_DEG,
  lonDeg = BERLIN_LON_DEG,
): SolarDayBounds {
  let sunrise = 6
  let sunset = 18
  let foundRise = false
  for (let t = 3; t <= 12; t += 0.05) {
    const prev = solarPosition(dayOfYear, t - 0.05, latDeg, lonDeg).elevationRad
    const cur = solarPosition(dayOfYear, t, latDeg, lonDeg).elevationRad
    if (!foundRise && prev < 0 && cur >= 0) {
      sunrise = t
      foundRise = true
    }
  }
  for (let t = 12; t <= 22; t += 0.05) {
    const prev = solarPosition(dayOfYear, t - 0.05, latDeg, lonDeg).elevationRad
    const cur = solarPosition(dayOfYear, t, latDeg, lonDeg).elevationRad
    if (prev >= 0 && cur < 0) {
      sunset = t
      break
    }
  }
  if (sunset <= sunrise + 0.5) {
    sunrise = 6
    sunset = 20
  }
  return {
    sunrise: Math.round(sunrise * 100) / 100,
    sunset: Math.round(sunset * 100) / 100,
  }
}

/** Farbtemperatur aus Elevation (warm am Horizont). */
export function colorTempFromElevation(elevationRad: number): number {
  const elevDeg = Math.max(0, rad2deg(elevationRad))
  const t = clamp(elevDeg / 55, 0, 1)
  return Math.round(2800 + t * (5600 - 2800))
}

function azimuthDeltaDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360)
  return Math.min(d, 360 - d)
}

/**
 * Zeitpunkt (Dezimalstunden), an dem der Sonnen-Azimut dem Ziel am nächsten kommt
 * (entlang Aufgang→Untergang). Immer ein Wert — Fallback = nächstgelegener Azimut der Bahn.
 */
export function timeWhenSunAzimuth(
  dayOfYear: number,
  targetAzimuthDeg: number,
  latDeg = BERLIN_LAT_DEG,
  lonDeg = BERLIN_LON_DEG,
): { hours: number; exact: boolean; actualAzimuthDeg: number } {
  const bounds = solarDayBounds(dayOfYear, latDeg, lonDeg)
  const target = ((targetAzimuthDeg % 360) + 360) % 360
  const step = 0.05
  let bestT = bounds.sunrise
  let bestDelta = 360
  let bestAz = target

  for (let t = bounds.sunrise; t <= bounds.sunset + 1e-6; t += step) {
    const az = solarPosition(dayOfYear, t, latDeg, lonDeg).azimuthDeg
    const delta = azimuthDeltaDeg(az, target)
    if (delta < bestDelta) {
      bestDelta = delta
      bestT = t
      bestAz = az
    }
  }

  return {
    hours: Math.round(bestT * 100) / 100,
    exact: bestDelta <= 8,
    actualAzimuthDeg: bestAz,
  }
}

/** Parse "HH:MM" → Dezimalstunden. */
export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h + m / 60
}

export function timeInputValue(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
