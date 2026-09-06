import type { EditScope } from '../studio/editScope'
import { editOpeningTargets, editWallTargets } from './editScope'
import type { EditorState, FacadeState, Opening, Wall } from '../types/facade'
import { cloneFacadeState, cloneWall } from '../types/facade'
import { findBuildingForWall, getAllWalls } from '../utils/buildings'
import { getWall } from '../utils/walls'

/** Ob zwei Zustände dieselbe Wand-/Öffnungs-Topologie haben (nur Property-Edit). */
export function isPropertyOnlyFacadeEdit(before: FacadeState, after: FacadeState): boolean {
  const a = getAllWalls(before)
  const b = getAllWalls(after)
  if (a.length !== b.length) return false
  const byId = new Map(b.map((w) => [w.id, w]))
  for (const wall of a) {
    const next = byId.get(wall.id)
    if (!next) return false
    if (wall.openings.length !== next.openings.length) return false
    const openIds = new Set(next.openings.map((o) => o.id))
    for (const o of wall.openings) {
      if (!openIds.has(o.id)) return false
    }
  }
  return before.buildings.length === after.buildings.length
}

function deepApplyChanged<T>(target: T, before: T, after: T): T {
  if (before === after) return target
  if (
    after === null ||
    typeof after !== 'object' ||
    before === null ||
    typeof before !== 'object' ||
    Array.isArray(after) !== Array.isArray(before)
  ) {
    return after as T
  }
  if (Array.isArray(after) && Array.isArray(before)) {
    // Arrays: bei gleicher Länge elementweise, sonst komplett ersetzen
    if (after.length !== before.length || !Array.isArray(target)) return after as T
    return after.map((item, i) =>
      deepApplyChanged((target as unknown[])[i], before[i], item),
    ) as T
  }
  const out: Record<string, unknown> = {
    ...(target as Record<string, unknown>),
  }
  const beforeObj = before as Record<string, unknown>
  const afterObj = after as Record<string, unknown>
  for (const key of Object.keys(afterObj)) {
    if (!(key in beforeObj)) {
      out[key] = afterObj[key]
      continue
    }
    if (beforeObj[key] === afterObj[key]) continue
    out[key] = deepApplyChanged(
      (target as Record<string, unknown>)[key],
      beforeObj[key],
      afterObj[key],
    )
  }
  return out as T
}

/** Geometrie-Felder, die beim Propagieren nicht von der Auswahl übernommen werden. */
const WALL_SKIP = new Set([
  'id',
  'originX',
  'originZ',
  'x',
  'y',
  'width',
  'height',
  'depth',
  'yawDeg',
  'panelFlip',
  'planLinked',
  'bayWindow',
  'bayParentId',
  'bayRole',
  'groupId',
  'neighbors',
  'buildingId',
  'kind',
  'openings',
])

function applyWallPropertyDelta(peer: Wall, before: Wall, after: Wall): Wall {
  let next = cloneWall(peer)
  for (const key of Object.keys(after) as (keyof Wall)[]) {
    if (WALL_SKIP.has(key as string)) continue
    if (before[key] === after[key]) continue
    const peerRec = peer as unknown as Record<string, unknown>
    const beforeRec = before as unknown as Record<string, unknown>
    const afterRec = after as unknown as Record<string, unknown>
    const nextRec = next as unknown as Record<string, unknown>
    nextRec[key as string] = deepApplyChanged(
      peerRec[key as string],
      beforeRec[key as string],
      afterRec[key as string],
    )
  }
  // Öffnungen: nur wenn Anker-Öffnungen geändert wurden und Peer passende Typen hat
  if (before.openings !== after.openings) {
    const beforeById = new Map(before.openings.map((o) => [o.id, o]))
    const afterById = new Map(after.openings.map((o) => [o.id, o]))
    next = {
      ...next,
      openings: peer.openings.map((peerOpen) => {
        for (const [id, afterOpen] of afterById) {
          const beforeOpen = beforeById.get(id)
          if (!beforeOpen || beforeOpen === afterOpen) continue
          if (peerOpen.type !== afterOpen.type) continue
          if (
            Math.round(peerOpen.width) !== Math.round(afterOpen.width) ||
            Math.round(peerOpen.height) !== Math.round(afterOpen.height)
          ) {
            continue
          }
          return applyOpeningPropertyDelta(peerOpen, beforeOpen, afterOpen)
        }
        return peerOpen
      }),
    }
  }
  return next
}

const OPENING_SKIP = new Set(['id', 'x', 'y', 'width', 'height', 'type', 'hidden'])

