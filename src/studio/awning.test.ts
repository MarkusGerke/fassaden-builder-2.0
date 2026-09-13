import { describe, expect, it } from 'vitest'
import {
  awningArmSegmentSpecs,
  awningGuideLength,
  awningKindDefaults,
  computeAwningPose,
  defaultAwningConfig,
  defaultOpeningAwningWidth,
  foldingArmSegmentLengthCm,
  markisolettePhaseSplit,
  normalizeAwningConfig,
  openingSupportsAwning,
  resolveDropArmXs,
} from './awning'

describe('awning normalize', () => {
  it('clamps extension and sizes', () => {
    const a = normalizeAwningConfig({
      enabled: true,
      extension: 2,
      widthCm: 50.3,
      projectionCm: 1000,
      kind: 'dropArm',
      frontOverhangCm: 99,
      slopeDeg: 90,
    })
    expect(a.extension).toBe(1)
    expect(a.widthCm).toBe(48)
    expect(a.projectionCm).toBe(480)
    expect(a.kind).toBe('dropArm')
    expect(a.enabled).toBe(true)
    expect(a.frontOverhangCm).toBe(48)
    expect(a.slopeDeg).toBe(45)
  })

  it('defaults disabled, gray fabric, overhang 16', () => {
    const a = defaultAwningConfig()
    expect(a.enabled).toBe(false)
    expect(a.frontOverhangCm).toBe(16)
    expect(a.overhangCm).toBe(16)
    expect(a.fabricColor).toBe('#9ca3af')
    expect(a.slopeDeg).toBe(15)
  })

  it('accepts markisolette', () => {
    expect(normalizeAwningConfig({ kind: 'markisolette' }).kind).toBe('markisolette')
  })
})

