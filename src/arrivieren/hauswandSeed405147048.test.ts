import { describe, it, expect } from 'vitest'
import { createDefaultFacadeState } from '../types/facade'
import { getActiveBuilding } from '../utils/buildings'
import { isStudioWall } from '../studio/walls'
import { generateHauswand } from './generateHauswand'
import { auditHauswandPlan } from './hauswandAudit'
import { collectEgOpenings } from './hauswandFacadeLayout'
import {
  applyHauswandGeneration,
  HAUSWAND_DEPTH_OPTIONS_CM,
  pickHauswandDepthCm,
} from './applyHauswandGeneration'

describe('seed 405147048 regression', () => {
  it('OG fluchtet mit EG; kein versetzter 144er; Audit leer', () => {
    const plan = generateHauswand(405147048)
    const eg = collectEgOpenings(plan.egGroups).filter((o) => o.role !== 'basement')
    const og = [...plan.ogWindowByAxis].sort((a, b) => a.x - b.x)
    expect(plan.axes).toBe(6)
    expect(plan.storeys).toBe(3)
    expect(og.some((o) => Math.abs(o.x - 552) < 1 && o.width === 144)).toBe(false)
    // Über Tür 648+144: OG-Fenster zentriert (672+96)
    expect(og.some((o) => Math.abs(o.x - 672) < 1 && o.width === 96)).toBe(true)
    // Rechtes Endfenster bleibt
    expect(og.some((o) => Math.abs(o.x - 1248) < 1)).toBe(true)
    for (const e of eg.filter((o) => o.type === 'window')) {
      expect(og.some((o) => Math.abs(o.x - e.x) < 1 && Math.abs(o.width - e.width) < 1)).toBe(true)
    }
    expect(auditHauswandPlan(plan)).toEqual([])
  })

  it('Apply: Rechteck-Hülle + Dach ohne Gauben, First O–W', () => {
    const plan = generateHauswand(405147048)
    const state = applyHauswandGeneration(createDefaultFacadeState(), plan)
    const b = getActiveBuilding(state)
    const egStudio = b.walls.filter(
      (w) => isStudioWall(w) && (w.y ?? 0) < 0.5 && !w.bayRole && !w.bayParentId,
    )
    // Front + 3 Seiten je Etage → 4 EG-Außenwände
    expect(egStudio.length).toBe(4)
    const depths = egStudio.map((w) => Math.round(w.width))
    expect(depths.filter((w) => w === plan.widthCm).length).toBeGreaterThanOrEqual(2)
    const depthCm = pickHauswandDepthCm(plan.seed)
    expect(HAUSWAND_DEPTH_OPTIONS_CM).toContain(depthCm)
    expect(depths).toContain(depthCm)
    expect(b.roof?.enabled).toBe(true)
    expect(b.roof?.ridgeDeg).toBe(90)
    expect(b.roof?.dormers?.length ?? 0).toBe(0)
    expect(b.roof?.crossGables?.length ?? 0).toBe(0)
  })
})
