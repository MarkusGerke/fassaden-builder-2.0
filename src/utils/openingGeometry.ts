import type {
  Opening,
  OpeningArch,
  OpeningFill,
  OpeningPanelClearance,
  OpeningRevealFrame,
} from '../types/facade'
import {
  type ArchFormId,
  isArchFormId,
  normalizeArchFormId,
  resolveArchRiseForOpening,
  sampleArchCrown,
  snapArchRiseCm,
} from './archForms'
import { DEFAULT_WINDOW_DEPTH_OFFSET } from '../constants/presets'
import { STUDIO_MASONRY } from '../studio/constants'
export const DEFAULT_REVEAL_EMBED_CM = 8
export const DEFAULT_REVEAL_INSET_CM = 4
export const DEFAULT_NICHE_DEPTH_CM = 10
export const DEFAULT_ARCH_KEYSTONE_COUNT = 7
export const DEFAULT_PANEL_CLEARANCE_CM = 8
/** Fallback-Vorstand der Freiraum-Front (cm), wenn nicht gesetzt und kein Paneel-Vorstand. */
export const DEFAULT_PANEL_CLEARANCE_DEPTH_CM = 4
/** Tiefe: negativ = Vertiefung in die Wand, positiv = Vorstand vor der Wand. */
export const PANEL_CLEARANCE_DEPTH_MIN = -40
export const PANEL_CLEARANCE_DEPTH_MAX = 40
/** Segmente für den vollen Halbkreis (Clip, SVG, Stein-Kontur). */
export const ARCH_CURVE_SEGMENTS = 128
/** 3D-Extrude/Shape — 64 gegen Facetten an Spitz-/Stichbögen. */
export const ARCH_MESH_SEGMENTS = 64
/** Bogen-Segmente je Keilstein — nicht `ARCH_CURVE_SEGMENTS / count` (das waren 14–26). */
export function voussoirMeshSegments(count: number): number {
  return Math.max(6, Math.min(8, Math.ceil(48 / Math.max(1, count))))
}

/** Rechteck in Wandkoordinaten (cm). */
export interface OpeningRect {
  x: number
  y: number
  width: number
  height: number
}

/** Stein-/Wandrest: optionale Bogenkanten statt Geraden. */
export interface OpeningPoly extends OpeningRect {
  /** Untere Kante = Oberkante des Lochs (Rest oberhalb der Maske). */
  bottomArc?: { x: number; y: number }[]
  /** Obere Kante = Unterkante des Lochs (Rest unterhalb der Maske). */
  topArc?: { x: number; y: number }[]
  /**
   * Allgemeiner Umriss (Wand-XY, gegen den Uhrzeigersinn).
   * Für Bogenring-Keilsteine und Fächerzellen; hat Vorrang vor Rechteck/`bottomArc`.
   */
  outline?: { x: number; y: number }[]
  /**
   * Polar-Keil (Voussoir/Fächer): gemeinsamer Mittelpunkt, radiale Fugen.
   * Bossen folgen diesem Keil, kein Diamant im Umriss.
   */
  polar?: {
    cx: number
    cy: number
    rInner: number
    rOuter: number
    t0: number
    t1: number
  }
  /**
   * Zwickel über dem Extrados: lotrechte Außenkante + Bogen innen.
   * Front als Strip (kein Fächer — der Zwickel ist konkav).
   */
  spandrelStrip?: {
    xOuter: number
    inner: { x: number; y: number }[]
  }
  depth?: number
  taperDepth?: number
  taper?: number
  recessed?: boolean
  /** Ursprungsfeld vor dem Öffnungs-Clip — Bossen-Diamant bleibt am Raster. */
  sourceX?: number
  sourceY?: number
  sourceWidth?: number
  sourceHeight?: number
  /** Dock 1+1: Chamfer an Start/Ende erzwingen. */
  keepBossChamferStart?: boolean
  keepBossChamferEnd?: boolean
  /** Dock 0,5+0,5: Chamfer der Dock-Innenseite auf 0. */
  flattenDockStart?: boolean
  flattenDockEnd?: boolean
}

export interface ArchGeom {
  cx: number
  cy: number
  r: number
  x0: number
  x1: number
  y0: number
  y1: number
  springY: number
}

/** Kreis oder Stadion (abgerundetes Rechteck) für Nischen / Regenrohr-Aussparungen. */
export interface StadiumGeom {
  cx: number
  cy: number
  r: number
  x0: number
  x1: number
  y0: number
  y1: number
  vertical: boolean
}

export function normalizeRevealFrame(
  raw?: Partial<OpeningRevealFrame> | null,
): OpeningRevealFrame {
  return {
    enabled: Boolean(raw?.enabled),
    embedCm: Math.max(0, raw?.embedCm ?? DEFAULT_REVEAL_EMBED_CM),
    insetCm: Math.max(0, raw?.insetCm ?? DEFAULT_REVEAL_INSET_CM),
  }
}

export function normalizeOpeningFill(raw?: Partial<OpeningFill> | null): OpeningFill {
  const mode = raw?.mode === 'flush' || raw?.mode === 'niche' ? raw.mode : 'opening'
  return {
    mode,
    nicheDepthCm: Math.max(1, raw?.nicheDepthCm ?? DEFAULT_NICHE_DEPTH_CM),
  }
}

function clampOddKeystoneCount(n: number): number {
  let v = Math.round(n)
  if (!Number.isFinite(v)) v = DEFAULT_ARCH_KEYSTONE_COUNT
  v = Math.max(5, Math.min(21, v))
  if (v % 2 === 0) v += 1
  return Math.max(5, Math.min(21, v))
}

export const MIN_ARCH_JAMB_COUNT = 1
export const MAX_ARCH_JAMB_COUNT = 21

export function clampJambCount(n: number): number {
  let v = Math.round(n)
  if (!Number.isFinite(v)) v = 1
  return Math.max(MIN_ARCH_JAMB_COUNT, Math.min(MAX_ARCH_JAMB_COUNT, v))
}

/** Lichte Höhe der Schenkel (Kämpfer minus halbe Fuge bis Sohlbank). */
export function archJambClearHeight(cy: number, sillY: number, joint: number): number {
  return Math.max(0, cy - Math.max(0, joint) * 0.5 - sillY)
}

/** Auto-Anzahl je Laibung: lichte Höhe / Steinhöhe. */
export function archJambCountAuto(clearHeight: number, panelHeight: number): number {
  const raw = Math.round(Math.max(1, clearHeight) / Math.max(8, panelHeight))
  return clampJambCount(Math.max(1, raw))
}

export function normalizeOpeningArch(raw?: Partial<OpeningArch> | null): OpeningArch {
  // Fehlendes `voussoirs` bleibt false — Alt-Saves ohne Feld behalten Raster-Clip ohne Ring.
  // UI-Default „Rund → Keilstein an“ setzt das Feld explizit (commitOpeningArchPatch).
  const voussoirs = Boolean(raw?.voussoirs ?? raw?.keystones)
  let form: ArchFormId
  if (raw?.form != null) {
    form = normalizeArchFormId(raw.form, raw?.enabled ? 'round' : 'rect')
  } else if (raw?.enabled) {
    // Migration: Alt-Saves mit enabled ohne form → Rundbogen
    form = 'round'
  } else {
    form = 'rect'
  }
  const out: OpeningArch = {
    enabled: form !== 'rect',
    form,
    keystones: Boolean(raw?.keystones),
    voussoirs,
  }
  if (raw?.riseCm != null && Number.isFinite(raw.riseCm) && raw.riseCm > 0) {
    out.riseCm = snapArchRiseCm(raw.riseCm)
  }
  if (raw?.keystoneCount != null && Number.isFinite(raw.keystoneCount)) {
    out.keystoneCount = clampOddKeystoneCount(raw.keystoneCount)
  }
  if (raw?.ringThicknessCm != null && Number.isFinite(raw.ringThicknessCm)) {
    out.ringThicknessCm = Math.max(4, Math.min(128, raw.ringThicknessCm))
  }
  if (raw?.thetaStartDeg != null && Number.isFinite(raw.thetaStartDeg)) {
    out.thetaStartDeg = Math.max(0, Math.min(180, raw.thetaStartDeg))
  }
  if (raw?.thetaEndDeg != null && Number.isFinite(raw.thetaEndDeg)) {
    out.thetaEndDeg = Math.max(0, Math.min(180, raw.thetaEndDeg))
  }
  if (raw?.spandrel === 'rect' || raw?.spandrel === 'bond') {
    out.spandrel = raw.spandrel
  }
  if (raw?.jambs === true) out.jambs = true
  if (raw?.jambCount != null && Number.isFinite(raw.jambCount)) {
    out.jambCount = clampJambCount(raw.jambCount)
  }
  return out
}

export function openingArchForm(opening: Pick<Opening, 'arch'> & { type?: Opening['type'] }): ArchFormId {
  if (opening.type === 'conch') return 'round'
  return normalizeOpeningArch(opening.arch).form ?? 'rect'
}

/** Ob der Öffnung ein Keilstein-Ring gebaut werden soll. */
export function openingArchVoussoirsEnabled(opening: Opening): boolean {
  const arch = normalizeOpeningArch(opening.arch)
  return arch.form === 'round' && Boolean(arch.voussoirs ?? arch.keystones)
}

/**
 * Rundbogen-Geometrie für Blendrahmen/Flügel/Glas in Öffnungskoordinaten (Ursprung unten links).
 * `riseCm` optional — sonst Form-Standard via `resolveArchRiseForOpening`.
 */
export function glazingArchGeom(
  width: number,
  height: number,
  riseCm?: number | null,
): ArchGeom | null {
  const rise = resolveArchRiseForOpening('round', width, height, riseCm)
  const r = Math.min(width / 2, rise)
  if (r < 1) return null
  return {
    cx: width / 2,
    cy: height - r,
    r,
    x0: 0,
    x1: width,
    y0: 0,
    y1: height,
    springY: height - r,
  }
}

/** Konzentrischer kleinerer Bogen (gleiche Mitte), z. B. Blendrahmen-Innenseite. */
export function insetArchGeom(geom: ArchGeom, inset: number): ArchGeom | null {
  const r = geom.r - inset
  if (r < 1) return null
  return {
    cx: geom.cx,
    cy: geom.cy,
    r,
    x0: geom.cx - r,
    x1: geom.cx + r,
    y0: geom.y0 + inset,
    y1: geom.cy + r,
    springY: geom.cy,
  }
}

export function offsetArchGeom(geom: ArchGeom, dx: number, dy: number): ArchGeom {
  return {
    cx: geom.cx + dx,
    cy: geom.cy + dy,
    r: geom.r,
    x0: geom.x0 + dx,
    x1: geom.x1 + dx,
    y0: geom.y0 + dy,
    y1: geom.y1 + dy,
    springY: geom.springY + dy,
  }
}

export function clampToArchX(geom: ArchGeom, x: number): number {
  return Math.max(geom.cx - geom.r, Math.min(geom.cx + geom.r, x))
}

export function archYAt(geom: ArchGeom, x: number): number {
  const d = clampToArchX(geom, x) - geom.cx
  return geom.cy + Math.sqrt(Math.max(0, geom.r * geom.r - d * d))
}

export function archThetaAt(geom: ArchGeom, x: number): number {
  return Math.acos(Math.max(-1, Math.min(1, (clampToArchX(geom, x) - geom.cx) / geom.r)))
}

/**
 * Ob Blendrahmen/Flügel/Glas gebogen sind.
 * Immer identisch zur Wandöffnungsform (`Opening.arch`) — kein separater Override mehr.
 */
export function openingGlazingArchEnabled(opening: Pick<Opening, 'arch' | 'glazingArch'>): boolean {
  return openingGlazingArchForm(opening) !== 'rect'
}

/** Bogenform für Blendrahmen/Glas — immer `Opening.arch.form` (Fenster/Tür = Öffnung). */
export function openingGlazingArchForm(
  opening: Pick<Opening, 'arch' | 'glazingArch'>,
): ArchFormId {
  return normalizeOpeningArch(opening.arch).form ?? 'rect'
}

/** Kronen-Polyline in Öffnungskoordinaten (Ursprung unten links). */
export function glazingArchCrown(
  width: number,
  height: number,
  form: ArchFormId,
  segments = ARCH_MESH_SEGMENTS,
  riseCm?: number | null,
): { x: number; y: number }[] {
  if (form === 'rect' || width < 1 || height < 1) {
    return [
      { x: 0, y: height },
      { x: width, y: height },
    ]
  }
  const rise = resolveArchRiseForOpening(form, width, height, riseCm)
  const springY = height - rise
  return sampleArchCrown(form, width, rise, segments).map((p) => ({
    x: p.x,
    y: springY + p.y,
  }))
}

/** Kronen-Polyline mit Stichmaß aus `Opening.arch` (inkl. optionalem `riseCm`). */
export function openingGlazingArchCrown(
  opening: Pick<Opening, 'width' | 'height' | 'arch'>,
  segments = ARCH_MESH_SEGMENTS,
): { x: number; y: number }[] {
  const form = openingArchForm(opening)
  const arch = normalizeOpeningArch(opening.arch)
  if (form === 'rect' || opening.width < 1 || opening.height < 1) {
    return [
      { x: 0, y: opening.height },
      { x: opening.width, y: opening.height },
    ]
  }
  const rise = resolveArchRiseForOpening(form, opening.width, opening.height, arch.riseCm)
  const springY = opening.height - rise
  return sampleArchCrown(form, opening.width, rise, segments).map((p) => ({
    x: p.x,
    y: springY + p.y,
  }))
}

export function openingFillMode(opening: Opening): OpeningFill['mode'] {
  return normalizeOpeningFill(opening.fill).mode
}

/** True wenn „In Wand eingebettet“ aktiv ist (Fake-Öffnung ohne Loch). */
export function openingIsEmbeddedFake(opening: Opening): boolean {
  return normalizeRevealFrame(opening.revealFrame).enabled
}

export function openingIsCutout(opening: Pick<Opening, 'type'>): boolean {
  return opening.type === 'cutout'
}

/** Konche: Kalotten-Nische mit Viertelkugel-Rückwand. */
export function openingIsConch(opening: Pick<Opening, 'type'>): boolean {
  return opening.type === 'conch'
}

/** Kein Fenster-/Tür-Chrome (Rahmen, Glas) — reine Nischen/Durchbrüche. Konche hat Bänke/Profile/Verdachung. */
export function openingLacksWindowChrome(opening: Pick<Opening, 'type'>): boolean {
  return opening.type === 'cutout'
}

/** Fensterbank, Verdachung u. ä. wie bei Fenstern (inkl. Konche). */
export function openingActsAsWindow(opening: Pick<Opening, 'type'>): boolean {
  return opening.type === 'window' || opening.type === 'conch'
}

/** Fensterbank, Profile, Verdachung — Fenster, Tür, Konche. */
export function openingSupportsOpeningDecor(opening: Pick<Opening, 'type' | 'basementWindow'>): boolean {
  if (opening.type === 'cutout') return false
  if (opening.type === 'window' && opening.basementWindow?.enabled) return false
  return opening.type === 'window' || opening.type === 'door' || opening.type === 'conch'
}

export function openingHasWindowChrome(opening: Pick<Opening, 'type'>): boolean {
  return opening.type === 'window' || opening.type === 'door'
}

export function openingHasRoundMask(opening: Pick<Opening, 'type' | 'cutoutShape'>): boolean {
  return opening.type === 'cutout' && opening.cutoutShape === 'round'
}

/** True wenn Glas/Flügel-Mesh gezeichnet wird. */
export function openingShowsGlazing(opening: Opening): boolean {
  return resolveOpeningLayerContract(opening).showsGlazing
}

/** True wenn Wandkörper/Paneele ein Loch bekommen (Schicht A — dichte Schale). */
export function openingCutsWall(opening: Opening): boolean {
  return resolveOpeningLayerContract(opening).cutsShell
}

export function openingRevealEmbed(opening: Opening): number {
  const frame = normalizeRevealFrame(opening.revealFrame)
  return frame.enabled ? (frame.embedCm ?? DEFAULT_REVEAL_EMBED_CM) : 0
}

export function openingRevealInset(opening: Opening): number {
  const frame = normalizeRevealFrame(opening.revealFrame)
  return frame.enabled ? (frame.insetCm ?? DEFAULT_REVEAL_INSET_CM) : 0
}

export function normalizePanelClearance(
  raw?: Partial<OpeningPanelClearance> | null,
): OpeningPanelClearance {
  const out: OpeningPanelClearance = {
    enabled: Boolean(raw?.enabled),
    cm: Math.max(0, Math.round(raw?.cm ?? DEFAULT_PANEL_CLEARANCE_CM)),
    finish: raw?.finish === 'taper' ? 'taper' : 'empty',
  }
  if (raw?.depthCm != null && Number.isFinite(raw.depthCm)) {
    out.depthCm = Math.max(
      PANEL_CLEARANCE_DEPTH_MIN,
      Math.min(PANEL_CLEARANCE_DEPTH_MAX, raw.depthCm),
    )
  }
  return out
}

