import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, PLAN_DIAGONAL_STEP } from './constants'
import { layoutPanelTiles, masonryPatternCuts, panelCourseCount, visiblePanelRowRect } from './panelLayout'
import { WALL_DEPTH } from '../constants/presets'
import { panelMiterEnds, studioPanelFaceLocalZ } from './walls'
import { studioMiterLocalX } from './wallMiterX'

function studioWall(partial: Partial<Wall> & { id: string }): Wall {
  return {
    id: partial.id,
    kind: 'studio',
    x: 0,
    y: 0,
    width: partial.width ?? 384,
    height: partial.height ?? 128,
    depth: WALL_DEPTH,
    originX: partial.originX ?? 0,
    originZ: partial.originZ ?? 0,
    yawDeg: partial.yawDeg ?? 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panel: partial.panel ?? {
      ...DEFAULT_STUDIO_PANEL,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
    },
    ...partial,
  }
}

describe('hide panel rows', () => {
  it('zählt Schichten aus Wandhöhe und Paneelhöhe', () => {
    expect(panelCourseCount(456, { ...DEFAULT_STUDIO_PANEL, plinthEnabled: false, plinthHeight: 0 })).toBe(15)
  })

  it('blendet unterste Reihe aus', () => {
    const wall = studioWall({ id: 'wall-1', height: 128 })
    const panel = { ...DEFAULT_STUDIO_PANEL, plinthEnabled: false, plinthHeight: 0, hideRowsBottom: 1, hideRowsTop: 0 }
    const tiles = layoutPanelTiles(wall, panel)
    const courseCount = panelCourseCount(wall.height, panel)
    expect(tiles.length).toBe(courseCount - 1)
    expect(tiles.every((tile) => tile.y >= 32 - 1e-6)).toBe(true)
  })

  it('blendet oberste Reihe aus', () => {
    const wall = studioWall({ id: 'wall-1', height: 128 })
    const panel = { ...DEFAULT_STUDIO_PANEL, plinthEnabled: false, plinthHeight: 0, hideRowsBottom: 0, hideRowsTop: 1 }
    const tiles = layoutPanelTiles(wall, panel)
    const courseCount = panelCourseCount(wall.height, panel)
    expect(tiles.length).toBe(courseCount - 1)
    const maxTop = Math.max(...tiles.map((tile) => tile.y + tile.height))
    expect(maxTop).toBeLessThan(wall.height - 1e-6)
  })

  it('liefert Mörtel-Band nur für sichtbare Reihen', () => {
    const wall = studioWall({ id: 'wall-1', height: 128 })
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      plinthEnabled: false,
      plinthHeight: 0,
      hideRowsBottom: 1,
      hideRowsTop: 1,
    }
    const band = visiblePanelRowRect(wall, panel)
    expect(band).toEqual({ x: 0, y: 32, width: 384, height: 64 })
  })

  it('zwei persistierte Zonen: 48 unten / 24 oben per rect', () => {
    const lower = {
      ...DEFAULT_STUDIO_PANEL,
      plinthEnabled: false,
      plinthHeight: 0,
      panelWidth: 48,
      panelHeight: 32,
      pattern: 'runningBond' as const,
    }
    const upper = {
      ...DEFAULT_STUDIO_PANEL,
      plinthEnabled: false,
      plinthHeight: 0,
      panelWidth: 24,
      panelHeight: 32,
      pattern: 'runningBond' as const,
    }
    const wall = studioWall({
      id: 'multi-zone',
      height: 256,
      width: 384,
      panel: lower,
      claddingZones: [
        {
          id: 'lo',
          kind: 'bond',
          front: 'flat',
          rect: { x: 0, y: 0, width: 384, height: 128 },
          panel: lower,
        },
        {
          id: 'hi',
          kind: 'bond',
          front: 'flat',
          rect: { x: 0, y: 128, width: 384, height: 128 },
          panel: upper,
        },
      ],
    })
    const tiles = layoutPanelTiles(wall, lower, [wall])
    const lo = tiles.filter((t) => t.y + t.height <= 128 + 1e-6)
    const hi = tiles.filter((t) => t.y >= 128 - 1e-6)
    expect(lo.length).toBeGreaterThan(0)
    expect(hi.length).toBeGreaterThan(0)
    expect(Math.max(...lo.map((t) => t.width))).toBeGreaterThan(40)
    expect(Math.max(...hi.map((t) => t.width))).toBeLessThan(30)
    expect(Math.min(...hi.map((t) => t.y))).toBeGreaterThanOrEqual(128 - 1)
  })
})

function tilesStayInWall(tiles: { x: number; width: number }[], wall: { width: number }) {
  return tiles.every((tile) => tile.x >= -0.05 && tile.x + tile.width <= wall.width + 0.05)
}

function frontTileWidth(wall: Wall, tile: { x: number; width: number }, walls: Wall[] = [wall]): number {
  const z = studioPanelFaceLocalZ(wall)
  const miter = panelMiterEnds(wall, walls)
  const x0 = studioMiterLocalX(wall, tile.x, z, miter.start, miter.end)
  const x1 = studioMiterLocalX(wall, tile.x + tile.width, z, miter.start, miter.end)
  return x1 - x0
}

