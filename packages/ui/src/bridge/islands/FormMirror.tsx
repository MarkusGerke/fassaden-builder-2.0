import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createListCollection } from '@ark-ui/solid/select'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Accordion, Button, Field, NumberInput, Select } from '@/components/ui'
import { FieldRow } from '@/composites/FieldRow'
import {
  clickId,
  isButtonActive,
  readString,
  writeString,
} from '../vanillaBind'
import {
  BoundCheckbox,
  BoundNumberField,
  BoundSliderControl,
  useSyncTick,
} from './BoundControls'

export type FormMirrorProps = {
  rootSelector: string
  subscribe?: (cb: () => void) => () => void
}

type SelectOption = { value: string; label: string }

type MirroredControl =
  | { kind: 'checkbox'; key: string; id: string; label: string }
  | {
      kind: 'range'
      key: string
      id: string
      label: string
      min: number
      max: number
      step: number
    }
  | {
      kind: 'number'
      key: string
      id: string
      label: string
      min: number
      max: number
      step: number
    }
  | {
      kind: 'toolbarStepper'
      key: string
      stepperId: string
      label: string
      min: number
      max: number
      step: number
    }
  | { kind: 'select'; key: string; id: string; label: string; options: SelectOption[] }
  | { kind: 'color'; key: string; id: string; label: string }
  | { kind: 'button'; key: string; id: string; label: string }
  | { kind: 'buttonEl'; key: string; mirrorId: string; label: string }
  | {
      kind: 'toggleRow'
      key: string
      buttons: Array<{ id?: string; mirrorId?: string; label: string }>
    }

type MirroredBlock =
  | { kind: 'control'; key: string; control: MirroredControl }
  | { kind: 'adopt'; key: string; slotId: string }

type OrderedBlock =
  | (Extract<MirroredBlock, { kind: 'control' }> & { orderNode: Element })
  | (Extract<MirroredBlock, { kind: 'adopt' }> & { orderNode: Element })

type MirroredSection = {
  key: string
  title: string
  blocks: MirroredBlock[]
}

let mirrorSeq = 0

function ensureMirrorId(el: HTMLElement): string {
  const existing = el.dataset.parkMirrorId
  if (existing) return existing
  const id = `park-mirror-${++mirrorSeq}`
  el.dataset.parkMirrorId = id
  return id
}

function hasHiddenAncestor(el: Element, stopAt?: Element | null): boolean {
  let cur: Element | null = el
  while (cur && cur !== stopAt) {
    if (cur.hasAttribute('hidden')) return true
    if (cur instanceof HTMLElement && cur.hidden) return true
    // Nested options blocks often use [hidden] without .hidden prop sync
    const style = cur instanceof HTMLElement ? cur.style.display : ''
    if (style === 'none') return true
    cur = cur.parentElement
  }
  return false
}

function isSectionVisible(section: Element): boolean {
  if (section.classList.contains('library-edit-filtered-out')) return false
  return !hasHiddenAncestor(section)
}

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

function labelFor(el: HTMLElement): string {
  const closestLabel = el.closest('label')
  if (closestLabel) {
    const clone = closestLabel.cloneNode(true) as HTMLElement
    clone.querySelectorAll('input, select, textarea, output, button').forEach((n) => n.remove())
    const t = cleanText(clone.textContent)
    if (t) return t
  }

  const prev = el.previousElementSibling
  if (prev?.classList.contains('toolbar-label')) {
    const t = cleanText(prev.textContent)
    if (t) return t
  }

  const group = el.closest(
    '.toolbar-group, .ui-field-inline, .toolbar-inline-value, .toolbar-check, .field-control-row',
  )
  const groupLabel = group?.querySelector(
    ':scope > .toolbar-label, :scope > label.slider-label span',
  )
  if (groupLabel) {
    const t = cleanText(groupLabel.textContent)
    if (t) return t
  }

  const sliderSpan = el.closest('.toolbar-group')?.querySelector('label.slider-label span')
  if (sliderSpan) {
    const t = cleanText(sliderSpan.textContent)
    if (t) return t
  }

  const aria = el.getAttribute('aria-label')
  if (aria) return cleanText(aria)

  return el.id || 'Steuerung'
}

