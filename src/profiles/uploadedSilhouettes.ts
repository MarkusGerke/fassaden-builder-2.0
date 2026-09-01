import type { ProfileDefinition, ProfileRenderContext, ProfileSectionPoint } from './types'

const NS = 'http://www.w3.org/2000/svg'

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag)
}

function renderSectionBand(
  parent: SVGGElement,
  context: ProfileRenderContext,
  depth: number,
  fill: string,
  stroke: string,
) {
  const { edge, length, x, y } = context
  const vertical = edge === 'left' || edge === 'right'
  const rect = createSvgElement('rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(vertical ? depth : length))
  rect.setAttribute('height', String(vertical ? length : depth))
  rect.setAttribute('fill', fill)
  rect.setAttribute('stroke', stroke)
  rect.setAttribute('stroke-width', '0.6')
  parent.appendChild(rect)
}

function makeProfile(
  id: string,
  label: string,
  section: ProfileSectionPoint[],
  fill: string,
  stroke: string,
  projecting = true,
): ProfileDefinition {
  const depth = Math.max(...section.map((p) => p.outward), 1)
  const forward = Math.max(...section.map((p) => p.forward), 1)
  return {
    id,
    label,
    depth,
    tileLength: depth,
    projecting,
    forward,
    section,
    renderEdge(parent, context) {
      renderSectionBand(parent, context, depth, fill, stroke)
    },
  }
}

/**
 * SVG-/PNG-Querschnitte (Maße im Dateinamen in mm, intern cm).
 *
 * Gemeinsam: SVG-links = Wand (`forward = 0`), SVG-rechts = Front (`forward`).
 * Fensterprofil: SVG-oben = oben am oberen Holm (`outward` weg von der Öffnung,
 * SVG-unten an der Öffnungskante).
 * Traufgesims: Silhouette-oben = Krone an der Wandoberkante (`outward = 0`);
 * Silhouette-unten = unteres Profil (hängt die Fassade hinunter).
 * Sockelprofil: SVG-unten = Boden (`outward = 0`), SVG-oben = Oberkante.
 */


export const FENSTERPROFIL_32x120_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 12.0, forward: 0.0 },
  { outward: 12.0, forward: 2.81 },
  { outward: 9.42, forward: 3.1 },
  { outward: 8.63, forward: 1.84 },
  { outward: 5.75, forward: 2.72 },
  { outward: 4.96, forward: 2.33 },
  { outward: 4.66, forward: 1.65 },
  { outward: 0.5, forward: 1.65 },
  { outward: 0.1, forward: 0.87 },
  { outward: 0.0, forward: 0.87 },
  { outward: 0.0, forward: 0.0 },
]

export const fensterprofil32x120Profile = makeProfile(
  'fensterprofil32x120',
  'Fensterprofil 32×120',
  FENSTERPROFIL_32x120_SECTION,
  '#dccfb0',
  '#8f7448',
  true,
)

export const FENSTERPROFIL_35x130_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 13.0, forward: 0.0 },
  { outward: 13.0, forward: 1.1 },
  { outward: 11.89, forward: 1.6 },
  { outward: 10.4, forward: 3.1 },
  { outward: 9.1, forward: 3.5 },
  { outward: 7.15, forward: 3.5 },
  { outward: 5.39, forward: 2.9 },
  { outward: 4.09, forward: 1.6 },
  { outward: 3.16, forward: 1.6 },
  { outward: 2.32, forward: 2.5 },
  { outward: 1.49, forward: 1.6 },
  { outward: 0.65, forward: 1.6 },
  { outward: 0.0, forward: 1.1 },
  { outward: 0.0, forward: 0.0 },
]

export const fensterprofil35x130Profile = makeProfile(
  'fensterprofil35x130',
  'Fensterprofil 35×130',
  FENSTERPROFIL_35x130_SECTION,
  '#e0d2b4',
  '#8a7044',
  true,
)

export const FENSTERPROFIL_40x140_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 14.0, forward: 0.0 },
  { outward: 14.0, forward: 1.0 },
  { outward: 13.7, forward: 4.0 },
  { outward: 10.72, forward: 4.0 },
  { outward: 8.54, forward: 2.0 },
  { outward: 5.56, forward: 3.0 },
  { outward: 4.67, forward: 2.0 },
  { outward: 1.39, forward: 2.0 },
  { outward: 0.79, forward: 1.67 },
  { outward: 0.1, forward: 0.56 },
  { outward: 0.0, forward: 0.56 },
  { outward: 0.0, forward: 0.0 },
]

export const fensterprofil40x140Profile = makeProfile(
  'fensterprofil40x140',
  'Fensterprofil 40×140',
  FENSTERPROFIL_40x140_SECTION,
  '#e4d6b8',
  '#856c40',
  true,
)

