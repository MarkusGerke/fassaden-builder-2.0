import { Show, createEffect, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Box, HStack } from 'styled-system/jsx'
import { Button, Drawer } from '@/components/ui'
import * as Splitter from '@/components/ui/splitter'
import * as ScrollArea from '@/components/ui/scroll-area'
import { LeftChromeApp, type LeftChromeAppProps } from './LeftChromeApp'
import { ViewportChromeApp, type ViewportChromeAppProps } from './ViewportChromeApp'
import { ChromeExtrasApp } from './ChromeExtrasApp'
import { LibraryDockApp, type LibraryDockAppProps } from './LibraryDockApp'
import { SelectionToolbarApp, type SelectionToolbarAppProps } from './SelectionToolbarApp'
import { FormMirror } from './FormMirror'
import { SceneToolbarApp, type SceneToolbarAppProps } from './SceneToolbarApp'
import { clickId } from '../vanillaBind'

/** Tabs + Filterband + Kartenzeile (kein Vertikal-Greifer). */
export const LIBRARY_DOCK_HEIGHT = 'calc(2.75rem + 2.75rem + 6.5rem + 0.75rem)'

/** Gleiche Snaps wie Vanilla-Sheet (`src/ui/touchChrome.ts`). */
const EDIT_SHEET_HEIGHT_KEY = 'fassaden-builder-library-edit-sheet-height'
const EDIT_SHEET_SNAP_POINTS = [1, 0.75, 0.5, 0.25] as const

function loadEditSheetSnap(): number {
  try {
    const raw = Number(sessionStorage.getItem(EDIT_SHEET_HEIGHT_KEY))
    if (raw === 100) return 1
    if (raw === 75) return 0.75
    if (raw === 50) return 0.5
    if (raw === 25) return 0.25
  } catch {
    /* ignore */
  }
  return 0.5
}

function persistEditSheetSnap(snap: number): void {
  const pct = Math.round(snap * 100)
  if (pct === 100 || pct === 75 || pct === 50 || pct === 25) {
    try {
      sessionStorage.setItem(EDIT_SHEET_HEIGHT_KEY, String(pct))
    } catch {
      /* ignore */
    }
  }
}

function snapPointToNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  const px = Number.parseFloat(value)
  return Number.isFinite(px) ? px : null
}

export type LiveShellAppProps = {
  left: LeftChromeAppProps
  viewport: ViewportChromeAppProps
  scene?: SceneToolbarAppProps
  selection?: SelectionToolbarAppProps
  library?: LibraryDockAppProps
  chromeExtras?: { syncEvent?: string }
}

function adopt(id: string, host: HTMLElement | undefined): void {
  const el = document.getElementById(id)
  if (!el || !host) return
  if (el.parentElement !== host) host.appendChild(el)
}

function markLegacy(id: string): void {
  document.getElementById(id)?.classList.add('vanilla-legacy-park')
}

function bumpCanvas(): void {
  window.dispatchEvent(new Event('resize'))
}

function SplitGrip(props: { id: `${string}:${string}` }) {
  return (
    <Splitter.ResizeTrigger id={props.id}>
      <Splitter.ResizeTriggerIndicator />
    </Splitter.ResizeTrigger>
  )
}

function syncCollapsed(
  api: {
    isPanelCollapsed: (id: string) => boolean
    collapsePanel: (id: string) => void
    expandPanel: (id: string) => void
  },
  id: string,
  collapsed: boolean,
): void {
  const isCollapsed = api.isPanelCollapsed(id)
  if (collapsed && !isCollapsed) api.collapsePanel(id)
  if (!collapsed && isCollapsed) api.expandPanel(id)
}

function InspectorPanels(props: {
  hasSelection: boolean
  portal: 'scene' | 'selection'
  selection?: SelectionToolbarAppProps
  scene?: SceneToolbarAppProps
}): JSX.Element {
  return (
    <>
      <Show when={props.portal !== 'scene' && props.hasSelection}>
        <Box minH="0">
          <SelectionToolbarApp {...props.selection} />
        </Box>
      </Show>
      <Show when={props.portal === 'scene'}>
        <FormMirror rootSelector="#scene-toolbar-panels" subscribe={props.scene?.subscribe} />
      </Show>
    </>
  )
}

/**
 * Eine sichtbare UI-Welt: Ark Splitter (links | Mitte | rechts).
 * Bibliothek unten: feste Höhe, kein Greifer.
 * Touch: linke/rechte Spalte weg; Bearbeiten öffnet Drawer von unten.
 */
