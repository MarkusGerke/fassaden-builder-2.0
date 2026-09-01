import * as THREE from 'three'
import { DEFAULT_GLASS_COLOR } from '../constants/colorPalettes'
import type { ArchFormId } from '../utils/archForms'
import {
  ARCH_MESH_SEGMENTS,
  glazingArchCrown,
  glazingArchGeom,
  insetArchGeom,
} from '../utils/openingGeometry'
import { createGlassMaterial, createTintedMaterial } from '../utils/threeColors'
import type { OpeningGlassConfig } from '../utils/glassConfig'
import type { SurfaceFinish } from '../types/facade'

const FRAME_THICK = 4

function resolveGlazingForm(glazingArch: boolean | ArchFormId): ArchFormId {
  if (typeof glazingArch === 'string') return glazingArch
  return glazingArch ? 'round' : 'rect'
}

function appendCrown(
  path: THREE.Shape | THREE.Path,
  crown: { x: number; y: number }[],
  reverse: boolean,
): void {
  const pts = reverse ? [...crown].reverse() : crown
  for (let i = 1; i < pts.length; i += 1) {
    path.lineTo(pts[i]!.x, pts[i]!.y)
  }
}

function createArchedLodGeometry(
  width: number,
  height: number,
  thickness: number,
  depth: number,
  withHole: boolean,
  form: ArchFormId,
  riseCm?: number | null,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  const crown = glazingArchCrown(width, height, form, ARCH_MESH_SEGMENTS, riseCm)
  const springY = crown[0]?.y ?? height

  shape.moveTo(0, 0)
  shape.lineTo(width, 0)
  shape.lineTo(width, springY)
  if (form === 'round') {
    const geom = glazingArchGeom(width, height, riseCm)
    if (geom) shape.absarc(geom.cx, geom.cy, geom.r, 0, Math.PI, false)
    else appendCrown(shape, crown, true)
  } else {
    appendCrown(shape, crown, true)
  }
  shape.closePath()

  if (withHole) {
    const t = Math.min(thickness, width / 2 - 0.4, height / 2 - 0.4)
    if (t > 0.4) {
      const hole = new THREE.Path()
      if (form === 'round') {
        const geom = glazingArchGeom(width, height, riseCm)
        const inner = geom ? insetArchGeom(geom, t) : null
        if (inner) {
          hole.moveTo(t, t)
          hole.lineTo(t, inner.springY)
          hole.absarc(inner.cx, inner.cy, inner.r, Math.PI, 0, true)
          hole.lineTo(width - t, t)
          hole.closePath()
        } else {
          hole.moveTo(t, t)
          hole.lineTo(t, height - t)
          hole.lineTo(width - t, height - t)
          hole.lineTo(width - t, t)
          hole.closePath()
        }
      } else {
        const innerCrown = glazingArchCrown(
          Math.max(2, width - 2 * t),
          Math.max(2, height - 2 * t),
          form,
          ARCH_MESH_SEGMENTS,
          riseCm,
        ).map((p) => ({ x: p.x + t, y: p.y + t }))
        const innerSpring = innerCrown[0]?.y ?? height - t
        hole.moveTo(t, t)
        hole.lineTo(t, innerSpring)
        appendCrown(hole, innerCrown, false)
        hole.lineTo(width - t, t)
        hole.closePath()
      }
      shape.holes.push(hole)
    }
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: ARCH_MESH_SEGMENTS,
  })
}

/**
 * LOD-Mittelstufe: Glasfläche + schmaler Rahmen statt voller Gründerzeit-Gruppe.
 * `glazingArch`: Legacy-boolean oder `ArchFormId`.
 * `riseCm`: optionales Stichmaß aus `Opening.arch`.
 */
export function createSimpleWindowMesh(
  width: number,
  height: number,
  frameColor: string,
  glassColor: string | OpeningGlassConfig = DEFAULT_GLASS_COLOR,
  glazingArch: boolean | ArchFormId = false,
  frameFinish?: SurfaceFinish | null,
  riseCm?: number | null,
): THREE.Group {
  const group = new THREE.Group()
  group.userData.proceduralWindow = true
  group.userData.lodTier = 'low'

  const frameMat = createTintedMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
    frameColor,
    frameFinish,
  )
  const t = Math.min(FRAME_THICK, width * 0.12, height * 0.12)
  const depth = 3
  const form = resolveGlazingForm(glazingArch)

  if (form !== 'rect') {
    const frameGeo = createArchedLodGeometry(width, height, t, depth, true, form, riseCm)
    const frame = new THREE.Mesh(frameGeo, frameMat)
    frame.position.set(-width / 2, -height / 2, -depth / 2)
    frame.castShadow = true
    frame.receiveShadow = false
    group.add(frame)

    const glassMat = createGlassMaterial(glassColor)
    const glassShape = new THREE.Shape()
    if (form === 'round') {
      const inner = glazingArchGeom(width, height, riseCm)
      const inset = inner ? insetArchGeom(inner, t) : null
      if (inset) {
        glassShape.moveTo(t, t)
        glassShape.lineTo(width - t, t)
        glassShape.lineTo(width - t, inset.springY)
        glassShape.absarc(inset.cx, inset.cy, inset.r, 0, Math.PI, false)
        glassShape.closePath()
      } else {
        glassShape.moveTo(t, t)
        glassShape.lineTo(width - t, t)
        glassShape.lineTo(width - t, height - t)
        glassShape.lineTo(t, height - t)
        glassShape.closePath()
      }
    } else {
      const crown = glazingArchCrown(
        Math.max(2, width - 2 * t),
        Math.max(2, height - 2 * t),
        form,
        ARCH_MESH_SEGMENTS,
        riseCm,
      ).map((p) => ({ x: p.x + t, y: p.y + t }))
      const springY = crown[0]?.y ?? height - t
      glassShape.moveTo(t, t)
      glassShape.lineTo(width - t, t)
      glassShape.lineTo(width - t, springY)
      appendCrown(glassShape, crown, true)
      glassShape.closePath()
    }
    const glassGeo = new THREE.ExtrudeGeometry(glassShape, {
      depth: 1.2,
      bevelEnabled: false,
      curveSegments: ARCH_MESH_SEGMENTS,
    })
    const glass = new THREE.Mesh(glassGeo, glassMat)
    glass.position.set(-width / 2, -height / 2, -0.6)
    glass.castShadow = false
    glass.receiveShadow = false
    group.add(glass)
    return group
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), frameMat)
  top.position.set(0, height / 2 - t / 2, 0)
  top.castShadow = true
  top.receiveShadow = false
  group.add(top)

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), frameMat)
  bottom.position.set(0, -height / 2 + t / 2, 0)
  bottom.castShadow = true
  bottom.receiveShadow = false
  group.add(bottom)

  const left = new THREE.Mesh(new THREE.BoxGeometry(t, height - t * 2, depth), frameMat)
  left.position.set(-width / 2 + t / 2, 0, 0)
  left.castShadow = true
  left.receiveShadow = false
  group.add(left)

  const right = new THREE.Mesh(new THREE.BoxGeometry(t, height - t * 2, depth), frameMat)
  right.position.set(width / 2 - t / 2, 0, 0)
  right.castShadow = true
  right.receiveShadow = false
  group.add(right)

  const glassMat = createGlassMaterial(glassColor)
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1, width - t * 2), Math.max(1, height - t * 2), 1.2),
    glassMat,
  )
  glass.castShadow = false
  glass.receiveShadow = false
  group.add(glass)

  return group
}
