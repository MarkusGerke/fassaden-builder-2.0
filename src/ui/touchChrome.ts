/**
 * Touch-Chrome: nur grober Pointer oder schmaler Viewport (≤900px).
 * Große Desktop-Screens (auch Ansicht „Fassade“) behalten das klassische Layout.
 */

export const TOUCH_CHROME_MAX_WIDTH_PX = 900

export const TOUCH_VIEW_PREF_KEY = 'fassaden-builder-touch-view'

export type TouchViewPreference = 'present' | '3d'

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
  windows: ['measures', 'style'],
  doors: ['measures', 'style', 'stairs'],
  niches: ['measures'],
  profiles: ['profile', 'sill-outer', 'sill-inner'],
  openingForm: ['measures'],
  pediment: ['pediment', 'consoles', 'taperedField'],
  panels: ['panels'],
  cornice: ['cornice'],
  plinth: ['plinth'],
  trimBands: ['trimBands'],
  label: ['label'],
  awnings: ['awning'],
  stairs: ['stairs'],
  rollerShutters: ['roller-shutter'],
  lights: ['sceneLight'],
  /** Touch ohne Auswahl: Szene-Kacheln → Bottom-Sheet (keine Register) */
  sceneView: ['view'],
  sceneSun: ['sun'],
  sceneBloom: ['bloom'],
  sceneLights: ['sceneLights'],
}

export const SCENE_LIBRARY_TABS = ['sceneView', 'sceneSun', 'sceneBloom', 'sceneLights'] as const
export type SceneLibraryTab = (typeof SCENE_LIBRARY_TABS)[number]

/** Kacheln in der Touch-Bibliothek ohne Auswahl. */
export const SCENE_LIBRARY_TILES: ReadonlyArray<{
  tab: SceneLibraryTab
  label: string
  sections: readonly string[]
}> = [
  { tab: 'sceneView', label: 'Ansicht', sections: ['view'] },
  { tab: 'sceneSun', label: 'Licht & Schatten', sections: ['sun'] },
  { tab: 'sceneBloom', label: 'Bloom', sections: ['bloom'] },
  { tab: 'sceneLights', label: 'Lampen & Leuchten', sections: ['sceneLights'] },
]

export function isSceneLibraryTab(tab: string): tab is SceneLibraryTab {
  return (SCENE_LIBRARY_TABS as readonly string[]).includes(tab)
}

/** Settings-Sektionen, die aus der Szene-Toolbar (nicht Auswahl) kommen. */
export const SCENE_EDIT_SECTIONS = new Set(['view', 'sun', 'bloom', 'sceneLights'])

export function isSceneEditFocus(sections: string[] | null | undefined): boolean {
  return Boolean(sections?.some((id) => SCENE_EDIT_SECTIONS.has(id)))
}

/** Blickrichtung relativ zur Hausfront (Touch-Ansicht). */
export type TouchFacadeFacing = 'left' | 'frontal' | 'right'

export function normalizeYaw360(yaw: number): number {
  return ((yaw % 360) + 360) % 360
}

export function yawForTouchFacing(homeYaw: number, facing: TouchFacadeFacing): number {
  const home = normalizeYaw360(homeYaw)
  if (facing === 'frontal') return home
  if (facing === 'left') return normalizeYaw360(home + 90)
  return normalizeYaw360(home - 90)
}

/** `null` = Yaw liegt nicht auf dem Triade links/frontal/rechts. */
export function touchFacingFromYaw(homeYaw: number, yaw: number): TouchFacadeFacing | null {
  const home = normalizeYaw360(homeYaw)
  const y = normalizeYaw360(yaw)
  if (Math.abs(y - home) < 0.5 || Math.abs(y - home) > 359.5) return 'frontal'
  if (Math.abs(y - normalizeYaw360(home + 90)) < 0.5) return 'left'
  if (Math.abs(y - normalizeYaw360(home - 90)) < 0.5) return 'right'
  return null
}

/**
 * Fassaden-Yaw mit den meisten Fenstern (= Frontseite).
 * `snapYaw` z. B. 45°-Raster; bei Gleichstand kleinerer Yaw.
 */
