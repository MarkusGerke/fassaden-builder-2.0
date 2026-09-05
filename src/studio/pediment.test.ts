import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  pedimentFormPoints,
  pedimentGableLayout,
  pedimentOutlineWallXy,
  normalizeOpeningPediment,
} from '../studio/pediment'
import { buildPedimentProfilePaths } from './pedimentGeometry'
import { openingTopProfileLiftCm, pedimentBaseLiftCm } from './openingProfileLift'
import { DEFAULT_STUDIO_PANEL } from './constants'

function opening(width = 96): Opening {
  return {
    id: 'win-1',
    type: 'window',
    x: 144,
    y: 96,
    width,
    height: 192,
  }
}

function wallWith(openingItem: Opening, profiles: Wall['profiles'] = []): Wall {
  return {
    id: 'w',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 1000,
    height: 544,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [openingItem],
    profiles,
    neighbors: emptyNeighbors(),
    panel: { ...DEFAULT_STUDIO_PANEL, enabled: true },
  }
}

describe('pediment gable layout', () => {
  it('spannt Öffnungsbreite plus Überstand ohne Horizontalen', () => {
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'triangleClosed',
      overhang: 8,
      gableWidth: 0,
      sideArmWidth: 0,
      gableHeight: 24,
    })
    const win = opening(96)
    const layout = pedimentGableLayout(win, ped)
    expect(layout.x1 - layout.x0).toBe(96 + 16)
    expect(layout.gableLeft).toBe(layout.x0)
    expect(layout.gableRight).toBe(layout.x1)
    expect(layout.x0).toBe(win.x - 8)
    expect(layout.x1).toBe(win.x + win.width + 8)
  })

  it('offenes Dreieck mit Horizontalen setzt Seitenarme', () => {
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'triangle',
      overhang: 8,
      gableWidth: 40,
      sideArmWidth: 16,
      gableHeight: 24,
    })
    const win = opening(96)
    const layout = pedimentGableLayout(win, ped)
    const pts = pedimentFormPoints('triangle', layout)
    expect(layout.gableRight - layout.gableLeft).toBe(40)
    expect(layout.x0).toBe(layout.gableLeft - 16)
    expect(layout.x1).toBe(layout.gableRight + 16)
    expect(pts[0]?.x).toBe(layout.x0)
    expect(pts[pts.length - 1]?.x).toBe(layout.x1)
    expect(pts.length).toBeGreaterThan(3)
  })

  it('geschlossenes Dreieck ist ein Dreieck über der Fensterbreite inkl. Überstand', () => {
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'triangleClosed',
      overhang: 8,
      gableHeight: 24,
    })
    const win = opening()
    const outline = pedimentOutlineWallXy(win, ped)
    expect(outline).toHaveLength(3)
    expect(outline[0]?.x).toBe(win.x - 8)
    expect(outline[2]?.x).toBe(win.x + win.width + 8)
  })

  it('hebt die Basis um das obere Öffnungsprofil', () => {
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'straight',
      overhang: 0,
    })
    const win = opening()
    const without = pedimentGableLayout(win, ped, 0)
    const withLift = pedimentGableLayout(win, ped, 14)
    expect(withLift.yBase).toBe(without.yBase + 14)
  })
})

describe('closed pediment sweep paths', () => {
  it('führt geschlossenes Dreieck als Closed-Loop mit Außen-Normalen', () => {
    const win = opening(144)
    const wall = wallWith(win)
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'triangleClosed',
      profileId: 'fensterprofil40x140',
      overhang: 8,
      gableHeight: 48,
    })
    const paths = buildPedimentProfilePaths(wall, win, ped)
    expect(paths).toHaveLength(1)
    expect(paths[0]?.closed).toBe(true)
    expect(paths[0]?.points.length).toBe(3)
    const outward = paths[0]!.outward
    expect(outward).toHaveLength(3)
    expect(outward[2]!.y).toBeLessThan(0)
    expect(outward[0]!.x).toBeLessThan(0)
    expect(outward[1]!.x).toBeGreaterThan(0)
  })

  it('führt geschlossenes Segment als Bogen plus Sturz nach außen', () => {
    const win = opening(144)
    const wall = wallWith(win)
    const ped = normalizeOpeningPediment({
      enabled: true,
      form: 'segmentClosed',
      profileId: 'fensterprofil40x140',
      overhang: 8,
      gableHeight: 48,
    })
    const paths = buildPedimentProfilePaths(wall, win, ped)
    expect(paths).toHaveLength(2)
    expect(paths.every((path) => path.closed === false)).toBe(true)
    expect(paths[1]!.outward[0]!.y).toBeLessThan(0)
  })
})

describe('opening top profile lift', () => {
  it('liefert 0 ohne Sturzprofil', () => {
    const win = opening()
    expect(openingTopProfileLiftCm(wallWith(win), win)).toBe(0)
  })

  it('nimmt die Outward-Höhe des oberen Fensterprofils', () => {
    const win = opening()
    const wall = wallWith(win, [
      { openingId: win.id, profileId: 'fensterprofil40x140', edge: 'top' },
    ])
    const lift = openingTopProfileLiftCm(wall, win)
    expect(lift).toBeGreaterThan(8)
  })

  it('addiert den Nutzer-Versatz zum Sturzprofil', () => {
    const win = opening()
    const wall = wallWith(win, [
      { openingId: win.id, profileId: 'fensterprofil40x140', edge: 'top' },
    ])
    const ped = normalizeOpeningPediment({ enabled: true, offsetUp: 8 })
    const combined = pedimentBaseLiftCm(wall, win, ped)
    expect(combined).toBe(openingTopProfileLiftCm(wall, win) + 8)
  })

  it('lässt negativen Versatz unter den Sturz', () => {
    const win = opening()
    const wall = wallWith(win, [
      { openingId: win.id, profileId: 'fensterprofil40x140', edge: 'top' },
    ])
    const ped = normalizeOpeningPediment({ enabled: true, offsetUp: -16 })
    expect(ped.offsetUp).toBe(-16)
    const lift = openingTopProfileLiftCm(wall, win)
    expect(pedimentBaseLiftCm(wall, win, ped)).toBe(lift - 16)
    const layout = pedimentGableLayout(win, ped, pedimentBaseLiftCm(wall, win, ped))
    expect(layout.yBase).toBe(win.y + win.height + lift - 16)
  })

  it('nutzt extentOutCm des Rahmenprofils als Lift', () => {
    const win = opening()
    win.trim = { extentOutCm: 24, scale: 1 }
    const wall = wallWith(win, [
      { openingId: win.id, profileId: 'fensterprofil40x140', edge: 'top' },
    ])
    expect(openingTopProfileLiftCm(wall, win)).toBe(24)
  })
})