function sectionTitle(section: HTMLElement): string {
  const data = section.getAttribute('data-settings-label')
  if (data) return cleanText(data)
  const head = section.querySelector(':scope > .settings-section-head')
  if (head) return cleanText(head.textContent) || 'Abschnitt'
  return section.id || 'Abschnitt'
}

function parseNumAttr(el: HTMLElement, name: string, fallback: number): number {
  const raw = el.getAttribute(name)
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function readSelectOptions(select: HTMLSelectElement): SelectOption[] {
  return Array.from(select.options).map((opt) => ({
    value: opt.value,
    label: cleanText(opt.textContent) || opt.value,
  }))
}

function isPairedNumInput(id: string, root: Element): boolean {
  if (!id.endsWith('-num')) return false
  const base = id.slice(0, -4)
  if (!base) return false
  return !!root.querySelector(`input#${CSS.escape(base)}[type="range"]`)
}

/**
 * Vanilla ± neben `input[type=number]` nicht spiegeln (Park NumberInput hat eigene Pfeile).
 * `.toolbar-stepper` (± / Wert / ±) ist Produkt-UI — wird als eigener Control-Typ gespiegelt.
 */
function isNumberStepperButton(el: HTMLButtonElement): boolean {
  if (el.closest('.toolbar-stepper')) return false
  const group = el.closest('.preset-group, .opening-width-controls, .ui-stepper, .field-stepper')
  if (!group?.querySelector('input[type="number"]')) return false
  const label = cleanText(el.textContent)
  return label === '−' || label === '-' || label === '+' || /^[−+\-]\d/.test(label)
}

function toolbarStepperLabel(root: HTMLElement): string {
  const aria = root.getAttribute('aria-label')
  if (aria) return cleanText(aria)
  const group = root.closest('.toolbar-group, .toolbar-inline-stepper, .ui-field-inline')
  const lab = group?.querySelector(':scope > .toolbar-label, :scope > span.toolbar-label')
  if (lab) return cleanText(lab.textContent)
  return root.id || 'Wert'
}

function toolbarStepperMin(root: HTMLElement): number {
  const el = root.querySelector('.toolbar-stepper-value')
  if (el instanceof HTMLInputElement && el.min !== '') {
    const n = Number(el.min)
    if (Number.isFinite(n)) return n
  }
  if (root.id.includes('muntin')) return 0
  return 1
}

function isInsideAdoptHost(el: Element, section: Element): boolean {
  const host = el.closest('[data-park-adopt]')
  return !!host && host !== el && section.contains(host)
}

function scanControls(section: HTMLElement, root: Element): MirroredControl[] {
  const out: MirroredControl[] = []
  const seen = new Set<string>()

  // Produkt-Stepper (−/Wert/+): bindToolbarStepper ersetzt output→input ohne stabile id am Wert.
  section.querySelectorAll<HTMLElement>('.toolbar-stepper[id]').forEach((stepper) => {
    if (hasHiddenAncestor(stepper, section)) return
    if (isInsideAdoptHost(stepper, section)) return
    const id = stepper.id
    if (!id || seen.has(`stepper:${id}`)) return
    seen.add(`stepper:${id}`)
    out.push({
      kind: 'toolbarStepper',
      key: `stepper:${id}`,
      stepperId: id,
      label: toolbarStepperLabel(stepper),
      min: toolbarStepperMin(stepper),
      max: 99,
      step: 1,
    })
  })

  const candidates = section.querySelectorAll<HTMLElement>(
    'input[type="checkbox"][id], input[type="range"][id], input[type="number"][id], input[type="color"][id], select[id], button.preset-btn[id], .preset-group > button',
  )

  for (const el of candidates) {
    if (hasHiddenAncestor(el, section)) continue
    if (isInsideAdoptHost(el, section)) continue

    if (el instanceof HTMLInputElement) {
      const id = el.id
      if (!id || seen.has(id)) continue

      if (el.type === 'checkbox') {
        seen.add(id)
        out.push({ kind: 'checkbox', key: id, id, label: labelFor(el) })
        continue
      }
      if (el.type === 'range') {
        seen.add(id)
        out.push({
          kind: 'range',
          key: id,
          id,
          label: labelFor(el),
          min: parseNumAttr(el, 'min', 0),
          max: parseNumAttr(el, 'max', 100),
          step: parseNumAttr(el, 'step', 1),
        })
        continue
      }
      if (el.type === 'number') {
        if (isPairedNumInput(id, root)) continue
        // Wert-Feld von .toolbar-stepper — eigener Control-Typ, nicht doppelt als number
        if (el.closest('.toolbar-stepper')) continue
        seen.add(id)
        out.push({
          kind: 'number',
          key: id,
          id,
          label: labelFor(el),
          min: parseNumAttr(el, 'min', -1e9),
          max: parseNumAttr(el, 'max', 1e9),
          step: parseNumAttr(el, 'step', 1),
        })
        continue
      }
      if (el.type === 'color') {
        seen.add(id)
        out.push({ kind: 'color', key: id, id, label: labelFor(el) })
        continue
      }
    }

    if (el instanceof HTMLSelectElement) {
      const id = el.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({
        kind: 'select',
        key: id,
        id,
        label: labelFor(el),
        options: readSelectOptions(el),
      })
      continue
    }

    if (el instanceof HTMLButtonElement) {
      if (isNumberStepperButton(el)) continue

      const toggleGroup = el.closest('.preset-group.scope-toggle')
      if (toggleGroup instanceof HTMLElement && toggleGroup.querySelectorAll('button').length >= 2) {
        const groupKey = toggleGroup.id || ensureMirrorId(toggleGroup)
        if (seen.has(`toggle:${groupKey}`)) continue
        seen.add(`toggle:${groupKey}`)
        const buttons: Extract<MirroredControl, { kind: 'toggleRow' }>['buttons'] = []
        toggleGroup.querySelectorAll('button').forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return
          if (isNumberStepperButton(btn)) return
          if (btn.id) {
            seen.add(btn.id)
            buttons.push({
              id: btn.id,
              label: cleanText(btn.textContent) || btn.id,
            })
          } else {
            const mirrorId = ensureMirrorId(btn)
            seen.add(mirrorId)
            buttons.push({
              mirrorId,
              label: cleanText(btn.textContent) || mirrorId,
            })
          }
        })
        if (buttons.length > 0) {
          out.push({ kind: 'toggleRow', key: `toggle:${groupKey}`, buttons })
        }
        continue
      }

      if (el.id) {
        if (seen.has(el.id)) continue
        seen.add(el.id)
        out.push({
          kind: 'button',
          key: el.id,
          id: el.id,
          label: cleanText(el.textContent) || labelFor(el) || el.id,
        })
        continue
      }
      if (el.closest('.preset-group')) {
        const mirrorId = ensureMirrorId(el)
        if (seen.has(mirrorId)) continue
        seen.add(mirrorId)
        out.push({
          kind: 'buttonEl',
          key: mirrorId,
          mirrorId,
          label: cleanText(el.textContent) || mirrorId,
        })
      }
    }
  }

  return out
}

