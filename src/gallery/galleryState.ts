import {
  WALL_DEPTH,
  WALL_HEIGHT,
  WINDOW_SILL_Y,
  type WallOpeningPreset,
} from '../constants/presets'
import { buildBayWindowWalls, type BayWindowPreset } from '../studio/bayWindow'
import {
  DEFAULT_STUDIO_PANEL,
  normalizeStudioPanel,
  PATTERN_LABELS,
} from '../studio/constants'
import { DEFAULT_ROOF } from '../studio/roof'
import { createStudioWall, normalizeStudioWall } from '../studio/walls'
import type { FacadeState, Opening, StudioPanelPattern, Wall } from '../types/facade'
import { createBuilding } from '../utils/buildings'
import { createId } from '../utils/id'
import { createOpening } from '../utils/openings'
import { OPENING_MIN_GAP } from '../utils/validation'
import {
  buildGallerySections,
  galleryWallLengths,
  type GallerySection,
} from './galleryCatalog'
import {
  buildGalleryRandomSpecs,
  GALLERY_RANDOM_COUNT,
  type GalleryRandomSpec,
} from './galleryRandom'
import { clampGallerySpacingCm, GALLERY_SPACING_DEFAULT_CM } from './gallerySpacing'

export interface BuildGalleryOptions {
  spacingCm?: number
  randomSeed?: number
  randomCount?: number
}

function panelForPattern(pattern: StudioPanelPattern) {
  return normalizeStudioPanel({
    ...DEFAULT_STUDIO_PANEL,
    pattern,
    enabled: pattern !== 'none',
  })
}

function makeGalleryWall(opts: {
  originX: number
  originZ: number
  width: number
  pattern: StudioPanelPattern
  label?: string
}): Wall {
  const base = createStudioWall(opts.originX, 0)
  return normalizeStudioWall({
    ...base,
    id: createId(),
    width: opts.width,
    height: WALL_HEIGHT,
    depth: WALL_DEPTH,
    originX: opts.originX,
    originZ: opts.originZ,
    x: opts.originX,
    yawDeg: 0,
    panelFlip: true,
    planLinked: false,
    panel: panelForPattern(opts.pattern),
    openings: [],
    profiles: [],
    label: opts.label
      ? {
          enabled: true,
          text: opts.label,
          heightCm: 16,
          x: 8,
          y: WALL_HEIGHT - 28,
          align: 'left',
          color: '#333333',
          depth: 'flat',
        }
      : undefined,
  })
}

function openingFitsWall(preset: WallOpeningPreset, wallWidth: number): boolean {
  return preset.width + OPENING_MIN_GAP * 2 <= wallWidth
}

function applyOpeningPreset(wall: Wall, preset: WallOpeningPreset): Wall {
  if (!openingFitsWall(preset, wall.width)) return wall
  let opening = createOpening(preset.type, preset.width, preset.height, wall)
  if (preset.type === 'cutout' || preset.type === 'conch') {
    opening = {
      ...opening,
      y: preset.y ?? opening.y,
      cutoutShape: preset.cutoutShape ?? (preset.type === 'conch' ? 'round' : 'rect'),
      fill: preset.fill ?? { mode: 'niche', nicheDepthCm: 8 },
      ...(preset.type === 'conch'
        ? {
            arch: {
              enabled: true,
              form: 'round' as const,
              riseCm: Math.min(preset.width / 2, preset.height),
            },
          }
        : {}),
    }
  }
  if (preset.type === 'window' && preset.basementWindow) {
    opening = {
      ...opening,
      y: preset.y ?? 0,
      basementWindow: { enabled: true, grilleHeight: 0.5 },
      sillInner: opening.sillInner ? { ...opening.sillInner, enabled: false } : undefined,
      sillOuter: opening.sillOuter ? { ...opening.sillOuter, enabled: false } : undefined,
    }
  } else if (preset.y != null) {
    opening = { ...opening, y: preset.y }
  } else if (preset.type === 'window' && opening.y === 0) {
    opening = { ...opening, y: WINDOW_SILL_Y }
  }
  return { ...wall, openings: [opening as Opening] }
}

function appendBayAssembly(
  walls: Wall[],
  originX: number,
  originZ: number,
  parentWidth: number,
  pattern: StudioPanelPattern,
  bay: BayWindowPreset,
): { walls: Wall[]; usedWidth: number; usedDepth: number } {
  const parent = makeGalleryWall({
    originX,
    originZ,
    width: parentWidth,
    pattern,
  })
  const built = buildBayWindowWalls(parent, bay)
  if (!built) {
    walls.push(parent)
    return { walls, usedWidth: parentWidth, usedDepth: WALL_DEPTH }
  }
  walls.push(built.parent, ...built.walls)
  return {
    walls,
    usedWidth: Math.max(parentWidth, bay.frontWidthCm),
    usedDepth: WALL_DEPTH + bay.depthCm,
  }
}

function placeRow(
  spacing: number,
  placeCells: (push: (cellWidth: number, cellDepth: number, placeAt: (x: number) => void) => void) => void,
): { maxDepth: number } {
  let cursorX = 0
  let maxDepth = WALL_DEPTH
  let first = true
  placeCells((cellWidth, cellDepth, placeAt) => {
    if (!first) cursorX += spacing
    first = false
    placeAt(cursorX)
    cursorX += cellWidth
    maxDepth = Math.max(maxDepth, cellDepth)
  })
  return { maxDepth }
}

