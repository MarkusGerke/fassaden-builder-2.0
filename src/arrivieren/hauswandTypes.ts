export type HauswandEgType =
  | 'entrance'
  | 'driveway'
  | 'shopWindow'
  | 'shopfrontGroup'
  | 'residentialWindows'

export type HauswandBayShape = 'none' | 'rect' | 'angled45' | 'round'

export interface HauswandRegelwerk {
  version: string
  id: string
  title: string
  weights: {
    storeys: Record<string, number>
    axes: Record<string, number>
    egType: Record<string, number>
    bayPresence: {
      none: number
      present: number
      gate: { minStoreys: number; minAxes: number }
    }
    bayShapeWhenPresent: Record<string, number>
    bayAxisSpan: Record<string, number>
    bayHorizontalPlacement: Record<string, number>
  }
  constraints: {
    storeys: { min: number; max: number }
    axes: { min: number; softMax: number; hardMax: number }
  }
  feedbackSchema?: {
    brokenRules: string[]
  }
  enums: {
    egType: HauswandEgType[]
    bayShape: HauswandBayShape[]
  }
}

export interface HauswandOpeningSpec {
  x: number
  width: number
  height: number
  y: number
  type: 'window' | 'door'
}

export interface HauswandEgGroup {
  axisStart: number
  axisCount: number
  openings: HauswandOpeningSpec[]
}

export interface HauswandBayPlan {
  shape: Exclude<HauswandBayShape, 'none'>
  axisStart: number
  axisSpan: number
  /** Mitte der Erker-Mundöffnung in Wand-lokal X (cm). */
  centerLocalXCm: number
  presetId: string
}

export interface HauswandPlan {
  seed: number
  storeys: number
  axes: number
  /** Standard-Fensterbreite (Höhe 192 außer Shop/Keller). */
  windowWidthCm: number
  widthCm: number
  egType: HauswandEgType
  egGroups: HauswandEgGroup[]
  /** Fenster pro Achse OG (und ggf. EG bei Wohnfenster). */
  ogWindowByAxis: HauswandOpeningSpec[]
  bay: HauswandBayPlan | null
  snapshotDe: string
}

export type HauswandFeedbackVerdict = 'ok' | 'wrong'

export interface HauswandFeedbackEntry {
  ts: string
  seed: number
  snapshotDe: string
  plan: HauswandPlan
  verdict: HauswandFeedbackVerdict
  brokenRules: string[]
  note: string
  suggestedWeightTweaks?: string
}
