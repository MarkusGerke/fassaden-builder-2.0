import type { MotionEase, MotionCurve, Opening, OpeningRollerShutter } from '../types/facade'
import {
  MOTION_V_MAX,
  MOTION_V_MIN,
  deleteMotionKey,
  insertMotionKey,
  moveMotionKey,
  normalizeMotionCurve,
  sampleMotionCurve,
  setMotionKeyEase,
} from '../utils/openingMotion'
import {
  normalizeOpeningRollerShutter,
  rollerShutterMotionPreset,
  type RollerShutterMotionPreset,
} from '../studio/rollerShutter'

const SVG_NS = 'http://www.w3.org/2000/svg'
const VIEW_W = 280
const VIEW_H = 156
const PAD_L = 30
const PAD_R = 10
const PAD_T = 10
const PAD_B = 24

export type RollerMotionPhase = 'raise' | 'lower'

export interface RollerShutterMotionEditorHost {
  getOpening(): Opening | null
  getPhase(): RollerMotionPhase
  setPhase(phase: RollerMotionPhase): void
  commitMotion(motion: NonNullable<OpeningRollerShutter['motion']>): void
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

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
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

function patchPhaseCurve(
  motion: NonNullable<OpeningRollerShutter['motion']>,
  phase: RollerMotionPhase,
  curve: MotionCurve,
): NonNullable<OpeningRollerShutter['motion']> {
  const fallback = phase === 'raise' ? motion.raise : motion.lower
  const next = normalizeMotionCurve(curve, fallback)
  return phase === 'raise'
    ? { raise: next, lower: motion.lower }
    : { raise: motion.raise, lower: next }
}

export function initRollerShutterMotionEditor(host: RollerShutterMotionEditorHost): {
  sync: () => void
  setPlayhead: (t: number | null) => void
} {
  const svg = document.querySelector<SVGSVGElement>('#roller-shutter-motion-curve')
  const durationInput = el<HTMLInputElement>('roller-shutter-duration')
  const deleteBtn = el<HTMLButtonElement>('roller-shutter-delete-key')
  const keyOptions = el<HTMLDivElement>('roller-shutter-key-options')

  let selectedIndex = 0
  let playheadT: number | null = null
  let draft: NonNullable<OpeningRollerShutter['motion']> | null = null
  let dragIndex: number | null = null

  function currentMotion(): NonNullable<OpeningRollerShutter['motion']> | null {
    if (draft) return draft
    const opening = host.getOpening()
    if (!opening) return null
    return normalizeOpeningRollerShutter(opening.rollerShutter).motion!
  }

  function currentCurve(motion: NonNullable<OpeningRollerShutter['motion']>): MotionCurve {
    return host.getPhase() === 'raise' ? motion.raise : motion.lower
  }

  function commit(motion: NonNullable<OpeningRollerShutter['motion']>) {
    draft = null
    host.commitMotion(motion)
  }

  function draw() {
    if (!svg) return
    const motion = currentMotion()
    svg.replaceChildren()
    if (!motion) return
    const curve = currentCurve(motion)

    svg.appendChild(
      svgEl('rect', {
        x: PAD_L,
        y: PAD_T,
        width: VIEW_W - PAD_L - PAD_R,
        height: VIEW_H - PAD_T - PAD_B,
        fill: '#fafafa',
      }),
    )

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
      label.textContent = v === 1 ? 'Ende' : 'Start'
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
      const selected = index === selectedIndex
      svg.appendChild(
        svgEl('circle', {
          cx: tToX(key.t),
          cy: vToY(key.v),
          r: selected ? 6 : 4.5,
          fill: selected ? '#1d4ed8' : '#fff',
          stroke: '#1d4ed8',
          'stroke-width': selected ? 2 : 1.4,
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

  function syncFields(motion: NonNullable<OpeningRollerShutter['motion']>) {
    const curve = currentCurve(motion)
    const phase = host.getPhase()
    if (durationInput && document.activeElement !== durationInput) {
      durationInput.value = String(Math.round((curve.durationMs / 1000) * 10) / 10)
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#roller-shutter-phase-group .preset-btn')) {
      btn.classList.toggle('active', btn.dataset.rollerPhase === phase)
    }
    if (keyOptions) {
      const canDelete = selectedIndex > 0 && selectedIndex < curve.keys.length - 1
      if (deleteBtn) deleteBtn.hidden = !canDelete
    }
    const ease = curve.keys[selectedIndex]?.ease ?? 'smooth'
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#roller-shutter-ease-group .preset-btn')) {
      btn.classList.toggle('active', btn.dataset.rollerEase === ease)
    }
  }

  function hitKey(curve: MotionCurve, x: number, y: number): number {
    let best = -1
    let bestDist = 10
    curve.keys.forEach((key, index) => {
      const dist = Math.hypot(tToX(key.t) - x, vToY(key.v) - y)
      if (dist < bestDist) {
        bestDist = dist
        best = index
      }
    })
    return best
  }

  function sync() {
    const opening = host.getOpening()
    if (!opening?.rollerShutter?.enabled) {
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

  document.querySelectorAll<HTMLButtonElement>('#roller-shutter-phase-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.rollerPhase
      if (next !== 'raise' && next !== 'lower') return
      host.setPhase(next)
      selectedIndex = 0
      draft = null
      sync()
    })
  })

  document.querySelectorAll<HTMLButtonElement>('#roller-shutter-preset-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rollerPreset as RollerShutterMotionPreset | undefined
      if (id !== 'soft' && id !== 'linear' && id !== 'cable') return
      commit(rollerShutterMotionPreset(id))
    })
  })

  document.querySelectorAll<HTMLButtonElement>('#roller-shutter-ease-group .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ease = btn.dataset.rollerEase as MotionEase | undefined
      if (ease !== 'smooth' && ease !== 'linear') return
      const motion = currentMotion()
      if (!motion) return
      commit(patchPhaseCurve(motion, host.getPhase(), setMotionKeyEase(currentCurve(motion), selectedIndex, ease)))
    })
  })

  deleteBtn?.addEventListener('click', () => {
    const motion = currentMotion()
    if (!motion) return
    commit(patchPhaseCurve(motion, host.getPhase(), deleteMotionKey(currentCurve(motion), selectedIndex)))
    selectedIndex = Math.max(0, selectedIndex - 1)
  })

  durationInput?.addEventListener('change', () => {
    const motion = currentMotion()
    if (!motion || !durationInput) return
    const seconds = Number(durationInput.value)
    const durationMs = Math.max(
      80,
      Math.min(12000, Math.round((Number.isFinite(seconds) ? seconds : 1.8) * 1000)),
    )
    durationInput.value = String(Math.round((durationMs / 1000) * 10) / 10)
    commit(patchPhaseCurve(motion, host.getPhase(), { ...currentCurve(motion), durationMs }))
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
    commit(patchPhaseCurve(motion, host.getPhase(), nextCurve))
  })

  svg?.addEventListener('pointermove', (event) => {
    if (dragIndex == null || !draft || !svg) return
    const { x, y } = clientToSvg(svg, event.clientX, event.clientY)
    draft = patchPhaseCurve(draft, host.getPhase(), moveMotionKey(currentCurve(draft), dragIndex, xToT(x), yToV(y)))
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
