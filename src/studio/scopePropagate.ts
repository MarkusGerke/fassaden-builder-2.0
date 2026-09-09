import type { EditScope } from '../studio/editScope'
import {
  editOpeningTargets,
  editWallTargets,
  filterOpeningRefsByBasementParity,
} from './editScope'
import type {
  EditorState,
  FacadeState,
  Opening,
  OpeningRef,
  ProfileAssignment,
  Wall,
} from '../types/facade'
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
  // Rahmenprofile hängen an openingId — nicht als Array deep-mergen (fremde IDs).
  'profiles',
])

/** Profil-Zuweisungen einer Öffnung (Kante+Profil), sortiert vergleichbar. */
function profileAssignmentKey(p: ProfileAssignment): string {
  return `${p.edge}:${p.profileId}`
}

function profilesForOpening(wall: Wall, openingId: string): ProfileAssignment[] {
  return wall.profiles.filter((p) => p.openingId === openingId)
}

function openingProfilesEqual(a: ProfileAssignment[], b: ProfileAssignment[]): boolean {
  if (a.length !== b.length) return false
  const sa = a.map(profileAssignmentKey).sort()
  const sb = b.map(profileAssignmentKey).sort()
  return sa.every((k, i) => k === sb[i])
}

/** Ersetzt die Profil-Zuweisungen einer Peer-Öffnung durch die des Donors (IDs remappen). */
export function applyOpeningProfilesDelta(
  peerProfiles: ProfileAssignment[],
  peerOpeningId: string,
  beforeProfiles: ProfileAssignment[],
  afterProfiles: ProfileAssignment[],
): ProfileAssignment[] {
  if (openingProfilesEqual(beforeProfiles, afterProfiles)) return peerProfiles
  return [
    ...peerProfiles.filter((p) => p.openingId !== peerOpeningId),
    ...afterProfiles.map((p) => ({
      openingId: peerOpeningId,
      profileId: p.profileId,
      edge: p.edge,
    })),
  ]
}

/** Fenster/Türen: Property- und Profil-Deltas ohne Maßfilter. */
function openingTakesFrameProfile(opening: Opening): boolean {
  return opening.type === 'window' || opening.type === 'door'
}

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
  const beforeById = new Map(before.openings.map((o) => [o.id, o]))
  const afterById = new Map(after.openings.map((o) => [o.id, o]))
  let profiles = next.profiles
  let openingsChanged = false
  const openings = peer.openings.map((peerOpen) => {
    let nextOpen = peerOpen
    let did = false
    for (const [id, afterOpen] of afterById) {
      const beforeOpen = beforeById.get(id)
      if (!beforeOpen) continue
      const beforeProf = profilesForOpening(before, id)
      const afterProf = profilesForOpening(after, id)
      const openSame = beforeOpen === afterOpen
      const profSame = openingProfilesEqual(beforeProf, afterProf)
      const canTakePeer =
        openingTakesFrameProfile(peerOpen) && openingTakesFrameProfile(afterOpen)
      if (!canTakePeer) continue
      if (!profSame) {
        profiles = applyOpeningProfilesDelta(profiles, peerOpen.id, beforeProf, afterProf)
        did = true
      }
      if (!openSame) {
        nextOpen = applyOpeningPropertyDelta(peerOpen, beforeOpen, afterOpen)
        did = true
      }
      if (did) break
    }
    if (did) openingsChanged = true
    return nextOpen
  })
  if (openingsChanged) {
    next = { ...next, openings, profiles }
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

export type ScopePropagateKind = 'type' | 'floor' | 'facade'

/**
 * Toast „Typ“: gleicher Öffnungstyp (Fenster↔Fenster, Tür↔Tür), **beliebige Maße**.
 * Sonst fehlt der Button bei Unikat-Maßen, obwohl Etage/Fassade angeboten werden.
 * (Gültig-für „Typ“ in der Toolbar bleibt Typ+Maß via `editOpeningTargets`.)
 */
export function propagateOpeningTargets(
  state: FacadeState,
  editor: EditorState,
  toScope: ScopePropagateKind,
): OpeningRef[] {
  if (toScope !== 'type') return editOpeningTargets(state, editor, toScope, null)
  const types = new Set<string>()
  for (const ref of editor.selectedOpenings) {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (opening) types.add(opening.type)
  }
  if (types.size === 0) return [...editor.selectedOpenings]
  const refs: OpeningRef[] = []
  for (const wall of getAllWalls(state)) {
    for (const opening of wall.openings) {
      if (types.has(opening.type)) refs.push({ wallId: wall.id, openingId: opening.id })
    }
  }
  return filterOpeningRefsByBasementParity(state, refs, editor)
}

/** Ob eine höhere Scope-Stufe mehr Ziele träfe als die aktuelle. */
export function scopePropagateAvailable(
  state: FacadeState,
  editor: EditorState,
  fromScope: EditScope,
  toScope: ScopePropagateKind,
): boolean {
  if (fromScope === 'facade') return false
  if (fromScope === 'type' && toScope === 'type') return false
  if (fromScope === 'floor' && (toScope === 'floor' || toScope === 'type')) return false
  const hasOpenings = editor.selectedOpenings.length > 0
  if (hasOpenings) {
    const current = editOpeningTargets(state, editor, fromScope, null)
    const elevated = propagateOpeningTargets(state, editor, toScope)
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
    const targets = propagateOpeningTargets(after, editor, toScope)
    type OpeningDonor = {
      before: Opening
      after: Opening
      profilesBefore: ProfileAssignment[]
      profilesAfter: ProfileAssignment[]
    }
    const donors = editor.selectedOpenings
      .map((ref): OpeningDonor | null => {
        const bWall = getWall(before, ref.wallId)
        const aWall = getWall(after, ref.wallId)
        const bOpen = bWall?.openings.find((o) => o.id === ref.openingId)
        const aOpen = aWall?.openings.find((o) => o.id === ref.openingId)
        if (!bOpen || !aOpen || !bWall || !aWall) return null
        return {
          before: bOpen,
          after: aOpen,
          profilesBefore: profilesForOpening(bWall, ref.openingId),
          profilesAfter: profilesForOpening(aWall, ref.openingId),
        }
      })
      .filter((d): d is OpeningDonor => Boolean(d))

    if (donors.length === 0) return after

    return updateWallsInState(after, (wall) => {
      let changed = false
      let profiles = wall.profiles
      const openings = wall.openings.map((open) => {
        const hit = targets.some((t) => t.wallId === wall.id && t.openingId === open.id)
        if (!hit) return open
        let nextOpen = open
        let did = false
        for (const donor of donors) {
          const openSame = donor.before === donor.after
          const profSame = openingProfilesEqual(donor.profilesBefore, donor.profilesAfter)
          // Typ-Stufe: nur gleicher Opening-Typ; Etage/Fassade: Fenster und Türen.
          const canTakePeer =
            toScope === 'type'
              ? open.type === donor.after.type
              : openingTakesFrameProfile(open) && openingTakesFrameProfile(donor.after)
          if (!canTakePeer) continue
          if (!profSame) {
            profiles = applyOpeningProfilesDelta(
              profiles,
              open.id,
              donor.profilesBefore,
              donor.profilesAfter,
            )
            did = true
          }
          if (!openSame) {
            nextOpen = applyOpeningPropertyDelta(open, donor.before, donor.after)
            did = true
          }
          if (did) break
        }
        if (did) changed = true
        return nextOpen
      })
      return changed ? { ...cloneWall(wall), openings, profiles } : wall
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
