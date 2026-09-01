export type MenuItem = {
  label: string
  action?: () => void
  danger?: boolean
  disabled?: boolean
  children?: MenuItem[]
}

let openMenu: HTMLElement | null = null
let outsideHandler: ((event: Event) => void) | null = null

export function closeContextMenu() {
  openMenu?.remove()
  openMenu = null
  if (outsideHandler) {
    document.removeEventListener('pointerdown', outsideHandler, true)
    document.removeEventListener('keydown', onKeyDown, true)
    outsideHandler = null
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeContextMenu()
}

function buildMenu(items: MenuItem[], submenu = false): HTMLDivElement {
  const menu = document.createElement('div')
  menu.className = submenu ? 'os-menu os-menu-sub' : 'os-menu'
  menu.addEventListener('pointerdown', (event) => event.stopPropagation())

  for (const item of items) {
    if (item.children && item.children.length > 0) {
      const row = document.createElement('div')
      row.className = 'os-menu-item os-menu-parent'
      const label = document.createElement('span')
      label.textContent = item.label
      const caret = document.createElement('span')
      caret.className = 'os-menu-caret'
      caret.textContent = '›'
      const sub = buildMenu(item.children, true)
      row.append(label, caret, sub)
      menu.appendChild(row)
      continue
    }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = item.danger ? 'os-menu-item os-menu-danger' : 'os-menu-item'
    btn.textContent = item.label
    btn.disabled = Boolean(item.disabled)
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (item.disabled) return
      closeContextMenu()
      item.action?.()
    })
    menu.appendChild(btn)
  }

  return menu
}

export function showContextMenu(clientX: number, clientY: number, items: MenuItem[]) {
  closeContextMenu()
  if (items.length === 0) return
  const menu = buildMenu(items)
  menu.style.left = `${clientX}px`
  menu.style.top = `${clientY}px`
  document.body.appendChild(menu)
  openMenu = menu

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) {
      menu.style.left = `${Math.max(8, clientX - rect.width)}px`
    }
    if (rect.bottom > window.innerHeight - 8) {
      menu.style.top = `${Math.max(8, clientY - rect.height)}px`
    }
  })

  outsideHandler = (event: Event) => {
    if (openMenu && event.target instanceof Node && openMenu.contains(event.target)) return
    closeContextMenu()
  }
  window.setTimeout(() => {
    document.addEventListener('pointerdown', outsideHandler!, true)
    document.addEventListener('keydown', onKeyDown, true)
  }, 0)
}
