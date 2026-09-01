export interface ParsedOpening {
  width: number
  height: number
}

export interface ParsedWallModule {
  name: string
  index: number
  width: number
  height: number
  openings: ParsedOpening[]
}

const WALL_MODULE_RE = /^(\d+)-(\d+)x(\d+)(?:-(.+))?(?:-v[12])?(?:\.\d+)?$/
const SIZE_RE = /(\d+)x(\d+)/g

export function parseWallModuleName(rawName: string): ParsedWallModule | null {
  const base = rawName.split('.')[0].replace(/-v[12]$/, '')
  const match = WALL_MODULE_RE.exec(base)
  if (!match) return null

  const [, indexText, widthText, heightText, rest] = match
  const openings: ParsedOpening[] = []

  if (rest) {
    const restClean = rest.replace(/-v[12]$/, '')
    for (const sizeMatch of restClean.matchAll(SIZE_RE)) {
      openings.push({
        width: Number.parseInt(sizeMatch[1], 10),
        height: Number.parseInt(sizeMatch[2], 10),
      })
    }
  }

  return {
    name: base,
    index: Number.parseInt(indexText, 10),
    width: Number.parseInt(widthText, 10),
    height: Number.parseInt(heightText, 10),
    openings,
  }
}

export function openingKind(height: number): 'door' | 'window' {
  return height >= 320 ? 'door' : 'window'
}
