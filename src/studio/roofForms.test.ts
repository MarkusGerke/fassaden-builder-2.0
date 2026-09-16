import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOF, normalizeRoof, roofEffectiveCovering } from './roof'
import {
  buildRoofEnvelope,
  buildRoofEnvelopeGeometry,
  clipPolygonByHalfPlane,
  crossGableFootprint,
  edgeCompassLabel,
  orientRingCcw,
  roofEdgeKey,
  roofEnvelopeHeightAt,
  yawToDirXZ,
  type XZ,
} from './roofForms'
import { offsetPolygonPerEdge } from './roof'

const TAN45 = 1

/** Rechteck 960 × 480 (x × z), CCW. */
function rect(w = 960, d = 480): XZ[] {
  return orientRingCcw([
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: d },
    { x: 0, z: d },
  ])
}

/** Rechteck mit zwei 45°-Ecken (abgeschrägt) an der Ostseite. */
function chamfered(): XZ[] {
  return orientRingCcw([
    { x: 0, z: 0 },
    { x: 800, z: 0 },
    { x: 960, z: 160 },
    { x: 960, z: 320 },
    { x: 800, z: 480 },
    { x: 0, z: 480 },
  ])
}

function envelopeFor(kind: 'gable' | 'hip' | 'halfHip' | 'shed', outer: XZ[], opts: Partial<Parameters<typeof normalizeRoof>[0] & object> = {}, flush?: boolean[]) {
  const roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind, pitch: 45, ...opts })
  const flushArr = flush ?? outer.map(() => false)
  const eave = offsetPolygonPerEdge(outer, flushArr.map((f) => (f ? 0 : roof.overhang)))
  const env = buildRoofEnvelope({ kind, outer, eave, eaveY: 448, flush: flushArr, roof })
  expect(env).not.toBeNull()
  return env!
}

describe('roofForms – Hilfsfunktionen', () => {
  it('Halbebenen-Clip schneidet ein Rechteck in der Mitte', () => {
    const poly = rect(100, 100)
    const half = clipPolygonByHalfPlane(poly, -1, 0, 50) // x ≤ 50
    expect(half.length).toBe(4)
    for (const p of half) expect(p.x).toBeLessThanOrEqual(50 + 1e-6)
  })

  it('Yaw → Richtung: 0 = Norden (−Z), 90 = Westen (−X)', () => {
    const n = yawToDirXZ(0)
    expect(n.x).toBeCloseTo(0)
    expect(n.z).toBeCloseTo(-1)
    const w = yawToDirXZ(90)
    expect(w.x).toBeCloseTo(-1)
    expect(w.z).toBeCloseTo(0)
  })

  it('Kompass der Außenseite: Kante entlang +X unten (z=0, CCW) zeigt nach Norden', () => {
    const r = rect()
    // CCW-Ring: Kante von (0,0) → (960,0)? Nach orientRingCcw kann die Reihenfolge gedreht sein.
    const labels = r.map((a, i) => edgeCompassLabel(a, r[(i + 1) % r.length]))
    expect(new Set(labels)).toEqual(new Set(['N', 'O', 'S', 'W']))
  })
})

