import { For, createSignal, onCleanup, onMount } from 'solid-js'
import { Box, Stack } from 'styled-system/jsx'
import { Tabs } from '@/components/ui'
import { toggleGroup } from 'styled-system/recipes'
import { subscribeBus } from '../vanillaBind'

export type LibraryDockAppProps = {
  tabsSelector?: string
  itemsHostId?: string
  filterHostId?: string
  syncEvent?: string
}

type TabInfo = {
  id: string
  value: string
  label: string
  hidden: boolean
  active: boolean
}

const TILE_STYLES = toggleGroup({ variant: 'ghost', tile: true })
const FILTER_STYLES = toggleGroup({ variant: 'outline', size: 'sm' })

function addClassNames(el: HTMLElement, className: string): boolean {
  let changed = false
  for (const token of className.split(/\s+/)) {
    if (token && !el.classList.contains(token)) {
      el.classList.add(token)
      changed = true
    }
  }
  return changed
}

function setAttrIfChanged(el: HTMLElement, name: string, value: string): boolean {
  if (el.getAttribute(name) === value) return false
  el.setAttribute(name, value)
  return true
}

function readTabs(selector: string): TabInfo[] {
  const root = document.querySelector(selector)
  if (!root) return []
  return [...root.querySelectorAll<HTMLButtonElement>('.library-tab')].map((btn) => ({
    id: btn.id,
    value: btn.dataset.libraryTab || btn.id,
    label: (btn.textContent || '').trim(),
    hidden: btn.hidden || btn.hasAttribute('hidden'),
    active: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true',
  }))
}

/**
 * Vanilla-Karten als Park ToggleGroup-Tiles (Anatomie + Recipe), DnD bleibt.
 * Nur mutieren wenn nötig — sonst MutationObserver → Endlosschleife.
 *
 * Hinweis: echte Ark-`ToggleGroup.Item`-Kinder wären ideal; die Kacheln bleiben
 * Vanilla-DOM (DnD/IDs), optisch über Recipe-Klassen angebunden.
 */
function paintLibraryTiles(host: HTMLElement): void {
  setAttrIfChanged(host, 'data-scope', 'toggle-group')
  setAttrIfChanged(host, 'data-part', 'root')
  setAttrIfChanged(host, 'data-orientation', 'horizontal')
  addClassNames(host, TILE_STYLES.root)
  host.style.flexWrap = 'nowrap'
  host.style.display = 'flex'
  host.style.alignItems = 'stretch'

  for (const card of host.querySelectorAll<HTMLElement>(':scope > .opening-library-card')) {
    setAttrIfChanged(card, 'data-scope', 'toggle-group')
    setAttrIfChanged(card, 'data-part', 'item')
    const on =
      card.classList.contains('active') || card.classList.contains('library-card-applied')
    setAttrIfChanged(card, 'data-state', on ? 'on' : 'off')
    addClassNames(card, TILE_STYLES.item)
  }
}

/**
 * Farbkategorien: Optik wie Sandbox ToggleGroup outline (eine Kategorie bleibt aktiv).
 */
function paintLibraryFilterChips(host: HTMLElement): void {
  const row = host.querySelector<HTMLElement>('.library-filter-tabs') ?? host
  if (row === host && !host.classList.contains('library-filter-tabs')) return
  setAttrIfChanged(row, 'data-scope', 'toggle-group')
  setAttrIfChanged(row, 'data-part', 'root')
  setAttrIfChanged(row, 'data-orientation', 'horizontal')
  addClassNames(row, FILTER_STYLES.root)
  row.style.flexWrap = 'nowrap'
  row.style.display = 'inline-flex'
  row.style.alignItems = 'center'

  for (const chip of row.querySelectorAll<HTMLElement>(':scope > .library-filter-tab')) {
    setAttrIfChanged(chip, 'data-scope', 'toggle-group')
    setAttrIfChanged(chip, 'data-part', 'item')
    const on = chip.classList.contains('active') || chip.getAttribute('aria-selected') === 'true'
    setAttrIfChanged(chip, 'data-state', on ? 'on' : 'off')
    addClassNames(chip, FILTER_STYLES.item)
  }
}

