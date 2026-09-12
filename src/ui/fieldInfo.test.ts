/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  ensureUnitInNearbyLabel,
  hasManualPlusMinusNeighbors,
  inferFieldUnit,
  splitEmDashExplanation,
} from './fieldInfo'

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

describe('inferFieldUnit', () => {
  it('nimmt data-unit bevorzugt', () => {
    const input = document.createElement('input')
    input.type = 'number'
    input.dataset.unit = '%'
    expect(inferFieldUnit(input)).toBe('%')
  })

  it('liest (cm) aus dem Gruppen-Label', () => {
    const group = document.createElement('div')
    group.className = 'toolbar-group'
    const label = document.createElement('span')
    label.className = 'toolbar-label'
    label.textContent = 'Höhe (cm)'
    const input = document.createElement('input')
    input.type = 'number'
    group.append(label, input)
    document.body.appendChild(group)
    expect(inferFieldUnit(input)).toBe('cm')
    group.remove()
  })

  it('liest Einheit aus title', () => {
    const input = document.createElement('input')
    input.type = 'number'
    input.title = 'cm, 8er-Raster'
    expect(inferFieldUnit(input)).toBe('cm')
  })
})

describe('ensureUnitInNearbyLabel', () => {
  it('ergänzt (cm) am Label wenn nur im title', () => {
    const group = document.createElement('div')
    group.className = 'toolbar-group'
    const label = document.createElement('span')
    label.className = 'toolbar-label'
    label.appendChild(document.createTextNode('Horizontale Position'))
    const input = document.createElement('input')
    input.type = 'number'
    input.title = 'cm, 8er-Raster'
    group.append(label, input)
    document.body.appendChild(group)
    ensureUnitInNearbyLabel(input)
    expect(label.textContent?.trim()).toBe('Horizontale Position (cm)')
    group.remove()
  })

  it('verdoppelt (cm) nicht', () => {
    const group = document.createElement('div')
    group.className = 'toolbar-group'
    const label = document.createElement('span')
    label.className = 'toolbar-label'
    label.appendChild(document.createTextNode('Breite (cm)'))
    const input = document.createElement('input')
    input.type = 'number'
    group.append(label, input)
    document.body.appendChild(group)
    ensureUnitInNearbyLabel(input)
    expect(label.textContent?.trim()).toBe('Breite (cm)')
    group.remove()
  })
})

describe('hasManualPlusMinusNeighbors', () => {
  it('erkennt Studio-±-Gruppe', () => {
    const group = document.createElement('div')
    group.className = 'preset-group'
    const minus = document.createElement('button')
    minus.textContent = '−'
    const input = document.createElement('input')
    input.type = 'number'
    const plus = document.createElement('button')
    plus.textContent = '+'
    group.append(minus, input, plus)
    expect(hasManualPlusMinusNeighbors(input)).toBe(true)
  })

  it('ignoriert Richtungschips ohne ±', () => {
    const group = document.createElement('div')
    group.className = 'preset-group'
    const left = document.createElement('button')
    left.textContent = '←'
    const input = document.createElement('input')
    input.type = 'number'
    group.append(left, input)
    expect(hasManualPlusMinusNeighbors(input)).toBe(false)
  })
})
