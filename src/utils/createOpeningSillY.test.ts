import { describe, expect, it } from 'vitest'
import { createOpening, addOpening } from './openings'
import { createStudioWall } from '../studio/walls'
import { DEFAULT_STUDIO_PANEL } from '../studio/constants'
import { WINDOW_SILL_Y, WALL_DEPTH } from '../constants/presets'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { createId } from './id'

/**
 * v2.0.310: Brüstung 128 cm unabhängig von der Wandhöhe.
 * Symptom: Bei 448 cm wirkte Vertikal 128 korrekt ((448−192)/2 = 128 = Wandmitte).
 * Bei anderen Höhen (z. B. OG 352) zog alignOpeningToMasonry auf Schichtmitte (132)
 * bzw. Paneel-Snap auf 120 — falsche Platzierung und falsches Vertikal-Feld.
 */

function stateWith(wall: Wall): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'B',
        wallHeight: wall.height,
        wallDepth: WALL_DEPTH,
        walls: [wall],
        floors: [],
        groups: [],
      },
    ],
    activeBuildingId: 'b1',
    selection: { kind: 'none' },
    neighbors: emptyNeighbors(),
  } as unknown as FacadeState
}

describe('Fenster-Brüstung vs Wandhöhe (v2.0.310)', () => {
  it('Streifen: createOpening hält 128 bei jeder Höhe', () => {
    for (const h of [448, 352, 320, 384]) {
      const wall = { ...createStudioWall(0, 0), id: createId(), width: 384, height: h }
      expect(createOpening('window', 96, 192, wall).y).toBe(WINDOW_SILL_Y)
    }
  })

  it('Läuferverband: addOpening hält Brüstung 128 (nicht Wand-/Schichtmitte)', () => {
    for (const h of [448, 352, 320, 384]) {
      const wall: Wall = {
        ...createStudioWall(0, 0),
        id: createId(),
        width: 384,
        height: h,
        panel: {
          ...DEFAULT_STUDIO_PANEL,
          enabled: true,
          pattern: 'runningBond',
          panelWidth: 48,
          panelHeight: 24,
          plinthEnabled: false,
          plinthHeight: 0,
        },
      }
      const opening = createOpening('window', 96, 192, wall, { x: 48, y: WINDOW_SILL_Y })
      expect(opening.y, `createOpening h=${h}`).toBe(WINDOW_SILL_Y)
      const next = addOpening(stateWith(wall), wall.id, opening)
      const placed = next.buildings[0]!.walls[0]!.openings[0]!
      const center = (h - 192) / 2
      expect(
        placed.y,
        `addOpening h=${h} got ${placed.y}, center would be ${center}`,
      ).toBe(WINDOW_SILL_Y)
    }
  })

  it('zu kurze Wand: Brüstung wird geklemmt, nicht zentriert', () => {
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 384,
      height: 256,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 24,
        plinthEnabled: false,
        plinthHeight: 0,
      },
    }
    const opening = createOpening('window', 96, 192, wall, { x: 48, y: WINDOW_SILL_Y })
    expect(opening.y).toBe(256 - 192) // maxY = 64
    expect(opening.y).not.toBe((256 - 192) / 2) // nicht Wandmitte 32
  })
})
