import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { createStudioMortarGeometry, createStudioPanelGeometry } from './panelGeometry'

/**
 * Regression: Bogenkappe darf nicht als ~128 Trapez-Spalten extrudiert werden —
 * das erzeugt beim Rauszoomen vertikale Distanz-Zacken (v2.0.166).
 */
describe('Bogenkappe Front-Tessellation', () => {
  it('erzeugt über dem Rundbogen deutlich weniger Dreiecke als Spalten-Quads', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'strip' as const,
      panelHeight: 16,
      panelWidth: 384,
      joint: 0.8,
      jointDepth: 0.8,
      projectDepth: 4,
    }
    const opening = {
      id: 'door-arch',
      type: 'door',
      x: 120,
      y: 0,
      width: 144,
      height: 320,
      arch: { enabled: true, form: 'round', voussoirs: false },
    } as Opening
    const wall = {
      id: 'w-arch',
      kind: 'studio',
      x: 0,
      y: 0,
      width: 384,
      height: 448,
      depth: 32,
      panel,
      openings: [opening],
    } as Wall

    const geo = createStudioPanelGeometry(wall, panel, [wall])
    const index = geo.getIndex()
    const triCount = index ? index.count / 3 : geo.attributes.position.count / 3
    // Alte Spalten-Tessellation: oft ≫ 2000 Tris; Earcut-Front bleibt kompakt.
    expect(triCount).toBeLessThan(1800)

    const mortar = createStudioMortarGeometry(wall, panel, [wall])
    expect(mortar).toBeTruthy()
    const mi = mortar!.getIndex()
    const mTris = mi ? mi.count / 3 : mortar!.attributes.position.count / 3
    expect(mTris).toBeLessThan(900)
    mortar!.dispose()
    geo.dispose()
  })
})
