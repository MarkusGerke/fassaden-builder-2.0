import { describe, expect, it } from 'vitest'
import {
  insertBayAsWallSegment,
  migrateBaysToOuterOrigin,
  migrateFlushBayPanelsToDepth,
  slideBaySegmentAlong,
} from './baySegment'
import { BAY_WINDOW_PRESETS } from './bayWindow'
import {
  createStudioWall,
  panelMiterEnds,
  studioPanelFaceLocalZ,
  wallEndPoint,
  wallStartPoint,
} from './walls'
import { studioMiterLocalX } from './wallMiterX'
import { normalizeYawDeg } from './compass'
import { finalizeStudioGeometry } from './planGeometry'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from './constants'
import { layoutPanelTiles } from './panelLayout'
import { WALL_DEPTH } from '../constants/presets'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { createId } from '../utils/id'

/**
 * v2.0.305: Erker-Planlinie = Außenkante (wie Außenwände seit v0.7.279).
 * Symptom vorher: Host mit Innen-Origin (`panelFlip: false`) → Erker-Wände ebenfalls
 * Innen-Origin → sichtbare Front an den 90°-Ecken 384 + 2×24 = 432 cm, Läufer-Muster
 * mit 24-cm-Stummeln je Seite („optisch 24 cm breiter als die Größenangabe“).
 */

function preset384() {
  return BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f384-d96-rect')!
}

function stateWithWall(wall: Wall): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'B',
        wallHeight: 512,
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

function hostWall(panelFlip: boolean): Wall {
  return {
    ...createStudioWall(0, 0),
    id: createId(),
    width: 768,
    height: 512,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    x: 0,
    yawDeg: 0,
    panelFlip,
    planLinked: true,
    neighbors: emptyNeighbors(),
  }
}

function visibleFrontLen(front: Wall, walls: Wall[]): number {
  const m = panelMiterEnds(front, walls)
  const fz = studioPanelFaceLocalZ(front)
  return (
    studioMiterLocalX(front, front.width, fz, m.start, m.end) -
    studioMiterLocalX(front, 0, fz, m.start, m.end)
  )
}

/** Alt-Erker nachbauen: jede Fläche 180° gedreht mit panelFlip=false (Innen-Origin). */
function legacyInnerOrigin(wall: Wall): Wall {
  const finish = wallEndPoint(wall)
  return {
    ...wall,
    originX: finish.x,
    originZ: finish.z,
    x: finish.x,
    yawDeg: normalizeYawDeg((wall.yawDeg ?? 0) + 180),
    panelFlip: false,
    openings: wall.openings.map((o) => ({ ...o, x: wall.width - o.x - o.width })),
  }
}

