/**
 * Touch-Chrome: nur grober Pointer oder schmaler Viewport (≤900px).
 * Große Desktop-Screens (auch Ansicht „Fassade“) behalten das klassische Layout.
 */

export const TOUCH_CHROME_MAX_WIDTH_PX = 900

export type LibraryEditFocus =
  | 'measures'
  | 'colors'
  | 'pediment'
  | 'consoles'
  | 'profile'
  | 'panels'
  | 'cornice'
  | 'plinth'
  | 'trimBands'
  | 'label'
  | 'awning'
  | 'stairs'
  | 'arch'
  | 'style'

/** Bibliothek-Tab → Settings-Sektion(en) für Bearbeiten. */
export const LIBRARY_TAB_EDIT_SECTIONS: Record<string, string[]> = {
  windows: ['measures', 'colors', 'style'],
  doors: ['measures', 'colors', 'style', 'stairs'],
  niches: ['measures', 'colors'],
  profiles: ['profile', 'sill-outer', 'sill-inner'],
  openingForm: ['measures'],
  pediment: ['pediment', 'consoles', 'taperedField'],
  panels: ['panels', 'colors'],
  cornice: ['cornice'],
  plinth: ['plinth'],
  trimBands: ['trimBands'],
  label: ['label'],
  awnings: ['awning'],
  stairs: ['stairs'],
  farbe: ['colors'],
  lights: ['sceneLight'],
}

export function isCoarseOrNarrowViewport(win: Window = window): boolean {
  return (
    win.matchMedia('(pointer: coarse)').matches ||
    win.matchMedia(`(max-width: ${TOUCH_CHROME_MAX_WIDTH_PX}px)`).matches
  )
}

/**
 * Touch-Chrome-Layout aktiv.
 * `view` bleibt in der Signatur für Aufrufer; Aktivierung hängt nicht mehr von
 * Ansicht Fassade (`present`) ab — nur coarse/narrow.
 */
export function isTouchChromeLayout(_view: string, win: Window = window): boolean {
  return isCoarseOrNarrowViewport(win)
}

/** Auf Touch/schmal die Ansicht auf Fassade zwingen (nicht Export). */
export function shouldForcePresentView(view: string, win: Window = window): boolean {
  if (view === 'export' || view === 'present') return false
  return isCoarseOrNarrowViewport(win)
}
