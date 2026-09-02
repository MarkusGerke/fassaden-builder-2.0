/**
 * Fassaden-Schichten: Zonen (B) + Re-Exports des Öffnungsvertrags.
 * Vertrag selbst: `resolveOpeningLayerContract` in openingGeometry.ts.
 * Siehe docs/facade-layers.md.
 */
import type {
  CladdingFrontKind,
  CladdingZone,
  CladdingZoneKind,
  Opening,
  StudioPanelConfig,
  Wall,
} from '../types/facade'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel, panelKindForPattern } from './constants'
import {
  openingArchVoussoirsEnabled,
  openingCutsWall,
  openingPanelClearance,
  openingPanelClearanceFinish,
  resolveOpeningLayerContract,
  type OpeningLayerContract,
} from '../utils/openingGeometry'

export type { CladdingFrontKind, CladdingZone, CladdingZoneKind, OpeningLayerContract }
export { resolveOpeningLayerContract }

/** Dichte Wandschale — lichtdicht, wirft/empfängt Schatten. */
export type FacadeLayerId = 'shell' | 'cladding' | 'attachment'

/** Alias: Schicht-A-Loch (gleiche Semantik wie `openingCutsWall`). */
export function openingCutsShell(opening: Opening): boolean {
  return openingCutsWall(opening)
}

/** Freiraum-cm nur für Verkleidung. */
export function openingCladdingInflateCm(opening: Opening): number {
  return openingPanelClearance(opening)
}

/**
 * Inflate für Feld-Layout / Siegel an der Laibung.
 * Bei Keilstein-Ring ohne taper-Freiraum: 0 (Raster dockt am Extrados).
 */
export function openingCladdingMaskInflateForLayout(opening: Opening): number {
  const c = resolveOpeningLayerContract(opening)
  if (!c.cutsShell) return 0
  if (openingArchVoussoirsEnabled(opening) && c.claddingClearanceFinish !== 'taper') return 0
  return c.claddingMaskInflateCm
}

/**
 * Effektives Paneel für eine Zone (Wand-Panel + Zone-Overrides).
 */
export function effectivePanelForZone(
  wall: Wall,
  zone: CladdingZone,
  panelHint?: StudioPanelConfig,
): StudioPanelConfig {
  const base = normalizeStudioPanel(panelHint ?? wall.panel ?? DEFAULT_STUDIO_PANEL)
  if (zone.kind === 'none') {
    return { ...base, enabled: false, pattern: 'none' }
  }
  if (zone.panel) return normalizeStudioPanel({ ...base, ...zone.panel, enabled: true })
  return base
}

/**
 * Primäres Paneel der Wand unter Berücksichtigung von `claddingZones`.
 * Eine volle Zone ohne rect → deren Panel; sonst Wand-`panel`.
 */
export function effectiveStudioPanelForWall(
  wall: Wall,
  panelHint?: StudioPanelConfig,
): StudioPanelConfig {
  const zones = claddingZonesForWall(wall)
  const primary = zones.find((z) => z.kind !== 'none') ?? zones[0]
  if (!primary) return normalizeStudioPanel(panelHint ?? wall.panel ?? DEFAULT_STUDIO_PANEL)
  return effectivePanelForZone(wall, primary, panelHint)
}

/**
 * Leitet eine Standard-Zone aus dem heutigen `wall.panel` ab.
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

  // Kein `panel`-Snapshot: Layout nutzt Aufruf-`panel` / `wall.panel`.
  // Explizite Overrides nur in persistierten `claddingZones`.
  return [{ id: 'full', kind, front }]
}

export function claddingZonesForWall(wall: Wall): CladdingZone[] {
  const stored = wall.claddingZones
  if (stored && stored.length > 0) return stored
  return deriveCladdingZonesFromPanel(wall)
}

/** Kacheln einer Zone auf deren `rect` schneiden (falls gesetzt). */
export function clipTilesToZoneRect<T extends { x: number; y: number; width: number; height: number }>(
  tiles: T[],
  zone: CladdingZone,
): T[] {
  const r = zone.rect
  if (!r) return tiles
  const out: T[] = []
  const x1 = r.x + r.width
  const y1 = r.y + r.height
  for (const tile of tiles) {
    const tx1 = tile.x + tile.width
    const ty1 = tile.y + tile.height
    const nx0 = Math.max(tile.x, r.x)
    const ny0 = Math.max(tile.y, r.y)
    const nx1 = Math.min(tx1, x1)
    const ny1 = Math.min(ty1, y1)
    if (nx1 - nx0 <= 0.05 || ny1 - ny0 <= 0.05) continue
    out.push({ ...tile, x: nx0, y: ny0, width: nx1 - nx0, height: ny1 - ny0 })
  }
  return out
}

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
