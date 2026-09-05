import type { EditorState, FacadeState, Opening, OpeningRef, Wall } from '../types/facade'
import { findBuildingForWall, getActiveBuilding, getAllWalls } from '../utils/buildings'
import { floorIndex } from '../utils/layers'
import { getWall } from '../utils/walls'
import { normalizeYawDeg } from './compass'
import { panelConfigKey } from './constants'
import { isStudioWall } from './walls'

export type EditScope = 'element' | 'floor' | 'facade' | 'type'

export const DEFAULT_EDIT_SCOPE: EditScope = 'element'

function openingBasementEnabled(opening: Opening): boolean {
  return opening.type === 'window' && Boolean(opening.basementWindow?.enabled)
}

/** Keller-Parität der aktuellen Öffnungsauswahl. */
export function basementParityOfSelection(
  state: FacadeState,
  editor: EditorState,
): boolean | 'mixed' | 'none' {
  if (editor.selectedOpenings.length === 0) return 'none'
  let basement: boolean | undefined
  for (const ref of editor.selectedOpenings) {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!opening) continue
    const isBasement = openingBasementEnabled(opening)
    if (basement === undefined) basement = isBasement
    else if (basement !== isBasement) return 'mixed'
  }
  return basement ?? false
}

/** Nur Öffnungen mit gleicher Keller-Parität wie der Anker. Bei gemischter Auswahl: nur markierte. */
export function filterOpeningRefsByBasementParity(
  state: FacadeState,
  refs: OpeningRef[],
  editor: EditorState,
): OpeningRef[] {
  const parity = basementParityOfSelection(state, editor)
  if (parity === 'none') return refs
  if (parity === 'mixed') {
    const selected = new Set(editor.selectedOpenings.map((r) => `${r.wallId}:${r.openingId}`))
    return refs.filter((ref) => selected.has(`${ref.wallId}:${ref.openingId}`))
  }
  return refs.filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!opening) return false
    return openingBasementEnabled(opening) === parity
  })
}

function wallHeightForWall(state: FacadeState, wallId: string): number {
  return findBuildingForWall(state, wallId)?.wallHeight ?? getActiveBuilding(state).wallHeight
}

/** Alle floorIndex-Werte der aktuellen Wand-/Öffnungsauswahl. */
function selectedFloorIndices(state: FacadeState, editor: EditorState): number[] {
  const floors = new Set<number>()
  for (const wallId of editor.selectedWallIds) {
    const wall = getWall(state, wallId)
    if (wall) floors.add(floorIndex(wall, wallHeightForWall(state, wallId)))
  }
  for (const ref of editor.selectedOpenings) {
    const wall = getWall(state, ref.wallId)
    if (wall) floors.add(floorIndex(wall, wallHeightForWall(state, ref.wallId)))
  }
  return [...floors]
}

/** Gleicher Öffnungstyp und gleiche Maße (Breite×Höhe, cm gerundet). Keller separat. */
export function openingsMatchByType(a: Opening, b: Opening): boolean {
  if (a.type !== b.type) return false
  return (
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  )
}

/** Alle Studio-Wände desselben Hauses (alle Seiten, alle Winkel, alle Etagen). */
function studioWallsOfBuilding(state: FacadeState, wallId: string) {
  const buildingId = findBuildingForWall(state, wallId)?.id
  return getAllWalls(state).filter((wall) => {
    if (!isStudioWall(wall)) return false
    if (!buildingId) return true
    return findBuildingForWall(state, wall.id)?.id === buildingId
  })
}

/** Unique Yaws der Studio-Wände im Haus der Ankerwand (aufsteigend). */
export function availableFacadeYaws(state: FacadeState, anchorWallId: string): number[] {
  const walls = studioWallsOfBuilding(state, anchorWallId)
  return [...new Set(walls.map((wall) => normalizeYawDeg(wall.yawDeg ?? 0)))].sort((a, b) => a - b)
}

/** Persistenz / UI: leeres Array oder ungültig → null (= alle Richtungen). */
export function normalizeFacadeYawFilter(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const yaws = [
    ...new Set(
      raw
        .map((item) => normalizeYawDeg(Number(item)))
        .filter((yaw) => Number.isFinite(yaw)),
    ),
  ]
  return yaws.length === 0 ? null : yaws
}

function wallsMatchingFacadeYaws(walls: Wall[], filter: number[] | null | undefined): Wall[] {
  if (!filter || filter.length === 0) return walls
  const set = new Set(filter.map((yaw) => normalizeYawDeg(yaw)))
  return walls.filter((wall) => set.has(normalizeYawDeg(wall.yawDeg ?? 0)))
}

