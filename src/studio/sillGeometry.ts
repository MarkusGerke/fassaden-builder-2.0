import * as THREE from 'three'

/**
 * Außenbank-Quader ohne die wandseitige Rückfläche.
 * Die Rückseite über dem Mauerwerk z-fightet ab mittlerer Zoom-Stufe
 * (graue Rechtecke links/rechts der Bank); Front/Deckel/Stirn bleiben.
 */
export function createOuterSillBoardGeometry(
  width: number,
  thickness: number,
  depth: number,
  translateZ: number,
  outwardSign: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, thickness, depth)
  geo.translate(0, -thickness / 2, translateZ)
  const index = geo.getIndex()
  if (!index) return geo
  // BoxGeometry-Faces: +X, −X, +Y, −Y, +Z, −Z — je 6 Indices.
  const wallFace = outwardSign < 0 ? 4 : 5
  const src = index.array
  const dst: number[] = []
  for (let face = 0; face < 6; face += 1) {
    if (face === wallFace) continue
    const start = face * 6
    for (let i = 0; i < 6; i += 1) dst.push(src[start + i]!)
  }
  geo.setIndex(dst)
  geo.clearGroups()
  return geo
}
