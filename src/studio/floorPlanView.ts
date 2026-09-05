import * as THREE from 'three'
import { PLAN_GRID, STUDIO_WALL_DEPTH } from './constants'
import {
  extractPlanRings,
  formatPlanLengthCm,
  isValidPlanLine,
  planLineLengthCm,
  planNodeWorld,
  type FloorPlan,
  type PlanNode,
} from './floorPlan'
import type { Wall, Building } from '../types/facade'
import { wallAlongDelta } from './walls'
import { floorIndex } from '../utils/layers'
import type { BuildingGuide } from './buildingGuides'
import { planGridBoundsForBuilding } from '../utils/buildings'

/** Zellen über die Zeichenfläche — Weltmaß wie früher 32×48 cm (= 192×8 cm). */
export const PLAN_DRAW_CELLS = 192
export const PLAN_VIEW_SIZE = PLAN_DRAW_CELLS * PLAN_GRID
/** Abstand der Draufsicht-Kamera über dem höchsten Gebäudeteil (cm). */
export const TOP_VIEW_CAMERA_PAD = 160

export interface PlanGridPoint {
  gx: number
  gz: number
}

export interface PlanPreview {
  start: PlanGridPoint
  end: PlanGridPoint
}

function gridWorld(gx: number, gz: number): THREE.Vector3 {
  return new THREE.Vector3(gx * PLAN_GRID, 0.8, gz * PLAN_GRID)
}

function disposeLine(line: THREE.Line) {
  line.geometry.dispose()
  if (Array.isArray(line.material)) line.material.forEach((m) => m.dispose())
  else line.material.dispose()
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose()
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
  else mesh.material.dispose()
}

function disposePlanObject(obj: THREE.Object3D) {
  if (obj instanceof THREE.Line) disposeLine(obj)
  else if (obj instanceof THREE.Mesh) disposeMesh(obj)
}

function createEdgeMesh(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  options: { height?: number; thickness?: number; opacity?: number } = {},
): THREE.Mesh {
  const height = options.height ?? 5
  const thickness = options.thickness ?? 4
  const dir = to.clone().sub(from)
  const length = dir.length()
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(length, 0.001), height, thickness), material)
  const mid = from.clone().add(to).multiplyScalar(0.5)
  mesh.position.set(mid.x, height * 0.5 + 0.3, mid.z)
  if (length > 0.001) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize())
  }
  return mesh
}

export class FloorPlanView {
  readonly root = new THREE.Group()
  private readonly gridGroup = new THREE.Group()
  private readonly wallOverlayGroup = new THREE.Group()
  private readonly wallDockPreviewGroup = new THREE.Group()
  private readonly buildingBoundsGroup = new THREE.Group()
  private readonly buildingGuidesGroup = new THREE.Group()
  private readonly alignGuidesGroup = new THREE.Group()
  private readonly edgesGroup = new THREE.Group()
  private readonly nodesGroup = new THREE.Group()
  private readonly previewGroup = new THREE.Group()
  private readonly fillGroup = new THREE.Group()
  private readonly labelLayer: HTMLElement
  private labelElements: HTMLDivElement[] = []
  private previewLabel: HTMLDivElement | null = null
  private renderStyle: 'color' | 'line' = 'color'
  private lineStrokeScale = 1

  constructor(labelLayer: HTMLElement) {
    this.labelLayer = labelLayer
    this.root.add(
      this.gridGroup,
      this.wallOverlayGroup,
      this.wallDockPreviewGroup,
      this.buildingBoundsGroup,
      this.buildingGuidesGroup,
      this.alignGuidesGroup,
      this.fillGroup,
      this.edgesGroup,
      this.nodesGroup,
      this.previewGroup,
    )
    for (const group of [
      this.gridGroup,
      this.wallOverlayGroup,
      this.wallDockPreviewGroup,
      this.buildingBoundsGroup,
      this.buildingGuidesGroup,
      this.alignGuidesGroup,
      this.fillGroup,
      this.edgesGroup,
      this.nodesGroup,
      this.previewGroup,
    ]) {
      group.renderOrder = 1
    }
    this.buildGrid()
  }

