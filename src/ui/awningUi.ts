/**
 * Markisen-UI + Playback (Öffnung / Wand).
 * Wird aus main.ts mit DOM-Refs und State-Callbacks initialisiert.
 */
import type { AwningConfig, AwningKind, FacadeState, MotionCurve, OpeningRef, Wall } from '../types/facade'
import {
  awningKindDefaults,
  defaultAwningConfig,
  isAwningKind,
  openingSupportsAwning,
} from '../studio/awning'
import {
  addWallAwning,
  ensureOpeningAwning,
  findWallAwning,
  removeWallAwning,
  updateOpeningAwning,
  updateWallAwning,
  wallAwnings,
} from '../utils/awnings'
import { evalMotionCurve } from '../utils/openingMotion'
import { normalizeDaySchedule, type DaySchedule } from '../utils/daySchedule'
import { bindDayScheduleEditor } from './dayScheduleEditor'
import { normalizeSurfaceFinish } from '../utils/surfaceFinish'

export type AwningUiDeps = {
  getState: () => FacadeState
  commitState: (next: FacadeState) => void
  previewState: (next: FacadeState) => void
  markViewportDirty: () => void
  scopedOpeningRefs: () => OpeningRef[]
  selectedOpening: () => { wall: Wall; opening: import('../types/facade').Opening } | null
  selectedWallIds: () => string[]
  getWall: (state: FacadeState, wallId: string) => Wall | undefined
  selectedAwningId: () => string | undefined
  setSelectedAwningId: (id: string | undefined) => void
  applyAwningExtension: (
    wallId: string,
    extension: number,
    opts?: { openingId?: string; awningId?: string },
  ) => boolean
  ensureHighDetailForWall: (wallId: string) => void
  stopOtherPlayback: () => void
  syncSelectionHighlightSuppressed: () => void
  renderColorSwatches: (
    host: HTMLElement,
    palette: 'profile' | 'wall' | 'cladding' | 'frame' | 'glass',
    color: string,
    onCommit: (color: string) => void,
    onPreview?: (color: string | null) => void,
    finish?: {
      value: ReturnType<typeof normalizeSurfaceFinish>
      select: HTMLSelectElement
      onChange: (finish: ReturnType<typeof normalizeSurfaceFinish>) => void
    },
  ) => void
  previewSelectionColor: (fn: (color: string) => FacadeState) => (color: string | null) => void
}

type PlayMode = 'extend' | 'retract' | 'cycle'
type PlayPhase = 'extend' | 'retract' | 'hold'

type Playback = {
  targets: Array<{ wallId: string; openingId?: string; awningId: string }>
  mode: PlayMode
  phase: PlayPhase
  t0: number
  startExt: number
  targetExt: number
  extendCurve: MotionCurve
  retractCurve: MotionCurve
}

let playback: Playback | null = null
let deps: AwningUiDeps | null = null

function d(): AwningUiDeps {
  if (!deps) throw new Error('awningUi not initialized')
  return deps
}

export function isAwningPlaybackActive(): boolean {
  return Boolean(playback)
}

export function stopAwningPlayback(commit: boolean): void {
  const p = playback
  playback = null
  const api = deps
  if (!api) return
  api.syncSelectionHighlightSuppressed()
  const stopBtn = document.querySelector<HTMLButtonElement>('#awning-stop')
  if (stopBtn) stopBtn.hidden = true
  if (!p) return
  if (commit) {
    const ext =
      p.phase === 'hold'
        ? p.targetExt
        : Number(document.querySelector<HTMLInputElement>('#awning-extension')?.value ?? 65) / 100
    commitAwningExtensionOnTargets(p.targets, ext)
  }
  syncAwningControls()
  api.markViewportDirty()
}

function commitAwningExtensionOnTargets(
  targets: Playback['targets'],
  extension: number,
): void {
  const api = d()
  let next = api.getState()
  const openingRefs: OpeningRef[] = []
  const wallPatches = new Map<string, string>()
  for (const t of targets) {
    if (t.openingId) openingRefs.push({ wallId: t.wallId, openingId: t.openingId })
    else wallPatches.set(t.wallId, t.awningId)
  }
  if (openingRefs.length > 0) {
    next = updateOpeningAwning(next, openingRefs, { extension })
  }
  for (const [wallId, awningId] of wallPatches) {
    next = updateWallAwning(next, [wallId], { extension }, awningId)
  }
  api.commitState(next)
}

