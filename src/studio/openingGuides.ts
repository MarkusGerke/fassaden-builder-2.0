import type { Opening, Wall } from '../types/facade'
import { wallElevationAlong } from './elevation'

/** Anzeige-Toleranz für Hilfslinien (cm); Snap bleibt 8 cm. */
export const OPENING_GUIDE_TOLERANCE = 0.5

export type OpeningGuideKind =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'midX'
  | 'midY'
  | 'wallMidX'
  | 'wallThird1X'
  | 'wallThird2X'
  | 'wallQuarter1X'
  | 'wallQuarter3X'
  | 'wallMidY'
  | 'wallThird1Y'
  | 'wallThird2Y'
  | 'wallQuarter1Y'
  | 'wallQuarter3Y'
  | 'selfLeft'
  | 'selfRight'
  | 'selfMidX'
  | 'selfTop'
  | 'selfBottom'
  | 'selfMidY'

export type OpeningGuide = {
  kind: OpeningGuideKind
  /** Wand-lokal X/Y oder globaler Aufriss-X (siehe `space`). */
  value: number
  orientation: 'vertical' | 'horizontal'
  /** Koordinatenraum der `value`-Angabe. */
  space: 'wallLocal' | 'elevationX'
  /** Wand für wand-lokale Linien (3D + SVG). */
  wallId?: string
  source: 'self' | 'align'
}

type EdgeValues = {
  left: number
  right: number
  top: number
  bottom: number
  midX: number
  midY: number
}

const WALL_X_MARKS: { kind: OpeningGuideKind; frac: number }[] = [
  { kind: 'wallQuarter1X', frac: 0.25 },
  { kind: 'wallThird1X', frac: 1 / 3 },
  { kind: 'wallMidX', frac: 0.5 },
  { kind: 'wallThird2X', frac: 2 / 3 },
  { kind: 'wallQuarter3X', frac: 0.75 },
]

const WALL_Y_MARKS: { kind: OpeningGuideKind; frac: number }[] = [
  { kind: 'wallQuarter1Y', frac: 0.25 },
  { kind: 'wallThird1Y', frac: 1 / 3 },
  { kind: 'wallMidY', frac: 0.5 },
  { kind: 'wallThird2Y', frac: 2 / 3 },
  { kind: 'wallQuarter3Y', frac: 0.75 },
]

function edgesOf(opening: Opening): EdgeValues {
  return {
    left: opening.x,
    right: opening.x + opening.width,
    bottom: opening.y,
    top: opening.y + opening.height,
    midX: opening.x + opening.width / 2,
    midY: opening.y + opening.height / 2,
  }
}

