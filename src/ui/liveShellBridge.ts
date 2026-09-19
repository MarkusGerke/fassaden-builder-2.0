/**
 * Park Live-Shell: eine Splitter-Welt (Ark). Vanilla-IDs bleiben im DOM, nicht im Layout.
 */
import { mountLiveShellApp, mountAppLoadingIsland, type FileMenuAction, subscribeBus, publishBus } from '@fassaden/ui'
import '@fassaden/ui/park.css'
import { APP_VERSION } from '../version'

export const SCENE_TOOLBAR_SYNC = 'fb:scene-toolbar-sync'
export const VIEWPORT_CHROME_SYNC = 'fb:viewport-chrome-sync'
export const SELECTION_TOOLBAR_SYNC = 'fb:selection-toolbar-sync'
export const LIBRARY_DOCK_SYNC = 'fb:library-dock-sync'
export const CHROME_EXTRAS_SYNC = 'fb:chrome-extras-sync'

export function publishSceneToolbarSync(): void {
  publishBus(SCENE_TOOLBAR_SYNC)
}

export function publishViewportChromeSync(): void {
  publishBus(VIEWPORT_CHROME_SYNC)
}

export function publishSelectionToolbarSync(): void {
  publishBus(SELECTION_TOOLBAR_SYNC)
}

export function publishLibraryDockSync(): void {
  publishBus(LIBRARY_DOCK_SYNC)
}

export function publishChromeExtrasSync(): void {
  publishBus(CHROME_EXTRAS_SYNC)
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

function wireSelectionSheetRelocation(getParkSel: () => HTMLElement | null): void {
  const sheet = document.getElementById('library-edit-sheet')
  const sheetBody = document.getElementById('library-edit-sheet-body')
  if (!sheet || !sheetBody) return

  let deskHost: HTMLElement | null = null
  const sync = () => {
    const parkSel = getParkSel()
    if (!parkSel) return
    if (!deskHost) deskHost = parkSel.parentElement
    if (!sheet.hidden) sheetBody.appendChild(parkSel)
    else if (deskHost) deskHost.appendChild(parkSel)
  }
  sync()
  new MutationObserver(sync).observe(sheet, {
    attributes: true,
    attributeFilter: ['hidden'],
  })
}

export function initAppLoadingIsland(): void {
  const host = document.getElementById('app-loading-root')
  if (!host || host.childElementCount > 0) return
  mountAppLoadingIsland(host)
}

export function initLiveShell(opts: {
  host: HTMLElement
  getView: () => string
  setView: (view: string) => void
  subscribeView: (listener: (value: string) => void) => () => void
}): void {
  document.documentElement.classList.add('park-shell')

  mountLiveShellApp(opts.host, {
    left: {
      versionLabel: `v${APP_VERSION}`,
      onFileAction,
      releaseHostId: 'ui-island-release',
      layerListId: 'layer-list',
      creditsButtonId: 'app-credits-btn',
    },
    viewport: {
      getView: opts.getView,
      setView: opts.setView,
      subscribeView: opts.subscribeView,
      syncEvent: VIEWPORT_CHROME_SYNC,
    },
    scene: {
      subscribe: (listener) => subscribeBus(SCENE_TOOLBAR_SYNC, listener),
    },
    selection: {
      subscribe: (listener) => subscribeBus(SELECTION_TOOLBAR_SYNC, listener),
    },
    library: {
      tabsSelector: '#vanilla-library-tabs',
      itemsHostId: 'opening-library-items',
      filterHostId: 'library-filter-row',
      syncEvent: LIBRARY_DOCK_SYNC,
    },
    chromeExtras: {
      syncEvent: CHROME_EXTRAS_SYNC,
    },
  })

  queueMicrotask(() => {
    wireSelectionSheetRelocation(
      () => document.querySelector<HTMLElement>('[data-park-selection-toolbar]'),
    )
  })
}