export function playAwning(mode: PlayMode, scope: 'opening' | 'wall' = 'opening'): void {
  const api = d()
  api.stopOtherPlayback()
  stopAwningPlayback(false)

  const targets: Playback['targets'] = []
  let sample: AwningConfig | null = null

  if (scope === 'opening') {
    const refs = api.scopedOpeningRefs().filter((ref) => {
      const wall = api.getWall(api.getState(), ref.wallId)
      const opening = wall?.openings.find((o) => o.id === ref.openingId)
      return opening && openingSupportsAwning(opening) && ensureOpeningAwning(opening).enabled
    })
    for (const ref of refs) {
      const wall = api.getWall(api.getState(), ref.wallId)
      const opening = wall?.openings.find((o) => o.id === ref.openingId)
      if (!opening) continue
      const awning = ensureOpeningAwning(opening)
      targets.push({ wallId: ref.wallId, openingId: ref.openingId, awningId: awning.id })
      if (!sample) sample = awning
      api.ensureHighDetailForWall(ref.wallId)
    }
  } else {
    const wallId = api.selectedWallIds()[0]
    if (!wallId) return
    const wall = api.getWall(api.getState(), wallId)
    if (!wall) return
    const awning =
      findWallAwning(wall, api.selectedAwningId()) ?? wallAwnings(wall)[0]
    if (!awning?.enabled) return
    targets.push({ wallId, awningId: awning.id })
    sample = awning
    api.ensureHighDetailForWall(wallId)
  }

  if (!sample || targets.length === 0) return
  const phase: PlayPhase = mode === 'retract' ? 'retract' : 'extend'
  const targetExt = phase === 'extend' ? 1 : 0
  playback = {
    targets,
    mode,
    phase,
    t0: performance.now(),
    startExt: sample.extension,
    targetExt,
    extendCurve: sample.motion!.extend,
    retractCurve: sample.motion!.retract,
  }
  api.syncSelectionHighlightSuppressed()
  const stopBtn = document.querySelector<HTMLButtonElement>('#awning-stop')
  if (stopBtn) stopBtn.hidden = false
  tickAwningPlayback(performance.now())
}

export function tickAwningPlayback(now: number): void {
  const p = playback
  const api = deps
  if (!p || !api) return

  if (p.phase === 'hold') {
    for (const t of p.targets) {
      api.applyAwningExtension(t.wallId, p.targetExt, {
        openingId: t.openingId,
        awningId: t.awningId,
      })
    }
    if (now - p.t0 >= 700) {
      p.phase = 'retract'
      p.startExt = 1
      p.targetExt = 0
      p.t0 = now
    }
    api.markViewportDirty()
    return
  }

  const curve = p.phase === 'extend' ? p.extendCurve : p.retractCurve
  const t = Math.min(1, (now - p.t0) / Math.max(80, curve.durationMs))
  const v = evalMotionCurve(curve, t)
  const extension = p.startExt + (p.targetExt - p.startExt) * v
  for (const target of p.targets) {
    api.applyAwningExtension(target.wallId, extension, {
      openingId: target.openingId,
      awningId: target.awningId,
    })
  }
  const extInput = document.querySelector<HTMLInputElement>('#awning-extension')
  const extLabel = document.querySelector<HTMLElement>('#awning-extension-label')
  if (extInput) extInput.value = String(Math.round(extension * 100))
  if (extLabel) extLabel.textContent = String(Math.round(extension * 100))
  const studioExt = document.querySelector<HTMLInputElement>('#studio-awning-extension')
  const studioLabel = document.querySelector<HTMLElement>('#studio-awning-extension-label')
  if (studioExt) studioExt.value = String(Math.round(extension * 100))
  if (studioLabel) studioLabel.textContent = String(Math.round(extension * 100))

  if (t >= 1) {
    if (p.mode === 'cycle' && p.phase === 'extend') {
      p.phase = 'hold'
      p.targetExt = 1
      p.t0 = now
      api.markViewportDirty()
      return
    }
    const finalExt = p.targetExt
    const targets = p.targets
    playback = null
    const stopBtn = document.querySelector<HTMLButtonElement>('#awning-stop')
    if (stopBtn) stopBtn.hidden = true
    api.syncSelectionHighlightSuppressed()
    commitAwningExtensionOnTargets(targets, finalExt)
    return
  }
  api.markViewportDirty()
}

