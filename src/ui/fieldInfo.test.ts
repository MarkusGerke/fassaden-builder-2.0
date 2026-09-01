import { describe, expect, it } from 'vitest'
import { splitEmDashExplanation } from './fieldInfo'

describe('splitEmDashExplanation', () => {
  it('trennt Label und Erklärung am Gedankenstrich', () => {
    expect(splitEmDashExplanation('Fugenbreite — Abstand zwischen Steinen (cm)')).toEqual({
      title: 'Fugenbreite (cm)',
      hint: 'Abstand zwischen Steinen',
    })
  })

  it('lässt Labels ohne Gedankenstrich unverändert', () => {
    expect(splitEmDashExplanation('Paneelfarbe')).toEqual({ title: 'Paneelfarbe' })
  })
})
