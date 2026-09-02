import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { JOIN_OVERLAP, PROFILE_OFFSET_CLASSICAL_V2, WALL_DEPTH, WINDOW_RECESS } from './constants/presets'
import {
  DEFAULT_CEILING_COLOR,
  DEFAULT_INTERIOR_COLOR,
  DEFAULT_PROFILE_COLOR,
  DEFAULT_JOINT_COLOR,
  DEFAULT_WALL_COLOR,
  defaultOpeningFrameColor,
} from './constants/colorPalettes'
import type { EditorState, FacadeState, Opening, OpeningRef, Wall, Building } from './types/facade'
import { cloneFacadeState, createDefaultEditorState } from './types/facade'
import {
  buildingShowsBareWalls,
  findBuildingForWall,
  findWall,
  getActiveBuilding,
  getVisibleWalls,
  wallWithoutOpenings,
} from './utils/buildings'
import { resolveProfile } from './profiles/registry'
import { applyPlinthOpeningFragmentDiscard, buildProfilePaths, clipProfileSectionAboveCm, createPlinthProfileSweepGeometry, createProfileSweepGeometry, createSimpleProfileBarGeometry, disposePlinthOpeningDiscard, scaleProfileSectionAxes, transformProfileSection, transformProfileSectionAnchored } from './utils/profilePaths'
import { clampFacadeState, edgeIsJoined } from './utils/walls'
import {
  labelWorldDeltaFromStates,
  openingDragFloatLocalZ,
  openingWorldDeltaFromStates,
  trimBandWorldDeltaFromStates,
  wallWorldDeltaFromStates,
} from './utils/liveDrag'
import { openingHasProfile, normalizeOpeningSillOuter, outerSillUsesProfile, resolveOuterSillLayout } from './utils/openings'
import {
  ARCH_MESH_SEGMENTS,
  effectiveOpeningDepthOffset,
  normalizeOpeningArch,
  openingCutsWall,
  openingFillMode,
  filterStudioDrawingSegment,
  openingHasRoundMask,
  openingMaskPolyline,
  openingMasonryRect,
  openingGlazingArchEnabled,
  openingGlazingArchForm,
  openingShowsGlazing,
  openingActsAsWindow,
} from './utils/openingGeometry'
import { resolveCladding, windowModelKey } from './meshes/catalog'
import { loadCladdingTemplates, loadWindowProfileTemplates } from './meshes/loadMeshes'
import { createGruenderzeitWindowMesh, gruenderzeitConfigForOpening, isLeafMotionTag, windowAssemblyDepth, type LeafMotionTag } from './windows/gruenderzeit'
import {
  createInteriorShadeMesh,
  createOpeningGuardMesh,
  normalizeOpeningDoor,
  normalizeOpeningGuard,
  normalizeOpeningInteriorShade,
} from './windows/openingExtras'
import { applyMeshColor, applyOrthographicGlassSeeThrough, applyRenderExteriorSurfaceLook, applyRenderInteriorSurfaceLook, applySurfaceFinish, applyWorkModeSurfaceLook, createTintedMaterial, getGlassEnvironment, materialIsGlassLike } from './utils/threeColors'
import { applyFacadeShadeShader, facadeOutwardLocalZ } from './utils/facadeShade'
import { openingGlassConfig } from './utils/glassConfig'
import { DEFAULT_STUDIO_PANEL } from './studio/constants'
import { layoutPanelTiles } from './studio/panelLayout'
import {
  createPanelAtlasStrips,
  createStudioPanelAtlasGeometry,
  disposePanelAtlasTexture,
  studioLightModeWindowOriginZ,
} from './studio/panelAtlas'
import { createStudioClearanceCapGeometry, createStudioMortarFlatGeometry, createStudioMortarGeometry, createStudioOpeningRevealGeometry, createStudioOpeningShadowTunnelGeometry, createStudioPanelFlatGeometriesByColorIndex, createStudioPanelGeometriesByColorIndex, createStudioPanelGeometry, createStudioPanelLowGeometry, createStudioPlinthGeometry, createStudioWallGeometry, openingDragGhostWallLocalPoints, studioWorkModeTileLocalZ } from './studio/panelGeometry'
import { buildTileColorPalette, tileColorStageCount } from './studio/tileColors'
import { DEFAULT_LOD_SETTINGS, type LodSettings } from './lighting/lodSettings'
import type { LodLevel } from './utils/performanceLod'
import {
  averageBuildingColor,
  buildingScreenSpanPx,
  buildingWorldBoxForBuilding,
  effectiveCategoryLevel,
  effectiveFarHullLevel,
  LOD_EVAL_INTERVAL_FRAMES,
  nextLodLevel,
  tileScreenPx,
} from './utils/performanceLod'
import { createSimpleWindowMesh } from './studio/windowLod'
import type { OpeningGuide, OpeningDistanceLine } from './studio/openingGuides'
import { isMidStyleGuide, isSelfGuide } from './studio/openingGuides'
import { basementWindowEnabled, createBasementGrilleGeometry } from './studio/basementWindow'
import { createOpeningStairsGeometry } from './studio/stairs'
import {
  createRollerSlatGeometry,
  normalizeOpeningRollerShutter,
  openingSupportsRollerShutter,
  rollerShutterFinish,
  rollerShutterSlatCentersFromBottom,
  rollerShutterSlatCount,
  rollerShutterSlatWidth,
  DEFAULT_ROLLER_BULGE_CM,
  DEFAULT_ROLLER_COLOR,
  ROLLER_SHUTTER_INWARD_CM,
} from './studio/rollerShutter'
import { normalizeOpeningPediment } from './studio/pediment'
import {
  createPedimentConsoleGeometries,
  createPedimentSweepGeometry,
} from './studio/pedimentGeometry'
import { innerFaceRingWorld, planFacesWithHoles } from './studio/floorPlan'
import { innerFaceRingFromWalls } from './studio/panelGeometry'
import { floorIndex, storeyFloorSurfaceY, storeyTopY } from './utils/layers'
import { facadeOutward } from './studio/elevation'
import { isStudioWall, leafOpenSignForWall, outerSillBoardPose, studioFacadeOutwardLocalZ, studioFacadeSelectionLocalZ, studioPanelFaceLocalZ, studioProfileAnchorLocalZ, studioWallOuterLocalZ, studioWallTransform, studioWindowOriginZ, wallAlongDelta, wallHasPanels, windowDepthForwardSign } from './studio/walls'
import { buildMansardRoof } from './studio/roof'
import {
  createWallLabelMeshSpec,
  isWallLabelFontReady,
  isWallLabelFlatFontReady,
  isWallLabelFlatFontAttempted,
  isWallLabelExtrudedFontAttempted,
  preloadWallLabelFlatFont,
  preloadWallLabelExtrudedFont,
  retryWallLabelExtrudedFont,
  invalidateWallLabelTexturesAfterFontLoad,
  wallLabelNeedsFont,
  wallLabelNeedsFlatFont,
} from './studio/labelGeometry'
import { wallHasLabel, wallLabel } from './utils/wallLabel'
import {
  INDOOR_SLAB_THICKNESS,
  SHADOW_LAYER_EXTERIOR,
  SHADOW_LAYER_INTERIOR,
} from './utils/sunLighting'
import { bindSkipPointLights, bindSkipPointShadows, setSkipPointLights } from './lighting/skipPointLights'
import { buildPointLightRoomOccluders } from './lighting/pointLightRoomOccluders'

export class FacadeController {
  public readonly wallGroup: THREE.Group = new THREE.Group()
  public readonly profileGroup: THREE.Group = new THREE.Group()
  public readonly windowGroup: THREE.Group = new THREE.Group()
  public readonly casingGroup: THREE.Group = new THREE.Group()
  public readonly claddingGroup: THREE.Group = new THREE.Group()
  public readonly selectionGroup: THREE.Group = new THREE.Group()
  /** Nur Öffnungs-Umriss beim Fensterziehen (Profile/Bänke aus). */
  private readonly openingDragGhostGroup: THREE.Group = new THREE.Group()
  private readonly openingDragGhostFillMaterial: THREE.MeshBasicMaterial
  private readonly openingDragHiddenVis = new Map<string, boolean>()
  private readonly openingDragHiddenCast = new Map<string, boolean>()
  public readonly indoorFloorGroup: THREE.Group = new THREE.Group()
  /** Nur Punktlicht-Cube-Shadows: unsichtbare Außenring-Platten (Layer 3). */
  public readonly pointLightOccluderGroup: THREE.Group = new THREE.Group()
  public readonly roofGroup: THREE.Group = new THREE.Group()
  public readonly lineGroup: THREE.Group = new THREE.Group()
  public readonly guideGroup: THREE.Group = new THREE.Group()
  /** Kanten der Zeichnungsansicht, als Kinder der jeweiligen Meshes (folgen sitePivot). */
  private readonly lineOverlays: LineSegments2[] = []
  private lineOverlaysVisible = true

