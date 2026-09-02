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
import {
  clampStudioPanelSize,
  DEFAULT_STUDIO_PANEL,
  normalizeStudioPanel,
  panelKindForPattern,
  STUDIO_MASONRY,
} from './constants'
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

const ZONE_Y_EPS = 0.05

/** Persistierte Zonen mit Rechteck (Multi-Band / freie Felder). */
export function wallHasCladdingZoneRects(wall: Wall): boolean {
  const zones = wall.claddingZones
  if (!zones || zones.length === 0) return false
  return zones.some((z) => z.rect != null && z.kind !== 'none')
}

/**
 * Zone, die Höhe `y` (Wand-Lokal, cm von unten) trifft.
 * Bei Überlappung: größte Schnittfläche in Y; sonst nächste Zone-Mitte.
 * Ohne Rects → erste nicht-`none`-Zone bzw. `null`.
 */
export function claddingZoneAtY(wall: Wall, y: number): CladdingZone | null {
  const zones = claddingZonesForWall(wall).filter((z) => z.kind !== 'none')
  if (zones.length === 0) return claddingZonesForWall(wall)[0] ?? null

  const withRect = zones.filter((z) => z.rect != null)
  if (withRect.length === 0) return zones[0] ?? null

  const yClamped = Number.isFinite(y) ? y : 0
  let bestHit: CladdingZone | null = null
  let bestOverlap = -1
  for (const z of withRect) {
    const r = z.rect!
    const y0 = r.y
    const y1 = r.y + r.height
    const overlap = Math.min(y1, yClamped + ZONE_Y_EPS) - Math.max(y0, yClamped - ZONE_Y_EPS)
    if (overlap > bestOverlap && yClamped >= y0 - ZONE_Y_EPS && yClamped <= y1 + ZONE_Y_EPS) {
      bestOverlap = overlap
      bestHit = z
    }
  }
  if (bestHit) return bestHit

  let nearest = withRect[0]!
  let nearestD = Infinity
  for (const z of withRect) {
    const r = z.rect!
    const mid = r.y + r.height / 2
    const d = Math.abs(mid - yClamped)
    if (d < nearestD) {
      nearestD = d
      nearest = z
    }
  }
  return nearest
}

/** Effektives Paneel an Höhe `y` (Öffnungsmitte / Laibungsband). */
export function effectivePanelAtY(
  wall: Wall,
  y: number,
  panelHint?: StudioPanelConfig,
): StudioPanelConfig {
  if (!wallHasCladdingZoneRects(wall)) {
    return normalizeStudioPanel(panelHint ?? wall.panel ?? DEFAULT_STUDIO_PANEL)
  }
  const zone = claddingZoneAtY(wall, y)
  if (!zone) return normalizeStudioPanel(panelHint ?? wall.panel ?? DEFAULT_STUDIO_PANEL)
  return effectivePanelForZone(wall, zone, panelHint)
}

/** Tiefe Kopie der Zonen (Stil-Zwischenablage / Vorlagen). */
export function cloneCladdingZones(
  zones: CladdingZone[] | undefined,
): CladdingZone[] | undefined {
  if (!zones) return undefined
  return zones.map((zone) => ({
    ...zone,
    rect: zone.rect ? { ...zone.rect } : undefined,
    panel: zone.panel ? { ...zone.panel } : undefined,
  }))
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
  if (!stored || stored.length === 0) return deriveCladdingZonesFromPanel(wall)
  // Zwei Horizontal-Bänder: Rects an aktuelle Wandbreite/-höhe anpassen (nach Resize).
  if (isTwoHorizontalBandCladding(wall)) {
    return buildTwoHorizontalCladdingZones(wall, readTwoHorizontalBandOptions(wall))
  }
  return stored
}

/** Persistierte Zwei-Bänder-UI (`band-lower` / `band-upper`). */
export function isTwoHorizontalBandCladding(wall: Wall): boolean {
  const zones = wall.claddingZones
  if (!zones || zones.length !== 2) return false
  const ids = new Set(zones.map((z) => z.id))
  return ids.has('band-lower') && ids.has('band-upper')
}