/** Rolle der Öffnung gegenüber Shell (A) / Verkleidung (B) / Anbauteile (C). */
export interface OpeningLayerContract {
  fillMode: OpeningFill['mode']
  embeddedFake: boolean
  cutsShell: boolean
  showsGlazing: boolean
  showsWindowChrome: boolean
  attachmentsAllowed: boolean
  /** Immer 0 — Freiraum gehört nicht zum Mauerloch. */
  shellMaskInflateCm: number
  claddingMaskInflateCm: number
  claddingClearanceFinish: 'none' | 'empty' | 'taper'
  claddingClearanceDepthCm: number
}

/** Kanonische Öffnungsrolle — Single Source of Truth (docs/facade-layers.md). */
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
        : DEFAULT_PANEL_CLEARANCE_DEPTH_CM
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

/**
 * Extra-Ausschnitt nur für Paneele/Ziegel/Mörtel — das Mauerloch bleibt unverändert.
 * Schicht B; = `resolveOpeningLayerContract(...).claddingMaskInflateCm`.
 */
export function openingPanelClearance(opening: Opening): number {
  return resolveOpeningLayerContract(opening).claddingMaskInflateCm
}

/**
 * Freiraum-Bandfüllung. Nur sinnvoll wenn Freiraum aktiv (`openingPanelClearance` > 0).
 * Default `empty`.
 */
export function openingPanelClearanceFinish(opening: Opening): 'empty' | 'taper' {
  const finish = resolveOpeningLayerContract(opening).claddingClearanceFinish
  return finish === 'taper' ? 'taper' : 'empty'
}

/**
 * Vorstand der Freiraum-Front (cm) vor der Wandaußenkante.
 * Negativ = Vertiefung in die Wand. Ungesetzt → `fallback`.
 */
export function openingPanelClearanceDepthCm(
  opening: Opening,
  fallback = DEFAULT_PANEL_CLEARANCE_DEPTH_CM,
): number {
  const c = resolveOpeningLayerContract(opening)
  if (c.claddingMaskInflateCm <= 0) return 0
  const gap = normalizePanelClearance(opening.panelClearance)
  if (gap.depthCm != null && Number.isFinite(gap.depthCm)) return gap.depthCm
  return fallback
}

/** Legacy `arch.panelFan` → Freiraum mit `finish: 'taper'`. */
export function migrateOpeningPanelFan(opening: Opening): Opening {
  const archRaw = opening.arch as (OpeningArch & { panelFan?: boolean }) | undefined
  if (!archRaw || !('panelFan' in archRaw)) return opening
  const { panelFan, ...archRest } = archRaw
  const next: Opening = {
    ...opening,
    arch: Object.keys(archRest).length > 0 ? { ...archRest } : undefined,
  }
  if (panelFan) {
    next.panelClearance = {
      enabled: true,
      cm: opening.panelClearance?.cm ?? DEFAULT_PANEL_CLEARANCE_CM,
      finish: 'taper',
    }
  } else if (opening.panelClearance) {
    next.panelClearance = { ...opening.panelClearance }
  }
  return next
}

/**
 * Effektiver Tiefen-Offset für Fensterfront (+ außen, − innen).
 * Inset des Blendrahmens wirkt nach innen (gegen Profil-Vorstand).
 */
export function effectiveOpeningDepthOffset(
  opening: Opening,
  buildingOffset?: number,
): number {
  const base =
    opening.depthOffset !== undefined
      ? opening.depthOffset
      : (buildingOffset ?? DEFAULT_WINDOW_DEPTH_OFFSET)
  return base - openingRevealInset(opening)
}

/** Lichtes Öffnungsrechteck inkl. optionalem Embed (Mauerloch). */
export function openingMasonryRect(opening: Opening, extraInflate = 0): OpeningRect {
  const embed = openingRevealEmbed(opening) + extraInflate
  return {
    x: opening.x - embed,
    y: opening.y - embed,
    width: opening.width + embed * 2,
    height: opening.height + embed * 2,
  }
}

export function openingArchGeom(opening: Opening, inflate = 0): ArchGeom | null {
  if (!openingCutsWall(opening)) return null
  if (openingIsCutout(opening)) return null
  // ArchGeom (Kreis) nur für Rundbogen / Voussoir-Pipeline
  if (openingArchForm(opening) !== 'round') return null
  const base = openingMasonryRect(opening, inflate)
  const arch = normalizeOpeningArch(opening.arch)
  const rise = resolveArchRiseForOpening('round', base.width, base.height, arch.riseCm)
  const r = Math.min(base.width / 2, rise)
  if (r < 1) return null
  const springY = base.y + base.height - r
  return {
    cx: base.x + base.width / 2,
    cy: springY,
    r,
    x0: base.x,
    x1: base.x + base.width,
    y0: base.y,
    y1: base.y + base.height,
    springY,
  }
}

/**
 * Kronen-Polyline der Öffnung in Wand-XY (Kämpfer → Scheitel → Kämpfer).
 * null bei eckiger Öffnung.
 */
export function openingArchOutline(
  opening: Opening,
  inflate = 0,
  segments = ARCH_CURVE_SEGMENTS,
): { x: number; y: number }[] | null {
  // Auch bei Fake-Einbettung (kein Wandloch): Profile/Verdachung brauchen die Bogenkrone.
  if (opening.hidden) return null
  if (openingIsCutout(opening)) return null
  const form = openingArchForm(opening)
  if (form === 'rect') return null
  const base = openingMasonryRect(opening, inflate)
  const arch = normalizeOpeningArch(opening.arch)
  const rise = resolveArchRiseForOpening(form, base.width, base.height, arch.riseCm)
  if (rise < 1e-6) return null
  const springY = base.y + base.height - rise
  return sampleArchCrown(form, base.width, rise, segments).map((p) => ({
    x: base.x + p.x,
    y: springY + p.y,
  }))
}

export function openingArchSpringY(opening: Opening, inflate = 0): number | null {
  const outline = openingArchOutline(opening, inflate, 8)
  if (!outline || outline.length < 2) return null
  return outline[0]!.y
}

/** Rechteckkörper unter der Kämpferlinie (ohne Bogenkappe). */
export function openingBodyRect(opening: Opening, inflate = 0): OpeningRect {
  const base = openingMasonryRect(opening, inflate)
  const springY = openingArchSpringY(opening, inflate)
  if (springY == null) return base
  return {
    x: base.x,
    y: base.y,
    width: base.width,
    height: Math.max(0, springY - base.y),
  }
}

/** Oberer Halbkreis, gleichmäßig im Winkel (nicht im X-Raster — sonst lange Sehnen an den Kämpfern). */
export function archPolyline(
  geom: ArchGeom,
  segments = ARCH_CURVE_SEGMENTS,
  x0 = geom.x0,
  x1 = geom.x1,
): { x: number; y: number }[] {
  const left = Math.max(geom.x0, Math.min(x0, x1))
  const right = Math.min(geom.x1, Math.max(x0, x1))
  const thetaAt = (x: number) =>
    Math.acos(Math.max(-1, Math.min(1, (x - geom.cx) / geom.r)))
  const tLeft = thetaAt(left)
  const tRight = thetaAt(right)
  const span = Math.max(0, tLeft - tRight)
  const n = Math.max(4, Math.ceil((Math.max(16, segments) * span) / Math.PI))
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = tLeft - (span * i) / n
    pts.push({
      x: geom.cx + Math.cos(t) * geom.r,
      y: geom.cy + Math.sin(t) * geom.r,
    })
  }
  return pts
}

export function openingHasCurvedMask(opening: Opening, _inflate = 0): boolean {
  return openingArchForm(opening) !== 'rect' || openingHasRoundMask(opening)
}

export function openingStadiumGeom(opening: Opening, inflate = 0): StadiumGeom | null {
  if (!openingCutsWall(opening)) return null
  if (!openingHasRoundMask(opening)) return null
  const base = openingMasonryRect(opening, inflate)
  const r = Math.min(base.width, base.height) / 2
  if (r < 1) return null
  return {
    cx: base.x + base.width / 2,
    cy: base.y + base.height / 2,
    r,
    x0: base.x,
    x1: base.x + base.width,
    y0: base.y,
    y1: base.y + base.height,
    vertical: base.height + 1e-6 >= base.width,
  }
}

export function stadiumYTop(geom: StadiumGeom, x: number): number {
  const dx = x - geom.cx
  if (geom.vertical) {
    const capCy = geom.y1 - geom.r
    if (Math.abs(dx) > geom.r + 1e-9) return capCy
    return capCy + Math.sqrt(Math.max(0, geom.r * geom.r - dx * dx))
  }
  const leftCx = geom.x0 + geom.r
  const rightCx = geom.x1 - geom.r
  if (x >= leftCx - 1e-9 && x <= rightCx + 1e-9) return geom.y1
  const ccx = x < geom.cx ? leftCx : rightCx
  const ddx = x - ccx
  return geom.cy + Math.sqrt(Math.max(0, geom.r * geom.r - ddx * ddx))
}

export function stadiumYBottom(geom: StadiumGeom, x: number): number {
  const dx = x - geom.cx
  if (geom.vertical) {
    const capCy = geom.y0 + geom.r
    if (Math.abs(dx) > geom.r + 1e-9) return capCy
    return capCy - Math.sqrt(Math.max(0, geom.r * geom.r - dx * dx))
  }
  const leftCx = geom.x0 + geom.r
  const rightCx = geom.x1 - geom.r
  if (x >= leftCx - 1e-9 && x <= rightCx + 1e-9) return geom.y0
  const ccx = x < geom.cx ? leftCx : rightCx
  const ddx = x - ccx
  return geom.cy - Math.sqrt(Math.max(0, geom.r * geom.r - ddx * ddx))
}

/** Geschlossene Stadion-/Kreis-Kontur, gegen den Uhrzeigersinn, Start oben links der Kappe. */
export function stadiumPolyline(
  geom: StadiumGeom,
  segments = ARCH_CURVE_SEGMENTS,
): { x: number; y: number }[] {
  const n = Math.max(8, Math.ceil(segments / 2))
  const pts: { x: number; y: number }[] = []
  if (geom.vertical) {
    const topCy = geom.y1 - geom.r
    const botCy = geom.y0 + geom.r
    for (let i = 0; i <= n; i += 1) {
      const t = Math.PI * (1 - i / n)
      pts.push({ x: geom.cx + Math.cos(t) * geom.r, y: topCy + Math.sin(t) * geom.r })
    }
    for (let i = 0; i <= n; i += 1) {
      const t = -Math.PI * (i / n)
      pts.push({ x: geom.cx + Math.cos(t) * geom.r, y: botCy + Math.sin(t) * geom.r })
    }
    return pts
  }
  const leftCx = geom.x0 + geom.r
  const rightCx = geom.x1 - geom.r
  for (let i = 0; i <= n; i += 1) {
    const t = Math.PI / 2 - Math.PI * (i / n)
    pts.push({ x: rightCx + Math.cos(t) * geom.r, y: geom.cy + Math.sin(t) * geom.r })
  }
  for (let i = 0; i <= n; i += 1) {
    const t = -Math.PI / 2 - Math.PI * (i / n)
    pts.push({ x: leftCx + Math.cos(t) * geom.r, y: geom.cy + Math.sin(t) * geom.r })
  }
  return pts
}

/** Horizontale Sehne der Maske auf Höhe `y`, oder null wenn die Maske dort nicht trifft. */
export function maskXSpanAtY(
  opening: Opening,
  y: number,
  inflate = 0,
): { x0: number; x1: number } | null {
  const stadium = openingStadiumGeom(opening, inflate)
  if (stadium) {
    if (y < stadium.y0 - 1e-9 || y > stadium.y1 + 1e-9) return null
    if (stadium.vertical) {
      if (y >= stadium.y0 + stadium.r - 1e-9 && y <= stadium.y1 - stadium.r + 1e-9) {
        return { x0: stadium.x0, x1: stadium.x1 }
      }
      const capCy = y > stadium.cy ? stadium.y1 - stadium.r : stadium.y0 + stadium.r
      const dy = y - capCy
      if (Math.abs(dy) > stadium.r + 1e-9) return null
      const halfW = Math.sqrt(Math.max(0, stadium.r * stadium.r - dy * dy))
      return { x0: stadium.cx - halfW, x1: stadium.cx + halfW }
    }
    const capLx = stadium.x0 + stadium.r
    const capRx = stadium.x1 - stadium.r
    const dy = y - stadium.cy
    if (Math.abs(dy) > stadium.r + 1e-9) return null
    const half = Math.sqrt(Math.max(0, stadium.r * stadium.r - dy * dy))
    return { x0: capLx - half, x1: capRx + half }
  }
  const outline = openingArchOutline(opening, inflate)
  if (outline && outline.length >= 2) {
    const masonry = openingMasonryRect(opening, inflate)
    const springY = outline[0]!.y
    const apexY = outline.reduce((m, p) => Math.max(m, p.y), outline[0]!.y)
    if (y < masonry.y - 1e-9 || y > apexY + 1e-9) return null
    if (y <= springY + 1e-9) return { x0: masonry.x, x1: masonry.x + masonry.width }
    const xs: number[] = []
    for (let i = 0; i < outline.length - 1; i += 1) {
      const a = outline[i]!
      const b = outline[i + 1]!
      const lo = Math.min(a.y, b.y)
      const hi = Math.max(a.y, b.y)
      if (y < lo - 1e-9 || y > hi + 1e-9) continue
      if (Math.abs(b.y - a.y) < 1e-9) {
        xs.push(a.x, b.x)
        continue
      }
      const u = (y - a.y) / (b.y - a.y)
      if (u < -1e-9 || u > 1 + 1e-9) continue
      xs.push(a.x + (b.x - a.x) * u)
    }
    if (xs.length < 2) return null
    return { x0: Math.min(...xs), x1: Math.max(...xs) }
  }
  if (!openingCutsWall(opening)) return null
  const rect = openingMasonryRect(opening, inflate)
  if (y < rect.y - 1e-9 || y > rect.y + rect.height + 1e-9) return null
  return { x0: rect.x, x1: rect.x + rect.width }
}

export function openingWallFaceMaskPolyline(
  opening: Opening,
  inflate = 0,
): { x: number; y: number }[] {
  const pts = openingMaskPolyline(opening, inflate)
  if (opening.y > 0.5) return pts
  const sill = 8
  return pts.map((p) => (p.y <= opening.y + 0.5 ? { x: p.x, y: p.y - sill } : p))
}

/** Öffnungsmaske in Wand-XY — dieselbe Kontur wie das Wandloch
 * (Rechteck, Rundbogen oder Stadion/Kreis).
 */
export function openingMaskPolyline(
  opening: Opening,
  inflate = 0,
  segments = ARCH_CURVE_SEGMENTS,
): { x: number; y: number }[] {
  const stadium = openingStadiumGeom(opening, inflate)
  if (stadium) return stadiumPolyline(stadium)
  const masonry = openingMasonryRect(opening, inflate)
  const x0 = masonry.x
  const x1 = masonry.x + masonry.width
  const y0 = masonry.y
  const outline = openingArchOutline(opening, inflate, segments)
  if (!outline || outline.length < 2) {
    const y1 = masonry.y + masonry.height
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ]
  }
  const arch = [...outline].reverse()
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...arch]
}

function polylineContainsXY(
  pts: { x: number; y: number }[],
  x: number,
  y: number,
): boolean {
  if (pts.length < 3) return false
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const yi = pts[i]!.y
    const yj = pts[j]!.y
    const xi = pts[i]!.x
    const xj = pts[j]!.x
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside
    }
  }
  return inside
}

const DRAWING_HOLE_HIT_PAD_CM = -0.4
const DRAWING_HOLE_CLIP_PAD_CM = 0.08

/** Glas-/Cladding-Loch für die Zeichnung. `pad` negativ = etwas kleiner (Endpunkte auf der Kante zählen nicht als Treffer). */
export function openingDrawingHolePolyline(
  opening: Opening,
  pad = DRAWING_HOLE_HIT_PAD_CM,
): { x: number; y: number }[] {
  return openingMaskPolyline(opening, openingPanelClearance(opening) + pad)
}

export function openingDrawingHoleContainsPoint(opening: Opening, x: number, y: number): boolean {
  if (opening.hidden || !openingCutsWall(opening)) return false
  return polylineContainsXY(openingDrawingHolePolyline(opening), x, y)
}

function segmentLineHitT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const rx = bx - ax
  const ry = by - ay
  const sx = dx - cx
  const sy = dy - cy
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-12) return null
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom
  if (t > 1e-6 && t < 1 - 1e-6 && u > -1e-6 && u < 1 + 1e-6) return t
  return null
}

