import { wallCompassLabel } from '../studio/compass'
import { normalizeYawDeg } from '../studio/compass'

export type ExportAspectId = '1:1' | '3:4' | '2:3' | '9:16'
export type ExportOrientation = 'portrait' | 'landscape'

export type ExportViewKind = { kind: 'yaw'; yaw: number } | { kind: 'top' }

export interface ExportSlotState {
  id: string
  view: ExportViewKind
  enabled: boolean
  /** Passepartout-Rand als % der kürzeren Frame-Seite. */
  passepartoutPct: number
  passepartoutColor: string
}

export interface ExportModeUiState {
  orientation: ExportOrientation
  aspectId: ExportAspectId
  wallpaper: boolean
  /** Top-Safe-Area in % der Frame-Höhe (Uhr). */
  wallpaperTopPct: number
  focusedSlotId: string | null
  slots: ExportSlotState[]
}

export const EXPORT_ASPECT_OPTIONS: Array<{ id: ExportAspectId; label: string }> = [
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '2:3', label: '2:3' },
  { id: '9:16', label: '9:16' },
]

export const DEFAULT_PASSEPARTOUT_PCT = 6
export const DEFAULT_PASSEPARTOUT_COLOR = '#f2f0ea'
export const DEFAULT_WALLPAPER_TOP_PCT = 11
export const EXPORT_CAPTURE_LONG_EDGE = 1600
export const EXPORT_JPG_QUALITY = 0.92

export function createDefaultExportState(yaws: number[]): ExportModeUiState {
  const slots: ExportSlotState[] = yaws.map((yaw) => ({
    id: `yaw-${normalizeYawDeg(yaw)}`,
    view: { kind: 'yaw', yaw: normalizeYawDeg(yaw) },
    enabled: true,
    passepartoutPct: DEFAULT_PASSEPARTOUT_PCT,
    passepartoutColor: DEFAULT_PASSEPARTOUT_COLOR,
  }))
  slots.push({
    id: 'top',
    view: { kind: 'top' },
    enabled: false,
    passepartoutPct: DEFAULT_PASSEPARTOUT_PCT,
    passepartoutColor: DEFAULT_PASSEPARTOUT_COLOR,
  })
  return {
    orientation: 'landscape',
    aspectId: '9:16',
    wallpaper: false,
    wallpaperTopPct: DEFAULT_WALLPAPER_TOP_PCT,
    focusedSlotId: slots[0]?.id ?? null,
    slots,
  }
}

/** Portrait: aspect als Höhe/Breite-Anteil; Landscape gespiegelt. Rückgabe: width/height. */
export function exportFrameAspectRatio(
  orientation: ExportOrientation,
  aspectId: ExportAspectId,
): number {
  const [a, b] = aspectId.split(':').map(Number) as [number, number]
  // aspectId ist Hochformat-Ratio (schmal:hoch), z. B. 9:16
  const portraitWh = a / b
  return orientation === 'portrait' ? portraitWh : 1 / portraitWh
}

export function exportFramePixelSize(
  orientation: ExportOrientation,
  aspectId: ExportAspectId,
  longEdge = EXPORT_CAPTURE_LONG_EDGE,
): { width: number; height: number } {
  const ratio = exportFrameAspectRatio(orientation, aspectId)
  if (ratio >= 1) {
    return { width: longEdge, height: Math.max(1, Math.round(longEdge / ratio)) }
  }
  return { width: Math.max(1, Math.round(longEdge * ratio)), height: longEdge }
}

export function exportSlotLabel(view: ExportViewKind): string {
  if (view.kind === 'top') return 'Oben'
  return wallCompassLabel(view.yaw)
}

export function syncExportSlotsWithYaws(state: ExportModeUiState, yaws: number[]): ExportModeUiState {
  const normalized = [...new Set(yaws.map((y) => normalizeYawDeg(y)))].sort((a, b) => a - b)
  const byId = new Map(state.slots.map((slot) => [slot.id, slot]))
  const next: ExportSlotState[] = normalized.map((yaw) => {
    const id = `yaw-${yaw}`
    const prev = byId.get(id)
    return (
      prev ?? {
        id,
        view: { kind: 'yaw' as const, yaw },
        enabled: true,
        passepartoutPct: DEFAULT_PASSEPARTOUT_PCT,
        passepartoutColor: DEFAULT_PASSEPARTOUT_COLOR,
      }
    )
  })
  const topPrev = byId.get('top')
  next.push(
    topPrev ?? {
      id: 'top',
      view: { kind: 'top' },
      enabled: false,
      passepartoutPct: DEFAULT_PASSEPARTOUT_PCT,
      passepartoutColor: DEFAULT_PASSEPARTOUT_COLOR,
    },
  )
  const focused =
    next.find((slot) => slot.id === state.focusedSlotId)?.id ?? next.find((s) => s.enabled)?.id ?? null
  return { ...state, slots: next, focusedSlotId: focused }
}

export function buildExportFilename(ext: 'png' | 'jpg'): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `fassade-export-${stamp}.${ext}`
}

/**
 * Zeichnet ein Slot-Bild in einen Frame (Passepartout + optional Wallpaper-Top).
 * `image` wird contain in die innere Fläche gelegt.
 */
export function drawExportFrame(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  frameW: number,
  frameH: number,
  slot: ExportSlotState,
  wallpaper: boolean,
  wallpaperTopPct: number,
): void {
  const shorter = Math.min(frameW, frameH)
  const pad = Math.max(0, (slot.passepartoutPct / 100) * shorter)
  const topSafe = wallpaper ? Math.max(0, (wallpaperTopPct / 100) * frameH) : 0

  ctx.fillStyle = slot.passepartoutColor
  ctx.fillRect(x, y, frameW, frameH)

  const innerX = x + pad
  const innerY = y + pad + topSafe
  const innerW = Math.max(1, frameW - pad * 2)
  const innerH = Math.max(1, frameH - pad * 2 - topSafe)

  const imgW = 'width' in image ? Number(image.width) : 1
  const imgH = 'height' in image ? Number(image.height) : 1
  const scale = Math.min(innerW / Math.max(1, imgW), innerH / Math.max(1, imgH))
  const drawW = imgW * scale
  const drawH = imgH * scale
  const drawX = innerX + (innerW - drawW) / 2
  const drawY = innerY + (innerH - drawH) / 2
  ctx.drawImage(image, drawX, drawY, drawW, drawH)
}

export function composeExportGrid(
  frames: Array<{ image: CanvasImageSource; slot: ExportSlotState }>,
  frameW: number,
  frameH: number,
  wallpaper: boolean,
  wallpaperTopPct: number,
  gap = 24,
  bg = '#2a2a2a',
): HTMLCanvasElement {
  const n = Math.max(1, frames.length)
  const cols = Math.min(n, n <= 2 ? n : n <= 4 ? 2 : 3)
  const rows = Math.ceil(n / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * frameW + (cols + 1) * gap
  canvas.height = rows * frameH + (rows + 1) * gap
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  frames.forEach((frame, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = gap + col * (frameW + gap)
    const y = gap + row * (frameH + gap)
    drawExportFrame(ctx, frame.image, x, y, frameW, frameH, frame.slot, wallpaper, wallpaperTopPct)
  })
  return canvas
}

export function downloadCanvasBlob(canvas: HTMLCanvasElement, filename: string, type: 'image/png' | 'image/jpeg', quality?: number) {
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    type,
    quality,
  )
}