function controlOrderNode(section: HTMLElement, control: MirroredControl): Element | null {
  if (control.kind === 'toolbarStepper') {
    return section.querySelector(`#${CSS.escape(control.stepperId)}`)
  }
  if (control.kind === 'toggleRow') {
    const first = control.buttons[0]
    if (first?.id) return section.querySelector(`#${CSS.escape(first.id)}`)
    if (first?.mirrorId) {
      return section.querySelector(`[data-park-mirror-id="${CSS.escape(first.mirrorId)}"]`)
    }
    return null
  }
  if (control.kind === 'buttonEl') {
    return section.querySelector(`[data-park-mirror-id="${CSS.escape(control.mirrorId)}"]`)
  }
  if ('id' in control && control.id) {
    return section.querySelector(`#${CSS.escape(control.id)}`)
  }
  return null
}

function scanBlocks(section: HTMLElement, root: Element): MirroredBlock[] {
  const raw: OrderedBlock[] = []
  const seenAdopt = new Set<string>()

  section.querySelectorAll<HTMLElement>('[data-park-adopt]').forEach((host) => {
    if (hasHiddenAncestor(host, section)) return
    // Nur Top-Level-Hosts der Sektion (kein Adopt in Adopt)
    const outer = host.parentElement?.closest('[data-park-adopt]')
    if (outer && section.contains(outer)) return
    const slotId = host.getAttribute('data-park-adopt')?.trim()
    if (!slotId || seenAdopt.has(slotId)) return
    seenAdopt.add(slotId)
    raw.push({
      kind: 'adopt',
      key: `adopt:${slotId}`,
      slotId,
      orderNode: host,
    })
  })

  section.querySelectorAll<HTMLElement>('[data-park-adopt-anchor]').forEach((anchor) => {
    // Anchor selbst darf „unsichtbar“ sein — nur echte Vorfahren prüfen
    if (anchor.parentElement && hasHiddenAncestor(anchor.parentElement, section)) return
    const slotId = anchor.getAttribute('data-park-adopt-anchor')?.trim()
    if (!slotId || seenAdopt.has(slotId)) return
    seenAdopt.add(slotId)
    raw.push({
      kind: 'adopt',
      key: `adopt:${slotId}`,
      slotId,
      orderNode: anchor,
    })
  })

  for (const control of scanControls(section, root)) {
    const orderNode = controlOrderNode(section, control)
    if (!orderNode || hasHiddenAncestor(orderNode, section)) continue
    raw.push({
      kind: 'control',
      key: `ctrl:${control.key}`,
      control,
      orderNode,
    })
  }

  raw.sort((a, b) => {
    if (a.orderNode === b.orderNode) return 0
    const pos = a.orderNode.compareDocumentPosition(b.orderNode)
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })

  return raw.map((item) => {
    if (item.kind === 'adopt') {
      return { kind: 'adopt' as const, key: item.key, slotId: item.slotId }
    }
    return { kind: 'control' as const, key: item.key, control: item.control }
  })
}

