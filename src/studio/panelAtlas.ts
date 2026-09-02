/**
 * Entwurf-Modus: Mauerwerk als Canvas-Textur(en) aus layoutPanelTiles
 * (gleiche Maße/Muster/Farben wie die parametrische Pipeline).
 *
 * Lange Wände werden in Streifen geteilt, damit px/cm nicht unter die
 * Lesbarkeit sinkt (früher: eine 1024px-Atlas für die ganze Wand → „Brei“).
 */

import * as THREE from 'three'
import { DEFAULT_JOINT_COLOR } from '../constants/colorPalettes'
import type { StudioPanelConfig, Wall } from '../types/facade'
import { openingCutsWall } from '../utils/openingGeometry'
import { studioWindowDepthForwardSign, studioWallOuterLocalZ } from './walls'
import {
  buildTileColorPalette,
  pickTileColorIndex,
  tileColorStageCount,
} from './tileColors'
import type { PanelTile } from './panelLayout'
import { visiblePanelRowRect } from './panelLayout'

const LIGHT_AHEAD_CM = 2
/** Max. Kantenlänge einer Atlas-Textur (WebGL-sicher, scharf genug). */
const MAX_ATLAS_PX = 2048
/** Ziel-Auflösung — ~3 px/cm ≈ 75 px pro 25 cm-Stein. */
const TARGET_PX_PER_CM = 3
/** Untergrenze, bevor weiter in Streifen geteilt wird. */
const MIN_PX_PER_CM = 2
/** Max. Streifenbreite in cm bei Ziel-Auflösung. */
const MAX_STRIP_CM = Math.floor(MAX_ATLAS_PX / TARGET_PX_PER_CM)

export interface PanelAtlasStrip {
  texture: THREE.CanvasTexture
  startCm: number
  lengthCm: number
}

export function studioLightModeTileLocalZ(wall: Wall): number {
  return studioWallOuterLocalZ(wall) + studioWindowDepthForwardSign(wall) * LIGHT_AHEAD_CM
}

/**
 * Fenster-Pivot im Entwurf-Modus: Front bündig leicht vor der Atlas-Ebene
 * (sonst liegen LOD-Fenster 24 cm in der Wand und verschwinden hinter der Textur).
 */
export function studioLightModeWindowOriginZ(
  wall: Wall,
  boxMaxZ: number,
  depthOffset = 0,
): number {
  const forward = studioWindowDepthForwardSign(wall)
  const faceZ = studioLightModeTileLocalZ(wall)
  const frontZ = faceZ + forward * 0.4 + depthOffset * forward
  return frontZ + boxMaxZ
}

function atlasScale(spanW: number, spanH: number): number {
  const longest = Math.max(spanW, spanH, 1)
  return Math.min(MAX_ATLAS_PX / longest, TARGET_PX_PER_CM)
}

/** Horizontale Streifen, damit jede Atlas-Textur ≥ MIN_PX_PER_CM hält. */
export function panelAtlasStripRanges(wallWidth: number): { startCm: number; lengthCm: number }[] {
  const width = Math.max(1, wallWidth)
  const maxSpan = Math.max(48, Math.min(MAX_STRIP_CM, Math.floor(MAX_ATLAS_PX / MIN_PX_PER_CM)))
  const ranges: { startCm: number; lengthCm: number }[] = []
  let start = 0
  while (start < width - 0.5) {
    const length = Math.min(maxSpan, width - start)
    ranges.push({ startCm: start, lengthCm: length })
    start += length
  }
  return ranges.length > 0 ? ranges : [{ startCm: 0, lengthCm: width }]
}

