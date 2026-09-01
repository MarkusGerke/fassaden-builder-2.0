import type { MotionEase, MotionCurve, Opening, OpeningMotion } from '../types/facade'
import {
  MOTION_V_MAX,
  MOTION_V_MIN,
  deleteMotionKey,
  insertMotionKey,
  motionPresetById,
  moveMotionKey,
  openingMotionFromOpening,
  openingMotionToDataset,
  parseOpeningMotionDataset,
  patchOpeningMotionCurve,
  sampleMotionCurve,
  setMotionKeyEase,
} from '../utils/openingMotion'

const SVG_NS = 'http://www.w3.org/2000/svg'
const VIEW_W = 280
const VIEW_H = 156
const PAD_L = 30
const PAD_R = 10
const PAD_T = 10
const PAD_B = 24

export interface OpeningMotionEditorHost {
  getOpening(): Opening | null
  commitMotion(motion: OpeningMotion): void
  play(mode: 'open' | 'close' | 'cycle'): void
  stop(): void
  isPlaying(): boolean
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.querySelector(`#${id}`)
}

function tToX(t: number): number {
  return PAD_L + t * (VIEW_W - PAD_L - PAD_R)
}

function vToY(v: number): number {
  const u = (v - MOTION_V_MIN) / (MOTION_V_MAX - MOTION_V_MIN)
  return PAD_T + (1 - u) * (VIEW_H - PAD_T - PAD_B)
}

function xToT(x: number): number {
  return Math.max(0, Math.min(1, (x - PAD_L) / (VIEW_W - PAD_L - PAD_R)))
}

function yToV(y: number): number {
  const u = 1 - (y - PAD_T) / (VIEW_H - PAD_T - PAD_B)
  return MOTION_V_MIN + u * (MOTION_V_MAX - MOTION_V_MIN)
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value))
  }
  return node
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const mapped = pt.matrixTransform(ctm.inverse())
  return { x: mapped.x, y: mapped.y }
}

