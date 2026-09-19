import { render } from 'solid-js/web'
import {
  FileMenuIsland,
  ViewModeIsland,
  type FileMenuAction,
  type ViewModeItem,
} from './islands/ChromeIslands'

export type { FileMenuAction, ViewModeItem }

export function mountFileMenuIsland(
  host: HTMLElement,
  onAction: (action: FileMenuAction) => void,
): () => void {
  host.replaceChildren()
  return render(() => <FileMenuIsland onAction={onAction} />, host)
}

export function mountViewModeIsland(
  host: HTMLElement,
  opts: {
    getValue: () => string
    onValueChange: (value: string) => void
    items: ViewModeItem[]
    subscribe?: (listener: (value: string) => void) => () => void
  },
): () => void {
  host.replaceChildren()
  return render(
    () => (
      <ViewModeIsland
        getValue={opts.getValue}
        onValueChange={opts.onValueChange}
        items={opts.items}
        subscribe={opts.subscribe}
      />
    ),
    host,
  )
}
