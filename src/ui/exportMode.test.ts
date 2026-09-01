import { describe, expect, it } from 'vitest'
import {
  exportFrameAspectRatio,
  exportFramePixelSize,
  buildExportFilename,
  syncExportSlotsWithYaws,
  createDefaultExportState,
} from './exportMode'

describe('exportMode', () => {
  it('Quer 9:16 ergibt 16:9', () => {
    expect(exportFrameAspectRatio('landscape', '9:16')).toBeCloseTo(16 / 9, 5)
    expect(exportFrameAspectRatio('portrait', '9:16')).toBeCloseTo(9 / 16, 5)
  })

  it('Pixelgröße hält Seitenverhältnis', () => {
    const { width, height } = exportFramePixelSize('landscape', '9:16', 1600)
    expect(width / height).toBeCloseTo(16 / 9, 2)
  })

  it('Dateiname endet auf png/jpg', () => {
    expect(buildExportFilename('png')).toMatch(/^fassade-export-\d{6}-\d{6}\.png$/)
    expect(buildExportFilename('jpg')).toMatch(/\.jpg$/)
  })

  it('sync behält Top-Slot und Yaw-Slots', () => {
    const state = createDefaultExportState([0, 90])
    state.slots.find((s) => s.id === 'top')!.enabled = true
    const next = syncExportSlotsWithYaws(state, [0, 180])
    expect(next.slots.map((s) => s.id).sort()).toEqual(['top', 'yaw-0', 'yaw-180'])
    expect(next.slots.find((s) => s.id === 'top')!.enabled).toBe(true)
  })
})
