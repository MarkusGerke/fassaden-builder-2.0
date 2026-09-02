/**
 * Fassaden-Schichten-Vertrag (Shell / Verkleidung / Anbauteile).
 *
 * Eine Öffnungsmaske steuert Loch in der dichten Wandschale (A), Ausschnitt/Dock
 * der Verkleidung (B) und Anbindung von Profilen/Verdachung (C).
 * Freiraum (`panelClearance`) vergrößert nur B — nie das Mauerloch in A.
 * „In Wand eingebettet“ (`revealFrame`) schließt A und Glas, Dekor C bleibt.
 *
 * Siehe docs/facade-layers.md.
 */
import type {
  CladdingFrontKind,
  CladdingZone,
  CladdingZoneKind,
  Opening,
  OpeningFillMode,
  Wall,
} from '../types/facade'
import { normalizeStudioPanel, panelKindForPattern } from './constants'
import {
  normalizeOpeningFill,
  normalizePanelClearance,
  normalizeRevealFrame,
  openingHasWindowChrome,
  openingLacksWindowChrome,
  openingSupportsOpeningDecor,
} from '../utils/openingGeometry'

export type { CladdingFrontKind, CladdingZone, CladdingZoneKind, OpeningFillMode }

/** Dichte Wandschale — lichtdicht, wirft/empfängt Schatten. */
export type FacadeLayerId = 'shell' | 'cladding' | 'attachment'

/** Rolle einer Öffnung gegenüber den drei Schichten. */
export interface OpeningLayerContract {
  fillMode: OpeningFillMode
  /** „In Wand eingebettet“ — Fake ohne Loch/Glas. */
  embeddedFake: boolean
  /** Schicht A: Loch in der dichten Wandschale. */
  cutsShell: boolean
  /** Glas/Flügel (nur bei echtem Durchbruch + fill opening). */
  showsGlazing: boolean
  /** Rahmen/Sprossen-Chrome. */
  showsWindowChrome: boolean
  /** Profile, Verdachung, Bänke dürfen andocken. */
  attachmentsAllowed: boolean
  /**
   * Inflate der Öffnungsmaske für Schicht A (Wandloch).
   * Immer 0 — Freiraum gehört nicht zum Mauerloch.
   */
  shellMaskInflateCm: number
  /**
   * Extra-Ausschnitt nur für Schicht B (Paneele/Mauerwerk/Mörtel).
   * = `panelClearance.cm` wenn aktiv.
   */
  claddingMaskInflateCm: number
  /** Freiraum-Bandfüllung (nur wenn Inflate > 0). */
  claddingClearanceFinish: 'none' | 'empty' | 'taper'
  /** Vorstand/Vertiefung des Freiraum-Bands (cm); 0 wenn Freiraum aus. */
  claddingClearanceDepthCm: number
}

const DEFAULT_CLEARANCE_DEPTH = 4

/**
 * Kanonische Öffnungsrolle für Shell / Cladding / Attachments.
 * Single Source of Truth — Renderer und Layout sollen hiernach entscheiden.
 */
export function resolveOpeningLayerContract(opening: Opening): OpeningLayerContract {
  const fill = normalizeOpeningFill(opening.fill)
  const embeddedFake = normalizeRevealFrame(opening.revealFrame).enabled
  const clearance = normalizePanelClearance(opening.panelClearance)
  const hidden = Boolean(opening.hidden)

  const cutsShell = !hidden && !embeddedFake && fill.mode !== 'flush'

  const showsGlazing =
    !hidden &&
    !embeddedFake &&
    !openingLacksWindowChrome(opening) &&
    fill.mode === 'opening'

  const showsWindowChrome =
    !hidden && !embeddedFake && openingHasWindowChrome(opening) && fill.mode === 'opening'

  const attachmentsAllowed = !hidden && openingSupportsOpeningDecor(opening)

  const claddingMaskInflateCm =
    !hidden && clearance.enabled ? Math.max(0, clearance.cm ?? 0) : 0

  let claddingClearanceFinish: OpeningLayerContract['claddingClearanceFinish'] = 'none'
  if (claddingMaskInflateCm > 0) {
    claddingClearanceFinish = clearance.finish === 'taper' ? 'taper' : 'empty'
  }

  const claddingClearanceDepthCm =
    claddingMaskInflateCm > 0
      ? clearance.depthCm != null && Number.isFinite(clearance.depthCm)
        ? clearance.depthCm
        : DEFAULT_CLEARANCE_DEPTH
      : 0

  return {
    fillMode: fill.mode,
    embeddedFake,
    cutsShell,
    showsGlazing,
    showsWindowChrome,
    attachmentsAllowed,
    shellMaskInflateCm: 0,
    claddingMaskInflateCm,
    claddingClearanceFinish,
    claddingClearanceDepthCm,
  }
}

/** True wenn die dichte Schale ein Loch braucht (Shadow-Tunnel, Laibung, CSG). */
export function openingCutsShell(opening: Opening): boolean {
  return resolveOpeningLayerContract(opening).cutsShell
}

/** Freiraum-cm nur für Verkleidung. */
export function openingCladdingInflateCm(opening: Opening): number {
  return resolveOpeningLayerContract(opening).claddingMaskInflateCm
}

/**
 * Leitet eine Standard-Zone aus dem heutigen `wall.panel` ab.
 * Keine Persistenz-Pflicht — Übergangspfad bis echte Zonen-UI existiert.
 */
export function deriveCladdingZonesFromPanel(wall: Wall): CladdingZone[] {
  const raw = wall.panel
  if (!raw || raw.enabled === false) {
    return [{ id: 'full', kind: 'none', front: 'flat' }]
  }
  const panel = normalizeStudioPanel(raw)
  if (panel.pattern === 'none') {
    return [{ id: 'full', kind: 'none', front: 'flat' }]
  }

  const kind: CladdingZoneKind =
    panel.pattern === 'strip'
      ? 'strip'
      : (panel.taperDepth ?? 0) > 0.05
        ? 'boss'
        : panelKindForPattern(panel.pattern) === 'masonry' || panel.pattern === 'runningBond'
          ? 'bond'
          : 'bond'

  const front: CladdingFrontKind = (panel.taperDepth ?? 0) > 0.05 ? 'frustum' : 'flat'

  return [{ id: 'full', kind, front, panel: { ...panel } }]
}

/**
 * Aktive Zonen: persistierte `wall.claddingZones` falls vorhanden und nicht leer,
 * sonst Ableitung aus Panel.
 */
export function claddingZonesForWall(wall: Wall): CladdingZone[] {
  const stored = wall.claddingZones
  if (stored && stored.length > 0) return stored
  return deriveCladdingZonesFromPanel(wall)
}

/** Kurzbeschreibung für Debug/Docs. */
export function describeOpeningLayerContract(c: OpeningLayerContract): string {
  const parts = [
    `fill=${c.fillMode}`,
    c.embeddedFake ? 'embedded' : null,
    c.cutsShell ? 'cutsShell' : 'noShellHole',
    c.showsGlazing ? 'glazing' : null,
    c.claddingMaskInflateCm > 0
      ? `clearance=${c.claddingMaskInflateCm}/${c.claddingClearanceFinish}`
      : null,
  ]
  return parts.filter(Boolean).join(' ')
}
