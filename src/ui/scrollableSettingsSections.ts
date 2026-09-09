/**
 * Scrollgesteuertes Sektions-Layout — Port von react-scrollable-accordion (List/ListHeader):
 *
 * - Wrapper (`.right-selection-toolbar`, position: relative) umschließt das scrollende Panel.
 * - Köpfe werden `position: absolute` relativ zum **Wrapper** geklebt (nicht zum Scroller),
 *   dadurch stehen sie still, während das Panel scrollt — kein Nachziehen pro Frame.
 * - N[i] = natürliche Scroll-Y des Kopfes (alle Köpfe im Fluss), einmal gemessen (Sync/Resize/Inhalt).
 * - Oben:  scrollTop + Σh(0..i)          >= N[i] → top = Σh(0..i); Sektion paddingTop = Platzhalter
 * - Unten: scrollTop + (viewH − Σh(i..n)) <  N[i] → bottom = Σh(i+1..n)
 * - Klick: scrollTop = N[i] − Σh(0..i).
 *
 * Abweichung zur Referenz (bewusst): dort ist initialOffsetTop = offsetTop − Σh(0..i) und die
 * Bedingungen addieren Σh(0..i) erneut → ab Kopf 1 kleben/lösen Köpfe um Σh(0..i) zu früh/spät
 * (sichtbarer Sprung). Mit N[i] direkt ist der Übergang exakt am Slot → kein Sprung.
 */

export const SETTINGS_SECTION_HEAD_REM = 2.15

/** Smooth-Scroll endet gerundet (Device-Pixel) → Kopf sonst 0,3 px „zu früh“ im Fluss. */
const STICK_EPSILON_PX = 0.5

type PanelLayout = {
  sections: HTMLElement[]
  headers: HTMLElement[]
  heights: number[]
  initialOffsets: number[]
  /** Platzhalter je Sektion, wenn der Kopf oben klebt: Kopfhöhe + row-gap (Flex-Sektionen). */
  placeholders: number[]
}

type PanelState = {
  sections: HTMLElement[]
  layout: PanelLayout | null
  onScroll: () => void
  onResize: () => void
  rafId: number
  /** Inhaltsänderungen (Checkbox blendet Felder ein) → initialOffsetTop neu messen. */
  resizeObserver: ResizeObserver | null
  remeasureRafId: number
  /** Sektionsmenge/-reihenfolge/-labels beim letzten vollen Sync — gleich → kein Neuaufbau. */
  signature: string
}

const panelStateByRoot = new WeakMap<HTMLElement, PanelState>()

export function measureSettingsSectionHeadPx(head?: HTMLElement | null): number {
  if (head) {
    const h = head.getBoundingClientRect().height
    if (h > 0) return h
  }
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return SETTINGS_SECTION_HEAD_REM * (Number.isFinite(rootPx) && rootPx > 0 ? rootPx : 16)
}

/** Σ heights[from..to) — getStickedHeadersTotalHeight(start, end) in der Referenz. */
function sumHeights(heights: number[], from: number, to: number): number {
  let total = 0
  for (let i = from; i < to; i += 1) total += heights[i] ?? 0
  return total
}

/** Wrapper = nicht scrollender Containing Block (Referenz: `Wrapper` mit position: relative). */
function panelWrapper(panel: HTMLElement): HTMLElement {
  const wrapper = panel.closest<HTMLElement>('.right-selection-toolbar')
  return wrapper ?? panel
}

function clearHeaderStick(head: HTMLElement): void {
  head.style.position = ''
  head.style.top = ''
  head.style.bottom = ''
  head.style.left = ''
  head.style.right = ''
  head.style.width = ''
  head.style.zIndex = ''
  head.style.transform = ''
  head.classList.remove(
    'settings-section-head-parked',
    'settings-section-head-stuck-top',
    'settings-section-head-stuck-bottom',
  )
  // Platzhalter: Referenz setzt marginTop aufs nächste Geschwister — das würde bei uns
  // vorhandene margin-top (.toolbar-group 1.5rem) überschreiben und den Inhalt um die
  // Differenz springen lassen. Deshalb additiv als paddingTop der Sektion (exakt Kopfhöhe).
  const section = head.parentElement
  if (section instanceof HTMLElement && section.dataset.settingsHeadPad === '1') {
    section.style.paddingTop = ''
    delete section.dataset.settingsHeadPad
  }
  const legacyNext = head.nextElementSibling
  if (legacyNext instanceof HTMLElement && legacyNext.dataset.settingsHeadMargin === '1') {
    legacyNext.style.marginTop = ''
    delete legacyNext.dataset.settingsHeadMargin
  }
}

