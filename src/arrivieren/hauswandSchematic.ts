import type { HauswandPlan } from './hauswandTypes'
import {
  hauswandAxisOpeningXCm,
  hauswandWidthCm,
  HAUSWAND_PIER_CM,
  HAUSWAND_WINDOW_WIDTH_CM,
} from './hauswandGrid'

/** Einfache SVG-Schematik (Achsen raster, EG/OG, Erker). */
export function hauswandPlanSchematicSvg(plan: HauswandPlan, opts?: { scale?: number }): string {
  const scale = opts?.scale ?? 0.35
  const w = plan.widthCm * scale
  const storeyH = 52
  const pad = 8
  const h = pad * 2 + plan.storeys * storeyH
  const pierW = HAUSWAND_PIER_CM * scale
  const winW = HAUSWAND_WINDOW_WIDTH_CM * scale

  const rects: string[] = []
  for (let s = 0; s < plan.storeys; s += 1) {
    const y = pad + s * storeyH
    rects.push(
      `<rect x="${pad}" y="${y}" width="${w}" height="${storeyH - 4}" fill="#f4f0ea" stroke="#888" stroke-width="1"/>`,
    )
  }

  for (let a = 0; a < plan.axes; a += 1) {
    const x = pad + hauswandAxisOpeningXCm(a) * scale
    rects.push(
      `<rect x="${x - pierW * 0.25}" y="${pad}" width="${pierW * 0.5}" height="${plan.storeys * storeyH - 4}" fill="#ccc" opacity="0.35"/>`,
    )
  }

  const bays = plan.bays?.length ? plan.bays : plan.bay ? [plan.bay] : []
  for (const bay of bays) {
    for (let s = 1; s <= plan.storeys - 2; s += 1) {
      const y = pad + s * storeyH + 6
      const x0 = pad + hauswandAxisOpeningXCm(bay.axisStart) * scale
      const bw = (bay.axisSpan * 144 - 48) * scale || winW
      rects.push(
        `<rect x="${x0}" y="${y}" width="${bw}" height="${storeyH - 16}" fill="#c8dff0" stroke="#4a7" stroke-width="1.2" rx="2"/>`,
      )
    }
  }

  const label = plan.snapshotDe.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + pad * 2} ${h + 20}" width="${w + pad * 2}" height="${h + 20}" role="img" aria-label="Hauswand-Schematik">
  ${rects.join('\n  ')}
  <text x="${pad}" y="${h + 14}" font-size="9" fill="#333">${label}</text>
</svg>`
}

export { hauswandWidthCm }
