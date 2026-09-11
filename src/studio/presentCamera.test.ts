import { describe, expect, it } from 'vitest'
import { computePresentCameraFrame } from './presentCamera'
import type { Wall } from '../types/facade'

function wall(partial: Partial<Wall> & Pick<Wall, 'id' | 'width' | 'height'>): Wall {
  return {
    x: 0,
    y: 0,
    depth: 24,
    yawDeg: 0,
    panelFlip: true,
    originX: 0,
    originZ: 0,
    openings: [],
    ...partial,
  }
}

describe('computePresentCameraFrame', () => {
  it('zentriert vertikal auf Gebäudemitte', () => {
    const walls = [wall({ id: 'a', width: 400, height: 280, y: 0 })]
    const frame = computePresentCameraFrame({
      walls,
      yawDeg: 0,
      fovDeg: 50,
      aspect: 16 / 9,
      storeyHeight: 280,
    })
    expect(frame).not.toBeNull()
    expect(frame!.lookY).toBeCloseTo(140, 0)
  })

  it('größere Distanz bei mehr Geschosshöhe im Bild', () => {
    const one = computePresentCameraFrame({
      walls: [wall({ id: 'a', width: 400, height: 280, y: 0 })],
      yawDeg: 0,
      fovDeg: 50,
      aspect: 1,
      storeyHeight: 280,
    })
    const two = computePresentCameraFrame({
      walls: [wall({ id: 'a', width: 400, height: 560, y: 0 })],
      yawDeg: 0,
      fovDeg: 50,
      aspect: 1,
      storeyHeight: 280,
    })
    expect(one!.distance).toBeLessThan(two!.distance)
  })
})
