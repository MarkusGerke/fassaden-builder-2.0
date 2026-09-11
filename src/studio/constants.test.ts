import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STUDIO_PANEL,
  studioPanelDefaultsForPattern,
} from './constants'

describe('studioPanelDefaultsForPattern', () => {
  it('Streifen: 64×32, Reihen oben sichtbar', () => {
    expect(studioPanelDefaultsForPattern('strip')).toEqual({
      panelWidth: 64,
      panelHeight: 32,
      projectDepth: 4,
      hideRowsBottom: 0,
      hideRowsTop: 0,
    })
  })

  it('Läuferverband: 48×24, Bossen 1 / 0,8', () => {
    expect(studioPanelDefaultsForPattern('runningBond')).toEqual({
      panelWidth: 48,
      panelHeight: 24,
      projectDepth: 4,
      hideRowsBottom: 0,
      hideRowsTop: 0,
      taperDepth: 1,
      taper: 0.8,
    })
  })

  it('Kopfverband: 24×8, ohne Bossen-Vorstand', () => {
    expect(studioPanelDefaultsForPattern('headerBond')).toEqual({
      panelWidth: 24,
      panelHeight: 8,
      projectDepth: 4,
      hideRowsBottom: 0,
      hideRowsTop: 0,
      taperDepth: 0,
    })
  })

  it('unbekannte Muster ändern keine Maße', () => {
    expect(studioPanelDefaultsForPattern('englishBond')).toEqual({})
    expect(studioPanelDefaultsForPattern('none')).toEqual({})
  })
})

describe('DEFAULT_STUDIO_PANEL', () => {
  it('entspricht Streifen + Sockel 64×8', () => {
    expect(DEFAULT_STUDIO_PANEL.pattern).toBe('strip')
    expect(DEFAULT_STUDIO_PANEL.panelWidth).toBe(64)
    expect(DEFAULT_STUDIO_PANEL.panelHeight).toBe(32)
    expect(DEFAULT_STUDIO_PANEL.hideRowsTop).toBe(0)
    expect(DEFAULT_STUDIO_PANEL.plinthHeight).toBe(64)
    expect(DEFAULT_STUDIO_PANEL.plinthDepth).toBe(8)
  })
})