function scanSections(rootSelector: string): MirroredSection[] {
  const root = document.querySelector(rootSelector)
  if (!root) return []

  const sections = root.querySelectorAll<HTMLElement>('.settings-section')
  const out: MirroredSection[] = []
  const usedKeys = new Set<string>()

  sections.forEach((section, index) => {
    if (!isSectionVisible(section)) return
    const blocks = scanBlocks(section, root)
    const base =
      section.getAttribute('data-settings-section') || section.id || `section-${index}`
    // Ohne stabile id leere Sektionen weglassen. Mit id behalten — sonst droppen sie
    // kurz während Adopt und resetten openValues (Akkordeon klappt zu).
    if (blocks.length === 0 && !section.id && !section.getAttribute('data-settings-section')) {
      return
    }
    const title = sectionTitle(section)
    let key = base
    if (usedKeys.has(key)) key = `${base}-${index}`
    usedKeys.add(key)
    out.push({
      key,
      title,
      blocks,
    })
  })

  return out
}

function BoundSelect(props: {
  id: string
  label: string
  options: SelectOption[]
  tick: () => number
  bump: () => void
}): JSX.Element {
  const value = () => {
    props.tick()
    return readString(props.id)
  }

  const setValue = (next: string) => {
    writeString(props.id, next)
    props.bump()
  }

  const collection = createMemo(() =>
    createListCollection({
      items: props.options.map((o) => ({ label: o.label, value: o.value })),
    }),
  )

  return (
    <Field.Root>
      <FieldRow label={props.label}>
        <Select.Root
          collection={collection()}
          value={[value()]}
          onValueChange={(d) => {
            const v = d.value[0]
            if (typeof v === 'string') setValue(v)
          }}
          positioning={{ sameWidth: true }}
          size="sm"
          width="auto"
          minW="9rem"
          maxW="14rem"
          flexShrink="0"
        >
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Auswählen…" />
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Trigger>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                <For each={collection().items}>
                  {(item) => (
                    <Select.Item item={item}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                      <Select.ItemIndicator />
                    </Select.Item>
                  )}
                </For>
              </Select.Content>
            </Select.Positioner>
          </Portal>
          <Select.HiddenSelect />
        </Select.Root>
      </FieldRow>
    </Field.Root>
  )
}

