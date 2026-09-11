import { describe, expect, it } from 'vitest'
import { DEFAULT_BLOOM_SETTINGS } from '../lighting/bloom'
import { createDefaultFacadeState } from '../types/facade'
import { DEFAULT_SCENE_APPEARANCE } from './persistence'
import {
  buildSharePayload,
  buildShowcaseUrl,
  decodeFacadeHash,
  encodeFacadeHash,
  isShowcaseViewFromUrl,
  resolveShareAppView,
  sharePayloadDefaults,
} from './share'
import { DEFAULT_SUN_SETTINGS } from './sunLighting'

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

  it('speichert die aktive Ansicht im Link', async () => {
    const facade = createDefaultFacadeState()
    const payload = buildSharePayload(facade, { view: '3d', sun: DEFAULT_SUN_SETTINGS })
    const decoded = await decodeFacadeHash(await encodeFacadeHash(payload))
    expect(decoded?.view).toBe('3d')
    expect(resolveShareAppView(decoded!)).toBe('3d')
  })

  it('resolveShareAppView: legacy viewYaw → Aufriss, sonst 3D', () => {
    expect(resolveShareAppView({ viewYaw: 90 })).toBe('front')
    expect(resolveShareAppView({})).toBe('3d')
    expect(resolveShareAppView({ view: 'present', viewYaw: 90 })).toBe('present')
  })

  it('liefert Hydrate-Defaults für fehlende Felder', () => {
    const defaults = sharePayloadDefaults()
    expect(defaults.scene).toEqual(DEFAULT_SCENE_APPEARANCE)
    expect(defaults.viewYaw).toBe(0)
  })

  it('encodiert und decodiert Licht und Bloom', async () => {
    const facade = createDefaultFacadeState()
    const payload = buildSharePayload(facade, {
      sun: {
        ...DEFAULT_SUN_SETTINGS,
        timeOfDay: 18.5,
        colorTemperature: 3200,
      },
      bloom: {
        ...DEFAULT_BLOOM_SETTINGS,
        enabled: true,
        strength: 0.4,
      },
    })
    const hash = await encodeFacadeHash(payload)
    const decoded = await decodeFacadeHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded!.sun?.timeOfDay).toBeCloseTo(18.5, 5)
    expect(decoded!.sun?.colorTemperature).toBe(3200)
    expect(decoded!.bloom?.enabled).toBe(true)
    expect(decoded!.bloom?.strength).toBeCloseTo(0.4, 5)
  })

  it('erkennt Showcase-Query und baut Showcase-URL', async () => {
    expect(isShowcaseViewFromUrl('?view=showcase')).toBe(true)
    expect(isShowcaseViewFromUrl('?showcase=1')).toBe(true)
    expect(isShowcaseViewFromUrl('?stage=1')).toBe(false)
    const facade = createDefaultFacadeState()
    const hash = await encodeFacadeHash(
      buildSharePayload(facade, {
        sun: { ...DEFAULT_SUN_SETTINGS, timeOfDay: 12 },
      }),
    )
    const link = buildShowcaseUrl(hash, 'http://example.test/app?stage=1&foo=1')
    const url = new URL(link)
    expect(url.searchParams.get('view')).toBe('showcase')
    expect(url.searchParams.has('stage')).toBe(false)
    expect(url.searchParams.get('foo')).toBe('1')
    expect(url.hash.startsWith('#f=')).toBe(true)
  })
})
