import type { Wall } from '../types/facade'
import { openingCutsWall } from '../utils/openingGeometry'
import { wallHasArcBay } from './arcWall'
import { isStudioWall, studioWallOuterSpine, wallAlongDelta } from './walls'

export interface XZ {
  x: number
  z: number
}

/**
 * Seitlicher Überstand der Kerbe über das Öffnungsloch: die Kerbenflanken liegen
 * im Wandkörper (keine koplanaren Flächen mit der Laibung).
 */
export const SLAB_NOTCH_SIDE_PAD_CM = 1
/** Kerbenrückwand knapp hinter der Wandinnenseite (nicht koplanar mit der Innenwand). */
export const SLAB_NOTCH_BACK_EXTRA_CM = 0.5
/** Öffnung muss die Platte echt schneiden — Berühren (Tür-Unterkante = Boden-OK) zählt nicht. */
const NOTCH_Y_EPS = 0.5
/**
 * Max. Abstand Wandkörper-Außenkante ↔ Ring-Kante. Der Plan-Ring liegt an der
 * Fassadenfront (Paneelvorstand), der Wandkörper kann dahinter zurückgesetzt sein
 * (`finalizeStudioGeometry`, z. B. 8 cm Paneele).
 */
const EDGE_MATCH_MAX_OFFSET_CM = 48
/** Kerbenenden müssen auf der Ring-Kante liegen (Parameter 0…1, kleine Toleranz). */
const EDGE_PARAM_TOL = 1e-3
const MIN_NOTCH_WIDTH_CM = 1

/**
 * Wand-X-Intervalle (vom Wandanfang), in denen Öffnungen die Platte
 * `[slabBottomY, slabTopY]` (Welt-Y) durchdringen. Überlappungen sind verschmolzen.
 */
export function slabOpeningNotchIntervals(
  wall: Wall,
  slabBottomY: number,
  slabTopY: number,
): Array<[number, number]> {
  const raw: Array<[number, number]> = []
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const oy0 = wall.y + opening.y
    const oy1 = oy0 + opening.height
    const overlaps = oy0 < slabTopY && oy1 > slabBottomY
    // Angehobene Tür: Schwelle = Boden-OK → Platte würde sonst die Tür füllen.
    const raisedDoorSill =
      opening.type === 'door' &&
      opening.y > 0.5 &&
      Math.abs(oy0 - slabTopY) <= NOTCH_Y_EPS
    // Kellerfenster unter der Platte: Oberkante berührt Platten-Unterseite → sonst
    // läuft die Kante als „zweiter Sockel“ quer durchs Fenster.
    const capsBelowSlab =
      Math.abs(oy1 - slabBottomY) <= NOTCH_Y_EPS && oy0 < slabBottomY - NOTCH_Y_EPS
    if (!overlaps && !raisedDoorSill && !capsBelowSlab) continue
    const x0 = Math.max(MIN_NOTCH_WIDTH_CM, opening.x - SLAB_NOTCH_SIDE_PAD_CM)
    const x1 = Math.min(wall.width - MIN_NOTCH_WIDTH_CM, opening.x + opening.width + SLAB_NOTCH_SIDE_PAD_CM)
    if (x1 - x0 < MIN_NOTCH_WIDTH_CM) continue
    raw.push([x0, x1])
  }
  if (raw.length === 0) return raw
  raw.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [raw[0]!]
  for (let i = 1; i < raw.length; i += 1) {
    const cur = raw[i]!
    const last = merged[merged.length - 1]!
    if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1])
    else merged.push([cur[0], cur[1]])
  }
  return merged
}

/** Projektion von `p` auf die Gerade a→b: Parameter t und Abstand zur Geraden. */
function projectOnLine(p: XZ, a: XZ, b: XZ): { t: number; dist: number; point: XZ } | null {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return null
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2
  const point = { x: a.x + dx * t, z: a.z + dz * t }
  return { t, dist: Math.hypot(p.x - point.x, p.z - point.z), point }
}

