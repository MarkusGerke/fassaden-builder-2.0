import { For, Show, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Menu } from '@/components/ui'
import * as TreeView from '@/components/ui/tree-view'

export type LayersTreeAppProps = {
  layerListId?: string
}

type LayerNode = {
  id: string
  name: string
  kind?: string
  meta?: string
  selected?: boolean
  children?: LayerNode[]
}

type LayerTargets = {
  click: Map<string, HTMLElement>
  expand: Map<string, HTMLElement>
  more: Map<string, HTMLElement>
  mode: Map<string, { layers: HTMLButtonElement; decor: HTMLButtonElement }>
}

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

type LayerAction = {
  label: string
  danger?: boolean
  disabled?: boolean
  children?: LayerAction[]
}

function parseOsMenu(menu: Element): LayerAction[] {
  const out: LayerAction[] = []
  for (const child of Array.from(menu.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (child.classList.contains('os-menu-parent')) {
      const label = textOf(child.querySelector(':scope > span:not(.os-menu-caret)')) || 'Mehr'
      const sub = child.querySelector(':scope > .os-menu-sub')
      out.push({
        label,
        children: sub ? parseOsMenu(sub) : [],
      })
      continue
    }
    if (!child.classList.contains('os-menu-item')) continue
    out.push({
      label: textOf(child),
      danger: child.classList.contains('os-menu-danger'),
      disabled: child instanceof HTMLButtonElement && child.disabled,
    })
  }
  return out
}

function withHarvestedMenu<T>(fn: () => T): T {
  document.documentElement.classList.add('fb-harvest-menu')
  try {
    return fn()
  } finally {
    document.querySelectorAll('.os-menu').forEach((n) => n.remove())
    document.documentElement.classList.remove('fb-harvest-menu')
  }
}

function harvestLayerActions(more: HTMLElement): LayerAction[] {
  return withHarvestedMenu(() => {
    more.click()
    const menu = document.querySelector('.os-menu')
    return menu ? parseOsMenu(menu) : []
  })
}

function findMenuChild(root: Element, label: string): HTMLElement | undefined {
  return Array.from(root.children).find((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false
    const text = el.classList.contains('os-menu-parent')
      ? textOf(el.querySelector(':scope > span:not(.os-menu-caret)'))
      : textOf(el)
    return text === label
  })
}

function runLayerAction(more: HTMLElement, path: string[]): void {
  document.documentElement.classList.add('fb-harvest-menu')
  try {
    more.click()
    let root: Element | null = document.querySelector('.os-menu')
    for (let i = 0; i < path.length; i++) {
      if (!root) return
      const hit = findMenuChild(root, path[i] ?? '')
      if (!hit) return
      if (i === path.length - 1) {
        hit.click()
        return
      }
      root = hit.querySelector(':scope > .os-menu-sub')
    }
  } finally {
    document.querySelectorAll('.os-menu').forEach((n) => n.remove())
    document.documentElement.classList.remove('fb-harvest-menu')
  }
}

function ActionMenuItems(props: {
  actions: LayerAction[]
  more: HTMLElement
  path?: string[]
}): JSX.Element {
  return (
    <For each={props.actions}>
      {(action) => {
        const path = () => [...(props.path ?? []), action.label]
        return (
          <Show
            when={action.children && action.children.length > 0}
            fallback={
              <Menu.Item
                value={path().join('›')}
                disabled={action.disabled}
                data-danger={action.danger ? '' : undefined}
                onClick={() => {
                  if (action.disabled) return
                  runLayerAction(props.more, path())
                }}
              >
                {action.label}
              </Menu.Item>
            }
          >
            <Menu.Root positioning={{ placement: 'right-start', gutter: 4 }}>
              <Menu.TriggerItem>
                {action.label}
                <Menu.Indicator />
              </Menu.TriggerItem>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content minW="12rem">
                    <ActionMenuItems
                      actions={action.children ?? []}
                      more={props.more}
                      path={path()}
                    />
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Show>
        )
      }}
    </For>
  )
}

function LayerNav(props: {
  nodeId: string
  more?: HTMLElement
  children: JSX.Element
}) {
  const [actions, setActions] = createSignal<LayerAction[]>([])

  const load = () => {
    if (!props.more) {
      setActions([])
      return
    }
    setActions(harvestLayerActions(props.more))
  }

  return (
    <Show when={props.more} fallback={props.children}>
      <Menu.Root
        positioning={{ placement: 'right-start', gutter: 4 }}
        onOpenChange={(d) => {
          if (d.open) load()
        }}
      >
        <Menu.ContextTrigger
          asChild={(ctxProps) => {
            const p = ctxProps()
            return (
              <Box
                width="full"
                minW="0"
                {...p}
                onContextMenu={(event) => {
                  event.preventDefault()
                  const handler = p.onContextMenu
                  if (typeof handler === 'function') {
                    ;(handler as (e: MouseEvent) => void)(event)
                  }
                }}
              >
                {props.children}
              </Box>
            )
          }}
        />
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="12rem">
              <ActionMenuItems actions={actions()} more={props.more!} />
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Show>
  )
}

/** Kind-Chip + Label + Meta (wie Vanilla `.layer-kind` / `.layer-label` / `.layer-meta`). */
function displayParts(btn: HTMLElement): {
  kind?: string
  label: string
  meta?: string
  selected: boolean
} {
  const kind = textOf(btn.querySelector('.layer-kind')) || undefined
  const rawLabel = textOf(btn.querySelector('.layer-label'))
  const meta = textOf(btn.querySelector('.layer-meta')) || undefined
  const label = rawLabel || (!kind ? textOf(btn) || 'Element' : '')
  return {
    kind,
    label: label || kind || 'Element',
    meta,
    selected: btn.classList.contains('selected'),
  }
}

function scanChildren(
  container: Element | null,
  targets: LayerTargets,
  idPrefix: string,
): { nodes: LayerNode[]; selected: string[]; expanded: string[] } {
  const nodes: LayerNode[] = []
  const selected: string[] = []
  const expanded: string[] = []
  if (!container) return { nodes, selected, expanded }

  let i = 0
  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement)) continue
    const id = `${idPrefix}.${i++}`

    // Floor / roof / building-like nested branch
    const header = child.querySelector(':scope > .layer-floor-header, :scope > .layer-building-header')
    if (header) {
      const collapse = header.querySelector<HTMLElement>('.layer-floor-collapse')
      const toggle = header.querySelector<HTMLElement>('.layer-floor-toggle, .layer-row')
      const more = header.querySelector<HTMLElement>('.layer-more-btn')
      const titleEl = toggle?.querySelector('span') ?? toggle
      const name = textOf(titleEl) || textOf(toggle) || 'Gruppe'
      const isExpanded = collapse ? collapse.textContent?.includes('▾') === true : true
      if (collapse) targets.expand.set(id, collapse)
      if (toggle) {
        targets.click.set(id, toggle)
        if (toggle.classList.contains('selected')) selected.push(id)
      }
      if (more) targets.more.set(id, more)

      const body = child.querySelector(
        ':scope > .layer-floor-body:not(.collapsed), :scope > .layer-decor-body, :scope > ul.layer-floor-body, :scope > ul.layer-roof-body',
      )
      const bodyCollapsed = child.querySelector(':scope > .layer-floor-body.collapsed')
      const activeBody =
        body && !(body instanceof HTMLElement && body.classList.contains('collapsed'))
          ? body
          : bodyCollapsed && isExpanded
            ? bodyCollapsed
            : isExpanded
              ? body
              : null

      // Mode toggle only on building level — handled by caller
      const nested = scanChildren(
        isExpanded ? (activeBody ?? child.querySelector(':scope > ul')) : null,
        targets,
        id,
      )
      if (isExpanded) {
        expanded.push(id, ...nested.expanded)
        selected.push(...nested.selected)
      }

      nodes.push({
        id,
        name,
        selected: toggle?.classList.contains('selected'),
        children: nested.nodes.length > 0 ? nested.nodes : [],
      })
      continue
    }

    // Wall / ceiling / opening row
    const rowBtn =
      child.querySelector<HTMLElement>(':scope > .layer-wall-row > .layer-row') ||
      child.querySelector<HTMLElement>(':scope > .layer-row') ||
      (child.classList.contains('layer-row') ? child : null)
    const wallRow = child.querySelector(':scope > .layer-wall-row')
    const wallCollapse = wallRow?.querySelector<HTMLElement>('.layer-wall-collapse')
    const more =
      wallRow?.querySelector<HTMLElement>('.layer-more-btn') ||
      child.querySelector<HTMLElement>(':scope > .layer-more-btn')

    if (rowBtn) {
      const parts = displayParts(rowBtn)
      targets.click.set(id, rowBtn)
      if (more) targets.more.set(id, more)
      if (parts.selected) selected.push(id)

      const nestedList = child.querySelector(':scope > .layer-floor-body, :scope > ul')
      const hasNested = nestedList && nestedList.children.length > 0
      const wallExpanded = wallCollapse
        ? wallCollapse.textContent?.includes('▾') === true
        : Boolean(hasNested && !(nestedList as HTMLElement).classList.contains('collapsed'))

      if (wallCollapse && (wallCollapse.textContent?.trim() || hasNested)) {
        targets.expand.set(id, wallCollapse)
      }

      if (hasNested && (wallExpanded || !wallCollapse)) {
        const nested = scanChildren(nestedList, targets, id)
        if (wallExpanded) {
          expanded.push(id, ...nested.expanded)
        }
        selected.push(...nested.selected)
        nodes.push({
          id,
          name: parts.label,
          kind: parts.kind,
          meta: parts.meta,
          selected: parts.selected,
          children: nested.nodes,
        })
      } else if (wallCollapse && (wallCollapse.textContent?.trim() || hasNested)) {
        nodes.push({
          id,
          name: parts.label,
          kind: parts.kind,
          meta: parts.meta,
          selected: parts.selected,
          children: [],
        })
      } else {
        nodes.push({
          id,
          name: parts.label,
          kind: parts.kind,
          meta: parts.meta,
          selected: parts.selected,
        })
      }
      continue
    }

    // Decor checkbox rows
    if (child.classList.contains('layer-decor-row')) {
      const lab = child.querySelector('label')
      const name = textOf(lab?.querySelector('span')) || textOf(lab) || 'Schmuck'
      const input = child.querySelector<HTMLInputElement>('input[type="checkbox"]')
      if (lab) targets.click.set(id, lab)
      else if (input) targets.click.set(id, input)
      nodes.push({ id, name, kind: 'Schmuck' })
      continue
    }

    // Add-roof button etc.
    const addBtn = child.querySelector<HTMLElement>(':scope > .layer-add-roof, :scope > button.layer-row')
    if (addBtn) {
      targets.click.set(id, addBtn)
      nodes.push({ id, name: textOf(addBtn) || 'Aktion' })
      continue
    }
  }

  return { nodes, selected, expanded }
}