function sectionFilter(section: HTMLElement): boolean {
  return (
    section.isConnected &&
    !section.hidden &&
    !section.classList.contains('selection-tab-filtered-out') &&
    !section.classList.contains('settings-section-empty')
  )
}

/**
 * Die Referenz setzt voraus, dass die Kopf-Reihenfolge der DOM-Reihenfolge entspricht.
 * Unsere Sektionen sind nach `data-settings-order` sortiert (Maße → Farben → …), liegen im DOM
 * aber anders (z. B. Farben ganz unten). Deshalb Geschwister je Elternknoten umsortieren:
 * Einheit = Kind des Elternknotens; Rang = kleinster Sortierindex der enthaltenen Sektionen.
 * Kinder ohne Sektion (Aktionen, Hinweise) werden nicht bewegt.
 */
function orderSectionsInDom(panel: HTMLElement, sections: HTMLElement[]): void {
  const rank = new Map<HTMLElement, number>()
  sections.forEach((section, index) => rank.set(section, index))

  const parents = new Set<HTMLElement>()
  for (const section of sections) {
    let node: HTMLElement | null = section.parentElement
    while (node && node !== panel) {
      parents.add(node)
      node = node.parentElement
    }
    if (node === panel) parents.add(panel)
  }

  const unitRank = (unit: HTMLElement): number | null => {
    let best: number | null = null
    if (rank.has(unit)) best = rank.get(unit)!
    for (const [section, r] of rank) {
      if (unit !== section && unit.contains(section)) best = best == null ? r : Math.min(best, r)
    }
    return best
  }

  for (const parent of parents) {
    const rankedChildren = () =>
      [...parent.children]
        .filter((c): c is HTMLElement => c instanceof HTMLElement)
        .map((c) => ({ el: c, r: unitRank(c) }))
        .filter((u): u is { el: HTMLElement; r: number } => u.r != null)

    const desired = rankedChildren().sort((a, b) => a.r - b.r).map((u) => u.el)
    for (let i = 0; i < desired.length; i += 1) {
      const slots = rankedChildren().map((u) => u.el)
      const current = slots[i]
      const want = desired[i]!
      if (current && current !== want) parent.insertBefore(want, current)
    }
  }
}

const END_SPACER_CLASS = 'settings-section-end-spacer'

/** Unsichtbarer Nachlauf, damit auch die letzte Sektion per Klick bis unter den Top-Stapel scrollen kann. */
function ensureEndSpacer(panel: HTMLElement): HTMLElement {
  let spacer = panel.querySelector<HTMLElement>(`:scope > .${END_SPACER_CLASS}`)
  if (!spacer) {
    spacer = document.createElement('div')
    spacer.className = END_SPACER_CLASS
    spacer.setAttribute('aria-hidden', 'true')
  }
  if (panel.lastElementChild !== spacer) panel.appendChild(spacer)
  return spacer
}

