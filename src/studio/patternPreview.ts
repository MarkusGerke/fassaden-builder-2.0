import type { StudioPanelPattern } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { layoutPanelTiles } from './panelLayout'
import type { Wall } from '../types/facade'

const NS = 'http://www.w3.org/2000/svg'

const PREVIEW_WALL: Wall = {
  id: '__preview__',
  x: 0,
  y: 0,
  width: 192,
  height: 128,
  depth: 24,
  kind: 'studio',
  openings: [],
  profiles: [],
  neighbors: {},
  panel: DEFAULT_STUDIO_PANEL,
}

const previewSvgCache = new Map<string, SVGSVGElement>()

function previewCacheKey(
  pattern: StudioPanelPattern,
  stretcher: number,
  courseHeight: number,
): string {
  return `${pattern}:${stretcher}:${courseHeight}`
}

/** Kontur-Vorschau eines Verbands als SVG-Rechtecke. */
export function drawPatternPreviewSvg(
  svg: SVGSVGElement,
  pattern: StudioPanelPattern,
  stretcher = 32,
  courseHeight = 16,
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const panel = {
    ...DEFAULT_STUDIO_PANEL,
    pattern,
    panelWidth: stretcher,
    panelHeight: courseHeight,
    enabled: pattern !== 'none',
    projectDepth: 4,
    joint: 0.8,
  }

  const wall = { ...PREVIEW_WALL, panel }
  const tiles = layoutPanelTiles(wall, panel, [])
  if (tiles.length === 0) {
    const text = document.createElementNS(NS, 'text')
    text.setAttribute('x', '4')
    text.setAttribute('y', '12')
    text.setAttribute('font-size', '6')
    text.textContent = '—'
    svg.appendChild(text)
    return
  }

  const pad = 1
  const maxX = wall.width
  const maxY = wall.height
  svg.setAttribute('viewBox', `${-pad} ${-pad} ${maxX + pad * 2} ${maxY + pad * 2}`)

  for (const tile of tiles) {
    const rect = document.createElementNS(NS, 'rect')
    rect.setAttribute('x', String(tile.x))
    rect.setAttribute('y', String(maxY - tile.y - tile.height))
    rect.setAttribute('width', String(tile.width))
    rect.setAttribute('height', String(tile.height))
    rect.setAttribute('fill', 'none')
    rect.setAttribute('stroke', 'currentColor')
    rect.setAttribute('stroke-width', '0.6')
    if (tile.shearX) {
      rect.setAttribute(
        'transform',
        `skewX(${Math.atan(tile.shearX / tile.height) * (180 / Math.PI)})`,
      )
    }
    svg.appendChild(rect)
  }
}

/** Gecachte SVG-Vorschau klonen (einmal pro Muster berechnet). */
export function clonePatternPreviewSvg(
  pattern: StudioPanelPattern,
  stretcher = 32,
  courseHeight = 16,
): SVGSVGElement {
  const key = previewCacheKey(pattern, stretcher, courseHeight)
  let cached = previewSvgCache.get(key)
  if (!cached) {
    cached = document.createElementNS(NS, 'svg')
    drawPatternPreviewSvg(cached, pattern, stretcher, courseHeight)
    previewSvgCache.set(key, cached)
  }
  return cached.cloneNode(true) as SVGSVGElement
}
