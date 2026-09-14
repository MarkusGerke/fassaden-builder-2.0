import { describe, expect, it } from 'vitest'
import {
  defaultLibraryEditSheetHeight,
  facadeYawWithMostWindows,
  isCoarseOrNarrowViewport,
  isSceneEditFocus,
  isSceneLibraryTab,
  isTouchChromeLayout,
  shouldForcePresentView,
  touchFacingFromYaw,
  TOUCH_CHROME_MAX_WIDTH_PX,
  yawForTouchFacing,
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

  it('forces present on coarse/narrow for non-3d editor views; 3d allowed when chosen', () => {
    expect(shouldForcePresentView('3d', mockWin({ coarse: true }))).toBe(false)
    expect(shouldForcePresentView('front', mockWin({ width: 700 }))).toBe(true)
    expect(shouldForcePresentView('present', mockWin({ coarse: true }))).toBe(false)
    expect(shouldForcePresentView('export', mockWin({ coarse: true }))).toBe(false)
    expect(shouldForcePresentView('3d', mockWin({ width: 1400 }))).toBe(false)
  })

  it('maps scene library tabs and edit focus', () => {
    expect(isSceneLibraryTab('sceneView')).toBe(true)
    expect(isSceneLibraryTab('windows')).toBe(false)
    expect(isSceneEditFocus(['view'])).toBe(true)
    expect(isSceneEditFocus(['measures'])).toBe(false)
  })

  it('maps links/frontal/rechts relative to home yaw', () => {
    expect(yawForTouchFacing(0, 'frontal')).toBe(0)
    expect(yawForTouchFacing(0, 'left')).toBe(90)
    expect(yawForTouchFacing(0, 'right')).toBe(270)
    expect(touchFacingFromYaw(0, 90)).toBe('left')
    expect(touchFacingFromYaw(0, 270)).toBe('right')
    expect(touchFacingFromYaw(0, 45)).toBe(null)
  })

  it('picks compact sheet open height from sections', () => {
    expect(defaultLibraryEditSheetHeight(['view'])).toBe(25)
    expect(defaultLibraryEditSheetHeight(['sceneLights'])).toBe(25)
    expect(defaultLibraryEditSheetHeight(['bloom'])).toBe(25)
    expect(defaultLibraryEditSheetHeight(['sun'])).toBe(50)
    expect(defaultLibraryEditSheetHeight(['measures', 'style'])).toBe(50)
  })

  it('picks facade yaw with most windows as front', () => {
    expect(
      facadeYawWithMostWindows([
        { yawDeg: 0, openings: [{ type: 'window' }, { type: 'window' }] },
        { yawDeg: 90, openings: [{ type: 'window' }] },
        { yawDeg: 180, openings: [{ type: 'door' }] },
      ]),
    ).toBe(0)
    expect(
      facadeYawWithMostWindows([
        { yawDeg: 90, openings: [{ type: 'window' }, { type: 'window' }, { type: 'window' }] },
        { yawDeg: 0, openings: [{ type: 'window' }] },
      ]),
    ).toBe(90)
    expect(facadeYawWithMostWindows([{ yawDeg: 0, openings: [{ type: 'door' }] }])).toBe(null)
  })
})
