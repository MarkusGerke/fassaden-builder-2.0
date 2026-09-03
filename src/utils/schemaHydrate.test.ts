/**
 * Fixture-Tests: Alt-Öffnungen ohne Nested-Felder → nach migrate/hydrate/clamp kanonisch.
 * Ausführen: `npm test`
 */
import { describe, expect, it } from 'vitest'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { createOpening } from './openings'
import { hydrateOpening, hydrateWall, openingHasCanonicalFields } from './hydrate'
import {
  FACADE_SCHEMA_VERSION,
  migrateAlignMasonryOpenings,
  migrateFacadeSchema,
  migrateIndoorWhiteDefaults,
  migrateOpeningPanelFan,
  migratePlinthSockelStandard,
  migrateUnchangedOpeningDefaults,
  migrateWindowDepthOffsetNeg24,
} from './schemaMigrations'
import { applyFacadeLoadPipeline } from './facadeLoad'
import { clampFacadeState } from './walls'
import { WALL_DEPTH } from '../constants/presets'

function sparseWindow(): Opening {
  return {
    id: 'win-old',
    type: 'window',
    x: 64,
    y: 96,
    width: 96,
    height: 192,
  }
}

function sparseDoor(): Opening {
  return {
    id: 'door-old',
    type: 'door',
    x: 32,
    y: 0,
    width: 96,
    height: 224,
  }
}