export function facadeYawWithMostWindows(
  walls: ReadonlyArray<{
    yawDeg?: number
    openings?: ReadonlyArray<{ type?: string }>
  }>,
  snapYaw: (yaw: number) => number = (y) => normalizeYaw360(Math.round(y / 45) * 45),
): number | null {
  const counts = new Map<number, number>()
  for (const wall of walls) {
    const yaw = snapYaw(wall.yawDeg ?? 0)
    let add = 0
    for (const opening of wall.openings ?? []) {
      if (opening.type === 'window') add += 1
    }
    if (add === 0) continue
    counts.set(yaw, (counts.get(yaw) ?? 0) + add)
  }
  if (counts.size === 0) return null
  let bestYaw = 0
  let bestCount = -1
  for (const [yaw, n] of counts) {
    if (n > bestCount || (n === bestCount && yaw < bestYaw)) {
      bestCount = n
      bestYaw = yaw
    }
  }
  return bestYaw
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

export function loadTouchViewPreference(win: Window = window): TouchViewPreference {
  try {
    const raw = win.localStorage.getItem(TOUCH_VIEW_PREF_KEY)
    if (raw === '3d' || raw === 'present') return raw
  } catch {
    /* ignore */
  }
  return 'present'
}

export function saveTouchViewPreference(pref: TouchViewPreference, win: Window = window): void {
  try {
    win.localStorage.setItem(TOUCH_VIEW_PREF_KEY, pref)
  } catch {
    /* ignore */
  }
}

/**
 * Auf Touch/schmal: Fassade erzwingen, außer der Nutzer hat explizit 3D gewählt
 * (Ansicht-Register) oder Export ist aktiv.
 */
export function shouldForcePresentView(view: string, win: Window = window): boolean {
  if (view === 'export' || view === 'present' || view === '3d') return false
  if (!isCoarseOrNarrowViewport(win)) return false
  return loadTouchViewPreference(win) !== '3d'
}

/** Sektionen, die im Touch-Chrome in der Szene-Sidebar ausgeblendet bleiben. */
export const TOUCH_SCENE_HIDDEN_SECTIONS = new Set(['anim', 'perf'])

/** Touch-only Szene-Sektionen (Desktop: hidden). */
export const TOUCH_SCENE_ONLY_SECTIONS = new Set(['view'])

export const LIBRARY_EDIT_SHEET_HEIGHTS = [100, 75, 50, 25] as const
export type LibraryEditSheetHeight = (typeof LIBRARY_EDIT_SHEET_HEIGHTS)[number]
export const LIBRARY_EDIT_SHEET_HEIGHT_KEY = 'fassaden-builder-library-edit-sheet-height'

/**
 * Wenig Inhalt → 25 % (Ansicht, Bloom, Lampen & Leuchten, …).
 * Sonst Standard max. 50 %. 75/100 nur per Drag (Snaps bleiben).
 */
export const LIBRARY_EDIT_SHEET_COMPACT_SECTIONS = new Set([
  'view',
  'bloom',
  'sceneLights',
  'sceneLight',
  'label',
  'awning',
  'stairs',
  'roller-shutter',
])

export function defaultLibraryEditSheetHeight(
  sections: readonly string[] | null | undefined,
): LibraryEditSheetHeight {
  if (!sections?.length) return 50
  if (sections.every((id) => LIBRARY_EDIT_SHEET_COMPACT_SECTIONS.has(id))) return 25
  return 50
}

export function loadLibraryEditSheetHeight(win: Window = window): LibraryEditSheetHeight {
  try {
    const raw = Number(win.sessionStorage.getItem(LIBRARY_EDIT_SHEET_HEIGHT_KEY))
    if ((LIBRARY_EDIT_SHEET_HEIGHTS as readonly number[]).includes(raw)) {
      return raw as LibraryEditSheetHeight
    }
  } catch {
    /* ignore */
  }
  return 50
}

export function saveLibraryEditSheetHeight(height: LibraryEditSheetHeight, win: Window = window): void {
  try {
    win.sessionStorage.setItem(LIBRARY_EDIT_SHEET_HEIGHT_KEY, String(height))
  } catch {
    /* ignore */
  }
}

export function snapLibraryEditSheetHeight(pct: number): LibraryEditSheetHeight | 'close' {
  if (pct < 18) return 'close'
  let best: LibraryEditSheetHeight = 25
  let bestDist = Infinity
  for (const h of LIBRARY_EDIT_SHEET_HEIGHTS) {
    const d = Math.abs(h - pct)
    if (d < bestDist) {
      best = h
      bestDist = d
    }
  }
  return best
}
