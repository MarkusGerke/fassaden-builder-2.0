import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, PLAN_DIAGONAL_STEP } from './constants'
import { layoutPanelTiles, panelCourseCount, visiblePanelRowRect } from './panelLayout'
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
    const { panel, a, b, walls } = masonryPair('miter', 384, PLAN_DIAGONAL_STEP * 4)
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
      width: PLAN_DIAGONAL_STEP * 4,
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
      width: PLAN_DIAGONAL_STEP * 4,
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
      width: PLAN_DIAGONAL_STEP * 4,
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

  it('hält Paneel-Y-Raster am Wandfuß; Sockel clippt nur (keine Verschiebung)', () => {
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
})

describe('Verbandsmuster gleichmäßig (wandweites Raster)', () => {
  function rowTiles(tiles: ReturnType<typeof layoutPanelTiles>, row: number, ph: number) {
    return tiles
      .filter((t) => Math.round((t.y - ph / 2) / ph) === row)
      .sort((a, b) => a.x - b.x)
  }

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
