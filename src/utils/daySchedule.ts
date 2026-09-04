/**
 * Uhrzeit-Schedule für Lichter, Öffnungen und Rollläden.
 * Zeiten als Dezimalstunden 0…24 (Mitternacht wrap).
 */

export interface DaySchedule {
  /** Ein: Licht an / öffnen / Rollladen hoch */
  onTimes: number[]
  /** Aus: Licht aus / schließen / Rollladen runter */
  offTimes: number[]
}

export const EMPTY_DAY_SCHEDULE: DaySchedule = { onTimes: [], offTimes: [] }

const EPS = 1e-6

export function normalizeHour(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  let h = raw % 24
  if (h < 0) h += 24
  if (h >= 24 - EPS) h = 0
  return h
}

export function normalizeDaySchedule(raw: unknown): DaySchedule {
  if (!raw || typeof raw !== 'object') return { onTimes: [], offTimes: [] }
  const o = raw as { onTimes?: unknown; offTimes?: unknown }
  const clean = (list: unknown): number[] => {
    if (!Array.isArray(list)) return []
    const out: number[] = []
    const seen = new Set<string>()
    for (const item of list) {
      const h = normalizeHour(item)
      if (h == null) continue
      const key = h.toFixed(4)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(h)
    }
    out.sort((a, b) => a - b)
    return out
  }
  return { onTimes: clean(o.onTimes), offTimes: clean(o.offTimes) }
}

export function dayScheduleHasTimes(schedule: DaySchedule | undefined | null): boolean {
  if (!schedule) return false
  return schedule.onTimes.length > 0 || schedule.offTimes.length > 0
}

type ScheduleEvent = { t: number; on: boolean }

function eventsFromSchedule(schedule: DaySchedule): ScheduleEvent[] {
  const events: ScheduleEvent[] = [
    ...schedule.onTimes.map((t) => ({ t, on: true })),
    ...schedule.offTimes.map((t) => ({ t, on: false })),
  ]
  events.sort((a, b) => a.t - b.t || Number(a.on) - Number(b.on))
  return events
}

/**
 * Zustand laut letztem Event ≤ timeOfDay (Wrap über Mitternacht).
 * Leere Listen → false (kein Clock-Trigger).
 */
export function scheduleSaysOn(schedule: DaySchedule | undefined | null, timeOfDay: number): boolean {
  const s = normalizeDaySchedule(schedule ?? EMPTY_DAY_SCHEDULE)
  if (!dayScheduleHasTimes(s)) return false
  const t = normalizeHour(timeOfDay) ?? 0
  const events = eventsFromSchedule(s)
  if (events.length === 0) return false
  let last: ScheduleEvent | null = null
  for (const ev of events) {
    if (ev.t <= t + EPS) last = ev
  }
  if (!last) {
    // Vor dem ersten Event heute → letztes Event von „gestern“ (Ende der Liste)
    last = events[events.length - 1]!
  }
  return last.on
}

export interface ScheduleCrossing {
  turnedOn: boolean
  turnedOff: boolean
}

/**
 * Crossing zwischen prevTime und nextTime (vorwärts, inkl. Wrap).
 * Mehrere Events im Intervall: nur das letzte zählt für turnedOn/Off.
 */
export function scheduleCrossings(
  schedule: DaySchedule | undefined | null,
  prevTime: number,
  nextTime: number,
): ScheduleCrossing {
  const s = normalizeDaySchedule(schedule ?? EMPTY_DAY_SCHEDULE)
  const out: ScheduleCrossing = { turnedOn: false, turnedOff: false }
  if (!dayScheduleHasTimes(s)) return out
  const prev = normalizeHour(prevTime) ?? 0
  const next = normalizeHour(nextTime) ?? 0
  const events = eventsFromSchedule(s)
  const crossed: ScheduleEvent[] = []
  if (next >= prev - EPS) {
    for (const ev of events) {
      if (ev.t > prev + EPS && ev.t <= next + EPS) crossed.push(ev)
    }
  } else {
    // Wrap über Mitternacht
    for (const ev of events) {
      if (ev.t > prev + EPS || ev.t <= next + EPS) crossed.push(ev)
    }
  }
  if (crossed.length === 0) return out
  const last = crossed[crossed.length - 1]!
  if (last.on) out.turnedOn = true
  else out.turnedOff = true
  return out
}

export function formatScheduleHour(h: number): string {
  const clamped = normalizeHour(h) ?? 0
  const hours = Math.floor(clamped + EPS)
  const minutes = Math.round((clamped - hours) * 60)
  const mm = ((minutes % 60) + 60) % 60
  const hh = minutes >= 60 ? (hours + 1) % 24 : hours % 24
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function parseScheduleHourInput(raw: string): number | null {
  const t = raw.trim()
  const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(t)
  if (!m) {
    const asNum = Number.parseFloat(t.replace(',', '.'))
    return normalizeHour(asNum)
  }
  const hh = Number.parseInt(m[1]!, 10)
  const mm = m[2] != null ? Number.parseInt(m[2], 10) : 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 24 || mm < 0 || mm > 59) {
    return null
  }
  if (hh === 24 && mm === 0) return 0
  if (hh >= 24) return null
  return normalizeHour(hh + mm / 60)
}