function scanLayerList(
  list: HTMLElement,
  targets: LayerTargets,
): { rootChildren: LayerNode[]; selected: string[]; expanded: string[] } {
  targets.click.clear()
  targets.expand.clear()
  targets.more.clear()
  targets.mode.clear()

  const rootChildren: LayerNode[] = []
  const selected: string[] = []
  const expanded: string[] = []
  const buildings = Array.from(list.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains('layer-building'),
  )
  const houses = buildings.filter((child) => !child.classList.contains('layer-scene-lights'))
  const flattenHouse = houses.length === 1
  let bi = 0

  for (const child of buildings) {
    const isLights = child.classList.contains('layer-scene-lights')
    const hoist = flattenHouse && !isLights
    const id = isLights ? `l${bi++}` : hoist ? 'house' : `b${bi++}`
    const header = child.querySelector(':scope > .layer-building-header, :scope > .layer-floor-header')
    const collapse = header?.querySelector<HTMLElement>('.layer-floor-collapse')
    const toggle = header?.querySelector<HTMLElement>('.layer-floor-toggle')
    const more = header?.querySelector<HTMLElement>('.layer-more-btn')
    const name = textOf(toggle) || (isLights ? 'Lichter' : 'Haus')
    const isExpanded = collapse ? collapse.textContent?.includes('▾') === true : true

    if (!hoist) {
      if (collapse) targets.expand.set(id, collapse)
      if (toggle) {
        targets.click.set(id, toggle)
        if (toggle.classList.contains('selected')) selected.push(id)
      }
      if (more) targets.more.set(id, more)
    }

    const modeToggle = child.querySelector(':scope > .layer-mode-toggle')
    if (modeToggle && !hoist) {
      const btns = Array.from(modeToggle.querySelectorAll<HTMLButtonElement>('button.view-mode-btn'))
      const layersBtn = btns.find((b) => textOf(b).includes('Ebenen'))
      const decorBtn = btns.find((b) => textOf(b).includes('Fassadenschmuck') || textOf(b).includes('Schmuck'))
      if (layersBtn && decorBtn) {
        targets.mode.set(id, { layers: layersBtn, decor: decorBtn })
      }
    }

    const bodies = [
      ...child.querySelectorAll(':scope > .layer-decor-body, :scope > .layer-floor-body'),
    ]
    const nestedNodes: LayerNode[] = []
    const scanBodies = hoist || isExpanded
    if (scanBodies) {
      if (!hoist) expanded.push(id)
      for (const body of bodies) {
        const nested = scanChildren(body, targets, id)
        nestedNodes.push(...nested.nodes)
        expanded.push(...nested.expanded)
        selected.push(...nested.selected)
      }
    }

    if (hoist) {
      rootChildren.push(...nestedNodes)
      continue
    }

    rootChildren.push({
      id,
      name,
      selected: child.classList.contains('layer-selected-building'),
      children: nestedNodes,
    })
    if (child.classList.contains('layer-selected-building') && !selected.includes(id)) {
      selected.push(id)
    }
  }

  return { rootChildren, selected, expanded }
}

