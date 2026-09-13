import type { AwningConfig, FacadeState, Opening, OpeningRef, Wall } from '../types/facade'
import { cloneWall } from '../types/facade'
import { mapAllWalls } from './buildings'
import { snapToGrid } from './grid'
import { STUDIO_MASONRY } from '../studio/constants'
import {
  AWNING_OVERHANG_STEP_CM,
  defaultAwningConfig,
  defaultOpeningAwningWidth,
  normalizeAwningConfig,
  openingSupportsAwning,
} from '../studio/awning'
import { createId } from './id'

export function wallAwnings(wall: Wall): AwningConfig[] {
  return (wall.awnings ?? []).map((item) => normalizeAwningConfig(item))
}

export function findWallAwning(wall: Wall, awningId?: string | null): AwningConfig | undefined {
  if (!awningId) return undefined
  return wallAwnings(wall).find((item) => item.id === awningId)
}

export function defaultWallAwningAnchor(
  wall: Wall,
  widthCm = 192,
  projectionCm = 144,
): { mountX: number; mountY: number } {
  const w = Math.max(48, widthCm)
  const mountX = snapToGrid(Math.max(0, (wall.width - w) / 2), STUDIO_MASONRY)
  const mountY = snapToGrid(
    Math.max(AWNING_MOUNT_MIN_Y, Math.min(wall.height - 24, wall.height * 0.72)),
    STUDIO_MASONRY,
  )
  void projectionCm
  return { mountX, mountY }
}

const AWNING_MOUNT_MIN_Y = 96

/** Öffnung ist Mitglied einer Wand-Gruppen-Markise. */
export function openingCoveredByWallAwning(wall: Wall, openingId: string): boolean {
  return Boolean(findWallAwningCoveringOpening(wall, openingId))
}

/** Gruppen-Markise, die diese Öffnung abdeckt (enabled). */
export function findWallAwningCoveringOpening(
  wall: Wall,
  openingId: string,
): AwningConfig | undefined {
  return wallAwnings(wall).find(
    (a) => a.enabled && Array.isArray(a.openingIds) && a.openingIds.includes(openingId),
  )
}

/**
 * Gruppen-`mountY` ist relativ zum Span-Sturz (wie Öffnungs-Markise).
 * Alt: absolute Wandhöhe ≈ Span-Top → auf Relativ umrechnen.
 */
export function groupAwningMountYRelative(stored: number | undefined, spanTop: number): number {
  const y = stored ?? 0
  if (Math.abs(y - spanTop) <= STUDIO_MASONRY) return 0
  if (y > 96) return snapToGrid(y - spanTop, STUDIO_MASONRY)
  return y
}

/** Layout aus Öffnungs-Span + Seitenüberstand (linke Kante = Span − Überstand). */
export function layoutAwningForOpenings(
  openings: Pick<Opening, 'x' | 'y' | 'width' | 'height'>[],
  overhangCm?: number,
): { widthCm: number; mountX: number; mountY: number } {
  if (openings.length === 0) {
    return { widthCm: 192, mountX: 0, mountY: AWNING_MOUNT_MIN_Y }
  }
  const left = Math.min(...openings.map((o) => o.x))
  const right = Math.max(...openings.map((o) => o.x + o.width))
  const top = Math.max(...openings.map((o) => o.y + o.height))
  const span = Math.max(8, right - left)
  const widthCm = defaultOpeningAwningWidth({ width: span }, overhangCm)
  const oh = overhangCm ?? 16
  const mountX = snapToGrid(left - oh, AWNING_OVERHANG_STEP_CM)
  const mountY = snapToGrid(Math.max(AWNING_MOUNT_MIN_Y, top), STUDIO_MASONRY)
  return { widthCm, mountX, mountY }
}

/**
 * Öffnungs-Markisenbreite neu + Gruppen-Markisen am Span halten.
 * Nach Größen-/Positionsänderung einer Öffnung aufrufen.
 */
