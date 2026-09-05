import type { EditorState, FacadeState } from '../types/facade'
import type { EditScope } from '../studio/editScope'
import { normalizeFacadeYawFilter } from '../studio/editScope'
import {
  DEFAULT_BLOOM_SETTINGS,
  isBloomSettings,
  normalizeBloomSettings,
  type BloomSettings,
} from '../lighting/bloom'
import {
  DEFAULT_FOG_SETTINGS,
  isFogSettings,
  normalizeFogSettings,
  type FogSettings,
} from '../lighting/fog'
import {
  DEFAULT_LOD_SETTINGS,
  isLodSettings,
  normalizeLodSettings,
  type LodSettings,
} from '../lighting/lodSettings'
// FacadeState wird für die floors-Typisierung benötigt (wird oben importiert)
import { getAllWalls } from './buildings'
import { clampFacadeState } from './walls'
import { FACADE_SCHEMA_VERSION } from './schemaMigrations'
import { applyFacadeLoadPipeline } from './facadeLoad'
import {
  DEFAULT_SUN_SETTINGS,
  isSunSettings,
  normalizeSunSettings,
  type SunSettings,
} from './sunLighting'
const STORAGE_KEY = 'fassaden-builder-state-v6'

export type AppView = 'front' | '3d' | 'top' | 'export'

export interface SceneAppearance {
  background: string
  ground: string
  skyReflection: string
  /** Multiplikator für Linienstärke im Stil „Zeichnung“ (2D-SVG und 3D-Kanten). */
  lineStrokeScale: number
}

/** Neutral-Studio-Tagesbeige — siehe `STUDIO_DAY_BEIGE` in `studioStage.ts`. */
export const DEFAULT_SCENE_APPEARANCE: SceneAppearance = {
  background: '#E8E3DD',
  ground: '#E8E3DD',
  skyReflection: '#E8E3DD',
  lineStrokeScale: 1,
}

/** Alte Defaults — gelten als nicht vom Nutzer überschrieben und werden migriert. */
export const PREVIOUS_SKY_REFLECTION_DEFAULTS = ['#ffffff', '#3a6084', '#555555'] as const
export const PREVIOUS_BACKGROUND_DEFAULTS = ['#ffffff', '#555555'] as const
export const PREVIOUS_GROUND_DEFAULTS = ['#ffffff', '#555555'] as const

function normalizeLineStrokeScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SCENE_APPEARANCE.lineStrokeScale
  return Math.min(3, Math.max(0.25, n))
}

export interface PersistedAppState {
  schemaVersion?: number
  facade: FacadeState
  editor: EditorState
  view: AppView
  sun?: SunSettings
  editScope?: EditScope
  /** Bei Scope „Fassade“: gefilterte Yaws; null/fehlt = alle Hausseiten. */
  editFacadeYawFilter?: number[] | null
  scene?: SceneAppearance
  bloom?: BloomSettings
  fog?: FogSettings
  lod?: LodSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFloorPlanArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every(
    (item) => isRecord(item) && Array.isArray(item.nodes) && Array.isArray(item.edges),
  )
}

function isFacadeState(value: unknown): value is FacadeState | Record<string, unknown> {
  if (!isRecord(value)) return false
  if (Array.isArray(value.buildings) && value.buildings.length > 0) return true
  if (Array.isArray(value.walls) && typeof value.wallHeight === 'number') return true
  return false
}

function isEditorState(value: unknown): value is EditorState {
  if (!isRecord(value)) return false
  return (
    Array.isArray(value.selectedWallIds) &&
    Array.isArray(value.selectedOpenings) &&
    Array.isArray(value.selectedEdges)
  )
}

