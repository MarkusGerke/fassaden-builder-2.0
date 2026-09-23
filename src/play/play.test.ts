/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { buildPlayStarterFacade, PLAY_STARTERS, whitenPlayFacade } from './playStarters'
import { DEFAULT_FACADE_STARTER_ID } from './facadeOnboarding'
import { getAllWalls } from '../utils/buildings'
import { isStudioWall } from '../studio/walls'

describe('play starters', () => {
  it('katalog hat 5–10 Einstiege', () => {
    expect(PLAY_STARTERS.length).toBeGreaterThanOrEqual(5)
    expect(PLAY_STARTERS.length).toBeLessThanOrEqual(10)
  })

  it('Default-Starter liegt im Katalog', () => {
    expect(PLAY_STARTERS.some((s) => s.id === DEFAULT_FACADE_STARTER_ID)).toBe(true)
  })

  it('baut weißes Haus mit Öffnungen', () => {
    const facade = buildPlayStarterFacade('stadthaus-3', createDefaultFacadeState())
    const walls = getAllWalls(facade)
    expect(walls.some((w) => (w.openings?.length ?? 0) > 0)).toBe(true)
    expect(walls.every((w) => (w.wallColor ?? '').toLowerCase() === '#ffffff')).toBe(true)
    const exterior = walls.filter((w) => isStudioWall(w) && w.role !== 'interior')
    expect(
      exterior.every((w) => w.panel?.plinthEnabled !== false && (w.panel?.plinthHeight ?? 0) === 48),
    ).toBe(true)
  })
})

describe('whiten', () => {
  it('ist idempotent', () => {
    const a = whitenPlayFacade(createDefaultFacadeState())
    const b = whitenPlayFacade(a)
    expect(b.buildings[0]?.walls[0]?.wallColor).toBe('#ffffff')
  })
})
