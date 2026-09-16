import { describe, expect, it } from 'vitest'
import type { Building, Opening, RoofDormerKind } from '../types/facade'
import { ROOF_DORMER_KINDS, normalizeRoofDormerKind } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { normalizeRoof } from './roof'
import {
  buildDormerMeshes,
  createDormerFixture,
  createSkylightFixture,
  dormerAnchorForEavePlacement,
  dormerEavePlacement,
  dormerFootprint,
  dormerRoofHoles,
  DORMER_WINDOW_TOP_MARGIN_CM,
  fitDormerWindow,
  footprintsOverlap,
  resolveDormerModel,
  roofEaveCuts,
  roofEaveInfo,
  roofOpeningHoles,
} from './roofOpenings'
import { pointInPolygonXZ } from './floorPlan'
import type { XZ } from './roofForms'

function isConvexCcw(poly: XZ[]): boolean {
  if (poly.length < 3) return false
  let sign = 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const c = poly[(i + 2) % poly.length]
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
    if (Math.abs(cross) < 1e-6) continue
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

function gableHouse(): Building {
  return {
    id: 'b1',
    name: 'T',
    wallHeight: 448,
    wallDepth: WALL_DEPTH,
    walls: [],
    floors: [
      {
        nodes: [
          { id: 'a', gx: 0, gz: 0 },
          { id: 'b', gx: 60, gz: 0 },
          { id: 'c', gx: 60, gz: 36 },
          { id: 'd', gx: 0, gz: 36 },
        ],
        edges: [
          { id: 'e1', fromId: 'a', toId: 'b' },
          { id: 'e2', fromId: 'b', toId: 'c' },
          { id: 'e3', fromId: 'c', toId: 'd' },
          { id: 'e4', fromId: 'd', toId: 'a' },
        ],
      },
    ],
    roof: normalizeRoof({ enabled: true, kind: 'gable', pitch: 45 }),
  }
}

describe('roofOpenings light', () => {
  it('normalizeRoof clampt Skylight/Gaube und mappt shed → shedStraight', () => {
    const roof = normalizeRoof({
      enabled: true,
      skylights: [{ id: 's1', x: 10, z: 20, widthCm: 77, heightCm: 123 }],
      dormers: [{ id: 'd1', kind: 'shed' as never, x: 1, z: 2, widthCm: 155, depthCm: 119, heightCm: 141 }],
    })
    expect(roof.skylights?.[0]?.widthCm).toBe(80)
    expect(roof.skylights?.[0]?.heightCm).toBe(120)
    expect(roof.dormers?.[0]?.kind).toBe('shedStraight')
    expect(roof.dormers?.[0]?.widthCm).toBe(152)
    expect(roof.dormers?.[0]?.heightCm).toBe(144)
  })

  it('normalizeRoofDormerKind kennt alle Wikipedia-Formen', () => {
    expect(normalizeRoofDormerKind('shed')).toBe('shedStraight')
    expect(normalizeRoofDormerKind('unknown')).toBe('gable')
    for (const kind of ROOF_DORMER_KINDS) {
      expect(normalizeRoofDormerKind(kind)).toBe(kind)
    }
  })

  it('footprintsOverlap', () => {
    const a = [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
      { x: 0, z: 100 },
    ]
    const b = [
      { x: 50, z: 50 },
      { x: 150, z: 50 },
      { x: 150, z: 150 },
      { x: 50, z: 150 },
    ]
    expect(footprintsOverlap(a, b)).toBe(true)
  })

  it('create helpers', () => {
    expect(createSkylightFixture(1, 2).id).toBeTruthy()
    expect(createDormerFixture('gable', 1, 2).kind).toBe('gable')
    expect(createDormerFixture('shedStraight', 1, 2).kind).toBe('shedStraight')
  })

  it('alle Gaubenformen erzeugen Wände, Dach, Blenden, Fenster und konvexes Loch', () => {
    const building = gableHouse()
    const roof = building.roof!
    const cx = 240
    const cz = 72
    for (const kind of ROOF_DORMER_KINDS) {
      const d = createDormerFixture(kind as RoofDormerKind, cx, cz)
      const foot = dormerFootprint(building, roof, d)
      expect(foot, kind).toBeTruthy()
      expect(foot!.length, kind).toBeGreaterThanOrEqual(4)
      const mesh = buildDormerMeshes(building, roof, d)
      expect(mesh, kind).toBeTruthy()
      expect(mesh!.roof.getAttribute('position')!.count, kind).toBeGreaterThan(2)
      expect(mesh!.shell.getAttribute('position')!.count, kind).toBeGreaterThan(2)
      expect(mesh!.trim.getAttribute('position')!.count, kind).toBeGreaterThan(2)
      expect(mesh!.window, kind).toBeTruthy()
      // Fensterfront zeigt hangabwärts (Betrachter), Oben = +Y.
      expect(mesh!.window!.outward.y).toBeCloseTo(0, 6)
      expect(mesh!.window!.up.y).toBe(1)
      const holes = dormerRoofHoles(mesh!.model)
      expect(holes.length, kind).toBeGreaterThanOrEqual(1)
      for (const hole of holes) {
        expect(isConvexCcw(hole), `${kind} hole convex`).toBe(true)
        // Loch liegt im äußeren Fußabdruck.
        for (const p of hole) expect(pointInPolygonXZ(p.x, p.z, foot!), `${kind} hole in footprint`).toBe(true)
      }
      mesh!.shell.dispose()
      mesh!.roof.dispose()
      mesh!.trim.dispose()
    }
  })

  it('Giebelgaube: Kehle vor der Tiefe-Kappe, keine Rückwand; First auf Wandhöhe + Neigung', () => {
    const building = gableHouse()
    const roof = building.roof!
    const d = createDormerFixture('gable', 240, 72, 160, 400, 140)
    const model = resolveDormerModel(building, roof, d)!
    expect(model).toBeTruthy()
    expect(model.hasBackWall).toBe(false)
    // tanM = 1 (45°), Firstanhebung = 140 + tan40°·80 ≈ 207 → Kehle bei v ≈ 207.
    const ridgeRise = 140 + Math.tan((40 * Math.PI) / 180) * 80
    expect(model.actualDepthCm).toBeCloseTo(ridgeRise / model.tanM, 0)
    expect(model.topAt(0, 0) - model.y0).toBeCloseTo(ridgeRise, 6)
    expect(model.topAt(80, 0) - model.y0).toBeCloseTo(140, 6)
    // Fenster passt zwischen die Wangen (Wandstärke 20 + 8 Rand).
    expect(model.window!.width).toBeLessThanOrEqual(160 - 2 * 28)
    expect(model.window!.x).toBeGreaterThanOrEqual(28)
  })

  it('kurze gespeicherte Tiefe (Bibliothek 120) → trotzdem Kehle, keine stumpfe Rückwand', () => {
    const building = gableHouse()
    const roof = building.roof!
    for (const kind of ['gable', 'pointed', 'shedTrapez', 'shedStraight', 'barrel'] as const) {
      const d = createDormerFixture(kind, 240, 72, 160, 120, 140)
      const model = resolveDormerModel(building, roof, d)!
      expect(model.hasBackWall, kind).toBe(false)
      // Kehle ≥ Fronthöhe/tanM; bei Spitz ≈ 140, sonst oft > 200 — jedenfalls > Kappe 120.
      expect(model.actualDepthCm, kind).toBeGreaterThan(120)
      expect(model.window, kind).toBeTruthy()
      const holes = dormerRoofHoles(model)
      expect(holes.length, kind).toBeGreaterThanOrEqual(1)
      const mesh = buildDormerMeshes(building, roof, d)
      expect(mesh?.window, kind).toBeTruthy()
    }
  })

  it('Spitz- und Fledermausgaube: Fenster liegt unter dem Frontprofil', () => {
    const building = gableHouse()
    const roof = building.roof!
    for (const kind of ['pointed', 'bat'] as const) {
      const d = createDormerFixture(kind, 240, 72)
      const model = resolveDormerModel(building, roof, d)!
      expect(model.window, kind).toBeTruthy()
      const w = model.window!
      const uL = w.x - model.widthCm / 2
      const uR = uL + w.width
      const yTop = model.yBase + w.y + w.height + DORMER_WINDOW_TOP_MARGIN_CM
      for (const u of [uL, (uL + uR) / 2, uR]) {
        expect(model.topAt(u, 0), `${kind} @${u}`).toBeGreaterThanOrEqual(yTop - 0.5)
      }
      expect(buildDormerMeshes(building, roof, d)?.window, kind).toBeTruthy()
    }
  })

  it('Schleppgaube steiler als Hauptdach → Rückwand an der Kappe', () => {
    const building = gableHouse()
    const roof = building.roof!
    const d = { ...createDormerFixture('shedStraight', 240, 72, 160, 200, 120), roofPitchDeg: 50 }
    const model = resolveDormerModel(building, roof, d)!
    expect(model.hasBackWall).toBe(true)
    expect(model.actualDepthCm).toBe(200)
    const mesh = buildDormerMeshes(building, roof, d)!
    expect(mesh.shell.getAttribute('position')!.count).toBeGreaterThan(0)
  })

  it('Walm ohne Firstgrat: Spitze der Walmflächen liegt auf der Kehle', () => {
    const building = gableHouse()
    const roof = building.roof!
    const model = resolveDormerModel(building, roof, createDormerFixture('hipNoRidge', 240, 72, 160, 400, 140))!
    const planes = model.planes!
    const front = planes.find((p) => p.a === 0 && p.b > 0)!
    const side = planes.find((p) => p.a > 0)!
    // Schnitt Frontwalm ∩ First (u=0): v = (c_side − c_front)/b_front
    const vApex = (side.c - front.c) / front.b
    // actualDepthCm wird per Bisektion mit 0,5-cm-Schwelle gesucht → ±2 cm.
    expect(Math.abs(vApex - model.actualDepthCm)).toBeLessThan(2)
  })

  it('Traufdurchbruch: Front auf der Wandlinie, Unterkante Traufe, Rinnenschnitt + zwei Löcher', () => {
    const building = gableHouse()
    const roof = building.roof!
    const info = roofEaveInfo(building, roof)!
    const d = { ...createDormerFixture('gable', 240, 72, 160, 400, 140), eaveBreak: true }
    const model = resolveDormerModel(building, roof, d)!
    expect(model.eaveBreak).toBe(true)
    expect(model.yBase).toBeCloseTo(info.eaveY, 3)
    expect(model.vEave).not.toBeNull()
    expect(model.vEave!).toBeLessThan(0)
    // Frontwand-Mitte liegt auf der Wandlinie (z = 0 der Südkante).
    expect(Math.abs(model.origin.z)).toBeLessThan(0.5)
    const holes = dormerRoofHoles(model)
    expect(holes.length).toBe(2)
    const cuts = roofEaveCuts(building, roof)
    expect(cuts.length).toBe(0) // roof.dormers ist leer
    const withDormer = { ...roof, dormers: [d] }
    expect(roofEaveCuts(building, withDormer).length).toBe(1)
    expect(roofOpeningHoles(building, withDormer).length).toBe(2)
  })

  it('fitDormerWindow clampt zu breite/hohe Fenster', () => {
    const building = gableHouse()
    const roof = building.roof!
    const model = resolveDormerModel(building, roof, createDormerFixture('gable', 240, 72, 160, 400, 140))!
    const fitted = fitDormerWindow(model, { id: 'w', type: 'window', x: 0, y: 4, width: 400, height: 900 })!
    expect(fitted.width).toBe(160 - 2 * 28)
    expect(fitted.y).toBe(8)
    expect(fitted.height + fitted.y + 10).toBeLessThanOrEqual(model.topAt(fitted.x - 80, 0) - model.yBase + 1)
  })

  it('Gaubenfenster kommt aus der Öffnungs-Logik und erbt den Hausstil', () => {
    const win = createDormerFixture('gable', 240, 72).window!
    // Feldkatalog wie eine Wandöffnung (Gründerzeit-Teilung, Glas, Bank).
    expect(win.gruenderzeit).toBeTruthy()
    expect(win.glassMode).toBeTruthy()
    expect(win.sillOuter?.enabled).toBe(true)

    const donor: Opening = {
      ...win,
      id: 'haus-fenster',
      frameColor: '#123456',
      glassColor: '#abcdef',
    }
    const inherited = createDormerFixture('gable', 240, 72, 160, 400, 140, [
      { openings: [donor] },
    ]).window!
    expect(inherited.frameColor).toBe('#123456')
    expect(inherited.glassColor).toBe('#abcdef')
  })

  it('Fenster ausblenden: kein Fenster, kein Loch in der Frontwand', () => {
    const building = gableHouse()
    const roof = building.roof!
    const d = createDormerFixture('gable', 240, 72)
    const withWindow = resolveDormerModel(building, roof, d)!
    expect(withWindow.window).toBeTruthy()
    const hiddenWin = { ...d, window: { ...d.window!, hidden: true } }
    const model = resolveDormerModel(building, roof, hiddenWin)!
    expect(model.window).toBeNull()
    const mesh = buildDormerMeshes(building, roof, hiddenWin)!
    expect(mesh.window).toBeNull()
    // Frontwand ohne Loch hat weniger Dreiecke als mit Fenster.
    const solid = mesh.shell.getIndex()!.count
    const perforated = buildDormerMeshes(building, roof, d)!.shell.getIndex()!.count
    expect(solid).toBeLessThan(perforated)
  })

  it('Traufposition: Abstand und Lauf auf der Traufkante setzen den Anker', () => {
    const building = gableHouse()
    const roof = building.roof!
    const d = createDormerFixture('gable', 240, 72)
    const placement = dormerEavePlacement(building, roof, d)!
    expect(placement.distanceCm).toBeGreaterThan(0)
    expect(placement.edgeLengthCm).toBeGreaterThan(0)

    const nearerEave = placement.distanceCm / 2
    const moved = dormerAnchorForEavePlacement(building, roof, d, { distanceCm: nearerEave })!
    const after = dormerEavePlacement(building, roof, moved)!
    expect(after.distanceCm).toBeCloseTo(nearerEave, 1)
    expect(after.alongCm).toBeCloseTo(placement.alongCm, 1)

    const slidTo = placement.alongCm / 2
    const slid = dormerAnchorForEavePlacement(building, roof, d, { alongCm: slidTo })!
    const afterSlide = dormerEavePlacement(building, roof, slid)!
    expect(afterSlide.alongCm).toBeCloseTo(slidTo, 1)
    expect(afterSlide.distanceCm).toBeCloseTo(placement.distanceCm, 1)
  })

  it('Fledermaus: Loch unter dem Buckel, Fenster unter dem Scheitel', () => {
    const building = gableHouse()
    const roof = building.roof!
    const d = createDormerFixture('bat', 240, 72)
    expect(d.widthCm).toBeGreaterThanOrEqual(320)
    const model = resolveDormerModel(building, roof, d)!
    expect(model.planes).toBeNull()
    expect(model.topAt(0, 0) - model.y0).toBeCloseTo(d.heightCm, 6)
    expect(model.topAt(d.widthCm / 2, 0) - model.y0).toBeCloseTo(0, 6)
    expect(model.topAt(0, d.depthCm) - model.roofAt(d.depthCm)).toBeCloseTo(0, 6)
    expect(model.window).toBeTruthy()
  })
})
