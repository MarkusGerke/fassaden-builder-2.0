import type { ProfileDefinition, ProfileRenderContext, ProfileSectionPoint } from './types'

const NS = 'http://www.w3.org/2000/svg'

export const PROJECTING_OUTWARD = 12
export const PROJECTING_FORWARD = 8
export const PROJECTING_THICKNESS = 4

export const PROJECTING_SECTION: ProfileSectionPoint[] = [
  { outward: 0, forward: 0 },
  { outward: PROJECTING_OUTWARD, forward: 0 },
  { outward: PROJECTING_OUTWARD, forward: PROJECTING_FORWARD },
  { outward: PROJECTING_OUTWARD - PROJECTING_THICKNESS, forward: PROJECTING_FORWARD },
  { outward: PROJECTING_OUTWARD - PROJECTING_THICKNESS, forward: PROJECTING_THICKNESS },
  { outward: 0, forward: PROJECTING_THICKNESS },
]

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag)
}

export const projectingProfile: ProfileDefinition = {
  id: 'projecting',
  label: 'Gesims (einfach)',
  depth: PROJECTING_OUTWARD,
  tileLength: PROJECTING_OUTWARD,
  projecting: true,
  forward: PROJECTING_FORWARD,
  section: PROJECTING_SECTION,
  renderEdge(parent, context: ProfileRenderContext) {
    const { edge, length, x, y } = context
    const vertical = edge === 'left' || edge === 'right'
    const rect = createSvgElement('rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(vertical ? PROJECTING_OUTWARD : length))
    rect.setAttribute('height', String(vertical ? length : PROJECTING_OUTWARD))
    rect.setAttribute('fill', '#c4b49a')
    rect.setAttribute('stroke', '#8a7349')
    rect.setAttribute('stroke-width', '0.7')
    parent.appendChild(rect)
  },
}
