import type { OpeningCutoutShape, OpeningFill } from '../types/facade'

export const GRID_SIZE = 8

export const WALL_WIDTH_PRESETS = [96, 192, 384, 576] as const
export const WALL_HEIGHT = 448
export const WALL_DEPTH = 32

/** Bibliotheks-Presets: Wandlänge in cm (Vielfache des 48-cm-Grundrissrasters). */
export interface WallLengthPreset {
  id: string
  label: string
  lengthCm: number
}

export const WALL_LENGTH_PRESETS: WallLengthPreset[] = [
  { id: 'wall-96', label: 'Wand 96', lengthCm: 96 },
  { id: 'wall-192', label: 'Wand 192', lengthCm: 192 },
  { id: 'wall-384', label: 'Wand 384', lengthCm: 384 },
  { id: 'wall-576', label: 'Wand 576', lengthCm: 576 },
]

export type EndPieceHand = 'left' | 'right'

export interface WallEndPiecePreset extends WallLengthPreset {
  hand: EndPieceHand
}

/** Endstück 48: L-Form, Außenseite vorne + links bzw. vorne + rechts. */
export const WALL_END_PIECE_PRESETS: WallEndPiecePreset[] = [
  { id: 'wall-end-48-left', label: 'Endstück 48 links', lengthCm: 48, hand: 'left' },
  { id: 'wall-end-48-right', label: 'Endstück 48 rechts', lengthCm: 48, hand: 'right' },
]


export interface WallWithOpeningPreset {
  id: string
  label: string
  lengthCm: number
  opening: {
    type: 'window' | 'door'
    width: number
    height: number
  }
}

/** Wände mit mittiger Standardöffnung (Bibliothek Tab Wände). */
export const WALL_WITH_OPENING_PRESETS: WallWithOpeningPreset[] = [
  {
    id: 'wall-192-window-96',
    label: 'Wand 192 + Fenster',
    lengthCm: 192,
    opening: { type: 'window', width: 96, height: 192 },
  },
  {
    id: 'wall-192-door-96',
    label: 'Wand 192 + Tür',
    lengthCm: 192,
    opening: { type: 'door', width: 96, height: 320 },
  },
  {
    id: 'wall-384-window-144',
    label: 'Wand 384 + Fenster',
    lengthCm: 384,
    opening: { type: 'window', width: 144, height: 192 },
  },
  {
    id: 'wall-384-door-96',
    label: 'Wand 384 + Tür',
    lengthCm: 384,
    opening: { type: 'door', width: 96, height: 320 },
  },
]

export function endPieceHandFromPresetId(id: string): EndPieceHand | null {
  if (id === 'wall-end-48-left' || id === 'wall-end-48') return 'left'
  if (id === 'wall-end-48-right') return 'right'
  return null
}
/** Sichtbarer Boden-/View-Rand rund um die Wände (cm). */
export const GROUND_MARGIN = 384

export const WINDOW_WIDTH_PRESETS = [48, 96, 144, 192, 288, 396] as const
export const WINDOW_HEIGHT = 192
export const WINDOW_SILL_Y = 128
export const WINDOW_RECESS = 24

/** Fenster schwebt beim Verschieben so weit vor der Außenfläche (cm), ohne Schatten-Neuberechnung. */
export const OPENING_DRAG_FLOAT_CM = 48
/** Standard-Vorstand aller Fensterprofile (cm, − = nach innen). */
export const WINDOW_TRIM_DEFAULT_OFFSET_FORWARD = -4
/** Zusatz-Versatz zur 24-cm-Laibung (cm, + = nach außen, 0 = Front in der Laibung). */
export const DEFAULT_WINDOW_DEPTH_OFFSET = 0
export const CLADDING_OFFSET_V1 = 4
export const CLADDING_OFFSET_V2 = 9.5
/** Paneele v2 um 8 cm nach hinten (Z) gegenüber dem bisherigen Stand. */
export const CLADDING_OFFSET_V2_RECESS = 8
/** Fenster-/Türprofil bei Paneele v2 um 4 cm nach außen. */
export const PROFILE_OFFSET_CLASSICAL_V2 = 4

export const DOOR_WIDTH_PRESETS = [96, 144, 288, 480] as const
export const DOOR_HEIGHT = 320

export type WallWidthPreset = (typeof WALL_WIDTH_PRESETS)[number]
export type WindowWidthPreset = (typeof WINDOW_WIDTH_PRESETS)[number]
export type DoorWidthPreset = (typeof DOOR_WIDTH_PRESETS)[number]

