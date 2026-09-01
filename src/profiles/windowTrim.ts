import type { ProfileRenderContext } from './types'

const NS = 'http://www.w3.org/2000/svg'

/** Profil-IDs, die Fensterprofil-Steuerungen (Verschieben, Drehen, Ecke) nutzen. */
export const WINDOW_TRIM_PROFILE_IDS = [
  'fensterprofil32x120',
  'fensterprofil35x130',
  'fensterprofil40x140',
] as const
export type WindowTrimProfileId = (typeof WINDOW_TRIM_PROFILE_IDS)[number]

/** Umlaufendes Rahmenprofil an Öffnungskanten (Toolbar „Rahmenprofil“). */
export const FRAME_PROFILE_IDS = [
  'fensterprofil32x120',
  'fensterprofil35x130',
  'fensterprofil40x140',
] as const
export type FrameProfileId = (typeof FRAME_PROFILE_IDS)[number]
export const DEFAULT_FRAME_PROFILE_ID: FrameProfileId = 'fensterprofil32x120'

export function isFrameProfile(profileId: string): profileId is FrameProfileId {
  return (FRAME_PROFILE_IDS as readonly string[]).includes(profileId)
}

export function isWindowTrimProfile(profileId: string): profileId is WindowTrimProfileId {
  return (WINDOW_TRIM_PROFILE_IDS as readonly string[]).includes(profileId)
}

/** Verdachungs-Querschnitte (Fensterverdachung-Feature, nicht Kanten-Profil). */
export const PEDIMENT_PROFILE_IDS = [
  'fensterprofil32x120',
  'fensterprofil35x130',
  'fensterprofil40x140',
] as const
export type PedimentProfileId = (typeof PEDIMENT_PROFILE_IDS)[number]
export const DEFAULT_PEDIMENT_PROFILE_ID: PedimentProfileId = 'fensterprofil40x140'

/** Konsolen-Querschnitte unter den Verdachungsenden. */
export const PEDIMENT_CONSOLE_IDS = ['traufgesims70x150', 'sockelprofil'] as const
export type PedimentConsoleId = (typeof PEDIMENT_CONSOLE_IDS)[number]
export const DEFAULT_PEDIMENT_CONSOLE_ID: PedimentConsoleId = 'traufgesims70x150'

/** Fensterbank außen — eigenständige Profil-Kategorie. */
export const SILL_OUTER_PROFILE_IDS = [
  'fensterprofil32x120',
  'fensterprofil35x130',
  'fensterprofil40x140',
] as const
export type SillOuterProfileId = (typeof SILL_OUTER_PROFILE_IDS)[number]

/** Gesims-Profile (Studio-Wand und Modul-Wand) — nur SVG-Traufgesimse. */
export const CORNICE_PROFILE_IDS = [
  'traufgesims70x150',
  'traufgesims110x135',
  'traufgesims200x200',
] as const
export type CorniceProfileId = (typeof CORNICE_PROFILE_IDS)[number]
export const DEFAULT_CORNICE_PROFILE_ID: CorniceProfileId = 'traufgesims70x150'

/** Sockelprofil-Querschnitte (SVG 19×196). */
export const PLINTH_PROFILE_IDS = ['sockelprofil'] as const
export type PlinthProfileId = (typeof PLINTH_PROFILE_IDS)[number]
export const DEFAULT_PLINTH_PROFILE_ID: PlinthProfileId = 'sockelprofil'

export function isPlinthProfile(profileId: string): profileId is PlinthProfileId {
  return (PLINTH_PROFILE_IDS as readonly string[]).includes(profileId)
}

/** Dachziegel-Querschnitt (Dach-Toolbar). */
export const ROOF_TILE_PROFILE_IDS = ['projecting', 'classical'] as const
export type RoofTileProfileId = (typeof ROOF_TILE_PROFILE_IDS)[number]

export function isSillOuterProfile(profileId: string): profileId is SillOuterProfileId {
  return (SILL_OUTER_PROFILE_IDS as readonly string[]).includes(profileId)
}

export function isCorniceProfile(profileId: string): profileId is CorniceProfileId {
  return (CORNICE_PROFILE_IDS as readonly string[]).includes(profileId)
}

export function isPedimentProfile(profileId: string): profileId is PedimentProfileId {
  return (PEDIMENT_PROFILE_IDS as readonly string[]).includes(profileId)
}

export function isPedimentConsoleProfile(profileId: string): profileId is PedimentConsoleId {
  return (PEDIMENT_CONSOLE_IDS as readonly string[]).includes(profileId)
}

function createSvgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag)
}

export function renderTrimBand(
  parent: SVGGElement,
  context: ProfileRenderContext,
  depth: number,
  fill = '#d5c8a8',
  stroke = '#9a7f52',
) {
  const { edge, length, x, y } = context
  const vertical = edge === 'left' || edge === 'right'
  const rect = createSvgEl('rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(vertical ? depth : length))
  rect.setAttribute('height', String(vertical ? length : depth))
  rect.setAttribute('fill', fill)
  rect.setAttribute('stroke', stroke)
  rect.setAttribute('stroke-width', '0.6')
  parent.appendChild(rect)
}
