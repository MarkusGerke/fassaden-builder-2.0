import { APP_VERSION } from '../version'

/** Lizenz der eingebundenen Fassaden-Schriften. */
export type LabelFontLicenseId = 'ofl-1.1' | 'cc-by-nc-sa-3.0-de'

export interface LabelFontDef {
  id: string
  /** Anzeigename in der Schriftwahl. */
  name: string
  /** CSS `font-family` für Vorschau und Canvas. */
  family: string
  /** Dateiname unter `public/fonts/` bzw. `public/fonts/peter-wiegel/`. */
  file: string
  designer: string
  license: LabelFontLicenseId
  sourceUrl: string
  /** Unterordner: leer = `public/fonts/`, sonst z. B. `peter-wiegel`. */
  dir: string
  /** Ursprungsordner im Peter-Wiegel-Paket; leer bei Federo. */
  sourceFolder: string
}

export const DEFAULT_LABEL_FONT_ID = 'federo'

export const LABEL_FONT_LICENSES: Record<
  LabelFontLicenseId,
  { name: string; url: string; file?: string }
> = {
  'ofl-1.1': {
    name: 'SIL Open Font License 1.1',
    url: 'https://scripts.sil.org/OFL',
    file: '/fonts/licenses/OFL-1.1.txt',
  },
  'cc-by-nc-sa-3.0-de': {
    name: 'CC BY-NC-SA 3.0 DE (Namensnennung – Nicht kommerziell – Weitergabe unter gleichen Bedingungen)',
    url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/de/',
  },
}

const PETER = {
  designer: 'Peter Wiegel',
  sourceUrl: 'https://www.peter-wiegel.de',
  dir: 'peter-wiegel',
} as const

function pw(
  id: string,
  name: string,
  file: string,
  license: LabelFontLicenseId,
  sourceFolder: string,
): LabelFontDef {
  return {
    id,
    name,
    family: `Fassade ${name}`,
    file,
    license,
    sourceFolder,
    ...PETER,
  }
}

/** Federo plus Peter-Wiegel-Schriften (eine Schnittleiste je Ordner, plus Waschküche grob). */
export const LABEL_FONTS: readonly LabelFontDef[] = [
  {
    id: 'federo',
    name: 'Federo',
    family: 'Federo',
    file: 'Federo-Regular.ttf',
    designer: 'Cyreal',
    license: 'ofl-1.1',
    sourceUrl: 'https://fonts.google.com/specimen/Federo',
    dir: '',
    sourceFolder: '',
  },
  pw('berlin-email', 'Berlin Email', 'berlin-email.ttf', 'cc-by-nc-sa-3.0-de', 'BerlinEmailTT'),
  pw('berliner-wand', 'Berliner Wand', 'berliner-wand.ttf', 'ofl-1.1', 'Berliner_Wand'),
  pw('bombe-cat', 'Bombe CAT', 'bombe-cat.ttf', 'ofl-1.1', 'Bombe_CAT'),
  pw('cat-neuzeit', 'CAT Neuzeit', 'cat-neuzeit.ttf', 'ofl-1.1', 'CATNeuzeit'),
  pw('cat-reporter', 'CAT Reporter', 'cat-reporter.ttf', 'ofl-1.1', 'CATReporter'),
  pw('din-1451-breit', 'DIN 1451 breit', 'din-1451-breit.ttf', 'ofl-1.1', 'DIN1451breit'),
  pw('flottflott', 'Flottflott', 'flottflott.ttf', 'ofl-1.1', 'Flottflott'),
  pw('hardman', 'Hardman', 'hardman.ttf', 'ofl-1.1', 'Hardman'),
  pw('mammut-cat', 'Mammut CAT', 'mammut-cat.ttf', 'ofl-1.1', 'MammutCAT'),
  pw('mammut-ot-cat', 'Mammut OT CAT', 'mammut-ot-cat.ttf', 'ofl-1.1', 'Mammut_OT_CAT'),
  pw('osterbar', 'Osterbar', 'osterbar.ttf', 'ofl-1.1', 'Osterbar'),
  pw('phanta-du', 'Phanta Du', 'phanta-du.ttf', 'ofl-1.1', 'PhantaDu'),
  pw('rumburak', 'Rumburak', 'rumburak.ttf', 'ofl-1.1', 'Rumburak'),
  pw('rundkursiv', 'Rundkursiv', 'rundkursiv.ttf', 'ofl-1.1', 'Rundkursiv'),
  pw('secession', 'Secession', 'secession.ttf', 'ofl-1.1', 'Secession'),
  pw('vorgang', 'Vorgang', 'vorgang.ttf', 'ofl-1.1', 'Vorgang'),
  pw('waschkueche', 'Waschküche', 'waschkueche.ttf', 'cc-by-nc-sa-3.0-de', 'WaschkuecheTT'),
  pw('waschkueche-grob', 'Waschküche grob', 'waschkueche-grob.ttf', 'cc-by-nc-sa-3.0-de', 'WaschkuecheTT'),
]

const byId = new Map(LABEL_FONTS.map((font) => [font.id, font]))

export function labelFontPublicDir(font: LabelFontDef): string {
  return font.dir ? `/fonts/${font.dir}` : '/fonts'
}

export function labelFontTtfUrl(font: LabelFontDef): string {
  return `${labelFontPublicDir(font)}/${font.file}?v=${APP_VERSION}`
}

export function labelFontTypefaceUrl(font: LabelFontDef): string {
  const json = font.file.replace(/\.ttf$/i, '.typeface.json')
  return `${labelFontPublicDir(font)}/${json}?v=${APP_VERSION}`
}

export function getLabelFont(id: string | undefined): LabelFontDef {
  if (id && byId.has(id)) return byId.get(id)!
  return byId.get(DEFAULT_LABEL_FONT_ID)!
}

/** Unbekannte IDs und Legacy `helvetiker` → Federo. */
export function resolveLabelFontId(id: string | undefined): string {
  if (!id || id === 'helvetiker') return DEFAULT_LABEL_FONT_ID
  return byId.has(id) ? id : DEFAULT_LABEL_FONT_ID
}

export function labelFontFaceCss(): string {
  return LABEL_FONTS.map(
    (font) =>
      `@font-face{font-family:'${font.family}';src:url('${labelFontTtfUrl(font)}') format('truetype');font-weight:400;font-style:normal;font-display:swap;}`,
  ).join('\n')
}

export function injectLabelFontFaces(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('label-font-faces')) return
  const style = document.createElement('style')
  style.id = 'label-font-faces'
  style.textContent = labelFontFaceCss()
  document.head.appendChild(style)
}
