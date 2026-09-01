/**
 * Prüft: Raster clippt am Extrados, keine Extra-Zwickel-Polygone, keine dünnen
 * Kappenreste über dem Scheitel.
 */
import { DEFAULT_STUDIO_PANEL } from '../src/studio/constants.ts'
import { layoutPanelTiles } from '../src/studio/panelLayout.ts'
import type { Opening, Wall } from '../src/types/facade.ts'
import {
  archSpandrelCoursePolys,
  archVoussoirPolysFromSpec,
  buildSemicircularArchSpec,
  clipPolysMinusArches,
  voussoirCapBayRect,
  voussoirExtradosPolyline,
} from '../src/utils/openingGeometry.ts'

const panel = {
  ...DEFAULT_STUDIO_PANEL,
  pattern: 'headerBond' as const,
  panelWidth: 32,
  panelHeight: 16,
  joint: 0.8,
  taperDepth: 4,
  taper: 0.45,
  plinthEnabled: false,
}

const opening: Opening = {
  id: 'win-arch',
  type: 'window',
  x: 80,
  y: 96,
  width: 96,
  height: 160,
  arch: { enabled: true, voussoirs: true, spandrel: 'bond' },
}

const wall: Wall = {
  id: 'wall',
  kind: 'studio',
  x: 0,
  y: 0,
  width: 256,
  height: 320,
  depth: 24,
  panel,
  openings: [opening],
  profiles: [],
  neighbors: {},
}

const spec = buildSemicircularArchSpec(opening, {
  panelWidth: panel.panelWidth,
  panelHeight: panel.panelHeight,
  joint: panel.joint,
})
if (!spec) throw new Error('spec missing')

const tiles = layoutPanelTiles(wall, panel, [wall])
const clipped = clipPolysMinusArches(tiles, wall.openings, 0, panel.panelHeight, {
  panelWidth: panel.panelWidth,
  joint: panel.joint,
})
const voussoirs = archVoussoirPolysFromSpec(spec)
const invented = archSpandrelCoursePolys(spec, tiles)
const bay = voussoirCapBayRect(spec)
const crownY = spec.cy + spec.rOuter
const courseH = panel.panelHeight - panel.joint

const fail = (msg: string) => {
  console.error(`FAIL  ${msg}`)
  process.exitCode = 1
}
const pass = (msg: string) => console.log(`PASS  ${msg}`)

if (clipped.some((p) => p.spandrelStrip)) fail('clipped raster has spandrelStrip')
else pass('no invented spandrelStrip on raster')

if (invented.length === 0) fail('helper still builds course polys (sanity)')
else pass(`course-poly helper exists but unused in 3D (${invented.length})`)

const crumbs = clipped.filter(
  (p) =>
    ((p.bottomArc && p.bottomArc.length >= 2) || (p.topArc && p.topArc.length >= 2)) &&
    p.height < 3.2,
)
if (crumbs.length > 0) fail(`thin arc crumbs: ${crumbs.length}`)
else pass('no sub-3.2cm arc crumbs on the crown')

const thinCapRemnants = clipped.filter((p) => {
  if (p.bottomArc && p.bottomArc.length >= 2) return false
  if (p.outline && p.outline.length >= 3) return false
  const y1 = p.y + p.height
  const overlapsBayX = p.x < spec.cx + spec.rOuter && p.x + p.width > spec.cx - spec.rOuter
  const sitsOnCrown = p.y >= crownY - 0.6 && p.y <= crownY + courseH * 0.35
  const thin = p.height < courseH * 0.55
  const insideBay = p.x >= bay.x - 1 && p.x + p.width <= bay.x + bay.width + 1
  return overlapsBayX && sitsOnCrown && thin && insideBay && y1 <= crownY + courseH
})
if (thinCapRemnants.length > 0) {
  fail(`thin invented blocks on crown: ${thinCapRemnants.length}`)
} else {
  pass('no thin rectangular blocks sitting on the crown')
}

const insideRing = clipped.filter((p) => {
  const mx = p.x + p.width / 2
  const my = p.y + p.height / 2
  if (my < spec.cy + 1) return false
  const d = Math.hypot(mx - spec.cx, my - spec.cy)
  return d < spec.rOuter - 2
})
if (insideRing.length > 0) fail(`raster centroids inside ring: ${insideRing.length}`)
else pass('no raster stone centered inside the voussoir ring')

const arcRemnants = clipped.filter((p) => p.bottomArc && p.bottomArc.length >= 2)
if (arcRemnants.length < 4) fail(`too few mask-clipped zwickel (${arcRemnants.length})`)
else pass(`mask-clipped zwickel tiles: ${arcRemnants.length}`)

const extrados = voussoirExtradosPolyline(spec)
const span = spec.thetaStart - spec.thetaEnd
const sagOneWedge = spec.rOuter * (1 - Math.cos(span / (2 * Math.max(1, spec.count))))
const chordLimit = sagOneWedge + 1.2
let deepChords = 0
for (const p of arcRemnants) {
  const arc = p.bottomArc
  if (!arc || arc.length < 2) continue
  for (let i = 0; i < arc.length - 1; i += 1) {
    const a = arc[i]!
    const b = arc[i + 1]!
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const d = Math.hypot(mx - spec.cx, my - spec.cy)
    if (d < spec.rOuter - chordLimit) deepChords += 1
  }
}
if (deepChords > 0) fail(`bottomArc chords cut into the ring: ${deepChords}`)
else pass(`zwickel dock on voussoir extrados (${extrados.length} mesh points, sag≤${chordLimit.toFixed(1)}cm)`)

if (voussoirs.length < 5) fail(`voussoir count ${voussoirs.length}`)
else pass(`voussoirs: ${voussoirs.length}`)

const above = clipped.filter((p) => p.y >= crownY + 0.5)
const brokenAbove = above.filter((p) => p.height < courseH * 0.7 && p.width < spec.rOuter)
if (brokenAbove.length > 0) fail(`shredded tiles above crown: ${brokenAbove.length}`)
else pass(`full courses above crown: ${above.length}`)

if (process.exitCode) {
  console.error('assert-zwickel-mask failed')
  process.exit(1)
}
console.log('assert-zwickel-mask ok')