function commitOpeningPatch(
  patch: Partial<AwningConfig> & { motion?: Partial<NonNullable<AwningConfig['motion']>> },
  opts?: { live?: boolean },
): void {
  const api = d()
  const refs = api.scopedOpeningRefs().filter((ref) => {
    const wall = api.getWall(api.getState(), ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    return opening && openingSupportsAwning(opening)
  })
  if (refs.length === 0) return
  const next = updateOpeningAwning(api.getState(), refs, patch)
  if (opts?.live && typeof patch.extension === 'number') {
    for (const ref of refs) {
      const wall = api.getWall(next, ref.wallId)
      const opening = wall?.openings.find((o) => o.id === ref.openingId)
      const id = opening ? ensureOpeningAwning(opening).id : undefined
      api.applyAwningExtension(ref.wallId, patch.extension, {
        openingId: ref.openingId,
        awningId: id,
      })
    }
    api.previewState(next)
    syncAwningControls()
    api.markViewportDirty()
    return
  }
  api.commitState(next)
}

function commitWallPatch(
  patch: Partial<AwningConfig>,
  opts?: { live?: boolean },
): void {
  const api = d()
  const wallIds = api.selectedWallIds()
  if (wallIds.length === 0) return
  const awningId = api.selectedAwningId()
  const next = updateWallAwning(api.getState(), wallIds, patch, awningId)
  if (opts?.live && typeof patch.extension === 'number') {
    for (const wallId of wallIds) {
      api.applyAwningExtension(wallId, patch.extension, { awningId: awningId ?? undefined })
    }
    api.previewState(next)
    syncStudioAwningControls()
    api.markViewportDirty()
    return
  }
  api.commitState(next)
}

export function syncAwningControls(): void {
  const section = document.querySelector<HTMLElement>('#opening-awning-section')
  const options = document.querySelector<HTMLElement>('#awning-options')
  const enabled = document.querySelector<HTMLInputElement>('#awning-enabled')
  if (!section || !options || !enabled || !deps) return

  const sel = deps.selectedOpening()
  const supports = Boolean(sel && openingSupportsAwning(sel.opening))
  const show = deps.scopedOpeningRefs().length >= 1 && supports
  section.hidden = !show
  if (!show || !sel) {
    options.hidden = true
    return
  }
  const awning = ensureOpeningAwning(sel.opening)
  enabled.checked = awning.enabled
  options.hidden = !awning.enabled
  if (!awning.enabled) return

  const ext = document.querySelector<HTMLInputElement>('#awning-extension')
  const extLabel = document.querySelector<HTMLElement>('#awning-extension-label')
  const width = document.querySelector<HTMLInputElement>('#awning-width')
  const projection = document.querySelector<HTMLInputElement>('#awning-projection')
  const overhang = document.querySelector<HTMLInputElement>('#awning-overhang')
  const frontOverhang = document.querySelector<HTMLInputElement>('#awning-front-overhang')
  const slope = document.querySelector<HTMLInputElement>('#awning-slope')
  const armClearance = document.querySelector<HTMLInputElement>('#awning-arm-clearance')
  const armMountY = document.querySelector<HTMLInputElement>('#awning-arm-mount-y')
  const verticalDrop = document.querySelector<HTMLInputElement>('#awning-vertical-drop')
  const mountY = document.querySelector<HTMLInputElement>('#awning-mount-y')
  const finish = document.querySelector<HTMLSelectElement>('#awning-finish')
  if (ext) ext.value = String(Math.round(awning.extension * 100))
  if (extLabel) extLabel.textContent = String(Math.round(awning.extension * 100))
  if (width) width.value = String(awning.widthCm)
  if (projection) projection.value = String(awning.projectionCm)
  if (overhang) overhang.value = String(awning.overhangCm ?? 16)
  if (frontOverhang) frontOverhang.value = String(awning.frontOverhangCm ?? 16)
  if (slope) slope.value = String(awning.slopeDeg ?? 15)
  if (armClearance) armClearance.value = String(awning.armClearanceCm ?? 8)
  if (armMountY) armMountY.value = String(awning.armMountYCm ?? 144)
  if (verticalDrop) verticalDrop.value = String(awning.verticalDropCm ?? 120)
  if (mountY) mountY.value = String(awning.mountY ?? 0)
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-awning-kind]')) {
    btn.classList.toggle('active', btn.dataset.awningKind === awning.kind)
  }
  syncAwningKindFields(awning.kind, 'opening')
  const fabricHost = document.querySelector<HTMLElement>('#awning-fabric-color-swatches')
  const frameHost = document.querySelector<HTMLElement>('#awning-frame-color-swatches')
  if (fabricHost) {
    deps.renderColorSwatches(
      fabricHost,
      'wall',
      awning.fabricColor ?? '#9ca3af',
      (color) => commitOpeningPatch({ fabricColor: color }),
      deps.previewSelectionColor((color) =>
        updateOpeningAwning(deps!.getState(), deps!.scopedOpeningRefs(), { fabricColor: color }),
      ),
      finish
        ? {
            value: normalizeSurfaceFinish(awning.finish),
            select: finish,
            onChange: (f) => commitOpeningPatch({ finish: f }),
          }
        : undefined,
    )
  }
  if (frameHost) {
    deps.renderColorSwatches(
      frameHost,
      'profile',
      awning.frameColor ?? '#4b5563',
      (color) => commitOpeningPatch({ frameColor: color }),
      deps.previewSelectionColor((color) =>
        updateOpeningAwning(deps!.getState(), deps!.scopedOpeningRefs(), { frameColor: color }),
      ),
    )
  }
}

