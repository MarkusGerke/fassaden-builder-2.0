/** Erklärungstexte an Feldern als Info-Icon mit Hover-Tipp. */

const SKIP_HINT_IDS = new Set([
  'roof-hint',
  'validation-hint',
  'validation-hint-studio',
  'opening-motion-status',
  'roller-shutter-drop-label',
  'sun-anim-hint',
  'sun-anim-both-hint',
  'share-status',
  'plan-status',
])

const CONTROL_SELECTOR =
  'input:not([type="hidden"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), select, textarea'

let tipEl: HTMLDivElement | null = null
let listenersBound = false

export function splitEmDashExplanation(text: string): { title: string; hint?: string } {
  const idx = text.indexOf(' — ')
  if (idx <= 0) return { title: text.trim() }
  let title = text.slice(0, idx).trim()
  let hint = text.slice(idx + 3).trim()
  const unit = hint.match(/\s*\((cm[^)]*)\)\s*$/i)
  if (unit && unit.index !== undefined && !/\(/.test(title)) {
    title = `${title} (${unit[1]})`
    hint = hint.slice(0, unit.index).trim()
  }
  return hint ? { title, hint } : { title: text.trim() }
}

export function installFieldInfo(root: ParentNode = document): void {
  splitEmDashLabels(root)
  upgradeHintParagraphs(root)
  upgradeControlTitles(root)
  bindTipListeners()
}

function bindTipListeners(): void {
  if (listenersBound) return
  listenersBound = true
  document.addEventListener('pointerover', onTipEnter)
  document.addEventListener('pointerout', onTipLeave)
  document.addEventListener('focusin', onTipEnter)
  document.addEventListener('focusout', onTipLeave)
  document.addEventListener('scroll', hideFieldTip, true)
  window.addEventListener('resize', hideFieldTip)
}

function onTipEnter(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const btn = target.closest<HTMLElement>('.field-info')
  if (!btn?.dataset.tip) return
  showFieldTip(btn)
}

function onTipLeave(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('.field-info')) return
  const next =
    event instanceof PointerEvent ? event.relatedTarget : (event as FocusEvent).relatedTarget
  if (next instanceof Element && next.closest('.field-info') === target.closest('.field-info')) {
    return
  }
  hideFieldTip()
}

function showFieldTip(anchor: HTMLElement): void {
  const text = anchor.dataset.tip?.trim()
  if (!text) return
  if (!tipEl) {
    tipEl = document.createElement('div')
    tipEl.className = 'field-info-tip'
    tipEl.setAttribute('role', 'tooltip')
    document.body.appendChild(tipEl)
  }
  tipEl.textContent = text
  tipEl.hidden = false
  const r = anchor.getBoundingClientRect()
  const margin = 8
  const maxW = Math.min(264, window.innerWidth - margin * 2)
  tipEl.style.maxWidth = `${maxW}px`
  const tw = tipEl.offsetWidth
  const th = tipEl.offsetHeight
  let left = r.left
  if (left + tw > window.innerWidth - margin) left = window.innerWidth - tw - margin
  if (left < margin) left = margin
  let top = r.bottom + 6
  if (top + th > window.innerHeight - margin) top = Math.max(margin, r.top - th - 6)
  tipEl.style.left = `${Math.round(left)}px`
  tipEl.style.top = `${Math.round(top)}px`
}

function hideFieldTip(): void {
  if (tipEl) tipEl.hidden = true
}

function createInfoButton(text: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'field-info'
  btn.dataset.tip = text
  btn.setAttribute('aria-label', `Hinweis: ${text}`)
  btn.textContent = 'i'
  btn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  btn.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  return btn
}

function addOrMergeInfo(host: HTMLElement, text: string): void {
  const tip = text.trim()
  if (!tip) return
  const existing = host.matches('.field-info')
    ? host
    : host.querySelector<HTMLElement>(':scope > .field-info, :scope span > .field-info')
  if (existing) {
    const prev = existing.dataset.tip ?? ''
    if (prev && !prev.includes(tip)) existing.dataset.tip = `${prev} ${tip}`
    else if (!prev) existing.dataset.tip = tip
    existing.setAttribute('aria-label', `Hinweis: ${existing.dataset.tip}`)
    return
  }
  const btn = createInfoButton(tip)
  if (host.matches('.slider-label')) {
    const span = host.querySelector(':scope > span')
    if (span) {
      span.append(' ', btn)
      return
    }
  }
  if (host.matches(CONTROL_SELECTOR)) {
    wrapControlWithInfo(host, btn)
    return
  }
  if (host.matches('label') && !host.matches('.toolbar-check, .slider-label')) {
    const nestedRow = host.querySelector<HTMLElement>(':scope > .field-control-row')
    if (nestedRow) {
      nestedRow.appendChild(btn)
      return
    }
    const nestedControl = host.querySelector<HTMLElement>(CONTROL_SELECTOR)
    if (nestedControl && nestedControl.parentElement === host) {
      wrapControlWithInfo(nestedControl, btn)
      return
    }
  }
  host.append(' ', btn)
}