/** Querschnitt aus Traufgesims-70×150-Silhouette (PNG, mm→cm; oben = Krone). */
export const TRAUFGESIMS_70x150_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 0.0, forward: 7.0 },
  { outward: 0.9, forward: 7.0 },
  { outward: 1.3, forward: 5.8 },
  { outward: 2.7, forward: 4.4 },
  { outward: 3.1, forward: 3.3 },
  { outward: 3.5, forward: 3.2 },
  { outward: 3.6, forward: 2.3 },
  { outward: 10.7, forward: 2.3 },
  { outward: 10.9, forward: 2.6 },
  { outward: 11.3, forward: 2.6 },
  { outward: 11.7, forward: 3.3 },
  { outward: 12.7, forward: 3.5 },
  { outward: 13.4, forward: 2.6 },
  { outward: 13.8, forward: 2.6 },
  { outward: 14.1, forward: 1.4 },
  { outward: 15.0, forward: 1.2 },
  { outward: 15.0, forward: 0.0 },
  { outward: 0.0, forward: 0.0 },
]

export const traufgesims70x150Profile = makeProfile(
  'traufgesims70x150',
  'Traufgesims 70×150',
  TRAUFGESIMS_70x150_SECTION,
  '#d4c4a8',
  '#8a7349',
  true,
)

/** Querschnitt aus Traufgesims-110×135-Silhouette (PNG, mm→cm; oben = Krone). */
export const TRAUFGESIMS_110x135_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 0.0, forward: 11.0 },
  { outward: 1.1, forward: 11.0 },
  { outward: 1.7, forward: 9.8 },
  { outward: 2.1, forward: 9.8 },
  { outward: 2.2, forward: 9.3 },
  { outward: 4.3, forward: 8.9 },
  { outward: 5.5, forward: 8.3 },
  { outward: 6.5, forward: 7.5 },
  { outward: 7.6, forward: 5.7 },
  { outward: 8.1, forward: 2.8 },
  { outward: 8.6, forward: 2.8 },
  { outward: 8.7, forward: 2.4 },
  { outward: 9.1, forward: 2.2 },
  { outward: 9.2, forward: 1.7 },
  { outward: 10.8, forward: 1.7 },
  { outward: 10.9, forward: 2.1 },
  { outward: 11.3, forward: 2.2 },
  { outward: 11.6, forward: 2.6 },
  { outward: 12.2, forward: 2.6 },
  { outward: 13.0, forward: 1.3 },
  { outward: 13.5, forward: 1.0 },
  { outward: 13.5, forward: 0.0 },
  { outward: 0.0, forward: 0.0 },
]

export const traufgesims110x135Profile = makeProfile(
  'traufgesims110x135',
  'Traufgesims 110×135',
  TRAUFGESIMS_110x135_SECTION,
  '#d9c7a3',
  '#8a7349',
  true,
)

/** Querschnitt aus Traufgesims-200×200-Silhouette (PNG, mm→cm; oben = Krone). */
export const TRAUFGESIMS_200x200_SECTION: ProfileSectionPoint[] = [
  { outward: 0.0, forward: 0.0 },
  { outward: 0.0, forward: 20.0 },
  { outward: 1.4, forward: 20.0 },
  { outward: 1.9, forward: 19.0 },
  { outward: 3.1, forward: 18.7 },
  { outward: 3.5, forward: 18.3 },
  { outward: 3.9, forward: 17.0 },
  { outward: 4.7, forward: 17.0 },
  { outward: 5.8, forward: 12.9 },
  { outward: 7.3, forward: 10.2 },
  { outward: 8.9, forward: 8.5 },
  { outward: 11.0, forward: 7.1 },
  { outward: 12.9, forward: 6.3 },
  { outward: 17.0, forward: 5.6 },
  { outward: 17.1, forward: 4.6 },
  { outward: 17.8, forward: 4.5 },
  { outward: 18.6, forward: 3.9 },
  { outward: 19.0, forward: 2.3 },
  { outward: 20.0, forward: 1.5 },
  { outward: 20.0, forward: 0.0 },
  { outward: 0.0, forward: 0.0 },
]

export const traufgesims200x200Profile = makeProfile(
  'traufgesims200x200',
  'Traufgesims 200×200',
  TRAUFGESIMS_200x200_SECTION,
  '#d4c4a8',
  '#7a6540',
  true,
)

/**
 * Sockelprofil aus `19x196-1.svg` (viewBox 20×198, mm → cm).
 * Links = Wand (`forward = 0`), unten = Boden (`outward = 0`).
 */
export const SOCKELPROFIL_SECTION: ProfileSectionPoint[] = [
  { outward: 0.13, forward: 0.05 },
  { outward: 19.73, forward: 0.05 },
  { outward: 19.18, forward: 1.4 },
  { outward: 16.73, forward: 1.4 },
  { outward: 16.73, forward: 0.85 },
  { outward: 6.56, forward: 0.85 },
  { outward: 6.56, forward: 1.05 },
  { outward: 5.91, forward: 1.7 },
  { outward: 3.27, forward: 1.7 },
  { outward: 3.27, forward: 1.95 },
  { outward: 0.13, forward: 1.95 },
  { outward: 0.13, forward: 0.05 },
]

export const sockelprofilProfile = makeProfile(
  'sockelprofil',
  'Sockelprofil',
  SOCKELPROFIL_SECTION,
  '#cfc0a4',
  '#8a7349',
  true,
)

export const UPLOADED_PROFILES: ProfileDefinition[] = [
  fensterprofil32x120Profile,
  fensterprofil35x130Profile,
  fensterprofil40x140Profile,
  traufgesims70x150Profile,
  traufgesims110x135Profile,
  traufgesims200x200Profile,
  sockelprofilProfile,
]
