import { readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { describe, it } from 'vitest'
import { normalizeStudioPanel } from './constants'
import { layoutPanelTiles } from './panelLayout'
import { openingCutsWall, openingPanelClearance, openingMasonryRect, openingArchGeom, openingArchSpringY } from '../utils/openingGeometry'

describe('diag share wall', () => {
  it('inspects blockers vs tiles', () => {
    const hash = readFileSync('/tmp/fb-hash-only.txt', 'utf8').trim()
    const payload = hash.startsWith('f=') ? hash.slice(2) : hash
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const data = JSON.parse(gunzipSync(Buffer.from(b64 + pad, 'base64')).toString('utf8'))
    const all = data.facade.buildings[0].walls
    const wall = all.find((w: { id: string }) => w.id.startsWith('1face1c1'))
    const panel = normalizeStudioPanel(wall.panel)
    for (const o of wall.openings.slice(0, 2)) {
      const c = openingPanelClearance(o)
      const rect = openingMasonryRect(o, c)
      const geom = openingArchGeom(o, c)
      const spring = openingArchSpringY(o, c)
      // eslint-disable-next-line no-console
      console.log({
        cuts: openingCutsWall(o),
        c,
        ox: o.x,
        ow: o.width,
        oy: o.y,
        oh: o.height,
        rect: { x: rect.x, w: rect.width, y: rect.y, h: rect.height },
        spring,
        springY: geom?.springY,
        form: o.arch?.form,
      })
    }
    const tiles = layoutPanelTiles(wall, panel, all)
    const spanning = tiles.filter((t) =>
      wall.openings.some(
        (o: { x: number; width: number; y: number; height: number }) =>
          t.x < o.x && t.x + t.width > o.x + o.width,
      ),
    )
    const overhang = tiles.filter((t) =>
      wall.openings.some(
        (o: { x: number; width: number }) => t.x < o.x && t.x + t.width > o.x + 1 && t.x + t.width < o.x + o.width,
      ),
    )
    // eslint-disable-next-line no-console
    console.log({
      spanning: spanning.length,
      overhang: overhang.length,
      sampleOver: overhang.slice(0, 5).map((t) => ({ x: +t.x.toFixed(1), w: +t.width.toFixed(1), end: +(t.x + t.width).toFixed(1), y: +t.y.toFixed(1) })),
      sampleSpan: spanning.slice(0, 3).map((t) => ({ x: +t.x.toFixed(1), w: +t.width.toFixed(1), y: +t.y.toFixed(1) })),
    })
  })
})
