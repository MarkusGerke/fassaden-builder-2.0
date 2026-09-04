/**
 * Neutraler Studio-Bühnenmodus: flacher Boden (größer als das Haus) in einer Kugel,
 * die nur von innen sichtbar ist — von außen blickt man hindurch. Beige Tag / nahezu schwarz Nacht.
 */
import * as THREE from 'three'

const STORAGE_KEY = 'fassaden-builder-stage-environment'

export type StageEnvironment = 'sky' | 'studio'

export const DEFAULT_STAGE_ENVIRONMENT: StageEnvironment = 'sky'

/** Helles Beige wie Produktfotos / Softbox-Studio. */
export const STUDIO_DAY_BEIGE = '#E8E3DD'
/** Nahezu Schwarz bei Nacht — warme Unterton, kein kühles Blau. */
export const STUDIO_NIGHT_NEAR_BLACK = '#0C0B0A'

/** Mindest-Schattenweichheit (PCSS-Slider-Skala) im Neutralmodus. */
export const STUDIO_MIN_SHADOW_SOFTNESS = 5.5
/** Leichtes Ambient-Boost — Schatten bleiben sichtbar. */
export const STUDIO_AMBIENT_BOOST = 1.12
/** Key-Licht etwas gedämpft → weichere Kontraste. */
export const STUDIO_KEY_INTENSITY_SCALE = 0.85

/** Extra-Rand des flachen Bodens über die Gebäude-AABB (cm). */
export const STUDIO_FLOOR_MARGIN_CM = 480
/** Kugelradius = halbe Bodengröße × Faktor (Kugel umschließt die Platte). */
export const STUDIO_SPHERE_RADIUS_FACTOR = 0.72
export const STUDIO_SPHERE_SEGMENTS_W = 64
export const STUDIO_SPHERE_SEGMENTS_H = 48

export function loadStageEnvironment(): StageEnvironment {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'sky' || raw === 'studio') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_STAGE_ENVIRONMENT
}

export function saveStageEnvironment(mode: StageEnvironment): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function isStudioStage(mode: StageEnvironment): boolean {
  return mode === 'studio'
}

/**
 * Mischt Tagesbeige → Nacht-Schwarz anhand des Celestial-`twilightFactor` (0 Tag … 1 Nacht).
 */
export function studioEnvironmentHex(twilightFactor: number): string {
  const t = THREE.MathUtils.clamp(twilightFactor, 0, 1)
  const ease = THREE.MathUtils.smoothstep(t, 0.12, 0.92)
  const day = new THREE.Color(STUDIO_DAY_BEIGE)
  const night = new THREE.Color(STUDIO_NIGHT_NEAR_BLACK)
  return `#${day.clone().lerp(night, ease).getHexString()}`
}

/**
 * Flacher Neutral-Boden: immer größer als die Gebäude-Spannweite (+ Rand).
 * `groundSize` ist die Landschafts-Bodenplatte; Gebäude-Halbspanne kommt separat.
 */
export function studioFlatFloorSize(groundSize: number, buildingSpanCm: number): number {
  const fromBuilding = Math.max(0, buildingSpanCm) + STUDIO_FLOOR_MARGIN_CM * 2
  return Math.max(400, groundSize, fromBuilding)
}

/** Kugelradius so, dass die flache Platte innen liegt und die Kuppel darüber schließt. */
export function studioSphereRadius(flatFloorSize: number): number {
  return Math.max(300, flatFloorSize * STUDIO_SPHERE_RADIUS_FACTOR)
}

/**
 * Volle Kugel, Normalen nach außen — Material mit `BackSide`:
 * von außen unsichtbar (hindurchschauen), von innen beige Innenfläche.
 */
export function createStudioSphereGeometry(
  radius: number,
  opts?: { widthSegments?: number; heightSegments?: number },
): THREE.SphereGeometry {
  const r = Math.max(40, radius)
  const w = Math.max(16, opts?.widthSegments ?? STUDIO_SPHERE_SEGMENTS_W)
  const h = Math.max(12, opts?.heightSegments ?? STUDIO_SPHERE_SEGMENTS_H)
  return new THREE.SphereGeometry(r, w, h)
}

/** @deprecated Alias — ältere Tests/Aufrufe; nutzt flachen Radius als Kugelradius. */
export function createStudioBowlGeometry(
  floorRadius: number,
  opts?: { rimRatio?: number; radialSegments?: number; ringSegments?: number },
): THREE.BufferGeometry {
  void opts?.rimRatio
  const radial = opts?.radialSegments
  const rings = opts?.ringSegments
  return createStudioSphereGeometry(Math.max(40, floorRadius), {
    widthSegments: radial,
    heightSegments: rings,
  })
}

/** @deprecated → {@link studioFlatFloorSize} / {@link studioSphereRadius}. */
export function studioBowlFloorRadius(groundSize: number): number {
  return studioSphereRadius(studioFlatFloorSize(groundSize, 0))
}
