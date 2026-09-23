import { createSignal, onCleanup, onMount } from 'solid-js'
import { Box, Stack } from 'styled-system/jsx'
import { Field, SegmentGroup, Slider } from '@/components/ui'
import { FieldRow } from '@/composites/FieldRow'
import {
  clickId,
  isButtonActive,
  readNumber,
  writeNumber,
  subscribeBus,
} from '../vanillaBind'

export type ChromeExtrasAppProps = {
  syncEvent?: string
}

/**
 * Scope-Bar und Strichstärke — Park.
 */
export function ChromeExtrasApp(props: ChromeExtrasAppProps) {
  const [tick, setTick] = createSignal(0)
  const bump = () => setTick((t) => t + 1)

  onMount(() => {
    const unsub = props.syncEvent
      ? subscribeBus(props.syncEvent, bump)
      : undefined
    onCleanup(() => unsub?.())
  })

  const scope = () => {
    tick()
    if (isButtonActive('edit-scope-type')) return 'type'
    if (isButtonActive('edit-scope-floor')) return 'floor'
    if (isButtonActive('edit-scope-facade')) return 'facade'
    return 'element'
  }

  const stroke = () => {
    tick()
    return readNumber('scene-line-stroke')
  }

  const strokeVisible = () => {
    tick()
    const row = document.getElementById('view-line-stroke-row')
    return !!row && !row.hidden
  }

  const scopeVisible = () => {
    tick()
    const slot = document.getElementById('scope-bar-slot')
    return !!slot && !slot.hidden
  }

  return (
    <Stack gap="2" data-park-chrome-extras="" class="park-chrome-extras" color="fg.default">
      {scopeVisible() ? (
        <SegmentGroup.Root
          value={scope()}
          onValueChange={(d) => {
            if (d.value === 'type') clickId('edit-scope-type')
            else if (d.value === 'floor') clickId('edit-scope-floor')
            else if (d.value === 'facade') clickId('edit-scope-facade')
            else clickId('edit-scope-element')
            bump()
          }}
        >
          <SegmentGroup.Items
            items={[
              { value: 'element', label: 'Auswahl' },
              { value: 'type', label: 'Typ' },
              { value: 'floor', label: 'Etage' },
              { value: 'facade', label: 'Fassade' },
            ]}
          />
          <SegmentGroup.Indicator />
        </SegmentGroup.Root>
      ) : null}

      {strokeVisible() ? (
        <Field.Root maxW="14rem">
          <FieldRow label="Strichstärke">
            <Box textStyle="sm" color="fg.muted" minW="4ch" textAlign="right">
              {stroke().toFixed(2)}
            </Box>
          </FieldRow>
          <Slider.Root
            min={0.25}
            max={3}
            step={0.05}
            value={[stroke()]}
            onValueChange={(d) => {
              const v = d.value[0]
              if (typeof v === 'number') writeNumber('scene-line-stroke', v)
              bump()
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
      ) : null}
    </Stack>
  )
}
