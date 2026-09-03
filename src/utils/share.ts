import type { FacadeState } from '../types/facade'
import { snapYawTo45 } from '../studio/compass'
import { applyFacadeLoadPipeline } from './facadeLoad'
import {
  DEFAULT_SCENE_APPEARANCE,
  normalizeSceneAppearance,
  type SceneAppearance,
} from './persistence'
import { FACADE_SCHEMA_IMPORT_BASE, FACADE_SCHEMA_VERSION } from './schemaMigrations'

const HASH_PREFIX = '#f='
/** localStorage-Schlüssel: zuletzt von dieser App selbst geschriebener Live-Hash. */
const LIVE_HASH_KEY = 'fassaden-builder-live-hash'

/** Inhalt eines Teilen-Links (Hash `#f=`). */
export interface SharePayload {
  facade: FacadeState
  /**
   * Schema-Stand der Fassade. Ohne Angabe (alte Links) startet der Import bei
   * `FACADE_SCHEMA_IMPORT_BASE` und spielt alle Migrationen erneut — mit Angabe nicht.
   */
  schemaVersion?: number
  /** Szene-Farben (Hintergrund, Boden, Himmel, Strichstärke). */
  scene?: SceneAppearance
  /** Kompass-/Seitenansicht in Grad (45°-Raster), nur bei `kind: 'yaw'`. */
  viewYaw?: number
}

