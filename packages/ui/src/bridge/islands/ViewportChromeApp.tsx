import { For, createSignal, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import { HStack, Stack } from 'styled-system/jsx'
import { Button, Menu } from '@/components/ui'
import { clickId, isButtonActive, subscribeBus } from '../vanillaBind'

export type ViewportChromeAppProps = {
  getView: () => string
  setView: (view: string) => void
  subscribeView?: (listener: (value: string) => void) => () => void
  /** Bus zum Refresh aktiver Buttons (Farbe/Render/Umgebung). */
  syncEvent?: string
}

type MenuOption = { value: string; label: string }

function ChromeMenu(props: {
  label: string
  value: string
  options: MenuOption[]
  onPick: (value: string) => void
}) {
  const current = () =>
    props.options.find((o) => o.value === props.value)?.label ?? props.label

  return (
    <Menu.Root
      onSelect={(d) => {
        if (d.value) props.onPick(d.value)
      }}
    >
      <Menu.Trigger
        asChild={(p) => (
          <Button variant="surface" size="sm" bg="white" {...p()}>
            {current()} <Menu.Indicator />
          </Button>
        )}
      />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <For each={props.options}>
              {(opt) => <Menu.Item value={opt.value}>{opt.label}</Menu.Item>}
            </For>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/**
 * Park-Viewport-Chrome: Ansicht / Darstellung / Präsentation / Umgebung als Ark Menu.
 */
export function ViewportChromeApp(props: ViewportChromeAppProps) {
  const [view, setView] = createSignal(props.getView())
  const [tick, setTick] = createSignal(0)
  const bump = () => setTick((t) => t + 1)

  onMount(() => {
    const unsubView = props.subscribeView?.((v) => setView(v))
    const unsubSync = props.syncEvent ? subscribeBus(props.syncEvent, bump) : undefined
    onCleanup(() => {
      unsubView?.()
      unsubSync?.()
    })
  })

  const colorMode = () => {
    tick()
    return isButtonActive('view-btn-line') ? 'line' : 'color'
  }
  const presentation = () => {
    tick()
    if (isButtonActive('light-presentation-btn')) return 'draft'
    if (isButtonActive('edit-presentation-btn')) return 'preview'
    return 'render'
  }
  const stageEnv = () => {
    tick()
    return isButtonActive('stage-env-studio-btn') ? 'studio' : 'sky'
  }
  const lightMode = () => {
    tick()
    return isButtonActive('light-mode-btn')
  }

  return (
    <Stack gap="2" data-park-viewport-chrome="" class="park-viewport-chrome" color="fg.default">
      <HStack gap="2" flexWrap="wrap" alignItems="center">
        <ChromeMenu
          label="Ansicht"
          value={view()}
          options={[
            { value: 'front', label: '2D' },
            { value: 'present', label: 'Fassade' },
            { value: '3d', label: '3D' },
            { value: 'export', label: 'Export' },
          ]}
          onPick={(v) => {
            setView(v)
            props.setView(v)
          }}
        />

        <ChromeMenu
          label="Darstellung"
          value={colorMode()}
          options={[
            { value: 'color', label: 'Farbe' },
            { value: 'line', label: 'Zeichnung' },
          ]}
          onPick={(v) => {
            if (v === 'line') clickId('view-btn-line')
            else clickId('view-btn-color')
            bump()
          }}
        />

        <ChromeMenu
          label="Präsentation"
          value={presentation()}
          options={[
            { value: 'draft', label: 'Entwurf' },
            { value: 'preview', label: 'Vorschau' },
            { value: 'render', label: 'Render' },
          ]}
          onPick={(v) => {
            if (v === 'draft') clickId('light-presentation-btn')
            else if (v === 'preview') clickId('edit-presentation-btn')
            else clickId('render-presentation-btn')
            bump()
          }}
        />

        <ChromeMenu
          label="Umgebung"
          value={stageEnv()}
          options={[
            { value: 'sky', label: 'Himmel' },
            { value: 'studio', label: 'Neutral' },
          ]}
          onPick={(v) => {
            if (v === 'studio') clickId('stage-env-studio-btn')
            else clickId('stage-env-sky-btn')
            bump()
          }}
        />

        <Button
          size="sm"
          variant={lightMode() ? 'solid' : 'surface'}
          bg={lightMode() ? undefined : 'white'}
          onClick={() => {
            clickId('light-mode-btn')
            bump()
          }}
        >
          Licht
        </Button>

        <Button
          size="sm"
          variant="surface"
          bg="white"
          title="Zufällige Fassade"
          aria-label="Zufällige Fassade"
          onClick={() => clickId('arrivieren-viewport-random')}
        >
          Zufall
        </Button>
      </HStack>
    </Stack>
  )
}
