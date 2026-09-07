import type { FacadeState, Opening, Wall, WallLabelConfig, WallLabelDepth, WallTrimBand } from '../types/facade'
import { STUDIO_MASONRY, studioPlinthActive } from '../studio/constants'
import { visiblePanelRowRange } from '../studio/panelLayout'
import { openingCutsWall } from './openingGeometry'
import { snapToGrid } from './grid'
import { normalizeWallTrimBand } from './trimBands'
import { resolveLabelFontId } from '../studio/labelFonts'
import { createId } from './id'
import { normalizeSurfaceFinish } from './surfaceFinish'

export type WallLabelAlign = 'left' | 'center' | 'right'

/** Versatz beim Einfügen einer weiteren Schrift auf derselben Wand (cm). */
export const WALL_LABEL_PASTE_OFFSET = STUDIO_MASONRY * 2

export const DEFAULT_WALL_LABEL: Required<
  Omit<WallLabelConfig, 'color' | 'fontId' | 'finish' | 'id'>
> & { color?: string; fontId?: string; finish?: WallLabelConfig['finish']; id?: string } = {
  enabled: false,
  text: '',
  x: 0,
  y: 0,
  heightCm: 48,
  depth: 'flat',
  extrudeCm: 4,
  offsetForward: 0,
  align: 'center',
  fontId: 'federo',
}

export const NEUTRAL_WALL_LABEL: WallLabelConfig = { ...DEFAULT_WALL_LABEL }

/** Standard-Abstand der Schriftoberkante von der Wandoberkante (cm). */
export const WALL_LABEL_DEFAULT_TOP_MARGIN_CM = 64

/** Standard-Anker: horizontal zentriert, Oberkante 64 cm unter der Wandoberkante. */
export function defaultWallLabelAnchor(
  wall: Wall,
  heightCm?: number,
): { x: number; y: number } {
  const h = clampHeightCm(heightCm)
  const yMax = Math.max(0, wall.height - h)
  const yRaw = wall.height - WALL_LABEL_DEFAULT_TOP_MARGIN_CM - h
  const y = Math.max(0, Math.min(yMax, snapToGrid(yRaw, STUDIO_MASONRY)))
  const x = snapToGrid(wall.width / 2, STUDIO_MASONRY)
  return {
    x: Math.max(0, Math.min(wall.width, x)),
    y,
  }
}

/** Setzt aktive Beschriftung auf den Standard-Anker (Mitte, 64 cm unter der Oberkante). */
export function placeWallLabelDefault(
  wall: Wall,
  label?: WallLabelConfig,
): WallLabelConfig | null {
  const normalized = normalizeWallLabel(label ?? wall.label, wall)
  if (!normalized.enabled || !(normalized.text ?? '').trim()) return null
  const { x, y } = defaultWallLabelAnchor(wall, normalized.heightCm)
  if (normalized.x === x && normalized.y === y && normalized.align === 'center') return null
  return { ...normalized, x, y, align: 'center' }
}

export function syncWallLabelDefaultPlacement(state: FacadeState, wallIds: string[]): FacadeState {
  const ids = new Set(wallIds)
  let changed = false
  const buildings = state.buildings.map((building) => ({
    ...building,
    walls: building.walls.map((wall) => {
      if (!ids.has(wall.id)) return wall
      const existing = wallLabels(wall)
      if (existing.length === 0) return wall
      let labelsChanged = false
      const next = existing.map((item) => {
        const placed = placeWallLabelDefault(wall, item)
        if (!placed) return item
        labelsChanged = true
        return placed
      })
      if (!labelsChanged) return wall
      changed = true
      return withWallLabels(wall, next)
    }),
  }))
  return changed ? { ...state, buildings } : state
}

