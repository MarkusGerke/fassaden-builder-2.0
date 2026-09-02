import type { Wall } from '../types/facade'
import { wallStartPoint } from './walls'

export type ElevationFilter =
  | { kind: 'all' }
  | { kind: 'yaw'; yaw: number }
  | { kind: 'wall'; wallId: string }

export interface ElevationLayout {
  x: number
  y: number
}

const ELEVATION_GAP = 64

function normalizeYawDeg(yaw: number): number {
  return ((yaw % 360) + 360) % 360
}

function yawDelta(a: number, b: number): number {
  const d = Math.abs(normalizeYawDeg(a) - normalizeYawDeg(b))
  return Math.min(d, 360 - d)
}

/**
 * Wände für eine Blickrichtung. Exakte Yaw-Treffer zuerst;
 * sonst nächste vorhandene Fassadenrichtung (z. B. N/O 315° → N oder O),
 * damit der Aufriss bei Rechteckhäusern nicht leer bleibt.
 */
export function wallsForYaw(walls: Wall[], yaw: number): Wall[] {
  const target = normalizeYawDeg(yaw)
  const exact = walls.filter((wall) => normalizeYawDeg(wall.yawDeg ?? 0) === target)
  if (exact.length > 0) return exact
  const yaws = [...new Set(walls.map((wall) => normalizeYawDeg(wall.yawDeg ?? 0)))]
  if (yaws.length === 0) return []
  let best = yaws[0]
  let bestDelta = yawDelta(best, target)
  for (const y of yaws) {
    const d = yawDelta(y, target)
    if (d < bestDelta) {
      best = y
      bestDelta = d
    }
  }
  return walls.filter((wall) => normalizeYawDeg(wall.yawDeg ?? 0) === best)
}

/** Position der Wandkante entlang ihrer Achse (cm). */
export function wallElevationAlong(wall: Wall): number {
  const origin = wallStartPoint(wall)
  const yawRad = ((wall.yawDeg ?? 0) * Math.PI) / 180
  return origin.x * Math.cos(yawRad) + origin.z * -Math.sin(yawRad)
}

function wallsForFilter(walls: Wall[], filter: ElevationFilter): Wall[] {
  if (filter.kind === 'all') return walls
  if (filter.kind === 'yaw') return wallsForYaw(walls, filter.yaw)
  return walls.filter((wall) => wall.id === filter.wallId)
}

/**
 * 2D-Lage der Wände als Aufriss: gleiche Blickrichtung = eine Fassade,
 * „Alle“ legt die Fassaden nebeneinander.
 */
export function layoutElevation(
  walls: Wall[],
  filter: ElevationFilter,
): Map<string, ElevationLayout> {
  const map = new Map<string, ElevationLayout>()
  const visible = wallsForFilter(walls, filter)

  if (filter.kind !== 'all') {
    for (const wall of visible) {
      map.set(wall.id, { x: wallElevationAlong(wall), y: wall.y })
    }
    return map
  }

  const yaws = [...new Set(visible.map((wall) => wall.yawDeg ?? 0))].sort((a, b) => a - b)
  let cursor = 0
  for (const yaw of yaws) {
    const group = visible.filter((wall) => (wall.yawDeg ?? 0) === yaw)
    if (group.length === 0) continue
    const alongs = group.map(wallElevationAlong)
    const minAlong = Math.min(...alongs)
    const maxAlong = Math.max(
      ...group.map((wall, i) => alongs[i] + wall.width),
    )
    for (const wall of group) {
      map.set(wall.id, {
        x: wallElevationAlong(wall) - minAlong + cursor,
        y: wall.y,
      })
    }
    cursor += maxAlong - minAlong + ELEVATION_GAP
  }

  return map
}

export function elevationBounds(
  walls: Wall[],
  layout: Map<string, ElevationLayout>,
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (walls.length === 0 || layout.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const wall of walls) {
    const pos = layout.get(wall.id)
    if (!pos) continue
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + wall.width)
    maxY = Math.max(maxY, pos.y + wall.height)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** Außennormale der Paneelseite (panelFlip: −lokales Z). */
export function facadeOutward(yawDeg: number, panelFlip = true): { x: number; z: number } {
  const yawRad = (yawDeg * Math.PI) / 180
  const localOut = panelFlip ? -1 : 1
  return {
    x: localOut * Math.sin(yawRad),
    z: localOut * Math.cos(yawRad),
  }
}

/**
 * Sonne läuft entlang der Fassade (Streiflicht), nicht frontal/gegen.
 * Dann erzeugen Shadow-Maps auf Paneelen/Mauerwerk Zoom-Schraffur
 * (Ost/West bei Südsonne) — Nord/Süd brauchen Werfschatten auch morgens/abends.
 *
 * Nur wenn der Azimut näher als ~14° an der Fassaden-Längsachse liegt (nicht 28° —
 * sonst fehlen Fenster-/Sohlbank-Schatten auf Nord/Süd schon ab ~09:00 / ~15:10).
 *
 * `sunAzimuthDeg`: CW 0=N, 90=O, 180=S, 270=W (wie `SunSettings.azimuth`).
 */
export function facadeSunIsGrazing(
  facadeYawDeg: number,
  sunAzimuthDeg: number,
  epsilonDeg = 14,
): boolean {
  const out = facadeOutward(facadeYawDeg, true)
  // CW-Azimut der Außennormalen (atan2(x, −z): 0=N, 90=O).
  const outwardCw = normalizeYawDeg((Math.atan2(out.x, -out.z) * 180) / Math.PI)
  const alongA = normalizeYawDeg(outwardCw + 90)
  const alongB = normalizeYawDeg(outwardCw + 270)
  const sun = normalizeYawDeg(sunAzimuthDeg)
  return Math.min(yawDelta(sun, alongA), yawDelta(sun, alongB)) < epsilonDeg
}