function paintAtlasStrip(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  claddingColor: string,
  seedKey: string,
  range: { startCm: number; lengthCm: number },
): THREE.CanvasTexture {
  const scale = atlasScale(range.lengthCm, wall.height)
  const cw = Math.max(1, Math.ceil(range.lengthCm * scale))
  const ch = Math.max(1, Math.ceil(wall.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, cw, ch)

  const band = visiblePanelRowRect(wall, panel)
  const jointColor = panel.jointColor ?? DEFAULT_JOINT_COLOR
  const stages = tileColorStageCount(panel.tileColorVariety ?? 0)
  const palette = buildTileColorPalette(
    claddingColor,
    panel.tileColorVariance ?? 0,
    stages,
  )
  const joint = Math.max(0, panel.joint ?? 0.8)
  const halfJ = joint * 0.5
  const xMin = range.startCm
  const xMax = range.startCm + range.lengthCm

  const toX = (cm: number) => (cm - range.startCm) * scale
  // Canvas Y von oben; Wand-Y von unten
  const toY = (cmFromBottom: number) => ch - cmFromBottom * scale

  if (band) {
    const bx0 = Math.max(band.x, xMin)
    const bx1 = Math.min(band.x + band.width, xMax)
    if (bx1 > bx0 + 0.05) {
      ctx.fillStyle = jointColor
      ctx.fillRect(toX(bx0), toY(band.y + band.height), (bx1 - bx0) * scale, band.height * scale)
    }
  }

  for (const tile of tiles) {
    const stableIdx = Math.round((tile.x + 1) * 128 + (tile.y + 1) * 0.5)
    const colorIdx = pickTileColorIndex(seedKey, stableIdx, stages)
    const x0 = tile.x + halfJ
    const y0 = tile.y + halfJ
    const tw = tile.width - joint
    const th = tile.height - joint
    if (tw < 0.05 || th < 0.05) continue
    const clipL = Math.max(x0, xMin)
    const clipR = Math.min(x0 + tw, xMax)
    if (clipR <= clipL + 0.05) continue
    ctx.fillStyle = palette[colorIdx] ?? claddingColor
    ctx.fillRect(toX(clipL), toY(y0 + th), (clipR - clipL) * scale, th * scale)
  }

  // Öffnungen freistellen (Wandkörper darunter bleibt sichtbar)
  ctx.globalCompositeOperation = 'destination-out'
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const ox0 = Math.max(opening.x, xMin)
    const ox1 = Math.min(opening.x + opening.width, xMax)
    if (ox1 <= ox0 + 0.05) continue
    ctx.fillRect(
      toX(ox0),
      toY(opening.y + opening.height),
      (ox1 - ox0) * scale,
      opening.height * scale,
    )
  }
  ctx.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Keine Mipmaps: bei Unterabtastung bleibt das Raster lesbar (kein „Brei“).
  texture.generateMipmaps = false
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  texture.userData.disposeCanvas = () => {
    canvas.width = 0
    canvas.height = 0
  }
  return texture
}

/** Zeichnet Fugenfläche + Steine; lange Wände → mehrere Streifen. */
export function createPanelAtlasStrips(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  claddingColor: string,
  seedKey: string,
): PanelAtlasStrip[] {
  return panelAtlasStripRanges(wall.width).map((range) => ({
    texture: paintAtlasStrip(wall, panel, tiles, claddingColor, seedKey, range),
    startCm: range.startCm,
    lengthCm: range.lengthCm,
  }))
}

/** @deprecated Prefer createPanelAtlasStrips — eine Textur nur für kurze Wände. */
export function createPanelAtlasTexture(
  wall: Wall,
  panel: StudioPanelConfig,
  tiles: PanelTile[],
  claddingColor: string,
  seedKey: string,
): THREE.CanvasTexture {
  const strips = createPanelAtlasStrips(wall, panel, tiles, claddingColor, seedKey)
  for (let i = 1; i < strips.length; i += 1) disposePanelAtlasTexture(strips[i]!.texture)
  return strips[0]!.texture
}

/** Eine ebene Wandfläche (optional Streifen) in Lokalmaßen mit UV 0…1 über den Streifen. */
export function createStudioPanelAtlasGeometry(
  wall: Wall,
  range?: { startCm: number; lengthCm: number },
): THREE.BufferGeometry {
  const startCm = range?.startCm ?? 0
  const lengthCm = range?.lengthCm ?? wall.width
  const faceZ = studioLightModeTileLocalZ(wall)
  const nz = studioWindowDepthForwardSign(wall)
  const x0 = startCm - wall.width / 2
  const x1 = startCm + lengthCm - wall.width / 2
  const y0 = -wall.height / 2
  const y1 = wall.height / 2
  const positions = new Float32Array([
    x0, y0, faceZ,
    x1, y0, faceZ,
    x1, y1, faceZ,
    x0, y1, faceZ,
  ])
  const normals = new Float32Array([
    0, 0, nz, 0, 0, nz, 0, 0, nz, 0, 0, nz,
  ])
  // Bei negativem Forward (Flip) Winding umkehren, damit Front sichtbar bleibt
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  const indices = nz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

export function disposePanelAtlasTexture(texture: THREE.Texture | undefined | null) {
  if (!texture) return
  const disposeCanvas = texture.userData?.disposeCanvas as (() => void) | undefined
  disposeCanvas?.()
  texture.dispose()
}