describe('dock half merge', () => {
  const panelBase = {
    ...DEFAULT_STUDIO_PANEL,
    pattern: 'runningBond' as const,
    panelWidth: 48,
    panelHeight: 32,
    plinthEnabled: false,
    plinthHeight: 0,
    cornerJoin: 'miter' as const,
  }

  function dockedWalls(endBossEnd: 'full' | 'half', endBossStart: 'full' | 'half') {
    const left = studioWall({
      id: 'left',
      width: 384,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase, endBossEnd },
    })
    const right = studioWall({
      id: 'right',
      width: 384,
      height: 128,
      originX: 384,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase, endBossStart },
    })
    return { left, right, walls: [left, right] }
  }

  function jointTileWidths(wall: Wall, walls: Wall[], side: 'end' | 'start') {
    const tiles = layoutPanelTiles(wall, wall.panel!, walls)
    const header = 24
    const joint =
      side === 'end'
        ? tiles.filter((tile) => Math.abs(tile.x + tile.width - wall.width) < 0.6)
        : tiles.filter((tile) => tile.x < 0.6)
    return { header, widths: joint.map((tile) => tile.width) }
  }

  it('führt volle Endsteine an der Dock-Fuge nicht zu Doppelsteinen', () => {
    const { left, right, walls } = dockedWalls('full', 'full')
    const leftJoint = jointTileWidths(left, walls, 'end')
    const rightJoint = jointTileWidths(right, walls, 'start')
    const maxW = Math.max(...leftJoint.widths, ...rightJoint.widths)
    expect(maxW).toBeLessThanOrEqual(leftJoint.header * 2 + 1)
  })

  it('führt halbe Endsteine an der Dock-Fuge visuell zusammen (Chamfer 0, ohne Überstand)', () => {
    const { left, right, walls } = dockedWalls('half', 'half')
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const rightTiles = layoutPanelTiles(right, right.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(tilesStayInWall(rightTiles, right)).toBe(true)
    const oddLeft = leftTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && Math.abs(tile.x + tile.width - left.width) < 0.6,
    )
    const oddRight = rightTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && tile.x < 0.6,
    )
    expect(oddLeft.length).toBeGreaterThan(0)
    expect(oddRight.length).toBeGreaterThan(0)
    expect(oddLeft.every((tile) => tile.flattenDockEnd === true)).toBe(true)
    expect(oddRight.every((tile) => tile.flattenDockStart === true)).toBe(true)
  })

  it('verlängert volle Endsteine nicht in eine Nachbarwand mit Reststein', () => {
    const panelBase = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 48,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
      endBossEnd: 'full' as const,
      endBossStart: 'off' as const,
    }
    const left = studioWall({
      id: 'left',
      width: 384,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase, endBossEnd: 'off', endBossStart: 'off' },
    })
    const right = studioWall({
      id: 'right',
      width: 23,
      height: 128,
      originX: 384,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase, endBossEnd: 'off', endBossStart: 'off' },
    })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const rightTiles = layoutPanelTiles(right, right.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(tilesStayInWall(rightTiles, right)).toBe(true)
  })

  it('verbindet zwei 1er-Steine an der Dock-Fuge nicht zu einem Doppelstein', () => {
    const panelBase = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    const left = studioWall({
      id: 'left',
      width: 192,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const right = studioWall({
      id: 'right',
      width: 192,
      height: 128,
      originX: 192,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const rightTiles = layoutPanelTiles(right, right.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(tilesStayInWall(rightTiles, right)).toBe(true)
    const evenLeftEnd = leftTiles.filter(
      (tile) => Math.abs(tile.y - 0.4) < 1 && tile.x + tile.width >= left.width - 2,
    )
    expect(evenLeftEnd.every((tile) => tile.x + tile.width <= left.width + 0.5)).toBe(true)
    expect(evenLeftEnd.every((tile) => tile.keepBossChamferEnd === true)).toBe(true)
    for (const tile of evenLeftEnd) {
      expect(tile.width).toBeLessThan(32 * 1.5)
    }
    const evenRightStart = rightTiles.filter(
      (tile) => Math.abs(tile.y - 0.4) < 1 && tile.x < 0.6,
    )
    expect(evenRightStart.every((tile) => tile.keepBossChamferStart === true)).toBe(true)
  })

  it('setzt bei 0,5+0,5 den Innenseiten-Chamfer auf 0 — Kacheln bleiben in der Wand', () => {
    const panelBase = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    const left = studioWall({
      id: 'left',
      width: 192,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const right = studioWall({
      id: 'right',
      width: 192,
      height: 128,
      originX: 192,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const rightTiles = layoutPanelTiles(right, right.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(tilesStayInWall(rightTiles, right)).toBe(true)
    const oddLeftEnd = leftTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && Math.abs(tile.x + tile.width - left.width) < 0.6,
    )
    const oddRightStart = rightTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && tile.x < 0.6,
    )
    expect(oddLeftEnd.length).toBeGreaterThan(0)
    expect(oddRightStart.length).toBeGreaterThan(0)
    expect(oddLeftEnd.every((tile) => tile.flattenDockEnd === true)).toBe(true)
    expect(oddRightStart.every((tile) => tile.flattenDockStart === true)).toBe(true)
    for (const tile of [...oddLeftEnd, ...oddRightStart]) {
      expect(tile.width).toBeLessThan(32 * 0.75)
    }
  })

  it('glättet 0,5er auch wenn die Versatzlage Restbreite auf die Köpfe verteilt', () => {
    const panelBase = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 48,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    const left = studioWall({
      id: 'left',
      width: 400,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const right = studioWall({
      id: 'right',
      width: 400,
      height: 128,
      originX: 400,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const rightTiles = layoutPanelTiles(right, right.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(tilesStayInWall(rightTiles, right)).toBe(true)
    const oddLeftEnd = leftTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && Math.abs(tile.x + tile.width - left.width) < 0.6,
    )
    const oddRightStart = rightTiles.filter(
      (tile) => Math.abs(tile.y - 32.4) < 1 && tile.x < 0.6,
    )
    expect(oddLeftEnd.every((tile) => tile.flattenDockEnd === true)).toBe(true)
    expect(oddRightStart.every((tile) => tile.flattenDockStart === true)).toBe(true)
  })

  it('ragt nicht über eine Öffnung der Nachbarwand', () => {
    const panelBase = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    const left = studioWall({
      id: 'left',
      width: 192,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
    })
    const right = studioWall({
      id: 'right',
      width: 192,
      height: 128,
      originX: 192,
      originZ: 0,
      yawDeg: 0,
      panel: { ...panelBase },
      openings: [
        {
          id: 'win',
          type: 'window',
          x: 0,
          y: 32,
          width: 64,
          height: 64,
        },
      ],
    })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    expect(tilesStayInWall(leftTiles, left)).toBe(true)
    expect(leftTiles.every((tile) => tile.x + tile.width <= left.width + 0.05)).toBe(true)
  })
})

function courseTiles(
  tiles: ReturnType<typeof layoutPanelTiles>,
  rowIndex: number,
  panelHeight = 32,
  joint = 0.8,
) {
  const y = rowIndex * panelHeight + joint / 2
  return tiles.filter((tile) => Math.abs(tile.y - y) < 1).sort((a, b) => a.x - b.x)
}

function firstWidthsDiffer(even: { width: number }[], odd: { width: number }[], minDelta: number) {
  expect(even.length).toBeGreaterThan(0)
  expect(odd.length).toBeGreaterThan(0)
  expect(Math.abs(even[0]!.width - odd[0]!.width)).toBeGreaterThan(minDelta)
}

describe('bond stagger when panel width changes', () => {
  const panelAt = (pattern: 'runningBond' | 'runningBondThird' | 'headerBond', panelWidth: number) => ({
    ...DEFAULT_STUDIO_PANEL,
    pattern,
    panelWidth,
    panelHeight: 32,
    plinthEnabled: false,
    plinthHeight: 0,
    cornerJoin: 'miter' as const,
  })

  it('hält den Läuferverband-Versatz auf einer Wand bei geänderter Steinbreite', () => {
    for (const panelWidth of [24, 40, 48, 56, 72, 80]) {
      const panel = panelAt('runningBond', panelWidth)
      const wall = studioWall({ id: 'wall-1', width: 192, panel })
      const tiles = layoutPanelTiles(wall, panel)
      firstWidthsDiffer(courseTiles(tiles, 0), courseTiles(tiles, 1), panelWidth * 0.2)
    }
  })

  it('hält den Versatz auf der zweiten Dock-Wand wenn die Breite die erste nicht teilt', () => {
    for (const panelWidth of [40, 56, 72, 80]) {
      const panel = panelAt('runningBond', panelWidth)
      const left = studioWall({ id: 'left', width: 192, originX: 0, panel })
      const right = studioWall({ id: 'right', width: 192, originX: 192, panel })
      const walls = [left, right]
      const tiles = layoutPanelTiles(right, panel, walls)
      firstWidthsDiffer(courseTiles(tiles, 0), courseTiles(tiles, 1), panelWidth * 0.15)
    }
  })

  it('hält ⅓-Läuferverband-Versatz nach Breitenänderung an der Dock-Kette', () => {
    const panel = panelAt('runningBondThird', 40)
    const left = studioWall({ id: 'left', width: 192, originX: 0, panel })
    const right = studioWall({ id: 'right', width: 192, originX: 192, panel })
    const tiles = layoutPanelTiles(right, panel, [left, right])
    const w0 = courseTiles(tiles, 0)[0]!.width
    const w1 = courseTiles(tiles, 1)[0]!.width
    const w2 = courseTiles(tiles, 2)[0]!.width
    expect(Math.abs(w0 - w1)).toBeGreaterThan(4)
    expect(Math.abs(w1 - w2)).toBeGreaterThan(4)
  })

  it('hält Kopfverband-Versatz auf der zweiten Dock-Wand bei Breite 40', () => {
    const panel = panelAt('headerBond', 40)
    const left = studioWall({ id: 'left', width: 192, originX: 0, panel })
    const right = studioWall({ id: 'right', width: 192, originX: 192, panel })
    const tiles = layoutPanelTiles(right, panel, [left, right])
    firstWidthsDiffer(courseTiles(tiles, 0), courseTiles(tiles, 1), 3)
  })
})

describe('45° Verband-Ecke 0,5 / 1', () => {
  const halfOrFull = (width: number) => Math.abs(width - 16) < 3 || Math.abs(width - 32) < 3
  const notOneAndHalfOrTwo = (width: number) =>
    Math.abs(width - 48) > 4 && Math.abs(width - 64) > 4

  function masonryPair(cornerJoin: 'miter' | 'bond', widthA = 192, widthB = 192) {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 32,
      cornerJoin,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const a = studioWall({
      id: 'a',
      width: widthA,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: widthB,
      originX: widthA,
      originZ: 0,
      yawDeg: 45,
      panel,
    })
    return { panel, a, b, walls: [a, b] }
  }

  it('setzt komplementäre 0,5- und 1-Steine an der 45°-Ecke', () => {
    const { panel, a, b, walls } = masonryPair('bond')
    const endA = courseTiles(layoutPanelTiles(a, panel, walls), 0).at(-1)!
    const startB = courseTiles(layoutPanelTiles(b, panel, walls), 0)[0]!
    expect(halfOrFull(endA.width)).toBe(true)
    expect(halfOrFull(startB.width)).toBe(true)
    expect(Math.abs(endA.width - startB.width)).toBeGreaterThan(8)
  })

  it('Kopfverband an 45°-Ecke: Endsteine nur Binder / ½-Binder', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'headerBond' as const,
      panelWidth: 32,
      panelHeight: 16,
      cornerJoin: 'bond' as const,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const header = 16
    const a = studioWall({
      id: 'a',
      width: 192,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: 192,
      originX: 192,
      originZ: 0,
      yawDeg: 45,
      panel,
    })
    const walls = [a, b]
    for (const row of [0, 1]) {
      const endA = courseTiles(layoutPanelTiles(a, panel, walls), row).at(-1)!
      const startB = courseTiles(layoutPanelTiles(b, panel, walls), row)[0]!
      const ok = (w: number) => Math.abs(w - header) < 2 || Math.abs(w - header / 2) < 2
      expect(ok(endA.width)).toBe(true)
      expect(ok(startB.width)).toBe(true)
      expect(Math.abs(endA.width - 32)).toBeGreaterThan(4)
      expect(Math.abs(startB.width - 32)).toBeGreaterThan(4)
    }
  })

  it('gilt auch bei Gehrung (nicht nur Ecke Verband) und lässt keine 1,5er/2er-Stummel', () => {
    const { panel, a, b, walls } = masonryPair('miter', 384, 384)
    const rowA = courseTiles(layoutPanelTiles(a, panel, walls), 0)
    const rowB = courseTiles(layoutPanelTiles(b, panel, walls), 0)
    const endA = rowA.at(-1)!
    const prevA = rowA.at(-2)!
    const startB = rowB[0]!
    const nextB = rowB[1]!
    expect(halfOrFull(endA.width)).toBe(true)
    expect(halfOrFull(startB.width)).toBe(true)
    expect(notOneAndHalfOrTwo(endA.width)).toBe(true)
    expect(notOneAndHalfOrTwo(startB.width)).toBe(true)
    expect(Math.abs(endA.width - startB.width)).toBeGreaterThan(8)
    expect(prevA.width).toBeGreaterThan(28)
    expect(nextB.width).toBeGreaterThan(28)
  })

  it('hält 0,5/1 wenn die 45°-Länge nicht durch 32 teilbar ist', () => {
    const { panel, a, b, walls } = masonryPair('miter', 384, PLAN_DIAGONAL_STEP * 12)
    const endA = courseTiles(layoutPanelTiles(a, panel, walls), 0).at(-1)!
    const startB = courseTiles(layoutPanelTiles(b, panel, walls), 0)[0]!
    expect(halfOrFull(endA.width)).toBe(true)
    expect(halfOrFull(startB.width)).toBe(true)
    expect(notOneAndHalfOrTwo(endA.width)).toBe(true)
    expect(notOneAndHalfOrTwo(startB.width)).toBe(true)
    expect(Math.abs(endA.width - startB.width)).toBeGreaterThan(8)
  })

  it('tauscht 0,5 und 1 in der nächsten Lage', () => {
    const { panel, a, b, walls } = masonryPair('miter')
    const evenA = courseTiles(layoutPanelTiles(a, panel, walls), 0).at(-1)!
    const oddA = courseTiles(layoutPanelTiles(a, panel, walls), 1).at(-1)!
    const evenB = courseTiles(layoutPanelTiles(b, panel, walls), 0)[0]!
    const oddB = courseTiles(layoutPanelTiles(b, panel, walls), 1)[0]!
    expect(Math.abs(evenA.width - oddA.width)).toBeGreaterThan(8)
    expect(Math.abs(evenA.width - evenB.width)).toBeGreaterThan(8)
    expect(Math.abs(oddA.width - oddB.width)).toBeGreaterThan(8)
  })

  it('24-cm-Läufer: 45°-Halbstein bleibt 12 cm (nicht auf 16 gesnappt), Versatz ≈ 0,5', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 24,
      panelHeight: 8,
      joint: 0.8,
      cornerJoin: 'miter' as const,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const a = studioWall({
      id: 'a24',
      width: 960,
      height: 128,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panel,
    })
    const b = studioWall({
      id: 'b24',
      width: 304,
      height: 128,
      originX: 960,
      originZ: 0,
      yawDeg: 45,
      panel,
    })
    const walls = [a, b]
    const tiles = layoutPanelTiles(a, panel, walls)
    const even = courseTiles(tiles, 0, 8)
    const odd = courseTiles(tiles, 1, 8)
    const endEven = even.at(-1)!.width
    const endOdd = odd.at(-1)!.width
    // Früher: snapMasonryCm(12)→16 → Versatz 8 cm ≈ ⅓
    expect(Math.min(endEven, endOdd)).toBeGreaterThan(10)
    expect(Math.min(endEven, endOdd)).toBeLessThan(14)
    expect(Math.max(endEven, endOdd)).toBeGreaterThan(20)
    expect(Math.abs(endEven - endOdd)).toBeGreaterThan(10)
    expect(Math.abs(endEven - endOdd)).toBeLessThan(14)
    const midX = a.width * 0.5
    const e = even.find((t) => t.x <= midX && t.x + t.width >= midX)!
    const joints = odd.flatMap((t) => [t.x, t.x + t.width])
    const inside = joints.filter((j) => j > e.x + 1 && j < e.x + e.width - 1)
    expect(inside.length).toBeGreaterThan(0)
    const frac = (inside[0]! - e.x) / e.width
    expect(frac).toBeGreaterThan(0.4)
    expect(frac).toBeLessThan(0.6)
  })

  it('hält 45°-0,5/1 planstabil, unabhängig von Wand-IDs', () => {
    const { panel } = masonryPair('miter')
    const pair = (idA: string, idB: string, y: number) => {
      const a = studioWall({
        id: idA,
        y,
        width: 192,
        originX: 0,
        originZ: 0,
        yawDeg: 0,
        panel,
      })
      const b = studioWall({
        id: idB,
        y,
        width: 192,
        originX: 192,
        originZ: 0,
        yawDeg: 45,
        panel,
      })
      return { a, b, walls: [a, b] }
    }
    const lex = pair('a', 'z', 0)
    const rev = pair('z', 'a', 400)
    const endLex = courseTiles(layoutPanelTiles(lex.a, panel, lex.walls), 0).at(-1)!
    const endRev = courseTiles(layoutPanelTiles(rev.a, panel, rev.walls), 0).at(-1)!
    const startLex = courseTiles(layoutPanelTiles(lex.b, panel, lex.walls), 0)[0]!
    const startRev = courseTiles(layoutPanelTiles(rev.b, panel, rev.walls), 0)[0]!
    expect(endLex.width).toBeCloseTo(endRev.width, 5)
    expect(startLex.width).toBeCloseTo(startRev.width, 5)
    expect(Math.abs(endLex.width - startLex.width)).toBeGreaterThan(8)
  })

  it('setzt an 45°-Ecken Front-0,5/1; Raster ab x=0 bis zur Ecke', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      cornerJoin: 'none' as const,
      projectDepth: 4,
      taperDepth: 2,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const miter = 16.57
    const a = studioWall({
      id: 'a',
      width: 1056,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      miterStart: 40,
      miterEnd: -miter,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: PLAN_DIAGONAL_STEP * 12,
      depth: 40,
      originX: 1056,
      originZ: 0,
      yawDeg: 45,
      panelFlip: false,
      miterStart: miter,
      miterEnd: -miter,
      panel,
    })
    const walls = [a, b]
    const endA = courseTiles(layoutPanelTiles(a, panel, walls), 0).at(-1)!
    const startB = courseTiles(layoutPanelTiles(b, panel, walls), 0)[0]!
    const firstA = courseTiles(layoutPanelTiles(a, panel, walls), 0)[0]!
    const near = (w: number, t: number) => Math.abs(w - t) < 8
    const frontEndA = frontTileWidth(a, endA, walls)
    const frontStartB = frontTileWidth(b, startB, walls)
    const frontFirstA = frontTileWidth(a, firstA, walls)
    expect(near(frontEndA, 32) || near(frontEndA, 64)).toBe(true)
    expect(near(frontStartB, 32) || near(frontStartB, 64)).toBe(true)
    expect(Math.abs(frontEndA - frontStartB)).toBeGreaterThan(16)
    expect(firstA.x).toBeLessThan(-8)
    expect(near(frontFirstA, 32) || near(frontFirstA, 64)).toBe(true)
  })

  it('hält Läuferverband: gerade Lage 1er, versetzte 0,5er — nicht Stapelverband', () => {
    const { panel, a, walls } = masonryPair('miter', 384, 384)
    const even = courseTiles(layoutPanelTiles(a, panel, walls), 0)
    const odd = courseTiles(layoutPanelTiles(a, panel, walls), 1)
    expect(Math.abs(even[0]!.width - 32)).toBeLessThan(4)
    expect(Math.abs(odd[0]!.width - 16)).toBeLessThan(4)
    const evenJoint = even[0]!.width
    const oddJoint = odd[0]!.width
    expect(Math.abs(evenJoint - oddJoint)).toBeGreaterThan(8)
    expect(Math.abs(even[1]!.x - odd[1]!.x)).toBeGreaterThan(8)
  })

  it('lässt links keinen 1,5er und keine gekürzte Sockelreihe (1056 × 64, Sockel 96)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      cornerJoin: 'none' as const,
      projectDepth: 4,
      taperDepth: 2,
      plinthEnabled: true,
      plinthHeight: 96,
      hideRowsTop: 3,
    }
    const a = studioWall({
      id: 'a',
      width: 1056,
      height: 512,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      miterStart: 40,
      miterEnd: -16.57,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: PLAN_DIAGONAL_STEP * 12,
      height: 512,
      depth: 40,
      originX: 1056,
      originZ: 0,
      yawDeg: 45,
      panelFlip: false,
      miterStart: 16.57,
      miterEnd: -16.57,
      panel,
    })
    const walls = [a, b]
    const tiles = layoutPanelTiles(a, panel, walls)
    const minY = Math.min(...tiles.map((t) => t.y))
    expect(minY).toBeGreaterThanOrEqual(96 - 1)
    const bottomRow = tiles.filter((t) => Math.abs(t.y - minY) < 1)
    expect(bottomRow.length).toBeGreaterThan(0)
    expect(bottomRow.every((t) => t.height > 28)).toBe(true)
    const even = bottomRow.sort((x, y) => x.x - y.x)
    const oddY = minY + 32
    const odd = tiles.filter((t) => Math.abs(t.y - oddY) < 1).sort((x, y) => x.x - y.x)
    expect(even[0]!.width).toBeLessThan(80)
    expect(odd[0]!.width).toBeLessThan(80)
    const frontEven = frontTileWidth(a, even[0]!, walls)
    const frontOdd = frontTileWidth(a, odd[0]!, walls)
    expect(Math.abs(frontEven - frontOdd)).toBeGreaterThan(16)
  })

  it('hält Läuferverband an 90°-Gehrung (Außenkante): Versatz, keine Stummel', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 48,
      panelHeight: 32,
      cornerJoin: 'miter' as const,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const a = studioWall({
      id: 'a',
      width: 500,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: true,
      miterStart: 40,
      miterEnd: -40,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: 300,
      depth: 40,
      originX: 500,
      originZ: 0,
      yawDeg: 90,
      panelFlip: true,
      miterStart: 40,
      miterEnd: -40,
      panel,
    })
    const walls = [a, b]
    const tiles = layoutPanelTiles(a, panel, walls)
    expect(tiles.every((t) => t.width >= 8 - 1e-6)).toBe(true)
    const even = courseTiles(tiles, 0)
    const odd = courseTiles(tiles, 1)
    expect(even.length).toBeGreaterThan(2)
    expect(odd.length).toBeGreaterThan(2)
    // Versatzlage: erster Stein halb (± Rest), gerade Lage voll (± Rest) — kein Doppel-Halbstein
    expect(Math.abs(even[0]!.width - odd[0]!.width)).toBeGreaterThan(12)
    expect(odd[1]!.width).toBeGreaterThan(40)
    const evenJoint = even[0]!.x + even[0]!.width
    const oddJoint = odd[0]!.x + odd[0]!.width
    expect(Math.abs(evenJoint - oddJoint)).toBeGreaterThan(16)
    // Feldsteine nahe Rastermaß — kein Stapelverband durch gedehnte Forced-Ends
    const fieldEven = even.slice(1, -1)
    const fieldOdd = odd.slice(1, -1)
    expect(fieldEven.every((t) => Math.abs(t.width - 48) < 6)).toBe(true)
    expect(fieldOdd.every((t) => Math.abs(t.width - 48) < 6)).toBe(true)
    // Raster auf Plan 0…width (Außenkante); Joint-Einzug der Innenfugen ist ok
    expect(even[0]!.x).toBeLessThan(1)
    expect(even.at(-1)!.x + even.at(-1)!.width).toBeGreaterThan(a.width - 1)
  })

  it('hält Endbreiten halb/voll und Versatz auch wenn Breite durch 48 teilbar ist', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 48,
      panelHeight: 32,
      cornerJoin: 'miter' as const,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const a = studioWall({
      id: 'a',
      width: 480,
      depth: 40,
      yawDeg: 0,
      panelFlip: true,
      miterStart: 40,
      miterEnd: -40,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: 240,
      depth: 40,
      originX: 480,
      yawDeg: 90,
      panelFlip: true,
      miterStart: 40,
      miterEnd: -40,
      panel,
    })
    const tiles = layoutPanelTiles(a, panel, [a, b])
    const even = courseTiles(tiles, 0)
    const odd = courseTiles(tiles, 1)
    // Joint zieht ~0,4 cm von Innenkanten — Endbreite nahe 48 bzw. 24
    expect(Math.abs(even[0]!.width - 48)).toBeLessThan(2)
    expect(Math.abs(odd[0]!.width - 24)).toBeLessThan(2)
    expect(Math.abs(even.at(-1)!.width - 48)).toBeLessThan(2)
    expect(Math.abs(odd.at(-1)!.width - 24)).toBeLessThan(2)
    expect(tiles.every((t) => t.width >= 8 - 1e-6)).toBe(true)
    expect(Math.abs(even[1]!.x - odd[1]!.x)).toBeGreaterThan(16)
  })

  it('gehrt die 90°-Kante auch ohne Mauerwerk am Nachbarn — Raster ab x=0 mit 0,5/1', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      cornerJoin: 'none' as const,
      projectDepth: 4,
      taperDepth: 2,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const a = studioWall({
      id: 'a',
      width: 1056,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      miterStart: 40,
      miterEnd: -16.57,
      panel,
    })
    const b = studioWall({
      id: 'b',
      width: PLAN_DIAGONAL_STEP * 12,
      depth: 40,
      originX: 1056,
      originZ: 0,
      yawDeg: 45,
      panelFlip: false,
      miterStart: 16.57,
      miterEnd: -16.57,
      panel,
    })
    const blank = studioWall({
      id: 'c',
      width: 400,
      depth: 40,
      originX: 0,
      originZ: -400,
      yawDeg: 270,
      panelFlip: false,
      miterStart: 40,
      miterEnd: -40,
      panel: { ...panel, pattern: 'none', enabled: false, plinthEnabled: false },
    })
    const walls = [a, b, blank]
    expect(panelMiterEnds(a, walls).start).toBe(true)
    const even = courseTiles(layoutPanelTiles(a, panel, walls), 0)
    const odd = courseTiles(layoutPanelTiles(a, panel, walls), 1)
    expect(even[0]!.x).toBeLessThan(-8)
    expect(odd[0]!.x).toBeLessThan(-8)
    const near = (w: number, t: number) => Math.abs(w - t) < 8
    const frontEven = frontTileWidth(a, even[0]!, walls)
    const frontOdd = frontTileWidth(a, odd[0]!, walls)
    expect(near(frontEven, 64) || near(frontEven, 32)).toBe(true)
    expect(near(frontOdd, 64) || near(frontOdd, 32)).toBe(true)
    expect(Math.abs(even[2]!.x - odd[2]!.x)).toBeGreaterThan(8)
  })

  it('hält Paneel-Y-Raster am Wandfuß; überlappende Reihe wird auf Sockel gekürzt (v2.0.200)', () => {
    const base = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 32,
      plinthEnabled: true,
      plinthHeight: 32,
    }
    const wall = studioWall({
      id: 'plinth-y',
      width: 320,
      height: 320,
      depth: 32,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      panel: base,
    })
    const with32 = layoutPanelTiles(wall, base, [wall])
    const with64 = layoutPanelTiles(wall, { ...base, plinthHeight: 64 }, [wall])
    const y32 = [...new Set(with32.map((t) => Math.round(t.y)))].sort((a, b) => a - b)
    const y64 = [...new Set(with64.map((t) => Math.round(t.y)))].sort((a, b) => a - b)
    expect(y32[0]).toBeGreaterThanOrEqual(32 - 1)
    expect(y64[0]).toBeGreaterThanOrEqual(64 - 1)
    const shared = y32.filter((y) => y >= 64)
    for (const y of shared) {
      expect(y64).toContain(y)
    }
  })

  it('kürzt unterste Paneelreihe auf Sockeloberkante bei hoher Paneelhöhe (v2.0.200)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 32,
      panelHeight: 88,
      plinthEnabled: true,
      plinthHeight: 32,
    }
    const wall = studioWall({
      id: 'tall-panel-plinth',
      width: 320,
      height: 448,
      depth: 32,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      panel,
    })
    const withPlinth = layoutPanelTiles(wall, panel, [wall])
    const without = layoutPanelTiles(
      wall,
      { ...panel, plinthEnabled: false, plinthHeight: 0 },
      [wall],
    )
    const minWith = Math.min(...withPlinth.map((t) => t.y))
    const minWithout = Math.min(...without.map((t) => t.y))
    // Ohne Sockel startet die Reihe am Fuß; mit Sockel an der Oberkante — keine Lücke bis 88.
    expect(minWithout).toBeLessThan(8)
    expect(minWith).toBeGreaterThanOrEqual(32 - 1)
    expect(minWith).toBeLessThan(40)
    const bottom = withPlinth.filter((t) => Math.abs(t.y - minWith) < 1)
    expect(bottom.every((t) => t.height > 40)).toBe(true)
  })
})

