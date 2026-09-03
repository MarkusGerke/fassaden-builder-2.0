/**
 * Reload-Stabilität: Ein erneuter Load (localStorage, Hash, Datei) darf Öffnungen nicht verschieben.
 * Ausführen: `npm test`
 */
import { describe, expect, it } from 'vitest'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { applyFacadeLoadPipeline } from './facadeLoad'
import { FACADE_SCHEMA_VERSION } from './schemaMigrations'
import { decodeFacadeHash, encodeFacadeHash, buildSharePayload } from './share'

function masonryWall(id: string, originX: number, originZ: number, yawDeg: number, openings: Opening[]): Wall {
  return {
    id,
    kind: 'studio',
    x: originX,
    y: 0,
    width: 384,
    height: 456,
    depth: WALL_DEPTH,
    originX,
    originZ,
    yawDeg,
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
    panel: {
      enabled: true,
      pattern: 'runningBond',
      panelWidth: 24,
      panelHeight: 8,
      plinthEnabled: false,
    } as Wall['panel'],
  }
}

function userPlacedOpenings(): Opening[] {
  // Positionen, die der Nutzer per Drag gesetzt hat (Fuge + Wandmitte, nicht Steinmitte).
  return [
    { id: 'w1', type: 'window', x: 52, y: 96, width: 92, height: 192 },
    { id: 'w2', type: 'window', x: 220, y: 96, width: 92, height: 192 },
  ]
}

function facade(): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls: [
          masonryWall('n', 0, 0, 0, userPlacedOpenings()),
          masonryWall('e', 384, 0, 90, userPlacedOpenings()),
        ],
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
        windowDepthOffset: 0,
      },
    ],
    activeBuildingId: 'b1',
  }
}

function openingPositions(state: FacadeState): Array<[string, number, number, number, number]> {
  return state.buildings.flatMap((b) =>
    b.walls.flatMap((w) => w.openings.map((o): [string, number, number, number, number] => [`${w.id}:${o.id}`, o.x, o.y, o.width, o.height])),
  )
}

describe('applyFacadeLoadPipeline — Reload verschiebt keine Öffnungen', () => {
  it('Import (v7) → gespeichert (v14) → erneuter Load: identische Öffnungen', () => {
    const first = applyFacadeLoadPipeline(facade(), 7).facade
    const second = applyFacadeLoadPipeline(first, FACADE_SCHEMA_VERSION).facade
    expect(openingPositions(second)).toEqual(openingPositions(first))
  })

  it('Load von v14 ändert einmal geladene Öffnungen nicht (Fixpunkt)', () => {
    const once = applyFacadeLoadPipeline(facade(), FACADE_SCHEMA_VERSION).facade
    const twice = applyFacadeLoadPipeline(once, FACADE_SCHEMA_VERSION).facade
    expect(openingPositions(twice)).toEqual(openingPositions(once))
  })
})

describe('Share-Hash trägt schemaVersion', () => {
  it('Hash aus aktuellem Stand spielt keine Schema-Migrationen erneut ab', async () => {
    const saved = applyFacadeLoadPipeline(facade(), FACADE_SCHEMA_VERSION).facade
    const hash = await encodeFacadeHash(buildSharePayload(saved))
    const decoded = await decodeFacadeHash(hash)
    expect(decoded).not.toBeNull()
    expect(openingPositions(decoded!.facade)).toEqual(openingPositions(saved))
  })
})