export function initOpeningMotionEditor(host: OpeningMotionEditorHost): {
  sync: () => void
  setPlayhead: (t: number | null) => void
} {
  const section = el<HTMLDivElement>('opening-motion-section')
  const svg = document.querySelector<SVGSVGElement>('#opening-motion-curve')
  const durationInput = el<HTMLInputElement>('opening-motion-duration')
  const holdInput = el<HTMLInputElement>('opening-motion-hold')
  const holdWrap = el<HTMLLabelElement>('opening-motion-hold-wrap')
  const maxDegInput = el<HTMLInputElement>('opening-motion-maxdeg')
  const datasetArea = el<HTMLTextAreaElement>('opening-motion-dataset')
  const statusEl = el<HTMLParagraphElement>('opening-motion-status')
  const deleteBtn = el<HTMLButtonElement>('opening-motion-delete-key')
  const stopBtn = el<HTMLButtonElement>('opening-motion-stop')
  const keyOptions = el<HTMLDivElement>('opening-motion-key-options')

  let phase: 'open' | 'close' = 'open'
  let selectedIndex = 0
  let playheadT: number | null = null
  let dragIndex: number | null = null
  let draft: OpeningMotion | null = null

  function setStatus(message: string, show: boolean) {
    if (!statusEl) return
    statusEl.textContent = message
    statusEl.hidden = !show
  }

  function currentMotion(): OpeningMotion | null {
    if (draft) return draft
    const opening = host.getOpening()
    if (!opening || (opening.type !== 'window' && opening.type !== 'door')) return null
    return openingMotionFromOpening(opening)
  }

  function currentCurve(motion: OpeningMotion): MotionCurve {
    return phase === 'close' ? motion.close : motion.open
  }

  function commit(motion: OpeningMotion) {
    draft = null
    host.commitMotion(motion)
  }

  function draw() {
    if (!svg) return
    const motion = currentMotion()
    svg.replaceChildren()
    if (!motion) return
    const curve = currentCurve(motion)

    const plotBg = svgEl('rect', {
      x: PAD_L,
      y: PAD_T,
      width: VIEW_W - PAD_L - PAD_R,
      height: VIEW_H - PAD_T - PAD_B,
      fill: '#fafafa',
    })
    svg.appendChild(plotBg)

    for (const v of [0, 1]) {
      const y = vToY(v)
      svg.appendChild(
        svgEl('line', {
          x1: PAD_L,
          y1: y,
          x2: VIEW_W - PAD_R,
          y2: y,
          stroke: '#ccc',
          'stroke-dasharray': v === 1 ? '3 3' : '0',
        }),
      )
      const label = svgEl('text', {
        x: PAD_L - 4,
        y: y + 3,
        'text-anchor': 'end',
        'font-size': 9,
        fill: '#666',
      })
      label.textContent = v === 1 ? 'offen' : 'zu'
      svg.appendChild(label)
    }

    const samples = sampleMotionCurve(curve, 64)
    const d = samples
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${tToX(p.t).toFixed(2)},${vToY(p.v).toFixed(2)}`)
      .join(' ')
    svg.appendChild(
      svgEl('path', {
        d,
        fill: 'none',
        stroke: '#1d4ed8',
        'stroke-width': 1.8,
      }),
    )

    if (playheadT != null) {
      const x = tToX(playheadT)
      svg.appendChild(
        svgEl('line', {
          x1: x,
          y1: PAD_T,
          x2: x,
          y2: VIEW_H - PAD_B,
          stroke: '#c2410c',
          'stroke-width': 1.2,
          'stroke-dasharray': '3 2',
        }),
      )
    }

    curve.keys.forEach((key, index) => {
      const cx = tToX(key.t)
      const cy = vToY(key.v)
      const selected = index === selectedIndex
      svg.appendChild(
        svgEl('circle', {
          cx,
          cy,
          r: selected ? 6 : 4.5,
          fill: selected ? '#1d4ed8' : '#fff',
          stroke: '#1d4ed8',
          'stroke-width': selected ? 2 : 1.4,
          'data-key-index': index,
        }),
      )
    })

    const axis = svgEl('text', {
      x: VIEW_W / 2,
      y: VIEW_H - 6,
      'text-anchor': 'middle',
      'font-size': 9,
      fill: '#777',
    })
    axis.textContent = 'Zeit →'
    svg.appendChild(axis)
  }

  function syncFields(motion: OpeningMotion) {
    const curve = currentCurve(motion)
    if (durationInput && document.activeElement !== durationInput) {
      durationInput.value = String(curve.durationMs)
    }
    if (holdInput && document.activeElement !== holdInput) {
      holdInput.value = String(motion.open.holdMs ?? 0)
    }
    if (maxDegInput && document.activeElement !== maxDegInput) {
      maxDegInput.value = String(motion.maxDeg)
    }
    if (holdWrap) holdWrap.hidden = phase !== 'open'
    if (keyOptions) {
      const canDelete = selectedIndex > 0 && selectedIndex < curve.keys.length - 1
      if (deleteBtn) deleteBtn.hidden = !canDelete
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#opening-motion-phase-group .preset-btn')) {
      btn.classList.toggle('active', btn.dataset.motionPhase === phase)
    }
    const ease = curve.keys[selectedIndex]?.ease ?? 'smooth'
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#opening-motion-ease-group .preset-btn')) {
      btn.classList.toggle('active', btn.dataset.motionEase === ease)
    }
    if (datasetArea && document.activeElement !== datasetArea) {
      const opening = host.getOpening()
      const preset = opening?.type === 'door' ? 'door' : 'window'
      datasetArea.value = JSON.stringify(openingMotionToDataset(motion, preset), null, 2)
    }
    if (stopBtn) stopBtn.hidden = !host.isPlaying()
  }

  function hitKey(curve: MotionCurve, x: number, y: number): number {
    let best = -1
    let bestDist = 10
    curve.keys.forEach((key, index) => {
      const dx = tToX(key.t) - x
      const dy = vToY(key.v) - y
      const dist = Math.hypot(dx, dy)
      if (dist < bestDist) {
        bestDist = dist
        best = index
      }
    })
    return best
  }

  function sync() {
    const opening = host.getOpening()
    if (!section) return
    if (!opening || (opening.type !== 'window' && opening.type !== 'door')) {
      draw()
      return
    }
    const motion = currentMotion()
    if (!motion) return
    const curve = currentCurve(motion)
    if (selectedIndex >= curve.keys.length) selectedIndex = curve.keys.length - 1
    if (selectedIndex < 0) selectedIndex = 0
    syncFields(motion)
    draw()
  }

  document.querySelectorAll<HTMLButtonElement>('#opening-motion-phase-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.motionPhase
      if (next !== 'open' && next !== 'close') return
      phase = next
      selectedIndex = 0
      draft = null
      sync()
    })
  })

  document.querySelectorAll<HTMLButtonElement>('#opening-motion-preset-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.motionPreset
      if (id !== 'window' && id !== 'door' && id !== 'linear') return
      commit(motionPresetById(id))
    })
  })

  document.querySelectorAll<HTMLButtonElement>('#opening-motion-ease-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ease = btn.dataset.motionEase as MotionEase | undefined
      if (ease !== 'smooth' && ease !== 'linear') return
      const motion = currentMotion()
      if (!motion) return
      commit(patchOpeningMotionCurve(motion, phase, setMotionKeyEase(currentCurve(motion), selectedIndex, ease)))
    })
  })

  deleteBtn?.addEventListener('click', () => {
    const motion = currentMotion()
    if (!motion) return
    commit(patchOpeningMotionCurve(motion, phase, deleteMotionKey(currentCurve(motion), selectedIndex)))
    selectedIndex = Math.max(0, selectedIndex - 1)
  })

  durationInput?.addEventListener('change', () => {
    const motion = currentMotion()
    if (!motion) return
    const curve = { ...currentCurve(motion), durationMs: Number(durationInput.value) }
    commit(patchOpeningMotionCurve(motion, phase, curve))
  })

  holdInput?.addEventListener('change', () => {
    const motion = currentMotion()
    if (!motion) return
    commit({
      ...motion,
      open: { ...motion.open, holdMs: Number(holdInput.value) },
    })
  })

  maxDegInput?.addEventListener('change', () => {
    const motion = currentMotion()
    if (!motion) return
    commit({ ...motion, maxDeg: Number(maxDegInput.value) })
  })

  el<HTMLButtonElement>('opening-motion-play-open')?.addEventListener('click', () => host.play('open'))
  el<HTMLButtonElement>('opening-motion-play-close')?.addEventListener('click', () => host.play('close'))
  el<HTMLButtonElement>('opening-motion-play-cycle')?.addEventListener('click', () => host.play('cycle'))
  stopBtn?.addEventListener('click', () => host.stop())

  el<HTMLButtonElement>('opening-motion-copy')?.addEventListener('click', async () => {
    const motion = currentMotion()
    if (!motion || !datasetArea) return
    const text = datasetArea.value || JSON.stringify(openingMotionToDataset(motion), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Datensatz kopiert.', true)
    } catch {
      datasetArea.select()
      setStatus('Bitte manuell kopieren (Strg/Cmd+C).', true)
    }
  })

  el<HTMLButtonElement>('opening-motion-apply')?.addEventListener('click', () => {
    const opening = host.getOpening()
    if (!opening || !datasetArea) return
    const parsed = parseOpeningMotionDataset(datasetArea.value, opening.type)
    if (!parsed) {
      setStatus('Ungültiger Datensatz — Format fassaden-opening-motion/v1 erwartet.', true)
      return
    }
    setStatus('', false)
    commit(parsed)
  })

  svg?.addEventListener('pointerdown', (event) => {
    const motion = currentMotion()
    if (!motion || !svg) return
    const { x, y } = clientToSvg(svg, event.clientX, event.clientY)
    const curve = currentCurve(motion)
    const hit = hitKey(curve, x, y)
    if (hit >= 0) {
      selectedIndex = hit
      dragIndex = hit
      draft = motion
      svg.setPointerCapture(event.pointerId)
      draw()
      return
    }
    if (x < PAD_L || x > VIEW_W - PAD_R || y < PAD_T || y > VIEW_H - PAD_B) return
    const nextCurve = insertMotionKey(curve, xToT(x), yToV(y))
    const inserted = nextCurve.keys.findIndex(
      (key) => Math.abs(key.t - xToT(x)) < 0.04 && Math.abs(key.v - yToV(y)) < 0.08,
    )
    selectedIndex = inserted >= 0 ? inserted : Math.max(1, nextCurve.keys.length - 2)
    commit(patchOpeningMotionCurve(motion, phase, nextCurve))
  })

  svg?.addEventListener('pointermove', (event) => {
    if (dragIndex == null || !draft || !svg) return
    const { x, y } = clientToSvg(svg, event.clientX, event.clientY)
    draft = patchOpeningMotionCurve(draft, phase, moveMotionKey(currentCurve(draft), dragIndex, xToT(x), yToV(y)))
    draw()
  })

  const endDrag = (event: PointerEvent) => {
    if (dragIndex == null) return
    if (svg?.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
    dragIndex = null
    if (draft) commit(draft)
  }

  svg?.addEventListener('pointerup', endDrag)
  svg?.addEventListener('pointercancel', endDrag)

  return {
    sync,
    setPlayhead(t) {
      playheadT = t
      draw()
    },
  }
}
