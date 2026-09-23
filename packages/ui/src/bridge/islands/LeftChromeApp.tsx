import { Box, HStack, Stack } from 'styled-system/jsx'
import { Button } from '@/components/ui'
import { FileMenuIsland, type FileMenuAction } from './ChromeIslands'
import { LayersTreeApp } from './LayersTreeApp'
import { clickId } from '../vanillaBind'

export type LeftChromeAppProps = {
  versionLabel: string
  onFileAction: (action: FileMenuAction) => void
  /** Host-Node für Release-Notes-Insel (wird hierher verschoben). */
  releaseHostId?: string
  /** Vanilla `#layer-list` — Sync-Quelle für TreeView (bleibt `.vanilla-legacy-park`). */
  layerListId?: string
  creditsButtonId?: string
  layersVisible?: () => boolean
  subscribeLayers?: (listener: () => void) => () => void
}

/**
 * Linke Spalte: Titel + Datei in einer Zeile, Version/Quellen, Ebenen ohne Card-Box.
 */
export function LeftChromeApp(props: LeftChromeAppProps) {
  const attachRelease = (el: HTMLDivElement) => {
    if (!props.releaseHostId) return
    const host = document.getElementById(props.releaseHostId)
    if (host && host.parentElement !== el) el.appendChild(host)
  }

  return (
    <Stack gap="4" data-park-left-chrome="" class="park-left-chrome" color="fg.default" p="4">
      <Stack gap="2">
        <HStack gap="3" alignItems="center" justify="space-between" flexWrap="wrap">
          <Box fontSize="xl" fontWeight="bold" letterSpacing="tight" minW="0">
            Fassaden-Builder 2.0
          </Box>
          <FileMenuIsland
            onAction={props.onFileAction}
            layersVisible={props.layersVisible}
            subscribeLayers={props.subscribeLayers}
          />
        </HStack>
        <HStack gap="2" alignItems="center" flexWrap="wrap">
          <div ref={attachRelease} class="park-release-slot" />
          <Button
            size="xs"
            variant="plain"
            onClick={() => clickId(props.creditsButtonId ?? 'app-credits-btn')}
          >
            Quellen
          </Button>
        </HStack>
      </Stack>

      <LayersTreeApp layerListId={props.layerListId ?? 'layer-list'} />
    </Stack>
  )
}
