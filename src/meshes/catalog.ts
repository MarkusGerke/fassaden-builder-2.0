import profile48 from '../assets/profiles/profile-48x192.glb?url'
import profile96 from '../assets/profiles/profile-96x192.glb?url'
import profile144 from '../assets/profiles/profile-144x192.glb?url'
import cladding96v1 from '../assets/cladding/cladding-96x416-48x192-v1.glb?url'
import cladding192_48v1 from '../assets/cladding/cladding-192x416-48x192-v1.glb?url'
import cladding192_96v1 from '../assets/cladding/cladding-192x416-96x192-v1.glb?url'
import cladding192_144v1 from '../assets/cladding/cladding-192x416-144x192-v1.glb?url'
import cladding96v2 from '../assets/cladding/cladding-96x416-48x192-v2.glb?url'
import cladding192_48v2 from '../assets/cladding/cladding-192x416-48x192-v2.glb?url'
import cladding192_96v2 from '../assets/cladding/cladding-192x416-96x192-v2.glb?url'
import { BLENDER_PANELS, panelId } from '../blender/panelModules'
import { getWallModule } from '../blender/wallModules'
import type { Wall } from '../types/facade'
import {
  WALL_HEIGHT,
  WINDOW_HEIGHT,
  CLADDING_OFFSET_V1,
  CLADDING_OFFSET_V2,
  CLADDING_OFFSET_V2_RECESS,
} from '../constants/presets'

export interface ProfileMeshSpec {
  width: number
  height: number
  url: string
}

export interface CladdingSpec {
  id: string
  moduleName: string
  variant: 'v1' | 'v2'
  wallWidth: number
  wallHeight: number
  openingWidth: number
  openingHeight: number
  offsetOutward: number
  url?: string
  label: string
}

export const WINDOW_PROFILE_MODELS: ProfileMeshSpec[] = [
  { width: 48, height: WINDOW_HEIGHT, url: profile48 },
  { width: 96, height: WINDOW_HEIGHT, url: profile96 },
  { width: 144, height: WINDOW_HEIGHT, url: profile144 },
]

const CLADDING_GLB: Partial<Record<string, string>> = {
  '3-96x416-48x192-v1': cladding96v1,
  '3-96x416-48x192-v2': cladding96v2,
  '4-192x416-48x192-v1': cladding192_48v1,
  '4-192x416-48x192-v2': cladding192_48v2,
  '4-192x416-96x192-v1': cladding192_96v1,
  '4-192x416-96x192-v2': cladding192_96v2,
  '4-192x416-144x192-v1': cladding192_144v1,
}

function primaryWindowSize(moduleName: string): { width: number; height: number } | undefined {
  const module = getWallModule(moduleName)
  const opening = module?.openings.find((item) => item.type === 'window')
  if (!opening) return undefined
  return { width: opening.width, height: opening.height }
}

export const CLADDING_MODELS: CladdingSpec[] = BLENDER_PANELS.map((panel) => {
  const id = panelId(panel.moduleName, panel.variant)
  const opening = primaryWindowSize(panel.moduleName)
  const module = getWallModule(panel.moduleName)
  return {
    id,
    moduleName: panel.moduleName,
    variant: panel.variant,
    wallWidth: module?.width ?? 0,
    wallHeight: WALL_HEIGHT,
    openingWidth: opening?.width ?? 0,
    openingHeight: opening?.height ?? WINDOW_HEIGHT,
    offsetOutward:
      panel.variant === 'v1'
        ? CLADDING_OFFSET_V1
        : CLADDING_OFFSET_V2 - CLADDING_OFFSET_V2_RECESS,
    url: CLADDING_GLB[id],
    label: id,
  }
})

export function windowModelKey(width: number, height: number): string {
  return `${width}x${height}`
}

export function matchingCladdings(wall: Wall): CladdingSpec[] {
  if (!wall.moduleName) return []
  return CLADDING_MODELS.filter((spec) => spec.moduleName === wall.moduleName)
}

function claddingVariant(id: string | undefined): 'v1' | 'v2' | undefined {
  if (!id) return undefined
  if (id === 'v2' || id.endsWith('-v2')) return 'v2'
  if (id === 'v1' || id.endsWith('-v1')) return 'v1'
  return undefined
}

export function resolveCladding(wall: Wall): CladdingSpec | undefined {
  const matches = matchingCladdings(wall)
  if (matches.length === 0 || wall.claddingId === 'none') return undefined
  if (wall.claddingId) {
    const exact = matches.find((spec) => spec.id === wall.claddingId)
    if (exact) return exact
    const variant = claddingVariant(wall.claddingId)
    if (variant) {
      const byVariant = matches.find((spec) => spec.variant === variant)
      if (byVariant) return byVariant
    }
  }
  return matches.find((spec) => spec.variant === 'v1') ?? matches[0]
}
