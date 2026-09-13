import { describe, expect, it } from 'vitest'
import {
  isCoarseOrNarrowViewport,
  isTouchChromeLayout,
  shouldForcePresentView,
  TOUCH_CHROME_MAX_WIDTH_PX,
} from './touchChrome'

function mockWin(opts: { coarse?: boolean; width?: number }): Window {
  const coarse = opts.coarse ?? false
  const width = opts.width ?? 1200
  return {
    matchMedia: (query: string) => ({
      matches:
        query.includes('pointer: coarse')
          ? coarse
          : query.includes(`max-width: ${TOUCH_CHROME_MAX_WIDTH_PX}`)
            ? width <= TOUCH_CHROME_MAX_WIDTH_PX
            : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  } as unknown as Window
}

describe('touchChrome', () => {
  it('detects coarse or narrow', () => {
    expect(isCoarseOrNarrowViewport(mockWin({ coarse: true }))).toBe(true)
    expect(isCoarseOrNarrowViewport(mockWin({ width: 800 }))).toBe(true)
    expect(isCoarseOrNarrowViewport(mockWin({ width: 1200 }))).toBe(false)
  })

  it('does not activate solely for present on large desktop', () => {
    expect(isTouchChromeLayout('present', mockWin({ width: 1400 }))).toBe(false)
    expect(isTouchChromeLayout('3d', mockWin({ width: 1400 }))).toBe(false)
    expect(isTouchChromeLayout('present', mockWin({ width: 800 }))).toBe(true)
    expect(isTouchChromeLayout('3d', mockWin({ coarse: true }))).toBe(true)
  })

  it('forces present on coarse/narrow except export/present', () => {
    expect(shouldForcePresentView('3d', mockWin({ coarse: true }))).toBe(true)
    expect(shouldForcePresentView('front', mockWin({ width: 700 }))).toBe(true)
    expect(shouldForcePresentView('present', mockWin({ coarse: true }))).toBe(false)
    expect(shouldForcePresentView('export', mockWin({ coarse: true }))).toBe(false)
    expect(shouldForcePresentView('3d', mockWin({ width: 1400 }))).toBe(false)
  })
})