  private gridFine = new THREE.LineBasicMaterial({ color: 0xd8d8d8 })
  private gridBold = new THREE.LineBasicMaterial({ color: 0xbcbcbc })
  private gridBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }

  private clearGrid() {
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0]
      this.gridGroup.remove(child)
      if (child instanceof THREE.Line) child.geometry.dispose()
    }
  }

  private buildGrid(minX = 0, maxX = PLAN_VIEW_SIZE, minZ = 0, maxZ = PLAN_VIEW_SIZE) {
    this.clearGrid()
    const x0 = Math.floor(minX / PLAN_GRID) * PLAN_GRID
    const x1 = Math.ceil(maxX / PLAN_GRID) * PLAN_GRID
    const z0 = Math.floor(minZ / PLAN_GRID) * PLAN_GRID
    const z1 = Math.ceil(maxZ / PLAN_GRID) * PLAN_GRID
    this.gridBounds = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }
    for (let x = x0; x <= x1 + 0.01; x += PLAN_GRID) {
      const i = Math.round(x / PLAN_GRID)
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.2, z0),
        new THREE.Vector3(x, 0.2, z1),
      ])
      this.gridGroup.add(new THREE.Line(geo, i % 4 === 0 ? this.gridBold : this.gridFine))
    }
    for (let z = z0; z <= z1 + 0.01; z += PLAN_GRID) {
      const i = Math.round(z / PLAN_GRID)
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x0, 0.2, z),
        new THREE.Vector3(x1, 0.2, z),
      ])
      this.gridGroup.add(new THREE.Line(geo, i % 4 === 0 ? this.gridBold : this.gridFine))
    }
  }

  /** Raster über den sichtbaren Kamerabereich legen. */
  syncGridToCamera(camera: THREE.OrthographicCamera) {
    const pad = PLAN_GRID * 8
    const halfW = (camera.right - camera.left) / 2
    const halfH = (camera.top - camera.bottom) / 2
    const cx = camera.position.x
    const cz = camera.position.z
    const minX = cx - halfW - pad
    const maxX = cx + halfW + pad
    const minZ = cz - halfH - pad
    const maxZ = cz + halfH + pad
    const { minX: a, maxX: b, minZ: c, maxZ: d } = this.gridBounds
    if (minX >= a && maxX <= b && minZ >= c && maxZ <= d) return
    this.buildGrid(minX - pad, maxX + pad, minZ - pad, maxZ + pad)
  }

  setRenderStyle(style: 'color' | 'line') {
    this.renderStyle = style
  }

  setLineStrokeScale(scale: number) {
    this.lineStrokeScale = Math.min(3, Math.max(0.25, scale))
  }

  private edgeThickness(base = 4): number {
    return base * this.lineStrokeScale
  }

  clearLabels() {
    for (const label of this.labelElements) label.remove()
    this.labelElements.length = 0
    this.previewLabel?.remove()
    this.previewLabel = null
  }

  rebuild(plan: FloorPlan, preview: PlanPreview | null, activeNode: PlanGridPoint | null) {
    while (this.edgesGroup.children.length > 0) {
      const child = this.edgesGroup.children[0]
      this.edgesGroup.remove(child)
      disposePlanObject(child)
    }
    while (this.nodesGroup.children.length > 0) {
      this.nodesGroup.remove(this.nodesGroup.children[0])
    }
    while (this.previewGroup.children.length > 0) {
      const child = this.previewGroup.children[0]
      this.previewGroup.remove(child)
      disposePlanObject(child)
    }
    this.clearLabels()

    while (this.fillGroup.children.length > 0) {
      const child = this.fillGroup.children[0]
      this.fillGroup.remove(child)
      disposePlanObject(child)
    }

    const nodeById = new Map(plan.nodes.map((node) => [node.id, node]))
    const rings = extractPlanRings(plan)
    const closed = rings.some((ring) => ring.closed)
    const lineMode = this.renderStyle === 'line'
    const edgeColor = lineMode ? 0x000000 : closed ? 0x1f6b3a : 0x222222

    for (const ring of rings) {
      if (!ring.closed || ring.nodes.length < 3) continue
      if (lineMode) continue
      const shape = new THREE.Shape()
      ring.nodes.forEach((node, index) => {
        const x = node.gx * PLAN_GRID
        const z = node.gz * PLAN_GRID
        if (index === 0) shape.moveTo(x, z)
        else shape.lineTo(x, z)
      })
      shape.closePath()
      const geometry = new THREE.ShapeGeometry(shape)
      geometry.rotateX(Math.PI / 2)
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x8fbf9a,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
        }),
      )
      mesh.position.y = 0.4
      this.fillGroup.add(mesh)
    }
    for (const edge of plan.edges) {
      const from = nodeById.get(edge.fromId)
      const to = nodeById.get(edge.toId)
      if (!from || !to) continue
      const a = gridWorld(from.gx, from.gz)
      const b = gridWorld(to.gx, to.gz)
      const edgeMesh = createEdgeMesh(a, b, edgeColor, { thickness: this.edgeThickness() })
      edgeMesh.userData.edgeId = edge.id
      this.edgesGroup.add(edgeMesh)
      this.queueLabel(
        a.clone().lerp(b, 0.5),
        formatPlanLengthCm(planLineLengthCm(from.gx, from.gz, to.gx, to.gz)),
        true,
      )
    }

    const nodeGeo = new THREE.SphereGeometry(5, 12, 12)
    const nodeMat = new THREE.MeshBasicMaterial({ color: lineMode ? 0x000000 : 0x333333 })
    const activeMat = new THREE.MeshBasicMaterial({ color: 0xff8800 })
    for (const node of plan.nodes) {
      const mesh = new THREE.Mesh(
        nodeGeo,
        activeNode?.gx === node.gx && activeNode?.gz === node.gz ? activeMat : nodeMat,
      )
      const world = gridWorld(node.gx, node.gz)
      mesh.position.copy(world)
      mesh.userData.nodeId = node.id
      this.nodesGroup.add(mesh)
    }

    if (preview && (preview.start.gx !== preview.end.gx || preview.start.gz !== preview.end.gz)) {
      const valid = isValidPlanLine(
        preview.start.gx,
        preview.start.gz,
        preview.end.gx,
        preview.end.gz,
      )
      const a = gridWorld(preview.start.gx, preview.start.gz)
      const b = gridWorld(preview.end.gx, preview.end.gz)
      this.previewGroup.add(
        createEdgeMesh(a, b, valid ? 0xff8800 : 0xe07070, {
          height: 4,
          thickness: this.edgeThickness(3),
          opacity: 0.85,
        }),
      )
      const mid = a.clone().lerp(b, 0.5)
      this.previewLabel = this.createLabelElement(valid ? 'plan-label valid' : 'plan-label invalid')
      this.previewLabel.textContent = valid
        ? formatPlanLengthCm(
            planLineLengthCm(preview.start.gx, preview.start.gz, preview.end.gx, preview.end.gz),
          )
        : '—'
      this.previewLabel.dataset.worldX = String(mid.x)
      this.previewLabel.dataset.worldY = String(mid.y + 12)
      this.previewLabel.dataset.worldZ = String(mid.z)
      this.labelLayer.appendChild(this.previewLabel)
    }
  }

  private createLabelElement(className: string): HTMLDivElement {
    const label = document.createElement('div')
    label.className = className
    return label
  }

  private queueLabel(world: THREE.Vector3, text: string, _persist = true) {
    const label = this.createLabelElement('plan-label')
    label.textContent = text
    label.dataset.worldX = String(world.x)
    label.dataset.worldY = String(world.y)
    label.dataset.worldZ = String(world.z)
    this.labelLayer.appendChild(label)
    this.labelElements.push(label)
  }

  updateLabelPositions(camera: THREE.Camera, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const update = (label: HTMLDivElement) => {
      const x = Number(label.dataset.worldX)
      const y = Number(label.dataset.worldY)
      const z = Number(label.dataset.worldZ)
      const projected = new THREE.Vector3(x, y, z).project(camera)
      if (projected.z > 1) {
        label.style.display = 'none'
        return
      }
      label.style.display = 'block'
      label.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`
      label.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`
    }
    for (const label of this.labelElements) update(label)
    if (this.previewLabel && this.previewLabel.dataset.worldX) {
      update(this.previewLabel)
    } else if (this.previewLabel) {
      // preview label positioned at midpoint during rebuild - set on first update
    }
  }

  setPreviewLabelMidpoint(camera: THREE.Camera, canvas: HTMLCanvasElement, a: THREE.Vector3, b: THREE.Vector3) {
    if (!this.previewLabel) return
    const mid = a.clone().lerp(b, 0.5)
    this.previewLabel.dataset.worldX = String(mid.x)
    this.previewLabel.dataset.worldY = String(mid.y + 8)
    this.previewLabel.dataset.worldZ = String(mid.z)
    const rect = canvas.getBoundingClientRect()
    const projected = mid.project(camera)
    this.previewLabel.style.display = 'block'
    this.previewLabel.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`
    this.previewLabel.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height - 10}px`
    void rect
  }

  pickGrid(raycaster: THREE.Raycaster): PlanGridPoint | null {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) return null
    const gx = Math.round(hit.x / PLAN_GRID)
    const gz = Math.round(hit.z / PLAN_GRID)
    return { gx, gz }
  }

  /** Trifft einen Plan-Knoten oder eine Plan-Kante per Raycaster. */
  pickPlanObject(raycaster: THREE.Raycaster): { kind: 'node'; nodeId: string } | { kind: 'edge'; edgeId: string } | null {
    const nodeHits = raycaster.intersectObjects(this.nodesGroup.children, false)
    if (nodeHits.length > 0) {
      const id = nodeHits[0].object.userData.nodeId as string | undefined
      if (id) return { kind: 'node', nodeId: id }
    }
    const edgeHits = raycaster.intersectObjects(this.edgesGroup.children, false)
    if (edgeHits.length > 0) {
      const id = edgeHits[0].object.userData.edgeId as string | undefined
      if (id) return { kind: 'edge', edgeId: id }
    }
    return null
  }

  /** Hebt selektierten Knoten/Kante visuell hervor. */
  setSelection(nodeId: string | null, edgeId: string | null) {
    for (const obj of this.nodesGroup.children) {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.set(mesh.userData.nodeId === nodeId ? 0xff4400 : 0x333333)
    }
    for (const obj of this.edgesGroup.children) {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.set(mesh.userData.edgeId === edgeId ? 0xff4400 : 0x1f6b3a)
    }
  }

  /** Leert das Wand-Overlay. */
  clearWallOverlay() {
    while (this.wallOverlayGroup.children.length > 0) {
      const child = this.wallOverlayGroup.children[0]
      this.wallOverlayGroup.remove(child)
      disposePlanObject(child)
    }
  }

  /** Zeichnet Studio-Wände als Draufsicht-Overlay (halbtransparent). */
  rebuildWallOverlay(
    walls: Wall[],
    activeFloor?: number,
    wallHeight?: number,
    options?: { dimmed?: boolean; buildingId?: string; append?: boolean },
  ) {
    if (!options?.append) {
      this.clearWallOverlay()
    }
    const dimmed = options?.dimmed ?? false
    const mat = new THREE.MeshBasicMaterial({
      color: dimmed ? 0x888888 : 0x4466cc,
      transparent: true,
      opacity: dimmed ? 0.18 : 0.38,
    })
    for (const wall of walls) {
      if (wall.kind !== 'studio') continue
      if (activeFloor !== undefined && floorIndex(wall, wallHeight) !== activeFloor) continue
      const originX = wall.originX ?? wall.x
      const originZ = wall.originZ ?? 0
      const along = wallAlongDelta(wall.yawDeg ?? 0, wall.width / 2)
      const cx = originX + along.x
      const cz = originZ + along.z
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.width, 2, wall.depth), mat.clone())
      mesh.position.set(cx, 1, cz)
      mesh.rotation.y = (wall.yawDeg ?? 0) * (Math.PI / 180)
      mesh.userData.buildingId = options?.buildingId
      mesh.userData.wallId = wall.id
      this.wallOverlayGroup.add(mesh)

      if (dimmed) continue

      for (const opening of wall.openings ?? []) {
        const yawRad = (wall.yawDeg ?? 0) * (Math.PI / 180)
        const localCenterX = opening.x + opening.width / 2 - wall.width / 2
        const openingAlong = wallAlongDelta(wall.yawDeg ?? 0, localCenterX)
        const wx = cx + openingAlong.x
        const wz = cz + openingAlong.z
        const oGeo = new THREE.BoxGeometry(opening.width, 4, wall.depth + 2)
        const oMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.55 })
        const oMesh = new THREE.Mesh(oGeo, oMat)
        oMesh.position.set(wx, 3, wz)
        oMesh.rotation.y = yawRad
        oMesh.userData.openingId = opening.id
        oMesh.userData.wallId = wall.id
        this.wallOverlayGroup.add(oMesh)
      }
    }
  }

  rebuildBuildingBoundsOverlay(
    buildings: Building[],
    selectedBuildingId: string | null | undefined,
  ) {
    while (this.buildingBoundsGroup.children.length > 0) {
      const child = this.buildingBoundsGroup.children[0]
      this.buildingBoundsGroup.remove(child)
      disposePlanObject(child)
    }
    if (!selectedBuildingId) return
    const building = buildings.find((b) => b.id === selectedBuildingId)
    if (!building || building.hidden) return
    const bounds = planGridBoundsForBuilding(building)
    if (!bounds) return
    const minX = bounds.minGx * PLAN_GRID
    const maxX = bounds.maxGx * PLAN_GRID
    const minZ = bounds.minGz * PLAN_GRID
    const maxZ = bounds.maxGz * PLAN_GRID
    const w = Math.max(PLAN_GRID, maxX - minX)
    const d = Math.max(PLAN_GRID, maxZ - minZ)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), mat)
    mesh.position.set(minX + w / 2, 0.5, minZ + d / 2)
    this.buildingBoundsGroup.add(mesh)

    const edgeMat = new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.95 })
    const y = 1.2
    const corners = [
      new THREE.Vector3(minX, y, minZ),
      new THREE.Vector3(maxX, y, minZ),
      new THREE.Vector3(maxX, y, maxZ),
      new THREE.Vector3(minX, y, maxZ),
      new THREE.Vector3(minX, y, minZ),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(corners)
    this.buildingBoundsGroup.add(new THREE.Line(geo, edgeMat))
  }

  showBuildingGuides(guides: BuildingGuide[]) {
    while (this.buildingGuidesGroup.children.length > 0) {
      const child = this.buildingGuidesGroup.children[0]
      this.buildingGuidesGroup.remove(child)
      if (child instanceof THREE.Line) child.geometry.dispose()
    }
    const selfMat = new THREE.LineBasicMaterial({
      color: 0x66d9ff,
      transparent: true,
      opacity: 0.55,
    })
    const alignMat = new THREE.LineBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.9,
    })
    for (const guide of guides) {
      const mat = guide.source === 'self' ? selfMat : alignMat
      const span = PLAN_VIEW_SIZE * 3
      const points =
        guide.orientation === 'vertical'
          ? [
              new THREE.Vector3(guide.value, 1.5, -span),
              new THREE.Vector3(guide.value, 1.5, span),
            ]
          : [
              new THREE.Vector3(-span, 1.5, guide.value),
              new THREE.Vector3(span, 1.5, guide.value),
            ]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      this.buildingGuidesGroup.add(new THREE.Line(geo, mat))
    }
  }

  clearBuildingGuides() {
    while (this.buildingGuidesGroup.children.length > 0) {
      const child = this.buildingGuidesGroup.children[0]
      this.buildingGuidesGroup.remove(child)
      if (child instanceof THREE.Line) child.geometry.dispose()
    }
  }

  showWallMoveGuides(
    guides: Array<{ value: number; orientation: 'vertical' | 'horizontal'; source: 'self' | 'align' }>,
  ) {
    this.showBuildingGuides(
      guides.map((g) => ({
        kind: 'midX' as const,
        value: g.value,
        orientation: g.orientation,
        source: g.source,
      })),
    )
  }

  clearWallMoveGuides() {
    this.clearBuildingGuides()
  }

  showAlignGuides(guides: BuildingGuide[]) {
    this.clearAlignGuides()
    const alignMat = new THREE.LineBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.9,
    })
    for (const guide of guides) {
      const span = PLAN_VIEW_SIZE * 3
      const points =
        guide.orientation === 'vertical'
          ? [
              new THREE.Vector3(guide.value, 1.5, -span),
              new THREE.Vector3(guide.value, 1.5, span),
            ]
          : [
              new THREE.Vector3(-span, 1.5, guide.value),
              new THREE.Vector3(span, 1.5, guide.value),
            ]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      this.alignGuidesGroup.add(new THREE.Line(geo, alignMat))
    }
  }

  clearAlignGuides() {
    while (this.alignGuidesGroup.children.length > 0) {
      const child = this.alignGuidesGroup.children[0]
      this.alignGuidesGroup.remove(child)
      if (child instanceof THREE.Line) child.geometry.dispose()
    }
  }

  /** Gitterpunkt innerhalb der Gebäude-AABB? */
  pickBuildingAtGrid(
    buildings: Building[],
    gx: number,
    gz: number,
  ): string | null {
    for (const building of buildings) {
      if (building.hidden) continue
      const bounds = planGridBoundsForBuilding(building)
      if (!bounds) continue
      if (gx >= bounds.minGx && gx <= bounds.maxGx && gz >= bounds.minGz && gz <= bounds.maxGz) {
        return building.id
      }
    }
    return null
  }

  pickPlanOpening(raycaster: THREE.Raycaster): { wallId: string; openingId: string } | null {
    const hits = raycaster.intersectObjects(this.wallOverlayGroup.children, false)
    for (const hit of hits) {
      const { wallId, openingId } = hit.object.userData
      if (wallId && openingId) return { wallId, openingId }
    }
    return null
  }

  /** Studio-Wand unter dem Cursor (ohne Öffnungs-Treffer). */
  pickPlanWall(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObjects(this.wallOverlayGroup.children, false)
    for (const hit of hits) {
      const { wallId, openingId } = hit.object.userData
      if (wallId && !openingId) return wallId as string
    }
    return null
  }

  /**
   * Orange Flächenmarkierung für Wand-Andocken aus der Bibliothek
   * (Schatten/Zielbereich unter der geplanten Wand).
   */
  setWallDockPreview(from: PlanGridPoint, to: PlanGridPoint, valid = true) {
    if (from.gx === to.gx && from.gz === to.gz) {
      this.clearWallDockPreview()
      return
    }
    const a = gridWorld(from.gx, from.gz)
    const b = gridWorld(to.gx, to.gz)
    this.setWallDockPreviewWorld([{ ax: a.x, az: a.z, bx: b.x, bz: b.z }], valid)
  }

  setWallDockPreviewWorld(
    segments: Array<{
      ax: number
      az: number
      bx: number
      bz: number
      dockStart?: boolean
      dockEnd?: boolean
    }>,
    valid = true,
  ) {
    this.clearWallDockPreview()
    const fill = valid ? 0xff8800 : 0xe04040
    const edge = valid ? 0xff6600 : 0xc02020
    const capFill = valid ? 0xff5500 : 0xe04040
    for (const seg of segments) {
      if (Math.hypot(seg.bx - seg.ax, seg.bz - seg.az) < 1e-6) continue
      const a = new THREE.Vector3(seg.ax, 0, seg.az)
      const b = new THREE.Vector3(seg.bx, 0, seg.bz)
      const shadow = createEdgeMesh(a, b, 0x000000, {
        height: 0.8,
        thickness: STUDIO_WALL_DEPTH * 1.35,
        opacity: 0.22,
      })
      shadow.position.y = 0.15
      this.wallDockPreviewGroup.add(shadow)
      const solid = createEdgeMesh(a, b, fill, {
        height: 3.5,
        thickness: STUDIO_WALL_DEPTH,
        opacity: 0.45,
      })
      this.wallDockPreviewGroup.add(solid)
      const outline = createEdgeMesh(a, b, edge, {
        height: 5,
        thickness: 5,
        opacity: 0.95,
      })
      this.wallDockPreviewGroup.add(outline)
      const addCap = (at: THREE.Vector3) => {
        const capMat = new THREE.MeshBasicMaterial({
          color: capFill,
          transparent: true,
          opacity: 0.92,
        })
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(STUDIO_WALL_DEPTH + 4, 8, STUDIO_WALL_DEPTH + 4),
          capMat,
        )
        cap.position.set(at.x, 4.2, at.z)
        this.wallDockPreviewGroup.add(cap)
      }
      if (seg.dockStart) addCap(a)
      if (seg.dockEnd) addCap(b)
    }
  }

  clearWallDockPreview() {
    while (this.wallDockPreviewGroup.children.length > 0) {
      const child = this.wallDockPreviewGroup.children[0]
      this.wallDockPreviewGroup.remove(child)
      disposePlanObject(child)
    }
  }

  nodeWorld(node: PlanNode) {
    return planNodeWorld(node)
  }
}

export function syncPlanCamera(
  camera: THREE.OrthographicCamera,
  aspect: number,
  zoom = 1,
  offsetX = 0,
  offsetZ = 0,
  viewYawDeg = 0,
  contentMaxY = 448,
) {
  const margin = PLAN_GRID * 0.5
  const span = PLAN_VIEW_SIZE + margin * 2
  const halfW = span / (2 * zoom)
  const halfH = halfW / (aspect > 0 ? aspect : 1)
  const cx = PLAN_VIEW_SIZE / 2 + offsetX
  const cz = PLAN_VIEW_SIZE / 2 + offsetZ
  camera.left = -halfW
  camera.right = halfW
  camera.top = halfH
  camera.bottom = -halfH
  const camY = Math.max(contentMaxY + TOP_VIEW_CAMERA_PAD, TOP_VIEW_CAMERA_PAD + 200)
  camera.near = 1
  camera.far = camY + TOP_VIEW_CAMERA_PAD + 80
  camera.position.set(cx, camY, cz)
  const yawRad = THREE.MathUtils.degToRad(viewYawDeg)
  camera.up.set(Math.sin(yawRad), 0, -Math.cos(yawRad))
  camera.lookAt(cx, 0, cz)
  camera.updateProjectionMatrix()
}