function syncTrimBandsToTopBareBand(state: FacadeState, wallIds: string[]): FacadeState {
  const ids = new Set(wallIds)
  let changed = false
  const buildings = state.buildings.map((building) => ({
    ...building,
    walls: building.walls.map((wall) => {
      if (!ids.has(wall.id)) return wall
      if (!wall.trimBands?.length) return wall
      let bandsChanged = false
      const trimBands = wall.trimBands.map((entry) => {
        const placed = placeTrimBandOnTopBareBand(wall, entry)
        if (placed) {
          bandsChanged = true
          return placed
        }
        return entry
      })
      if (!bandsChanged) return wall
      changed = true
      return { ...wall, trimBands }
    }),
  }))
  return changed ? { ...state, buildings } : state
}

function clampAlign(value: unknown): WallLabelAlign {
  if (value === 'left' || value === 'right') return value
  return 'center'
}

function clampDepth(value: unknown): WallLabelDepth {
  return value === 'extruded' ? 'extruded' : 'flat'
}

function clampHeightCm(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return DEFAULT_WALL_LABEL.heightCm
  return Math.max(STUDIO_MASONRY, Math.min(192, snapToGrid(value!, STUDIO_MASONRY)))
}

function clampExtrudeCm(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return DEFAULT_WALL_LABEL.extrudeCm
  return Math.max(0.5, Math.min(40, Math.round(value! * 10) / 10))
}

/** Vorstand vor der Fassade (cm); negativ = nach hinten/innen. */
function clampOffsetForward(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_WALL_LABEL.offsetForward
  return Math.max(-80, Math.min(80, Math.round(Number(value) * 10) / 10))
}

export function normalizeWallLabel(raw?: WallLabelConfig, wall?: Wall): WallLabelConfig {
  const heightCm = clampHeightCm(raw?.heightCm)
  const xRaw = Number.isFinite(raw?.x) ? Number(raw!.x) : (wall ? wall.width / 2 : DEFAULT_WALL_LABEL.x)
  const yRaw = Number.isFinite(raw?.y) ? Number(raw!.y) : (wall ? wall.height / 2 : DEFAULT_WALL_LABEL.y)
  let x = snapToGrid(xRaw, STUDIO_MASONRY)
  let y = snapToGrid(yRaw, STUDIO_MASONRY)
  if (wall) {
    x = Math.max(0, Math.min(wall.width, x))
    y = Math.max(0, Math.min(wall.height, y))
  }
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : createId(),
    enabled: Boolean(raw?.enabled),
    text: typeof raw?.text === 'string' ? raw.text : DEFAULT_WALL_LABEL.text,
    x,
    y,
    heightCm,
    color: typeof raw?.color === 'string' ? raw.color : undefined,
    finish: normalizeSurfaceFinish(raw?.finish),
    depth: clampDepth(raw?.depth),
    extrudeCm: clampExtrudeCm(raw?.extrudeCm),
    offsetForward: clampOffsetForward(raw?.offsetForward),
    align: clampAlign(raw?.align),
    fontId: resolveLabelFontId(raw?.fontId),
  }
}

/** Alle Schriften der Wand (`labels[]`, sonst Legacy `label`). */
export function wallLabels(wall: Wall): WallLabelConfig[] {
  if (Array.isArray(wall.labels) && wall.labels.length > 0) {
    return wall.labels.map((item) => normalizeWallLabel(item, wall))
  }
  if (wall.label) {
    const single = normalizeWallLabel(wall.label, wall)
    if (single.enabled || (single.text ?? '').trim()) return [single]
  }
  return []
}

export function wallLabel(wall: Wall, labelId?: string | null): WallLabelConfig {
  const all = wallLabels(wall)
  if (labelId) {
    const found = all.find((item) => item.id === labelId)
    if (found) return found
  }
  const active = all.find((item) => item.enabled && (item.text ?? '').trim())
  if (active) return active
  if (all[0]) return all[0]
  return normalizeWallLabel(wall.label, wall)
}