export interface WallOpeningPreset {
  id: string
  label: string
  type: 'door' | 'window' | 'cutout' | 'conch'
  width: number
  height: number
  y?: number
  basementWindow?: boolean
  cutoutShape?: OpeningCutoutShape
  fill?: OpeningFill
}

export const WALL_OPENING_PRESETS: WallOpeningPreset[] = [
  {
    id: 'window-48',
    label: 'Fenster 48×192',
    type: 'window',
    width: 48,
    height: WINDOW_HEIGHT,
  },
  {
    id: 'window-48-96',
    label: 'Fenster 48×96',
    type: 'window',
    width: 48,
    height: 96,
  },
  {
    id: 'window-96-128',
    label: 'Fenster 96×128',
    type: 'window',
    width: 96,
    height: 128,
  },
  {
    id: 'window-96',
    label: 'Fenster 96×192',
    type: 'window',
    width: 96,
    height: WINDOW_HEIGHT,
  },
  {
    id: 'window-96-264',
    label: 'Fenster 96×264',
    type: 'window',
    width: 96,
    height: 264,
  },
  {
    id: 'window-144',
    label: 'Fenster 144×192',
    type: 'window',
    width: 144,
    height: WINDOW_HEIGHT,
  },
  {
    id: 'window-192',
    label: 'Fenster 192×192',
    type: 'window',
    width: 192,
    height: 192,
  },
  {
    id: 'window-396-196',
    label: 'Fenster 396×196',
    type: 'window',
    width: 396,
    height: 196,
  },
  {
    id: 'window-basement-48',
    label: 'Kellerfenster 48×64',
    type: 'window',
    width: 48,
    height: 64,
    y: 0,
    basementWindow: true,
  },
  {
    id: 'door-96',
    label: 'Tür 96×320',
    type: 'door',
    width: 96,
    height: DOOR_HEIGHT,
  },
  {
    id: 'door-144',
    label: 'Tür 144×320',
    type: 'door',
    width: 144,
    height: DOOR_HEIGHT,
  },
  {
    id: 'door-288',
    label: 'Tür 288×320',
    type: 'door',
    width: 288,
    height: DOOR_HEIGHT,
  },
  {
    id: 'door-480',
    label: 'Tür 480×320',
    type: 'door',
    width: 480,
    height: DOOR_HEIGHT,
  },
  {
    id: 'cutout-niche-32x48',
    label: 'Nische 32×48',
    type: 'cutout',
    width: 32,
    height: 48,
    y: WINDOW_SILL_Y,
    cutoutShape: 'rect',
    fill: { mode: 'niche', nicheDepthCm: 8 },
  },
  {
    id: 'cutout-niche-24-round',
    label: 'Nische rund 24',
    type: 'cutout',
    width: 24,
    height: 24,
    y: WINDOW_SILL_Y,
    cutoutShape: 'round',
    fill: { mode: 'niche', nicheDepthCm: 8 },
  },
  {
    id: 'conch-96x128',
    label: 'Konche 96×128',
    type: 'conch',
    width: 96,
    height: 128,
    y: WINDOW_SILL_Y,
    fill: { mode: 'niche', nicheDepthCm: 48 },
  },
  {
    id: 'conch-64x96',
    label: 'Konche 64×96',
    type: 'conch',
    width: 64,
    height: 96,
    y: WINDOW_SILL_Y,
    fill: { mode: 'niche', nicheDepthCm: 32 },
  },
  {
    id: 'cutout-downpipe-16x192',
    label: 'Regenrohr 16×192',
    type: 'cutout',
    width: 16,
    height: 192,
    y: 0,
    cutoutShape: 'round',
    fill: { mode: 'niche', nicheDepthCm: 8 },
  },
  {
    id: 'cutout-through-16',
    label: 'Durchbruch 16×16',
    type: 'cutout',
    width: 16,
    height: 16,
    y: WINDOW_SILL_Y,
    cutoutShape: 'rect',
    fill: { mode: 'opening' },
  },
  {
    id: 'cutout-through-32-round',
    label: 'Durchbruch rund 32',
    type: 'cutout',
    width: 32,
    height: 32,
    y: WINDOW_SILL_Y,
    cutoutShape: 'round',
    fill: { mode: 'opening' },
  },
]

export const ALL_EDGES = ['top', 'right', 'bottom', 'left'] as const
export const JOIN_OVERLAP = 0.2
/** SVG-Wandverschieben: gleiches Raster wie Plan/3D (`PLAN_GRID` = 48 cm). */
export const WALL_MOVE_SNAP = 48
export const FLUSH_TOLERANCE = 48
