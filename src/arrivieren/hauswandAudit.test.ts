import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { applyHauswandGeneration, stripHauswandWallDecor } from './applyHauswandGeneration'
import { generateHauswand } from './generateHauswand'
import { auditHauswandPlan, runHauswandAuditSample } from './hauswandAudit'
import { collectEgOpenings } from './hauswandFacadeLayout'
import { getActiveBuilding } from '../utils/buildings'
import { isStudioWall } from '../studio/walls'

describe('hauswandAudit Kontrollprotokoll', () => {
  it('30 Zufalls-Fassaden ohne Regelverstöße', () => {
    const results = runHauswandAuditSample(30, generateHauswand)
    const failed = results.filter((r) => !r.ok)
    if (failed.length) {
      const report = failed
        .slice(0, 8)
        .map(
          (r) =>
            `seed ${r.seed}: ${r.violations.map((v) => `${v.rule}(${v.detail})`).join('; ')}`,
        )
        .join('\n')
      expect(failed, `Kontrollprotokoll fehlgeschlagen:\n${report}`).toHaveLength(0)
    }
    expect(results).toHaveLength(30)
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('Apply: Erker und Fassade ohne Paneel/Sockel/Gesims', () => {
    let foundBay = false
    for (let i = 0; i < 80 && !foundBay; i += 1) {
      const plan = generateHauswand(1000 + i)
      if (!plan.bays?.length && !plan.bay) continue
      foundBay = true
      const state = applyHauswandGeneration(createDefaultFacadeState(), plan)
      const walls = getActiveBuilding(state).walls.filter(isStudioWall)
      for (const w of walls) {
        if (w.bayRole || w.bayParentId) {
          expect(w.panel?.enabled).toBe(false)
          expect(w.panel?.plinthEnabled).toBe(false)
          expect(w.cornice).toBeFalsy()
          expect(w.trimBands?.length ?? 0).toBe(0)
        }
      }
    }
    expect(foundBay).toBe(true)
  })

  it('stripHauswandWallDecor schaltet Paneel und Sockel aus', () => {
    const wall = stripHauswandWallDecor({
      id: 't',
      x: 0,
      y: 0,
      width: 100,
      height: 448,
      depth: 48,
      openings: [],
      panel: { enabled: true, plinthEnabled: true } as never,
      cornice: { enabled: true } as never,
      trimBands: [{ id: 'a' } as never],
    } as never)
    expect(wall.panel?.enabled).toBe(false)
    expect(wall.panel?.plinthEnabled).toBe(false)
    expect(wall.cornice).toBeUndefined()
    expect(wall.trimBands).toEqual([])
  })

  it('audit erkennt fehlenden Eingang', () => {
    const plan = generateHauswand(42)
    const broken = {
      ...plan,
      egGroups: plan.egGroups.map((g) => ({
        ...g,
        openings: g.openings.filter((o) => o.type !== 'door'),
      })),
    }
    const v = auditHauswandPlan(broken)
    expect(v.some((x) => x.rule === 'entrance')).toBe(true)
  })
})

