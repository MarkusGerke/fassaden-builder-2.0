import { describe, expect, it } from 'vitest'
import { defaultGruenderzeitConfig, layoutGruenderzeitWindow, resolveTimber } from './gruenderzeit'

describe('Tür ohne unteren Blendrahmen (openBottom)', () => {
  it('füllt Flügel bis zum Boden und lässt keinen Unterbalken', () => {
    const config = defaultGruenderzeitConfig(96, 224, 'door')
    const timber = resolveTimber(config.timber)
    const height = 224
    const closed = layoutGruenderzeitWindow(96, height, config)
    const open = layoutGruenderzeitWindow(96, height, config, false, null, { openBottom: true })

    const closedSash = closed.leaves.find((l) => l.region === 'sash')!
    const openSash = open.leaves.find((l) => l.region === 'sash')!

    expect(closedSash.y).toBeCloseTo(timber.blend, 5)
    expect(openSash.y).toBe(0)
    expect(openSash.h).toBeGreaterThan(closedSash.h)
    expect(openSash.y + openSash.h).toBeCloseTo(height - timber.blend, 5)

    const bottomFrameBars = open.bars.filter(
      (b) => b.kind === 'frame' && b.y < 0.1 && b.h <= timber.blend + 0.1 && b.w > timber.blend * 2,
    )
    expect(bottomFrameBars).toHaveLength(0)
  })

  it('mit geschlossenem Unterrahmen bleibt Inset und Unterbalken', () => {
    const config = defaultGruenderzeitConfig(96, 224, 'door')
    const timber = resolveTimber(config.timber)
    const height = 224
    const layout = layoutGruenderzeitWindow(96, height, config, false, null, { openBottom: false })
    const sash = layout.leaves.find((l) => l.region === 'sash')!
    expect(sash.y).toBeCloseTo(timber.blend, 5)
    const bottom = layout.bars.find(
      (b) => b.kind === 'frame' && b.y < 0.1 && b.h <= timber.blend + 0.1 && b.w > timber.blend * 2,
    )
    expect(bottom).toBeTruthy()
  })
})
