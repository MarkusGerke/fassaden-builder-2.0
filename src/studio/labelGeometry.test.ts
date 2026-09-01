import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { DEFAULT_STUDIO_PANEL } from './constants'
import {
  applyWallLabelFacing,
  createWallLabelMeshSpec,
  retryWallLabelExtrudedFont,
  wallLabelSurfaceLocalZ,
} from './labelGeometry'
import { studioFacadeOutwardLocalZ, studioWindowDepthForwardSign } from './walls'

const typefacePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/fonts/Federo-Regular.typeface.json',
)

function masonryWall(panelFlip: boolean): Wall {
  return {
    id: 'wall-1',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 944,
    height: 544,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: panelFlip ? 180 : 0,
    panelFlip,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    panel: {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'headerBond',
      projectDepth: 3.8,
      taperDepth: 4,
    },
    label: {
      enabled: true,
      text: 'Test',
      depth: 'flat',
      x: 472,
      y: 224,
      heightCm: 32,
      color: '#0D0D0D',
    },
  }
}

describe('wallLabel placement', () => {
  it('sitzt auf der äußersten Fassade (inkl. Bosse)', () => {
    const wall = masonryWall(false)
    const z = wallLabelSurfaceLocalZ(wall, 0)
    const face = studioFacadeOutwardLocalZ(wall)
    const sign = studioWindowDepthForwardSign(wall)
    expect(z).toBeCloseTo(face + sign * 1.2)
    expect(z).toBeGreaterThan(wall.depth)
  })

  it('legt extrudierte Schrift auf dieselbe Fassaden-Ebene wie Flachschrift', () => {
    const wall = masonryWall(false)
    const flat = wallLabelSurfaceLocalZ(wall, 0, false)
    const extruded = wallLabelSurfaceLocalZ(wall, 0, true)
    expect(extruded).toBeCloseTo(flat + 0.3, 1) // etwas mehr Eps bei Extrusion
    expect(extruded).toBeGreaterThan(studioFacadeOutwardLocalZ(wall))
  })

  it('dreht extrudierte Schrift bei panelFlip nach außen wie die flache Plane', () => {
    const wall = masonryWall(true)
    const geometry = new THREE.BoxGeometry(10, 10, 4)
    geometry.translate(0, 0, 2) // z=0..4, Front bei +Z
    applyWallLabelFacing(geometry, wall, true)
    geometry.computeBoundingBox()
    // Nach rotateY(π): Extrusion zeigt nach −Z (Außenseite).
    expect(geometry.boundingBox!.max.z).toBeLessThanOrEqual(1e-6)
    expect(geometry.boundingBox!.min.z).toBeLessThan(0)
  })

  it('liegt im oberen Freistreifen auf der Wandhaut, nicht hinter den Bossen', () => {
    const wall = masonryWall(true)
    wall.panel!.hideRowsTop = 1
    const heightCm = 48
    const anchorY = wall.height - heightCm
    const onBare = wallLabelSurfaceLocalZ(wall, 0, false, anchorY, heightCm)
    const onPanels = wallLabelSurfaceLocalZ(wall, 0, false, 200, heightCm)
    expect(onBare).toBeGreaterThan(onPanels)
    expect(onBare).toBeGreaterThan(-2)
  })

  it('bleibt bei panelFlip auf der Außenseite statt durch die Wandmitte zu klappen', () => {
    const wall = masonryWall(true)
    const localZ = wallLabelSurfaceLocalZ(wall, 0)
    expect(localZ).toBeLessThan(0)
    expect(Math.abs(localZ - studioFacadeOutwardLocalZ(wall))).toBeLessThan(2)

    const geometry = new THREE.PlaneGeometry(40, 32)
    applyWallLabelFacing(geometry, wall, false)
    geometry.translate(0, 0, localZ)
    geometry.computeBoundingBox()
    const z = geometry.boundingBox!.min.z
    expect(z).toBeCloseTo(localZ)

    const flippedAfterTranslate = new THREE.PlaneGeometry(40, 32)
    flippedAfterTranslate.translate(0, 0, localZ)
    flippedAfterTranslate.rotateY(Math.PI)
    flippedAfterTranslate.computeBoundingBox()
    expect(flippedAfterTranslate.boundingBox!.min.z).toBeCloseTo(-localZ)
    expect(flippedAfterTranslate.boundingBox!.min.z).toBeGreaterThan(0)
  })

  it('lässt extrudierte Schrift vor der Fassade stehen, nicht im Stein', () => {
    const wall = masonryWall(false)
    const geometry = new THREE.BoxGeometry(10, 10, 8)
    geometry.translate(0, 0, 4)
    applyWallLabelFacing(geometry, wall, true)
    const localZ = wallLabelSurfaceLocalZ(wall, 0, true)
    geometry.translate(0, 0, localZ)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(
      studioFacadeOutwardLocalZ(wall) - 1e-6,
    )
  })

  it('verschiebt Schrift mit negativem Vorstand nach hinten', () => {
    const wall = masonryWall(false)
    const face = studioFacadeOutwardLocalZ(wall)
    const sign = studioWindowDepthForwardSign(wall)
    const forward = wallLabelSurfaceLocalZ(wall, 4, false)
    const back = wallLabelSurfaceLocalZ(wall, -4, false)
    expect(forward).toBeCloseTo(face + sign * 4 + sign * 1.2)
    expect(back).toBeCloseTo(face + sign * -4 + sign * 1.2)
    expect(back).toBeLessThan(forward)
  })

  it('verschiebt Schrift mit negativem Vorstand bei panelFlip nach innen', () => {
    const wall = masonryWall(true)
    const face = studioFacadeOutwardLocalZ(wall)
    const sign = studioWindowDepthForwardSign(wall)
    expect(sign).toBe(-1)
    const back = wallLabelSurfaceLocalZ(wall, -5, false)
    // Negativer Vorstand: entgegen −Z, also Richtung Wandmitte (größeres Z).
    expect(back).toBeCloseTo(face + -5 * sign + sign * 1.2)
    expect(back).toBeGreaterThan(face + sign * 1.2)
  })
})

describe('createWallLabelMeshSpec extruded', () => {
  it('extrudiert auch Texte mit & und behält beide Punzen', async () => {
    const typefaceJson = readFileSync(typefacePath, 'utf8')
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('typeface.json')) {
        return new Response(typefaceJson, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return originalFetch(input)
    }) as typeof fetch
    try {
      const { FontLoader } = await import('three/addons/loaders/FontLoader.js')
      const font = new FontLoader().parse(JSON.parse(typefaceJson))
      const ampShapes = font.generateShapes('&', 32)
      expect(ampShapes).toHaveLength(1)
      expect(ampShapes[0]!.holes).toHaveLength(2)

      await retryWallLabelExtrudedFont()
      const wall = masonryWall(false)
      wall.label = {
        enabled: true,
        text: 'Brot & Brötchen',
        depth: 'extruded',
        extrudeCm: 8,
        x: 472,
        y: 224,
        heightCm: 32,
        color: '#E8C547',
      }
      const spec = createWallLabelMeshSpec(wall)
      expect(spec).not.toBeNull()
      expect(spec!.geometry.type).toBe('TextGeometry')
      expect((spec!.material as THREE.MeshStandardMaterial).transparent).toBe(false)
      spec!.geometry.computeBoundingBox()
      const box = spec!.geometry.boundingBox!
      expect(box.max.z - box.min.z).toBeGreaterThan(7)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
