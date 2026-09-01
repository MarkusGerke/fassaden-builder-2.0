import type { EditorState, FacadeState } from '../types/facade'
import { cloneFacadeState, createDefaultEditorState } from '../types/facade'
import { buildGalleryFacadeState } from '../gallery/galleryState'
import {
  clampGallerySpacingCm,
  loadGallerySpacingCm,
  saveGallerySpacingCm,
  GALLERY_SPACING_DEFAULT_CM,
} from '../gallery/gallerySpacing'
import { newGalleryRandomSeed } from '../gallery/galleryRandom'

const GALLERY_HASH = '#gallery'

export interface GallerySnapshot {
  facade: FacadeState
  editor: EditorState
}

export interface GalleryModeHost {
  getFacade(): FacadeState
  getEditor(): EditorState
  /** Galerie-State setzen ohne Persistenz/Hash (Host prüft isGalleryModeActive). */
  applyTransient(facade: FacadeState, editor: EditorState): void
  /** Nach Exit: Projekt wiederherstellen (mit Persistenz erlaubt). */
  restoreProject(facade: FacadeState, editor: EditorState): void
  focusExterior(): void
  setView3d(): void
  onGalleryActiveChange?(active: boolean): void
}

let galleryActive = false
let snapshot: GallerySnapshot | null = null
let spacingCm = GALLERY_SPACING_DEFAULT_CM
let randomSeed = 1

export function isGalleryModeActive(): boolean {
  return galleryActive
}

export function getGallerySpacingCm(): number {
  return spacingCm
}

export function getGalleryRandomSeed(): number {
  return randomSeed
}

export function isGalleryHash(): boolean {
  const hash = window.location.hash
  return hash === GALLERY_HASH || hash.startsWith(`${GALLERY_HASH}?`)
}

function setGalleryHash(on: boolean) {
  const next = on ? GALLERY_HASH : ''
  if (window.location.hash === next) return
  if (on) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${GALLERY_HASH}`)
  } else if (window.location.hash === GALLERY_HASH || window.location.hash.startsWith(`${GALLERY_HASH}?`)) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}

function rebuildInto(host: GalleryModeHost) {
  const built = buildGalleryFacadeState({ spacingCm, randomSeed })
  spacingCm = built.spacingCm
  randomSeed = built.randomSeed
  const editor = createDefaultEditorState()
  host.applyTransient(built.state, editor)
  host.setView3d()
  host.focusExterior()
}

export function enterGalleryMode(host: GalleryModeHost): void {
  if (galleryActive) {
    rebuildInto(host)
    return
  }
  snapshot = {
    facade: cloneFacadeState(host.getFacade()),
    editor: {
      ...host.getEditor(),
      selectedWallIds: [...host.getEditor().selectedWallIds],
      selectedOpenings: host.getEditor().selectedOpenings.map((o) => ({ ...o })),
    },
  }
  spacingCm = loadGallerySpacingCm()
  randomSeed = newGalleryRandomSeed()
  galleryActive = true
  setGalleryHash(true)
  host.onGalleryActiveChange?.(true)
  rebuildInto(host)
}

export function exitGalleryMode(host: GalleryModeHost): void {
  if (!galleryActive) return
  galleryActive = false
  setGalleryHash(false)
  host.onGalleryActiveChange?.(false)
  const snap = snapshot
  snapshot = null
  if (snap) {
    host.restoreProject(snap.facade, snap.editor)
    host.setView3d()
    host.focusExterior()
  }
}

export function toggleGalleryMode(host: GalleryModeHost): void {
  if (galleryActive) exitGalleryMode(host)
  else enterGalleryMode(host)
}

export function setGallerySpacingAndRebuild(host: GalleryModeHost, value: number): void {
  spacingCm = saveGallerySpacingCm(clampGallerySpacingCm(value))
  if (!galleryActive) return
  rebuildInto(host)
}

export function reshuffleGalleryRandom(host: GalleryModeHost): void {
  if (!galleryActive) return
  randomSeed = newGalleryRandomSeed()
  rebuildInto(host)
}

export function syncGalleryControls(ui: {
  spacingInput: HTMLInputElement | null
  section: HTMLElement | null
  exitBtn: HTMLButtonElement | null
  enterBtn: HTMLButtonElement | null
}): void {
  if (ui.spacingInput) ui.spacingInput.value = String(spacingCm)
  if (ui.section) ui.section.hidden = !galleryActive
  if (ui.exitBtn) ui.exitBtn.hidden = !galleryActive
  if (ui.enterBtn) {
    ui.enterBtn.classList.toggle('active', galleryActive)
    ui.enterBtn.setAttribute('aria-pressed', galleryActive ? 'true' : 'false')
    ui.enterBtn.textContent = galleryActive ? 'Galerie aus' : 'Galerie'
  }
}

export function initGalleryUi(
  host: GalleryModeHost,
  els: {
    enterBtn: HTMLButtonElement
    exitBtn?: HTMLButtonElement | null
    spacingInput: HTMLInputElement
    reshuffleBtn: HTMLButtonElement
    section: HTMLElement
  },
): void {
  spacingCm = loadGallerySpacingCm()
  els.spacingInput.value = String(spacingCm)

  els.enterBtn.addEventListener('click', () => {
    toggleGalleryMode(host)
    syncGalleryControls({
      spacingInput: els.spacingInput,
      section: els.section,
      exitBtn: els.exitBtn ?? null,
      enterBtn: els.enterBtn,
    })
  })

  els.exitBtn?.addEventListener('click', () => {
    exitGalleryMode(host)
    syncGalleryControls({
      spacingInput: els.spacingInput,
      section: els.section,
      exitBtn: els.exitBtn ?? null,
      enterBtn: els.enterBtn,
    })
  })

  const applySpacing = () => {
    setGallerySpacingAndRebuild(host, Number(els.spacingInput.value))
    syncGalleryControls({
      spacingInput: els.spacingInput,
      section: els.section,
      exitBtn: els.exitBtn ?? null,
      enterBtn: els.enterBtn,
    })
  }
  els.spacingInput.addEventListener('change', applySpacing)
  els.reshuffleBtn.addEventListener('click', () => {
    reshuffleGalleryRandom(host)
  })

  syncGalleryControls({
    spacingInput: els.spacingInput,
    section: els.section,
    exitBtn: els.exitBtn ?? null,
    enterBtn: els.enterBtn,
  })

  if (isGalleryHash()) {
    enterGalleryMode(host)
    syncGalleryControls({
      spacingInput: els.spacingInput,
      section: els.section,
      exitBtn: els.exitBtn ?? null,
      enterBtn: els.enterBtn,
    })
  }
}