export function wallHasLabel(wall: Wall): boolean {
  return wallLabels(wall).some(
    (label) => label.enabled === true && (label.text ?? '').trim().length > 0,
  )
}

/** Sync: `labels` kanonisch, `label` = erste Schrift (Alt-Code/Toolbar). */
export function withWallLabels(wall: Wall, labels: WallLabelConfig[]): Wall {
  const normalized = labels.map((item) => normalizeWallLabel(item, wall))
  return {
    ...wall,
    labels: normalized,
    label: normalized[0] ?? { ...NEUTRAL_WALL_LABEL, id: createId() },
  }
}

export function findWallLabel(wall: Wall, labelId: string): WallLabelConfig | undefined {
  return wallLabels(wall).find((item) => item.id === labelId)
}

/**
 * Synthetische Öffnung für Hilfslinien/Abstände beim Schrift-Verschieben
 * (Anker + ungefähre Textbreite, damit Kanten/Mitte wie bei Fenstern snappen).
 */
export function labelAsGuideOpening(wall: Wall, labelId?: string | null): Opening | null {
  if (!wallHasLabel(wall)) return null
  const label = wallLabel(wall, labelId)
  if (!label.enabled || !(label.text ?? '').trim()) return null
  const text = (label.text ?? '').trim()
  const heightCm = clampHeightCm(label.heightCm)
  const width = Math.max(heightCm, Math.round(text.length * heightCm * 0.55))
  const anchorX = label.x ?? wall.width / 2
  const align = label.align ?? 'center'
  let x = anchorX
  if (align === 'center') x -= width / 2
  else if (align === 'right') x -= width
  return {
    id: label.id ? `__wall_label__${label.id}` : '__wall_label__',
    type: 'window',
    x: Math.max(0, Math.min(wall.width - width, x)),
    y: Math.max(0, Math.min(wall.height - heightCm, label.y ?? 0)),
    width,
    height: heightCm,
  }
}

/** Anker auf der geschlossenen Wandfläche (nicht in Tür/Fenster, oberhalb Sockel). */
export function suggestWallLabelAnchor(wall: Wall): { x: number; y: number } {
  const heightCm = clampHeightCm(wall.label?.heightCm)
  const plinth = wall.panel && studioPlinthActive(wall.panel) ? Math.max(0, wall.panel.plinthHeight ?? 0) : 0
  const minY = Math.min(wall.height, plinth + STUDIO_MASONRY)
  const maxY = Math.max(0, wall.height - heightCm)
  const openings = wall.openings.filter((opening) => !opening.hidden && openingCutsWall(opening))
  const hits = (x: number, y: number) =>
    openings.some(
      (opening) =>
        x >= opening.x &&
        x <= opening.x + opening.width &&
        y >= opening.y &&
        y + heightCm <= opening.y + opening.height,
    )
  const clampX = (x: number) => Math.max(0, Math.min(wall.width, snapToGrid(x, STUDIO_MASONRY)))
  const clampY = (y: number) => Math.max(0, Math.min(wall.height, snapToGrid(y, STUDIO_MASONRY)))
  const openingTop = openings.reduce((top, opening) => Math.max(top, opening.y + opening.height), minY)
  const bandY = clampY(Math.max(minY, Math.min(maxY, openingTop + STUDIO_MASONRY)))
  const edge = STUDIO_MASONRY * 4
  const candidates = [
    { x: edge, y: bandY },
    { x: wall.width - edge, y: bandY },
    { x: wall.width / 2, y: bandY },
    { x: edge, y: maxY },
    { x: wall.width - edge, y: maxY },
    { x: wall.width / 2, y: maxY },
    { x: edge, y: minY },
    { x: wall.width - edge, y: minY },
    { x: wall.width * 0.25, y: minY },
    { x: wall.width * 0.75, y: minY },
    { x: wall.width / 2, y: minY },
    { x: wall.width / 2, y: (minY + maxY) / 2 },
  ]
  for (const candidate of candidates) {
    const x = clampX(candidate.x)
    const y = clampY(Math.max(minY, Math.min(maxY, candidate.y)))
    if (!hits(x, y)) return { x, y }
  }
  return { x: clampX(wall.width / 2), y: clampY(Math.max(minY, wall.height / 2)) }
}

