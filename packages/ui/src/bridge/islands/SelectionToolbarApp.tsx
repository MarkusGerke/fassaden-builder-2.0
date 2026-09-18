import type { JSX } from 'solid-js'
import { Box } from 'styled-system/jsx'
import { FormMirror } from './FormMirror'

export type SelectionToolbarAppProps = {
  subscribe?: (listener: () => void) => () => void
}

/**
 * Park-Spiegel der Auswahl-Toolbar (`#selection-toolbar-panels`).
 * Vanilla-Panels bleiben als ID-Quelle (`.vanilla-legacy-park`).
 */
export function SelectionToolbarApp(props: SelectionToolbarAppProps): JSX.Element {
  return (
    <Box
      data-park-selection-toolbar=""
      class="park-selection-toolbar"
      color="fg.default"
      minW="0"
    >
      <FormMirror rootSelector="#selection-toolbar-panels" subscribe={props.subscribe} />
    </Box>
  )
}
