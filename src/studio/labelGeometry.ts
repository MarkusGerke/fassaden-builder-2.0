import * as THREE from 'three'
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import type { Wall } from '../types/facade'
import {
  normalizeWallLabel,
  type WallLabelAlign,
  wallLabel,
  wallHasLabel,
  topBareBandForWall,
} from '../utils/wallLabel'
import { applySurfaceFinish } from '../utils/threeColors'
import {
  studioFacadeOutwardLocalZ,
  studioWallOuterFaceLocalZ,
  studioWindowDepthForwardSign,
} from './walls'
import {
  getLabelFont,
  labelFontTtfUrl,
  labelFontTypefaceUrl,
  resolveLabelFontId,
  type LabelFontDef,
} from './labelFonts'

/** Vor der äußersten Fassade (Paneel inkl. Bosse), klar vor Stein und Fuge. */
const FLAT_EPS_CM = 1.2
/**
 * Extrudierte Schrift: Rückseite knapp vor der äußersten Fassadenfläche,
 * Extrusion nach außen — sonst versinkt die Tiefe in den Bossen und wirkt wie Flachschrift.
 */
const EXTRUDED_EPS_CM = 1.5
/** Canvas-Auflösung — nicht zu groß, sonst rastet `measureText`/`fillText` beim ersten Federo-Draw. */
const CANVAS_HEIGHT = 96
export const WALL_LABEL_FONT_FAMILY = 'Federo'
/** Fallback, falls Typeface fehlt oder ungültig ist (Three.js-Beispieldatei). */
const WALL_LABEL_TYPEFACE_FALLBACK_URL = '/fonts/helvetiker_regular.typeface.json'
const FONT_LOAD_TIMEOUT_MS = 8000

const textureCache = new Map<string, THREE.CanvasTexture>()
const extrudedFonts = new Map<string, Font>()
const flatReady = new Set<string>()
const flatAttempted = new Set<string>()
const extrudedAttempted = new Set<string>()
const flatPromises = new Map<string, Promise<void>>()
const extrudedPromises = new Map<string, Promise<void>>()

function fontOf(fontId?: string): LabelFontDef {
  return getLabelFont(resolveLabelFontId(fontId))
}

function flatFontCss(font: LabelFontDef, sizePx = 16): string {
  return `400 ${sizePx}px "${font.family}", serif`
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('font-timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 64).trim().toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html')
}