function near(a: number, b: number, tol = OPENING_GUIDE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

function globalOpeningX(wall: Wall, localX: number): number {
  return wallElevationAlong(wall) + localX
}

function mergeGuides(into: OpeningGuide[], add: OpeningGuide[]): OpeningGuide[] {
  const seen = new Set(into.map((g) => `${g.space}:${g.orientation}:${g.kind}:${g.value.toFixed(2)}`))
  for (const g of add) {
    const key = `${g.space}:${g.orientation}:${g.kind}:${g.value.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    into.push(g)
  }
  return into
}

/**
 * Hilfslinien beim Verschieben:
 * - Eigene Kanten/Mitten des aktiven Elements (immer sichtbar, vertikal + horizontal)
 * - Ausrichtung an anderen Öffnungen (Kanten/Mitten, auch über Wandgrenzen auf derselben Etage)
 * - Wand-Referenzen: 1/4, 1/3, 1/2, 2/3, 3/4
 */
export function computeOpeningGuides(
  wall: Wall,
  active: Opening,
  floorWalls: Wall[] = [wall],
): OpeningGuide[] {
  const a = edgesOf(active)
  const guides: OpeningGuide[] = []
  const seen = new Set<string>()

  const push = (guide: OpeningGuide) => {
    const key = `${guide.space}:${guide.orientation}:${guide.kind}:${guide.value.toFixed(2)}:${guide.source}`
    if (seen.has(key)) return
    seen.add(key)
    guides.push(guide)
  }

  const pushLocalVertical = (
    kind: OpeningGuideKind,
    value: number,
    source: 'self' | 'align',
  ) => {
    push({
      kind,
      value,
      orientation: 'vertical',
      space: 'wallLocal',
      wallId: wall.id,
      source,
    })
  }

  const pushLocalHorizontal = (
    kind: OpeningGuideKind,
    value: number,
    source: 'self' | 'align',
  ) => {
    push({
      kind,
      value,
      orientation: 'horizontal',
      space: 'wallLocal',
      wallId: wall.id,
      source,
    })
  }

  const pushGlobalVertical = (kind: OpeningGuideKind, elevationX: number) => {
    push({
      kind,
      value: elevationX,
      orientation: 'vertical',
      space: 'elevationX',
      source: 'align',
    })
  }

  // Eigene Hilfslinien des verschobenen Elements (immer)
  pushLocalVertical('selfLeft', a.left, 'self')
  pushLocalVertical('selfRight', a.right, 'self')
  pushLocalVertical('selfMidX', a.midX, 'self')
  pushLocalHorizontal('selfTop', a.top, 'self')
  pushLocalHorizontal('selfBottom', a.bottom, 'self')
  pushLocalHorizontal('selfMidY', a.midY, 'self')

  const activeXRefs: { kind: OpeningGuideKind; value: number }[] = [
    { kind: 'left', value: a.left },
    { kind: 'right', value: a.right },
    { kind: 'midX', value: a.midX },
  ]
  const activeYRefs: { kind: OpeningGuideKind; value: number }[] = [
    { kind: 'top', value: a.top },
    { kind: 'bottom', value: a.bottom },
    { kind: 'midY', value: a.midY },
  ]

  // Gleiche Wand: Kanten/Mitten anderer Öffnungen
  for (const peer of wall.openings) {
    if (peer.id === active.id) continue
    const p = edgesOf(peer)
    const peerX = [p.left, p.right, p.midX]
    const peerY = [p.top, p.bottom, p.midY]
    for (const ref of activeXRefs) {
      for (const px of peerX) {
        if (near(ref.value, px)) pushLocalVertical(ref.kind, ref.value, 'align')
      }
    }
    for (const ref of activeYRefs) {
      for (const py of peerY) {
        if (near(ref.value, py)) pushLocalHorizontal(ref.kind, ref.value, 'align')
      }
    }
  }

  // Etage: horizontale Ausrichtung + vertikale Ausrichtung im Aufriss (global X)
  for (const other of floorWalls) {
    if (Math.abs(other.y - wall.y) > 1e-6) continue
    for (const peer of other.openings) {
      if (other.id === wall.id && peer.id === active.id) continue
      const p = edgesOf(peer)

      for (const ref of activeYRefs) {
        for (const py of [p.top, p.bottom, p.midY]) {
          if (near(ref.value, py)) pushLocalHorizontal(ref.kind, ref.value, 'align')
        }
      }

      const aGlobalX = activeXRefs.map((ref) => ({
        kind: ref.kind,
        value: globalOpeningX(wall, ref.value),
      }))
      const pGlobalX = [p.left, p.right, p.midX].map((px) => globalOpeningX(other, px))
      for (const ref of aGlobalX) {
        for (const gx of pGlobalX) {
          if (near(ref.value, gx)) {
            if (other.id === wall.id) {
              pushLocalVertical(ref.kind, ref.value - wallElevationAlong(wall), 'align')
            } else {
              pushGlobalVertical(ref.kind, ref.value)
            }
          }
        }
      }
    }
  }

  // Wand-Bruchteile (vertikal + horizontal)
  for (const mark of WALL_X_MARKS) {
    const wx = wall.width * mark.frac
    for (const ref of activeXRefs) {
      if (near(ref.value, wx)) pushLocalVertical(mark.kind, wx, 'align')
    }
  }
  for (const mark of WALL_Y_MARKS) {
    const wy = wall.height * mark.frac
    for (const ref of activeYRefs) {
      if (near(ref.value, wy)) pushLocalHorizontal(mark.kind, wy, 'align')
    }
  }

  return guides
}

/** Hilfslinien für mehrere gleichzeitig verschobene Öffnungen (je Wand zusammenführen). */
export function computeOpeningGuidesForRefs(
  walls: Wall[],
  refs: { wallId: string; openingId: string }[],
): Map<string, OpeningGuide[]> {
  const byWall = new Map<string, OpeningGuide[]>()
  for (const ref of refs) {
    const wall = walls.find((w) => w.id === ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    if (!wall || !opening) continue
    const guides = computeOpeningGuides(wall, opening, walls)
    const merged = byWall.get(wall.id) ?? []
    byWall.set(wall.id, mergeGuides(merged, guides))
  }
  return byWall
}

export function isWallReferenceGuide(kind: OpeningGuideKind): boolean {
  return kind.startsWith('wall')
}

export function isSelfGuide(guide: OpeningGuide): boolean {
  return guide.source === 'self' || guide.kind.startsWith('self')
}

function kindStartsWithSelf(kind: OpeningGuideKind): boolean {
  return kind.startsWith('self')
}

export function isMidStyleGuide(guide: OpeningGuide): boolean {
  if (guide.source === 'self') return false
  if (isWallReferenceGuide(guide.kind)) return true
  return guide.kind === 'midX' || guide.kind === 'midY'
}

export { kindStartsWithSelf as isSelfGuideKind }
