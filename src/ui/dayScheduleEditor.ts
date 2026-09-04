import {
  formatScheduleHour,
  normalizeDaySchedule,
  parseScheduleHourInput,
  type DaySchedule,
} from '../utils/daySchedule'

export interface DayScheduleEditorHost {
  getSchedule: () => DaySchedule
  setSchedule: (schedule: DaySchedule) => void
}

function listEl(container: HTMLElement, kind: 'on' | 'off'): HTMLUListElement {
  const id = kind === 'on' ? 'on-list' : 'off-list'
  let ul = container.querySelector<HTMLUListElement>(`ul[data-schedule-list="${id}"]`)
  if (!ul) {
    ul = document.createElement('ul')
    ul.dataset.scheduleList = id
    ul.className = 'day-schedule-list'
  }
  return ul
}

function renderList(
  ul: HTMLUListElement,
  times: number[],
  onRemove: (hour: number) => void,
): void {
  ul.replaceChildren()
  for (const hour of times) {
    const li = document.createElement('li')
    li.className = 'day-schedule-item'
    const label = document.createElement('span')
    label.textContent = formatScheduleHour(hour)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'preset-btn day-schedule-remove'
    remove.textContent = '×'
    remove.title = 'Zeit entfernen'
    remove.addEventListener('click', () => onRemove(hour))
    li.append(label, remove)
    ul.append(li)
  }
  if (times.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'day-schedule-empty'
    empty.textContent = 'Keine Zeiten'
    ul.append(empty)
  }
}

/**
 * Bindet Ein-/Aus-Zeitlisten an einen Container (Licht, Öffnung, Rollladen).
 * Erwartet Markup mit `.day-schedule-on` / `.day-schedule-off` und time+button Inputs.
 */
export function bindDayScheduleEditor(
  container: HTMLElement,
  host: DayScheduleEditorHost,
): { sync: () => void } {
  const onBlock = container.querySelector<HTMLElement>('.day-schedule-on')
  const offBlock = container.querySelector<HTMLElement>('.day-schedule-off')
  if (!onBlock || !offBlock) {
    return { sync: () => undefined }
  }

  const onList = listEl(container, 'on')
  const offList = listEl(container, 'off')
  const onMount = onBlock.querySelector('.day-schedule-list-mount') ?? onBlock
  const offMount = offBlock.querySelector('.day-schedule-list-mount') ?? offBlock
  if (!onList.parentElement) onMount.append(onList)
  if (!offList.parentElement) offMount.append(offList)

  const onInput = onBlock.querySelector<HTMLInputElement>('input[data-schedule-add="on"]')
  const offInput = offBlock.querySelector<HTMLInputElement>('input[data-schedule-add="off"]')
  const onAddBtn = onBlock.querySelector<HTMLButtonElement>('button[data-schedule-add="on"]')
  const offAddBtn = offBlock.querySelector<HTMLButtonElement>('button[data-schedule-add="off"]')

  const apply = (mutator: (s: DaySchedule) => DaySchedule) => {
    const next = normalizeDaySchedule(mutator(host.getSchedule()))
    host.setSchedule(next)
    sync()
  }

  const addTime = (kind: 'on' | 'off', raw: string) => {
    const hour = parseScheduleHourInput(raw)
    if (hour == null) return
    apply((s) => {
      const key = kind === 'on' ? 'onTimes' : 'offTimes'
      if (s[key].some((t) => Math.abs(t - hour) < 1e-4)) return s
      return { ...s, [key]: [...s[key], hour] }
    })
  }

  onAddBtn?.addEventListener('click', () => {
    if (!onInput) return
    addTime('on', onInput.value)
    onInput.value = ''
  })
  offAddBtn?.addEventListener('click', () => {
    if (!offInput) return
    addTime('off', offInput.value)
    offInput.value = ''
  })
  onInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    addTime('on', onInput.value)
    onInput.value = ''
  })
  offInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    addTime('off', offInput.value)
    offInput.value = ''
  })

  function sync(): void {
    const s = normalizeDaySchedule(host.getSchedule())
    renderList(onList, s.onTimes, (hour) =>
      apply((cur) => ({
        ...cur,
        onTimes: cur.onTimes.filter((t) => Math.abs(t - hour) >= 1e-4),
      })),
    )
    renderList(offList, s.offTimes, (hour) =>
      apply((cur) => ({
        ...cur,
        offTimes: cur.offTimes.filter((t) => Math.abs(t - hour) >= 1e-4),
      })),
    )
  }

  sync()
  return { sync }
}