function clipSegmentOutsidePolyline(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pts: { x: number; y: number }[],
): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  if (pts.length < 3) return [{ x0, y0, x1, y1 }]
  const ts = [0, 1]
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const t = segmentLineHitT(x0, y0, x1, y1, pts[j]!.x, pts[j]!.y, pts[i]!.x, pts[i]!.y)
    if (t != null) ts.push(t)
  }
  ts.sort((a, b) => a - b)
  const uniq: number[] = []
  for (const t of ts) {
    if (uniq.length === 0 || t - uniq[uniq.length - 1]! > 1e-5) uniq.push(t)
  }
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  for (let i = 0; i < uniq.length - 1; i += 1) {
    const tA = uniq[i]!
    const tB = uniq[i + 1]!
    if (tB - tA < 1e-5) continue
    const tm = (tA + tB) / 2
    const mx = x0 + (x1 - x0) * tm
    const my = y0 + (y1 - y0) * tm
    if (polylineContainsXY(pts, mx, my)) continue
    out.push({
      x0: x0 + (x1 - x0) * tA,
      y0: y0 + (y1 - y0) * tA,
      x1: x0 + (x1 - x0) * tB,
      y1: y0 + (y1 - y0) * tB,
    })
  }
  return out
}

/**
 * Zeichnungs-Kante in Wand-XY: trifft die Öffnung nur im **Maskenloch** (Bogen, nicht Bounding-Box).
 * Schultersteine am Rund-/Tudorbogen bleiben stehen; Glas und Freiraum nicht.
 */
export function claddingEdgeHitsOpening(
  opening: Opening,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  _inset = 0,
): boolean {
  if (opening.hidden || !openingCutsWall(opening)) return false
  const hole = openingDrawingHolePolyline(opening)
  const ox0 = Math.min(...hole.map((p) => p.x))
  const ox1 = Math.max(...hole.map((p) => p.x))
  const oy0 = Math.min(...hole.map((p) => p.y))
  const oy1 = Math.max(...hole.map((p) => p.y))
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  if (maxX < ox0 || minX > ox1 || maxY < oy0 || minY > oy1) return false
  const len = Math.hypot(x1 - x0, y1 - y0)
  const samples = Math.max(5, Math.min(80, Math.ceil(len / 6) + 1))
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    if (polylineContainsXY(hole, x, y)) return true
  }
  return false
}

/**
 * Lange Schräge im Sockelstreifen: CSG-Triangulation zwischen Kellerfenstern
 * (oft **zwischen** den Öffnungen, daher nicht von `claddingEdgeHitsOpening` erfasst).
 */
export function isSpuriousPlinthDrawingDiagonal(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plinthHeight: number,
): boolean {
  if (plinthHeight < 0.5) return false
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  if (dx < 36 || dy < 2.5) return false
  if (Math.hypot(dx, dy) < 48) return false
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  if (minY < -2 || maxY > plinthHeight + 6) return false
  return true
}

/**
 * CSG-Diagonale in der Rechteck-Schulter eines Bogens: liegt in der Bounding-Box,
 * aber nicht im Maskenloch. Nicht für eckige Öffnungen (außer Rund-Cutout).
 */
export function isSpuriousOpeningShoulderDiagonal(
  opening: Opening,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (opening.hidden || !openingCutsWall(opening)) return false
  if (!openingHasCurvedMask(opening)) return false
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  if (dx < 8 || dy < 2.5) return false
  const ox0 = opening.x
  const ox1 = opening.x + opening.width
  const oy0 = opening.y
  const oy1 = opening.y + opening.height
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  if (maxX < ox0 || minX > ox1 || maxY < oy0 || minY > oy1) return false
  const hole = openingDrawingHolePolyline(opening)
  const len = Math.hypot(dx, dy)
  const samples = Math.max(6, Math.min(40, Math.ceil(len / 8)))
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    if (x <= ox0 || x >= ox1 || y <= oy0 || y >= oy1) continue
    if (!polylineContainsXY(hole, x, y)) return true
  }
  return false
}

/** Kanten in die Wandtiefe (Stirn, Bossen-Fase) — in der Aufriss-Zeichnung Reißverschluss. */
export const DRAWING_DEPTH_EDGE_CM = 0.4

/**
 * Lokal-X auf die Plan-Kante ziehen, wenn der Punkt vor/hinter dem Wandende liegt
 * (Gehrung `z × tan` und Profil-Kappen). Innenfugen bleiben unangetastet.
 */
export function snapDrawingLocalX(localX: number, wallWidth: number): number {
  const halfW = wallWidth / 2
  const wallX = localX + halfW
  if (wallX <= 0.05) return -halfW
  if (wallX >= wallWidth - 0.05) return halfW
  return localX
}

export type StudioDrawingWall = {
  width: number
  height: number
  depth?: number
  panelFlip?: boolean
  openings: Opening[]
  panel?: {
    plinthEnabled?: boolean
    plinthHeight?: number
    taperDepth?: number
    projectDepth?: number
  } | null
}

/** Lokales Z der Bossen-Front (eingezogene Fläche). null ohne Bossen-Vorstand. */
export function studioDrawingBossFrontLocalZ(wall: StudioDrawingWall): number | null {
  const taper = wall.panel?.taperDepth ?? 0
  if (taper <= 0.35) return null
  const project = wall.panel?.projectDepth ?? 4
  const flip = wall.panelFlip !== false
  const depth = wall.depth ?? 32
  const bodyFrontZ = flip ? -project : depth + project
  return flip ? bodyFrontZ - taper : bodyFrontZ + taper
}

/** Kanten auf der Bossen-Front — in der Zeichnung das innere Quadrat im Stein. */
export const DRAWING_BOSS_FRONT_Z_EPS = 0.45

/**
 * EdgesGeometry-Strecke(n) für den Linienmodus: keine Tiefenkanten, Glas rausgeschnitten
 * (Maske, nicht Bounding-Box), Endpunkte an der Plan-Kante bündig.
 * Eine Wand-Fuge, die ein Fenster kreuzt, wird in Pier-Stücke geteilt — nicht ganz verworfen.
 */
export function filterStudioDrawingSegments(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  wall: StudioDrawingWall,
): number[][] {
  const sax = snapDrawingLocalX(ax, wall.width)
  if (Math.abs(az - bz) > DRAWING_DEPTH_EDGE_CM) return []
  const taper = wall.panel?.taperDepth ?? 0
  if (taper > 0.35) {
    const project = wall.panel?.projectDepth ?? 4
    const flip = wall.panelFlip !== false
    const depth = wall.depth ?? 32
    const bodyFrontZ = flip ? -project : depth + project
    const bossZ = flip ? bodyFrontZ - taper : bodyFrontZ + taper
    const midz = (az + bz) / 2
    const zEps = Math.max(DRAWING_BOSS_FRONT_Z_EPS, taper * 0.55)
    if (Math.abs(midz - bossZ) <= zEps) return []
    // Bossen-Platte vor der Steinfront: inneres Quadrat ums Fenster sitzt oft
    // nicht exakt auf bossZ (andere projectDepth, Overlay). Alles zwischen
    // Körperfront und Bossen-Front entfällt — Mörtel liegt davor/dahinter.
    const toward = flip ? -1 : 1
    const zFromBody = (midz - bodyFrontZ) * toward
    if (zFromBody > 0.35 && zFromBody < taper + 0.85) return []
  }
  const sbx = snapDrawingLocalX(bx, wall.width)
  if (Math.hypot(sax - sbx, ay - by, az - bz) < 0.08) return []
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const wx0 = sax + halfW
  const wy0 = ay + halfH
  const wx1 = sbx + halfW
  const wy1 = by + halfH
  const plinthOn = wall.panel?.plinthEnabled !== false
  const plinthH = plinthOn && typeof wall.panel?.plinthHeight === 'number' ? wall.panel.plinthHeight : 0
  if (isSpuriousPlinthDrawingDiagonal(wx0, wy0, wx1, wy1, plinthH)) return []
  if (
    wall.openings.some((opening) => isSpuriousOpeningShoulderDiagonal(opening, wx0, wy0, wx1, wy1))
  ) {
    return []
  }
  let pieces: Array<{ x0: number; y0: number; x1: number; y1: number }> = [
    { x0: wx0, y0: wy0, x1: wx1, y1: wy1 },
  ]
  for (const opening of wall.openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const hole = openingDrawingHolePolyline(opening, DRAWING_HOLE_CLIP_PAD_CM)
    const next: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
    for (const piece of pieces) {
      next.push(...clipSegmentOutsidePolyline(piece.x0, piece.y0, piece.x1, piece.y1, hole))
    }
    pieces = next
    if (pieces.length === 0) return []
  }
  const z = (az + bz) / 2
  return pieces
    .filter((p) => Math.hypot(p.x1 - p.x0, p.y1 - p.y0) >= 0.08)
    .map((p) => [p.x0 - halfW, p.y0 - halfH, z, p.x1 - halfW, p.y1 - halfH, z])
}

/** Erstes Teilstück oder `null` (Kompatibilität). */
export function filterStudioDrawingSegment(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  wall: StudioDrawingWall,
): number[] | null {
  return filterStudioDrawingSegments(ax, ay, az, bx, by, bz, wall)[0] ?? null
}

/** True wenn der Wandpunkt im Öffnungsloch liegt (Maskenkontur, inkl. Rundbogen). */
export function openingContainsPoint(opening: Opening, x: number, y: number): boolean {
  if (opening.hidden || !openingCutsWall(opening)) return false
  const pts = openingMaskPolyline(opening)
  if (pts.length < 3) {
    return (
      x >= opening.x &&
      x <= opening.x + opening.width &&
      y >= opening.y &&
      y <= opening.y + opening.height
    )
  }
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const yi = pts[i]!.y
    const yj = pts[j]!.y
    const xi = pts[i]!.x
    const xj = pts[j]!.x
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Schnitt der Masken-Polyline mit der Horizontalen `y` (Wand-cm). */
export function polylineXRangesAtY(
  pts: { x: number; y: number }[],
  y: number,
): Array<{ x0: number; x1: number }> {
  if (pts.length < 3) return []
  const yq = y + 1e-4
  const xs: number[] = []
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const yi = pts[i]!.y
    const yj = pts[j]!.y
    if ((yi > yq) === (yj > yq)) continue
    const t = (yq - yi) / (yj - yi)
    if (!Number.isFinite(t)) continue
    xs.push(pts[i]!.x + t * (pts[j]!.x - pts[i]!.x))
  }
  xs.sort((a, b) => a - b)
  const ranges: Array<{ x0: number; x1: number }> = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const x0 = xs[i]!
    const x1 = xs[i + 1]!
    if (x1 - x0 > 0.25) ranges.push({ x0, x1 })
  }
  return ranges
}

/** Y-Löcher einer geschlossenen Polyline auf Wand-X (vertikaler Schnitt). */
export function polylineYRangesAtX(
  pts: { x: number; y: number }[],
  x: number,
): Array<{ y0: number; y1: number }> {
  if (pts.length < 3) return []
  const xq = x + 1e-4
  const ys: number[] = []
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i]!.x
    const xj = pts[j]!.x
    if ((xi > xq) === (xj > xq)) continue
    const t = (xq - xi) / (xj - xi)
    if (!Number.isFinite(t)) continue
    ys.push(pts[i]!.y + t * (pts[j]!.y - pts[i]!.y))
  }
  ys.sort((a, b) => a - b)
  const ranges: Array<{ y0: number; y1: number }> = []
  for (let i = 0; i + 1 < ys.length; i += 2) {
    const y0 = ys[i]!
    const y1 = ys[i + 1]!
    if (y1 - y0 > 0.25) ranges.push({ y0, y1 })
  }
  return ranges
}

/**
 * X-Löcher der Öffnungsmaske auf Höhe `y` — dieselbe Kontur wie Paneele/Mauerwerk
 * (Rechteck, Rundbogen, Stadion), optional aufgeblasen (`inflate`).
 */
export function openingMaskXRangesAtY(
  opening: Opening,
  y: number,
  inflate = 0,
): Array<{ x0: number; x1: number }> {
  if (opening.hidden || !openingCutsWall(opening)) return []
  return polylineXRangesAtY(openingMaskPolyline(opening, inflate), y)
}

/** Y-Löcher der Öffnungsmaske auf Wand-X — dieselbe Kontur wie Paneele/Mauerwerk. */
export function openingMaskYRangesAtX(
  opening: Opening,
  x: number,
  inflate = 0,
): Array<{ y0: number; y1: number }> {
  if (opening.hidden || !openingCutsWall(opening)) return []
  return polylineYRangesAtX(openingMaskPolyline(opening, inflate), x)
}

/** SVG-Pfad der Maske (SVG-Y von oben, Wand-Y von unten). */
export function openingMaskSvgPath(
  opening: Opening,
  wallHeight: number,
  extraTop = 0,
  inflate = 0,
): string {
  const pts = openingMaskPolyline(opening, inflate)
  if (pts.length < 3) return ''
  const toSvgY = (y: number) => wallHeight - y + extraTop
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${toSvgY(p.y)}`).join(' ')} Z`
}

function polylineSvgPath(
  pts: { x: number; y: number }[],
  wallHeight: number,
  extraTop: number,
): string {
  if (pts.length < 3) return ''
  const toSvgY = (y: number) => wallHeight - y + extraTop
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${toSvgY(p.y)}`).join(' ')} Z`
}

function clearanceSideBandSvgPath(
  outer: { x: number; y: number }[],
  inner: { x: number; y: number }[],
  wallHeight: number,
  extraTop: number,
  skipSill: boolean,
): string {
  if (outer.length < 3 || inner.length !== outer.length) return ''
  const toSvgY = (y: number) => wallHeight - y + extraTop
  const parts: string[] = []
  const n = outer.length
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const ao = outer[i]!
    const bo = outer[j]!
    const ai = inner[i]!
    const bi = inner[j]!
    if (skipSill && ao.y <= 0.5 && bo.y <= 0.5) continue
    parts.push(
      `M ${ao.x} ${toSvgY(ao.y)} L ${bo.x} ${toSvgY(bo.y)} L ${bi.x} ${toSvgY(bi.y)} L ${ai.x} ${toSvgY(ai.y)} Z`,
    )
  }
  return parts.join(' ')
}

/**
 * Freiraum-Ring als Evenodd-Pfad. An der Sohlbank (Tür am Boden) kein Band nach unten —
 * verhindert die sichtbare Linie an der Wandunterkante.
 */
export function openingClearanceBandSvgPath(
  opening: Opening,
  wallHeight: number,
  extraTop = 0,
  clearance: number,
): string {
  if (clearance <= 0.05) return ''
  const floorClamp = opening.y <= 0.5
  const outer = openingMaskPolyline(opening, clearance)
  const inner = openingMaskPolyline(opening, 0)
  if (floorClamp) {
    return clearanceSideBandSvgPath(outer, inner, wallHeight, extraTop, true)
  }
  const outerPath = polylineSvgPath(outer, wallHeight, extraTop)
  const innerPath = polylineSvgPath(inner, wallHeight, extraTop)
  if (!outerPath || !innerPath) return ''
  return `${outerPath} ${innerPath}`
}

/**
 * Clip-Löcher für rechteckiges CSG: bei Rundbogen nur der Körper unter der Kämpferlinie.
 * Runde Nischen haben kein Rechteckloch — nur Band-Clip.
 */
export function openingClipRects(opening: Opening, inflate = 0): OpeningRect[] {
  if (!openingCutsWall(opening)) return []
  if (openingHasRoundMask(opening)) return []
  if (openingArchForm(opening) === 'rect') return [openingMasonryRect(opening, inflate)]
  const body = openingBodyRect(opening, inflate)
  return body.height > 0.5 ? [body] : []
}

/**
 * Tür mit Treppe: die Schwelle liegt über dem Boden, das **Wandloch** geht trotzdem
 * von y=0 bis zur originalen Oberkante (Bogen bleibt, weil Rise von oben zählt).
 * Sonst bleibt Mauerwerk/Mörtel als Fläche in der unteren Türhälfte.
 */
export function openingCutsFromGround(opening: Opening): boolean {
  if (opening.hidden || !openingCutsWall(opening)) return false
  if (opening.y <= 0.05) return true
  return opening.type === 'door' && Boolean(opening.stairs?.enabled)
}

export function openingForShellCut(opening: Opening): Opening {
  if (opening.type !== 'door' || !opening.stairs?.enabled || opening.y <= 0.05) return opening
  return { ...opening, y: 0, height: opening.y + opening.height }
}

function copyPolyProps(
  rect: OpeningPoly,
): Pick<
  OpeningPoly,
  | 'depth'
  | 'taperDepth'
  | 'taper'
  | 'recessed'
  | 'sourceX'
  | 'sourceY'
  | 'sourceWidth'
  | 'sourceHeight'
  | 'keepBossChamferStart'
  | 'keepBossChamferEnd'
  | 'flattenDockStart'
  | 'flattenDockEnd'