function applyOpeningPropertyDelta(peer: Opening, before: Opening, after: Opening): Opening {
  const out = { ...(peer as unknown as Record<string, unknown>) }
  for (const key of Object.keys(after) as (keyof Opening)[]) {
    if (OPENING_SKIP.has(key as string)) continue
    if (before[key] === after[key]) continue
    const peerRec = peer as unknown as Record<string, unknown>
    const beforeRec = before as unknown as Record<string, unknown>
    const afterRec = after as unknown as Record<string, unknown>
    out[key as string] = deepApplyChanged(
      peerRec[key as string],
      beforeRec[key as string],
      afterRec[key as string],
    )
  }
  return out as unknown as Opening
}

export type ScopePropagateKind = 'floor' | 'facade'

/** Ob eine höhere Scope-Stufe mehr Ziele träfe als die aktuelle. */
export function scopePropagateAvailable(
  state: FacadeState,
  editor: EditorState,
  fromScope: EditScope,
  toScope: ScopePropagateKind,
): boolean {
  if (fromScope === 'facade' || fromScope === 'type') return false
  if (fromScope === 'floor' && toScope === 'floor') return false
  const hasOpenings = editor.selectedOpenings.length > 0
  if (hasOpenings) {
    const current = editOpeningTargets(state, editor, fromScope, null)
    const elevated = editOpeningTargets(state, editor, toScope, null)
    return elevated.length > current.length
  }
  if (editor.selectedWallIds.length === 0) return false
  const current = editWallTargets(state, editor, fromScope, null)
  const elevated = editWallTargets(state, editor, toScope, null)
  return elevated.length > current.length
}

/**
 * Wendet die Property-Deltas der aktuellen Auswahl (before→after) auf alle
 * Ziele unter `toScope` an. Geometrie (Lage/Maße) bleibt am Peer.
 */
export function propagateSelectionEdit(
  before: FacadeState,
  after: FacadeState,
  editor: EditorState,
  toScope: ScopePropagateKind,
): FacadeState {
  if (!isPropertyOnlyFacadeEdit(before, after)) return after

  const hasOpenings = editor.selectedOpenings.length > 0
  if (hasOpenings) {
    const targets = editOpeningTargets(after, editor, toScope, null)
    const donors = editor.selectedOpenings
      .map((ref) => {
        const bWall = getWall(before, ref.wallId)
        const aWall = getWall(after, ref.wallId)
        const bOpen = bWall?.openings.find((o) => o.id === ref.openingId)
        const aOpen = aWall?.openings.find((o) => o.id === ref.openingId)
        if (!bOpen || !aOpen) return null
        return { before: bOpen, after: aOpen }
      })
      .filter((d): d is { before: Opening; after: Opening } => Boolean(d))

    if (donors.length === 0) return after

    return updateWallsInState(after, (wall) => {
      let changed = false
      const openings = wall.openings.map((open) => {
        const hit = targets.some((t) => t.wallId === wall.id && t.openingId === open.id)
        if (!hit) return open
        for (const donor of donors) {
          if (open.type !== donor.after.type) continue
          if (
            Math.round(open.width) !== Math.round(donor.after.width) ||
            Math.round(open.height) !== Math.round(donor.after.height)
          ) {
            continue
          }
          changed = true
          return applyOpeningPropertyDelta(open, donor.before, donor.after)
        }
        return open
      })
      return changed ? { ...cloneWall(wall), openings } : wall
    })
  }

  const targets = new Set(editWallTargets(after, editor, toScope, null))
  const donorIds = editor.selectedWallIds
  const donors = donorIds
    .map((id) => {
      const b = getWall(before, id)
      const a = getWall(after, id)
      return b && a ? { before: b, after: a } : null
    })
    .filter((d): d is { before: Wall; after: Wall } => Boolean(d))
  if (donors.length === 0) return after
  const primary = donors[0]!

  return updateWallsInState(after, (wall) => {
    if (!targets.has(wall.id)) return wall
    if (donorIds.includes(wall.id)) return wall
    return applyWallPropertyDelta(wall, primary.before, primary.after)
  })
}

function updateWallsInState(
  state: FacadeState,
  mapWall: (wall: Wall) => Wall,
): FacadeState {
  const next = cloneFacadeState(state)
  next.buildings = next.buildings.map((building) => ({
    ...building,
    walls: building.walls.map(mapWall),
  }))
  return next
}

export function wallStillInBuilding(state: FacadeState, wallId: string): boolean {
  return Boolean(findBuildingForWall(state, wallId))
}