function syncAwningKindFields(kind: AwningKind, scope: 'opening' | 'studio'): void {
  const drop = document.querySelector<HTMLElement>(
    scope === 'opening' ? '#awning-drop-fields' : '#studio-awning-drop-fields',
  )
  const marki = document.querySelector<HTMLElement>(
    scope === 'opening' ? '#awning-markisolette-fields' : '#studio-awning-markisolette-fields',
  )
  const overhangRow = document.querySelector<HTMLElement>('#awning-overhang-row')
  const projectionRow = document.querySelector<HTMLElement>(
    scope === 'opening' ? '#awning-projection-row' : '#studio-awning-projection-row',
  )
  const mountYRow = document.querySelector<HTMLElement>(
    scope === 'opening' ? '#awning-arm-mount-y-row' : '#studio-awning-arm-mount-y-row',
  )
  const showDrop = kind === 'dropArm' || kind === 'markisolette'
  if (drop) drop.hidden = !showDrop
  if (marki) marki.hidden = kind !== 'markisolette'
  if (overhangRow && scope === 'opening') overhangRow.hidden = kind === 'dropArm'
  // Fallarm: Armlänge kommt aus der Konsolenhöhe → keine Ausladung. Markisolette: Drehpunkt = Schienenende → keine Konsole.
  if (projectionRow) projectionRow.hidden = kind === 'dropArm'
  if (mountYRow) mountYRow.hidden = kind === 'markisolette'
}

/** Typwechsel: `kind` plus typgerechte Maße (Ausladung/Konsole/Senkrecht), nur wenn sich der Typ ändert. */
function kindSwitchPatch(kind: AwningKind, current: AwningKind | undefined): Partial<AwningConfig> {
  if (current === kind) return { kind }
  return { kind, ...awningKindDefaults(kind) }
}

