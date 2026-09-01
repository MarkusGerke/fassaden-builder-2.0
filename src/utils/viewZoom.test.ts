import { describe, expect, it } from 'vitest'
import {
  DBLCLICK_ZOOM_DURATION_MS,
  DBLCLICK_ZOOM_FACTOR,
  easeOutCubic,
  lerpNumber,
  normalizedWheelDeltaY,
  wheelZoomFactorFromDelta,
  zoomPanOffsetsAtCursor,
} from './viewZoom'

describe('normalizedWheelDeltaY', () => {
  it('lässt Pixel-Delta unverändert', () => {
    expect(normalizedWheelDeltaY(120, 0, 800)).toBe(120)
  })

  it('skaliert Zeilen-Delta', () => {
    expect(normalizedWheelDeltaY(3, 1, 800)).toBe(48)
  })

  it('skaliert Seiten-Delta mit Viewport-Höhe', () => {
    expect(normalizedWheelDeltaY(1, 2, 600)).toBe(600)
  })
})

describe('wheelZoomFactorFromDelta', () => {
  it('verkleinert bei positivem Delta (rauszoomen)', () => {
    expect(wheelZoomFactorFromDelta(100)).toBeLessThan(1)
  })

  it('vergrößert bei negativem Delta (reinzoomen)', () => {
    expect(wheelZoomFactorFromDelta(-100)).toBeGreaterThan(1)
  })

  it('ist 1 bei Delta 0', () => {
    expect(wheelZoomFactorFromDelta(0)).toBe(1)
  })
})

describe('zoomPanOffsetsAtCursor', () => {
  it('hält Cursor-Punkt bei Faktor 2 stabil', () => {
    const halfW = 100
    const halfH = 80
    const nx = 0.5
    const ny = -0.25
    const before = { x: nx * halfW, y: ny * halfH }
    const { panX, panY } = zoomPanOffsetsAtCursor({
      nx,
      ny,
      factor: 2,
      panX: 0,
      panY: 0,
      halfW,
      halfH,
    })
    const after = { x: panX + nx * (halfW / 2), y: panY + ny * (halfH / 2) }
    expect(after.x).toBeCloseTo(before.x, 5)
    expect(after.y).toBeCloseTo(before.y, 5)
  })
})

describe('DBLCLICK_ZOOM_FACTOR', () => {
  it('ist größer als 1', () => {
    expect(DBLCLICK_ZOOM_FACTOR).toBeGreaterThan(1)
  })
})

describe('easeOutCubic', () => {
  it('startet bei 0 und endet bei 1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
})

describe('lerpNumber', () => {
  it('interpoliert zur Mitte', () => {
    expect(lerpNumber(0, 100, 0.5)).toBe(50)
  })
})

describe('DBLCLICK_ZOOM_DURATION_MS', () => {
  it('ist positiv', () => {
    expect(DBLCLICK_ZOOM_DURATION_MS).toBeGreaterThan(0)
  })
})
