/** Persistenz für gewähltes Starter-Haus + Tour (kein Fassaden-Schema). */

export const FACADE_STARTER_STORAGE_KEY = 'fassaden-builder-facade-starter-v1'
export const TOUR_COMPLETED_KEY = 'fassaden-builder-tour-completed-v1'
export const LAYERS_VISIBLE_KEY = 'fassaden-builder-layers-visible-v1'

export const DEFAULT_FACADE_STARTER_ID = 'stadthaus-3'

export interface FacadeStarterProgress {
  starterId: string | null
}

export function loadActiveStarterId(): string | null {
  try {
    const raw = localStorage.getItem(FACADE_STARTER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { starterId?: unknown }
    return typeof parsed.starterId === 'string' ? parsed.starterId : null
  } catch {
    return null
  }
}

export function saveActiveStarterId(starterId: string | null): void {
  try {
    localStorage.setItem(FACADE_STARTER_STORAGE_KEY, JSON.stringify({ starterId }))
  } catch {
    /* ignore */
  }
}

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === '1'
  } catch {
    return false
  }
}

export function setTourCompleted(done: boolean): void {
  try {
    if (done) localStorage.setItem(TOUR_COMPLETED_KEY, '1')
    else localStorage.removeItem(TOUR_COMPLETED_KEY)
  } catch {
    /* ignore */
  }
}

/** Default: Ebenen aus (false). */
export function loadLayersVisible(): boolean {
  try {
    const v = localStorage.getItem(LAYERS_VISIBLE_KEY)
    if (v === null) return false
    return v === '1'
  } catch {
    return false
  }
}

export function saveLayersVisible(visible: boolean): void {
  try {
    localStorage.setItem(LAYERS_VISIBLE_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}
