import { applyHauswandGeneration } from '../arrivieren/applyHauswandGeneration'
import { HAUSWAND_BROKEN_RULE_LABELS, HAUSWAND_REGELWERK } from '../arrivieren/constants'
import {
  generateHauswand,
  parseHauswandSeed,
  randomHauswandSeed,
} from '../arrivieren/generateHauswand'
import {
  appendHauswandFeedback,
  copyHauswandFeedbackJsonl,
  createHauswandFeedbackEntry,
  downloadHauswandFeedbackJsonl,
  readHauswandFeedback,
} from '../arrivieren/hauswandFeedback'
import { hauswandPlanSchematicSvg } from '../arrivieren/hauswandSchematic'
import type { HauswandFeedbackVerdict, HauswandPlan } from '../arrivieren/hauswandTypes'
import type { EditorState, FacadeState } from '../types/facade'

export interface ArrivierenModeHost {
  getFacade: () => FacadeState
  getEditor: () => EditorState
  applyState: (facade: FacadeState, editor?: EditorState) => void
  /** Nach Generieren: Haus im Viewport einrahmen (mit Transition). */
  frameGeneratedFacade?: () => void
}

export interface ArrivierenUiElements {
  seedInput: HTMLInputElement
  seedRandomBtn: HTMLButtonElement
  generateBtn: HTMLButtonElement
  snapshotEl: HTMLElement
  schematicHost: HTMLElement
  schematicToggle: HTMLInputElement
  noteInput: HTMLTextAreaElement
  weightNoteInput: HTMLTextAreaElement
  feedbackOkBtn: HTMLButtonElement
  feedbackWrongBtn: HTMLButtonElement
  exportCopyBtn: HTMLButtonElement
  exportDownloadBtn: HTMLButtonElement
  brokenRulesHost: HTMLElement
  /** Bühne: Zufall (optional). */
  viewportRandomBtn?: HTMLButtonElement | null
  /** Bühne: ein Seed zurück (optional). */
  viewportUndoBtn?: HTMLButtonElement | null
}

let lastPlan: HauswandPlan | null = null
/** Vorherige Seeds (Undo auf der Bühne) — ein Schritt zurück. */
let previousSeed: number | null = null

export function getLastHauswandPlan(): HauswandPlan | null {
  return lastPlan
}

export function getHauswandPreviousSeed(): number | null {
  return previousSeed
}

function renderBrokenRuleChecks(host: HTMLElement): void {
  host.innerHTML = ''
  const rules = HAUSWAND_REGELWERK.feedbackSchema?.brokenRules ?? []
  for (const id of rules) {
    const label = document.createElement('label')
    label.className = 'toolbar-check'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.brokenRule = id
    label.appendChild(input)
    label.appendChild(document.createTextNode(HAUSWAND_BROKEN_RULE_LABELS[id] ?? id))
    host.appendChild(label)
  }
}

function selectedBrokenRules(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLInputElement>('input[data-broken-rule]:checked')].map(
    (el) => el.dataset.brokenRule!,
  )
}

function clearBrokenRules(host: HTMLElement): void {
  for (const el of host.querySelectorAll<HTMLInputElement>('input[data-broken-rule]')) {
    el.checked = false
  }
}

function updateSchematic(ui: ArrivierenUiElements): void {
  if (!ui.schematicToggle.checked || !lastPlan) {
    ui.schematicHost.innerHTML = ''
    ui.schematicHost.hidden = true
    return
  }
  ui.schematicHost.hidden = false
  ui.schematicHost.innerHTML = hauswandPlanSchematicSvg(lastPlan)
}

function syncUndoButton(ui: ArrivierenUiElements): void {
  if (!ui.viewportUndoBtn) return
  ui.viewportUndoBtn.disabled = previousSeed == null
}

function runHauswandGenerate(
  host: ArrivierenModeHost,
  ui: ArrivierenUiElements,
  opts?: { seed?: number; rememberPrevious?: boolean },
): void {
  const seed = parseHauswandSeed(opts?.seed ?? (ui.seedInput.value || Date.now()))
  if (opts?.rememberPrevious !== false && lastPlan && lastPlan.seed !== seed) {
    previousSeed = lastPlan.seed
  }
  ui.seedInput.value = String(seed)
  const plan = generateHauswand(seed)
  lastPlan = plan
  ui.snapshotEl.textContent = plan.snapshotDe
  const next = applyHauswandGeneration(host.getFacade(), plan)
  host.applyState(next, host.getEditor())
  host.frameGeneratedFacade?.()
  updateSchematic(ui)
  syncUndoButton(ui)
}

/** Zufall von der Bühne (merkt aktuellen Seed für Undo). */
export function arrivierenViewportRandom(host: ArrivierenModeHost, ui: ArrivierenUiElements): void {
  const seed = randomHauswandSeed()
  runHauswandGenerate(host, ui, { seed, rememberPrevious: true })
}

/** Ein Seed zurück (Bühne). */
export function arrivierenViewportUndo(host: ArrivierenModeHost, ui: ArrivierenUiElements): void {
  if (previousSeed == null) return
  const seed = previousSeed
  previousSeed = null
  runHauswandGenerate(host, ui, { seed, rememberPrevious: false })
}

export function initArrivierenUi(host: ArrivierenModeHost, ui: ArrivierenUiElements): void {
  renderBrokenRuleChecks(ui.brokenRulesHost)
  syncUndoButton(ui)

  ui.seedRandomBtn.addEventListener('click', () => {
    runHauswandGenerate(host, ui, { seed: randomHauswandSeed(), rememberPrevious: true })
  })

  ui.generateBtn.addEventListener('click', () => runHauswandGenerate(host, ui))

  ui.viewportRandomBtn?.addEventListener('click', () => arrivierenViewportRandom(host, ui))
  ui.viewportUndoBtn?.addEventListener('click', () => arrivierenViewportUndo(host, ui))

  ui.schematicToggle.addEventListener('change', () => updateSchematic(ui))

  const submitFeedback = (verdict: HauswandFeedbackVerdict) => {
    if (!lastPlan) {
      ui.snapshotEl.textContent = 'Zuerst generieren.'
      return
    }
    const entry = createHauswandFeedbackEntry({
      seed: lastPlan.seed,
      snapshotDe: lastPlan.snapshotDe,
      plan: lastPlan,
      verdict,
      brokenRules: selectedBrokenRules(ui.brokenRulesHost),
      note: ui.noteInput.value,
      suggestedWeightTweaks: ui.weightNoteInput.value.trim() || undefined,
    })
    appendHauswandFeedback(entry)
    clearBrokenRules(ui.brokenRulesHost)
    ui.noteInput.value = ''
    ui.weightNoteInput.value = ''
    ui.snapshotEl.textContent = `${verdict === 'ok' ? 'Korrekt' : 'Falsch'} · ${readHauswandFeedback().length} Einträge`
  }

  ui.feedbackOkBtn.addEventListener('click', () => submitFeedback('ok'))
  ui.feedbackWrongBtn.addEventListener('click', () => submitFeedback('wrong'))
  ui.exportCopyBtn.addEventListener('click', () => {
    void copyHauswandFeedbackJsonl().then((ok) => {
      ui.snapshotEl.textContent = ok ? 'JSONL kopiert.' : 'Zwischenablage fehlgeschlagen.'
    })
  })
  ui.exportDownloadBtn.addEventListener('click', () => {
    downloadHauswandFeedbackJsonl()
    ui.snapshotEl.textContent = 'JSONL heruntergeladen.'
  })
}