function BoundColorButton(props: {
  id: string
  label: string
  tick: () => number
  bump: () => void
}): JSX.Element {
  const hex = () => {
    props.tick()
    return readString(props.id) || '#000000'
  }
  return (
    <Field.Root>
      <FieldRow label={props.label}>
        <HStack gap="2" alignItems="center">
          <Box
            w="1.25rem"
            h="1.25rem"
            borderRadius="l1"
            borderWidth="1px"
            borderColor="border.default"
            style={{ 'background-color': hex() }}
          />
          <Box textStyle="sm" fontFamily="mono" minW="7ch">
            {hex()}
          </Box>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clickId(props.id)
              props.bump()
            }}
          >
            Farbe…
          </Button>
        </HStack>
      </FieldRow>
    </Field.Root>
  )
}

function BoundPresetButton(props: {
  id?: string
  mirrorId?: string
  label: string
  tick: () => number
  bump: () => void
}): JSX.Element {
  const active = () => {
    props.tick()
    if (props.id) return isButtonActive(props.id)
    if (props.mirrorId) {
      const el = document.querySelector(
        `[data-park-mirror-id="${CSS.escape(props.mirrorId)}"]`,
      )
      return (
        !!el?.classList.contains('active') || el?.getAttribute('aria-pressed') === 'true'
      )
    }
    return false
  }

  return (
    <Button
      size="sm"
      variant={active() ? 'solid' : 'outline'}
      alignSelf="flex-start"
      width="auto"
      flexShrink="0"
      onClick={() => {
        if (props.id) clickId(props.id)
        else if (props.mirrorId) {
          ;(
            document.querySelector(
              `[data-park-mirror-id="${CSS.escape(props.mirrorId)}"]`,
            ) as HTMLElement | null
          )?.click()
        }
        props.bump()
      }}
    >
      {props.label}
    </Button>
  )
}

function BoundToggleRow(props: {
  buttons: Array<{ id?: string; mirrorId?: string; label: string }>
  tick: () => number
  bump: () => void
}): JSX.Element {
  return (
    <HStack gap="2" flexWrap="wrap" alignItems="center">
      <For each={props.buttons}>
        {(btn) => (
          <BoundPresetButton
            id={btn.id}
            mirrorId={btn.mirrorId}
            label={btn.label}
            tick={props.tick}
            bump={props.bump}
          />
        )}
      </For>
    </HStack>
  )
}

function readToolbarStepperValue(stepperId: string, fallback: number): number {
  const root = document.getElementById(stepperId)
  const el = root?.querySelector('.toolbar-stepper-value')
  if (el instanceof HTMLInputElement) {
    const n = Number(el.value)
    return Number.isFinite(n) ? Math.round(n) : fallback
  }
  const n = Number(el?.textContent?.trim())
  return Number.isFinite(n) ? Math.round(n) : fallback
}

/** Immer über Vanilla ± — `bindToolbarStepper` ist die Domain-Wahrheit (change allein reicht nicht zuverlässig mit Ark). */
function nudgeToolbarStepper(stepperId: string, delta: number): void {
  const root = document.getElementById(stepperId)
  if (!root) return
  const steps = Math.abs(Math.round(delta))
  if (steps === 0) return
  const btn =
    delta > 0
      ? root.querySelector<HTMLButtonElement>('.toolbar-stepper-inc')
      : root.querySelector<HTMLButtonElement>('.toolbar-stepper-dec')
  for (let i = 0; i < steps; i += 1) btn?.click()
}

function writeToolbarStepperValue(stepperId: string, next: number): void {
  const target = Math.round(next)
  const cur = readToolbarStepperValue(stepperId, target)
  nudgeToolbarStepper(stepperId, target - cur)
}