function appendPatternRow(
  walls: Wall[],
  section: GallerySection,
  originZ: number,
  spacing: number,
): number {
  const pattern = section.pattern ?? 'none'
  const lengths = galleryWallLengths()
  const { maxDepth } = placeRow(spacing, (push) => {
    for (const len of lengths) {
      push(len.lengthCm, WALL_DEPTH, (x) => {
        walls.push(
          makeGalleryWall({
            originX: x,
            originZ,
            width: len.lengthCm,
            pattern,
            label: `${PATTERN_LABELS[pattern]} · ${len.lengthCm}`,
          }),
        )
      })
    }
  })
  return maxDepth
}

function appendOpeningRow(
  walls: Wall[],
  section: GallerySection,
  originZ: number,
  spacing: number,
): number {
  const preset = section.openingPreset
  if (!preset) return WALL_DEPTH
  const pattern = section.pattern ?? 'strip'
  const lengths = galleryWallLengths().filter((len) => openingFitsWall(preset, len.lengthCm))
  if (lengths.length === 0) return WALL_DEPTH
  const { maxDepth } = placeRow(spacing, (push) => {
    for (const len of lengths) {
      push(len.lengthCm, WALL_DEPTH, (x) => {
        const wall = applyOpeningPreset(
          makeGalleryWall({
            originX: x,
            originZ,
            width: len.lengthCm,
            pattern,
            label: `${preset.label} · ${len.lengthCm}`,
          }),
          preset,
        )
        walls.push(wall)
      })
    }
  })
  return maxDepth
}

function appendBayRow(
  walls: Wall[],
  section: GallerySection,
  originZ: number,
  spacing: number,
): number {
  const bay = section.bayPreset
  if (!bay) return WALL_DEPTH
  const pattern = section.pattern ?? 'strip'
  // Parent etwas breiter als Front, damit Erker andocken kann.
  const parentWidth = Math.max(bay.frontWidthCm + 64, galleryWallLengths()[0]?.lengthCm ?? 192)
  const { maxDepth } = placeRow(spacing, (push) => {
    push(parentWidth, WALL_DEPTH + bay.depthCm, (x) => {
      appendBayAssembly(walls, x, originZ, parentWidth, pattern, bay)
    })
  })
  return maxDepth
}

function appendRandomRow(
  walls: Wall[],
  originZ: number,
  spacing: number,
  specs: GalleryRandomSpec[],
): number {
  let maxDepth = WALL_DEPTH
  const { maxDepth: rowDepth } = placeRow(spacing, (push) => {
    for (const spec of specs) {
      if (spec.kind === 'bay' && spec.bayPreset) {
        const parentWidth = Math.max(spec.lengthCm, spec.bayPreset.frontWidthCm + 64)
        push(parentWidth, WALL_DEPTH + spec.bayPreset.depthCm, (x) => {
          const result = appendBayAssembly(
            walls,
            x,
            originZ,
            parentWidth,
            spec.pattern,
            spec.bayPreset!,
          )
          maxDepth = Math.max(maxDepth, result.usedDepth)
        })
        continue
      }
      push(spec.lengthCm, WALL_DEPTH, (x) => {
        let wall = makeGalleryWall({
          originX: x,
          originZ,
          width: spec.lengthCm,
          pattern: spec.pattern,
          label: `Zufall · ${spec.lengthCm}`,
        })
        if (spec.kind === 'opening' && spec.openingPreset) {
          wall = applyOpeningPreset(wall, spec.openingPreset)
        }
        walls.push(wall)
      })
    }
  })
  return Math.max(maxDepth, rowDepth)
}

export function buildGalleryFacadeState(options: BuildGalleryOptions = {}): {
  state: FacadeState
  randomSeed: number
  spacingCm: number
} {
  const spacingCm = clampGallerySpacingCm(options.spacingCm ?? GALLERY_SPACING_DEFAULT_CM)
  const randomSeed = options.randomSeed ?? 1
  const randomCount = options.randomCount ?? GALLERY_RANDOM_COUNT
  const sections = buildGallerySections()
  const walls: Wall[] = []
  let originZ = 0
  let firstRow = true

  for (const section of sections) {
    if (!firstRow) originZ += spacingCm
    firstRow = false

    let rowDepth = WALL_DEPTH
    if (section.kind === 'pattern') {
      rowDepth = appendPatternRow(walls, section, originZ, spacingCm)
    } else if (section.kind === 'opening') {
      rowDepth = appendOpeningRow(walls, section, originZ, spacingCm)
    } else if (section.kind === 'bay') {
      rowDepth = appendBayRow(walls, section, originZ, spacingCm)
    } else if (section.kind === 'random') {
      const specs = buildGalleryRandomSpecs(randomSeed, randomCount)
      rowDepth = appendRandomRow(walls, originZ, spacingCm, specs)
    }

    // Nächste Reihe hinter der aktuellen (inkl. Erker-Tiefe).
    originZ += Math.max(0, rowDepth - WALL_DEPTH)
  }

  const building = createBuilding({
    id: createId(),
    name: 'Galerie',
    walls: walls.map((wall) => ({ ...wall, planLinked: false })),
    wallHeight: WALL_HEIGHT,
    wallDepth: WALL_DEPTH,
    roof: { ...DEFAULT_ROOF, enabled: false },
  })

  const state: FacadeState = {
    buildings: [building],
    activeBuildingId: building.id,
    viewOptions: { showCeiling: false, showIntermediateFloors: false },
    siteYawDeg: 0,
  }

  return { state, randomSeed, spacingCm }
}