function facadeWithOpenings(openings: Opening[]): FacadeState {
  const wall: Wall = {
    id: 'wall-1',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 384,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
  }
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls: [wall],
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
        windowDepthOffset: -24,
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('hydrateOpening', () => {
  it('füllt Alt-Fenster auf den kanonischen Feldkatalog (Features aus)', () => {
    const hydrated = hydrateOpening(sparseWindow())
    expect(openingHasCanonicalFields(hydrated)).toBe(true)
    expect(hydrated.pediment?.enabled).toBe(false)
    expect(hydrated.revealFrame?.enabled).toBe(false)
    expect(hydrated.panelClearance?.enabled).toBe(false)
    expect(hydrated.arch?.enabled).toBe(false)
    expect(hydrated.basementWindow?.enabled).toBe(false)
    expect(hydrated.frameColor).toBe('#ffffff')
    expect(hydrated.gruenderzeit?.casements).toBe(1)
    expect(hydrated.gruenderzeit?.transom).toBe(false)
    expect(hydrated.glassMode).toBe('tint')
    expect(hydrated.gruenderzeit).toBeDefined()
    expect(hydrated.trim).toBeDefined()
    expect(hydrated.sillInner).toBeDefined()
    expect(hydrated.sillOuter).toBeDefined()
    expect(hydrated.motion?.open.keys.length).toBeGreaterThan(1)
    expect(hydrated.motion?.open.keys.some((key) => key.v > 1)).toBe(true)
  })

  it('ersetzt unveränderten alten Rahmen-Default #4a4a4a durch Weiß', () => {
    const hydrated = hydrateOpening({ ...sparseWindow(), frameColor: '#4a4a4a' })
    expect(hydrated.frameColor).toBe('#ffffff')
  })

  it('lässt abweichende Rahmenfarbe unverändert', () => {
    const hydrated = hydrateOpening({ ...sparseWindow(), frameColor: '#6b4f3a' })
    expect(hydrated.frameColor).toBe('#6b4f3a')
  })

  it('füllt Alt-Tür inkl. Treppe aus', () => {
    const hydrated = hydrateOpening(sparseDoor())
    expect(openingHasCanonicalFields(hydrated)).toBe(true)
    expect(hydrated.stairs?.enabled).toBe(false)
    expect(hydrated.pediment?.enabled).toBe(false)
    expect(hydrated.motion?.open.holdMs).toBeGreaterThan(0)
  })

  it('createOpening liefert denselben Feldkatalog wie hydrate(sparse)', () => {
    const wall = { width: 384, height: 456, depth: WALL_DEPTH, kind: 'studio' as const }
    const created = createOpening('window', 96, 192, wall)
    expect(openingHasCanonicalFields(created)).toBe(true)
    expect(created.revealFrame).toBeDefined()
    expect(created.panelClearance).toBeDefined()
    expect(created.pediment).toBeDefined()
    expect(created.glassMode).toBe('tint')
  })
})

describe('migrateFacadeSchema', () => {
  it('hebt schemaVersion auf FACADE_SCHEMA_VERSION', () => {
    const { schemaVersion } = migrateFacadeSchema(facadeWithOpenings([sparseWindow()]), 7)
    expect(schemaVersion).toBe(FACADE_SCHEMA_VERSION)
  })

  it('panelFan → panelClearance taper (8→9)', () => {
    const opening = {
      ...sparseWindow(),
      arch: { enabled: true, panelFan: true } as Opening['arch'] & { panelFan?: boolean },
    }
    const migrated = migrateOpeningPanelFan(opening as Opening)
    expect(migrated.panelClearance?.enabled).toBe(true)
    expect(migrated.panelClearance?.finish).toBe('taper')
    expect((migrated.arch as { panelFan?: boolean } | undefined)?.panelFan).toBeUndefined()
  })

  it('windowDepthOffset −24 → 0 (9→10)', () => {
    const next = migrateWindowDepthOffsetNeg24(facadeWithOpenings([sparseWindow()]))
    expect(next.buildings[0]!.windowDepthOffset).toBe(0)
  })

  it('sockelStandard → sockelprofil (9→10)', () => {
    const state = facadeWithOpenings([])
    state.buildings[0]!.walls[0]!.panel = {
      enabled: true,
      pattern: 'strip',
      plinthProfileId: 'sockelStandard',
    } as Wall['panel']
    const next = migratePlinthSockelStandard(state)
    expect(next.buildings[0]!.walls[0]!.panel?.plinthProfileId).toBe('sockelprofil')
  })

  it('Läuferverband: Öffnung auf Halbstein-Fugen (13→14)', () => {
    const state = facadeWithOpenings([
      { id: 'off', type: 'window', x: 50, y: 32, width: 80, height: 100 },
    ])
    state.buildings[0]!.walls[0]!.panel = {
      enabled: true,
      pattern: 'runningBond',
      panelWidth: 24,
      panelHeight: 8,
      plinthEnabled: false,
    } as Wall['panel']
    const next = migrateAlignMasonryOpenings(state)
    const o = next.buildings[0]!.walls[0]!.openings[0]!
    expect(o.x % 12).toBeCloseTo(0, 5)
    expect(o.width % 12).toBeCloseTo(0, 5)
    expect(o.width).toBeGreaterThanOrEqual(24)
  })
})

describe('applyFacadeLoadPipeline', () => {
  it('migrate → hydrate → clamp liefert kanonische Openings', () => {
    const { facade, schemaVersion } = applyFacadeLoadPipeline(
      facadeWithOpenings([sparseWindow(), sparseDoor()]),
      7,
    )
    expect(schemaVersion).toBe(FACADE_SCHEMA_VERSION)
    expect(facade.buildings[0]!.windowDepthOffset).toBe(0)
    const wall = facade.buildings[0]!.walls[0]!
    expect(wall.openings.every(openingHasCanonicalFields)).toBe(true)
    expect(wall.planLinked).toBe(true)
  })
})

describe('clampFacadeState', () => {
  it('hydriert sparse openings beim Clamp', () => {
    const next = clampFacadeState(facadeWithOpenings([sparseWindow(), sparseDoor()]))
    const wall = next.buildings[0]!.walls[0]!
    expect(wall.openings.every(openingHasCanonicalFields)).toBe(true)
    expect(wall.planLinked).toBe(true)
  })
})

describe('schema 10→11 invertierte Plan-Fuge', () => {
  function linkedWall(
    id: string,
    originX: number,
    originZ: number,
    yawDeg: number,
    width: number,
  ): Wall {
    return {
      id,
      kind: 'studio',
      x: originX,
      y: 0,
      width,
      height: 456,
      depth: WALL_DEPTH,
      originX,
      originZ,
      yawDeg,
      panelFlip: false,
      openings: [],
      profiles: [],
      neighbors: emptyNeighbors(),
      planLinked: true,
    }
  }

  function invertedBranchFacade(): FacadeState {
    return {
      buildings: [
        {
          id: 'b1',
          name: 'Haus 1',
          walls: [
            linkedWall('w5', 180.35, -1547.65, 90, 336),
            linkedWall('w6', 180.35, -1547.65, 180, 240),
          ],
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
  }

  it('hebt schemaVersion auf 11 und dreht die Blatt-Wand an die Fuge', () => {
    const { facade, schemaVersion } = migrateFacadeSchema(invertedBranchFacade(), 10)
    expect(schemaVersion).toBe(FACADE_SCHEMA_VERSION)
    const branch = facade.buildings[0]!.walls.find((wall) => wall.id === 'w6')!
    const source = facade.buildings[0]!.walls.find((wall) => wall.id === 'w5')!
    expect(branch.originX).toBeCloseTo((source.originX ?? 0) - 240)
    expect(branch.yawDeg).toBe(0)
    expect(branch.panelFlip).toBe(false)
  })

  it('Load-Pipeline ab v10 korrigiert Front und Gehrung', () => {
    const { facade, schemaVersion } = applyFacadeLoadPipeline(invertedBranchFacade(), 10)
    expect(schemaVersion).toBe(FACADE_SCHEMA_VERSION)
    const branch = facade.buildings[0]!.walls.find((wall) => wall.id === 'w6')!
    const source = facade.buildings[0]!.walls.find((wall) => wall.id === 'w5')!
    const joint = {
      x: source.originX ?? 0,
      z: source.originZ ?? 0,
    }
    const endX =
      (branch.originX ?? 0) + branch.width * Math.cos(((branch.yawDeg ?? 0) * Math.PI) / 180)
    const endZ =
      (branch.originZ ?? 0) - branch.width * Math.sin(((branch.yawDeg ?? 0) * Math.PI) / 180)
    expect(endX).toBeCloseTo(joint.x)
    expect(endZ).toBeCloseTo(joint.z)
    expect(branch.panelFlip).toBe(false)
  })

  it('Load-Pipeline korrigiert auch wenn schemaVersion schon 11 ist', () => {
    const { facade } = applyFacadeLoadPipeline(invertedBranchFacade(), 11)
    const branch = facade.buildings[0]!.walls.find((wall) => wall.id === 'w6')!
    const source = facade.buildings[0]!.walls.find((wall) => wall.id === 'w5')!
    const joint = {
      x: source.originX ?? 0,
      z: source.originZ ?? 0,
    }
    const endX =
      (branch.originX ?? 0) + branch.width * Math.cos(((branch.yawDeg ?? 0) * Math.PI) / 180)
    const endZ =
      (branch.originZ ?? 0) - branch.width * Math.sin(((branch.yawDeg ?? 0) * Math.PI) / 180)
    expect(endX).toBeCloseTo(joint.x)
    expect(endZ).toBeCloseTo(joint.z)
    expect(branch.panelFlip).toBe(false)
  })
})

describe('schema 11→12 unveränderte Defaults', () => {
  it('setzt alte Fensterbank-Defaults und Klarglas-Transmission auf die neuen Werte', () => {
    const old = sparseWindow()
    old.sillOuter = { enabled: true, mode: 'board', depth: 32, thickness: 4 }
    old.glassMode = 'physical'
    old.glassColor = 'transparent'
    old.glassTransmission = 0.9
    const next = migrateUnchangedOpeningDefaults(facadeWithOpenings([old]))
    const opening = next.buildings[0]!.walls[0]!.openings[0]!
    expect(opening.sillOuter?.depth).toBe(16)
    expect(opening.glassTransmission).toBe(0)
  })

  it('setzt die Zwischen-Default-Transmission 0,42 ebenfalls auf 0', () => {
    const old = sparseWindow()
    old.glassMode = 'physical'
    old.glassTransmission = 0.42
    const next = migrateUnchangedOpeningDefaults(facadeWithOpenings([old]))
    expect(next.buildings[0]!.walls[0]!.openings[0]!.glassTransmission).toBe(0)
  })

  it('lässt vom Nutzer abweichende Werte unangetastet', () => {
    const custom = sparseWindow()
    custom.sillOuter = { enabled: true, mode: 'board', depth: 12, thickness: 4 }
    custom.glassMode = 'physical'
    custom.glassColor = '#6fa3c4'
    custom.glassTransmission = 0.55
    const next = migrateUnchangedOpeningDefaults(facadeWithOpenings([custom]))
    const opening = next.buildings[0]!.walls[0]!.openings[0]!
    expect(opening.sillOuter?.depth).toBe(12)
    expect(opening.glassColor).toBe('#6fa3c4')
    expect(opening.glassTransmission).toBe(0.55)
  })
})

describe('schema 12→13 Innenweiß', () => {
  it('setzt alte Decken-Defaults und fehlende Innenwandfarbe auf Weiß', () => {
    const raw = facadeWithOpenings([])
    raw.buildings[0]!.floors = [{ nodes: [], edges: [], ceilingColor: '#9a8a7a' }]
    const next = migrateIndoorWhiteDefaults(raw)
    expect(next.buildings[0]!.floors[0]!.ceilingColor).toBe('#ffffff')
    expect(next.buildings[0]!.walls[0]!.interiorColor).toBe('#ffffff')
  })

  it('lässt eine eigene Deckenfarbe unangetastet', () => {
    const raw = facadeWithOpenings([])
    raw.buildings[0]!.floors = [{ nodes: [], edges: [], ceilingColor: '#445566' }]
    const next = migrateIndoorWhiteDefaults(raw)
    expect(next.buildings[0]!.floors[0]!.ceilingColor).toBe('#445566')
  })

  it('Load-Pipeline hydriert Innenwandfarbe', () => {
    const { facade, schemaVersion } = applyFacadeLoadPipeline(facadeWithOpenings([]), 12)
    expect(schemaVersion).toBe(FACADE_SCHEMA_VERSION)
    expect(facade.buildings[0]!.walls[0]!.interiorColor).toBe('#ffffff')
    expect(facade.buildings[0]!.floors[0]!.ceilingColor).toBe('#ffffff')
  })
})

describe('hydrateWall', () => {
  it('setzt fehlende Innenwandfarbe auf Weiß', () => {
    const wall = hydrateWall(facadeWithOpenings([]).buildings[0]!.walls[0]!)
    expect(wall.interiorColor).toBe('#ffffff')
  })
})