async function fetchTypefaceJson(url: string): Promise<unknown> {
  const response = await withTimeout(fetch(url, { cache: 'no-store' }), FONT_LOAD_TIMEOUT_MS)
  if (!response.ok) throw new Error(`typeface-http-${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/html')) throw new Error('typeface-html')
  const text = await response.text()
  if (looksLikeHtml(text)) throw new Error('typeface-html-body')
  const data = JSON.parse(text) as { glyphs?: unknown }
  if (!data || typeof data !== 'object' || !data.glyphs) throw new Error('typeface-invalid')
  return data
}

async function preloadFlatFont(fontId: string): Promise<void> {
  if (flatReady.has(fontId)) return
  flatAttempted.add(fontId)
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return
  const def = fontOf(fontId)
  try {
    const face = new FontFace(def.family, `url(${labelFontTtfUrl(def)})`, {
      weight: '400',
      style: 'normal',
    })
    await withTimeout(face.load(), FONT_LOAD_TIMEOUT_MS)
    document.fonts.add(face)
    flatReady.add(fontId)
  } catch {
    flatReady.delete(fontId)
    flatPromises.delete(fontId)
  }
}

async function preloadExtrudedFont(fontId: string): Promise<void> {
  if (extrudedFonts.has(fontId)) return
  extrudedAttempted.add(fontId)
  const def = fontOf(fontId)
  const urls = [labelFontTypefaceUrl(def), WALL_LABEL_TYPEFACE_FALLBACK_URL]
  for (const url of urls) {
    try {
      const data = (await fetchTypefaceJson(url)) as Parameters<FontLoader['parse']>[0]
      extrudedFonts.set(fontId, new FontLoader().parse(data))
      return
    } catch {
      // nächster Kandidat
    }
  }
  extrudedFonts.delete(fontId)
  extrudedPromises.delete(fontId)
}

/** Flache Canvas-Schrift (TTF). Blockiert nicht den Geometrie-Rebuild. */
export function preloadWallLabelFlatFont(fontId?: string): Promise<void> {
  const id = resolveLabelFontId(fontId)
  if (flatReady.has(id)) return Promise.resolve()
  let job = flatPromises.get(id)
  if (!job) {
    job = preloadFlatFont(id).catch(() => undefined)
    flatPromises.set(id, job)
  }
  return job
}

/** Extrudierte TextGeometry (typeface.json) — erst bei „Mit Tiefe“. */
export function preloadWallLabelExtrudedFont(fontId?: string): Promise<void> {
  const id = resolveLabelFontId(fontId)
  if (extrudedFonts.has(id)) return Promise.resolve()
  let job = extrudedPromises.get(id)
  if (!job) {
    job = preloadExtrudedFont(id).catch(() => undefined)
    extrudedPromises.set(id, job)
  }
  return job
}

/** Ermöglicht einen erneuten Typeface-Load (auch wenn bereits geladen — nach Font-Fix). */
export function retryWallLabelExtrudedFont(fontId?: string): Promise<void> {
  const id = resolveLabelFontId(fontId)
  extrudedFonts.delete(id)
  extrudedAttempted.delete(id)
  extrudedPromises.delete(id)
  return preloadWallLabelExtrudedFont(id)
}

/** Lädt die genannte Schrift: flach immer, extrudiert on-demand wenn schon angefordert. */
export function preloadWallLabelFont(fontId?: string): Promise<void> {
  const id = resolveLabelFontId(fontId)
  return Promise.all([
    preloadWallLabelFlatFont(id),
    extrudedAttempted.has(id) || extrudedFonts.has(id)
      ? preloadWallLabelExtrudedFont(id)
      : Promise.resolve(),
  ]).then(() => undefined)
}

export function isWallLabelFlatFontReady(fontId?: string): boolean {
  return flatReady.has(resolveLabelFontId(fontId))
}

export function isWallLabelFontReady(fontId?: string): boolean {
  return extrudedFonts.has(resolveLabelFontId(fontId))
}

export function isWallLabelFlatFontAttempted(fontId?: string): boolean {
  return flatAttempted.has(resolveLabelFontId(fontId))
}

export function isWallLabelExtrudedFontAttempted(fontId?: string): boolean {
  return extrudedAttempted.has(resolveLabelFontId(fontId))
}

function labelAnchorOffset(align: WallLabelAlign, textWidth: number): number {
  if (align === 'left') return textWidth / 2
  if (align === 'right') return -textWidth / 2
  return 0
}

function labelOverlapsBareBand(wall: Wall, anchorY: number, heightCm: number): boolean {
  const band = topBareBandForWall(wall)
  if (!band) return false
  const bottom = anchorY
  const top = anchorY + heightCm
  const overlap = Math.min(top, band.yMax) - Math.max(bottom, band.yMin)
  return overlap >= Math.min(heightCm * 0.45, 8)
}

/** Lokales Z auf der sichtbaren Fassade (Paneel/Bosse oder nackter Freistreifen). */
export function wallLabelSurfaceLocalZ(
  wall: Wall,
  offsetForward = 0,
  extruded = false,
  anchorY?: number,
  heightCm?: number,
): number {
  const sign = studioWindowDepthForwardSign(wall)
  const eps = extruded ? EXTRUDED_EPS_CM : FLAT_EPS_CM
  const onBare =
    anchorY !== undefined &&
    heightCm !== undefined &&
    labelOverlapsBareBand(wall, anchorY, heightCm)
  // Freistreifen ohne Paneele: äußere Wandhaut (nicht Bossen-Spitze — die liegt dahinter).
  const face = onBare ? studioWallOuterFaceLocalZ(wall) : studioFacadeOutwardLocalZ(wall)
  return face + offsetForward * sign + sign * eps
}

/**
 * Spiegelt die Schrift zur Außenseite, ohne sie um die Wandmitte zu klappen.
 * Vor `translate(localX, localY, localZ)` aufrufen — sonst landet die Schrift auf der Wandrückseite.
 */
export function applyWallLabelFacing(
  geometry: THREE.BufferGeometry,
  wall: Wall,
  extruded: boolean,
): void {
  if (studioWindowDepthForwardSign(wall) >= 0) return
  // Flach und extrudiert gleich: Vorderseite nach außen (−Z bei panelFlip).
  geometry.rotateY(Math.PI)
  if (extruded) geometry.computeVertexNormals()
}

function flatLabelTexture(
  text: string,
  color: string,
  heightCm: number,
  font: LabelFontDef,
): { texture: THREE.CanvasTexture; widthCm: number; heightCm: number } {
  const ready = flatReady.has(font.id)
  const fontKey = ready ? font.id : 'fallback'
  const key = `${fontKey}|${text}|${color}|${heightCm}`
  const cached = textureCache.get(key)
  if (cached) {
    const aspect = cached.image.width / cached.image.height
    return { texture: cached, widthCm: heightCm * aspect, heightCm }
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontPx = Math.round(CANVAS_HEIGHT * 0.72)
  const fontStack = ready
    ? flatFontCss(font, fontPx)
    : `400 ${fontPx}px Georgia, 'Times New Roman', serif`
  ctx.font = fontStack
  const metrics = ctx.measureText(text)
  const textWidthPx = Math.max(1, Math.ceil(metrics.width + fontPx * 0.4))
  canvas.width = textWidthPx
  canvas.height = CANVAS_HEIGHT
  ctx.font = fontStack
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillText(text, canvas.width / 2, CANVAS_HEIGHT / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  textureCache.set(key, texture)
  const aspect = canvas.width / canvas.height
  return { texture, widthCm: heightCm * aspect, heightCm }
}

export interface WallLabelMeshSpec {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  localX: number
  localY: number
  localZ: number
  rotationY: number
}

export function createWallLabelMeshSpec(wall: Wall): WallLabelMeshSpec | null {
  const label = normalizeWallLabel(wall.label, wall)
  const text = (label.text ?? '').trim()
  if (!label.enabled || !text) return null

  const color = label.color ?? '#2c2825'
  const heightCm = label.heightCm ?? 32
  const anchorX = label.x ?? wall.width / 2
  const anchorY = label.y ?? wall.height / 2
  const align = label.align ?? 'center'
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const fontDef = fontOf(label.fontId)
  const extrudedFont = extrudedFonts.get(fontDef.id)
  const wantExtruded = label.depth === 'extruded'
  const localZ = wallLabelSurfaceLocalZ(
    wall,
    label.offsetForward ?? 0,
    wantExtruded,
    anchorY,
    heightCm,
  )
  /** Mesh folgt der Wand; die Blickrichtung steckt in der Geometrie (`applyWallLabelFacing`). */
  const rotationY = 0
  const anchorLocalY = anchorY - halfH + heightCm / 2

  if (wantExtruded && extrudedFont) {
    const extrudeCm = Math.max(0.5, label.extrudeCm ?? 4)
    const geometry = new TextGeometry(text, {
      font: extrudedFont,
      size: heightCm,
      depth: extrudeCm,
      curveSegments: 12,
      bevelEnabled: false,
    })
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) {
      geometry.dispose()
      return null
    }
    const textWidth = box.max.x - box.min.x
    const textDepth = box.max.z - box.min.z
    // Rückseite an z=0, Extrusion nach +Z (Außenseite vor applyWallLabelFacing).
    geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z)
    // Falls Typeface/Extrude unerwartet flach war: mind. gewünschte Tiefe erzwingen.
    if (textDepth < extrudeCm * 0.5) {
      geometry.scale(1, 1, extrudeCm / Math.max(1e-3, textDepth))
    }
    const localX = anchorX - halfW + labelAnchorOffset(align, textWidth)
    const localY = anchorLocalY
    applyWallLabelFacing(geometry, wall, true)
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    applySurfaceFinish(material, label.finish)
    return { geometry, material, localX, localY, localZ, rotationY }
  }

  // „Mit Tiefe“ ohne geladenes Typeface: kein stilles Flach-Fallback — Aufrufer lädt Font nach.
  if (wantExtruded && !extrudedFont) {
    return null
  }

  const { texture, widthCm, heightCm: planeHeight } = flatLabelTexture(text, color, heightCm, fontDef)
  const geometry = new THREE.PlaneGeometry(widthCm, planeHeight)
  applyWallLabelFacing(geometry, wall, false)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    // Depth-Test an: sonst scheint die Schrift durch alle Wände (Galerie).
    // polygonOffset hält sie knapp vor der eigenen Fassade ohne Z-Fight.
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    // Nur Vorderseite: DoubleSide + transparent ließ die Rückseite voll Sonne
    // (Schattenseite wirkte so hell wie die Sonnenseite).
    side: THREE.FrontSide,
    shadowSide: THREE.FrontSide,
    color: 0xffffff,
  })
  applySurfaceFinish(material, label.finish)
  const localX = anchorX - halfW + labelAnchorOffset(align, widthCm)
  const localY = anchorLocalY
  return { geometry, material, localX, localY, localZ, rotationY }
}

export function wallLabelNeedsFont(wall: Wall): boolean {
  if (!wallHasLabel(wall)) return false
  return wallLabel(wall).depth === 'extruded'
}

export function wallLabelNeedsFlatFont(wall: Wall): boolean {
  if (!wallHasLabel(wall)) return false
  return wallLabel(wall).depth !== 'extruded'
}

/** Opake 3D-Schrift wirft Schatten — Fassade muss dann empfangen. */
export function wallLabelCastsShadow(wall: Wall): boolean {
  if (!wallHasLabel(wall)) return false
  return wallLabel(wall).depth === 'extruded'
}

export function disposeWallLabelTextureCache() {
  for (const texture of textureCache.values()) texture.dispose()
  textureCache.clear()
}

export function invalidateWallLabelTexturesAfterFontLoad() {
  disposeWallLabelTextureCache()
}