function measurePanelLayout(panel: HTMLElement, sections: HTMLElement[]): PanelLayout | null {
  const headers = sections
    .map((section) => section.querySelector<HTMLElement>(':scope > .settings-section-head'))
    .filter((head): head is HTMLElement => head instanceof HTMLElement)
  if (headers.length === 0) return null

  // Während der Messung darf scrollHeight nie schrumpfen (Köpfe lösen entfernt Gaps),
  // sonst klemmt der Browser scrollTop sofort → Position verloren. Spacer temporär vergrößern.
  const spacer = ensureEndSpacer(panel)
  const previousSpacerH = spacer.getBoundingClientRect().height
  const tempSpacerH = previousSpacerH + panel.clientHeight
  spacer.style.height = `${tempSpacerH}px`
  headers.forEach(clearHeaderStick)

  const panelTop = panel.getBoundingClientRect().top
  const scrollTop = panel.scrollTop
  const heights = headers.map((head) => measureSettingsSectionHeadPx(head))
  // N[i]: natürliche Scroll-Y des Kopfes (alle Köpfe im Fluss).
  const initialOffsets = headers.map(
    (head) => head.getBoundingClientRect().top - panelTop + scrollTop,
  )
  // Ein absoluter Kopf nimmt in Flex-Spalten außer seiner Höhe auch den row-gap mit.
  const placeholders = sections.map((section, index) => {
    const cs = getComputedStyle(section)
    const isColumnFlex =
      cs.display.includes('flex') && (cs.flexDirection === 'column' || cs.flexDirection === 'column-reverse')
    const gap = isColumnFlex ? parseFloat(cs.rowGap) : 0
    return (heights[index] ?? 0) + (Number.isFinite(gap) ? gap : 0)
  })

  // Letzte Sektion muss bis unter den Top-Stapel scrollen können.
  const last = headers.length - 1
  const lastTargetScroll = (initialOffsets[last] ?? 0) - sumHeights(heights, 0, last)
  const maxScrollWithoutSpacer = panel.scrollHeight - tempSpacerH - panel.clientHeight
  const extra = Math.max(0, Math.ceil(lastTargetScroll - maxScrollWithoutSpacer))
  spacer.style.height = `${extra}px`

  return { sections, headers, heights, initialOffsets, placeholders }
}

/** Nur DOM-Writes — alle Layout-Reads (Rects, clientWidth) passieren VOR der Schleife im Update. */
function stickHeader(head: HTMLElement, leftPx: number, widthPx: number, index: number): void {
  head.style.position = 'absolute'
  head.style.left = `${leftPx}px`
  head.style.width = `${widthPx}px`
  head.style.zIndex = String(40 + index)
  head.classList.add('settings-section-head-parked')
}

/**
 * handleScroll der Referenz für alle Köpfe.
 */
export function updateScrollableSettingsPanel(panel: HTMLElement): void {
  const state = panelStateByRoot.get(panel)
  if (!state?.layout) return

  const { sections, headers, heights, initialOffsets, placeholders } = state.layout
  const n = sections.length
  if (n === 0 || sections.some((s) => !sectionFilter(s))) {
    // Sichtbarkeit hat sich geändert → Layout ungültig, neu messen.
    remeasurePanelLayout(panel, state.sections)
    return
  }

  const wrapper = panelWrapper(panel)
  const wrapperRect = wrapper.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const offsetTopInWrapper = panelRect.top - wrapperRect.top
  const offsetBottomInWrapper = wrapperRect.bottom - panelRect.bottom
  const leftInWrapper = panelRect.left - wrapperRect.left
  const scrollTop = panel.scrollTop
  const viewH = panel.clientHeight
  const viewW = panel.clientWidth
  // Ab hier nur noch DOM-Writes: Ein Layout-Read zwischen „Platzhalter entfernt“ und „neu
  // gesetzt“ würde den Inhalt kurz verkürzen und scrollTop am Ende klemmen (≈ Σ Gaps).

  let activeIndex = 0

  headers.forEach((head, index) => {
    const headH = placeholders[index] ?? heights[index] ?? 0
    const topSum = sumHeights(heights, 0, index)
    const tailSum = sumHeights(heights, index, n)
    const bottomSum = sumHeights(heights, index + 1, n)
    const initialOffsetTop = initialOffsets[index] ?? 0

    clearHeaderStick(head)

    // Platzhalter in beiden Klebe-Zuständen: Der Fluss (und damit scrollHeight) bleibt
    // zustandsunabhängig. Ohne Platzhalter unten wäre scrollHeight um Σh der unten geklebten
    // Köpfe kleiner → ein Sprung ans Ende (Klick, scrollTop=) klemmt am momentanen Maximum.
    const holdPlace = () => {
      const section = head.parentElement
      if (section instanceof HTMLElement) {
        section.style.paddingTop = `${headH}px`
        section.dataset.settingsHeadPad = '1'
      }
    }

    if (scrollTop + topSum >= initialOffsetTop - STICK_EPSILON_PX) {
      // Oben kleben: natürliche Viewport-Y des Kopfes ≤ Slot Σh(0..i)
      stickHeader(head, leftInWrapper, viewW, index)
      head.style.top = `${offsetTopInWrapper + topSum}px`
      head.classList.add('settings-section-head-stuck-top')
      holdPlace()
      activeIndex = index
    } else if (scrollTop + (viewH - tailSum) < initialOffsetTop) {
      // Unten kleben: natürliche Viewport-Y des Kopfes > Slot viewH − Σh(i..n)
      stickHeader(head, leftInWrapper, viewW, index)
      head.style.bottom = `${offsetBottomInWrapper + bottomSum}px`
      head.classList.add('settings-section-head-stuck-bottom')
      holdPlace()
    }
  })

  headers.forEach((head, index) => {
    head.classList.toggle('settings-section-head-active', index === activeIndex)
  })
}

