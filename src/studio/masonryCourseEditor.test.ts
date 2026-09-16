import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from './constants'
import {
  courseBandAtLocalY,
  courseFromStaging,
  createDefaultCourseStaging,
  normalizeCourseOverrides,
  rotateCourseStaging,
  upsertCourseOverride,
} from './masonryCourseEditor'
import { layoutPanelTiles } from './panelLayout'

function studioWall(partial: Partial<Wall> & Pick<Wall, 'id' | 'width' | 'height'>): Wall {
  return {
    kind: 'studio',
    x: 0,
    y: 0,
    depth: 32,
    openings: [],
    profiles: [],
    neighbors: {},
    panel: normalizeStudioPanel({ ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', panelWidth: 48, panelHeight: 24 }),
    ...partial,
  } as Wall
}

describe('masonryCourseEditor', () => {
  it('normalizeCourseOverrides filtert none und sortiert nach Y', () => {
    const list = normalizeCourseOverrides([
      {
        y: 48,
        height: 24,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 24,
      },
      {
        y: 0,
        height: 24,
        pattern: 'headerBond',
        panelWidth: 24,
        panelHeight: 8,
        colorStage: 3,
      },
      {
        y: 96,
        height: 24,
        pattern: 'none',
        panelWidth: 48,
        panelHeight: 24,
      },
    ])
    expect(list).toHaveLength(2)
    expect(list[0]!.y).toBe(0)
    expect(list[0]!.colorStage).toBe(3)
    expect(list[1]!.pattern).toBe('runningBond')
  })

  it('rotateCourseStaging tauscht Breite und Höhe', () => {
    const s = createDefaultCourseStaging('runningBond')
    expect(s.panelWidth).toBe(48)
    expect(s.panelHeight).toBe(24)
    const r = rotateCourseStaging(s)
    expect(r.panelWidth).toBe(24)
    expect(r.panelHeight).toBe(48)
    expect(r.rotated90).toBe(true)
  })

  it('courseBandAtLocalY trifft die Modulreihe', () => {
    const wall = studioWall({ id: 'w1', width: 192, height: 240 })
    const band = courseBandAtLocalY(wall, 30, 24, [])
    expect(band).not.toBeNull()
    expect(band!.height).toBe(24)
    expect(band!.y).toBe(24)
  })

  it('layoutPanelTiles ersetzt nur das Override-Band', () => {
    const wall = studioWall({
      id: 'w1',
      width: 192,
      height: 192,
      courseOverrides: [
        {
          y: 48,
          height: 24,
          pattern: 'headerBond',
          panelWidth: 24,
          panelHeight: 24,
          colorStage: 2,
        },
      ],
    })
    const panel = wall.panel!
    const tiles = layoutPanelTiles(wall, panel, [])
    const inBand = tiles.filter((t) => t.y >= 48 - 0.1 && t.y + t.height <= 72 + 0.1)
    const outside = tiles.filter((t) => t.y + t.height <= 48 + 0.1 || t.y >= 72 - 0.1)
    expect(inBand.length).toBeGreaterThan(0)
    expect(inBand.every((t) => t.colorStage === 2)).toBe(true)
    expect(outside.some((t) => t.width >= 40)).toBe(true)
  })

  it('upsertCourseOverride ersetzt überlappende Bänder', () => {
    const a = courseFromStaging({ y: 0, height: 24 }, createDefaultCourseStaging('runningBond'))
    const b = courseFromStaging(
      { y: 0, height: 24 },
      { ...createDefaultCourseStaging('headerBond'), colorStage: 1 },
    )
    const list = upsertCourseOverride([a], b)
    expect(list).toHaveLength(1)
    expect(list[0]!.pattern).toBe('headerBond')
    expect(list[0]!.colorStage).toBe(1)
  })
})
