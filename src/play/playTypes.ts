/** Typen für kuratierte Start-Fassaden (Bibliothek → Fassade). */

export const PLAY_WHITE = '#ffffff'

export interface PlayStarterDef {
  id: string
  name: string
  /** Kurz für die Karte. */
  blurb: string
  /** Fester Arrivieren-Seed → reproduzierbare Hülle + Standard-Öffnungen. */
  seed: number
  storeysHint: string
}