> {
  return {
    depth: rect.depth,
    taperDepth: rect.taperDepth,
    taper: rect.taper,
    recessed: rect.recessed,
    sourceX: rect.sourceX,
    sourceY: rect.sourceY,
    sourceWidth: rect.sourceWidth,
    sourceHeight: rect.sourceHeight,
    keepBossChamferStart: rect.keepBossChamferStart,
    keepBossChamferEnd: rect.keepBossChamferEnd,
    flattenDockStart: rect.flattenDockStart,
    flattenDockEnd: rect.flattenDockEnd,
  }
}

function interpolatePolyArc(
  arc: { x: number; y: number }[] | undefined,
  x: number,
  fallback: number,
  eps: number,
): number {
  if (!arc || arc.length < 2) return fallback
  // Nicht das Clip-ε (oft 0,05): Laibungsnaht ist ~JAMB_SEAM (0,001). Sonst landet
  // x knapp außerhalb der Kerbe noch auf dem Loch-Y und Flat-Samples zwischen
  // Öffnungen fehlen → Diagonalen in Streifen-Paneelen.
  const seam = Math.min(eps, JAMB_SEAM * 2)
  if (x <= arc[0].x + seam) return arc[0].y
  if (x >= arc[arc.length - 1].x - seam) return arc[arc.length - 1].y
  for (let i = 0; i < arc.length - 1; i += 1) {
    const a = arc[i]
    const b = arc[i + 1]
    if (x >= a.x - seam && x <= b.x + seam) {
      const dx = b.x - a.x
      if (Math.abs(dx) < seam) {
        return Math.abs(x - a.x) <= Math.abs(x - b.x) ? a.y : b.y
      }
      const t = (x - a.x) / dx
      return a.y + t * (b.y - a.y)
    }
  }
  return fallback
}

/** Untere Kante eines Restes: vorhandene `bottomArc` oder Rechteckboden. */
function polyBottomAt(rect: OpeningPoly, x: number, eps: number): number {
  return interpolatePolyArc(rect.bottomArc, x, rect.y, eps)
}

/** Obere Kante eines Restes: vorhandene `topArc` oder Rechteckdecke. */
function polyTopAt(rect: OpeningPoly, x: number, eps: number): number {
  return interpolatePolyArc(rect.topArc, x, rect.y + rect.height, eps)
}

/**
 * Mindestgröße für Clip-Reste am Bogen.
 * Nicht `STUDIO_MASONRY` (8): nach Abzug der Fuge sind Schichthöhen oft ~7,2 cm —
 * mit Schwellwert 8 verschwinden ganze Zwickel/Schichten und es bleibt ein Rechteckloch.
 */
export const MIN_ARCH_CLIP_REMNANT = 1
/**
 * Dünne Kappe über dem Scheitel: Spalten dünner als das werden nicht verbunden.
 * AABB-Höhe einer wandbreiten Streifenreihe ist die volle Schichthöhe — ohne
 * Spaltenfilter bleibt ein Dreiecks-Krümel in der Öffnung.
 */
export const ARCH_REMNANT_CRUMB_CM = 3.2

/**
 * Mindestbreite fürs Verschmelzen schmaler Clip-Reste.
 * Obergrenze `2 × STUDIO_MASONRY` (16 cm): sonst bei 64-cm-Steinen alles &lt; 32 cm
 * weg/merged — Zwickel am Bogen und Streifen-Keile zerfallen.
 */
export function minClipRemnantWidth(panelWidth = 32): number {
  return Math.max(STUDIO_MASONRY, Math.min(panelWidth / 2, STUDIO_MASONRY * 2))
}

function clipPartRowKey(p: OpeningPoly): string {
  return `${Math.round(p.y * 1000)}:${Math.round(p.height * 1000)}`
}

function isMergeableNarrowClip(p: OpeningPoly, minWidth: number, eps: number): boolean {
  if (p.width >= minWidth - eps) return false
  if (p.outline && p.outline.length >= 3) return false
  if ((p.bottomArc?.length ?? 0) >= 2 || (p.topArc?.length ?? 0) >= 2) return false
  // Ungeschnittener Rasterstein (z. B. halber Endstein am Wandende) ist kein Clip-Rest:
  // bleibt eigener Stein mit Stoßfuge — sonst 1,5-Steine bzw. Lücken je Farbstufe.
  if (p.sourceWidth != null && p.width >= p.sourceWidth - eps) return false
  return true
}

function clipPartsTouch(a: OpeningPoly, b: OpeningPoly, eps: number): boolean {
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width)
  return gap <= eps
}

function mergeClipRects(a: OpeningPoly, b: OpeningPoly): OpeningPoly {
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x + a.width, b.x + b.width)
  const y1 = Math.max(a.y + a.height, b.y + b.height)
  return {
    ...copyPolyProps(a),
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    outline: undefined,
    bottomArc: undefined,
    topArc: undefined,
  }
}

/**
 * Schmale Rechteck-Reste nach dem Öffnungs-Clip mit **anliegenden** Nachbarn verschmelzen.
 * Outline-/Bogen-Reste bleiben unverändert (L-Steine, Bogenkappen).
 * Nicht anliegend (Lücke = Öffnung): Rest entfällt — Bounding-Box würde das Fenster füllen.
 */
export function mergeNarrowClipParts(
  parts: OpeningPoly[],
  minWidth: number,
  eps = 0.05,
): OpeningPoly[] {
  const rowMap = new Map<string, OpeningPoly[]>()
  for (const p of parts) {
    const key = clipPartRowKey(p)
    const list = rowMap.get(key) ?? []
    list.push({ ...p })
    rowMap.set(key, list)
  }
  const out: OpeningPoly[] = []
  for (const row of rowMap.values()) {
    let sorted = row.sort((a, b) => a.x - b.x)
    for (let guard = 0; guard < 64; guard += 1) {
      let merged = false
      const next: OpeningPoly[] = []
      for (let i = 0; i < sorted.length; i += 1) {
        const p = sorted[i]!
        if (!isMergeableNarrowClip(p, minWidth, eps)) {
          next.push(p)
          continue
        }
        const prev = next[next.length - 1]
        const succ = sorted[i + 1]
        if (prev && clipPartsTouch(prev, p, Math.max(eps, 1))) {
          next[next.length - 1] = mergeClipRects(prev, p)
          merged = true
        } else if (succ && clipPartsTouch(p, succ, Math.max(eps, 1))) {
          sorted[i + 1] = mergeClipRects(p, succ)
          merged = true
        }
        // Schmal und nicht anliegend: Rest fallen lassen — sonst füllt die AABB das Fenster.
      }
      sorted = next
      if (!merged) break
    }
    out.push(...sorted)
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x)
}

const JAMB_FLUSH_EPS = 0.05
/** Steine, die knapp vor der Laibung enden oder noch ins Rechteckloch ragen, bündig schneiden. */
const MAX_JAMB_FLUSH = 96

/**
 * Rechteck-Reste unter der Kämpferlinie auf eine gemeinsame vertikale Laibung ziehen.
 * Bogenkappen (`bottomArc`/`topArc`/`outline`) bleiben unverändert.
 */
export function flushClipPartsToOpeningJambs(
  parts: OpeningPoly[],
  openings: Opening[],
  inflate = 0,
): OpeningPoly[] {
  const bodies: Array<{ x0: number; x1: number; y0: number; y1: number }> = []
  for (const opening of openings) {
    if (opening.hidden || !openingCutsWall(opening)) continue
    const clearance =
      openingArchVoussoirsEnabled(opening) && openingPanelClearanceFinish(opening) !== 'taper'
        ? inflate
        : openingPanelClearance(opening) + inflate
    const rect = openingMasonryRect(opening, clearance)
    const geom = openingArchGeom(opening, clearance)
    const springY = openingArchSpringY(opening, clearance) ?? geom?.springY ?? rect.y + rect.height
    if (rect.width <= JAMB_FLUSH_EPS || springY - rect.y <= JAMB_FLUSH_EPS) continue
    bodies.push({ x0: rect.x, x1: rect.x + rect.width, y0: rect.y, y1: springY })
  }
  if (bodies.length === 0) return parts

  // Nur der Stein direkt vor der Laibung wird gezogen: liegt ein anderer Teil derselben
  // Zeile (auch Bogenkappe) in der Lücke, bleibt der Stein — sonst überlappen ganze Reihen
  // zu einem Streifen (v2.0.30–2.0.33).
  const rowMap = new Map<string, OpeningPoly[]>()
  for (const p of parts) {
    const key = clipPartRowKey(p)
    const list = rowMap.get(key) ?? []
    list.push(p)
    rowMap.set(key, list)
  }
  const gapIsFree = (part: OpeningPoly, gx0: number, gx1: number): boolean => {
    const row = rowMap.get(clipPartRowKey(part)) ?? []
    for (const q of row) {
      if (q === part) continue
      if (q.x < gx1 - JAMB_FLUSH_EPS && q.x + q.width > gx0 + JAMB_FLUSH_EPS) return false
    }
    return true
  }

  const out: OpeningPoly[] = []
  for (const part of parts) {
    if (part.outline && part.outline.length >= 3) {
      out.push(part)
      continue
    }
    if ((part.bottomArc && part.bottomArc.length >= 2) || (part.topArc && part.topArc.length >= 2)) {
      out.push(part)
      continue
    }
    let x0 = part.x
    let x1 = part.x + part.width
    const y0 = part.y
    const y1 = part.y + part.height
    let drop = false
    for (const hole of bodies) {
      if (y1 <= hole.y0 + JAMB_FLUSH_EPS || y0 >= hole.y1 - JAMB_FLUSH_EPS) continue
      const overlapsX = x0 < hole.x1 - JAMB_FLUSH_EPS && x1 > hole.x0 + JAMB_FLUSH_EPS
      if (!overlapsX) {
        if (
          x1 <= hole.x0 + JAMB_FLUSH_EPS &&
          hole.x0 - x1 > JAMB_FLUSH_EPS &&
          hole.x0 - x1 <= MAX_JAMB_FLUSH &&
          gapIsFree(part, x1, hole.x0)
        ) {
          x1 = hole.x0
        }
        if (
          x0 >= hole.x1 - JAMB_FLUSH_EPS &&
          x0 - hole.x1 > JAMB_FLUSH_EPS &&
          x0 - hole.x1 <= MAX_JAMB_FLUSH &&
          gapIsFree(part, hole.x1, x0)
        ) {
          x0 = hole.x1
        }
        continue
      }
      const coversLeft = x0 < hole.x0 + JAMB_FLUSH_EPS
      const coversRight = x1 > hole.x1 - JAMB_FLUSH_EPS
      if (coversLeft && coversRight) {
        if (hole.x0 - x0 > JAMB_FLUSH_EPS) {
          out.push({ ...part, x: x0, width: hole.x0 - x0 })
        }
        x0 = hole.x1
        continue
      }
      if (coversLeft) x1 = Math.min(x1, hole.x0)
      else if (coversRight) x0 = Math.max(x0, hole.x1)
      else {
        drop = true
        break
      }
    }
    if (drop) continue
    if (x1 - x0 <= JAMB_FLUSH_EPS) continue
    out.push({ ...part, x: x0, width: x1 - x0 })
  }
  return out
}

/**
 * Naht knapp außerhalb der Laibung, damit bottomArc/topArc eine lotrechte Jamb-Kante
 * (kein Diagonal-Schnitt durch den Stein) interpolieren.
 */
const JAMB_SEAM = 1e-3

function uniqueSortedXs(xs: number[], eps: number): number[] {
  const sorted = [...xs].sort((a, b) => a - b)
  const out: number[] = []
  for (const x of sorted) {
    if (out.length === 0 || x - out[out.length - 1] > eps) out.push(x)
  }
  return out
}

/** Y auf einer von links nach rechts laufenden Polylinie (Extrados-Sehnen der Keile). */
function yOnPolylineX(
  pts: { x: number; y: number }[],
  x: number,
  eps: number,
): number | null {
  if (pts.length < 2) return null
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const lo = Math.min(a.x, b.x)
    const hi = Math.max(a.x, b.x)
    if (x < lo - eps || x > hi + eps) continue
    if (Math.abs(b.x - a.x) < 1e-9) return Math.max(a.y, b.y)
    const u = (x - a.x) / (b.x - a.x)
    return a.y + (b.y - a.y) * u
  }
  return null
}

interface ClipBand {
  x: number
  y0: number
  y1: number
  /** Stück über der Bogenkappe (Keil zwischen Bogen und Schichtoberkante). */
  aboveHole?: boolean
}

type ClipRect = { x0: number; y0: number; x1: number; y1: number }

function ptKey(p: { x: number; y: number }): string {
  return `${p.x.toFixed(4)},${p.y.toFixed(4)}`
}

/** Loch von links und rechts umschlossen (C/O) — sonst L/[ mit nur einer Laibung. */
function isEnclosedCShape(byXList: Map<number, ClipBand[]>, eps: number): boolean {
  const xs = [...byXList.keys()].sort((a, b) => a - b)
  const two = xs.filter((x) => (byXList.get(x)?.length ?? 0) >= 2)
  if (two.length === 0) return false
  const t0 = two[0]
  const t1 = two[two.length - 1]
  const spanLeft = xs.some((x) => x < t0 - eps && (byXList.get(x)?.length ?? 0) === 1)
  const spanRight = xs.some((x) => x > t1 + eps && (byXList.get(x)?.length ?? 0) === 1)
  return spanLeft && spanRight
}

function bandsToRects(group: ClipBand[], eps: number): ClipRect[] {
  const byX = new Map<number, ClipBand[]>()
  for (const b of group) {
    const list = byX.get(b.x)
    if (list) list.push(b)
    else byX.set(b.x, [b])
  }
  const xs = [...byX.keys()].sort((a, b) => a - b)
  const rects: ClipRect[] = []
  for (let i = 0; i < xs.length - 1; i += 1) {
    const left = byX.get(xs[i]) ?? []
    const right = byX.get(xs[i + 1]) ?? []
    for (const a of left) {
      for (const b of right) {
        const y0 = Math.max(a.y0, b.y0)
        const y1 = Math.min(a.y1, b.y1)
        if (y1 - y0 > eps) rects.push({ x0: xs[i], y0, x1: xs[i + 1], y1 })
      }
    }
  }
  return rects
}

function outlineFromRects(rects: ClipRect[], eps: number): { x: number; y: number }[] | null {
  if (rects.length === 0) return null
  const xs = uniqueSortedXs(
    rects.flatMap((r) => [r.x0, r.x1]),
    Math.max(eps * 0.25, 1e-4),
  )
  const ys = uniqueSortedXs(
    rects.flatMap((r) => [r.y0, r.y1]),
    Math.max(eps * 0.25, 1e-4),
  )
  if (xs.length < 2 || ys.length < 2) return null
  const nx = xs.length - 1
  const ny = ys.length - 1
  const occ: boolean[][] = Array.from({ length: nx }, () => Array(ny).fill(false))
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      occ[i][j] = rects.some((r) => cx >= r.x0 - eps && cx <= r.x1 + eps && cy >= r.y0 - eps && cy <= r.y1 + eps)
    }
  }
  const edges: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = []
  const push = (x0: number, y0: number, x1: number, y1: number) => {
    edges.push({ a: { x: x0, y: y0 }, b: { x: x1, y: y1 } })
  }
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      if (!occ[i][j]) continue
      if (i === 0 || !occ[i - 1][j]) push(xs[i], ys[j + 1], xs[i], ys[j])
      if (i === nx - 1 || !occ[i + 1][j]) push(xs[i + 1], ys[j], xs[i + 1], ys[j + 1])
      if (j === 0 || !occ[i][j - 1]) push(xs[i], ys[j], xs[i + 1], ys[j])
      if (j === ny - 1 || !occ[i][j + 1]) push(xs[i + 1], ys[j + 1], xs[i], ys[j + 1])
    }
  }
  if (edges.length < 3) return null
  const adj = new Map<string, { x: number; y: number }[]>()
  for (const e of edges) {
    const k = ptKey(e.a)
    const list = adj.get(k)
    if (list) list.push(e.b)
    else adj.set(k, [e.b])
  }
  let start = edges[0].a
  for (const e of edges) {
    if (e.a.x < start.x - 1e-9 || (Math.abs(e.a.x - start.x) < 1e-9 && e.a.y < start.y)) start = e.a
  }
  const ring: { x: number; y: number }[] = [{ x: start.x, y: start.y }]
  const used = new Set<string>()
  let cur = start
  for (let n = 0; n < edges.length + 2; n += 1) {
    const opts = adj.get(ptKey(cur)) ?? []
    let next: { x: number; y: number } | null = null
    for (const cand of opts) {
      const uk = `${ptKey(cur)}>${ptKey(cand)}`
      if (used.has(uk)) continue
      used.add(uk)
      next = cand
      break
    }
    if (!next) break
    if (ptKey(next) === ptKey(start)) break
    ring.push(next)
    cur = next
  }
  const cleaned: { x: number; y: number }[] = []
  for (const p of ring) {
    const last = cleaned[cleaned.length - 1]
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-4) cleaned.push(p)
  }
  if (cleaned.length >= 2 && ptKey(cleaned[0]) === ptKey(cleaned[cleaned.length - 1])) cleaned.pop()
  const colinear: { x: number; y: number }[] = []
  for (let i = 0; i < cleaned.length; i += 1) {
    const a = cleaned[(i + cleaned.length - 1) % cleaned.length]
    const b = cleaned[i]
    const c = cleaned[(i + 1) % cleaned.length]
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) > 1e-6) colinear.push(b)
  }
  return colinear.length >= 3 ? colinear : cleaned.length >= 3 ? cleaned : null
}

