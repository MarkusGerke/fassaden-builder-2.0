import type { WallOpeningPreset } from '../constants/presets'
import { DEFAULT_FRAME_COLOR, DEFAULT_GLASS_COLOR } from '../constants/colorPalettes'
import type { GruenderzeitWindowConfig, Opening } from '../types/facade'
import {
  defaultGruenderzeitConfig,
  gruenderzeitPreviewSvg,
} from '../windows/gruenderzeit'

/** Linienzeichnung (Ansicht „Zeichnung“) als SVG-Vorschau für Bibliothekskarten. */
export function openingPreviewSvg(preset: WallOpeningPreset): string {
  if (preset.type === 'conch') {
    return conchPreviewSvg(preset.width, preset.height)
  }
  if (preset.type === 'cutout') {
    return cutoutPreviewSvg(preset.width, preset.height, preset.cutoutShape ?? 'rect')
  }
  return openingSizePreviewSvg(preset.width, preset.height, preset.type)
}

function conchPreviewSvg(width: number, height: number): string {
  const pad = 10
  const vbW = width + pad * 2
  const vbH = height + pad * 2
  const x = pad
  const y = pad
  const r = Math.min(width / 2, height)
  const spring = y + height - r
  const cx = x + width / 2
  const path = [
    `M ${x} ${y + height}`,
    `L ${x} ${spring}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${spring}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
  // Kalotten-Hinweis: innere Halbkreis-Bögen
  const arcs = [0.35, 0.65]
    .map((t) => {
      const rr = r * t
      return `<path d="M ${cx - rr} ${spring} A ${rr} ${rr} 0 0 1 ${cx + rr} ${spring}" fill="none" stroke="#8a8378" stroke-width="1.2"/>`
    })
    .join('')
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${path}" fill="#cfc8bc" stroke="#5c564c" stroke-width="2"/>${arcs}</svg>`
}

function cutoutPreviewSvg(width: number, height: number, shape: 'rect' | 'round'): string {
  const pad = 10
  const vbW = width + pad * 2
  const vbH = height + pad * 2
  const x = pad
  const y = pad
  const r = Math.min(width, height) / 2
  const body =
    shape === 'round'
      ? width >= height - 0.5 && height >= width - 0.5
        ? `<circle cx="${x + width / 2}" cy="${y + height / 2}" r="${r}" fill="#cfc8bc" stroke="#5c564c" stroke-width="2"/>`
        : width <= height
          ? `<path d="M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + width} ${y + r} L ${x + width} ${y + height - r} A ${r} ${r} 0 0 1 ${x} ${y + height - r} Z" fill="#cfc8bc" stroke="#5c564c" stroke-width="2"/>`
          : `<path d="M ${x + r} ${y} L ${x + width - r} ${y} A ${r} ${r} 0 0 1 ${x + width - r} ${y + height} L ${x + r} ${y + height} A ${r} ${r} 0 0 1 ${x + r} ${y} Z" fill="#cfc8bc" stroke="#5c564c" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#cfc8bc" stroke="#5c564c" stroke-width="2"/>`
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`
}

export function openingSizePreviewSvg(
  width: number,
  height: number,
  type: Opening['type'],
  config?: GruenderzeitWindowConfig,
): string {
  const pad = 10
  const vbW = width + pad * 2
  const vbH = height + pad * 2
  const x = pad
  const y = pad
  const cfg = config ?? defaultGruenderzeitConfig(width, height, type)
  const inner = gruenderzeitPreviewSvg(width, height, cfg, DEFAULT_FRAME_COLOR, DEFAULT_GLASS_COLOR)
  const innerBody = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g transform="translate(${x} ${y})">${innerBody}</g>
  </svg>`
}