function NodeLabel(props: { kind?: string; name: string; meta?: string }) {
  const showName = () => {
    // Kein doppeltes „Wand Wand“, wenn Label leer und name === kind
    if (props.kind && props.name === props.kind) return false
    return Boolean(props.name)
  }
  return (
    <HStack gap="1.5" justify="space-between" width="full" minW="0" flex="1">
      <HStack gap="1.5" minW="0" flex="1">
        <Show when={props.kind}>
          <Box as="span" textStyle="sm" color="fg.muted" flexShrink="0">
            {props.kind}
          </Box>
        </Show>
        <Show when={showName()}>
          <Box as="span" textStyle="sm" color="fg.default" truncate minW="0">
            {props.name}
          </Box>
        </Show>
      </HStack>
      <Show when={props.meta}>
        <Box as="span" textStyle="sm" color="fg.muted" flexShrink="0">
          {props.meta}
        </Box>
      </Show>
    </HStack>
  )
}

function TreeNode(props: {
  node: LayerNode
  indexPath: number[]
  targets: LayerTargets
}) {
  const isBranch = () => Array.isArray(props.node.children)
  const more = () => props.targets.more.get(props.node.id)
  const label = () => (
    <NodeLabel kind={props.node.kind} name={props.node.name} meta={props.node.meta} />
  )

  return (
    <TreeView.NodeProvider node={props.node} indexPath={props.indexPath}>
      <Show
        when={isBranch()}
        fallback={
          <TreeView.Item>
            <LayerNav nodeId={props.node.id} more={more()}>
              <TreeView.ItemText>{label()}</TreeView.ItemText>
            </LayerNav>
          </TreeView.Item>
        }
      >
        <TreeView.Branch>
          <TreeView.BranchControl>
            <TreeView.BranchIndicator />
            <LayerNav nodeId={props.node.id} more={more()}>
              <TreeView.BranchText>{label()}</TreeView.BranchText>
            </LayerNav>
          </TreeView.BranchControl>
          <TreeView.BranchContent>
            <TreeView.BranchIndentGuide />
            <For each={props.node.children}>
              {(child, index) => (
                <TreeNode
                  node={child}
                  indexPath={[...props.indexPath, index()]}
                  targets={props.targets}
                />
              )}
            </For>
          </TreeView.BranchContent>
        </TreeView.Branch>
      </Show>
    </TreeView.NodeProvider>
  )
}