export function syncAwningGeometryOnWall(wall: Wall): Wall {
  const covered = new Set<string>()
  for (const a of wallAwnings(wall)) {
    if (!a.enabled || !a.openingIds?.length) continue
    for (const id of a.openingIds) covered.add(id)
  }

  const openings = wall.openings.map((opening) => {
    if (!opening.awning?.enabled) return opening
    if (covered.has(opening.id)) return opening
    if (!openingSupportsAwning(opening)) return opening
    const widthCm = defaultOpeningAwningWidth(opening, opening.awning.overhangCm)
    if (widthCm === opening.awning.widthCm) return opening
    return {
      ...opening,
      awning: normalizeAwningConfig({ ...opening.awning, widthCm }),
    }
  })

  const openById = new Map(openings.map((o) => [o.id, o]))
  const awnings = wallAwnings(wall).map((awning) => {
    if (!awning.enabled || !awning.openingIds?.length) return awning
    const ids = awning.openingIds.filter((id) => openById.has(id))
    if (ids.length === 0) {
      return normalizeAwningConfig({ ...awning, openingIds: undefined })
    }
    const members = ids.map((id) => openById.get(id)!)
    const layout = layoutAwningForOpenings(members, awning.overhangCm)
    return normalizeAwningConfig({
      ...awning,
      openingIds: ids,
      widthCm: layout.widthCm,
      mountX: layout.mountX,
      mountY: groupAwningMountYRelative(awning.mountY, layout.mountY),
    })
  })

  return { ...cloneWall(wall), openings, awnings }
}

export function addWallAwning(
  state: FacadeState,
  wallId: string,
  partial?: Partial<AwningConfig>,
): { state: FacadeState; awningId: string } {
  const awningId = typeof partial?.id === 'string' && partial.id.trim() ? partial.id.trim() : createId()
  const nextState = mapAllWalls(state, (wall) => {
    if (wall.id !== wallId) return cloneWall(wall)
    const widthCm = partial?.widthCm ?? 192
    const anchor = defaultWallAwningAnchor(wall, widthCm, partial?.projectionCm)
    const awning = normalizeAwningConfig({
      ...defaultAwningConfig({
        enabled: true,
        kind: partial?.kind ?? 'foldingArm',
        extension: partial?.extension ?? 0.65,
        ...partial,
        id: awningId,
        mountX: partial?.mountX ?? anchor.mountX,
        mountY: partial?.mountY ?? anchor.mountY,
      }),
      enabled: true,
      id: awningId,
    })
    return {
      ...cloneWall(wall),
      awnings: [...wallAwnings(wall), awning],
    }
  })
  return { state: nextState, awningId }
}

export function updateWallAwning(
  state: FacadeState,
  wallIds: string[],
  patch: Partial<AwningConfig> & {
    motion?: Partial<NonNullable<AwningConfig['motion']>>
  },
  awningId?: string | null,
): FacadeState {
  if (wallIds.length === 0) return state
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const list = wallAwnings(wall)
    if (list.length === 0) return cloneWall(wall)
    const targetId = awningId && list.some((a) => a.id === awningId) ? awningId : list[0]!.id
    const nextWall: Wall = {
      ...cloneWall(wall),
      awnings: list.map((item) => {
        if (item.id !== targetId) return item
        const motion = patch.motion
          ? {
              extend: patch.motion.extend ?? item.motion!.extend,
              retract: patch.motion.retract ?? item.motion!.retract,
            }
          : item.motion
        return normalizeAwningConfig({
          ...item,
          ...patch,
          id: item.id,
          motion,
        })
      }),
    }
    // Gruppen-Markise: Breite/Mount nach overhang/openingIds neu ableiten.
    return syncAwningGeometryOnWall(nextWall)
  })
}

export function removeWallAwning(
  state: FacadeState,
  wallId: string,
  awningId?: string | null,
): FacadeState {
  return mapAllWalls(state, (wall) => {
    if (wall.id !== wallId) return cloneWall(wall)
    const list = wallAwnings(wall)
    if (list.length === 0) return cloneWall(wall)
    const next = awningId ? list.filter((item) => item.id !== awningId) : list.slice(0, -1)
    return { ...cloneWall(wall), awnings: next }
  })
}

export function updateOpeningAwning(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<AwningConfig> & {
    motion?: Partial<NonNullable<AwningConfig['motion']>>
  },
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.has(opening.id)) return opening
        if (!openingSupportsAwning(opening)) return opening
        const prev = normalizeAwningConfig(
          opening.awning ??
            defaultAwningConfig({
              enabled: false,
              widthCm: defaultOpeningAwningWidth(opening),
            }),
        )
        const motion = patch.motion
          ? {
              extend: patch.motion.extend ?? prev.motion!.extend,
              retract: patch.motion.retract ?? prev.motion!.retract,
            }
          : prev.motion
        let widthCm = defaultOpeningAwningWidth(
          opening,
          patch.overhangCm ?? prev.overhangCm,
        )
        // widthCm aus Patch ignorieren — immer Öffnung + Überstand (v2.0.430).
        void patch.widthCm
        return {
          ...opening,
          awning: normalizeAwningConfig({
            ...prev,
            ...patch,
            id: prev.id,
            widthCm,
            motion,
          }),
        }
      }),
    }
  })
}