function normalizeView(view: unknown): AppView {
  if (view === '3d') return '3d'
  if (view === 'front') return 'front'
  if (view === 'top') return 'top'
  if (view === 'export') return 'export'
  // Legacy: früherer Grundriss-Tab
  if (view === 'plan') return 'top'
  // Legacy: frühere „Bearbeiten“-Ansicht und „2d“ → 2D-Aufriss
  if (view === 'edit' || view === '2d') return 'front'
  return 'front'
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function normalizeSceneAppearance(value: unknown): SceneAppearance {
  if (!isRecord(value)) return { ...DEFAULT_SCENE_APPEARANCE }
  const bgRaw = isHexColor(value.background) ? value.background : undefined
  const groundRaw = isHexColor(value.ground) ? value.ground : undefined
  const skyRaw = isHexColor(value.skyReflection) ? value.skyReflection : undefined
  const wasOld = (raw: string | undefined, prev: readonly string[]) =>
    raw != null && prev.some((item) => item.toLowerCase() === raw.toLowerCase())
  return {
    background:
      wasOld(bgRaw, PREVIOUS_BACKGROUND_DEFAULTS) || bgRaw == null
        ? DEFAULT_SCENE_APPEARANCE.background
        : bgRaw,
    ground:
      wasOld(groundRaw, PREVIOUS_GROUND_DEFAULTS) || groundRaw == null
        ? DEFAULT_SCENE_APPEARANCE.ground
        : groundRaw,
    skyReflection:
      wasOld(skyRaw, PREVIOUS_SKY_REFLECTION_DEFAULTS) || skyRaw == null
        ? DEFAULT_SCENE_APPEARANCE.skyReflection
        : skyRaw,
    lineStrokeScale: normalizeLineStrokeScale(value.lineStrokeScale),
  }
}

export function loadPersistedState(): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return loadLegacyPersistedState()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (!isFacadeState(parsed.facade) || !isEditorState(parsed.editor)) return null
    const schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 7
    const migrated = applyFacadeLoadPipeline(parsed.facade as FacadeState, schemaVersion)
    let facade = migrated.facade
    if (getAllWalls(facade).length === 0) {
      const legacyBackup = loadLegacyPersistedState()
      if (legacyBackup && getAllWalls(legacyBackup.facade).length > 0) {
        facade = legacyBackup.facade
      }
    }
    const rawFacade = parsed.facade as Record<string, unknown>
    if (isFloorPlanArray(rawFacade.floors) && facade.buildings.length === 1) {
      facade.buildings[0].floors = rawFacade.floors as FacadeState['buildings'][0]['floors']
      facade = clampFacadeState(facade)
    }
    const scene = normalizeSceneAppearance(parsed.scene)
    return {
      schemaVersion: migrated.schemaVersion,
      facade,
      editor: {
        selectedWallIds: [...parsed.editor.selectedWallIds],
        selectedOpenings: parsed.editor.selectedOpenings.map((ref) => ({ ...ref })),
        selectedEdges: [...parsed.editor.selectedEdges],
        selectedSceneLightId:
          typeof parsed.editor.selectedSceneLightId === 'string'
            ? parsed.editor.selectedSceneLightId
            : undefined,
        selectedSceneLightIds: Array.isArray(parsed.editor.selectedSceneLightIds)
          ? parsed.editor.selectedSceneLightIds.filter((id): id is string => typeof id === 'string')
          : undefined,
      },
      view: normalizeView(parsed.view),
      sun: isSunSettings(parsed.sun)
        ? normalizeSunSettings(parsed.sun)
        : { ...DEFAULT_SUN_SETTINGS },
      editScope:
        parsed.editScope === 'element' ||
        parsed.editScope === 'type' ||
        parsed.editScope === 'floor' ||
        parsed.editScope === 'facade'
          ? parsed.editScope
          : undefined,
      editFacadeYawFilter: normalizeFacadeYawFilter(parsed.editFacadeYawFilter),
      scene,
      bloom: isBloomSettings(parsed.bloom)
        ? normalizeBloomSettings(parsed.bloom)
        : { ...DEFAULT_BLOOM_SETTINGS },
      fog: isFogSettings(parsed.fog) ? normalizeFogSettings(parsed.fog) : { ...DEFAULT_FOG_SETTINGS },
      lod: isLodSettings(parsed.lod) ? normalizeLodSettings(parsed.lod) : { ...DEFAULT_LOD_SETTINGS },
    }
  } catch {
    return null
  }
}

function loadLegacyPersistedState(): PersistedAppState | null {
  try {
    const raw =
      localStorage.getItem('fassaden-builder-state-v5') ??
      localStorage.getItem('fassaden-builder-state-v4')
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (!isFacadeState(parsed.facade) || !isEditorState(parsed.editor)) return null
    const migrated = applyFacadeLoadPipeline(parsed.facade as FacadeState, 6)
    return {
      schemaVersion: migrated.schemaVersion,
      facade: migrated.facade,
      editor: {
        selectedWallIds: [...parsed.editor.selectedWallIds],
        selectedOpenings: parsed.editor.selectedOpenings.map((ref) => ({ ...ref })),
        selectedEdges: [...parsed.editor.selectedEdges],
      },
      view: normalizeView(parsed.view),
      sun: { ...DEFAULT_SUN_SETTINGS },
    }
  } catch {
    return null
  }
}

export function savePersistedState(state: PersistedAppState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, schemaVersion: FACADE_SCHEMA_VERSION }),
    )
  } catch {
    // Quota or private mode — ignore silently.
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('fassaden-builder-state-v4')
  } catch {
    // ignore
  }
}