describe('Verbandsmuster gleichmäßig (wandweites Raster)', () => {
  function rowTiles(tiles: ReturnType<typeof layoutPanelTiles>, row: number, ph: number) {
    return tiles
      .filter((t) => Math.round((t.y - ph / 2) / ph) === row)
      .sort((a, b) => a.x - b.x)
  }

  it('24er und 48er gleichen Wandmaßes teilen Innenfugen (Rest nur am Ende)', () => {
    const mk = (id: string, panelWidth: number, panelHeight: number) => {
      const panel = {
        ...DEFAULT_STUDIO_PANEL,
        pattern: 'runningBond' as const,
        panelWidth,
        panelHeight,
        joint: panelWidth === 24 ? 0.8 : 1.2,
        plinthEnabled: false,
        plinthHeight: 0,
        cornerJoin: 'miter' as const,
      }
      return studioWall({ id, width: 400, height: 128, panel })
    }
    const w24 = mk('a24', 24, 8)
    const w48 = mk('a48', 48, 16)
    const cuts24 = masonryPatternCuts(w24, w24.panel!, [], 0)
    const cuts48 = masonryPatternCuts(w48, w48.panel!, [], 0)
    for (const j of [0, 48, 96, 144, 192, 240, 288, 336, 384]) {
      expect(cuts24.some((c) => Math.abs(c - j) < 0.05)).toBe(true)
      expect(cuts48.some((c) => Math.abs(c - j) < 0.05)).toBe(true)
    }
    expect(cuts24.some((c) => Math.abs(c - 24) < 0.05)).toBe(true)
    // Rest am Ende: letzter Cut = 400, vorletzter = 384 (= 16×24 = 8×48)
    expect(cuts24.at(-1)).toBe(400)
    expect(cuts48.at(-1)).toBe(400)
    expect(cuts24.at(-2)).toBe(384)
    expect(cuts48.at(-2)).toBe(384)
  })

  it('Läuferverband 24×8: gerade 1/1/…, versetzt 0,5/1/…/0,5 — auch mit Öffnungen', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 24,
      panelHeight: 8,
      joint: 0.8,
      plinthEnabled: false,
      cornerJoin: 'miter' as const,
    }
    const w = studioWall({
      id: 'w',
      width: 480,
      height: 128,
      panel,
      openings: [
        {
          id: 'a',
          type: 'window',
          x: 120,
          y: 32,
          width: 96,
          height: 64,
          arch: { enabled: true, form: 'segmental' },
        },
        {
          id: 'b',
          type: 'window',
          x: 280,
          y: 32,
          width: 96,
          height: 64,
          arch: { enabled: true, form: 'segmental' },
        },
      ],
    })
    const tiles = layoutPanelTiles(w, panel, [])
    const even = rowTiles(tiles, 0, 8).filter((t) => t.x + t.width > 5 && t.x < 115)
    const odd = rowTiles(tiles, 1, 8).filter((t) => t.x + t.width > 5 && t.x < 115)
    expect(even[0]!.width).toBeGreaterThan(20)
    expect(odd[0]!.width).toBeLessThan(16)
    expect(odd[0]!.width).toBeGreaterThan(8)
    expect(Math.abs(even[1]!.x - odd[1]!.x)).toBeGreaterThan(8)
  })

  it('Läuferverband: keine Stummel schmaler als der Halbstein an der Laibung', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 24,
      panelHeight: 8,
      joint: 0.8,
      plinthEnabled: false,
      cornerJoin: 'miter' as const,
    }
    const w = studioWall({
      id: 'sliver',
      width: 480,
      height: 128,
      panel,
      openings: [
        {
          id: 'a',
          type: 'window',
          x: 128,
          y: 32,
          width: 80,
          height: 64,
        },
      ],
    })
    const tiles = layoutPanelTiles(w, panel, [])
    const o = w.openings[0]!
    const midY = o.y + o.height * 0.4
    const atJamb = tiles.filter(
      (t) =>
        t.y <= midY &&
        t.y + t.height >= midY &&
        (Math.abs(t.x + t.width - o.x) < 1.5 || Math.abs(t.x - (o.x + o.width)) < 1.5),
    )
    expect(atJamb.length).toBeGreaterThan(0)
    const half = panel.panelWidth / 2
    for (const t of atJamb) {
      expect(t.width).toBeGreaterThanOrEqual(half - panel.joint - 1)
      expect(t.width).toBeLessThanOrEqual(panel.panelWidth + half + 1)
    }
  })

  it('Läuferverband 64×32: innere Steine volle Breite, kein Dehnungs-Chaos', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      joint: 0.8,
      plinthEnabled: false,
      cornerJoin: 'miter' as const,
    }
    const w = studioWall({
      id: 'w64',
      width: 960,
      height: 320,
      panel,
      openings: [
        {
          id: 'a',
          type: 'window',
          x: 200,
          y: 64,
          width: 192,
          height: 192,
          arch: { enabled: true, form: 'segmental', riseCm: 24 },
        },
      ],
    })
    const tiles = layoutPanelTiles(w, panel, [])
    const even = rowTiles(tiles, 0, 32)
    const odd = rowTiles(tiles, 1, 32)
    expect(even.length).toBeGreaterThan(5)
    expect(odd.length).toBeGreaterThan(5)
    const innerEven = even.filter((t) => t.x > 10 && t.x + t.width < 190)
    const innerOdd = odd.filter((t) => t.x > 40 && t.x + t.width < 190)
    for (const t of innerEven.slice(1, -1)) {
      expect(Math.abs(t.width - 64)).toBeLessThan(4)
    }
    for (const t of innerOdd.slice(1, -1)) {
      expect(Math.abs(t.width - 64)).toBeLessThan(4)
    }
    expect(odd[0]!.width).toBeLessThan(40)
    expect(even[0]!.width).toBeGreaterThan(50)
  })

  it('keine Phantom-Steine quer durch die Öffnung (Cut-Merge-Lücke)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 24,
      panelHeight: 8,
      joint: 0.8,
      plinthEnabled: false,
      cornerJoin: 'miter' as const,
    }
    const w = studioWall({
      id: 'phantom',
      width: 1112.6,
      height: 384,
      panel,
      openings: [
        {
          id: 'a',
          type: 'window',
          x: 128,
          y: 128,
          width: 192,
          height: 192,
          arch: { enabled: true, form: 'segmental', riseCm: 8 },
        },
        {
          id: 'b',
          type: 'window',
          x: 384,
          y: 128,
          width: 192,
          height: 192,
          arch: { enabled: true, form: 'segmental', riseCm: 8 },
        },
      ],
    })
    const tiles = layoutPanelTiles(w, panel, [])
    for (const o of w.openings) {
      const midY = o.y + o.height * 0.4
      const crossing = tiles.filter(
        (t) =>
          t.y <= midY &&
          t.y + t.height >= midY &&
          t.x < o.x + 1 &&
          t.x + t.width > o.x + o.width - 1,
      )
      expect(crossing.length).toBe(0)
      const atJamb = tiles.filter(
        (t) =>
          t.y <= midY &&
          t.y + t.height >= midY &&
          Math.abs(t.x + t.width - o.x) < 1.5,
      )
      expect(atJamb.length).toBeGreaterThan(0)
      expect(atJamb.every((t) => t.width <= panel.panelWidth + panel.panelWidth / 2 + 1)).toBe(true)
      expect(atJamb.every((t) => t.width >= panel.panelWidth / 2 - 2)).toBe(true)
      // Kein Stein ragt in die Öffnung hinein
      const intoHole = tiles.filter(
        (t) =>
          t.y <= midY &&
          t.y + t.height >= midY &&
          t.x < o.x - 0.5 &&
          t.x + t.width > o.x + 1,
      )
      expect(intoHole.length).toBe(0)
    }
  })

  it('Streifen 64×32: eine Bahn je Reihe', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'strip' as const,
      panelWidth: 64,
      panelHeight: 32,
      joint: 0.8,
      plinthEnabled: false,
    }
    const w = studioWall({
      id: 'strip64',
      width: 960,
      height: 320,
      panel,
      openings: [
        {
          id: 'a',
          type: 'window',
          x: 200,
          y: 64,
          width: 192,
          height: 192,
          arch: { enabled: true, form: 'segmental', riseCm: 24 },
        },
      ],
    })
    const tiles = layoutPanelTiles(w, panel, [])
    const row0 = rowTiles(tiles, 0, 32)
    expect(row0.length).toBe(1)
    expect(row0[0]!.width).toBeCloseTo(960, 0)
  })
})

