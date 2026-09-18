import { render } from 'solid-js/web'
import { ReleaseNotesIsland } from './islands/ReleaseNotesIsland'
import type { ReleaseNotesModel } from './types'

/**
 * Mountet die Release-Notes-Insel in `host`. Rückgabe: Dispose (unmount).
 */
export function mountReleaseNotesIsland(
  host: HTMLElement,
  model: ReleaseNotesModel,
): () => void {
  host.replaceChildren()
  return render(() => <ReleaseNotesIsland model={model} />, host)
}