  private readonly meshes = new Map<string, THREE.Mesh>()
  private readonly wallMaterials = new Map<string, THREE.MeshStandardMaterial>()
  private readonly wallInteriorMaterials = new Map<string, THREE.MeshStandardMaterial>()
  private readonly material: THREE.MeshStandardMaterial
  private readonly selectedMaterial: THREE.MeshStandardMaterial
  private readonly selectionLineMaterial: THREE.LineBasicMaterial
  private readonly guideEdgeMaterial: THREE.LineBasicMaterial
  private readonly guideMidMaterial: THREE.LineBasicMaterial
  private readonly guideSelfMaterial: THREE.LineBasicMaterial
  private readonly guideDistanceMaterial: THREE.LineBasicMaterial
  private readonly profileMaterial: THREE.MeshStandardMaterial
  private readonly axes: THREE.AxesHelper
  private readonly profileMeshes: THREE.Mesh[] = []
  private readonly innerSillMeshes: THREE.Mesh[] = []
  private readonly outerSillMeshes: THREE.Mesh[] = []
  private readonly pedimentMeshes: THREE.Mesh[] = []
  private readonly windowInstances: THREE.Object3D[] = []
  private readonly casingInstances: THREE.Object3D[] = []
  private readonly claddingInstances: THREE.Object3D[] = []
  private readonly studioCladdingMeshes: THREE.Mesh[] = []
  private readonly wallLabelMeshes: THREE.Mesh[] = []
  /** 2D-Front: Paneele/Mörtel empfangen Werfschatten; 3D aus (Moiré). */
  private claddingReceiveShadows = false
  /** 2D-Front: Glas als Alpha statt Physical-Transmission. */
  private orthoGlassSeeThrough = false
  /** Punktlicht-Raumhülle: Shader-Maske außen + unsichtbare Shadow-Platten. */
  private pointLightOccludersEnabled = false
  private readonly claddingLodLowMeshes: THREE.Mesh[] = []
  private readonly claddingLodHighMeshes: THREE.Mesh[] = []
  private readonly windowLodLowInstances: THREE.Object3D[] = []
  private readonly farHullMeshes: THREE.Mesh[] = []
  private readonly lodLevelByBuilding = new Map<string, LodLevel>()
  private readonly highDetailBuilt = new Set<string>()
  private lodEvalFrame = 0
  private lodSettings: LodSettings = { ...DEFAULT_LOD_SETTINGS, simplify: { ...DEFAULT_LOD_SETTINGS.simplify }, thresholds: { ...DEFAULT_LOD_SETTINGS.thresholds } }
  /** render | Vorschau (preview) | Entwurf (draft Atlas-Textur). */
  private presentationMode: import('./lighting/editPresentation').PresentationMode = 'render'
  /** Galerie: nur Wände in Reichweite der Kamera zeichnen (ein Gebäude → LOD hilft nicht). */
  private galleryCullActive = false
  private readonly galleryNearWallIds = new Set<string>()
  private readonly galleryCullCamPos = new THREE.Vector3()
  private readonly galleryCullWallPos = new THREE.Vector3()
  private readonly stairMeshes: THREE.Mesh[] = []
  private readonly rollerShutterGroups: THREE.Group[] = []
  private readonly revealMeshes: THREE.Mesh[] = []
  /** Unsichtbare Öffnungs-Tunnel nur für Shadow-Map (pro Wand). */
  private readonly openingShadowTunnelMeshes = new Map<string, THREE.Mesh>()
  private readonly guideLines: THREE.Line[] = []
  private readonly guideDistanceLines: THREE.Line[] = []
  private casingTemplates = new Map<string, THREE.Object3D>()
  private claddingTemplates = new Map<string, THREE.Object3D>()
  private state: FacadeState
  private readonly liveDragRest = new Map<string, THREE.Vector3>()
  /** Öffnungen, deren Loch während des Ziehens geschlossen ist (Wandkörper/Paneele). */
  private readonly openingDragOmitByWall = new Map<string, Set<string>>()
  private editor: EditorState = createDefaultEditorState()
  private renderStyle: 'color' | 'line' = 'color'
  private lineStrokeScale = 1
  private suppressSelectionHighlight = false
  private readonly whiteMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    // Wie Wandkörper: Fläche leicht zurück, damit LineSegments2 nicht mit dem Fill z-fightet.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  private readonly lineMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: 1,
    worldUnits: false,
    depthTest: true,
  })
  /** Nur Shadow-Map: kein Color-/Depth-Write, keine Zeichnungs-Kanten. */
  private readonly shadowOccluderMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  /** Punktlicht-Cube-Map: BasicMaterial mit colorWrite:false wird sonst übersprungen. */
  private readonly shadowDistanceMaterial = new THREE.MeshDistanceMaterial({
    side: THREE.DoubleSide,
  })
  private static readonly LINE_WIDTH_BASE_PX = 1.25
  private resolveMeshesReady!: () => void
  /** Nach erstem `loadMeshes()` (Fenster/Verkleidung + `syncLabelShadowReceivers`). */
  readonly whenMeshesReady: Promise<void>

  constructor(scene: THREE.Scene, initialState: FacadeState) {
    this.whenMeshesReady = new Promise<void>((resolve) => {
      this.resolveMeshesReady = resolve
    })
    this.state = clampFacadeState(initialState)
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      dithering: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
      // Nur Vorderseite in der Shadow-Map — DoubleSide erzeugt Moiré/Schraffur beim Zoomen.
      shadowSide: THREE.FrontSide,
    })
    this.selectedMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.92,
      metalness: 0,
      dithering: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
      shadowSide: THREE.FrontSide,
    })
    this.selectionLineMaterial = new THREE.LineBasicMaterial({
      color: 0xff8800,
      depthTest: false,
      depthWrite: false,
    })
    this.openingDragGhostFillMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.35,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    this.guideEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    })
    this.guideMidMaterial = new THREE.LineBasicMaterial({
      color: 0xff8800,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    })
    this.guideSelfMaterial = new THREE.LineBasicMaterial({
      color: 0x66d9ff,
      depthTest: false,
      transparent: true,
      opacity: 0.55,
    })
    this.guideDistanceMaterial = new THREE.LineBasicMaterial({
      color: 0xffd966,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    })
    this.profileMaterial = new THREE.MeshStandardMaterial({
      color: 0xc4b49a,
      roughness: 0.55,
      metalness: 0.02,
      dithering: false,
      side: THREE.DoubleSide,
      shadowSide: THREE.FrontSide,
      // Vor Paneelen (Factor +1): Bogenprofil-Fußplatte sonst Z-Fight im Zwickel.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })

    this.axes = new THREE.AxesHelper(80)
    this.axes.position.set(0, 0, 0)
    scene.add(this.axes)

    scene.add(this.wallGroup)
    scene.add(this.profileGroup)
    scene.add(this.windowGroup)
    scene.add(this.casingGroup)
    scene.add(this.claddingGroup)
    scene.add(this.selectionGroup)
    scene.add(this.openingDragGhostGroup)
    scene.add(this.indoorFloorGroup)
    this.pointLightOccluderGroup.name = 'pointLightOccluders'
    scene.add(this.pointLightOccluderGroup)
    scene.add(this.roofGroup)
    scene.add(this.lineGroup)
    scene.add(this.guideGroup)
    this.rebuild()
    void this.loadMeshes()
  }

  getState(): FacadeState {
    return cloneFacadeState(this.state)
  }

  private buildingIsBare(buildingId: string | undefined | null): boolean {
    if (!buildingId) return false
    return buildingShowsBareWalls(this.state.buildings.find((b) => b.id === buildingId))
  }

  private wallIsBare(wall: Wall): boolean {
    return this.buildingIsBare(wall.buildingId ?? findBuildingForWall(this.state, wall.id)?.id)
  }

  /** Geometriequelle: bei `bareWalls` oder Live-Ziehen ohne Loch der gezogenen Öffnung. */
  private wallForBodyMesh(wall: Wall): Wall {
    if (this.wallIsBare(wall)) return wallWithoutOpenings(wall)
    const omit = this.openingDragOmitByWall.get(wall.id)
    if (!omit || omit.size === 0) return wall
    const openings = wall.openings.filter((opening) => !omit.has(opening.id))
    if (openings.length === wall.openings.length) return wall
    return { ...wall, openings }
  }

  private labelFontReloadScheduled = false
  private wallLabelsNeedShadowUpdate = false

  /** Nur Beschriftungs-Meshes neu, ohne Paneele/Wandkörper und ohne komplette Zeichnung. */
  refreshWallLabels(options?: { afterFontLoad?: boolean }) {
    if (options?.afterFontLoad) invalidateWallLabelTexturesAfterFontLoad()
    for (const mesh of this.wallLabelMeshes) {
      for (const child of [...mesh.children]) {
        if (!child.userData.lineOverlay) continue
        const overlay = child as LineSegments2
        const idx = this.lineOverlays.indexOf(overlay)
        if (idx >= 0) this.lineOverlays.splice(idx, 1)
        mesh.remove(overlay)
        overlay.geometry?.dispose()
      }
      this.profileGroup.remove(mesh)
      this.claddingGroup.remove(mesh)
      mesh.geometry.dispose()
      this.disposeLabelMaterial(mesh)
    }
    this.wallLabelMeshes.length = 0
    for (const wall of getVisibleWalls(this.state)) {
      if (this.wallIsBare(wall)) continue
      if (!isStudioWall(wall)) continue
      const labelSpec = createWallLabelMeshSpec(wall)
      if (!labelSpec) continue
      const transform = wallPlacement(wall)
      const buildingId = wall.buildingId ?? findBuildingForWall(this.state, wall.id)?.id
      labelSpec.geometry.translate(labelSpec.localX, labelSpec.localY, labelSpec.localZ)
      const labelMesh = new THREE.Mesh(labelSpec.geometry, labelSpec.material)
      this.configureLabelShadow(labelMesh, labelSpec.material)
      labelMesh.userData.lodTier = 'label'
      labelMesh.userData.buildingId = buildingId
      labelMesh.userData.wallId = wall.id
      tagPickable(labelMesh, { kind: 'wall', wallId: wall.id, wallPart: 'label' })
      labelMesh.userData.originalMaterial = labelSpec.material
      labelMesh.position.set(transform.position.x, transform.position.y, transform.position.z)
      labelMesh.rotation.y = transform.rotationY + labelSpec.rotationY
      labelMesh.renderOrder = 30
      this.claddingGroup.add(labelMesh)
      this.wallLabelMeshes.push(labelMesh)
      if (this.renderStyle === 'line') {
        labelMesh.material = this.whiteMaterial
        this.addMeshEdges(labelMesh)
      }
    }
    this.syncLineOverlayVisibility()
    this.applySelection()
    this.scheduleLabelFontRefresh(getVisibleWalls(this.state))
    this.syncLabelShadowReceivers()
    // Auch wenn keine Schrift mehr castet: Empfangs-Flags können gewechselt haben.
    this.wallLabelsNeedShadowUpdate = true
    if (this.renderStyle !== 'line') this.applyFacadeBacklitShade()
  }

  /** Nach Label-Refresh: Shadow-Map einmal neu berechnen (extrudierte Schrift). */
  consumeWallLabelsShadowDirty(): boolean {
    if (!this.wallLabelsNeedShadowUpdate) return false
    this.wallLabelsNeedShadowUpdate = false
    return true
  }

  private scheduleLabelFontRefresh(walls: Wall[]) {
    if (this.labelFontReloadScheduled) return
    const jobs: Promise<void>[] = []
    const queued = new Set<string>()
    const enqueue = (job: Promise<void>, key: string) => {
      if (queued.has(key)) return
      queued.add(key)
      jobs.push(job)
    }
    for (const wall of walls) {
      if (!isStudioWall(wall) || !wallHasLabel(wall)) continue
      const fontId = wallLabel(wall).fontId
      if (wallLabelNeedsFlatFont(wall) && !isWallLabelFlatFontReady(fontId) && !isWallLabelFlatFontAttempted(fontId)) {
        enqueue(preloadWallLabelFlatFont(fontId), `flat:${fontId}`)
      }
      if (wallLabelNeedsFont(wall) && !isWallLabelFontReady(fontId)) {
        enqueue(
          isWallLabelExtrudedFontAttempted(fontId)
            ? retryWallLabelExtrudedFont(fontId)
            : preloadWallLabelExtrudedFont(fontId),
          `ex:${fontId}`,
        )
      }
    }
    if (jobs.length === 0) return
    this.labelFontReloadScheduled = true
    void Promise.all(jobs).then(() => {
      this.labelFontReloadScheduled = false
      this.refreshWallLabels({ afterFontLoad: true })
    })
  }

  private configureLabelShadow(mesh: THREE.Mesh, material: THREE.Material) {
    const opaque = material instanceof THREE.MeshStandardMaterial && !material.transparent
    mesh.castShadow = opaque
    // Empfang an: Gebäudeschatten dunkelt Direct. Extra Shadow-Z-Bias im Label-Shader
    // (LABEL_SHADOW_COORD_Z_BIAS) verhindert, dass die 1–2 cm entfernte Wand die Glyphen frisst.
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.layers.enable(SHADOW_LAYER_EXTERIOR)
  }

  /**
   * Wandkörper empfängt immer (Innenraum v0.7.237 + Freistreifen).
   * Paneele/Mörtel: Empfang nur in 2D-Front (`claddingReceiveShadows`) — sonst Zoom-Schraffur
   * in 3D (v0.7.140); im Aufriss braucht die Nordfassade Werfschatten von Gesims/Vorstand,
   * weil Lambert (N·L) dort bei typischem Tages-Azimut kaum schwankt.
   * Gesims/Zierband casten immer (auch bei Schrift) — Schrift empfängt mit Z-Bias (v0.7.252).
   * Früher: Cast bei Schrift aus → kein Gesims-Schatten auf dem Freistreifen.
   */
  private syncLabelShadowReceivers() {
    for (const [wallId, mesh] of this.meshes) {
      const wall = findWall(this.state, wallId)
      if (!wall || !isStudioWall(wall)) continue
      mesh.receiveShadow = true
      mesh.castShadow = true
    }
    const claddingLists = [this.studioCladdingMeshes, this.claddingLodHighMeshes, this.claddingLodLowMeshes]
    for (const list of claddingLists) {
      for (const mesh of list) {
        mesh.receiveShadow = this.claddingMeshShouldReceiveShadow(mesh)
      }
    }
    for (const mesh of this.profileMeshes) {
      const wallPart = mesh.userData.wallPart as string | undefined
      if (wallPart !== 'cornice' && wallPart !== 'trimBand') continue
      mesh.castShadow = true
    }
    // Stufen-Geometrie: immer empfangen (Selbst-/Werfschatten), nicht wie große Paneelflächen.
    for (const mesh of this.stairMeshes) {
      mesh.receiveShadow = true
    }
    this.syncOpeningReceiveShadows()
  }

  /** Glas und transparente Teile aus — Rahmen/Füllung wie Paneele in 2D-Front. */
  private openingMeshMayReceiveShadow(mesh: THREE.Mesh): boolean {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!(mat instanceof THREE.Material)) continue
      if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0.05) return false
      if (mat instanceof THREE.MeshStandardMaterial) {
        if (mat.transparent && mat.opacity < 0.95) return false
        const name = (mat.name ?? '').toLowerCase()
        if (name.includes('glass') || name.includes('glas')) return false
      }
    }
    return true
  }

  /** Fensterrahmen/-füllung: Shadow-Map wenn Paneele empfangen (2D-Front). */
  private syncOpeningReceiveShadows() {
    const enable = this.claddingReceiveShadows
    const apply = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        if (child.userData.shadowOccluder || child.userData.role === 'guideRail') return
        child.receiveShadow = enable && this.openingMeshMayReceiveShadow(child)
      })
    }
    for (const instance of this.windowInstances) apply(instance)
    for (const instance of this.windowLodLowInstances) apply(instance)
    for (const instance of this.casingInstances) apply(instance)
    for (const mesh of this.pedimentMeshes) apply(mesh)
  }

  /** Glas/transparent — kein Cube-Shadow-Cast (Licht scheint durch). */
  private openingMeshCastsPointShadow(mesh: THREE.Mesh): boolean {
    return this.openingMeshMayReceiveShadow(mesh)
  }

  /** Bibliotheks-Punktlicht: Shader-Maske außen + unsichtbare Shadow-Platten. */
  syncPointLightOccluders(roomOcclusion: boolean, sceneLightsActive: boolean): void {
    this.pointLightOccludersEnabled = roomOcclusion
    this.sceneLightsActive = sceneLightsActive
    this.applyPointLightOccluders()
  }

  private sceneLightsActive = false

  private bindSkipPointLightsOn(
    material: THREE.Material | THREE.Material[] | undefined,
    allLayers = false,
  ): void {
    if (!material) return
    if (Array.isArray(material)) {
      if (allLayers) {
        for (const item of material) bindSkipPointLights(item)
        return
      }
      bindSkipPointLights(material[0]!)
      return
    }
    bindSkipPointLights(material)
  }

  private tagPointLightShadowOccluder(mesh: THREE.Mesh): void {
    mesh.customDistanceMaterial = this.shadowDistanceMaterial
    mesh.castShadow = true
    mesh.receiveShadow = false
  }

  private clearPointLightRoomOccluders(): void {
    while (this.pointLightOccluderGroup.children.length > 0) {
      const child = this.pointLightOccluderGroup.children[0] as THREE.Mesh
      this.pointLightOccluderGroup.remove(child)
      child.geometry.dispose()
    }
  }

  private rebuildPointLightRoomOccluders(): void {
    this.clearPointLightRoomOccluders()
    if (!this.pointLightOccludersEnabled) return
    const meshes = buildPointLightRoomOccluders(this.state.buildings, this.shadowOccluderMaterial)
    for (const mesh of meshes) {
      this.tagPointLightShadowOccluder(mesh)
      this.pointLightOccluderGroup.add(mesh)
    }
  }

  private applyPointLightOccluders(): void {
    const enable = this.pointLightOccludersEnabled
    setSkipPointLights(this.sceneLightsActive)
    this.rebuildPointLightRoomOccluders()

    for (const child of this.indoorFloorGroup.children) {
      if (!(child instanceof THREE.Mesh)) continue
      child.castShadow = enable ? child.visible : (child.userData.indoorRole === 'ceiling' && child.visible)
      child.receiveShadow = child.visible
      child.layers.set(SHADOW_LAYER_INTERIOR)
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) bindSkipPointShadows(mat)
      }
    }

    const wallShadowSide = enable ? THREE.DoubleSide : THREE.FrontSide
    for (const mat of this.wallMaterials.values()) {
      mat.shadowSide = wallShadowSide
      this.bindSkipPointLightsOn(mat)
    }
    for (const mat of this.wallInteriorMaterials.values()) {
      mat.shadowSide = THREE.FrontSide
      bindSkipPointShadows(mat)
    }

    for (const mesh of this.meshes.values()) {
      mesh.castShadow = true
      this.syncWallMeshLightLayers(mesh)
    }
    for (const tunnel of this.openingShadowTunnelMeshes.values()) {
      this.tagPointLightShadowOccluder(tunnel)
    }
    for (const mesh of this.revealMeshes) {
      mesh.castShadow = true
      const sealed = mesh.userData.sealedNiche === true
      this.bindSkipPointLightsOn(mesh.material, sealed)
      this.bindSkipPointLightsOn(
        mesh.userData.originalMaterial as THREE.Material | THREE.Material[] | undefined,
        sealed,
      )
    }
    for (const mesh of this.innerSillMeshes) {
      mesh.castShadow = true
    }
    const exteriorLists = [
      this.studioCladdingMeshes,
      this.claddingLodHighMeshes,
      this.claddingLodLowMeshes,
      this.profileMeshes,
      this.pedimentMeshes,
      this.stairMeshes,
      this.outerSillMeshes,
    ]
    for (const list of exteriorLists) {
      for (const mesh of list) {
        mesh.castShadow = true
        this.bindSkipPointLightsOn(mesh.material)
        const original = mesh.userData.originalMaterial as THREE.Material | THREE.Material[] | undefined
        this.bindSkipPointLightsOn(original)
      }
    }
    const applyOpeningTree = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        if (child.userData.role === 'guideRail') return
        if (!this.openingMeshCastsPointShadow(child)) return
        child.castShadow = true
        this.bindSkipPointLightsOn(child.material)
      })
    }
    for (const instance of this.windowInstances) applyOpeningTree(instance)
    for (const instance of this.windowLodLowInstances) applyOpeningTree(instance)
    for (const instance of this.casingInstances) applyOpeningTree(instance)
    for (const group of this.rollerShutterGroups) {
      applyOpeningTree(group)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) this.bindSkipPointLightsOn(child.material)
      })
    }

    if (!enable) this.applyIndoorShadowCasting()
  }

  /**
   * Paneele/Mörtel empfangen Shadow-Map nur wenn `claddingReceiveShadows`
   * (2D-Front oder Arbeitsmodus). Sockel und Freiraum-Kappen bleiben aus.
   */
  private claddingMeshShouldReceiveShadow(mesh: THREE.Mesh): boolean {
    if (!this.claddingReceiveShadows && !this.isPerfPresentation()) return false
    const wallPart = mesh.userData.wallPart as string | undefined
    const lodTier = mesh.userData.lodTier as string | undefined
    if (wallPart === 'plinth' || lodTier === 'plinth') return false
    // Clearance-Kappen: openingPart gesetzt, kein wallPart cladding.
    if (mesh.userData.openingPart != null && wallPart !== 'cladding') return false
    return (
      wallPart === 'cladding' ||
      lodTier === 'mortar' ||
      lodTier === 'low' ||
      lodTier === 'light' ||
      lodTier === 'high'
    )
  }

  private isPreviewPresentation(): boolean {
    return this.presentationMode === 'preview'
  }

  private isDraftPresentation(): boolean {
    return this.presentationMode === 'draft'
  }

  /** Arbeit oder Leicht: vereinfachte Profile, harte Schatten, kein High-Cladding. */
  private isPerfPresentation(): boolean {
    return this.presentationMode !== 'render'
  }

  private finishExteriorMaterial(material: THREE.MeshStandardMaterial): void {
    if (this.isPerfPresentation()) {
      if (this.isPreviewPresentation()) applyWorkModeSurfaceLook(material)
      return
    }
    applyRenderExteriorSurfaceLook(material)
  }

  private finishInteriorMaterial(material: THREE.MeshStandardMaterial): void {
    if (this.isPerfPresentation()) return
    applyRenderInteriorSurfaceLook(material)
  }

  private syncWallMeshLightLayers(mesh: THREE.Mesh): void {
    mesh.layers.enable(SHADOW_LAYER_EXTERIOR)
    if (this.sceneLightsActive) mesh.layers.enable(SHADOW_LAYER_INTERIOR)
    else mesh.layers.disable(SHADOW_LAYER_INTERIOR)
  }

  /**
   * 2D-Aufriss oder Arbeitsmodus: Paneele empfangen Werfschatten.
   * 3D/Oben ohne Arbeit: aus — vermeidet Zoom-Moiré auf großen Frontflächen.
   */
  setCladdingReceiveShadows(enabled: boolean) {
    if (this.claddingReceiveShadows === enabled) return
    this.claddingReceiveShadows = enabled
    this.syncLabelShadowReceivers()
    this.wallLabelsNeedShadowUpdate = true
  }

  /** 2D-Aufriss: Glas durchsichtig (kein Physical-Transmission, das in Ortho schwarz wird). */
  setOrthographicGlassSeeThrough(enable: boolean) {
    this.orthoGlassSeeThrough = enable
    this.applyOrthographicGlassSeeThrough()
  }

  private applyOrthographicGlassSeeThrough() {
    const enable = this.orthoGlassSeeThrough
    const apply = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (mat instanceof THREE.MeshPhysicalMaterial && materialIsGlassLike(mat)) {
            applyOrthographicGlassSeeThrough(mat, enable)
          }
        }
      })
    }
    for (const instance of this.windowInstances) apply(instance)
    for (const instance of this.windowLodLowInstances) apply(instance)
  }

  private disposeLabelMaterial(mesh: THREE.Mesh) {
    const materials = new Set<THREE.Material>()
    const current = mesh.material
    if (Array.isArray(current)) current.forEach((item) => materials.add(item))
    else materials.add(current)
    const original = mesh.userData.originalMaterial as THREE.Material | undefined
    if (original) materials.add(original)
    for (const material of materials) {
      if (material === this.whiteMaterial || material === this.selectedMaterial || material === this.lineMaterial) {
        continue
      }
      material.dispose()
    }
  }

  setState(state: FacadeState, options?: { rebuildBuildingIds?: string[]; livePreview?: boolean }) {
    this.endLiveDrag()
    this.state = clampFacadeState(state)
    const partial = options?.rebuildBuildingIds
    const live = options?.livePreview === true
    if (partial !== undefined) {
      if (partial.length > 0) {
        for (const buildingId of partial) {
          this.highDetailBuilt.delete(buildingId)
          this.disposeBuildingHighDetail(buildingId)
          this.removeBuildingRenderables(buildingId)
          this.rebuildBuilding(buildingId)
        }
        if (!live) {
          this.rebuildIndoorFloor()
          this.rebuildFarHulls()
        }
        // Wie `finalizeGeometryRebuild`: neue Fenster haben receiveShadow=false
        // (Gründerzeit-Default). Ohne Sync fehlen Gesims-Schatten auf allen Rahmen.
        this.syncLabelShadowReceivers()
        this.applyRenderStyle()
        this.applySelection()
      }
      return
    } else {
      this.lodLevelByBuilding.clear()
      this.highDetailBuilt.clear()
      this.disposeAllHighDetail()
      this.clearFarHulls()
      this.rebuild()
      this.rebuildIndoorFloor()
      this.rebuildRoof()
      this.rebuildFarHulls()
      this.finalizeGeometryRebuild()
      this.applyRenderStyle()
    }
    this.applySelection()
  }

  /** Wände mit aktivem Öffnungs-Zug (vor `endLiveDrag` auslesen). */
  peekOpeningDragWallIds(): Set<string> {
    return new Set(this.openingDragOmitByWall.keys())
  }

  /** Restpositionen des Live-Ziehens verwerfen (Rebuild oder Commit). */
  endLiveDrag() {
    this.liveDragRest.clear()
    this.openingDragOmitByWall.clear()
    this.restoreOpeningDetailMeshVisibility()
    this.clearOpeningDragGhosts()
  }

  /**
   * Fensterziehen: Loch einmal schließen, nur Öffnungs-Umriss schwebt (~48 cm).
   * @returns true beim ersten Aufruf (Geometrie/Schatten einmal neu backen).
   */
  beginOpeningDragMode(refs: OpeningRef[]): boolean {
    if (refs.length === 0) return false
    let changed = false
    for (const ref of refs) {
      let omit = this.openingDragOmitByWall.get(ref.wallId)
      if (!omit) {
        omit = new Set<string>()
        this.openingDragOmitByWall.set(ref.wallId, omit)
      }
      if (!omit.has(ref.openingId)) {
        omit.add(ref.openingId)
        changed = true
      }
    }
    if (!changed) return false

    const wallIds = new Set(refs.map((ref) => ref.wallId))
    this.patchWallsForOpeningDrag(wallIds)
    this.hideOpeningDetailMeshes(refs)
    this.suppressOpeningDragShadowCasters(wallIds)
    this.clearOpeningDragGhosts()
    this.createOpeningDragGhosts(refs)
    this.liveDragRest.clear()
    return true
  }

  /** Schatten-Tunnel der betroffenen Wände während des Ziehens nicht werfen. */
  private suppressOpeningDragShadowCasters(wallIds: Set<string>) {
    for (const wallId of wallIds) {
      const tunnel = this.openingShadowTunnelMeshes.get(wallId)
      if (!tunnel) continue
      if (!this.openingDragHiddenCast.has(tunnel.uuid)) {
        this.openingDragHiddenCast.set(tunnel.uuid, tunnel.castShadow)
      }
      tunnel.castShadow = false
    }
  }

  private hideOpeningDetailMeshes(refs: OpeningRef[]) {
    const dragged = (wallId: string | undefined, openingId: string | undefined) =>
      Boolean(
        wallId &&
          openingId &&
          refs.some((ref) => ref.wallId === wallId && ref.openingId === openingId),
      )

    const hideObject = (obj: THREE.Object3D) => {
      if (!dragged(obj.userData.wallId as string | undefined, obj.userData.openingId as string | undefined)) {
        return
      }
      obj.traverse((node) => {
        if (!this.openingDragHiddenVis.has(node.uuid)) {
          this.openingDragHiddenVis.set(node.uuid, node.visible)
        }
        node.visible = false
        if (node instanceof THREE.Mesh) {
          if (!this.openingDragHiddenCast.has(node.uuid)) {
            this.openingDragHiddenCast.set(node.uuid, node.castShadow)
          }
          node.castShadow = false
        }
      })
    }

    for (const obj of this.windowInstances) hideObject(obj)
    for (const obj of this.windowLodLowInstances) hideObject(obj)
    for (const mesh of this.profileMeshes) hideObject(mesh)
    for (const mesh of this.innerSillMeshes) hideObject(mesh)
    for (const mesh of this.outerSillMeshes) hideObject(mesh)
    for (const mesh of this.pedimentMeshes) hideObject(mesh)
    for (const mesh of this.revealMeshes) hideObject(mesh)
    for (const obj of this.rollerShutterGroups) hideObject(obj)
    for (const mesh of this.stairMeshes) hideObject(mesh)
    for (const obj of this.casingInstances) hideObject(obj)
    for (const mesh of [...this.claddingLodLowMeshes, ...this.claddingLodHighMeshes]) hideObject(mesh)
  }

  private restoreOpeningDetailMeshVisibility() {
    if (this.openingDragHiddenVis.size === 0 && this.openingDragHiddenCast.size === 0) return
    const visit = (obj: THREE.Object3D) => {
      obj.traverse((node) => {
        const prevVis = this.openingDragHiddenVis.get(node.uuid)
        if (prevVis !== undefined) node.visible = prevVis
        if (node instanceof THREE.Mesh) {
          const prevCast = this.openingDragHiddenCast.get(node.uuid)
          if (prevCast !== undefined) node.castShadow = prevCast
        }
      })
    }
    for (const obj of this.windowInstances) visit(obj)
    for (const obj of this.windowLodLowInstances) visit(obj)
    for (const mesh of this.profileMeshes) visit(mesh)
    for (const mesh of this.innerSillMeshes) visit(mesh)
    for (const mesh of this.outerSillMeshes) visit(mesh)
    for (const mesh of this.pedimentMeshes) visit(mesh)
    for (const mesh of this.revealMeshes) visit(mesh)
    for (const obj of this.rollerShutterGroups) visit(obj)
    for (const mesh of this.stairMeshes) visit(mesh)
    for (const obj of this.casingInstances) visit(obj)
    for (const mesh of [...this.claddingLodLowMeshes, ...this.claddingLodHighMeshes]) visit(mesh)
    for (const tunnel of this.openingShadowTunnelMeshes.values()) visit(tunnel)
    this.openingDragHiddenVis.clear()
    this.openingDragHiddenCast.clear()
  }

  private clearOpeningDragGhosts() {
    while (this.openingDragGhostGroup.children.length > 0) {
      const child = this.openingDragGhostGroup.children[0]
      this.openingDragGhostGroup.remove(child)
      child.traverse((node) => {
        if (node instanceof THREE.LineSegments || node instanceof THREE.Mesh) {
          node.geometry?.dispose()
        }
      })
    }
  }

  private createOpeningDragGhosts(refs: OpeningRef[]) {
    for (const ref of refs) {
      const wall = findWall(this.state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (!wall || !opening) continue

      const localZ = openingDragFloatLocalZ(wall)
      const group = new THREE.Group()
      for (const part of createOpeningDragGhostParts(
        wall,
        opening,
        localZ,
        this.openingDragGhostFillMaterial,
        this.selectionLineMaterial,
      )) {
        group.add(part)
      }
      if (group.children.length === 0) continue

      group.userData = {
        kind: 'openingDragGhost',
        wallId: wall.id,
        openingId: opening.id,
      }

      const transform = wallPlacement(wall)
      group.position.set(transform.position.x, transform.position.y, transform.position.z)
      group.rotation.y = transform.rotationY

      this.openingDragGhostGroup.add(group)
    }
  }

  private patchWallsForOpeningDrag(wallIds: Set<string>) {
    const walls = getVisibleWalls(this.state).filter((wall) => wallIds.has(wall.id))
    if (walls.length === 0) return

    this.rebuildWallBodiesForWallIds(wallIds)
    this.removeCladdingMeshesForWallIds(wallIds)

    if (this.isPerfPresentation()) {
      this.rebuildCladdingForWalls(walls, 'high')
    } else {
      this.rebuildCladdingForWalls(walls, 'low')
      const buildingIds = new Set(
        walls.map((wall) => wall.buildingId).filter((id): id is string => Boolean(id)),
      )
      for (const buildingId of buildingIds) {
        if (!this.highDetailBuilt.has(buildingId)) continue
        this.rebuildCladdingForWalls(
          walls.filter((wall) => wall.buildingId === buildingId),
          'high',
        )
      }
    }

    this.applyLodVisibility()
  }

  private rebuildWallBodiesForWallIds(wallIds: Set<string>) {
    for (const wall of getVisibleWalls(this.state)) {
      if (!wallIds.has(wall.id)) continue
      const neighborWalls = this.buildingWalls(wall)
      const bodyWall = this.wallForBodyMesh(wall)
      const geometry = isStudioWall(bodyWall)
        ? createStudioWallGeometry(bodyWall, neighborWalls)
        : createWallGeometry(bodyWall, neighborWalls)
      const mesh = this.meshes.get(wall.id)
      if (!mesh) continue
      mesh.geometry.dispose()
      mesh.geometry = geometry
    }
  }

  private removeCladdingMeshesForWallIds(wallIds: Set<string>) {
    const removeFrom = (list: THREE.Mesh[]) => {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const mesh = list[i]
        if (!wallIds.has(mesh.userData.wallId as string)) continue
        this.claddingGroup.remove(mesh)
        mesh.geometry.dispose()
        list.splice(i, 1)
      }
    }
    removeFrom(this.claddingLodLowMeshes)
    removeFrom(this.claddingLodHighMeshes)
    removeFrom(this.studioCladdingMeshes)
  }

  private openingDragOmitVisible(wallId: string, openingId: string | undefined): boolean {
    if (!openingId) return false
    return this.openingDragOmitByWall.get(wallId)?.has(openingId) ?? false
  }

  /**
   * Öffnungen während pointermove: nur Mesh-Translation, kein Rebuild.
   * Mauerwerk-Loch folgt erst beim Loslassen (`setState`).
   */
  applyLiveOpeningOffsets(base: FacadeState, next: FacadeState, refs: OpeningRef[]) {
    this.state = next
    for (const ref of refs) {
      const world = openingWorldDeltaFromStates(base, next, ref)
      this.offsetLiveRoots(
        (obj) =>
          obj.userData.kind === 'openingDragGhost' &&
          obj.userData.wallId === ref.wallId &&
          obj.userData.openingId === ref.openingId,
        world,
      )
    }
  }

  /** Ganze Wände während pointermove: alle Meshes der Wand-IDs mitziehen. */
  applyLiveWallOffsets(base: FacadeState, next: FacadeState, wallIds: string[]) {
    this.state = next
    for (const wallId of wallIds) {
      const world = wallWorldDeltaFromStates(base, next, wallId)
      this.offsetLiveRoots((obj) => obj.userData.wallId === wallId, world)
    }
  }

  applyLiveTrimOffset(base: FacadeState, next: FacadeState, wallId: string, bandId: string) {
    this.state = next
    const world = trimBandWorldDeltaFromStates(base, next, wallId, bandId)
    this.offsetLiveRoots(
      (obj) => obj.userData.wallId === wallId && obj.userData.bandId === bandId,
      world,
    )
  }

  applyLiveLabelOffset(base: FacadeState, next: FacadeState, wallId: string) {
    this.state = next
    const world = labelWorldDeltaFromStates(base, next, wallId)
    this.offsetLiveRoots(
      (obj) => obj.userData.wallId === wallId && obj.userData.wallPart === 'label',
      world,
    )
  }

  private offsetLiveRoots(
    match: (obj: THREE.Object3D) => boolean,
    world: { x: number; y: number; z: number },
  ) {
    this.forEachLiveDragRoot((obj) => {
      if (!match(obj)) return
      const rest = this.captureLiveRest(obj)
      obj.position.set(rest.x + world.x, rest.y + world.y, rest.z + world.z)
    })
  }

  private captureLiveRest(obj: THREE.Object3D): THREE.Vector3 {
    let rest = this.liveDragRest.get(obj.uuid)
    if (!rest) {
      rest = obj.position.clone()
      this.liveDragRest.set(obj.uuid, rest)
    }
    return rest
  }

  private forEachLiveDragRoot(fn: (obj: THREE.Object3D) => void) {
    const seen = new Set<string>()
    const visit = (obj: THREE.Object3D) => {
      if (seen.has(obj.uuid)) return
      seen.add(obj.uuid)
      fn(obj)
    }
    for (const mesh of this.meshes.values()) visit(mesh)
    for (const mesh of this.openingShadowTunnelMeshes.values()) visit(mesh)
    for (const obj of this.openingDragGhostGroup.children) visit(obj)
    for (const obj of this.profileMeshes) visit(obj)
    for (const obj of this.innerSillMeshes) visit(obj)
    for (const obj of this.outerSillMeshes) visit(obj)
    for (const obj of this.pedimentMeshes) visit(obj)
    for (const obj of this.windowInstances) visit(obj)
    for (const obj of this.windowLodLowInstances) visit(obj)
    for (const obj of this.casingInstances) visit(obj)
    for (const obj of this.claddingInstances) visit(obj)
    for (const obj of this.studioCladdingMeshes) visit(obj)
    for (const obj of this.wallLabelMeshes) visit(obj)
    for (const obj of this.claddingLodLowMeshes) visit(obj)
    for (const obj of this.claddingLodHighMeshes) visit(obj)
    for (const obj of this.stairMeshes) visit(obj)
    for (const obj of this.rollerShutterGroups) visit(obj)
    for (const obj of this.revealMeshes) visit(obj)
  }

  clearOpeningGuides() {
    for (const line of this.guideLines) {
      this.guideGroup.remove(line)
      line.geometry.dispose()
    }
    this.guideLines.length = 0
    for (const line of this.guideDistanceLines) {
      this.guideGroup.remove(line)
      line.geometry.dispose()
    }
    this.guideDistanceLines.length = 0
  }

  /** Zeigt Ausrichtungs-Hilfslinien in Wand-Lokalmaßen (vor der Fassade). */
  setOpeningGuides(wall: Wall, guides: OpeningGuide[]) {
    this.setOpeningGuidesBatch([{ wall, guides }])
  }

  setOpeningGuidesBatch(entries: { wall: Wall; guides: OpeningGuide[]; distanceLines?: OpeningDistanceLine[] }[]) {
    this.clearOpeningGuides()
    for (const { wall, guides, distanceLines } of entries) {
      const local = guides.filter((g) => g.space === 'wallLocal')
      if (local.length > 0) this.appendWallOpeningGuides(wall, local)
      const localDistances = (distanceLines ?? []).filter((l) => l.space === 'wallLocal')
      if (localDistances.length > 0) this.appendWallOpeningDistanceLines(wall, localDistances)
    }
  }

  private appendWallOpeningGuides(wall: Wall, guides: OpeningGuide[]) {
    const yawDeg = wall.yawDeg ?? 0
    const originX = wall.originX ?? wall.x
    const originZ = wall.originZ ?? 0
    const outward = facadeOutward(yawDeg, wall.panelFlip ?? true)
    const offset = 2
    const padY = 2400
    const padX = 2400
    const ox = outward.x * offset
    const oz = outward.z * offset

    for (const guide of guides) {
      const material = isSelfGuide(guide)
        ? this.guideSelfMaterial
        : isMidStyleGuide(guide)
          ? this.guideMidMaterial
          : this.guideEdgeMaterial
      let a: THREE.Vector3
      let b: THREE.Vector3
      if (guide.orientation === 'vertical') {
        const along = wallAlongDelta(yawDeg, guide.value)
        a = new THREE.Vector3(
          originX + along.x + ox,
          wall.y - padY,
          originZ + along.z + oz,
        )
        b = new THREE.Vector3(
          originX + along.x + ox,
          wall.y + wall.height + padY,
          originZ + along.z + oz,
        )
      } else {
        const y = wall.y + guide.value
        const along0 = wallAlongDelta(yawDeg, -padX)
        const along1 = wallAlongDelta(yawDeg, wall.width + padX)
        a = new THREE.Vector3(originX + along0.x + ox, y, originZ + along0.z + oz)
        b = new THREE.Vector3(originX + along1.x + ox, y, originZ + along1.z + oz)
      }
      const geom = new THREE.BufferGeometry().setFromPoints([a, b])
      const line = new THREE.Line(geom, material)
      line.renderOrder = isSelfGuide(guide) ? 9 : 10
      this.guideGroup.add(line)
      this.guideLines.push(line)
    }
  }

  private appendWallOpeningDistanceLines(wall: Wall, lines: OpeningDistanceLine[]) {
    const yawDeg = wall.yawDeg ?? 0
    const originX = wall.originX ?? wall.x
    const originZ = wall.originZ ?? 0
    const outward = facadeOutward(yawDeg, wall.panelFlip ?? true)
    const offset = 2.5
    const ox = outward.x * offset
    const oz = outward.z * offset
    const capHalf = 6

    const addSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
      const geom = new THREE.BufferGeometry().setFromPoints([a, b])
      const line = new THREE.Line(geom, this.guideDistanceMaterial)
      line.renderOrder = 11
      this.guideGroup.add(line)
      this.guideDistanceLines.push(line)
    }

    const localToWorld = (localX: number, localY: number): THREE.Vector3 => {
      const along = wallAlongDelta(yawDeg, localX)
      return new THREE.Vector3(
        originX + along.x + ox,
        wall.y + localY,
        originZ + along.z + oz,
      )
    }

    for (const dist of lines) {
      const a = localToWorld(dist.fromX, dist.fromY)
      const b = localToWorld(dist.toX, dist.toY)
      addSegment(a, b)

      const dx = dist.toX - dist.fromX
      const dy = dist.toY - dist.fromY
      const horizontal = Math.abs(dx) >= Math.abs(dy)
      if (horizontal) {
        addSegment(localToWorld(dist.fromX, dist.fromY - capHalf), localToWorld(dist.fromX, dist.fromY + capHalf))
        addSegment(localToWorld(dist.toX, dist.toY - capHalf), localToWorld(dist.toX, dist.toY + capHalf))
      } else {
        addSegment(localToWorld(dist.fromX - capHalf, dist.fromY), localToWorld(dist.fromX + capHalf, dist.fromY))
        addSegment(localToWorld(dist.toX - capHalf, dist.toY), localToWorld(dist.toX + capHalf, dist.toY))
      }
    }
  }

  /** Decke/Boden: wie Innenwand — kein Gegenlicht-Shader, EnvMap-Fill, kein Punktlicht-Cube-Schatten. */
  private createIndoorSlabMaterial(hex: string): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    })
    material.userData.interiorWallSurface = true
    material.userData.skipFacadeShade = true
    bindSkipPointShadows(material)
    const glassEnv = getGlassEnvironment()
    if (glassEnv) {
      material.envMap = glassEnv
      material.envMapIntensity = Math.max(material.envMapIntensity, 0.42)
    }
    return material
  }

  rebuildIndoorFloor() {
    const slabMaterials = new Map<string, THREE.MeshStandardMaterial>()
    const slabMatFor = (hex: string) => {
      const key = hex.toLowerCase()
      let mat = slabMaterials.get(key)
      if (!mat) {
        mat = this.createIndoorSlabMaterial(hex)
        slabMaterials.set(key, mat)
      }
      return mat
    }
    while (this.indoorFloorGroup.children.length > 0) {
      const child = this.indoorFloorGroup.children[0] as THREE.Mesh
      this.indoorFloorGroup.remove(child)
      child.geometry?.dispose()
      const depthMat = child.customDepthMaterial
      if (depthMat) {
        depthMat.dispose()
        child.customDepthMaterial = undefined
      }
    }
    const slabThickness = INDOOR_SLAB_THICKNESS

    const ringToShapeXY = (pts: Array<{ x: number; z: number }>) => {
      if (pts.length < 3) return null
      const shape = new THREE.Shape()
      shape.moveTo(pts[0].x, -pts[0].z)
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, -pts[i].z)
      }
      shape.closePath()
      return shape
    }

    const addFloorMesh = (
      shape: THREE.Shape,
      y: number,
      material: THREE.Material,
      buildingId: string,
      floorIdx: number,
      role: 'ceiling' | 'floor',
    ) => {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: slabThickness,
        bevelEnabled: false,
      })
      const mesh = new THREE.Mesh(geo, material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(0, y, 0)
      // Nur Innen-Layer: Außen-Sonne (Layer 0) soll keine Etagenstreifen auf der Fassade werfen.
      mesh.layers.set(SHADOW_LAYER_INTERIOR)
      mesh.receiveShadow = true
      mesh.userData.indoorRole = role
      mesh.userData.kind = role === 'ceiling' ? 'ceiling' : 'floor'
      mesh.userData.buildingId = buildingId
      mesh.userData.floorIndex = floorIdx
      this.indoorFloorGroup.add(mesh)
    }

    for (const building of this.state.buildings) {
      if (building.hidden) continue
      if (buildingShowsBareWalls(building)) continue
      const floors = building.floors
      if (!floors || floors.length === 0) continue

      for (let fi = 0; fi < floors.length; fi++) {
        const plan = floors[fi]
        if (plan.hidden) continue
        const wallDepth = building.wallDepth ?? WALL_DEPTH
        const floorWalls = building.walls.filter(
          (wall) => !wall.hidden && floorIndex(wall, building.wallHeight) === fi,
        )
        const slabMat = slabMatFor(plan.ceilingColor ?? DEFAULT_CEILING_COLOR)
        const faces = planFacesWithHoles(plan)
        for (const face of faces) {
          const inner = innerFaceRingFromWalls(face.outer, floorWalls, wallDepth)
          if (inner.length < 3) continue
          const shape = ringToShapeXY(inner)
          if (!shape) continue
          for (const holeNodes of face.holes) {
            const holeInner = innerFaceRingWorld(holeNodes, wallDepth)
            if (holeInner.length < 3) continue
            const path = new THREE.Path()
            path.moveTo(holeInner[0].x, -holeInner[0].z)
            for (let i = holeInner.length - 1; i >= 1; i -= 1) {
              path.lineTo(holeInner[i].x, -holeInner[i].z)
            }
            path.closePath()
            shape.holes.push(path)
          }
          const ceilingY = storeyTopY(building, fi) - slabThickness
          addFloorMesh(shape.clone(), ceilingY, slabMat, building.id, fi, 'ceiling')
          const floorSurfaceY = storeyFloorSurfaceY(building, fi)
          addFloorMesh(shape.clone(), floorSurfaceY - slabThickness, slabMat, building.id, fi, 'floor')
        }
      }
    }
    this.applyIndoorVisibility()
    this.applyPointLightOccluders()
  }

  rebuildRoof(buildingId?: string) {
    if (!buildingId) {
      while (this.roofGroup.children.length > 0) {
        const child = this.roofGroup.children[0] as THREE.Mesh
        this.roofGroup.remove(child)
        child.geometry?.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material?.dispose()
      }
    } else {
      for (let i = this.roofGroup.children.length - 1; i >= 0; i -= 1) {
        const child = this.roofGroup.children[i] as THREE.Mesh
        if (child.userData.buildingId !== buildingId) continue
        this.roofGroup.remove(child)
        child.geometry?.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material?.dispose()
      }
    }

    for (const building of this.state.buildings) {
      if (buildingId && building.id !== buildingId) continue
      if (building.hidden) continue
      if (buildingShowsBareWalls(building)) continue
      if (building.roof?.hidden) continue
      const roofState = buildingRoofState(this.state, building)
      const built = buildMansardRoof(roofState, building.roof)
      if (!built) continue

      const tileMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(built.tileColor),
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.FrontSide,
        shadowSide: THREE.FrontSide,
      })
      const roofMesh = new THREE.Mesh(built.roof, tileMat)
      roofMesh.castShadow = true
      roofMesh.receiveShadow = true
      roofMesh.userData.roofPart = 'tiles'
      roofMesh.userData.buildingId = building.id
      this.roofGroup.add(roofMesh)

      if (built.gutter) {
        const gutterMat = new THREE.MeshStandardMaterial({
          color: 0x4a4a4a,
          roughness: 0.45,
          metalness: 0.55,
          side: THREE.DoubleSide,
        })
        const gutterMesh = new THREE.Mesh(built.gutter, gutterMat)
        gutterMesh.castShadow = true
        gutterMesh.receiveShadow = true
        gutterMesh.userData.roofPart = 'gutter'
        gutterMesh.userData.buildingId = building.id
        this.roofGroup.add(gutterMesh)
      }
    }
  }

  setRenderStyle(style: 'color' | 'line') {
    this.renderStyle = style
    this.applyRenderStyle()
    this.applySelection()
  }

  setLineStrokeScale(scale: number) {
    this.lineStrokeScale = Math.min(3, Math.max(0.25, scale))
    this.lineMaterial.linewidth = FacadeController.LINE_WIDTH_BASE_PX * this.lineStrokeScale
    if (this.renderStyle === 'line') this.applyRenderStyle()
  }

  setLineResolution(width: number, height: number) {
    this.lineMaterial.resolution.set(Math.max(1, width), Math.max(1, height))
  }

  /** Zeichnungs-Kanten während Orbit aus — LineSegments2 auf jedem Mesh ist teuer. */
  setLineOverlaysVisible(visible: boolean) {
    this.lineOverlaysVisible = visible
    this.syncLineOverlayVisibility()
  }

  private syncLineOverlayVisibility() {
    const show = this.lineOverlaysVisible && this.renderStyle === 'line'
    for (const line of this.lineOverlays) line.visible = show
  }

  private createFatLineSegments(edges: THREE.BufferGeometry): LineSegments2 {
    const lineGeo = new LineSegmentsGeometry()
    lineGeo.setPositions(edges.attributes.position.array as Float32Array)
    edges.dispose()
    const line = new LineSegments2(lineGeo, this.lineMaterial)
    line.computeLineDistances()
    return line
  }

  /** Zeichnungs-Kanten: keine Stirn/Tiefe, keine Strecke durchs Loch, Plan-Kante bündig. */
  private filterCladdingEdgesOutsideOpenings(
    edges: THREE.BufferGeometry,
    wall: Wall,
  ): THREE.BufferGeometry {
    const pos = edges.getAttribute('position')
    if (!pos || pos.count < 2) return edges
    const kept: number[] = []
    for (let i = 0; i < pos.count; i += 2) {
      const seg = filterStudioDrawingSegment(
        pos.getX(i),
        pos.getY(i),
        pos.getZ(i),
        pos.getX(i + 1),
        pos.getY(i + 1),
        pos.getZ(i + 1),
        wall,
      )
      if (!seg) continue
      kept.push(...seg)
    }
    edges.dispose()
    const filtered = new THREE.BufferGeometry()
    filtered.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
    return filtered
  }

  private addMeshEdges(obj: THREE.Mesh, thresholdAngle = 20) {
    if (!obj.geometry) return
    const deg =
      typeof obj.userData.lineEdgeThreshold === 'number'
        ? obj.userData.lineEdgeThreshold
        : obj.geometry.userData.plinthCsg
          ? 48
          : thresholdAngle
    let edges: THREE.BufferGeometry = new THREE.EdgesGeometry(obj.geometry, deg)
    const wallId = obj.userData.wallId as string | undefined
    const wall = wallId ? findWall(this.state, wallId) : undefined
    const isOpeningMesh = Boolean(obj.userData.openingId)
    const wallPart = obj.userData.wallPart as string | undefined
    const claddingLike =
      wallPart === 'cladding' ||
      wallPart === 'plinth' ||
      wallPart === 'trimBand' ||
      wallPart === 'cornice' ||
      obj.userData.lodTier === 'mortar' ||
      obj.userData.lodTier === 'low' ||
      obj.userData.lodTier === 'high' ||
      obj.userData.lodTier === 'plinth' ||
      obj.userData.lodTier === 'light'
    if (wall && isStudioWall(wall) && claddingLike && !isOpeningMesh) {
      edges = this.filterCladdingEdgesOutsideOpenings(edges, wall)
    }
    const pos = edges.getAttribute('position')
    if (!pos || pos.count < 2) {
      edges.dispose()
      return
    }
    const line = this.createFatLineSegments(edges)
    line.userData.lineOverlay = true
    obj.add(line)
    this.lineOverlays.push(line)
  }

  private clearLineGroup() {
    for (const line of this.lineOverlays) {
      line.removeFromParent()
      line.geometry?.dispose()
    }
    this.lineOverlays.length = 0
    while (this.lineGroup.children.length > 0) {
      const child = this.lineGroup.children[0] as LineSegments2
      this.lineGroup.remove(child)
      child.geometry?.dispose()
    }
  }

  private applyLineStyleToGroup(group: THREE.Group, thresholdAngle = 20) {
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.userData.lineOverlay) return
      if (obj.userData.shadowOccluder) return
      // Wandkörper-Außenfläche + Paneele = doppelte Kanten in der Zeichnung (Streifen/Laibung).
      if (group === this.wallGroup) {
        const wall = findWall(this.state, obj.userData.wallId as string)
        if (wall && isStudioWall(wall) && wallHasPanels(wall)) {
          if (!obj.userData.lineBackupMaterial) {
            obj.userData.lineBackupMaterial = this.wallBodyMaterial(wall.id)
          }
          obj.material = this.whiteMaterial
          return
        }
      }
      // Laibung / Sockel-Sturz: Öffnungskontur besitzen Paneele bzw. Sockelband —
      // gleiche Logik wie Wandkörper ohne Kanten (sonst Bogen-Reißverschluss).
      if (obj.userData.skipLineEdges) {
        if (!obj.userData.lineBackupMaterial) {
          const mat = obj.material
          const isTransient =
            mat === this.selectedMaterial ||
            mat === this.whiteMaterial ||
            mat === this.lineMaterial
          obj.userData.lineBackupMaterial = isTransient
            ? (obj.userData.originalMaterial as THREE.Material | undefined) ?? this.material
            : mat
        }
        obj.material = this.whiteMaterial
        return
      }
      if (!obj.userData.lineBackupMaterial) {
        // Nie Selektion-/Weiß-Material sichern — sonst bleibt Orange/Weiß „kleben“.
        const mat = obj.material
        const isTransient =
          mat === this.selectedMaterial ||
          mat === this.whiteMaterial ||
          mat === this.lineMaterial
        obj.userData.lineBackupMaterial = isTransient
          ? (obj.userData.originalMaterial as THREE.Material | undefined) ??
            (obj.userData.wallId
              ? this.wallBodyMaterial(obj.userData.wallId as string)
              : undefined) ??
            this.material
          : mat
      }
      obj.material = this.whiteMaterial
      this.addMeshEdges(obj, thresholdAngle)
    })
  }

  private restoreColorStyleToGroup(group: THREE.Group) {
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.userData.lineBackupMaterial) {
        obj.material = obj.userData.lineBackupMaterial
        delete obj.userData.lineBackupMaterial
      }
    })
  }

  private applyRenderStyle() {
    const isLine = this.renderStyle === 'line'
    this.clearLineGroup()

    const meshGroups = [
      this.wallGroup,
      this.claddingGroup,
      this.profileGroup,
      this.windowGroup,
      this.casingGroup,
      this.roofGroup,
      this.indoorFloorGroup,
    ]

    if (isLine) {
      for (const group of meshGroups) {
        // Dachziegel: etwas niedrigere Schwellwinkel → mehr Profil-/Fugenlinien
        const threshold = group === this.roofGroup ? 12 : 22
        this.applyLineStyleToGroup(group, threshold)
      }
    } else {
      for (const group of meshGroups) {
        this.restoreColorStyleToGroup(group)
      }
    }
    this.syncLineOverlayVisibility()
    if (!isLine) this.applyFacadeBacklitShade()
  }

  private applyIndoorVisibility() {
    for (const child of this.indoorFloorGroup.children) {
      const buildingId = child.userData.buildingId as string | undefined
      const floorIndex = child.userData.floorIndex as number | undefined
      const building = buildingId
        ? this.state.buildings.find((item) => item.id === buildingId)
        : undefined
      const floor = building && floorIndex !== undefined ? building.floors[floorIndex] : undefined
      child.visible = floor ? floor.showCeiling !== false && !floor.hidden : true
    }
    this.applyPointLightOccluders()
  }

  /**
   * Decken werfen Schatten; Böden empfangen. Kein Cast auf Böden — sonst doppelte Silhouette.
   */
  private applyIndoorShadowCasting() {
    for (const child of this.indoorFloorGroup.children) {
      const mesh = child as THREE.Mesh
      const role = mesh.userData.indoorRole as string | undefined
      mesh.castShadow = role === 'ceiling' && mesh.visible
      mesh.receiveShadow = mesh.visible
      mesh.layers.set(SHADOW_LAYER_INTERIOR)
    }
  }

  setEditor(editor: EditorState) {
    this.editor = {
      selectedWallIds: [...editor.selectedWallIds],
      selectedOpenings: editor.selectedOpenings.map((ref) => ({ ...ref })),
      selectedEdges: [...editor.selectedEdges],
      selectedOpeningPart: editor.selectedOpeningPart,
      selectedWallPart: editor.selectedWallPart,
      selectedTrimBandId: editor.selectedTrimBandId,
      selectedRoofBuildingId: editor.selectedRoofBuildingId,
      selectedRoofPart: editor.selectedRoofPart,
      selectedCeiling: editor.selectedCeiling ? { ...editor.selectedCeiling } : undefined,
      selectedBuildingId: editor.selectedBuildingId,
    }
    this.applySelection()
  }

  /** Distanz-/Bildschirm-LOD: Low/High umschalten, High-Detail lazy nachladen. */
  setLodSettings(settings: LodSettings) {
    this.lodSettings = {
      ...settings,
      simplify: { ...settings.simplify },
      thresholds: { ...settings.thresholds },
    }
    if (!this.lodSettings.enabled) {
      this.forceAllHighDetail()
    } else {
      this.applyLodVisibility()
    }
  }

  /**
   * Darstellungsmodus: full | work (Arbeit, Flat-Meshes) | draft (Atlas-Textur, max. Performance).
   * Behält parametrische Daten; nur Geometrie-/Shading-Pfad wechselt.
   */
  setPresentationMode(mode: import('./lighting/editPresentation').PresentationMode) {
    if (this.presentationMode === mode) return
    this.presentationMode = mode
    for (const building of this.state.buildings) {
      if (building.hidden) continue
      this.disposeBuildingHighDetail(building.id)
      this.highDetailBuilt.delete(building.id)
    }
    this.rebuildWallBodies()
    this.rebuildCladding()
    this.rebuildProfiles()
    this.rebuildPediments()
    if (mode === 'render') {
      this.rebuildWindows()
      this.forceAllHighDetail()
    } else {
      for (const instance of [...this.windowInstances]) {
        this.windowGroup.remove(instance)
        this.disposeObject3D(instance)
      }
      this.windowInstances.length = 0
      for (const instance of [...this.windowLodLowInstances]) {
        this.windowGroup.remove(instance)
        this.disposeObject3D(instance)
      }
      this.windowLodLowInstances.length = 0
      // Entwurf/Vorschau: Gründerzeit-Fenster (Rahmen/Sprossen); Wand bleibt Atlas bzw. Flat.
      this.rebuildWindowsForWalls(getVisibleWalls(this.state), 'high')
      for (const building of this.state.buildings) {
        if (building.hidden) continue
        this.highDetailBuilt.add(building.id)
      }
      this.applyLodVisibility()
    }
    this.syncLabelShadowReceivers()
  }

  /** @deprecated Use setPresentationMode */
  setEditPresentation(enabled: boolean) {
    this.setPresentationMode(enabled ? 'preview' : 'render')
  }

  /** Nur Wandkörper neu (volle Außenfläche; Arbeitsmodus locht die Wand nicht). */
  private rebuildWallBodies() {
    for (const wall of getVisibleWalls(this.state)) {
      const neighborWalls = this.buildingWalls(wall)
      const bodyWall = this.wallForBodyMesh(wall)
      const geometry = isStudioWall(bodyWall)
        ? createStudioWallGeometry(bodyWall, neighborWalls)
        : createWallGeometry(bodyWall, neighborWalls)
      const mesh = this.meshes.get(wall.id)
      if (!mesh) continue
      mesh.geometry.dispose()
      mesh.geometry = geometry
    }
  }

  /** Einmalig volle Details für alle sichtbaren Häuser (Export/Screenshot). */
  forceAllHighDetail() {
    if (this.isPerfPresentation()) {
      for (const building of this.state.buildings) {
        if (building.hidden) continue
        this.ensureBuildingHighDetail(building.id)
      }
      this.applyLodVisibility()
      return
    }
    for (const building of this.state.buildings) {
      if (building.hidden) continue
      this.lodLevelByBuilding.set(building.id, 'high')
      this.ensureBuildingHighDetail(building.id)
    }
    this.applyLodVisibility()
  }

  /** High-LOD-Fenster mit Flügel-Pivots für eine Wand (Öffnungs-Animation). */
  ensureHighDetailForWall(wallId: string) {
    const wall = findWall(this.state, wallId)
    const buildingId = wall?.buildingId
    if (!buildingId) {
      this.forceAllHighDetail()
      return
    }
    this.lodLevelByBuilding.set(buildingId, 'high')
    this.ensureBuildingHighDetail(buildingId)
    this.applyLodVisibility()
  }

  /**
   * Setzt Flügelwinkel ohne Mesh-Rebuild.
   * `degFor` liefert den Öffnungswinkel in Grad (vor Scharnier-Vorzeichen).
   */
  applyOpeningLeafDegrees(
    wallId: string,
    openingId: string,
    degFor: (tag: LeafMotionTag) => number,
  ): boolean {
    let found = false
    for (const instance of this.windowInstances) {
      if (instance.userData.wallId !== wallId || instance.userData.openingId !== openingId) continue
      instance.traverse((obj) => {
        const tag = obj.userData.leafMotion
        if (!isLeafMotionTag(tag)) return
        const deg = degFor(tag)
        const mode = tag.openMode ?? 'turn'
        obj.rotation.set(0, 0, 0)
        if (mode === 'tilt') {
          obj.rotation.x = THREE.MathUtils.degToRad(-deg * 0.45)
        } else if (mode === 'turnTilt') {
          obj.rotation.y = THREE.MathUtils.degToRad(deg * 0.55 * tag.dir * tag.openSign)
          obj.rotation.x = THREE.MathUtils.degToRad(-deg * 0.25)
        } else {
          obj.rotation.y = THREE.MathUtils.degToRad(deg * tag.dir * tag.openSign)
        }
        found = true
      })
    }
    return found
  }

  resetOpeningLeafRest(wallId: string, openingId: string): boolean {
    return this.applyOpeningLeafDegrees(wallId, openingId, (tag) => tag.restDeg)
  }

  /**
   * Setzt Rollladen-Höhe ohne Mesh-Rebuild (`drop` 0 = oben, 1 = unten).
   */
  applyRollerShutterDrop(wallId: string, openingId: string, drop: number): boolean {
    let found = false
    for (const group of this.rollerShutterGroups) {
      if (group.userData.wallId !== wallId || group.userData.openingId !== openingId) continue
      this.layoutRollerShutterGroup(group, drop)
      found = true
    }
    return found
  }

  private layoutRollerShutterGroup(group: THREE.Group, drop: number) {
    const openingHeight = Number(group.userData.openingHeight) || 1
    const slatHeight = Number(group.userData.slatHeight) || 5
    const gap = Number(group.userData.gap) || 0.85
    const centers = rollerShutterSlatCentersFromBottom(openingHeight, drop, slatHeight, gap)
    let slatIndex = 0
    for (const child of group.children) {
      if (child.userData.role !== 'slat') continue
      const mesh = child as THREE.Mesh
      const y = centers[slatIndex]
      slatIndex += 1
      if (y === undefined) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.y = y - openingHeight / 2
    }
  }

  /** Nach Fenster-/Verkleidungs-Rebuild: High-Cache invalidieren und LOD-Sichtbarkeit anwenden. */
  private finalizeGeometryRebuild() {
    this.syncLabelShadowReceivers()
    this.applyPointLightOccluders()
    this.applyFacadeBacklitShade()
    if (!this.lodSettings.enabled) {
      this.forceAllHighDetail()
    } else {
      this.applyLodVisibility()
    }
  }

  /** Gegenlicht: Seiten und Oberseiten wie die Front abdunkeln, ohne Front-Schraffur. */
  private applyFacadeBacklitShade() {
    const shadeMesh = (mesh: THREE.Object3D, wallId?: string) => {
      const id = wallId ?? (mesh.userData.wallId as string | undefined)
      const wall = id ? findWall(this.state, id) : undefined
      if (!wall || !isStudioWall(wall)) return
      if (mesh.userData.kind === 'rollerShutter') return
      const sign = facadeOutwardLocalZ(wall.panelFlip)
      const isLabel = mesh.userData.lodTier === 'label'
      mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        if (child.userData.role === 'guideRail') return
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (mat === this.whiteMaterial || mat === this.selectedMaterial || mat === this.lineMaterial) {
            continue
          }
          if (mat.userData.skipFacadeShade === true) continue
          if (id && this.wallInteriorMaterials.get(id) === mat) continue
          applyFacadeShadeShader(mat, sign, { label: isLabel })
        }
      })
    }
    for (const [wallId, mesh] of this.meshes) shadeMesh(mesh, wallId)
    for (const mesh of this.studioCladdingMeshes) shadeMesh(mesh)
    for (const mesh of this.claddingLodHighMeshes) shadeMesh(mesh)
    for (const mesh of this.claddingLodLowMeshes) shadeMesh(mesh)
    for (const mesh of this.profileMeshes) shadeMesh(mesh)
    for (const mesh of this.revealMeshes) shadeMesh(mesh)
    for (const mesh of this.innerSillMeshes) shadeMesh(mesh)
    for (const mesh of this.outerSillMeshes) shadeMesh(mesh)
    for (const mesh of this.pedimentMeshes) shadeMesh(mesh)
    for (const mesh of this.stairMeshes) shadeMesh(mesh)
    for (const mesh of this.wallLabelMeshes) shadeMesh(mesh)
    for (const instance of this.windowInstances) shadeMesh(instance)
  }

  updatePerformanceLod(camera: THREE.Camera, viewportHeight: number) {
    if (!this.lodSettings.enabled) {
      let builtMissing = false
      for (const building of this.state.buildings) {
        if (building.hidden) continue
        if (this.highDetailBuilt.has(building.id)) continue
        builtMissing = true
        this.lodLevelByBuilding.set(building.id, 'high')
        this.ensureBuildingHighDetail(building.id)
      }
      if (builtMissing) this.applyLodVisibility()
      return
    }

    this.lodEvalFrame = (this.lodEvalFrame + 1) % LOD_EVAL_INTERVAL_FRAMES
    if (this.lodEvalFrame !== 0) return

    let levelsChanged = false
    for (const building of this.state.buildings) {
      if (building.hidden) continue
      const spanPx = buildingScreenSpanPx(building, camera, viewportHeight)
      const box = buildingWorldBoxForBuilding(building)
      const size = new THREE.Vector3()
      box.getSize(size)
      const spanCm = Math.max(size.x, size.z, 400)
      const tilePx = tileScreenPx(spanPx, 32, spanCm)
      const prev = this.lodLevelByBuilding.get(building.id) ?? 'high'
      let level = nextLodLevel(prev, spanPx, tilePx, this.lodSettings.thresholds)
      level = effectiveFarHullLevel(level, this.lodSettings.simplify.farHull, true)
      if (level !== prev) levelsChanged = true
      this.lodLevelByBuilding.set(building.id, level)
      if (level === 'high' && !this.highDetailBuilt.has(building.id)) {
        this.ensureBuildingHighDetail(building.id)
        levelsChanged = true
      }
    }
    if (levelsChanged) this.applyLodVisibility()
  }

  /** Galerie-Distanz-Culling ein/aus. */
  setGalleryDistanceCull(active: boolean) {
    if (this.galleryCullActive === active) return
    this.galleryCullActive = active
    if (!active) this.galleryNearWallIds.clear()
    this.applyLodVisibility()
  }

  /**
   * Blendet Galerie-Wände jenseits von maxDistance aus (mit Hysterese).
   * Muss bei Kamerabewegung aufgerufen werden — auch während Orbit-Lite.
   */
  updateGalleryDistanceCull(
    camera: THREE.Camera,
    maxDistance: number,
    hysteresis = 220,
  ): boolean {
    if (!this.galleryCullActive || maxDistance <= 0) return false
    camera.getWorldPosition(this.galleryCullCamPos)
    const hideAt = maxDistance + hysteresis
    let changed = false
    const seen = new Set<string>()
    for (const wall of getVisibleWalls(this.state)) {
      seen.add(wall.id)
      const mesh = this.meshes.get(wall.id)
      if (!mesh) continue
      mesh.getWorldPosition(this.galleryCullWallPos)
      // Ungefähre Wandmitte: Origin + halbe Breite entlang der Wand.
      this.galleryCullWallPos.x += (wall.width * 0.5) * Math.sin(mesh.rotation.y)
      this.galleryCullWallPos.z += (wall.width * 0.5) * Math.cos(mesh.rotation.y)
      this.galleryCullWallPos.y += wall.height * 0.5
      const dist = this.galleryCullWallPos.distanceTo(this.galleryCullCamPos)
      const wasNear = this.galleryNearWallIds.has(wall.id)
      let near = wasNear
      if (this.galleryNearWallIds.size === 0 && !changed) {
        // Erstbefüllung ohne Hysterese
        near = dist <= maxDistance
      } else if (wasNear && dist > hideAt) {
        near = false
      } else if (!wasNear && dist <= maxDistance) {
        near = true
      }
      if (near !== wasNear) {
        changed = true
        if (near) this.galleryNearWallIds.add(wall.id)
        else this.galleryNearWallIds.delete(wall.id)
      } else if (this.galleryNearWallIds.size === 0 && near) {
        changed = true
        this.galleryNearWallIds.add(wall.id)
      }
    }
    for (const id of [...this.galleryNearWallIds]) {
      if (!seen.has(id)) {
        this.galleryNearWallIds.delete(id)
        changed = true
      }
    }
    // Bootstrap: wenn Set nach erstem Pass noch leer war und wir oben nur per Flag gearbeitet haben
    if (this.galleryNearWallIds.size === 0) {
      for (const wall of getVisibleWalls(this.state)) {
        const mesh = this.meshes.get(wall.id)
        if (!mesh) continue
        mesh.getWorldPosition(this.galleryCullWallPos)
        this.galleryCullWallPos.y += wall.height * 0.5
        if (this.galleryCullWallPos.distanceTo(this.galleryCullCamPos) <= maxDistance) {
          this.galleryNearWallIds.add(wall.id)
          changed = true
        }
      }
    }
    if (changed) this.applyLodVisibility()
    return changed
  }

  private isGalleryWallDrawn(wallId: string | undefined): boolean {
    if (!this.galleryCullActive) return true
    if (!wallId) return true
    // Bis zur ersten Eval alles zeigen, damit Einstieg nicht leer wirkt.
    if (this.galleryNearWallIds.size === 0) return true
    return this.galleryNearWallIds.has(wallId)
  }

  private applyLodVisibility() {
    const lodOn = this.lodSettings.enabled
    const { simplify } = this.lodSettings

    const baseLevelForWall = (wallId: string): LodLevel => {
      const wall = findWall(this.state, wallId)
      if (!wall?.buildingId) return lodOn ? 'medium' : 'high'
      return this.lodLevelByBuilding.get(wall.buildingId) ?? (lodOn ? 'medium' : 'high')
    }

    const levelForCategory = (wallId: string, category: keyof typeof simplify): LodLevel =>
      effectiveCategoryLevel(baseLevelForWall(wallId), simplify[category], lodOn)

    for (const [wallKey, mesh] of this.meshes) {
      const wallId = (mesh.userData.wallId as string | undefined) ?? wallKey
      const base = baseLevelForWall(wallId)
      const showWalls =
        effectiveFarHullLevel(base, simplify.farHull, lodOn) !== 'far' &&
        this.isGalleryWallDrawn(wallId)
      mesh.visible = showWalls
    }

    for (const child of this.roofGroup.children) {
      const buildingId = child.userData.buildingId as string | undefined
      if (!buildingId) continue
      const base = this.lodLevelByBuilding.get(buildingId) ?? (lodOn ? 'medium' : 'high')
      child.visible = effectiveFarHullLevel(base, simplify.farHull, lodOn) !== 'far'
    }

    for (const mesh of this.claddingLodLowMeshes) {
      const wallId = mesh.userData.wallId as string
      if (this.isPerfPresentation()) {
        mesh.visible = this.isGalleryWallDrawn(wallId)
        continue
      }
      const level = levelForCategory(wallId, 'facadePattern')
      mesh.visible = level === 'medium' && this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.claddingLodHighMeshes) {
      const wallId = mesh.userData.wallId as string
      if (this.isPerfPresentation()) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'facadePattern')
      mesh.visible = level === 'high' && this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.studioCladdingMeshes) {
      if (mesh.userData.lodTier === 'mortar' || mesh.userData.lodTier === 'plinth') {
        const wallId = mesh.userData.wallId as string
        if (this.isPerfPresentation()) {
          mesh.visible = this.isGalleryWallDrawn(wallId)
          continue
        }
        const level = levelForCategory(wallId, 'facadePattern')
        mesh.visible =
          (level === 'medium' || level === 'high') && this.isGalleryWallDrawn(wallId)
      }
    }

    for (const obj of this.windowLodLowInstances) {
      const wallId = obj.userData.wallId as string
      const openingId = obj.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        obj.visible = false
        continue
      }
      if (this.isDraftPresentation()) {
        obj.visible = this.isGalleryWallDrawn(wallId)
        continue
      }
      if (this.isPreviewPresentation()) {
        obj.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'windows')
      obj.visible = level === 'medium' && this.isGalleryWallDrawn(wallId)
    }
    for (const obj of this.windowInstances) {
      if (obj.userData.lodTier === 'high') {
        const wallId = obj.userData.wallId as string
        const openingId = obj.userData.openingId as string | undefined
        if (this.openingDragOmitVisible(wallId, openingId)) {
          obj.visible = false
          continue
        }
        if (this.isDraftPresentation()) {
          obj.visible = this.isGalleryWallDrawn(wallId)
          continue
        }
        if (this.isPerfPresentation()) {
          obj.visible = this.isGalleryWallDrawn(wallId)
          continue
        }
        const level = levelForCategory(wallId, 'windows')
        obj.visible = level === 'high' && this.isGalleryWallDrawn(wallId)
      }
    }

    for (const mesh of this.profileMeshes) {
      const wallId = mesh.userData.wallId as string | undefined
      if (!wallId) continue
      const openingId = mesh.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'profiles')
      mesh.visible =
        effectiveFarHullLevel(level, simplify.farHull, lodOn) !== 'far' &&
        this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.innerSillMeshes) {
      const wallId = mesh.userData.wallId as string
      const openingId = mesh.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'profiles')
      mesh.visible =
        effectiveFarHullLevel(level, simplify.farHull, lodOn) !== 'far' &&
        this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.outerSillMeshes) {
      const wallId = mesh.userData.wallId as string
      const openingId = mesh.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'profiles')
      mesh.visible =
        effectiveFarHullLevel(level, simplify.farHull, lodOn) !== 'far' &&
        this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.pedimentMeshes) {
      const wallId = mesh.userData.wallId as string
      const openingId = mesh.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'profiles')
      mesh.visible =
        effectiveFarHullLevel(level, simplify.farHull, lodOn) !== 'far' &&
        this.isGalleryWallDrawn(wallId)
    }
    for (const mesh of this.revealMeshes) {
      const wallId = mesh.userData.wallId as string
      const openingId = mesh.userData.openingId as string | undefined
      if (this.openingDragOmitVisible(wallId, openingId)) {
        mesh.visible = false
        continue
      }
      const level = levelForCategory(wallId, 'reveals')
      mesh.visible = level === 'high' && this.isGalleryWallDrawn(wallId)
    }

    for (const hull of this.farHullMeshes) {
      const buildingId = hull.userData.buildingId as string
      const base = this.lodLevelByBuilding.get(buildingId) ?? (lodOn ? 'medium' : 'high')
      hull.visible = lodOn && simplify.farHull && base === 'far'
    }

    for (const mesh of this.wallLabelMeshes) {
      const wallId = mesh.userData.wallId as string | undefined
      mesh.visible = this.isGalleryWallDrawn(wallId)
    }

    for (const [wallId, mesh] of this.openingShadowTunnelMeshes) {
      mesh.visible = this.isGalleryWallDrawn(wallId)
    }
  }

  private disposeBuildingHighDetail(buildingId: string) {
    this.removeMeshesFromList(this.claddingLodHighMeshes, buildingId, this.claddingGroup, true)
    for (let i = this.windowInstances.length - 1; i >= 0; i -= 1) {
      const obj = this.windowInstances[i]
      if (obj.userData.lodTier !== 'high') continue
      if (obj.userData.buildingId !== buildingId) continue
      this.windowGroup.remove(obj)
      this.disposeObject3D(obj)
      this.windowInstances.splice(i, 1)
    }
  }

  private disposeAllHighDetail() {
    for (const mesh of this.claddingLodHighMeshes) {
      this.claddingGroup.remove(mesh)
      mesh.geometry.dispose()
    }
    this.claddingLodHighMeshes.length = 0
    for (let i = this.windowInstances.length - 1; i >= 0; i -= 1) {
      if (this.windowInstances[i].userData.lodTier !== 'high') continue
      const obj = this.windowInstances[i]
      this.windowGroup.remove(obj)
      this.disposeObject3D(obj)
      this.windowInstances.splice(i, 1)
    }
  }

  private disposeObject3D(obj: THREE.Object3D) {
    const materials = new Set<THREE.Material>()
    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry.dispose()
      const list = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of list) materials.add(material)
    })
    for (const material of materials) material.dispose()
  }

  private removeMeshesFromList(
    list: THREE.Mesh[],
    buildingId: string,
    group: THREE.Group,
    disposeGeo: boolean,
  ) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const mesh = list[i]
      if (mesh.userData.buildingId !== buildingId) continue
      group.remove(mesh)
      if (disposeGeo) mesh.geometry.dispose()
      list.splice(i, 1)
    }
  }

  private removeBuildingRenderables(buildingId: string) {
    const wallIds = new Set(
      getVisibleWalls(this.state)
        .filter((w) => w.buildingId === buildingId)
        .map((w) => w.id),
    )

    for (const [id, mesh] of this.meshes) {
      if (!wallIds.has(id)) continue
      this.wallGroup.remove(mesh)
      mesh.geometry.dispose()
      this.meshes.delete(id)
      this.disposeOpeningShadowTunnel(id)
      this.disposeWallBodyMaterials(id)
    }

    this.removeMeshesFromList(this.claddingLodLowMeshes, buildingId, this.claddingGroup, true)
    this.removeMeshesFromList(this.claddingLodHighMeshes, buildingId, this.claddingGroup, true)
    this.removeMeshesFromList(this.studioCladdingMeshes, buildingId, this.claddingGroup, true)

    for (let i = this.windowLodLowInstances.length - 1; i >= 0; i -= 1) {
      const obj = this.windowLodLowInstances[i]
      if (obj.userData.buildingId !== buildingId) continue
      this.windowGroup.remove(obj)
      this.disposeObject3D(obj)
      this.windowLodLowInstances.splice(i, 1)
    }
    this.disposeBuildingHighDetail(buildingId)

    const filterMeshList = (list: THREE.Mesh[], group: THREE.Group) => {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const mesh = list[i]
        const wallId = mesh.userData.wallId as string | undefined
        if (!wallId || !wallIds.has(wallId)) continue
        group.remove(mesh)
        disposePlinthOpeningDiscard(mesh.geometry)
        mesh.customDepthMaterial?.dispose()
        mesh.geometry.dispose()
        list.splice(i, 1)
      }
    }
    filterMeshList(this.profileMeshes, this.profileGroup)
    filterMeshList(this.revealMeshes, this.profileGroup)
    filterMeshList(this.innerSillMeshes, this.profileGroup)
    filterMeshList(this.outerSillMeshes, this.profileGroup)
    filterMeshList(this.pedimentMeshes, this.profileGroup)
    filterMeshList(this.stairMeshes, this.claddingGroup)

    for (let i = this.casingInstances.length - 1; i >= 0; i -= 1) {
      const obj = this.casingInstances[i]
      if (!wallIds.has(obj.userData.wallId as string)) continue
      this.casingGroup.remove(obj)
      this.casingInstances.splice(i, 1)
    }
    for (let i = this.claddingInstances.length - 1; i >= 0; i -= 1) {
      const obj = this.claddingInstances[i]
      if (!wallIds.has(obj.userData.wallId as string)) continue
      this.claddingGroup.remove(obj)
      this.claddingInstances.splice(i, 1)
    }

    for (let i = this.roofGroup.children.length - 1; i >= 0; i -= 1) {
      const child = this.roofGroup.children[i] as THREE.Mesh
      if (child.userData.buildingId !== buildingId) continue
      this.roofGroup.remove(child)
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material?.dispose()
    }

    for (let i = this.farHullMeshes.length - 1; i >= 0; i -= 1) {
      if (this.farHullMeshes[i].userData.buildingId !== buildingId) continue
      this.farHullMeshes[i].removeFromParent()
      this.farHullMeshes[i].geometry.dispose()
      this.farHullMeshes.splice(i, 1)
    }
  }

  private rebuildBuilding(buildingId: string) {
    const walls = getVisibleWalls(this.state).filter((w) => w.buildingId === buildingId)
    const bare = this.buildingIsBare(buildingId)
    for (const wall of walls) {
      this.syncWallBodyMeshes(wall)
      this.syncOpeningShadowTunnel(wall)
    }

    if (bare) {
      this.rebuildFarHullForBuilding(buildingId)
      this.lodLevelByBuilding.set(buildingId, 'high')
      this.highDetailBuilt.add(buildingId)
      this.applyLodVisibility()
      return
    }

    this.rebuildProfilesForBuilding(buildingId)
    this.rebuildInnerSillsForBuilding(buildingId)
    this.rebuildOuterSillsForBuilding(buildingId)
    this.rebuildPedimentsForBuilding(buildingId)
    this.rebuildRevealsForBuilding(buildingId)
    this.rebuildCladdingForWalls(walls, 'low')
    this.rebuildCasingsForBuilding(buildingId)
    this.rebuildStairsForBuilding(buildingId)
    this.rebuildRollerShuttersForBuilding(buildingId)
    this.rebuildRoofForBuilding(buildingId)
    this.rebuildFarHullForBuilding(buildingId)
    if (this.isPerfPresentation()) {
      this.rebuildWindowsForWalls(walls, 'high')
      this.highDetailBuilt.add(buildingId)
      this.lodLevelByBuilding.set(buildingId, 'high')
      this.applyLodVisibility()
      return
    }
    this.rebuildWindowsForWalls(walls, 'low')
    this.lodLevelByBuilding.set(buildingId, 'high')
    this.ensureBuildingHighDetail(buildingId)
  }

  private ensureBuildingHighDetail(buildingId: string) {
    if (this.buildingIsBare(buildingId)) {
      this.highDetailBuilt.add(buildingId)
      return
    }
    if (this.isDraftPresentation()) {
      this.highDetailBuilt.add(buildingId)
      return
    }
    if (this.isPreviewPresentation()) {
      // Cladding bleibt Flat; Fenster ggf. nachziehen.
      if (!this.highDetailBuilt.has(buildingId)) {
        const walls = getVisibleWalls(this.state).filter((w) => w.buildingId === buildingId)
        this.rebuildWindowsForWalls(walls, 'high')
        this.highDetailBuilt.add(buildingId)
        this.applyLodVisibility()
      }
      return
    }
    if (this.highDetailBuilt.has(buildingId)) return
    const walls = getVisibleWalls(this.state).filter((w) => w.buildingId === buildingId)
    this.rebuildCladdingForWalls(walls, 'high')
    this.rebuildWindowsForWalls(walls, 'high')
    this.highDetailBuilt.add(buildingId)
    this.applyFacadeBacklitShade()
    this.applyLodVisibility()
  }

  private clearFarHulls() {
    for (const mesh of this.farHullMeshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    this.farHullMeshes.length = 0
  }

  private rebuildFarHulls() {
    this.clearFarHulls()
    for (const building of this.state.buildings) {
      if (building.hidden) continue
      this.rebuildFarHullForBuilding(building.id)
    }
  }

  private rebuildFarHullForBuilding(buildingId: string) {
    const building = this.state.buildings.find((b) => b.id === buildingId)
    if (!building || building.hidden) return
    const box = buildingWorldBoxForBuilding(building)
    if (box.isEmpty()) return
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z)
    const mat = createTintedMaterial(this.material, averageBuildingColor(building))
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.buildingId = buildingId
    mesh.visible = false
    this.wallGroup.add(mesh)
    this.farHullMeshes.push(mesh)
  }

  private rebuildProfilesForBuilding(buildingId: string) {
    this.rebuildProfiles(buildingId)
  }

  private rebuildInnerSillsForBuilding(buildingId: string) {
    this.rebuildInnerSills(buildingId)
  }

  private rebuildOuterSillsForBuilding(buildingId: string) {
    this.rebuildOuterSills(buildingId)
  }

  private rebuildPedimentsForBuilding(buildingId: string) {
    this.rebuildPediments(buildingId)
  }

  private rebuildRevealsForBuilding(buildingId: string) {
    this.rebuildReveals(buildingId)
  }

  private rebuildCasingsForBuilding(buildingId: string) {
    this.rebuildCasings(buildingId)
  }

  private rebuildStairsForBuilding(buildingId: string) {
    this.rebuildStairs(buildingId)
  }

  private rebuildRollerShuttersForBuilding(buildingId: string) {
    this.rebuildRollerShutters(buildingId)
  }

  private rebuildRoofForBuilding(buildingId: string) {
    this.rebuildRoof(buildingId)
  }

  /** Während Farb-Hover: keine orange Selektion, damit die Vorschaufarbe sichtbar ist. */
  setSelectionHighlightSuppressed(suppressed: boolean) {
    if (this.suppressSelectionHighlight === suppressed) return
    this.suppressSelectionHighlight = suppressed
    this.applySelection()
  }

  private async loadMeshes() {
    try {
      const [casings, claddings] = await Promise.all([
        loadWindowProfileTemplates(),
        loadCladdingTemplates(),
      ])
      this.casingTemplates = casings
      this.claddingTemplates = claddings
      this.rebuildWindows()
      this.rebuildCasings()
      this.rebuildCladding()
      this.finalizeGeometryRebuild()
      this.applyRenderStyle()
      this.applySelection()
    } finally {
      this.resolveMeshesReady()
    }
  }

  private buildingWalls(wall: Wall): Wall[] {
    return findBuildingForWall(this.state, wall.id)?.walls ?? []
  }

  private disposeWallBodyMaterials(id: string) {
    const exterior = this.wallMaterials.get(id)
    if (exterior) {
      exterior.dispose()
      this.wallMaterials.delete(id)
    }
    const interior = this.wallInteriorMaterials.get(id)
    if (interior) {
      interior.dispose()
      this.wallInteriorMaterials.delete(id)
    }
  }

  private wallBodyMaterial(wallId: string): THREE.Material | THREE.Material[] {
    const exterior = this.wallMaterials.get(wallId)
    const interior = this.wallInteriorMaterials.get(wallId)
    if (!exterior) return this.material
    if (!interior) return exterior
    return [exterior, interior]
  }

  private syncWallBodyMaterials(
    wall: Wall,
    shadowSide: THREE.Side,
  ): THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] {
    const bare = this.wallIsBare(wall)
    const wallColor = bare ? '#ffffff' : (wall.wallColor ?? DEFAULT_WALL_COLOR)
    const interiorColor = bare ? '#ffffff' : (wall.interiorColor ?? DEFAULT_INTERIOR_COLOR)
    const finish = bare ? undefined : wall.wallFinish
    let exterior = this.wallMaterials.get(wall.id)
    if (!exterior) {
      exterior = createTintedMaterial(this.material, wallColor, finish)
      this.wallMaterials.set(wall.id, exterior)
    } else {
      exterior.color.set(wallColor)
      applySurfaceFinish(exterior, finish)
    }
    exterior.side = THREE.FrontSide
    exterior.shadowSide = shadowSide
    this.finishExteriorMaterial(exterior)

    let interior = this.wallInteriorMaterials.get(wall.id)
    if (!interior) {
      interior = createTintedMaterial(this.material, interiorColor, finish)
      this.wallInteriorMaterials.set(wall.id, interior)
    } else {
      interior.color.set(interiorColor)
      applySurfaceFinish(interior, finish)
    }
    interior.side = THREE.FrontSide
    interior.shadowSide = THREE.FrontSide
    interior.userData.interiorWallSurface = true
    interior.userData.skipFacadeShade = true
    bindSkipPointShadows(interior)
    this.finishInteriorMaterial(interior)

    return isStudioWall(wall) ? [exterior, interior] : exterior
  }

  /** Studio-Wand: ein Mesh, zwei Materialien (außen/innen) — kein Geometrie-Split. */
  private syncWallBodyMeshes(wall: Wall): void {
    const neighborWalls = this.buildingWalls(wall)
    const bodyWall = this.wallForBodyMesh(wall)
    const transform = wallPlacement(wall)
    const geometry = isStudioWall(bodyWall)
      ? createStudioWallGeometry(bodyWall, neighborWalls)
      : createWallGeometry(bodyWall, neighborWalls)
    const wallMaterial = this.syncWallBodyMaterials(
      wall,
      this.pointLightOccludersEnabled ? THREE.DoubleSide : THREE.FrontSide,
    )
    let mesh = this.meshes.get(wall.id)
    if (!mesh) {
      mesh = new THREE.Mesh(geometry, wallMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.wallGroup.add(mesh)
      this.meshes.set(wall.id, mesh)
    } else {
      mesh.geometry.dispose()
      mesh.geometry = geometry
      mesh.material = wallMaterial
      mesh.receiveShadow = true
    }
    mesh.userData = { kind: 'wall', wallId: wall.id, buildingId: wall.buildingId }
    mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
    mesh.rotation.y = transform.rotationY
    this.syncWallMeshLightLayers(mesh)
  }

  private rebuild() {
    const visibleWalls = getVisibleWalls(this.state)
    const remaining = new Set(visibleWalls.map((wall) => wall.id))

    for (const [id, mesh] of this.meshes) {
      if (remaining.has(id)) continue
      this.wallGroup.remove(mesh)
      mesh.geometry.dispose()
      this.meshes.delete(id)
      this.disposeOpeningShadowTunnel(id)
      this.disposeWallBodyMaterials(id)
    }

    for (const wall of visibleWalls) {
      this.syncWallBodyMeshes(wall)
      this.syncOpeningShadowTunnel(wall)
    }
    this.disposeLeftoverInteriorWallShells()

    this.rebuildProfiles()
    this.rebuildInnerSills()
    this.rebuildOuterSills()
    this.rebuildPediments()
    this.rebuildReveals()
    this.rebuildWindows()
    this.rebuildCasings()
    try {
      this.rebuildCladding()
    } catch (error) {
      console.error('Verkleidung fehlgeschlagen', error)
    }
    this.rebuildStairs()
    this.rebuildRollerShutters()
    // Stil vor Selektion: sonst überschreibt applyRenderStyle die orange Auswahl
    this.finalizeGeometryRebuild()
    this.applyRenderStyle()
    this.applySelection()
  }

  private rebuildReveals(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.revealMeshes) {
        this.profileGroup.remove(mesh)
        mesh.geometry.dispose()
      }
      this.revealMeshes.length = 0
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      if (this.isDraftPresentation()) continue
      if (!isStudioWall(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if (!openingCutsWall(opening)) continue
        const geometry = createStudioOpeningRevealGeometry(wall, opening)
        if (!geometry) continue
        const exteriorColor =
          opening.revealExteriorColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR
        const interiorColor =
          opening.revealInteriorColor ?? wall.interiorColor ?? DEFAULT_INTERIOR_COLOR
        const exteriorMaterial = createTintedMaterial(this.material, exteriorColor, wall.wallFinish)
        const interiorMaterial = createTintedMaterial(
          this.material,
          interiorColor,
          wall.wallFinish,
        )
        exteriorMaterial.shadowSide = THREE.FrontSide
        interiorMaterial.shadowSide = THREE.FrontSide
        interiorMaterial.userData.skipFacadeShade = true
        bindSkipPointShadows(interiorMaterial)
        const materials =
          geometry.groups.length >= 2
            ? [exteriorMaterial, interiorMaterial]
            : exteriorMaterial
        const mesh = new THREE.Mesh(geometry, materials)
        mesh.castShadow = true
        // Nische/Konche empfängt Cube-Schatten der Kappen — sonst leuchtet der Hohlraum.
        mesh.receiveShadow = opening.type === 'conch' || openingFillMode(opening) === 'niche'
        mesh.renderOrder = 2
        exteriorMaterial.polygonOffset = true
        exteriorMaterial.polygonOffsetFactor = -2
        exteriorMaterial.polygonOffsetUnits = -2
        interiorMaterial.polygonOffset = true
        interiorMaterial.polygonOffsetFactor = -2
        interiorMaterial.polygonOffsetUnits = -2
        mesh.userData.originalMaterial = materials
        mesh.userData.wallId = wall.id
        mesh.userData.sealedNiche =
          opening.type === 'conch' || openingFillMode(opening) === 'niche'
        // Zeichnung: Kanten wie Wandkörper bei Paneelen weglassen — Extrados besitzen
        // Steine/Sockel; sonst 64–128 Laibungs-Segmente als Reißverschluss.
        mesh.userData.skipLineEdges = true
        tagPickable(mesh, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'group',
        })
        const transform = studioWallTransform(wall)
        mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
        mesh.rotation.y = transform.rotationY
        this.profileGroup.add(mesh)
        this.revealMeshes.push(mesh)
      }
    }
  }

  private disposeOpeningShadowTunnel(wallId: string) {
    const mesh = this.openingShadowTunnelMeshes.get(wallId)
    if (!mesh) return
    this.wallGroup.remove(mesh)
    mesh.geometry.dispose()
    this.openingShadowTunnelMeshes.delete(wallId)
  }

  /** Reste der fehlgeschlagenen Wand-Split-Meshes (v2.0.48) entfernen. */
  private disposeLeftoverInteriorWallShells(): void {
    const extra: THREE.Mesh[] = []
    for (const child of this.wallGroup.children) {
      if (child instanceof THREE.Mesh && child.userData.wallShell === 'interior') extra.push(child)
    }
    for (const mesh of extra) {
      this.wallGroup.remove(mesh)
      mesh.geometry.dispose()
    }
  }

  /** Unsichtbarer Tunnel: blockiert Licht durch die Wandstärke (Öffnungen, Konchen, Keller). */
  private syncOpeningShadowTunnel(wall: Wall) {
    if (!isStudioWall(wall) || this.wallIsBare(wall)) {
      this.disposeOpeningShadowTunnel(wall.id)
      return
    }
    const surfaceWall = this.wallForBodyMesh(wall)
    const geometry = createStudioOpeningShadowTunnelGeometry(surfaceWall)
    if (!geometry) {
      this.disposeOpeningShadowTunnel(wall.id)
      return
    }
    let mesh = this.openingShadowTunnelMeshes.get(wall.id)
    if (!mesh) {
      mesh = new THREE.Mesh(geometry, this.shadowOccluderMaterial)
      mesh.frustumCulled = false
      this.wallGroup.add(mesh)
      this.openingShadowTunnelMeshes.set(wall.id, mesh)
    } else {
      mesh.geometry.dispose()
      mesh.geometry = geometry
    }
    this.tagPointLightShadowOccluder(mesh)
    mesh.userData = {
      kind: 'openingShadowTunnel',
      wallId: wall.id,
      buildingId: wall.buildingId,
      shadowOccluder: true,
    }
    mesh.layers.enable(SHADOW_LAYER_EXTERIOR)
    mesh.layers.enable(SHADOW_LAYER_INTERIOR)
    const transform = wallPlacement(wall)
    mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
    mesh.rotation.y = transform.rotationY
  }

  private rebuildWindows() {
    this.highDetailBuilt.clear()
    for (const instance of [...this.windowInstances]) {
      this.windowGroup.remove(instance)
      this.disposeObject3D(instance)
    }
    this.windowInstances.length = 0
    for (const instance of [...this.windowLodLowInstances]) {
      this.windowGroup.remove(instance)
      this.disposeObject3D(instance)
    }
    this.windowLodLowInstances.length = 0
    this.rebuildWindowsForWalls(getVisibleWalls(this.state), this.windowTierForPresentation())
    this.applyLodVisibility()
    this.applyOrthographicGlassSeeThrough()
  }

  private windowTierForPresentation(): 'low' | 'high' {
    if (this.isPreviewPresentation() || this.isDraftPresentation()) return 'high'
    return 'low'
  }

  private rebuildWindowsForWalls(walls: Wall[], tier: 'low' | 'high') {
    for (const wall of walls) {
      if (this.wallIsBare(wall)) continue
      const building = findBuildingForWall(this.state, wall.id)
            const buildingId = wall.buildingId ?? building?.id

      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if (opening.type !== 'window' && opening.type !== 'door') continue
        if (!openingShowsGlazing(opening)) continue

        const config = gruenderzeitConfigForOpening(opening)
        const frameDepth = windowAssemblyDepth(config)
        const frameColor = opening.frameColor ?? defaultOpeningFrameColor(opening.type)
        const frameFinish = opening.frameFinish
        const glassConfig = openingGlassConfig(opening)
        const depthOffset = effectiveOpeningDepthOffset(opening, building?.windowDepthOffset)

        const glazingArch = openingGlazingArchEnabled(opening)
        const glazingForm = openingGlazingArchForm(opening)
        const archRiseCm = normalizeOpeningArch(opening.arch).riseCm
        let instance: THREE.Object3D
        if (tier === 'low') {
          if (opening.type === 'window' || glazingArch) {
            instance = createSimpleWindowMesh(
              opening.width,
              opening.height,
              frameColor,
              glassConfig,
              glazingForm,
              frameFinish,
              archRiseCm,
            )
          } else {
            const doorMat = createTintedMaterial(
              new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
              frameColor,
              frameFinish,
            )
            instance = new THREE.Mesh(
              new THREE.BoxGeometry(opening.width, opening.height, frameDepth),
              doorMat,
            )
            instance.castShadow = true
            instance.receiveShadow = false
            instance.userData.proceduralWindow = true
            instance.userData.lodTier = 'low'
          }
        } else {
          instance = createGruenderzeitWindowMesh(
            opening.width,
            opening.height,
            config,
            frameColor,
            glassConfig,
            glazingForm,
            frameFinish,
            leafOpenSignForWall(wall),
            archRiseCm,
            opening.type === 'door' ? normalizeOpeningDoor(opening.door) : null,
          )
          instance.userData.lodTier = 'high'
        }

        instance.userData.buildingId = buildingId
        instance.userData.wallId = wall.id
        instance.userData.openingId = opening.id
        tagPickable(instance, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'frame',
        })

        if (isStudioWall(wall)) {
          const local = openingLocalCenter(wall, opening)
          const originZ = this.isDraftPresentation()
            ? studioLightModeWindowOriginZ(wall, frameDepth, depthOffset)
            : studioWindowOriginZ(wall, frameDepth, depthOffset)
          const world = localToWorld(wall, local.x, local.y, originZ)
          instance.position.set(world.x, world.y, world.z)
          instance.rotation.y = studioWallTransform(wall).rotationY + Math.PI
        } else {
          instance.position.set(
            wall.x + opening.x + opening.width / 2,
            wall.y + opening.y + opening.height / 2,
            wall.depth - WINDOW_RECESS - frameDepth + depthOffset * windowDepthForwardSign(wall),
          )
        }

        this.windowGroup.add(instance)
        if (this.isDraftPresentation()) {
          instance.renderOrder = 3
        }
        if (tier === 'low') {
          instance.visible = this.isDraftPresentation()
          this.windowLodLowInstances.push(instance)
        } else {
          instance.visible = false
          this.windowInstances.push(instance)
        }

        if (tier === 'high' && (opening.type === 'window' || opening.type === 'door')) {
          const guard = normalizeOpeningGuard(opening.guard)
          if (guard.enabled) {
            const guardMesh = createOpeningGuardMesh(
              opening.width,
              opening.height,
              guard,
              frameColor,
            )
            guardMesh.position.z = frameDepth + 2.5
            tagPickable(guardMesh, {
              kind: 'opening',
              wallId: wall.id,
              openingId: opening.id,
              openingPart: 'frame',
            })
            instance.add(guardMesh)
          }
          const shade = normalizeOpeningInteriorShade(opening.interiorShade)
          if (shade.enabled && shade.drop > 0.02) {
            const shadeMesh = createInteriorShadeMesh(opening.width, opening.height, shade)
            shadeMesh.position.z = -1.5
            instance.add(shadeMesh)
          }
        }

        if (tier === 'high' && basementWindowEnabled(opening)) {
          const grilleGeometry = createBasementGrilleGeometry(wall, opening)
          if (grilleGeometry) {
            const grilleMaterial = new THREE.MeshStandardMaterial({
              color: 0x353535,
              roughness: 0.75,
              metalness: 0.55,
            })
            const grilleMesh = new THREE.Mesh(grilleGeometry, grilleMaterial)
            grilleMesh.castShadow = true
            grilleMesh.receiveShadow = true
            grilleMesh.userData.lodTier = 'high'
            grilleMesh.userData.buildingId = buildingId
            grilleMesh.userData.wallId = wall.id
            tagPickable(grilleMesh, {
              kind: 'opening',
              wallId: wall.id,
              openingId: opening.id,
              openingPart: 'grille',
            })
            if (isStudioWall(wall)) {
              const transform = studioWallTransform(wall)
              grilleMesh.position.set(transform.position.x, transform.position.y, transform.position.z)
              grilleMesh.rotation.y = transform.rotationY
            } else {
              grilleMesh.position.set(wall.x + wall.width / 2, wall.y + wall.height / 2, 0)
            }
            this.windowGroup.add(grilleMesh)
            this.windowInstances.push(grilleMesh)
          }
        }
      }
    }
    this.applyOrthographicGlassSeeThrough()
  }

  private rebuildCasings(buildingId?: string) {
    if (!buildingId) {
      for (const instance of this.casingInstances) {
        this.casingGroup.remove(instance)
      }
      this.casingInstances.length = 0
    }
    if (this.casingTemplates.size === 0) return

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if (opening.type !== 'window') continue
        if (!openingHasProfile(wall, opening.id, 'classical')) continue
        const template = this.casingTemplates.get(windowModelKey(opening.width, opening.height))
        if (!template) continue
        const cladding = resolveCladding(wall)
        const z =
          cladding?.variant === 'v2' ? PROFILE_OFFSET_CLASSICAL_V2 : 0
        const instance = template.clone(true)
        applyMeshColor(instance, opening.frameColor ?? defaultOpeningFrameColor(opening.type), {
          skipGlass: true,
          finish: opening.frameFinish,
        })
        tagPickable(instance, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'frame',
        })
        instance.userData.wallId = wall.id
        instance.userData.buildingId = wall.buildingId
        instance.position.set(wall.x + opening.x, wall.y + opening.y, z)
        this.casingGroup.add(instance)
        this.casingInstances.push(instance)
      }
    }
  }

  private rebuildCladding() {
    this.highDetailBuilt.clear()
    for (const instance of this.claddingInstances) {
      this.claddingGroup.remove(instance)
    }
    this.claddingInstances.length = 0

    for (const mesh of this.wallLabelMeshes) {
      this.profileGroup.remove(mesh)
      this.claddingGroup.remove(mesh)
      mesh.geometry.dispose()
      this.disposeLabelMaterial(mesh)
    }
    this.wallLabelMeshes.length = 0

    for (const mesh of [
      ...this.studioCladdingMeshes,
      ...this.claddingLodLowMeshes,
      ...this.claddingLodHighMeshes,
    ]) {
      this.claddingGroup.remove(mesh)
      mesh.geometry.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial && mat.map) {
          disposePanelAtlasTexture(mat.map)
          mat.map = null
        }
        if (mat !== this.material && mat !== this.whiteMaterial) mat.dispose()
      }
    }
    this.studioCladdingMeshes.length = 0
    this.wallLabelMeshes.length = 0
    this.claddingLodLowMeshes.length = 0
    this.claddingLodHighMeshes.length = 0

    this.rebuildCladdingForWalls(getVisibleWalls(this.state), 'low')
  }

  private rebuildCladdingForWalls(walls: Wall[], tier: 'low' | 'high') {
    if (tier === 'high') this.scheduleLabelFontRefresh(walls)
    const box = new THREE.Box3()
    const targetList = tier === 'low' ? this.claddingLodLowMeshes : this.claddingLodHighMeshes

    for (const wall of walls) {
      if (this.wallIsBare(wall)) continue
      const geomWall = this.wallForBodyMesh(wall)
      const neighborWalls = this.buildingWalls(wall)
      const buildingId = wall.buildingId ?? findBuildingForWall(this.state, wall.id)?.id

      if (isStudioWall(wall)) {
        const panel = wall.panel ?? DEFAULT_STUDIO_PANEL
        const transform = wallPlacement(wall)
        if (!(panel.enabled === false || panel.pattern === 'none')) {
          try {
            const claddingColor = wall.claddingColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR
            const tiles = layoutPanelTiles(geomWall, panel, neighborWalls)

            const stages = tileColorStageCount(panel.tileColorVariety ?? 0)
            const palette = buildTileColorPalette(
              claddingColor,
              panel.tileColorVariance ?? 0,
              stages,
            )
            const seedKey = `${wall.id}:${claddingColor}:${panel.tileColorVariance ?? 0}:${panel.tileColorVariety ?? 0}:${panel.pattern}`
            const useMultiColor = stages > 1 && (panel.tileColorVariance ?? 0) > 0

            if (tier === 'low') {
              if (this.isDraftPresentation()) {
                // Lange Wände: mehrere Atlas-Streifen, damit Steine nicht zu „Brei“ verpixelt werden.
                const strips = createPanelAtlasStrips(
                  geomWall,
                  panel,
                  tiles,
                  claddingColor,
                  seedKey,
                )
                for (const strip of strips) {
                  const geometry = createStudioPanelAtlasGeometry(geomWall, {
                    startCm: strip.startCm,
                    lengthCm: strip.lengthCm,
                  })
                  const material = createTintedMaterial(this.material, '#ffffff', wall.claddingFinish)
                  material.map = strip.texture
                  material.transparent = true
                  material.alphaTest = 0.35
                  material.depthWrite = false
                  material.needsUpdate = true
                  applyWorkModeSurfaceLook(material)
                  const mesh = new THREE.Mesh(geometry, material)
                  mesh.renderOrder = 2
                  mesh.castShadow = false
                  mesh.receiveShadow = true
                  mesh.userData.lodTier = 'light'
                  mesh.userData.buildingId = buildingId
                  mesh.userData.wallId = wall.id
                  tagPickable(mesh, { kind: 'wall', wallId: wall.id, wallPart: 'cladding' })
                  mesh.userData.originalMaterial = material
                  mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
                  mesh.rotation.y = transform.rotationY
                  mesh.visible = false
                  this.claddingGroup.add(mesh)
                  targetList.push(mesh)
                }
              } else {
              const geos =
                this.isPreviewPresentation()
                  ? createStudioPanelFlatGeometriesByColorIndex(
                      geomWall,
                      panel,
                      useMultiColor ? stages : 1,
                      seedKey,
                      neighborWalls,
                      tiles,
                    )
                  : useMultiColor
                    ? createStudioPanelGeometriesByColorIndex(
                        geomWall,
                        panel,
                        stages,
                        seedKey,
                        neighborWalls,
                        tiles,
                      )
                    : [
                        {
                          stageIndex: 0,
                          // Bei persistierten Zonen echtes Raster (sonst eine Platte ohne Modulwechsel).
                          geometry:
                            geomWall.claddingZones && geomWall.claddingZones.length > 0
                              ? createStudioPanelGeometry(geomWall, panel, neighborWalls, tiles)
                              : createStudioPanelLowGeometry(geomWall, panel, neighborWalls),
                        },
                      ]
              for (const { stageIndex, geometry } of geos) {
                if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
                  geometry.dispose()
                  continue
                }
                const color = useMultiColor ? (palette[stageIndex] ?? claddingColor) : claddingColor
                const material = createTintedMaterial(this.material, color, wall.claddingFinish)
                if (this.isPreviewPresentation()) applyWorkModeSurfaceLook(material)
                else this.finishExteriorMaterial(material)
                const mesh = new THREE.Mesh(geometry, material)
                mesh.castShadow = !this.isPreviewPresentation()
                mesh.receiveShadow = this.isPreviewPresentation()
                mesh.userData.lodTier = 'low'
                mesh.userData.buildingId = buildingId
                mesh.userData.wallId = wall.id
                tagPickable(mesh, { kind: 'wall', wallId: wall.id, wallPart: 'cladding' })
                mesh.userData.originalMaterial = material
                mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
                mesh.rotation.y = transform.rotationY
                mesh.visible = false
                this.claddingGroup.add(mesh)
                targetList.push(mesh)
              }

              if (panel.joint > 0) {
                const mortarGeometry = this.isPreviewPresentation()
                  ? createStudioMortarFlatGeometry(geomWall, panel, neighborWalls, tiles)
                  : createStudioMortarGeometry(geomWall, panel, neighborWalls, tiles)
                if (mortarGeometry) {
                  const mortarColor = panel.jointColor ?? DEFAULT_JOINT_COLOR
                  const mortarMaterial = createTintedMaterial(
                    this.material,
                    mortarColor,
                    wall.wallFinish,
                  )
                  if (this.isPreviewPresentation()) applyWorkModeSurfaceLook(mortarMaterial)
                  else this.finishExteriorMaterial(mortarMaterial)
                  const mortarMesh = new THREE.Mesh(mortarGeometry, mortarMaterial)
                  mortarMesh.castShadow = !this.isPreviewPresentation()
                  mortarMesh.receiveShadow = this.isPreviewPresentation()
                  mortarMesh.userData.lodTier = 'mortar'
                  mortarMesh.userData.skipLineEdges = true
                  mortarMesh.userData.buildingId = buildingId
                  mortarMesh.userData.wallId = wall.id
                  tagPickable(mortarMesh, { kind: 'wall', wallId: wall.id })
                  mortarMesh.userData.originalMaterial = mortarMaterial
                  mortarMesh.position.set(transform.position.x, transform.position.y, transform.position.z)
                  mortarMesh.rotation.y = transform.rotationY
                  mortarMesh.visible = false
                  this.claddingGroup.add(mortarMesh)
                  this.studioCladdingMeshes.push(mortarMesh)
                }
              }

              if (this.isPreviewPresentation()) {
                const profileId = panel.plinthProfileId ?? 'sockelprofil'
                const decorativePlinth = profileId !== 'sockelStandard' && Boolean(profileId)
                if (!decorativePlinth) {
                  const plinthGeometry = createStudioPlinthGeometry(geomWall, panel, neighborWalls)
                  if (plinthGeometry) {
                    const plinthColor = panel.plinthColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR
                    const plinthMaterial = createTintedMaterial(
                      this.material,
                      plinthColor,
                      wall.wallFinish,
                    )
                    applyWorkModeSurfaceLook(plinthMaterial)
                    const plinthMesh = new THREE.Mesh(plinthGeometry, plinthMaterial)
                    plinthMesh.castShadow = true
                    plinthMesh.receiveShadow = false
                    plinthMesh.userData.lodTier = 'plinth'
                    plinthMesh.userData.buildingId = buildingId
                    plinthMesh.userData.wallId = wall.id
                    tagPickable(plinthMesh, { kind: 'wall', wallId: wall.id, wallPart: 'plinth' })
                    plinthMesh.userData.originalMaterial = plinthMaterial
                    plinthMesh.position.set(
                      transform.position.x,
                      transform.position.y,
                      transform.position.z,
                    )
                    plinthMesh.rotation.y = transform.rotationY
                    this.claddingGroup.add(plinthMesh)
                    this.studioCladdingMeshes.push(plinthMesh)
                  }
                }
              }
              }
            } else if (!this.isPerfPresentation()) {
              const geos = useMultiColor
                ? createStudioPanelGeometriesByColorIndex(
                    geomWall,
                    panel,
                    stages,
                    seedKey,
                    neighborWalls,
                    tiles,
                  )
                : [
                    {
                      stageIndex: 0,
                      geometry: createStudioPanelGeometry(geomWall, panel, neighborWalls, tiles),
                    },
                  ]
              for (const { stageIndex, geometry } of geos) {
                if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
                  geometry.dispose()
                  continue
                }
                const color = palette[stageIndex] ?? claddingColor
                const material = createTintedMaterial(this.material, color, wall.claddingFinish)
                this.finishExteriorMaterial(material)
                const mesh = new THREE.Mesh(geometry, material)
                mesh.castShadow = true
                mesh.receiveShadow = false
                mesh.userData.lodTier = 'high'
                mesh.userData.buildingId = buildingId
                mesh.userData.wallId = wall.id
                tagPickable(mesh, { kind: 'wall', wallId: wall.id, wallPart: 'cladding' })
                mesh.userData.originalMaterial = material
                mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
                mesh.rotation.y = transform.rotationY
                mesh.visible = false
                this.claddingGroup.add(mesh)
                targetList.push(mesh)
              }
            }
          } catch (error) {
            console.error('Paneel-Geometrie fehlgeschlagen', wall.id, panel.pattern, error)
          }
        }

        // Freiraum-Rahmen: auch ohne Paneele/Mauerwerk (Abstand × Tiefe vor der Wand).
        if (!this.isPerfPresentation()) {
        const wallCapColor = wall.wallColor ?? DEFAULT_WALL_COLOR
        for (const opening of geomWall.openings) {
          const capGeometry = createStudioClearanceCapGeometry(geomWall, opening, panel)
          if (!capGeometry) continue
          const capMaterial = createTintedMaterial(this.material, wallCapColor, wall.wallFinish)
          const capMesh = new THREE.Mesh(capGeometry, capMaterial)
          capMesh.castShadow = true
          capMesh.receiveShadow = false
          capMesh.userData.lodTier = 'high'
          capMesh.userData.buildingId = buildingId
          capMesh.userData.wallId = wall.id
          tagPickable(capMesh, {
            kind: 'opening',
            wallId: wall.id,
            openingId: opening.id,
            openingPart: 'group',
          })
          capMesh.userData.originalMaterial = capMaterial
          capMesh.position.set(transform.position.x, transform.position.y, transform.position.z)
          capMesh.rotation.y = transform.rotationY
          this.claddingGroup.add(capMesh)
          targetList.push(capMesh)
        }
        }

        if (tier === 'high' && !this.isPerfPresentation()) {
          const profileId = panel.plinthProfileId ?? 'sockelprofil'
          const decorativePlinth = profileId !== 'sockelStandard' && Boolean(profileId)
          // Dekoratives Profil ersetzt die Box — nur Sweep in profilePaths.
          if (!decorativePlinth) {
            const plinthGeometry = createStudioPlinthGeometry(geomWall, panel, neighborWalls)
            if (plinthGeometry) {
              const plinthColor = panel.plinthColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR
              const plinthMaterial = createTintedMaterial(
                this.material,
                plinthColor,
                wall.wallFinish,
              )
              const plinthMesh = new THREE.Mesh(plinthGeometry, plinthMaterial)
              plinthMesh.castShadow = true
              plinthMesh.receiveShadow = false
              plinthMesh.userData.lodTier = 'plinth'
              plinthMesh.userData.buildingId = buildingId
              plinthMesh.userData.wallId = wall.id
              tagPickable(plinthMesh, { kind: 'wall', wallId: wall.id, wallPart: 'plinth' })
              plinthMesh.userData.originalMaterial = plinthMaterial
              plinthMesh.position.set(transform.position.x, transform.position.y, transform.position.z)
              plinthMesh.rotation.y = transform.rotationY
              this.claddingGroup.add(plinthMesh)
              this.studioCladdingMeshes.push(plinthMesh)
            }
          }
        }

        continue
      }

      if (tier !== 'high') continue
      // GLB-Verkleidung hat ein rechteckiges Fensterloch. Bei Fassaden-Rundbogen
      // würde sonst die rechteckige Aussparung (Ecken/Schultern) sichtbar bleiben.
      const hasFacadeArch = geomWall.openings.some(
        (opening) =>
          openingCutsWall(opening) &&
          (normalizeOpeningArch(opening.arch).enabled || openingHasRoundMask(opening)),
      )
      if (hasFacadeArch) continue
      const spec = resolveCladding(wall)
      if (!spec) continue
      const template = this.claddingTemplates.get(spec.id)
      if (!template) continue
      box.setFromObject(template)
      const instance = template.clone(true)
      const claddingColor = wall.claddingColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR
      applyMeshColor(instance, claddingColor)
      instance.userData.buildingId = buildingId
      instance.userData.wallId = wall.id
      tagPickable(instance, { kind: 'wall', wallId: wall.id })
      instance.position.set(
        wall.x - box.min.x,
        wall.y - box.min.y,
        wall.depth + spec.offsetOutward - box.max.z,
      )
      this.claddingGroup.add(instance)
      this.claddingInstances.push(instance)
    }
    if (tier === 'high') {
      this.refreshWallLabels()
    }
  }

  private rebuildStairs(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.stairMeshes) {
        this.claddingGroup.remove(mesh)
        mesh.geometry.dispose()
      }
      this.stairMeshes.length = 0
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if (opening.type !== 'door' || !opening.stairs?.enabled) continue
        const geometry = createOpeningStairsGeometry(wall, opening)
        if (!geometry) continue
        const color = opening.stairs.color ?? wall.wallColor ?? DEFAULT_WALL_COLOR
        const finish = opening.stairs.finish ?? wall.wallFinish
        const material = createTintedMaterial(this.material, color, finish)
        material.side = THREE.DoubleSide
        material.shadowSide = THREE.FrontSide
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.originalMaterial = material
        mesh.userData.wallId = wall.id
        mesh.userData.buildingId = wall.buildingId
        tagPickable(mesh, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'stairs',
        })
        const transform = wallPlacement(wall)
        mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
        mesh.rotation.y = transform.rotationY
        this.claddingGroup.add(mesh)
        this.stairMeshes.push(mesh)
      }
    }
  }

  private disposeRollerShutterGroup(group: THREE.Group) {
    this.windowGroup.remove(group)
    const geo = group.userData.sharedGeometry
    if (geo instanceof THREE.BufferGeometry) geo.dispose()
    const mat = group.userData.sharedMaterial
    if (mat instanceof THREE.Material) mat.dispose()
    const guideGeo = group.userData.sharedGuideGeometry
    if (guideGeo instanceof THREE.BufferGeometry) guideGeo.dispose()
    const guideMat = group.userData.sharedGuideMaterial
    if (guideMat instanceof THREE.Material) guideMat.dispose()
  }

  private rebuildRollerShutters(buildingId?: string) {
    if (!buildingId) {
      for (const group of this.rollerShutterGroups) {
        this.disposeRollerShutterGroup(group)
      }
      this.rollerShutterGroups.length = 0
    } else {
      for (let i = this.rollerShutterGroups.length - 1; i >= 0; i -= 1) {
        const group = this.rollerShutterGroups[i]!
        if (group.userData.buildingId !== buildingId) continue
        this.disposeRollerShutterGroup(group)
        this.rollerShutterGroups.splice(i, 1)
      }
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if (!openingSupportsRollerShutter(opening)) continue
        const shutter = normalizeOpeningRollerShutter(opening.rollerShutter)
        if (!shutter.enabled) continue

        const width = rollerShutterSlatWidth(opening.width)
        const slatHeight = shutter.slatHeightCm ?? 5
        const gap = shutter.gapCm ?? 0.85
        const nMax = rollerShutterSlatCount(opening.height, slatHeight)
        const color = shutter.color ?? DEFAULT_ROLLER_COLOR
        const finish = rollerShutterFinish(shutter)
        const material = createTintedMaterial(this.profileMaterial, color, finish)
        material.side = THREE.DoubleSide
        const slatGeo = createRollerSlatGeometry(width, slatHeight, DEFAULT_ROLLER_BULGE_CM)

        const group = new THREE.Group()
        group.userData.wallId = wall.id
        group.userData.openingId = opening.id
        group.userData.buildingId = wall.buildingId
        group.userData.openingHeight = opening.height
        group.userData.slatHeight = slatHeight
        group.userData.gap = gap
        group.userData.kind = 'rollerShutter'
        group.userData.sharedGeometry = slatGeo
        group.userData.sharedMaterial = material

        for (let i = 0; i < nMax; i += 1) {
          const mesh = new THREE.Mesh(slatGeo, material)
          mesh.castShadow = true
          mesh.receiveShadow = true
          mesh.userData.originalMaterial = material
          mesh.userData.role = 'slat'
          mesh.visible = false
          tagPickable(mesh, {
            kind: 'opening',
            wallId: wall.id,
            openingId: opening.id,
            openingPart: 'rollerShutter',
          })
          group.add(mesh)
        }

        const localX = opening.x + opening.width / 2 - wall.width / 2
        const localY = opening.y + opening.height / 2 - wall.height / 2
        const forward = isStudioWall(wall) ? windowDepthForwardSign(wall) : 1
        const facadeZ = isStudioWall(wall) ? studioFacadeOutwardLocalZ(wall) : wall.depth
        // 8 cm hinter die Fassadenaußenfläche (in die Leibung).
        const localZ = facadeZ - forward * ROLLER_SHUTTER_INWARD_CM

        if (isStudioWall(wall)) {
          const world = localToWorld(wall, localX, localY, localZ)
          group.position.set(world.x, world.y, world.z)
          group.rotation.y = studioWallTransform(wall).rotationY
        } else {
          group.position.set(
            wall.x + opening.x + opening.width / 2,
            wall.y + opening.y + opening.height / 2,
            localZ,
          )
        }

        this.layoutRollerShutterGroup(group, shutter.drop)
        this.windowGroup.add(group)
        this.rollerShutterGroups.push(group)
      }
    }
  }

  private rebuildProfiles(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.profileMeshes) {
        this.profileGroup.remove(mesh)
        disposePlinthOpeningDiscard(mesh.geometry)
        mesh.customDepthMaterial?.dispose()
        mesh.geometry.dispose()
      }
      this.profileMeshes.length = 0
    }

    for (const path of buildProfilePaths(this.state)) {
      const profile = resolveProfile(path.profileId, this.state.customProfiles)
      if (!profile?.projecting || !profile.section || path.points.length < 2) continue
      const wall = findWall(this.state, path.wallId)
      if (buildingId && wall?.buildingId !== buildingId) continue
      if (wall && this.wallIsBare(wall)) continue
      const profileColor = path.color ?? wall?.profileColor ?? DEFAULT_PROFILE_COLOR

      let zBase: number
      let forwardSign: number

      if (path.localSpace && wall && isStudioWall(wall)) {
        forwardSign = path.forwardSign ?? 1
        if (this.isPerfPresentation()) {
          // Balken auf Stein-Ebene (vor der Wand), flush.
          zBase = studioWorkModeTileLocalZ(wall)
          zBase += (path.offsetForward ?? 0) * forwardSign
        } else if (path.role === 'sillOuter' || path.role === 'sillInner') {
          zBase = studioFacadeOutwardLocalZ(wall)
          zBase += (path.offsetForward ?? 0) * forwardSign
        } else if (path.role === 'plinthProfile') {
          zBase = studioPanelFaceLocalZ(wall)
          zBase += (path.offsetForward ?? 0) * forwardSign
        } else if (path.useWallOuterFace) {
          zBase = studioWallOuterLocalZ(wall)
          zBase += (path.offsetForward ?? 0) * forwardSign
        } else {
          zBase = studioProfileAnchorLocalZ(wall, path.offsetForward ?? 0)
        }
      } else {
        forwardSign = 1
        zBase = findBuildingForWall(this.state, path.wallId)?.wallDepth ?? getActiveBuilding(this.state).wallDepth
        zBase += (path.offsetForward ?? 0) * forwardSign
      }

      const transformSection = path.role === 'sillInner'
        ? transformProfileSectionAnchored
        : transformProfileSection
      let section = scaleProfileSectionAxes(
        transformSection(
          profile.section,
          path.rotationDeg ?? 0,
          path.flipOutward ?? false,
          path.flipForward ?? false,
        ),
        path.sectionScale ?? 1,
        path.sectionScaleForward ?? path.sectionScale ?? 1,
      )
      if (path.sectionClipBelowCm != null && path.sectionClipBelowCm > 0.05) {
        section = clipProfileSectionAboveCm(section, path.sectionClipBelowCm)
        if (section.length < 2) continue
      }
      const plinthH = wall?.panel?.plinthHeight ?? 0
      const usePlinthSweep =
        path.clipOpeningMask && wall && plinthH > 0.5 && path.role === 'plinthProfile'
      const geometry =
        this.isPerfPresentation() && !usePlinthSweep
          ? createSimpleProfileBarGeometry(path, section, zBase, forwardSign, { flushBack: true })
          : usePlinthSweep
            ? createPlinthProfileSweepGeometry(path, section, zBase, forwardSign, wall, plinthH)
            : createProfileSweepGeometry(path, section, zBase, forwardSign)
      const material = createTintedMaterial(
        this.profileMaterial,
        profileColor,
        path.finish ?? wall?.profileFinish,
      )
      if (this.isPerfPresentation()) applyWorkModeSurfaceLook(material)
      const mesh = new THREE.Mesh(geometry, material)
      const isPlinth = path.role === 'plinthProfile'
      mesh.castShadow = true
      mesh.receiveShadow = this.isPerfPresentation() ? false : !isPlinth
      mesh.userData.originalMaterial = material
      const plinthDiscard = geometry.userData.plinthOpeningDiscard
      if (plinthDiscard) {
        applyPlinthOpeningFragmentDiscard(mesh, plinthDiscard)
        // Ungeschnittene Sweep-Kanten würden in der Zeichnung durch Fenster laufen.
        mesh.userData.skipLineEdges = true
      } else if (isPlinth && geometry.userData.plinthCsg) {
        // CSG erzeugt interne Diagonalen zwischen Kellerfenstern; Kantenfilter
        // entfernt sie, aber Silhouette bleibt über EdgesGeometry + Filter.
        mesh.userData.lineEdgeThreshold = 35
      }

      if (path.localSpace && wall && isStudioWall(wall)) {
        const transform = studioWallTransform(wall)
        mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
        mesh.rotation.y = transform.rotationY
      }

      if (path.openingId && wall) {
        const part =
          path.role === 'sillInner' ? 'sillInner' : path.role === 'sillOuter' ? 'sillOuter' : 'trim'
        tagPickable(mesh, {
          kind: 'opening',
          wallId: wall.id,
          openingId: path.openingId,
          openingPart: part,
        })
      } else if (wall) {
        tagPickable(mesh, {
          kind: 'wall',
          wallId: wall.id,
          wallPart:
            path.role === 'plinthProfile'
              ? 'plinth'
              : path.role === 'trimBand'
                ? 'trimBand'
                : 'cornice',
          bandId: path.role === 'trimBand' ? path.bandId : undefined,
        })
      }
      mesh.userData.wallId = path.wallId

      this.profileGroup.add(mesh)
      this.profileMeshes.push(mesh)
    }
  }

  private rebuildInnerSills(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.innerSillMeshes) {
        this.profileGroup.remove(mesh)
        mesh.geometry.dispose()
      }
      this.innerSillMeshes.length = 0
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        const sill = opening.sillInner
        if (!sill?.enabled || !openingActsAsWindow(opening) || opening.y <= 0) continue
        if (basementWindowEnabled(opening)) continue
        const depth = Math.max(1, sill.depth ?? 16)
        const thickness = Math.max(0.5, sill.thickness ?? 4)
        const overhang = sill.overhang ?? 8
        const sillWidth = opening.width + overhang * 2
        const color = sill.color ?? '#ffffff'
        const geometry = new THREE.BoxGeometry(sillWidth, thickness, depth)
        const material = createTintedMaterial(
          this.profileMaterial,
          color,
          sill.finish ?? wall.profileFinish,
        )
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.originalMaterial = material

        const localX = opening.x + opening.width / 2 - wall.width / 2
        const localY = opening.y - thickness / 2 - wall.height / 2
        const inward = isStudioWall(wall) ? -windowDepthForwardSign(wall) : -1
        const innerFaceZ = isStudioWall(wall)
          ? ((wall.panelFlip ?? false) ? wall.depth : 0)
          : 0
        const localZ = innerFaceZ + inward * (depth / 2)

        if (isStudioWall(wall)) {
          const world = localToWorld(wall, localX, localY, localZ)
          mesh.position.set(world.x, world.y, world.z)
          mesh.rotation.y = studioWallTransform(wall).rotationY
        } else {
          mesh.position.set(
            wall.x + opening.x + opening.width / 2,
            wall.y + opening.y - thickness / 2,
            localZ,
          )
        }

        tagPickable(mesh, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'sillInner',
        })
        mesh.userData.wallId = wall.id
        this.profileGroup.add(mesh)
        this.innerSillMeshes.push(mesh)
      }
    }
  }

  private rebuildOuterSills(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.outerSillMeshes) {
        this.profileGroup.remove(mesh)
        mesh.geometry.dispose()
      }
      this.outerSillMeshes.length = 0
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        const sill = opening.sillOuter
        if (!sill?.enabled || !openingActsAsWindow(opening) || opening.y <= 0) continue
        if (basementWindowEnabled(opening)) continue
        const normalized = normalizeOpeningSillOuter(sill)
        if (outerSillUsesProfile(normalized)) continue
        const layout = resolveOuterSillLayout(opening, normalized)
        const depth = Math.max(1, layout.depth)
        const thickness = Math.max(0.5, layout.thickness)
        const width = Math.max(1, layout.width)
        const color = normalized.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR
        const geometry = new THREE.BoxGeometry(width, thickness, depth)
        const angleRad = ((layout.angleDeg ?? 0) * Math.PI) / 180
        const board = outerSillBoardPose(wall, depth)
        // Pivot an der Oberkante (bündig mit Öffnungs-Unterkante), Neigung senkt nur die Tropfkante.
        geometry.translate(0, -thickness / 2, board.translateZ)
        const material = createTintedMaterial(
          this.profileMaterial,
          color,
          normalized.finish ?? wall.profileFinish,
        )
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.originalMaterial = material

        const localX = layout.xLeft + width / 2 - wall.width / 2
        const localY = layout.yTop - wall.height / 2
        const localZ = board.localZ

        if (isStudioWall(wall)) {
          const world = localToWorld(wall, localX, localY, localZ)
          mesh.position.set(world.x, world.y, world.z)
          // Zuerst Wand-Yaw, danach lokale Neigung — sonst überschreibt Euler.y die X-Neigung.
          const wallYaw = studioWallTransform(wall).rotationY
          mesh.rotation.set(0, wallYaw, 0)
          if (angleRad > 1e-6) {
            mesh.rotateX(angleRad * board.tiltX)
          }
        } else {
          mesh.position.set(
            wall.x + layout.xLeft + width / 2,
            wall.y + layout.yTop,
            localZ,
          )
          if (angleRad > 1e-6) {
            mesh.rotation.x = angleRad * board.tiltX
          }
        }

        tagPickable(mesh, {
          kind: 'opening',
          wallId: wall.id,
          openingId: opening.id,
          openingPart: 'sillOuter',
        })
        mesh.userData.wallId = wall.id
        this.profileGroup.add(mesh)
        this.outerSillMeshes.push(mesh)
      }
    }
  }

  private rebuildPediments(buildingId?: string) {
    if (!buildingId) {
      for (const mesh of this.pedimentMeshes) {
        this.profileGroup.remove(mesh)
        mesh.geometry.dispose()
      }
      this.pedimentMeshes.length = 0
    }

    for (const wall of getVisibleWalls(this.state)) {
      if (buildingId && wall.buildingId !== buildingId) continue
      if (this.wallIsBare(wall)) continue
      for (const opening of wall.openings) {
        if (opening.hidden) continue
        if ((opening.type !== 'window' && opening.type !== 'door' && opening.type !== 'conch') || !opening.pediment?.enabled) continue
        if (opening.type === 'window' && basementWindowEnabled(opening)) continue
        const pediment = normalizeOpeningPediment(opening.pediment)
        const color = pediment.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR
        const material = createTintedMaterial(
          this.profileMaterial,
          color,
          pediment.finish ?? wall.profileFinish,
        )
        if (this.isPerfPresentation()) applyWorkModeSurfaceLook(material)
        const transform = wallPlacement(wall)

        const sweep = createPedimentSweepGeometry(wall, opening, pediment, {
          simpleBar: this.isPerfPresentation(),
        })
        if (sweep) {
          const mesh = new THREE.Mesh(sweep, material)
          mesh.castShadow = true
          mesh.receiveShadow = !this.isPerfPresentation()
          mesh.userData.originalMaterial = material
          tagPickable(mesh, {
            kind: 'opening',
            wallId: wall.id,
            openingId: opening.id,
            openingPart: 'pediment',
          })
          mesh.userData.wallId = wall.id
          if (isStudioWall(wall)) {
            mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
            mesh.rotation.y = transform.rotationY
          }
          this.profileGroup.add(mesh)
          this.pedimentMeshes.push(mesh)
        }

        for (const consoleGeo of createPedimentConsoleGeometries(wall, opening, pediment, {
          simpleBar: this.isPerfPresentation(),
        })) {
          const mesh = new THREE.Mesh(consoleGeo, material)
          mesh.castShadow = true
          mesh.receiveShadow = !this.isPerfPresentation()
          mesh.userData.originalMaterial = material
          tagPickable(mesh, {
            kind: 'opening',
            wallId: wall.id,
            openingId: opening.id,
            openingPart: 'pediment',
          })
          mesh.userData.wallId = wall.id
          if (isStudioWall(wall)) {
            mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
            mesh.rotation.y = transform.rotationY
          }
          this.profileGroup.add(mesh)
          this.pedimentMeshes.push(mesh)
        }
      }
    }
  }

  private applySelection() {
    const isLine = this.renderStyle === 'line'
    const wallPart = this.editor.selectedWallPart ?? 'group'
    const openingPart = this.editor.selectedOpeningPart ?? 'group'
    const highlightWalls =
      !this.suppressSelectionHighlight &&
      this.editor.selectedOpenings.length === 0 &&
      wallPart === 'group'

    for (const [id, mesh] of this.meshes) {
      if (isLine) {
        mesh.material = this.whiteMaterial
        continue
      }
      const base = this.wallBodyMaterial(id)
      mesh.material =
        highlightWalls && this.editor.selectedWallIds.includes(id) ? this.selectedMaterial : base
    }

    for (const mesh of [
      ...this.studioCladdingMeshes,
      ...this.wallLabelMeshes,
      ...this.claddingLodLowMeshes,
      ...this.claddingLodHighMeshes,
    ]) {
      if (isLine) {
        mesh.material = this.whiteMaterial
        continue
      }
      const wallId = mesh.userData.wallId as string | undefined
      const meshPart = mesh.userData.wallPart as string | undefined
      const base = (mesh.userData.originalMaterial as THREE.Material | undefined) ?? this.material
      const labelKeepTexture = meshPart === 'label' && wallPart !== 'label'
      const selected =
        !labelKeepTexture &&
        this.editor.selectedWallIds.includes(wallId ?? '') &&
        this.editor.selectedOpenings.length === 0 &&
        (wallPart === 'group' || wallPart === meshPart || (wallPart === 'cladding' && meshPart === 'cladding'))
      mesh.material = !this.suppressSelectionHighlight && selected ? this.selectedMaterial : base
    }

    for (const mesh of this.stairMeshes) {
      if (isLine) {
        mesh.material = this.whiteMaterial
        continue
      }
      const wallId = mesh.userData.wallId as string | undefined
      const openingId = mesh.userData.openingId as string | undefined
      const base = (mesh.userData.originalMaterial as THREE.Material | undefined) ?? this.material
      const selected =
        openingPart === 'stairs' &&
        this.editor.selectedOpenings.some(
          (ref) => ref.wallId === wallId && ref.openingId === openingId,
        )
      mesh.material = !this.suppressSelectionHighlight && selected ? this.selectedMaterial : base
    }

    for (const mesh of this.profileMeshes) {
      if (isLine) continue
      const wallId = mesh.userData.wallId as string | undefined
      const meshPart = mesh.userData.wallPart as string | undefined
      const bandId = mesh.userData.bandId as string | undefined
      const base = (mesh.userData.originalMaterial as THREE.Material | undefined) ?? this.profileMaterial
      if (
        !this.suppressSelectionHighlight &&
        wallPart === 'trimBand' &&
        meshPart === 'trimBand' &&
        this.editor.selectedWallIds.includes(wallId ?? '') &&
        this.editor.selectedOpenings.length === 0 &&
        this.editor.selectedTrimBandId &&
        bandId === this.editor.selectedTrimBandId
      ) {
        mesh.material = this.selectedMaterial
      } else if (mesh.material === this.selectedMaterial) {
        mesh.material = base
      }
    }

    while (this.selectionGroup.children.length > 0) {
      const child = this.selectionGroup.children[0]
      this.selectionGroup.remove(child)
      if ((child as THREE.LineSegments).geometry) (child as THREE.LineSegments).geometry.dispose()
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
    }

    if (this.suppressSelectionHighlight) return

    // In Zeichnung: nur schwarze Kontur, kein oranger Fill
    const overlayMat = isLine ? this.lineMaterial : this.selectionLineMaterial
    const fillMat = isLine
      ? null
      : new THREE.MeshBasicMaterial({
          color: 0xff6600,
          transparent: true,
          opacity: 0.35,
          depthTest: false,
          depthWrite: false,
        })

    const addOverlay = (
      wall: Wall,
      width: number,
      height: number,
      localX: number,
      localY: number,
      thickness: number,
    ) => {
      const boxGeo = new THREE.BoxGeometry(width, height, thickness)
      const edgesGeo = new THREE.EdgesGeometry(boxGeo)
      const lines = isLine
        ? this.createFatLineSegments(edgesGeo)
        : new THREE.LineSegments(edgesGeo, overlayMat)
      const outwardZ = isStudioWall(wall)
        ? studioFacadeSelectionLocalZ(wall, 4)
        : wall.depth + 4
      const world = localToWorld(wall, localX, localY, outwardZ)
      lines.position.set(world.x, world.y, world.z)
      if (isStudioWall(wall)) {
        lines.rotation.y = studioWallTransform(wall).rotationY
      }
      lines.renderOrder = 10
      this.selectionGroup.add(lines)
      if (fillMat) {
        const fill = new THREE.Mesh(boxGeo, fillMat)
        fill.position.copy(lines.position)
        fill.rotation.copy(lines.rotation)
        fill.renderOrder = 9
        this.selectionGroup.add(fill)
      } else {
        boxGeo.dispose()
      }
    }

    if (highlightWalls || (wallPart === 'cladding' && this.editor.selectedOpenings.length === 0)) {
      for (const wallId of this.editor.selectedWallIds) {
        const wall = findWall(this.state, wallId)
        if (!wall) continue
        addOverlay(wall, wall.width, wall.height, 0, 0, 3)
      }
    }

    for (const ref of this.editor.selectedOpenings) {
      if (this.openingDragOmitVisible(ref.wallId, ref.openingId)) continue
      const wall = findWall(this.state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (!wall || !opening) continue

      // Treppen: Orange auf Stufen-Meshes (oben), kein flaches Overlay in der Sockelzone
      if (openingPart === 'stairs' && opening.stairs?.enabled) {
        continue
      }

      const local = openingLocalCenter(wall, opening)
      addOverlay(wall, opening.width, opening.height, local.x, local.y, 4)
    }

    const selCeiling = this.editor.selectedCeiling
    if (selCeiling && !this.suppressSelectionHighlight) {
      for (const child of this.indoorFloorGroup.children) {
        const mesh = child as THREE.Mesh
        if (
          mesh.userData.buildingId !== selCeiling.buildingId ||
          mesh.userData.floorIndex !== selCeiling.floorIndex ||
          mesh.userData.indoorRole !== 'ceiling' ||
          !mesh.visible
        ) {
          continue
        }
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry)
        const lines = isLine
          ? this.createFatLineSegments(edgesGeo)
          : new THREE.LineSegments(edgesGeo, overlayMat)
        lines.position.copy(mesh.position)
        lines.rotation.copy(mesh.rotation)
        lines.scale.copy(mesh.scale)
        lines.renderOrder = 10
        this.selectionGroup.add(lines)
        if (fillMat) {
          const fill = new THREE.Mesh(mesh.geometry.clone(), fillMat)
          fill.position.copy(mesh.position)
          fill.rotation.copy(mesh.rotation)
          fill.scale.copy(mesh.scale)
          fill.renderOrder = 9
          this.selectionGroup.add(fill)
        } else {
          edgesGeo.dispose()
        }
      }
    }
  }
}

