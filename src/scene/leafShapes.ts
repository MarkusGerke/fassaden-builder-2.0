/**
 * Einfache Herbstblatt-Silhouetten (flach, wenige Dreiecke) für Bodenlaub.
 */
import * as THREE from 'three'

export const LEAF_SHAPE_COUNT = 3 as const
export type LeafShapeId = 0 | 1 | 2

const EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: 0.2,
  bevelEnabled: false,
  curveSegments: 1,
  steps: 1,
}

function shapeMaple(): THREE.Shape {
  const s = new THREE.Shape()
  // Ahorn-ähnlich: gelappte Silhouette, Spitze oben (lokal +Y vor Rotation).
  s.moveTo(0, 6)
  s.lineTo(1.8, 3.2)
  s.lineTo(5.2, 3.6)
  s.lineTo(2.4, 1.2)
  s.lineTo(3.6, -2.4)
  s.lineTo(0.6, -0.8)
  s.lineTo(0, -5.5)
  s.lineTo(-0.6, -0.8)
  s.lineTo(-3.6, -2.4)
  s.lineTo(-2.4, 1.2)
  s.lineTo(-5.2, 3.6)
  s.lineTo(-1.8, 3.2)
  s.closePath()
  return s
}

function shapeOval(): THREE.Shape {
  const s = new THREE.Shape()
  // Oval / Eiche-ähnlich (Polygon, wenig Segmente).
  s.moveTo(0, 5.5)
  s.lineTo(2.4, 4)
  s.lineTo(3.4, 0)
  s.lineTo(2.4, -4)
  s.lineTo(0, -5.5)
  s.lineTo(-2.4, -4)
  s.lineTo(-3.4, 0)
  s.lineTo(-2.4, 4)
  s.closePath()
  return s
}

function shapeLance(): THREE.Shape {
  const s = new THREE.Shape()
  // Spitz / lanzettlich.
  s.moveTo(0, 6)
  s.lineTo(1.8, 2.5)
  s.lineTo(1.4, -2)
  s.lineTo(0, -6)
  s.lineTo(-1.4, -2)
  s.lineTo(-1.8, 2.5)
  s.closePath()
  return s
}

const SHAPERS: (() => THREE.Shape)[] = [shapeMaple, shapeOval, shapeLance]

/** Geteilte Geometrien — einmal erzeugen, viele Meshes. */
let shared: THREE.BufferGeometry[] | null = null

export function getLeafGeometries(): readonly THREE.BufferGeometry[] {
  if (shared) return shared
  shared = SHAPERS.map((make) => {
    const geo = new THREE.ExtrudeGeometry(make(), EXTRUDE)
    // Flach auf XZ legen (Extrude geht in +Z).
    geo.rotateX(-Math.PI / 2)
    geo.computeVertexNormals()
    return geo
  })
  return shared
}

export function normalizeLeafShapeId(raw: unknown): LeafShapeId {
  const n = typeof raw === 'number' ? Math.round(raw) : Number(raw)
  if (n === 1 || n === 2) return n
  return 0
}

export function disposeLeafGeometries(): void {
  if (!shared) return
  for (const g of shared) g.dispose()
  shared = null
}