function libraryHome(): HTMLElement | null {
  return (
    document.getElementById('library-mode') ??
    document.getElementById('opening-library')
  )
}

/** Hosts nach Unmount zurück in Vanilla — sonst sind Karten für immer weg. */
function restoreLibraryHosts(itemsId: string, filterId: string): void {
  const home = libraryHome()
  if (!home) return
  const filter = document.getElementById(filterId)
  const items = document.getElementById(itemsId)
  if (filter && filter.parentElement !== home) {
    const before = items && home.contains(items) ? items : home.firstChild
    home.insertBefore(filter, before)
  }
  if (items && items.parentElement !== home) {
    home.appendChild(items)
  }
}

/**
 * Falls ein früherer Unmount die Nodes zerstört hat: leere Hosts neu anlegen
 * und Vanilla zum Neubefüllen anstoßen (Tab-Klick → initOpeningLibrary).
 */
function ensureLibraryHosts(itemsId: string, filterId: string): {
  items: HTMLElement | null
  filter: HTMLElement | null
  recreated: boolean
} {
  const home = libraryHome()
  if (!home) return { items: null, filter: null, recreated: false }
  let recreated = false
  let filter = document.getElementById(filterId)
  let items = document.getElementById(itemsId)
  if (!filter) {
    filter = document.createElement('div')
    filter.id = filterId
    filter.className = 'library-filter-row'
    filter.hidden = true
    home.insertBefore(filter, home.firstChild)
    recreated = true
  }
  if (!items) {
    items = document.createElement('div')
    items.id = itemsId
    items.className = 'opening-library-items'
    home.appendChild(items)
    recreated = true
  }
  return { items, filter, recreated }
}

/**
 * Bibliothek: Register = Ark Tabs (line), Kacheln = ToggleGroup-Recipe auf Vanilla-Karten.
 */