/** True wenn der Anker in einer wandschneidenden Öffnung liegt (Tür-/Fensterloch). */
export function labelAnchorInOpening(wall: Wall, x: number, y: number): boolean {
  return wall.openings.some(
    (opening) =>
      !opening.hidden &&
      openingCutsWall(opening) &&
      x >= opening.x &&
      x <= opening.x + opening.width &&
      y >= opening.y &&
      y <= opening.y + opening.height,
  )
}

/** Schiebt gespeicherte Anker aus Tür/Fenster auf die geschlossene Wandfläche. */
export function nudgeWallLabelOffOpenings(wall: Wall, label: WallLabelConfig): WallLabelConfig {
  const normalized = normalizeWallLabel(label, wall)
  const x = normalized.x ?? 0
  const y = normalized.y ?? 0
  if (!labelAnchorInOpening(wall, x, y)) return normalized
  const suggested = suggestWallLabelAnchor({ ...wall, label: normalized })
  return { ...normalized, x: suggested.x, y: suggested.y }
}

/**
 * Nackter Wandstreifen über den sichtbaren Paneel-Reihen (durch „Reihen oben ausblenden“).
 * Null wenn keine Paneele oder kein oberer Freistreifen.
 */
export function topBareBandForWall(
  wall: Wall,
): { yMin: number; yMax: number; height: number } | null {
  const panel = wall.panel
  if (!panel || panel.enabled === false || panel.pattern === 'none') return null
  const hideTop = Math.max(0, Math.floor(Number(panel.hideRowsTop) || 0))
  if (hideTop <= 0) return null
  const { lastVisibleRow, rowCuts } = visiblePanelRowRange(wall.height, panel)
  const yMin = rowCuts[lastVisibleRow + 1] ?? wall.height
  const yMax = wall.height
  const height = yMax - yMin
  if (height < STUDIO_MASONRY) return null
  return { yMin, yMax, height }
}

/** @deprecated Alias — bitte `topBareBandForWall` verwenden. */
export function topBareBandForLabel(
  wall: Wall,
): { yMin: number; yMax: number; height: number } | null {
  return topBareBandForWall(wall)
}

/**
 * Setzt die Schrift im oberen Freistreifen auf den Standard-Anker (Mitte, 64 cm unter der Oberkante).
 */
export function placeWallLabelOnTopBareBand(
  wall: Wall,
  label?: WallLabelConfig,
): WallLabelConfig | null {
  const normalized = normalizeWallLabel(label ?? wall.label, wall)
  if (!normalized.enabled || !(normalized.text ?? '').trim()) return null
  const band = topBareBandForWall(wall)
  if (!band) return null
  return placeWallLabelDefault(wall, normalized)
}

/** Verschiebt Zierbänder aus dem ausgeblendeten oberen Paneelstreifen auf die nackte Wand. */
export function placeTrimBandOnTopBareBand(
  wall: Wall,
  band?: WallTrimBand,
): WallTrimBand | null {
  const normalized = normalizeWallTrimBand(band ?? { id: '', enabled: true })
  if (normalized.enabled === false) return null
  const zone = topBareBandForWall(wall)
  if (!zone || normalized.yFromBottom < zone.yMin - 0.5) return null
  const yRaw =
    zone.height >= STUDIO_MASONRY * 2
      ? zone.yMin + zone.height / 2
      : Math.max(zone.yMin, wall.height - STUDIO_MASONRY)
  const yFromBottom = Math.max(
    zone.yMin,
    Math.min(wall.height, snapToGrid(yRaw, STUDIO_MASONRY)),
  )
  if (normalized.yFromBottom === yFromBottom) return null
  return { ...normalized, yFromBottom }
}

