import { createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Box } from 'styled-system/jsx'
import { Checkbox, Field, NumberInput, Slider } from '@/components/ui'
import { FieldRow } from '@/composites/FieldRow'
import {
  readChecked,
  readDisabled,
  readNumber,
  writeChecked,
  writeNumber,
} from '../vanillaBind'

export type BoundSliderDef = {
  id: string
  label: string
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export function useSyncTick(subscribe?: (listener: () => void) => () => void) {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const unsub = subscribe?.(() => setTick((t) => t + 1))
    if (unsub) onCleanup(unsub)
  })
  return { tick, bump: () => setTick((t) => t + 1) }
}

export function BoundSliderControl(props: {
  def: BoundSliderDef
  tick: () => number
  bump: () => void
}): JSX.Element {
  const value = () => {
    props.tick()
    return readNumber(props.def.id)
  }
  const label = () =>
    props.def.format ? props.def.format(value()) : String(value())

  return (
    <Field.Root>
      <FieldRow label={props.def.label}>
        <Box textStyle="sm" color="fg.muted" minW="4ch" textAlign="right">
          {label()}
        </Box>
      </FieldRow>
      <Slider.Root
        min={props.def.min}
        max={props.def.max}
        step={props.def.step}
        value={[value()]}
        onValueChange={(d) => {
          const v = d.value[0]
          if (typeof v === 'number') writeNumber(props.def.id, v)
          props.bump()
        }}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
    </Field.Root>
  )
}

export function BoundCheckbox(props: {
  id: string
  label: string
  tick: () => number
  bump: () => void
}): JSX.Element {
  const checked = () => {
    props.tick()
    return readChecked(props.id)
  }
  return (
    <Checkbox.Root
      checked={checked()}
      onCheckedChange={(d) => {
        writeChecked(props.id, !!d.checked)
        props.bump()
      }}
      alignSelf="flex-start"
      w="fit-content"
      maxW="full"
      justifyContent="flex-start"
    >
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Label textAlign="start">{props.label}</Checkbox.Label>
      <Checkbox.HiddenInput />
    </Checkbox.Root>
  )
}

export function BoundNumberField(props: {
  id: string
  label: string
  min: number
  max: number
  step: number
  tick: () => number
  bump: () => void
}): JSX.Element {
  const value = () => {
    props.tick()
    return String(readNumber(props.id))
  }
  const disabled = () => {
    props.tick()
    return readDisabled(props.id)
  }
  return (
    <Field.Root>
      <FieldRow label={props.label}>
        <NumberInput.Root
          min={props.min}
          max={props.max}
          step={props.step}
          value={value()}
          disabled={disabled()}
          onValueChange={(d) => {
            const raw = d.value
            const n = typeof raw === 'string' ? Number(raw) : Number(raw)
            if (!Number.isFinite(n)) return
            writeNumber(props.id, n)
            props.bump()
          }}
          size="sm"
          width="7rem"
          flexShrink="0"
        >
          <NumberInput.Input />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
        </NumberInput.Root>
      </FieldRow>
    </Field.Root>
  )
}