function emitOutlinePoly(
  group: ClipBand[],
  props: ReturnType<typeof copyPolyProps>,
  eps: number,
  minRemnant: number,
): OpeningPoly | null {
  const rects = bandsToRects(group, eps)
  const outline = outlineFromRects(rects, eps)
  if (!outline || outline.length < 3) return null
  let x0 = outline[0].x
  let y0 = outline[0].y
  let x1 = outline[0].x
  let y1 = outline[0].y
  for (const p of outline) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  const width = x1 - x0
  const height = y1 - y0
  if (width < minRemnant - eps || height < minRemnant - eps) return null
  return { ...props, x: x0, y: y0, width, height, outline }
}

/**
 * Kachel minus ein in X begrenztes Loch, dessen Unter-/Oberkante y(x) ist.
 *
 * Ein Stein bleibt ein zusammenhängendes Polygon: links/rechts der Laibung
 * nicht an Sohlbank oder Kämpfer horizontal zerlegen (sonst zerfällt der
 * Bossen-Frustum in zwei Kisten). In der Kappe kein Split an boxX0/boxX1
 * (sonst Phantom-Kasten in der Zeichnung). Nur wenn ein Rest das Loch in Y
 * vollständig umschließt (C/O), wird in Sohlbank-/Kämpfer-Bänder getrennt.
 */
function clipPolyMinusColumnHole(
  rect: OpeningPoly,
  holeX0: number,
  holeX1: number,
  holeAt: (x: number) => { y0: number; y1: number } | null,
  splitY0: number,
  splitY1: number,
  sampleXs: number[],
  eps: number,
  minRemnant: number,
): OpeningPoly[] {
  const rx0 = rect.x
  const rx1 = rect.x + rect.width
  const props = copyPolyProps(rect)
  const xs = uniqueSortedXs(
    sampleXs
      .concat([rx0, rx1, holeX0, holeX1, holeX0 - JAMB_SEAM, holeX1 + JAMB_SEAM])
      .filter((x) => x >= rx0 - eps && x <= rx1 + eps)
      .map((x) => Math.max(rx0, Math.min(rx1, x))),
    Math.min(eps * 0.25, JAMB_SEAM * 0.5),
  )
  // Flache Bereiche zwischen Öffnungen mitabasten — sonst fehlen nach mehreren
  // Bogen-Clips die Flat-Samples und topArc/bottomArc überspannt Öffnungen diagonal.
  const densified: number[] = []
  const step = Math.max(8, minRemnant)
  for (let i = 0; i < xs.length - 1; i += 1) {
    densified.push(xs[i]!)
    const gap = xs[i + 1]! - xs[i]!
    if (gap > step * 1.5) {
      const n = Math.min(64, Math.floor(gap / step))
      for (let k = 1; k < n; k += 1) {
        densified.push(xs[i]! + (gap * k) / n)
      }
    }
  }
  if (xs.length > 0) densified.push(xs[xs.length - 1]!)
  const xsFull = uniqueSortedXs(densified, Math.min(eps * 0.25, JAMB_SEAM * 0.5))
  if (xsFull.length < 2) return [rect]

  const yOverlap = (a: ClipBand, b: ClipBand) =>
    Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > eps

  const expand = (band: ClipBand): ClipBand[] => {
    // Nur wenn das Loch eine echte Mittelzone hat (Kämpfer…Sohlbank). Beim Kreis
    // sind splitY0≈splitY1 — sonst würde jeder Stein auf Höhe der Mitte zerlegt.
    if (splitY1 - splitY0 <= Math.max(1, minRemnant)) return [band]
    const spansBelow = band.y0 < splitY0 - eps
    const spansAbove = band.y1 > splitY1 + eps
    if (!(spansBelow && spansAbove)) return [band]
    const parts: ClipBand[] = []
    if (band.y0 < splitY0 - eps) {
      parts.push({ x: band.x, y0: band.y0, y1: Math.min(band.y1, splitY0) })
    }
    const mid0 = Math.max(band.y0, splitY0)
    const mid1 = Math.min(band.y1, splitY1)
    if (mid1 - mid0 > eps) parts.push({ x: band.x, y0: mid0, y1: mid1 })
    if (band.y1 > splitY1 + eps) {
      parts.push({ x: band.x, y0: Math.max(band.y0, splitY1), y1: band.y1 })
    }
    return parts.filter((p) => p.y1 - p.y0 > eps)
  }

  const columns: ClipBand[][] = xsFull.map((x) => {
    const yLo = polyBottomAt(rect, x, eps)
    const yHi = polyTopAt(rect, x, eps)
    if (yHi - yLo <= eps) return []
    const hole = x > holeX0 - 1e-9 && x < holeX1 + 1e-9 ? holeAt(x) : null
    if (!hole) return expand({ x, y0: yLo, y1: yHi })
    // Dünne Spalten bleiben hier erhalten: Ob ein Stück ein Krümel ist, entscheidet
    // die zusammenhängende Gruppe (unten). Über dem Bogen laufen Steine/Streifen als
    // Keil bis zur Schichtoberkante aus — Spaltenweise Verwerfen erzeugte dort flache
    // Stufen („Kasten“ über dem Scheitel).
    const parts: ClipBand[] = []
    if (yLo < hole.y0 - eps) {
      parts.push({ x, y0: yLo, y1: Math.min(yHi, hole.y0) })
    }
    if (yHi > hole.y1 + eps) {
      parts.push({ x, y0: Math.max(yLo, hole.y1), y1: yHi, aboveHole: true })
    }
    return parts.filter((p) => p.y1 - p.y0 > eps)
  })

  const bands: ClipBand[] = columns.flat()
  if (bands.length === 0) return []

  const parent = bands.map((_, i) => i)
  const find = (i: number): number => {
    let n = i
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]]
      n = parent[n]
    }
    return n
  }
  const union = (a: number, b: number) => {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) parent[pa] = pb
  }

  let offset = 0
  for (let c = 0; c < columns.length - 1; c += 1) {
    const left = columns[c]
    const right = columns[c + 1]
    for (let i = 0; i < left.length; i += 1) {
      for (let j = 0; j < right.length; j += 1) {
        if (yOverlap(left[i], right[j])) union(offset + i, offset + left.length + j)
      }
    }
    offset += left.length
  }

  const groups = new Map<number, ClipBand[]>()
  for (let i = 0; i < bands.length; i += 1) {
    const root = find(i)
    const list = groups.get(root)
    if (list) list.push(bands[i])
    else groups.set(root, [bands[i]])
  }

  const emitMonotone = (spanIn: ClipBand[]): OpeningPoly | null => {
    const byX = new Map<number, ClipBand>()
    for (const b of spanIn) {
      const prev = byX.get(b.x)
      if (!prev || b.y1 - b.y0 > prev.y1 - prev.y0) byX.set(b.x, b)
    }
    const span = [...byX.values()].sort((a, b) => a.x - b.x)
    if (span.length < 2) return null
    const x0 = span[0].x
    const x1 = span[span.length - 1].x
    const y0 = Math.min(...span.map((s) => s.y0))
    const y1 = Math.max(...span.map((s) => s.y1))
    const width = x1 - x0
    const height = y1 - y0
    if (width < minRemnant - eps || height < minRemnant - eps) return null
    const bottomVaries = span.some((s) => Math.abs(s.y0 - y0) > eps)
    const topVaries = span.some((s) => Math.abs(s.y1 - y1) > eps)
    // Krümel (Sohlbank-Zwickel) weglassen — sonst Linienhaufen. Keile über der Bogenkappe
    // bleiben auch flach: Sie schließen die Schicht bis zum Bogen (kein „Kasten“ am Scheitel).
    const wedgeAbove = spanIn.some((b) => b.aboveHole)
    if (!wedgeAbove && (bottomVaries || topVaries) && height < ARCH_REMNANT_CRUMB_CM - eps) {
      return null
    }
    const poly: OpeningPoly = { ...props, x: x0, y: y0, width, height }
    if (bottomVaries) poly.bottomArc = span.map((s) => ({ x: s.x, y: s.y0 }))
    if (topVaries) poly.topArc = span.map((s) => ({ x: s.x, y: s.y1 }))
    return poly
  }

  const out: OpeningPoly[] = []
  for (const group of groups.values()) {
    // Krümel unter dem Loch (Sohlbank-Zwickel), die nirgends Steinhöhe erreichen, weg.
    // Keile über der Bogenkappe bleiben — sie folgen dem Bogen bis zur Schichtoberkante.
    const tallest = group.reduce((m, b) => Math.max(m, b.y1 - b.y0), 0)
    if (tallest < ARCH_REMNANT_CRUMB_CM - eps && !group.some((b) => b.aboveHole)) continue
    group.sort((a, b) => a.x - b.x || a.y0 - b.y0)
    const byXList = new Map<number, ClipBand[]>()
    for (const b of group) {
      const list = byXList.get(b.x)
      if (list) list.push(b)
      else byXList.set(b.x, [b])
    }
    const maxN = Math.max(...[...byXList.values()].map((list) => list.length))
    if (maxN < 2) {
      const poly = emitMonotone(group)
      if (poly) out.push(poly)
      continue
    }
    // C/O: Loch von beiden Seiten umschlossen → an Sohlbank/Kämpfer trennen.
    // L in der Bogenkappe nicht als ein Outline (Sehne durch den Bogen) — unten
    // Rechteck zur Laibung, oben bottomArc. Kleine L-Steine ohne Kappe bleiben ein Stück.
    if (!isEnclosedCShape(byXList, eps) && !group.some((b) => b.aboveHole)) {
      const outlinePoly = emitOutlinePoly(group, props, eps, minRemnant)
      if (outlinePoly) {
        out.push(outlinePoly)
        continue
      }
    }
    let splitAt = 0
    let splitN = 0
    for (const list of byXList.values()) {
      if (list.length < 2) continue
      list.sort((a, b) => a.y0 - b.y0)
      splitAt += (list[0].y1 + list[list.length - 1].y0) / 2
      splitN += 1
    }
    splitAt = splitN > 0 ? splitAt / splitN : (splitY0 + splitY1) / 2
    const lower: ClipBand[] = []
    const upper: ClipBand[] = []
    for (const list of byXList.values()) {
      list.sort((a, b) => a.y0 - b.y0)
      if (list.length >= 2) {
        lower.push(list[0])
        upper.push(list[list.length - 1])
        continue
      }
      const b = list[0]
      if (b.y1 <= splitAt + eps) lower.push(b)
      else if (b.y0 >= splitAt - eps) upper.push(b)
      else {
        lower.push({ x: b.x, y0: b.y0, y1: splitAt })
        upper.push({ x: b.x, y0: splitAt, y1: b.y1 })
      }
    }
    const lo = emitMonotone(lower)
    const hi = emitMonotone(upper)
    if (lo) out.push(lo)
    if (hi) out.push(hi)
  }
  return out
}

/**
 * Sehnen aus dem Clip-Raster auf die echte Maskenkurve ziehen und verdichten.
 * `arch`: Rest oberhalb (bottomArc ≥ Kurve). `bowl`: Rest unterhalb (topArc ≤ Kurve).
 */
function refinePolyArcToCurve(
  poly: OpeningPoly,
  curveY: (x: number) => number,
  curveX0: number,
  curveX1: number,
  kind: 'arch' | 'bowl',
): OpeningPoly {
  const snap = (
    arc: { x: number; y: number }[] | undefined,
    flatY: number,
  ): { x: number; y: number }[] | undefined => {
    if (!arc || arc.length < 2) return arc
    const x0 = arc[0]!.x
    const x1 = arc[arc.length - 1]!.x
    const extra: number[] = []
    const span0 = Math.max(x0, curveX0)
    const span1 = Math.min(x1, curveX1)
    if (span1 - span0 > 0.5) {
      const n = Math.max(8, Math.ceil(((span1 - span0) / Math.max(1, curveX1 - curveX0)) * ARCH_CURVE_SEGMENTS))
      for (let i = 0; i <= n; i += 1) extra.push(span0 + ((span1 - span0) * i) / n)
    }
    // Originalpunkte der Polylinie exakt behalten — insbesondere die lotrechte
    // Laibungsnaht (x = Laibung − JAMB_SEAM → x = Laibung). Ein Merge mit 0,2 cm
    // ließ die Stufen-Ecke wegfallen: Sehne vom Steinboden bis zum Kämpfer (Diagonale).
    const arcXs = arc.map((p) => p.x)
    const extraXs = extra.filter((x) => !arcXs.some((ax) => Math.abs(ax - x) <= 0.2))
    const samples: { x: number; y: number | null }[] = [
      ...arc.map((p) => ({ x: p.x, y: p.y as number | null })),
      ...extraXs.map((x) => ({ x, y: null as number | null })),
    ].sort((a, b) => a.x - b.x)
    const out: { x: number; y: number }[] = []
    for (const sample of samples) {
      const x = sample.x
      if (x < x0 - 1e-6 || x > x1 + 1e-6) continue
      let y = sample.y ?? interpolatePolyArc(arc, x, flatY, 0.05)
      if (x >= curveX0 - 0.05 && x <= curveX1 + 0.05) {
        const cy = curveY(x)
        if (kind === 'arch' && y > flatY + 0.4) y = Math.max(y, cy)
        if (kind === 'bowl' && y < flatY - 0.4) y = Math.min(y, cy)
      }
      const prev = out[out.length - 1]
      if (!prev || Math.hypot(prev.x - x, prev.y - y) > 1e-4) out.push({ x, y })
    }
    return out.length >= 2 ? out : arc
  }
  const next: OpeningPoly = { ...poly }
  if (kind === 'arch') {
    const refined = snap(poly.bottomArc, poly.y)
    if (refined) next.bottomArc = refined
  } else {
    const refined = snap(poly.topArc, poly.y + poly.height)
    if (refined) next.topArc = refined
  }
  return next
}

/**
 * Kachel minus Bogenloch.
 *
 * Unter der Kämpferlinie: echte vertikale Laibung. In der Bogenkappe: Kurvenschnitt
 * über die volle Steinbreite — kein Split an boxX0/boxX1 (Phantom-Kasten).
 * Links/rechts der Öffnung bleibt der Stein ein Polygon (Laibung + Zwickel),
 * damit der Bossen-Frustum nicht an der Kämpferlinie zerfällt.
 */
export function clipRectMinusArch(
  rect: OpeningPoly,
  curveGeom: ArchGeom,
  jambGeom: ArchGeom = curveGeom,
  eps = 0.05,
  minRemnant = MIN_ARCH_CLIP_REMNANT,
  curvePoly?: { x: number; y: number }[],
): OpeningPoly[] {
  const rx0 = rect.x
  const rx1 = rect.x + rect.width
  const ry0 = rect.y
  const ry1 = rect.y + rect.height
  const jx0 = Math.min(jambGeom.x0, jambGeom.x1)
  const jx1 = Math.max(jambGeom.x0, jambGeom.x1)
  const cx0 = Math.min(curveGeom.x0, curveGeom.x1)
  const cx1 = Math.max(curveGeom.x0, curveGeom.x1)
  const boxX0 = Math.min(jx0, cx0)
  const boxX1 = Math.max(jx1, cx1)
  const boxY0 = Math.min(jambGeom.y0, curveGeom.y0)
  const boxY1 = Math.max(jambGeom.y1, curveGeom.y1)
  if (rx1 <= boxX0 + eps || rx0 >= boxX1 - eps || ry1 <= boxY0 + eps || ry0 >= boxY1 - eps) {
    return [rect]
  }
  const arcX0 = Math.max(rx0, curveGeom.x0)
  const arcX1 = Math.min(rx1, curveGeom.x1)
  const polyXs =
    curvePoly && curvePoly.length >= 2 && arcX1 - arcX0 > eps
      ? curvePoly.filter((p) => p.x >= arcX0 - eps && p.x <= arcX1 + eps).map((p) => p.x)
      : []
  const sampleXs = [
    rx0,
    rx1,
    boxX0,
    boxX1,
    jx0,
    jx1,
    ...(polyXs.length >= 2
      ? polyXs
      : arcX1 - arcX0 > eps
        ? archPolyline(curveGeom, ARCH_CURVE_SEGMENTS, arcX0, arcX1).map((p) => p.x)
        : []),
    ...(rect.bottomArc ?? []).map((p) => p.x),
    ...(rect.topArc ?? []).map((p) => p.x),
  ]
  const holeY1 = (x: number) => {
    if (curvePoly && curvePoly.length >= 2) {
      const y = yOnPolylineX(curvePoly, x, eps)
      if (y != null) return y
    }
    return archYAt(curveGeom, x)
  }
  const parts = clipPolyMinusColumnHole(
    rect,
    boxX0,
    boxX1,
    (x) => {
      const onJamb = x > jx0 - 1e-9 && x < jx1 + 1e-9
      const capY = Math.max(jambGeom.springY, holeY1(x))
      if (onJamb) {
        return { y0: boxY0, y1: capY }
      }
      // Extrados breiter als die Laibung: nur Kappe/Ring, nicht bis zur Sohlbank.
      if (x < cx0 + eps || x > cx1 - eps) return null
      const y1 = holeY1(x)
      if (y1 <= jambGeom.springY + eps) return null
      return { y0: jambGeom.springY, y1 }
    },
    boxY0,
    jambGeom.springY,
    sampleXs,
    eps,
    minRemnant,
  )
  return parts.map((part) =>
    refinePolyArcToCurve(part, (x) => holeY1(x), curveGeom.x0, curveGeom.x1, 'arch'),
  )
}

