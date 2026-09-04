import { describe, expect, it } from 'vitest'
import { LeafRuntime, windImpulsePreview, LEAF_WIND_RADIUS_CM } from './leafRuntime'
import { createRandomLeaf } from './groundLeaves'

describe('leafRuntime', () => {
  it('sync erzeugt Meshes und snapshot behält Pose', () => {
    const runtime = new LeafRuntime()
    const leaf = createRandomLeaf(10, 20, () => 0.3)
    runtime.sync([leaf])
    expect(runtime.count()).toBe(1)
    const snap = runtime.snapshotLeaves()
    expect(snap[0]?.x).toBeCloseTo(10, 5)
    expect(snap[0]?.z).toBeCloseTo(20, 5)
    runtime.dispose()
  })

  it('tick bewegt Blätter im Windradius', () => {
    const runtime = new LeafRuntime()
    const leaf = createRandomLeaf(0, 0, () => 0.4)
    runtime.sync([leaf])
    const moved = runtime.tick(50, {
      x: 5,
      z: 0,
      vx: 200,
      vz: 0,
      active: true,
    })
    expect(moved).toBe(true)
    const snap = runtime.snapshotLeaves()[0]!
    expect(Math.hypot(snap.x, snap.z)).toBeGreaterThan(0.01)
    runtime.dispose()
  })

  it('windImpulsePreview ist null außerhalb des Radius', () => {
    const far = LEAF_WIND_RADIUS_CM + 10
    expect(
      windImpulsePreview(far, 0, { x: 0, z: 0, vx: 100, vz: 0, active: true }),
    ).toEqual({ ax: 0, az: 0 })
    const near = windImpulsePreview(10, 0, { x: 0, z: 0, vx: 100, vz: 0, active: true })
    expect(Math.abs(near.ax) + Math.abs(near.az)).toBeGreaterThan(0)
  })
})
