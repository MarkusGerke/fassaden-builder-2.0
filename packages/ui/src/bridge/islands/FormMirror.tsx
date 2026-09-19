import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createListCollection } from '@ark-ui/solid/select'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Accordion, Button, Field, Select } from '@/components/ui'
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
  | { kind: 'select'; key: string; id: string; label: string; options: SelectOption[] }
  | { kind: 'color'; key: string; id: string; label: string }
  | { kind: 'button'; key: string; id: string; label: string }
  | { kind: 'buttonEl'; key: string; mirrorId: string; label: string }
  | {
      kind: 'toggleRow'
      key: string
      buttons: Array<{ id?: string; mirrorId?: string; label: string }>
    }

type MirroredSection = {
  key: string
  title: string
  controls: MirroredControl[]
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

/** Vanilla-Stepper (− / Zahl / +): Park NumberInput hat eigene Pfeile — Buttons nicht spiegeln. */
function isNumberStepperButton(el: HTMLButtonElement): boolean {
  const group = el.closest('.preset-group, .opening-width-controls, .ui-stepper, .field-stepper')
  if (group?.querySelector('input[type="number"]')) return true
  const label = cleanText(el.textContent)
  return label === '−' || label === '-' || label === '+' || /^[−+\-]\d/.test(label)
}

function scanControls(section: HTMLElement, root: Element): MirroredControl[] {
  const out: MirroredControl[] = []
  const seen = new Set<string>()

  const candidates = section.querySelectorAll<HTMLElement>(
    'input[type="checkbox"][id], input[type="range"][id], input[type="number"][id], input[type="color"][id], select[id], button.preset-btn[id], .preset-group > button',
  )

  for (const el of candidates) {
    if (hasHiddenAncestor(el, section)) continue

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

function scanSections(rootSelector: string): MirroredSection[] {
  const root = document.querySelector(rootSelector)
  if (!root) return []

  const sections = root.querySelectorAll<HTMLElement>('.settings-section')
  const out: MirroredSection[] = []

  sections.forEach((section, index) => {
    if (!isSectionVisible(section)) return
    const controls = scanControls(section, root)
    // Leere Sektionen (keine sichtbaren Controls) nicht als Akkordeon spiegeln
    if (controls.length === 0) return
    const title = sectionTitle(section)
    const key =
      section.getAttribute('data-settings-section') || section.id || `section-${index}`
    out.push({
      key: `${key}-${index}`,
      title,
      controls,
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

/**
 * Spiegelt einen Vanilla-Settings-Root (`.settings-section`) in Park Accordion + Bound-Controls.
 * Scannt auch hidden Legacy-DOM (`.vanilla-legacy-park`).
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
        const el = record.target
        if (!(el instanceof Element)) return true
        if (
          el.classList.contains('settings-section-head') ||
          el.classList.contains('settings-section-end-spacer')
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

  /** Nur bei neuem Sektions-Set zurücksetzen — nicht bei jedem MutationObserver-Tick (sonst lässt sich Maße nicht schließen). */
  const sectionSignature = createMemo(() => sections().map((s) => s.key).join('|'))
  const [openValues, setOpenValues] = createSignal<string[]>([])
  const [boundSignature, setBoundSignature] = createSignal('')

  createEffect(() => {
    const sig = sectionSignature()
    const list = sections()
    if (!sig || sig === boundSignature()) return
    setBoundSignature(sig)
    const preferred =
      list.find((s) => /maße|measures|dimensions/i.test(`${s.title} ${s.key}`)) ?? list[0]
    setOpenValues(preferred ? [preferred.key] : [])
  })

  return (
    <Show when={sections().length > 0} fallback={null}>
      <Accordion.Root
        multiple
        collapsible
        value={openValues()}
        onValueChange={(d) => setOpenValues(d.value)}
      >
        <For each={sections()}>
          {(section) => (
            <Accordion.Item value={section.key}>
              <Accordion.ItemTrigger>
                {section.title}
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Stack gap="4" py="2">
                    <For each={section.controls}>
                      {(control) => (
                        <MirrorControlView control={control} tick={tick} bump={bump} />
                      )}
                    </For>
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          )}
        </For>
      </Accordion.Root>
    </Show>
  )
}
