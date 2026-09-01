/** Stabiler Hash → Seed für Paneel-Zufallsfarben. */
export function hashStringSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  }
}

/** Vielfalt 0–100 → Anzahl Farbstufen 1…8. */
export function tileColorStageCount(varietyPercent: number): number {
  const v = Math.max(0, Math.min(100, varietyPercent))
  if (v <= 0) return 1
  return Math.max(1, Math.min(8, Math.round(1 + (v / 100) * 7)))
}

/** Palette aus Basisfarbe + Kontrast (%). */
export function buildTileColorPalette(
  baseHex: string,
  variancePercent: number,
  stageCount: number,
): string[] {
  const stages = Math.max(1, stageCount)
  if (stages === 1 || variancePercent <= 0) return [baseHex]
  const { r, g, b } = hexToRgb(baseHex.startsWith('#') ? baseHex : `#${baseHex}`)
  const { h, s, l } = rgbToHsl(r, g, b)
  const amp = (variancePercent / 100) * 0.45
  const colors: string[] = []
  for (let i = 0; i < stages; i += 1) {
    const t = stages === 1 ? 0 : (i / (stages - 1)) * 2 - 1
    const ll = Math.max(0.05, Math.min(0.95, l + t * amp))
    const rgb = hslToRgb(h, s, ll)
    colors.push(rgbToHex(rgb.r, rgb.g, rgb.b))
  }
  return colors
}

export function pickTileColorIndex(
  seedKey: string,
  tileIndex: number,
  stageCount: number,
): number {
  if (stageCount <= 1) return 0
  const rnd = mulberry32(hashStringSeed(`${seedKey}:${tileIndex}`))
  return Math.floor(rnd() * stageCount)
}