export function LiveShellApp(props: LiveShellAppProps) {
  let stageHost!: HTMLDivElement
  let exportHost!: HTMLDivElement
  let planHost!: HTMLDivElement
  let syncing = false
  const [hasSelection, setHasSelection] = createSignal(false)
  const [dockCollapsed, setDockCollapsed] = createSignal(false)
  const [touch, setTouch] = createSignal(false)
  const [editOpen, setEditOpen] = createSignal(false)
  const [editPortal, setEditPortal] = createSignal<'scene' | 'selection'>('selection')
  const [editTitle, setEditTitle] = createSignal('Bearbeiten')
  const [editSnap, setEditSnap] = createSignal<number>(0.5)

  createEffect(() => {
    if (editOpen()) setEditSnap(loadEditSheetSnap())
  })

  const main = Splitter.useSplitter(() => ({
    orientation: 'horizontal' as const,
    panels: [
      { id: 'left', minSize: 14, maxSize: 38, collapsible: true, collapsedSize: 0 },
      { id: 'main', minSize: 30 },
      { id: 'right', minSize: 16, maxSize: 44, collapsible: true, collapsedSize: 0 },
    ],
    defaultSize: [20, 56, 24],
    onResize: bumpCanvas,
    onResizeEnd: bumpCanvas,
    onCollapse: () => {
      if (syncing) return
      const api = main()
      const app = document.getElementById('app')
      if (!app) return
      const leftDown = api.isPanelCollapsed('left')
      const rightDown = api.isPanelCollapsed('right')
      if (leftDown !== app.classList.contains('ui-left-collapsed')) clickId('ui-left-collapse')
      if (rightDown !== app.classList.contains('ui-right-collapsed')) clickId('ui-right-collapse')
      bumpCanvas()
    },
  }))

  onMount(() => {
    document.documentElement.classList.add('park-shell')
    document.documentElement.classList.remove('park-hard-cutover')

    markLegacy('ui')
    markLegacy('ui-right')
    markLegacy('ui-left-collapse')
    markLegacy('ui-right-collapse')
    markLegacy('library-dock')
    markLegacy('viewport-chrome')

    adopt('viewport', stageHost)
    adopt('export-sidebar', exportHost)
    adopt('plan-sidebar', planHost)

    const app = document.getElementById('app')
    const touchMq = window.matchMedia('(pointer: coarse), (max-width: 900px)')
    const syncChrome = () => {
      setTouch(touchMq.matches)
      setEditOpen(document.documentElement.classList.contains('ui-library-edit-focus'))
      setEditPortal(
        document.documentElement.dataset.editPortal === 'scene' ? 'scene' : 'selection',
      )
      const title = document.getElementById('library-edit-sheet-title')?.textContent?.trim()
      if (title) setEditTitle(title)
    }
    const applyAppClasses = () => {
      syncChrome()
      if (!app) return
      syncing = true
      try {
        const api = main()
        const stage = app.classList.contains('stage-view') || app.classList.contains('showcase-view')
        const narrow = touchMq.matches
        syncCollapsed(api, 'left', !narrow && (stage || app.classList.contains('ui-left-collapsed')))
        syncCollapsed(api, 'right', !narrow && (stage || app.classList.contains('ui-right-collapsed')))
        setDockCollapsed(!narrow && (app.classList.contains('ui-bottom-collapsed') || stage))
        const sel = document.getElementById('selection-toolbar')
        setHasSelection(!!sel && !sel.hidden)
      } finally {
        syncing = false
      }
    }

    applyAppClasses()
    requestAnimationFrame(() => {
      applyAppClasses()
      bumpCanvas()
    })

    const mo = new MutationObserver(applyAppClasses)
    if (app) mo.observe(app, { attributes: true, attributeFilter: ['class'] })
    const htmlMo = new MutationObserver(applyAppClasses)
    htmlMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-edit-portal'],
    })
    touchMq.addEventListener('change', applyAppClasses)
    const sel = document.getElementById('selection-toolbar')
    const selMo = sel ? new MutationObserver(applyAppClasses) : null
    if (sel) selMo?.observe(sel, { attributes: true, attributeFilter: ['hidden'] })
    onCleanup(() => {
      mo.disconnect()
      htmlMo.disconnect()
      touchMq.removeEventListener('change', applyAppClasses)
      selMo?.disconnect()
    })
  })

  return (
    <Box
      data-park-live-shell=""
      class="park-live-shell"
      position="absolute"
      inset="0"
      h="100%"
      w="100%"
      minH="0"
      bg="gray.2"
      color="fg.default"
    >
      <Splitter.RootProvider value={main} h="100%" w="100%" minH="0" minW="0">
        <Splitter.Panel id="left">
          <ScrollArea.Frame h="100%" minH="0" bg="gray.1">
            <LeftChromeApp {...props.left} />
          </ScrollArea.Frame>
        </Splitter.Panel>
        <SplitGrip id="left:main" />
        <Splitter.Panel id="main">
          <Box position="relative" h="100%" minH="0" display="flex" flexDirection="column">
            <Box position="relative" flex="1" minH="0" minW="0" bg="gray.5">
              <Box
                position="absolute"
                top="3"
                left="3"
                right="3"
                zIndex="12"
                pointerEvents="none"
              >
                <Box pointerEvents="auto" display="flex" flexDirection="column" gap="2">
                  <ViewportChromeApp {...props.viewport} />
                  <ChromeExtrasApp syncEvent={props.chromeExtras?.syncEvent} />
                </Box>
              </Box>
              <Box
                ref={(el) => {
                  stageHost = el
                }}
                h="100%"
                minH="0"
                minW="0"
                class="park-stage-host"
              />
            </Box>
            <Show when={!dockCollapsed()}>
              <Box
                class="park-library-slide"
                data-park-library-fixed=""
                data-open={touch() || hasSelection() ? 'true' : 'false'}
                flexShrink="0"
                bg="gray.1"
                overflow="hidden"
              >
                <Box h={touch() ? 'auto' : LIBRARY_DOCK_HEIGHT} minH={touch() ? '0' : LIBRARY_DOCK_HEIGHT}>
                  <LibraryDockApp {...props.library} />
                </Box>
              </Box>
            </Show>
          </Box>
        </Splitter.Panel>
        <SplitGrip id="main:right" />
        <Splitter.Panel id="right">
          <Box h="100%" minH="0" display="flex" flexDirection="column" bg="gray.1">
            <div
              ref={(el) => {
                exportHost = el
              }}
              class="park-export-slot"
            />
            <div
              ref={(el) => {
                planHost = el
              }}
              class="park-plan-slot"
            />
            <Box flex="1" minH="0" display="flex" flexDirection="column">
              <Show when={hasSelection() && !touch()}>
                <Box flex="1" minH="0" display="flex" flexDirection="column">
                  <ScrollArea.Frame h="100%" minH="0">
                    <Box p="3">
                      <SelectionToolbarApp {...props.selection} />
                    </Box>
                  </ScrollArea.Frame>
                </Box>
              </Show>
              <Show when={!touch()}>
                <Box flex="1" minH="0">
                  <ScrollArea.Frame h="100%" minH="0">
                    <Box p="3">
                      <SceneToolbarApp {...props.scene} />
                    </Box>
                  </ScrollArea.Frame>
                </Box>
              </Show>
            </Box>
          </Box>
        </Splitter.Panel>
      </Splitter.RootProvider>
      <Show when={touch()}>
        <Portal>
          <Drawer.Root
            open={editOpen()}
            swipeDirection="down"
            snapPoints={[...EDIT_SHEET_SNAP_POINTS]}
            snapPoint={editSnap()}
            onSnapPointChange={(d) => {
              const next = snapPointToNumber(d.snapPoint)
              if (next == null) return
              setEditSnap(next)
              persistEditSheetSnap(next)
            }}
            onOpenChange={(d) => {
              if (!d.open) clickId('library-edit-sheet-close')
            }}
            lazyMount
          >
            <Drawer.Backdrop class="park-drawer-backdrop" />
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Grabber>
                  <Drawer.GrabberIndicator />
                </Drawer.Grabber>
                <HStack px="4" pb="2" alignItems="center" justify="space-between">
                  <Drawer.Title>{editTitle()}</Drawer.Title>
                  <Drawer.CloseTrigger
                    asChild={(p) => (
                      <Button {...p()} size="sm" variant="outline">
                        Schließen
                      </Button>
                    )}
                  />
                </HStack>
                <Box class="park-no-scrollbar" overflowY="auto" flex="1" minH="0" px="3" pb="4">
                  <InspectorPanels
                    hasSelection={hasSelection()}
                    portal={editPortal()}
                    selection={props.selection}
                    scene={props.scene}
                  />
                </Box>
              </Drawer.Content>
            </Drawer.Positioner>
          </Drawer.Root>
        </Portal>
      </Show>
    </Box>
  )
}
