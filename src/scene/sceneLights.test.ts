import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { clampFacadeState } from '../utils/walls'
import {
  addSceneLight,
  createSceneLightGroup,
  duplicateSceneLight,
  facadeStateDiffersOnlyBySceneLights,
  normalizeSceneLightState,
  normalizeSceneLights,
  sceneLightDisplayName,
  sceneLightsLayerListKey,
  setAllSceneLightsEnabled,
  ungroupSceneLights,
  updateSceneLight,
} from './sceneLights'

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

  it('wendet Deckenlampen-Voreinstellung an', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState(), undefined, 'deckenlampe')
    const light = normalizeSceneLights(state.sceneLights)[0]
    expect(lightId).toBeTruthy()
    expect(light?.preset).toBe('deckenlampe')
    expect(light?.beamMode).toBe('down')
    expect(light?.beamAngleDownDeg).toBe(68)
    expect(light?.label).toBe('Deckenlampe')
  })

  it('Blaulicht: feste Farbe und Blink-Animation', () => {
    const { state } = addSceneLight(createDefaultFacadeState(), undefined, 'blaulicht')
    const light = normalizeSceneLights(state.sceneLights)[0]
    expect(light?.preset).toBe('blaulicht')
    expect(light?.color).toBe('#0a3dff')
    expect(light?.animation).toBe('blaulicht')
    expect(light?.castShadow).toBe(false)
    expect(light?.beamMode).toBe('omni')
  })

  it('benennt Ebenen-Einträge nach Art mit Nummer', () => {
    let { state } = addSceneLight(createDefaultFacadeState(), undefined, 'blaulicht')
    state = addSceneLight(state, undefined, 'blaulicht').state
    state = addSceneLight(state, undefined, 'laterne').state
    const lights = normalizeSceneLights(state.sceneLights)
    expect(sceneLightDisplayName(lights[0]!, lights)).toBe('Blaulicht 1')
    expect(sceneLightDisplayName(lights[1]!, lights)).toBe('Blaulicht 2')
    expect(sceneLightDisplayName(lights[2]!, lights)).toBe('Laterne')
  })

  it('gruppiert und löst Lichter', () => {
    let { state, lightId: a } = addSceneLight(createDefaultFacadeState(), undefined, 'laterne')
    const b = addSceneLight(state, undefined, 'deckenlampe')
    state = b.state
    state = createSceneLightGroup(state, [a, b.lightId], 'Hof')
    const grouped = normalizeSceneLightState(state)
    expect(grouped.sceneLightGroups).toHaveLength(1)
    expect(grouped.sceneLightGroups[0]?.name).toBe('Hof')
    expect(grouped.sceneLights.every((l) => l.groupId === grouped.sceneLightGroups[0]?.id)).toBe(true)
    state = ungroupSceneLights(state, [a])
    const after = normalizeSceneLightState(state)
    expect(after.sceneLightGroups[0]?.memberLightIds).toEqual([b.lightId])
    expect(after.sceneLights.find((l) => l.id === a)?.groupId).toBeUndefined()
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

  it('erkennt reine Licht-Diffs (kein Fassaden-Pfad nötig)', () => {
    const base = createDefaultFacadeState()
    const { state: withLight, lightId } = addSceneLight(base)
    expect(facadeStateDiffersOnlyBySceneLights(base, withLight)).toBe(true)
    const moved = updateSceneLight(withLight, lightId, { x: 99 })
    expect(facadeStateDiffersOnlyBySceneLights(withLight, moved)).toBe(true)
    const other = { ...withLight, siteYawDeg: 15 }
    expect(facadeStateDiffersOnlyBySceneLights(withLight, other)).toBe(false)
  })

  it('Layer-List-Key ignoriert XYZ/Farbe', () => {
    const { state, lightId } = addSceneLight(createDefaultFacadeState())
    const moved = updateSceneLight(state, lightId, { x: 50, color: '#ff0000' })
    expect(sceneLightsLayerListKey(state)).toBe(sceneLightsLayerListKey(moved))
    const toggled = updateSceneLight(state, lightId, { enabled: false })
    expect(sceneLightsLayerListKey(state)).not.toBe(sceneLightsLayerListKey(toggled))
  })
})