function BoundToolbarStepper(props: {
  stepperId: string
  label: string
  min: number
  max: number
  step: number
  tick: () => number
  bump: () => void
}): JSX.Element {
  const value = () => {
    props.tick()
    return String(readToolbarStepperValue(props.stepperId, props.min))
  }
  const applyNext = (raw: unknown) => {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n)) return
    writeToolbarStepperValue(props.stepperId, n)
    props.bump()
  }
  /** Ark-Trigger → Vanilla ± (Zag feuert onValueChange nicht zuverlässig bei allen Pointer-Pfaden). */
  const nudge = (dir: 1 | -1) => {
    nudgeToolbarStepper(props.stepperId, dir * props.step)
    props.bump()
  }
  return (
    <Field.Root>
      <FieldRow label={props.label}>
        <NumberInput.Root
          min={props.min}
          max={props.max}
          step={props.step}
          value={value()}
          onValueChange={(d) => {
            const asNum = (d as { valueAsNumber?: number }).valueAsNumber
            if (typeof asNum === 'number' && Number.isFinite(asNum)) {
              applyNext(asNum)
              return
            }
            applyNext(d.value)
          }}
          size="sm"
          width="7rem"
          flexShrink="0"
        >
          <NumberInput.Input />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger
              onClick={(e: MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                nudge(1)
              }}
            />
            <NumberInput.DecrementTrigger
              onClick={(e: MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                nudge(-1)
              }}
            />
          </NumberInput.Control>
        </NumberInput.Root>
      </FieldRow>
    </Field.Root>
  )
}

function MirrorControlView(props: {
  control: MirroredControl
  tick: () => number
  bump: () => void
}): JSX.Element {
  const c = props.control
  switch (c.kind) {
    case 'checkbox':
      return <BoundCheckbox id={c.id} label={c.label} tick={props.tick} bump={props.bump} />
    case 'range':
      return (
        <BoundSliderControl
          def={{
            id: c.id,
            label: c.label,
            min: c.min,
            max: c.max,
            step: c.step,
          }}
          tick={props.tick}
          bump={props.bump}
        />
      )
    case 'number':
      return (
        <BoundNumberField
          id={c.id}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          tick={props.tick}
          bump={props.bump}
        />
      )
    case 'toolbarStepper':
      return (
        <BoundToolbarStepper
          stepperId={c.stepperId}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          tick={props.tick}
          bump={props.bump}
        />
      )
    case 'select':
      return (
        <BoundSelect
          id={c.id}
          label={c.label}
          options={c.options}
          tick={props.tick}
          bump={props.bump}
        />
      )
    case 'color':
      return (
        <BoundColorButton id={c.id} label={c.label} tick={props.tick} bump={props.bump} />
      )
    case 'button':
      return (
        <BoundPresetButton id={c.id} label={c.label} tick={props.tick} bump={props.bump} />
      )
    case 'buttonEl':
      return (
        <BoundPresetButton
          mirrorId={c.mirrorId}
          label={c.label}
          tick={props.tick}
          bump={props.bump}
        />
      )
    case 'toggleRow':
      return <BoundToggleRow buttons={c.buttons} tick={props.tick} bump={props.bump} />
    default:
      return <></>
  }
}