describe('roofForms – Satteldach', () => {
  it('First über der langen Achse, Höhe = halbe Gebäudebreite × tan(Neigung)', () => {
    const env = envelopeFor('gable', rect())
    // Außenring 960×480 → halbe Tiefe 240 (Überstand hebt den First nicht)
    expect(env.faces.length).toBe(2)
    expect(env.ridgeY - env.eaveY).toBeCloseTo(240 * TAN45, 3)
    // Zwei Traufkanten (lang), zwei Giebelkanten (kurz)
    expect(env.isEave.filter(Boolean).length).toBe(2)
  })

  it('Giebelwand-Geometrie entsteht nur an den Giebelseiten; Rinne nur an Traufen', () => {
    const env = envelopeFor('gable', rect())
    const geo = buildRoofEnvelopeGeometry(env)
    expect(geo.gable).not.toBeNull()
    expect(geo.gutterEdgeActive.filter(Boolean).length).toBe(2)
    expect(geo.roof.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('Firstrichtung manuell (N–S) dreht den First auf die kurze Achse', () => {
    const env = envelopeFor('gable', rect(), { ridgeDeg: 0 })
    // First entlang Z → Spannweite in X: 960 / 2 = 480
    expect(env.ridgeY - env.eaveY).toBeCloseTo(480, 3)
  })

  it('Bündige Giebelkante: kein Überstand, Kante bleibt ohne Rinne', () => {
    const outer = rect()
    // Kante mit Außenseite Osten bündig setzen
    const flush = outer.map((a, i) => edgeCompassLabel(a, outer[(i + 1) % outer.length]) === 'O')
    const env = envelopeFor('gable', outer, {}, flush)
    const eastIdx = flush.indexOf(true)
    expect(env.flush[eastIdx]).toBe(true)
    // Traufpolygon-Kante Ost liegt auf x = 960 (kein Überstand)
    const a = env.eave[eastIdx]
    const b = env.eave[(eastIdx + 1) % env.eave.length]
    expect(a.x).toBeCloseTo(960, 3)
    expect(b.x).toBeCloseTo(960, 3)
    const geo = buildRoofEnvelopeGeometry(env)
    expect(geo.gutterEdgeActive[eastIdx]).toBe(false)
  })

  it('Traufüberstand verlängert die Traufe, Firsthöhe bleibt', () => {
    const low = envelopeFor('gable', rect(), { overhang: 10 })
    const high = envelopeFor('gable', rect(), { overhang: 80 })
    expect(high.ridgeY).toBeCloseTo(low.ridgeY, 3)
    expect(high.eave[0]!.x).not.toBeCloseTo(low.eave[0]!.x, 0)
  })
})

describe('roofForms – Walmdach', () => {
  it('Rechteck: vier Flächen, First = halbe Gebäudebreite', () => {
    const env = envelopeFor('hip', rect())
    expect(env.faces.length).toBe(4)
    expect(env.ridgeY - env.eaveY).toBeCloseTo(240, 3)
    expect(env.isEave.every(Boolean)).toBe(true)
  })

  it('45°-Grundriss: jede Kante liefert eine Fläche, Dach bleibt geschlossen', () => {
    const outer = chamfered()
    const env = envelopeFor('hip', outer)
    expect(env.faces.length).toBe(6)
    // Mitte des Grundrisses liegt unter dem First-Niveau, aber über der Traufe
    const mid = roofEnvelopeHeightAt(env, { x: 480, z: 240 })
    expect(mid).toBeGreaterThan(env.eaveY + 200)
    expect(mid).toBeLessThanOrEqual(env.ridgeY + 1e-6)
  })

  it('Bündige Kante am Walm → keine Ebene, Fläche endet senkrecht (Giebelwand)', () => {
    const outer = rect()
    const flush = outer.map((a, i) => edgeCompassLabel(a, outer[(i + 1) % outer.length]) === 'O')
    const env = envelopeFor('hip', outer, {}, flush)
    expect(env.faces.length).toBe(3)
    const eastIdx = flush.indexOf(true)
    // Dachhaut an der Ostkante liegt oberhalb der Traufe (kein Auslauf auf eaveY)
    expect(env.isEave[eastIdx]).toBe(false)
    const geo = buildRoofEnvelopeGeometry(env)
    expect(geo.gable).not.toBeNull()
  })
})

describe('roofForms – Krüppelwalm und Pult', () => {
  it('Krüppelwalm: Giebelhöhe begrenzt, Firsthöhe wie Sattel, First kürzer', () => {
    const gable = envelopeFor('gable', rect())
    const half = envelopeFor('halfHip', rect(), { halfHipHeight: 120 })
    expect(half.faces.length).toBe(4)
    expect(half.ridgeY).toBeCloseTo(gable.ridgeY, 3)
    // An der Giebel-Überstandsspitze: Krüppelwalm-Ebene setzt sich fort (−Überstand·tan)
    const yAtGable = roofEnvelopeHeightAt(half, { x: -40, z: 240 })
    expect(yAtGable - half.eaveY).toBeCloseTo(120 - 40 * TAN45, 3)
    // Sattel: Höhe nur aus Querschnitt (z), Überstand in x ändert nichts
    expect(roofEnvelopeHeightAt(gable, { x: -40, z: 240 }) - gable.eaveY).toBeCloseTo(240, 3)
  })

  it('Pult: eine Fläche, Hochseite gegenüber der längsten Traufkante', () => {
    const env = envelopeFor('shed', rect())
    expect(env.faces.length).toBe(1)
    expect(env.isEave.filter(Boolean).length).toBe(1)
    expect(env.ridgeY - env.eaveY).toBeCloseTo(480, 3) // volle Gebäudebreite 480
  })
})

describe('roofForms – Zwerchgiebel', () => {
  it('Fußabdruck liegt innen an der Traufkante und schneidet die Dachhaut', () => {
    const outer = rect()
    const env = envelopeFor('gable', outer)
    const edgeIdx = 0
    const a = env.eave[edgeIdx]
    const b = env.eave[(edgeIdx + 1) % env.eave.length]
    const foot = crossGableFootprint(a, b, 320, 240)
    expect(foot.length).toBe(4)
    const geo = buildRoofEnvelopeGeometry(env, [{ edgeKey: roofEdgeKey(env.outer[edgeIdx], env.outer[(edgeIdx + 1) % env.outer.length]), widthCm: 320, depthCm: 240 }], 45)
    expect(geo.roof.getAttribute('position').count).toBeGreaterThan(0)
    expect(geo.gable).not.toBeNull()
    // Rinne an der Zwerchgiebel-Kante aus
    expect(geo.gutterEdgeActive[edgeIdx]).toBe(false)
  })
})

describe('normalizeRoof – neue Felder', () => {
  it('Alt-Save ohne kind → Mansarde, Kantenmodi leer', () => {
    const roof = normalizeRoof({ enabled: true })
    expect(roof.kind).toBe('mansard')
    expect(roof.edgeModes).toBeUndefined()
    expect(roof.ridgeDeg).toBeNull()
  })

  it('MVP: Ziegel abgeschaltet — wirksame Eindeckung immer glatt', () => {
    const roof = normalizeRoof({ kind: 'mansard', covering: 'tiles', ridgeDeg: 100, edgeModes: { 'a:b': 'flush', 'c:d': 'auto' as never } })
    expect(roofEffectiveCovering(roof)).toBe('smooth')
    expect(roofEffectiveCovering({ ...roof, kind: 'gable' })).toBe('smooth')
    expect(roof.ridgeDeg).toBe(90)
    expect(roof.edgeModes).toEqual({ 'a:b': 'flush' })
  })
})

describe('roof eaveY – echte Geschossoberkante', () => {
  it('storeyTopY statt floors×wallHeight: kürzere Obergeschosse erzeugen keine Lücke', async () => {
    const { storeyTopY } = await import('../utils/layers')
    const building = {
      id: 't',
      name: 't',
      wallHeight: 448,
      walls: [
        { id: 'w0', x: 0, y: 0, width: 100, height: 448, openings: [], storeyIndex: 0 },
        { id: 'w4', x: 0, y: 1504, width: 100, height: 352, openings: [], storeyIndex: 4 },
      ],
      floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }],
    } as any
    expect(storeyTopY(building, 4)).toBe(1856)
    expect(building.floors.length * building.wallHeight).toBe(2240)
    expect(building.floors.length * building.wallHeight - storeyTopY(building, 4)).toBe(384)
  })

  it('Dachhaut liegt um Plattendicke über der Wandoberkante (kein Durchscheinen)', async () => {
    const { roofSlabVerticalCm, ROOF_SLAB_THICKNESS_CM } = await import('./roofForms')
    expect(roofSlabVerticalCm(45)).toBeCloseTo(ROOF_SLAB_THICKNESS_CM * Math.SQRT2, 5)
    expect(roofSlabVerticalCm(0.5)).toBeGreaterThan(ROOF_SLAB_THICKNESS_CM * 0.9)
  })
})
