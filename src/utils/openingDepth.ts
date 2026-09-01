import { WINDOW_RECESS } from '../constants/presets'
import type { Opening } from '../types/facade'
import { effectiveOpeningDepthOffset, openingRevealInset } from './openingGeometry'

/** Frontlage der Verglasung in cm ab Wand-Außenkante (Standard-Laibung 24 cm + Offset). */
export function openingFacadeDepthCm(opening: Opening, buildingOffset?: number): number {
  return WINDOW_RECESS + effectiveOpeningDepthOffset(opening, buildingOffset)
}

/** Speichert `Opening.depthOffset` aus gewünschter Frontlage (cm ab Außenkante). */
export function depthOffsetFromFacadeDepthCm(facadeDepthCm: number, opening: Opening): number {
  return facadeDepthCm - WINDOW_RECESS + openingRevealInset(opening)
}

/** Gebäude-Default als Frontlage (cm). */
export function buildingFacadeDepthCm(buildingOffset?: number): number {
  return WINDOW_RECESS + (buildingOffset ?? 0)
}

/** Gebäude-`windowDepthOffset` aus Frontlage. */
export function buildingDepthOffsetFromFacadeDepthCm(facadeDepthCm: number): number {
  return facadeDepthCm - WINDOW_RECESS
}

export function openingUsesCustomDepth(opening: Opening): boolean {
  return opening.depthOffset !== undefined
}
