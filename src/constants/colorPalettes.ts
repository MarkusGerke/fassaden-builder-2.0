export const DEFAULT_WALL_COLOR = '#ffffff'
/** Mörtel zwischen Paneelsteinen. */
export const DEFAULT_JOINT_COLOR = '#c8c0b8'
/** Innenwandfläche (Raumseite). */
export const DEFAULT_INTERIOR_COLOR = '#ffffff'
/** Decke und Fußboden-Platte. */
export const DEFAULT_CEILING_COLOR = '#ffffff'
/** Alte Decken-/Boden-Fallbacks vor v0.7.246. */
export const PREVIOUS_CEILING_COLOR_DEFAULTS = ['#9a8a7a', '#8a7a6a'] as const
export const DEFAULT_CLADDING_COLOR_V1 = '#ffffff'
export const DEFAULT_CLADDING_COLOR_V2 = '#ffffff'
export const DEFAULT_FRAME_COLOR = '#ffffff'
export const DEFAULT_DOOR_COLOR = '#ffffff'
export const DEFAULT_GLASS_COLOR = 'transparent'
export const DEFAULT_PROFILE_COLOR = '#ffffff'

export const WALL_COLORS = ['#ffffff', '#f5f5f5', '#e0e0e0', '#f0e6d8', '#e8dcc8', '#4a4a4a'] as const
export const CLADDING_COLORS = ['#ffffff', '#cccccc', '#e8dcc8', '#c4704b', '#6b705c', '#4a4a4a'] as const
export const FRAME_COLORS = ['#ffffff', '#4a4a4a', '#6b4f3a', '#1a1a1a', '#2d4a3e'] as const
export const TRANSPARENT_GLASS = 'transparent'
export const GLASS_COLORS = [TRANSPARENT_GLASS, '#6fa3c4', '#a8d4e6', '#87ceeb', '#4a6a7a', '#c8e6f5'] as const

export function isTransparentGlass(color: string | undefined): boolean {
  return color === TRANSPARENT_GLASS || color === 'none' || color === '#00000000'
}
export const PROFILE_COLORS = ['#ffffff', '#f5f1e6', '#d4c4a8', '#9e9e9e', '#4a3728'] as const

export type ColorPalette = 'wall' | 'cladding' | 'frame' | 'glass' | 'profile'

export function paletteColors(kind: ColorPalette): readonly string[] {
  switch (kind) {
    case 'wall':
      return WALL_COLORS
    case 'cladding':
      return CLADDING_COLORS
    case 'frame':
      return FRAME_COLORS
    case 'glass':
      return GLASS_COLORS
    case 'profile':
      return PROFILE_COLORS
  }
}

export function defaultCladdingColor(variant: 'v1' | 'v2' | undefined): string {
  return variant === 'v2' ? DEFAULT_CLADDING_COLOR_V2 : DEFAULT_CLADDING_COLOR_V1
}

export function defaultOpeningFrameColor(type: 'door' | 'window' | 'cutout' | 'conch'): string {
  return type === 'door' ? DEFAULT_DOOR_COLOR : DEFAULT_FRAME_COLOR
}