/** Verschiebt Beschriftungen und Zierbänder in den oberen Freistreifen, wo möglich. */
export function syncWallDecorToTopBareBand(state: FacadeState, wallIds: string[]): FacadeState {
  let next = syncWallLabelDefaultPlacement(state, wallIds)
  next = syncTrimBandsToTopBareBand(next, wallIds)
  return next
}

/** Verschiebt aktive Beschriftungen in den oberen Freistreifen, wo möglich. */
export function syncWallLabelsToTopBareBand(state: FacadeState, wallIds: string[]): FacadeState {
  return syncWallDecorToTopBareBand(state, wallIds)
}

export function updateWallLabel(
  state: FacadeState,
  wallIds: string[],
  patch: Partial<WallLabelConfig>,
  labelId?: string | null,
): FacadeState {
  const ids = new Set(wallIds)
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: building.walls.map((wall) => {
        if (!ids.has(wall.id)) return wall
        const existing = wallLabels(wall)
        if (existing.length === 0) {
          return withWallLabels(wall, [
            normalizeWallLabel(
              { ...NEUTRAL_WALL_LABEL, ...patch, enabled: patch.enabled ?? true },
              wall,
            ),
          ])
        }
        const targetId = labelId ?? existing[0]?.id
        const next = existing.map((item) =>
          item.id === targetId ? normalizeWallLabel({ ...item, ...patch }, wall) : item,
        )
        return withWallLabels(wall, next)
      }),
    })),
  }
}

/** Fügt eine Schrift hinzu (Kopie / Paste); versetzt Anker, wenn schon Schriften da sind. */
export function addWallLabel(
  state: FacadeState,
  wallId: string,
  source: Partial<WallLabelConfig>,
  opts?: { at?: { x: number; y: number } },
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: building.walls.map((wall) => {
        if (wall.id !== wallId) return wall
        const existing = wallLabels(wall)
        let x = opts?.at?.x
        let y = opts?.at?.y
        if (x === undefined || y === undefined) {
          const base = normalizeWallLabel({ ...source, enabled: true }, wall)
          x = base.x ?? wall.width / 2
          y = base.y ?? wall.height / 2
          if (existing.length > 0) {
            x = Math.min(wall.width, x + WALL_LABEL_PASTE_OFFSET)
            y = Math.max(0, y - WALL_LABEL_PASTE_OFFSET)
          }
        }
        const added = normalizeWallLabel(
          {
            ...source,
            id: createId(),
            enabled: true,
            x,
            y,
          },
          wall,
        )
        return withWallLabels(wall, [...existing, added])
      }),
    })),
  }
}

export function removeWallLabel(
  state: FacadeState,
  wallId: string,
  labelId?: string | null,
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: building.walls.map((wall) => {
        if (wall.id !== wallId) return wall
        const existing = wallLabels(wall)
        if (existing.length === 0) return wall
        if (!labelId || existing.length === 1) {
          return withWallLabels(wall, [])
        }
        return withWallLabels(
          wall,
          existing.filter((item) => item.id !== labelId),
        )
      }),
    })),
  }
}

function stateWithoutWallLabels(state: FacadeState): unknown {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      walls: building.walls.map((wall) => {
        const { label: _label, labels: _labels, ...rest } = wall
        return rest
      }),
    })),
  }
}

/** True wenn sich nur `wall.label` geändert hat — kein Paneel-/Wand-Rebuild nötig. */
export function facadeStateDiffersOnlyByWallLabels(prev: FacadeState, next: FacadeState): boolean {
  if (JSON.stringify(stateWithoutWallLabels(prev)) !== JSON.stringify(stateWithoutWallLabels(next))) {
    return false
  }
  return JSON.stringify(prev) !== JSON.stringify(next)
}