describe('Erker: Planlinie = Außenkante (v2.0.305)', () => {
  it.each([true, false])('Host panelFlip=%s → Front/Schenkel panelFlip true, sichtbare Front 384', (flip) => {
    const host = hostWall(flip)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const walls = inserted.state.buildings[0]!.walls
    const front = walls.find((w) => w.bayRole === 'front')!
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(front.width).toBe(384)
    expect(front.depth).toBe(24)
    expect(front.panelFlip).toBe(true)
    for (const s of sides) expect(s.panelFlip).toBe(true)
    // Steinfront (Vorstand 4, v2.0.307) an den 90°-Gehrungen 384 + 2×4 — Trapez-Ecksteine,
    // Raster bleibt auf 384 (siehe Test unten). Vorher (Innen-Origin) waren es 384 + 2×24.
    const pd = front.panel?.projectDepth ?? 0
    expect(visibleFrontLen(front, walls)).toBeCloseTo(384 + 2 * pd, 3)
    // Außenkante des Körpers 384 (Gehrung nur nach innen)
    const outerZ = 0
    const outer =
      studioMiterLocalX(front, front.width, outerZ, true, true) -
      studioMiterLocalX(front, 0, outerZ, true, true)
    expect(outer).toBeCloseTo(384, 3)
    // Mund-Konvention: erster Schenkel startet am Mund, letzter endet am Mund.
    const hostWallNow = walls.find((w) => w.bayWindow)!
    const ordered = hostWallNow.bayWindow!.wallIds
      .map((id) => walls.find((w) => w.id === id)!)
      .filter((w) => w.bayRole === 'side')
    expect(Math.abs(wallStartPoint(ordered[0]!).z)).toBeLessThan(1e-6)
    expect(Math.abs(wallEndPoint(ordered[1]!).z)).toBeLessThan(1e-6)
  })

  it('Vorstand 4 an Außen-Origin-Ecke: Raster bleibt auf 384 (8×48 / 0,5+7+0,5), kein 8-cm-Stummel', () => {
    // Live-Befund v2.0.305: Paneelfront (z = −4) ist an der 90°-Gehrung 392 lang →
    // Front-Layout legte 8×48 + 9,6 bzw. 23,6 + 7×48 + 33,6.
    const host = hostWall(true)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const walls = inserted.state.buildings[0]!.walls.map((w) =>
      w.bayRole === 'front' || w.bayRole === 'side'
        ? { ...w, panel: normalizeStudioPanel({ ...(w.panel ?? DEFAULT_STUDIO_PANEL), projectDepth: 4, taperDepth: 1 }) }
        : w,
    )
    const front = walls.find((w) => w.bayRole === 'front')!
    const panel = normalizeStudioPanel(front.panel!)
    const tiles = layoutPanelTiles(front, panel, walls)
    const ys = [...new Set(tiles.map((t) => Math.round(t.y + t.height / 2)))].sort((a, b) => a - b)
    const row = (y: number) =>
      tiles
        .filter((t) => Math.abs(t.y + t.height / 2 - y) < 2)
        .sort((a, b) => a.x - b.x)
        // Fugenhälften: Endsteine 47,6, Mittelsteine 47,2, Halbsteine 23,6 → auf 8er-Modul runden
        .map((t) => Math.round(t.width / 8) * 8)
    // Unterste Lagen liegen unter den Fenstern → durchgehend.
    const even = row(ys[0]!)
    const odd = row(ys[1]!)
    const full = even.length === 8 ? even : odd
    const half = even.length === 8 ? odd : even
    expect(full).toEqual([48, 48, 48, 48, 48, 48, 48, 48])
    expect(half).toEqual([24, 48, 48, 48, 48, 48, 48, 48, 24])
  })

  it('Schieben funktioniert auch mit umgedrehtem Umlauf (Host panelFlip=false)', () => {
    const host = hostWall(false)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const hostNow = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const before = inserted.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    const slid = slideBaySegmentAlong(inserted.state, hostNow.id, 64)
    expect(slid).not.toBeNull()
    const after = slid!.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    const mid = (w: Wall) => (wallStartPoint(w).x + wallEndPoint(w).x) / 2
    expect(Math.abs(mid(after) - mid(before))).toBeCloseTo(64, 3)
  })

  it('Migration Schema 19: Alt-Erker mit Innen-Origin wird auf Außenkante neu aufgebaut', () => {
    const host = hostWall(false)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const hostNow = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const memberIds = new Set(hostNow.bayWindow!.wallIds)
    const legacyWalls = inserted.state.buildings[0]!.walls.map((w) =>
      memberIds.has(w.id) && (w.bayRole === 'front' || w.bayRole === 'side') ? legacyInnerOrigin(w) : w,
    )
    const legacyHost = legacyWalls.find((w) => w.bayWindow)!
    // Alt-Reihenfolge: Umlauf umgekehrt → wallIds spiegeln, damit sides[0] wieder am Mund startet
    legacyHost.bayWindow = { ...legacyHost.bayWindow!, wallIds: [...legacyHost.bayWindow!.wallIds].reverse() }
    const legacyState = finalizeStudioGeometry({
      ...inserted.state,
      buildings: [{ ...inserted.state.buildings[0]!, walls: legacyWalls }],
    })
    const legacyFinal = legacyState.buildings[0]!.walls
    const legacyFront = legacyFinal.find((w) => w.bayRole === 'front')!
    expect(legacyFront.panelFlip).toBe(false)
    // Alt-Zustand reproduziert: sichtbare Front 384 + 2×24 (+ 2×Vorstand) = 432 (+8)
    const pdLegacy = legacyFront.panel?.projectDepth ?? 0
    expect(visibleFrontLen(legacyFront, legacyFinal)).toBeCloseTo(432 + 2 * pdLegacy, 3)

    const migrated = migrateBaysToOuterOrigin(legacyState)
    const walls = migrated.buildings[0]!.walls
    const front = walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBe(384)
    expect(front.panelFlip).toBe(true)
    for (const s of walls.filter((w) => w.bayRole === 'side')) expect(s.panelFlip).toBe(true)
    const pd = front.panel?.projectDepth ?? 0
    expect(visibleFrontLen(front, walls)).toBeCloseTo(384 + 2 * pd, 3)
    // Mund bleibt an derselben Stelle (192…576 auf dem Host)
    const sides = walls.filter((w) => w.bayRole === 'side')
    const mouthXs = sides
      .map((s) => [wallStartPoint(s), wallEndPoint(s)].find((p) => Math.abs(p.z) < 1e-6)!.x)
      .sort((a, b) => a - b)
    expect(mouthXs[0]).toBeCloseTo(192, 3)
    expect(mouthXs[1]).toBeCloseTo(576, 3)
  })

  it('v2.0.307: Bibliothek-Erker bekommen Steine mit Dicke (Vorstand 4 / Bosse 1), kein projectDepth 0', () => {
    // v2.0.304 erzwang projectDepth/taperDepth 0 → Steine ohne Dicke 0,15 cm vor der
    // Wandschale → weiß/beige Streifen (Z-Fight) ab ~10 m, besonders beim Orbit.
    const host = hostWall(true)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const members = inserted.state.buildings[0]!.walls.filter((w) => w.bayRole === 'front' || w.bayRole === 'side')
    expect(members).toHaveLength(3)
    for (const w of members) {
      expect(w.panel?.projectDepth).toBe(4)
      expect(w.panel?.taperDepth).toBe(1)
    }
  })

  it('Migration Schema 20: Erker-Paneele ohne Dicke (v2.0.304) → Vorstand 4 / Bosse 1', () => {
    const host = hostWall(true)
    const inserted = insertBayAsWallSegment(stateWithWall(host), host.id, preset384(), 384)!
    const flushState: FacadeState = {
      ...inserted.state,
      buildings: [
        {
          ...inserted.state.buildings[0]!,
          walls: inserted.state.buildings[0]!.walls.map((w) =>
            w.bayRole
              ? { ...w, panel: normalizeStudioPanel({ ...(w.panel ?? DEFAULT_STUDIO_PANEL), projectDepth: 0, taperDepth: 0 }) }
              : w,
          ),
        },
      ],
    }
    const migrated = migrateFlushBayPanelsToDepth(flushState)
    const walls = migrated.buildings[0]!.walls
    for (const w of walls.filter((w) => w.bayRole)) {
      expect(w.panel?.projectDepth).toBe(4)
      expect(w.panel?.taperDepth).toBe(1)
      // Breite/Höhe/Muster unangetastet
      expect(w.panel?.pattern).toBe('runningBond')
      expect(w.panel?.panelWidth).toBe(48)
    }
    // Host (kein bayRole) bleibt unverändert
    const hostNow = walls.find((w) => w.bayWindow)!
    expect(hostNow.panel?.projectDepth).toBe(host.panel?.projectDepth ?? DEFAULT_STUDIO_PANEL.projectDepth)
    // Idempotent
    expect(migrateFlushBayPanelsToDepth(migrated)).toBe(migrated)
  })
})