export function ensureOpeningAwning(opening: Opening): AwningConfig {
  return normalizeAwningConfig(
    opening.awning ??
      defaultAwningConfig({
        enabled: false,
        widthCm: defaultOpeningAwningWidth(opening),
      }),
  )
}

/** Zwischenablage nur Markise (Rechtsklick). */
export type AwningClipboard = {
  config: AwningConfig
  source: 'opening' | 'wall'
}

export function cloneAwningConfig(config: AwningConfig): AwningConfig {
  return normalizeAwningConfig(JSON.parse(JSON.stringify(config)) as AwningConfig)
}

/**
 * Markisen-Config auf Öffnung(en) anwenden.
 * - paste: ohne/deaktivierte Markise → aktivieren; mit Markise → Stil übernehmen
 * - replace: nur wenn bereits aktiviert — Ziel-`id` behalten
 */
export function applyAwningToOpenings(
  state: FacadeState,
  targets: OpeningRef[],
  source: AwningConfig,
  mode: 'paste' | 'replace',
): FacadeState {
  if (targets.length === 0) return state
  const template = cloneAwningConfig({ ...source, enabled: true })
  return mapAllWalls(state, (wall) => {
    const hit = targets.filter((t) => t.wallId === wall.id)
    if (hit.length === 0) return cloneWall(wall)
    const ids = new Set(hit.map((t) => t.openingId))
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!ids.has(opening.id)) return opening
        if (!openingSupportsAwning(opening)) return opening
        const prev = ensureOpeningAwning(opening)
        if (mode === 'replace' && !prev.enabled) return opening
        const widthCm = defaultOpeningAwningWidth(opening, template.overhangCm ?? prev.overhangCm)
        return {
          ...opening,
          awning: normalizeAwningConfig({
            ...template,
            id: prev.id,
            enabled: true,
            widthCm,
            mountX: undefined,
            mountY: template.mountY ?? prev.mountY,
            openingIds: undefined,
          }),
        }
      }),
    }
  })
}

/**
 * Wand-Markise: bei `awningId` ersetzen, sonst neu anlegen.
 * `at` = Wand-lokal für Mount (Einfügen).
 */
export function applyAwningToWall(
  state: FacadeState,
  wallId: string,
  source: AwningConfig,
  opts?: { awningId?: string | null; at?: { localX: number; localY: number } },
): { state: FacadeState; awningId: string } {
  const template = cloneAwningConfig({ ...source, enabled: true })
  const wall = state.buildings.flatMap((b) => b.walls).find((w) => w.id === wallId)
  if (!wall) return { state, awningId: template.id }

  const existingId =
    opts?.awningId && wallAwnings(wall).some((a) => a.id === opts.awningId)
      ? opts.awningId
      : undefined

  if (existingId) {
    const prev = findWallAwning(wall, existingId)!
    const next = updateWallAwning(
      state,
      [wallId],
      {
        ...template,
        id: existingId,
        enabled: true,
        widthCm: template.widthCm || prev.widthCm,
        mountX: template.mountX ?? prev.mountX,
        mountY: template.mountY ?? prev.mountY,
      },
      existingId,
    )
    return { state: next, awningId: existingId }
  }

  const widthCm = template.widthCm || 192
  let mountX = template.mountX
  let mountY = template.mountY
  if (opts?.at) {
    mountX = snapToGrid(
      Math.max(0, Math.min(wall.width - widthCm, opts.at.localX - widthCm / 2)),
      STUDIO_MASONRY,
    )
    mountY = snapToGrid(
      Math.max(AWNING_MOUNT_MIN_Y, Math.min(wall.height - 24, opts.at.localY)),
      STUDIO_MASONRY,
    )
  }
  return addWallAwning(state, wallId, {
    ...template,
    id: createId(),
    enabled: true,
    widthCm,
    mountX,
    mountY,
    openingIds: undefined,
  })
}

/**
 * Eine Markise über mehrere Öffnungen derselben Wand.
 * Deaktiviert individuelle opening.awning für die Mitglieder.
 */