function remeasurePanelLayout(panel: HTMLElement, sections: HTMLElement[]): void {
  const state = panelStateByRoot.get(panel)
  if (!state) return
  const live = sections.filter(sectionFilter)
  state.layout = live.length > 0 ? measurePanelLayout(panel, live) : null
  observeSections(state, panel, live)
  if (!state.layout) {
    for (const head of panel.querySelectorAll<HTMLElement>('.settings-section > .settings-section-head')) {
      clearHeaderStick(head)
    }
    return
  }
  updateScrollableSettingsPanel(panel)
}

/** Nach dem nächsten Frame neu messen (gebündelt). */
function scheduleRemeasure(state: PanelState, panel: HTMLElement): void {
  if (state.remeasureRafId) return
  state.remeasureRafId = requestAnimationFrame(() => {
    state.remeasureRafId = 0
    remeasurePanelLayout(panel, state.sections)
  })
}

/**
 * ResizeObserver auf Panel + Inhalts-Kinder der Sektionen (nicht die Sektionen selbst:
 * deren Höhe ändert sich planmäßig beim Kleben — Kopf raus aus dem Fluss / paddingTop rein —
 * und würde bei jedem Übergang ein Remeasure auslösen).
 */
function observeSections(state: PanelState, panel: HTMLElement, live: HTMLElement[]): void {
  if (typeof ResizeObserver === 'undefined') return
  if (!state.resizeObserver) {
    state.resizeObserver = new ResizeObserver(() => scheduleRemeasure(state, panel))
  }
  const ro = state.resizeObserver
  ro.disconnect()
  ro.observe(panel)
  for (const section of live) {
    for (const child of section.children) {
      if (child instanceof HTMLElement && !child.classList.contains('settings-section-head')) {
        ro.observe(child)
      }
    }
  }
}

/** scrollTo der Referenz: list.scrollTop = initialOffsetTop − Σh(0..index). */
export function scrollToSettingsSection(
  panel: HTMLElement,
  section: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  const state = panelStateByRoot.get(panel)
  if (!state?.layout) return
  const index = state.layout.sections.indexOf(section)
  if (index < 0) return

  const { heights, initialOffsets } = state.layout
  const targetTop = Math.max(0, Math.ceil((initialOffsets[index] ?? 0) - sumHeights(heights, 0, index)))
  panel.scrollTo({ top: targetTop, behavior })
  if (behavior === 'auto') updateScrollableSettingsPanel(panel)
}

function panelSignature(sections: HTMLElement[]): string {
  return sections
    .map(
      (s) =>
        `${s.id || s.dataset.settingsSection || ''}:${sectionFilter(s) ? 1 : 0}:${
          s.dataset.settingsLabel ?? s.dataset.settingsSection ?? ''
        }`,
    )
    .join('|')
}