function isParallel(a: XZ, b: XZ, yawDeg: number): boolean {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return false
  const along = wallAlongDelta(yawDeg, 1)
  const cross = (dx / len) * along.z - (dz / len) * along.x
  return Math.abs(cross) < 1e-3
}

/**
 * Kerbt einen Plan-Ring (Welt-XZ) an allen Öffnungen ein, die die Platte
 * `[slabBottomY, slabTopY]` durchdringen. Der Ring kann Außen- oder Innenkante
 * sein: die Kerbenrückwand liegt immer hinter der Wandinnenseite
 * (`wall.depth + SLAB_NOTCH_BACK_EXTRA_CM` von der Fassaden-Spine). Sonst würde die
 * Platte quer durch die Öffnung laufen (z. B. angehobener Boden bei Tür mit Treppe
 * vor einem Kellerfenster → „zweiter Sockel“). Außerhalb der Kerben bleibt der Ring
 * unverändert (Schwelle unter Türen bleibt geschlossen).
 *
 * Funktioniert für Außen- und Hof-Ringe: die Kerbe zeigt immer vom Wand-Außen ins
 * Gebäude (`studioWallOuterSpine().outward`), unabhängig von der Ring-Orientierung.
 */
export function notchSlabRingAtOpenings(
  ring: XZ[],
  walls: Wall[],
  slabBottomY: number,
  slabTopY: number,
): XZ[] {
  const n = ring.length
  if (n < 3) return ring
  const insertions = new Map<number, Array<{ t: number; pts: XZ[] }>>()

  for (const wall of walls) {
    if (wall.hidden || !isStudioWall(wall) || wallHasArcBay(wall)) continue
    const intervals = slabOpeningNotchIntervals(wall, slabBottomY, slabTopY)
    if (intervals.length === 0) continue
    const spine = studioWallOuterSpine(wall)
    const yaw = wall.yawDeg ?? 0
    const back = wall.depth + SLAB_NOTCH_BACK_EXTRA_CM
    const inward = { x: -spine.outward.x * back, z: -spine.outward.z * back }
    for (const [x0, x1] of intervals) {
      const a0 = wallAlongDelta(yaw, x0)
      const a1 = wallAlongDelta(yaw, x1)
      const o0: XZ = { x: spine.start.x + a0.x, z: spine.start.z + a0.z }
      const o1: XZ = { x: spine.start.x + a1.x, z: spine.start.z + a1.z }
      const i0: XZ = { x: o0.x + inward.x, z: o0.z + inward.z }
      const i1: XZ = { x: o1.x + inward.x, z: o1.z + inward.z }
      for (let k = 0; k < n; k += 1) {
        const a = ring[k]!
        const b = ring[(k + 1) % n]!
        if (!isParallel(a, b, yaw)) continue
        const p0 = projectOnLine(o0, a, b)
        const p1 = projectOnLine(o1, a, b)
        if (!p0 || !p1) continue
        if (p0.dist > EDGE_MATCH_MAX_OFFSET_CM || p1.dist > EDGE_MATCH_MAX_OFFSET_CM) continue
        if (p0.t < -EDGE_PARAM_TOL || p0.t > 1 + EDGE_PARAM_TOL) continue
        if (p1.t < -EDGE_PARAM_TOL || p1.t > 1 + EDGE_PARAM_TOL) continue
        // Kerbenmund liegt auf der Ring-Kante (Fassadenfront), Rückwand hinter der Wandinnenseite.
        const entry =
          p0.t <= p1.t
            ? { t: p0.t, pts: [p0.point, i0, i1, p1.point] }
            : { t: p1.t, pts: [p1.point, i1, i0, p0.point] }
        const list = insertions.get(k)
        if (list) list.push(entry)
        else insertions.set(k, [entry])
        break
      }
    }
  }

  if (insertions.size === 0) return ring
  const out: XZ[] = []
  for (let k = 0; k < n; k += 1) {
    out.push(ring[k]!)
    const list = insertions.get(k)
    if (!list) continue
    list.sort((p, q) => p.t - q.t)
    for (const entry of list) out.push(...entry.pts)
  }
  return out
}
