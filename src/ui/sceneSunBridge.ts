/**
 * Park-Insel für Szene „Licht & Schatten / Sonne“ — Vanilla-Range-Inputs bleiben (hidden),
 * Werte werden 1:1 gespiegelt inkl. input-Events für main.ts.
 */
import { mountSceneSunIsland, type BoundSlider } from '@fassaden/ui'
import '@fassaden/ui/park.css'

const SUN_BUS = 'fb:scene-sun-sync'

export function publishSceneSunSync(): void {
  window.dispatchEvent(new Event(SUN_BUS))
}

function subscribeSceneSunSync(listener: () => void): () => void {
  window.addEventListener(SUN_BUS, listener)
  return () => window.removeEventListener(SUN_BUS, listener)
}

function readRange(id: string): number {
  const el = document.getElementById(id) as HTMLInputElement | null
  return el ? Number(el.value) : 0
}

function writeRange(id: string, value: number): void {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) return
  el.value = String(value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const SLIDERS: BoundSlider[] = [
  {
    id: 'sun-time',
    label: 'Tageszeit',
    min: 0,
    max: 23.9833333333,
    step: 0.0166666667,
    format: (v) => {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    },
  },
  {
    id: 'sun-azimuth',
    label: 'Sonnenwinkel (Himmelsrichtung)',
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
  },
  {
    id: 'sun-elevation',
    label: 'Sonnenwinkel (Höhe)',
    min: -12,
    max: 70,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: 'sun-intensity',
    label: 'Sonnenlicht',
    min: 0.3,
    max: 8,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  {
    id: 'sun-ambient',
    label: 'Umgebungslicht',
    min: 0.05,
    max: 1.2,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-shadow-contrast',
    label: 'Schatten-Kontrast',
    min: 0.5,
    max: 10,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-shade-depth',
    label: 'Schatten-Tiefe (Fassade & Innen)',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-softness',
    label: 'Schatten-Weichheit',
    min: 0.5,
    max: 8,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
  {
    id: 'sun-color-temp',
    label: 'Farbtemperatur',
    min: 2700,
    max: 8000,
    step: 100,
    format: (v) => `${Math.round(v)} K`,
  },
]

export function initSceneSunIsland(host: HTMLElement): () => void {
  const dispose = mountSceneSunIsland(host, {
    sliders: SLIDERS,
    readValue: readRange,
    writeValue: writeRange,
    subscribe: subscribeSceneSunSync,
  })

  return dispose
}
