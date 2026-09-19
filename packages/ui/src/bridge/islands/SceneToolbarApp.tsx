import { For, Show } from 'solid-js'
import { Box, Stack, HStack } from 'styled-system/jsx'
import { Accordion, Button, Field, Input } from '@/components/ui'
import { ConditionalReveal } from '@/composites/ConditionalReveal'
import {
  BoundCheckbox,
  BoundNumberField,
  BoundSliderControl,
  useSyncTick,
  type BoundSliderDef,
} from './BoundControls'
import {
  clickId,
  readChecked,
  readString,
  writeString,
} from '../vanillaBind'

export type SceneToolbarAppProps = {
  subscribe?: (listener: () => void) => () => void
  /** Ohne Objektauswahl: Zufallsmodus oben in der rechten Leiste. */
  showArrivieren?: boolean
  /** Dach gewählt: Licht & Schatten gehört nicht in diese Leiste. */
  hideSun?: boolean
}

const SUN_SLIDERS: BoundSliderDef[] = [
  {
    id: 'sun-time',
    label: 'Tageszeit',
    min: 0,
    max: 23.9833333333,
    step: 0.0166666667,
    format: (v) => {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    },
  },
  {
    id: 'sun-azimuth',
    label: 'Sonnenwinkel (Himmelsrichtung)',
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
  },
  {
    id: 'sun-elevation',
    label: 'Sonnenwinkel (Höhe)',
    min: -12,
    max: 70,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: 'sun-intensity',
    label: 'Sonnenlicht',
    min: 0.3,
    max: 8,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  {
    id: 'sun-ambient',
    label: 'Umgebungslicht',
    min: 0.05,
    max: 1.2,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-shadow-contrast',
    label: 'Schatten-Kontrast',
    min: 0.5,
    max: 10,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-shade-depth',
    label: 'Schatten-Tiefe (Fassade & Innen)',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'sun-softness',
    label: 'Schatten-Weichheit',
    min: 0.5,
    max: 8,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
  {
    id: 'sun-color-temp',
    label: 'Farbtemperatur',
    min: 2700,
    max: 8000,
    step: 100,
    format: (v) => `${Math.round(v)} K`,
  },
]

const BLOOM_SLIDERS: BoundSliderDef[] = [
  {
    id: 'bloom-threshold',
    label: 'Schwelle',
    min: 0,
    max: 1.2,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    id: 'bloom-strength',
    label: 'Stärke',
    min: 0,
    max: 1.5,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    id: 'bloom-radius',
    label: 'Radius',
    min: 0,
    max: 1,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    id: 'bloom-exposure',
    label: 'Belichtung',
    min: 0.75,
    max: 1.45,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
]

const WIND_SLIDER: BoundSliderDef = {
  id: 'scene-wind-intensity',
  label: 'Windintensität',
  min: 0,
  max: 1,
  step: 0.01,
  format: (v) => v.toFixed(2),
}

const LOD_SLIDERS: BoundSliderDef[] = [
  {
    id: 'lod-tile-high',
    label: 'Volle Ziegel ab (px)',
    min: 0.5,
    max: 32,
    step: 0.5,
    format: (v) => String(v),
  },
  {
    id: 'lod-tile-medium',
    label: 'Vereinfachte Fassade ab (px)',
    min: 0.1,
    max: 16,
    step: 0.1,
    format: (v) => String(v),
  },
  {
    id: 'lod-building-far',
    label: 'Nur Silhouette unter (px)',
    min: 5,
    max: 120,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
]

const PUDDLE_SLIDERS: BoundSliderDef[] = [
  {
    id: 'ground-puddles-count',
    label: 'Dichte',
    min: 1,
    max: 8,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
  {
    id: 'ground-puddles-size',
    label: 'Pfützengröße',
    min: 0.35,
    max: 2.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'ground-puddles-spread',
    label: 'Zone ums Haus',
    min: 0.4,
    max: 2.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'ground-puddles-strength',
    label: 'Spiegelung',
    min: 0.15,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
]

const FOG_SLIDERS_LINEAR: BoundSliderDef[] = [
  {
    id: 'fog-near',
    label: 'Near (cm)',
    min: 1,
    max: 5000,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
  {
    id: 'fog-far',
    label: 'Far (cm)',
    min: 10,
    max: 10000,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
]

const FOG_SLIDER_EXP: BoundSliderDef = {
  id: 'fog-density',
  label: 'Dichte',
  min: 0.00001,
  max: 0.05,
  step: 0.000001,
  format: (v) => v.toFixed(6),
}

function Section(props: {
  value: string
  title: string
  children: any
}) {
  return (
    <Accordion.Item value={props.value}>
      <Accordion.ItemTrigger>
        {props.title}
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody>
          <Stack gap="4" py="2">
            {props.children}
          </Stack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  )
}

/**
 * Vollständige Park-Szene-Leiste (Hard-Cutover). Vanilla-Inputs bleiben hidden gekoppelt.
 */
export function SceneToolbarApp(props: SceneToolbarAppProps) {
  const { tick, bump } = useSyncTick(props.subscribe)

  const bloomOn = () => {
    tick()
    return readChecked('bloom-enabled')
  }
  const lodOn = () => {
    tick()
    return readChecked('lod-enabled')
  }
  const puddlesOn = () => {
    tick()
    return readChecked('ground-puddles-enabled')
  }
  const fogOn = () => {
    tick()
    return readChecked('fog-enabled')
  }
  const fogType = () => {
    tick()
    return readString('fog-type') || 'linear'
  }
  const sunDate = () => {
    tick()
    return readString('sun-date')
  }
  const animMode = () => {
    tick()
    const time = document.getElementById('sun-anim-mode-time') as HTMLInputElement | null
    return time?.checked ? 'time' : 'light'
  }

  return (
    <Box data-park-scene-toolbar="" class="park-scene-toolbar" color="fg.default" minW="0">
      <Accordion.Root
        multiple
        defaultValue={props.showArrivieren ? ['arrivieren', 'sun', 'bloom', 'anim', 'scene'] : ['sun', 'bloom', 'anim', 'scene']}
        collapsible
      >
        <Show when={props.showArrivieren}>
          <Section value="arrivieren" title="Zufallsmodus">
            <Field.Root>
              <Field.Label>Seed</Field.Label>
              <HStack gap="2">
                <Input
                  size="sm"
                  inputMode="numeric"
                  placeholder="leer = Zufall"
                  value={readString('arrivieren-seed')}
                  onInput={(e) => {
                    writeString('arrivieren-seed', e.currentTarget.value)
                    bump()
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => clickId('arrivieren-seed-random')}>
                  Zufall
                </Button>
              </HStack>
            </Field.Root>
            <Button size="sm" onClick={() => clickId('arrivieren-generate')}>
              Generieren
            </Button>
            <Box textStyle="sm" color="fg.muted">
              {(tick(), document.getElementById('arrivieren-snapshot')?.textContent ?? '')}
            </Box>
            <BoundCheckbox
              id="arrivieren-schematic-toggle"
              label="SVG-Schematik"
              tick={tick}
              bump={bump}
            />
          </Section>
        </Show>
        <Show when={!props.hideSun}>
        <Section value="sun" title="Licht & Schatten">
          <Field.Root>
            <Field.Label>Datum (Berlin)</Field.Label>
            <Input
              type="date"
              size="sm"
              value={sunDate()}
              onInput={(e) => {
                writeString('sun-date', e.currentTarget.value)
                bump()
              }}
            />
          </Field.Root>
          <For each={SUN_SLIDERS}>
            {(def) => <BoundSliderControl def={def} tick={tick} bump={bump} />}
          </For>
        </Section>
        </Show>

        <Section value="lamps" title="Lampen & Leuchten">
          <BoundCheckbox
            id="view-all-scene-lights"
            label="Alle Lichter an"
            tick={tick}
            bump={bump}
          />
          <BoundCheckbox
            id="view-show-light-markers"
            label="Lichtpunkte anzeigen"
            tick={tick}
            bump={bump}
          />
        </Section>

        <Section value="bloom" title="Schein">
          <BoundCheckbox id="bloom-enabled" label="Schein an" tick={tick} bump={bump} />
          <ConditionalReveal when={bloomOn()}>
            <Stack gap="4">
              <BoundCheckbox
                id="bloom-disable-during-motion"
                label="Schein bei Kamerabewegung aus"
                tick={tick}
                bump={bump}
              />
              <For each={BLOOM_SLIDERS}>
                {(def) => <BoundSliderControl def={def} tick={tick} bump={bump} />}
              </For>
            </Stack>
          </ConditionalReveal>
        </Section>

        <Section value="anim" title="Animation">
          <BoundCheckbox
            id="anim-paused"
            label="Animationen pausieren"
            tick={tick}
            bump={bump}
          />
          <BoundCheckbox id="anim-day-cycle" label="Tageszyklus" tick={tick} bump={bump} />
          <BoundNumberField
            id="anim-day-cycle-minutes"
            label="Tagesdauer (Min.)"
            min={1}
            max={1440}
            step={1}
            tick={tick}
            bump={bump}
          />
          <BoundCheckbox
            id="anim-auto-lights"
            label="Lichter mit Sonne"
            tick={tick}
            bump={bump}
          />
          <BoundSliderControl def={WIND_SLIDER} tick={tick} bump={bump} />

          <Box fontWeight="semibold" textStyle="sm">
            Szene abspielen
          </Box>
          <HStack gap="2" flexWrap="wrap">
            <Button
              size="sm"
              variant={animMode() === 'time' ? 'solid' : 'outline'}
              onClick={() => {
                clickId('sun-anim-mode-time')
                bump()
              }}
            >
              Tagesverlauf
            </Button>
            <Button
              size="sm"
              variant={animMode() === 'light' ? 'solid' : 'outline'}
              onClick={() => {
                clickId('sun-anim-mode-light')
                bump()
              }}
            >
              Licht
            </Button>
          </HStack>
          <BoundNumberField
            id="sun-anim-duration"
            label="Dauer (s)"
            min={5}
            max={120}
            step={1}
            tick={tick}
            bump={bump}
          />
          <HStack gap="2">
            <Button size="sm" onClick={() => clickId('sun-path-play')}>
              Abspielen
            </Button>
            <Button size="sm" variant="outline" onClick={() => clickId('sun-path-stop')}>
              Stop
            </Button>
          </HStack>
        </Section>

        <Section value="scene" title="Szene">
          <BoundCheckbox
            id="lod-enabled"
            label="Automatische Detail-Reduktion"
            tick={tick}
            bump={bump}
          />
          <ConditionalReveal when={lodOn()}>
            <Stack gap="4">
              <HStack gap="2" flexWrap="wrap">
                <Button size="sm" variant="outline" onClick={() => clickId('lod-preset-navigation')}>
                  Navigation
                </Button>
                <Button size="sm" variant="outline" onClick={() => clickId('lod-preset-balanced')}>
                  Ausgewogen
                </Button>
                <Button size="sm" variant="outline" onClick={() => clickId('lod-preset-quality')}>
                  Alle Details
                </Button>
              </HStack>
              <For each={LOD_SLIDERS}>
                {(def) => <BoundSliderControl def={def} tick={tick} bump={bump} />}
              </For>
              <BoundCheckbox
                id="lod-simplify-facade"
                label="Fassaden-Muster (Farben bleiben)"
                tick={tick}
                bump={bump}
              />
              <BoundCheckbox
                id="lod-simplify-windows"
                label="Fenster & Türen"
                tick={tick}
                bump={bump}
              />
              <BoundCheckbox
                id="lod-simplify-profiles"
                label="Profile & Gesimse"
                tick={tick}
                bump={bump}
              />
              <BoundCheckbox
                id="lod-simplify-reveals"
                label="Leibungen"
                tick={tick}
                bump={bump}
              />
              <BoundCheckbox
                id="lod-simplify-far-hull"
                label="Haus-Silhouette (Box)"
                tick={tick}
                bump={bump}
              />
              <Button size="sm" variant="subtle" onClick={() => clickId('lod-force-high')}>
                Alle Details jetzt laden
              </Button>
            </Stack>
          </ConditionalReveal>

          <BoundCheckbox
            id="ground-puddles-enabled"
            label="Pfützen (Fassaden-Spiegelung)"
            tick={tick}
            bump={bump}
          />
          <ConditionalReveal when={puddlesOn()}>
            <Stack gap="4">
              <For each={PUDDLE_SLIDERS}>
                {(def) => <BoundSliderControl def={def} tick={tick} bump={bump} />}
              </For>
            </Stack>
          </ConditionalReveal>

          <BoundCheckbox id="fog-enabled" label="Nebel an" tick={tick} bump={bump} />
          <ConditionalReveal when={fogOn()}>
            <Stack gap="4">
              <HStack gap="2">
                <Button
                  size="sm"
                  variant={fogType() === 'linear' ? 'solid' : 'outline'}
                  onClick={() => {
                    writeString('fog-type', 'linear')
                    bump()
                  }}
                >
                  Linear
                </Button>
                <Button
                  size="sm"
                  variant={fogType() === 'exponential' ? 'solid' : 'outline'}
                  onClick={() => {
                    writeString('fog-type', 'exponential')
                    bump()
                  }}
                >
                  Exponentiell
                </Button>
              </HStack>
              <Show when={fogType() === 'linear'}>
                <For each={FOG_SLIDERS_LINEAR}>
                  {(def) => <BoundSliderControl def={def} tick={tick} bump={bump} />}
                </For>
              </Show>
              <Show when={fogType() === 'exponential'}>
                <BoundSliderControl def={FOG_SLIDER_EXP} tick={tick} bump={bump} />
              </Show>
            </Stack>
          </ConditionalReveal>
        </Section>

        <Section value="debug" title="Debug">
          <BoundCheckbox
            id="perf-overlay-enabled"
            label="FPS / Draw Calls / Dreiecke"
            tick={tick}
            bump={bump}
          />
        </Section>
      </Accordion.Root>
    </Box>
  )
}
