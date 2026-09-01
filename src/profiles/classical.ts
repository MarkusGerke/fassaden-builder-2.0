import type { ProfileDefinition, ProfileRenderContext } from './types'

const NS = 'http://www.w3.org/2000/svg'

export const CLASSICAL_PROFILE_DEPTH = 16
export const CLASSICAL_TILE_LENGTH = 16

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag)
}

function renderTile(
  parent: SVGGElement,
  x: number,
  y: number,
  along: number,
  depth: number,
  vertical: boolean,
) {
  const group = createSvgElement('g')
  const width = vertical ? depth : along
  const height = vertical ? along : depth

  const outer = createSvgElement('rect')
  outer.setAttribute('x', String(x))
  outer.setAttribute('y', String(y))
  outer.setAttribute('width', String(width))
  outer.setAttribute('height', String(height))
  outer.setAttribute('fill', '#d9c7a3')
  outer.setAttribute('stroke', '#8a7349')
  outer.setAttribute('stroke-width', '0.6')
  group.appendChild(outer)

  const inset = 3
  const mid = createSvgElement('rect')
  mid.setAttribute('x', String(x + (vertical ? inset : 2)))
  mid.setAttribute('y', String(y + (vertical ? 2 : inset)))
  mid.setAttribute('width', String(Math.max(1, width - (vertical ? inset * 2 : 4))))
  mid.setAttribute('height', String(Math.max(1, height - (vertical ? 4 : inset * 2))))
  mid.setAttribute('fill', '#efe3c8')
  mid.setAttribute('stroke', '#a48b5c')
  mid.setAttribute('stroke-width', '0.5')
  group.appendChild(mid)

  const bead = createSvgElement('rect')
  if (vertical) {
    bead.setAttribute('x', String(x + depth - 5))
    bead.setAttribute('y', String(y + 3))
    bead.setAttribute('width', '2.5')
    bead.setAttribute('height', String(Math.max(1, along - 6)))
  } else {
    bead.setAttribute('x', String(x + 3))
    bead.setAttribute('y', String(y + depth - 5))
    bead.setAttribute('width', String(Math.max(1, along - 6)))
    bead.setAttribute('height', '2.5')
  }
  bead.setAttribute('fill', '#b89a63')
  group.appendChild(bead)

  parent.appendChild(group)
}

export const classicalProfile: ProfileDefinition = {
  id: 'classical',
  label: 'Fenster-/Türprofil',
  depth: CLASSICAL_PROFILE_DEPTH,
  tileLength: CLASSICAL_TILE_LENGTH,
  renderEdge(parent, context: ProfileRenderContext) {
    const { edge, length, x, y } = context
    const vertical = edge === 'left' || edge === 'right'
    const tileCount = Math.max(1, Math.round(length / CLASSICAL_TILE_LENGTH))
    const tileSize = length / tileCount

    for (let i = 0; i < tileCount; i += 1) {
      const offset = i * tileSize
      renderTile(
        parent,
        vertical ? x : x + offset,
        vertical ? y + offset : y,
        tileSize,
        CLASSICAL_PROFILE_DEPTH,
        vertical,
      )
    }
  },
}