describe('Rechteckfenster: Reste über/unter dem Sturz', () => {
  it('legt Mittelsteine in der Schicht, die den Sturz schneidet', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      joint: 0.8,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    // Sturz bei y=140 → mittendrin in einer ~32-cm-Schicht (nicht auf der Fuge)
    const opening = {
      id: 'win',
      type: 'window' as const,
      x: 200,
      y: 140,
      width: 160,
      height: 200,
    }
    const wall = studioWall({
      id: 'facade',
      width: 640,
      height: 448,
      panel,
      openings: [opening],
    })
    const tiles = layoutPanelTiles(wall, panel, [])
    const midX = opening.x + opening.width / 2
    const above = opening.y - 6
    const below = opening.y + opening.height + 6
    const coverAbove = tiles.filter(
      (t) => t.x < midX && t.x + t.width > midX && t.y < above && t.y + t.height > above,
    )
    const coverBelow = tiles.filter(
      (t) => t.x < midX && t.x + t.width > midX && t.y < below && t.y + t.height > below,
    )
    expect(coverAbove.length, 'Stein über dem Sturz fehlt').toBeGreaterThan(0)
    expect(coverBelow.length, 'Stein unter der Sohlbank fehlt').toBeGreaterThan(0)
  })

  it('auch mit Freiraum: Reste über dem Sturz bleiben', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      joint: 0.8,
      plinthEnabled: false,
      plinthHeight: 0,
      cornerJoin: 'miter' as const,
    }
    const opening = {
      id: 'win',
      type: 'window' as const,
      x: 200,
      y: 140,
      width: 160,
      height: 200,
      panelClearance: { enabled: true, cm: 8, depthCm: 0, finish: 'empty' as const },
    }
    const wall = studioWall({
      id: 'facade-clear',
      width: 640,
      height: 448,
      panel,
      openings: [opening],
    })
    const tiles = layoutPanelTiles(wall, panel, [])
    const midX = opening.x + opening.width / 2
    const above = opening.y - 6
    const coverAbove = tiles.filter(
      (t) => t.x < midX && t.x + t.width > midX && t.y < above && t.y + t.height > above,
    )
    expect(coverAbove.length, 'Stein über Sturz mit Freiraum fehlt').toBeGreaterThan(0)
  })
})
