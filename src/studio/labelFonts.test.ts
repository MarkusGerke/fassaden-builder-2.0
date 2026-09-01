import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABEL_FONT_ID,
  LABEL_FONTS,
  getLabelFont,
  resolveLabelFontId,
} from './labelFonts'

describe('labelFonts', () => {
  it('kennt Federo und die Peter-Wiegel-Schriften eindeutig', () => {
    const ids = LABEL_FONTS.map((font) => font.id)
    expect(ids).toContain('federo')
    expect(ids).toContain('berlin-email')
    expect(ids).toContain('berliner-wand')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mappt unbekannte und Legacy-IDs auf Federo', () => {
    expect(resolveLabelFontId(undefined)).toBe(DEFAULT_LABEL_FONT_ID)
    expect(resolveLabelFontId('helvetiker')).toBe(DEFAULT_LABEL_FONT_ID)
    expect(resolveLabelFontId('not-a-font')).toBe(DEFAULT_LABEL_FONT_ID)
    expect(resolveLabelFontId('rumburak')).toBe('rumburak')
    expect(getLabelFont('waschkueche').license).toBe('cc-by-nc-sa-3.0-de')
    expect(getLabelFont('berliner-wand').license).toBe('ofl-1.1')
  })

  it('hat TTF und Typeface für jede Schrift', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../public')
    expect(LABEL_FONTS).toHaveLength(19)
    for (const font of LABEL_FONTS) {
      const dir = font.dir ? join(root, 'fonts', font.dir) : join(root, 'fonts')
      expect(existsSync(join(dir, font.file)), font.file).toBe(true)
      const typeface = font.file.replace(/\.ttf$/i, '.typeface.json')
      expect(existsSync(join(dir, typeface)), typeface).toBe(true)
    }
    expect(getLabelFont('berlin-email').sourceFolder).toBe('BerlinEmailTT')
  })
})
