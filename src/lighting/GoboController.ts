/**
 * GoboController – unsichtbare Schattenmasken über der Szene.
 *
 * Jedes Gobo ist ein PlaneGeometry mit:
 *   - MeshBasicMaterial { colorWrite: false, alphaMap, alphaTest: 0.5, transparent: true }
 *   - castShadow: true  → wirft einen Schatten
 *   - receiveShadow: false, sichtbar: false im Render (colorWrite erzeugt kein Pixel)
 *
 * Die Schatten entstehen, weil die Shadow-Map-Kamera das Mesh rendert (alpha cutout).
 * Im Haupt-Render erzeugt colorWrite:false keinerlei sichtbare Pixel.
 */
import * as THREE from 'three'
import { createGoboTexture, type GoboPreset } from './goboTextures'
import { createId } from '../utils/id'

export interface GoboItem {
  id: string
  preset: GoboPreset
  /** Horizontalversatz relativ zur Fassadenmitte in cm */
  offsetX: number
  /** Höhe über dem Boden in cm */
  height: number
  /** Abstand vor der Fassade in cm (negativ = vor der Wand) */
  distance: number
  /** Breite des Gobo-Mesh in cm */
  size: number
  /** Seed für prozeduralen Inhalt */
  seed: number
  enabled: boolean
}

export function defaultGoboItem(id: string, preset: GoboPreset): GoboItem {
  return {
    id,
    preset,
    offsetX: 0,
    height: 200,
    distance: 300,
    size: 400,
    seed: 1,
    enabled: true,
  }
}

export function normalizeGoboItem(raw: unknown): GoboItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const PRESETS: GoboPreset[] = ['tree', 'leaves', 'clouds', 'blinds']
  const preset: GoboPreset = PRESETS.includes(r.preset as GoboPreset) ? (r.preset as GoboPreset) : 'tree'
  return {
    id: typeof r.id === 'string' ? r.id : createId(),
    preset,
    offsetX: typeof r.offsetX === 'number' ? r.offsetX : 0,
    height: typeof r.height === 'number' ? r.height : 200,
    distance: typeof r.distance === 'number' ? r.distance : 300,
    size: typeof r.size === 'number' ? r.size : 400,
    seed: typeof r.seed === 'number' ? r.seed : 1,
    enabled: r.enabled !== false,
  }
}

export interface GoboSettings {
  items: GoboItem[]
}

export const DEFAULT_GOBO_SETTINGS: GoboSettings = { items: [] }

export function normalizeGoboSettings(raw: unknown): GoboSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_GOBO_SETTINGS }
  const r = raw as Record<string, unknown>
  const items = Array.isArray(r.items)
    ? r.items.map(normalizeGoboItem).filter((x): x is GoboItem => x !== null)
    : []
  return { items }
}

export function isGoboSettings(value: unknown): value is GoboSettings {
  if (typeof value !== 'object' || value === null) return false
  return Array.isArray((value as Record<string, unknown>).items)
}

// ─── Controller ────────────────────────────────────────────────────────────────

type MeshEntry = {
  item: GoboItem
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
}

export class GoboController {
  private readonly group = new THREE.Group()
  private entries = new Map<string, MeshEntry>()
  /** Referenzposition: Fassadenmitte XZ – gesetzt via setFacadeCenter */
  private facadeCX = 0
  private facadeCZ = 0
  private facadeYawRad = 0

  constructor(parent: THREE.Object3D) {
    parent.add(this.group)
  }

  /** Setzt die Fassadenmitte und Ausrichtung für korrekte Gobo-Platzierung. */
  setFacadeCenter(cx: number, cz: number, yawDeg: number) {
    this.facadeCX = cx
    this.facadeCZ = cz
    this.facadeYawRad = (yawDeg * Math.PI) / 180
  }

  setSettings(settings: GoboSettings) {
    // Entferne veraltete Meshes
    const newIds = new Set(settings.items.map((i) => i.id))
    for (const [id, entry] of this.entries) {
      if (!newIds.has(id)) {
        this.group.remove(entry.mesh)
        entry.mesh.geometry.dispose()
        entry.material.dispose()
        this.entries.delete(id)
      }
    }

    for (const item of settings.items) {
      if (!item.enabled) {
        const entry = this.entries.get(item.id)
        if (entry) {
          entry.mesh.visible = false
        }
        continue
      }
      this.upsert(item)
    }
  }

  private upsert(item: GoboItem) {
    const existing = this.entries.get(item.id)
    if (existing) {
      this.applyItemToMesh(item, existing.mesh, existing.material)
      existing.item = item
    } else {
      const geo = new THREE.PlaneGeometry(1, 1)
      const alphaMap = createGoboTexture(item.preset, item.seed)
      const mat = new THREE.MeshBasicMaterial({
        colorWrite: false,
        alphaMap,
        alphaTest: 0.4,
        transparent: true,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = false
      this.group.add(mesh)
      this.entries.set(item.id, { item, mesh, material: mat })
      this.applyItemToMesh(item, mesh, mat)
    }
  }

  private applyItemToMesh(item: GoboItem, mesh: THREE.Mesh, mat: THREE.MeshBasicMaterial) {
    mesh.visible = item.enabled
    // Gobo ist horizontal (Schatten auf Boden/Fassade), Plane liegt horizontal
    mesh.rotation.set(-Math.PI / 2, 0, 0)
    mesh.scale.set(item.size, item.size, 1)

    // Position: Fassadenmitte + offsetX entlang Wand + distance vor Fassade
    const cosYaw = Math.cos(this.facadeYawRad)
    const sinYaw = Math.sin(this.facadeYawRad)
    // „vor" der Fassade = entlang des Outward-Vektors
    const outX = -sinYaw
    const outZ = -cosYaw
    const alongX = cosYaw
    const alongZ = -sinYaw

    mesh.position.set(
      this.facadeCX + alongX * item.offsetX + outX * item.distance,
      item.height,
      this.facadeCZ + alongZ * item.offsetX + outZ * item.distance,
    )

    // Textur bei Preset/Seed-Wechsel
    const tex = createGoboTexture(item.preset, item.seed)
    if (mat.alphaMap !== tex) {
      mat.alphaMap = tex
      mat.needsUpdate = true
    }
  }

  dispose() {
    for (const entry of this.entries.values()) {
      this.group.remove(entry.mesh)
      entry.mesh.geometry.dispose()
      entry.material.dispose()
    }
    this.entries.clear()
  }
}