export function syncScrollableSettingsPanel(panel: HTMLElement, sections: HTMLElement[]): void {
  // Wird bei jedem UI-Render aufgerufen: ohne Änderung an Menge/Reihenfolge/Labels nichts tun
  // (Inhaltsänderungen fängt der ResizeObserver). Sonst löst jeder Render ein Remeasure aus,
  // das die Köpfe kurz löst und am Scroll-Ende die Position klemmt.
  const signature = panelSignature(sections)
  const existing = panelStateByRoot.get(panel)
  if (existing && existing.layout && existing.signature === signature) return

  panel.classList.add('scrollable-settings-panel')
  panelWrapper(panel).classList.add('scrollable-settings-wrapper')

  for (const orphan of panel.querySelectorAll<HTMLElement>('.settings-section > .settings-section-head')) {
    const parent = orphan.parentElement
    if (!(parent instanceof HTMLElement) || !sections.includes(parent)) orphan.remove()
  }
  for (const spacer of panel.querySelectorAll<HTMLElement>('.settings-section-head-spacer')) {
    spacer.remove()
  }

  orderSectionsInDom(panel, sections)

  sections.forEach((section) => {
    let head = section.querySelector<HTMLElement>(':scope > .settings-section-head')
    if (!head) {
      head = document.createElement('div')
      head.className = 'settings-section-head'
      head.setAttribute('role', 'button')
      head.tabIndex = 0
      section.insertBefore(head, section.firstChild)
    }
    clearHeaderStick(head)
    const label = section.dataset.settingsLabel ?? section.dataset.settingsSection ?? ''
    if (head.textContent !== label) head.textContent = label
  })

  if (!panel.dataset.scrollableSettingsClickBound) {
    panel.dataset.scrollableSettingsClickBound = '1'
    panel.addEventListener('click', (ev) => {
      const raw = ev.target
      if (!(raw instanceof Element)) return
      const head = raw.closest('.settings-section-head')
      if (!(head instanceof HTMLElement) || !panel.contains(head)) return
      const target = head.parentElement
      if (!(target instanceof HTMLElement)) return
      scrollToSettingsSection(panel, target, 'smooth')
    })
    panel.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return
      const raw = ev.target
      if (!(raw instanceof Element) || !raw.classList.contains('settings-section-head')) return
      ev.preventDefault()
      raw.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  let state = panelStateByRoot.get(panel)
  if (!state) {
    const created: PanelState = {
      sections,
      layout: null,
      onScroll: () => {},
      onResize: () => {},
      rafId: 0,
      resizeObserver: null,
      remeasureRafId: 0,
      signature: '',
    }
    created.onScroll = () => {
      if (created.rafId) return
      created.rafId = requestAnimationFrame(() => {
        created.rafId = 0
        updateScrollableSettingsPanel(panel)
      })
    }
    created.onResize = () => remeasurePanelLayout(panel, created.sections)
    panel.addEventListener('scroll', created.onScroll, { passive: true })
    window.addEventListener('resize', created.onResize)
    panelStateByRoot.set(panel, created)
    state = created
  } else {
    state.sections = sections
  }
  state.signature = signature

  panel.style.scrollPaddingTop = ''
  panel.style.scrollPaddingBottom = ''
  remeasurePanelLayout(panel, sections)
}

export function detachScrollableSettingsPanel(panel: HTMLElement): void {
  const state = panelStateByRoot.get(panel)
  if (!state) return
  if (state.rafId) cancelAnimationFrame(state.rafId)
  if (state.remeasureRafId) cancelAnimationFrame(state.remeasureRafId)
  state.resizeObserver?.disconnect()
  panel.removeEventListener('scroll', state.onScroll)
  window.removeEventListener('resize', state.onResize)
  for (const head of panel.querySelectorAll<HTMLElement>('.settings-section > .settings-section-head')) {
    clearHeaderStick(head)
  }
  panel.querySelector(`:scope > .${END_SPACER_CLASS}`)?.remove()
  panelStateByRoot.delete(panel)
}
