import { describe, it, expect } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { layoutPanelTiles } from './panelLayout'
import { createStudioPanelGeometry } from './panelGeometry'
import { WALL_DEPTH } from '../constants/presets'
import * as THREE from 'three'

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
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panelFlip: true,
    panel: partial.panel ?? { ...DEFAULT_STUDIO_PANEL },
    ...partial,
  }
}

describe('1+1 dock boss trapezoid', () => {
  const panel = {
    ...DEFAULT_STUDIO_PANEL,
    pattern: 'runningBond' as const,
    enabled: true,
    panelWidth: 48,
    panelHeight: 32,
    joint: 0.8,
    plinthEnabled: false,
    plinthHeight: 0,
    projectDepth: 6,
    taperDepth: 4,
    taper: 0.5,
    endBossEndJoin: 'flush' as const,
    endBossStartJoin: 'flush' as const,
  }

  it('markiert 1+1-Endsteine mit keepBossChamfer', () => {
    const left = studioWall({ id: 'left', width: 384, originX: 0, panel: { ...panel } })
    const right = studioWall({ id: 'right', width: 384, originX: 384, panel: { ...panel } })
    const walls = [left, right]
    const leftTiles = layoutPanelTiles(left, left.panel!, walls)
    const evenEnd = leftTiles.filter(
      (t) => Math.abs(t.y - 0.4) < 1 && t.x + t.width > 370 && t.x + t.width <= left.width + 0.5,
    )
    expect(evenEnd.length).toBeGreaterThan(0)
    expect(evenEnd.every((t) => t.keepBossChamferEnd === true)).toBe(true)
    const oddEnd = leftTiles.filter(
      (t) => Math.abs(t.y - 32.4) < 1 && Math.abs(t.x + t.width - left.width) < 0.6,
    )
    expect(oddEnd.length).toBeGreaterThan(0)
    expect(oddEnd.every((t) => t.flattenDockEnd === true)).toBe(true)
    expect(oddEnd.every((t) => t.x + t.width <= left.width + 0.05)).toBe(true)
  })

  it('hat Bossen-Einzug an der Dock-Seite bei 1+1', () => {
    const left = studioWall({ id: 'left', width: 384, originX: 0, panel: { ...panel } })
    const right = studioWall({ id: 'right', width: 384, originX: 384, panel: { ...panel } })
    const walls = [left, right]
    const geo = createStudioPanelGeometry(left, left.panel!, walls)!
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const halfW = left.width / 2
    const frontXs: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      if (Math.abs(y - -47.6) > 12) continue
      if (z > -9) continue
      const wallX = x + halfW
      if (wallX > 330) frontXs.push(wallX)
    }
    expect(frontXs.length).toBeGreaterThan(0)
    const maxFront = Math.max(...frontXs)
    // Kachel endet ~383.6; mit Chamfer-Einzug deutlich davor
    expect(maxFront).toBeLessThan(380)
  })

  it('setzt bei 0,5+0,5 den Dock-Chamfer auf 0 ohne Überstand', () => {
    const left = studioWall({ id: 'left', width: 384, originX: 0, panel: { ...panel } })
    const right = studioWall({ id: 'right', width: 384, originX: 384, panel: { ...panel } })
    const walls = [left, right]
    const geo = createStudioPanelGeometry(left, left.panel!, walls)!
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const halfW = left.width / 2
    const frontXs: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      if (Math.abs(y - -15.6) > 12) continue
      if (z > -9) continue
      const wallX = x + halfW
      if (wallX > 360) frontXs.push(wallX)
    }
    expect(frontXs.length).toBeGreaterThan(0)
    const maxFront = Math.max(...frontXs)
    expect(maxFront).toBeGreaterThan(382)
    expect(maxFront).toBeLessThan(left.width + 0.6)
  })
})