export function clipRectMinusStadium(
  rect: OpeningPoly,
  geom: StadiumGeom,
  eps = 0.05,
  minRemnant = MIN_ARCH_CLIP_REMNANT,
): OpeningPoly[] {
  const rx0 = rect.x
  const rx1 = rect.x + rect.width
  const ry0 = rect.y
  const ry1 = rect.y + rect.height
  if (rx1 <= geom.x0 + eps || rx0 >= geom.x1 - eps || ry1 <= geom.y0 + eps || ry0 >= geom.y1 - eps) {
    return [rect]
  }
  const sampleXs = [
    rx0,
    rx1,
    geom.x0,
    geom.x1,
    ...stadiumPolyline(geom).map((p) => p.x),
    ...(rect.bottomArc ?? []).map((p) => p.x),
    ...(rect.topArc ?? []).map((p) => p.x),
  ]
  const splitY0 = geom.vertical ? geom.y0 + geom.r : geom.y0
  const splitY1 = geom.vertical ? geom.y1 - geom.r : geom.y1
  const parts = clipPolyMinusColumnHole(
    rect,
    geom.x0,
    geom.x1,
    (x) => ({
      y0: stadiumYBottom(geom, x),
      y1: stadiumYTop(geom, x),
    }),
    splitY0,
    splitY1,
    sampleXs,
    eps,
    minRemnant,
  )
  return parts.map((part) => {
    let next = refinePolyArcToCurve(
      part,
      (x) => stadiumYTop(geom, x),
      geom.x0,
      geom.x1,
      'arch',
    )
    next = refinePolyArcToCurve(
      next,
      (x) => stadiumYBottom(geom, x),
      geom.x0,
      geom.x1,
      'bowl',
    )
    return next
  })
}

/** Rechteckloch ohne Split an Sohlbank/Kämpfer — L-Steine bleiben ein Polygon. */
export function clipRectMinusBox(
  rect: OpeningPoly,
  hole: OpeningRect,
  eps = 0.05,
  minRemnant = MIN_ARCH_CLIP_REMNANT,
): OpeningPoly[] {
  const rx0 = rect.x
  const rx1 = rect.x + rect.width
  const ry0 = rect.y
  const ry1 = rect.y + rect.height
  const hx0 = hole.x
  const hx1 = hole.x + hole.width
  const hy0 = hole.y
  const hy1 = hole.y + hole.height
  if (rx1 <= hx0 + eps || rx0 >= hx1 - eps || ry1 <= hy0 + eps || ry0 >= hy1 - eps) {
    return [rect]
  }
  return clipPolyMinusColumnHole(
    rect,
    hx0,
    hx1,
    () => ({ y0: hy0, y1: hy1 }),
    hy0,
    hy1,
    [rx0, rx1, hx0, hx1],
    eps,
    minRemnant,
  )
}

/**
 * Schneidet ein Trapez aus (untere/obere Breite, zentriert auf `cx`).
 * Für taperedField: kartesisches Raster nur im echten Trapez entfernen (kein AABB-Loch).
 */
export function clipRectMinusTrapezoid(
  rect: OpeningPoly,
  trap: {
    cx: number
    y0: number
    y1: number
    widthBottom: number
    widthTop: number
  },
  eps = 0.05,
  minRemnant = MIN_ARCH_CLIP_REMNANT,
): OpeningPoly[] {
  const halfB = Math.max(0, trap.widthBottom) / 2
  const halfT = Math.max(0, trap.widthTop) / 2
  const maxHalf = Math.max(halfB, halfT)
  if (maxHalf < eps || trap.y1 - trap.y0 < eps) return [rect]
  const hx0 = trap.cx - maxHalf
  const hx1 = trap.cx + maxHalf
  const hy0 = trap.y0
  const hy1 = trap.y1
  const rx0 = rect.x
  const rx1 = rect.x + rect.width
  const ry0 = rect.y
  const ry1 = rect.y + rect.height
  if (rx1 <= hx0 + eps || rx0 >= hx1 - eps || ry1 <= hy0 + eps || ry0 >= hy1 - eps) {
    return [rect]
  }
  const holeAt = (x: number): { y0: number; y1: number } | null => {
    const dx = Math.abs(x - trap.cx)
    if (dx >= maxHalf - 1e-9) return null
    const minHalf = Math.min(halfB, halfT)
    if (dx <= minHalf + 1e-9) return { y0: hy0, y1: hy1 }
    // half(y) = halfB + (halfT-halfB)*t → t = (dx-halfB)/(halfT-halfB)
    const denom = halfT - halfB
    if (Math.abs(denom) < 1e-9) return { y0: hy0, y1: hy1 }
    const t = (dx - halfB) / denom
    const yEdge = hy0 + t * (hy1 - hy0)
    if (halfT < halfB) {
      // nach oben verjüngend: außen nur unterhalb der Flanke
      return { y0: hy0, y1: Math.max(hy0, Math.min(hy1, yEdge)) }
    }
    // nach unten verjüngend: außen nur oberhalb der Flanke
    return { y0: Math.max(hy0, Math.min(hy1, yEdge)), y1: hy1 }
  }
  const sampleXs = [rx0, rx1, hx0, hx1, trap.cx - halfB, trap.cx + halfB, trap.cx - halfT, trap.cx + halfT]
  return clipPolyMinusColumnHole(rect, hx0, hx1, holeAt, hy0, hy1, sampleXs, eps, minRemnant)
}

export function clipPolysMinusArches(
  parts: OpeningPoly[],
  openings: Opening[],
  inflate = 0,
  panelHeight = 32,
  options?: {
    dockCartesianAtExtrados?: boolean
    panelWidth?: number
    joint?: number
    /** Hybrid-Mauerwerk: Clip am Intrados; Bogenband wird separat mit Hybrid-Polys gefüllt. */
    hybridArchMasonry?: boolean
    /**
     * Radiale Rustika-Lagen (v2.0.78): Clip am Intrados; Spandrille wird separat
     * mit `archRusticatedCoursePolys` gefüllt. Hat Vorrang vor Hybrid.
     */
    archRustication?: boolean
    panelPattern?: string | null
  },
): OpeningPoly[] {
  const dockAtExtrados = options?.dockCartesianAtExtrados !== false
  let next = parts
  for (const opening of openings) {
    const voussoirsOn = openingArchVoussoirsEnabled(opening)
    const rusticationOn = options?.archRustication === true
    const hybridOn =
      !rusticationOn &&
      (options?.hybridArchMasonry === true ||
        Boolean(
          options?.hybridArchMasonry !== false &&
            options?.panelPattern &&
            openingArchHybridMasonryEnabled(opening, options.panelPattern),
        ))
    let ring = 0
    if (voussoirsOn && dockAtExtrados && !hybridOn && !rusticationOn) {
      const arch = normalizeOpeningArch(opening.arch)
      ring =
        arch.ringThicknessCm != null
          ? Math.max(4, arch.ringThicknessCm)
          : archRingThickness(panelHeight)
    }
    // Freiraum „leer“ mit Keilstein-Ring: Raster dockt am Extrados — sonst entsteht
    // ein zweiter leerer Bogenring um die Voussoirs. Nur „zulaufen“ bleibt außen.
    // Hybrid / Rustika: Clip am Intrados (Loch); Zwickel-Band wird in prepareStudioPanelParts entfernt.
    const clearance =
      voussoirsOn && !hybridOn && !rusticationOn && openingPanelClearanceFinish(opening) !== 'taper'
        ? 0
        : openingPanelClearance(opening)
    if (hybridOn || rusticationOn) {
      const jamb = openingArchGeom(opening, inflate + clearance)
      if (!jamb) continue
      next = next.flatMap((part) => clipRectMinusArch(part, jamb, jamb))
      continue
    }
    if (voussoirsOn && dockAtExtrados) {
      const jamb = openingArchGeom(opening, inflate)
      if (!jamb) continue
      const curve = inflateArchGeom(jamb, ring + clearance) ?? jamb
      const spec = buildSemicircularArchSpec(opening, {
        panelWidth: options?.panelWidth ?? 32,
        panelHeight,
        joint: options?.joint,
        inflate,
      })
      const extrados = spec ? voussoirExtradosPolyline(spec) : undefined
      next = next.flatMap((part) =>
        clipRectMinusArch(part, curve, jamb, 0.05, MIN_ARCH_CLIP_REMNANT, extrados),
      )
      continue
    }
    const pad = inflate + clearance
    const stadium = openingStadiumGeom(opening, pad + ring)
    if (stadium) {
      next = next.flatMap((part) => clipRectMinusStadium(part, stadium))
      continue
    }
    const jamb = openingArchGeom(opening, pad)
    if (jamb) {
      next = next.flatMap((part) => clipRectMinusArch(part, jamb, jamb))
      continue
    }
    // Nicht-Rundbogen: Kronen-Polyline + synthetische Kämpfer-Geometrie für die Laibung
    const outline = openingArchOutline(opening, pad)
    if (!outline || outline.length < 2) continue
    const masonry = openingMasonryRect(opening, pad)
    const springY = outline[0]!.y
    const apexY = outline.reduce((m, p) => Math.max(m, p.y), springY)
    const rise = Math.max(0, apexY - springY)
    const faux: ArchGeom = {
      cx: masonry.x + masonry.width / 2,
      cy: springY,
      r: Math.max(rise, 1),
      x0: masonry.x,
      x1: masonry.x + masonry.width,
      y0: masonry.y,
      y1: masonry.y + masonry.height,
      springY,
    }
    next = next.flatMap((part) =>
      clipRectMinusArch(part, faux, faux, 0.05, MIN_ARCH_CLIP_REMNANT, outline),
    )
  }
  return splitMultiNotchArcPolys(next, {
    // Nicht ½ Steinbreite: bei 64-cm-Paneelen würden Keile &lt; 32 cm verworfen.
    minSliceWidth: MIN_ARCH_CLIP_REMNANT,
  })
}

/**
 * Reste mit mehreren Bogen-Kerben in X zerlegen (z. B. wandbreite Streifen unter/über
 * mehreren Fenstern). Ein gemeinsames topArc/bottomArc über 2+ Öffnungen erzeugt sonst
 * Sehnen/Diagonalen und zerstört Bossen-Einzug in der Zeichnung.
 */
export function splitMultiNotchArcPolys(
  parts: OpeningPoly[],
  options?: { eps?: number; minSliceWidth?: number },
): OpeningPoly[] {
  const eps = options?.eps ?? 0.05
  const minSlice = options?.minSliceWidth ?? MIN_ARCH_CLIP_REMNANT
  return parts.flatMap((part) => splitOneMultiNotchArcPoly(part, eps, minSlice))
}

function splitOneMultiNotchArcPoly(poly: OpeningPoly, eps: number, minSliceWidth: number): OpeningPoly[] {
  if (poly.outline && poly.outline.length >= 3) return [poly]
  const top = poly.topArc
  const bottom = poly.bottomArc
  const hasTop = Boolean(top && top.length >= 4)
  const hasBottom = Boolean(bottom && bottom.length >= 4)
  if (hasTop && hasBottom) {
    // Beide Kanten gekerbt (z. B. Mörtelband y=0…Sockel: unten Kellerfenster, oben
    // angehobene Tür). Auch **eine** Kerbe je Kante muss splitten — sonst bleibt ein
    // Band mit zwei Arcs und füllt die Türöffnung.
    return splitPolyAlongNotchedArc(poly, top!, 'top', eps, minSliceWidth, true).flatMap((part) =>
      part.bottomArc && part.bottomArc.length >= 4
        ? splitPolyAlongNotchedArc(part, part.bottomArc, 'bottom', eps, minSliceWidth, true)
        : [part],
    )
  }
  if (hasTop) return splitPolyAlongNotchedArc(poly, top!, 'top', eps, minSliceWidth)
  if (hasBottom) return splitPolyAlongNotchedArc(poly, bottom!, 'bottom', eps, minSliceWidth)
  return [poly]
}

function splitPolyAlongNotchedArc(
  poly: OpeningPoly,
  arc: { x: number; y: number }[],
  kind: 'top' | 'bottom',
  eps: number,
  minSliceWidth: number,
  splitSingleNotch = false,
): OpeningPoly[] {
  const flatY = kind === 'top' ? poly.y + poly.height : poly.y
  const cutEps = Math.max(eps, 0.5)
  type Run = { cut: boolean; i0: number; i1: number }
  const runs: Run[] = []
  for (let i = 0; i < arc.length; i += 1) {
    const cut = Math.abs(arc[i]!.y - flatY) > cutEps
    const last = runs[runs.length - 1]
    if (!last || last.cut !== cut) runs.push({ cut, i0: i, i1: i })
    else last.i1 = i
  }
  const cutCount = runs.filter((r) => r.cut).length
  // Eine Kerbe = ein Rundbogen: Rest bleibt ein Polygon mit bottomArc/topArc.
  // Split in flach|Kerbe|flach erzeugt vertikale Stirnkanten je Reihe (Treppenstufen
  // in der Zeichnung) und dreieckige Lücken am Scheitel.
  if (!splitSingleNotch && cutCount < 2) return [poly]
  if (cutCount < 1) return [poly]

  const splitXs: number[] = [poly.x, poly.x + poly.width]
  for (let r = 0; r < runs.length; r += 1) {
    const run = runs[r]!
    if (!run.cut) continue
    const xEnter = arc[run.i0]!.x
    // Ende der Kerbe = erster Flat-Sample danach (nicht letzter Cut-Punkt bei y=Loch).
    const next = runs[r + 1]
    const xLeave =
      next && !next.cut ? arc[next.i0]!.x : arc[run.i1]!.x
    splitXs.push(xEnter, xLeave)
  }
  for (let r = 0; r < runs.length; r += 1) {
    const run = runs[r]!
    if (run.cut) continue
    const cutBefore = runs.slice(0, r).some((x) => x.cut)
    const cutAfter = runs.slice(r + 1).some((x) => x.cut)
    if (!cutBefore || !cutAfter) continue
    const flatW = Math.abs(arc[run.i1]!.x - arc[run.i0]!.x)
    if (flatW < minSliceWidth - eps) continue
    splitXs.push((arc[run.i0]!.x + arc[run.i1]!.x) / 2)
  }
  const xs = uniqueSortedXs(splitXs, eps)
  if (xs.length < 3) return [poly]

  const props = copyPolyProps(poly)
  const y0 = poly.y
  const y1 = poly.y + poly.height
  const out: OpeningPoly[] = []
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = xs[i]!
    const x1 = xs[i + 1]!
    if (x1 - x0 < minSliceWidth - eps) continue
    const slice: { x: number; y: number }[] = []
    const push = (x: number, y: number) => {
      const prev = slice[slice.length - 1]
      if (!prev || Math.hypot(prev.x - x, prev.y - y) > 1e-4) slice.push({ x, y })
    }
    push(x0, kind === 'top' ? polyTopAt(poly, x0, eps) : polyBottomAt(poly, x0, eps))
    for (const p of arc) {
      if (p.x < x0 - eps || p.x > x1 + eps) continue
      push(p.x, p.y)
    }
    push(x1, kind === 'top' ? polyTopAt(poly, x1, eps) : polyBottomAt(poly, x1, eps))
    let maxDev = 0
    for (const p of slice) maxDev = Math.max(maxDev, Math.abs(p.y - flatY))
    const part: OpeningPoly = { ...props, x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    // Nur echte Kerben behalten — Fast-flach (Rauschen an Split-Kanten) als Rechteck.
    if (maxDev > cutEps && slice.length >= 2) {
      if (kind === 'top') part.topArc = slice
      else part.bottomArc = slice
    }
    out.push(part)
  }
  return out.length > 0 ? out : [poly]
}

/** Ringdicke ≈ eine Schichthöhe (mind. 8 cm). */
export function archRingThickness(panelHeight: number): number {
  return Math.max(8, panelHeight)
}