/** Legacy-Fassade für buildMansardRoof: pro Gebäude isoliert. */
function buildingRoofState(state: FacadeState, building: Building): FacadeState {
  return {
    ...state,
    buildings: [building],
    activeBuildingId: building.id,
    floors: building.floors,
    wallHeight: building.wallHeight,
    roof: building.roof,
    walls: building.walls,
  } as FacadeState
}

function wallPlacement(wall: Wall) {
  if (isStudioWall(wall)) return studioWallTransform(wall)
  return {
    position: { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: 0 },
    rotationY: 0,
  }
}

function openingLocalCenter(wall: Wall, opening: Opening) {
  return {
    x: opening.x + opening.width / 2 - wall.width / 2,
    y: opening.y + opening.height / 2 - wall.height / 2,
  }
}

/** Flache Öffnungsmaske in Wand-Lokalraum — kein Schatten, nur Overlay. */
function createOpeningDragGhostParts(
  wall: Wall,
  opening: Opening,
  localZ: number,
  fillMat: THREE.MeshBasicMaterial,
  lineMat: THREE.LineBasicMaterial,
): THREE.Object3D[] {
  const pts = isStudioWall(wall)
    ? openingDragGhostWallLocalPoints(wall, opening, localZ)
    : openingMaskPolyline(opening, 0, ARCH_MESH_SEGMENTS).map((p) => ({
        x: p.x - wall.width / 2,
        y: p.y - wall.height / 2,
      }))
  if (pts.length < 3) return []

  const shape = new THREE.Shape()
  shape.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i += 1) {
    shape.lineTo(pts[i]!.x, pts[i]!.y)
  }
  shape.closePath()

  const fillGeo = new THREE.ShapeGeometry(shape)
  const fill = new THREE.Mesh(fillGeo, fillMat)
  fill.position.z = localZ
  fill.renderOrder = 11
  fill.castShadow = false
  fill.receiveShadow = false
  fill.frustumCulled = false

  const linePositions: number[] = []
  for (const pt of pts) {
    linePositions.push(pt.x, pt.y, localZ)
  }
  linePositions.push(pts[0]!.x, pts[0]!.y, localZ)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
  const lines = new THREE.LineLoop(lineGeo, lineMat)
  lines.renderOrder = 12
  lines.castShadow = false
  lines.receiveShadow = false
  lines.frustumCulled = false

  return [fill, lines]
}