export interface DecodedSharePayload {
  facade: FacadeState
  scene?: SceneAppearance
  viewYaw?: number
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFacadeState(value: unknown): value is FacadeState {
  if (!isRecord(value)) return false
  if (Array.isArray(value.buildings) && value.buildings.length > 0) return true
  return Array.isArray(value.walls) && typeof value.wallHeight === 'number'
}

function normalizeViewYaw(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  return snapYawTo45(n)
}

/** Gespeicherte `schemaVersion` eines Payloads/Exports; fehlt sie, Import-Basis (alle Migrationen). */
export function readSchemaVersion(raw: unknown): number {
  if (!isRecord(raw)) return FACADE_SCHEMA_IMPORT_BASE
  const v = raw.schemaVersion
  return typeof v === 'number' && Number.isFinite(v) ? v : FACADE_SCHEMA_IMPORT_BASE
}

/** Export-Dateien tragen `schemaVersion` neben der Fassade; beim Import wieder abstreifen. */
function stripSchemaVersion(raw: FacadeState & { schemaVersion?: number }): FacadeState {
  const { schemaVersion: _ignored, ...facade } = raw
  return facade as FacadeState
}

function normalizeSharePayload(raw: unknown): DecodedSharePayload | null {
  if (isFacadeState(raw)) {
    return { facade: applyFacadeLoadPipeline(stripSchemaVersion(raw), readSchemaVersion(raw)).facade }
  }
  if (!isRecord(raw) || !isFacadeState(raw.facade)) return null
  const migrated = applyFacadeLoadPipeline(raw.facade as FacadeState, readSchemaVersion(raw))
  const scene = raw.scene != null ? normalizeSceneAppearance(raw.scene) : undefined
  const viewYaw = normalizeViewYaw(raw.viewYaw)
  return {
    facade: migrated.facade,
    scene,
    viewYaw,
  }
}

export function buildSharePayload(
  facade: FacadeState,
  extras?: { scene?: SceneAppearance; viewYaw?: number },
): SharePayload {
  const payload: SharePayload = { facade, schemaVersion: FACADE_SCHEMA_VERSION }
  if (extras?.scene) payload.scene = extras.scene
  if (extras?.viewYaw !== undefined) payload.viewYaw = snapYawTo45(extras.viewYaw)
  return payload
}

export async function encodeFacadeHash(payload: SharePayload | FacadeState): Promise<string> {
  const share: SharePayload = isFacadeState(payload)
    ? { facade: payload, schemaVersion: FACADE_SCHEMA_VERSION }
    : { ...payload, schemaVersion: payload.schemaVersion ?? FACADE_SCHEMA_VERSION }
  const json = JSON.stringify(share)
  const compressed = await gzipBytes(json)
  if (compressed) return `${HASH_PREFIX}${bytesToBase64Url(compressed)}`
  return `${HASH_PREFIX}${encodeURIComponent(json)}`
}

export async function decodeFacadeHash(hash: string): Promise<DecodedSharePayload | null> {
  if (!hash.startsWith(HASH_PREFIX)) return null
  const payload = hash.slice(HASH_PREFIX.length)
  try {
    let raw: unknown
    if (payload.startsWith('%7B') || payload.startsWith('{')) {
      raw = JSON.parse(decodeURIComponent(payload))
    } else {
      const text = await gunzipBytes(base64UrlToBytes(payload))
      if (!text) return null
      raw = JSON.parse(text)
    }
    return normalizeSharePayload(raw)
  } catch {
    return null
  }
}

/** Defaults für alte Links ohne `scene` / `viewYaw`. */
export function sharePayloadDefaults(): Pick<DecodedSharePayload, 'scene' | 'viewYaw'> {
  return {
    scene: { ...DEFAULT_SCENE_APPEARANCE },
    viewYaw: 0,
  }
}

export function readFacadeFromLocationHash(): string {
  return window.location.hash
}

function readLiveHashMarker(): string | null {
  try {
    return localStorage.getItem(LIVE_HASH_KEY)
  } catch {
    return null
  }
}

function writeLiveHashMarker(hash: string | null): void {
  try {
    if (hash) localStorage.setItem(LIVE_HASH_KEY, hash)
    else localStorage.removeItem(LIVE_HASH_KEY)
  } catch {
    // localStorage voll / gesperrt — Marker ist optional.
  }
}

/**
 * `true`, wenn der aktuelle URL-Hash von dieser App selbst (Live-Schreiben / Link kopieren)
 * gesetzt wurde. Dann ist localStorage der frischere Stand (350 ms vs. 1200 ms Debounce)
 * und muss beim Start gewinnen; nur ein fremder/eingefügter Link lädt aus dem Hash.
 */
export function isOwnLiveFacadeHash(hash: string): boolean {
  if (!hash.startsWith(HASH_PREFIX)) return false
  return readLiveHashMarker() === hash
}

/** Obergrenze für Live-Hash in der Adresszeile (Zeichen). Darüber nur localStorage. */
const MAX_LIVE_HASH_CHARS = 12000

export function writeFacadeHash(hash: string): void {
  const url = new URL(window.location.href)
  if (hash.length > MAX_LIVE_HASH_CHARS) {
    // Zu lang: Hash NICHT stehen lassen — ein veralteter `#f=` würde beim Reload
    // gegen den frischen localStorage-Stand gewinnen (Fenster/Wände „springen“).
    if (url.hash.startsWith(HASH_PREFIX)) {
      url.hash = ''
      window.history.replaceState(null, '', url)
    }
    writeLiveHashMarker(null)
    return
  }
  url.hash = hash
  window.history.replaceState(null, '', url)
  writeLiveHashMarker(hash)
}

let facadeHashGeneration = 0
let facadeHashTimer = 0

export function scheduleFacadeHashWrite(payload: SharePayload | FacadeState, delayMs = 1200): void {
  const generation = ++facadeHashGeneration
  window.clearTimeout(facadeHashTimer)
  facadeHashTimer = window.setTimeout(() => {
    void encodeFacadeHash(payload).then((hash) => {
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
  const exported = { ...facade, schemaVersion: FACADE_SCHEMA_VERSION }
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function loadFacadeFromFile(file: File): Promise<FacadeState> {
  const text = await file.text()
  const raw = JSON.parse(text) as FacadeState & { schemaVersion?: number }
  return applyFacadeLoadPipeline(stripSchemaVersion(raw), readSchemaVersion(raw)).facade
}

export async function copyFacadeLink(payload: SharePayload | FacadeState): Promise<string> {
  facadeHashGeneration += 1
  const hash = await encodeFacadeHash(payload)
  writeFacadeHash(hash)
  const url = new URL(window.location.href)
  url.hash = hash
  const link = url.toString()
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link)
  }
  return link
}