/** Bogenradius nach außen erweitern (Extrados); Mittelpunkt bleibt. */
export function inflateArchGeom(geom: ArchGeom, delta: number): ArchGeom | null {
  const r = geom.r + delta
  if (r < 1) return null
  return {
    cx: geom.cx,
    cy: geom.cy,
    r,
    x0: geom.cx - r,
    x1: geom.cx + r,
    y0: geom.y0,
    y1: geom.cy + r,
    springY: geom.cy,
  }
}

/** Ungerade Keilsteinzahl aus Bogenlänge / Steinbreite, begrenzt auf 5–21. */
export function archVoussoirCount(geom: ArchGeom, panelWidth: number): number {
  const arcLen = Math.PI * geom.r
  const raw = Math.round(arcLen / Math.max(8, panelWidth))
  return clampOddKeystoneCount(raw || 5)
}

/**
 * Parameter für einen klassischen Halbkreisbogen mit Keilsteinen
 * (gemeinsamer Mittelpunkt, Intrados/Extrados, strikt radiale Fugen).
 */
export interface SemicircularArchSpec {
  cx: number
  cy: number
  /** Intrados-Radius. */
  rInner: number
  /** Extrados-Radius (= rInner + ringThickness). */
  rOuter: number
  /** Anzahl Voussoirs (ungerade empfohlen). */
  count: number
  /** Fugenbreite in cm (Winkellücke). */
  joint: number
  /** Startwinkel in Radiant (Default π = links). */
  thetaStart: number
  /** Endwinkel in Radiant (Default 0 = rechts). */
  thetaEnd: number
  spandrel: 'bond' | 'rect'
  /** Schenkel bis Sohlbank. */
  jambs: boolean
  /** Steine je Schenkel (gleiche Höhe). */
  jambCount: number
  /** Unterkante der Öffnung (Sohlbank), für Schenkel. */
  sillY: number
}

export interface BuildArchSpecOptions {
  panelWidth: number
  panelHeight: number
  joint?: number
  inflate?: number
}

/**
 * Baut die Spec aus Öffnung + Paneelmaße.
 * Count/Ringstärke: Nutzerwert wenn gesetzt, sonst Auto.
 */
export function buildSemicircularArchSpec(
  opening: Opening,
  opts: BuildArchSpecOptions,
): SemicircularArchSpec | null {
  const arch = normalizeOpeningArch(opening.arch)
  if (arch.form !== 'round') return null
  const inner = openingArchGeom(opening, opts.inflate ?? 0)
  if (!inner) return null

  const ringT =
    arch.ringThicknessCm != null
      ? Math.max(4, arch.ringThicknessCm)
      : archRingThickness(opts.panelHeight)
  const count =
    arch.keystoneCount != null
      ? clampOddKeystoneCount(arch.keystoneCount)
      : archVoussoirCount(inner, opts.panelWidth)

  const thetaStart =
    arch.thetaStartDeg != null ? (arch.thetaStartDeg * Math.PI) / 180 : Math.PI
  const thetaEnd = arch.thetaEndDeg != null ? (arch.thetaEndDeg * Math.PI) / 180 : 0

  const joint = Math.max(0, opts.joint ?? 0.8)
  const clearH = archJambClearHeight(inner.cy, inner.y0, joint)
  const jambCount =
    arch.jambCount != null ? clampJambCount(arch.jambCount) : archJambCountAuto(clearH, opts.panelHeight)

  return {
    cx: inner.cx,
    cy: inner.cy,
    rInner: inner.r,
    rOuter: inner.r + ringT,
    count,
    joint,
    thetaStart,
    thetaEnd,
    spandrel: arch.spandrel === 'rect' ? 'rect' : 'bond',
    jambs: arch.jambs === true,
    jambCount,
    sillY: inner.y0,
  }
}

function archPointAt(geom: ArchGeom, theta: number, radius: number): { x: number; y: number } {
  return {
    x: geom.cx + Math.cos(theta) * radius,
    y: geom.cy + Math.sin(theta) * radius,
  }
}

function outlineBounds(pts: { x: number; y: number }[]): OpeningRect {
  let x0 = pts[0].x
  let x1 = pts[0].x
  let y0 = pts[0].y
  let y1 = pts[0].y
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

function wedgeOutline(
  geom: ArchGeom,
  t0: number,
  t1: number,
  rInner: number,
  rOuter: number,
  segments: number,
): { x: number; y: number }[] {
  const n = Math.max(3, segments)
  const outline: { x: number; y: number }[] = []
  for (let s = 0; s <= n; s += 1) {
    const t = t0 + (t1 - t0) * (s / n)
    outline.push(archPointAt(geom, t, rInner))
  }
  for (let s = 0; s <= n; s += 1) {
    const t = t1 + (t0 - t1) * (s / n)
    outline.push(archPointAt(geom, t, rOuter))
  }
  return outline
}

function specGeom(spec: SemicircularArchSpec): ArchGeom {
  return {
    cx: spec.cx,
    cy: spec.cy,
    r: spec.rInner,
    x0: spec.cx - spec.rInner,
    x1: spec.cx + spec.rInner,
    y0: spec.cy - spec.rInner,
    y1: spec.cy + spec.rOuter,
    springY: spec.cy,
  }
}

/** Winkelpaare der Keile inkl. Fugenlücke (t0 links/größer, t1 rechts/kleiner). */
export function voussoirWedgeAngles(spec: SemicircularArchSpec): { t0: number; t1: number }[] {
  if (spec.count < 3 || spec.rOuter - spec.rInner < 0.5) return []
  const span = spec.thetaStart - spec.thetaEnd
  if (span < 0.05) return []
  const rMid = (spec.rInner + spec.rOuter) * 0.5
  const gap = Math.min((span / spec.count) * 0.35, spec.joint / Math.max(1, rMid))
  const out: { t0: number; t1: number }[] = []
  for (let i = 0; i < spec.count; i += 1) {
    const raw0 = spec.thetaStart - (span * i) / spec.count
    const raw1 = spec.thetaStart - (span * (i + 1)) / spec.count
    const t0 = raw0 - gap * 0.5
    const t1 = raw1 + gap * 0.5
    if (t0 - t1 < 0.02) continue
    out.push({ t0, t1 })
  }
  return out
}

/**
 * Äußere Keilstein-Kante (Extrados) in derselben Facettierung wie das 3D-Mesh.
 * Paneel-Clip dockt an diese Sehnen — nicht an einen dichten Kreis, dessen Sehne durch die Keile geht.
 */
export function voussoirExtradosPolyline(spec: SemicircularArchSpec): { x: number; y: number }[] {
  const geom = specGeom(spec)
  const segs = voussoirMeshSegments(spec.count)
  const pts: { x: number; y: number }[] = []
  const push = (p: { x: number; y: number }) => {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.02) pts.push(p)
  }
  push(archPointAt(geom, spec.thetaStart, spec.rOuter))
  for (const { t0, t1 } of voussoirWedgeAngles(spec)) {
    for (let s = 0; s <= segs; s += 1) {
      const t = t0 + (t1 - t0) * (s / segs)
      push(archPointAt(geom, t, spec.rOuter))
    }
  }
  push(archPointAt(geom, spec.thetaEnd, spec.rOuter))
  return pts
}

/**
 * Keilsteine aus Spec: θ von thetaStart nach thetaEnd; Winkellücke ≈ Fuge.
 */
export function archVoussoirPolysFromSpec(spec: SemicircularArchSpec): OpeningPoly[] {
  const segs = voussoirMeshSegments(spec.count)
  const geom = specGeom(spec)
  const out: OpeningPoly[] = []
  for (const { t0, t1 } of voussoirWedgeAngles(spec)) {
    const outline = wedgeOutline(geom, t0, t1, spec.rInner, spec.rOuter, segs)
    out.push({
      ...outlineBounds(outline),
      outline,
      polar: {
        cx: spec.cx,
        cy: spec.cy,
        rInner: spec.rInner,
        rOuter: spec.rOuter,
        t0,
        t1,
      },
    })
  }
  return out
}

/**
 * Hybrid-Übergang Rechteckverband ↔ Radialkeile (v2.0.75).
 * Aktiv wenn Keilstein-Ring an, Rundbogen, und Paneel kein Streifen/none.
 * Alt-Saves ohne `voussoirs` bleiben beim klassischen Extrados-Clip.
 * Ohne `panelPattern` → false (Caller muss Verband setzen).
 */
export function openingArchHybridMasonryEnabled(
  opening: Opening,
  panelPattern?: string | null,
): boolean {
  if (!openingArchVoussoirsEnabled(opening)) return false
  if (normalizeOpeningArch(opening.arch).form !== 'round') return false
  if (panelPattern == null || panelPattern === '') return false
  if (panelPattern === 'strip' || panelPattern === 'none') return false
  return true
}

/** Lagerfugen-Y im Bogenband (Kämpfer → erste Fuge über Extrados-Scheitel). */
export function archHybridCourseYs(
  rowCuts: number[],
  springY: number,
  crownY: number,
  panelHeight: number,
): number[] {
  const step = Math.max(4, panelHeight)
  const top = crownY + step + 0.5
  const ys = rowCuts.filter((y) => y >= springY - 0.5 && y <= top)
  if (ys.length === 0) {
    const out: number[] = []
    for (let y = springY; y <= top + 1e-6; y += step) out.push(y)
    out.push(Math.ceil((crownY - springY) / step) * step + springY)
    return [...new Set(out.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
  }
  const last = ys[ys.length - 1]!
  if (last < crownY - 0.05) {
    ys.push(last + step)
  }
  return [...new Set(ys.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
}

function pushOutlinePt(out: { x: number; y: number }[], p: { x: number; y: number }) {
  const last = out[out.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.04) out.push(p)
}

/**
 * Hybrid-Keilsteine **schichtweise** (wie Referenzfoto): jede Lagerfuge läuft durch,
 * Steine = Schnitt Winkelsektor × Schichtband. Kein ein Keil von Intrados bis eine
 * Dock-Y (das ließ Löcher und überlange Schultern).
 */
export function archHybridVoussoirPolysFromSpec(
  spec: SemicircularArchSpec,
  courseYs: number[],
  opts?: { panelWidth?: number; panelHeight?: number },
): OpeningPoly[] {
  const segs = Math.max(4, Math.min(12, voussoirMeshSegments(spec.count)))
  const geom = specGeom(spec)
  const panelH = Math.max(4, opts?.panelHeight ?? 16)
  const springY = spec.cy
  const crownY = springY + spec.rOuter
  const courses =
    courseYs.length > 0
      ? [...courseYs].sort((a, b) => a - b)
      : archHybridCourseYs([], springY, crownY, panelH)

  const bands: { y0: number; y1: number }[] = []
  for (let i = 0; i < courses.length - 1; i += 1) {
    const y0 = courses[i]!
    const y1 = courses[i + 1]!
    if (y1 - y0 < 1) continue
    if (y1 <= springY + 0.3) continue
    if (y0 >= crownY + panelH * 0.6) continue
    bands.push({ y0: Math.max(y0, springY), y1 })
  }
  if (bands.length === 0) {
    // Fallback: eine Schicht Intrados → Extrados-Scheitel
    bands.push({ y0: springY, y1: Math.max(springY + 4, crownY) })
  }

  const out: OpeningPoly[] = []
  for (const band of bands) {
    for (const { t0, t1 } of voussoirWedgeAngles(spec)) {
      const poly = hybridCourseWedgePoly(spec, geom, t0, t1, band.y0, band.y1, segs)
      if (poly) out.push(poly)
    }
  }
  return out
}

/** Ein Stein: Winkelsektor ∩ Schicht [y0,y1], außen radial/horizontal, innen Bogen oder Sehne. */
function hybridCourseWedgePoly(
  spec: SemicircularArchSpec,
  geom: ArchGeom,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  segs: number,
): OpeningPoly | null {
  const { cx, cy, rInner } = { cx: spec.cx, cy: spec.cy, rInner: spec.rInner }
  if (y1 - y0 < 1.2) return null
  const rCap = spec.rOuter * 1.25

  const hitOrCap = (theta: number, y: number) => {
    const s = Math.sin(theta)
    if (s >= 0.04) {
      const r = (y - cy) / s
      if (r >= rInner * 0.97) {
        const rr = Math.min(r, rCap)
        return { x: cx + Math.cos(theta) * rr, y, r: rr }
      }
    }
    const dy = y - cy
    if (dy < -0.2 || dy > rCap) return null
    const dx = Math.sqrt(Math.max(0, rCap * rCap - dy * dy))
    const x = cx + (Math.cos(theta) >= 0 ? dx : -dx)
    return { x, y, r: Math.hypot(x - cx, dy) }
  }

  const topL = hitOrCap(t0, y1)
  const topR = hitOrCap(t1, y1)
  if (!topL || !topR) return null

  // Intrados nur innerhalb der Schicht (kein voller Halbbogen in unterster Lage)
  const inner: { x: number; y: number }[] = []
  for (let s = 0; s <= segs; s += 1) {
    const t = t0 + ((t1 - t0) * s) / segs
    const p = archPointAt(geom, t, rInner)
    if (p.y >= y0 - 0.15 && p.y <= y1 + 0.15) inner.push(p)
  }

  const outline: { x: number; y: number }[] = []
  if (inner.length >= 2) {
    for (const p of inner) pushOutlinePt(outline, p)
    pushOutlinePt(outline, topR)
    pushOutlinePt(outline, topL)
  } else {
    const botL = hitOrCap(t0, y0)
    const botR = hitOrCap(t1, y0)
    if (!botL || !botR) return null
    if (botL.r < rInner - 0.5 && botR.r < rInner - 0.5) return null
    pushOutlinePt(outline, botL)
    pushOutlinePt(outline, botR)
    pushOutlinePt(outline, topR)
    pushOutlinePt(outline, topL)
  }

  if (outline.length < 3) return null
  const b = outlineBounds(outline)
  if (b.width < 1.5 || b.height < 1.2) return null
  if (b.height > (y1 - y0) * 1.35 + 1) return null
  let area = 0
  for (let i = 0; i < outline.length; i += 1) {
    const j = (i + 1) % outline.length
    area += outline[i]!.x * outline[j]!.y - outline[j]!.x * outline[i]!.y
  }
  area = Math.abs(area) * 0.5
  if (area < 8) return null
  if (area / (b.width * b.height) < 0.18) return null

  return {
    ...b,
    outline,
    polar: {
      cx,
      cy,
      rInner: inner.length >= 2 ? rInner : Math.min(topL.r, topR.r) * 0.9,
      rOuter: Math.max(topL.r, topR.r),
      t0,
      t1,
    },
  }
}

/**
 * Kartesisches Raster im Bogen-Sektor entfernen (nicht die ganze AABB-Bucht —
 * sonst fehlen ~30 % Fläche neben den Keilen).
 */
export function cartesianPartOverlapsHybridSector(
  part: OpeningPoly,
  spec: SemicircularArchSpec,
  rMax: number,
): boolean {
  const samples = [
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.25, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.75, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.25 },
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.75 },
  ]
  const yLo = spec.cy - 0.5
  const yHi = spec.cy + spec.rOuter + Math.max(8, (rMax - spec.rOuter) * 0.5)
  for (const p of samples) {
    if (p.y < yLo || p.y > yHi) continue
    const dx = p.x - spec.cx
    const dy = p.y - spec.cy
    if (dy < -0.5) continue
    const r = Math.hypot(dx, dy)
    if (r < spec.rInner - 0.8) continue
    if (r > rMax + 0.5) continue
    const theta = Math.atan2(dy, dx)
    if (theta >= spec.thetaEnd - 0.08 && theta <= spec.thetaStart + 0.08) return true
  }
  if (part.bottomArc?.length || part.topArc?.length) {
    const py1 = part.y + part.height
    if (part.y < yHi && py1 > yLo) {
      const mx = part.x + part.width * 0.5
      if (Math.abs(mx - spec.cx) <= rMax + 1) return true
    }
  }
  return false
}

export function hybridSectorRMax(spec: SemicircularArchSpec, hybridPolys: OpeningPoly[]): number {
  let rMax = spec.rOuter
  for (const p of hybridPolys) {
    for (const pt of p.outline ?? []) {
      rMax = Math.max(rMax, Math.hypot(pt.x - spec.cx, pt.y - spec.cy))
    }
  }
  return rMax
}

/** Bounding der Hybrid-Bogenkappe (Kämpfer → oberste Abschluss-Lagerfuge). */
export function hybridArchBayRect(
  spec: SemicircularArchSpec,
  hybridPolys: OpeningPoly[],
  pad = 0.08,
): OpeningRect {
  let x0 = spec.cx - spec.rOuter
  let x1 = spec.cx + spec.rOuter
  let y1 = spec.cy + spec.rOuter
  for (const p of hybridPolys) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x + p.width)
    y1 = Math.max(y1, p.y + p.height)
  }
  return {
    x: x0 - pad,
    y: spec.cy - pad,
    width: x1 - x0 + pad * 2,
    height: Math.max(0, y1 - spec.cy) + pad * 2,
  }
}