function findAdoptHost(slotId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-park-adopt="${CSS.escape(slotId)}"]`,
  )
}

/** Überlebt Solid-Slot-Clear und AdoptSlot-Remount (Host kann disconnected sein). */
const adoptHostRegistry = new Map<string, HTMLElement>()

function ensureAdoptAnchor(host: HTMLElement, slotId: string): void {
  const existing = document.querySelector(`[data-park-adopt-anchor="${CSS.escape(slotId)}"]`)
  if (existing) return
  const anchor = document.createElement('div')
  // Kein `hidden`/`display:none` — sonst droppt scanBlocks den Anchor (hasHiddenAncestor)
  // sobald der Host im Park-Slot ist → AdoptSlot unmount → Host weg.
  anchor.setAttribute('data-park-adopt-anchor', slotId)
  anchor.setAttribute('aria-hidden', 'true')
  anchor.className = 'park-adopt-anchor'
  host.parentElement?.insertBefore(anchor, host)
}

/**
 * Verschiebt einen Vanilla-`data-park-adopt`-Host in den Park-Slot.
 * Remount-sicher: nur verschieben wenn noch nicht im Slot; Cleanup → Anchor.
 * Registry + placedHost: Solid kann Slot-Kinder clearen (Host disconnected, nicht mehr im document).
 * Cleanup fasst den Host nicht an, wenn ein anderer Slot ihn schon hält (Remount-Race).
 */
function AdoptSlot(props: { slotId: string; tick?: () => number }): JSX.Element {
  let slot!: HTMLDivElement
  let placedHost: HTMLElement | null = null

  const place = () => {
    const host =
      findAdoptHost(props.slotId) ?? adoptHostRegistry.get(props.slotId) ?? placedHost
    if (!host || !slot) return
    if (host.parentElement === slot) {
      placedHost = host
      adoptHostRegistry.set(props.slotId, host)
      return
    }
    ensureAdoptAnchor(host, props.slotId)
    placedHost = host
    adoptHostRegistry.set(props.slotId, host)
    slot.appendChild(host)
  }

  onMount(() => {
    place()
    // Nach Accordion-Open / Layout: nochmal (SVG getScreenCTM)
    requestAnimationFrame(place)
  })

  createEffect(() => {
    props.slotId
    props.tick?.()
    place()
  })

  onCleanup(() => {
    const host = placedHost ?? adoptHostRegistry.get(props.slotId) ?? null
    placedHost = null
    if (!host) return
    // Remount-Race: neuer AdoptSlot hat den Host bereits — nicht zurückholen
    const ownerSlot = host.closest('[data-park-adopt-slot]')
    if (ownerSlot && ownerSlot !== slot) return
    const anchor = document.querySelector(`[data-park-adopt-anchor="${CSS.escape(props.slotId)}"]`)
    if (anchor?.parentElement) {
      anchor.parentElement.insertBefore(host, anchor.nextSibling)
    }
  })

  return (
    <div
      ref={(el) => {
        slot = el
      }}
      class="park-adopt-slot"
      data-park-adopt-slot={props.slotId}
      style={{ 'min-width': '0', width: '100%', 'max-width': '100%' }}
    />
  )
}

function MirrorBlock(props: {
  blockKey: string
  getBlocks: () => MirroredBlock[]
  tick: () => number
  bump: () => void
}): JSX.Element {
  const block = createMemo(() => props.getBlocks().find((b) => b.key === props.blockKey))
  const adoptId = createMemo(() =>
    block()?.kind === 'adopt' ? (block() as Extract<MirroredBlock, { kind: 'adopt' }>).slotId : null,
  )
  const control = createMemo(() =>
    block()?.kind === 'control'
      ? (block() as Extract<MirroredBlock, { kind: 'control' }>).control
      : null,
  )
  return (
    <>
      <Show when={adoptId()}>
        <AdoptSlot slotId={adoptId()!} tick={props.tick} />
      </Show>
      <Show when={control()}>
        <MirrorControlView control={control()!} tick={props.tick} bump={props.bump} />
      </Show>
    </>
  )
}

function FormMirrorSection(props: {
  sectionKey: string
  getSection: () => MirroredSection | undefined
  tick: () => number
  bump: () => void
}): JSX.Element {
  const title = createMemo(() => props.getSection()?.title || props.sectionKey)
  const blockKeys = createMemo(() => props.getSection()?.blocks.map((b) => b.key) ?? [])
  return (
    <Accordion.Item value={props.sectionKey}>
      <Accordion.ItemTrigger>
        {title()}
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody>
          <Stack gap="4" py="2">
            <For each={blockKeys()}>
              {(blockKey) => (
                <MirrorBlock
                  blockKey={blockKey}
                  getBlocks={() => props.getSection()?.blocks ?? []}
                  tick={props.tick}
                  bump={props.bump}
                />
              )}
            </For>
          </Stack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  )
}

/**
 * Spiegelt einen Vanilla-Settings-Root (`.settings-section`) in Park Accordion + Bound-Controls.
 * Scannt auch hidden Legacy-DOM (`.vanilla-legacy-park`).
 * Hybrid: `[data-park-adopt]`-Hosts wandern in Park-Slots (kein Doppel-Mirror).
 */
export function FormMirror(props: FormMirrorProps): JSX.Element {
  const { tick, bump } = useSyncTick(props.subscribe)

  onMount(() => {
    const root = document.querySelector(props.rootSelector)
    if (!root) return
    const mo = new MutationObserver((records) => {
      // Geklebte Sektionsköpfe toggeln class/style jedes Frame. Das würde
      // BoundSelect/NumberInput neu mounten — Dropdowns und Stepper bleiben dann tot.
      const relevant = records.some((record) => {
        if (record.type === 'childList') {
          const nodes = [...record.addedNodes, ...record.removedNodes]
          if (
            nodes.length > 0 &&
            nodes.every(
              (n) =>
                n instanceof Element &&
                (n.hasAttribute('data-park-adopt') ||
                  n.hasAttribute('data-park-adopt-anchor') ||
                  !!n.closest('[data-park-adopt-slot]')),
            )
          ) {
            return false
          }
        }
        const el = record.target
        if (!(el instanceof Element)) return true
        if (
          el.classList.contains('settings-section-head') ||
          el.classList.contains('settings-section-end-spacer') ||
          el.classList.contains('settings-section-head-spacer')
        ) {
          return false
        }
        // Adopt-Host-Inhalte (SVG-Punkte, Schedule-Listen) nicht als Sektions-Rescan werten
        if (el.closest('[data-park-adopt]') || el.closest('[data-park-adopt-slot]')) {
          return false
        }
        // aria-pressed / active-Klasse auf Buttons ändert nicht die Sektionsliste
        if (
          record.type === 'attributes' &&
          (record.attributeName === 'aria-pressed' || record.attributeName === 'disabled')
        ) {
          return false
        }
        if (
          record.type === 'attributes' &&
          record.attributeName === 'class' &&
          (el.matches('button, .preset-btn, .preset-group') ||
            el.classList.contains('settings-section-head-stuck-top') ||
            el.classList.contains('settings-section-head-stuck-bottom') ||
            el.classList.contains('settings-section-head-parked') ||
            el.classList.contains('settings-section-head-active'))
        ) {
          return false
        }
        return true
      })
      if (relevant) bump()
    })
    mo.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['hidden', 'class', 'disabled', 'aria-pressed'],
    })
    onCleanup(() => mo.disconnect())
  })

  const sections = createMemo(() => {
    tick()
    return scanSections(props.rootSelector)
  })

  /**
   * Nur die Menge sichtbarer Sektionen — nicht die Block-Keys darunter.
   * Sonst resetten Adopt/Control-Rescans das Accordion und Sektionen lassen sich nicht öffnen.
   */
  const sectionKeys = createMemo(() => sections().map((s) => s.key))
  const sectionSignature = createMemo(() => sectionKeys().join('|'))
  const [openValues, setOpenValues] = createSignal<string[]>([])
  const [boundSignature, setBoundSignature] = createSignal('')

  createEffect(() => {
    // Nur Signatur tracken — nicht sections()/tick, sonst Race mit jedem MO-Bump.
    const sig = sectionSignature()
    if (!sig) {
      setBoundSignature('')
      return
    }
    if (sig === boundSignature()) return
    setBoundSignature(sig)
    const keys = new Set(sig.split('|').filter(Boolean))
    setOpenValues((prev) => {
      const kept = prev.filter((k) => keys.has(k))
      if (kept.length === prev.length && kept.every((k, i) => k === prev[i])) return prev
      // Keys kurz verschwunden (Adopt-Race): offen halten.
      if (kept.length === 0 && prev.length > 0) return prev
      return kept
    })
  })

  return (
    <Show when={sectionKeys().length > 0} fallback={null}>
      <Accordion.Root
        multiple
        collapsible
        value={openValues()}
        onValueChange={(d) => setOpenValues(d.value)}
      >
        <For each={sectionKeys()}>
          {(sectionKey) => (
            <FormMirrorSection
              sectionKey={sectionKey}
              getSection={() => sections().find((s) => s.key === sectionKey)}
              tick={tick}
              bump={bump}
            />
          )}
        </For>
      </Accordion.Root>
    </Show>
  )
}