function wrapControlWithInfo(control: HTMLElement, btn: HTMLButtonElement): void {
  const parent = control.parentElement
  if (parent?.classList.contains('field-control-row')) {
    parent.appendChild(btn)
    return
  }
  const row = document.createElement('div')
  row.className = 'field-control-row'
  const next = control.nextElementSibling
  control.replaceWith(row)
  row.appendChild(control)
  if (next?.tagName === 'OUTPUT') row.appendChild(next)
  row.appendChild(btn)
}

function isLabelish(el: Element): boolean {
  return el.matches('.toolbar-label, .slider-label, .toolbar-check, label')
}

function controlIn(el: Element): HTMLElement | null {
  if (el.matches(CONTROL_SELECTOR)) return el as HTMLElement
  if (isLabelish(el)) {
    return (el.querySelector<HTMLElement>(CONTROL_SELECTOR) ?? el) as HTMLElement
  }
  const childLabel = [...el.children].find((c) => isLabelish(c))
  if (childLabel) return childLabel as HTMLElement
  const childControl = [...el.children].find((c) => c.matches(CONTROL_SELECTOR))
  if (childControl) return childControl as HTMLElement
  if (el.matches('.preset-group, .field-control-row, .toolbar-row, .toolbar-row-2')) {
    const inner = el.querySelector<HTMLElement>(CONTROL_SELECTOR)
    if (inner) return inner
  }
  return null
}

function fromSiblings(start: Element | null, dir: 'prev' | 'next'): HTMLElement | null {
  let node: Element | null = start
  while (node) {
    if (node.querySelectorAll(':scope > .toolbar-group').length > 1) {
      if (dir === 'prev') return null
      node = node.nextElementSibling
      continue
    }
    if (isLabelish(node)) return node as HTMLElement
    const control = controlIn(node)
    if (control) return resolveInfoHost(control)
    node = dir === 'prev' ? node.previousElementSibling : node.nextElementSibling
  }
  return null
}

function findAssociatedHost(hint: HTMLElement): HTMLElement | null {
  const fromPrev = fromSiblings(hint.previousElementSibling, 'prev')
  if (fromPrev) return fromPrev

  const parent = hint.parentElement
  if (parent && !parent.matches('.settings-section, .ui-section, form, dialog, body, #app')) {
    const climbed = fromSiblings(parent.previousElementSibling, 'prev')
    if (climbed) return climbed
  }

  return fromSiblings(hint.nextElementSibling, 'next')
}

function resolveInfoHost(control: HTMLElement): HTMLElement {
  if (control.matches('.toolbar-check, .slider-label, .toolbar-label, label')) return control
  const check = control.closest<HTMLElement>('.toolbar-check')
  if (check) return check
  const slider = control.closest<HTMLElement>('.slider-label')
  if (slider) return slider
  const wrapLabel = control.closest('label')
  if (wrapLabel && wrapLabel.querySelector(CONTROL_SELECTOR) === control) return wrapLabel
  let prev = control.previousElementSibling
  while (prev) {
    if (prev.matches('.toolbar-label, .slider-label')) return prev as HTMLElement
    prev = prev.previousElementSibling
  }
  const group = control.closest('.toolbar-group')
  const groupLabel = group?.querySelector<HTMLElement>(':scope > .toolbar-label, :scope > .slider-label')
  if (groupLabel) return groupLabel
  return control
}

function shouldSkipHint(hint: HTMLElement): boolean {
  if (hint.classList.contains('is-error')) return true
  if (hint.id && SKIP_HINT_IDS.has(hint.id)) return true
  if (hint.dataset.fieldInfoConsumed === '1') return true
  const text = hint.textContent?.trim() ?? ''
  if (!text) return true
  if (text.endsWith(':') && text.length < 40) return true
  if (hint.parentElement?.matches('form.dialog-form, dialog') && !hint.closest('.toolbar-group')) {
    return true
  }
  return false
}

function upgradeHintParagraphs(root: ParentNode): void {
  for (const hint of [...root.querySelectorAll<HTMLElement>('p.toolbar-hint, p.compact-hint')]) {
    if (shouldSkipHint(hint)) continue
    const extra = hint.getAttribute('title')?.trim()
    const text = [hint.textContent?.trim() ?? '', extra && extra !== hint.textContent?.trim() ? extra : '']
      .filter(Boolean)
      .join(' ')
    const host = findAssociatedHost(hint)
    if (!host) continue
    addOrMergeInfo(host, text)
    hint.hidden = true
    hint.dataset.fieldInfoConsumed = '1'
    hint.removeAttribute('title')
  }
}

function upgradeControlTitles(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('input[title], select[title], textarea[title]')) {
    if (el.matches('[type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"]')) {
      continue
    }
    const title = el.getAttribute('title')?.trim()
    if (!title) continue
    if (el instanceof HTMLInputElement && el.disabled) continue
    addOrMergeInfo(resolveInfoHost(el), title)
    el.removeAttribute('title')
  }
}

function splitEmDashLabels(root: ParentNode): void {
  for (const label of root.querySelectorAll<HTMLElement>('.toolbar-label')) {
    if (label.dataset.fieldInfoSplit === '1') continue
    if (label.querySelector('.field-info')) continue
    const raw = label.textContent?.trim() ?? ''
    const { title, hint } = splitEmDashExplanation(raw)
    if (!hint) continue
    label.dataset.fieldInfoSplit = '1'
    label.textContent = title
    addOrMergeInfo(label, hint)
  }
}