describe('awning kinematics', () => {
  it('guide length increases with extension (folding)', () => {
    const a = awningGuideLength(computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 0.1 }))
    const b = awningGuideLength(computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 0.9 }))
    expect(b).toBeGreaterThan(a)
  })

  it('guide length increases with extension (drop)', () => {
    const a = awningGuideLength(computeAwningPose({ kind: 'dropArm', widthCm: 192, projectionCm: 144, extension: 0.15 }))
    const b = awningGuideLength(computeAwningPose({ kind: 'dropArm', widthCm: 192, projectionCm: 144, extension: 1 }))
    expect(b).toBeGreaterThan(a)
  })

  it('front Z near mount when retracted', () => {
    const pose = computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 0 })
    expect(pose.frontBarCenter.z).toBeLessThan(12)
  })

  it('drop arm is one rigid segment: constant mount→front distance, no elbow, single spec per side', () => {
    const at = (extension: number) =>
      computeAwningPose({ kind: 'dropArm', widthCm: 192, projectionCm: 144, extension, slopeDeg: 15, armMountYCm: 144 })
    const a = at(0)
    const b = at(0.4)
    const c = at(1)
    expect(a.armLen).toBeCloseTo(c.armLen, 6)
    for (const p of [a, b, c]) {
      expect(p.leftMount.distanceTo(p.leftFront)).toBeCloseTo(p.armLen, 4)
      // Ellbogen liegt exakt auf der Geraden Konsole→Vorderkante (kein Knick)
      const mid = p.leftMount.clone().lerp(p.leftFront, 0.5)
      expect(p.leftElbow.distanceTo(mid)).toBeLessThan(1e-6)
      expect(awningArmSegmentSpecs(p, 'dropArm')).toHaveLength(2)
    }
    // eingefahren: Arm senkrecht an der Wand, Profil direkt unter dem Kasten
    expect(a.leftFront.z).toBeCloseTo(a.leftMount.z, 4)
    expect(a.frontBarCenter.y).toBeGreaterThan(-12)
    // Konsole bleibt fest
    expect(a.leftMount.y).toBeCloseTo(c.leftMount.y, 6)
    expect(a.leftMount.y).toBeCloseTo(-144, 6)
    // ausgefahren: Arm 15° unter Horizontal (fällt)
    const dy = c.leftFront.y - c.leftMount.y
    const dz = c.leftFront.z - c.leftMount.z
    expect(dz).toBeGreaterThan(0)
    expect(Math.atan2(-dy, dz) * (180 / Math.PI)).toBeCloseTo(15, 1)
    // Zwischenstellung: Profil weiter außen als eingefahren, tiefer als eingefahren
    expect(b.frontBarCenter.z).toBeGreaterThan(a.frontBarCenter.z + 10)
    expect(b.frontBarCenter.y).toBeLessThan(a.frontBarCenter.y)
  })

  it('folding arm links keep their length while the elbow folds inward', () => {
    const at = (extension: number) =>
      computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension, slopeDeg: 15 })
    const poses = [at(0.1), at(0.5), at(1)]
    const ref = foldingArmSegmentLengthCm(144)
    for (const p of poses) {
      expect(p.leftMount.distanceTo(p.leftElbow)).toBeCloseTo(ref, 0)
      expect(p.leftElbow.distanceTo(p.leftFront)).toBeCloseTo(ref, 0)
      expect(p.rightMount.distanceTo(p.rightElbow)).toBeCloseTo(ref, 0)
      expect(awningArmSegmentSpecs(p, 'foldingArm')).toHaveLength(4)
    }
    // je weniger ausgefahren, desto weiter klappt der Ellbogen zur Mitte
    expect(poses[0]!.leftElbow.x).toBeGreaterThan(poses[1]!.leftElbow.x)
    expect(poses[1]!.leftElbow.x).toBeGreaterThan(poses[2]!.leftElbow.x)
    expect(poses[0]!.rightElbow.x).toBeLessThan(poses[1]!.rightElbow.x)
    // Ellbogen zwischen Wand und Vorderkante (Tuchebene), nicht dahinter
    for (const p of poses) {
      expect(p.leftElbow.z).toBeGreaterThanOrEqual(p.leftMount.z - 1e-6)
      expect(p.leftElbow.z).toBeLessThanOrEqual(p.leftFront.z + 1e-6)
    }
  })

  it('folding arms on a narrow awning cross without intersecting', () => {
    const p = computeAwningPose({ kind: 'foldingArm', widthCm: 96, projectionCm: 144, extension: 0.5 })
    expect(p.leftElbow.x).toBeGreaterThan(p.rightElbow.x)
    expect(Math.abs(p.leftElbow.y - p.rightElbow.y)).toBeGreaterThan(3)
  })

  it('drop-arm mounts sit outside opening plus profile by at least 8 cm', () => {
    const xs = resolveDropArmXs({
      widthCm: 200,
      openingWidthCm: 96,
      profileOutwardCm: 8,
      armClearanceCm: 8,
    })
    expect(xs.rightX).toBe(48 + 8 + 8)
    expect(xs.leftX).toBe(-xs.rightX)
  })

  it('drop arm front hangs below mount when extended', () => {
    const pose = computeAwningPose({ kind: 'dropArm', widthCm: 192, projectionCm: 144, extension: 1, slopeDeg: 15 })
    expect(pose.frontBarCenter.y).toBeLessThan(pose.leftMount.y - 10)
    expect(pose.frontBarCenter.z).toBeGreaterThan(40)
    // Stoff liegt vor dem Arm (Normale nach außen/oben), keine Durchdringung
    const midRow = Math.floor((pose.segsAlong - 4) / 2)
    const midCol = Math.floor(pose.segsAcross / 2)
    const fabricMid = pose.fabricPoints[midRow * (pose.segsAcross + 1) + midCol]!
    const armMid = pose.leftElbow
    expect(fabricMid.y).toBeGreaterThan(armMid.y)
  })

  it('folding elbows fold inward in X, not hanging far below fabric', () => {
    const folded = computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 0.25 })
    const open = computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 0.95 })
    expect(folded.leftElbow.x).toBeGreaterThan(folded.leftMount.x + 5)
    expect(folded.rightElbow.x).toBeLessThan(folded.rightMount.x - 5)
    // fast gestreckt: Restknick deutlich kleiner als eingeklappt
    expect(Math.abs(open.leftElbow.x - open.leftMount.x)).toBeLessThan(30)
    expect(Math.abs(open.leftElbow.x - open.leftMount.x)).toBeLessThan(folded.leftElbow.x - folded.leftMount.x)
    const straight = computeAwningPose({ kind: 'foldingArm', widthCm: 192, projectionCm: 144, extension: 1 })
    expect(Math.abs(straight.leftElbow.x - straight.leftMount.x)).toBeLessThan(16)
    const midRow = Math.floor(open.segsAlong / 2)
    const midCol = Math.floor(open.segsAcross / 2)
    const fabricMid = open.fabricPoints[midRow * (open.segsAcross + 1) + midCol]!
    expect(open.leftElbow.y).toBeLessThan(fabricMid.y)
  })

  it('volant hangs below front bar', () => {
    const pose = computeAwningPose({
      kind: 'foldingArm',
      widthCm: 192,
      projectionCm: 144,
      extension: 1,
      frontOverhangCm: 24,
    })
    let minY = Infinity
    let maxZ = -Infinity
    for (const p of pose.fabricPoints) {
      minY = Math.min(minY, p.y)
      maxZ = Math.max(maxZ, p.z)
    }
    expect(minY).toBeLessThan(pose.frontBarCenter.y)
    expect(maxZ).toBeGreaterThan(pose.frontBarCenter.z)
    expect(maxZ).toBeLessThan(pose.frontBarCenter.z + 12)
  })

  it('markisolette has vertical then angled section', () => {
    const pose = computeAwningPose({
      kind: 'markisolette',
      widthCm: 160,
      projectionCm: 80,
      extension: 1,
      verticalDropCm: 64,
      slopeDeg: 35,
    })
    expect(pose.guideBottomY).toBeLessThan(-40)
    expect(pose.frontBarCenter.z).toBeGreaterThan(20)
    expect(pose.frontBarCenter.y).toBeLessThan(pose.guideBottomY!)
  })

  it('markisolette: vertical phase in the rail, then rigid arm swings around the rail end', () => {
    const base = { kind: 'markisolette' as const, widthCm: 160, projectionCm: 64, verticalDropCm: 120, slopeDeg: 45 }
    const { e1, armLen, vertical } = markisolettePhaseSplit({ ...base, extension: 0 })
    expect(vertical).toBe(120)
    // Ausladung = armLen · sin(135°)
    expect(armLen * Math.sin(Math.PI * 0.75)).toBeCloseTo(64, 6)
    const closed = computeAwningPose({ ...base, extension: 0 })
    const mid1 = computeAwningPose({ ...base, extension: e1 * 0.5 })
    const end1 = computeAwningPose({ ...base, extension: e1 })
    const mid2 = computeAwningPose({ ...base, extension: e1 + (1 - e1) * 0.5 })
    const open = computeAwningPose({ ...base, extension: 1 })
    // Phase 1: Profil bleibt in der Schiene (z konstant), fährt senkrecht; Gleiter hängt eine Armlänge darunter
    for (const p of [closed, mid1, end1]) {
      expect(p.frontBarCenter.z).toBeCloseTo(closed.frontBarCenter.z, 6)
      expect(p.leftFront.y - p.leftMount.y).toBeCloseTo(armLen, 6)
      expect(awningArmSegmentSpecs(p, 'markisolette')).toHaveLength(2)
    }
    expect(mid1.frontBarCenter.y).toBeLessThan(closed.frontBarCenter.y)
    expect(end1.frontBarCenter.y).toBeCloseTo(-120, 6)
    // Blockadeelement: Drehpunkt = Schienenende = Austritt − Armlänge, ab dann fest
    expect(end1.leftMount.y).toBeCloseTo(-120 - armLen, 6)
    expect(end1.guideBottomY).toBeCloseTo(-120 - armLen, 6)
    expect(mid2.leftMount.y).toBeCloseTo(end1.leftMount.y, 6)
    expect(open.leftMount.y).toBeCloseTo(end1.leftMount.y, 6)
    // Phase 2: Armlänge konstant, Profil schwenkt nach außen und unter den Austritt
    for (const p of [mid2, open]) {
      expect(p.leftMount.distanceTo(p.leftFront)).toBeCloseTo(armLen, 4)
      expect(p.frontBarCenter.z).toBeGreaterThan(end1.frontBarCenter.z + 5)
      expect(p.frontBarCenter.y).toBeLessThanOrEqual(-120 + 1e-6)
    }
    // Kreisbogen: waagerechter Arm (Mitte Phase 2) reicht weiter als 45° unter Horizontal — physikalisch korrekt
    expect(mid2.frontBarCenter.y).toBeGreaterThan(open.frontBarCenter.y)
    // voll: Arm 45° unter Horizontal, Ausladung 64 cm
    expect(open.leftFront.z - open.leftMount.z).toBeCloseTo(64, 4)
    expect(open.leftMount.y - open.leftFront.y).toBeCloseTo(64, 4)
    // Stoff: senkrecht bis zum Austritt (z konstant), danach schräg
    const col = Math.floor(open.segsAcross / 2)
    const rowZ = (row: number) => open.fabricPoints[row * (open.segsAcross + 1) + col]!.z
    expect(rowZ(1)).toBeCloseTo(rowZ(0), 2)
    expect(rowZ(2)).toBeCloseTo(rowZ(0), 2)
    expect(rowZ(open.segsAlong - 4)).toBeGreaterThan(rowZ(0) + 40)
    // Leitkurve wächst monoton über beide Phasen
    const l = [closed, mid1, end1, mid2, open].map(awningGuideLength)
    for (let i = 1; i < l.length; i += 1) expect(l[i]!).toBeGreaterThan(l[i - 1]! - 1e-6)
  })

  it('kind defaults give type-appropriate sizes', () => {
    expect(awningKindDefaults('markisolette')).toMatchObject({ projectionCm: 64, verticalDropCm: 120, slopeDeg: 45 })
    expect(awningKindDefaults('dropArm')).toMatchObject({ armMountYCm: 144 })
    expect(awningKindDefaults('foldingArm')).toMatchObject({ projectionCm: 144, slopeDeg: 15 })
  })

  it('arm inset moves drop-arm mounts', () => {
    const narrow = computeAwningPose({
      kind: 'dropArm',
      widthCm: 200,
      projectionCm: 120,
      extension: 1,
      armInsetCm: 8,
    })
    const wide = computeAwningPose({
      kind: 'dropArm',
      widthCm: 200,
      projectionCm: 120,
      extension: 1,
      armInsetCm: 40,
    })
    expect(Math.abs(narrow.leftMount.x)).toBeGreaterThan(Math.abs(wide.leftMount.x))
  })
})

describe('opening supports', () => {
  it('allows window/door/cutout/conch, not basement', () => {
    expect(openingSupportsAwning({ type: 'window' })).toBe(true)
    expect(openingSupportsAwning({ type: 'cutout' })).toBe(true)
    expect(
      openingSupportsAwning({ type: 'window', basementWindow: { enabled: true, grilleHeight: 0.5 } }),
    ).toBe(false)
  })

  it('default opening width uses 16 cm overhang per side', () => {
    expect(defaultOpeningAwningWidth({ width: 96 }, 16)).toBe(128)
  })
})
