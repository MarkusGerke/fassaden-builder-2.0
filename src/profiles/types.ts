import type { OpeningEdge } from '../types/facade'

export interface ProfileRenderContext {
  edge: OpeningEdge
  length: number
  x: number
  y: number
}

export interface ProfileSectionPoint {
  outward: number
  forward: number
}

export interface ProfileDefinition {
  id: string
  label: string
  depth: number
  tileLength: number
  projecting?: boolean
  forward?: number
  section?: ProfileSectionPoint[]
  renderEdge(parent: SVGGElement, context: ProfileRenderContext): void
}
