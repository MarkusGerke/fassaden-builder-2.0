import { archJambPolysFromSpec, buildSemicircularArchSpec } from '../src/utils/openingGeometry.ts'
import type { Opening } from '../src/types/facade.ts'

const opening: Opening = {
  id: 'win',
  type: 'window',
  x: 576,
  y: 152,
  width: 144,
  height: 192,
  arch: { enabled: true, voussoirs: true, jambs: true, jambCount: 5, keystoneCount: 7 },
}

const spec = buildSemicircularArchSpec(opening, {
  panelWidth: 64,
  panelHeight: 32,
  joint: 0.8,
})
if (!spec) throw new Error('spec missing')

const jambs = archJambPolysFromSpec(spec)
const left = jambs.filter((p) => p.x < spec.cx).sort((a, b) => a.y - b.y)
const right = jambs.filter((p) => p.x > spec.cx).sort((a, b) => a.y - b.y)
if (left.length !== 5 || right.length !== 5) {
  console.error(`FAIL count left=${left.length} right=${right.length}`)
  process.exit(1)
}
const heights = left.map((p) => p.height)
const minH = Math.min(...heights)
const maxH = Math.max(...heights)
if (maxH - minH > 0.02) {
  console.error(`FAIL unequal heights`, heights)
  process.exit(1)
}
const yBot = left[0]!.y
const yTop = left[left.length - 1]!.y + left[left.length - 1]!.height
if (Math.abs(yBot - spec.sillY) > 0.05) {
  console.error(`FAIL sill ${yBot} vs ${spec.sillY}`)
  process.exit(1)
}
const expectTop = spec.cy - spec.joint * 0.5
if (Math.abs(yTop - expectTop) > 0.05) {
  console.error(`FAIL spring ${yTop} vs ${expectTop}`)
  process.exit(1)
}
console.log(`PASS  5 equal jamb stones h=${minH.toFixed(2)}cm sill→spring`)
