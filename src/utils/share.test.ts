import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import {
  buildSharePayload,
  decodeFacadeHash,
  encodeFacadeHash,
  sharePayloadDefaults,
} from './share'
import { DEFAULT_SCENE_APPEARANCE } from './persistence'

describe('share payload', () => {
  it('encodiert und decodiert Szene-Farben und Kompass', async () => {
    const facade = createDefaultFacadeState()
    const payload = buildSharePayload(facade, {
      scene: {
        background: '#112233',
        ground: '#445566',
        skyReflection: '#778899',
        lineStrokeScale: 1.5,
      },
      viewYaw: 270,
    })
    const hash = await encodeFacadeHash(payload)
    const decoded = await decodeFacadeHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded!.scene?.ground).toBe('#445566')
    expect(decoded!.scene?.background).toBe('#112233')
    expect(decoded!.viewYaw).toBe(270)
  })

  it('liest alte Links ohne Wrapper weiter als reine Fassade', async () => {
    const facade = createDefaultFacadeState()
    const hash = await encodeFacadeHash(facade)
    const decoded = await decodeFacadeHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded!.facade.buildings.length).toBeGreaterThan(0)
    expect(decoded!.scene).toBeUndefined()
    expect(decoded!.viewYaw).toBeUndefined()
  })

  it('liefert Hydrate-Defaults für fehlende Felder', () => {
    const defaults = sharePayloadDefaults()
    expect(defaults.scene).toEqual(DEFAULT_SCENE_APPEARANCE)
    expect(defaults.viewYaw).toBe(0)
  })
})