export function syncStudioAwningControls(): void {
  const options = document.querySelector<HTMLElement>('#studio-awning-options')
  const removeBtn = document.querySelector<HTMLButtonElement>('#studio-awning-remove')
  if (!options || !deps) return
  const wallId = deps.selectedWallIds()[0]
  const wall = wallId ? deps.getWall(deps.getState(), wallId) : undefined
  const list = wall ? wallAwnings(wall) : []
  const awning =
    (deps.selectedAwningId()
      ? list.find((a) => a.id === deps!.selectedAwningId())
      : undefined) ?? list[0]
  const has = Boolean(awning)
  options.hidden = !has
  if (removeBtn) removeBtn.hidden = !has
  if (!awning) return

  const ext = document.querySelector<HTMLInputElement>('#studio-awning-extension')
  const extLabel = document.querySelector<HTMLElement>('#studio-awning-extension-label')
  const width = document.querySelector<HTMLInputElement>('#studio-awning-width')
  const projection = document.querySelector<HTMLInputElement>('#studio-awning-projection')
  const frontOverhang = document.querySelector<HTMLInputElement>('#studio-awning-front-overhang')
  const slope = document.querySelector<HTMLInputElement>('#studio-awning-slope')
  const armInset = document.querySelector<HTMLInputElement>('#studio-awning-arm-inset')
  const armMountY = document.querySelector<HTMLInputElement>('#studio-awning-arm-mount-y')
  const verticalDrop = document.querySelector<HTMLInputElement>('#studio-awning-vertical-drop')
  const x = document.querySelector<HTMLInputElement>('#studio-awning-x')
  const y = document.querySelector<HTMLInputElement>('#studio-awning-y')
  if (ext) ext.value = String(Math.round(awning.extension * 100))
  if (extLabel) extLabel.textContent = String(Math.round(awning.extension * 100))
  if (width) width.value = String(awning.widthCm)
  if (projection) projection.value = String(awning.projectionCm)
  if (frontOverhang) frontOverhang.value = String(awning.frontOverhangCm ?? 16)
  if (slope) slope.value = String(awning.slopeDeg ?? 15)
  if (armInset) armInset.value = String(awning.armInsetCm ?? 16)
  if (armMountY) armMountY.value = String(awning.armMountYCm ?? 144)
  if (verticalDrop) verticalDrop.value = String(awning.verticalDropCm ?? 120)
  if (x) x.value = String(awning.mountX ?? 0)
  if (y) y.value = String(awning.mountY ?? 0)
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-studio-awning-kind]')) {
    btn.classList.toggle('active', btn.dataset.studioAwningKind === awning.kind)
  }
  syncAwningKindFields(awning.kind, 'studio')
  const fabricHost = document.querySelector<HTMLElement>('#studio-awning-fabric-color-swatches')
  const frameHost = document.querySelector<HTMLElement>('#studio-awning-frame-color-swatches')
  if (fabricHost) {
    deps.renderColorSwatches(
      fabricHost,
      'wall',
      awning.fabricColor ?? '#9ca3af',
      (color) => commitWallPatch({ fabricColor: color }),
      deps.previewSelectionColor((color) =>
        updateWallAwning(deps!.getState(), deps!.selectedWallIds(), { fabricColor: color }, deps!.selectedAwningId()),
      ),
    )
  }
  if (frameHost) {
    deps.renderColorSwatches(
      frameHost,
      'profile',
      awning.frameColor ?? '#4b5563',
      (color) => commitWallPatch({ frameColor: color }),
      deps.previewSelectionColor((color) =>
        updateWallAwning(deps!.getState(), deps!.selectedWallIds(), { frameColor: color }, deps!.selectedAwningId()),
      ),
    )
  }
}