export function LibraryDockApp(props: LibraryDockAppProps) {
  const tabsSel = () => props.tabsSelector ?? '#vanilla-library-tabs'
  const itemsId = () => props.itemsHostId ?? 'opening-library-items'
  const filterId = () => props.filterHostId ?? 'library-filter-row'
  const syncEvent = () => props.syncEvent ?? 'fb:library-dock-sync'

  const [tick, setTick] = createSignal(0)
  const bump = () => setTick((t) => t + 1)
  let filterSlot!: HTMLDivElement
  let itemsSlot!: HTMLDivElement

  onMount(() => {
    const placeHosts = () => {
      const ensured = ensureLibraryHosts(itemsId(), filterId())
      const filter = ensured.filter
      const items = ensured.items
      if (filter && filterSlot && filter.parentElement !== filterSlot) {
        filterSlot.appendChild(filter)
      }
      if (items && itemsSlot && items.parentElement !== itemsSlot) {
        itemsSlot.appendChild(items)
      }
      if (items) paintLibraryTiles(items)
      if (filter) paintLibraryFilterChips(filter)
      if (ensured.recreated) {
        // Vanilla füllt Karten neu (initOpeningLibrary über Tab-Klick) — kein syncEvent-Reentry.
        const active =
          document.querySelector<HTMLButtonElement>(
            `${tabsSel()} .library-tab.active, ${tabsSel()} .library-tab[aria-selected="true"]`,
          ) ?? document.querySelector<HTMLButtonElement>(`${tabsSel()} .library-tab:not([hidden])`)
        active?.click()
      }
      return { filter, items }
    }

    const placed = placeHosts()

    let painting = false
    const safePaint = (host: HTMLElement) => {
      if (painting) return
      painting = true
      try {
        paintLibraryTiles(host)
      } finally {
        painting = false
      }
    }

    let paintingFilter = false
    const safePaintFilter = (host: HTMLElement) => {
      if (paintingFilter) return
      paintingFilter = true
      try {
        paintLibraryFilterChips(host)
      } finally {
        paintingFilter = false
      }
    }

    const unsub = subscribeBus(syncEvent(), () => {
      bump()
      placeHosts()
      const host = document.getElementById(itemsId())
      if (host) safePaint(host)
      const filterHost = document.getElementById(filterId())
      if (filterHost) safePaintFilter(filterHost)
    })
    const tabRoot = document.querySelector(tabsSel())
    const tabMo = new MutationObserver(bump)
    if (tabRoot) {
      tabMo.observe(tabRoot, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'hidden', 'aria-selected'],
      })
    }
    let itemsMo: MutationObserver | null = null
    const bindItemsMo = (items: HTMLElement | null) => {
      itemsMo?.disconnect()
      if (!items) return
      itemsMo = new MutationObserver((records) => {
        if (painting) return
        const structural = records.some((r) => r.type === 'childList')
        if (!structural) {
          safePaint(items)
          return
        }
        bump()
        safePaint(items)
      })
      itemsMo.observe(items, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['class'],
      })
    }
    bindItemsMo(placed.items)

    let filterMo: MutationObserver | null = null
    const bindFilterMo = (filter: HTMLElement | null) => {
      filterMo?.disconnect()
      if (!filter) return
      filterMo = new MutationObserver(() => {
        if (paintingFilter) return
        safePaintFilter(filter)
      })
      filterMo.observe(filter, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'aria-selected'],
      })
    }
    bindFilterMo(placed.filter)

    onCleanup(() => {
      unsub()
      tabMo.disconnect()
      itemsMo?.disconnect()
      filterMo?.disconnect()
      // Vor Solid-Destroy: Hosts zurück nach #library-mode
      restoreLibraryHosts(itemsId(), filterId())
    })
  })

  const tabs = () => {
    tick()
    return readTabs(tabsSel()).filter((t) => !t.hidden)
  }
  const activeTab = () => tabs().find((t) => t.active)?.value ?? tabs()[0]?.value ?? ''

  return (
    <Stack
      gap="3"
      data-park-library-dock=""
      class="park-library-dock"
      colorPalette="blue"
      color="fg.default"
      w="100%"
      h="100%"
      minH="0"
      bg="gray.1"
      borderTopWidth="1px"
      borderColor="border.default"
    >
      <Box
        class="park-library-tabs-scroll"
        h="auto"
        maxH="2.75rem"
        w="100%"
        minH="0"
        overflowX="auto"
        overflowY="hidden"
      >
        <Tabs.Root
          size="sm"
          variant="line"
          value={activeTab()}
          display="inline-flex"
          minW="max-content"
          onValueChange={(d) => {
            if (!d.value) return
            const tab = tabs().find((t) => t.value === d.value)
            if (tab?.id) document.getElementById(tab.id)?.click()
            bump()
          }}
        >
          <Tabs.List flexWrap="nowrap" gap="1">
            <For each={tabs()}>
              {(t) => (
                <Tabs.Trigger value={t.value} whiteSpace="nowrap">
                  {t.label}
                </Tabs.Trigger>
              )}
            </For>
            <Tabs.Indicator />
          </Tabs.List>
        </Tabs.Root>
      </Box>

      <div ref={filterSlot} class="park-library-filter-slot" />

      <Box
        flex="0 0 auto"
        minH="0"
        h="auto"
        w="100%"
        overflowX="auto"
        overflowY="hidden"
        class="park-library-items-scroll"
      >
        {/*
          Kein zweites ToggleGroup.Root um den Slot — paintLibraryTiles setzt
          Anatomie auf #opening-library-items (Vanilla bleibt DnD-Host).
        */}
        <Box ref={itemsSlot} class="park-library-items-slot" minH="0" />
      </Box>
    </Stack>
  )
}
