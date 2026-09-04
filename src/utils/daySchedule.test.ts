import { describe, expect, it } from 'vitest'
import {
  formatScheduleHour,
  normalizeDaySchedule,
  parseScheduleHourInput,
  scheduleCrossings,
  scheduleSaysOn,
} from './daySchedule'

describe('daySchedule', () => {
  it('leere Listen → scheduleSaysOn false', () => {
    expect(scheduleSaysOn({ onTimes: [], offTimes: [] }, 20)).toBe(false)
    expect(scheduleSaysOn(undefined, 20)).toBe(false)
  })

  it('letzter Event ≤ Zeit entscheidet', () => {
    const s = { onTimes: [18], offTimes: [7] }
    expect(scheduleSaysOn(s, 19)).toBe(true)
    expect(scheduleSaysOn(s, 6)).toBe(true) // Wrap: letztes Event 18 on
    expect(scheduleSaysOn(s, 8)).toBe(false)
    expect(scheduleSaysOn(s, 17.5)).toBe(false)
  })

  it('Crossings vorwärts und über Mitternacht', () => {
    const s = { onTimes: [18], offTimes: [7] }
    expect(scheduleCrossings(s, 17.9, 18.1)).toEqual({ turnedOn: true, turnedOff: false })
    expect(scheduleCrossings(s, 6.9, 7.1)).toEqual({ turnedOn: false, turnedOff: true })
    expect(scheduleCrossings(s, 23.5, 0.5)).toEqual({ turnedOn: false, turnedOff: false })
    expect(scheduleCrossings(s, 6.5, 7.5).turnedOff).toBe(true)
  })

  it('normalize dedupliziert und sortiert', () => {
    expect(normalizeDaySchedule({ onTimes: [20, 8, 8], offTimes: [22] })).toEqual({
      onTimes: [8, 20],
      offTimes: [22],
    })
  })

  it('parse/format HH:MM', () => {
    expect(parseScheduleHourInput('18:30')).toBeCloseTo(18.5, 5)
    expect(formatScheduleHour(18.5)).toBe('18:30')
  })
})
