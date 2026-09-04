import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR, SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import {
  MAX_SCENE_LIGHT_SHADOWS,
  SceneLightRuntime,
  STABLE_LIGHT_COUNT_STEP,
} from './sceneLightRuntime'
import { wattsToThreeIntensity } from './sceneLightUnits'

function firstPointLight(runtime: SceneLightRuntime): THREE.PointLight | undefined {
  let found: THREE.PointLight | undefined
  runtime.root.traverse((obj) => {
    if (found) return
    if ((obj as THREE.PointLight).isPointLight) found = obj as THREE.PointLight
  })
  return found
}

describe('sceneLightRuntime', () => {
  it('Bibliotheks-Punktlicht auf Außen- und Innen-Layer', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: true,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
        },
      ],
      { roomOcclusion: true },
    )
    const light = firstPointLight(runtime)
    expect(light).toBeDefined()
    expect(light!.layers.isEnabled(SHADOW_LAYER_INTERIOR)).toBe(true)
    expect(light!.layers.isEnabled(SHADOW_LAYER_EXTERIOR)).toBe(true)
    expect(light!.shadow.camera.layers.isEnabled(SHADOW_LAYER_OCCLUDER)).toBe(true)
    const root = light!.parent!
    const glow = root.children.find((c) => (c as THREE.Sprite).isSprite)
    const solid = root.children.find((c) => c.name === 'lightSolidMarker') as THREE.Mesh | undefined
    const bloomCore = root.children.find((c) => c.name === 'lightBloomCore') as THREE.Mesh | undefined
    expect(glow?.visible).toBe(false)
    expect(solid?.visible).toBe(true)
    expect(bloomCore?.visible).toBe(false)
    runtime.dispose()
  })

  it('Bloom-Kern bei Raum-Okklusion sichtbar wenn Bloom aktiv', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: true,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
        },
      ],
      { roomOcclusion: true, bloomActive: true },
    )
    const light = firstPointLight(runtime)
    const bloomCore = light!.parent!.children.find((c) => c.name === 'lightBloomCore') as
      | THREE.Mesh
      | undefined
    expect(bloomCore?.visible).toBe(true)
    runtime.dispose()
  })

  it('Deckenlampe: Spot nach unten, Point aus', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'ceil',
          x: 0,
          y: 280,
          z: 0,
          color: '#ffd080',
          intensity: 24,
          enabled: true,
          castShadow: true,
          beamMode: 'down',
          beamAngleDownDeg: 68,
        },
      ],
      { roomOcclusion: true },
    )
    let spot: THREE.SpotLight | undefined
    let point: THREE.PointLight | undefined
    runtime.root.traverse((obj) => {
      if ((obj as THREE.SpotLight).isSpotLight && obj.userData.spotDir === 'down') {
        spot = obj as THREE.SpotLight
      }
      if ((obj as THREE.PointLight).isPointLight) point = obj as THREE.PointLight
    })
    expect(spot?.visible).toBe(true)
    expect(point?.visible).toBe(false)
    expect(spot!.angle).toBeGreaterThan(0.5)
    runtime.dispose()
  })

  it('Shadow autoUpdate aus; nur neues/verschobenes Licht dirty', () => {
    const runtime = new SceneLightRuntime()
    const base = {
      color: '#ffd080',
      intensity: 12,
      enabled: true,
      castShadow: true,
      beamMode: 'omni' as const,
    }
    runtime.sync([{ id: 'a', x: 0, y: 200, z: 0, ...base }], { roomOcclusion: true })
    const lightA = firstPointLight(runtime)!
    expect(lightA.shadow.autoUpdate).toBe(false)
    expect(lightA.shadow.needsUpdate).toBe(true)
    lightA.shadow.needsUpdate = false
    // Fake: Map existiert (Bake schon gelaufen)
    lightA.shadow.map = { dispose: () => undefined } as unknown as THREE.WebGLRenderTarget

    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base },
        { id: 'b', x: 48, y: 200, z: 0, ...base },
      ],
      { roomOcclusion: true },
    )
    const lights: THREE.PointLight[] = []
    runtime.root.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) lights.push(obj as THREE.PointLight)
    })
    const a = lights.find((l) => l.userData.sceneLightId === 'a')!
    const b = lights.find((l) => l.userData.sceneLightId === 'b')!
    expect(a.shadow.needsUpdate).toBe(false)
    expect(b.shadow.needsUpdate).toBe(true)

    b.shadow.needsUpdate = false
    b.shadow.map = { dispose: () => undefined } as unknown as THREE.WebGLRenderTarget
    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base },
        { id: 'b', x: 96, y: 200, z: 0, ...base },
      ],
      { roomOcclusion: true },
    )
    expect(a.shadow.needsUpdate).toBe(false)
    expect(b.shadow.needsUpdate).toBe(true)

    // Dämmerung: aus und wieder an ohne Map-Verlust → kein Re-Bake
    b.shadow.needsUpdate = false
    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base, enabled: false },
        { id: 'b', x: 96, y: 200, z: 0, ...base, enabled: false },
      ],
      { roomOcclusion: true },
    )
    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base, enabled: true },
        { id: 'b', x: 96, y: 200, z: 0, ...base, enabled: true },
      ],
      { roomOcclusion: true },
    )
    expect(a.shadow.needsUpdate).toBe(false)
    expect(b.shadow.needsUpdate).toBe(false)
    runtime.dispose()
  })

  it('tickFades blendet Intensität ohne Shadow-Rebake', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: true,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
          fadeInMs: 1000,
          fadeOutMs: 1000,
        },
      ],
      { roomOcclusion: true },
    )
    const light = firstPointLight(runtime)!
    const map = { dispose: () => undefined } as unknown as THREE.WebGLRenderTarget
    light.shadow.map = map
    light.shadow.needsUpdate = false
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: false,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
          fadeInMs: 1000,
          fadeOutMs: 1000,
        },
      ],
      { roomOcclusion: true },
    )
    expect(runtime.tickFades(500, 0)).toBe(true)
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.intensity).toBeLessThan(wattsToThreeIntensity(12) * 0.6)
    expect(light.shadow.needsUpdate).toBe(false)
    expect(light.shadow.map).toBe(map)
    runtime.dispose()
  })

  it('stableLightCount: Reserve-Lichter halten die Anzahl bei Hinzufügen/Löschen/aus konstant', () => {
    const runtime = new SceneLightRuntime()
    const base = {
      color: '#ffd080',
      intensity: 12,
      enabled: true,
      castShadow: false,
      beamMode: 'omni' as const,
    }
    const opts = { roomOcclusion: false, stableLightCount: true }
    runtime.sync([{ id: 'a', x: 0, y: 200, z: 0, ...base }], opts)
    const first = runtime.countedLights()
    // 1 echtes Licht → auf Schritt aufgerundet (mind. eine freie Reserve).
    expect(first.points % STABLE_LIGHT_COUNT_STEP).toBe(0)
    expect(first.points).toBeGreaterThan(1)

    // Hinzufügen innerhalb der Reserve: Anzahl unverändert.
    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base },
        { id: 'b', x: 48, y: 200, z: 0, ...base },
      ],
      opts,
    )
    expect(runtime.countedLights()).toEqual(first)

    // Ausgeschaltet bleibt gezählt (visible, Intensität 0) — Blinken ohne Programmwechsel.
    runtime.sync(
      [
        { id: 'a', x: 0, y: 200, z: 0, ...base, enabled: false },
        { id: 'b', x: 48, y: 200, z: 0, ...base },
      ],
      opts,
    )
    runtime.snapFadesToEnabled(0)
    expect(runtime.countedLights()).toEqual(first)
    const lights: THREE.PointLight[] = []
    runtime.root.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) lights.push(obj as THREE.PointLight)
    })
    const a = lights.find((l) => l.userData.sceneLightId === 'a')!
    expect(a.visible).toBe(true)
    expect(a.intensity).toBe(0)

    // Löschen: Hysterese, Anzahl bleibt.
    runtime.sync([{ id: 'b', x: 48, y: 200, z: 0, ...base }], opts)
    expect(runtime.countedLights()).toEqual(first)

    // Ohne Option: Reserven aus, nur echte aktive Lichter zählen.
    runtime.sync([{ id: 'b', x: 48, y: 200, z: 0, ...base }], { roomOcclusion: false })
    expect(runtime.countedLights()).toEqual({ points: 1, spots: 0 })
    runtime.dispose()
  })

  it('Shadow-Budget: nur die hellsten N Casters behalten castShadow', () => {
    const runtime = new SceneLightRuntime()
    const n = MAX_SCENE_LIGHT_SHADOWS + 6
    const lights = Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      x: i * 40,
      y: 200,
      z: 0,
      color: '#ffaa66',
      intensity: i + 1,
      enabled: true,
      showMarker: false,
      castShadow: true,
      beamMode: 'omni' as const,
    }))
    runtime.sync(lights, { roomOcclusion: true })
    runtime.snapFadesToEnabled(0)
    const casting: { id: string; intensity: number }[] = []
    runtime.root.traverse((obj) => {
      const pl = obj as THREE.PointLight
      if (!pl.isPointLight || !pl.castShadow) return
      casting.push({ id: String(pl.userData.sceneLightId), intensity: pl.intensity })
    })
    expect(casting).toHaveLength(MAX_SCENE_LIGHT_SHADOWS)
    const ids = casting.map((c) => c.id).sort()
    const expected = lights
      .slice(-MAX_SCENE_LIGHT_SHADOWS)
      .map((l) => l.id)
      .sort()
    expect(ids).toEqual(expected)
    runtime.dispose()
  })
})