export function initAwningUi(api: AwningUiDeps): void {
  deps = api

  const enabled = document.querySelector<HTMLInputElement>('#awning-enabled')
  enabled?.addEventListener('change', () => {
    if (enabled.checked) {
      const { widthCm: _w, id: _id, ...defaults } = defaultAwningConfig({ enabled: true })
      commitOpeningPatch({ ...defaults, enabled: true })
    } else {
      commitOpeningPatch({ enabled: false })
    }
    syncAwningControls()
  })

  const ext = document.querySelector<HTMLInputElement>('#awning-extension')
  ext?.addEventListener('input', () => {
    commitOpeningPatch({ extension: Number(ext.value) / 100 }, { live: true })
  })
  ext?.addEventListener('change', () => {
    commitOpeningPatch({ extension: Number(ext.value) / 100 })
  })

  for (const [id, key] of [
    ['#awning-width', 'widthCm'],
    ['#awning-projection', 'projectionCm'],
    ['#awning-front-overhang', 'frontOverhangCm'],
    ['#awning-slope', 'slopeDeg'],
    ['#awning-overhang', 'overhangCm'],
    ['#awning-arm-clearance', 'armClearanceCm'],
    ['#awning-arm-mount-y', 'armMountYCm'],
    ['#awning-vertical-drop', 'verticalDropCm'],
    ['#awning-mount-y', 'mountY'],
  ] as const) {
    const el = document.querySelector<HTMLInputElement>(id)
    el?.addEventListener('change', () => {
      commitOpeningPatch({ [key]: Number(el.value) } as Partial<AwningConfig>)
    })
  }

  document.querySelectorAll<HTMLButtonElement>('[data-awning-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.awningKind
      if (!isAwningKind(kind)) return
      const sel = api.selectedOpening()
      commitOpeningPatch(kindSwitchPatch(kind, sel ? ensureOpeningAwning(sel.opening).kind : undefined))
    })
  })

  document.querySelector('#awning-play-extend')?.addEventListener('click', () => playAwning('extend'))
  document.querySelector('#awning-play-retract')?.addEventListener('click', () => playAwning('retract'))
  document.querySelector('#awning-play-cycle')?.addEventListener('click', () => playAwning('cycle'))
  document.querySelector('#awning-stop')?.addEventListener('click', () => {
    if (!playback) return
    const extension = Number(document.querySelector<HTMLInputElement>('#awning-extension')?.value ?? 0) / 100
    const targets = playback.targets
    playback = null
    commitAwningExtensionOnTargets(targets, extension)
  })

  const scheduleEl = document.querySelector<HTMLDivElement>('#awning-schedule')
  if (scheduleEl) {
    bindDayScheduleEditor(scheduleEl, {
      getSchedule: () => {
        const sel = api.selectedOpening()
        if (!sel) return normalizeDaySchedule(undefined)
        return normalizeDaySchedule(ensureOpeningAwning(sel.opening).schedule)
      },
      setSchedule: (schedule: DaySchedule) => {
        commitOpeningPatch({ schedule })
      },
    })
  }

  document.querySelector('#studio-awning-add')?.addEventListener('click', () => {
    const wallId = api.selectedWallIds()[0]
    if (!wallId) return
    const { state: next, awningId } = addWallAwning(api.getState(), wallId, {
      enabled: true,
      kind: 'foldingArm',
    })
    api.setSelectedAwningId(awningId)
    api.commitState(next)
  })
  document.querySelector('#studio-awning-remove')?.addEventListener('click', () => {
    const wallId = api.selectedWallIds()[0]
    if (!wallId) return
    api.commitState(removeWallAwning(api.getState(), wallId, api.selectedAwningId()))
    api.setSelectedAwningId(undefined)
  })

  const studioExt = document.querySelector<HTMLInputElement>('#studio-awning-extension')
  studioExt?.addEventListener('input', () => {
    commitWallPatch({ extension: Number(studioExt.value) / 100 }, { live: true })
  })
  studioExt?.addEventListener('change', () => {
    commitWallPatch({ extension: Number(studioExt.value) / 100 })
  })
  for (const [id, key] of [
    ['#studio-awning-width', 'widthCm'],
    ['#studio-awning-projection', 'projectionCm'],
    ['#studio-awning-front-overhang', 'frontOverhangCm'],
    ['#studio-awning-slope', 'slopeDeg'],
    ['#studio-awning-arm-inset', 'armInsetCm'],
    ['#studio-awning-arm-mount-y', 'armMountYCm'],
    ['#studio-awning-vertical-drop', 'verticalDropCm'],
    ['#studio-awning-x', 'mountX'],
    ['#studio-awning-y', 'mountY'],
  ] as const) {
    const el = document.querySelector<HTMLInputElement>(id)
    el?.addEventListener('change', () => {
      commitWallPatch({ [key]: Number(el.value) } as Partial<AwningConfig>)
    })
  }
  document.querySelectorAll<HTMLButtonElement>('[data-studio-awning-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.studioAwningKind
      if (!isAwningKind(kind)) return
      const wallId = api.selectedWallIds()[0]
      const wall = wallId ? api.getWall(api.getState(), wallId) : undefined
      const list = wall ? wallAwnings(wall) : []
      const current = (api.selectedAwningId() ? list.find((a) => a.id === api.selectedAwningId()) : undefined) ?? list[0]
      commitWallPatch(kindSwitchPatch(kind, current?.kind))
    })
  })
  document
    .querySelector('#studio-awning-play-extend')
    ?.addEventListener('click', () => playAwning('extend', 'wall'))
  document
    .querySelector('#studio-awning-play-retract')
    ?.addEventListener('click', () => playAwning('retract', 'wall'))
}

export function placeLibraryAwning(kind: AwningKind): void {
  const api = d()
  const sel = api.selectedOpening()
  if (sel && openingSupportsAwning(sel.opening)) {
    const { widthCm: _w, id: _id, ...defaults } = defaultAwningConfig({ enabled: true, kind })
    commitOpeningPatch({
      ...defaults,
      ...awningKindDefaults(kind),
      enabled: true,
      kind,
    })
    return
  }
  const wallId = api.selectedWallIds()[0]
  if (!wallId) return
  const { state: next, awningId } = addWallAwning(api.getState(), wallId, {
    ...awningKindDefaults(kind),
    enabled: true,
    kind,
  })
  api.setSelectedAwningId(awningId)
  api.commitState(next)
}

export function clearLibraryAwning(): void {
  const api = d()
  const sel = api.selectedOpening()
  if (sel && openingSupportsAwning(sel.opening)) {
    commitOpeningPatch({ enabled: false })
    return
  }
  const wallId = api.selectedWallIds()[0]
  if (!wallId) return
  api.commitState(removeWallAwning(api.getState(), wallId, api.selectedAwningId()))
  api.setSelectedAwningId(undefined)
}