/**
 * Bounding-Box der Bogenkappe (Kämpfer → Scheitel).
 * 3D stanzt diese Box nicht mehr — das Raster clippt am Extrados (`clipPolysMinusArches`).
 */
export function voussoirCapBayRect(spec: SemicircularArchSpec, bayTop?: number): OpeningRect {
  const crownY = spec.cy + spec.rOuter
  const top = Math.max(crownY, bayTop ?? crownY)
  const pad = 0.08
  return {
    x: spec.cx - spec.rOuter - pad,
    y: spec.cy - pad,
    width: spec.rOuter * 2 + pad * 2,
    height: Math.max(0, top - spec.cy) + pad * 2,
  }
}

export function archJambHoleRects(spec: SemicircularArchSpec): OpeningRect[] {
  if (!spec.jambs) return []
  const ringT = spec.rOuter - spec.rInner
  const h = spec.cy - spec.sillY
  if (ringT < 0.5 || h < 0.5) return []
  return [
    { x: spec.cx - spec.rOuter, y: spec.sillY, width: ringT, height: h },
    { x: spec.cx + spec.rInner, y: spec.sillY, width: ringT, height: h },
  ]
}

/**
 * Zwickel links/rechts: lotrechte Außenkante, innen der Extrados (bis zum Scheitel).
 */
export function archSpandrelStripPolys(spec: SemicircularArchSpec): OpeningPoly[] {
  const crownY = spec.cy + spec.rOuter
  const outer: ArchGeom = {
    cx: spec.cx,
    cy: spec.cy,
    r: spec.rOuter,
    x0: spec.cx - spec.rOuter,
    x1: spec.cx + spec.rOuter,
    y0: spec.cy - spec.rOuter,
    y1: crownY,
    springY: spec.cy,
  }
  const segs = Math.max(12, ARCH_MESH_SEGMENTS)
  const leftArc = archPolyline(outer, segs, spec.cx - spec.rOuter, spec.cx)
  const rightArc = archPolyline(outer, segs, spec.cx, spec.cx + spec.rOuter)
  const leftInner = leftArc.filter((p, i, arr) => i === 0 || Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) > 0.02)
  const rightInner = rightArc.filter((p, i, arr) => i === 0 || Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) > 0.02)
  const out: OpeningPoly[] = []
  const maxW = (inner: { x: number }[], xOuter: number) =>
    Math.max(0, ...inner.map((p) => Math.abs(p.x - xOuter)))
  if (leftInner.length >= 2 && maxW(leftInner, spec.cx - spec.rOuter) >= 1) {
    const b = outlineBounds([{ x: spec.cx - spec.rOuter, y: spec.cy }, ...leftInner])
    out.push({
      ...b,
      spandrelStrip: { xOuter: spec.cx - spec.rOuter, inner: leftInner },
    })
  }
  if (rightInner.length >= 2 && maxW(rightInner, spec.cx + spec.rOuter) >= 1) {
    const b = outlineBounds([{ x: spec.cx + spec.rOuter, y: spec.cy }, ...rightInner])
    out.push({
      ...b,
      spandrelStrip: { xOuter: spec.cx + spec.rOuter, inner: rightInner },
    })
  }
  return out
}

/**
 * Extra-Zwickelsteine in Lagerfugen (nicht mehr in 3D).
 * Die Zwickel sind geclippte Rastersteine am Extrados.
 */
export function archSpandrelCoursePolys(
  spec: SemicircularArchSpec,
  courses: { y: number; height: number }[],
): OpeningPoly[] {
  const crownY = spec.cy + spec.rOuter
  const r = spec.rOuter
  const xAt = (y: number, side: -1 | 1) => {
    const dy = Math.max(-r, Math.min(r, y - spec.cy))
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy))
    return spec.cx + side * dx
  }
  const bands: { y0: number; y1: number }[] = []
  const seen = new Set<string>()
  for (const t of courses) {
    if (t.height > 80) continue
    const y0 = Math.max(spec.cy, t.y)
    const y1 = Math.min(crownY, t.y + t.height)
    if (y1 - y0 < 1) continue
    const key = `${y0.toFixed(2)}:${y1.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    bands.push({ y0, y1 })
  }
  if (bands.length === 0) return archSpandrelStripPolys(spec)
  bands.sort((a, b) => a.y0 - b.y0)
  const out: OpeningPoly[] = []
  const n = Math.max(6, Math.ceil(ARCH_MESH_SEGMENTS / 2))
  const pushSide = (side: -1 | 1, xOuter: number) => {
    for (const { y0, y1 } of bands) {
      const inner: { x: number; y: number }[] = []
      for (let i = 0; i <= n; i += 1) {
        const y = y0 + ((y1 - y0) * i) / n
        inner.push({ x: xAt(y, side), y })
      }
      const maxW = Math.max(...inner.map((p) => Math.abs(p.x - xOuter)))
      if (maxW < 1.2) continue
      const b = outlineBounds([{ x: xOuter, y: y0 }, { x: xOuter, y: y1 }, ...inner])
      out.push({
        ...b,
        spandrelStrip: { xOuter, inner },
      })
    }
  }
  pushSide(-1, spec.cx - spec.rOuter)
  pushSide(1, spec.cx + spec.rOuter)
  return out.length > 0 ? out : archSpandrelStripPolys(spec)
}

/** Schenkel: gleiche Steinhöhe von Sohlbank bis unter den Kämpfer, `jambCount` je Seite. */
export function archJambPolysFromSpec(spec: SemicircularArchSpec): OpeningPoly[] {
  if (!spec.jambs) return []
  const ringT = spec.rOuter - spec.rInner
  const yTop = spec.cy - spec.joint * 0.5
  const yBot = spec.sillY
  const span = yTop - yBot
  if (ringT < 0.5 || span < 1) return []
  const gap = Math.max(0.2, spec.joint)
  let n = Math.max(1, spec.jambCount)
  while (n > 1 && span - (n - 1) * gap < n) n -= 1
  const stoneH = (span - (n - 1) * gap) / n
  if (stoneH < 1) return []
  const out: OpeningPoly[] = []
  const pushPair = (y0: number, y1: number) => {
    const h = y1 - y0
    if (h < 1) return
    out.push({ x: spec.cx - spec.rOuter, y: y0, width: ringT, height: h })
    out.push({ x: spec.cx + spec.rInner, y: y0, width: ringT, height: h })
  }
  for (let i = 0; i < n; i += 1) {
    const y1 = yTop - i * (stoneH + gap)
    pushPair(y1 - stoneH, y1)
  }
  return out
}

/**
 * Keilsteine des Paneel-Bogenrings (Innenradius = Clip-Kurve, außen + ringT).
 * θ von π (links) nach 0 (rechts); kleine Winkellücke ≈ Fuge.
 */
export function archVoussoirPolys(
  inner: ArchGeom,
  count: number,
  ringT: number,
  joint = 0.8,
): OpeningPoly[] {
  return archVoussoirPolysFromSpec({
    cx: inner.cx,
    cy: inner.cy,
    rInner: inner.r,
    rOuter: inner.r + ringT,
    count,
    joint,
    thetaStart: Math.PI,
    thetaEnd: 0,
    spandrel: 'bond',
    jambs: false,
    jambCount: 1,
    sillY: inner.cy - inner.r,
  })
}

function svgPt(
  spec: SemicircularArchSpec,
  r: number,
  t: number,
  toSvgY: (y: number) => number,
): string {
  const x = spec.cx + Math.cos(t) * r
  const y = spec.cy + Math.sin(t) * r
  return `${x.toFixed(2)} ${toSvgY(y).toFixed(2)}`
}

/** Keil als echter Kreisbogen (Intrados/Extrados) plus radiale Fugen. */
function wedgeArcSvgPath(
  spec: SemicircularArchSpec,
  t0: number,
  t1: number,
  toSvgY: (y: number) => number,
): string {
  const large = Math.abs(t0 - t1) > Math.PI ? 1 : 0
  const ri = spec.rInner.toFixed(2)
  const ro = spec.rOuter.toFixed(2)
  return [
    `M ${svgPt(spec, spec.rInner, t0, toSvgY)}`,
    `A ${ri} ${ri} 0 ${large} 1 ${svgPt(spec, spec.rInner, t1, toSvgY)}`,
    `L ${svgPt(spec, spec.rOuter, t1, toSvgY)}`,
    `A ${ro} ${ro} 0 ${large} 0 ${svgPt(spec, spec.rOuter, t0, toSvgY)}`,
    'Z',
  ].join(' ')
}

/**
 * SVG-Markup für Toolbar-Vorschau: Keilsteine + Intrados/Extrados + radiale Fugen.
 * Mit `hybrid`/`courseYs`: Hybrid-Polygone (Lagerfugen-Extrados) statt Kreisring.
 * Koordinaten in Wand-cm; SVG-y nach unten (Bogenscheitel oben).
 */
export function archVoussoirSvg(
  spec: SemicircularArchSpec,
  opts?: { hybrid?: boolean; courseYs?: number[]; panelWidth?: number },
): {
  viewBox: string
  wedges: string[]
  radials: string[]
  jambs: string[]
  spandrels: string[]
  intrados: string
  extrados: string
  center: { x: number; y: number }
} {
  const hybridPolys =
    opts?.hybrid === true
      ? archHybridVoussoirPolysFromSpec(
          spec,
          opts.courseYs ??
            archHybridCourseYs([], spec.cy, spec.cy + spec.rOuter, opts.panelWidth ?? 32),
          { panelWidth: opts.panelWidth },
        )
      : null

  let minX = spec.cx - spec.rOuter
  let maxX = spec.cx + spec.rOuter
  let maxWorldY = spec.cy + spec.rOuter
  if (hybridPolys) {
    for (const p of hybridPolys) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x + p.width)
      maxWorldY = Math.max(maxWorldY, p.y + p.height)
    }
  }
  const pad = Math.max(4, spec.joint * 2)
  minX -= pad
  maxX += pad
  const minY = (spec.jambs ? Math.min(spec.sillY, spec.cy) : spec.cy) - pad
  const maxY = maxWorldY + pad
  const h = maxY - minY
  const toSvgY = (y: number) => maxY - y
  const viewBox = `${minX.toFixed(1)} 0 ${(maxX - minX).toFixed(1)} ${h.toFixed(1)}`

  const outlinePath = (outline: { x: number; y: number }[]) => {
    if (outline.length < 2) return ''
    const [first, ...rest] = outline
    return [
      `M ${first!.x.toFixed(2)} ${toSvgY(first!.y).toFixed(2)}`,
      ...rest.map((p) => `L ${p.x.toFixed(2)} ${toSvgY(p.y).toFixed(2)}`),
      'Z',
    ].join(' ')
  }

  const angles = voussoirWedgeAngles(spec)
  const wedges = hybridPolys
    ? hybridPolys.map((p) => outlinePath(p.outline ?? [])).filter(Boolean)
    : angles.map(({ t0, t1 }) => wedgeArcSvgPath(spec, t0, t1, toSvgY))

  const jointThetas = [spec.thetaStart]
  for (let i = 1; i < spec.count; i += 1) {
    jointThetas.push(spec.thetaStart - ((spec.thetaStart - spec.thetaEnd) * i) / spec.count)
  }
  jointThetas.push(spec.thetaEnd)
  const radials = hybridPolys
    ? []
    : jointThetas.map((t) => {
        const inner = svgPt(spec, spec.rInner, t, toSvgY)
        const outer = svgPt(spec, spec.rOuter, t, toSvgY)
        return `M ${inner} L ${outer}`
      })

  const jambs = archJambPolysFromSpec(spec).map((rect) => {
    const x = rect.x
    const y = toSvgY(rect.y + rect.height)
    return `M ${x.toFixed(2)} ${y.toFixed(2)} h ${rect.width.toFixed(2)} v ${rect.height.toFixed(2)} h ${(-rect.width).toFixed(2)} Z`
  })

  const spandrels = hybridPolys
    ? []
    : archSpandrelStripPolys(spec)
        .map((poly) => {
          const strip = poly.spandrelStrip
          if (!strip || strip.inner.length < 2) return ''
          const xO = strip.xOuter
          const inner = [...strip.inner].sort((a, b) => a.y - b.y)
          const first = inner[0]!
          const last = inner[inner.length - 1]!
          const pts = [
            `M ${xO.toFixed(2)} ${toSvgY(first.y).toFixed(2)}`,
            ...inner.map((p) => `L ${p.x.toFixed(2)} ${toSvgY(p.y).toFixed(2)}`),
            `L ${xO.toFixed(2)} ${toSvgY(last.y).toFixed(2)}`,
            'Z',
          ]
          return pts.join(' ')
        })
        .filter(Boolean)

  const arcPath = (r: number) => {
    const large = Math.abs(spec.thetaStart - spec.thetaEnd) > Math.PI ? 1 : 0
    return `M ${svgPt(spec, r, spec.thetaStart, toSvgY)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${svgPt(spec, r, spec.thetaEnd, toSvgY)}`
  }

  // Hybrid: „Extrados“ = obere Abschlusskanten der Hybrid-Polygone (gestuft)
  let extrados = arcPath(spec.rOuter)
  if (hybridPolys && hybridPolys.length > 0) {
    const topEdge: { x: number; y: number }[] = []
    for (const p of hybridPolys) {
      const ol = p.outline
      if (!ol) continue
      for (const pt of ol) {
        if (pt.y >= maxWorldY - 0.6) topEdge.push(pt)
      }
    }
    topEdge.sort((a, b) => a.x - b.x)
    if (topEdge.length >= 2) {
      extrados = [
        `M ${topEdge[0]!.x.toFixed(2)} ${toSvgY(topEdge[0]!.y).toFixed(2)}`,
        ...topEdge.slice(1).map((p) => `L ${p.x.toFixed(2)} ${toSvgY(p.y).toFixed(2)}`),
      ].join(' ')
    }
  }

  return {
    viewBox,
    wedges,
    radials,
    jambs,
    spandrels,
    intrados: arcPath(spec.rInner),
    extrados,
    center: { x: spec.cx, y: toSvgY(spec.cy) },
  }
}

/**
 * Fächer im Zwickel außerhalb des Rings: radiale Stoßfugen, konzentrische Lagerfugen.
 * `maxY` = Oberkante der ersetzten Passstein-Reste.
 */
export function archFanPolys(
  inner: ArchGeom,
  ringT: number,
  panelHeight: number,
  panelWidth: number,
  maxY: number,
  joint = 0.8,
): OpeningPoly[] {
  const r0 = inner.r + ringT
  const rMax = Math.max(r0 + 1, maxY - inner.cy)
  if (rMax <= r0 + 0.5) return []
  const count = archVoussoirCount(inner, panelWidth)
  const ringH = Math.max(4, panelHeight - joint)
  const gap = Math.min((Math.PI / count) * 0.35, joint / Math.max(1, r0))
  const segs = Math.max(4, Math.ceil(24 / count))
  const out: OpeningPoly[] = []
  let rInner = r0
  for (let ring = 0; ring < 12 && rInner < rMax - 0.5; ring += 1) {
    const rOuter = Math.min(rMax, rInner + ringH)
    if (rOuter - rInner < 1) break
    for (let i = 0; i < count; i += 1) {
      const raw0 = Math.PI * (1 - i / count)
      const raw1 = Math.PI * (1 - (i + 1) / count)
      const t0 = raw0 - gap * 0.5
      const t1 = raw1 + gap * 0.5
      if (t0 - t1 < 0.02) continue
      const outline = wedgeOutline(inner, t0, t1, rInner, rOuter, segs)
      const b = outlineBounds(outline)
      if (b.y + b.height < inner.springY - 0.5) continue
      if (b.x + b.width < inner.x0 - ringT || b.x > inner.x1 + ringT) continue
      out.push({
        ...b,
        outline,
        polar: { cx: inner.cx, cy: inner.cy, rInner, rOuter, t0, t1 },
      })
    }
    rInner = rOuter + joint
  }
  return out
}

/** Ob ein Clip-Rest im Bogenzwickel liegt (Passstein über der Kämpferlinie). */
export function isArchSpandrelRemnant(rect: OpeningPoly, geom: ArchGeom): boolean {
  if (rect.outline && rect.outline.length >= 3) return false
  if (rect.y + rect.height <= geom.springY + 0.5) return false
  const midX = rect.x + rect.width * 0.5
  if (midX < geom.x0 - 1 || midX > geom.x1 + 1) return false
  return Boolean(rect.bottomArc) || rect.y + rect.height * 0.5 > geom.springY
}

/** Punkte entlang des oberen Bogens (Wand-XY), für Trim/Keilsteine. */
export function openingArchPolyline(
  opening: Opening,
  segments = ARCH_CURVE_SEGMENTS,
): { x: number; y: number }[] {
  const outline = openingArchOutline(opening, 0, segments)
  if (!outline || outline.length < 2) {
    return [
      { x: opening.x, y: opening.y + opening.height },
      { x: opening.x + opening.width, y: opening.y + opening.height },
    ]
  }
  return outline
}
