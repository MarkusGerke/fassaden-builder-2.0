import type { HauswandRegelwerk } from './hauswandTypes'
import rulesJson from './rules/hauswand-regelwerk.json'

export const HAUSWAND_REGELWERK = rulesJson as HauswandRegelwerk

export const HAUSWAND_FEEDBACK_STORAGE_KEY = 'fassaden-arrivieren-hauswand-feedback/v1'

export const HAUSWAND_BROKEN_RULE_LABELS: Record<string, string> = {
  storeys: 'Geschosse',
  axes: 'Achsen',
  width: 'Breite',
  egType: 'EG-Typ',
  egAlignment: 'EG-Achsen',
  ogWindows: 'OG-Fenster',
  bayPlacement: 'Erker-Position',
  bayStacking: 'Erker-Stapel',
  proportions: 'Proportionen',
  other: 'Sonstiges',
}