/** Teilungshöhe (cm von unten), 8-cm-Raster, mind. eine Schicht Rand. */
export function clampCladdingSplitY(splitYCm: number, wallHeight: number): number {
  const min = STUDIO_MASONRY
  const max = Math.max(min, Math.round((wallHeight - STUDIO_MASONRY) / STUDIO_MASONRY) * STUDIO_MASONRY)
  if (!Number.isFinite(splitYCm)) {
    return clampCladdingSplitY(wallHeight / 2, wallHeight)
  }
  const snapped = Math.round(splitYCm / STUDIO_MASONRY) * STUDIO_MASONRY
  return Math.min(max, Math.max(min, snapped))
}

export interface TwoHorizontalBandOptions {
  splitYCm: number
  lowerPanelWidth: number
  upperPanelWidth: number
}

/** Liest Split + Modulbreiten aus persistierten Bändern (Fallback: Wand-Panel). */
export function readTwoHorizontalBandOptions(wall: Wall): TwoHorizontalBandOptions {
  const base = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  const zones = wall.claddingZones ?? []
  const lower = zones.find((z) => z.id === 'band-lower')
  const upper = zones.find((z) => z.id === 'band-upper')
  const splitYCm = clampCladdingSplitY(
    lower?.rect?.height ?? wall.height * 0.5,
    wall.height,
  )
  const lowerPanelWidth = clampStudioPanelSize(
    lower?.panel?.panelWidth ?? base.panelWidth,
  )
  const upperPanelWidth = clampStudioPanelSize(
    upper?.panel?.panelWidth ?? defaultUpperBandWidth(lowerPanelWidth),
  )
  return { splitYCm, lowerPanelWidth, upperPanelWidth }
}

/** Default oberes Modul: Hälfte der unteren Breite (mind. 8 cm). */
export function defaultUpperBandWidth(lowerPanelWidth: number): number {
  return clampStudioPanelSize(Math.max(STUDIO_MASONRY, lowerPanelWidth / 2))
}

/**
 * Zwei horizontale Verkleidungszonen (unten/oben) mit eigenem Modulmaß.
 * Basis-Optik kommt aus `wall.panel`; nur `panelWidth` weicht je Band ab.
 */
export function buildTwoHorizontalCladdingZones(
  wall: Wall,
  options: TwoHorizontalBandOptions,
): CladdingZone[] {
  const base = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  const splitY = clampCladdingSplitY(options.splitYCm, wall.height)
  const lowerW = clampStudioPanelSize(options.lowerPanelWidth)
  const upperW = clampStudioPanelSize(options.upperPanelWidth)
  const kind: CladdingZoneKind =
    base.pattern === 'strip'
      ? 'strip'
      : (base.taperDepth ?? 0) > 0.05
        ? 'boss'
        : panelKindForPattern(base.pattern) === 'masonry' || base.pattern === 'runningBond'
          ? 'bond'
          : 'bond'
  const front: CladdingFrontKind = (base.taperDepth ?? 0) > 0.05 ? 'frustum' : 'flat'
  const upperH = Math.max(STUDIO_MASONRY, wall.height - splitY)
  return [
    {
      id: 'band-lower',
      kind,
      front,
      rect: { x: 0, y: 0, width: wall.width, height: splitY },
      panel: { ...base, panelWidth: lowerW, enabled: true },
    },
    {
      id: 'band-upper',
      kind,
      front,
      rect: { x: 0, y: splitY, width: wall.width, height: upperH },
      panel: { ...base, panelWidth: upperW, enabled: true },
    },
  ]
}

/** Wand mit Zwei-Bänder-Zonen; `wall.panel.panelWidth` = unteres Modul. */
export function applyTwoHorizontalCladdingZones(
  wall: Wall,
  options: TwoHorizontalBandOptions,
): Wall {
  const zones = buildTwoHorizontalCladdingZones(wall, options)
  const lowerW = clampStudioPanelSize(options.lowerPanelWidth)
  const panel = normalizeStudioPanel({
    ...(wall.panel ?? DEFAULT_STUDIO_PANEL),
    panelWidth: lowerW,
    enabled: true,
  })
  return { ...wall, panel, claddingZones: zones }
}

/** Zwei-Bänder entfernen → klassisches Ein-Panel. */
export function clearPersistedCladdingZones(wall: Wall): Wall {
  if (!wall.claddingZones) return wall
  return { ...wall, claddingZones: undefined }
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
