/**
 * Bloom-Hilfen: Layer-Markierung für besonders helle Lichtquellen (HDR-Kern).
 * Die eigentliche Bloom-Pipeline ist Full-Scene `UnrealBloomPass` in `main.ts`
 * (Schwelle/Stärke/Radius auf dem gesamten Bild) — Selective-Darkening entfiel in v2.0.104,
 * weil Bloom sonst nur an Marker-Kugeln wirkte und „keinerlei Wirkung“ zeigte.
 */
import * as THREE from 'three'
import { BLOOM_LAYER } from '../utils/sunLighting'

/** Optional: HDR-Lichtkerne zusätzlich auf BLOOM_LAYER (Full-Scene-Bloom erfasst sie ohnehin). */
export function enableBloomLayer(obj: THREE.Object3D): void {
  obj.layers.enable(BLOOM_LAYER)
}
