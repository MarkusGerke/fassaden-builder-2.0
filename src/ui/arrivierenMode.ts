import { applyHauswandGeneration } from '../arrivieren/applyHauswandGeneration'
import { HAUSWAND_BROKEN_RULE_LABELS, HAUSWAND_REGELWERK } from '../arrivieren/constants'
import { generateHauswand, parseHauswandSeed } from '../arrivieren/generateHauswand'
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
}

export interface ArrivierenUiElements {
  seedInput: HTMLInputElement
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
}

let lastPlan: HauswandPlan | null = null

export function getLastHauswandPlan(): HauswandPlan | null {
  return lastPlan
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

export function initArrivierenUi(host: ArrivierenModeHost, ui: ArrivierenUiElements): void {
  renderBrokenRuleChecks(ui.brokenRulesHost)

  ui.generateBtn.addEventListener('click', () => {
    const seed = parseHauswandSeed(ui.seedInput.value || Date.now())
    ui.seedInput.value = String(seed)
    const plan = generateHauswand(seed)
    lastPlan = plan
    ui.snapshotEl.textContent = plan.snapshotDe
    const next = applyHauswandGeneration(host.getFacade(), plan)
    host.applyState(next, host.getEditor())
    updateSchematic(ui)
  })

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
      brokenRules: verdict === 'wrong' ? selectedBrokenRules(ui.brokenRulesHost) : [],
      note: ui.noteInput.value.trim(),
      suggestedWeightTweaks: ui.weightNoteInput.value.trim() || undefined,
    })
    appendHauswandFeedback(entry)
    clearBrokenRules(ui.brokenRulesHost)
    ui.noteInput.value = ''
    ui.weightNoteInput.value = ''
  }

  ui.feedbackOkBtn.addEventListener('click', () => submitFeedback('ok'))
  ui.feedbackWrongBtn.addEventListener('click', () => submitFeedback('wrong'))

  ui.exportCopyBtn.addEventListener('click', () => {
    void copyHauswandFeedbackJsonl(readHauswandFeedback()).then((ok) => {
      ui.exportCopyBtn.textContent = ok ? 'Kopiert' : 'Kopieren fehlgeschlagen'
      window.setTimeout(() => {
        ui.exportCopyBtn.textContent = 'Feedback kopieren'
      }, 2000)
    })
  })

  ui.exportDownloadBtn.addEventListener('click', () => {
    downloadHauswandFeedbackJsonl(readHauswandFeedback())
  })
}
