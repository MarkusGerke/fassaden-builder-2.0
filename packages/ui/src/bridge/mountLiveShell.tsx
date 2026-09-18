import { render } from 'solid-js/web'
import { SceneToolbarApp, type SceneToolbarAppProps } from './islands/SceneToolbarApp'
import { ViewportChromeApp, type ViewportChromeAppProps } from './islands/ViewportChromeApp'
import { LeftChromeApp, type LeftChromeAppProps } from './islands/LeftChromeApp'
import {
  SelectionToolbarApp,
  type SelectionToolbarAppProps,
} from './islands/SelectionToolbarApp'
import { LibraryDockApp, type LibraryDockAppProps } from './islands/LibraryDockApp'
import { ChromeExtrasApp, type ChromeExtrasAppProps } from './islands/ChromeExtrasApp'
import { LiveShellApp, type LiveShellAppProps } from './islands/LiveShellApp'
import { AppLoadingIsland } from './islands/AppLoadingIsland'

export function mountLiveShellApp(host: HTMLElement, props: LiveShellAppProps): () => void {
  host.replaceChildren()
  return render(() => <LiveShellApp {...props} />, host)
}

export function mountSceneToolbarApp(
  host: HTMLElement,
  props: SceneToolbarAppProps = {},
): () => void {
  host.replaceChildren()
  return render(() => <SceneToolbarApp {...props} />, host)
}

export function mountViewportChromeApp(
  host: HTMLElement,
  props: ViewportChromeAppProps,
): () => void {
  host.replaceChildren()
  return render(() => <ViewportChromeApp {...props} />, host)
}

export function mountLeftChromeApp(host: HTMLElement, props: LeftChromeAppProps): () => void {
  host.replaceChildren()
  return render(() => <LeftChromeApp {...props} />, host)
}

export function mountSelectionToolbarApp(
  host: HTMLElement,
  props: SelectionToolbarAppProps = {},
): () => void {
  host.replaceChildren()
  return render(() => <SelectionToolbarApp {...props} />, host)
}

export function mountLibraryDockApp(
  host: HTMLElement,
  props: LibraryDockAppProps = {},
): () => void {
  host.replaceChildren()
  return render(() => <LibraryDockApp {...props} />, host)
}

export function mountAppLoadingIsland(host: HTMLElement): () => void {
  host.replaceChildren()
  return render(() => <AppLoadingIsland />, host)
}

export function mountChromeExtrasApp(
  host: HTMLElement,
  props: ChromeExtrasAppProps = {},
): () => void {
  host.replaceChildren()
  return render(() => <ChromeExtrasApp {...props} />, host)
}
