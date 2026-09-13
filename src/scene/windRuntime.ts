import * as THREE from 'three'

export type WindFabricHandle = {
  mesh: THREE.Mesh
  /** Ruhe-Positionen (x,y,z interleaved). */
  basePositions: Float32Array
  /** 0…1 Phasen-Offset für Gust-Variation. */
  phase: number
  /** Skala der Auslenkung (cm). Default 1. */
  amplitudeScale?: number
}

const fabrics = new Map<string, WindFabricHandle>()

export function registerWindFabric(
  id: string,
  mesh: THREE.Mesh,
  opts?: { phase?: number; amplitudeScale?: number },
): void {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return
  const base = new Float32Array(pos.array.length)
  base.set(pos.array as ArrayLike<number>)
  fabrics.set(id, {
    mesh,
    basePositions: base,
    phase: opts?.phase ?? Math.random(),
    amplitudeScale: opts?.amplitudeScale ?? 1,
  })
}

export function unregisterWindFabric(id: string): void {
  fabrics.delete(id)
}

export function clearWindFabrics(): void {
  fabrics.clear()
}

export function windFabricIds(): string[] {
  return [...fabrics.keys()]
}

/** Hash-Noise 0…1 */
function hashNoise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function smoothNoise(t: number): number {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return hashNoise(i) * (1 - u) + hashNoise(i + 1) * u
}

/**
 * Pro-Frame Wind auf registrierte Stoffe.
 * @returns true wenn Vertices geändert wurden (Render nötig).
 */
export function tickWindFabrics(
  timeSec: number,
  intensity: number,
  opts?: { paused?: boolean },
): boolean {
  if (opts?.paused || intensity <= 1e-4 || fabrics.size === 0) {
    // Bei 0: auf Base zurücksetzen falls noch Offset.
    let restored = false
    if (intensity <= 1e-4) {
      for (const handle of fabrics.values()) {
        const pos = handle.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
        if (!pos) continue
        let dirty = false
        for (let i = 0; i < handle.basePositions.length; i += 1) {
          if (pos.array[i] !== handle.basePositions[i]) {
            dirty = true
            break
          }
        }
        if (!dirty) continue
        ;(pos.array as Float32Array).set(handle.basePositions)
        pos.needsUpdate = true
        handle.mesh.geometry.computeVertexNormals()
        restored = true
      }
    }
    return restored
  }

  const amp = intensity * intensity * 4.5 + intensity * 2.2
  const gust =
    smoothNoise(timeSec * 0.35) * 0.55 +
    smoothNoise(timeSec * 0.9 + 17) * 0.3 +
    smoothNoise(timeSec * 2.4 + 41) * 0.15
  const storm = intensity > 0.7 ? (intensity - 0.7) / 0.3 : 0

  for (const handle of fabrics.values()) {
    const pos = handle.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    if (!pos) continue
    const base = handle.basePositions
    const scale = (handle.amplitudeScale ?? 1) * amp * (0.55 + gust)
    const phase = handle.phase * Math.PI * 2
    const arr = pos.array as Float32Array

    for (let i = 0; i < pos.count; i += 1) {
      const ix = i * 3
      const bx = base[ix]!
      const by = base[ix + 1]!
      const bz = base[ix + 2]!
      // Entlang Ausladung (z) und Breite (x) Wellen; Offset vor allem ±Y und leicht ±X.
      const along = bz * 0.04 + bx * 0.02
      const w1 = Math.sin(timeSec * (1.2 + storm * 1.8) + along + phase)
      const w2 = Math.sin(timeSec * (2.7 + storm * 2.2) + along * 1.7 + phase * 1.3)
      const w3 = Math.sin(timeSec * (4.1 + storm) + bx * 0.08 + phase)
      const flap = (w1 * 0.55 + w2 * 0.3 + w3 * 0.15) * scale
      // Stärker in der Mitte der Bahn (nicht am Kasten/Frontrohr fixiert).
      const edge = Math.min(1, Math.max(0, Math.abs(bz) / Math.max(8, Math.abs(bz) + 1)))
      const edgeFade = Math.sin(Math.PI * Math.min(1, edge))
      arr[ix] = bx + flap * 0.15 * edgeFade
      arr[ix + 1] = by + flap * edgeFade
      arr[ix + 2] = bz + flap * 0.08 * edgeFade
    }
    pos.needsUpdate = true
    handle.mesh.geometry.computeVertexNormals()
  }
  return true
}

/** Reine Test-Hilfe: Displacement-Amplitude-Schätzung ohne Mesh. */
export function windDisplacementAmplitude(intensity: number): number {
  if (intensity <= 0) return 0
  return intensity * intensity * 4.5 + intensity * 2.2
}
