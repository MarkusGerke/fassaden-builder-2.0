/**
 * Sichtbare Park-Chrome: Datei-Menü + Ansichts-SegmentGroup.
 * Vanilla-Hosts bleiben im DOM (hidden); bestehende Listener via .click().
 */
import {
  mountFileMenuIsland,
  mountViewModeIsland,
  type FileMenuAction,
} from '@fassaden/ui'
import '@fassaden/ui/park.css'

const VIEW_BUS = 'fb:chrome-view'

export function publishChromeView(view: string): void {
  window.dispatchEvent(new CustomEvent(VIEW_BUS, { detail: view }))
}

export function subscribeChromeView(listener: (view: string) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail
    if (typeof detail === 'string') listener(detail)
  }
  window.addEventListener(VIEW_BUS, handler)
  return () => window.removeEventListener(VIEW_BUS, handler)
}

function clickId(id: string): void {
  document.getElementById(id)?.click()
}

function onFileAction(action: FileMenuAction): void {
  switch (action) {
    case 'export':
      clickId('save-json')
      break
    case 'import':
      clickId('load-json')
      break
    case 'link':
      clickId('copy-link')
      break
    case 'showcase':
      clickId('copy-showcase-link')
      break
  }
}

export function initChromeIslands(opts: {
  fileHost: HTMLElement
  viewHost: HTMLElement
  getView: () => string
  setView: (view: string) => void
}): void {
  mountFileMenuIsland(opts.fileHost, onFileAction)
  mountViewModeIsland(opts.viewHost, {
    getValue: opts.getView,
    onValueChange: opts.setView,
    items: [
      { value: 'front', label: '2D' },
      { value: 'present', label: 'Fassade' },
      { value: '3d', label: '3D' },
      { value: 'export', label: 'Export' },
    ],
    subscribe: subscribeChromeView,
  })
}
