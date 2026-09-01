import { describe, expect, it } from 'vitest'
import { collectPlanDrawGuides } from './buildingGuides'

describe('collectPlanDrawGuides', () => {
  it('zeigt eine Linie, wenn der Cursor mit einem anderen Knoten in X bündig ist', () => {
    const guides = collectPlanDrawGuides(
      { x: 480, z: 96 },
      [
        { x: 0, z: 0 },
        { x: 480, z: 0 },
      ],
      { x: 0, z: 96 },
    )
    expect(guides.some((g) => g.orientation === 'vertical' && g.value === 480 && g.source === 'align')).toBe(
      true,
    )
  })

  it('ignoriert den Startpunkt als Referenz', () => {
    const guides = collectPlanDrawGuides({ x: 48, z: 0 }, [{ x: 0, z: 0 }], { x: 0, z: 0 })
    expect(guides).toHaveLength(0)
  })
})