/**
 * Park TreeView über Vanilla `#layer-list`.
 * Aktionen (löschen, duplizieren, ausblenden, …) per Ark Context Menu (Rechtsklick).
 */
export function LayersTreeApp(props: LayersTreeAppProps) {
  const listId = () => props.layerListId ?? 'layer-list'
  const targets: LayerTargets = {
    click: new Map(),
    expand: new Map(),
    more: new Map(),
    mode: new Map(),
  }

  const [tick, setTick] = createSignal(0)
  const [selectedValue, setSelectedValue] = createSignal<string[]>([])
  const [expandedValue, setExpandedValue] = createSignal<string[]>([])
  let syncingFromDom = false
  let moTimer: number | undefined

  const sameIds = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  const collection = createMemo(() => {
    tick()
    const list = document.getElementById(listId())
    const scanned = list
      ? scanLayerList(list, targets)
      : { rootChildren: [] as LayerNode[], selected: [] as string[], expanded: [] as string[] }

    // Sync controlled selection/expansion from DOM — ohne Vanilla-Clicks (sonst Endlosschleife)
    queueMicrotask(() => {
      syncingFromDom = true
      try {
        if (!sameIds(selectedValue(), scanned.selected)) setSelectedValue(scanned.selected)
        if (!sameIds(expandedValue(), scanned.expanded)) setExpandedValue(scanned.expanded)
      } finally {
        // nach dem Controlled-Update noch einen Tick warten, bis Ark settled ist
        queueMicrotask(() => {
          syncingFromDom = false
        })
      }
    })

    return TreeView.createTreeCollection<LayerNode>({
      nodeToValue: (n) => n.id,
      nodeToString: (n) => n.name,
      rootNode: { id: 'ROOT', name: '', children: scanned.rootChildren },
    })
  })

  onMount(() => {
    const list = document.getElementById(listId())
    if (!list) return
    const mo = new MutationObserver(() => {
      // Debounce — Vanilla baut den Baum oft in vielen Mutationen
      window.clearTimeout(moTimer)
      moTimer = window.setTimeout(() => setTick((t) => t + 1), 32)
    })
    mo.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    setTick((t) => t + 1)
    onCleanup(() => {
      mo.disconnect()
      window.clearTimeout(moTimer)
    })
  })

  return (
    <Stack gap="2" class="park-layers-tree" data-park-layers-tree="" width="full">
      <TreeView.Root
        collection={collection() as never}
        selectedValue={selectedValue()}
        expandedValue={expandedValue()}
        onSelectionChange={(d) => {
          const values = d.selectedValue ?? []
          setSelectedValue(values)
          if (syncingFromDom) return
          const id = values[0]
          if (!id) return
          targets.click.get(id)?.click()
        }}
        onExpandedChange={(d) => {
          const next = new Set(d.expandedValue ?? [])
          const prev = new Set(expandedValue())
          setExpandedValue([...next])
          if (syncingFromDom) return
          for (const id of next) {
            if (!prev.has(id)) targets.expand.get(id)?.click()
          }
          for (const id of prev) {
            if (!next.has(id)) targets.expand.get(id)?.click()
          }
        }}
      >
        <TreeView.Tree>
          <For each={collection().rootNode.children}>
            {(node, index) => <TreeNode node={node} indexPath={[index()]} targets={targets} />}
          </For>
        </TreeView.Tree>
      </TreeView.Root>
    </Stack>
  )
}
