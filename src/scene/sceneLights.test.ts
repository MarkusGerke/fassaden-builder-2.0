import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { clampFacadeState } from '../utils/walls'
import { addSceneLight, duplicateSceneLight, normalizeSceneLights, setAllSceneLightsEnabled, updateSceneLight } from './sceneLights'

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

  it('setzt Farbe aus Farbtemperatur', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState())
    const next = updateSceneLight(state, lightId, { colorTemperature: 4500 })
    const light = normalizeSceneLights(next.sceneLights)[0]
    expect(light?.colorTemperature).toBe(4500)
    expect(light?.color.startsWith('#')).toBe(true)
  })

  it('bewahrt manuelle Farbe neben Farbtemperatur', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState())
    const withTemp = updateSceneLight(state, lightId, { colorTemperature: 3000 })
    const custom = updateSceneLight(withTemp, lightId, { color: '#00ff88' })
    const light = normalizeSceneLights(custom.sceneLights)[0]
    expect(light?.color).toBe('#00ff88')
    expect(light?.colorTemperature).toBe(3000)
  })

  it('dupliziert mit gleichen Einstellungen und Versatz', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState())
    const patched = updateSceneLight(state, lightId, {
      intensity: 25,
      showMarker: false,
      markerSizeCm: 24,
      color: '#aabbcc',
    })
    const { state: next, lightId: copyId } = duplicateSceneLight(patched, lightId)
    expect(copyId).not.toBe(lightId)
    const lights = normalizeSceneLights(next.sceneLights)
    expect(lights).toHaveLength(2)
    const copy = lights.find((item) => item.id === copyId)
    expect(copy?.intensity).toBe(25)
    expect(copy?.showMarker).toBe(false)
    expect(copy?.markerSizeCm).toBe(24)
    expect(copy?.color).toBe('#aabbcc')
    expect(copy!.x - lights.find((item) => item.id === lightId)!.x).toBe(48)
  })

  it('schaltet alle Lichter gemeinsam', () => {
    let { state, lightId } = addSceneLight(createDefaultFacadeState())
    const second = addSceneLight(state)
    state = second.state
    state = updateSceneLight(state, lightId, { enabled: false })
    expect(normalizeSceneLights(state.sceneLights).some((l) => l.enabled)).toBe(true)
    state = setAllSceneLightsEnabled(state, false)
    expect(normalizeSceneLights(state.sceneLights).every((l) => !l.enabled)).toBe(true)
    state = setAllSceneLightsEnabled(state, true)
    expect(normalizeSceneLights(state.sceneLights).every((l) => l.enabled)).toBe(true)
  })
})