function localToWorld(wall: Wall, localX: number, localY: number, localZ: number) {
  const transform = wallPlacement(wall)
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  return {
    x: transform.position.x + localX * cos + localZ * sin,
    y: wall.y + wall.height / 2 + localY,
    z: transform.position.z - localX * sin + localZ * cos,
  }
}

function createWallGeometry(wall: Wall, walls: Wall[]): THREE.ExtrudeGeometry {
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const extraRight = edgeIsJoined(wall, 'right', walls) ? JOIN_OVERLAP : 0
  const extraTop = edgeIsJoined(wall, 'top', walls) ? JOIN_OVERLAP : 0
  const left = -halfW
  const right = halfW + extraRight
  const bottom = -halfH
  const top = halfH + extraTop

  const groundOpenings = wall.openings
    .filter((opening) => opening.y === 0 && openingCutsWall(opening) && !openingHasRoundMask(opening))
    .slice()
    .sort((a, b) => a.x - b.x)
  const elevatedOpenings = wall.openings.filter(
    (opening) => openingCutsWall(opening) && (opening.y > 0 || openingHasRoundMask(opening)),
  )

  const shape = new THREE.Shape()
  shape.moveTo(left, bottom)

  let cursorX = left
  for (const opening of groundOpenings) {
    const masonry = openingMasonryRect(opening)
    const openingLeft = -halfW + masonry.x
    const openingRight = openingLeft + masonry.width
    if (openingLeft > cursorX) {
      shape.lineTo(openingLeft, bottom)
    }
    const poly = openingMaskPolyline(opening)
    if (poly.length >= 3) {
      const notch = [poly[0], ...poly.slice(1).reverse()]
      for (const p of notch) {
        shape.lineTo(-halfW + p.x, -halfH + p.y)
      }
    }
    cursorX = openingRight
  }

  if (cursorX < right) {
    shape.lineTo(right, bottom)
  }
  shape.lineTo(right, top)
  shape.lineTo(left, top)
  shape.lineTo(left, bottom)

  for (const opening of elevatedOpenings) {
    const hole = openingHole(opening, halfW, halfH)
    if (hole) shape.holes.push(hole)
  }

  return new THREE.ExtrudeGeometry(shape, {
    depth: wall.depth,
    bevelEnabled: false,
    curveSegments: ARCH_MESH_SEGMENTS,
  })
}

function openingHole(opening: Opening, halfW: number, halfH: number): THREE.Path | null {
  if (!openingCutsWall(opening)) return null
  const pts = openingMaskPolyline(opening)
  if (pts.length < 3) return null
  const hole = new THREE.Path()
  const seq = [...pts].reverse()
  hole.moveTo(-halfW + seq[0].x, -halfH + seq[0].y)
  for (let i = 1; i < seq.length; i += 1) {
    hole.lineTo(-halfW + seq[i].x, -halfH + seq[i].y)
  }
  hole.lineTo(-halfW + seq[0].x, -halfH + seq[0].y)
  return hole
}

function tagPickable(
  object: THREE.Object3D,
  data: {
    kind: 'wall' | 'opening'
    wallId: string
    openingId?: string
    openingPart?: string
    wallPart?: string
    bandId?: string
  },
) {
  object.traverse((child) => {
    child.userData.kind = data.kind
    child.userData.wallId = data.wallId
    if (data.openingId) child.userData.openingId = data.openingId
    if (data.openingPart) child.userData.openingPart = data.openingPart
    if (data.wallPart) child.userData.wallPart = data.wallPart
    if (data.bandId) child.userData.bandId = data.bandId
  })
}
