import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { normalizeStudioPanel } from '../studio/constants'
import {
  createStudioPanelFlatGeometriesByColorIndex,
  createStudioPanelGeometriesByColorIndex,
  createStudioPanelGeometry,
  createStudioPanelLowGeometry,
  createStudioMortarGeometry,
  createStudioPlinthGeometry,
} from '../studio/panelGeometry'
import { layoutPanelTiles } from '../studio/panelLayout'
import {
  clipPolysMinusArches,
  claddingEdgeHitsOpening,
  filterStudioDrawingSegment,
  filterStudioDrawingSegments,
  isSpuriousOpeningShoulderDiagonal,
  flushClipPartsToOpeningJambs,
  mergeNarrowClipParts,
  minClipRemnantWidth,
  openingArchGeom,
  openingContainsPoint,
  snapDrawingLocalX,
  studioDrawingBossFrontLocalZ,
} from './openingGeometry'

/**
 * Fixture: OG-Wand Streifen + 2 Rundbogen + 1 Rechteckfenster (User-Hash 2026-08-25).
 * Gespeichert unter /tmp beim Debug; hier inline minimal nachgebaut.
 */
function stripWallWithTwoArches() {
  return {
    id: 'strip-test',
    x: 0,
    z: 0,
    y: 456,
    width: 944,
    height: 456,
    depth: 32,
    yawDeg: 180,
    miterStart: 0,
    miterEnd: 0,
    openings: [
      {
        id: 'a',
        type: 'window' as const,
        x: 184,
        y: 144,
        width: 144,
        height: 192,
        arch: {
          enabled: true,
          keystones: false,
          voussoirs: false,
          thetaStartDeg: 180,
          thetaEndDeg: 0,
          spandrel: 'bond' as const,
        },
        panelClearance: { enabled: true, cm: 8, finish: 'empty' as const, depthCm: 3.8 },
      },
      {
        id: 'b',
        type: 'window' as const,
        x: 424,
        y: 144,
        width: 144,
        height: 192,
      },
      {
        id: 'c',
        type: 'window' as const,
        x: 664,
        y: 144,
        width: 144,
        height: 192,
        arch: {
          enabled: true,
          keystones: false,
          voussoirs: false,
          thetaStartDeg: 180,
          thetaEndDeg: 0,
          spandrel: 'bond' as const,
        },
        panelClearance: { enabled: true, cm: 8, finish: 'empty' as const, depthCm: 3.8 },
      },
    ],
    panel: normalizeStudioPanel({
      enabled: true,
      pattern: 'strip',
      panelWidth: 64,
      panelHeight: 16,
      joint: 0.8,
      projectDepth: 3.8,
      taper: 0.8,
      taperDepth: 4,
      openingJoin: 'flush',
      plinthEnabled: true,
      plinthHeight: 48,
    }),
  }
}

function countTrianglesInsideOpenings(
  geo: THREE.BufferGeometry,
  wall: { width: number; height: number; openings: Array<Parameters<typeof openingContainsPoint>[0]> },
  inset = 8,
): number {
  const pos = geo.getAttribute('position')
  const index = geo.index
  if (!pos) return 0
  const triCount = index ? index.count / 3 : pos.count / 3
  const vert = (i: number) => {
    const vi = index ? index.getX(i) : i
    return { x: pos.getX(vi) + wall.width / 2, y: pos.getY(vi) + wall.height / 2 }
  }
  let inside = 0
  for (let t = 0; t < triCount; t += 1) {
    const a = vert(t * 3)
    const b = vert(t * 3 + 1)
    const c = vert(t * 3 + 2)
    const area = Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2)
    if (area < 4) continue
    const x = (a.x + b.x + c.x) / 3
    const y = (a.y + b.y + c.y) / 3
    for (const opening of wall.openings) {
      if (
        x > opening.x + inset &&
        x < opening.x + opening.width - inset &&
        y > opening.y + inset &&
        y < opening.y + opening.height - inset &&
        openingContainsPoint(opening as never, x, y)
      ) {
        inside += 1
        break
      }
    }
  }
  return inside
}

function countSlantedEdges(
  geo: THREE.BufferGeometry,
  minDx = 15,
  minDy = 3,
  minLen = 64,
): number {
  const edges = new THREE.EdgesGeometry(geo, 22)
  const ep = edges.getAttribute('position')
  let n = 0
  for (let i = 0; i < ep.count; i += 2) {
    const dx = Math.abs(ep.getX(i) - ep.getX(i + 1))
    const dy = Math.abs(ep.getY(i) - ep.getY(i + 1))
    const dz = Math.abs(ep.getZ(i) - ep.getZ(i + 1))
    const len = Math.hypot(dx, dy)
    // Kappen-Trapezseiten sind kurz; CSG-Artefakte spannen oft über eine ganze Schicht.
    if (dx > minDx && dy > minDy && dz < 2 && len > minLen) n += 1
  }
  edges.dispose()
  return n
}

