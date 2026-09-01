import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { normalizeStudioPanel } from '../studio/constants'
import { createStudioPanelGeometry } from '../studio/panelGeometry'
import { layoutPanelTiles } from '../studio/panelLayout'
import { clipPolysMinusArches, openingArchGeom } from './openingGeometry'

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

function countSlantedEdges(geo: THREE.BufferGeometry, minDx = 15, minDy = 3): number {
  const edges = new THREE.EdgesGeometry(geo, 22)
  const ep = edges.getAttribute('position')
  let n = 0
  for (let i = 0; i < ep.count; i += 2) {
    const dx = Math.abs(ep.getX(i) - ep.getX(i + 1))
    const dy = Math.abs(ep.getY(i) - ep.getY(i + 1))
    const dz = Math.abs(ep.getZ(i) - ep.getZ(i + 1))
    if (dx > minDx && dy > minDy && dz < 2) n += 1
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
})