export function createGroupAwningForOpenings(
  state: FacadeState,
  wallId: string,
  openingIds: string[],
  partial?: Partial<AwningConfig>,
): { state: FacadeState; awningId: string } {
  const unique = [...new Set(openingIds)]
  if (unique.length < 1) return { state, awningId: '' }
  const wall = state.buildings.flatMap((b) => b.walls).find((w) => w.id === wallId)
  if (!wall) return { state, awningId: '' }
  const members = unique
    .map((id) => wall.openings.find((o) => o.id === id))
    .filter((o): o is Opening => Boolean(o && openingSupportsAwning(o)))
  if (members.length === 0) return { state, awningId: '' }

  const overhangCm = partial?.overhangCm ?? members[0]!.awning?.overhangCm ?? 16
  const layout = layoutAwningForOpenings(members, overhangCm)
  const awningId =
    typeof partial?.id === 'string' && partial.id.trim() ? partial.id.trim() : createId()

  const nextState = mapAllWalls(state, (w) => {
    if (w.id !== wallId) return cloneWall(w)
    const memberIds = new Set(members.map((m) => m.id))
    // Andere Gruppen ohne diese IDs bereinigen
    const otherAwnings = wallAwnings(w)
      .filter((a) => a.id !== awningId)
      .map((a) => {
        if (!a.openingIds?.length) return a
        const rest = a.openingIds.filter((id) => !memberIds.has(id))
        if (rest.length === a.openingIds.length) return a
        if (rest.length === 0) return null
        return normalizeAwningConfig({ ...a, openingIds: rest })
      })
      .filter((a): a is AwningConfig => Boolean(a))

    const relativeMountY = groupAwningMountYRelative(partial?.mountY ?? 0, layout.mountY)
    const group = normalizeAwningConfig({
      ...defaultAwningConfig({
        enabled: true,
        kind: partial?.kind ?? members[0]!.awning?.kind ?? 'foldingArm',
        ...partial,
        id: awningId,
        overhangCm,
        widthCm: layout.widthCm,
        mountX: layout.mountX,
        mountY: relativeMountY,
        openingIds: members.map((m) => m.id),
      }),
      enabled: true,
      id: awningId,
      openingIds: members.map((m) => m.id),
      widthCm: layout.widthCm,
      mountX: layout.mountX,
      mountY: relativeMountY,
    })

    const openings = w.openings.map((opening) => {
      if (!memberIds.has(opening.id)) return opening
      const prev = ensureOpeningAwning(opening)
      return {
        ...opening,
        awning: normalizeAwningConfig({ ...prev, enabled: false }),
      }
    })

    return syncAwningGeometryOnWall({
      ...cloneWall(w),
      openings,
      awnings: [...otherAwnings, group],
    })
  })
  return { state: nextState, awningId }
}

/** Gruppen-Markise entfernen (Öffnungen ohne Markise). */
export function dissolveGroupAwning(
  state: FacadeState,
  wallId: string,
  awningId: string,
): FacadeState {
  return removeWallAwning(state, wallId, awningId)
}

/** Gruppen-Markise → je Mitglied eine individuelle Öffnungs-Markise. */
export function splitGroupAwningToOpenings(
  state: FacadeState,
  wallId: string,
  awningId: string,
): FacadeState {
  const wall = state.buildings.flatMap((b) => b.walls).find((w) => w.id === wallId)
  const group = wall ? findWallAwning(wall, awningId) : undefined
  if (!wall || !group?.openingIds?.length) return state

  const style = cloneAwningConfig({ ...group, openingIds: undefined, enabled: true })
  let next = removeWallAwning(state, wallId, awningId)
  const refs = group.openingIds.map((openingId) => ({ wallId, openingId }))
  next = applyAwningToOpenings(next, refs, style, 'paste')
  return next
}

/** Öffnungen zur bestehenden Gruppen-Markise hinzufügen / entfernen. */
export function setGroupAwningOpeningIds(
  state: FacadeState,
  wallId: string,
  awningId: string,
  openingIds: string[],
): FacadeState {
  if (openingIds.length === 0) return dissolveGroupAwning(state, wallId, awningId)
  const wall = state.buildings.flatMap((b) => b.walls).find((w) => w.id === wallId)
  const prev = wall ? findWallAwning(wall, awningId) : undefined
  const { state: next } = createGroupAwningForOpenings(state, wallId, openingIds, {
    id: awningId,
    ...(prev ?? {}),
  })
  return next
}
