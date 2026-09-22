import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOF, normalizeRoof, roofEffectiveCovering } from './roof'
import {
  buildRoofEnvelope,
  buildRoofEnvelopeGeometry,
  clipPolygonByHalfPlane,
  crossGableFootprint,
  edgeCompassLabel,
  edgeOutwardXZ,
  orientRingCcw,
  roofEdgeKey,
  roofEnvelopeHeightAt,
  yawToDirXZ,
  roofKindUsesRidgeDir,
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

  it('Kasten-Traufe: Füllung zwischen Wandoberkante und Dachunterseite (Soffit)', () => {
    const env = envelopeFor('gable', rect(), { overhang: 48 })
    const geo = buildRoofEnvelopeGeometry(env)
    expect(geo.gable).not.toBeNull()
    const pos = geo.gable!.getAttribute('position')
    expect(pos.count).toBeGreaterThan(24)
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    expect(minY).toBeLessThanOrEqual(env.wallTopY + 1)
    expect(maxY).toBeGreaterThanOrEqual(env.eaveY - env.tv - 1)
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

  it('ridgeRiseCm setzt First über Traufe (pitch nur Fallback)', () => {
    const env = envelopeFor('gable', rect(), { ridgeRiseCm: 200, pitch: 12 })
    expect(env.ridgeY - env.eaveY).toBeCloseTo(200, 3)
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

describe('roofForms – Kastentraufe', () => {
  it('Untersicht liegt auf der Unterkante der Traufspitze und reicht an die Wand', () => {
    const env = envelopeFor('gable', rect(), { overhang: 40, pitch: 45 })
    const edge = env.isEave.findIndex(Boolean)
    expect(edge).toBeGreaterThanOrEqual(0)
    const tipA = env.eave[edge]!
    const tipB = env.eave[(edge + 1) % env.eave.length]!
    const mid = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
    const soffitY = roofEnvelopeHeightAt(env, mid) - env.tv
    expect(soffitY).toBeLessThan(env.eaveY - 20)
    const geo = buildRoofEnvelopeGeometry(env)
    const pos = geo.gable!.getAttribute('position')
    const wallA = env.outer[edge]!
    const wallB = env.outer[(edge + 1) % env.outer.length]!
    let onSoffit = 0
    let onWall = 0
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getY(i) - soffitY) > 0.3) continue
      onSoffit += 1
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const dx = wallB.x - wallA.x
      const dz = wallB.z - wallA.z
      const len2 = dx * dx + dz * dz || 1
      let t = ((x - wallA.x) * dx + (z - wallA.z) * dz) / len2
      t = Math.max(0, Math.min(1, t))
      const dist = Math.hypot(x - (wallA.x + dx * t), z - (wallA.z + dz * t))
      if (dist < 1.5) onWall += 1
    }
    expect(onSoffit).toBeGreaterThan(6)
    expect(onWall).toBeGreaterThan(0)
  })

  it('nackte Wand (flush, Überstand bleibt) bekommt trotzdem eine Untersicht', () => {
    const outer = rect()
    const roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'gable', pitch: 45, overhang: 40 })
    const eave = offsetPolygonPerEdge(outer, outer.map(() => roof.overhang))
    const env = buildRoofEnvelope({
      kind: 'gable',
      outer,
      eave,
      eaveY: 448,
      flush: outer.map(() => true),
      roof,
    })
    expect(env).not.toBeNull()
    const geo = buildRoofEnvelopeGeometry(env!)
    const pos = geo.gable!.getAttribute('position')
    const edge = env!.isEave.findIndex(Boolean)
    const tipA = env!.eave[edge]!
    const tipB = env!.eave[(edge + 1) % env!.eave.length]!
    const soffitY = roofEnvelopeHeightAt(env!, { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }) - env!.tv
    let onSoffit = 0
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getY(i) - soffitY) <= 0.3) onSoffit += 1
    }
    expect(onSoffit).toBeGreaterThan(6)
    expect(geo.gutterEdgeActive.filter(Boolean).length).toBe(2)
  })

  it('Stirnbrett an der Dachoberkante, Ecke ohne schräge Kappe', () => {
    const env = envelopeFor('gable', rect(), { overhang: 40, pitch: 45 })
    const edge = env.isEave.findIndex(Boolean)
    const tipA = env.eave[edge]!
    const tipB = env.eave[(edge + 1) % env.eave.length]!
    const wallA = env.outer[edge]!
    const wallB = env.outer[(edge + 1) % env.outer.length]!
    const out = edgeOutwardXZ(wallA, wallB)
    const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
    const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
    const dist = (midTip.x - midWall.x) * out.x + (midTip.z - midWall.z) * out.z
    const p0 = { x: wallA.x + out.x * dist, z: wallA.z + out.z * dist }
    const prev = (edge + env.outer.length - 1) % env.outer.length
    const prevA = env.outer[prev]!
    const prevB = env.outer[(prev + 1) % env.outer.length]!
    const prevOut = edgeOutwardXZ(prevA, prevB)
    const prevMidW = { x: (prevA.x + prevB.x) / 2, z: (prevA.z + prevB.z) / 2 }
    const prevTipA = env.eave[prev]!
    const prevTipB = env.eave[(prev + 1) % env.eave.length]!
    const prevMidT = { x: (prevTipA.x + prevTipB.x) / 2, z: (prevTipA.z + prevTipB.z) / 2 }
    const prevDist = (prevMidT.x - prevMidW.x) * prevOut.x + (prevMidT.z - prevMidW.z) * prevOut.z
    const neighbor = { x: prevB.x + prevOut.x * prevDist, z: prevB.z + prevOut.z * prevDist }
    const corner = {
      x: (p0.x + tipA.x + neighbor.x) / 3,
      z: (p0.z + tipA.z + neighbor.z) / 3,
    }
    const diag = {
      x: wallA.x + (tipA.x - wallA.x) / 3,
      z: wallA.z + (tipA.z - wallA.z) / 3,
    }
    const perp = { x: wallA.x + out.x * (dist / 3), z: wallA.z + out.z * (dist / 3) }
    const topY = roofEnvelopeHeightAt(env, midTip)
    const soffitY = topY - env.tv
    const geo = buildRoofEnvelopeGeometry(env)
    const pos = geo.gable!.getAttribute('position')
    const index = geo.gable!.getIndex()!
    let atTop = 0
    let cap = 0
    let shelf = 0
    let perpCap = 0
    const edgeLen = Math.hypot(tipB.x - tipA.x, tipB.z - tipA.z) || 1
    const edx = (tipB.x - tipA.x) / edgeLen
    const edz = (tipB.z - tipA.z) / edgeLen
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const t = (x - tipA.x) * edx + (z - tipA.z) * edz
      const d = Math.hypot(x - (tipA.x + edx * t), z - (tipA.z + edz * t))
      if (t >= -1 && t <= edgeLen + 1 && d < 2 && Math.abs(pos.getY(i) - topY) < 0.5) atTop += 1
    }
    for (let i = 0; i < index.count; i += 3) {
      let x = 0
      let y = 0
      let z = 0
      for (let k = 0; k < 3; k += 1) {
        const vi = index.getX(i + k)
        x += pos.getX(vi)
        y += pos.getY(vi)
        z += pos.getZ(vi)
      }
      x /= 3
      y /= 3
      z /= 3
      if (Math.hypot(x - diag.x, z - diag.z) < 8 && y > soffitY + 2) cap += 1
      if (Math.hypot(x - corner.x, z - corner.z) < 10 && Math.abs(y - soffitY) < 0.4) shelf += 1
      if (Math.hypot(x - perp.x, z - perp.z) < 6 && y > soffitY + 2) perpCap += 1
    }
    expect(atTop).toBeGreaterThan(0)
    expect(cap).toBe(0)
    // Ortgang steht ebenfalls vor: Eckstück auf der Außenkante, keine Kappe in der Wand.
    expect(shelf).toBeGreaterThan(0)
    expect(perpCap).toBe(0)
  })

  it('Walm: Eckstück folgt der Dachkante', () => {
    const env = envelopeFor('hip', rect(), { overhang: 40, pitch: 45 })
    const edge = 0
    expect(env.isEave[edge]).toBe(true)
    expect(env.isEave[(edge + 1) % env.isEave.length]).toBe(true)
    const tipA = env.eave[edge]!
    const wallA = env.outer[edge]!
    const wallB = env.outer[(edge + 1) % env.outer.length]!
    const out = edgeOutwardXZ(wallA, wallB)
    const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
    const tipB = env.eave[(edge + 1) % env.eave.length]!
    const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
    const dist = (midTip.x - midWall.x) * out.x + (midTip.z - midWall.z) * out.z
    const p0 = { x: wallA.x + out.x * dist, z: wallA.z + out.z * dist }
    const prev = env.outer.length - 1
    const prevA = env.outer[prev]!
    const prevB = env.outer[0]!
    const prevOut = edgeOutwardXZ(prevA, prevB)
    const prevMidW = { x: (prevA.x + prevB.x) / 2, z: (prevA.z + prevB.z) / 2 }
    const prevTipA = env.eave[prev]!
    const prevTipB = env.eave[0]!
    const prevMidT = { x: (prevTipA.x + prevTipB.x) / 2, z: (prevTipA.z + prevTipB.z) / 2 }
    const prevDist = (prevMidT.x - prevMidW.x) * prevOut.x + (prevMidT.z - prevMidW.z) * prevOut.z
    const neighbor = { x: prevB.x + prevOut.x * prevDist, z: prevB.z + prevOut.z * prevDist }
    const corner = {
      x: (p0.x + tipA.x + neighbor.x) / 3,
      z: (p0.z + tipA.z + neighbor.z) / 3,
    }
    const diag = {
      x: wallA.x + (tipA.x - wallA.x) / 3,
      z: wallA.z + (tipA.z - wallA.z) / 3,
    }
    const soffitY = roofEnvelopeHeightAt(env, midTip) - env.tv
    const geo = buildRoofEnvelopeGeometry(env)
    const pos = geo.gable!.getAttribute('position')
    const index = geo.gable!.getIndex()!
    let cap = 0
    let shelf = 0
    for (let i = 0; i < index.count; i += 3) {
      let x = 0
      let y = 0
      let z = 0
      for (let k = 0; k < 3; k += 1) {
        const vi = index.getX(i + k)
        x += pos.getX(vi)
        y += pos.getY(vi)
        z += pos.getZ(vi)
      }
      x /= 3
      y /= 3
      z /= 3
      if (Math.hypot(x - diag.x, z - diag.z) < 8 && y > soffitY + 2) cap += 1
      if (Math.hypot(x - corner.x, z - corner.z) < 10 && Math.abs(y - soffitY) < 0.4) shelf += 1
    }
    expect(cap).toBe(0)
    expect(shelf).toBeGreaterThan(0)
  })

  it('bündiger Giebel: Endkappe in der Wandebene', () => {
    const env = envelopeFor('gable', rect(), { overhang: 40, pitch: 45 }, [false, true, false, true])
    expect(env.isEave[0]).toBe(true)
    expect(env.isEave[1]).toBe(false)
    const wallA = env.outer[0]!
    const wallB = env.outer[1]!
    const tipA = env.eave[0]!
    const tipB = env.eave[1]!
    const out = edgeOutwardXZ(wallA, wallB)
    const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
    const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
    const dist = (midTip.x - midWall.x) * out.x + (midTip.z - midWall.z) * out.z
    const perp = { x: wallA.x + out.x * (dist / 3), z: wallA.z + out.z * (dist / 3) }
    const len = Math.hypot(wallB.x - wallA.x, wallB.z - wallA.z) || 1
    const along = { x: (wallB.x - wallA.x) / len, z: (wallB.z - wallA.z) / len }
    const side = { x: wallA.x - along.x * 20, z: wallA.z - along.z * 20 }
    const soffitY = roofEnvelopeHeightAt(env, midTip) - env.tv
    const topAtWall = roofEnvelopeHeightAt(env, wallA)
    const geo = buildRoofEnvelopeGeometry(env)
    const pos = geo.gable!.getAttribute('position')
    const index = geo.gable!.getIndex()!
    let sideCap = 0
    let perpCap = 0
    let capReachesTop = 0
    for (let i = 0; i < pos.count; i += 1) {
      if (
        Math.hypot(pos.getX(i) - wallA.x, pos.getZ(i) - wallA.z) < 0.15 &&
        Math.abs(pos.getY(i) - topAtWall) < 1
      ) {
        capReachesTop += 1
      }
    }
    for (let i = 0; i < index.count; i += 3) {
      let x = 0
      let y = 0
      let z = 0
      for (let k = 0; k < 3; k += 1) {
        const vi = index.getX(i + k)
        x += pos.getX(vi)
        y += pos.getY(vi)
        z += pos.getZ(vi)
      }
      x /= 3
      y /= 3
      z /= 3
      if (y <= soffitY + 2) continue
      if (Math.hypot(x - side.x, z - side.z) < 8) sideCap += 1
      if (Math.hypot(x - perp.x, z - perp.z) < 6) perpCap += 1
    }
    expect(sideCap).toBe(0)
    expect(perpCap).toBeGreaterThan(0)
    expect(capReachesTop).toBeGreaterThan(0)
  })

  it('Pult: Füllwand sticht nicht durch die Dachhaut', () => {
    const env = envelopeFor('shed', rect(), { overhang: 40, pitch: 45 })
    const geo = buildRoofEnvelopeGeometry(env)
    const pos = geo.gable!.getAttribute('position')
    let above = 0
    for (let i = 0; i < pos.count; i += 1) {
      const y = roofEnvelopeHeightAt(env, { x: pos.getX(i), z: pos.getZ(i) })
      if (pos.getY(i) > y + 0.6) above += 1
    }
    expect(above).toBe(0)
  })
})

describe('roofForms – Firstrichtung', () => {
  it('Mansarde und Walm nutzen dieselbe Achsen-Auswahl wie der Sattel', () => {
    expect(roofKindUsesRidgeDir('mansard')).toBe(true)
    expect(roofKindUsesRidgeDir('hip')).toBe(true)
    expect(roofKindUsesRidgeDir('gable')).toBe(true)
    expect(roofKindUsesRidgeDir('shed')).toBe(true)
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
