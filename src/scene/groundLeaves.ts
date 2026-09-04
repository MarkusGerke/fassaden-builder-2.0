/**
 * Bodenlaub: persistierte Herbstblätter auf dem Grundstück (siteOffset-Lokal, cm).
 */
import type { FacadeState } from '../types/facade'
import { createId } from '../utils/id'
import { normalizeLeafShapeId, type LeafShapeId } from './leafShapes'

export const MAX_GROUND_LEAVES = 800
export const LEAF_CLUMP_COUNT = 12
export const LEAF_CLUMP_RADIUS_CM = 40
export const LEAF_Y_CM = 0.8

export const LEAF_AUTUMN_COLORS = ['#C45A1A', '#D4A017', '#8B3A1A', '#A65D2E'] as const

export interface GroundLeaf {
  id: string
  shape: LeafShapeId
  x: number
  z: number
  /** Knapp über Boden gegen Z-Fighting. */
  y: number
  yawDeg: number
  /** Einheitliche Größe ~0,7…1,4. */
  scale: number
  color: string
}

function clampFinite(n: unknown, fallback: number, min: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

function normalizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toUpperCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return fallback
}

export function normalizeGroundLeaf(raw: Partial<GroundLeaf> & { id?: string }): GroundLeaf {
  const colorFallback =
    LEAF_AUTUMN_COLORS[Math.abs(hashString(raw.id ?? 'x')) % LEAF_AUTUMN_COLORS.length]!
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId(),
    shape: normalizeLeafShapeId(raw.shape),
    x: clampFinite(raw.x, 0, -50000, 50000),
    z: clampFinite(raw.z, 0, -50000, 50000),
    y: clampFinite(raw.y, LEAF_Y_CM, 0, 20),
    yawDeg: clampFinite(raw.yawDeg, 0, -720, 720),
    scale: clampFinite(raw.scale, 1, 0.4, 2.5),
    color: normalizeHexColor(raw.color, colorFallback),
  }
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function normalizeGroundLeaves(raw: unknown): GroundLeaf[] {
  if (!Array.isArray(raw)) return []
  const out: GroundLeaf[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    out.push(normalizeGroundLeaf(item as Partial<GroundLeaf>))
    if (out.length >= MAX_GROUND_LEAVES) break
  }
  return out
}

export function normalizeGroundLeafState(state: FacadeState): {
  groundLeaves: GroundLeaf[]
} {
  return { groundLeaves: normalizeGroundLeaves(state.groundLeaves) }
}

export function randomAutumnColor(rand = Math.random): string {
  return LEAF_AUTUMN_COLORS[Math.floor(rand() * LEAF_AUTUMN_COLORS.length) % LEAF_AUTUMN_COLORS.length]!
}

export function createRandomLeaf(
  x: number,
  z: number,
  rand: () => number = Math.random,
): GroundLeaf {
  return normalizeGroundLeaf({
    id: createId(),
    shape: Math.floor(rand() * 3) as LeafShapeId,
    x,
    z,
    y: LEAF_Y_CM,
    yawDeg: rand() * 360,
    scale: 0.75 + rand() * 0.55,
    color: randomAutumnColor(rand),
  })
}

/** Kleines Häufchen um (cx, cz). */
export function createLeafClump(
  cx: number,
  cz: number,
  count = LEAF_CLUMP_COUNT,
  radiusCm = LEAF_CLUMP_RADIUS_CM,
  rand: () => number = Math.random,
): GroundLeaf[] {
  const n = Math.max(1, Math.min(40, Math.round(count)))
  const leaves: GroundLeaf[] = []
  for (let i = 0; i < n; i += 1) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * radiusCm
    leaves.push(createRandomLeaf(cx + Math.cos(a) * r, cz + Math.sin(a) * r, rand))
  }
  return leaves
}

/**
 * Zufällige Verteilung in einem Rechteck (siteOffset-Lokal, Mitte + Halbweiten).
 * Respektiert MAX_GROUND_LEAVES inklusive bestehender Blätter.
 */
export function createLeafScatter(
  centerX: number,
  centerZ: number,
  halfW: number,
  halfD: number,
  count: number,
  existingCount: number,
  rand: () => number = Math.random,
): GroundLeaf[] {
  const room = Math.max(0, MAX_GROUND_LEAVES - existingCount)
  const n = Math.max(0, Math.min(room, Math.round(count)))
  const leaves: GroundLeaf[] = []
  const w = Math.max(40, halfW)
  const d = Math.max(40, halfD)
  for (let i = 0; i < n; i += 1) {
    leaves.push(
      createRandomLeaf(centerX + (rand() * 2 - 1) * w, centerZ + (rand() * 2 - 1) * d, rand),
    )
  }
  return leaves
}

export function appendGroundLeaves(
  state: FacadeState,
  additions: GroundLeaf[],
): FacadeState {
  const current = normalizeGroundLeaves(state.groundLeaves)
  const room = Math.max(0, MAX_GROUND_LEAVES - current.length)
  if (room === 0 || additions.length === 0) return state
  const next = [...current, ...additions.slice(0, room).map((l) => normalizeGroundLeaf(l))]
  return { ...state, groundLeaves: next }
}

export function clearGroundLeaves(state: FacadeState): FacadeState {
  if (!state.groundLeaves || state.groundLeaves.length === 0) return state
  return { ...state, groundLeaves: [] }
}

export function setGroundLeaves(state: FacadeState, leaves: GroundLeaf[]): FacadeState {
  return { ...state, groundLeaves: normalizeGroundLeaves(leaves) }
}