export function editWallTargets(
  state: FacadeState,
  editor: EditorState,
  scope: EditScope,
  facadeYawFilter: number[] | null = null,
): string[] {
  if (editor.selectedWallIds.length === 0) return []
  if (scope === 'type') {
    const anchor = getWall(state, editor.selectedWallIds[0])
    if (!anchor) return [...editor.selectedWallIds]
    const buildingId = findBuildingForWall(state, anchor.id)?.id
    if (isStudioWall(anchor)) {
      const key = panelConfigKey(anchor.panel)
      return getAllWalls(state)
        .filter((wall) => {
          const b = findBuildingForWall(state, wall.id)
          if (buildingId && b?.id !== buildingId) return false
          return isStudioWall(wall) && panelConfigKey(wall.panel) === key
        })
        .map((wall) => wall.id)
    }
    const moduleKey = `${anchor.moduleName ?? ''}:${anchor.claddingId ?? ''}`
    return getAllWalls(state)
      .filter(
        (wall) =>
          !isStudioWall(wall) &&
          `${wall.moduleName ?? ''}:${wall.claddingId ?? ''}` === moduleKey,
      )
      .map((wall) => wall.id)
  }
  if (scope === 'facade') {
    const anchor = getWall(state, editor.selectedWallIds[0])
    if (!anchor) return [...editor.selectedWallIds]
    return wallsMatchingFacadeYaws(studioWallsOfBuilding(state, anchor.id), facadeYawFilter).map(
      (wall) => wall.id,
    )
  }
  if (scope === 'floor') {
    const floors = selectedFloorIndices(state, editor)
    if (floors.length === 0) return [...editor.selectedWallIds]
    const floorSet = new Set(floors)
    return getAllWalls(state)
      .filter(
        (wall) =>
          isStudioWall(wall) &&
          floorSet.has(floorIndex(wall, wallHeightForWall(state, wall.id))),
      )
      .map((wall) => wall.id)
  }
  return editor.selectedWallIds.filter((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall)
  })
}

export function editOpeningTargets(
  state: FacadeState,
  editor: EditorState,
  scope: EditScope,
  facadeYawFilter: number[] | null = null,
): OpeningRef[] {
  if (editor.selectedOpenings.length === 0) return []
  if (scope === 'facade') {
    const anchorRef = editor.selectedOpenings[0]
    const anchorWall = anchorRef ? getWall(state, anchorRef.wallId) : undefined
    if (!anchorWall) return [...editor.selectedOpenings]
    const refs: OpeningRef[] = []
    for (const wall of wallsMatchingFacadeYaws(
      studioWallsOfBuilding(state, anchorWall.id),
      facadeYawFilter,
    )) {
      for (const opening of wall.openings) {
        refs.push({ wallId: wall.id, openingId: opening.id })
      }
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  if (scope === 'floor') {
    const floors = selectedFloorIndices(state, editor)
    if (floors.length === 0) return [...editor.selectedOpenings]
    const floorSet = new Set(floors)
    const refs: OpeningRef[] = []
    for (const wall of getAllWalls(state)) {
      if (!floorSet.has(floorIndex(wall, wallHeightForWall(state, wall.id)))) continue
      for (const opening of wall.openings) {
        refs.push({ wallId: wall.id, openingId: opening.id })
      }
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  if (scope === 'type') {
    const anchors: Opening[] = []
    for (const ref of editor.selectedOpenings) {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (opening) anchors.push(opening)
    }
    if (anchors.length === 0) return [...editor.selectedOpenings]
    const refs: OpeningRef[] = []
    for (const wall of getAllWalls(state)) {
      for (const opening of wall.openings) {
        if (anchors.some((anchor) => openingsMatchByType(anchor, opening))) {
          refs.push({ wallId: wall.id, openingId: opening.id })
        }
      }
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  return filterOpeningRefsByBasementParity(state, [...editor.selectedOpenings], editor)
}

function isDoorOrWindow(opening: Opening): boolean {
  return opening.type === 'window' || opening.type === 'door'
}

/**
 * Ziele für Bogenform / Stichmaß: Fenster **und** Türen im Gültigkeitsbereich
 * (Ausschnitte ausgenommen). Bei „Auswahl“: nur markierte Fenster/Türen.
 * Bei „Typ“: gleicher Typ und gleiche Maße wie die Auswahl (wie `editOpeningTargets`).
 */
export function editArchOpeningTargets(
  state: FacadeState,
  editor: EditorState,
  scope: EditScope,
  facadeYawFilter: number[] | null = null,
): OpeningRef[] {
  if (editor.selectedOpenings.length === 0) return []
  const anchorRef = editor.selectedOpenings[0]!
  const anchorWall = getWall(state, anchorRef.wallId)
  if (!anchorWall) return []

  const pushDoorWindow = (wall: { id: string; openings: Opening[] }, into: OpeningRef[]) => {
    for (const opening of wall.openings) {
      if (!isDoorOrWindow(opening)) continue
      into.push({ wallId: wall.id, openingId: opening.id })
    }
  }

  const refs: OpeningRef[] = []
  if (scope === 'element') {
    for (const ref of editor.selectedOpenings) {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (opening && isDoorOrWindow(opening)) refs.push(ref)
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  if (scope === 'type') {
    const anchors: Opening[] = []
    for (const ref of editor.selectedOpenings) {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (opening && isDoorOrWindow(opening)) anchors.push(opening)
    }
    if (anchors.length === 0) return []
    for (const wall of studioWallsOfBuilding(state, anchorWall.id)) {
      for (const opening of wall.openings) {
        if (!isDoorOrWindow(opening)) continue
        if (anchors.some((anchor) => openingsMatchByType(anchor, opening))) {
          refs.push({ wallId: wall.id, openingId: opening.id })
        }
      }
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  if (scope === 'facade') {
    for (const wall of wallsMatchingFacadeYaws(
      studioWallsOfBuilding(state, anchorWall.id),
      facadeYawFilter,
    )) {
      pushDoorWindow(wall, refs)
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  if (scope === 'floor') {
    const floors = selectedFloorIndices(state, editor)
    if (floors.length === 0) {
      pushDoorWindow(anchorWall, refs)
      return refs
    }
    const floorSet = new Set(floors)
    for (const wall of getAllWalls(state)) {
      if (!floorSet.has(floorIndex(wall, wallHeightForWall(state, wall.id)))) continue
      pushDoorWindow(wall, refs)
    }
    return filterOpeningRefsByBasementParity(state, refs, editor)
  }
  return filterOpeningRefsByBasementParity(state, refs, editor)
}
