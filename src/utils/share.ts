import type { FacadeState } from '../types/facade'
import { applyFacadeLoadPipeline } from './facadeLoad'

const HASH_PREFIX = '#f='

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function gzipBytes(input: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzipBytes(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null
  const copy = Uint8Array.from(bytes)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export async function encodeFacadeHash(facade: FacadeState): Promise<string> {
  const json = JSON.stringify(facade)
  const compressed = await gzipBytes(json)
  if (compressed) return `${HASH_PREFIX}${bytesToBase64Url(compressed)}`
  return `${HASH_PREFIX}${encodeURIComponent(json)}`
}

export async function decodeFacadeHash(hash: string): Promise<FacadeState | null> {
  if (!hash.startsWith(HASH_PREFIX)) return null
  const payload = hash.slice(HASH_PREFIX.length)
  try {
    let raw: FacadeState
    if (payload.startsWith('%7B') || payload.startsWith('{')) {
      raw = JSON.parse(decodeURIComponent(payload)) as FacadeState
    } else {
      const text = await gunzipBytes(base64UrlToBytes(payload))
      if (!text) return null
      raw = JSON.parse(text) as FacadeState
    }
    return applyFacadeLoadPipeline(raw).facade
  } catch {
    return null
  }
}

export function readFacadeFromLocationHash(): string {
  return window.location.hash
}

/** Obergrenze für Live-Hash in der Adresszeile (Zeichen). Darüber nur localStorage. */
const MAX_LIVE_HASH_CHARS = 12000

export function writeFacadeHash(hash: string): void {
  if (hash.length > MAX_LIVE_HASH_CHARS) return
  const url = new URL(window.location.href)
  url.hash = hash
  window.history.replaceState(null, '', url)
}

let facadeHashGeneration = 0
let facadeHashTimer = 0

export function scheduleFacadeHashWrite(facade: FacadeState, delayMs = 1200): void {
  const generation = ++facadeHashGeneration
  window.clearTimeout(facadeHashTimer)
  facadeHashTimer = window.setTimeout(() => {
    void encodeFacadeHash(facade).then((hash) => {
      if (generation !== facadeHashGeneration) return
      writeFacadeHash(hash)
    })
  }, delayMs)
}

function facadeExportFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const yy = pad(now.getFullYear() % 100)
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const hh = pad(now.getHours())
  const mi = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  return `fassade-${yy}${mm}${dd}-${hh}${mi}${ss}.json`
}

export function downloadFacadeJson(facade: FacadeState, filename = facadeExportFilename()): void {
  const blob = new Blob([JSON.stringify(facade, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function loadFacadeFromFile(file: File): Promise<FacadeState> {
  const text = await file.text()
  return applyFacadeLoadPipeline(JSON.parse(text) as FacadeState).facade
}

export async function copyFacadeLink(facade: FacadeState): Promise<string> {
  facadeHashGeneration += 1
  const hash = await encodeFacadeHash(facade)
  writeFacadeHash(hash)
  const url = new URL(window.location.href)
  url.hash = hash
  const link = url.toString()
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link)
  }
  return link
}
