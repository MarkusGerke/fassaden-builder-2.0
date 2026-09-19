import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from './constants'
import {
  courseBandAtLocalY,
  courseFromStaging,
  createDefaultCourseStaging,
  findCourseAtLocalY,
  normalizeCourseOverrides,
  removeCourseOverride,
  rotateCourseStaging,
  updateWallCourseOverride,
  upsertCourseOverride,
} from './masonryCourseEditor'
import { layoutPanelTiles, layoutTilesForCourseOverride } from './panelLayout'
import { patternCoursePhaseCount } from './constants'

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
  it('patternCoursePhaseCount spiegelt Verbands-Lagen', () => {
    expect(patternCoursePhaseCount('strip')).toBe(1)
    expect(patternCoursePhaseCount('runningBond')).toBe(2)
    expect(patternCoursePhaseCount('runningBondThird')).toBe(3)
    expect(patternCoursePhaseCount('dutchBond')).toBe(4)
  })

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
    expect(s.projectDepth).toBeGreaterThan(0)
    const r = rotateCourseStaging(s)
    expect(r.panelWidth).toBe(24)
    expect(r.panelHeight).toBe(48)
    expect(r.rotated90).toBe(true)
    expect(r.projectDepth).toBe(s.projectDepth)
    expect(r.coursePhase).toBe(s.coursePhase)
  })

  it('coursePhase ändert den Versatz bei Läuferverband', () => {
    const wall = studioWall({ id: 'w1', width: 192, height: 192 })
    const base = wall.panel!
    const even = layoutTilesForCourseOverride(
      wall,
      base,
      {
        y: 48,
        height: 24,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 24,
        coursePhase: 0,
      },
      [],
    )
    const odd = layoutTilesForCourseOverride(
      wall,
      base,
      {
        y: 48,
        height: 24,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 24,
        coursePhase: 1,
      },
      [],
    )
    expect(even.length).toBeGreaterThan(0)
    expect(odd.length).toBeGreaterThan(0)
    // Versatzlage startet mit Halbstein (gleiche x=0, andere Breite).
    expect(even[0]!.width).toBeGreaterThan(odd[0]!.width + 1)
    expect(odd.length).toBeGreaterThan(even.length)
  })

  it('courseFromStaging speichert Tiefe, Bossen, Keil und Verband-Ebene', () => {
    const staging = {
      ...createDefaultCourseStaging('englishBond'),
      projectDepth: 6,
      coursePhase: 1,
      colorStage: 2,
      taperDepth: 1,
      taper: 0.7,
      taperSides: 'lr' as const,
    }
    const course = courseFromStaging({ y: 24, height: 24 }, staging)
    expect(course.projectDepth).toBe(6)
    expect(course.coursePhase).toBe(1)
    expect(course.colorStage).toBe(2)
    expect(course.taperDepth).toBe(1)
    expect(course.taper).toBe(0.7)
    expect(course.taperSides).toBe('lr')
  })

  it('courseBandAtLocalY trifft die Modulreihe', () => {
    const wall = studioWall({ id: 'w1', width: 192, height: 240 })
    const band = courseBandAtLocalY(wall, 30, 24, [])
    expect(band).not.toBeNull()
    expect(band!.height).toBe(24)
    expect(band!.y).toBe(24)
  })

  it('findCourseAtLocalY trifft gesetzte Schicht', () => {
    const wall = studioWall({
      id: 'w1',
      width: 192,
      height: 192,
      courseOverrides: [
        {
          y: 48,
          height: 24,
          pattern: 'runningBond',
          panelWidth: 48,
          panelHeight: 24,
          coursePhase: 1,
        },
      ],
    })
    const hit = findCourseAtLocalY(wall, 55)
    expect(hit).not.toBeNull()
    expect(hit!.coursePhase).toBe(1)
    expect(findCourseAtLocalY(wall, 10)).toBeNull()
  })

  it('removeCourseOverride entfernt das Band', () => {
    const list = removeCourseOverride(
      [
        {
          y: 0,
          height: 24,
          pattern: 'strip',
          panelWidth: 64,
          panelHeight: 24,
        },
        {
          y: 48,
          height: 24,
          pattern: 'runningBond',
          panelWidth: 48,
          panelHeight: 24,
        },
      ],
      { y: 48, height: 24 },
    )
    expect(list).toHaveLength(1)
    expect(list[0]!.pattern).toBe('strip')
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

  it('updateWallCourseOverride belässt pattern none — nur Override-Reihen', () => {
    const wall = studioWall({
      id: 'w1',
      width: 192,
      height: 192,
      panel: normalizeStudioPanel({
        ...DEFAULT_STUDIO_PANEL,
        pattern: 'none',
        enabled: false,
      }),
    })
    const course = courseFromStaging(
      { y: 128, height: 8 },
      { ...createDefaultCourseStaging('headerBond'), panelWidth: 24, panelHeight: 8 },
    )
    const next = updateWallCourseOverride(
      { buildings: [{ id: 'b1', name: 't', wallHeight: 448, walls: [wall], floors: [] }] } as never,
      ['w1'],
      course,
    )
    const w = next.buildings[0]!.walls[0]!
    expect(w.panel?.pattern).toBe('none')
    expect(w.courseOverrides).toHaveLength(1)
    const tiles = layoutPanelTiles(w, w.panel!, [])
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThan(80)
    expect(tiles.every((t) => t.y >= 128 - 1 && t.y + t.height <= 136 + 1)).toBe(true)
  })
})
