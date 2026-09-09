import { describe, expect, it } from 'vitest'
import {
  BAY_LIBRARY_FRONTS_CM,
  BAY_WALL_DEPTH_CM,
  BAY_WINDOW_PRESETS,
  buildBayWindowAtPose,
  buildBayWindowWalls,
  defaultBayLibraryPanel,
} from './bayWindow'
import { createStudioWall, panelMiterEnds, studioPanelFaceLocalZ } from './walls'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { layoutPanelTiles } from './panelLayout'
import { studioMiterLocalX } from './wallMiterX'
import { WINDOW_SILL_Y } from '../constants/presets'

function pierWidthsAboveSill(front: ReturnType<typeof buildBayWindowAtPose>[number], walls: typeof front[]) {
  const panel = front.panel!
  const tiles = layoutPanelTiles(front, panel, walls)
  const midYs = [...new Set(tiles.map((t) => Math.round(t.y + t.height / 2)))]
    .filter((y) => y > WINDOW_SILL_Y + 20 && y < WINDOW_SILL_Y + 80)
    .sort((a, b) => a - b)
  const row = (y: number) =>
    tiles
      .filter((t) => Math.abs(t.y + t.height / 2 - y) < 2)
      .sort((a, b) => a.x - b.x)
      .map((t) => Math.round(t.width * 10) / 10)
  return { ys: midYs, even: row(midYs[0]!), odd: row(midYs[1] ?? midYs[0]!) }
}

describe('Erker-Bibliothek 288/384 (Verifikation)', () => {
  it('Bibliothek: schmal 288, breit 384, Wandstärke 24', () => {
    expect([...BAY_LIBRARY_FRONTS_CM]).toEqual([192, 288, 384, 576])
    expect(BAY_WALL_DEPTH_CM).toBe(24)
    expect(BAY_WINDOW_PRESETS.some((p) => p.id === 'bay-f288-d96-rect')).toBe(true)
    expect(BAY_WINDOW_PRESETS.some((p) => p.id === 'bay-f384-d96-rect')).toBe(true)
    expect(BAY_WINDOW_PRESETS.some((p) => p.id === 'bay-f336-d96-rect')).toBe(false)
  })

  it('Breiter Erker 384: Läufer 48, Tiefe 24, Fenster 48/240 (Rand 48, Lücke 96), Pfeiler volle 48', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f384-d96-rect')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    const front = walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(384, 5)
    expect(front.depth).toBe(BAY_WALL_DEPTH_CM)
    expect(front.panel?.pattern).toBe('runningBond')
    expect(front.panel?.panelWidth).toBe(48)
    expect(front.openings.map((o) => o.x)).toEqual([expect.closeTo(48, 5), expect.closeTo(240, 5)])
    expect(front.openings.every((o) => o.y === WINDOW_SILL_Y)).toBe(true)
    const { even } = pierWidthsAboveSill(front, walls)
    // Zwischen Fenstern/Rändern: volle Läufer-Vielfache (≥ 48), kein 24er-Stummel
    expect(even.length).toBeGreaterThanOrEqual(3)
    expect(even.every((w) => w >= 46)).toBe(true)
  })

  it('Erker Front↔Schenkel: Paneel-Gehrung an, Vorstand 4 (Steine mit Dicke) — Raster auf wall.width', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f384-d96-rect')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    const front = walls.find((w) => w.bayRole === 'front')!
    // v2.0.307: kein `projectDepth: 0` mehr — Steine ohne Dicke flackerten gegen die Wandschale.
    expect(front.panel?.projectDepth).toBe(4)
    expect(front.panel?.taperDepth).toBe(1)
    expect(panelMiterEnds(front, walls)).toEqual({ start: true, end: true })
    const faceZ = studioPanelFaceLocalZ(front)
    const m = panelMiterEnds(front, walls)
    const faceLen =
      studioMiterLocalX(front, front.width, faceZ, m.start, m.end) -
      studioMiterLocalX(front, 0, faceZ, m.start, m.end)
    // Steinfront steht 4 cm vor der Außenkante → an den 90°-Gehrungen höchstens je +4
    // (Trapez-Eckstein); Körper-Außenkante und Raster bleiben auf wall.width.
    expect(faceLen).toBeGreaterThanOrEqual(front.width - 1e-6)
    expect(faceLen).toBeLessThanOrEqual(front.width + 2 * 4 + 1e-6)

    // Unter Brüstung: volle Breite, gerade Lage 8 Module, Versatzlage 0,5 … 0,5
    const tiles = layoutPanelTiles(front, front.panel!, walls)
    const midYs = [...new Set(tiles.map((t) => Math.round(t.y + t.height / 2)))]
      .filter((y) => y > 20 && y < WINDOW_SILL_Y - 10)
      .sort((a, b) => a - b)
    expect(midYs.length).toBeGreaterThanOrEqual(2)
    const row = (y: number) =>
      tiles
        .filter((t) => Math.abs(t.y + t.height / 2 - y) < 2)
        .sort((a, b) => a.x - b.x)
        .map((t) => Math.round(t.width * 10) / 10)
    const even = row(midYs[0]!)
    const odd = row(midYs[1]!)
    expect(even).toHaveLength(8)
    expect(even.every((w) => w > 46 && w < 49)).toBe(true)
    expect(odd[0]!).toBeGreaterThan(22)
    expect(odd[0]!).toBeLessThan(26)
    expect(odd[odd.length - 1]!).toBeGreaterThan(22)
    expect(odd[odd.length - 1]!).toBeLessThan(26)
    expect(odd.slice(1, -1).every((w) => w > 46 && w < 49)).toBe(true)
  })

  it('Schmaler Erker 288: Tiefe 24, ein Fenster zentriert (96 | 96 | 96)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f288-d96-rect')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    const front = walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(288, 5)
    expect(front.depth).toBe(BAY_WALL_DEPTH_CM)
    // Front-Regel Rand 48 / Lücke 96: zwei 96er bräuchten 384 → ein Fenster, Ränder 96
    expect(front.openings.map((o) => o.x)).toEqual([expect.closeTo(96, 5)])
  })

  it('Host mit Streifen-64 wird auf Erker zu Läufer 48', () => {
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      height: 512,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'strip' as const, panelWidth: 64, enabled: true },
    }
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f384-d96-rect')!
    const built = buildBayWindowWalls(parent, preset, 288)!
    const front = built.walls.find((w) => w.bayRole === 'front')!
    expect(front.panel?.pattern).toBe('runningBond')
    expect(front.panel?.panelWidth).toBe(48)
    expect(front.depth).toBe(BAY_WALL_DEPTH_CM)
  })

  it('defaultBayLibraryPanel ist Läufer 48', () => {
    const p = defaultBayLibraryPanel()
    expect(p.pattern).toBe('runningBond')
    expect(p.panelWidth).toBe(48)
    expect(p.enabled).toBe(true)
  })
})
