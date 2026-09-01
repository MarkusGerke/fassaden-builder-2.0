import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { clampFacadeState } from '../utils/walls'
import { addSceneLight, normalizeSceneLights, updateSceneLight } from './sceneLights'

describe('sceneLights', () => {
  it('fügt Punktlicht mit Default-Position ein', () => {
    const base = createDefaultFacadeState()
    const { state, lightId } = addSceneLight(base)
    const lights = normalizeSceneLights(state.sceneLights)
    expect(lights).toHaveLength(1)
    expect(lights[0]?.id).toBe(lightId)
    expect(lights[0]?.intensity).toBeGreaterThan(0)
  })

  it('überlebt clampFacadeState (migrateToBuildings)', () => {
    const { state } = addSceneLight(createDefaultFacadeState())
    const clamped = clampFacadeState(state)
    expect(normalizeSceneLights(clamped.sceneLights)).toHaveLength(1)
  })

  it('aktualisiert XYZ', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState())
    const next = updateSceneLight(state, lightId, { x: 10, y: 200, z: -30 })
    const light = normalizeSceneLights(next.sceneLights)[0]
    expect(light?.x).toBe(10)
    expect(light?.y).toBe(200)
    expect(light?.z).toBe(-30)
  })
})
