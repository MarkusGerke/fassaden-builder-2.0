import { createSignal, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Button, Menu, SegmentGroup } from '@/components/ui'

export type FileMenuAction = 'export' | 'import' | 'link' | 'showcase' | 'layers' | 'tour'

export type FileMenuIslandProps = {
  onAction: (action: FileMenuAction) => void
  /** Ebenen gerade sichtbar? Für Menütext. */
  layersVisible?: () => boolean
  subscribeLayers?: (listener: () => void) => () => void
}

/** Park Menu — ersetzt Vanilla `<details class="file-menu">`. */
export function FileMenuIsland(props: FileMenuIslandProps) {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const unsub = props.subscribeLayers?.(() => setTick((t) => t + 1))
    if (unsub) onCleanup(unsub)
  })

  const layersLabel = () => {
    tick()
    const visible = props.layersVisible?.() ?? false
    return visible ? 'Ebenen ausblenden' : 'Ebenen einblenden'
  }

  return (
    <Menu.Root
      onSelect={(d) => {
        const v = d.value as FileMenuAction | undefined
        if (v) props.onAction(v)
      }}
    >
      <Menu.Trigger
        asChild={(p) => (
          <Button variant="outline" size="sm" {...p()}>
            Datei <Menu.Indicator />
          </Button>
        )}
      />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="export">Exportieren als .json</Menu.Item>
            <Menu.Item value="import">Importieren einer .json</Menu.Item>
            <Menu.Separator />
            <Menu.Item value="link">Link kopieren</Menu.Item>
            <Menu.Item value="showcase">Showcase-Link kopieren</Menu.Item>
            <Menu.Separator />
            <Menu.Item value="layers">{layersLabel()}</Menu.Item>
            <Menu.Item value="tour">Einführungstour</Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

export type ViewModeItem = { value: string; label: string }

export type ViewModeIslandProps = {
  /** Aktuelle Ansicht (`front` | `present` | `3d` | `export` | …). */
  getValue: () => string
  onValueChange: (value: string) => void
  items: ViewModeItem[]
  /** App feuert bei setView — hält Segment synchron. */
  subscribe?: (listener: (value: string) => void) => () => void
}

/** Park SegmentGroup — ersetzt Vanilla Ansicht-Toggle (2D/Fassade/3D/Export). */
export function ViewModeIsland(props: ViewModeIslandProps) {
  const [value, setValue] = createSignal(props.getValue())

  onMount(() => {
    const unsub = props.subscribe?.((v) => setValue(v))
    if (unsub) onCleanup(unsub)
  })

  return (
    <SegmentGroup.Root
      value={value()}
      onValueChange={(d) => {
        if (!d.value) return
        setValue(d.value)
        props.onValueChange(d.value)
      }}
    >
      <SegmentGroup.Items items={props.items} />
      <SegmentGroup.Indicator />
    </SegmentGroup.Root>
  )
}