describe('strip panels vs multiple arched openings', () => {
  it('splits multi-notch strip rows instead of one wall-wide topArc', () => {
    const wall = stripWallWithTwoArches()
    const panel = normalizeStudioPanel(wall.panel)
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const row = tiles.filter((t) => t.y > 128 && t.y < 129)
    expect(row.length).toBe(1)
    const parts = clipPolysMinusArches(
      row.map((t) => ({ ...t })),
      wall.openings as never,
      0,
      panel.panelHeight,
      { panelWidth: panel.panelWidth, joint: panel.joint },
    )
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.width < wall.width - 1)).toBe(true)
  })

  it('produces no large coplanar diagonal edges in line style', () => {
    const wall = stripWallWithTwoArches()
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    expect(countSlantedEdges(geo)).toBe(0)
    geo.dispose()
  })

  it('lässt keine Paneel-Dreiecke im Fensterinneren', () => {
    const wall = stripWallWithTwoArches()
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    expect(countTrianglesInsideOpenings(geo, wall)).toBe(0)
    geo.dispose()
  })

  it('lässt keine Mörtel- oder Sockel-Dreiecke im Fensterinneren', () => {
    const wall = stripWallWithTwoArches()
    const panel = normalizeStudioPanel(wall.panel)
    const mortar = createStudioMortarGeometry(wall as never, panel, [])
    if (mortar) {
      expect(countTrianglesInsideOpenings(mortar, wall)).toBe(0)
      expect(countSlantedEdges(mortar)).toBe(0)
      mortar.dispose()
    }
    const plinth = createStudioPlinthGeometry(wall as never, panel, [])
    if (plinth) {
      expect(countTrianglesInsideOpenings(plinth, wall, 4)).toBe(0)
      expect(countSlantedEdges(plinth)).toBe(0)
      plinth.dispose()
    }
  })

  it('mergeNarrowClipParts füllt keine Lücke zwischen zwei Steinen', () => {
    const minW = minClipRemnantWidth(64)
    const merged = mergeNarrowClipParts(
      [
        { x: 0, y: 144, width: 180, height: 16 },
        { x: 330, y: 144, width: 20, height: 16 },
        { x: 400, y: 144, width: 180, height: 16 },
      ],
      minW,
    )
    const coversWindow = merged.some((p) => p.x < 184 && p.x + p.width > 328)
    expect(coversWindow).toBe(false)
  })

  it('work-mode flat panels clip arched openings (no line-style diagonals)', () => {
    const wall = stripWallWithTwoArches()
    const panel = normalizeStudioPanel(wall.panel)
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const geo = createStudioPanelFlatGeometriesByColorIndex(
      wall as never,
      panel,
      1,
      'flat-arch',
      [],
      tiles,
    )[0]!.geometry
    expect(countSlantedEdges(geo)).toBe(0)
    geo.dispose()
  })

  it('schneidet einen einzelnen Rundbogen als Kurve, nicht als Treppenstufen je Reihe', () => {
    const wall = {
      id: 'one-arch',
      x: 0,
      y: 0,
      width: 640,
      height: 400,
      depth: 32,
      openings: [
        {
          id: 'a',
          type: 'window' as const,
          x: 200,
          y: 80,
          width: 192,
          height: 240,
          arch: { enabled: true, voussoirs: false, keystones: false },
        },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'strip' as const,
        panelWidth: 64,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        taper: 0.8,
        taperDepth: 4,
        plinthEnabled: false,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geom = openingArchGeom(wall.openings[0]!, 0)!
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const row = tiles.find((t) => t.y > geom.springY + 20 && t.y < geom.y1 - 20)
    expect(row).toBeTruthy()
    const parts = clipPolysMinusArches(
      [{ ...row! }],
      wall.openings as never,
      0,
      panel.panelHeight,
      { panelWidth: panel.panelWidth, joint: panel.joint },
    )
    expect(parts.length).toBeGreaterThanOrEqual(1)
    expect(parts.length).toBeLessThanOrEqual(2)
    const withArc = parts.filter((p) => (p.bottomArc?.length ?? 0) >= 8)
    expect(withArc.length).toBeGreaterThanOrEqual(1)
    for (const part of withArc) {
      const ys = (part.bottomArc ?? []).map((p) => p.y)
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(4)
    }
    expect(parts.every((p) => p.width > 20 || (p.bottomArc?.length ?? 0) > 8)).toBe(true)
  })

  it('legt bottomArc auf oder außerhalb des Kreises, nicht als Sehne ins Loch', () => {
    const wall = {
      id: 'one-arch-chord',
      x: 0,
      y: 0,
      width: 640,
      height: 400,
      depth: 32,
      openings: [
        {
          id: 'a',
          type: 'window' as const,
          x: 200,
          y: 80,
          width: 192,
          height: 240,
          arch: { enabled: true, voussoirs: false, keystones: false },
        },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'strip' as const,
        panelWidth: 64,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        taper: 0.8,
        taperDepth: 4,
        plinthEnabled: false,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geom = openingArchGeom(wall.openings[0]!, 0)!
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const cap = tiles.filter((t) => t.y + t.height > geom.springY && t.y < geom.y1)
    const parts = clipPolysMinusArches(
      cap.map((t) => ({ ...t })),
      wall.openings as never,
      0,
      panel.panelHeight,
      { panelWidth: panel.panelWidth, joint: panel.joint },
    )
    for (const part of parts) {
      for (const pt of part.bottomArc ?? []) {
        if (pt.x <= geom.x0 + 1 || pt.x >= geom.x1 - 1 || pt.y <= geom.springY + 0.5) continue
        const d = Math.hypot(pt.x - geom.cx, pt.y - geom.cy)
        expect(d).toBeGreaterThanOrEqual(geom.r - 0.4)
      }
    }
  })

  it('lässt keinen Dreiecks-Krümel am Scheitel (Streifen und Kopfverband)', () => {
    for (const pattern of ['strip', 'headerBond'] as const) {
      const wall = {
        id: `crown-${pattern}`,
        x: 0,
        y: 0,
        width: 640,
        height: 400,
        depth: 32,
        openings: [
          {
            id: 'a',
            type: 'window' as const,
            x: 200,
            y: 80,
            width: 192,
            height: 240,
            arch: { enabled: true, voussoirs: false, keystones: false },
          },
        ],
        panel: normalizeStudioPanel({
          enabled: true,
          pattern,
          panelWidth: 32,
          panelHeight: 16,
          joint: 0.8,
          projectDepth: 3.8,
          taper: 0.45,
          taperDepth: 4,
          plinthEnabled: false,
        }),
      }
      const panel = normalizeStudioPanel(wall.panel)
      const geom = openingArchGeom(wall.openings[0]!, 0)!
      const tiles = layoutPanelTiles(wall as never, panel, [])
      const parts = clipPolysMinusArches(
        tiles.map((t) => ({ ...t })),
        wall.openings as never,
        0,
        panel.panelHeight,
        { panelWidth: panel.panelWidth, joint: panel.joint },
      )
      const crumbs = parts.filter((p) => {
        const midX = p.x + p.width / 2
        const midY = p.y + p.height / 2
        return (
          Math.abs(midX - geom.cx) < 24 &&
          midY > geom.y1 - 10 &&
          p.width < 48 &&
          p.height < 8
        )
      })
      expect(crumbs, pattern).toHaveLength(0)
    }
  })

  it('verschmilzt schmale Rechteck-Reste zwischen mehreren Bögen (3 Fenster)', () => {
    const wall = stripWallWithTwoArches()
    wall.openings.push({
      id: 'd',
      type: 'window' as const,
      x: 664,
      y: 144,
      width: 144,
      height: 192,
      arch: {
        enabled: true,
        keystones: false,
        voussoirs: false,
        thetaStartDeg: 180,
        thetaEndDeg: 0,
        spandrel: 'bond' as const,
      },
      panelClearance: { enabled: true, cm: 8, finish: 'empty' as const, depthCm: 3.8 },
    })
    wall.width = 944
    const panel = normalizeStudioPanel(wall.panel)
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const minW = minClipRemnantWidth(panel.panelWidth)
    const parts = mergeNarrowClipParts(
      clipPolysMinusArches(
        tiles.map((t) => ({ ...t })),
        wall.openings as never,
        0,
        panel.panelHeight,
        { panelWidth: panel.panelWidth, joint: panel.joint },
      ),
      minW,
    )
    const narrowRects = parts.filter(
      (p) =>
        p.width < minW - 0.1 &&
        !(p.outline && p.outline.length >= 3) &&
        !(p.bottomArc?.length ?? 0) &&
        !(p.topArc?.length ?? 0),
    )
    expect(narrowRects).toHaveLength(0)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    expect(countSlantedEdges(geo)).toBe(0)
    geo.dispose()
  })
})

function basementWallWithFourArches(pattern: 'strip' | 'masonry') {
  const arch = {
    enabled: true,
    form: 'round' as const,
    voussoirs: false,
    keystones: false,
    thetaStartDeg: 180,
    thetaEndDeg: 0,
    spandrel: 'bond' as const,
  }
  const win = (id: string, x: number, width: number) => ({
    id,
    type: 'window' as const,
    x,
    y: 0,
    width,
    height: 80,
    arch,
    basementWindow: { enabled: true, grilleHeight: 0.5 },
  })
  return {
    id: 'basement-four',
    kind: 'studio' as const,
    x: 0,
    z: 0,
    y: 256,
    width: 960,
    height: 256,
    depth: 32,
    yawDeg: 0,
    miterStart: 0,
    miterEnd: 0,
    openings: [win('a', 48, 80), win('b', 176, 80), win('c', 320, 160), win('d', 560, 160)],
    panel: normalizeStudioPanel({
      enabled: true,
      pattern,
      panelWidth: pattern === 'strip' ? 64 : 16,
      panelHeight: pattern === 'strip' ? 16 : 8,
      joint: 0.8,
      projectDepth: 3.8,
      plinthEnabled: true,
      plinthHeight: 48,
      plinthProfileId: 'sockelStandard',
    }),
  }
}

describe('Kellerfenster im Sockel', () => {
  it('Paneele/Low-LOD/Sockel bleiben außerhalb der vier Bögen', () => {
    const wall = basementWallWithFourArches('strip')
    const panel = normalizeStudioPanel(wall.panel)
    const high = createStudioPanelGeometry(wall as never, panel, [])
    const low = createStudioPanelLowGeometry(wall as never, panel, [])
    const plinth = createStudioPlinthGeometry(wall as never, panel, [])
    const mortar = createStudioMortarGeometry(wall as never, panel, [])
    expect(countTrianglesInsideOpenings(high, wall, 6), 'high').toBe(0)
    expect(countSlantedEdges(high), 'high slant').toBe(0)
    expect(countTrianglesInsideOpenings(low, wall, 6), 'low').toBe(0)
    expect(countSlantedEdges(low), 'low slant').toBe(0)
    if (plinth) {
      expect(countTrianglesInsideOpenings(plinth, wall, 6), 'plinth').toBe(0)
      expect(countSlantedEdges(plinth), 'plinth slant').toBe(0)
    }
    if (mortar) {
      expect(countTrianglesInsideOpenings(mortar, wall, 6), 'mortar').toBe(0)
      expect(countSlantedEdges(mortar), 'mortar slant').toBe(0)
    }
    high.dispose()
    low.dispose()
    plinth?.dispose()
    mortar?.dispose()
  })

  it('Mauerwerk bleibt außerhalb der vier Bögen', () => {
    const wall = basementWallWithFourArches('masonry')
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    expect(countTrianglesInsideOpenings(geo, wall, 6)).toBe(0)
    expect(countSlantedEdges(geo)).toBe(0)
    geo.dispose()
  })
})

describe('Zeichnung: Kanten und Laibung', () => {
  it('erkennt eine Diagonale, deren Mitte zwischen zwei Fenstern liegt', () => {
    const a = {
      id: 'a',
      type: 'window' as const,
      x: 48,
      y: 0,
      width: 80,
      height: 80,
    }
    const b = {
      id: 'b',
      type: 'window' as const,
      x: 176,
      y: 0,
      width: 80,
      height: 80,
    }
    expect(claddingEdgeHitsOpening(a as never, 0, 0, 400, 80)).toBe(true)
    expect(claddingEdgeHitsOpening(b as never, 0, 0, 400, 80)).toBe(true)
    expect(claddingEdgeHitsOpening(a as never, 0, 90, 400, 90)).toBe(false)
  })

  it('erkennt CSG-Diagonalen in der Rechteck-Schulter eines Bogens', () => {
    const opening = {
      id: 'arch',
      type: 'window' as const,
      x: 448,
      y: 0,
      width: 48,
      height: 64,
      arch: {
        enabled: true,
        keystones: false,
        voussoirs: false,
        thetaStartDeg: 180,
        thetaEndDeg: 0,
      },
    }
    // Schulter liegt außerhalb der Bogenmaske — nicht mehr als „Loch“ werten (kein Phantom-Rechteck).
    expect(claddingEdgeHitsOpening(opening as never, 492.1, 58.9, 735, 48.2)).toBe(false)
    expect(openingContainsPoint(opening as never, 492.1, 58.9)).toBe(false)
    expect(isSpuriousOpeningShoulderDiagonal(opening as never, 492.1, 58.9, 735, 48.2)).toBe(true)
  })

  it('verwirft lange CSG-Schrägen im Sockel auch zwischen Kellerfenstern', () => {
    const wall = {
      width: 1112,
      height: 512,
      openings: [
        { id: 'a', type: 'window' as const, x: 448, y: 0, width: 48, height: 64 },
        { id: 'b', type: 'window' as const, x: 736, y: 0, width: 48, height: 64 },
      ],
      panel: { plinthEnabled: true, plinthHeight: 96 },
    }
    // Pier zwischen Fenstern — trifft kein Loch, ist aber Sockel-CSG-Diagonale.
    expect(filterStudioDrawingSegment(496.99 - 556, 50.34 - 256, -4, 735 - 556, 43.04 - 256, -4, wall)).toBeNull()
    // Horizontale Fuge im Pier (über den Kellerfenstern, unter Sockeloberkante) bleibt.
    const horiz = filterStudioDrawingSegment(500 - 556, 80 - 256, -4, 700 - 556, 80 - 256, -4, wall)
    expect(horiz).not.toBeNull()
  })

  it('Läuferverband: Reste unter der Kämpferlinie teilen eine vertikale Laibung', () => {
    const wall = {
      id: 'bond-jamb',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 384,
      height: 256,
      depth: 32,
      yawDeg: 0,
      miterStart: 0,
      miterEnd: 0,
      openings: [
        {
          id: 'w',
          type: 'window' as const,
          x: 128,
          y: 64,
          width: 80,
          height: 128,
        },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 32,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const parts = flushClipPartsToOpeningJambs(
      mergeNarrowClipParts(
        clipPolysMinusArches(
          tiles.map((t) => ({ ...t })),
          wall.openings as never,
          0,
          panel.panelHeight,
          { panelWidth: panel.panelWidth, joint: panel.joint },
        ),
        minClipRemnantWidth(panel.panelWidth),
      ),
      wall.openings as never,
    )
    const left = 128
    const springY = 64 + 128
    const ends = new Set<number>()
    for (const p of parts) {
      if (p.outline || p.bottomArc || p.topArc) continue
      if (p.y + p.height < 65 || p.y > springY - 1) continue
      const x1 = p.x + p.width
      // Nur der Stein direkt vor der Laibung (Lücke < Splitter + Fuge) muss bündig enden;
      // ein voller Stein davor bleibt an seiner Stoßfuge (v2.0.34).
      if (x1 > left - 9 && x1 < left + 2 && p.x < left - 4) {
        ends.add(Math.round(x1 * 10) / 10)
      }
    }
    expect([...ends].length).toBeGreaterThan(0)
    expect([...ends].every((x) => Math.abs(x - left) < 0.6)).toBe(true)

    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const edges = new THREE.EdgesGeometry(geo, 22)
    const ep = edges.getAttribute('position')
    const halfW = wall.width / 2
    const halfH = wall.height / 2
    let hits = 0
    for (let i = 0; i < ep.count; i += 2) {
      if (
        claddingEdgeHitsOpening(
          wall.openings[0] as never,
          ep.getX(i) + halfW,
          ep.getY(i) + halfH,
          ep.getX(i + 1) + halfW,
          ep.getY(i + 1) + halfH,
        )
      ) {
        hits += 1
      }
    }
    edges.dispose()
    geo.dispose()
    expect(hits).toBe(0)
  })

  it('Läuferverband: jede sichtbare Reihe füllt 0…Wandbreite', () => {
    const wall = {
      id: 'bond-end',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 192,
      height: 128,
      depth: 32,
      yawDeg: 0,
      openings: [],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 32,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        plinthEnabled: false,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const tiles = layoutPanelTiles(wall as never, panel, [])
    const rows = new Map<number, typeof tiles>()
    for (const tile of tiles) {
      const key = Math.round(tile.y)
      const list = rows.get(key) ?? []
      list.push(tile)
      rows.set(key, list)
    }
    expect(rows.size).toBeGreaterThan(2)
    for (const row of rows.values()) {
      const x0 = Math.min(...row.map((t) => t.x))
      const x1 = Math.max(...row.map((t) => t.x + t.width))
      expect(x0).toBeCloseTo(0, 0)
      expect(x1).toBeCloseTo(wall.width, 0)
    }
  })

  it('Tiefenkanten und Strecken durchs Fenster entfallen; Gehrung snappt auf die Plan-Kante', () => {
    const opening = {
      id: 'w',
      type: 'window' as const,
      x: 80,
      y: 40,
      width: 80,
      height: 80,
    }
    const wall = { width: 240, height: 160, openings: [opening] }
    expect(filterStudioDrawingSegment(-5, 0, 0, -5, 10, 8, wall)).toBeNull()
    // Bossen-Fase: kleiner dz, aber > DRAWING_DEPTH_EDGE_CM
    expect(filterStudioDrawingSegment(10, 0, -2.7, 10, 3.2, -3.7, wall)).toBeNull()
    const through = filterStudioDrawingSegments(-120, 0, -4, 120, 0, -4, wall)
    expect(through.length).toBeGreaterThanOrEqual(2)
    for (const seg of through) {
      expect(
        claddingEdgeHitsOpening(opening as never, seg[0]! + 120, seg[1]! + 80, seg[3]! + 120, seg[4]! + 80),
      ).toBe(false)
    }
    expect(snapDrawingLocalX(-120 - 20, 240)).toBeCloseTo(-120, 5)
    const snapped = filterStudioDrawingSegment(-140, 20, -4, -100, 20, -4, wall)
    expect(snapped).not.toBeNull()
    expect(snapped![0]).toBeCloseTo(-120, 5)
  })

  it('Zeichnungsfilter: Kanten der Stein-Geometrie laufen nicht durchs Fenster', () => {
    const wall = {
      id: 'bond-draw',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 384,
      height: 256,
      depth: 32,
      yawDeg: 0,
      miterStart: 32,
      miterEnd: 32,
      openings: [
        {
          id: 'w',
          type: 'window' as const,
          x: 128,
          y: 64,
          width: 80,
          height: 128,
        },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 32,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        taper: 0.55,
        taperDepth: 4,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const edges = new THREE.EdgesGeometry(geo, 22)
    const ep = edges.getAttribute('position')
    let keptHits = 0
    let kept = 0
    for (let i = 0; i < ep.count; i += 2) {
      const segs = filterStudioDrawingSegments(
        ep.getX(i),
        ep.getY(i),
        ep.getZ(i),
        ep.getX(i + 1),
        ep.getY(i + 1),
        ep.getZ(i + 1),
        wall,
      )
      for (const seg of segs) {
        kept += 1
        if (
          claddingEdgeHitsOpening(
            wall.openings[0] as never,
            seg[0] + wall.width / 2,
            seg[1] + wall.height / 2,
            seg[3] + wall.width / 2,
            seg[4] + wall.height / 2,
          )
        ) {
          keptHits += 1
        }
      }
    }
    edges.dispose()
    geo.dispose()
    expect(kept).toBeGreaterThan(20)
    expect(keptHits).toBe(0)
  })

  it('Bossen an Wandende: Front-X der Endsteine ist in geraden und versetzten Lagen gleich', () => {
    const wall = {
      id: 'boss-end',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 192,
      height: 96,
      depth: 32,
      yawDeg: 0,
      panelFlip: true,
      openings: [],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 32,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        taper: 0.5,
        taperDepth: 6,
        plinthEnabled: false,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const pos = geo.getAttribute('position')
    const halfW = wall.width / 2
    const frontZ = -3.8 - 6
    const xs: number[] = []
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      if (Math.abs(z - frontZ) > 0.6) continue
      if (x + halfW < wall.width - 4) continue
      xs.push(x)
    }
    geo.dispose()
    expect(xs.length).toBeGreaterThan(4)
    const span = Math.max(...xs) - Math.min(...xs)
    expect(span).toBeLessThan(1.2)
  })
})

/** v2.0.34: Läuferverband an Ecken und zwischen Fenstern (User-Hash 2026-09-02, Farbe/Render). */
describe('Läuferverband: Ecken und Laibungen im Render', () => {
  function rowXsAtFront(
    geos: THREE.BufferGeometry[],
    wallWidth: number,
    wallHeight: number,
    panelHeight: number,
    frontZ: number,
  ): Map<number, number[]> {
    const rows = new Map<number, Set<number>>()
    for (const geo of geos) {
      const pos = geo.getAttribute('position')
      for (let i = 0; i < pos.count; i += 1) {
        if (Math.abs(pos.getZ(i) - frontZ) > 0.05) continue
        const y = pos.getY(i) + wallHeight / 2
        const row = Math.round((y - panelHeight / 2) / panelHeight)
        const set = rows.get(row) ?? new Set<number>()
        set.add(Math.round((pos.getX(i) + wallWidth / 2) * 100) / 100)
        rows.set(row, set)
      }
    }
    const out = new Map<number, number[]>()
    for (const [row, set] of rows) out.set(row, [...set].sort((a, b) => a - b))
    return out
  }

  /**
   * Ecke des User-Hashes (OG, 24×8): Südwand mit 45°-Wand (Paneele) am Start und
   * Westwand (Putz, `pattern: none`) am Ende. Ohne Fenster.
   */
  function userCornerWalls(extra: Record<string, unknown> = {}) {
    const bond = normalizeStudioPanel({
      enabled: true,
      pattern: 'runningBond',
      panelWidth: 24,
      panelHeight: 8,
      joint: 0.8,
      projectDepth: 4,
      taperDepth: 0,
      cornerJoin: 'miter',
      plinthEnabled: false,
      hideRowsTop: 0,
      hideRowsBottom: 0,
      ...extra,
    })
    const south = {
      id: 'user-south',
      kind: 'studio' as const,
      x: 1216.57,
      originX: 1216.5685424949238,
      originZ: 1000,
      z: 0,
      y: 512,
      width: 1112.5685424949238,
      height: 64,
      depth: 40,
      yawDeg: 180,
      panelFlip: true,
      planLinked: true,
      miterStart: -16.5685424949238,
      miterEnd: 40,
      openings: [],
      panel: bond,
    }
    const diagonal = {
      id: 'user-diag',
      kind: 'studio' as const,
      x: 1432,
      originX: 1432,
      originZ: 784.5685424949237,
      z: 0,
      y: 512,
      width: 304.66608896548195,
      height: 64,
      depth: 40,
      yawDeg: 225,
      panelFlip: true,
      planLinked: true,
      miterStart: -16.5685424949238,
      miterEnd: 16.5685424949238,
      openings: [],
      panel: bond,
    }
    const west = {
      id: 'user-west',
      kind: 'studio' as const,
      x: 104,
      originX: 104,
      originZ: 1000,
      z: 0,
      y: 512,
      width: 992,
      height: 64,
      depth: 40,
      yawDeg: 90,
      panelFlip: true,
      planLinked: true,
      miterStart: -40,
      miterEnd: 40,
      openings: [],
      panel: normalizeStudioPanel({ ...bond, pattern: 'none' }),
    }
    return { south, diagonal, west, walls: [south, diagonal, west] as never[] }
  }

  function expectRowsMatchLayout(
    geos: THREE.BufferGeometry[],
    wall: ReturnType<typeof userCornerWalls>['south'],
    tiles: ReturnType<typeof layoutPanelTiles>,
  ) {
    const rows = rowXsAtFront(geos, wall.width, wall.height, wall.panel.panelHeight, -4)
    expect(rows.size).toBeGreaterThanOrEqual(6)
    const xEnd = Math.max(...tiles.map((t) => t.x + t.width))
    const xStart = Math.min(...tiles.map((t) => t.x))
    for (const [row, xs] of rows) {
      const layoutRow = tiles.filter((t) => Math.round((t.y - wall.panel.panelHeight / 2) / wall.panel.panelHeight) === row)
      expect(layoutRow.length).toBeGreaterThan(40)
      // jeder Stein behält beide Stoßfugen-Kanten: nichts verschmolzen, nichts verworfen
      expect(xs.length).toBe(layoutRow.length * 2)
      expect(xs[0]).toBeCloseTo(xStart, 1)
      expect(xs[xs.length - 1]).toBeCloseTo(xEnd, 1)
    }
  }

  it('Farbstufen: halber Endstein am Wandende bleibt in jeder Lage (kein Treppen-Effekt)', () => {
    const { south: wall, walls } = userCornerWalls({ tileColorVariance: 5, tileColorVariety: 100 })
    const tiles = layoutPanelTiles(wall as never, wall.panel, walls)
    // versetzte Lagen enden mit einem 11,6-cm-Stein (< halbe Steinbreite)
    const narrowEnd = tiles.filter((t) => t.width < 12 && t.x + t.width > wall.width)
    expect(narrowEnd.length).toBeGreaterThan(2)
    const geos = createStudioPanelGeometriesByColorIndex(wall as never, wall.panel, 8, 'user-south:#7E2020', walls, tiles)
    expect(geos.length).toBeGreaterThan(1)
    expectRowsMatchLayout(geos.map((g) => g.geometry), wall, tiles)
    for (const { geometry } of geos) geometry.dispose()
  })

  it('Einfarbig: halber Endstein wird nicht mit dem Nachbarn zu 1,5 Steinen verschmolzen', () => {
    const { south: wall, walls } = userCornerWalls()
    const tiles = layoutPanelTiles(wall as never, wall.panel, walls)
    const geo = createStudioPanelGeometry(wall as never, wall.panel, walls, tiles)
    expectRowsMatchLayout([geo], wall, tiles)
    geo.dispose()
  })

  it('flushClipPartsToOpeningJambs zieht nur den Stein direkt vor der Laibung', () => {
    const opening = { id: 'w', type: 'window' as const, x: 144, y: 120, width: 208, height: 200 }
    const y = 128.4
    const height = 7.2
    const row = [
      { x: 44.1, y, width: 22.9, height },
      { x: 67.8, y, width: 22.9, height },
      { x: 91.5, y, width: 22.8, height },
      { x: 115.1, y, width: 27.8, height }, // endet 1,1 cm vor der Laibung → bündig
      { x: 352, y, width: 22.9, height }, // beginnt an der Laibung → unverändert
      { x: 375.7, y, width: 22.9, height },
    ]
    const out = flushClipPartsToOpeningJambs(row, [opening] as never).sort((a, b) => a.x - b.x)
    expect(out).toHaveLength(row.length)
    expect(out[0].x + out[0].width).toBeCloseTo(67.0, 3)
    expect(out[1].x + out[1].width).toBeCloseTo(90.7, 3)
    expect(out[2].x + out[2].width).toBeCloseTo(114.3, 3)
    expect(out[3].x + out[3].width).toBeCloseTo(144, 3)
    expect(out[4].x).toBeCloseTo(352, 3)
    expect(out[5].x).toBeCloseTo(375.7, 3)
    // Lücke ohne Zwischenstein: nächster Stein wird bis zur Laibung gezogen
    const gap = flushClipPartsToOpeningJambs(
      [
        { x: 91.5, y, width: 22.8, height },
        { x: 352, y, width: 22.9, height },
      ],
      [opening] as never,
    ).sort((a, b) => a.x - b.x)
    expect(gap[0].x + gap[0].width).toBeCloseTo(144, 3)
  })

  it('Fensterreihen: Pfeiler zwischen Fenstern behalten Stoßfugen (User-Wand)', () => {
    const wall = {
      id: 'bond-piers',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 776.57,
      height: 200,
      depth: 40,
      yawDeg: 0,
      openings: [
        { id: 'a', type: 'window' as const, x: 464, y: 120, width: 192, height: 192 },
        { id: 'b', type: 'window' as const, x: 152, y: 120, width: 192, height: 192 },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 24,
        panelHeight: 8,
        joint: 0.8,
        projectDepth: 4,
        taperDepth: 0,
        plinthEnabled: false,
        hideRowsTop: 0,
        hideRowsBottom: 0,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const rows = rowXsAtFront([geo], wall.width, wall.height, panel.panelHeight, -4)
    const windowRows = [...rows.entries()].filter(([row]) => row * 8 + 4 > 128 && row * 8 + 4 < 192)
    expect(windowRows.length).toBeGreaterThan(3)
    for (const [, xs] of windowRows) {
      // Pfeiler 344…464 (120 cm) hat mindestens vier Stoßfugen-Kanten
      const pier = xs.filter((x) => x > 344.5 && x < 463.5)
      expect(pier.length).toBeGreaterThanOrEqual(6)
      for (let i = 1; i < xs.length; i += 1) {
        const gap = xs[i] - xs[i - 1]
        // Stein an der Laibung darf einen verworfenen Splitter (< 8 cm) aufnehmen;
        // Fensterbreite (192) ist die einzige erlaubte große Lücke.
        // Laibung darf Clip-Rest bis minClipRemnantWidth aufnehmen;
        // Fensterbreite (~192) ist die einzige erlaubte große Lücke.
        const maxStone = panel.panelWidth + minClipRemnantWidth(panel.panelWidth) + panel.joint
        if (gap > maxStone) expect(gap).toBeGreaterThan(150)
      }
    }
    geo.dispose()
  })

  it('Stirnfläche am Wandende: sichtbar ohne Paneel-Nachbar, verdeckt mit Paneel-Nachbar', () => {
    const { south, walls } = userCornerWalls()
    const geo = createStudioPanelGeometry(south as never, south.panel, walls)
    const pos = geo.getAttribute('position')
    const idx = geo.getIndex()!
    const halfW = south.width / 2
    let endFaces = 0
    let startFaces = 0
    for (let t = 0; t < idx.count; t += 3) {
      const ids = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)]
      const xs = ids.map((i) => pos.getX(i) + halfW)
      const zs = ids.map((i) => pos.getZ(i))
      if (Math.max(...zs) - Math.min(...zs) < 1) continue // nur Tiefenflächen
      if (xs.every((x) => x >= south.width - 0.01)) endFaces += 1
      if (xs.every((x) => x <= 0.01)) startFaces += 1
    }
    geo.dispose()
    expect(endFaces).toBeGreaterThan(0) // Westwand ohne Paneele deckt nichts ab
    expect(startFaces).toBe(0) // 45°-Wand mit Paneelen trifft auf Gehrung
  })

  it('Zeichnung: Streifen-Fugen folgen der Bogenmaske, nicht dem Rechteckloch', () => {
    const wall = {
      id: 'strip-draw-arch',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 640,
      height: 400,
      depth: 32,
      yawDeg: 0,
      miterStart: 0,
      miterEnd: 0,
      openings: [
        {
          id: 'a',
          type: 'window' as const,
          x: 200,
          y: 80,
          width: 192,
          height: 240,
          arch: { enabled: true, voussoirs: false, keystones: false },
        },
      ],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'strip' as const,
        panelWidth: 64,
        panelHeight: 32,
        joint: 0.8,
        projectDepth: 3.8,
        plinthEnabled: false,
      }),
    }
    const opening = wall.openings[0]!
    const geom = openingArchGeom(opening as never, 0)!
    const y = geom.springY + geom.r * 0.45
    const localY = y - wall.height / 2
    const segs = filterStudioDrawingSegments(-wall.width / 2, localY, -4, wall.width / 2, localY, -4, wall)
    const leftJamb = opening.x
    const dy = y - geom.cy
    const curveX = geom.cx - Math.sqrt(Math.max(0, geom.r * geom.r - dy * dy))
    let maxXInShoulder = -Infinity
    for (const s of segs) {
      const x0 = s[0]! + wall.width / 2
      const x1 = s[3]! + wall.width / 2
      if (Math.min(x0, x1) < leftJamb + 4) {
        maxXInShoulder = Math.max(maxXInShoulder, Math.max(x0, x1))
      }
    }
    expect(maxXInShoulder).toBeGreaterThan(leftJamb + 0.4 * (curveX - leftJamb))
    for (const s of segs) {
      expect(
        claddingEdgeHitsOpening(
          opening as never,
          s[0]! + wall.width / 2,
          s[1]! + wall.height / 2,
          s[3]! + wall.width / 2,
          s[4]! + wall.height / 2,
        ),
      ).toBe(false)
    }

    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelFlatGeometriesByColorIndex(wall as never, panel, 1, 'draw-arch', [])[0]!
      .geometry
    const sil = geo.userData.drawingArchPolylines as number[][] | undefined
    expect(sil?.length ?? 0).toBeGreaterThan(0)
    const pos = geo.getAttribute('position')
    let shoulderVerts = 0
    if (pos) {
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i) + wall.width / 2
        const vy = pos.getY(i) + wall.height / 2
        if (vy > geom.springY + 4 && vy < geom.cy + geom.r - 4 && x > leftJamb + 2 && x < geom.cx) {
          shoulderVerts += 1
        }
      }
    }
    geo.dispose()
    expect(shoulderVerts).toBeGreaterThan(8)
  })

  it('Schulter- und Kellerfenster-Steine in der Bogenkappe bleiben ganze Steine (keine 16-cm-Spalten, kein Schnitt am Scheitel)', () => {
    const run = (opening: { x: number; y: number; width: number; height: number }) => {
      const op = { id: 'a', type: 'window' as const, ...opening, arch: { enabled: true, voussoirs: false, keystones: false } }
      const wall = {
        id: 'cap-whole',
        kind: 'studio' as const,
        x: 0,
        z: 0,
        y: 0,
        width: 500,
        height: 400,
        depth: 24,
        yawDeg: 0,
        miterStart: 0,
        miterEnd: 0,
        openings: [op],
        panel: normalizeStudioPanel({
          enabled: true,
          pattern: 'runningBond' as const,
          panelWidth: 50,
          panelHeight: 25,
          joint: 0.8,
          projectDepth: 3.8,
          plinthEnabled: false,
        }),
      }
      const panel = normalizeStudioPanel(wall.panel)
      const geom = openingArchGeom(op as never, 0)!
      const tiles = layoutPanelTiles(wall as never, panel, [])
      const parts = flushClipPartsToOpeningJambs(
        mergeNarrowClipParts(
          clipPolysMinusArches(
            tiles.map((t) => ({ ...t, sourceX: t.x, sourceY: t.y, sourceWidth: t.width, sourceHeight: t.height })),
            wall.openings as never,
            0,
            panel.panelHeight,
            { panelWidth: panel.panelWidth, joint: panel.joint, panelPattern: panel.pattern },
          ),
          minClipRemnantWidth(panel.panelWidth),
        ),
        wall.openings as never,
        0,
      )
      const apexY = geom.cy + geom.r
      const capParts = parts.filter(
        (p) => p.y + p.height > geom.springY + 1 && p.y < apexY - 1 && p.x < geom.x1 + 1 && p.x + p.width > geom.x0 - 1,
      )
      expect(capParts.length).toBeGreaterThan(0)
      for (const p of capParts) {
        const src = tiles.find((t) => Math.abs(t.y - (p.sourceY ?? p.y)) < 0.2 && Math.abs(t.x - (p.sourceX ?? p.x)) < 0.2)
        expect(src, 'Rest ohne Ursprungsstein').toBeTruthy()
        // Keine waagerechte Teilung am Scheitel: Rest reicht bis zur Oberkante der Schicht.
        expect(p.y + p.height).toBeCloseTo(src!.y + src!.height, 2)
        // Keine Spalten: Rest beginnt am Ursprungsstein oder an der Laibung/Kurve, endet am Ursprungsstein oder an der Kurve.
        const x0 = p.x
        const x1 = p.x + p.width
        const onSrc0 = Math.abs(x0 - src!.x) < 0.3
        const onSrc1 = Math.abs(x1 - (src!.x + src!.width)) < 0.3
        const onCurve = (x: number) => {
          const dy = Math.max(0, Math.min(p.y + p.height, apexY) - geom.cy)
          const xl = geom.cx - Math.sqrt(Math.max(0, geom.r * geom.r - dy * dy))
          const xr = geom.cx + Math.sqrt(Math.max(0, geom.r * geom.r - dy * dy))
          return (x >= xl - 1.5 && x <= geom.cx) || (x <= xr + 1.5 && x >= geom.cx) || Math.abs(x - geom.x0) < 0.5 || Math.abs(x - geom.x1) < 0.5
        }
        expect(onSrc0 || onCurve(x0), `linke Kante ${x0} weder Stein noch Bogen`).toBe(true)
        expect(onSrc1 || onCurve(x1), `rechte Kante ${x1} weder Stein noch Bogen`).toBe(true)
      }
      // Ein Ursprungsstein liefert höchstens ein Stück je Seite der Kerbe (kein Spaltenraster).
      const bySrc = new Map<string, number>()
      for (const p of capParts) {
        const k = `${p.sourceX}:${p.sourceY}`
        bySrc.set(k, (bySrc.get(k) ?? 0) + 1)
      }
      for (const n of bySrc.values()) expect(n).toBeLessThanOrEqual(2)
    }
    run({ x: 175, y: 64, width: 150, height: 200 })
    run({ x: 230, y: 20, width: 40, height: 60 })
  })

  it('Kappensteine über dem Rundbogen bleiben im Verband: nur maskiert, keine Schrägseiten', () => {
    const opening = {
      id: 'a',
      type: 'window' as const,
      x: 200,
      y: 80,
      width: 160,
      height: 200,
      arch: { enabled: true, voussoirs: false, keystones: false },
    }
    const geom = openingArchGeom(opening as never, 0)!
    const y = geom.cy + geom.r - 18
    const h = 32
    const tiles = [
      { x: geom.cx - 32, y, width: 16, height: h },
      { x: geom.cx - 16, y, width: 16, height: h },
      { x: geom.cx, y, width: 16, height: h },
      { x: geom.cx + 16, y, width: 16, height: h },
      { x: geom.cx - 72, y: geom.springY + 6, width: 16, height: h },
    ]
    const clipped = clipPolysMinusArches(
      tiles.map((t) => ({ ...t })),
      [opening] as never,
      0,
      h,
    )
    const out = flushClipPartsToOpeningJambs(clipped, [opening] as never, 0)
    const caps = out.filter((p) => (p.bottomArc?.length ?? 0) >= 2)
    expect(caps.length).toBeGreaterThanOrEqual(4)
    for (const cap of caps) {
      const src = tiles.find((t) => Math.abs(t.x - cap.x) < 0.2 && Math.abs(t.x + t.width - (cap.x + cap.width)) < 0.2)
      expect(src).toBeTruthy()
      expect(cap.y + cap.height).toBeCloseTo(src!.y + src!.height, 3)
      // Bogenkante endet lotrecht an den Steinseiten — kein Strahl zum Bogenmittelpunkt.
      const arc = cap.bottomArc!
      expect(Math.abs(arc[0]!.x - cap.x)).toBeLessThan(0.3)
      expect(Math.abs(arc[arc.length - 1]!.x - (cap.x + cap.width))).toBeLessThan(0.3)
      if (cap.outline) {
        for (const pt of cap.outline) {
          expect(pt.x).toBeGreaterThanOrEqual(cap.x - 0.3)
          expect(pt.x).toBeLessThanOrEqual(cap.x + cap.width + 0.3)
        }
      }
    }
  })

  it('Zeichnung: Bossen-Front ums Fenster erzeugt kein inneres Quadrat', () => {
    const opening = {
      id: 'w',
      type: 'window' as const,
      x: 80,
      y: 40,
      width: 80,
      height: 80,
      arch: { enabled: true, voussoirs: false, keystones: false },
    }
    const wall = {
      id: 'boss-draw',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 240,
      height: 160,
      depth: 32,
      yawDeg: 0,
      panelFlip: true,
      openings: [opening],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 32,
        panelHeight: 16,
        joint: 0.8,
        projectDepth: 3.8,
        taper: 0.55,
        taperDepth: 4,
        plinthEnabled: false,
      }),
    }
    const bossZ = studioDrawingBossFrontLocalZ(wall)
    expect(bossZ).not.toBeNull()
    expect(filterStudioDrawingSegment(10, 20, bossZ!, 24, 20, bossZ!, wall)).toBeNull()
    const bodyZ = -3.8
    const body = filterStudioDrawingSegment(-90, 20, bodyZ, -50, 20, bodyZ, wall)
    expect(body).not.toBeNull()

    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const edges = new THREE.EdgesGeometry(geo, 22)
    const ep = edges.getAttribute('position')
    let bossFrontKept = 0
    for (let i = 0; i < ep.count; i += 2) {
      const segs = filterStudioDrawingSegments(
        ep.getX(i),
        ep.getY(i),
        ep.getZ(i),
        ep.getX(i + 1),
        ep.getY(i + 1),
        ep.getZ(i + 1),
        wall,
      )
      for (const seg of segs) {
        if (Math.abs(seg[2]! - bossZ!) <= 0.45 && Math.abs(seg[5]! - bossZ!) <= 0.45) {
          bossFrontKept += 1
        }
      }
    }
    edges.dispose()
    geo.dispose()
    expect(bossFrontKept).toBe(0)
  })

  it('Zeichnung: Bossen 48×32 / taper 2 ums Fenster ohne inneres Quadrat', () => {
    const opening = {
      id: 'w',
      type: 'window' as const,
      x: 96,
      y: 48,
      width: 192,
      height: 192,
      arch: { enabled: true, form: 'round' as const, voussoirs: false, keystones: false },
    }
    const wall = {
      id: 'boss-draw-48',
      kind: 'studio' as const,
      x: 0,
      z: 0,
      y: 0,
      width: 480,
      height: 320,
      depth: 32,
      yawDeg: 0,
      panelFlip: true,
      openings: [opening],
      panel: normalizeStudioPanel({
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 32,
        joint: 4,
        projectDepth: 2.7,
        taper: 0.55,
        taperDepth: 2,
        plinthEnabled: false,
      }),
    }
    const panel = normalizeStudioPanel(wall.panel)
    const geo = createStudioPanelGeometry(wall as never, panel, [])
    const edges = new THREE.EdgesGeometry(geo, 22)
    const ep = edges.getAttribute('position')
    const bossZ = studioDrawingBossFrontLocalZ(wall)!
    let bossFrontKept = 0
    let insetNearOpening = 0
    const hole = {
      x0: opening.x - wall.width / 2,
      x1: opening.x + opening.width - wall.width / 2,
      y0: opening.y - wall.height / 2,
      y1: opening.y + opening.height - wall.height / 2,
    }
    for (let i = 0; i < ep.count; i += 2) {
      const segs = filterStudioDrawingSegments(
        ep.getX(i),
        ep.getY(i),
        ep.getZ(i),
        ep.getX(i + 1),
        ep.getY(i + 1),
        ep.getZ(i + 1),
        wall,
      )
      for (const seg of segs) {
        if (Math.abs(seg[2]! - bossZ) <= 0.6 && Math.abs(seg[5]! - bossZ) <= 0.6) {
          bossFrontKept += 1
        }
        const mx = (seg[0]! + seg[3]!) / 2
        const my = (seg[1]! + seg[4]!) / 2
        const near =
          mx > hole.x0 - 20 &&
          mx < hole.x1 + 20 &&
          my > hole.y0 - 20 &&
          my < hole.y1 + 20
        const insidePad =
          mx > hole.x0 + 2 && mx < hole.x1 - 2 && my > hole.y0 + 2 && my < hole.y1 - 2
        if (near && !insidePad && Math.abs(seg[2]! - bossZ) <= 1.2) insetNearOpening += 1
      }
    }
    edges.dispose()
    geo.dispose()
    expect(bossFrontKept).toBe(0)
    expect(insetNearOpening).toBe(0)
  })
})
