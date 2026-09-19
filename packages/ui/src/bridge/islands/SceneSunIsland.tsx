import { For, createSignal, onCleanup, onMount } from 'solid-js'
import { Box, Stack } from 'styled-system/jsx'
import { Field, Slider } from '@/components/ui'
import { FieldRow } from '@/composites/FieldRow'

export type BoundSlider = {
  id: string
  label: string
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export type SceneSunIslandProps = {
  sliders: BoundSlider[]
  /** Liest aktuellen Wert aus dem Vanilla-Input. */
  readValue: (id: string) => number
  /** Schreibt Wert zurück (inkl. input-Event für main.ts). */
  writeValue: (id: string, value: number) => void
  /** App pusht nach Sync — Insel aktualisieren. */
  subscribe?: (listener: () => void) => () => void
}

/**
 * Park-UI für Szene „Licht & Schatten / Sonne“ — Werte bleiben an Vanilla-Input-IDs gekoppelt.
 */
export function SceneSunIsland(props: SceneSunIslandProps) {
  const [tick, setTick] = createSignal(0)

  onMount(() => {
    const unsub = props.subscribe?.(() => setTick((t) => t + 1))
    if (unsub) onCleanup(unsub)
  })

  return (
    <Stack gap="4" data-park-scene-sun="" class="park-scene-sun">
      <Box fontWeight="semibold" textStyle="sm" color="fg.default">
        Sonne (Park / Ark)
      </Box>
      <For each={props.sliders}>
        {(s) => {
          const value = () => {
            tick()
            return props.readValue(s.id)
          }
          const label = () => (s.format ? s.format(value()) : String(value()))
          return (
            <Field.Root>
              <FieldRow label={`${s.label}`}>
                <Box textStyle="sm" color="fg.muted" minW="4ch" textAlign="right">
                  {label()}
                </Box>
              </FieldRow>
              <Slider.Root
                min={s.min}
                max={s.max}
                step={s.step}
                value={[value()]}
                onValueChange={(d) => {
                  const v = d.value[0]
                  if (typeof v === 'number') props.writeValue(s.id, v)
                  setTick((t) => t + 1)
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
        }}
      </For>
    </Stack>
  )
}
