import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  applyTemplateDraft,
  createOpeningTemplate,
  draftFromOpening,
  loadOpeningTemplates,
  saveOpeningTemplates,
  type OpeningTemplate,
  type OpeningTemplateDraft,
} from './utils/openingTemplates'
import {
  applyPanelStyleToWall,
  createStyleTemplate,
  draftFromWallStyle,
  loadStyleTemplates,
  saveStyleTemplates,
  type StyleTemplate,
} from './utils/styleTemplates'
import { ALL_EDGES, DEFAULT_WINDOW_DEPTH_OFFSET, GROUND_MARGIN, WALL_DEPTH, WALL_END_PIECE_PRESETS, WALL_LENGTH_PRESETS, WALL_WITH_OPENING_PRESETS, WALL_OPENING_PRESETS, WALL_HEIGHT, endPieceHandFromPresetId, type EndPieceHand, type WallOpeningPreset, type WallWithOpeningPreset} from './constants/presets'
import {
  setGlassSkyReflectionColor,
  setGlassGroundReflectionColor,
  bindMaterialsToGlassEnv,
  clearGlassEnvironmentBindings,
} from './utils/threeColors'
import {
  DEFAULT_GLASS_IOR,
  DEFAULT_GLASS_ROUGHNESS,
  DEFAULT_GLASS_THICKNESS_CM,
  DEFAULT_GLASS_TRANSMISSION,
} from './utils/glassConfig'
import {
  applySceneBackground,
  bakeSceneReflectionsIfNeeded,
  exteriorReflectionProbe,
  initRoomEnvironment,
  markSceneReflectionsDirty,
  reflectionViewBucket,
} from './studio/roomEnvironment'
import { BAY_WINDOW_PRESETS, buildBayWindowWalls, buildBayWindowAtPose, bayWindowGhostSegments, bayWallSelectionIds, type BayWindowPreset, bayPresetKind} from './studio/bayWindow'
import {
  DEFAULT_CEILING_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_GLASS_COLOR,
  DEFAULT_INTERIOR_COLOR,
  DEFAULT_JOINT_COLOR,
  DEFAULT_PROFILE_COLOR,
  DEFAULT_WALL_COLOR,
  TRANSPARENT_GLASS,
  defaultOpeningFrameColor,
  type ColorPalette,
} from './constants/colorPalettes'
import { applyWallModule, BLENDER_WALL_MODULES } from './blender/wallModules'
import { BLENDER_WINDOW_MODELS } from './blender/windowModels'
import { FacadeController } from './FacadeController'
import { FacadeSvgView } from './FacadeSvgView'
import { isFrameProfile, isWindowTrimProfile, WINDOW_TRIM_PROFILE_IDS, PEDIMENT_PROFILE_IDS, PEDIMENT_CONSOLE_IDS, FRAME_PROFILE_IDS, SILL_OUTER_PROFILE_IDS, CORNICE_PROFILE_IDS, PLINTH_PROFILE_IDS, DEFAULT_PLINTH_PROFILE_ID } from './profiles/windowTrim'
import { PROFILE_LIST, allProfiles, canonicalProfileId, resolveProfile } from './profiles/registry'
import type { ProfileDefinition } from './profiles/types'
import {
  createDefaultEditorState,
  createDefaultFacadeState,
  cloneFacadeState,
  cloneWall,
  emptyNeighbors,
} from './types/facade'
import type {
  Building,
  EditorState,
  EndBossJoin,
  EndBossPattern,
  FacadeState,
  GruenderzeitPresetId,
  GruenderzeitTransomBars,
  GruenderzeitWindowConfig,
  OpeningEdge,
  OpeningMotion,
  MotionCurve,
  OpeningPart,
  OpeningRef,
  OpeningTrimConfig,
  Opening,
  ProfileAssignment,
  StudioCornerJoin,
  StudioPanelPattern,
  StudioYawDeg,
  Wall,
  WallCorniceConfig,
  WallLabelConfig,
  WallLabelDepth,
  WallGroup,
  WallSide,
  PedimentForm,
  SceneLight,
} from './types/facade'
import {
  addOpening,
  assessOpeningInsert,
  assignProfilesToOpenings,
  createOpening,
  defaultOuterSillDepth,
  clampOuterSillDepth,
  duplicateOpenings,
  insertOpeningReplacingOverlaps,
  moveOpening,
  openingProfileEdges,
  removeOpening,
  removeProfilesFromOpenings,
  centeredOpeningX,
  replaceOpeningsWithPreset,
  normalizeOpeningSillOuter,
  outerSillUsesProfile,
  updateOpening,
  updateOpeningFrameColors,
  updateOpeningRevealColors,
  updateOpeningFrameFinishes,
  updateOpeningGlassColors,
  updateOpeningGlassSettings,
  updateOpeningGruenderzeit,
  updateOpeningMotion,
  updateOpeningSills,
  updateOpeningStairs,
  updateOpeningRollerShutter,
  updateOpeningPediment,
  updateOpeningTaperedField,
  updateOpeningTrim,
  resetOpenings,
  updateWindowFrameColorsForWalls,
  updateWindowGlassColorsForWalls,
} from './utils/openings'
import {
  DEFAULT_NICHE_DEPTH_CM,
  DEFAULT_PANEL_CLEARANCE_CM,
  DEFAULT_PANEL_CLEARANCE_DEPTH_CM,
  PANEL_CLEARANCE_DEPTH_MAX,
  PANEL_CLEARANCE_DEPTH_MIN,
  DEFAULT_REVEAL_EMBED_CM,
  DEFAULT_REVEAL_INSET_CM,
  archJambClearHeight,
  archJambCountAuto,
  archRingThickness,
  archVoussoirCount,
  archVoussoirSvg,
  buildSemicircularArchSpec,
  clampJambCount,
  normalizeOpeningArch,
  normalizeOpeningFill,
  normalizePanelClearance,
  normalizeRevealFrame,
  openingArchGeom,
  openingArchHybridMasonryEnabled,
  openingArchVoussoirsEnabled,
  archHybridCourseYs,
  openingContainsPoint,
  openingGlazingArchForm,
  openingIsConch,
  openingLacksWindowChrome,
  openingActsAsWindow,
} from './utils/openingGeometry'
import {
  ARCH_FORM_IDS,
  ARCH_RISE_STEP_CM,
  type ArchFormId,
  archFormLabel,
  archFormPreviewSvg,
  defaultArchRise,
  maxArchRiseForOpening,
  resolveArchRiseForOpening,
  snapArchRiseCm,
} from './utils/archForms'
import { scaleProfileSectionAxes, transformProfileSection, transformProfileSectionAnchored } from './utils/profilePaths'
import {
  clampCorniceScale,
  normalizeWallCornice,
  updateWallCornice,
  wallCornice,
} from './utils/cornice'
import {
  addWallTrimBand,
  duplicateWallTrimBand,
  patchWallTrimBand,
  removeWallTrimBand,
  TRIM_BAND_DUPLICATE_OFFSET,
  wallTrimBands,
} from './utils/trimBands'
import {
  DEFAULT_WALL_LABEL,
  defaultWallLabelAnchor,
  facadeStateDiffersOnlyByWallLabels,
  syncWallDecorToTopBareBand,
  updateWallLabel,
  wallHasLabel,
  wallLabel,
} from './utils/wallLabel'
import {
  DEFAULT_SCENE_APPEARANCE,
  loadPersistedState,
  normalizeSceneAppearance,
  savePersistedState,
  type AppView,
  type SceneAppearance,
} from './utils/persistence'
import {
  GALLERY_CAM_MAX_DISTANCE,
  GALLERY_CAM_MIN_DISTANCE,
  GALLERY_WALL_CULL_DISTANCE,
  GALLERY_WALL_CULL_HYSTERESIS,
  galleryCameraDepthRange,
  galleryEntryFocusWalls,
  galleryFocusBounds,
  galleryZoomSpeedForDistance,
} from './gallery/galleryCamera'
import {
  initGalleryUi,
  isGalleryModeActive,
  type GalleryModeHost,
} from './ui/galleryMode'
import {
  EXPORT_JPG_QUALITY,
  buildExportFilename,
  composeExportGrid,
  createDefaultExportState,
  downloadCanvasBlob,
  exportFrameAspectRatio,
  exportFramePixelSize,
  exportSlotLabel,
  syncExportSlotsWithYaws,
  type ExportAspectId,
  type ExportModeUiState,
  type ExportOrientation,
  type ExportViewKind,
} from './ui/exportMode'
import { initOpeningMotionEditor } from './ui/openingMotionEditor'
import { evalMotionCurve, openingMotionFromOpening } from './utils/openingMotion'
import {
  buildSharePayload,
  copyFacadeLink,
  decodeFacadeHash,
  downloadFacadeJson,
  loadFacadeFromFile,
  readFacadeFromLocationHash,
  scheduleFacadeHashWrite,
} from './utils/share'
import { facadeHasNeedsReview } from './utils/schemaMigrations'
import {
  buildLayerOrder,
  floorIndex,
  floorLabel,
  layerIndexForWall,
  type LayerItem,
} from './utils/layers'
import { matchingCladdings, resolveCladding } from './meshes/catalog'
import { validateOpeningPlacement } from './utils/validation'
import { EditHistory, type HistorySnapshot } from './utils/history'
import {
  addAdjacentWall,
  clampFacadeState,
  duplicateStorey,
  duplicateWalls,
  finalizeWallLayout,
  getWall,
  getWallBounds,
  insertStoreyAbove,
  moveWalls,
  pasteWallsRelativeToTarget,
  removeStorey,
  removeWall,
  type StoreyCopyOptions,
  STOREY_COPY_PLAN_ONLY,
  DEFAULT_STOREY_COPY,
  resizeStoreyHeight,
  updateWallCladding,
  updateWallColors,
  updateCeilingColorForWalls,
  updateWallFinishes,
} from './utils/walls'
import {
  addBuildingBeside,
  buildingShowsBareWalls,
  duplicateBuilding,
  findBuildingForWall,
  getActiveBuilding,
  getAllWalls,
  insertBuildingClone,
  mapAllWalls,
  offsetBuildingByGrid,
  planGridBoundsForBuilding,
  removeBuilding,
  setActiveBuildingId,
  updateActiveBuilding,
  updateBuilding,
} from './utils/buildings'
import { createId } from './utils/id'
import {
  canEditActiveBuilding,
  canEditWall,
  floorPlanSpanMeta,
  groupWallsByFloorForBuilding,
  layerHiddenClass,
  layerOpeningWidthMeta,
  layerWidthMeta,
  sortedFloorIndicesForBuilding,
  visibilityMenuLabel,
} from './ui/layerListHelpers'
import {
  collectBuildingGuides,
  collectPlanDrawGuides,
  snapBuildingOffset,
} from './studio/buildingGuides'
import {
  boundsFromSegments,
  clearPlacementGrid,
  showFloorPlacementGrid,
  showFloorResizeGrid,
  showWallFacePlacementGrid,
} from './studio/placementGrid'
import { computeWallMoveGuides } from './studio/wallGuides'
import {
  applyDirectionalSun,
  applyYawAroundYToBox,
  buildingWorldBox,
  DEFAULT_SUN_SETTINGS,
  fitDirectionalShadowCamera,
  formatTimeOfDay,
  normalizeSunSettings,
  resolveAnimTimeRange,
  resolveSunFromDate,
  SHADOW_BIAS,
  SHADOW_NORMAL_BIAS_MIN,
  SHADOW_GROUND_MAX_LENGTH,
  SHADOW_LAYER_EXTERIOR,
  SHADOW_LAYER_INTERIOR,
  BLOOM_LAYER,
  SHADOW_MAP_SIZE,
  SHADOW_MAP_SIZE_INDOOR,
  shadowMapSizeForSiteSpan,
  sunDistanceForBox,
  sunTargetFromBox,
  syncSunSettingsFromSolar,
  type SunSettings,
} from './utils/sunLighting'
import { dateInputValue, parseDateInput, parseTimeInput, timeInputValue, todayMonthDay } from './utils/solar'
import { createStudioWall, isStudioWall, stretchStudioFacade, studioWallTransform, studioWallsCollideIdentical, updateStudioPanel, wallAlongDelta, duplicateStudioWallAtGrid, rotateStudioWallAroundCenter, wallEndIsFree, buildEndPieceReturnWall, buildStandaloneEndPieceWalls, buildStudioWallAt, endPieceArmsCollide, endPieceGhostSegments, endPieceSideForHand, END_PIECE_DEFAULT_ANGLE_DEG, findAdjacentWall, findCollinearDockWall, isWallPlanLinked, linkStudioWalls, mergeCollinearDockedWalls, selectionLockedToUnselected, unlinkStudioWallsFromUnselected, unselectedLinkedNeighbors,   unselectedTouchingWalls,
  expandPlanLinkedWallIds,
  expandWallMoveIds,
  adjustDockOrientation,
  inheritFrontsFromNeighbors,
  finalizeWallFrontOrientation,
  alignOpeningElementsToWallFront,
  wallStartPoint,
  wallEndPoint,
  wallHasPanels,
  viewerSideToAlongSign,
  studioFacadeOutwardDepth,
  alongWidthDeltaFromMove,
  snapBranchYawDeg,
  attachAngledWallFromEnd,
  attachAngledWallFromEndForVerticalStack,
  findVerticalAlignedWalls,
  branchClosesAgainstWalls,
  wallsShareEndpoint,
  offsetStudioWallsAlongFront,
  unselectedLinkedDiagonalWalls,
  frontMoveStepCm,
  expandCollinearPlanLinkedIds,
  updateTwoHorizontalCladdingBands,
} from './studio/walls'
import {
  defaultUpperBandWidth,
  isTwoHorizontalBandCladding,
  readTwoHorizontalBandOptions,
  clampCladdingSplitY,
} from './studio/facadeLayers'
import {
  applyWallPresetToSegment,
  inferWallSegmentLayout,
  wallPresetLengthCm as segmentPresetLengthCm,
  wallSegmentIndexAt,
} from './studio/wallSegments'
import {
  finalizeStudioGeometry,
  applyGlobalWallDepth,
  movePlanCornerInState,
  movePlanEdgeInState,
  previewPlanEdgeMove,
  previewPlanNodeMove,
  wallIdForPlanEdge,
} from './studio/planGeometry'
import {
  DEFAULT_EDIT_SCOPE,
  availableFacadeYaws,
  editArchOpeningTargets,
  editOpeningTargets,
  editWallTargets,
  normalizeFacadeYawFilter,
  type EditScope,
} from './studio/editScope'
import { clonePatternPreviewSvg } from './studio/patternPreview'
import { snapToGrid } from './utils/grid'
import { openingPreviewSvg, openingSizePreviewSvg } from './studio/openingPreview'
import {
  appendGruenderzeitSvg,
  axisWeights,
  clampGruenderzeitForBasement,
  detectWindowPreset,
  defaultGruenderzeitConfig,
  gruenderzeitConfigForOpening,
  isBinaryRatio,
  isPanelRatio,
  isSplitCount,
  layoutGruenderzeitWindow,
  paneCountForSplit,
  TIMBER,
  WINDOW_STYLE_PRESETS,
  resolveTimber,
} from './windows/gruenderzeit'
import {
  normalizeOpeningDoor,
  normalizeOpeningGuard,
  normalizeOpeningInteriorShade,
} from './windows/openingExtras'
import { facadeOutward, facadeSunIsGrazing, wallsForYaw, type ElevationFilter } from './studio/elevation'
import { lerpYawDeg, normalizeYawDeg, snapYawTo10, snapYawTo45, solarAzimuthToWallYaw, viewedFacadeYaw, wallCompassLabel, wallDockAxisFromFacadeYaw, yawFromCompassSvgPoint } from './studio/compass'
import { computeOpeningGuidesForRefs, computeOpeningDistanceLinesForRefs } from './studio/openingGuides'
import { panelCourseCount, visiblePanelRowRange } from './studio/panelLayout'
import {
  DEFAULT_STUDIO_PANEL,
  PLAN_GRID,
  STUDIO_DEFAULT_HEIGHT,
  STUDIO_MIN_SIZE,
  STUDIO_MASONRY,
  STUDIO_PANEL_SOFT_MAX,
  STUDIO_PANEL_MIN,
  STUDIO_PANEL_STEP,
  STUDIO_TILE,
  STUDIO_WALL_HEIGHT_STEP,
  WALL_RESIZE_FLOOR_STEP,
  snapWallWidthCm,
  snapWallWidthDelta,
  wallWidthStepCm,
  clampPlinthDepth,
  clampPlinthHeight,
  clampPlinthOffsetForward,
  clampHideRows,
  clampStudioPanelSize,
  MASONRY_KIND_PATTERNS,
  PANEL_KIND_PATTERNS,
  PATTERN_LABELS,
} from './studio/constants'
import {
  facadeHasRoofablePlan,
  normalizeRoof,
  type RoofConfig,
} from './studio/roof'
import { buildingCentroid, canRotateBuildingGeometry, canRotateStudioBuilding, rotateBuildingByDeg, rotateStudioBuilding } from './studio/rotateBuilding'
import { defaultOpeningStairs, normalizeOpeningStairs, snapStairMeasure, syncStairsToDoorWidth } from './studio/stairs'
import { normalizeOpeningPediment, pedimentFormIsClosed } from './studio/pediment'
import { normalizeOpeningTaperedField } from './studio/taperedField'
import {
  normalizeOpeningRollerShutter,
  openingSupportsRollerShutter,
  rollerShutterMotionPreset,
  DEFAULT_ROLLER_COLOR,
} from './studio/rollerShutter'
import { openingTopProfileLiftCm } from './studio/openingProfileLift'
import { preloadWallLabelFlatFont, retryWallLabelExtrudedFont } from './studio/labelGeometry'
import { LABEL_FONTS, injectLabelFontFaces, resolveLabelFontId } from './studio/labelFonts'
import {
  profileSectionNativeExtents,
  trimSectionScales,
} from './utils/profileSectionExtents'
import {
  addPlanNode,
  createEmptyFloorPlan,
  drawPlanLine,
  exampleRectFloorPlan,
  formatPlanLengthCm,
  type FloorPlan,
  planSegmentOverlaps,
  isValidPlanLine,
  planHasClosedRing,
  planLineLengthCm,
  planNodeWorld,
  removePlanEdge,
  removePlanNode,
  snapPlanGridToNearestNode,
  syncFloorPlansFromWalls,
  wallYawDegFromSegment,
  wallsFromFloorPlan,
  wouldCloseFloorPlan,
} from './studio/floorPlan'
import { FloorPlanView, syncPlanCamera, PLAN_VIEW_SIZE } from './studio/floorPlanView'
import {
  buildingDepthOffsetFromFacadeDepthCm,
  buildingFacadeDepthCm,
  depthOffsetFromFacadeDepthCm,
  openingFacadeDepthCm,
  openingUsesCustomDepth,
} from './utils/openingDepth'
import {
  DBLCLICK_ZOOM_DURATION_MS,
  DBLCLICK_ZOOM_FACTOR,
  easeOutCubic,
  lerpNumber,
  normalizedWheelDeltaY,
  wheelZoomFactorFromDelta,
  zoomPanOffsetsAtCursor,
} from './utils/viewZoom'
import { facadeShadeParamsFromSun, setFacadeShadeParams } from './utils/facadeShade'
import { resolveLightingMood } from './utils/lightingMood'
import {
  applyGroundMoodShader,
  setGroundShadowHard,
  updateGroundMoodUniformValues,
} from './lighting/groundMood'
import { AtmosphereSky, SKY_DISPLAY_EXPOSURE_BLOOM, SKY_DISPLAY_EXPOSURE_PLAIN } from './lighting/atmosphereSky'
import {
  disablePcssShadows,
  enablePcssShadows,
  invalidateShadowMaterials,
  shadowFrustumWidthCm,
  updatePcssShadowParameters,
} from './lighting/pcssShadows'
import {
  prepareCelestialShadowBox,
  resolveCelestialState,
  skyPaletteFromCelestial,
} from './utils/celestialSky'
import {
  DEFAULT_BLOOM_SETTINGS,
  bloomToneMappingExposure,
  normalizeBloomSettings,
  type BloomSettings,
} from './lighting/bloom'
import {
  loadPresentationMode,
  savePresentationMode,
  presentationUsesWorkLikeShading,
  type PresentationMode,
} from './lighting/editPresentation'
import { SelectiveBloomPipeline } from './lighting/selectiveBloom'
import { SceneLightRuntime } from './lighting/sceneLightRuntime'
import { normalizePowerWatts } from './lighting/sceneLightUnits'
import {
  addSceneLight,
  duplicateSceneLight,
  kelvinToHex,
  normalizeSceneLights,
  removeSceneLight,
  sceneLightById,
  updateSceneLight,
} from './scene/sceneLights'
import {
  DEFAULT_FOG_SETTINGS,
  normalizeFogSettings,
  type FogSettings,
} from './lighting/fog'
import {
  applyLodPreset,
  DEFAULT_LOD_SETTINGS,
  normalizeLodSettings,
  type LodSettings,
} from './lighting/lodSettings'
import { closeContextMenu, showContextMenu, type MenuItem } from './ui/contextMenu'
import { installFieldInfo } from './ui/fieldInfo'
import { initReleaseNotesUi } from './ui/releaseNotes'
import { initCreditsUi } from './ui/creditsDialog'
import {
  isPerfOverlayEnabled,
  markPerfFrameEnd,
  markPerfFrameStart,
  setPerfOverlayEnabled,
} from './ui/perfOverlay'
import { buildingIdsNeedingRebuild } from './utils/performanceLod'

const GROUND_BASE_SIZE = 2000

const canvas = document.querySelector<HTMLCanvasElement>('#three-canvas')!
const svgContainer = document.querySelector<HTMLDivElement>('#svg-view')!
const viewport = document.querySelector<HTMLDivElement>('#viewport')!
const viewportStage = document.querySelector<HTMLDivElement>('#viewport-stage')!

function viewportRenderWidth(): number {
  return Math.max(1, viewportStage.clientWidth)
}

function viewportRenderHeight(): number {
  return Math.max(1, viewportStage.clientHeight)
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
})
const MAX_PIXEL_RATIO = 1.5
/** Nach letztem Zoom/Orbit: Lite halten (Mausrad feuert start+end im selben Tick). */
const ORBIT_LITE_HOLD_MS = 320

let viewportDirty = true
/** Erst true nach Atmosphäre + erstem Mesh-Load — bis dahin kein Dirty-Skip in animate(). */
let sceneLightingReady = false
/** Erstes Shadow-Map-Bake nach Atmosphäre + Fenster-Meshes — bis dahin nur Licht ohne Bake. */
let startupShadowReady = false
let orbitLite = false
let orbitLiteTimer: ReturnType<typeof setTimeout> | null = null
/** true zwischen OrbitControls start und end (Mausrad: beides im selben Tick). */
let orbitLitePointer = false

function applyRendererPixelRatio() {
  const cap = orbitLite ? 1 : MAX_PIXEL_RATIO
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
  // Composer erst nach Init vorhanden; danach Ratio immer mitsynchronisieren (sonst Bloom-Pfad weich/pixelig).
  syncComposerPixelRatio?.()
}

/** Wird nach EffectComposer-Erzeugung gesetzt. */
let syncComposerPixelRatio: (() => void) | null = null

applyRendererPixelRatio()
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.BasicShadowMap
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true
enablePcssShadows()
renderer.toneMapping = THREE.NoToneMapping
renderer.toneMappingExposure = 1
const scene = new THREE.Scene()
scene.background = new THREE.Color(DEFAULT_SCENE_APPEARANCE.background)
initRoomEnvironment(renderer, scene)

const sitePivot = new THREE.Group()
sitePivot.name = 'sitePivot'
const siteOffset = new THREE.Group()
siteOffset.name = 'siteOffset'
sitePivot.add(siteOffset)
scene.add(sitePivot)
const _frontPanRight = new THREE.Vector3()
const _frontPanUp = new THREE.Vector3()
const _frontPanForward = new THREE.Vector3()
const _sceneLightWorld = new THREE.Vector3()
const atmosphereSky = new AtmosphereSky()
scene.add(atmosphereSky.root)
atmosphereSky.attachLights(scene)
const dirLight = atmosphereSky.sunLight
dirLight.castShadow = true
dirLight.layers.set(SHADOW_LAYER_EXTERIOR)
dirLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
dirLight.shadow.camera.near = 1
dirLight.shadow.camera.far = 2000
dirLight.shadow.camera.left = -600
dirLight.shadow.camera.right = 600
dirLight.shadow.camera.top = 600
dirLight.shadow.camera.bottom = -600
dirLight.shadow.bias = SHADOW_BIAS
dirLight.shadow.normalBias = 0.28
dirLight.shadow.camera.layers.set(SHADOW_LAYER_EXTERIOR)
dirLight.target.position.set(192, 224, 0)
let lastCelestialState = resolveCelestialState({ ...DEFAULT_SUN_SETTINGS })

const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000)
camera.position.set(400, 250, 500)
camera.layers.enable(SHADOW_LAYER_EXTERIOR)
camera.layers.enable(SHADOW_LAYER_INTERIOR)
camera.layers.enable(BLOOM_LAYER)

const frontCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000)
frontCamera.layers.enable(SHADOW_LAYER_EXTERIOR)
frontCamera.layers.enable(SHADOW_LAYER_INTERIOR)
frontCamera.layers.enable(BLOOM_LAYER)
const topCamera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 200)
topCamera.layers.enable(SHADOW_LAYER_EXTERIOR)
topCamera.layers.enable(SHADOW_LAYER_INTERIOR)
topCamera.layers.enable(BLOOM_LAYER)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = false
controls.rotateSpeed = 1.35
controls.minDistance = 60
controls.maxDistance = 4000
/** Volle Kugel — auch unter den Boden (kein künstliches Polar-Limit). */
controls.minPolarAngle = 0
controls.maxPolarAngle = Math.PI
controls.target.set(192, 224, 0)
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
/** ⌘/Ctrl kann auf macOS beim Pointerdown fehlen — keydown/keyup als Fallback. */
let modKeyHeld = false
/** Numpad-/Zifferntaste 1–9 gehalten → Nudge-Schritt = 8·n cm (sonst 8). */
let nudgeMultiplierHeld = 1

function heldNudgeStepCm(): number {
  return STUDIO_MASONRY * Math.max(1, Math.min(9, nudgeMultiplierHeld))
}

function nudgeMultiplierFromKey(key: string, code: string): number | null {
  if (code.startsWith('Numpad') && code.length === 7) {
    const n = Number(code.slice(6))
    if (n >= 1 && n <= 9) return n
  }
  if (code.startsWith('Digit') && code.length === 6) {
    const n = Number(code.slice(5))
    if (n >= 1 && n <= 9) return n
  }
  // Fallback: event.key bei Numpad oft die Ziffer selbst
  if (key.length === 1 && key >= '1' && key <= '9') return Number(key)
  return null
}

function markViewportDirty() {
  viewportDirty = true
}

function clearOrbitLiteTimer() {
  if (orbitLiteTimer !== null) {
    clearTimeout(orbitLiteTimer)
    orbitLiteTimer = null
  }
}

function setOrbitLite(active: boolean) {
  if (active) {
    clearOrbitLiteTimer()
    if (!orbitLite) {
      orbitLite = true
      applyRendererPixelRatio()
    }
    markViewportDirty()
    return
  }
  clearOrbitLiteTimer()
  if (!orbitLite) return
  orbitLite = false
  applyRendererPixelRatio()
  markSceneReflectionsDirty()
  if (currentView === 'top') {
    updateGroundPlane()
    floorPlanView.syncGridToCamera(topCamera)
  }
  updateWallLibraryGizmos()
  markViewportDirty()
}

function scheduleOrbitLiteEnd() {
  if (nav3d) return
  clearOrbitLiteTimer()
  orbitLiteTimer = setTimeout(() => {
    orbitLiteTimer = null
    if (nav3d) return
    setOrbitLite(false)
  }, ORBIT_LITE_HOLD_MS)
}

type Nav3dState = {
  mode: 'rotate' | 'pan'
  pointerId: number
  lastX: number
  lastY: number
  moved: boolean
}
let nav3d: Nav3dState | null = null

function isTypingInInput(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
}

function rotateCameraByPixels(dx: number, dy: number) {
  setOrbitLite(true)
  const height = Math.max(1, viewportRenderHeight())
  const scale = (2 * Math.PI * controls.rotateSpeed) / height
  controls.rotateLeft(scale * dx)
  controls.rotateUp(scale * dy)
  markViewportDirty()
  updateWallLibraryGizmos()
}

function rotateTopViewByPixels(dx: number) {
  const height = Math.max(1, viewportRenderHeight())
  const degPerPx = (360 * (controls.rotateSpeed ?? 1)) / height
  topViewYawDeg = (topViewYawDeg + degPerPx * dx + 360) % 360
  syncTopCamera2()
  updateViewCompass()
  markViewportDirty()
  updateWallLibraryGizmos()
}

function beginNav3d(event: PointerEvent) {
  nav3d = {
    mode: event.shiftKey ? 'pan' : 'rotate',
    pointerId: event.pointerId,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  }
  controls.enabled = false
  setOrbitLite(true)
  try {
    canvas.setPointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}

function moveNav3d(event: PointerEvent): boolean {
  if (!nav3d || event.pointerId !== nav3d.pointerId) return false
  const dx = event.clientX - nav3d.lastX
  const dy = event.clientY - nav3d.lastY
  if (dx !== 0 || dy !== 0) nav3d.moved = true
  if (nav3d.mode === 'pan') {
    const panMul = controls.keyPanSpeed ?? 7
    if (currentView === 'top') {
      panPlanByPixels(dx * panMul, dy * panMul)
    } else {
      controls.pan(dx * panMul, dy * panMul)
      markViewportDirty()
      updateWallLibraryGizmos()
    }
  } else if (currentView === 'top') {
    rotateTopViewByPixels(dx)
  } else {
    rotateCameraByPixels(dx, dy)
  }
  nav3d.lastX = event.clientX
  nav3d.lastY = event.clientY
  return true
}

function endNav3d(event?: PointerEvent): 'drag' | 'click' | false {
  if (!nav3d) return false
  const moved = nav3d.moved
  const pointerId = event?.pointerId ?? nav3d.pointerId
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId)
  }
  nav3d = null
  if (currentView === '3d') controls.enabled = true
  scheduleOrbitLiteEnd()
  return moved ? 'drag' : 'click'
}

function handleNav3dClick(event: PointerEvent) {
  const hit = pickFromEvent(event)
  if (!hit) {
    selectWall(null, true)
    return
  }
  if (hit.openingId && hit.wallId) {
    selectOpening(hit.wallId, hit.openingId, true, hit.openingPart)
    return
  }
  if (hit.wallId) {
    selectWall(hit.wallId, true)
  }
}

function handle3dCameraArrowKeys(event: KeyboardEvent): boolean {
  if (currentView !== '3d' && currentView !== 'top' && currentView !== 'front') return false
  if (isTypingInInput()) return false
  const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if (!arrows.includes(event.key)) return false

  const mod = event.metaKey || event.ctrlKey
  if (!mod && !event.shiftKey && editor.selectedOpenings.length > 0) return false

  event.preventDefault()
  event.stopImmediatePropagation()

  const h = Math.max(1, viewportRenderHeight())
  const rotStep = (2 * Math.PI * (controls.keyRotateSpeed ?? 1)) / h
  const panStep = controls.keyPanSpeed ?? 7

  if (mod && !event.shiftKey) {
    if (currentView === 'top') {
      if (event.key === 'ArrowLeft') rotateTopViewByPixels(-h * 0.35)
      else if (event.key === 'ArrowRight') rotateTopViewByPixels(h * 0.35)
      else return true
    } else if (currentView === '3d') {
      if (event.key === 'ArrowLeft') controls.rotateLeft(rotStep)
      else if (event.key === 'ArrowRight') controls.rotateLeft(-rotStep)
      else if (event.key === 'ArrowUp') controls.rotateUp(rotStep)
      else if (event.key === 'ArrowDown') controls.rotateUp(-rotStep)
    }
  } else if (currentView === 'top') {
    if (event.key === 'ArrowLeft') panPlanByPixels(panStep, 0)
    else if (event.key === 'ArrowRight') panPlanByPixels(-panStep, 0)
    else if (event.key === 'ArrowUp') panPlanByPixels(0, panStep)
    else if (event.key === 'ArrowDown') panPlanByPixels(0, -panStep)
  } else if (currentView === 'front') {
    if (event.key === 'ArrowLeft') panFrontByPixels(panStep, 0)
    else if (event.key === 'ArrowRight') panFrontByPixels(-panStep, 0)
    else if (event.key === 'ArrowUp') panFrontByPixels(0, panStep)
    else if (event.key === 'ArrowDown') panFrontByPixels(0, -panStep)
  } else {
    if (event.key === 'ArrowLeft') controls.pan(panStep, 0)
    else if (event.key === 'ArrowRight') controls.pan(-panStep, 0)
    else if (event.key === 'ArrowUp') controls.pan(0, panStep)
    else if (event.key === 'ArrowDown') controls.pan(0, -panStep)
  }
  setOrbitLite(true)
  scheduleOrbitLiteEnd()
  markViewportDirty()
  updateWallLibraryGizmos()
  return true
}

const GROUND_Y = -0.5
let groundGeo = new THREE.PlaneGeometry(GROUND_BASE_SIZE, GROUND_BASE_SIZE)
const groundMat = new THREE.MeshStandardMaterial({
  name: 'studioGround',
  color: new THREE.Color(DEFAULT_SCENE_APPEARANCE.ground),
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
})
applyGroundMoodShader(groundMat)
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.name = 'studioGround'
ground.rotation.x = -Math.PI / 2
ground.position.y = GROUND_Y
ground.receiveShadow = true
ground.castShadow = false
ground.layers.set(SHADOW_LAYER_EXTERIOR)
siteOffset.add(ground)

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.32)
hemiLight.position.set(0, 500, 0)
hemiLight.layers.enable(SHADOW_LAYER_EXTERIOR)
hemiLight.layers.enable(SHADOW_LAYER_INTERIOR)
scene.add(hemiLight)

const bounceDirLight = new THREE.DirectionalLight(0xffffff, 0.2)
bounceDirLight.castShadow = false
bounceDirLight.layers.enable(SHADOW_LAYER_EXTERIOR)
bounceDirLight.layers.enable(SHADOW_LAYER_INTERIOR)
scene.add(bounceDirLight)
bounceDirLight.target.position.set(192, 224, 0)
scene.add(bounceDirLight.target)

/** Zweite Sonne nur für Innenböden/Decken (Layer 1), damit Etagenplatten den Außenboden nicht als Prisma verdunkeln. */
const dirLightIndoor = new THREE.DirectionalLight(0xffffff, 1.5)
dirLightIndoor.castShadow = true
dirLightIndoor.layers.set(SHADOW_LAYER_INTERIOR)
dirLightIndoor.shadow.mapSize.set(SHADOW_MAP_SIZE_INDOOR, SHADOW_MAP_SIZE_INDOOR)
dirLightIndoor.shadow.camera.near = 1
dirLightIndoor.shadow.camera.far = 2000
dirLightIndoor.shadow.camera.left = -600
dirLightIndoor.shadow.camera.right = 600
dirLightIndoor.shadow.camera.top = 600
dirLightIndoor.shadow.camera.bottom = -600
dirLightIndoor.shadow.bias = SHADOW_BIAS
dirLightIndoor.shadow.normalBias = 0.28
// Indoor-Shadow-Camera sieht Hülle + Platten (WebGLShadowMap filtert primär über die Render-Kamera).
dirLightIndoor.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)
dirLightIndoor.shadow.camera.layers.enable(SHADOW_LAYER_INTERIOR)
scene.add(dirLightIndoor)
dirLightIndoor.target.position.set(192, 224, 0)
scene.add(dirLightIndoor.target)

const sceneLightRuntime = new SceneLightRuntime()
siteOffset.add(sceneLightRuntime.root)

/** Canvas-MSAA gilt nicht für EffectComposer-RTs — ohne Samples wirken Bloom-Kanten pixelig. */
const BLOOM_MSAA_SAMPLES = Math.min(8, renderer.capabilities.maxSamples)
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: BLOOM_MSAA_SAMPLES,
  }),
)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)
const selectiveBloom = new SelectiveBloomPipeline(
  renderer,
  scene,
  camera,
  new THREE.Vector2(1, 1),
  DEFAULT_BLOOM_SETTINGS.strength,
  DEFAULT_BLOOM_SETTINGS.radius,
  DEFAULT_BLOOM_SETTINGS.threshold,
  BLOOM_MSAA_SAMPLES,
)
composer.addPass(selectiveBloom.mixPass)
/** SMAA nur falls kein MSAA (WebGL1) — sonst weicher als der Pfad ohne Bloom. */
const smaaPass = BLOOM_MSAA_SAMPLES === 0 ? new SMAAPass() : null
if (smaaPass) composer.addPass(smaaPass)
const outputPass = new OutputPass()
composer.addPass(outputPass)

syncComposerPixelRatio = () => {
  composer.setPixelRatio(renderer.getPixelRatio())
  const w = viewportRenderWidth()
  const h = viewportRenderHeight()
  composer.setSize(w, h)
  selectiveBloom.setSize(w, h, renderer.getPixelRatio())
}
syncComposerPixelRatio()

const viewCompass = document.querySelector<HTMLDivElement>('#view-compass')!
const viewCompassNeedle = document.querySelector<SVGPolygonElement>('#view-compass-needle')!
const viewCompassLabel = document.querySelector<HTMLSpanElement>('#view-compass-label')!

let state: FacadeState = createDefaultFacadeState()
let openingDragBase: FacadeState | null = null
let wallMoveDragBase: FacadeState | null = null
let trimDragBase: FacadeState | null = null
let labelDragBase: FacadeState | null = null
let editor: EditorState = createDefaultEditorState()
let currentView: AppView = 'front'

function isSceneEditView(): boolean {
  return currentView === '3d' || currentView === 'front' || currentView === 'top'
}

/** Grundstücksdrehung gilt in allen Szenen-Ansichten (3D + Oben), nicht nur Perspektive. */
function siteYawForView(): number {
  return isSceneEditView() ? (state.siteYawDeg ?? 0) : 0
}

/** Höchster relevanter Y-Wert für Draufsicht-Kamera (Wände, Dach). */
function sceneContentMaxY(): number {
  let maxY = WALL_HEIGHT
  const box = buildingWorldBox(getAllWalls(state))
  if (!box.isEmpty()) maxY = Math.max(maxY, box.max.y)
  for (const building of state.buildings) {
    if (building.hidden) continue
    const wallH = building.wallHeight ?? WALL_HEIGHT
    const floorCount = Math.max(1, building.floors?.length ?? 1)
    maxY = Math.max(maxY, wallH * floorCount)
    const roof = building.roof
    if (roof?.enabled) {
      maxY = Math.max(maxY, wallH * floorCount + (roof.ridgeHeight ?? 80))
    }
  }
  return maxY
}

function sceneColorsForLighting(): { sky: string; ground: string; background: string } {
  const line = currentRenderStyle === 'line'
  return {
    sky: line ? '#ffffff' : sceneAppearance.skyReflection,
    ground: line ? '#ffffff' : sceneAppearance.ground,
    background: line ? '#ffffff' : sceneAppearance.background,
  }
}

function activeFloorWorldY(): number {
  return currentFloor * activeWallHeight()
}

const UI_MODE_STORAGE_KEY = 'fassaden-builder-ui-mode'
type UiMode = 'simple' | 'complex'
type LibraryTab = 'walls' | 'bay' | 'balcony' | 'loggia' | 'windows' | 'doors' | 'niches' | 'panels' | 'profiles' | 'pediment' | 'lights'

function loadUiMode(): UiMode {
  try {
    const raw = localStorage.getItem(UI_MODE_STORAGE_KEY)
    if (raw === 'complex' || raw === 'simple') return raw
  } catch {
    /* ignore */
  }
  return 'simple'
}

let uiMode: UiMode = loadUiMode()
let libraryTab: LibraryTab = 'walls'
/** Bibliotheks-Wand, die nach Klick bei Wandauswahl links/rechts/oben gesetzt wird. */
let armedLibraryWallPresetId: string | null = null

function syncUiModeChrome() {
  document.documentElement.dataset.uiMode = uiMode
  const simpleBtn = document.querySelector<HTMLButtonElement>('#ui-mode-simple')
  const complexBtn = document.querySelector<HTMLButtonElement>('#ui-mode-complex')
  simpleBtn?.classList.toggle('active', uiMode === 'simple')
  complexBtn?.classList.toggle('active', uiMode === 'complex')
}

function setUiMode(mode: UiMode) {
  uiMode = mode
  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
  syncUiModeChrome()
  renderUi()
}

function isAdvancedUi(): boolean {
  return uiMode === 'complex'
}

function syncLibraryTabs() {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.library-tab')) {
    const tab = btn.dataset.libraryTab as LibraryTab | undefined
    const active = tab === libraryTab
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-selected', active ? 'true' : 'false')
  }
}

function setLibraryTab(tab: LibraryTab) {
  if (tab !== 'walls') armedLibraryWallPresetId = null
  libraryTab = tab
  syncLibraryTabs()
  initOpeningLibrary()
}

function wallLengthPreviewSvg(lengthCm: number): string {
  const wallH = WALL_HEIGHT
  const w = Math.max(8, lengthCm)
  return `<svg viewBox="0 0 ${w} ${wallH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="0" width="${w}" height="${wallH}" fill="#d8d0c4" stroke="#6a6358" stroke-width="1.5"/>
  </svg>`
}

function wallWithOpeningPreviewSvg(preset: WallWithOpeningPreset): string {
  const wallH = WALL_HEIGHT
  const w = Math.max(8, preset.lengthCm)
  const ow = Math.min(preset.opening.width, w - 8)
  const oh = Math.min(preset.opening.height, wallH - 8)
  const ox = (w - ow) / 2
  const oy = preset.opening.type === 'door' ? wallH - oh : Math.max(8, (wallH - oh) / 2)
  const fill = preset.opening.type === 'door' ? '#8a7f70' : '#9eb6c8'
  return `<svg viewBox="0 0 ${w} ${wallH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="0" width="${w}" height="${wallH}" fill="#d8d0c4" stroke="#6a6358" stroke-width="1.5"/>
    <rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${fill}" stroke="#4a453c" stroke-width="1.2" opacity="0.85"/>
  </svg>`
}


function wallEndPiecePreviewSvg(hand: EndPieceHand = 'left'): string {
  const arm = 48
  const pad = 4
  const size = arm + pad * 2
  const bar = 10
  const vx = hand === 'right' ? pad + arm - bar : pad
  return `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="${pad}" y="${pad}" width="${arm}" height="${bar}" fill="#d8d0c4" stroke="#6a6358" stroke-width="1.5"/>
    <rect x="${vx}" y="${pad}" width="${bar}" height="${arm}" fill="#cfc6b8" stroke="#6a6358" stroke-width="1.2"/>
  </svg>`
}

function bayWindowPreviewSvg(preset: BayWindowPreset): string {
  const w = preset.frontWidthCm / 8
  const d = preset.depthCm / 8
  const pad = 6
  const totalW = w + d * 2 + pad * 2
  const totalH = d + pad * 2
  const ox = pad + d
  const oy = pad
  const inward = (preset.kind ?? 'bay') === 'loggia'
  const fill = inward ? '#c4cdd8' : '#d8d0c4'
  const fillSide = inward ? '#b8c2cf' : '#cfc6b8'
  if (preset.shape === 'round') {
    // Halbkreis-Skizze: Sehne oben (Fassade), Bogen nach unten (= außen) bzw. nach oben bei Loggia.
    const cy = inward ? oy + d : oy
    const sweep = inward ? 0 : 1
    return `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M ${ox},${cy} A ${w / 2},${d} 0 0 ${sweep} ${ox + w},${cy} Z" fill="${fill}" stroke="#6a6358" stroke-width="1.5"/>
      <line x1="${ox}" y1="${cy}" x2="${ox + w}" y2="${cy}" stroke="#6a6358" stroke-width="1.2"/>
    </svg>`
  }
  if (preset.shape === 'angled45') {
    const y0 = inward ? oy + d : oy
    const y1 = inward ? oy : oy + d
    return `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="${ox},${y0} ${ox + w},${y0} ${ox + w + d},${y1} ${ox - d},${y1}" fill="${fill}" stroke="#6a6358" stroke-width="1.5"/>
    </svg>`
  }
  // U-Form (Erker / Balkon / Loggia)
  if (inward) {
    return `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="${ox}" y="${oy + d - 8}" width="${w}" height="8" fill="${fill}" stroke="#6a6358" stroke-width="1.5"/>
      <rect x="${ox - d}" y="${oy}" width="${d}" height="${d - 8}" fill="${fillSide}" stroke="#6a6358" stroke-width="1.2"/>
      <rect x="${ox + w}" y="${oy}" width="${d}" height="${d - 8}" fill="${fillSide}" stroke="#6a6358" stroke-width="1.2"/>
    </svg>`
  }
  return `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="${ox}" y="${oy}" width="${w}" height="8" fill="${fill}" stroke="#6a6358" stroke-width="1.5"/>
    <rect x="${ox - d}" y="${oy + 8}" width="${d}" height="${d - 8}" fill="${fillSide}" stroke="#6a6358" stroke-width="1.2"/>
    <rect x="${ox + w}" y="${oy + 8}" width="${d}" height="${d - 8}" fill="${fillSide}" stroke="#6a6358" stroke-width="1.2"/>
  </svg>`
}

function pickGroundGridFromClient(clientX: number, clientY: number): { gx: number; gz: number } | null {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, getActiveCamera())
  const floorY = currentView === '3d' ? 0 : activeFloorWorldY()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  return {
    gx: Math.round(hit.x / PLAN_GRID),
    gz: Math.round(hit.z / PLAN_GRID),
  }
}

function setRaycasterFromClient(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, getActiveCamera())
}

function pickWorldOnHorizontalPlane(
  clientX: number,
  clientY: number,
  planeY: number,
): { x: number; y: number; z: number } | null {
  setRaycasterFromClient(clientX, clientY)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  return sceneLightPositionFromWorld(hit)
}

function sceneLightLocalToWorld(
  light: Pick<SceneLight, 'x' | 'y' | 'z'>,
  target = _sceneLightWorld,
): THREE.Vector3 {
  target.set(light.x, light.y, light.z)
  siteOffset.localToWorld(target)
  return target
}

function viewDepthReferencePoint(out: THREE.Vector3): THREE.Vector3 {
  if (currentView === 'front') {
    const base = getFrontViewBase()
    if (base) return out.set(base.lookX, base.lookY, base.lookZ)
  }
  if (currentView === '3d') return out.copy(controls.target)
  const box = buildingWorldBox(getAllWalls(state))
  if (box.isEmpty()) return out.set(0, 0, 0)
  return out.set((box.min.x + box.max.x) * 0.5, 0, (box.min.z + box.max.z) * 0.5)
}

function sceneLightViewDepthCm(light: Pick<SceneLight, 'x' | 'y' | 'z'>): number {
  getActiveCamera().getWorldDirection(_frontPanForward)
  sceneLightLocalToWorld(light, _sceneLightWorld)
  viewDepthReferencePoint(_frontPanRight)
  const dx = _sceneLightWorld.x - _frontPanRight.x
  const dy = _sceneLightWorld.y - _frontPanRight.y
  const dz = _sceneLightWorld.z - _frontPanRight.z
  return dx * _frontPanForward.x + dy * _frontPanForward.y + dz * _frontPanForward.z
}

function pickSceneLightOnViewPlane(
  clientX: number,
  clientY: number,
  planePointWorld: THREE.Vector3,
): Pick<SceneLight, 'x' | 'y' | 'z'> | null {
  setRaycasterFromClient(clientX, clientY)
  getActiveCamera().getWorldDirection(_frontPanForward)
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(_frontPanForward, planePointWorld)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  return sceneLightPositionFromWorld(hit)
}

/** Weltpunkt (Raycast) → siteOffset-Lokal (wie Wand-Meshes). */
function sceneLightPositionFromWorld(world: THREE.Vector3): Pick<SceneLight, 'x' | 'y' | 'z'> {
  _sceneLightWorld.copy(world)
  siteOffset.worldToLocal(_sceneLightWorld)
  return { x: _sceneLightWorld.x, y: _sceneLightWorld.y, z: _sceneLightWorld.z }
}

function pickSceneLightPlacementFromClient(
  clientX: number,
  clientY: number,
): Pick<SceneLight, 'x' | 'y' | 'z'> | null {
  if (currentView === 'top') {
    const grid = pickGroundGridFromClient(clientX, clientY)
    if (!grid) return null
    const box = buildingWorldBox(getAllWalls(state))
    const y = box.isEmpty() ? 220 : Math.max(box.min.y + 180, 180)
    return { x: grid.gx * PLAN_GRID, y, z: grid.gz * PLAN_GRID }
  }

  setRaycasterFromClient(clientX, clientY)
  const sceneHits = raycaster.intersectObjects(
    [
      facade.claddingGroup,
      facade.profileGroup,
      facade.windowGroup,
      facade.casingGroup,
      facade.wallGroup,
      facade.indoorFloorGroup,
      facade.roofGroup,
    ],
    true,
  )
  if (sceneHits.length > 0) {
    return sceneLightPositionFromWorld(sceneHits[0]!.point)
  }

  const box = buildingWorldBox(getAllWalls(state))
  const fallbackY = box.isEmpty() ? 220 : Math.max(box.min.y + 180, 180)
  return pickWorldOnHorizontalPlane(clientX, clientY, fallbackY)
}

function compassFacadeYaw(): number | undefined {
  return currentElevation.kind === 'yaw' ? snapYawTo45(currentElevation.yaw) : undefined
}

/** Freie Bibliothek-Wand: in 3D Front zur Kamera (entgegengesetzt zur Blickrichtung). */
function placementFacadeYaw(): number | undefined {
  if (currentView === '3d') {
    const lookX = controls.target.x - camera.position.x
    const lookZ = controls.target.z - camera.position.z
    return snapYawTo45(viewedFacadeYaw(lookX, lookZ))
  }
  return compassFacadeYaw()
}

function inferWallAxis(plan: FloorPlan, gx: number, gz: number): 'x' | 'z' {
  for (const edge of plan.edges) {
    const a = plan.nodes.find((n) => n.id === edge.fromId)
    const b = plan.nodes.find((n) => n.id === edge.toId)
    if (!a || !b) continue
    const nearA = Math.max(Math.abs(a.gx - gx), Math.abs(a.gz - gz)) <= 1
    const nearB = Math.max(Math.abs(b.gx - gx), Math.abs(b.gz - gz)) <= 1
    if (!nearA && !nearB) continue
    if (a.gz === b.gz) return 'x'
    if (a.gx === b.gx) return 'z'
  }
  const facadeYaw = placementFacadeYaw()
  if (facadeYaw !== undefined) return wallDockAxisFromFacadeYaw(facadeYaw)
  return 'x'
}

function planViewCenterGrid(): { gx: number; gz: number } {
  const worldX = PLAN_VIEW_SIZE / 2 + planOffsetX
  const worldZ = PLAN_VIEW_SIZE / 2 + planOffsetZ
  return {
    gx: Math.round(worldX / PLAN_GRID),
    gz: Math.round(worldZ / PLAN_GRID),
  }
}



function wallPresetLengthCm(presetId: string): number | null {
  const lengthPreset = WALL_LENGTH_PRESETS.find((item) => item.id === presetId)
  if (lengthPreset) return lengthPreset.lengthCm
  const withOpening = WALL_WITH_OPENING_PRESETS.find((item) => item.id === presetId)
  return withOpening?.lengthCm ?? null
}

function wallWithOpeningPreset(presetId: string) {
  return WALL_WITH_OPENING_PRESETS.find((item) => item.id === presetId)
}

function resolveWallDockPlacement(
  presetId: string,
  gx: number,
  gz: number,
  axisOverride?: 'x' | 'z',
  lengthCmOverride?: number,
): { gx: number; gz: number; axis: 'x' | 'z'; toGx: number; toGz: number; valid: boolean } | null {
  const lengthCm = lengthCmOverride ?? wallPresetLengthCm(presetId)
  if (lengthCm == null) return null
  const plan = currentFloorPlan()
  const snapped = snapPlanGridToNearestNode(plan, gx, gz, 2)
  const axis = axisOverride ?? wallDockAxisOverride ?? inferWallAxis(plan, snapped.gx, snapped.gz)
  const cells = Math.round(lengthCm / PLAN_GRID)
  if (cells < 1) return null

  type Candidate = { toGx: number; toGz: number; valid: boolean; dist: number }
  const candidates: Candidate[] = []
  for (const sign of [1, -1] as const) {
    const toGx = axis === 'x' ? snapped.gx + sign * cells : snapped.gx
    const toGz = axis === 'z' ? snapped.gz + sign * cells : snapped.gz
    const valid = !planSegmentOverlaps(plan, snapped.gx, snapped.gz, toGx, toGz)
    const dist = Math.hypot(gx - toGx, gz - toGz)
    candidates.push({ toGx, toGz, valid, dist })
  }
  const validOnes = candidates.filter((c) => c.valid)
  const pool = validOnes.length > 0 ? validOnes : candidates
  pool.sort((a, b) => a.dist - b.dist)
  const best = pool[0]
  return {
    gx: snapped.gx,
    gz: snapped.gz,
    axis,
    toGx: best.toGx,
    toGz: best.toGz,
    valid: best.valid,
  }
}

const wallDockGhostGroup = new THREE.Group()
wallDockGhostGroup.name = 'wallDockGhost'
siteOffset.add(wallDockGhostGroup)

const placementGridGroup = new THREE.Group()
placementGridGroup.name = 'placementGrid'
siteOffset.add(placementGridGroup)

function clearPlacementGridOverlay() {
  clearPlacementGrid(placementGridGroup)
}

function showPlacementGridForDockTargets(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  floorY: number,
  excludeIds?: Set<string>,
) {
  const startG = gridPointOf(ax, az)
  const endG = gridPointOf(bx, bz)
  const segments: Array<{ ax: number; az: number; bx: number; bz: number; floorY?: number }> = []
  for (const wall of activeBuilding().walls) {
    if (!isStudioWall(wall)) continue
    if (excludeIds?.has(wall.id)) continue
    if (Math.abs((wall.y ?? 0) - floorY) >= 1) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    const sg = gridPointOf(s.x, s.z)
    const eg = gridPointOf(e.x, e.z)
    const shares =
      sameGridPoint(sg, startG) ||
      sameGridPoint(eg, startG) ||
      sameGridPoint(sg, endG) ||
      sameGridPoint(eg, endG)
    if (!shares) continue
    segments.push({ ax: s.x, az: s.z, bx: e.x, bz: e.z, floorY: wall.y ?? 0 })
  }
  showPlacementGridForWallSegments(segments)
}

function showPlacementGridForWallSegments(
  segments: Array<{ ax: number; az: number; bx: number; bz: number; floorY?: number }>,
) {
  if (segments.length === 0) {
    clearPlacementGridOverlay()
    return
  }
  const b = boundsFromSegments(segments)
  const floorY = segments[0]?.floorY ?? currentFloor * activeWallHeight()
  showFloorPlacementGrid(placementGridGroup, b.minX, b.maxX, b.minZ, b.maxZ, floorY)
}

function refreshWallMoveGuides(wallIds: string[]) {
  const building = activeBuilding()
  const floorY = currentFloor * activeWallHeight()
  const idSet = new Set(wallIds)
  const active = building.walls.filter((w) => idSet.has(w.id) && isStudioWall(w))
  const floorWalls = building.walls.filter(
    (w) => isStudioWall(w) && Math.abs((w.y ?? 0) - floorY) < 1,
  )
  const guides = computeWallMoveGuides(active, floorWalls)
  floorPlanView.showWallMoveGuides(guides)
}

function disposeWallDockGhostObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else if (mat) mat.dispose()
  })
}

function clearWallDockSceneGhost() {
  while (wallDockGhostGroup.children.length > 0) {
    const child = wallDockGhostGroup.children[0]
    wallDockGhostGroup.remove(child)
    disposeWallDockGhostObject(child)
  }
}

function gridPointOf(x: number, z: number) {
  return { gx: Math.round(x / PLAN_GRID), gz: Math.round(z / PLAN_GRID) }
}

function sameGridPoint(
  a: { gx: number; gz: number },
  b: { gx: number; gz: number },
) {
  return a.gx === b.gx && a.gz === b.gz
}

function dockFacesForSegment(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  excludeIds?: Set<string>,
  /** Etagenfuß der gezogenen/platzierten Wand; Default = aktive UI-Etage. */
  floorY?: number,
): { start: boolean; end: boolean; top: boolean } {
  const startG = gridPointOf(ax, az)
  const endG = gridPointOf(bx, bz)
  let start = false
  let end = false
  let top = false
  const refFloorY = floorY ?? currentFloor * activeWallHeight()
  for (const wall of activeBuilding().walls) {
    if (!isStudioWall(wall)) continue
    if (excludeIds?.has(wall.id)) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    const sg = gridPointOf(s.x, s.z)
    const eg = gridPointOf(e.x, e.z)
    const sharesStart = sameGridPoint(sg, startG) || sameGridPoint(eg, startG)
    const sharesEnd = sameGridPoint(sg, endG) || sameGridPoint(eg, endG)
    const sameFloor = Math.abs((wall.y ?? 0) - refFloorY) < 1
    const sameSeg =
      (sameGridPoint(sg, startG) && sameGridPoint(eg, endG)) ||
      (sameGridPoint(sg, endG) && sameGridPoint(eg, startG))
    if (sameSeg && !sameFloor && Math.abs((wall.y ?? 0) + wall.height - refFloorY) < 2) {
      top = true
    }
    if (sameFloor && sharesStart) start = true
    if (sameFloor && sharesEnd) end = true
  }
  return { start, end, top }
}

function dockHighlightMaterial(valid: boolean) {
  return new THREE.MeshBasicMaterial({
    color: valid ? 0xff5500 : 0xe04040,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function addGhostDockFaceMeshes(
  midX: number,
  midZ: number,
  yaw: number,
  length: number,
  height: number,
  valid: boolean,
  docks: { start: boolean; end: boolean; top: boolean },
  floorY = 0,
) {
  const mat = dockHighlightMaterial(valid)
  const addFace = (localZ: number, geo: THREE.BufferGeometry) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(midX, floorY + height / 2, midZ)
    mesh.rotation.y = yaw
    mesh.translateZ(localZ)
    mesh.renderOrder = 20
    wallDockGhostGroup.add(mesh)
  }
  if (docks.start) {
    addFace(-length / 2, new THREE.BoxGeometry(WALL_DEPTH + 2, height, 5))
  }
  if (docks.end) {
    addFace(length / 2, new THREE.BoxGeometry(WALL_DEPTH + 2, height, 5))
  }
  if (docks.top) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_DEPTH + 2, 5, length), mat)
    mesh.position.set(midX, floorY + height, midZ)
    mesh.rotation.y = yaw
    mesh.renderOrder = 20
    wallDockGhostGroup.add(mesh)
  }
}

/**
 * Orange Endkappen an bestehenden Nachbarwänden.
 * `floorY`: Etage der gezogenen Wand (nicht die UI-Etage).
 * Pro Andockpunkt nur die nächstliegende Wandfläche — keine höheren Etagen, kein Stapel.
 */
function addExistingWallDockOverlays(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  valid: boolean,
  excludeIds?: Set<string>,
  floorY?: number,
) {
  const startG = gridPointOf(ax, az)
  const endG = gridPointOf(bx, bz)
  const refFloorY = floorY ?? currentFloor * activeWallHeight()
  const mat = dockHighlightMaterial(valid)

  type CapHit = {
    wall: Wall
    atStart: boolean
    dist: number
  }

  const pickNearest = (pointG: { gx: number; gz: number }, px: number, pz: number): CapHit | null => {
    let best: CapHit | null = null
    for (const wall of activeBuilding().walls) {
      if (!isStudioWall(wall)) continue
      if (excludeIds?.has(wall.id)) continue
      if (Math.abs((wall.y ?? 0) - refFloorY) >= 1) continue
      const s = wallStartPoint(wall)
      const e = wallEndPoint(wall)
      const sg = gridPointOf(s.x, s.z)
      const eg = gridPointOf(e.x, e.z)
      const atStart = sameGridPoint(sg, pointG)
      const atEnd = sameGridPoint(eg, pointG)
      if (!atStart && !atEnd) continue
      const cx = atStart ? s.x : e.x
      const cz = atStart ? s.z : e.z
      const dist = Math.hypot(cx - px, cz - pz)
      if (!best || dist < best.dist) {
        best = { wall, atStart, dist }
      }
    }
    return best
  }

  const addCapFor = (hit: CapHit) => {
    const wall = hit.wall
    const transform = studioWallTransform(wall)
    const group = new THREE.Group()
    group.position.set(transform.position.x, transform.position.y, transform.position.z)
    group.rotation.y = transform.rotationY
    group.renderOrder = 20
    const depth = wall.depth ?? WALL_DEPTH
    const cap = new THREE.Mesh(new THREE.BoxGeometry(5, wall.height, depth + 2), mat)
    cap.position.set(hit.atStart ? -wall.width / 2 : wall.width / 2, 0, depth / 2)
    cap.renderOrder = 20
    group.add(cap)
    wallDockGhostGroup.add(group)
  }

  // Top-Dock: Wand darunter, gleiche Grundriss-Kante
  for (const wall of activeBuilding().walls) {
    if (!isStudioWall(wall)) continue
    if (excludeIds?.has(wall.id)) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    const sg = gridPointOf(s.x, s.z)
    const eg = gridPointOf(e.x, e.z)
    const sameFloor = Math.abs((wall.y ?? 0) - refFloorY) < 1
    const sameSeg =
      (sameGridPoint(sg, startG) && sameGridPoint(eg, endG)) ||
      (sameGridPoint(sg, endG) && sameGridPoint(eg, startG))
    if (sameSeg && !sameFloor && Math.abs((wall.y ?? 0) + wall.height - refFloorY) < 2) {
      const transform = studioWallTransform(wall)
      const group = new THREE.Group()
      group.position.set(transform.position.x, transform.position.y, transform.position.z)
      group.rotation.y = transform.rotationY
      group.renderOrder = 20
      const depth = wall.depth ?? WALL_DEPTH
      const top = new THREE.Mesh(new THREE.BoxGeometry(wall.width, 5, depth + 2), mat)
      top.position.set(0, wall.height / 2, depth / 2)
      top.renderOrder = 20
      group.add(top)
      wallDockGhostGroup.add(group)
      break
    }
  }

  const nearStart = pickNearest(startG, ax, az)
  const nearEnd = pickNearest(endG, bx, bz)
  if (nearStart) addCapFor(nearStart)
  if (nearEnd && (!nearStart || nearEnd.wall.id !== nearStart.wall.id || nearEnd.atStart !== nearStart.atStart)) {
    addCapFor(nearEnd)
  }
}

function addWallDockGhostWorldSegment(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  valid: boolean,
  excludeIds?: Set<string>,
) {
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return
  const midX = (ax + bx) / 2
  const midZ = (az + bz) / 2
  const yaw = Math.atan2(dx, dz)
  const fill = valid ? 0xff8800 : 0xe04040
  const height = Math.max(32, activeWallHeight())
  const floorY = currentFloor * activeWallHeight()
  const docks = dockFacesForSegment(ax, az, bx, bz, excludeIds, floorY)

  const shadowGeo = new THREE.BoxGeometry(WALL_DEPTH * 1.35, 0.8, length)
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.position.set(midX, floorY + 0.4, midZ)
  shadow.rotation.y = yaw
  wallDockGhostGroup.add(shadow)

  // Orange Bodenfläche: zeigt, woh die Wand abgesetzt wird.
  const padGeo = new THREE.BoxGeometry(Math.max(WALL_DEPTH * 2.2, 48), 1.2, length + 24)
  const padMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const pad = new THREE.Mesh(padGeo, padMat)
  pad.position.set(midX, floorY + 0.6, midZ)
  pad.rotation.y = yaw
  wallDockGhostGroup.add(pad)

  const footGeo = new THREE.BoxGeometry(WALL_DEPTH, 3.5, length)
  const footMat = new THREE.MeshBasicMaterial({
    color: fill,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  const foot = new THREE.Mesh(footGeo, footMat)
  foot.position.set(midX, floorY + 1.75, midZ)
  foot.rotation.y = yaw
  wallDockGhostGroup.add(foot)

  const ghostGeo = new THREE.BoxGeometry(WALL_DEPTH, height, length)
  const ghostMat = new THREE.MeshBasicMaterial({
    color: fill,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ghost = new THREE.Mesh(ghostGeo, ghostMat)
  ghost.position.set(midX, floorY + height / 2, midZ)
  ghost.rotation.y = yaw
  wallDockGhostGroup.add(ghost)
  addGhostDockFaceMeshes(midX, midZ, yaw, length, height, valid, docks, floorY)
  addExistingWallDockOverlays(ax, az, bx, bz, valid, excludeIds, floorY)
}

function setWallDockSceneGhostWorld(
  segments: Array<{ ax: number; az: number; bx: number; bz: number }>,
  valid: boolean,
  excludeIds?: Set<string>,
) {
  clearWallDockSceneGhost()
  for (const seg of segments) {
    addWallDockGhostWorldSegment(seg.ax, seg.az, seg.bx, seg.bz, valid, excludeIds)
  }
}

/** Orange Andockmarkierung beim Verschieben bestehender Wände. */
function updateWallMoveDockHighlight(wallIds: string[]) {
  const idSet = new Set(wallIds)
  const building = activeBuilding()
  const segments: Array<{ ax: number; az: number; bx: number; bz: number; floorY: number; height: number }> =
    []
  for (const wall of building.walls) {
    if (!idSet.has(wall.id) || !isStudioWall(wall)) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    segments.push({
      ax: s.x,
      az: s.z,
      bx: e.x,
      bz: e.z,
      floorY: wall.y ?? 0,
      height: wall.height,
    })
  }
  clearWallDockSceneGhost()
  floorPlanView.clearWallDockPreview()
  for (const seg of segments) {
    const docks = dockFacesForSegment(seg.ax, seg.az, seg.bx, seg.bz, idSet, seg.floorY)
    if (!docks.start && !docks.end && !docks.top) continue
    addExistingWallDockOverlays(seg.ax, seg.az, seg.bx, seg.bz, true, idSet, seg.floorY)
    const dx = seg.bx - seg.ax
    const dz = seg.bz - seg.az
    const length = Math.hypot(dx, dz)
    if (length >= 1e-6) {
      const midX = (seg.ax + seg.bx) / 2
      const midZ = (seg.az + seg.bz) / 2
      const yaw = Math.atan2(dx, dz)
      const height = Math.max(32, seg.height)
      const mat = dockHighlightMaterial(true)
      if (docks.start) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_DEPTH + 2, height, 5), mat)
        mesh.position.set(midX, seg.floorY + height / 2, midZ)
        mesh.rotation.y = yaw
        mesh.translateZ(-length / 2)
        mesh.renderOrder = 20
        wallDockGhostGroup.add(mesh)
      }
      if (docks.end) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_DEPTH + 2, height, 5), mat)
        mesh.position.set(midX, seg.floorY + height / 2, midZ)
        mesh.rotation.y = yaw
        mesh.translateZ(length / 2)
        mesh.renderOrder = 20
        wallDockGhostGroup.add(mesh)
      }
      if (docks.top) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_DEPTH + 2, 5, length), mat)
        mesh.position.set(midX, seg.floorY + height, midZ)
        mesh.rotation.y = yaw
        mesh.renderOrder = 20
        wallDockGhostGroup.add(mesh)
      }
    }
  }
  showPlacementGridForWallSegments(segments)
  refreshWallMoveGuides(wallIds)
}

function yawFromAxisDirection(axis: 'x' | 'z', fromGx: number, fromGz: number, toGx: number, toGz: number): number {
  if (axis === 'x') return toGx >= fromGx ? 0 : 180
  return toGz >= fromGz ? 270 : 90
}

function updateWallDockPreviewAtClient(clientX: number, clientY: number, presetId: string) {
  lastWallDockClient = { x: clientX, y: clientY }
  const grid = pickGroundGridFromClient(clientX, clientY)
  if (!grid) {
    clearWallDockPreview()
    return
  }
  const endHand = endPieceHandFromPresetId(presetId)
  const bayPreset = BAY_WINDOW_PRESETS.find((item) => item.id === presetId)
  const dockLength = endHand ? 48 : bayPreset?.frontWidthCm
  const place = resolveWallDockPlacement(presetId, grid.gx, grid.gz, undefined, dockLength)
  if (!place) {
    clearWallDockPreview()
    return
  }
  const flush = flushFrontFromNeighbor(
    currentFloorPlan(),
    place.gx,
    place.gz,
    place.toGx,
    place.toGz,
    place.axis,
  )
  const segmentYaw = yawFromAxisDirection(place.axis, place.gx, place.gz, place.toGx, place.toGz)
  const neighbor = flush?.wallId
    ? activeBuilding().walls.find((wall) => wall.id === flush.wallId)
    : undefined
  const oriented = adjustDockOrientation(segmentYaw, flush?.panelFlip ?? true, neighbor, {
    facadeYaw: neighbor ? undefined : placementFacadeYaw(),
  })
  const yawDeg = oriented.yawDeg
  const originX = place.gx * PLAN_GRID
  const originZ = place.gz * PLAN_GRID
  const panelFlip = oriented.panelFlip
  let segments: Array<{ ax: number; az: number; bx: number; bz: number }>
  if (endHand) {
    segments = endPieceGhostSegments(originX, originZ, yawDeg, panelFlip, endHand)
  } else if (bayPreset) {
    segments = bayWindowGhostSegments(originX, originZ, yawDeg, panelFlip, bayPreset)
  } else {
    segments = [
      {
        ax: place.gx * PLAN_GRID,
        az: place.gz * PLAN_GRID,
        bx: place.toGx * PLAN_GRID,
        bz: place.toGz * PLAN_GRID,
      },
    ]
  }
  floorPlanView.clearWallDockPreview()
  setWallDockSceneGhostWorld(segments, place.valid)
  const floorY = currentFloor * activeWallHeight()
  showPlacementGridForDockTargets(
    place.gx * PLAN_GRID,
    place.gz * PLAN_GRID,
    place.toGx * PLAN_GRID,
    place.toGz * PLAN_GRID,
    floorY,
  )
}

function clearWallDockPreview() {
  floorPlanView.clearWallDockPreview()
  clearWallDockSceneGhost()
  clearPlacementGridOverlay()
  floorPlanView.clearWallMoveGuides()
}

/** Übernimmt yawDeg/panelFlip von kollinearer Nachbarwand am Andock-Knoten (Front bündig). */
function flushFrontFromNeighbor(
  plan: FloorPlan,
  fromGx: number,
  fromGz: number,
  toGx: number,
  toGz: number,
  axis: 'x' | 'z',
): { yawDeg: number; panelFlip: boolean; wallId: string } | null {
  const axisMatches = (a: { gx: number; gz: number }, b: { gx: number; gz: number }) =>
    axis === 'x' ? a.gz === b.gz : a.gx === b.gx
  let orthogonal: { yawDeg: number; panelFlip: boolean; wallId: string } | null = null
  for (const wall of activeBuilding().walls) {
    if (!isStudioWall(wall)) continue
    const ox = wall.originX ?? wall.x
    const oz = wall.originZ ?? 0
    const startGx = Math.round(ox / PLAN_GRID)
    const startGz = Math.round(oz / PLAN_GRID)
    const along = wallAlongDelta(wall.yawDeg ?? 0, wall.width)
    const endGx = Math.round((ox + along.x) / PLAN_GRID)
    const endGz = Math.round((oz + along.z) / PLAN_GRID)
    const shares =
      (startGx === fromGx && startGz === fromGz) ||
      (endGx === fromGx && endGz === fromGz) ||
      (startGx === toGx && startGz === toGz) ||
      (endGx === toGx && endGz === toGz)
    if (!shares) continue
    const info = {
      yawDeg: wall.yawDeg ?? 0,
      panelFlip: wall.panelFlip ?? true,
      wallId: wall.id,
    }
    if (axisMatches({ gx: startGx, gz: startGz }, { gx: endGx, gz: endGz })) {
      return info
    }
    if (!orthogonal) orthogonal = info
  }
  void plan
  return orthogonal
}

function applyWallJoinAndStyle(
  selectedIds: string[],
  otherIds: string[],
  choice: 'to-others' | 'to-selected' | 'connect',
) {
  const linkIds = [...new Set([...selectedIds, ...otherIds])]
  let next = linkStudioWalls(state, linkIds)
  if (choice === 'to-others' && selectedIds[0] && otherIds.length > 0) {
    next = copyWallOpticsState(next, selectedIds[0], otherIds)
    next = inheritFrontsFromNeighbors(next, otherIds, selectedIds)
  } else if (choice === 'to-selected' && otherIds[0] && selectedIds.length > 0) {
    next = copyWallOpticsState(next, otherIds[0], selectedIds)
    next = inheritFrontsFromNeighbors(next, selectedIds, otherIds)
  } else {
    next = inheritFrontsFromNeighbors(next, selectedIds, otherIds)
  }
  commitState(finalizeStudioGeometry(next), {
    selectedWallIds: selectedIds,
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent =
    choice === 'connect'
      ? otherIds.length > 0
        ? 'Wände verknüpft'
        : 'Wände verbunden'
      : 'Stile übernommen'
}

function copyWallOpticsState(facadeState: FacadeState, sourceId: string, targetIds: string[]): FacadeState {
  const source = getWall(facadeState, sourceId)
  if (!source || !isStudioWall(source) || targetIds.length === 0) return facadeState
  const ids = new Set(targetIds)
  return updateActiveBuilding(facadeState, {
    walls: activeBuilding(facadeState).walls.map((wall) => {
      if (!ids.has(wall.id) || !isStudioWall(wall)) return wall
      return {
        ...wall,
        height: source.height,
        panel: source.panel ? { ...source.panel } : wall.panel,
        wallColor: source.wallColor,
        interiorColor: source.interiorColor,
        claddingColor: source.claddingColor,
        profileColor: source.profileColor,
        cornice: source.cornice ? { ...source.cornice } : wall.cornice,
        panelFlip: source.panelFlip ?? wall.panelFlip,
      }
    }),
  })
}

function askDockStyleCopy(selectedIds: string | string[], otherIds: string | string[]) {
  const selected = Array.isArray(selectedIds) ? selectedIds : [selectedIds]
  const others = Array.isArray(otherIds) ? otherIds : [otherIds]
  const dialog = document.querySelector<HTMLDialogElement>('#wall-dock-style-dialog')
  if (!dialog || selected.length === 0) return
  if (others.length === 0) {
    applyWallJoinAndStyle(selected, [], 'connect')
    return
  }
  if (dialog.open) return
  const onClose = () => {
    dialog.removeEventListener('close', onClose)
    const value = dialog.returnValue
    if (value === 'to-others' || value === 'to-selected' || value === 'connect') {
      applyWallJoinAndStyle(selected, others, value)
    }
  }
  dialog.addEventListener('close', onClose)
  dialog.returnValue = 'cancel'
  dialog.showModal()
}

function unlinkSelectedStudioWalls() {
  if (!canEditActiveBuildingNow()) return
  const ids = editor.selectedWallIds.filter((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall) && isWallPlanLinked(wall)
  })
  if (ids.length === 0) return
  commitState(finalizeStudioGeometry(unlinkStudioWallsFromUnselected(state, ids)), {
    selectedWallIds: ids,
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = 'Wand losgelöst — frei verschieb- und streckbar'
}

function selectionHasPlanLinkedWalls(wallIds: string[]): boolean {
  return wallIds.some((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall) && isWallPlanLinked(wall)
  })
}

function promptJoinIfTouching(selectedIds: string[]) {
  if (selectedIds.length === 0) return
  const others = unselectedTouchingWalls(activeBuilding().walls, selectedIds)
  if (others.length === 0) return
  const anyUnlinked = selectedIds.some((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall) && !isWallPlanLinked(wall)
  })
  if (!anyUnlinked) return
  askDockStyleCopy(selectedIds, others.map((wall) => wall.id))
}

function incomingWallsCollide(existing: Wall[], incoming: Wall[]): boolean {
  for (let i = 0; i < incoming.length; i += 1) {
    if (studioWallsCollideIdentical(existing, incoming[i])) return true
    if (studioWallsCollideIdentical(incoming.slice(0, i), incoming[i])) return true
  }
  return false
}

function studioPoseFromDockPlace(place: {
  gx: number
  gz: number
  toGx: number
  toGz: number
  axis: 'x' | 'z'
  valid: boolean
}) {
  const plan = currentFloorPlan()
  const fromNode = { id: 'tmp-a', gx: place.gx, gz: place.gz }
  const toNode = { id: 'tmp-b', gx: place.toGx, gz: place.toGz }
  const world = planNodeWorld(fromNode)
  const flush = flushFrontFromNeighbor(plan, place.gx, place.gz, place.toGx, place.toGz, place.axis)
  const segmentYaw = wallYawDegFromSegment(fromNode, toNode)
  const neighbor = flush?.wallId
    ? activeBuilding().walls.find((wall) => wall.id === flush.wallId)
    : undefined
  const oriented = adjustDockOrientation(segmentYaw, flush?.panelFlip ?? true, neighbor, {
    facadeYaw: neighbor ? undefined : placementFacadeYaw(),
  })
  void plan
  return {
    originX: world.x,
    originZ: world.z,
    y: currentFloor * activeWallHeight(),
    yawDeg: oriented.yawDeg as StudioYawDeg,
    panelFlip: oriented.panelFlip,
    neighborId: flush?.wallId as string | undefined,
  }
}

function resolveWallMoveIds(seedIds: string[], singleFloor = false): string[] {
  const building = activeBuilding()
  return expandWallMoveIds(building.walls, seedIds, building.wallHeight, { singleFloor })
}

function wallIdsForMoveDrag(
  facadeState: FacadeState,
  seedWallIds: string[],
  singleFloor: boolean,
): string[] {
  const building =
    facadeState.buildings.find((b) => b.id === facadeState.activeBuildingId) ?? facadeState.buildings[0]
  if (!building) return seedWallIds
  return expandWallMoveIds(building.walls, seedWallIds, building.wallHeight, { singleFloor })
}

function commitNewStudioWalls(
  newWalls: Wall[],
  opts: { groupName: string; selectIds: string[]; neighborId?: string; status: string },
) {
  if (!canEditActiveBuildingNow()) return
  const building = activeBuilding()
  if (incomingWallsCollide(building.walls, newWalls)) {
    planStatus.textContent = 'Platzierung würde bestehende Wände überlagern'
    return
  }
  const groupId = createId()
  const grouped = newWalls.map((wall) => ({ ...wall, groupId }))
  const groups = [
    ...(building.groups ?? []),
    { id: groupId, name: opts.groupName, memberWallIds: grouped.map((wall) => wall.id) },
  ]
  let next = updateActiveBuilding(state, { walls: [...building.walls, ...grouped], groups })
  const linkIds = [...grouped.map((wall) => wall.id)]
  if (opts.neighborId) linkIds.push(opts.neighborId)
  if (linkIds.length > 0) {
    next = linkStudioWalls(next, linkIds)
  }
  if (opts.neighborId) {
    next = inheritFrontsFromNeighbors(
      next,
      grouped.map((wall) => wall.id),
      [opts.neighborId],
    )
  }
  next = finalizeWallFrontOrientation(next, grouped.map((wall) => wall.id))
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: opts.selectIds,
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = opts.status
  if (opts.neighborId) askDockStyleCopy(grouped.map((wall) => wall.id), opts.neighborId)
}

function addEndPiecePresetAtPlan(presetId: string, gx: number, gz: number, axis?: 'x' | 'z') {
  if (!canEditActiveBuildingNow()) return
  const hand = endPieceHandFromPresetId(presetId)
  if (!hand) return
  const place = resolveWallDockPlacement(presetId, gx, gz, axis, 48)
  if (!place) return
  if (!place.valid) {
    planStatus.textContent = 'Endstück überlappt bestehende Wand — Ablegen verweigert'
    return
  }
  const pose = studioPoseFromDockPlace(place)
  const { front, ret } = buildStandaloneEndPieceWalls({
    originX: pose.originX,
    originZ: pose.originZ,
    y: pose.y,
    yawDeg: pose.yawDeg,
    panelFlip: pose.panelFlip,
    hand,
  })
  commitNewStudioWalls([front, ret], {
    groupName: hand === 'left' ? 'Endstück 48 links' : 'Endstück 48 rechts',
    selectIds: [front.id, ret.id],
    neighborId: pose.neighborId,
    status: `Endstück 48 ${hand === 'left' ? 'links' : 'rechts'} gesetzt`,
  })
}

function addBayWindowPresetAtPlan(presetId: string, gx: number, gz: number, axis?: 'x' | 'z') {
  if (!canEditActiveBuildingNow()) return
  const preset = BAY_WINDOW_PRESETS.find((item) => item.id === presetId)
  if (!preset) return
  const place = resolveWallDockPlacement(presetId, gx, gz, axis, preset.frontWidthCm)
  if (!place) return
  if (!place.valid) {
    planStatus.textContent = 'Erker überlappt bestehende Wand — Ablegen verweigert'
    return
  }
  const pose = studioPoseFromDockPlace(place)
  const walls = buildBayWindowAtPose(
    {
      originX: pose.originX,
      originZ: pose.originZ,
      y: pose.y,
      yawDeg: pose.yawDeg,
      panelFlip: pose.panelFlip,
      height: activeWallHeight(),
    },
    preset,
  )
  if (walls.length === 0) {
    planStatus.textContent = 'Erker konnte nicht erzeugt werden'
    return
  }
  commitNewStudioWalls(walls, {
    groupName: preset.label,
    selectIds: walls.map((wall) => wall.id),
    neighborId: pose.neighborId,
    status: `${preset.label} gesetzt`,
  })
}

function addWallPresetAtPlan(
  presetId: string,
  gx: number,
  gz: number,
  axis?: 'x' | 'z',
) {
  if (!canEditActiveBuildingNow()) return
  const place = resolveWallDockPlacement(presetId, gx, gz, axis)
  if (!place) return
  const lengthPreset = WALL_LENGTH_PRESETS.find((item) => item.id === presetId)
  const openingPreset = wallWithOpeningPreset(presetId)
  const lengthCm = lengthPreset?.lengthCm ?? openingPreset?.lengthCm
  if (lengthCm == null) return
  if (!place.valid) {
    planStatus.textContent = 'Wand überlappt bestehende Wand — Ablegen verweigert'
    return
  }
  let plan = currentFloorPlan()
  plan = drawPlanLine(plan, place.gx, place.gz, place.toGx, place.toGz)

  const floors = [...getFloors()]
  while (floors.length <= currentFloor) floors.push(createEmptyFloorPlan())
  floors[currentFloor] = plan

  const fromNode = { id: 'tmp-a', gx: place.gx, gz: place.gz }
  const toNode = { id: 'tmp-b', gx: place.toGx, gz: place.toGz }
  const world = planNodeWorld(fromNode)
  const flush = flushFrontFromNeighbor(plan, place.gx, place.gz, place.toGx, place.toGz, place.axis)
  const segmentYaw = wallYawDegFromSegment(fromNode, toNode)
  const neighbor = flush?.wallId
    ? activeBuilding().walls.find((wall) => wall.id === flush.wallId)
    : undefined
  const oriented = adjustDockOrientation(segmentYaw, flush?.panelFlip ?? true, neighbor, {
    facadeYaw: neighbor ? undefined : placementFacadeYaw(),
  })
  const yawDeg = oriented.yawDeg as StudioYawDeg
  const panelFlip = oriented.panelFlip
  const wallY = currentFloor * activeWallHeight()
  let wall: Wall = {
    ...createStudioWall(world.x, wallY),
    width: lengthCm,
    height: activeWallHeight(),
    depth: WALL_DEPTH,
    originX: world.x,
    originZ: world.z,
    yawDeg,
    panelFlip,
    planLinked: Boolean(flush?.wallId),
    x: world.x,
    y: wallY,
  }
  if (openingPreset) {
    const ox = (lengthCm - openingPreset.opening.width) / 2
    const opening = createOpening(
      openingPreset.opening.type,
      openingPreset.opening.width,
      openingPreset.opening.height,
      wall,
      { x: ox },
    )
    wall = alignOpeningElementsToWallFront({ ...wall, openings: [opening] })
  }
  if (
    studioWallsCollideIdentical(
      activeBuilding().walls,
      wall,
    )
  ) {
    planStatus.textContent = 'Wand würde bestehende Wand überlagern — Ablegen verweigert'
    return
  }
  let next = updateActiveBuilding(state, {
    walls: [...activeBuilding().walls, wall],
    floors,
  })
  if (flush?.wallId) {
    next = linkStudioWalls(next, [wall.id, flush.wallId])
    const merged = mergeCollinearDockedWalls(next, flush.wallId, wall.id)
    if (merged) {
      next = merged
      wall = getWall(next, flush.wallId) ?? wall
    } else {
      next = inheritFrontsFromNeighbors(next, [wall.id], [flush.wallId])
    }
  }
  next = finalizeWallFrontOrientation(next, [wall.id])
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [wall.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  const openingHint = openingPreset
    ? openingPreset.opening.type === 'door'
      ? ' + Tür'
      : ' + Fenster'
    : ''
  planStatus.textContent = `Wand ${lengthCm} cm${openingHint} eingefügt`
  if (flush?.wallId && wall.id !== flush.wallId) {
    askDockStyleCopy(wall.id, flush.wallId)
  }
}



function applyStudioWallYawChange(ids: string[], yawForWall: (wall: Wall) => number, statusOk: string) {
  if (!canEditActiveBuildingNow()) return
  const idSet = new Set(ids.filter((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall) && !wall.endPieceParentId
  }))
  if (idSet.size === 0) return
  if (selectionLockedToUnselected(activeBuilding().walls, idSet)) {
    planStatus.textContent = 'Zuerst Wand lösen (Rechtsklick)'
    return
  }
  const building = activeBuilding()
  const selectedWalls = building.walls.filter((wall) => idSet.has(wall.id) && isStudioWall(wall))
  const rotateAsGroup = selectedWalls.length > 1
  let pivotX = 0
  let pivotZ = 0
  if (rotateAsGroup) {
    for (const wall of selectedWalls) {
      const center = wallAlongDelta(wall.yawDeg ?? 0, wall.width / 2)
      pivotX += (wall.originX ?? wall.x) + center.x
      pivotZ += (wall.originZ ?? 0) + center.z
    }
    pivotX /= selectedWalls.length
    pivotZ /= selectedWalls.length
  }
  const rotateWall = (wall: Wall) => {
    if (!rotateAsGroup) return rotateStudioWallAroundCenter(wall, yawForWall(wall))
    const nextYaw = yawForWall(wall)
    let deltaDeg = normalizeYawDeg(nextYaw - (wall.yawDeg ?? 0))
    if (deltaDeg > 180) deltaDeg -= 360
    const rad = (deltaDeg * Math.PI) / 180
    const center = wallAlongDelta(wall.yawDeg ?? 0, wall.width / 2)
    const worldCenterX = (wall.originX ?? wall.x) + center.x
    const worldCenterZ = (wall.originZ ?? 0) + center.z
    const dx = worldCenterX - pivotX
    const dz = worldCenterZ - pivotZ
    const rotatedCenterX = pivotX + dx * Math.cos(rad) - dz * Math.sin(rad)
    const rotatedCenterZ = pivotZ + dx * Math.sin(rad) + dz * Math.cos(rad)
    const nextHalf = wallAlongDelta(nextYaw, wall.width / 2)
    return {
      ...wall,
      yawDeg: nextYaw,
      originX: rotatedCenterX - nextHalf.x,
      originZ: rotatedCenterZ - nextHalf.z,
      x: rotatedCenterX - nextHalf.x,
    }
  }
  const previewWalls = building.walls.map((wall) => {
    if (!idSet.has(wall.id) || !isStudioWall(wall)) return wall
    return rotateWall(wall)
  })
  for (const wall of previewWalls) {
    if (!idSet.has(wall.id) || !isStudioWall(wall)) continue
    if (studioWallsCollideIdentical(previewWalls, wall, idSet)) {
      planStatus.textContent = 'Drehen würde Wände überlagern'
      return
    }
  }
  let next = updateActiveBuilding(state, {
    walls: previewWalls,
  })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [...idSet],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = statusOk
  promptJoinIfTouching([...idSet])
}

function rotateSelectedStudioWalls(direction: 1 | -1, stepDeg = 90) {
  const ids = editor.selectedWallIds
  applyStudioWallYawChange(
    ids,
    (wall) => normalizeYawDeg((wall.yawDeg ?? 0) + direction * stepDeg),
    direction > 0 ? `Wand ${stepDeg}° rechts gedreht` : `Wand ${stepDeg}° links gedreht`,
  )
}

function setSelectedStudioWallsYaw(nextYaw: number) {
  const snapped = snapYawTo10(nextYaw)
  applyStudioWallYawChange(
    editor.selectedWallIds,
    () => snapped,
    `Wand auf ${snapped}° gedreht`,
  )
}


function applyPanelPresetFromLibrary(
  pattern: StudioPanelPattern,
  options?: { wallId?: string },
) {
  if (!canEditActiveBuildingNow()) return
  let ids: string[]
  if (options?.wallId) {
    const multi =
      editor.selectedWallIds.includes(options.wallId) && editor.selectedWallIds.length > 1
    ids = multi ? [...editor.selectedWallIds] : [options.wallId]
  } else {
    ids = [...editor.selectedWallIds]
  }
  ids = ids.filter((id) => canEditWallNow(id) && isStudioWall(getWall(state, id)!))
  if (ids.length === 0) {
    planStatus.textContent = 'Wand auswählen oder Paneel auf eine Wand ziehen'
    return
  }
  pendingSelectionToolbarTab = 'panels'
  commitState(updateStudioPanel(state, ids, { pattern, enabled: pattern !== 'none' }))
  rebuildStudioPatternCards()
  planStatus.textContent = `Paneel „${PATTERN_LABELS[pattern]}“ angewendet`
}

function placeWallPresetFromLibrary(presetId: string, clientX?: number, clientY?: number) {
  if (!isSceneEditView() && clientX == null) {
    setView('top')
    planStatus.textContent = 'Wand-Preset: in der Draufsicht ablegen oder erneut klicken'
    return
  }
  let grid: { gx: number; gz: number } | null = null
  if (clientX != null && clientY != null) {
    grid = pickGroundGridFromClient(clientX, clientY)
  }
  if (!grid) {
    grid = currentView === 'top' ? planViewCenterGrid() : { gx: 0, gz: 0 }
  }
  addWallPresetAtPlan(presetId, grid.gx, grid.gz)
}

function selectedStudioWallForLibrary(): Wall | undefined {
  if (editor.selectedOpenings.length > 0) return undefined
  for (const id of editor.selectedWallIds) {
    const wall = getWall(state, id)
    if (wall && isStudioWall(wall) && !wall.endPieceParentId) return wall
  }
  return undefined
}

function viewerRightXZ(): { x: number; z: number } {
  const cam = getActiveCamera()
  cam.updateMatrixWorld()
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
  const len = Math.hypot(right.x, right.z)
  if (len < 1e-6) return { x: 1, z: 0 }
  return { x: right.x / len, z: right.z / len }
}

function visualSideToWallEnd(wall: Wall, side: 'left' | 'right'): 'start' | 'end' {
  const vr = viewerRightXZ()
  return viewerSideToAlongSign(wall, side, vr.x, vr.z) > 0 ? 'end' : 'start'
}

function wallNeighborOnVisualSide(wall: Wall, side: 'left' | 'right'): Wall | undefined {
  const end = visualSideToWallEnd(wall, side)
  const walls = activeBuilding().walls
  return findCollinearDockWall(wall, end, walls) ?? findAdjacentWall(wall, end, walls, { ignorePlanLink: true })
}

function wallsStackedAbove(wall: Wall): Wall[] {
  const originX = wall.originX ?? wall.x
  const originZ = wall.originZ ?? 0
  const yaw = wall.yawDeg ?? 0
  return activeBuilding().walls.filter((other) => {
    if (other.id === wall.id || !isStudioWall(other)) return false
    if (Math.abs((other.originX ?? other.x) - originX) > 2) return false
    if (Math.abs((other.originZ ?? 0) - originZ) > 2) return false
    const otherYaw = other.yawDeg ?? 0
    const yawDiff = Math.abs(((((otherYaw - yaw) % 360) + 540) % 360) - 180)
    if (yawDiff > 2) return false
    return Math.abs(other.y - (wall.y + wall.height)) < 2
  })
}

function armLibraryWallPreset(presetId: string) {
  armedLibraryWallPresetId = presetId
  updateWallLibraryGizmos()
  syncLibraryAppliedOutline()
  const hasWall = Boolean(selectedStudioWallForLibrary())
  if (isDraftWallModuleEdit()) {
    planStatus.textContent =
      'Entwurf: Wand anklicken = auswählen (Farben/Mauerwerk); nochmal klicken = Segment tauschen; Greifer verlängert'
    return
  }
  planStatus.textContent = hasWall
    ? 'Bibliotheks-Wand gewählt — +/− an der markierten Wand setzen oder entfernen'
    : 'Bibliotheks-Wand gewählt — Wand markieren oder per Ziehen platzieren'
}

function onWallLibraryCardClick(presetId: string) {
  const hand = endPieceHandFromPresetId(presetId)
  if (hand) {
    planStatus.textContent = 'Endstück: in die Fläche oder an ein Wandende ziehen'
    return
  }
  armLibraryWallPreset(presetId)
}

function disarmLibraryWallPreset() {
  armedLibraryWallPresetId = null
  updateWallLibraryGizmos()
  syncLibraryAppliedOutline()
}

function resolveWallLocalXForSegmentSwap(event: { clientX: number; clientY: number }): {
  wallId: string
  localX: number
} | null {
  const hit = pickFromEvent(event)
  if (hit?.openingId && hit.wallId) {
    const wall = getWall(state, hit.wallId)
    const opening = wall?.openings.find((item) => item.id === hit.openingId)
    if (wall && opening) {
      return { wallId: wall.id, localX: opening.x + opening.width / 2 }
    }
  }
  if (hit?.wallId) {
    const wallHit = pickWallAtClient(event.clientX, event.clientY)
    if (wallHit && wallHit.wallId === hit.wallId) {
      return { wallId: wallHit.wallId, localX: wallHit.localX }
    }
    const wall = getWall(state, hit.wallId)
    if (wall && isStudioWall(wall)) {
      return { wallId: wall.id, localX: wall.width / 2 }
    }
  }
  const wallHit = pickWallAtClient(event.clientX, event.clientY)
  if (wallHit) return wallHit
  return null
}

function trySwapDraftWallSegmentAtClick(event: PointerEvent): boolean {
  // Nur Tab Wände + Preset. Erster Klick wählt die Wand (Farben/Mauerwerk);
  // Tausch nur bei erneutem Klick auf bereits markierte Wand.
  if (!isDraftWallModuleEdit() || !armedLibraryWallPresetId || libraryTab !== 'walls') return false
  if (currentView !== '3d' && currentView !== 'front') return false
  if (!canEditActiveBuildingNow()) return false

  const target = resolveWallLocalXForSegmentSwap(event)
  if (!target) return false

  const wall = getWall(state, target.wallId)
  if (!wall || !isStudioWall(wall) || wall.endPieceParentId) return false

  const alreadySelected =
    editor.selectedWallIds.includes(target.wallId) && editor.selectedOpenings.length === 0
  if (!alreadySelected) return false

  const gridCm = armedDraftSegmentCm()
  if (gridCm == null) return false

  const layout = inferWallSegmentLayout(wall, gridCm)
  const segmentIndex = wallSegmentIndexAt(target.localX, layout)
  if (segmentIndex == null) return false

  const band = layout[segmentIndex]!
  const presetLen = segmentPresetLengthCm(armedLibraryWallPresetId)
  if (presetLen == null || Math.abs(presetLen - band.lengthCm) > 0.5) {
    planStatus.textContent = `Segment ${Math.round(band.lengthCm)} cm ≠ Preset ${Math.round(presetLen ?? 0)} cm — passendes Preset wählen`
    return false
  }

  const next = applyWallPresetToSegment(
    state,
    target.wallId,
    segmentIndex,
    armedLibraryWallPresetId,
    layout,
  )
  if (!next) return false

  commitState(finalizeStudioGeometry(next), {
    selectedWallIds: [target.wallId],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  const preset = wallWithOpeningPreset(armedLibraryWallPresetId)
  planStatus.textContent = preset
    ? `Segment ${segmentIndex + 1}: ${preset.label}`
    : `Segment ${segmentIndex + 1}: reine Wand ${Math.round(band.lengthCm)} cm`
  return true
}

function projectWorldToViewport(world: THREE.Vector3): { x: number; y: number } | null {
  const cam = getActiveCamera()
  cam.updateMatrixWorld()
  const ndc = world.clone().project(cam)
  if (ndc.z > 1 || ndc.z < -1) return null
  const rect = canvas.getBoundingClientRect()
  const host = document.querySelector<HTMLElement>('#wall-library-gizmos')
  const stage = (host?.parentElement ?? canvas.parentElement)?.getBoundingClientRect() ?? rect
  return {
    x: ((ndc.x + 1) / 2) * rect.width + (rect.left - stage.left),
    y: ((-ndc.y + 1) / 2) * rect.height + (rect.top - stage.top),
  }
}

function resolveLibraryWallPresetId(): string | null {
  if (armedLibraryWallPresetId) return armedLibraryWallPresetId
  const wall = selectedStudioWallForLibrary()
  if (!wall) return null
  const matched = [...matchingWallLibraryPresetIds(wall)]
  const lengthMatch = matched.find((id) => WALL_LENGTH_PRESETS.some((preset) => preset.id === id))
  if (lengthMatch) return lengthMatch
  const withOpening = matched.find((id) => WALL_WITH_OPENING_PRESETS.some((preset) => preset.id === id))
  if (withOpening) return withOpening
  const byWidth = WALL_LENGTH_PRESETS.find((preset) => preset.lengthCm === wall.width)
  return byWidth?.id ?? null
}

function armedDraftSegmentCm(): number | null {
  if (!isDraftWallModuleEdit() || !armedLibraryWallPresetId) return null
  const len = wallPresetLengthCm(armedLibraryWallPresetId)
  return len != null && len > 0 ? len : null
}

function snapDraftPresetWidthDelta(baseWidth: number, deltaCm: number, segmentCm: number): number {
  let target = baseWidth + deltaCm
  if (target < segmentCm) target = segmentCm
  const segments = Math.max(1, Math.round(target / segmentCm))
  return segments * segmentCm - baseWidth
}

function openingsWithinWallWidth(openings: Opening[], wallWidth: number): Opening[] {
  return openings.filter(
    (opening) =>
      !opening.hidden && opening.x >= -0.5 && opening.x + opening.width <= wallWidth + 0.5,
  )
}

function openingCenterInSegment(opening: Opening, segStart: number, segEnd: number): boolean {
  const center = opening.x + opening.width / 2
  return center >= segStart - 0.5 && center < segEnd + 0.5
}

/** Volle Kachelung — nur für neue Abzweig-Wände ohne bestehende Öffnungen. */
function applyDraftPresetOpeningsToWall(state: FacadeState, wallId: string): FacadeState {
  const presetId = armedLibraryWallPresetId
  if (!presetId) return state
  const wall = getWall(state, wallId)
  if (!wall || !isStudioWall(wall)) return state
  const segment = wallPresetLengthCm(presetId)
  if (segment == null || segment <= 0) return state
  const openingPreset = wallWithOpeningPreset(presetId)
  const building = findBuildingForWall(state, wallId)
  if (!building) return state

  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((item) => {
      if (item.id !== wallId || !isStudioWall(item)) return cloneWall(item)
      if (!openingPreset) {
        return { ...cloneWall(item), openings: [] }
      }
      const openings: Opening[] = []
      const count = Math.max(1, Math.round(item.width / segment))
      for (let i = 0; i < count; i += 1) {
        const ox = i * segment + (segment - openingPreset.opening.width) / 2
        if (ox + openingPreset.opening.width > item.width + 0.5) continue
        openings.push(
          createOpening(
            openingPreset.opening.type,
            openingPreset.opening.width,
            openingPreset.opening.height,
            item,
            { x: ox },
          ),
        )
      }
      return alignOpeningElementsToWallFront({ ...cloneWall(item), openings })
    }),
  }))
}

/**
 * Entwurf: Preset nur auf den neu hinzugefügten Wandabschnitt anwenden —
 * bestehende Öffnungen bleiben unverändert.
 */
function applyDraftPresetOpeningsIncrementalToWall(
  state: FacadeState,
  wallId: string,
  baseWidth: number,
  wallEnd: 'start' | 'end',
): FacadeState {
  const presetId = armedLibraryWallPresetId
  const wall = getWall(state, wallId)
  if (!wall || !isStudioWall(wall)) return state
  const building = findBuildingForWall(state, wallId)
  if (!building) return state

  const delta = wall.width - baseWidth

  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((item) => {
      if (item.id !== wallId || !isStudioWall(item)) return cloneWall(item)
      let openings = openingsWithinWallWidth(item.openings, item.width)
      if (Math.abs(delta) < 0.5 || !presetId) {
        if (openings.length === item.openings.length) return item
        return alignOpeningElementsToWallFront({ ...cloneWall(item), openings })
      }

      const segment = wallPresetLengthCm(presetId)
      if (segment == null || segment <= 0) {
        return alignOpeningElementsToWallFront({ ...cloneWall(item), openings })
      }

      const openingPreset = wallWithOpeningPreset(presetId)
      if (delta < -0.5 || !openingPreset) {
        return alignOpeningElementsToWallFront({ ...cloneWall(item), openings })
      }

      const newSegmentCount = Math.round(delta / segment)
      for (let j = 0; j < newSegmentCount; j += 1) {
        const segStart = wallEnd === 'end' ? baseWidth + j * segment : j * segment
        const segEnd = segStart + segment
        if (wallEnd === 'start' && segEnd > delta + 0.5) continue
        if (wallEnd === 'end' && segStart < baseWidth - 0.5) continue
        if (segEnd > item.width + 0.5) continue
        if (openings.some((opening) => openingCenterInSegment(opening, segStart, segEnd))) continue

        const ox = segStart + (segment - openingPreset.opening.width) / 2
        if (ox + openingPreset.opening.width > item.width + 0.5) continue
        openings.push(
          createOpening(
            openingPreset.opening.type,
            openingPreset.opening.width,
            openingPreset.opening.height,
            item,
            { x: ox },
          ),
        )
      }

      openings.sort((a, b) => a.x - b.x)
      return alignOpeningElementsToWallFront({ ...cloneWall(item), openings })
    }),
  }))
}

function applyDraftPresetOpeningsIncrementalForStack(
  state: FacadeState,
  baseState: FacadeState,
  wallId: string,
  baseWidth: number,
  wallEnd: 'start' | 'end',
): FacadeState {
  const wall = getWall(state, wallId)
  if (!wall) return state
  const building = findBuildingForWall(state, wallId)
  if (!building) return state
  const ids = [
    wallId,
    ...findVerticalAlignedWalls(wall, building.walls, building.wallHeight).map((w) => w.id),
  ]
  let next = state
  for (const id of ids) {
    const baseWall = getWall(baseState, id)
    next = applyDraftPresetOpeningsIncrementalToWall(
      next,
      id,
      baseWall?.width ?? baseWidth,
      wallEnd,
    )
  }
  return next
}

function withDraftPresetOpeningsAfterResize(
  next: FacadeState,
  drag: {
    wallId: string
    grip: WallResizeGrip
    branchWallId?: string
    wallEnd?: 'start' | 'end'
    baseWidth: number
    baseState: FacadeState
  },
): FacadeState {
  if (!isDraftWallModuleEdit()) return next
  const branched = Boolean(drag.branchWallId && getWall(next, drag.branchWallId))
  let committed = next
  if (branched && drag.branchWallId && armedLibraryWallPresetId) {
    committed = applyDraftPresetOpeningsToWall(committed, drag.branchWallId)
  } else if (drag.grip === 'left' || drag.grip === 'right') {
    committed = applyDraftPresetOpeningsIncrementalForStack(
      committed,
      drag.baseState,
      drag.wallId,
      drag.baseWidth,
      drag.wallEnd ?? 'end',
    )
  } else {
    return next
  }
  return finalizeStudioGeometry(committed)
}

function isDraftWallModuleEdit(): boolean {
  return presentationMode === 'draft'
}

function updateWallLibraryGizmos() {
  const host = document.querySelector<HTMLDivElement>('#wall-library-gizmos')
  if (host) host.hidden = true
  updateWallResizeGizmos()
}

type WallResizeGrip = 'left' | 'right' | 'top' | 'front'

let wallResizeDrag: {
  wallId: string
  grip: WallResizeGrip
  wallEnd?: 'start' | 'end'
  baseState: FacadeState
  baseWidth: number
  baseStoreyHeight: number
  anchorWorld: { x: number; z: number }
  anchorLocal: { x: number; y: number }
  grabFloor: { x: number; z: number } | null
  startClientX: number
  startClientY: number
  moved: boolean
  branchWallId?: string
  frontMoveSeedIds?: string[]
  moveWallIds?: string[]
  floorY: number
  pointerId: number
  captureEl: HTMLElement | null
} | null = null

/** Pixel, bevor der Greifer die Geometrie ändert (verhindert Sprung beim Anfassen). */
const WALL_RESIZE_DRAG_PX = 8

let wallResizePointerMove: ((event: PointerEvent) => void) | null = null
let wallResizePointerUp: ((event: PointerEvent) => void) | null = null

function pickSiteXzFromClient(
  clientX: number,
  clientY: number,
  floorY: number,
): { x: number; z: number } | null {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, getActiveCamera())
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  siteOffset.worldToLocal(hit)
  return { x: hit.x, z: hit.z }
}

function showWallResizeFloorGrid(wall: Wall) {
  const building = activeBuilding()
  const floorWalls = building.walls.filter(
    (item) => isStudioWall(item) && Math.abs((item.y ?? 0) - wall.y) < 2,
  )
  const source = floorWalls.length > 0 ? floorWalls : [wall]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const item of source) {
    const start = wallStartPoint(item)
    const end = wallEndPoint(item)
    minX = Math.min(minX, start.x, end.x)
    maxX = Math.max(maxX, start.x, end.x)
    minZ = Math.min(minZ, start.z, end.z)
    maxZ = Math.max(maxZ, start.z, end.z)
  }
  showFloorResizeGrid(placementGridGroup, minX, maxX, minZ, maxZ, wall.y, WALL_RESIZE_FLOOR_STEP)
  markViewportDirty()
}

function detachWallResizePointerListeners() {
  if (wallResizePointerMove) {
    window.removeEventListener('pointermove', wallResizePointerMove, true)
    wallResizePointerMove = null
  }
  if (wallResizePointerUp) {
    window.removeEventListener('pointerup', wallResizePointerUp, true)
    window.removeEventListener('pointercancel', wallResizePointerUp, true)
    wallResizePointerUp = null
  }
}

function selectedStudioWallForResize(): Wall | undefined {
  if (wallResizeDrag) {
    const live = getWall(state, wallResizeDrag.wallId)
    if (live && isStudioWall(live)) return live
    return getWall(wallResizeDrag.baseState, wallResizeDrag.wallId)
  }
  if (editor.selectedOpenings.length > 0) return undefined
  if (editor.selectedWallIds.length !== 1) return undefined
  const wall = getWall(state, editor.selectedWallIds[0]!)
  if (!wall || !isStudioWall(wall) || wall.endPieceParentId) return undefined
  return wall
}

function selectedStudioWallsForGizmos(): Wall[] {
  if (wallResizeDrag) {
    const live = selectedStudioWallForResize()
    return live ? [live] : []
  }
  if (editor.selectedOpenings.length > 0) return []
  return editor.selectedWallIds
    .map((id) => getWall(state, id))
    .filter((wall): wall is Wall => Boolean(wall && isStudioWall(wall) && !wall.endPieceParentId))
}

function frontGripLockedForSelection(selectedIds: string[]): boolean {
  return unselectedLinkedDiagonalWalls(activeBuilding().walls, selectedIds).length > 0
}

function wallResizeGripWorld(wall: Wall, grip: WallResizeGrip): THREE.Vector3 {
  const yaw = wall.yawDeg ?? 0
  const outward = facadeOutward(yaw, wall.panelFlip ?? true)
  const outwardDepth = (wall.depth ?? WALL_DEPTH) / 2 + studioFacadeOutwardDepth(wall)
  const start = wallStartPoint(wall)
  const end = wallEndPoint(wall)
  const leftIsStart = visualSideToWallEnd(wall, 'left') === 'start'
  if (grip === 'top' || grip === 'front') {
    const mid = wallAlongDelta(yaw, wall.width / 2)
    const y = grip === 'top' ? wall.y + wall.height : wall.y + wall.height / 2
    return new THREE.Vector3(
      start.x + mid.x + outward.x * outwardDepth,
      y,
      start.z + mid.z + outward.z * outwardDepth,
    )
  }
  const edge = grip === 'left' ? (leftIsStart ? start : end) : leftIsStart ? end : start
  const y = wall.y + wall.height / 2
  return new THREE.Vector3(
    edge.x + outward.x * outwardDepth,
    y,
    edge.z + outward.z * outwardDepth,
  )
}

function projectWorldToOverlay(
  world: THREE.Vector3,
  host: HTMLElement | null,
): { x: number; y: number } | null {
  const cam = getActiveCamera()
  cam.updateMatrixWorld()
  const ndc = world.clone().project(cam)
  if (ndc.z > 1 || ndc.z < -1) return null
  const rect = canvas.getBoundingClientRect()
  const stage = (host?.parentElement ?? canvas.parentElement)?.getBoundingClientRect() ?? rect
  return {
    x: ((ndc.x + 1) / 2) * rect.width + (rect.left - stage.left),
    y: ((-ndc.y + 1) / 2) * rect.height + (rect.top - stage.top),
  }
}

function updateWallResizeGizmos() {
  const host = document.querySelector<HTMLDivElement>('#wall-resize-gizmos')
  if (!host) return
  const walls = selectedStudioWallsForGizmos()
  const wall = walls[0]
  const show =
    Boolean(wall) &&
    isSceneEditView() &&
    canEditActiveBuildingNow()
  if (!show || !wall) {
    host.hidden = true
    return
  }
  const showSideGrips = walls.length === 1
  const frontLocked = frontGripLockedForSelection(
    wallResizeDrag ? (wallResizeDrag.moveWallIds ?? [wall.id]) : editor.selectedWallIds,
  )
  let anyVisible = false
  for (const grip of ['left', 'right', 'top', 'front'] as const) {
    const el = host.querySelector<HTMLElement>(`.wall-resize-grip[data-grip="${grip}"]`)
    if (!el) continue
    if (grip !== 'front' && !showSideGrips) {
      el.hidden = true
      continue
    }
    const world = wallResizeGripWorld(wall, grip)
    siteOffset.localToWorld(world)
    const screen = projectWorldToOverlay(world, host)
    if (!screen) {
      el.hidden = true
      continue
    }
    el.hidden = false
    el.style.left = `${screen.x}px`
    el.style.top = `${screen.y}px`
    if (grip === 'front') {
      el.classList.toggle('is-locked', frontLocked)
      const info = el.querySelector<HTMLElement>('.wall-resize-front-info')
      const arrow = el.querySelector<SVGElement>('.wall-resize-front-arrow')
      if (info) info.hidden = !frontLocked
      el.title = frontLocked ? '' : 'Wand in Front-Richtung verschieben'
      if (arrow && !frontLocked) {
        const origin = wallResizeGripWorld(wall, 'front')
        const out = facadeOutward(wall.yawDeg ?? 0, wall.panelFlip ?? true)
        const tip = origin.clone().add(new THREE.Vector3(out.x, 0, out.z))
        siteOffset.localToWorld(origin)
        siteOffset.localToWorld(tip)
        const a = projectWorldToOverlay(origin, host)
        const b = projectWorldToOverlay(tip, host)
        const deg =
          a && b ? (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90 : 0
        arrow.style.transform = `rotate(${deg}deg)`
      }
    }
    anyVisible = true
  }
  host.hidden = !anyVisible
}

function applyWallResizeDelta(
  base: FacadeState,
  wallId: string,
  grip: WallResizeGrip,
  wallEnd: 'start' | 'end' | undefined,
  deltaCm: number,
): FacadeState {
  if (deltaCm === 0) return base
  const wall = getWall(base, wallId)
  if (!wall) return base
  if (grip === 'top') {
    const fi = floorIndex(wall, wallHeightForWall(wall, base))
    return finalizeWallLayout(resizeStoreyHeight(base, fi, deltaCm))
  }
  const end = wallEnd ?? 'end'
  return finalizeStudioGeometry(stretchStudioFacade(base, wallId, end, deltaCm))
}

function clampWallResizeDelta(
  grip: WallResizeGrip,
  deltaCm: number,
  baseWidth: number,
  baseStoreyHeight: number,
  yawDeg = 0,
): number {
  if (grip === 'top') {
    const snapped = snapToGrid(deltaCm, STUDIO_WALL_HEIGHT_STEP)
    if (snapped === 0) return 0
    return baseStoreyHeight + snapped >= STUDIO_MIN_SIZE ? snapped : 0
  }
  const draftSegment = armedDraftSegmentCm()
  if (draftSegment != null) {
    const snapped = snapDraftPresetWidthDelta(baseWidth, deltaCm, draftSegment)
    if (snapped === 0) return 0
    return baseWidth + snapped >= draftSegment ? snapped : 0
  }
  const snapped = snapWallWidthDelta(baseWidth, deltaCm, yawDeg)
  if (snapped === 0) return 0
  const step = wallWidthStepCm(yawDeg)
  return baseWidth + snapped >= step ? snapped : 0
}

function wallResizeHasMoved(
  drag: NonNullable<typeof wallResizeDrag>,
  clientX: number,
  clientY: number,
): boolean {
  if (drag.moved) return true
  const dist = Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY)
  if (dist < WALL_RESIZE_DRAG_PX) return false
  drag.moved = true
  return true
}

function floorDeltaFromGrab(
  drag: NonNullable<typeof wallResizeDrag>,
  clientX: number,
  clientY: number,
): { dx: number; dz: number } | null {
  const floorHit = pickSiteXzFromClient(clientX, clientY, drag.floorY)
  if (!floorHit) return null
  if (!drag.grabFloor) {
    drag.grabFloor = floorHit
    return { dx: 0, dz: 0 }
  }
  return { dx: floorHit.x - drag.grabFloor.x, dz: floorHit.z - drag.grabFloor.z }
}

function applyWallResizePreview(
  drag: NonNullable<typeof wallResizeDrag>,
  clientX: number,
  clientY: number,
  opts?: { shift?: boolean },
): FacadeState {
  if (!wallResizeHasMoved(drag, clientX, clientY)) return drag.baseState
  const wall = getWall(drag.baseState, drag.wallId)
  if (!wall) return drag.baseState
  setup3dDragForWall(wall, { x: 0, y: 0, width: 0 })
  const shift = Boolean(opts?.shift)

  if (drag.grip === 'top') {
    const local = pick3dLocalAt(clientX, clientY)
    if (!local) return drag.baseState
    const raw = local.y - drag.anchorLocal.y
    const delta = clampWallResizeDelta('top', raw, drag.baseWidth, drag.baseStoreyHeight)
    return applyWallResizeDelta(drag.baseState, drag.wallId, 'top', undefined, delta)
  }

  const wallEnd = drag.wallEnd ?? 'end'
  const floorDelta = floorDeltaFromGrab(drag, clientX, clientY)

  if (drag.grip === 'front' && floorDelta) {
    const out = facadeOutward(wall.yawDeg ?? 0, wall.panelFlip ?? true)
    const along = floorDelta.dx * out.x + floorDelta.dz * out.z
    const step = frontMoveStepCm(wall)
    const dist = Math.round(along / step) * step
    if (Math.abs(dist) < 0.5) return drag.baseState
    const seeds =
      drag.frontMoveSeedIds ??
      expandCollinearPlanLinkedIds(
        activeBuilding(drag.baseState).walls,
        drag.moveWallIds ?? [drag.wallId],
      )
    const moveIds = wallIdsForMoveDrag(drag.baseState, seeds, Boolean(opts?.shift))
    const next = offsetStudioWallsAlongFront(drag.baseState, drag.wallId, moveIds, dist)
    const building = next.buildings.find((item) => item.id === next.activeBuildingId) ?? next.buildings[0]
    const idSet = new Set(moveIds)
    for (const item of building?.walls ?? []) {
      if (!idSet.has(item.id) || !isStudioWall(item)) continue
      if (studioWallsCollideIdentical(building.walls, item, idSet)) {
        planStatus.textContent = 'Verschieben würde Wände überlagern'
        return drag.baseState
      }
    }
    return finalizeStudioGeometry(next)
  }

  if (shift && floorDelta) {
    const { dx, dz } = floorDelta
    const yaw = snapBranchYawDeg(wall.yawDeg ?? 0, wallEnd, dx, dz)
    if (yaw === null) return drag.baseState
    const presetSeg = armedDraftSegmentCm()
    const width = presetSeg ?? snapWallWidthCm(Math.hypot(dx, dz), yaw)
    if (width < wallWidthStepCm(yaw) && presetSeg == null) return drag.baseState
    if (!drag.branchWallId) drag.branchWallId = createId()
    return withDraftPresetOpeningsAfterResize(
      finalizeStudioGeometry(
        attachAngledWallFromEndForVerticalStack(
          drag.baseState,
          drag.wallId,
          wallEnd,
          yaw,
          width,
          drag.branchWallId,
        ),
      ),
      drag,
    )
  }

  if (floorDelta) {
    const raw = alongWidthDeltaFromMove(wall.yawDeg ?? 0, wallEnd, floorDelta.dx, floorDelta.dz)
    const delta = clampWallResizeDelta(drag.grip, raw, drag.baseWidth, drag.baseStoreyHeight, wall.yawDeg ?? 0)
    return withDraftPresetOpeningsAfterResize(
      applyWallResizeDelta(drag.baseState, drag.wallId, drag.grip, wallEnd, delta),
      drag,
    )
  }

  const local = pick3dLocalAt(clientX, clientY)
  if (!local) return drag.baseState
  const raw = wallEnd === 'start' ? drag.anchorLocal.x - local.x : local.x - drag.anchorLocal.x
  const delta = clampWallResizeDelta(drag.grip, raw, drag.baseWidth, drag.baseStoreyHeight, wall.yawDeg ?? 0)
  return withDraftPresetOpeningsAfterResize(
    applyWallResizeDelta(drag.baseState, drag.wallId, drag.grip, wallEnd, delta),
    drag,
  )
}

function updateWallResizeBranchCloseHint(
  next: FacadeState,
  drag: NonNullable<typeof wallResizeDrag>,
  shift: boolean,
) {
  if (!shift || !drag.branchWallId) {
    clearWallDockSceneGhost()
    floorPlanView.clearWallDockPreview()
    return
  }
  const branch = getWall(next, drag.branchWallId)
  const building =
    next.buildings.find((item) => item.id === next.activeBuildingId) ?? next.buildings[0]
  const walls = building?.walls ?? []
  if (!branch || !branchClosesAgainstWalls(branch, drag.wallId, walls)) {
    planStatus.textContent = 'Neue Wand 45°/90° · Raster: 48 cm bzw. Diagonale 48×48 · Ecke oder Wand schließt'
    clearWallDockSceneGhost()
    floorPlanView.clearWallDockPreview()
    return
  }
  planStatus.textContent = 'Pfad geschlossen — Gehrung an der Fuge'
  const ids = [branch.id]
  for (const wall of walls) {
    if (wall.id !== branch.id && wallsShareEndpoint(branch, wall)) ids.push(wall.id)
  }
  updateWallMoveDockHighlight(ids)
}

function beginWallResizeDrag(wall: Wall, grip: WallResizeGrip, event: PointerEvent) {
  if (!canEditActiveBuildingNow()) return
  if (grip === 'front' && frontGripLockedForSelection(editor.selectedWallIds)) return
  const building = activeBuilding()
  const wallEnd = grip === 'left' || grip === 'right' ? visualSideToWallEnd(wall, grip) : undefined
  const corner =
    wallEnd === 'start' ? wallStartPoint(wall) : wallEnd === 'end' ? wallEndPoint(wall) : wallStartPoint(wall)
  setup3dDragForWall(wall, { x: 0, y: 0, width: 0 })
  const local = pick3dLocal(event) ?? {
    x: wallEnd === 'end' ? wall.width : wall.width / 2,
    y: grip === 'top' ? wall.height : wall.height / 2,
  }
  const moveWallIds =
    grip === 'front'
      ? expandCollinearPlanLinkedIds(
          building.walls,
          editor.selectedWallIds.filter((id) => {
            const item = getWall(state, id)
            return Boolean(item && isStudioWall(item))
          }),
        )
      : undefined

  wallResizeDrag = {
    wallId: wall.id,
    grip,
    wallEnd,
    baseState: cloneFacadeState(state),
    baseWidth: wall.width,
    baseStoreyHeight: building.wallHeight,
    anchorWorld: { x: corner.x, z: corner.z },
    anchorLocal: local,
    grabFloor: pickSiteXzFromClient(event.clientX, event.clientY, wall.y),
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    floorY: wall.y,
    pointerId: event.pointerId,
    captureEl: (event.target as HTMLElement | null)?.closest('.wall-resize-grip') ?? null,
    frontMoveSeedIds: grip === 'front' ? moveWallIds : undefined,
    moveWallIds,
  }

  showWallResizeFloorGrid(wall)
  if (isDraftWallModuleEdit()) {
    planStatus.textContent = armedLibraryWallPresetId
      ? 'Entwurf: Greifer in Segment-Schritten der Bibliothek (eine Wand, alle Etagen)'
      : 'Entwurf: Greifer — freie Länge (Preset in Bibliothek = Segment-Schritte)'
  } else {
    planStatus.textContent =
      grip === 'top'
        ? 'Höhe ziehen (24 cm)'
        : grip === 'front'
          ? 'Wand in Front-Richtung ziehen'
          : 'Wandkante: 48 cm achsparallel, 45° = Diagonale 48×48 · Shift: neue Wand, Ecke oder Wand schließt den Pfad'
  }

  controls.enabled = false
  setOrbitLite(true)

  wallResizePointerMove = (moveEvent: PointerEvent) => {
    if (!wallResizeDrag || moveEvent.pointerId !== wallResizeDrag.pointerId) return
    moveEvent.preventDefault()
    moveEvent.stopPropagation()
    const next = applyWallResizePreview(wallResizeDrag, moveEvent.clientX, moveEvent.clientY, {
      shift: moveEvent.shiftKey,
    })
    if (!wallResizeDrag.moved) return
    previewState(next)
    showWallResizeFloorGrid(getWall(next, wallResizeDrag.wallId) ?? wall)
    updateWallResizeGizmos()
    updateWallResizeBranchCloseHint(next, wallResizeDrag, moveEvent.shiftKey)
    markViewportDirty()
  }
  wallResizePointerUp = (upEvent: PointerEvent) => {
    if (!wallResizeDrag || upEvent.pointerId !== wallResizeDrag.pointerId) return
    finishWallResizeDrag(upEvent)
  }
  window.addEventListener('pointermove', wallResizePointerMove, true)
  window.addEventListener('pointerup', wallResizePointerUp, true)
  window.addEventListener('pointercancel', wallResizePointerUp, true)

  try {
    wallResizeDrag.captureEl?.setPointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
  event.preventDefault()
  event.stopPropagation()
}

function finishWallResizeDrag(event: PointerEvent) {
  if (!wallResizeDrag) return
  const drag = wallResizeDrag
  wallResizeDrag = null
  detachWallResizePointerListeners()
  clearPlacementGridOverlay()

  const movedEnough =
    drag.moved ||
    Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= WALL_RESIZE_DRAG_PX
  if (movedEnough) {
    drag.moved = true
    const next = applyWallResizePreview(drag, event.clientX, event.clientY, { shift: event.shiftKey })
    const wallBefore = getWall(drag.baseState, drag.wallId)
    const wallAfter = getWall(next, drag.wallId)
    const branched = Boolean(drag.branchWallId && getWall(next, drag.branchWallId))
    const changed =
      branched ||
      (wallBefore &&
        wallAfter &&
        (Math.abs(wallAfter.width - wallBefore.width) > 0.5 ||
          Math.abs(wallAfter.height - wallBefore.height) > 0.5 ||
          Math.abs((wallAfter.yawDeg ?? 0) - (wallBefore.yawDeg ?? 0)) > 0.5 ||
          Math.abs((wallAfter.originX ?? wallAfter.x) - (wallBefore.originX ?? wallBefore.x)) > 0.5 ||
          Math.abs((wallAfter.originZ ?? 0) - (wallBefore.originZ ?? 0)) > 0.5))
    if (changed) {
      const committed = withDraftPresetOpeningsAfterResize(next, drag)
      const selectIds =
        branched && drag.branchWallId ? [drag.branchWallId] : editor.selectedWallIds
      commitState(committed, { ...editor, selectedWallIds: selectIds, selectedOpenings: [] })
    } else {
      applyState(drag.baseState)
    }
  }

  drag3dWallPlane = null
  controls.enabled = true
  setOrbitLite(false)
  clearWallDockSceneGhost()
  floorPlanView.clearWallDockPreview()
  updateWallResizeGizmos()
  markViewportDirty()
  try {
    drag.captureEl?.releasePointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}

function addArmedLibraryWallBeside(side: 'left' | 'right') {
  if (!canEditActiveBuildingNow()) return
  const source = selectedStudioWallForLibrary()
  if (!source) return
  if (isDraftWallModuleEdit()) return
  if (elementClipboard?.kind === 'walls') {
    pasteWallsFromClipboard({ targetWallId: source.id, side })
    return
  }
  runDuplicateWalls(side, { wallIds: [source.id] })
}

async function addLibraryWallAbove() {
  if (!canEditActiveBuildingNow()) return
  const source = selectedStudioWallForLibrary()
  if (!source) return
  if (elementClipboard?.kind === 'walls') {
    pasteWallsFromClipboard({ targetWallId: source.id, side: 'above' })
    return
  }
  await addLibraryStoreyAbove()
}

function removeLibraryWallOnSide(side: 'left' | 'right') {
  if (!canEditActiveBuildingNow()) return
  const source = selectedStudioWallForLibrary()
  if (!source) return
  const neighbor = wallNeighborOnVisualSide(source, side)
  if (!neighbor) {
    planStatus.textContent = 'Keine Wand zum Entfernen'
    return
  }
  if (neighbor.endPieceParentId === source.id || source.endPiece?.armWallIds?.includes(neighbor.id)) {
    removeSelectedEndPiece()
    return
  }
  let next = removeWall(state, neighbor.id)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [source.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = `Wand ${side === 'left' ? 'links' : 'rechts'} entfernt`
}

const STOREY_COPY_PREFS_KEY = 'fassaden-builder-storey-copy'

function storeyCopyFromDialog(dialog: HTMLDialogElement): StoreyCopyOptions {
  const checked = (name: string) =>
    Boolean(dialog.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked)
  return {
    panel: checked('panel'),
    openings: checked('openings'),
    wallColor: checked('wallColor'),
    claddingColor: checked('claddingColor'),
    profileColor: checked('profileColor'),
    cornice: checked('cornice'),
    plinth: checked('plinth'),
  }
}

function loadStoreyCopyPrefs(): StoreyCopyOptions {
  try {
    const raw = localStorage.getItem(STOREY_COPY_PREFS_KEY)
    if (!raw) return { ...DEFAULT_STOREY_COPY }
    const parsed = JSON.parse(raw) as Partial<StoreyCopyOptions>
    return {
      panel: parsed.panel !== false,
      openings: parsed.openings !== false,
      wallColor: parsed.wallColor !== false,
      claddingColor: parsed.claddingColor !== false,
      profileColor: parsed.profileColor !== false,
      cornice: parsed.cornice !== false,
      plinth: parsed.plinth !== false,
    }
  } catch {
    return { ...DEFAULT_STOREY_COPY }
  }
}

function saveStoreyCopyPrefs(copy: StoreyCopyOptions) {
  localStorage.setItem(STOREY_COPY_PREFS_KEY, JSON.stringify(copy))
}

function applyStoreyCopyCheckboxes(dialog: HTMLDialogElement, copy: StoreyCopyOptions) {
  const set = (name: keyof StoreyCopyOptions, value: boolean) => {
    const input = dialog.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    if (input) input.checked = value
  }
  set('panel', copy.panel)
  set('openings', copy.openings)
  set('wallColor', copy.wallColor)
  set('claddingColor', copy.claddingColor)
  set('profileColor', copy.profileColor)
  set('cornice', copy.cornice)
  set('plinth', copy.plinth)
}

function askStoreyCopyOptions(title = 'Etage duplizieren'): Promise<StoreyCopyOptions | null> {
  const dialog = document.querySelector<HTMLDialogElement>('#storey-copy-dialog')
  if (!dialog) {
    return Promise.resolve({ ...DEFAULT_STOREY_COPY })
  }
  const heading = dialog.querySelector<HTMLElement>('#storey-copy-title')
  if (heading) heading.textContent = title
  applyStoreyCopyCheckboxes(dialog, loadStoreyCopyPrefs())
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose)
      if (dialog.returnValue === 'plan') {
        resolve({ ...STOREY_COPY_PLAN_ONLY })
        return
      }
      if (dialog.returnValue !== 'apply') {
        resolve(null)
        return
      }
      const copy = storeyCopyFromDialog(dialog)
      saveStoreyCopyPrefs(copy)
      resolve(copy)
    }
    dialog.addEventListener('close', onClose)
    dialog.returnValue = 'cancel'
    dialog.showModal()
  })
}

async function addLibraryStoreyAbove() {
  if (!canEditActiveBuildingNow()) return
  const source = selectedStudioWallForLibrary()
  if (!source) return
  const copy = await askStoreyCopyOptions('Etage hinzufügen')
  if (!copy) return
  const building = activeBuilding()
  const sourceFloor = floorIndex(source, building.wallHeight)
  const wallIds =
    editor.selectedWallIds.includes(source.id) && editor.selectedOpenings.length === 0
      ? editor.selectedWallIds.filter((id) => {
          const wall = getWall(state, id)
          return Boolean(wall && isStudioWall(wall))
        })
      : [source.id]
  let next = insertStoreyAbove(state, sourceFloor, { wallIds, copyOpenings: copy.openings, copy })
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: wallIds,
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = 'Etage darüber hinzugefügt'
}

function removeLibraryStoreyAbove() {
  if (!canEditActiveBuildingNow()) return
  const source = selectedStudioWallForLibrary()
  if (!source) return
  const stacked = wallsStackedAbove(source)
  if (stacked.length === 0) {
    planStatus.textContent = 'Keine Wand zum Entfernen'
    return
  }
  const building = activeBuilding()
  const stackedFloor = floorIndex(stacked[0]!, building.wallHeight)
  let next = state
  for (const wall of stacked) next = removeWall(next, wall.id)
  const remainingOnFloor = getActiveBuilding(next).walls.filter(
    (wall) => floorIndex(wall, building.wallHeight) === stackedFloor,
  )
  if (remainingOnFloor.length === 0) {
    next = removeStorey(next, stackedFloor)
  }
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [source.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = 'Etage darüber entfernt'
}

function matchingWallLibraryPresetIds(wall: Wall): Set<string> {
  const ids = new Set<string>()
  if (wall.endPiece?.hand === 'left') ids.add('wall-end-48-left')
  if (wall.endPiece?.hand === 'right') ids.add('wall-end-48-right')
  const openings = wall.openings.filter((item) => item.type === 'window' || item.type === 'door')
  if (openings.length === 1) {
    const opening = openings[0]!
    const withOp = WALL_WITH_OPENING_PRESETS.find(
      (preset) =>
        preset.lengthCm === wall.width &&
        preset.opening.type === opening.type &&
        preset.opening.width === opening.width &&
        preset.opening.height === opening.height,
    )
    if (withOp) {
      ids.add(withOp.id)
      return ids
    }
  }
  const length = WALL_LENGTH_PRESETS.find((preset) => preset.lengthCm === wall.width)
  if (length) ids.add(length.id)
  return ids
}

function matchingOpeningLibraryIds(): { presetIds: Set<string>; templateIds: Set<string> } {
  const presetIds = new Set<string>()
  const templateIds = new Set<string>()
  const openings: Opening[] = []
  if (editor.selectedOpenings.length > 0) {
    for (const ref of editor.selectedOpenings) {
      const opening = getWall(state, ref.wallId)?.openings.find((item) => item.id === ref.openingId)
      if (opening) openings.push(opening)
    }
  } else {
    for (const wall of selectedWalls()) openings.push(...wall.openings)
  }
  for (const opening of openings) {
    const preset = WALL_OPENING_PRESETS.find(
      (item) =>
        item.type === opening.type &&
        item.width === opening.width &&
        item.height === opening.height &&
        (item.type !== 'cutout' || (item.cutoutShape ?? 'rect') === (opening.cutoutShape ?? 'rect')),
    )
    if (preset) presetIds.add(preset.id)
    for (const template of openingTemplates) {
      if (
        template.draft.type === opening.type &&
        template.draft.width === opening.width &&
        template.draft.height === opening.height
      ) {
        templateIds.add(template.id)
      }
    }
  }
  return { presetIds, templateIds }
}

function matchingBayLibraryPresetId(wall: Wall): string | null {
  const bay = wall.bayWindow
  if (!bay) return null
  const kind = bay.kind ?? 'bay'
  const match = BAY_WINDOW_PRESETS.find(
    (preset) =>
      bayPresetKind(preset) === kind &&
      preset.frontWidthCm === bay.frontWidthCm &&
      preset.shape === bay.shape,
  )
  return match?.id ?? null
}

function isLibraryCardApplied(card: HTMLElement): boolean {
  const hasSelection = editor.selectedWallIds.length > 0 || editor.selectedOpenings.length > 0
  if (libraryTab === 'profiles' || libraryTab === 'pediment') {
    return card.classList.contains('active')
  }
  if (!hasSelection) {
    return card.dataset.libraryNone === '1' || card.dataset.panelPattern === 'none'
  }
  if (card.dataset.libraryNone === '1') {
    if (libraryTab === 'bay' || libraryTab === 'balcony' || libraryTab === 'loggia') {
      return !selectedWalls().some((wall) => wall.bayWindow)
    }
    if (libraryTab === 'panels') {
      const wall = selectedWalls()[0]
      return !wall?.panel || wall.panel.enabled === false || wall.panel.pattern === 'none'
    }
    if (libraryTab === 'windows' || libraryTab === 'doors' || libraryTab === 'niches') {
      if (editor.selectedOpenings.length > 0) return false
      if (libraryTab === 'niches') {
        return !selectedWalls().some((wall) =>
          wall.openings.some((opening) => opening.type === 'cutout' || opening.type === 'conch'),
        )
      }
      const type = libraryTab === 'doors' ? 'door' : 'window'
      return !selectedWalls().some((wall) => wall.openings.some((opening) => opening.type === type))
    }
    return false
  }
  const wallPresetId = card.dataset.wallPresetId
  if (wallPresetId) {
    if (armedLibraryWallPresetId === wallPresetId) return true
    return selectedWalls().some((wall) => matchingWallLibraryPresetIds(wall).has(wallPresetId))
  }
  const presetId = card.dataset.presetId
  const templateId = card.dataset.templateId
  if (presetId || templateId) {
    const match = matchingOpeningLibraryIds()
    if (presetId && match.presetIds.has(presetId)) return true
    if (templateId && match.templateIds.has(templateId)) return true
    return false
  }
  const panelPattern = card.dataset.panelPattern
  if (panelPattern) {
    const wall = selectedWalls()[0]
    const pattern =
      !wall?.panel || wall.panel.enabled === false || wall.panel.pattern === 'none' ? 'none' : wall.panel.pattern
    return panelPattern === pattern
  }
  const bayPresetId = card.dataset.bayPresetId
  if (bayPresetId) {
    return selectedWalls().some((wall) => matchingBayLibraryPresetId(wall) === bayPresetId)
  }
  return false
}

function syncLibraryAppliedOutline() {
  const host = document.querySelector('#opening-library-items')
  if (!host) return
  for (const card of host.querySelectorAll<HTMLElement>('.opening-library-card')) {
    const applied = isLibraryCardApplied(card)
    card.classList.toggle('library-card-applied', applied)
    if (libraryTab !== 'profiles' && libraryTab !== 'pediment') {
      card.classList.toggle('active', applied)
    }
  }
}

let lastSelectionAnchor: number | null = null

let currentElevation: ElevationFilter = { kind: 'yaw', yaw: 0 }
let editScope: EditScope = DEFAULT_EDIT_SCOPE
/** Bei Scope „Fassade“: gefilterte Yaws; null = alle Hausseiten. */
let editFacadeYawFilter: number[] | null = null
let sunSettings: SunSettings = { ...DEFAULT_SUN_SETTINGS }
let activeColorPickerCount = 0

function isColorPickerSessionActive(): boolean {
  return activeColorPickerCount > 0
}
let sceneAppearance: SceneAppearance = { ...DEFAULT_SCENE_APPEARANCE }
let bloomSettings: BloomSettings = { ...DEFAULT_BLOOM_SETTINGS }
let fogSettings: FogSettings = { ...DEFAULT_FOG_SETTINGS }
let lodSettings: LodSettings = normalizeLodSettings(DEFAULT_LOD_SETTINGS)
let presentationMode: PresentationMode = loadPresentationMode()
const collapsedFloors = new Set<number>()
const collapsedBuildings = new Set<string>()
const expandedRoofs = new Set<string>()
let sceneLightsLayerCollapsed = false
const buildingAddBtn = document.querySelector<HTMLButtonElement>('#building-add')!
const expandedWalls = new Set<string>()
let planBuildingDrag: {
  buildingId: string
  startBounds: { minGx: number; maxGx: number; minGz: number; maxGz: number }
  startGx: number
  startGz: number
  /** Snapshot vor dem Drag — Offset immer absolut von hier aus. */
  startState: FacadeState
} | null = null
let planBuildingDragMoved = false

function sharePayloadFromApp() {
  return buildSharePayload(state, {
    scene: sceneAppearance,
    viewYaw: currentElevation.kind === 'yaw' ? currentElevation.yaw : undefined,
  })
}

function scheduleShareHashWrite() {
  if (isGalleryModeActive()) return
  scheduleFacadeHashWrite(sharePayloadFromApp())
}

function persistApp() {
  if (isGalleryModeActive()) return
  savePersistedState({
    facade: state,
    editor,
    view: currentView,
    sun: sunSettings,
    editScope,
    editFacadeYawFilter,
    scene: sceneAppearance,
    bloom: bloomSettings,
    fog: fogSettings,
    lod: lodSettings,
  })
}

let persistAppTimer = 0
function schedulePersistApp() {
  if (isGalleryModeActive()) return
  if (persistAppTimer) window.clearTimeout(persistAppTimer)
  persistAppTimer = window.setTimeout(() => {
    persistAppTimer = 0
    persistApp()
  }, 350)
}

function bloomIsActive(): boolean {
  return (
    bloomSettings.enabled &&
    (currentView === '3d' || currentView === 'front') &&
    currentRenderStyle !== 'line'
  )
}

function applyBloomRenderer() {
  const enabled = bloomIsActive()
  selectiveBloom.mixPass.enabled = enabled
  if (smaaPass) smaaPass.enabled = enabled
  outputPass.enabled = enabled
  atmosphereSky.setDisplayExposure(enabled ? SKY_DISPLAY_EXPOSURE_BLOOM : SKY_DISPLAY_EXPOSURE_PLAIN)
  selectiveBloom.setBloomParams(
    bloomSettings.strength,
    bloomSettings.radius,
    bloomSettings.threshold,
  )
  if (enabled) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = bloomToneMappingExposure(bloomSettings.exposure)
  } else {
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
  }
}

function disposeDirectionalShadowMap(light: THREE.DirectionalLight) {
  const map = light.shadow.map
  if (!map) return
  map.dispose()
  light.shadow.map = null
}

function syncPresentationModeUi() {
  const draftBtn = document.querySelector<HTMLButtonElement>('#light-presentation-btn')
  const previewBtn = document.querySelector<HTMLButtonElement>('#edit-presentation-btn')
  const renderBtn = document.querySelector<HTMLButtonElement>('#render-presentation-btn')
  if (draftBtn) {
    draftBtn.classList.toggle('active', presentationMode === 'draft')
    draftBtn.setAttribute('aria-pressed', presentationMode === 'draft' ? 'true' : 'false')
  }
  if (previewBtn) {
    previewBtn.classList.toggle('active', presentationMode === 'preview')
    previewBtn.setAttribute('aria-pressed', presentationMode === 'preview' ? 'true' : 'false')
  }
  if (renderBtn) {
    renderBtn.classList.toggle('active', presentationMode === 'render')
    renderBtn.setAttribute('aria-pressed', presentationMode === 'render' ? 'true' : 'false')
  }
  const renderOnlySun = presentationMode === 'render'
  document.querySelector<HTMLElement>('#sun-softness-block')?.toggleAttribute('hidden', !renderOnlySun)
  document.querySelector<HTMLElement>('#sun-shadow-density-block')?.toggleAttribute('hidden', true)
}

function applyWorkModeShadowStyle() {
  const hard = presentationUsesWorkLikeShading(presentationMode)
  const nextType = THREE.BasicShadowMap
  if (renderer.shadowMap.type !== nextType) {
    disposeDirectionalShadowMap(dirLight)
    disposeDirectionalShadowMap(dirLightIndoor)
    renderer.shadowMap.type = nextType
  }
  if (hard) {
    disablePcssShadows()
    dirLight.shadow.radius = 0
    dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS_MIN
  } else {
    enablePcssShadows()
    dirLight.shadow.radius = 0
  }
  invalidateShadowMaterials(scene)
  renderer.shadowMap.needsUpdate = true
}

/** Entwurf / Vorschau / Render: Geometrie, Himmel, Schatten. */
function applyPresentationMode() {
  facade.setPresentationMode(presentationMode)
  syncPresentationModeUi()
  const line = currentRenderStyle === 'line'
  const wantSky =
    !presentationUsesWorkLikeShading(presentationMode) && !line && (currentView === '3d' || currentView === 'top')
  atmosphereSky.setVisible(wantSky)
  const bg = line ? '#ffffff' : sceneAppearance.background
  applySceneBackground(scene, renderer, bg)
  viewport.style.background = bg
  applyBloomRenderer()
  if (presentationUsesWorkLikeShading(presentationMode)) clearGlassEnvironmentBindings(scene)
  applyWorkModeShadowStyle()
  applySunLighting({ updateShadowMap: true })
  markViewportDirty()
  updateWallLibraryGizmos()
}

function setPresentationMode(mode: PresentationMode) {
  if (presentationMode === mode) return
  if (mode !== 'draft') armedLibraryWallPresetId = null
  presentationMode = mode
  savePresentationMode(presentationMode)
  applyPresentationMode()
}

/** Legacy: Vorschau ein/aus (Entwurf/Render unberührt). */
function setEditPresentationEnabled(enabled: boolean) {
  setPresentationMode(enabled ? 'preview' : 'render')
}


let fogAppliedKey = ''

function applyFogToScene() {
  if (!fogSettings.enabled || currentView !== '3d') {
    if (scene.fog) scene.fog = null
    fogAppliedKey = 'off'
    return
  }
  const key = `${fogSettings.type}:${fogSettings.color}:${fogSettings.near}:${fogSettings.far}:${fogSettings.density}`
  if (key === fogAppliedKey && scene.fog) return
  fogAppliedKey = key
  const color = new THREE.Color(fogSettings.color)
  if (fogSettings.type === 'exponential') {
    scene.fog = new THREE.FogExp2(color.getHex(), fogSettings.density)
  } else {
    scene.fog = new THREE.Fog(color.getHex(), fogSettings.near, fogSettings.far)
  }
}

function resizeComposer() {
  syncComposerPixelRatio?.()
}

/** CubeCamera-Bake blendet Selektion, Hilfslinien und Raster aus. */
const sceneReflectionHideRoots: THREE.Object3D[] = []
const reflectionProbePos = new THREE.Vector3()
const reflectionCamPos = new THREE.Vector3()
const reflectionFocus = new THREE.Vector3()
const reflectionSiteBox = new THREE.Box3()
let lastReflectionViewBucket = Number.NaN

function renderLitSceneFrame(activeCamera: THREE.Camera) {
  dirLight.visible = true
  const roomOcclusion = sceneLightRoomOcclusionActive()
  dirLightIndoor.visible = roomOcclusion
  if (roomOcclusion) {
    dirLightIndoor.intensity = Math.max(0.28, hemiLight.intensity * 0.9)
    dirLightIndoor.color.copy(dirLight.color)
  }
  renderer.autoClear = true
  // Shadow-Map nur bei Geometrie/Licht-Änderung (scheduleSunShadowMapUpdate) —
  // nicht jeden Frame bei Punktlicht, sonst stottern Orbit und Verschieben.
  const line = currentRenderStyle === 'line'
  const wantSky =
    !presentationUsesWorkLikeShading(presentationMode) && !line && (currentView === '3d' || currentView === 'top')
  atmosphereSky.setVisible(wantSky)
  if (!presentationUsesWorkLikeShading(presentationMode) && !orbitLite && !orbitLitePointer) {
    reflectionSiteBox.setFromObject(sitePivot)
    activeCamera.getWorldPosition(reflectionCamPos)
    if (reflectionSiteBox.isEmpty()) reflectionFocus.set(0, 180, 0)
    else reflectionSiteBox.getCenter(reflectionFocus)
    const viewBucket = reflectionViewBucket(reflectionCamPos, reflectionFocus)
    if (viewBucket !== lastReflectionViewBucket) {
      lastReflectionViewBucket = viewBucket
      markSceneReflectionsDirty()
    }
    exteriorReflectionProbe(reflectionSiteBox, reflectionCamPos, reflectionProbePos)
    bakeSceneReflectionsIfNeeded(renderer, scene, reflectionProbePos, sceneReflectionHideRoots)
    bindMaterialsToGlassEnv(scene)
  }
  const bloomOn = bloomIsActive() && !orbitLite && !orbitLitePointer
  renderPass.camera = activeCamera
  selectiveBloom.setCamera(activeCamera)
  if (bloomOn) {
    selectiveBloom.prepareMix()
    composer.render()
  } else {
    renderer.render(scene, activeCamera)
  }
}

function render3dFrame() {
  renderLitSceneFrame(camera)
}

async function loadInitialState(): Promise<void> {
  const hash = readFacadeFromLocationHash()
  if (hash) {
    const fromHash = await decodeFacadeHash(hash)
    if (fromHash) {
      state = fromHash.facade
      editor = createDefaultEditorState()
      currentView = 'front'
      if (fromHash.scene) sceneAppearance = normalizeSceneAppearance(fromHash.scene)
      if (fromHash.viewYaw !== undefined) {
        currentElevation = { kind: 'yaw', yaw: fromHash.viewYaw }
      }
      if (facadeHasNeedsReview(state)) {
        queueMicrotask(() => {
          planStatus.textContent =
            'Projekt aus älterer Version — bitte markierte Elemente prüfen'
        })
      }
      return
    }
  }

  const persisted = loadPersistedState()
  if (persisted) {
    state = persisted.facade
    editor = persisted.editor
    currentView = persisted.view === '3d' ? '3d' : 'front'
    sunSettings = normalizeSunSettings(persisted.sun)
    if (persisted.editScope) editScope = persisted.editScope
    editFacadeYawFilter = normalizeFacadeYawFilter(persisted.editFacadeYawFilter)
    sceneAppearance = normalizeSceneAppearance(persisted.scene)
    bloomSettings = normalizeBloomSettings(persisted.bloom)
    fogSettings = normalizeFogSettings(persisted.fog)
    lodSettings = normalizeLodSettings(persisted.lod)
    if (facadeHasNeedsReview(state)) {
      queueMicrotask(() => {
        planStatus.textContent =
          'Projekt aus älterer Version — bitte markierte Elemente prüfen'
      })
    }
  }
  ensureDefaultElevation()
  syncViewOptionsControls()
}

const selectionToolbar = document.querySelector<HTMLDivElement>('#selection-toolbar')!
const appRoot = document.querySelector<HTMLDivElement>('#app')!
const uiLeftCollapseBtn = document.querySelector<HTMLButtonElement>('#ui-left-collapse')!
const UI_LEFT_COLLAPSED_KEY = 'fassaden-builder-ui-left-collapsed'

function isUiLeftCollapsed(): boolean {
  return appRoot.classList.contains('ui-left-collapsed')
}

function setUiLeftCollapsed(collapsed: boolean) {
  appRoot.classList.toggle('ui-left-collapsed', collapsed)
  uiLeftCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
  uiLeftCollapseBtn.title = collapsed ? 'Linke Spalte ausklappen' : 'Linke Spalte einklappen'
  uiLeftCollapseBtn.textContent = collapsed ? '›' : '‹'
  try {
    localStorage.setItem(UI_LEFT_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function loadUiLeftCollapsed() {
  try {
    setUiLeftCollapsed(localStorage.getItem(UI_LEFT_COLLAPSED_KEY) === '1')
  } catch {
    setUiLeftCollapsed(false)
  }
}

uiLeftCollapseBtn.addEventListener('click', () => {
  setUiLeftCollapsed(!isUiLeftCollapsed())
})
loadUiLeftCollapsed()

/** Wand-Preset-Drag: ID für Preview (MIME ist im dragover oft leer). */
let activeWallDragPresetId: string | null = null
/** Während Wand-Preset-Drag: Taste R wechselt die Vorschau-Achse. */
let wallDockAxisOverride: 'x' | 'z' | null = null
/** Letzte Cursor-Position für Andock-Vorschau (R-Achsenwechsel). */
let lastWallDockClient: { x: number; y: number } | null = null
/** Paneel-Preset-Drag: Pattern-Id (MIME im dragover oft leer). */
let activePanelDragPatternId: string | null = null

type LibraryAsset =
  | { kind: 'frame-profile'; id: string }
  | { kind: 'cornice-profile'; id: string }
  | { kind: 'plinth-profile'; id: string }
  | { kind: 'sill-profile'; id: string }
  | { kind: 'pediment-form'; form: PedimentForm | 'none' }
  | { kind: 'pediment-profile'; id: string }
  | { kind: 'pediment-console'; id: string }

let activeLibraryAssetDrag: LibraryAsset | null = null

type StyleClipboard = {
  panel?: Wall['panel']
  claddingZones?: Wall['claddingZones']
  wallColor?: string
  interiorColor?: string
  claddingColor?: string
  profileColor?: string
  wallFinish?: Wall['wallFinish']
  claddingFinish?: Wall['claddingFinish']
  profileFinish?: Wall['profileFinish']
  cornice?: Wall['cornice']
  panelFlip?: boolean
  opening?: Opening
  /** Rahmenprofil der ersten Öffnung (liegt auf der Wand, nicht auf Opening). */
  frameProfileId?: string | null
}

let styleClipboard: StyleClipboard | null = null
/** Wenn gesetzt, nur diese Felder beim Einfügen-Dialog vorauswählen. */
let styleClipboardKeys: string[] | null = null
let stylePasteTarget:
  | { kind: 'wall'; ids: string[] }
  | { kind: 'opening'; refs: OpeningRef[] }
  | null = null

/** Geometrie-Zwischenablage (Rechtsklick Kopieren / Einfügen). */
type ElementClipboard =
  | {
      kind: 'openings'
      items: Array<{ opening: Opening; profiles: ProfileAssignment[] }>
    }
  | { kind: 'walls'; walls: Wall[] }
  | { kind: 'building'; building: Building }

let elementClipboard: ElementClipboard | null = null

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function copyOpeningsToClipboard(refs: OpeningRef[]) {
  const items: Array<{ opening: Opening; profiles: ProfileAssignment[] }> = []
  for (const ref of refs) {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    if (!wall || !opening) continue
    items.push({
      opening: deepCloneJson(opening),
      profiles: wall.profiles
        .filter((profile) => profile.openingId === opening.id)
        .map((profile) => ({ ...profile })),
    })
  }
  if (items.length === 0) return
  elementClipboard = { kind: 'openings', items }
  planStatus.textContent =
    items.length === 1 ? 'Öffnung kopiert' : `${items.length} Öffnungen kopiert`
}

function copyWallsToClipboard(wallIds: string[]) {
  const walls = wallIds
    .map((id) => getWall(state, id))
    .filter((wall): wall is Wall => Boolean(wall))
    .map((wall) => deepCloneJson(cloneWall(wall)))
  if (walls.length === 0) return
  elementClipboard = { kind: 'walls', walls }
  planStatus.textContent = walls.length === 1 ? 'Fassade kopiert' : `${walls.length} Wände kopiert`
}

function copyBuildingToClipboard(buildingId: string) {
  const building = state.buildings.find((item) => item.id === buildingId)
  if (!building) return
  elementClipboard = { kind: 'building', building: deepCloneJson(building) }
  planStatus.textContent = `Haus „${building.name}“ kopiert`
}

function pasteOpeningsFromClipboard(wallIds: string[]) {
  if (elementClipboard?.kind !== 'openings' || wallIds.length === 0) return
  let next = state
  const newRefs: OpeningRef[] = []
  for (const wallId of wallIds) {
    if (!getWall(next, wallId)) continue
    for (const item of elementClipboard.items) {
      const newId = createId()
      const opening = { ...deepCloneJson(item.opening), id: newId }
      next = addOpening(next, wallId, opening)
      const profiles = item.profiles.map((profile) => ({
        ...profile,
        openingId: newId,
      }))
      if (profiles.length > 0) {
        next = mapAllWalls(next, (wall) => {
          if (wall.id !== wallId) return wall
          return {
            ...cloneWall(wall),
            profiles: [...wall.profiles, ...profiles],
          }
        })
      }
      newRefs.push({ wallId, openingId: newId })
    }
  }
  if (newRefs.length === 0) {
    planStatus.textContent = 'Einfügen nicht möglich'
    return
  }
  commitState(finalizeStudioGeometry(next), {
    ...editor,
    selectedWallIds: [],
    selectedOpenings: newRefs,
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent =
    newRefs.length === 1 ? 'Öffnung eingefügt' : `${newRefs.length} Öffnungen eingefügt`
}

function pasteWallsFromClipboard(opts?: {
  targetWallId?: string
  side?: 'left' | 'right' | 'above'
}) {
  if (elementClipboard?.kind !== 'walls') return
  const beforeIds = new Set(getAllWalls(state).map((wall) => wall.id))
  let next: FacadeState

  if (opts?.targetWallId && opts.side) {
    next = pasteWallsRelativeToTarget(
      state,
      elementClipboard.walls,
      opts.targetWallId,
      opts.side,
      viewerRightXZ(),
    )
  } else {
    const building = activeBuilding()
    const floorY = currentFloor * activeWallHeight()
    const clones: Wall[] = []
    for (const source of elementClipboard.walls) {
      const openingIdMap = new Map<string, string>()
      const openings = source.openings.map((opening) => {
        const nextId = createId()
        openingIdMap.set(opening.id, nextId)
        return { ...deepCloneJson(opening), id: nextId }
      })
      const cloned: Wall = {
        ...deepCloneJson(cloneWall(source)),
        id: createId(),
        buildingId: building.id,
        y: isStudioWall(source) ? floorY : source.y,
        groupId: undefined,
        neighbors: emptyNeighbors(),
        openings,
        profiles: source.profiles.map((profile) => ({
          ...profile,
          openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
        })),
      }
      if (isStudioWall(source)) {
        const along = wallAlongDelta(source.yawDeg ?? 0, source.width + PLAN_GRID)
        cloned.originX = (source.originX ?? source.x) + along.x
        cloned.originZ = (source.originZ ?? 0) + along.z
        cloned.x = source.x + source.width + PLAN_GRID
        cloned.planLinked = false
      } else {
        cloned.x = source.x + source.width + PLAN_GRID
      }
      clones.push(cloned)
    }
    if (clones.length === 0) return
    next = updateBuilding(state, building.id, (b) => ({
      ...b,
      walls: [...b.walls, ...clones],
    }))
  }

  const newIds = getAllWalls(next)
    .filter((wall) => !beforeIds.has(wall.id))
    .map((wall) => wall.id)
  const hasStudio = newIds.some((id) => {
    const item = getWall(next, id)
    return item && isStudioWall(item)
  })
  if (hasStudio && newIds.length > 0) {
    if (opts?.targetWallId) {
      next = linkStudioWalls(next, [opts.targetWallId, ...newIds])
      next = inheritFrontsFromNeighbors(next, newIds, [opts.targetWallId])
    }
    next = finalizeStudioGeometry(next)
  } else {
    next = hasStudio ? finalizeStudioGeometry(next) : finalizeWallLayout(next)
  }
  if (opts?.side === 'above' && opts.targetWallId) {
    const target = getWall(next, opts.targetWallId)
    if (target) {
      currentFloor = floorIndex(target, activeBuilding().wallHeight) + 1
    }
  }
  commitState(next, {
    ...editor,
    selectedWallIds: newIds,
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = newIds.length === 1 ? 'Fassade eingefügt' : `${newIds.length} Wände eingefügt`
}

function pasteBuildingFromClipboard() {
  if (elementClipboard?.kind !== 'building') return
  const next = finalizeWallLayout(insertBuildingClone(state, elementClipboard.building, 'east'))
  for (const building of next.buildings) {
    collapsedBuildings.add(building.id)
  }
  commitState(next, {
    selectedBuildingId: next.activeBuildingId,
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedCeiling: undefined,
  })
  syncFloorUI()
  rebuildFloorPlanOverlay()
  planStatus.textContent = 'Haus eingefügt'
}

function pasteElementClipboard(opts?: { wallId?: string }) {
  if (!elementClipboard) return
  if (elementClipboard.kind === 'openings') {
    let wallIds: string[] = []
    if (opts?.wallId) {
      wallIds =
        editor.selectedWallIds.includes(opts.wallId) && editor.selectedOpenings.length === 0
          ? [...editor.selectedWallIds]
          : [opts.wallId]
    } else if (editor.selectedOpenings.length > 0) {
      wallIds = [...new Set(editor.selectedOpenings.map((ref) => ref.wallId))]
    } else if (editor.selectedWallIds.length > 0) {
      wallIds = [...editor.selectedWallIds]
    }
    if (wallIds.length === 0) {
      planStatus.textContent = 'Zum Einfügen einer Öffnung eine Wand wählen'
      return
    }
    pasteOpeningsFromClipboard(wallIds)
    return
  }
  if (elementClipboard.kind === 'walls') {
    pasteWallsFromClipboard()
    return
  }
  pasteBuildingFromClipboard()
}

function elementPasteMenuItems(opts?: { wallId?: string }): MenuItem[] {
  if (!elementClipboard) return []
  if (elementClipboard.kind === 'openings') {
    if (!opts?.wallId && editor.selectedWallIds.length === 0 && editor.selectedOpenings.length === 0) {
      return []
    }
    return [
      {
        label: 'Öffnung einfügen',
        action: () => pasteElementClipboard(opts),
      },
    ]
  }
  if (elementClipboard.kind === 'walls' && opts?.wallId) {
    const wallId = opts.wallId
    return [
      {
        label: 'Einfügen',
        children: [
          {
            label: 'Nach links',
            action: () => {
              ensureWallSelected(wallId)
              pasteWallsFromClipboard({ targetWallId: wallId, side: 'left' })
            },
          },
          {
            label: 'Nach rechts',
            action: () => {
              ensureWallSelected(wallId)
              pasteWallsFromClipboard({ targetWallId: wallId, side: 'right' })
            },
          },
          {
            label: 'Darüber',
            action: () => {
              ensureWallSelected(wallId)
              pasteWallsFromClipboard({ targetWallId: wallId, side: 'above' })
            },
          },
        ],
      },
    ]
  }
  const label =
    elementClipboard.kind === 'walls' ? 'Fassade einfügen' : 'Haus einfügen'
  return [
    {
      label,
      action: () => pasteElementClipboard(opts),
    },
  ]
}

const selectionRightTabs = document.querySelector<HTMLElement>('#selection-right-tabs')!
const libraryModeEl = document.querySelector<HTMLElement>('#library-mode')!
const openingLibraryEl = document.querySelector<HTMLElement>('#opening-library')!
const sceneToolbarTabs = document.querySelector<HTMLElement>('#scene-toolbar-tabs')!
const sceneToolbarPanels = document.querySelector<HTMLElement>('#scene-toolbar-panels')!
/** Aktiver Options-Reiter der Auswahl (kein „Alles“ — Tabs sitzen oben rechts). */
let selectionToolbarTab = ''
/** Nach 3D-Klick auf Wandteil: gewünschter Reiter einmalig übernehmen. */
let pendingSelectionToolbarTab: string | null = null
let selectionToolbarKind = ''
let sceneToolbarTab = 'all'
const lightingAccordion = document.querySelector<HTMLElement>('#lighting-accordion')!
const toolbarWall = document.querySelector<HTMLDivElement>('#toolbar-wall')!
const toolbarStudio = document.querySelector<HTMLDivElement>('#toolbar-studio')!
const toolbarOpening = document.querySelector<HTMLDivElement>('#toolbar-opening')!
const openingConflictDialog = document.querySelector<HTMLDialogElement>('#opening-conflict-dialog')!
const openingConflictMessage = document.querySelector<HTMLParagraphElement>('#opening-conflict-message')!
const openingConflictReplaceButton = document.querySelector<HTMLButtonElement>('#opening-conflict-replace')!
const layerList = document.querySelector<HTMLUListElement>('#layer-list')!
const wallModuleSelect = document.querySelector<HTMLSelectElement>('#wall-module')!
const claddingSection = document.querySelector<HTMLDivElement>('#cladding-section')!
const claddingSelect = document.querySelector<HTMLSelectElement>('#cladding-select')!
const validationHint = document.querySelector<HTMLParagraphElement>('#validation-hint')!
const profileSelectCards = document.querySelector<HTMLDivElement>('#profile-select-cards')!
const windowSillSection = document.querySelector<HTMLDivElement>('#window-sill-section')!
const windowBasementRow = document.querySelector<HTMLLabelElement>('#window-basement-row')!
const windowBasementEnabled = document.querySelector<HTMLInputElement>('#window-basement-enabled')!
const windowBasementGrilleOptions = document.querySelector<HTMLElement>('#window-basement-grille-options')!
const windowBasementGrilleHeight = document.querySelector<HTMLInputElement>('#window-basement-grille-height')!
const windowBasementGrilleHeightOut = document.querySelector<HTMLOutputElement>(
  '#window-basement-grille-height-out',
)!
const sillOuterEnabled = document.querySelector<HTMLInputElement>('#sill-outer-enabled')!
const sillInnerEnabled = document.querySelector<HTMLInputElement>('#sill-inner-enabled')!
const sillInnerOverhang = document.querySelector<HTMLInputElement>('#sill-inner-overhang')!
const sillInnerDepth = document.querySelector<HTMLInputElement>('#sill-inner-depth')!
const sillInnerThickness = document.querySelector<HTMLInputElement>('#sill-inner-thickness')!
const sillOuterOverhang = document.querySelector<HTMLInputElement>('#sill-outer-overhang')!
const sillOuterDepth = document.querySelector<HTMLInputElement>('#sill-outer-depth')!
const sillOuterThickness = document.querySelector<HTMLInputElement>('#sill-outer-thickness')!
const sillOuterAngle = document.querySelector<HTMLInputElement>('#sill-outer-angle')!
const sillOuterScale = document.querySelector<HTMLInputElement>('#sill-outer-scale')!
const sillOuterProfileCards = document.querySelector<HTMLDivElement>('#sill-outer-profile-cards')!
const sillOuterProfileOptions = document.querySelector<HTMLDivElement>('#sill-outer-profile-options')!
const sillOuterColorSwatches = document.querySelector<HTMLDivElement>('#sill-outer-color-swatches')!
const sillOuterCornerJoin = document.querySelector<HTMLSelectElement>('#sill-outer-corner-join')!
const sillOuterSectionPreview = document.querySelector<SVGSVGElement>('#sill-outer-section-preview')!
const sillOuterRotateCcw = document.querySelector<HTMLButtonElement>('#sill-outer-rotate-ccw')!
const sillOuterRotateCw = document.querySelector<HTMLButtonElement>('#sill-outer-rotate-cw')!
const sillOuterFlipOutward = document.querySelector<HTMLButtonElement>('#sill-outer-flip-outward')!
const sillOuterFlipForward = document.querySelector<HTMLButtonElement>('#sill-outer-flip-forward')!
const pedimentEnabled = document.querySelector<HTMLInputElement>('#pediment-enabled')!
const pedimentOptions = document.querySelector<HTMLDivElement>('#pediment-options')!
const pedimentFormCards = document.querySelector<HTMLDivElement>('#pediment-form-cards')!
const pedimentProfileCards = document.querySelector<HTMLDivElement>('#pediment-profile-cards')!
const pedimentConsoleOptions = document.querySelector<HTMLDivElement>('#pediment-console-options')!
const pedimentConsoleCards = document.querySelector<HTMLDivElement>('#pediment-console-cards')!
const pedimentOverhang = document.querySelector<HTMLInputElement>('#pediment-overhang')!
const pedimentGableHeight = document.querySelector<HTMLInputElement>('#pediment-gable-height')!
const pedimentGableLabel = document.querySelector<HTMLLabelElement>('#pediment-gable-label')!
const pedimentGableSizeRow = document.querySelector<HTMLDivElement>('#pediment-gable-size-row')!
const pedimentGableWidth = document.querySelector<HTMLInputElement>('#pediment-gable-width')!
const pedimentGableWidthLabel = document.querySelector<HTMLLabelElement>('#pediment-gable-width-label')!
const pedimentSideArmWidth = document.querySelector<HTMLInputElement>('#pediment-side-arm-width')!
const pedimentSideArmLabel = document.querySelector<HTMLLabelElement>('#pediment-side-arm-label')!
const pedimentSideArmsRow = document.querySelector<HTMLLabelElement>('#pediment-side-arms-row')!
const pedimentSideArmsEnabled = document.querySelector<HTMLInputElement>('#pediment-side-arms-enabled')!
const pedimentScale = document.querySelector<HTMLInputElement>('#pediment-scale')!
const pedimentExtentOut = document.querySelector<HTMLInputElement>('#pediment-extent-out')!
const pedimentExtentForward = document.querySelector<HTMLInputElement>('#pediment-extent-forward')!
const pedimentOffsetUp = document.querySelector<HTMLInputElement>('#pediment-offset-up')!
const pedimentOffsetForward = document.querySelector<HTMLInputElement>('#pediment-offset-forward')!
const pedimentColorSwatches = document.querySelector<HTMLDivElement>('#pediment-color-swatches')!
const pedimentConsolesEnabled = document.querySelector<HTMLInputElement>('#pediment-consoles-enabled')!
const pedimentConsoleWallOffset = document.querySelector<HTMLInputElement>('#pediment-console-wall-offset')!
const taperedFieldEnabled = document.querySelector<HTMLInputElement>('#tapered-field-enabled')!
const taperedFieldOptions = document.querySelector<HTMLDivElement>('#tapered-field-options')!
const taperedFieldCourses = document.querySelector<HTMLInputElement>('#tapered-field-courses')!
const taperedFieldOverhang = document.querySelector<HTMLInputElement>('#tapered-field-overhang')!
const taperedFieldRatio = document.querySelector<HTMLInputElement>('#tapered-field-ratio')!
const taperedFieldOffsetUp = document.querySelector<HTMLInputElement>('#tapered-field-offset-up')!
const taperedFieldInvert = document.querySelector<HTMLInputElement>('#tapered-field-invert')!
const openingWidthInput = document.querySelector<HTMLInputElement>('#opening-width')!
const openingHeightInput = document.querySelector<HTMLInputElement>('#opening-height')!
const openingFillMode = document.querySelector<HTMLSelectElement>('#opening-fill-mode')!
const openingTypeSection = document.querySelector<HTMLDivElement>('#opening-type-section')!
const openingTypeSelect = document.querySelector<HTMLSelectElement>('#opening-type-select')!
const openingCutoutShapeRow = document.querySelector<HTMLDivElement>('#opening-cutout-shape-row')!
const openingCutoutShape = document.querySelector<HTMLSelectElement>('#opening-cutout-shape')!
const openingNicheDepthRow = document.querySelector<HTMLDivElement>('#opening-niche-depth-row')!
const openingNicheDepth = document.querySelector<HTMLInputElement>('#opening-niche-depth')!
const openingRevealFrameEnabled = document.querySelector<HTMLInputElement>('#opening-reveal-frame-enabled')!
const openingRevealFrameOptions = document.querySelector<HTMLDivElement>('#opening-reveal-frame-options')!
const openingRevealEmbed = document.querySelector<HTMLInputElement>('#opening-reveal-embed')!
const openingRevealInset = document.querySelector<HTMLInputElement>('#opening-reveal-inset')!
const openingPanelClearanceEnabled = document.querySelector<HTMLInputElement>('#opening-panel-clearance-enabled')!
const openingPanelClearanceOptions = document.querySelector<HTMLDivElement>('#opening-panel-clearance-options')!
const openingPanelClearanceCm = document.querySelector<HTMLInputElement>('#opening-panel-clearance-cm')!
const openingPanelClearanceDepth = document.querySelector<HTMLInputElement>('#opening-panel-clearance-depth')!
const openingPanelClearanceFinish = document.querySelector<HTMLSelectElement>('#opening-panel-clearance-finish')!
const openingPanelClearanceFinishLabel = document.querySelector<HTMLSpanElement>('#opening-panel-clearance-finish-label')!
const openingArchEnabled = document.querySelector<HTMLInputElement>('#opening-arch-enabled')!
const openingArchFormCards = document.querySelector<HTMLDivElement>('#opening-arch-form-cards')!
const openingArchRiseRow = document.querySelector<HTMLDivElement>('#opening-arch-rise-row')!
const openingArchRise = document.querySelector<HTMLInputElement>('#opening-arch-rise')!
const openingArchRiseAuto = document.querySelector<HTMLButtonElement>('#opening-arch-rise-auto')!
const openingArchOptions = document.querySelector<HTMLDivElement>('#opening-arch-options')!
const openingArchVoussoirs = document.querySelector<HTMLInputElement>('#opening-arch-voussoirs')!
const openingArchPreview = document.querySelector<SVGSVGElement>('#opening-arch-preview')!
const openingArchVoussoirOpts = document.querySelector<HTMLDivElement>('#opening-arch-voussoir-opts')!
const openingArchJambs = document.querySelector<HTMLInputElement>('#opening-arch-jambs')!
const openingArchJambOpts = document.querySelector<HTMLDivElement>('#opening-arch-jamb-opts')!
const openingArchJambCount = document.querySelector<HTMLInputElement>('#opening-arch-jamb-count')!
const openingArchJambCountAuto = document.querySelector<HTMLButtonElement>('#opening-arch-jamb-count-auto')!
const openingArchCount = document.querySelector<HTMLInputElement>('#opening-arch-count')!
const openingArchCountAuto = document.querySelector<HTMLButtonElement>('#opening-arch-count-auto')!
const openingArchRing = document.querySelector<HTMLInputElement>('#opening-arch-ring')!
const openingArchRingAuto = document.querySelector<HTMLButtonElement>('#opening-arch-ring-auto')!
const openingArchThetaStart = document.querySelector<HTMLInputElement>('#opening-arch-theta-start')!
const openingArchThetaEnd = document.querySelector<HTMLInputElement>('#opening-arch-theta-end')!
const openingArchSpandrel = document.querySelector<HTMLSelectElement>('#opening-arch-spandrel')!
const openingPosX = document.querySelector<HTMLInputElement>('#opening-pos-x')!
const openingPosY = document.querySelector<HTMLInputElement>('#opening-pos-y')!
const openingNudgeLeft = document.querySelector<HTMLButtonElement>('#opening-nudge-left')!
const openingNudgeRight = document.querySelector<HTMLButtonElement>('#opening-nudge-right')!
const openingNudgeUp = document.querySelector<HTMLButtonElement>('#opening-nudge-up')!
const openingNudgeDown = document.querySelector<HTMLButtonElement>('#opening-nudge-down')!
const doorStairsSection = document.querySelector<HTMLDivElement>('#door-stairs-section')!
const openingRollerShutterSection = document.querySelector<HTMLDivElement>('#opening-roller-shutter-section')!
const rollerShutterEnabled = document.querySelector<HTMLInputElement>('#roller-shutter-enabled')!
const rollerShutterOptions = document.querySelector<HTMLDivElement>('#roller-shutter-options')!
const rollerShutterDrop = document.querySelector<HTMLInputElement>('#roller-shutter-drop')!
const rollerShutterDropPct = document.querySelector<HTMLInputElement>('#roller-shutter-drop-pct')!
const rollerShutterDropLabel = document.querySelector<HTMLSpanElement>('#roller-shutter-drop-label')!
const rollerShutterColorSwatches = document.querySelector<HTMLDivElement>('#roller-shutter-color-swatches')!
const rollerShutterFinish = document.querySelector<HTMLSelectElement>('#roller-shutter-finish')!
const rollerShutterSlatHeight = document.querySelector<HTMLInputElement>('#roller-shutter-slat-height')!
const rollerShutterGap = document.querySelector<HTMLInputElement>('#roller-shutter-gap')!
const rollerShutterDuration = document.querySelector<HTMLInputElement>('#roller-shutter-duration')!
const rollerShutterPlayLower = document.querySelector<HTMLButtonElement>('#roller-shutter-play-lower')!
const rollerShutterPlayRaise = document.querySelector<HTMLButtonElement>('#roller-shutter-play-raise')!
const rollerShutterPlayCycle = document.querySelector<HTMLButtonElement>('#roller-shutter-play-cycle')!
const rollerShutterStop = document.querySelector<HTMLButtonElement>('#roller-shutter-stop')!
const stairsEnabled = document.querySelector<HTMLInputElement>('#stairs-enabled')!
const stairsCount = document.querySelector<HTMLInputElement>('#stairs-count')!
const stairsRise = document.querySelector<HTMLInputElement>('#stairs-rise')!
const stairsTread = document.querySelector<HTMLInputElement>('#stairs-tread')!
const stairsLandingDepth = document.querySelector<HTMLInputElement>('#stairs-landing-depth')!
const stairsExtend = document.querySelector<HTMLInputElement>('#stairs-extend')!
const stairsSplay = document.querySelector<HTMLInputElement>('#stairs-splay')!
const stairsOptions = document.querySelector<HTMLDivElement>('#stairs-options')!
const profileEdgeSection = document.querySelector<HTMLDivElement>('#profile-edge-section')!
const profileTrimSection = document.querySelector<HTMLDivElement>('#profile-trim-section')!
const profileEdgeButtons = document.querySelectorAll<HTMLButtonElement>('.profile-edge-btn')
const profileCornerJoinSelect = document.querySelector<HTMLSelectElement>('#profile-corner-join')!
const profileOffsetXInput = document.querySelector<HTMLInputElement>('#profile-offset-x')!
const profileOffsetYInput = document.querySelector<HTMLInputElement>('#profile-offset-y')!
const profileOffsetForwardInput = document.querySelector<HTMLInputElement>('#profile-offset-forward')!
const profileExtentOutInput = document.querySelector<HTMLInputElement>('#profile-extent-out')!
const profileExtentForwardInput = document.querySelector<HTMLInputElement>('#profile-extent-forward')!
const profileSectionPreview = document.querySelector<SVGSVGElement>('#profile-section-preview')!
const profileRotateCcwButton = document.querySelector<HTMLButtonElement>('#profile-rotate-ccw')!
const profileRotateCwButton = document.querySelector<HTMLButtonElement>('#profile-rotate-cw')!
const profileFlipOutwardButton = document.querySelector<HTMLButtonElement>('#profile-flip-outward')!
const profileFlipForwardButton = document.querySelector<HTMLButtonElement>('#profile-flip-forward')!
const trimColorSwatches = document.querySelector<HTMLDivElement>('#trim-color-swatches')!
const trimColorSwatchesHub = document.querySelector<HTMLDivElement>('#trim-color-swatches-hub')!
const trimColorHubSection = document.querySelector<HTMLDivElement>('#trim-color-hub-section')!
const sillOuterColorSwatchesHub = document.querySelector<HTMLDivElement>('#sill-outer-color-swatches-hub')!
const sillOuterColorHubSection = document.querySelector<HTMLDivElement>('#sill-outer-color-hub-section')!
const pedimentColorSwatchesHub = document.querySelector<HTMLDivElement>('#pediment-color-swatches-hub')!
const pedimentColorHubSection = document.querySelector<HTMLDivElement>('#pediment-color-hub-section')!
const deleteWallButton = document.querySelector<HTMLButtonElement>('#delete-wall')!
const duplicateWallButton = document.querySelector<HTMLButtonElement>('#duplicate-wall')!
const deleteOpeningButton = document.querySelector<HTMLButtonElement>('#delete-opening')!
const duplicateOpeningButton = document.querySelector<HTMLButtonElement>('#duplicate-opening')!
const resetOpeningButton = document.querySelector<HTMLButtonElement>('#reset-opening')!
const openingModelSelect = document.querySelector<HTMLSelectElement>('#opening-model-select')!
const windowStyleSection = document.querySelector<HTMLDivElement>('#window-style-section')!
const windowStylePreview = document.querySelector<SVGSVGElement>('#window-style-preview')!
const windowTransomInput = document.querySelector<HTMLInputElement>('#window-transom')!
const windowTransomOptions = document.querySelector<HTMLDivElement>('#window-transom-options')!
const windowTransomRatioInput = document.querySelector<HTMLInputElement>('#window-transom-ratio')!
const windowCasementButtons = document.querySelectorAll<HTMLButtonElement>('#window-casement-group .preset-btn')
const windowTransomBarsButtons = document.querySelectorAll<HTMLButtonElement>('#window-transom-bars-group .preset-btn')
const windowSplitVCountButtons = document.querySelectorAll<HTMLButtonElement>('#window-split-v-count-group .preset-btn')
const windowSplitVRatioButtons = document.querySelectorAll<HTMLButtonElement>('#window-split-v-ratio-group .preset-btn')
const windowSplitVRatioGroup = document.querySelector<HTMLElement>('#window-split-v-ratio-group')!
const windowSplitHCountButtons = document.querySelectorAll<HTMLButtonElement>('#window-split-h-count-group .preset-btn')
const windowSplitHRatioButtons = document.querySelectorAll<HTMLButtonElement>('#window-split-h-ratio-group .preset-btn')
const windowSplitHRatioGroup = document.querySelector<HTMLElement>('#window-split-h-ratio-group')!
const windowPanelSection = document.querySelector<HTMLElement>('#window-panel-section')!
const windowBottomPanelInput = document.querySelector<HTMLInputElement>('#window-bottom-panel')!
const windowPanelRatioGroup = document.querySelector<HTMLElement>('#window-panel-ratio-group')!
const windowPanelRatioButtons = document.querySelectorAll<HTMLButtonElement>('#window-panel-ratio-group .preset-btn')
const windowMuntinSection = document.querySelector<HTMLElement>('#window-muntin-section')!
const windowMuntinVButtons = document.querySelectorAll<HTMLButtonElement>('#window-muntin-v-group .preset-btn')
const windowMuntinHButtons = document.querySelectorAll<HTMLButtonElement>('#window-muntin-h-group .preset-btn')
/** Mehrfachauswahl der Fensterteile in der Vorschau (Indizes in paneMuntins). */
let windowPaneSelection: number[] = []
const windowPresetSelect = document.querySelector<HTMLSelectElement>('#window-preset-select')!
const windowBoxInput = document.querySelector<HTMLInputElement>('#window-box')!
const windowBoxOptions = document.querySelector<HTMLElement>('#window-box-options')!
const windowInnerFrameColor = document.querySelector<HTMLInputElement>('#window-inner-frame-color')!
const windowProfiledBars = document.querySelector<HTMLInputElement>('#window-profiled-bars')!
const windowHardware = document.querySelector<HTMLInputElement>('#window-hardware')!
const windowTimberBlend = document.querySelector<HTMLInputElement>('#window-timber-blend')!
const windowTimberSash = document.querySelector<HTMLInputElement>('#window-timber-sash')!
const windowTimberMuntin = document.querySelector<HTMLInputElement>('#window-timber-muntin')!
const windowTimberKaempfer = document.querySelector<HTMLInputElement>('#window-timber-kaempfer')!
const windowTimberStulp = document.querySelector<HTMLInputElement>('#window-timber-stulp')!
const windowHingeModeList = document.querySelector<HTMLDivElement>('#window-hinge-mode-list')!
const windowGuardEnabled = document.querySelector<HTMLInputElement>('#window-guard-enabled')!
const windowGuardOptions = document.querySelector<HTMLElement>('#window-guard-options')!
const windowGuardMode = document.querySelector<HTMLSelectElement>('#window-guard-mode')!
const windowGuardSpacing = document.querySelector<HTMLInputElement>('#window-guard-spacing')!
const windowGuardHeight = document.querySelector<HTMLInputElement>('#window-guard-height')!
const windowShadeEnabled = document.querySelector<HTMLInputElement>('#window-shade-enabled')!
const windowShadeOptions = document.querySelector<HTMLElement>('#window-shade-options')!
const windowShadeMode = document.querySelector<HTMLSelectElement>('#window-shade-mode')!
const windowShadeDrop = document.querySelector<HTMLInputElement>('#window-shade-drop')!
const windowDoorExtras = document.querySelector<HTMLElement>('#window-door-extras')!
const windowDoorCassettes = document.querySelector<HTMLSelectElement>('#window-door-cassettes')!
const windowDoorHandle = document.querySelector<HTMLInputElement>('#window-door-handle')!
const windowDoorLetter = document.querySelector<HTMLInputElement>('#window-door-letter')!
const windowOpenGroup = document.querySelector<HTMLDivElement>('#window-open-group')!
const undoButton = document.querySelector<HTMLButtonElement>('#undo')!
const redoButton = document.querySelector<HTMLButtonElement>('#redo')!
const saveJsonButton = document.querySelector<HTMLButtonElement>('#save-json')!
const loadJsonButton = document.querySelector<HTMLButtonElement>('#load-json')!
const copyLinkButton = document.querySelector<HTMLButtonElement>('#copy-link')!
const loadJsonInput = document.querySelector<HTMLInputElement>('#load-json-input')!
const shareStatus = document.querySelector<HTMLParagraphElement>('#share-status')!
const wallColorSwatches = document.querySelector<HTMLDivElement>('#wall-color-swatches')!
const profileColorSwatches = document.querySelector<HTMLDivElement>('#profile-color-swatches')!
const frameColorSwatches = document.querySelector<HTMLDivElement>('#frame-color-swatches')!
const frameColorSection = document.querySelector<HTMLDivElement>('#frame-color-section')!
const frameColorSectionStudio = document.querySelector<HTMLDivElement>('#frame-color-section-studio')!
const frameColorSwatchesStudio = document.querySelector<HTMLDivElement>('#frame-color-swatches-studio')!
const frameColorSectionWall = document.querySelector<HTMLDivElement>('#frame-color-section-wall')!
const frameColorSwatchesWall = document.querySelector<HTMLDivElement>('#frame-color-swatches-wall')!
const glassColorSectionStudio = document.querySelector<HTMLDivElement>('#glass-color-section-studio')!
const glassColorSwatchesStudio = document.querySelector<HTMLDivElement>('#glass-color-swatches-studio')!
const glassColorSectionWall = document.querySelector<HTMLDivElement>('#glass-color-section-wall')!
const glassColorSwatchesWall = document.querySelector<HTMLDivElement>('#glass-color-swatches-wall')!
const glassColorSection = document.querySelector<HTMLDivElement>('#glass-color-section')!
const glassColorSwatches = document.querySelector<HTMLDivElement>('#glass-color-swatches')!
const revealExteriorColorSection = document.querySelector<HTMLDivElement>(
  '#reveal-exterior-color-section',
)!
const revealExteriorColorSwatches = document.querySelector<HTMLDivElement>(
  '#reveal-exterior-color-swatches',
)!
const revealInteriorColorSection = document.querySelector<HTMLDivElement>(
  '#reveal-interior-color-section',
)!
const revealInteriorColorSwatches = document.querySelector<HTMLDivElement>(
  '#reveal-interior-color-swatches',
)!
const glassPhysicalSection = document.querySelector<HTMLDivElement>('#glass-physical-section')!
const glassModePhysical = document.querySelector<HTMLInputElement>('#glass-mode-physical')!
const glassPhysicalOptions = document.querySelector<HTMLDivElement>('#glass-physical-options')!
const glassIorInput = document.querySelector<HTMLInputElement>('#glass-ior')!
const glassRoughnessInput = document.querySelector<HTMLInputElement>('#glass-roughness')!
const glassTransmissionInput = document.querySelector<HTMLInputElement>('#glass-transmission')!
const glassThicknessInput = document.querySelector<HTMLInputElement>('#glass-thickness')!
const studioPanelOptions = document.querySelector<HTMLDivElement>('#studio-panel-options')!
const studioJointsSection = document.querySelector<HTMLDivElement>('#studio-joints-section')!
const studioJointOptions = document.querySelector<HTMLDivElement>('#studio-joint-options')!
const studioJointColorRow = document.querySelector<HTMLDivElement>('#studio-joint-color-row')!
const studioTaperSection = document.querySelector<HTMLDivElement>('#studio-taper-section')!
const studioTaperOptions = document.querySelector<HTMLDivElement>('#studio-taper-options')!
const studioCorniceOptions = document.querySelector<HTMLDivElement>('#studio-cornice-options')!
const studioTrimBandsList = document.querySelector<HTMLDivElement>('#studio-trim-bands-list')!
const studioTrimBandAdd = document.querySelector<HTMLButtonElement>('#studio-trim-band-add')!
const viewBtnTop = document.querySelector<HTMLButtonElement>('#view-btn-top')!
const viewBtnFront = document.querySelector<HTMLButtonElement>('#view-btn-front')!
const viewBtn3d = document.querySelector<HTMLButtonElement>('#view-btn-3d')!
const viewBtnExport = document.querySelector<HTMLButtonElement>('#view-btn-export')!
const viewBtnColor = document.querySelector<HTMLButtonElement>('#view-btn-color')!
const viewBtnLine = document.querySelector<HTMLButtonElement>('#view-btn-line')!
const viewModeButtons = [viewBtnTop, viewBtnFront, viewBtn3d, viewBtnExport]
const renderStyleButtons = [viewBtnColor, viewBtnLine]
let currentRenderStyle: 'color' | 'line' = 'color'
const navHelpButton = document.querySelector<HTMLButtonElement>('#nav-help-btn')!
const navHelpDialog = document.querySelector<HTMLDialogElement>('#nav-help-dialog')!
const appVersionBtn = document.querySelector<HTMLButtonElement>('#app-version-btn')!
const appCreditsBtn = document.querySelector<HTMLButtonElement>('#app-credits-btn')!
const creditsDialog = document.querySelector<HTMLDialogElement>('#credits-dialog')!
const creditsBody = document.querySelector<HTMLDivElement>('#credits-body')!
const releaseNotesDialog = document.querySelector<HTMLDialogElement>('#release-notes-dialog')!
const releaseNotesBody = document.querySelector<HTMLDivElement>('#release-notes-body')!
const releaseNotesRepoLink = document.querySelector<HTMLParagraphElement>('#release-notes-repo-link')!
const planSidebar = document.querySelector<HTMLDetailsElement>('#plan-sidebar')!
const planStatus = document.querySelector<HTMLSpanElement>('#plan-status')!
const planClearButton = document.querySelector<HTMLButtonElement>('#plan-clear')!
const planGenerateButton = document.querySelector<HTMLButtonElement>('#plan-generate')!
const planLabelLayer = document.querySelector<HTMLDivElement>('#plan-label-layer')!
const sunDateInput = document.querySelector<HTMLInputElement>('#sun-date')!
const sunTimeInput = document.querySelector<HTMLInputElement>('#sun-time')!
const sunAzimuthInput = document.querySelector<HTMLInputElement>('#sun-azimuth')!
const sunPathPlayButton = document.querySelector<HTMLButtonElement>('#sun-path-play')!
const sunPathStopButton = document.querySelector<HTMLButtonElement>('#sun-path-stop')!
const sunAnimUseCompass = document.querySelector<HTMLInputElement>('#sun-anim-use-compass')!
const sunAnimUseTime = document.querySelector<HTMLInputElement>('#sun-anim-use-time')!
const sunAnimCompassRow = document.querySelector<HTMLDivElement>('#sun-anim-compass-row')!
const sunAnimTimeRow = document.querySelector<HTMLDivElement>('#sun-anim-time-row')!
const sunAnimBothHint = document.querySelector<HTMLParagraphElement>('#sun-anim-both-hint')!
const sunAnimFromCompass = document.querySelector<HTMLSelectElement>('#sun-anim-from-compass')!
const sunAnimToCompass = document.querySelector<HTMLSelectElement>('#sun-anim-to-compass')!
const sunAnimFromTime = document.querySelector<HTMLInputElement>('#sun-anim-from-time')!
const sunAnimToTime = document.querySelector<HTMLInputElement>('#sun-anim-to-time')!
const sunAnimDuration = document.querySelector<HTMLInputElement>('#sun-anim-duration')!
const sunAnimHint = document.querySelector<HTMLParagraphElement>('#sun-anim-hint')!
const sunIntensityInput = document.querySelector<HTMLInputElement>('#sun-intensity')!
const sunSoftnessInput = document.querySelector<HTMLInputElement>('#sun-softness')!
const sunColorTempInput = document.querySelector<HTMLInputElement>('#sun-color-temp')!
const sunAmbientInput = document.querySelector<HTMLInputElement>('#sun-ambient')!
const sunShadowContrastInput = document.querySelector<HTMLInputElement>('#sun-shadow-contrast')!
const sunShadowDensityInput = document.querySelector<HTMLInputElement>('#sun-shadow-density')!
const sunAzimuthValue = document.querySelector<HTMLOutputElement>('#sun-azimuth-value')!
const sunTimeValue = document.querySelector<HTMLOutputElement>('#sun-time-value')!
const sunIntensityValue = document.querySelector<HTMLOutputElement>('#sun-intensity-value')!
const sunSoftnessValue = document.querySelector<HTMLOutputElement>('#sun-softness-value')!
const sunColorTempValue = document.querySelector<HTMLOutputElement>('#sun-color-temp-value')!
const sunAmbientValue = document.querySelector<HTMLOutputElement>('#sun-ambient-value')!
const sunShadowContrastValue = document.querySelector<HTMLOutputElement>('#sun-shadow-contrast-value')!
const sunShadowDensityValue = document.querySelector<HTMLOutputElement>('#sun-shadow-density-value')!
const attachButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-side]'),
)
const editScopeBar = document.querySelector<HTMLDivElement>('#edit-scope-bar')!
const editScopeElement = document.querySelector<HTMLButtonElement>('#edit-scope-element')!
const editScopeType = document.querySelector<HTMLButtonElement>('#edit-scope-type')!
const editScopeFloor = document.querySelector<HTMLButtonElement>('#edit-scope-floor')!
const editScopeFacade = document.querySelector<HTMLButtonElement>('#edit-scope-facade')!
const editScopeFacadeYaws = document.querySelector<HTMLDivElement>('#edit-scope-facade-yaws')!
const viewShowCeiling = document.querySelector<HTMLInputElement>('#view-show-ceiling')
const viewShowIntermediateFloors = document.querySelector<HTMLInputElement>('#view-show-intermediate-floors')
const viewShowLightMarkers = document.querySelector<HTMLInputElement>('#view-show-light-markers')
const toolbarRoof = document.querySelector<HTMLDivElement>('#toolbar-roof')!
const toolbarCeiling = document.querySelector<HTMLDivElement>('#toolbar-ceiling')!
const toolbarSceneLight = document.querySelector<HTMLDivElement>('#toolbar-scene-light')!
const sceneLightXInput = document.querySelector<HTMLInputElement>('#scene-light-x')!
const sceneLightYInput = document.querySelector<HTMLInputElement>('#scene-light-y')!
const sceneLightZInput = document.querySelector<HTMLInputElement>('#scene-light-z')!
const sceneLightIntensityInput = document.querySelector<HTMLInputElement>('#scene-light-intensity')!
const sceneLightColorTempInput = document.querySelector<HTMLInputElement>('#scene-light-color-temp')!
const sceneLightColorTempValue = document.querySelector<HTMLOutputElement>('#scene-light-color-temp-value')!
const sceneLightColorSwatch = document.querySelector<HTMLSpanElement>('#scene-light-color-swatch')!
const sceneLightShowMarkerInput = document.querySelector<HTMLInputElement>('#scene-light-show-marker')!
const sceneLightMarkerSizeRow = document.querySelector<HTMLDivElement>('#scene-light-marker-size-row')!
const sceneLightMarkerSizeSlider = document.querySelector<HTMLInputElement>('#scene-light-marker-size')!
const sceneLightMarkerSizeNum = document.querySelector<HTMLInputElement>('#scene-light-marker-size-num')!
const sceneLightMarkerSizeValue = document.querySelector<HTMLOutputElement>('#scene-light-marker-size-value')!
const sceneLightDistanceInput = document.querySelector<HTMLInputElement>('#scene-light-distance')!
const sceneLightDecayInput = document.querySelector<HTMLInputElement>('#scene-light-decay')!
const sceneLightEnabledInput = document.querySelector<HTMLInputElement>('#scene-light-enabled')!
const sceneLightCastShadowInput = document.querySelector<HTMLInputElement>('#scene-light-cast-shadow')!
const sceneLightDepthSlider = document.querySelector<HTMLInputElement>('#scene-light-depth')!
const sceneLightDepthNum = document.querySelector<HTMLInputElement>('#scene-light-depth-num')!
const sceneLightDepthValue = document.querySelector<HTMLOutputElement>('#scene-light-depth-value')!
const sceneLightDeleteBtn = document.querySelector<HTMLButtonElement>('#scene-light-delete')!
const ceilingColorSwatches = document.querySelector<HTMLDivElement>('#ceiling-color-swatches')!
const roofShellOptions = document.querySelector<HTMLDivElement>('#roof-shell-options')!
const roofTilesOptions = document.querySelector<HTMLDivElement>('#roof-tiles-options')!
const roofGutterOptions = document.querySelector<HTMLDivElement>('#roof-gutter-options')!
const roofEnabled = document.querySelector<HTMLInputElement>('#roof-enabled')!
const roofOptions = document.querySelector<HTMLDivElement>('#roof-options')!
const roofPitchLower = document.querySelector<HTMLInputElement>('#roof-pitch-lower')!
const roofPitchUpper = document.querySelector<HTMLInputElement>('#roof-pitch-upper')!
const roofOverhang = document.querySelector<HTMLInputElement>('#roof-overhang')!
const roofRidgeHeight = document.querySelector<HTMLInputElement>('#roof-ridge-height')!
const roofTileProfile = document.querySelector<HTMLSelectElement>('#roof-tile-profile')!
const roofTileWidth = document.querySelector<HTMLInputElement>('#roof-tile-width')!
const roofTileHeight = document.querySelector<HTMLInputElement>('#roof-tile-height')!
const roofTileJoint = document.querySelector<HTMLInputElement>('#roof-tile-joint')!
const roofTileDepth = document.querySelector<HTMLInputElement>('#roof-tile-depth')!
const roofTileTaperDepth = document.querySelector<HTMLInputElement>('#roof-tile-taper-depth')!
const roofTileTaper = document.querySelector<HTMLInputElement>('#roof-tile-taper')!
const roofTileTaperValue = document.querySelector<HTMLOutputElement>('#roof-tile-taper-value')!
const roofTileColorSwatches = document.querySelector<HTMLDivElement>('#roof-tile-color-swatches')!
const roofGutter = document.querySelector<HTMLInputElement>('#roof-gutter')!
const roofHint = document.querySelector<HTMLParagraphElement>('#roof-hint')!
const buildingRotateCcw = document.querySelector<HTMLButtonElement>('#building-rotate-ccw')!
const buildingRotateCw = document.querySelector<HTMLButtonElement>('#building-rotate-cw')!
const sceneAllColorInput = document.querySelector<HTMLInputElement>('#scene-all-color')!
const sceneBgColorInput = document.querySelector<HTMLInputElement>('#scene-bg-color')!
const sceneGroundColorInput = document.querySelector<HTMLInputElement>('#scene-ground-color')!
const sceneSkyColorInput = document.querySelector<HTMLInputElement>('#scene-sky-color')!
const viewLineStrokeRow = document.querySelector<HTMLDivElement>('#view-line-stroke-row')!
const sceneLineStroke = document.querySelector<HTMLInputElement>('#scene-line-stroke')!
const sceneLineStrokeNum = document.querySelector<HTMLInputElement>('#scene-line-stroke-num')!
const sceneLineStrokeValue = document.querySelector<HTMLOutputElement>('#scene-line-stroke-value')!
const bloomEnabledInput = document.querySelector<HTMLInputElement>('#bloom-enabled')!
const bloomOptions = document.querySelector<HTMLDivElement>('#bloom-options')!
const bloomThreshold = document.querySelector<HTMLInputElement>('#bloom-threshold')!
const bloomThresholdNum = document.querySelector<HTMLInputElement>('#bloom-threshold-num')!
const bloomThresholdValue = document.querySelector<HTMLOutputElement>('#bloom-threshold-value')!
const bloomStrength = document.querySelector<HTMLInputElement>('#bloom-strength')!
const bloomStrengthNum = document.querySelector<HTMLInputElement>('#bloom-strength-num')!
const bloomStrengthValue = document.querySelector<HTMLOutputElement>('#bloom-strength-value')!
const bloomRadius = document.querySelector<HTMLInputElement>('#bloom-radius')!
const bloomRadiusNum = document.querySelector<HTMLInputElement>('#bloom-radius-num')!
const bloomRadiusValue = document.querySelector<HTMLOutputElement>('#bloom-radius-value')!
const bloomExposure = document.querySelector<HTMLInputElement>('#bloom-exposure')!
const bloomExposureNum = document.querySelector<HTMLInputElement>('#bloom-exposure-num')!
const bloomExposureValue = document.querySelector<HTMLOutputElement>('#bloom-exposure-value')!
const fogEnabledInput = document.querySelector<HTMLInputElement>('#fog-enabled')!
const perfOverlayEnabledInput = document.querySelector<HTMLInputElement>('#perf-overlay-enabled')!
const lodEnabledInput = document.querySelector<HTMLInputElement>('#lod-enabled')!
const lodOptions = document.querySelector<HTMLDivElement>('#lod-options')!
const lodPresetControls = document.querySelector<HTMLDivElement>('#lod-preset-controls')!
const lodPresetNavigationBtn = document.querySelector<HTMLButtonElement>('#lod-preset-navigation')!
const lodPresetBalancedBtn = document.querySelector<HTMLButtonElement>('#lod-preset-balanced')!
const lodPresetQualityBtn = document.querySelector<HTMLButtonElement>('#lod-preset-quality')!
const lodForceHighBtn = document.querySelector<HTMLButtonElement>('#lod-force-high')!
const lodTileHigh = document.querySelector<HTMLInputElement>('#lod-tile-high')!
const lodTileHighNum = document.querySelector<HTMLInputElement>('#lod-tile-high-num')!
const lodTileHighValue = document.querySelector<HTMLOutputElement>('#lod-tile-high-value')!
const lodTileMedium = document.querySelector<HTMLInputElement>('#lod-tile-medium')!
const lodTileMediumNum = document.querySelector<HTMLInputElement>('#lod-tile-medium-num')!
const lodTileMediumValue = document.querySelector<HTMLOutputElement>('#lod-tile-medium-value')!
const lodBuildingFar = document.querySelector<HTMLInputElement>('#lod-building-far')!
const lodBuildingFarNum = document.querySelector<HTMLInputElement>('#lod-building-far-num')!
const lodBuildingFarValue = document.querySelector<HTMLOutputElement>('#lod-building-far-value')!
const lodSimplifyFacadeInput = document.querySelector<HTMLInputElement>('#lod-simplify-facade')!
const lodSimplifyWindowsInput = document.querySelector<HTMLInputElement>('#lod-simplify-windows')!
const lodSimplifyProfilesInput = document.querySelector<HTMLInputElement>('#lod-simplify-profiles')!
const lodSimplifyRevealsInput = document.querySelector<HTMLInputElement>('#lod-simplify-reveals')!
const lodSimplifyFarHullInput = document.querySelector<HTMLInputElement>('#lod-simplify-far-hull')!
const fogOptions = document.querySelector<HTMLDivElement>('#fog-options')!
const fogTypeSelect = document.querySelector<HTMLSelectElement>('#fog-type')!
const fogColorInput = document.querySelector<HTMLInputElement>('#fog-color')!
const fogLinearOptions = document.querySelector<HTMLDivElement>('#fog-linear-options')!
const fogExpOptions = document.querySelector<HTMLDivElement>('#fog-exp-options')!
const fogNear = document.querySelector<HTMLInputElement>('#fog-near')!
const fogNearNum = document.querySelector<HTMLInputElement>('#fog-near-num')!
const fogNearValue = document.querySelector<HTMLOutputElement>('#fog-near-value')!
const fogFar = document.querySelector<HTMLInputElement>('#fog-far')!
const fogFarNum = document.querySelector<HTMLInputElement>('#fog-far-num')!
const fogFarValue = document.querySelector<HTMLOutputElement>('#fog-far-value')!
const fogDensity = document.querySelector<HTMLInputElement>('#fog-density')!
const fogDensityNum = document.querySelector<HTMLInputElement>('#fog-density-num')!
const fogDensityValue = document.querySelector<HTMLOutputElement>('#fog-density-value')!
const studioOpeningJoinMiter = document.querySelector<HTMLInputElement>('#studio-opening-join-miter')!
const studioStretchStartMinus = document.querySelector<HTMLButtonElement>('#studio-stretch-start-minus')!
const studioStretchStartPlus = document.querySelector<HTMLButtonElement>('#studio-stretch-start-plus')!
const studioStretchEndMinus = document.querySelector<HTMLButtonElement>('#studio-stretch-end-minus')!
const studioStretchEndPlus = document.querySelector<HTMLButtonElement>('#studio-stretch-end-plus')!
const studioHeightMinus = document.querySelector<HTMLButtonElement>('#studio-height-minus')!
const studioHeightPlus = document.querySelector<HTMLButtonElement>('#studio-height-plus')!
const studioWallHeightInput = document.querySelector<HTMLInputElement>('#studio-wall-height')!
const studioWallDepthInput = document.querySelector<HTMLInputElement>('#studio-wall-depth')!
const studioWallYawInput = document.querySelector<HTMLInputElement>('#studio-wall-yaw')!
const studioWallYawMinus = document.querySelector<HTMLButtonElement>('#studio-wall-yaw-minus')!
const studioWallYawPlus = document.querySelector<HTMLButtonElement>('#studio-wall-yaw-plus')!
const studioEndPieceSection = document.querySelector<HTMLDivElement>('#studio-end-piece-section')!
const studioEndPieceAngle = document.querySelector<HTMLInputElement>('#studio-end-piece-angle')!
const studioEndPieceMinus = document.querySelector<HTMLButtonElement>('#studio-end-piece-minus')!
const studioEndPiecePlus = document.querySelector<HTMLButtonElement>('#studio-end-piece-plus')!
const studioEndPieceRemove = document.querySelector<HTMLButtonElement>('#studio-end-piece-remove')!
const studioPatternPanelCards = document.querySelector<HTMLDivElement>('#studio-pattern-panel-cards')!
const studioPatternMasonryCards = document.querySelector<HTMLDivElement>('#studio-pattern-masonry-cards')!
const roofTilePatternCards = document.querySelector<HTMLDivElement>('#roof-tile-pattern-cards')!
const studioCornerJoinSelect = document.querySelector<HTMLSelectElement>('#studio-corner-join')!
const studioEndBossSection = document.querySelector<HTMLDivElement>('#studio-end-boss-section')!
const studioEndBossStartRow = document.querySelector<HTMLDivElement>('#studio-end-boss-start-row')!
const studioEndBossEndRow = document.querySelector<HTMLDivElement>('#studio-end-boss-end-row')!
const studioEndBossStart = document.querySelector<HTMLSelectElement>('#studio-end-boss-start')!
const studioEndBossEnd = document.querySelector<HTMLSelectElement>('#studio-end-boss-end')!
const studioEndBossStartJoin = document.querySelector<HTMLSelectElement>('#studio-end-boss-start-join')!
const studioEndBossEndJoin = document.querySelector<HTMLSelectElement>('#studio-end-boss-end-join')!
const studioJointInput = document.querySelector<HTMLInputElement>('#studio-joint')!
const studioPanelWidthInput = document.querySelector<HTMLInputElement>('#studio-panel-width')!
const studioPanelWidthRow = document.querySelector<HTMLDivElement>('#studio-panel-width-row')!
const studioPanelHeightInput = document.querySelector<HTMLInputElement>('#studio-panel-height')!
const studioCladdingTwoBands = document.querySelector<HTMLInputElement>('#studio-cladding-two-bands')!
const studioCladdingTwoBandsOptions = document.querySelector<HTMLDivElement>('#studio-cladding-two-bands-options')!
const studioCladdingSplitY = document.querySelector<HTMLInputElement>('#studio-cladding-split-y')!
const studioCladdingWidthLower = document.querySelector<HTMLInputElement>('#studio-cladding-width-lower')!
const studioCladdingWidthUpper = document.querySelector<HTMLInputElement>('#studio-cladding-width-upper')!
const studioHideRowsBottomInput = document.querySelector<HTMLInputElement>('#studio-hide-rows-bottom')!
const studioHideRowsTopInput = document.querySelector<HTMLInputElement>('#studio-hide-rows-top')!
const studioProjectDepthInput = document.querySelector<HTMLInputElement>('#studio-project-depth')!
const studioTileColorSection = document.querySelector<HTMLDivElement>('#studio-tile-color-section')!
const studioTileVariance = document.querySelector<HTMLInputElement>('#studio-tile-variance')!
const studioTileVarianceValue = document.querySelector<HTMLOutputElement>('#studio-tile-variance-value')!
const studioTileVariety = document.querySelector<HTMLInputElement>('#studio-tile-variety')!
const studioTileVarietyValue = document.querySelector<HTMLOutputElement>('#studio-tile-variety-value')!
const studioTileVarietyRow = document.querySelector<HTMLDivElement>('#studio-tile-variety-row')!
const studioPlinthEnabled = document.querySelector<HTMLInputElement>('#studio-plinth-enabled')!
const studioPlinthOptions = document.querySelector<HTMLDivElement>('#studio-plinth-options')!
const studioPlinthHeightInput = document.querySelector<HTMLInputElement>('#studio-plinth-height')!
const studioPlinthColorSwatches = document.querySelector<HTMLDivElement>('#studio-plinth-color-swatches')!
const studioPlinthDepthInput = document.querySelector<HTMLInputElement>('#studio-plinth-depth')!
const studioPlinthDepthRow = document.querySelector<HTMLDivElement>('#studio-plinth-depth-row')!
const studioPlinthOffsetInput = document.querySelector<HTMLInputElement>('#studio-plinth-offset')!
const studioPlinthOffsetRow = document.querySelector<HTMLDivElement>('#studio-plinth-offset-row')!
const studioPlinthProfileCards = document.querySelector<HTMLDivElement>('#studio-plinth-profile-cards')!
const studioPlinthPreview = document.querySelector<SVGSVGElement>('#studio-plinth-preview')!
const studioPlinthProfileOptions = document.querySelector<HTMLDivElement>('#studio-plinth-profile-options')!
const studioPlinthProfileScale = document.querySelector<HTMLInputElement>('#studio-plinth-profile-scale')!
const studioPlinthProfileColorSwatches = document.querySelector<HTMLDivElement>('#studio-plinth-profile-color-swatches')!
const studioPlinthRotateCcw = document.querySelector<HTMLButtonElement>('#studio-plinth-rotate-ccw')!
const studioPlinthRotateCw = document.querySelector<HTMLButtonElement>('#studio-plinth-rotate-cw')!
const studioPlinthFlipOutward = document.querySelector<HTMLButtonElement>('#studio-plinth-flip-outward')!
const studioPlinthFlipForward = document.querySelector<HTMLButtonElement>('#studio-plinth-flip-forward')!
const profileScaleInput = document.querySelector<HTMLInputElement>('#profile-scale')!
const studioJointDepthInput = document.querySelector<HTMLInputElement>('#studio-joint-depth')!
const studioTaperInput = document.querySelector<HTMLInputElement>('#studio-taper')!
const studioTaperDepthInput = document.querySelector<HTMLInputElement>('#studio-taper-depth')!
const studioPanelsEnabled = document.querySelector<HTMLInputElement>('#studio-panels-enabled')!
const studioPanelsAlternate = document.querySelector<HTMLInputElement>('#studio-panels-alternate')!
const studioPanelsAlternateRow = document.querySelector<HTMLDivElement>('#studio-panels-alternate-row')!
const deleteWallStudioButton = document.querySelector<HTMLButtonElement>('#delete-wall-studio')!
const studioWallUnlinkButton = document.querySelector<HTMLButtonElement>('#studio-wall-unlink')!
const floorPlanExampleButton = document.querySelector<HTMLButtonElement>('#floor-plan-example')!
const jointColorSwatchesStudio = document.querySelector<HTMLDivElement>('#joint-color-swatches-studio')!
const validationHintStudio = document.querySelector<HTMLParagraphElement>('#validation-hint-studio')!
const wallColorSwatchesStudio = document.querySelector<HTMLDivElement>('#wall-color-swatches-studio')!
const interiorColorSwatchesStudio = document.querySelector<HTMLDivElement>('#interior-color-swatches-studio')!
const ceilingColorSwatchesStudio = document.querySelector<HTMLDivElement>('#ceiling-color-swatches-studio')!
const claddingColorSwatchesStudio = document.querySelector<HTMLDivElement>('#cladding-color-swatches-studio')!
const profileColorSwatchesStudio = document.querySelector<HTMLDivElement>('#profile-color-swatches-studio')!
const studioWallFinishSelect = document.querySelector<HTMLSelectElement>('#studio-wall-finish')!
const studioCladdingFinishSelect = document.querySelector<HTMLSelectElement>('#studio-cladding-finish')!
const studioProfileFinishSelect = document.querySelector<HTMLSelectElement>('#studio-profile-finish')!
const studioLabelFinishSelect = document.querySelector<HTMLSelectElement>('#studio-label-finish')!
const openingFrameFinishSelect = document.querySelector<HTMLSelectElement>('#opening-frame-finish')!
const openingTrimFinishSelect = document.querySelector<HTMLSelectElement>('#opening-trim-finish')!
const stairsColorSwatches = document.querySelector<HTMLDivElement>('#stairs-color-swatches')!
const stairsFinishSelect = document.querySelector<HTMLSelectElement>('#stairs-finish')!
const sillInnerColorSwatches = document.querySelector<HTMLDivElement>('#sill-inner-color-swatches')!
const sillInnerFinishSelect = document.querySelector<HTMLSelectElement>('#sill-inner-finish')!
const sillOuterFinishSelect = document.querySelector<HTMLSelectElement>('#sill-outer-finish')!
const pedimentFinishSelect = document.querySelector<HTMLSelectElement>('#pediment-finish')!
const studioCorniceFinishSelect = document.querySelector<HTMLSelectElement>('#studio-cornice-finish')!
const wallCorniceFinishSelect = document.querySelector<HTMLSelectElement>('#wall-cornice-finish')!
const moduleWallFinishSelect = document.querySelector<HTMLSelectElement>('#module-wall-finish')!
const moduleProfileFinishSelect = document.querySelector<HTMLSelectElement>('#module-profile-finish')!
const studioCorniceEnabled = document.querySelector<HTMLInputElement>('#studio-cornice-enabled')!
const studioCorniceTop = document.querySelector<HTMLButtonElement>('#studio-cornice-top')!
const studioCorniceBottom = document.querySelector<HTMLButtonElement>('#studio-cornice-bottom')!
const studioCorniceScale = document.querySelector<HTMLInputElement>('#studio-cornice-scale')!
const wallCorniceEnabled = document.querySelector<HTMLInputElement>('#wall-cornice-enabled')!
const wallCorniceTop = document.querySelector<HTMLButtonElement>('#wall-cornice-top')!
const wallCorniceBottom = document.querySelector<HTMLButtonElement>('#wall-cornice-bottom')!
const wallCorniceScale = document.querySelector<HTMLInputElement>('#wall-cornice-scale')!
const studioCorniceColorSwatches = document.querySelector<HTMLDivElement>('#studio-cornice-color-swatches')!
const wallCorniceColorSwatches = document.querySelector<HTMLDivElement>('#wall-cornice-color-swatches')!
const studioCorniceProfileCards = document.querySelector<HTMLDivElement>('#studio-cornice-profile-cards')!
const wallCorniceProfileCards = document.querySelector<HTMLDivElement>('#wall-cornice-profile-cards')!
const studioCornicePreview = document.querySelector<SVGSVGElement>('#studio-cornice-preview')!
const wallCornicePreview = document.querySelector<SVGSVGElement>('#wall-cornice-preview')!
const studioCorniceRotateCcw = document.querySelector<HTMLButtonElement>('#studio-cornice-rotate-ccw')!
const studioCorniceRotateCw = document.querySelector<HTMLButtonElement>('#studio-cornice-rotate-cw')!
const studioCorniceFlipOutward = document.querySelector<HTMLButtonElement>('#studio-cornice-flip-outward')!
const studioCorniceFlipForward = document.querySelector<HTMLButtonElement>('#studio-cornice-flip-forward')!
const wallCorniceRotateCcw = document.querySelector<HTMLButtonElement>('#wall-cornice-rotate-ccw')!
const wallCorniceRotateCw = document.querySelector<HTMLButtonElement>('#wall-cornice-rotate-cw')!
const wallCorniceFlipOutward = document.querySelector<HTMLButtonElement>('#wall-cornice-flip-outward')!
const wallCorniceFlipForward = document.querySelector<HTMLButtonElement>('#wall-cornice-flip-forward')!
const studioCorniceOffsetForward = document.querySelector<HTMLInputElement>('#studio-cornice-offset-forward')!
const wallCorniceOffsetForward = document.querySelector<HTMLInputElement>('#wall-cornice-offset-forward')!
const openingWindowDepthOffset = document.querySelector<HTMLInputElement>('#opening-window-depth-offset')!
const openingWindowDepthReset = document.querySelector<HTMLButtonElement>('#opening-window-depth-reset')!
const openingWindowDepthHint = document.querySelector<HTMLParagraphElement>('#opening-window-depth-hint')!
const openingWindowDepthSection = document.querySelector<HTMLDivElement>('#opening-window-depth-section')!
const studioStandardDepthRow = document.querySelector<HTMLDivElement>('#studio-standard-depth-row')!
const studioAlternateLayers = document.querySelector<HTMLDivElement>('#studio-alternate-layers')!
const studioLayer1ProjectDepth = document.querySelector<HTMLInputElement>('#studio-layer1-project-depth')!
const studioLayer1TaperDepth = document.querySelector<HTMLInputElement>('#studio-layer1-taper-depth')!
const studioLayer1Taper = document.querySelector<HTMLInputElement>('#studio-layer1-taper')!
const studioLayer2ProjectDepth = document.querySelector<HTMLInputElement>('#studio-layer2-project-depth')!
const studioLayer2TaperDepth = document.querySelector<HTMLInputElement>('#studio-layer2-taper-depth')!
const studioLayer2Taper = document.querySelector<HTMLInputElement>('#studio-layer2-taper')!
const studioLabelEnabled = document.querySelector<HTMLInputElement>('#studio-label-enabled')!
const studioLabelOptions = document.querySelector<HTMLDivElement>('#studio-label-options')!
const studioLabelText = document.querySelector<HTMLInputElement>('#studio-label-text')!
const studioLabelTextSave = document.querySelector<HTMLButtonElement>('#studio-label-text-save')!
const studioLabelHeight = document.querySelector<HTMLInputElement>('#studio-label-height')!
const studioLabelX = document.querySelector<HTMLInputElement>('#studio-label-x')!
const studioLabelY = document.querySelector<HTMLInputElement>('#studio-label-y')!
const studioLabelAlign = document.querySelector<HTMLSelectElement>('#studio-label-align')!
const studioLabelColorSwatches = document.querySelector<HTMLDivElement>('#studio-label-color-swatches')!
const studioLabelDepthFlat = document.querySelector<HTMLButtonElement>('#studio-label-depth-flat')!
const studioLabelDepthExtruded = document.querySelector<HTMLButtonElement>('#studio-label-depth-extruded')!
const studioLabelExtrudeRow = document.querySelector<HTMLDivElement>('#studio-label-extrude-row')!
const studioLabelExtrude = document.querySelector<HTMLInputElement>('#studio-label-extrude')!
const studioLabelOffsetForward = document.querySelector<HTMLInputElement>('#studio-label-offset-forward')!
const studioLabelFontCards = document.querySelector<HTMLDivElement>('#studio-label-font-cards')!
injectLabelFontFaces()

// Grundrisse pro Etage; currentFloor zeigt die aktive Etage.
let currentFloor = 0
let floorPlanMode: 'navigate' | 'draw' | 'edit' = 'navigate'
let planEditSelectedNodeId: string | null = null
let planEditSelectedEdgeId: string | null = null
let planEditDragNodeId: string | null = null
let planEditDragNodeStartGx = 0
let planEditDragNodeStartGz = 0
let planEditDragEdgeId: string | null = null
let planEditEdgeDragStartGx = 0
let planEditEdgeDragStartGz = 0

// Plan-Kamera-Navigation (Zoom und Pan).
let planZoom = 1
let planOffsetX = 0
let planOffsetZ = 0
/** Draufsicht: Bildschirm-Nord / Kompass-Ausrichtung (Grad). */
let topViewYawDeg = 0
let planPanActive = false
let planPanLastX = 0
let planPanLastZ = 0

// 2D-Front: Zoom und Pan (Ortho-Kamera, Pan in Bildschirmachsen wie OrbitControls).
let frontZoom = 1
/** Verschiebung entlang Kamera-rechts / Kamera-hoch (cm), nicht Fassaden-Yaw. */
let frontPanScreenX = 0
let frontPanScreenY = 0
let frontPanActive = false
let frontPanLastX = 0
let frontPanLastY = 0

/** Mausrad-Zoom: pro Frame bündeln (Trackpad liefert viele Events). */
let viewWheelRaf = 0
let viewWheelPending: {
  view: 'front' | 'top'
  deltaY: number
  clientX: number
  clientY: number
} | null = null

/** Gecachtes Front-Layout (Wand-Bounds) — Zoom/Pan nutzen nur noch die Cache-Werte. */
type FrontViewBase = {
  viewW: number
  viewH: number
  lookX: number
  lookY: number
  lookZ: number
  outwardX: number
  outwardZ: number
  layoutKey: string
}
let frontViewBaseCache: FrontViewBase | null = null

type ViewZoomAnimTarget = {
  frontZoom?: number
  frontPanX?: number
  frontPanY?: number
  planZoom?: number
  planOffsetX?: number
  planOffsetZ?: number
}

let viewZoomAnim: {
  view: 'front' | 'top'
  startTime: number
  duration: number
  from: ViewZoomAnimTarget
  to: ViewZoomAnimTarget
} | null = null
let viewZoomAnimRaf = 0

function invalidateFrontViewBase() {
  frontViewBaseCache = null
}

function cancelViewZoomAnim() {
  viewZoomAnim = null
  if (viewZoomAnimRaf) {
    cancelAnimationFrame(viewZoomAnimRaf)
    viewZoomAnimRaf = 0
  }
}

function frontViewLayoutKey(walls: Wall[], yaw: number, width: number, height: number): string {
  const facing = wallsForYaw(walls, yaw)
  const targetWalls = facing.length > 0 ? facing : walls
  const elevKey =
    currentElevation.kind === 'yaw'
      ? `yaw:${currentElevation.yaw}`
      : currentElevation.kind === 'wall'
        ? `wall:${currentElevation.wallId}`
        : 'auto'
  const wallKey = targetWalls
    .map(
      (wall) =>
        `${wall.id}:${wall.x}:${wall.y}:${wall.width}:${wall.height}:${wall.originX ?? ''}:${wall.originZ ?? ''}`,
    )
    .join('|')
  return `${elevKey}|${width}x${height}|${wallKey}`
}

function computeFrontViewBase(
  walls: Wall[],
  yaw: number,
  width: number,
  height: number,
): FrontViewBase | null {
  const pad = 48
  const aspect = width / height
  const facing = wallsForYaw(walls, yaw)
  const targetWalls = facing.length > 0 ? facing : walls
  if (targetWalls.length === 0) return null

  let minAlong = Infinity
  let maxAlong = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let cx = 0
  let cy = 0
  let cz = 0
  const yawRad = (yaw * Math.PI) / 180
  const alongX = Math.cos(yawRad)
  const alongZ = -Math.sin(yawRad)
  for (const wall of targetWalls) {
    const origin = { x: wall.originX ?? wall.x, z: wall.originZ ?? 0 }
    const t0 = origin.x * alongX + origin.z * alongZ
    minAlong = Math.min(minAlong, t0)
    maxAlong = Math.max(maxAlong, t0 + wall.width)
    minY = Math.min(minY, wall.y)
    maxY = Math.max(maxY, wall.y + wall.height)
    const tr = studioWallTransform(wall)
    cx += tr.position.x
    cy += tr.position.y
    cz += tr.position.z
  }
  const n = targetWalls.length
  cx /= n
  cy /= n
  cz /= n

  const elevW = Math.max(80, maxAlong - minAlong)
  const elevH = Math.max(80, maxY - minY)
  let viewW = elevW + pad * 2
  let viewH = elevH + pad * 2
  if (viewW / viewH > aspect) viewH = viewW / aspect
  else viewW = viewH * aspect

  const outward = facadeOutward(yaw, targetWalls[0]?.panelFlip ?? true)
  return {
    viewW,
    viewH,
    lookX: cx,
    lookY: (minY + maxY) / 2,
    lookZ: cz,
    outwardX: outward.x,
    outwardZ: outward.z,
    layoutKey: frontViewLayoutKey(walls, yaw, width, height),
  }
}

function getFrontViewBase(): FrontViewBase | null {
  const walls = wallsForElevation().filter(isStudioWall)
  const width = Math.max(1, viewportRenderWidth())
  const height = Math.max(1, viewportRenderHeight())

  let yaw = 0
  if (currentElevation.kind === 'yaw') yaw = currentElevation.yaw
  else if (currentElevation.kind === 'wall') {
    yaw = getWall(state, currentElevation.wallId)?.yawDeg ?? 0
  } else {
    const yaws = walls.map((wall) => wall.yawDeg ?? 0)
    yaw = yaws.sort((a, b) =>
      yaws.filter((v) => v === b).length - yaws.filter((v) => v === a).length,
    )[0] ?? 0
  }

  const layoutKey = frontViewLayoutKey(walls, yaw, width, height)
  if (frontViewBaseCache?.layoutKey === layoutKey) return frontViewBaseCache
  frontViewBaseCache = computeFrontViewBase(walls, yaw, width, height)
  return frontViewBaseCache
}

function frontFrustumHalfExtents(): { halfW: number; halfH: number } {
  const base = getFrontViewBase()
  if (!base) return { halfW: 200, halfH: 200 }
  const zoom = clampFrontZoom(frontZoom)
  return { halfW: base.viewW / zoom / 2, halfH: base.viewH / zoom / 2 }
}

function applyFrontCameraFromBase(
  base: FrontViewBase,
  opts?: { fitOnly?: boolean; panOnly?: boolean },
) {
  const useNav = opts?.fitOnly !== true
  const applyPan = useNav && opts?.panOnly !== true
  const zoom = useNav ? clampFrontZoom(frontZoom) : 1
  if (useNav) frontZoom = zoom
  const viewW = base.viewW / (useNav ? zoom : 1)
  const viewH = base.viewH / (useNav ? zoom : 1)
  const dist = Math.max(viewW, viewH) + 400

  frontCamera.left = -viewW / 2
  frontCamera.right = viewW / 2
  frontCamera.top = viewH / 2
  frontCamera.bottom = -viewH / 2
  frontCamera.near = 1
  frontCamera.far = dist * 4
  frontCamera.position.set(
    base.lookX + base.outwardX * dist,
    base.lookY,
    base.lookZ + base.outwardZ * dist,
  )
  frontCamera.up.set(0, 1, 0)
  frontCamera.lookAt(base.lookX, base.lookY, base.lookZ)
  frontCamera.updateProjectionMatrix()

  if (applyPan && (frontPanScreenX !== 0 || frontPanScreenY !== 0)) {
    frontCamera.updateMatrixWorld()
    frontCamera.matrixWorld.extractBasis(_frontPanRight, _frontPanUp, _frontPanForward)
    const px =
      _frontPanRight.x * frontPanScreenX + _frontPanUp.x * frontPanScreenY
    const py =
      _frontPanRight.y * frontPanScreenX + _frontPanUp.y * frontPanScreenY
    const pz =
      _frontPanRight.z * frontPanScreenX + _frontPanUp.z * frontPanScreenY
    frontCamera.position.x += px
    frontCamera.position.y += py
    frontCamera.position.z += pz
    frontCamera.lookAt(base.lookX + px, base.lookY + py, base.lookZ + pz)
    frontCamera.updateMatrixWorld()
  }
}

function tickViewZoomAnim() {
  viewZoomAnimRaf = 0
  const anim = viewZoomAnim
  if (!anim) return
  const t = Math.min(1, (performance.now() - anim.startTime) / anim.duration)
  const e = easeOutCubic(t)
  if (anim.view === 'front') {
    if (anim.from.frontZoom != null && anim.to.frontZoom != null) {
      frontZoom = lerpNumber(anim.from.frontZoom, anim.to.frontZoom, e)
    }
    if (anim.from.frontPanX != null && anim.to.frontPanX != null) {
      frontPanScreenX = lerpNumber(anim.from.frontPanX, anim.to.frontPanX, e)
    }
    if (anim.from.frontPanY != null && anim.to.frontPanY != null) {
      frontPanScreenY = lerpNumber(anim.from.frontPanY, anim.to.frontPanY, e)
    }
    syncFrontCamera()
  } else {
    if (anim.from.planZoom != null && anim.to.planZoom != null) {
      planZoom = lerpNumber(anim.from.planZoom, anim.to.planZoom, e)
    }
    if (anim.from.planOffsetX != null && anim.to.planOffsetX != null) {
      planOffsetX = lerpNumber(anim.from.planOffsetX, anim.to.planOffsetX, e)
    }
    if (anim.from.planOffsetZ != null && anim.to.planOffsetZ != null) {
      planOffsetZ = lerpNumber(anim.from.planOffsetZ, anim.to.planOffsetZ, e)
    }
    syncTopCamera2({ deferGrid: true })
  }
  markViewportDirty()
  if (t < 1) {
    viewZoomAnimRaf = requestAnimationFrame(tickViewZoomAnim)
  } else {
    viewZoomAnim = null
    if (anim.view === 'top') syncTopCamera2()
    scheduleOrbitLiteEnd()
  }
}

function startViewZoomAnim(view: 'front' | 'top', to: ViewZoomAnimTarget) {
  cancelViewZoomAnim()
  const from: ViewZoomAnimTarget =
    view === 'front'
      ? {
          frontZoom: frontZoom,
          frontPanX: frontPanScreenX,
          frontPanY: frontPanScreenY,
        }
      : {
          planZoom: planZoom,
          planOffsetX: planOffsetX,
          planOffsetZ: planOffsetZ,
        }
  viewZoomAnim = {
    view,
    startTime: performance.now(),
    duration: DBLCLICK_ZOOM_DURATION_MS,
    from,
    to,
  }
  beginViewNavLite()
  tickViewZoomAnim()
}

function planZoomTargetAtClient(
  clientX: number,
  clientY: number,
  factor: number,
): ViewZoomAnimTarget {
  const { nx, ny } = canvasNdcFromClient(clientX, clientY)
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  const aspect = width / Math.max(height, 1)
  const span = (PLAN_VIEW_SIZE + PLAN_GRID) / planZoom
  const halfW = span / 2
  const halfH = halfW / (aspect > 0 ? aspect : 1)
  const cx = PLAN_VIEW_SIZE / 2 + planOffsetX
  const cz = PLAN_VIEW_SIZE / 2 + planOffsetZ
  const worldX = cx + nx * halfW
  const worldZ = cz - ny * halfH

  const nextZoom = clampPlanZoom(planZoom * factor)
  const spanNew = (PLAN_VIEW_SIZE + PLAN_GRID) / nextZoom
  const halfWNew = spanNew / 2
  const halfHNew = halfWNew / (aspect > 0 ? aspect : 1)
  return {
    planZoom: nextZoom,
    planOffsetX: worldX - nx * halfWNew - PLAN_VIEW_SIZE / 2,
    planOffsetZ: worldZ + ny * halfHNew - PLAN_VIEW_SIZE / 2,
  }
}

function beginViewNavLite() {
  setOrbitLite(true)
  scheduleOrbitLiteEnd()
}

function canvasNdcFromClient(clientX: number, clientY: number): { nx: number; ny: number } {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  return {
    nx: ((clientX - rect.left) / width) * 2 - 1,
    ny: -((clientY - rect.top) / height) * 2 + 1,
  }
}

function zoomFrontAtNdc(nx: number, ny: number, factor: number) {
  cancelViewZoomAnim()
  const { halfW, halfH } = frontFrustumHalfExtents()
  const nextPan = zoomPanOffsetsAtCursor({
    nx,
    ny,
    factor,
    panX: frontPanScreenX,
    panY: frontPanScreenY,
    halfW,
    halfH,
  })
  frontZoom = clampFrontZoom(frontZoom * factor)
  frontPanScreenX = nextPan.panX
  frontPanScreenY = nextPan.panY
  syncFrontCamera()
}

function zoomPlanAtClient(clientX: number, clientY: number, factor: number) {
  cancelViewZoomAnim()
  const target = planZoomTargetAtClient(clientX, clientY, factor)
  planZoom = target.planZoom ?? planZoom
  planOffsetX = target.planOffsetX ?? planOffsetX
  planOffsetZ = target.planOffsetZ ?? planOffsetZ
  framePlanIfZoomedOut(factor)
  syncTopCamera2({ deferGrid: orbitLite })
}

function flushViewWheelZoom() {
  viewWheelRaf = 0
  const pending = viewWheelPending
  viewWheelPending = null
  if (!pending) return
  const factor = wheelZoomFactorFromDelta(pending.deltaY)
  if (Math.abs(factor - 1) < 1e-6) return
  if (pending.view === 'front') {
    const { nx, ny } = canvasNdcFromClient(pending.clientX, pending.clientY)
    zoomFrontAtNdc(nx, ny, factor)
  } else {
    zoomPlanAtClient(pending.clientX, pending.clientY, factor)
  }
}

function queueViewWheelZoom(event: WheelEvent, view: 'front' | 'top') {
  event.preventDefault()
  cancelViewZoomAnim()
  beginViewNavLite()
  const dy = normalizedWheelDeltaY(event.deltaY, event.deltaMode, viewportRenderHeight())
  if (viewWheelPending?.view === view) {
    viewWheelPending.deltaY += dy
    viewWheelPending.clientX = event.clientX
    viewWheelPending.clientY = event.clientY
  } else {
    viewWheelPending = { view, deltaY: dy, clientX: event.clientX, clientY: event.clientY }
  }
  if (!viewWheelRaf) {
    viewWheelRaf = requestAnimationFrame(flushViewWheelZoom)
  }
}
let planNavDragOpening: { wallId: string; openingId: string } | null = null
let planNavDragLast: { x: number; z: number } | null = null
let planNavDragStart: { x: number; z: number; openingX: number } | null = null
let planNavWallDrag: {
  seedWallIds: string[]
  lastWallIds: string[]
  startGx: number
  startGz: number
  startState: FacadeState
  lastDgx: number
  lastDgz: number
} | null = null
let planNavWallDragMoved = false

function canEditActiveBuildingNow(): boolean {
  return canEditActiveBuilding(state)
}

function canEditWallNow(wallId: string): boolean {
  return canEditWall(state, wallId)
}

function activeBuilding(facadeState: FacadeState = state) {
  return getActiveBuilding(facadeState)
}

function activeWallHeight(facadeState: FacadeState = state) {
  return activeBuilding(facadeState).wallHeight
}

function wallHeightForWall(wall: Wall, facadeState: FacadeState = state) {
  return findBuildingForWall(facadeState, wall.id)?.wallHeight ?? activeWallHeight(facadeState)
}

function getFloors(): FloorPlan[] {
  const floors = activeBuilding().floors
  return floors.length > 0 ? floors : [createEmptyFloorPlan()]
}

function currentFloorPlan(): FloorPlan {
  const floors = getFloors()
  return floors[currentFloor] ?? createEmptyFloorPlan()
}

function setFloorPlan(plan: FloorPlan) {
  if (!canEditActiveBuildingNow()) return
  const floors = [...getFloors()]
  while (floors.length <= currentFloor) floors.push(createEmptyFloorPlan())
  floors[currentFloor] = plan
  state = updateActiveBuilding(state, { floors })
  persistApp()
}

let floorPlan: FloorPlan = createEmptyFloorPlan()
let floorPlanDrawStart: { gx: number; gz: number } | null = null
let floorPlanDrawPreview: { gx: number; gz: number } | null = null
let floorPlanLoopStart: { gx: number; gz: number } | null = null
let floorPlanIsDrawing = false
const floorPlanView = new FloorPlanView(planLabelLayer)
siteOffset.add(floorPlanView.root)

const planModeNavBtn = document.querySelector<HTMLButtonElement>('#plan-mode-nav')!
const planModeDrawBtn = document.querySelector<HTMLButtonElement>('#plan-mode-draw')!
const planModeEditBtn = document.querySelector<HTMLButtonElement>('#plan-mode-edit')!
const floorSelect = document.querySelector<HTMLSelectElement>('#floor-select')!
const floorAddBtn = document.querySelector<HTMLButtonElement>('#floor-add')!
const floorRemoveBtn = document.querySelector<HTMLButtonElement>('#floor-remove')!

const editHistory = new EditHistory()
let pendingDragUndo: HistorySnapshot | null = null

function currentSnapshot(): HistorySnapshot {
  return { facade: state, editor }
}

function updateHistoryButtons() {
  undoButton.disabled = !editHistory.canUndo()
  redoButton.disabled = !editHistory.canRedo()
}

function beginDragUndo() {
  if (!pendingDragUndo) {
    pendingDragUndo = {
      facade: cloneFacadeState(state),
      editor: {
        selectedWallIds: [...editor.selectedWallIds],
        selectedOpenings: editor.selectedOpenings.map((ref) => ({ ...ref })),
        selectedEdges: [...editor.selectedEdges],
      },
    }
  }
}

function finishDragUndo() {
  if (pendingDragUndo) {
    editHistory.record(pendingDragUndo)
    pendingDragUndo = null
    updateHistoryButtons()
  }
}

function selectedWalls(): Wall[] {
  return editor.selectedWallIds
    .map((id) => getWall(state, id))
    .filter((wall): wall is Wall => Boolean(wall))
}

function scopedWallIds(): string[] {
  return editWallTargets(state, editor, editScope, editFacadeYawFilter)
}

function scopedOpeningRefs(): OpeningRef[] {
  return editOpeningTargets(state, editor, editScope, editFacadeYawFilter)
}

function selectedWindowOpeningRefsForWalls(wallIds: string[]): OpeningRef[] {
  const refs: OpeningRef[] = []
  for (const wallId of wallIds) {
    const wall = getWall(state, wallId)
    if (!wall) continue
    for (const opening of wall.openings) {
      if (opening.type === 'window' || opening.type === 'door') {
        refs.push({ wallId, openingId: opening.id })
      }
    }
  }
  return refs
}

function commitOpeningSillPatch(
  patch: Parameters<typeof updateOpeningSills>[2],
) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningSills(state, refs, patch))
}

function commitOpeningPedimentPatch(
  patch: Parameters<typeof updateOpeningPediment>[2],
) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningPediment(state, refs, patch))
}

function commitOpeningTaperedFieldPatch(
  patch: Parameters<typeof updateOpeningTaperedField>[2],
) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningTaperedField(state, refs, patch))
}


function selectionIsStudioWall(): boolean {
  const walls = selectedWalls()
  return walls.length > 0 && walls.every(isStudioWall)
}

function updateFloorPlanStatus() {
  if (floorPlanMode === 'navigate') {
    const hasWalls = activeBuilding().walls.some(isStudioWall)
    const hasPlan = currentFloorPlan().edges.length > 0
    if (!hasPlan && hasWalls) {
      planStatus.textContent =
        '3D-Wände der Etage. Zum Nachzeichnen: „Zeichnen“. Geschoss klonen: in 3D unter Ebenen.'
      return
    }
    planStatus.textContent = 'Navigieren: Ziehen verschiebt, Scroll zoomt · Öffnungen ziehen'
    return
  }
  if (floorPlanMode === 'edit') {
    planStatus.textContent = 'Bearbeiten: Punkt oder Wand ziehen · Entf löscht · gilt für alle Etagen'
    return
  }
  if (planHasClosedRing(floorPlan)) {
    planStatus.textContent = 'Form geschlossen – „Wände aus Grundriss bauen“'
    return
  }
  if (!floorPlanDrawStart) {
    planStatus.textContent = 'Ersten Punkt setzen (Klick)'
    return
  }
  const preview = floorPlanDrawPreview ?? floorPlanDrawStart
  if (
    wouldCloseFloorPlan(floorPlan, floorPlanDrawStart, preview, floorPlanLoopStart)
  ) {
    planStatus.textContent = 'Startpunkt treffen: Form schließen'
    return
  }
  if (preview.gx === floorPlanDrawStart.gx && preview.gz === floorPlanDrawStart.gz) {
    planStatus.textContent = floorPlanIsDrawing
      ? 'Loslassen zum Setzen …'
      : 'Nächsten Punkt klicken oder ziehen (Alt+Klick: neuer Start)'
    return
  }
  if (!isValidPlanLine(floorPlanDrawStart.gx, floorPlanDrawStart.gz, preview.gx, preview.gz)) {
    planStatus.textContent = 'Nur 0°, 45° oder 90°'
    return
  }
  const lengthCm = planLineLengthCm(
    floorPlanDrawStart.gx,
    floorPlanDrawStart.gz,
    preview.gx,
    preview.gz,
  )
  planStatus.textContent = `Länge: ${formatPlanLengthCm(lengthCm)}`
}

function refreshPlanDrawGuides() {
  if (!floorPlanDrawStart || !floorPlanDrawPreview) {
    floorPlanView.clearAlignGuides()
    return
  }
  const preview = {
    x: floorPlanDrawPreview.gx * PLAN_GRID,
    z: floorPlanDrawPreview.gz * PLAN_GRID,
  }
  const start = {
    x: floorPlanDrawStart.gx * PLAN_GRID,
    z: floorPlanDrawStart.gz * PLAN_GRID,
  }
  const refs: Array<{ x: number; z: number }> = []
  for (const node of floorPlan.nodes) {
    refs.push({ x: node.gx * PLAN_GRID, z: node.gz * PLAN_GRID })
  }
  const building = activeBuilding()
  const floorY = currentFloor * (building.wallHeight ?? 0)
  for (const wall of building.walls) {
    if (!isStudioWall(wall)) continue
    if (Math.abs((wall.y ?? 0) - floorY) > 1) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    refs.push({ x: s.x, z: s.z }, { x: e.x, z: e.z })
  }
  floorPlanView.showAlignGuides(collectPlanDrawGuides(preview, refs, start))
}

function rebuildFloorPlanOverlay(planOverride?: FloorPlan) {
  floorPlan = planOverride ?? currentFloorPlan()
  const preview =
    floorPlanDrawStart && floorPlanDrawPreview
      ? { start: floorPlanDrawStart, end: floorPlanDrawPreview }
      : null
  floorPlanView.rebuild(floorPlan, preview, floorPlanDrawStart)
  floorPlanView.setSelection(planEditSelectedNodeId, planEditSelectedEdgeId)
  rebuildPlanWallOverlay()
  refreshPlanDrawGuides()
  updateFloorPlanStatus()
  if (currentView === 'top') markViewportDirty()
}

function resetFloorPlanDrawing() {
  floorPlanDrawStart = null
  floorPlanDrawPreview = null
  floorPlanLoopStart = null
  floorPlanIsDrawing = false
  rebuildFloorPlanOverlay()
}

function commitFloorPlanStroke() {
  if (!floorPlanDrawStart) return
  let plan = currentFloorPlan()
  const end = floorPlanDrawPreview ?? floorPlanDrawStart
  const closing = wouldCloseFloorPlan(plan, floorPlanDrawStart, end, floorPlanLoopStart)
  if (end.gx === floorPlanDrawStart.gx && end.gz === floorPlanDrawStart.gz) {
    plan = addPlanNode(plan, end.gx, end.gz)
  } else if (
    isValidPlanLine(floorPlanDrawStart.gx, floorPlanDrawStart.gz, end.gx, end.gz)
  ) {
    plan = drawPlanLine(
      plan,
      floorPlanDrawStart.gx,
      floorPlanDrawStart.gz,
      end.gx,
      end.gz,
    )
  }
  setFloorPlan(plan)
  floorPlan = plan
  if (closing && planHasClosedRing(plan)) {
    floorPlanDrawStart = null
    floorPlanDrawPreview = null
    floorPlanLoopStart = null
    floorPlanIsDrawing = false
    rebuildFloorPlanOverlay()
    return
  }
  floorPlanDrawStart = { gx: end.gx, gz: end.gz }
  floorPlanDrawPreview = null
  floorPlanIsDrawing = false
  rebuildFloorPlanOverlay()
}

function clearFloorPlanCanvas() {
  const empty = createEmptyFloorPlan()
  setFloorPlan(empty)
  floorPlan = empty
  resetFloorPlanDrawing()
  // Wände ebenfalls leeren, da sie aus dem Grundriss abgeleitet sind
  commitState(updateActiveBuilding(state, { walls: [] }), { selectedWallIds: [], selectedOpenings: [], selectedEdges: [] })
}

function pickPlanGridFromEvent(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, topCamera)
  return floorPlanView.pickGrid(raycaster)
}

function pickPlanWorldFromEvent(event: PointerEvent): { x: number; z: number } | null {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, topCamera)
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  return { x: hit.x, z: hit.z }
}

function updateFloorPlanPointer(event: PointerEvent) {
  const grid = pickPlanGridFromEvent(event)
  if (!grid || !floorPlanDrawStart) return
  floorPlanDrawPreview = grid
  rebuildFloorPlanOverlay()
}

function buildingWorldCenter(walls: Wall[]): { cx: number; cy: number; cz: number; span: number; maxY: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let maxY = STUDIO_DEFAULT_HEIGHT
  for (const wall of walls) {
    const ox = wall.originX ?? wall.x
    const oz = wall.originZ ?? 0
    const along = wallAlongDelta(wall.yawDeg ?? 0, wall.width)
    const ex = ox + along.x
    const ez = oz + along.z
    minX = Math.min(minX, ox, ex)
    maxX = Math.max(maxX, ox, ex)
    minZ = Math.min(minZ, oz, ez)
    maxZ = Math.max(maxZ, oz, ez)
    maxY = Math.max(maxY, wall.y + wall.height)
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxZ - minZ, PLAN_GRID * 4)
  return { cx, cy: maxY / 2, cz, span, maxY }
}

/** Erstausrichtung: Kamera in sinnvoller Distanz vor die gewählte Fassade. */
function focusCameraOnYaw(yawDeg: number, walls: Wall[]) {
  if (walls.length === 0) return
  const { cx, cy, cz, span, maxY } = buildingWorldCenter(walls)
  const dist = span * 1.1
  const outward = facadeOutward(yawDeg, true)
  controls.target.set(cx, cy, cz)
  camera.position.set(cx + outward.x * dist, maxY * 0.55 + span * 0.25, cz + outward.z * dist)
  controls.update()
  markViewportDirty()
}

/**
 * Kompass-Drehung: nur Perspektive ändern, Abstand zum Orbit-Mittelpunkt beibehalten.
 */
function orbitCameraToYaw(yawDeg: number, walls: Wall[]) {
  if (walls.length === 0) return
  const target = controls.target
  const dx = camera.position.x - target.x
  const dy = camera.position.y - target.y
  const dz = camera.position.z - target.z
  const horizDist = Math.hypot(dx, dz)

  // Noch keine sinnvolle Orbit-Position → einmalig einrahmen
  if (horizDist < 50) {
    focusCameraOnYaw(yawDeg, walls)
    return
  }

  const outward = facadeOutward(yawDeg, true)
  camera.position.set(
    target.x + outward.x * horizDist,
    target.y + dy,
    target.z + outward.z * horizDist,
  )
  controls.update()
  markViewportDirty()
}

function ensureDefaultElevation() {
  const yaws = [...new Set(getAllWalls(state).filter(isStudioWall).map((wall) => wall.yawDeg ?? 0))].sort(
    (a, b) => a - b,
  )
  if (currentElevation.kind === 'yaw') {
    const activeYaw = currentElevation.yaw
    if (yaws.some((yaw) => yaw === activeYaw)) return
  }
  if (yaws.includes(0)) {
    currentElevation = { kind: 'yaw', yaw: 0 }
  } else if (yaws.length > 0) {
    currentElevation = { kind: 'yaw', yaw: yaws[0] }
  } else {
    currentElevation = { kind: 'yaw', yaw: 0 }
  }
}

function setCompassYaw(yaw: number) {
  const snapped = snapYawTo45(yaw)
  currentElevation = { kind: 'yaw', yaw: snapped }
  applyElevation()
  updateViewCompass()
  syncCladdingReceiveShadows()
  if (currentView === '3d') {
    orbitCameraToYaw(snapped, getAllWalls(state))
  } else if (currentView === 'top') {
    topViewYawDeg = snapped
    syncTopCamera2()
    markViewportDirty()
  }
  scheduleShareHashWrite()
}

/** Kamera weich auf den Sonnen-Azimut drehen (Grad, ohne 45°-Raster / 2D-Ansicht). */
function orbitViewToSunAzimuth(solarAzDeg: number) {
  if (currentView !== '3d') {
    return
  }
  orbitCameraToYaw(solarAzimuthToWallYaw(solarAzDeg), getAllWalls(state))
}

function syncEditScopeButtons() {
  editScopeElement.classList.toggle('active', editScope === 'element')
  editScopeType.classList.toggle('active', editScope === 'type')
  editScopeFloor.classList.toggle('active', editScope === 'floor')
  editScopeFacade.classList.toggle('active', editScope === 'facade')
  syncEditScopeFacadeYawChips()
}

function facadeScopeAnchorWallId(): string | null {
  if (editor.selectedWallIds[0]) return editor.selectedWallIds[0]
  if (editor.selectedOpenings[0]) return editor.selectedOpenings[0].wallId
  return null
}

function syncEditScopeFacadeYawChips() {
  const show = editScope === 'facade' && !editScopeBar.hidden
  editScopeFacadeYaws.hidden = !show
  if (!show) {
    editScopeFacadeYaws.replaceChildren()
    return
  }
  const anchorId = facadeScopeAnchorWallId()
  if (!anchorId) {
    editScopeFacadeYaws.replaceChildren()
    return
  }
  const yaws = availableFacadeYaws(state, anchorId)
  const active = new Set((editFacadeYawFilter ?? []).map((y) => normalizeYawDeg(y)))
  editScopeFacadeYaws.replaceChildren()
  const allBtn = document.createElement('button')
  allBtn.type = 'button'
  allBtn.className = 'preset-btn'
  allBtn.textContent = 'Alle'
  allBtn.classList.toggle('active', !editFacadeYawFilter || editFacadeYawFilter.length === 0)
  allBtn.addEventListener('click', () => {
    editFacadeYawFilter = null
    syncEditScopeButtons()
    persistApp()
  })
  editScopeFacadeYaws.appendChild(allBtn)
  for (const yaw of yaws) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'preset-btn'
    btn.textContent = wallCompassLabel(yaw)
    btn.title = `${wallCompassLabel(yaw)} (${yaw}°)`
    btn.classList.toggle('active', active.has(normalizeYawDeg(yaw)))
    btn.addEventListener('click', () => {
      const set = new Set(editFacadeYawFilter ?? [])
      const key = normalizeYawDeg(yaw)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      editFacadeYawFilter = set.size === 0 ? null : [...set]
      syncEditScopeButtons()
      persistApp()
    })
    editScopeFacadeYaws.appendChild(btn)
  }
}

function setEditScope(scope: EditScope) {
  editScope = scope
  if (scope !== 'facade') editFacadeYawFilter = null
  syncEditScopeButtons()
  persistApp()
}

function syncViewOptionsControls() {
  if (viewShowLightMarkers) {
    viewShowLightMarkers.checked = state.viewOptions?.showLightMarkers !== false
  }
}

function syncRoofUI() {
  const canRoof = facadeHasRoofablePlan(state)
  toolbarRoof.classList.toggle('disabled', !canRoof)
  roofEnabled.disabled = !canRoof
  roofHint.hidden = canRoof
  const roof = normalizeRoof(activeBuilding().roof)
  roofEnabled.checked = canRoof && roof.enabled
  roofOptions.hidden = !roofEnabled.checked
  roofPitchLower.value = String(roof.pitchLower)
  roofPitchUpper.value = String(roof.pitchUpper)
  roofOverhang.value = String(roof.overhang)
  roofRidgeHeight.value = String(roof.ridgeHeight)
  if (editor.selectedRoofBuildingId) rebuildRoofPatternCardsIfNeeded()
  roofTileProfile.value = roof.tileProfile
  roofTileWidth.value = String(roof.tileWidth)
  roofTileHeight.value = String(roof.tileHeight)
  roofTileJoint.value = String(roof.tileJoint)
  roofTileDepth.value = String(roof.tileProjectDepth)
  roofTileTaperDepth.value = String(roof.tileTaperDepth)
  roofTileTaper.value = String(roof.tileTaper)
  roofTileTaperValue.textContent = roof.tileTaper.toFixed(2)
  roofGutter.checked = roof.gutter
  for (const input of [
    roofPitchLower,
    roofPitchUpper,
    roofOverhang,
    roofRidgeHeight,
    roofTileProfile,
    roofTileWidth,
    roofTileHeight,
    roofTileJoint,
    roofTileDepth,
    roofTileTaperDepth,
    roofTileTaper,
    roofGutter,
  ]) {
    ;(input as HTMLInputElement).disabled = !roofEnabled.checked
  }
  renderColorControl(
    roofTileColorSwatches,
    roof.tileColor,
    (color) => commitRoofPatch({ tileColor: color }),
  )
  for (const el of roofTileColorSwatches.querySelectorAll('input,button')) {
    ;(el as HTMLInputElement).disabled = !roofEnabled.checked
  }

  const part = editor.selectedRoofPart ?? 'group'
  const showAll = part === 'group'
  roofShellOptions.hidden = !showAll && part !== 'shell'
  roofTilesOptions.hidden = !showAll && part !== 'tiles'
  roofGutterOptions.hidden = !showAll && part !== 'gutter'
  if (part !== 'group') {
    roofEnabled.closest('.toolbar-group')?.classList.add('hidden')
  } else {
    roofEnabled.closest('.toolbar-group')?.classList.remove('hidden')
  }
}

function syncCeilingUI() {
  const sel = editor.selectedCeiling
  if (!sel) return
  const building = state.buildings.find((b) => b.id === sel.buildingId)
  const plan = building?.floors[sel.floorIndex]
  const color = plan?.ceilingColor ?? DEFAULT_CEILING_COLOR
  renderColorControl(ceilingColorSwatches, color, (nextColor) => {
    if (!building) return
    const floors = [...building.floors]
    while (floors.length <= sel.floorIndex) floors.push(createEmptyFloorPlan())
    floors[sel.floorIndex] = { ...floors[sel.floorIndex], ceilingColor: nextColor }
    commitState(updateBuilding(state, sel.buildingId, { floors }))
  })
}

function commitRoofPatch(patch: Partial<RoofConfig>) {
  if (!facadeHasRoofablePlan(state) && patch.enabled) return
  const next = normalizeRoof({ ...normalizeRoof(activeBuilding().roof), ...patch })
  commitState(updateActiveBuilding(state, { roof: next }))
}

function syncBuildingRotateUI() {
  const buildingId = editor.selectedBuildingId ?? state.activeBuildingId
  const can = buildingId
    ? canRotateBuildingGeometry(state, buildingId)
    : canRotateStudioBuilding(state)
  buildingRotateCcw.disabled = !can
  buildingRotateCw.disabled = !can
}

function commitBuildingRotate(delta: 45 | -45) {
  const buildingId = editor.selectedBuildingId ?? state.activeBuildingId
  if (buildingId && canRotateBuildingGeometry(state, buildingId)) {
    commitState(rotateBuildingByDeg(state, buildingId, delta))
    return
  }
  if (!canRotateStudioBuilding(state)) return
  commitState(rotateStudioBuilding(state, delta))
}

function commitViewOptions(patch: {
  showCeiling?: boolean
  showIntermediateFloors?: boolean
  showLightMarkers?: boolean
}) {
  state = {
    ...state,
    viewOptions: {
      showCeiling: patch.showCeiling ?? state.viewOptions?.showCeiling ?? true,
      showIntermediateFloors:
        patch.showIntermediateFloors ?? state.viewOptions?.showIntermediateFloors ?? true,
      showLightMarkers: patch.showLightMarkers ?? state.viewOptions?.showLightMarkers ?? true,
    },
  }
  facade.setState(state)
  syncSceneLightRuntime()
  syncViewOptionsControls()
  persistApp()
  markViewportDirty()
}

function focusCameraOnFloorPlan(walls: Wall[]) {
  if (walls.length === 0) return
  const bounds = galleryFocusBounds(walls)
  if (!bounds) return
  const { cx, cy, cz, span } = bounds
  controls.target.set(cx, cy, cz)
  camera.position.set(cx + span * 0.85, cy * 0.75 + span * 0.35, cz + span * 0.85)
  controls.update()
}

function focusCameraExterior(walls: Wall[]) {
  if (isGalleryModeActive()) {
    focusCameraOnFloorPlan(galleryEntryFocusWalls(walls))
    applyGalleryOrbitTuning()
    return
  }
  focusCameraOnFloorPlan(walls)
}

/** Orbit-Ziel auf Wand(en) legen und optional neu einrahmen. */
function focusGalleryOnWalls(walls: Wall[], reframe: boolean) {
  const bounds = galleryFocusBounds(walls)
  if (!bounds) return
  const { cx, cy, cz, span } = bounds
  if (reframe) {
    controls.target.set(cx, cy, cz)
    camera.position.set(cx + span * 0.9, cy * 0.7 + span * 0.4, cz + span * 0.9)
  } else {
    // Nur Pivot verschieben — Kamera behält Abstand/Winkel zum neuen Ziel.
    const offset = camera.position.clone().sub(controls.target)
    controls.target.set(cx, cy, cz)
    camera.position.copy(controls.target).add(offset)
  }
  applyGalleryOrbitTuning()
  controls.update()
  markViewportDirty()
}

function applyGalleryOrbitTuning() {
  controls.minDistance = GALLERY_CAM_MIN_DISTANCE
  controls.maxDistance = GALLERY_CAM_MAX_DISTANCE
  controls.minPolarAngle = 0
  controls.maxPolarAngle = Math.PI
  controls.screenSpacePanning = true
  controls.panSpeed = 1.35
  // Clip-Planes + Distanz-Culling: Nahzoom bleibt flüssig (kein Site-weites far).
  const dist = camera.position.distanceTo(controls.target)
  controls.zoomSpeed = galleryZoomSpeedForDistance(dist)
  const depth = galleryCameraDepthRange(dist)
  camera.near = depth.near
  camera.far = depth.far
  camera.updateProjectionMatrix()
  if (dist > GALLERY_CAM_MAX_DISTANCE) {
    const dir = camera.position.clone().sub(controls.target).normalize()
    camera.position.copy(controls.target).addScaledVector(dir, GALLERY_CAM_MAX_DISTANCE * 0.92)
    controls.update()
  }
  facade.setGalleryDistanceCull(true)
  facade.updateGalleryDistanceCull(camera, GALLERY_WALL_CULL_DISTANCE, GALLERY_WALL_CULL_HYSTERESIS)
}

function clearGalleryOrbitTuning() {
  controls.minDistance = 60
  controls.maxDistance = 4000
  controls.minPolarAngle = 0
  controls.maxPolarAngle = Math.PI
  controls.screenSpacePanning = false
  controls.zoomSpeed = 1
  controls.panSpeed = 1
  facade.setGalleryDistanceCull(false)
  camera.near = 1
  camera.far = Math.max(5000, camera.far)
  camera.updateProjectionMatrix()
}

function syncGalleryNavigationFeel() {
  if (!isGalleryModeActive() || currentView !== '3d') return
  const dist = camera.position.distanceTo(controls.target)
  controls.zoomSpeed = galleryZoomSpeedForDistance(dist)
  const depth = galleryCameraDepthRange(dist)
  if (Math.abs(camera.near - depth.near) > 0.05 || Math.abs(camera.far - depth.far) > 1) {
    camera.near = depth.near
    camera.far = depth.far
    camera.updateProjectionMatrix()
  }
  if (facade.updateGalleryDistanceCull(camera, GALLERY_WALL_CULL_DISTANCE, GALLERY_WALL_CULL_HYSTERESIS)) {
    markViewportDirty()
  }
}

function generateWallsFromFloorPlan(): boolean {
  const floors = getFloors()
  // Prüfe ob mindestens eine Etage Kanten hat.
  const hasAny = floors.some((plan) => plan.edges.length > 0)
  if (!hasAny) {
    planStatus.textContent =
      currentFloorPlan().nodes.length >= 2
        ? 'Punkte verbinden: vom orangenen Punkt zum Ziel klicken oder ziehen'
        : 'Zuerst mindestens eine Linie zeichnen (zwei Punkte verbinden)'
    return false
  }
  const building = activeBuilding()
  const existingPanel = building.walls.find((wall) => isStudioWall(wall))?.panel
  const walls = floors.flatMap((plan, i) =>
    wallsFromFloorPlan(plan, i * building.wallHeight, existingPanel),
  )
  const next = finalizeWallLayout(
    updateActiveBuilding(clampFacadeState(state), { walls, floors }),
  )
  commitState(next, {
    selectedWallIds: walls.map((wall) => wall.id),
    selectedOpenings: [],
    selectedEdges: [],
  })
  setView('3d')
  focusCameraExterior(getAllWalls(next))
  return true
}

function syncStudioPanelVisibility(
  panel: NonNullable<Wall['panel']>,
  corniceEnabled: boolean,
  wall?: Wall,
) {
  const panelsOn = panel.enabled !== false && panel.pattern !== 'none'
  // Muster-Karten bleiben immer sichtbar — sonst wirken Paneele/Mauerwerk „entfernt“,
  // wenn die Checkbox aus ist oder nur die Checkbox ohne Auswahl angezeigt wird.
  studioPanelOptions.hidden = false
  studioJointsSection.hidden = !panelsOn
  studioTaperSection.hidden = !panelsOn
  studioJointOptions.hidden = !panelsOn || panel.joint <= 0
  studioJointColorRow.hidden = !panelsOn
  studioTaperOptions.hidden = !panelsOn || (panel.taperDepth ?? 0) <= 0
  studioCorniceOptions.hidden = !corniceEnabled
  studioPlinthOptions.hidden = panel.plinthEnabled === false
  studioPanelsAlternateRow.hidden = !panelsOn || panel.pattern !== 'strip'
  const alternateOn = panel.alternateFloors === true && panel.pattern === 'strip'
  studioAlternateLayers.hidden = !panelsOn || !alternateOn
  studioStandardDepthRow.hidden = !panelsOn || alternateOn
  studioTaperSection.hidden = !panelsOn || alternateOn
  studioTileColorSection.hidden = !panelsOn
  studioTileVarietyRow.hidden = !panelsOn || (panel.tileColorVariance ?? 0) <= 0
  const twoBands = Boolean(wall && isTwoHorizontalBandCladding(wall))
  studioCladdingTwoBands.disabled = !panelsOn
  studioCladdingTwoBandsOptions.hidden = !panelsOn || !twoBands
  studioPanelWidthRow.hidden = !panelsOn || twoBands
}

function syncStudioToolbar(wall: Wall) {
  const panel = wall.panel
  if (!panel) return
  rebuildStudioPatternCardsIfNeeded()
  studioCornerJoinSelect.value = panel.cornerJoin
  studioJointInput.value = String(panel.joint)
  studioPanelWidthInput.value = String(panel.panelWidth)
  studioPanelHeightInput.value = String(panel.panelHeight)
  const courseCount = panelCourseCount(wall.height, panel)
  const maxHideRows = Math.max(0, courseCount - 1)
  studioHideRowsBottomInput.max = String(maxHideRows)
  studioHideRowsTopInput.max = String(maxHideRows)
  studioHideRowsBottomInput.value = String(clampHideRows(panel.hideRowsBottom, courseCount))
  studioHideRowsTopInput.value = String(clampHideRows(panel.hideRowsTop, courseCount))
  studioProjectDepthInput.value = String(panel.projectDepth)
  studioPlinthHeightInput.value = String(panel.plinthHeight ?? 0)
  studioPlinthHeightInput.step = String(STUDIO_MASONRY)
  studioPlinthHeightInput.min = '0'
  studioPlinthHeightInput.max = String(wall.height)
  studioPlinthDepthInput.value = String(panel.plinthDepth ?? 8)
  studioPlinthDepthInput.step = '1'
  studioPlinthOffsetInput.value = String(panel.plinthOffsetForward ?? 0)
  studioPlinthOffsetInput.step = '1'
  studioPlinthEnabled.checked = panel.plinthEnabled !== false
  syncPlinthProfileControls(wall)
  studioWallHeightInput.value = String(wall.height)
  studioWallHeightInput.min = String(STUDIO_MIN_SIZE)
  studioWallHeightInput.step = String(STUDIO_WALL_HEIGHT_STEP)
  studioWallDepthInput.value = String(activeBuilding().wallDepth ?? WALL_DEPTH)
  studioWallYawInput.value = String(Math.round(wall.yawDeg ?? 0))
  syncEndPieceControls(wall)
  syncEndBossControls(wall, activeBuilding().walls)
  studioJointDepthInput.value = String(panel.jointDepth ?? 0)
  studioTaperInput.value = String(panel.taper)
  studioTaperDepthInput.value = String(panel.taperDepth ?? 0)
  studioPanelsEnabled.checked = panel.enabled !== false && panel.pattern !== 'none'
  studioPanelsAlternate.checked = panel.alternateFloors === true
  studioOpeningJoinMiter.checked = panel.openingJoin === 'miter'
  studioLayer1ProjectDepth.value = String(panel.projectDepth)
  studioLayer1TaperDepth.value = String(panel.taperDepth ?? 0)
  studioLayer1Taper.value = String(panel.taper)
  studioLayer2ProjectDepth.value = String(panel.recessedProjectDepth ?? 0)
  studioLayer2TaperDepth.value = String(panel.recessedTaperDepth ?? 0)
  studioLayer2Taper.value = String(panel.recessedTaper ?? 1)
  const layer1TaperDepth = panel.taperDepth ?? 0
  studioLayer1Taper.disabled = layer1TaperDepth <= 0
  const layer2TaperDepth = panel.recessedTaperDepth ?? 0
  studioLayer2Taper.disabled = layer2TaperDepth <= 0
  studioTileVariance.value = String(panel.tileColorVariance ?? 0)
  studioTileVarianceValue.textContent = String(panel.tileColorVariance ?? 0)
  studioTileVariety.value = String(panel.tileColorVariety ?? 0)
  studioTileVarietyValue.textContent = String(panel.tileColorVariety ?? 0)
  const taperDepth = panel.taperDepth ?? 0
  studioTaperInput.disabled = taperDepth <= 0
  studioTaperInput.title = taperDepth <= 0
    ? 'Bossen-Vorstand muss > 0 sein, damit Bossenprofil sichtbar wird.'
    : ''
  syncCorniceControls(wall)
  syncTrimBandsControls(wall)
  syncLabelControls(wall)
  syncCladdingTwoBandsControls(wall)
  syncStudioPanelVisibility(panel, Boolean(wallCornice(wall).enabled), wall)
}

function syncCladdingTwoBandsControls(wall: Wall) {
  const twoBands = isTwoHorizontalBandCladding(wall)
  studioCladdingTwoBands.checked = twoBands
  const opts = twoBands
    ? readTwoHorizontalBandOptions(wall)
    : {
        splitYCm: clampCladdingSplitY(wall.height * 0.5, wall.height),
        lowerPanelWidth: wall.panel?.panelWidth ?? DEFAULT_STUDIO_PANEL.panelWidth,
        upperPanelWidth: defaultUpperBandWidth(wall.panel?.panelWidth ?? DEFAULT_STUDIO_PANEL.panelWidth),
      }
  studioCladdingSplitY.min = String(STUDIO_MASONRY)
  studioCladdingSplitY.max = String(Math.max(STUDIO_MASONRY, wall.height - STUDIO_MASONRY))
  studioCladdingSplitY.step = String(STUDIO_MASONRY)
  studioCladdingSplitY.value = String(opts.splitYCm)
  studioCladdingWidthLower.min = String(STUDIO_PANEL_MIN)
  studioCladdingWidthLower.max = String(STUDIO_PANEL_SOFT_MAX)
  studioCladdingWidthLower.step = String(STUDIO_PANEL_STEP)
  studioCladdingWidthLower.value = String(opts.lowerPanelWidth)
  studioCladdingWidthUpper.min = String(STUDIO_PANEL_MIN)
  studioCladdingWidthUpper.max = String(STUDIO_PANEL_SOFT_MAX)
  studioCladdingWidthUpper.step = String(STUDIO_PANEL_STEP)
  studioCladdingWidthUpper.value = String(opts.upperPanelWidth)
}

function labelPreviewSampleText(): string {
  const typed = studioLabelText.value.trim()
  if (typed) return typed
  const placeholder = studioLabelText.placeholder.trim()
  return placeholder || 'Vorschau'
}

function syncLabelFontCards(fontId?: string) {
  if (studioLabelFontCards.childElementCount === 0) return
  const activeId = resolveLabelFontId(
    fontId ?? studioLabelFontCards.querySelector<HTMLButtonElement>('.label-font-card.active')?.dataset.fontId,
  )
  const sample = labelPreviewSampleText()
  for (const btn of studioLabelFontCards.querySelectorAll<HTMLButtonElement>('.label-font-card')) {
    const selected = btn.dataset.fontId === activeId
    btn.classList.toggle('active', selected)
    btn.setAttribute('aria-selected', selected ? 'true' : 'false')
    const preview = btn.querySelector('.label-font-preview')
    if (preview) preview.textContent = sample
  }
}

function selectLabelFont(fontId: string) {
  commitLabelPatch({ fontId })
  const wall = anchorWall()
  const depth = wall ? wallLabel(wall).depth : 'flat'
  const job =
    depth === 'extruded' ? retryWallLabelExtrudedFont(fontId) : preloadWallLabelFlatFont(fontId)
  void job.then(() => {
    facade.refreshWallLabels({ afterFontLoad: true })
    applySunLighting({ updateShadowMap: true })
  })
}

function buildLabelFontCards() {
  studioLabelFontCards.replaceChildren()
  for (const font of LABEL_FONTS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tpl-card label-font-card'
    btn.dataset.fontId = font.id
    btn.setAttribute('role', 'option')
    btn.title = font.name
    const thumb = document.createElement('div')
    thumb.className = 'tpl-card-thumb label-font-thumb'
    const preview = document.createElement('span')
    preview.className = 'label-font-preview'
    preview.style.fontFamily = `"${font.family}", serif`
    preview.textContent = labelPreviewSampleText()
    thumb.appendChild(preview)
    const caption = document.createElement('span')
    caption.textContent = font.name
    btn.append(thumb, caption)
    btn.addEventListener('click', () => selectLabelFont(font.id))
    studioLabelFontCards.appendChild(btn)
  }
  const wall = anchorWall()
  syncLabelFontCards(wall ? wallLabel(wall).fontId : undefined)
}

function syncLabelControls(wall: Wall) {
  const label = wallLabel(wall)
  studioLabelEnabled.checked = Boolean(label.enabled)
  studioLabelOptions.hidden = !label.enabled
  studioLabelText.value = label.text ?? ''
  studioLabelHeight.value = String(label.heightCm ?? DEFAULT_WALL_LABEL.heightCm)
  studioLabelX.max = String(wall.width)
  studioLabelY.max = String(wall.height)
  studioLabelX.value = String(label.x ?? wall.width / 2)
  studioLabelY.value = String(label.y ?? wall.height / 2)
  studioLabelAlign.value = label.align ?? 'center'
  studioLabelExtrude.value = String(label.extrudeCm ?? 4)
  studioLabelOffsetForward.value = String(label.offsetForward ?? 0)
  const depth = label.depth ?? 'flat'
  studioLabelDepthFlat.classList.toggle('active', depth === 'flat')
  studioLabelDepthExtruded.classList.toggle('active', depth === 'extruded')
  studioLabelExtrudeRow.hidden = depth !== 'extruded'
  const color = label.color ?? wall.claddingColor ?? wall.wallColor ?? '#ffffff'
  renderColorSwatches(
    studioLabelColorSwatches,
    'profile',
    color,
    (next) => commitLabelPatch({ color: next }),
    previewSelectionColor((next) => updateWallLabel(state, scopedWallIds(), { color: next })),
  )
  studioLabelFinishSelect.value =
    label.finish === 'glossy' || label.finish === 'metal' ? label.finish : 'matte'
  syncLabelFontCards(label.fontId)
}

function refreshStudioPanelVisibility() {
  const wall = getWall(state, editor.selectedWallIds[0])
  if (!wall?.panel) return
  syncStudioPanelVisibility(wall.panel, Boolean(wallCornice(wall).enabled), wall)
}

function syncTrimBandsControls(wall: Wall) {
  studioTrimBandsList.replaceChildren()
  const canEdit = selectionIsStudioWall()
  // Nicht per `hidden` ausblenden — sonst fehlt der Reiter (settingsSectionVisibleForUi).
  studioTrimBandsSection.hidden = false
  studioTrimBandAdd.disabled = !canEdit
  studioTrimBandAdd.title = canEdit
    ? 'Horizontales Zierband an der ausgewählten Studio-Wand (Standard: Wandmitte)'
    : 'Zuerst eine Studio-Wand auswählen'
  if (!canEdit) return
  const bands = wallTrimBands(wall)
  const selectedBandId = editor.selectedTrimBandId
  for (const band of bands) {
    const block = document.createElement('div')
    block.className = 'trim-band-block'
    block.dataset.bandId = band.id
    if (selectedBandId === band.id) block.classList.add('selected')
    block.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('input, button, select, .tpl-card')) return
      selectWall(wall.id, false, 'trimBand', band.id)
    })

    const row = document.createElement('div')
    row.className = 'trim-band-row'

    const yLabel = document.createElement('label')
    yLabel.textContent = 'Position (cm)'
    const yInput = document.createElement('input')
    yInput.type = 'number'
    yInput.step = '8'
    yInput.min = '0'
    yInput.value = String(band.yFromBottom)
    yInput.title = 'Höhe von unten, 8-cm-Raster'
    yInput.addEventListener('change', () => {
      const anchorId = editor.selectedWallIds[0]
      commitState(
        patchWallTrimBand(state, scopedWallIds(), band.id, {
          yFromBottom: Number(yInput.value),
        }, { anchorWallId: anchorId, scope: editScope }),
      )
    })

    const scaleLabel = document.createElement('label')
    scaleLabel.textContent = 'Höhe'
    const scaleInput = document.createElement('input')
    scaleInput.type = 'number'
    scaleInput.step = '0.1'
    scaleInput.min = '0.1'
    scaleInput.value = String(band.scale ?? 1)
    scaleInput.addEventListener('change', () => {
      const anchorId = editor.selectedWallIds[0]
      commitState(
        patchWallTrimBand(state, scopedWallIds(), band.id, {
          scale: Number(scaleInput.value),
        }, { anchorWallId: anchorId, scope: editScope }),
      )
    })

    const depthLabel = document.createElement('label')
    depthLabel.textContent = 'Tiefe'
    const depthInput = document.createElement('input')
    depthInput.type = 'number'
    depthInput.step = '0.1'
    depthInput.min = '0.1'
    depthInput.value = String(band.sectionScaleForward ?? band.scale ?? 1)
    depthInput.addEventListener('change', () => {
      const anchorId = editor.selectedWallIds[0]
      commitState(
        patchWallTrimBand(state, scopedWallIds(), band.id, {
          sectionScaleForward: Number(depthInput.value),
        }, { anchorWallId: anchorId, scope: editScope }),
      )
    })

    const offsetLabel = document.createElement('label')
    offsetLabel.textContent = 'Vorstand (cm)'
    const offsetInput = document.createElement('input')
    offsetInput.type = 'number'
    offsetInput.step = '0.5'
    offsetInput.value = String(band.offsetForward ?? 0)
    offsetInput.addEventListener('change', () => {
      const anchorId = editor.selectedWallIds[0]
      commitState(
        patchWallTrimBand(state, scopedWallIds(), band.id, {
          offsetForward: Number(offsetInput.value),
        }, { anchorWallId: anchorId, scope: editScope }),
      )
    })

    const profileLabel = document.createElement('span')
    profileLabel.className = 'toolbar-label'
    profileLabel.textContent = 'Profil / Stil'
    const profileCards = document.createElement('div')
    profileCards.className = 'tpl-card-row profile-picker-row trim-band-profile-row'
    rebuildCorniceProfileCards(
      profileCards,
      band.profileId ?? 'traufgesims70x150',
      band.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR,
      (id) => {
        const anchorId = editor.selectedWallIds[0]
        commitState(
          patchWallTrimBand(state, scopedWallIds(), band.id, {
            profileId: id || band.profileId,
          }, { anchorWallId: anchorId, scope: editScope }),
        )
      },
    )

    const dupUpBtn = document.createElement('button')
    dupUpBtn.type = 'button'
    dupUpBtn.className = 'preset-btn'
    dupUpBtn.textContent = '↑'
    dupUpBtn.title = `Duplizieren nach oben (+${TRIM_BAND_DUPLICATE_OFFSET} cm)`
    dupUpBtn.addEventListener('click', () => {
      commitDuplicateTrimBand(wall.id, band.id, 'up')
    })

    const dupDownBtn = document.createElement('button')
    dupDownBtn.type = 'button'
    dupDownBtn.className = 'preset-btn'
    dupDownBtn.textContent = '↓'
    dupDownBtn.title = `Duplizieren nach unten (−${TRIM_BAND_DUPLICATE_OFFSET} cm)`
    dupDownBtn.addEventListener('click', () => {
      commitDuplicateTrimBand(wall.id, band.id, 'down')
    })

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'preset-btn toolbar-danger'
    delBtn.textContent = '×'
    delBtn.title = 'Band entfernen'
    delBtn.addEventListener('click', () => {
      const anchorId = editor.selectedWallIds[0]
      commitState(removeWallTrimBand(state, scopedWallIds(), band.id, {
        anchorWallId: anchorId,
        scope: editScope,
      }))
    })

    row.append(
      yLabel,
      yInput,
      scaleLabel,
      scaleInput,
      depthLabel,
      depthInput,
      offsetLabel,
      offsetInput,
      dupUpBtn,
      dupDownBtn,
      delBtn,
    )
    block.append(row, profileLabel, profileCards)
    studioTrimBandsList.appendChild(block)
  }
}

function commitDuplicateTrimBand(
  wallId: string,
  bandId: string,
  direction: 'up' | 'down',
) {
  const result = duplicateWallTrimBand(state, scopedWallIds(), bandId, direction, {
    anchorWallId: wallId,
    scope: editScope,
  })
  commitState(result.state, {
    ...editor,
    selectedWallIds: editor.selectedWallIds.includes(wallId)
      ? editor.selectedWallIds
      : [wallId],
    selectedOpenings: [],
    selectedWallPart: 'trimBand',
    selectedTrimBandId: result.newBandId ?? bandId,
  })
  pendingSelectionToolbarTab = 'trimBands'
}

const studioTrimBandsSection = document.querySelector<HTMLDivElement>('#studio-trim-bands-section')!

function syncCorniceControls(wall: Wall) {
  const cornice = wallCornice(wall)
  const edge = cornice.edge ?? 'top'
  const profileId = cornice.enabled ? (cornice.profileId ?? 'traufgesims70x150') : ''
  studioCorniceEnabled.checked = Boolean(cornice.enabled)
  studioCorniceTop.classList.toggle('active', edge === 'top')
  studioCorniceBottom.classList.toggle('active', edge === 'bottom')
  syncCorniceHeightInputs(wall, cornice)
  rebuildCorniceProfileCards(
    studioCorniceProfileCards,
    profileId,
    cornice.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR,
    (id) =>
      commitCornicePatch(id ? { enabled: true, profileId: id } : { enabled: false }),
  )
  studioCorniceFlipOutward.classList.toggle('active', Boolean(cornice.flipOutward))
  studioCorniceFlipForward.classList.toggle('active', Boolean(cornice.flipForward))
  wallCorniceEnabled.checked = Boolean(cornice.enabled)
  wallCorniceTop.classList.toggle('active', edge === 'top')
  wallCorniceBottom.classList.toggle('active', edge === 'bottom')
  rebuildCorniceProfileCards(
    wallCorniceProfileCards,
    profileId,
    cornice.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR,
    (id) =>
      commitCornicePatch(id ? { enabled: true, profileId: id } : { enabled: false }),
  )
  wallCorniceOffsetForward.value = String(cornice.offsetForward ?? 0)
  wallCorniceFlipOutward.classList.toggle('active', Boolean(cornice.flipOutward))
  wallCorniceFlipForward.classList.toggle('active', Boolean(cornice.flipForward))
  const color = activeCorniceColor()
  renderColorSwatches(
    studioCorniceColorSwatches,
    'profile',
    color,
    (next) => {
      commitCornicePatch({ color: next })
    },
    previewSelectionColor((next) => updateWallCornice(state, corniceTargetWallIds(), { color: next })),
  )
  renderColorSwatches(
    wallCorniceColorSwatches,
    'profile',
    color,
    (next) => {
      commitCornicePatch({ color: next })
    },
    previewSelectionColor((next) => updateWallCornice(state, corniceTargetWallIds(), { color: next })),
  )
  const corniceFinish =
    cornice.finish === 'glossy' || cornice.finish === 'metal'
      ? cornice.finish
      : cornice.finish === 'matte'
        ? 'matte'
        : wall.profileFinish === 'glossy' || wall.profileFinish === 'metal'
          ? wall.profileFinish
          : 'matte'
  studioCorniceFinishSelect.value = corniceFinish
  wallCorniceFinishSelect.value = corniceFinish
  drawCorniceSectionPreview()
}

function syncWindowDepthControls() {
  const sel = selectedWindowOpening()
  const building = activeBuilding()
  const buildingOffset = building.windowDepthOffset
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.type === 'window' || opening?.type === 'door'
  })

  const showDepth =
    Boolean(sel && (sel.opening.type === 'window' || sel.opening.type === 'door')) ||
    (editor.selectedOpenings.length === 0 && editor.selectedWallIds.length > 0)
  if (openingWindowDepthSection) openingWindowDepthSection.hidden = !showDepth

  if (refs.length === 0) {
    openingWindowDepthOffset.value = String(buildingFacadeDepthCm(buildingOffset))
    if (openingWindowDepthReset) openingWindowDepthReset.hidden = true
    if (openingWindowDepthHint) {
      openingWindowDepthHint.textContent =
        'Gebäude-Standard für alle Fenster/Türen ohne eigene Frontlage.'
    }
    return
  }

  const depths = refs.map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening ? openingFacadeDepthCm(opening, buildingOffset) : null
  })
  const custom = refs.some((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening ? openingUsesCustomDepth(opening) : false
  })
  const first = depths[0]
  const same = depths.length > 0 && depths.every((d) => d === first)
  openingWindowDepthOffset.value = same && first != null ? String(Math.round(first)) : ''
  if (openingWindowDepthReset) openingWindowDepthReset.hidden = !custom
  if (openingWindowDepthHint) {
    openingWindowDepthHint.textContent = custom
      ? 'Eigene Frontlage für die gewählte(n) Öffnung(en). Gebäude-Standard: ' +
        `${Math.round(buildingFacadeDepthCm(buildingOffset))} cm.`
      : `Gebäude-Standard (${Math.round(buildingFacadeDepthCm(buildingOffset))} cm) — Änderung gilt nur für die Auswahl.`
  }
}

function updateValidationHintStudio() {
  const invalid = selectedWalls()
    .flatMap((wall) =>
      wall.openings.map((opening) => validateOpeningPlacement(opening, wall)),
    )
    .find((result) => !result.valid)

  if (!invalid) {
    validationHintStudio.hidden = true
    validationHintStudio.textContent = ''
    return
  }

  validationHintStudio.hidden = false
  validationHintStudio.textContent = invalid.message ?? 'Ungültige Öffnung.'
}

function confirmOpeningInsert(message: string, canReplace: boolean): Promise<'replace' | 'cancel'> {
  openingConflictMessage.textContent = message
  openingConflictReplaceButton.hidden = !canReplace
  openingConflictDialog.returnValue = 'cancel'
  openingConflictDialog.showModal()
  return new Promise((resolve) => {
    openingConflictDialog.addEventListener(
      'close',
      () => {
        resolve(openingConflictDialog.returnValue === 'replace' ? 'replace' : 'cancel')
      },
      { once: true },
    )
  })
}

async function addOpeningPresetToSelection(
  presetId: string,
  options?: { wallId?: string; at?: { x: number; y?: number } },
) {
  const preset = WALL_OPENING_PRESETS.find((item) => item.id === presetId)
  const wallIds = options?.wallId ? [options.wallId] : [...editor.selectedWallIds]
  if (!preset || wallIds.length === 0) return

  type PendingInsert = {
    wallId: string
    opening: ReturnType<typeof createOpening>
    issue: NonNullable<ReturnType<typeof assessOpeningInsert>>
  }

  const inserts: Array<{ wallId: string; opening: ReturnType<typeof createOpening> }> = []
  const blocked: PendingInsert[] = []

  for (const wallId of wallIds) {
    const wall = getWall(state, wallId)
    if (!wall) continue
    const at = options?.at
      ? {
          x: options.at.x,
          y: preset.type === 'door' ? 0 : (preset.y ?? options.at.y),
        }
      : undefined
    let opening = createOpening(preset.type, preset.width, preset.height, wall, at, {
      donorWalls: getAllWalls(state).filter(
        (item) => item.buildingId === wall.buildingId && item.id !== wall.id,
      ),
    })
    if (preset.type === 'cutout') {
      opening = {
        ...opening,
        y: preset.y ?? opening.y,
        cutoutShape: preset.cutoutShape ?? 'rect',
        fill: preset.fill ?? { mode: 'niche', nicheDepthCm: DEFAULT_NICHE_DEPTH_CM },
      }
    }
    if (preset.type === 'conch') {
      opening = {
        ...opening,
        y: preset.y ?? opening.y,
        fill: preset.fill ?? {
          mode: 'niche',
          nicheDepthCm: Math.max(DEFAULT_NICHE_DEPTH_CM, preset.width / 2),
        },
      }
    }
    if (preset.type === 'window' && preset.basementWindow) {
      opening = {
        ...opening,
        y: preset.y ?? opening.y,
        basementWindow: { enabled: true, grilleHeight: 0.5 },
        gruenderzeit: clampGruenderzeitForBasement(
          defaultGruenderzeitConfig(preset.width, preset.height, 'window'),
        ),
        sillInner: opening.sillInner
          ? { ...opening.sillInner, enabled: false }
          : {
              enabled: false,
              depth: 16,
              thickness: 4,
              profileId: 'fensterprofil32x120',
              rotationDeg: 0,
              flipOutward: false,
              flipForward: true,
            },
        sillOuter: opening.sillOuter
          ? { ...opening.sillOuter, enabled: false }
          : {
              enabled: false,
              profileId: 'fensterprofil32x120',
              scale: 1,
              depth: 32,
              thickness: 4,
              angleDeg: 5,
              rotationDeg: 0,
              flipOutward: false,
              flipForward: false,
            },
      }
    }
    const issue = assessOpeningInsert(wall, opening)
    if (issue) blocked.push({ wallId, opening, issue })
    else inserts.push({ wallId, opening })
  }

  if (blocked.length > 0) {
    const first = blocked[0]
    const canReplace = blocked.every((item) => item.issue.kind === 'overlap')
    const choice = await confirmOpeningInsert(
      `${first.issue.message} (${preset.label})`,
      canReplace,
    )
    if (choice !== 'replace') return

    let next = state
    const newRefs: OpeningRef[] = []
    for (const item of blocked) {
      if (item.issue.kind !== 'overlap') continue
      next = insertOpeningReplacingOverlaps(
        next,
        item.wallId,
        item.opening,
        item.issue.overlapping.map((opening) => opening.id),
      )
      newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
    }
    for (const item of inserts) {
      next = addOpening(next, item.wallId, item.opening)
      newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
    }
    if (newRefs.length === 0) return
    commitState(next, {
      ...editor,
      selectedOpenings: newRefs,
      selectedWallIds: [...new Set(newRefs.map((ref) => ref.wallId))],
      selectedEdges: [],
      selectedOpeningPart: 'group',
    })
    return
  }

  let next = state
  const newRefs: OpeningRef[] = []
  for (const item of inserts) {
    next = addOpening(next, item.wallId, item.opening)
    newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
  }
  if (newRefs.length === 0) return

  commitState(next, {
    ...editor,
    selectedOpenings: newRefs,
    selectedWallIds: [...new Set(newRefs.map((ref) => ref.wallId))],
    selectedEdges: [],
    selectedOpeningPart: 'group',
  })
}

let openingTemplates: OpeningTemplate[] = loadOpeningTemplates()
let styleTemplates: StyleTemplate[] = loadStyleTemplates()

function persistOpeningTemplates() {
  saveOpeningTemplates(openingTemplates)
}

function persistStyleTemplates() {
  saveStyleTemplates(styleTemplates)
}

function templatePreviewHtml(draft: OpeningTemplateDraft): string {
  return openingSizePreviewSvg(draft.width, draft.height, draft.type, draft.gruenderzeit)
}

function openingRefsForLibrary(hit?: { wallId?: string; openingId?: string }): OpeningRef[] {
  if (hit?.wallId && hit.openingId) return [{ wallId: hit.wallId, openingId: hit.openingId }]
  const scoped = scopedOpeningRefs()
  if (scoped.length > 0) return scoped
  if (editor.selectedOpenings.length > 0) return [...editor.selectedOpenings]
  if (hit?.wallId) {
    const wall = getWall(state, hit.wallId)
    const opening = wall?.openings[0]
    if (opening) return [{ wallId: hit.wallId, openingId: opening.id }]
  }
  const selected = selectedWalls()[0]
  const opening = selected?.openings[0]
  if (selected && opening) return [{ wallId: selected.id, openingId: opening.id }]
  return []
}

function wallIdsForLibrary(hit?: { wallId?: string }): string[] {
  if (hit?.wallId) return [hit.wallId]
  const scoped = scopedWallIds()
  if (scoped.length > 0) return scoped
  return [...editor.selectedWallIds]
}

function applyLibraryAsset(asset: LibraryAsset, hit?: { wallId?: string; openingId?: string }) {
  if (asset.kind === 'frame-profile') {
    const refs = openingRefsForLibrary(hit)
    if (refs.length === 0) {
      planStatus.textContent = 'Profil auf ein Fenster oder eine Tür ziehen'
      return
    }
    commitState(
      asset.id
        ? assignProfilesToOpenings(state, refs, [...ALL_EDGES], asset.id)
        : removeProfilesFromOpenings(state, refs, [...ALL_EDGES]),
    )
    return
  }
  if (asset.kind === 'sill-profile') {
    const refs = openingRefsForLibrary(hit)
    if (refs.length === 0) {
      planStatus.textContent = 'Bankprofil auf ein Fenster ziehen'
      return
    }
    commitState(
      updateOpeningSills(state, refs, {
        outer: asset.id ? { enabled: true, mode: 'profile', profileId: asset.id } : { mode: 'board', profileId: undefined },
      }),
    )
    return
  }
  if (asset.kind === 'pediment-form') {
    const refs = openingRefsForLibrary(hit)
    if (refs.length === 0) {
      planStatus.textContent = 'Verdachung auf ein Fenster oder eine Tür ziehen'
      return
    }
    if (asset.form === 'none') {
      commitState(updateOpeningPediment(state, refs, { enabled: false }))
    } else {
      commitState(updateOpeningPediment(state, refs, { enabled: true, form: asset.form }))
    }
    return
  }
  if (asset.kind === 'pediment-profile') {
    const refs = openingRefsForLibrary(hit)
    if (refs.length === 0) {
      planStatus.textContent = 'Verdachungsprofil auf ein Fenster oder eine Tür ziehen'
      return
    }
    if (!asset.id) {
      commitState(updateOpeningPediment(state, refs, { enabled: false }))
    } else {
      commitState(updateOpeningPediment(state, refs, { enabled: true, profileId: asset.id }))
    }
    return
  }
  if (asset.kind === 'pediment-console') {
    const refs = openingRefsForLibrary(hit)
    if (refs.length === 0) {
      planStatus.textContent = 'Konsole auf ein Fenster oder eine Tür ziehen'
      return
    }
    commitState(
      updateOpeningPediment(
        state,
        refs,
        asset.id
          ? { enabled: true, consoles: { enabled: true, profileId: asset.id } }
          : { consoles: { enabled: false, profileId: undefined } },
      ),
    )
    return
  }
  const ids = wallIdsForLibrary(hit)
  if (ids.length === 0) {
    planStatus.textContent = 'Profil auf eine Wand ziehen'
    return
  }
  if (asset.kind === 'cornice-profile') {
    commitState(
      updateWallCornice(
        state,
        ids,
        asset.id ? { enabled: true, profileId: asset.id } : { enabled: false },
      ),
    )
    return
  }
  if (asset.kind === 'plinth-profile') {
    commitState(
      updateStudioPanel(
        state,
        ids,
        asset.id
          ? { plinthEnabled: true, plinthProfileId: asset.id }
          : { plinthEnabled: false },
      ),
    )
  }
}

function libraryHitFromClient(clientX: number, clientY: number): { wallId?: string; openingId?: string } {
  const pick = pickFromEvent({ clientX, clientY })
  if (pick?.openingId) return { wallId: pick.wallId, openingId: pick.openingId }
  const wallHit = pickWallAtClient(clientX, clientY)
  const wallId = wallHit?.wallId ?? pick?.wallId
  if (wallHit) {
    const wall = getWall(state, wallHit.wallId)
    const opening = wall?.openings.find(
      (item) =>
        wallHit.localX >= item.x &&
        wallHit.localX <= item.x + item.width &&
        wallHit.localY >= item.y &&
        wallHit.localY <= item.y + item.height,
    )
    if (opening) return { wallId: wallHit.wallId, openingId: opening.id }
  }
  return wallId ? { wallId } : {}
}

function appendLibraryGroupLabel(host: HTMLElement, text: string) {
  const el = document.createElement('span')
  el.className = 'library-group-label'
  el.textContent = text
  host.appendChild(el)
}

function appendLibraryAssetCard(
  host: HTMLElement,
  asset: LibraryAsset,
  title: string,
  thumbEl: HTMLElement,
) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'opening-library-card'
  card.draggable = true
  card.title = `${title} — auf Element ziehen`
  const label = document.createElement('span')
  label.textContent = title
  card.append(thumbEl, label)
  card.addEventListener('click', () => {
    if (card.dataset.didDrag === '1') {
      delete card.dataset.didDrag
      return
    }
    applyLibraryAsset(asset)
  })
  card.addEventListener('dragstart', (event) => {
    card.dataset.didDrag = '1'
    activeLibraryAssetDrag = asset
    event.dataTransfer?.setData('application/x-library-asset', JSON.stringify(asset))
    event.dataTransfer?.setData('text/plain', title)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
    card.classList.add('is-dragging')
  })
  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging')
    viewport.classList.remove('library-drop-target')
    activeLibraryAssetDrag = null
  })
  host.appendChild(card)
}

function appendLibraryNoneCard(
  host: HTMLElement,
  asset: LibraryAsset,
  label: string,
  selected: boolean,
) {
  const thumb = document.createElement('div')
  thumb.className = 'opening-library-thumb tpl-card-thumb-empty'
  thumb.textContent = label
  appendLibraryAssetCard(host, asset, label, thumb)
  const last = host.lastElementChild as HTMLElement | null
  if (last) {
    last.dataset.libraryNone = '1'
    last.classList.toggle('active', selected)
  }
}

function appendLibraryProfileCards(
  host: HTMLElement,
  profiles: ProfileDefinition[],
  kind: Extract<LibraryAsset, { id: string }>['kind'],
  selectedId: string,
  color: string,
  noneLabel = 'Keines',
) {
  const noneSelected = !selectedId
  appendLibraryNoneCard(host, { kind, id: '' } as LibraryAsset, noneLabel, noneSelected)
  for (const profile of profiles) {
    const thumb = document.createElement('div')
    thumb.className = 'opening-library-thumb'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '-2 -2 18 18')
    svg.setAttribute('width', '48')
    svg.setAttribute('height', '48')
    thumb.appendChild(svg)
    drawSectionPreview(
      svg,
      profile.id,
      { rotationDeg: 0, flipOutward: false, flipForward: false },
      color,
      false,
      undefined,
      kind === 'cornice-profile',
    )
    const cardTitle = profileCardDisplayLabel(profile.label)
    appendLibraryAssetCard(host, { kind, id: profile.id } as LibraryAsset, cardTitle, thumb)
    const last = host.lastElementChild as HTMLElement | null
    last?.classList.toggle('active', !noneSelected && profile.id === canonicalProfileId(selectedId))
  }
}

function appendLibraryIdleNoneCard(host: HTMLElement, label = 'Keines') {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'opening-library-card'
  card.dataset.libraryNone = '1'
  card.title = label
  const thumb = document.createElement('div')
  thumb.className = 'opening-library-thumb tpl-card-thumb-empty'
  thumb.textContent = label
  const text = document.createElement('span')
  text.textContent = label
  card.append(thumb, text)
  card.addEventListener('click', () => {
    if (card.dataset.didDrag === '1') {
      delete card.dataset.didDrag
      return
    }
    if (libraryTab === 'walls') disarmLibraryWallPreset()
  })
  host.appendChild(card)
}

function hideNativeDragImage(event: DragEvent) {
  const dt = event.dataTransfer
  if (!dt) return
  let img = document.getElementById('library-drag-ghost') as HTMLCanvasElement | null
  if (!img) {
    img = document.createElement('canvas')
    img.id = 'library-drag-ghost'
    img.width = 1
    img.height = 1
    img.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none'
    document.body.appendChild(img)
  }
  dt.setDragImage(img, 0, 0)
}

function initOpeningLibrary() {
  const host = document.querySelector<HTMLDivElement>('#opening-library-items')
  if (!host) return
  syncLibraryTabs()
  host.replaceChildren()

  const appendOpeningPresetCard = (preset: (typeof WALL_OPENING_PRESETS)[number]) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'opening-library-card'
    card.draggable = true
    card.dataset.presetId = preset.id
    card.title = `${preset.label} — auf eine Wand ziehen`
    const thumb = document.createElement('div')
    thumb.className = 'opening-library-thumb'
    thumb.innerHTML = openingPreviewSvg(preset)
    const label = document.createElement('span')
    label.textContent = preset.label
    card.append(thumb, label)
    card.addEventListener('click', () => {
      if (card.dataset.didDrag === '1') {
        delete card.dataset.didDrag
        return
      }
      if (editor.selectedWallIds.length === 0) return
      addOpeningPresetToSelection(preset.id)
    })
    card.addEventListener('dragstart', (event) => {
      card.dataset.didDrag = '1'
        hideNativeDragImage(event)
      event.dataTransfer?.setData('application/x-opening-preset', preset.id)
      event.dataTransfer?.setData('text/plain', preset.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
      card.classList.add('is-dragging')
    })
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging')
      viewport.classList.remove('library-drop-target')
    })
    host.appendChild(card)
  }

  const appendTemplateCards = (kind: 'window' | 'door') => {
    for (const template of openingTemplates.filter((t) => t.draft.type === kind)) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.templateId = template.id
      card.title = `${template.name} — Vorlage`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb'
      thumb.innerHTML = templatePreviewHtml(template.draft)
      const label = document.createElement('span')
      label.textContent = template.name
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'preset-btn toolbar-danger opening-library-card-del'
      del.textContent = '×'
      del.title = 'Vorlage löschen'
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        openingTemplates = openingTemplates.filter((t) => t.id !== template.id)
        persistOpeningTemplates()
        initOpeningLibrary()
      })
      card.append(thumb, label, del)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        if (editor.selectedWallIds.length === 0) return
        void addOpeningTemplateToSelection(template.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-opening-template', template.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
      })
      host.appendChild(card)
    }

    const newBtn = document.createElement('button')
    newBtn.type = 'button'
    newBtn.id = 'opening-template-new'
    newBtn.className = 'preset-btn opening-library-new'
    newBtn.title = kind === 'door' ? 'Neue Tür-Vorlage' : 'Neue Fenster-Vorlage'
    newBtn.textContent = 'Neue Vorlage'
    host.appendChild(newBtn)
  }

  if (libraryTab === 'walls') {
    appendLibraryIdleNoneCard(host, 'Keines')
    for (const preset of WALL_LENGTH_PRESETS) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.wallPresetId = preset.id
      card.title = `${preset.label} — in den Grundriss ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb opening-library-thumb-wall'
      thumb.innerHTML = wallLengthPreviewSvg(preset.lengthCm)
      const label = document.createElement('span')
      label.textContent = preset.label
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        onWallLibraryCardClick(preset.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-wall-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(card)
    }
    for (const preset of WALL_END_PIECE_PRESETS) {
      const endCard = document.createElement('button')
      endCard.type = 'button'
      endCard.className = 'opening-library-card'
      endCard.draggable = true
      endCard.dataset.wallPresetId = preset.id
      endCard.title = `${preset.label} — in die Fläche oder an ein Wandende ziehen`
      const endThumb = document.createElement('div')
      endThumb.className = 'opening-library-thumb opening-library-thumb-wall'
      endThumb.innerHTML = wallEndPiecePreviewSvg(preset.hand)
      const endLabel = document.createElement('span')
      endLabel.textContent = preset.label
      endCard.append(endThumb, endLabel)
      endCard.addEventListener('click', () => {
        if (endCard.dataset.didDrag === '1') {
          delete endCard.dataset.didDrag
          return
        }
        onWallLibraryCardClick(preset.id)
      })
      endCard.addEventListener('dragstart', (event) => {
        endCard.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-wall-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        endCard.classList.add('is-dragging')
      })
      endCard.addEventListener('dragend', () => {
        endCard.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(endCard)
    }
    for (const preset of WALL_WITH_OPENING_PRESETS) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.wallPresetId = preset.id
      card.title = `${preset.label} — in den Grundriss ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb opening-library-thumb-wall'
      thumb.innerHTML = wallWithOpeningPreviewSvg(preset)
      const label = document.createElement('span')
      label.textContent = preset.label
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        onWallLibraryCardClick(preset.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-wall-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(card)
    }
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'bay') {
    appendLibraryIdleNoneCard(host, 'Keines')
    for (const preset of BAY_WINDOW_PRESETS.filter((item) => bayPresetKind(item) === 'bay')) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.bayPresetId = preset.id
      card.title = `${preset.label} — in die Fläche oder auf eine Wand ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb opening-library-thumb-wall'
      thumb.innerHTML = bayWindowPreviewSvg(preset)
      const label = document.createElement('span')
      label.textContent = preset.label
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        placeBayWindowFromLibrary(preset.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-bay-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(card)
    }
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'balcony') {
    appendLibraryIdleNoneCard(host, 'Keines')
    for (const preset of BAY_WINDOW_PRESETS.filter((item) => bayPresetKind(item) === 'balcony')) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.bayPresetId = preset.id
      card.title = `${preset.label} — in die Fläche oder auf eine Wand ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb opening-library-thumb-wall'
      thumb.innerHTML = bayWindowPreviewSvg(preset)
      const label = document.createElement('span')
      label.textContent = preset.label
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        placeBayWindowFromLibrary(preset.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-bay-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(card)
    }
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'loggia') {
    appendLibraryIdleNoneCard(host, 'Keines')
    for (const preset of BAY_WINDOW_PRESETS.filter((item) => bayPresetKind(item) === 'loggia')) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.bayPresetId = preset.id
      card.title = `${preset.label} — in die Fläche oder auf eine Wand ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb opening-library-thumb-wall'
      thumb.innerHTML = bayWindowPreviewSvg(preset)
      const label = document.createElement('span')
      label.textContent = preset.label
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        placeBayWindowFromLibrary(preset.id)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-bay-preset', preset.id)
        activeWallDragPresetId = preset.id
        event.dataTransfer?.setData('text/plain', preset.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activeWallDragPresetId = null
        wallDockAxisOverride = null
        lastWallDockClient = null
        clearWallDockPreview()
      })
      host.appendChild(card)
    }
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'panels') {
    const patterns = ['none' as const, ...PANEL_KIND_PATTERNS, ...MASONRY_KIND_PATTERNS]
    for (const pattern of patterns) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'opening-library-card'
      card.draggable = true
      card.dataset.panelPattern = pattern
      card.title = `${PATTERN_LABELS[pattern]} — auf Wand ziehen`
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb'
      const svg = clonePatternPreviewSvg(pattern)
      thumb.appendChild(svg)
      const label = document.createElement('span')
      label.textContent = PATTERN_LABELS[pattern]
      card.append(thumb, label)
      card.addEventListener('click', () => {
        if (card.dataset.didDrag === '1') {
          delete card.dataset.didDrag
          return
        }
        applyPanelPresetFromLibrary(pattern)
      })
      card.addEventListener('dragstart', (event) => {
        card.dataset.didDrag = '1'
        hideNativeDragImage(event)
        event.dataTransfer?.setData('application/x-panel-preset', pattern)
        activePanelDragPatternId = pattern
        event.dataTransfer?.setData('text/plain', pattern)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
        card.classList.add('is-dragging')
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging')
        viewport.classList.remove('library-drop-target')
        activePanelDragPatternId = null
      })
      host.appendChild(card)
    }
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'profiles') {
    const openingSel = selectedWindowOpening()
    const wall = selectedWalls()[0]
    appendLibraryGroupLabel(host, 'Rahmen')
    appendLibraryProfileCards(
      host,
      frameProfileDefinitions(),
      'frame-profile',
      openingSel ? openingProfileId(openingSel.wall, openingSel.opening.id) ?? '' : '',
      activeTrimColor(),
      'Keines',
    )
    appendLibraryGroupLabel(host, 'Gesims')
    appendLibraryProfileCards(
      host,
      corniceProfileDefinitions(),
      'cornice-profile',
      wall && wallCornice(wall).enabled ? (wallCornice(wall).profileId ?? '') : '',
      wall ? (wallCornice(wall).color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR) : DEFAULT_PROFILE_COLOR,
      'Keines',
    )
    appendLibraryGroupLabel(host, 'Sockel')
    appendLibraryProfileCards(
      host,
      plinthProfileDefinitions(),
      'plinth-profile',
      wall?.panel && wall.panel.plinthEnabled !== false
        ? (wall.panel.plinthProfileId ?? DEFAULT_PLINTH_PROFILE_ID)
        : '',
      activePlinthProfileColor(wall),
      'Keiner',
    )
    appendLibraryGroupLabel(host, 'Fensterbank')
    const sill = openingSel?.opening.sillOuter
    appendLibraryProfileCards(
      host,
      sillOuterProfileDefinitions(),
      'sill-profile',
      sill?.mode === 'profile' ? (sill.profileId ?? '') : '',
      sill?.color ?? activeTrimColor(),
      'Keines',
    )
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'pediment') {
    const openingSel = selectedWindowOpening()
    const pediment = openingSel ? normalizeOpeningPediment(openingSel.opening.pediment) : null
    appendLibraryGroupLabel(host, 'Form')
    appendLibraryNoneCard(
      host,
      { kind: 'pediment-form', form: 'none' },
      'Keine',
      !pediment?.enabled,
    )
    const forms: Array<{ form: PedimentForm; label: string; svg: string }> = [
      { form: 'straight', label: 'Gerade', svg: '<svg viewBox="0 0 48 28" width="48" height="28"><path d="M6 20 H42" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>' },
      { form: 'triangle', label: 'Dreieck', svg: '<svg viewBox="0 0 48 28" width="48" height="28"><path d="M6 22 L24 6 L42 22" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>' },
      { form: 'segment', label: 'Segment', svg: '<svg viewBox="0 0 48 28" width="48" height="28"><path d="M6 22 Q24 2 42 22" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>' },
      { form: 'triangleClosed', label: 'Dreieck zu', svg: '<svg viewBox="0 0 48 28" width="48" height="28"><path d="M12 22 L24 6 L36 22 Z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>' },
      { form: 'segmentClosed', label: 'Segment zu', svg: '<svg viewBox="0 0 48 28" width="48" height="28"><path d="M12 22 Q24 4 36 22 Z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>' },
      { form: 'round', label: 'Rundbogen', svg: archFormPreviewSvg('round') },
      { form: 'pointed', label: 'Spitzbogen', svg: archFormPreviewSvg('pointed') },
      { form: 'segmental', label: 'Stichbogen', svg: archFormPreviewSvg('segmental') },
      { form: 'lancet', label: 'Lanzett', svg: archFormPreviewSvg('lancet') },
      { form: 'ellipse', label: 'Ellipse', svg: archFormPreviewSvg('ellipse') },
      { form: 'tudor', label: 'Tudor', svg: archFormPreviewSvg('tudor') },
    ]
    for (const item of forms) {
      const thumb = document.createElement('div')
      thumb.className = 'opening-library-thumb'
      thumb.innerHTML = item.svg
      appendLibraryAssetCard(host, { kind: 'pediment-form', form: item.form }, item.label, thumb)
      const last = host.lastElementChild as HTMLElement | null
      last?.classList.toggle('active', Boolean(pediment?.enabled) && pediment?.form === item.form)
    }
    appendLibraryGroupLabel(host, 'Profil')
    appendLibraryProfileCards(
      host,
      pedimentProfileDefinitions(),
      'pediment-profile',
      pediment?.enabled ? (pediment.profileId ?? '') : '',
      pediment?.color ?? activeTrimColor(),
      'Keines',
    )
    appendLibraryGroupLabel(host, 'Konsolen')
    appendLibraryProfileCards(
      host,
      pedimentConsoleProfileDefinitions(),
      'pediment-console',
      pediment?.enabled && pediment.consoles?.enabled ? (pediment.consoles.profileId ?? '') : '',
      pediment?.color ?? activeTrimColor(),
      'Keine',
    )
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'lights') {
    appendLibraryGroupLabel(host, 'Lichtquellen')
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'opening-library-card'
    card.title = 'Punktlicht — klicken oder in die Szene ziehen'
    const thumb = document.createElement('div')
    thumb.className = 'opening-library-thumb'
    thumb.innerHTML =
      '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#ffcc88"/><circle cx="24" cy="24" r="17" fill="none" stroke="#ffaa44" stroke-width="2" opacity="0.5"/><path d="M24 5 v6 M24 37 v6 M5 24 h6 M37 24 h6" stroke="#ffaa44" stroke-width="2" stroke-linecap="round" opacity="0.45"/></svg>'
    const label = document.createElement('span')
    label.textContent = 'Punktlicht'
    card.append(thumb, label)
    card.draggable = true
    card.addEventListener('click', () => {
      if (card.dataset.didDrag === '1') {
        delete card.dataset.didDrag
        return
      }
      insertSceneLightFromLibrary()
    })
    card.addEventListener('dragstart', (event) => {
      card.dataset.didDrag = '1'
      hideNativeDragImage(event)
      event.dataTransfer?.setData('application/x-scene-light', 'point')
      event.dataTransfer?.setData('text/plain', 'scene-light')
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
      card.classList.add('is-dragging')
    })
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging')
      viewport.classList.remove('library-drop-target')
    })
    host.appendChild(card)
    appendLibraryGroupLabel(host, 'Anzeige')
    const markerToggle = document.createElement('label')
    markerToggle.className = 'library-lights-option toolbar-check'
    const markerCheckbox = document.createElement('input')
    markerCheckbox.type = 'checkbox'
    markerCheckbox.checked = state.viewOptions?.showLightMarkers !== false
    markerCheckbox.addEventListener('change', () => {
      commitViewOptions({ showLightMarkers: markerCheckbox.checked })
      syncSceneLightRuntime()
    })
    markerToggle.append(markerCheckbox, document.createTextNode(' Lichtpunkte anzeigen'))
    host.appendChild(markerToggle)
    syncLibraryAppliedOutline()
    return
  }

  if (libraryTab === 'niches') {
    appendLibraryIdleNoneCard(host, 'Keines')
    for (const preset of WALL_OPENING_PRESETS.filter(
      (p) => p.type === 'cutout' || p.type === 'conch',
    )) {
      appendOpeningPresetCard(preset)
    }
    syncLibraryAppliedOutline()
    return
  }

  appendLibraryIdleNoneCard(host, 'Keines')
  const openingType = libraryTab === 'doors' ? 'door' : 'window'
  for (const preset of WALL_OPENING_PRESETS.filter((p) => p.type === openingType)) {
    appendOpeningPresetCard(preset)
  }

  const divider = document.createElement('div')
  divider.className = 'opening-library-divider'
  divider.setAttribute('aria-hidden', 'true')
  host.appendChild(divider)

  appendTemplateCards(openingType)
  syncLibraryAppliedOutline()
}

async function addOpeningTemplateToSelection(
  templateId: string,
  options?: { wallId?: string; at?: { x: number; y?: number } },
) {
  const template = openingTemplates.find((t) => t.id === templateId)
  const wallIds = options?.wallId ? [options.wallId] : [...editor.selectedWallIds]
  if (!template || wallIds.length === 0) return

  type PendingInsert = {
    wallId: string
    opening: ReturnType<typeof createOpening>
    issue: NonNullable<ReturnType<typeof assessOpeningInsert>>
  }
  const inserts: Array<{ wallId: string; opening: ReturnType<typeof createOpening> }> = []
  const blocked: PendingInsert[] = []

  for (const wallId of wallIds) {
    const wall = getWall(state, wallId)
    if (!wall) continue
    const at = options?.at
      ? {
          x: options.at.x,
          y: template.draft.type === 'door' ? 0 : (template.draft.y ?? options.at.y),
        }
      : undefined
    let opening = createOpening(
      template.draft.type,
      template.draft.width,
      template.draft.height,
      wall,
      at,
      {
        donorWalls: getAllWalls(state).filter(
          (item) => item.buildingId === wall.buildingId && item.id !== wall.id,
        ),
      },
    )
    opening = applyTemplateDraft(opening, template.draft)
    const issue = assessOpeningInsert(wall, opening)
    if (issue) blocked.push({ wallId, opening, issue })
    else inserts.push({ wallId, opening })
  }

  const applyProfile = (next: FacadeState, wallId: string, openingId: string) => {
    if (!template.draft.profileId) return next
    return assignProfilesToOpenings(
      next,
      [{ wallId, openingId }],
      [...ALL_EDGES],
      template.draft.profileId,
    )
  }

  if (blocked.length > 0) {
    const first = blocked[0]
    const canReplace = blocked.every((item) => item.issue.kind === 'overlap')
    const choice = await confirmOpeningInsert(
      `${first.issue.message} (${template.name})`,
      canReplace,
    )
    if (choice !== 'replace') return

    let next = state
    const newRefs: OpeningRef[] = []
    for (const item of blocked) {
      if (item.issue.kind !== 'overlap') continue
      next = insertOpeningReplacingOverlaps(
        next,
        item.wallId,
        item.opening,
        item.issue.overlapping.map((opening) => opening.id),
      )
      next = applyProfile(next, item.wallId, item.opening.id)
      newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
    }
    for (const item of inserts) {
      next = addOpening(next, item.wallId, item.opening)
      next = applyProfile(next, item.wallId, item.opening.id)
      newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
    }
    if (newRefs.length === 0) return
    commitState(next, {
      ...editor,
      selectedOpenings: newRefs,
      selectedWallIds: [...new Set(newRefs.map((ref) => ref.wallId))],
      selectedEdges: [],
    })
    return
  }

  let next = state
  const newRefs: OpeningRef[] = []
  for (const item of inserts) {
    next = addOpening(next, item.wallId, item.opening)
    next = applyProfile(next, item.wallId, item.opening.id)
    newRefs.push({ wallId: item.wallId, openingId: item.opening.id })
  }
  if (newRefs.length === 0) return
  commitState(next, {
    ...editor,
    selectedOpenings: newRefs,
    selectedWallIds: [...new Set(newRefs.map((ref) => ref.wallId))],
    selectedEdges: [],
  })
}

function pickWallAtClient(clientX: number, clientY: number): { wallId: string; localX: number; localY: number } | null {
  if (currentView === 'front') {
    return svgView.hitTestClient(clientX, clientY)
  }
  if (currentView !== '3d') return null

  const rect = canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )
  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, camera)
  const hits = ray.intersectObjects([facade.wallGroup, facade.claddingGroup], true)
  for (const hit of hits) {
    let current: THREE.Object3D | null = hit.object
    while (current) {
      const wallId = current.userData.wallId as string | undefined
      if (wallId && current.userData.kind === 'wall') {
        const wall = getWall(state, wallId)
        if (!wall) return null
        const originX = wall.originX ?? wall.x
        const originZ = wall.originZ ?? 0
        const yawRad = ((wall.yawDeg ?? 0) * Math.PI) / 180
        const dx = hit.point.x - originX
        const dz = hit.point.z - originZ
        return {
          wallId,
          localX: dx * Math.cos(yawRad) - dz * Math.sin(yawRad),
          localY: hit.point.y - wall.y,
        }
      }
      current = current.parent
    }
  }
  return null
}

function anchorWall(): Wall | undefined {
  return selectedWalls().at(-1)
}

function openingExists(nextState: FacadeState, ref: OpeningRef): boolean {
  const wall = getWall(nextState, ref.wallId)
  return Boolean(wall?.openings.some((opening) => opening.id === ref.openingId))
}

function normalizeEditor(nextState: FacadeState, nextEditor: EditorState): EditorState {
  const sceneLightId = nextEditor.selectedSceneLightId
  const sceneLightSelected =
    typeof sceneLightId === 'string' &&
    sceneLightId.length > 0 &&
    normalizeSceneLights(nextState.sceneLights).some((item) => item.id === sceneLightId)

  if (sceneLightSelected) {
    return { ...createDefaultEditorState(), selectedSceneLightId: sceneLightId }
  }

  const selectedWallIds = nextEditor.selectedWallIds.filter((id) =>
    getAllWalls(nextState).some((wall) => wall.id === id),
  )
  const selectedOpenings = nextEditor.selectedOpenings.filter((ref) =>
    openingExists(nextState, ref),
  )
  const selectedWallPart =
    selectedOpenings.length === 0 && selectedWallIds.length > 0
      ? nextEditor.selectedWallPart ?? 'group'
      : undefined
  let selectedTrimBandId: string | undefined
  if (selectedWallPart === 'trimBand' && nextEditor.selectedTrimBandId && selectedWallIds[0]) {
    const wall = getWall(nextState, selectedWallIds[0])
    if (wall?.trimBands?.some((band) => band.id === nextEditor.selectedTrimBandId)) {
      selectedTrimBandId = nextEditor.selectedTrimBandId
    }
  }

  return {
    selectedWallIds,
    selectedOpenings,
    selectedEdges: selectedOpenings.length > 0 ? [...nextEditor.selectedEdges] : [],
    selectedOpeningPart:
      selectedOpenings.length > 0 ? nextEditor.selectedOpeningPart ?? 'group' : undefined,
    selectedWallPart,
    selectedTrimBandId,
    selectedRoofBuildingId: nextEditor.selectedRoofBuildingId,
    selectedRoofPart: nextEditor.selectedRoofBuildingId
      ? nextEditor.selectedRoofPart ?? 'group'
      : undefined,
    selectedCeiling: nextEditor.selectedCeiling,
    selectedBuildingId: nextEditor.selectedBuildingId,
  }
}

function buildLayerOrderForState(facadeState: FacadeState = state): LayerItem[] {
  return buildLayerOrder(facadeState)
}

function editorFromLayerRange(from: number, to: number): EditorState {
  const items = buildLayerOrderForState()
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const wallIds = items
    .slice(start, end + 1)
    .map((item) => item.wallId)
  return { selectedWallIds: wallIds, selectedOpenings: [], selectedEdges: [] }
}

function sitePlanBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let any = false

  for (const building of state.buildings) {
    if (building.hidden) continue
    for (const wall of building.walls.filter(isStudioWall)) {
      any = true
      const ox = wall.originX ?? wall.x
      const oz = wall.originZ ?? 0
      const along = wallAlongDelta(wall.yawDeg ?? 0, wall.width)
      minX = Math.min(minX, ox, ox + along.x)
      maxX = Math.max(maxX, ox, ox + along.x)
      minZ = Math.min(minZ, oz, oz + along.z)
      maxZ = Math.max(maxZ, oz, oz + along.z)
    }
    const gridBounds = planGridBoundsForBuilding(building)
    if (gridBounds) {
      any = true
      minX = Math.min(minX, gridBounds.minGx * PLAN_GRID)
      maxX = Math.max(maxX, gridBounds.maxGx * PLAN_GRID)
      minZ = Math.min(minZ, gridBounds.minGz * PLAN_GRID)
      maxZ = Math.max(maxZ, gridBounds.maxGz * PLAN_GRID)
    }
  }

  if (!any) return null
  return { minX, maxX, minZ, maxZ }
}

/** Min/Max-Zoom für Grundriss — min = gesamte Site sichtbar (bei zentrierter Kamera). */
function planZoomLimits(): { min: number; max: number } {
  const bounds = sitePlanBounds()
  const baseSpan = PLAN_VIEW_SIZE + PLAN_GRID
  if (!bounds) return { min: 0.05, max: 8 }
  const contentSpan =
    Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, baseSpan * 0.3) +
    GROUND_MARGIN
  const min = Math.max(0.05, (baseSpan / contentSpan) * 0.95)
  return { min, max: 8 }
}

function clampPlanZoom(zoom: number): number {
  const { min, max } = planZoomLimits()
  return Math.max(min, Math.min(max, zoom))
}

function clampFrontZoom(zoom: number): number {
  return Math.max(0.25, Math.min(8, zoom))
}

function resetFrontNav() {
  frontZoom = 1
  frontPanScreenX = 0
  frontPanScreenY = 0
  cancelViewZoomAnim()
}

function syncFrontCamera() {
  applyFrontCameraView()
  if (currentView === 'front') markViewportDirty()
}

function panFrontByPixels(dx: number, dy: number) {
  cancelViewZoomAnim()
  beginViewNavLite()
  const { halfW, halfH } = frontFrustumHalfExtents()
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  const scaleX = (2 * halfW) / Math.max(width, 1)
  const scaleY = (2 * halfH) / Math.max(height, 1)
  // Wie OrbitControls.pan: Inhalt folgt dem Cursor (nicht spiegelverkehrt zur Fassaden-Yaw).
  frontPanScreenX -= dx * scaleX
  frontPanScreenY += dy * scaleY
  syncFrontCamera()
}

function syncCameraDistanceLimits() {
  if (isGalleryModeActive()) {
    applyGalleryOrbitTuning()
    return
  }
  const box = buildingWorldBox(getAllWalls(state))
  if (box.isEmpty()) {
    controls.maxDistance = 4000
    camera.far = 5000
    camera.near = 1
    camera.updateProjectionMatrix()
    return
  }
  const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 400)
  const radius = Math.max(span / 2, 200)
  controls.maxDistance = Math.max(4000, radius * 6)
  camera.far = Math.max(5000, controls.maxDistance + radius * 2 + 1000)
  camera.near = 1
  camera.updateProjectionMatrix()
  if (fogSettings.enabled && fogSettings.type === 'linear') {
    const far = Math.max(fogSettings.far, camera.far)
    if (far > fogSettings.far) {
      fogSettings = { ...fogSettings, far }
      applyFogToScene()
    }
  }
}

/** Beim Rauszoomen auf Site-Mitte springen, damit alle Häuser im Bild bleiben. */
function framePlanIfZoomedOut(factor: number) {
  if (factor >= 1) return
  const { min } = planZoomLimits()
  if (planZoom <= min * 1.05) {
    framePlanCameraToContent()
  }
}

function planFrustumSpan(): number {
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  const aspect = width / Math.max(height, 1)
  const margin = PLAN_GRID * 0.5
  const span = PLAN_VIEW_SIZE + margin * 2
  const halfW = span / (2 * planZoom)
  const halfH = halfW / (aspect > 0 ? aspect : 1)
  return Math.max(halfW, halfH) * 2
}

function syncGroundDepthForView() {
  groundMat.depthWrite = true
  ground.renderOrder = 0
  floorPlanView.root.renderOrder = 0
}

function groundSizeForView(): { size: number; cx: number; cz: number } {
  const planSize = PLAN_VIEW_SIZE + PLAN_GRID
  const studio = sitePlanBounds()
  const extra = currentView === '3d' ? SHADOW_GROUND_MAX_LENGTH : 0
  if (!studio) {
    const frustumSpan = currentView === 'top' ? planFrustumSpan() : 0
    const base = planSize + GROUND_MARGIN * 2
    return {
      size: Math.max(frustumSpan > 0 ? Math.max(base, frustumSpan * 1.2) : base, extra * 2),
      cx: planSize / 2,
      cz: planSize / 2,
    }
  }
  const buildingCount = Math.max(1, state.buildings.filter((b) => !b.hidden).length)
  const margin = GROUND_MARGIN + (buildingCount - 1) * PLAN_GRID * 4
  const width = studio.maxX - studio.minX + (margin + extra) * 2
  const depth = studio.maxZ - studio.minZ + (margin + extra) * 2
  const frustumSpan = currentView === 'top' ? planFrustumSpan() : 0
  const frustumMin = frustumSpan > 0 ? frustumSpan * 1.2 : 0
  const size = Math.max(width, depth, planSize + margin, frustumMin)
  return {
    size,
    cx: (studio.minX + studio.maxX) / 2,
    cz: (studio.minZ + studio.maxZ) / 2,
  }
}

function framePlanCameraToContent() {
  const studio = sitePlanBounds()
  if (!studio) {
    planOffsetX = 0
    planOffsetZ = 0
    return
  }
  const cx = (studio.minX + studio.maxX) / 2
  const cz = (studio.minZ + studio.maxZ) / 2
  planOffsetX = cx - PLAN_VIEW_SIZE / 2
  planOffsetZ = cz - PLAN_VIEW_SIZE / 2
  planZoom = clampPlanZoom(planZoom)
}

function rebuildPlanWallOverlay() {
  floorPlanView.clearWallOverlay()
  const activeId = state.activeBuildingId
  let first = true
  for (const building of state.buildings) {
    if (building.hidden) continue
    const isActive = building.id === activeId
    const walls = building.walls.filter(isStudioWall)
    floorPlanView.rebuildWallOverlay(
      walls,
      isActive ? currentFloor : undefined,
      building.wallHeight,
      { dimmed: !isActive, buildingId: building.id, append: !first },
    )
    first = false
  }
  floorPlanView.rebuildBuildingBoundsOverlay(state.buildings, editor.selectedBuildingId)
  if (!planBuildingDrag) floorPlanView.clearBuildingGuides()
  if (currentView === 'top') markViewportDirty()
}

function updateGroundPlane() {
  const { size, cx, cz } = groundSizeForView()
  const next = new THREE.PlaneGeometry(size, size)
  ground.geometry.dispose()
  ground.geometry = next
  groundGeo = next
  ground.scale.set(1, 1, 1)
  ground.position.set(cx, GROUND_Y, cz)
  ground.visible = currentView !== 'front'
  syncGroundDepthForView()
}

function getActiveCamera(): THREE.Camera {
  if (currentView === 'front') return frontCamera
  if (currentView === 'top') return topCamera
  return camera
}

function applyFrontCameraView(opts?: {
  width?: number
  height?: number
  yaw?: number
  /** Export-Capture: Einpassen ohne Nutzer-Zoom/Pan. */
  fitOnly?: boolean
  /** Nur Frustum für Pan-Skalierung (ohne Nutzer-Pan anwenden). */
  panOnly?: boolean
}) {
  if (opts?.fitOnly) {
    invalidateFrontViewBase()
  }

  const walls = (opts?.yaw != null ? getAllWalls(state) : wallsForElevation()).filter(isStudioWall)
  const width = Math.max(1, opts?.width ?? viewportRenderWidth())
  const height = Math.max(1, opts?.height ?? viewportRenderHeight())

  let yaw = 0
  if (opts?.yaw != null) yaw = opts.yaw
  else if (currentElevation.kind === 'yaw') yaw = currentElevation.yaw
  else if (currentElevation.kind === 'wall') {
    yaw = getWall(state, currentElevation.wallId)?.yawDeg ?? 0
  } else {
    const yaws = walls.map((wall) => wall.yawDeg ?? 0)
    yaw = yaws.sort((a, b) =>
      yaws.filter((v) => v === b).length - yaws.filter((v) => v === a).length,
    )[0] ?? 0
  }

  let base: FrontViewBase | null
  if (opts?.yaw != null || opts?.width != null || opts?.height != null || opts?.fitOnly) {
    base = computeFrontViewBase(walls, yaw, width, height)
  } else {
    base = getFrontViewBase()
  }

  if (!base) {
    frontCamera.left = -200
    frontCamera.right = 200
    frontCamera.top = 200
    frontCamera.bottom = -200
    frontCamera.position.set(0, 200, 800)
    frontCamera.lookAt(0, 200, 0)
    frontCamera.updateProjectionMatrix()
    return
  }

  applyFrontCameraFromBase(base, opts)
}

function syncFrontView() {
  applyFrontCameraView()
  ground.visible = false
  canvas.style.left = ''
  canvas.style.top = ''
  canvas.style.width = ''
  canvas.style.height = ''
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  applyRendererPixelRatio()
  renderer.setSize(width, height)
  markViewportDirty()
}

function centerSvgViewScroll() {
  requestAnimationFrame(() => {
    svgContainer.scrollLeft = Math.max(
      0,
      (svgContainer.scrollWidth - svgContainer.clientWidth) / 2,
    )
    svgContainer.scrollTop = Math.max(
      0,
      (svgContainer.scrollHeight - svgContainer.clientHeight) / 2,
    )
  })
}

function applyTodaySunDate() {
  const today = todayMonthDay()
  sunSettings = syncSunSettingsFromSolar(
    { ...sunSettings, month: today.month, day: today.day },
    { applySolarLook: false },
  )
}

function syncSunUi() {
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  sunDateInput.value = dateInputValue(sunSettings.month, sunSettings.day)
  sunTimeInput.min = '0'
  sunTimeInput.max = '24'
  sunTimeInput.value = String(sunSettings.timeOfDay)
  sunAzimuthInput.value = String(Math.round(sunSettings.azimuth))
  sunIntensityInput.value = String(sunSettings.intensity)
  sunSoftnessInput.value = String(sunSettings.shadowSoftness)
  sunColorTempInput.value = String(sunSettings.colorTemperature)
  sunAmbientInput.value = String(sunSettings.ambient)
  sunShadowContrastInput.value = String(sunSettings.shadowContrast)
  sunShadowDensityInput.value = String(sunSettings.shadowDensity)
  sunAzimuthValue.textContent = `${Math.round(sunSettings.azimuth)}°`
  sunTimeValue.textContent = formatTimeOfDay(sunSettings.timeOfDay)
  sunIntensityValue.textContent = sunSettings.intensity.toFixed(1)
  sunSoftnessValue.textContent = sunSettings.shadowSoftness.toFixed(1)
  sunColorTempValue.textContent = `${Math.round(sunSettings.colorTemperature)} K`
  sunAmbientValue.textContent = sunSettings.ambient.toFixed(2)
  sunShadowContrastValue.textContent = sunSettings.shadowContrast.toFixed(2)
  sunShadowDensityValue.textContent = sunSettings.shadowDensity.toFixed(2)

  const compass = sunSettings.animUseCompass
  const time = sunSettings.animUseTime
  sunAnimUseCompass.checked = compass
  sunAnimUseTime.checked = time
  sunAnimCompassRow.hidden = !compass
  sunAnimTimeRow.hidden = !time
  sunAnimBothHint.hidden = !(compass && time)
  if (compass) {
    sunAnimFromCompass.value = String(sunSettings.animFromAzimuth)
    sunAnimToCompass.value = String(sunSettings.animToAzimuth)
  }
  if (time) {
    sunAnimFromTime.value = timeInputValue(sunSettings.animFromTime)
    sunAnimToTime.value = timeInputValue(sunSettings.animToTime)
  }
  sunAnimDuration.value = String(sunSettings.animDurationSec)
  const range = resolveAnimTimeRange(sunSettings)
  sunAnimHint.hidden = !range.approxHint
}

function commitSunFromDateTime(applySolarLook = true) {
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook })
  syncSunUi()
  applySunLighting()
}

function setSunAnimChannel(channel: 'time' | 'compass', enabled: boolean) {
  if (channel === 'compass') {
    if (!enabled && !sunSettings.animUseTime) {
      sunAnimUseCompass.checked = true
      return
    }
    sunSettings.animUseCompass = enabled
  } else {
    if (!enabled && !sunSettings.animUseCompass) {
      sunAnimUseTime.checked = true
      return
    }
    sunSettings.animUseTime = enabled
    if (enabled) {
      const bounds = resolveSunFromDate(sunSettings).bounds
      if (sunSettings.animFromTime === sunSettings.animToTime) {
        sunSettings.animFromTime = bounds.sunrise
        sunSettings.animToTime = bounds.sunset
      }
    }
  }
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
}

/**
 * Paneel-/Mauerwerk-Shadow-Map: farbiger Aufriss und 3D; Zeichnung aus.
 * Ost/West bei Südsonne im Aufriss: Streiflicht → Empfang aus (Acne).
 */
let facadeReady = false
function syncCladdingReceiveShadows() {
  // applySceneAppearance / early applySunLighting laufen vor `const facade = …`
  if (!facadeReady) return
  if (presentationUsesWorkLikeShading(presentationMode)) {
    facade.setCladdingReceiveShadows(true)
    return
  }
  if (currentRenderStyle === 'line') {
    facade.setCladdingReceiveShadows(false)
    return
  }
  if (currentView === '3d') {
    facade.setCladdingReceiveShadows(true)
    return
  }
  if (currentView !== 'front') {
    facade.setCladdingReceiveShadows(false)
    return
  }
  let yaw = 0
  if (currentElevation.kind === 'yaw') yaw = currentElevation.yaw
  else if (currentElevation.kind === 'wall') {
    yaw = getWall(state, currentElevation.wallId)?.yawDeg ?? 0
  }
  const grazing = facadeSunIsGrazing(yaw, sunSettings.azimuth)
  facade.setCladdingReceiveShadows(!grazing)
}

function applyPcssSoftnessLive() {
  if (presentationUsesWorkLikeShading(presentationMode)) return
  updatePcssShadowParameters(
    sunSettings.shadowSoftness,
    shadowFrustumWidthCm(dirLight),
    scene,
  )
  markViewportDirty()
  if (currentView === '3d') render3dFrame()
  else if (currentView === 'front') renderLitSceneFrame(frontCamera)
  else if (currentView === 'top') renderLitSceneFrame(topCamera)
}

const SUN_SHADOW_MAP_MIN_INTERVAL_MS = 90
let sunShadowMapTimer = 0
let sunShadowMapQueued = false
let sunSliderPersistTimer = 0

function flushSunShadowMap() {
  if (sunShadowMapTimer) {
    window.clearTimeout(sunShadowMapTimer)
    sunShadowMapTimer = 0
  }
  sunShadowMapQueued = false
  renderer.shadowMap.needsUpdate = true
  markSceneReflectionsDirty()
  markViewportDirty()
}

function dismissAppLoading() {
  const el = document.querySelector('#app-loading')
  if (!el) return
  el.classList.add('is-done')
  el.setAttribute('aria-busy', 'false')
  markViewportDirty()
  window.setTimeout(() => el.remove(), 400)
}

/** Atmosphäre + Fenster-Meshes im Hintergrund; Schatten-Map erst wenn beides da ist. */
function bootstrapSceneLighting(): Promise<void> {
  void preloadWallLabelFlatFont().then(() => {
    facade.refreshWallLabels({ afterFontLoad: true })
    markViewportDirty()
  })
  return Promise.all([atmosphereSky.load(renderer), facade.whenMeshesReady]).then(() => {
    syncCladdingReceiveShadows()
    startupShadowReady = true
    applySunLighting({ updateShadowMap: true })
    sceneLightingReady = true
    markViewportDirty()
    if (currentView === 'front') syncFrontView()
    else if (currentView === 'top') syncTopView()
  })
}

/** Shadow-Map während Slider/Animation gedrosselt — Licht sofort, Bake später. */
function scheduleSunShadowMapUpdate() {
  sunShadowMapQueued = true
  if (sunShadowMapTimer) return
  sunShadowMapTimer = window.setTimeout(() => {
    sunShadowMapTimer = 0
    if (!sunShadowMapQueued) return
    sunShadowMapQueued = false
    renderer.shadowMap.needsUpdate = true
    markSceneReflectionsDirty()
    markViewportDirty()
  }, SUN_SHADOW_MAP_MIN_INTERVAL_MS)
}

function sceneLightRoomOcclusionActive(): boolean {
  if (presentationMode !== 'render') return false
  if (currentView !== '3d' && currentView !== 'front') return false
  return normalizeSceneLights(state.sceneLights).some((item) => item.enabled)
}

function sceneLightShadowFarCm(): number {
  const box = buildingWorldBox(getAllWalls(state))
  if (box.isEmpty()) return 2400
  const span = Math.max(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
    400,
  )
  return Math.min(4800, span * 1.8 + 400)
}

function sceneLightsActive(): boolean {
  return normalizeSceneLights(state.sceneLights).some((item) => item.enabled)
}

function syncSceneLightRuntime(): void {
  const roomOcclusion = sceneLightRoomOcclusionActive()
  const lightsActive = sceneLightsActive()
  sceneLightRuntime.sync(normalizeSceneLights(state.sceneLights), {
    roomOcclusion,
    selectedId: editor.selectedSceneLightId,
    shadowFarCm: sceneLightShadowFarCm(),
    showMarkers: state.viewOptions?.showLightMarkers !== false,
    bloomActive: bloomIsActive(),
  })
  if (!facadeReady) return
  facade.syncPointLightOccluders(roomOcclusion, lightsActive)
  if (roomOcclusion) scheduleSunShadowMapUpdate()
}

function insertSceneLightFromLibrary(position?: Pick<SceneLight, 'x' | 'y' | 'z'>): void {
  if (currentView !== '3d' && currentView !== 'top' && currentView !== 'front') {
    setView('3d')
  }
  const { state: next, lightId } = addSceneLight(state, position)
  commitState(next)
  selectSceneLight(lightId)
  syncSceneLightRuntime()
  planStatus.textContent = position
    ? 'Punktlicht platziert'
    : 'Punktlicht eingefügt — in 3D ziehen oder Position rechts anpassen'
}

function placeSceneLightFromLibraryDrop(clientX: number, clientY: number): boolean {
  if (currentView !== '3d' && currentView !== 'top' && currentView !== 'front') {
    setView('3d')
  }
  const position = pickSceneLightPlacementFromClient(clientX, clientY)
  if (!position) {
    planStatus.textContent = 'Punktlicht: in die Szene (3D/Front/Oben) ziehen'
    return false
  }
  insertSceneLightFromLibrary(position)
  return true
}

function selectSceneLight(lightId: string | null): void {
  if (lightId === null) {
    if (editor.selectedSceneLightId) applyEditorSelection(createDefaultEditorState())
    return
  }
  pendingSelectionToolbarTab = 'sceneLight'
  applyEditorSelection({ ...createDefaultEditorState(), selectedSceneLightId: lightId })
}

function syncSceneLightToolbar(): void {
  const id = editor.selectedSceneLightId
  if (!id) return
  const light = sceneLightById(state, id)
  if (!light) return
  sceneLightXInput.value = String(Math.round(light.x))
  sceneLightYInput.value = String(Math.round(light.y))
  sceneLightZInput.value = String(Math.round(light.z))
  if (document.activeElement !== sceneLightIntensityInput) {
    sceneLightIntensityInput.value = String(Math.round(light.intensity))
  }
  const colorTemp = light.colorTemperature ?? 3000
  sceneLightColorTempInput.value = String(colorTemp)
  sceneLightColorTempValue.textContent = `${Math.round(colorTemp)} K`
  sceneLightColorSwatch.style.backgroundColor = light.color
  sceneLightShowMarkerInput.checked = light.showMarker !== false
  sceneLightMarkerSizeRow.hidden = light.showMarker === false
  const markerSize = light.markerSizeCm ?? 40
  sceneLightMarkerSizeSlider.value = String(markerSize)
  sceneLightMarkerSizeNum.value = String(markerSize)
  sceneLightMarkerSizeValue.textContent = String(markerSize)
  if (document.activeElement !== sceneLightDistanceInput) {
    sceneLightDistanceInput.value = String(Math.round(light.distance ?? 0))
  }
  if (document.activeElement !== sceneLightDecayInput) {
    sceneLightDecayInput.value = String(light.decay ?? 2)
  }
  sceneLightEnabledInput.checked = light.enabled
  sceneLightCastShadowInput.checked = light.castShadow
  const depth = Math.round(sceneLightViewDepthCm(light))
  sceneLightDepthSlider.value = String(depth)
  sceneLightDepthNum.value = String(depth)
  sceneLightDepthValue.textContent = String(depth)
}

function patchSceneLightViewDepth(depthCm: number): void {
  const id = editor.selectedSceneLightId
  if (!id) return
  const light = sceneLightById(state, id)
  if (!light) return
  getActiveCamera().getWorldDirection(_frontPanForward)
  sceneLightLocalToWorld(light, _sceneLightWorld)
  viewDepthReferencePoint(_frontPanRight)
  const dx = _sceneLightWorld.x - _frontPanRight.x
  const dy = _sceneLightWorld.y - _frontPanRight.y
  const dz = _sceneLightWorld.z - _frontPanRight.z
  const currentDepth = dx * _frontPanForward.x + dy * _frontPanForward.y + dz * _frontPanForward.z
  _sceneLightWorld.addScaledVector(_frontPanForward, depthCm - currentDepth)
  patchSelectedSceneLight(sceneLightPositionFromWorld(_sceneLightWorld))
}

function patchSelectedSceneLight(patch: Parameters<typeof updateSceneLight>[2]): void {
  const id = editor.selectedSceneLightId
  if (!id) return
  commitState(updateSceneLight(state, id, patch))
}

function applySunLighting(opts?: { updateShadowMap?: boolean; live?: boolean }) {
  setFacadeShadeParams(facadeShadeParamsFromSun(sunSettings))
  syncCladdingReceiveShadows()
  const preCelestial = resolveCelestialState(sunSettings)
  const localBox = buildingWorldBox(getAllWalls(state))
  const centroid = buildingCentroid(state) ?? { x: 0, z: 0 }
  const siteYaw = siteYawForView()
  const box = applyYawAroundYToBox(localBox, siteYaw, centroid.x, centroid.z)
  const target = sunTargetFromBox(box)
  const shadowBox = prepareCelestialShadowBox(box, preCelestial, GROUND_Y)
  const distance = sunDistanceForBox(shadowBox)
  const sceneColors = sceneColorsForLighting()
  const palette = skyPaletteFromCelestial(
    preCelestial,
    sceneColors.sky,
    sceneColors.ground,
    sceneColors.background,
  )
  const mood = resolveLightingMood(sunSettings, preCelestial, palette, sceneColors.ground)
  const intensityScale = THREE.MathUtils.clamp(sunSettings.intensity / 2.4, 0.15, 3.5)
  lastCelestialState = atmosphereSky.update(sunSettings, {
    intensityScale,
    castShadow: mood.keyCastShadow,
    lightTarget: target,
    lightDistance: Math.max(900, distance),
  })
  atmosphereSky.skyLightProbe.intensity = mood.skyIntensity
  hemiLight.intensity = mood.skyIntensity
  hemiLight.color.copy(mood.hemiSkyColor)
  hemiLight.groundColor.copy(mood.groundHemiColor)

  const bounceDist = Math.max(900, distance)
  const bd = mood.bounceDirection
  bounceDirLight.intensity = mood.bounceIntensity
  bounceDirLight.color.copy(mood.bounceColor)
  bounceDirLight.position.set(
    target.x + bd.x * bounceDist,
    target.y + bd.y * bounceDist,
    target.z + bd.z * bounceDist,
  )
  bounceDirLight.target.position.copy(target)
  bounceDirLight.target.updateMatrixWorld()
  bounceDirLight.visible = mood.bounceIntensity > 0.02

  updateGroundMoodUniformValues(mood, groundMat.color)
  setGroundShadowHard(presentationUsesWorkLikeShading(presentationMode))
  applyWorkModeShadowStyle()

  applyDirectionalSun(sunSettings, dirLightIndoor, target, distance)
  dirLightIndoor.target.position.copy(dirLight.target.position)
  dirLightIndoor.target.updateMatrixWorld()
  // Schwaches Innen-Fill wenn Bibliotheks-Punktlicht aktiv — Innenwände/Laibung nicht schwarz.
  if (sceneLightRoomOcclusionActive()) {
    dirLightIndoor.visible = true
    dirLightIndoor.intensity = Math.max(0.28, hemiLight.intensity * 0.9)
    dirLightIndoor.color.copy(dirLight.color)
  } else {
    dirLightIndoor.visible = false
  }
  dirLightIndoor.castShadow = false
  fitDirectionalShadowCamera(dirLight, shadowBox)
  if (!presentationUsesWorkLikeShading(presentationMode)) {
    updatePcssShadowParameters(sunSettings.shadowSoftness, shadowFrustumWidthCm(dirLight), scene)
  }
  if (presentationUsesWorkLikeShading(presentationMode)) {
    dirLight.shadow.radius = 0
    dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS_MIN
    dirLight.shadow.bias = SHADOW_BIAS
  }
  const siteSpan = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 400)
  const shadowSize = shadowMapSizeForSiteSpan(siteSpan)
  dirLight.shadow.mapSize.set(shadowSize, shadowSize)
  dirLight.shadow.camera.layers.set(SHADOW_LAYER_EXTERIOR)
  syncSceneLightRuntime()
  const live = opts?.live === true
  if (opts?.updateShadowMap === true) {
    flushSunShadowMap()
  } else if (live) {
    scheduleSunShadowMapUpdate()
  } else if (opts?.updateShadowMap !== false && startupShadowReady) {
    flushSunShadowMap()
  }
  markViewportDirty()
}

function syncSiteTransform() {
  const centroid = buildingCentroid(state) ?? { x: 0, z: 0 }
  sitePivot.position.set(centroid.x, 0, centroid.z)
  siteOffset.position.set(-centroid.x, 0, -centroid.z)
  const yaw = siteYawForView()
  sitePivot.rotation.y = THREE.MathUtils.degToRad(yaw)
}

let cameraInitialized = false

function initCameraTarget() {
  const bounds = galleryFocusBounds(getAllWalls(state))
  if (bounds) {
    controls.target.set(bounds.cx, bounds.cy, bounds.cz)
  } else {
    controls.target.set(0, WALL_HEIGHT / 2, 0)
  }
  controls.update()
  cameraInitialized = true
  markViewportDirty()
}

function buildingIdsForWallIds(facadeState: FacadeState, wallIds: ReadonlySet<string>): string[] {
  const out = new Set<string>()
  for (const wallId of wallIds) {
    const wall = getWall(facadeState, wallId)
    const buildingId = wall?.buildingId ?? findBuildingForWall(facadeState, wallId)?.id
    if (buildingId) out.add(buildingId)
  }
  return [...out]
}

function applyState(nextState: FacadeState, nextEditor = editor) {
  discardLiveGeometryPreview()
  const openingDragWallIds = facade.peekOpeningDragWallIds()
  facade.endLiveDrag()
  const prevState = state
  state = clampFacadeState(syncFloorPlansFromWalls(nextState))
  editor = normalizeEditor(state, nextEditor)

  const openingDragCommit = openingDragWallIds.size > 0
  const labelOnly =
    !openingDragCommit && facadeStateDiffersOnlyByWallLabels(prevState, state)
  let rebuildIds = labelOnly ? [] : buildingIdsNeedingRebuild(prevState, state)
  if (openingDragCommit) {
    const dragBuildingIds = buildingIdsForWallIds(state, openingDragWallIds)
    if (dragBuildingIds.length === 0) {
      rebuildIds = null
    } else if (rebuildIds !== null) {
      rebuildIds = [...new Set([...rebuildIds, ...dragBuildingIds])]
    }
  }
  const geometryUnchanged = rebuildIds !== null && rebuildIds.length === 0
  let geometryChanged = false

  if (labelOnly) {
    facade.setState(state, { rebuildBuildingIds: [] })
    facade.refreshWallLabels()
    applySunLighting({ updateShadowMap: true })
  } else if (geometryUnchanged) {
    // Nur Editor/Selektion — kein Geometrie-Rebuild, kein svgView.
  } else if (rebuildIds !== null) {
    geometryChanged = rebuildIds.length > 0
    facade.setState(state, { rebuildBuildingIds: rebuildIds })
  } else {
    geometryChanged = true
    facade.setState(state)
  }

  if (!labelOnly && (!geometryUnchanged || openingDragCommit)) {
    svgView.setState(state, editor)
  }

  facade.setEditor(editor)
  reapplyOpeningMotionPlayback()
  reapplyRollerShutterPlayback()

  syncSiteTransform()
  updateGroundPlane()
  syncCameraDistanceLimits()
  if (geometryChanged || openingDragCommit) {
    applySunLighting({ updateShadowMap: true })
  }
  if (currentView === 'front') {
    syncFrontView()
  }
  if (currentView === 'export') {
    clearExportCaptureCache()
    void refreshExportPreview()
  }
  if (!cameraInitialized) {
    initCameraTarget()
  }
  if (currentView === '3d' && !openingMotionPlayback) {
    facade.updatePerformanceLod(camera, viewportRenderHeight())
  }
  schedulePersistApp()
  renderUi({ skipLayerList: geometryUnchanged && !labelOnly })
  updateHistoryButtons()
  updateWallLibraryGizmos()
  syncSceneLightRuntime()
  markViewportDirty()
}

/** Schneller Pfad: nur Auswahl/Editor — ohne Geometrie, svgView oder Shadow-Rebuild. */
function applyEditorSelection(nextEditor: EditorState) {
  editor = normalizeEditor(state, nextEditor)
  facade.setEditor(editor)
  syncSceneLightRuntime()
  schedulePersistApp()
  renderUi({ skipLayerList: true })
  updateWallLibraryGizmos()
  markViewportDirty()
}

let liveGeomRaf = 0
let liveGeomDirty = false
/** `null` = voller Rebuild beim Flush. */
let liveRebuildIds: string[] | null = []

function mergeLiveRebuildIds(next: string[] | null): void {
  if (liveRebuildIds === null || next === null) {
    liveRebuildIds = null
    return
  }
  if (next.length === 0) return
  const set = new Set(liveRebuildIds)
  for (const id of next) set.add(id)
  liveRebuildIds = [...set]
}

function discardLiveGeometryPreview() {
  if (liveGeomRaf) {
    cancelAnimationFrame(liveGeomRaf)
    liveGeomRaf = 0
  }
  liveGeomDirty = false
  liveRebuildIds = []
}

function flushLiveGeometryPreview() {
  liveGeomRaf = 0
  if (!liveGeomDirty) return
  liveGeomDirty = false
  const ids = liveRebuildIds
  liveRebuildIds = []
  if (ids !== null && ids.length === 0) {
    facade.setEditor(editor)
    markViewportDirty()
    return
  }
  if (ids === null) {
    facade.setState(state, { livePreview: true })
  } else {
    facade.setState(state, { rebuildBuildingIds: ids, livePreview: true })
  }
  facade.setEditor(editor)
  reapplyOpeningMotionPlayback()
  reapplyRollerShutterPlayback()
  updateWallLibraryGizmos()
  markViewportDirty()
}

/**
 * Live-Ziehen mit Geometrie-Änderung (z. B. Wand-Greifer): State sofort,
 * Rebuild max. 1×/Frame, keine Shadow-Map/SVG/Persistenz.
 * Verschieben von Objekten nutzt `previewMeshDrag` (nur Translation).
 */
function previewLiveState(nextState: FacadeState, nextEditor = editor) {
  const prevState = state
  state = clampFacadeState(syncFloorPlansFromWalls(nextState))
  editor = normalizeEditor(state, nextEditor)
  if (facadeStateDiffersOnlyByWallLabels(prevState, state)) {
    facade.setState(state, { rebuildBuildingIds: [] })
    facade.refreshWallLabels()
    facade.setEditor(editor)
    markViewportDirty()
    return
  }
  mergeLiveRebuildIds(buildingIdsNeedingRebuild(prevState, state))
  liveGeomDirty = true
  if (!liveGeomRaf) {
    liveGeomRaf = requestAnimationFrame(flushLiveGeometryPreview)
  }
}

function commitState(nextState: FacadeState, nextEditor = editor) {
  editHistory.record(currentSnapshot())
  applyState(nextState, nextEditor)
  scheduleShareHashWrite()
}

function previewState(nextState: FacadeState, nextEditor = editor) {
  previewLiveState(nextState, nextEditor)
}

/**
 * Verschieben: State sofort, Meshes nur translatieren (kein Ziegel-/CSG-Rebuild).
 * Beim ersten Zug: Loch schließen, nur Öffnungs-Umriss schwebt (`beginOpeningDragMode`).
 * `commitState`/`applyState` beim Loslassen schneidet Löcher neu und bäckt Schatten.
 */
function previewMeshDrag(nextState: FacadeState, nextEditor: EditorState, applyMeshes: () => void) {
  state = clampFacadeState(nextState)
  editor = normalizeEditor(state, nextEditor)
  applyMeshes()
  facade.setEditor(editor)
  markViewportDirty()
}

function previewOpeningDrag(
  nextState: FacadeState,
  refs: OpeningRef[],
  applyMeshes: () => void,
) {
  const dragStarted = facade.beginOpeningDragMode(refs)
  previewMeshDrag(nextState, editor, applyMeshes)
  if (dragStarted) {
    applySunLighting({ updateShadowMap: true })
  }
}


/** Verhindert Tab-Sprünge, solange in der Auswahl-Toolbar editiert wird. */
let selectionToolbarTabLocked = false
selectionToolbar.addEventListener(
  'pointerdown',
  (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('input, select, textarea, button')) return
    selectionToolbarTabLocked = true
  },
  true,
)
selectionToolbar.addEventListener('focusout', () => {
  window.setTimeout(() => {
    if (!selectionToolbar.contains(document.activeElement)) {
      selectionToolbarTabLocked = false
    }
  }, 0)
})

function finishRenderUi() {
  syncSelectionToolbarTabs()
  syncSceneToolbarTabs()
  syncLibraryAppliedOutline()
  updateWallLibraryGizmos()
  requestAnimationFrame(positionToolbar)
}

function renderUi(opts?: { skipLayerList?: boolean }) {
  if (!opts?.skipLayerList) {
    renderLayerList()
  }
  fillAllProfileSelects()
  syncEditScopeButtons()
  syncViewOptionsControls()
  syncRoofUI()
  syncCeilingUI()
  syncBuildingRotateUI()
  syncBloomFogUi()
  syncLodUi()

  const wall = anchorWall()
  const hasOpening = editor.selectedOpenings.length > 0
  const hasWall = Boolean(wall)
  const hasRoof = Boolean(editor.selectedRoofBuildingId)
  const hasCeiling = Boolean(editor.selectedCeiling)
  const hasSceneLight = Boolean(editor.selectedSceneLightId)
  const studioWall = selectionIsStudioWall()
  const showSelectionUi = hasWall || hasOpening || hasRoof || hasCeiling || hasSceneLight
  lightingAccordion.hidden = showSelectionUi
  planSidebar.hidden = true
  syncSceneToolbarTabs()
  editScopeBar.hidden = !showSelectionUi
  syncEditScopeFacadeYawChips()
  // Auswahl-Optionen liegen unten; rechte Toolbar nur als DOM-Host (CSS blendet aus).
  selectionToolbar.hidden = !showSelectionUi
  appRoot.classList.toggle('has-selection', showSelectionUi)
    toolbarWall.hidden = !hasWall || hasOpening || studioWall || hasRoof || hasCeiling || hasSceneLight
  toolbarStudio.hidden = !hasWall || hasOpening || !studioWall || hasRoof || hasCeiling || hasSceneLight
  toolbarOpening.hidden = !hasOpening
  toolbarRoof.hidden = !hasRoof || hasOpening || hasCeiling || hasSceneLight
  toolbarCeiling.hidden = !hasCeiling || hasOpening || hasRoof || hasSceneLight
  toolbarSceneLight.hidden = !hasSceneLight
  syncWindowDepthControls()

  // Dropdown befüllen (nur einmalig) — nur Fenstermodelle, keine Türen
  if (openingModelSelect.options.length === 0) {
    for (const model of BLENDER_WINDOW_MODELS) {
      const opt = document.createElement('option')
      opt.value = model.name
      opt.textContent = `Fenster ${model.width}×${model.height}`
      openingModelSelect.appendChild(opt)
    }
  }

  if (editor.selectedOpenings.length === 1) {
    const ref = editor.selectedOpenings[0]
    const selWall = getWall(state, ref.wallId)
    const selOpening = selWall?.openings.find((o) => o.id === ref.openingId)
    if (selOpening?.windowModel) {
      openingModelSelect.value = selOpening.windowModel
    }
  }

  if (hasOpening) {
    fillAllProfileSelects()
    syncProfileSelect()
    syncProfileEdgeButtons()
    syncProfileTrimControls()
    syncWindowStyleSection()
    syncWindowSillControls()
    syncPedimentControls()
    syncTaperedFieldControls()
    syncOpeningPositionControls()
    syncDoorStairsControls()
    syncRollerShutterControls()
    applyOpeningPartVisibility()
    applyWallPartVisibility()
    syncOpeningColorsHub()
    syncOpeningMotionEditor()
  } else {
    windowStyleSection.hidden = true
    const styleAcc = document.querySelector<HTMLElement>('#window-style-accordion')
    if (styleAcc) styleAcc.hidden = true
    windowSillSection.hidden = true
    doorStairsSection.hidden = true
    openingRollerShutterSection.hidden = true
    const pedimentSection = document.querySelector<HTMLElement>('#opening-pediment-section')
    const consolesSection = document.querySelector<HTMLElement>('#opening-consoles-section')
    const taperedFieldSection = document.querySelector<HTMLElement>('#opening-tapered-field-section')
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
    if (taperedFieldSection) taperedFieldSection.hidden = true
    const motionSection = document.querySelector<HTMLElement>('#opening-motion-section')
    if (motionSection) motionSection.hidden = true
    applyWallPartVisibility()
  }

  if (hasSceneLight) {
    syncSceneLightToolbar()
    finishRenderUi()
    return
  }

  if (!wall) {
    finishRenderUi()
    return
  }

  if (studioWall) {
    if (hasOpening) {
      syncOpeningColorSwatches(
        frameColorSwatches,
        frameColorSection,
        glassColorSwatches,
        glassColorSection,
        true,
      )
    }
    syncStudioToolbar(wall)
    renderColorSwatches(
      wallColorSwatchesStudio,
      'wall',
      activeWallColor(),
      (color) => {
        const ids = scopedWallIds()
        let next = updateWallColors(state, ids, color, 'wallColor')
        next = updateWallColors(next, ids, color, 'claddingColor')
        commitState(next)
      },
      previewSelectionColor((color) => {
        const ids = scopedWallIds()
        let next = updateWallColors(state, ids, color, 'wallColor')
        return updateWallColors(next, ids, color, 'claddingColor')
      }),
    )
    studioWallFinishSelect.value = wall.wallFinish === 'glossy' || wall.wallFinish === 'metal' ? wall.wallFinish : 'matte'
    renderColorSwatches(
      interiorColorSwatchesStudio,
      'wall',
      activeInteriorColor(),
      (color) => {
        commitState(updateWallColors(state, scopedWallIds(), color, 'interiorColor'))
      },
      previewSelectionColor((color) => updateWallColors(state, scopedWallIds(), color, 'interiorColor')),
    )
    renderColorSwatches(
      ceilingColorSwatchesStudio,
      'wall',
      activeCeilingColor(),
      (color) => {
        commitState(updateCeilingColorForWalls(state, scopedWallIds(), color))
      },
      previewSelectionColor((color) => updateCeilingColorForWalls(state, scopedWallIds(), color)),
    )
    renderColorSwatches(
      claddingColorSwatchesStudio,
      'wall',
      activeCladdingColor(),
      (color) => {
        commitState(updateWallColors(state, scopedWallIds(), color, 'claddingColor'))
      },
      previewSelectionColor((color) => updateWallColors(state, scopedWallIds(), color, 'claddingColor')),
    )
    studioCladdingFinishSelect.value =
      wall.claddingFinish === 'glossy' || wall.claddingFinish === 'metal' ? wall.claddingFinish : 'matte'
    renderColorSwatches(
      profileColorSwatchesStudio,
      'profile',
      activeProfileColor(),
      (color) => {
        commitState(updateWallColors(state, scopedWallIds(), color, 'profileColor'))
      },
      previewSelectionColor((color) => updateWallColors(state, scopedWallIds(), color, 'profileColor')),
    )
    studioProfileFinishSelect.value =
      wall.profileFinish === 'glossy' || wall.profileFinish === 'metal' ? wall.profileFinish : 'matte'
    renderColorSwatches(
      jointColorSwatchesStudio,
      'wall',
      activeJointColor(),
      (color) => {
        commitStudioPanelPatch({ jointColor: color })
      },
      previewPanelPatch((color) => ({ jointColor: color })),
    )
    syncOpeningColorSwatches(
      frameColorSwatchesStudio,
      frameColorSectionStudio,
      glassColorSwatchesStudio,
      glassColorSectionStudio,
      editor.selectedOpenings.length > 0,
    )
    updateValidationHintStudio()
    const canUnlink = selectionHasPlanLinkedWalls(editor.selectedWallIds)
    studioWallUnlinkButton.hidden = !canUnlink
    studioWallUnlinkButton.disabled = !canUnlink
    deleteWallStudioButton.disabled = editor.selectedWallIds.length === 0
    finishRenderUi()
    return
  }

  const selectedModules = editor.selectedWallIds
    .map((id) => getWall(state, id)?.moduleName)
    .filter((name): name is string => Boolean(name))
  const activeModule =
    selectedModules.length > 0 && selectedModules.every((name) => name === selectedModules[0])
      ? selectedModules[0]
      : ''
  wallModuleSelect.value = BLENDER_WALL_MODULES.some((module) => module.name === activeModule)
    ? activeModule
    : ''

  fillCladdingSelect(wall)
  if (!hasOpening) {
    syncProfileSelect()
    syncProfileEdgeButtons()
    syncProfileTrimControls()
  }
  syncColorSwatches(wall)
  syncCorniceControls(wall)
  updateValidationHint()
  deleteWallButton.disabled = editor.selectedWallIds.length === 0
  finishRenderUi()
}

document.addEventListener('click', () => closeContextMenu())

function openingReplaceItems(wallId: string, openingId: string): MenuItem[] {
  return WALL_OPENING_PRESETS.filter(
    (preset): preset is WallOpeningPreset & { type: 'door' | 'window' } =>
      preset.type === 'door' || preset.type === 'window',
  ).map((preset) => ({
    label: preset.label,
    action: () => {
      const refs = editor.selectedOpenings.some(
        (ref) => ref.wallId === wallId && ref.openingId === openingId,
      )
        ? [...editor.selectedOpenings]
        : [{ wallId, openingId }]
      commitState(replaceOpeningsWithPreset(state, refs, preset), {
        ...editor,
        selectedWallIds: [...new Set(refs.map((ref) => ref.wallId))],
        selectedOpenings: refs,
        selectedEdges: [],
      })
    },
  }))
}

function wallReplaceItems(wallId: string): MenuItem[] {
  const wall = getWall(state, wallId)
  if (!wall || isStudioWall(wall)) return []
  return BLENDER_WALL_MODULES.map((module) => ({
    label: module.name,
    action: () => {
      commitState(finalizeWallLayout(applyWallModule(state, [wallId], module.name)), {
        ...editor,
        selectedWallIds: [wallId],
        selectedOpenings: [],
      })
    },
  }))
}

function copyStylesFromWall(wallId: string, keys?: string[]) {
  const wall = getWall(state, wallId)
  if (!wall) return
  const first = wall.openings[0]
  const draft = draftFromWallStyle(
    wall,
    first,
    first
      ? wall.profiles.find((profile) => profile.openingId === first.id)?.profileId ?? null
      : null,
  )
  styleClipboard = {
    panel: draft.panel,
    claddingZones: draft.claddingZones,
    wallColor: draft.wallColor,
    interiorColor: draft.interiorColor,
    claddingColor: draft.claddingColor,
    profileColor: draft.profileColor,
    wallFinish: draft.wallFinish,
    claddingFinish: draft.claddingFinish,
    profileFinish: draft.profileFinish,
    cornice: draft.cornice,
    panelFlip: draft.panelFlip,
    opening: first ? { ...first } : undefined,
    frameProfileId: draft.frameProfileId ?? null,
  }
  styleClipboardKeys = keys && keys.length > 0 ? [...keys] : null
  const label = !keys || keys.length === 0 ? 'Stile' : keys.length === 1 ? 'Eigenschaft' : 'Eigenschaften'
  planStatus.textContent = `${label} kopiert — Rechtsklick auf ein Ziel zum Einfügen`
}

function copyStylesFromOpening(wallId: string, openingId: string) {
  const wall = getWall(state, wallId)
  const opening = wall?.openings.find((item) => item.id === openingId)
  if (!wall || !opening) return
  styleClipboard = {
    opening: { ...opening },
    frameProfileId:
      wall.profiles.find((profile) => profile.openingId === opening.id)?.profileId ?? null,
  }
  styleClipboardKeys = null
  planStatus.textContent = 'Stile kopiert — Rechtsklick auf ein Ziel zum Einfügen'
}

function openingObjectCopyLabel(type: Opening['type'] | undefined): string {
  if (type === 'door') return 'Tür'
  if (type === 'cutout') return 'Ausschnitt'
  if (type === 'conch') return 'Konche'
  return 'Fenster'
}

function askSaveStyleTemplate(wallId: string) {
  const wall = getWall(state, wallId)
  if (!wall) return
  const first = wall.openings[0]
  const frameProfileId = first
    ? wall.profiles.find((profile) => profile.openingId === first.id)?.profileId ?? null
    : null
  const dialog = document.querySelector<HTMLDialogElement>('#style-template-dialog')
  const nameInput = document.querySelector<HTMLInputElement>('#style-template-name')
  if (!dialog || !nameInput) return
  nameInput.value = wall.groupId
    ? (activeBuilding().groups ?? []).find((g) => g.id === wall.groupId)?.name ?? 'Stil-Vorlage'
    : 'Stil-Vorlage'
  if (dialog.open) return
  const onClose = () => {
    dialog.removeEventListener('close', onClose)
    if (dialog.returnValue !== 'apply') return
    const draft = draftFromWallStyle(wall, first, frameProfileId)
    styleTemplates = [
      ...styleTemplates,
      createStyleTemplate(nameInput.value, draft),
    ]
    persistStyleTemplates()
    planStatus.textContent = `Stil-Vorlage „${nameInput.value.trim() || 'Stil-Vorlage'}“ gespeichert`
  }
  dialog.addEventListener('close', onClose)
  dialog.returnValue = 'cancel'
  dialog.showModal()
}

function applyStyleTemplateDraft(
  draft: StyleTemplate['draft'],
  target: NonNullable<typeof stylePasteTarget>,
) {
  styleClipboard = {
    panel: draft.panel ? { ...draft.panel } : undefined,
    claddingZones: draft.claddingZones,
    wallColor: draft.wallColor,
    interiorColor: draft.interiorColor,
    claddingColor: draft.claddingColor,
    profileColor: draft.profileColor,
    wallFinish: draft.wallFinish,
    claddingFinish: draft.claddingFinish,
    profileFinish: draft.profileFinish,
    cornice: draft.cornice ? { ...draft.cornice } : undefined,
    panelFlip: draft.panelFlip,
    opening: draft.opening ? ({ ...draft.opening, id: 'tpl', x: 0 } as Opening) : undefined,
    frameProfileId: draft.frameProfileId ?? null,
  }
  stylePasteTarget = target
  applyStyleClipboardDirect(target)
}

function applyStyleClipboardDirect(target: NonNullable<typeof stylePasteTarget>) {
  const clip = styleClipboard
  if (!clip) return
  let next = state
  if (target.kind === 'wall') {
    next = updateActiveBuilding(next, {
      walls: activeBuilding(next).walls.map((wall) => {
        if (!target.ids.includes(wall.id)) return wall
        let updated = { ...wall }
        if (clip.panel) {
          updated = applyPanelStyleToWall(updated, {
            panel: clip.panel,
            claddingZones: clip.claddingZones,
          })
        }
        updated = {
          ...updated,
          wallColor: clip.wallColor,
          wallFinish: clip.wallFinish,
          interiorColor: clip.interiorColor,
          claddingColor: clip.claddingColor,
          claddingFinish: clip.claddingFinish,
          profileColor: clip.profileColor,
          profileFinish: clip.profileFinish,
        }
        if (clip.cornice) updated = { ...updated, cornice: { ...clip.cornice } }
        if (clip.panelFlip !== undefined) updated = { ...updated, panelFlip: clip.panelFlip }
        return updated
      }),
    })
  }
  const openingRefs = openingRefsForStylePaste(next, target)
  if (openingRefs.length > 0) {
    next = clip.frameProfileId
      ? assignProfilesToOpenings(next, openingRefs, [...ALL_EDGES], clip.frameProfileId)
      : removeProfilesFromOpenings(next, openingRefs, [...ALL_EDGES])
    if (clip.opening && (clip.opening.type === 'window' || clip.opening.type === 'door')) {
      for (const ref of openingRefs) {
        next = updateOpening(next, ref.wallId, ref.openingId, {
          trim: clip.opening.trim ? { ...clip.opening.trim } : undefined,
        })
      }
    }
    if (clip.opening && openingSupportsPediment(clip.opening)) {
      next = updateOpeningPediment(next, openingRefs, {
        ...normalizeOpeningPediment(clip.opening.pediment),
      })
    }
    if (clip.opening) {
      next = updateOpeningSills(next, openingRefs, {
        inner: clip.opening.sillInner,
        outer: clip.opening.sillOuter,
      })
    }
  }
  const wallIds =
    target.kind === 'wall' ? target.ids : [...new Set(openingRefs.map((r) => r.wallId))]
  next = finalizeWallFrontOrientation(next, wallIds)
  commitState(finalizeStudioGeometry(next))
  stylePasteTarget = null
  planStatus.textContent = 'Stil-Vorlage angewendet'
}

function styleTemplateMenuItems(
  target: NonNullable<typeof stylePasteTarget>,
): MenuItem[] {
  if (styleTemplates.length === 0) return []
  return styleTemplates.map((template) => ({
    label: template.name,
    action: () => applyStyleTemplateDraft(template.draft, target),
  }))
}

function openingRefsForStylePaste(
  next: FacadeState,
  target: NonNullable<typeof stylePasteTarget>,
): OpeningRef[] {
  if (target.kind === 'opening') return target.refs
  return target.ids.flatMap((id) => {
    const wall = getWall(next, id)
    return (wall?.openings ?? []).map((opening) => ({ wallId: id, openingId: opening.id }))
  })
}

function applyStylePasteFromDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('#style-paste-dialog')
  const target = stylePasteTarget
  const clip = styleClipboard
  if (!dialog || !target || !clip) return
  const checked = (name: string) =>
    Boolean(dialog.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked)
  let next = state
  if (target.kind === 'wall') {
    next = updateActiveBuilding(next, {
      walls: activeBuilding(next).walls.map((wall) => {
        if (!target.ids.includes(wall.id)) return wall
        let updated = { ...wall }
        if (checked('panel') && clip.panel) {
          updated = applyPanelStyleToWall(updated, {
            panel: clip.panel,
            claddingZones: clip.claddingZones,
          })
        } else if (checked('plinth') && clip.panel && updated.panel) {
          updated = {
            ...updated,
            panel: {
              ...updated.panel,
              plinthProfileId: clip.panel.plinthProfileId,
              plinthHeight: clip.panel.plinthHeight,
              plinthDepth: clip.panel.plinthDepth,
              plinthOffsetForward: clip.panel.plinthOffsetForward,
              plinthProfileScale: clip.panel.plinthProfileScale,
              plinthProfileColor: clip.panel.plinthProfileColor,
            },
          }
        }
        if (checked('wallColor')) {
          updated = {
            ...updated,
            wallColor: clip.wallColor,
            wallFinish: clip.wallFinish,
          }
        }
        if (checked('interiorColor')) {
          updated = {
            ...updated,
            interiorColor: clip.interiorColor,
          }
        }
        if (checked('claddingColor')) {
          updated = {
            ...updated,
            claddingColor: clip.claddingColor,
            claddingFinish: clip.claddingFinish,
          }
        }
        if (checked('profileColor')) {
          updated = {
            ...updated,
            profileColor: clip.profileColor,
            profileFinish: clip.profileFinish,
          }
        }
        if (checked('cornice') && clip.cornice) updated = { ...updated, cornice: { ...clip.cornice } }
        if (checked('panelFlip')) updated = { ...updated, panelFlip: clip.panelFlip }
        return updated
      }),
    })
  }
  const openingRefs = openingRefsForStylePaste(next, target)
  if (openingRefs.length > 0 && (checked('frameProfile') || checked('pediment') || checked('sills'))) {
    if (checked('frameProfile')) {
      next = clip.frameProfileId
        ? assignProfilesToOpenings(next, openingRefs, [...ALL_EDGES], clip.frameProfileId)
        : removeProfilesFromOpenings(next, openingRefs, [...ALL_EDGES])
      if (clip.opening && (clip.opening.type === 'window' || clip.opening.type === 'door')) {
        for (const ref of openingRefs) {
          next = updateOpening(next, ref.wallId, ref.openingId, {
            trim: clip.opening.trim ? { ...clip.opening.trim } : undefined,
          })
        }
      }
    }
    if (checked('pediment') && clip.opening && openingSupportsPediment(clip.opening)) {
      next = updateOpeningPediment(next, openingRefs, {
        ...normalizeOpeningPediment(clip.opening.pediment),
      })
    }
    if (checked('sills') && clip.opening) {
      next = updateOpeningSills(next, openingRefs, {
        inner: clip.opening.sillInner,
        outer: clip.opening.sillOuter,
      })
    }
  }
  if (checked('panelFlip')) {
    const wallIds =
      target.kind === 'wall' ? target.ids : [...new Set(openingRefs.map((r) => r.wallId))]
    next = finalizeWallFrontOrientation(next, wallIds)
  }
  commitState(finalizeStudioGeometry(next))
  stylePasteTarget = null
  planStatus.textContent = 'Stile eingefügt'
}

function askStylePaste(target: NonNullable<typeof stylePasteTarget>) {
  const dialog = document.querySelector<HTMLDialogElement>('#style-paste-dialog')
  if (!styleClipboard || !dialog) return
  stylePasteTarget = target
  const isOpening = target.kind === 'opening'
  dialog.querySelectorAll<HTMLElement>('.style-paste-wall').forEach((el) => {
    el.hidden = isOpening
  })
  dialog.querySelectorAll<HTMLElement>('.style-paste-opening').forEach((el) => {
    el.hidden = isOpening
      ? false
      : !(styleClipboard?.opening || styleClipboard?.frameProfileId)
  })
  for (const input of dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const name = input.name
    input.checked =
      !styleClipboardKeys || styleClipboardKeys.length === 0
        ? name !== 'panelFlip'
        : styleClipboardKeys.includes(name)
  }
  if (dialog.open) return
  const onClose = () => {
    dialog.removeEventListener('close', onClose)
    if (dialog.returnValue === 'apply') applyStylePasteFromDialog()
    else stylePasteTarget = null
  }
  dialog.addEventListener('close', onClose)
  dialog.returnValue = 'cancel'
  dialog.showModal()
}

function wallDuplicateMenuItems(wallId: string): MenuItem[] {
  const wall = getWall(state, wallId)
  const studio = Boolean(wall && isStudioWall(wall))
  const items: MenuItem[] = [
    {
      label: 'Nach links',
      action: () => {
        ensureWallSelected(wallId)
        runDuplicateWalls('left')
      },
    },
    {
      label: 'Nach rechts',
      action: () => {
        ensureWallSelected(wallId)
        runDuplicateWalls('right')
      },
    },
    {
      label: 'Darüber',
      action: () => {
        ensureWallSelected(wallId)
        runDuplicateWallsAbove(wallId)
      },
    },
  ]
  if (studio) {
    items.push({
      label: 'Separiert',
      action: () => runDuplicateWallSeparated(wallId),
    })
  }
  return items
}

function runDuplicateWallSeparated(wallId: string) {
  const beforeIds = new Set(getAllWalls(state).map((item) => item.id))
  let next = duplicateStudioWallAtGrid(state, wallId)
  const newWall = getAllWalls(next).find((item) => !beforeIds.has(item.id))
  if (
    newWall &&
    isStudioWall(newWall) &&
    studioWallsCollideIdentical(getAllWalls(next), newWall, [newWall.id])
  ) {
    planStatus.textContent = 'Duplikat würde Wand überlagern'
    return
  }
  next = finalizeStudioGeometry(next)
  const newId = newWall?.id
  commitState(next, {
    ...editor,
    selectedWallIds: newId ? [newId] : [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
  })
}

function runDuplicateWallsAbove(wallId: string) {
  const wall = getWall(state, wallId)
  if (!wall) return
  const building = activeBuilding()
  const sourceFloor = floorIndex(wall, building.wallHeight)
  const wallIds =
    editor.selectedWallIds.includes(wallId) && editor.selectedOpenings.length === 0
      ? [...editor.selectedWallIds]
      : [wallId]
  const beforeIds = new Set(getAllWalls(state).map((item) => item.id))
  let next = insertStoreyAbove(state, sourceFloor, { wallIds, copyOpenings: true })
  next = finalizeStudioGeometry(next)
  const newIds = getAllWalls(next)
    .filter((item) => !beforeIds.has(item.id))
    .map((item) => item.id)
  currentFloor = sourceFloor + 1
  commitState(next, {
    ...editor,
    selectedWallIds: newIds,
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
  })
  rebuildFloorPlanOverlay()
}

function wallContextItems(wallId: string): MenuItem[] {
  const wall = getWall(state, wallId)
  const building = activeBuilding()
  const replace = wallReplaceItems(wallId)
  const items: MenuItem[] = [
    {
      label: visibilityMenuLabel(wall?.hidden),
      action: () => toggleWallHidden(wallId),
    },
    {
      label: 'Duplizieren',
      children: wallDuplicateMenuItems(wallId),
    },
  ]
  if (replace.length > 0) {
    items.push({ label: 'Ersetzen durch', children: replace })
  }
  if (editor.selectedWallIds.length > 1) {
    const groupChildren = (building.groups ?? []).map((group) => ({
      label: group.name,
      action: () => addSelectionToWallGroup(group.id),
    }))
    items.push({
      label: 'Gruppieren',
      children: [
        { label: 'Neue Gruppe', action: () => createWallGroupFromSelection(`Gruppe ${(building.groups?.length ?? 0) + 1}`) },
        ...groupChildren,
      ],
    })
  }
  if (selectedWallGroupIds().length > 0) {
    items.push({
      label: 'Aus Gruppe lösen',
      action: () => ungroupSelectedWalls(),
    })
  }
  const menuWallIds =
    editor.selectedWallIds.includes(wallId) && editor.selectedOpenings.length === 0
      ? [...editor.selectedWallIds]
      : [wallId]
  if (selectionHasPlanLinkedWalls(menuWallIds)) {
    items.push({
      label: 'Wand lösen',
      action: () => {
        ensureWallSelected(wallId)
        unlinkSelectedStudioWalls()
      },
    })
  }
  const touchingOthers = unselectedTouchingWalls(building.walls, menuWallIds)
  const selectionHasUnlinked = menuWallIds.some((id) => {
    const item = getWall(state, id)
    return item && isStudioWall(item) && !isWallPlanLinked(item)
  })
  if (touchingOthers.length > 0 && selectionHasUnlinked) {
    items.push({
      label: 'Wand verknüpfen',
      action: () => {
        ensureWallSelected(wallId)
        askDockStyleCopy(
          [...editor.selectedWallIds],
          touchingOthers.map((item) => item.id),
        )
      },
    })
  } else if (selectionHasUnlinked && menuWallIds.length > 1) {
    items.push({
      label: 'Wand verknüpfen',
      action: () => {
        ensureWallSelected(wallId)
        askDockStyleCopy([...editor.selectedWallIds], [])
      },
    })
  }
  const copyStylePart = (keys?: string[]) => () => {
    ensureWallSelected(wallId)
    copyStylesFromWall(wallId, keys)
  }
  items.push({
    label: 'Kopieren',
    children: [
      {
        label: 'Objekt',
        action: () => {
          ensureWallSelected(wallId)
          copyWallsToClipboard([...editor.selectedWallIds])
        },
      },
      {
        label: 'Alles',
        action: () => {
          ensureWallSelected(wallId)
          copyWallsToClipboard([...editor.selectedWallIds])
          copyStylesFromWall(wallId)
          planStatus.textContent = 'Alles kopiert — Einfügen (Geometrie) oder Stile einfügen'
        },
      },
      { label: 'Stile', action: copyStylePart() },
      { label: 'Paneele', action: copyStylePart(['panel']) },
      { label: 'Wandfarbe', action: copyStylePart(['wallColor']) },
      { label: 'Innenwandfarbe', action: copyStylePart(['interiorColor']) },
      { label: 'Bekleidungsfarbe', action: copyStylePart(['claddingColor']) },
      { label: 'Profilfarbe', action: copyStylePart(['profileColor']) },
      { label: 'Gesims', action: copyStylePart(['cornice']) },
      { label: 'Sockel', action: copyStylePart(['plinth']) },
      { label: 'Außenseite', action: copyStylePart(['panelFlip']) },
      { label: 'Rahmenprofil', action: copyStylePart(['frameProfile']) },
      { label: 'Verdachung', action: copyStylePart(['pediment']) },
      { label: 'Fensterbänke', action: copyStylePart(['sills']) },
    ],
  })
  items.push(...elementPasteMenuItems({ wallId }))
  items.push({
    label: 'Stile kopieren',
    action: () => {
      ensureWallSelected(wallId)
      copyStylesFromWall(wallId)
    },
  })
  items.push({
    label: 'Stil als Vorlage speichern…',
    action: () => {
      ensureWallSelected(wallId)
      askSaveStyleTemplate(wallId)
    },
  })
  if (styleClipboard) {
    items.push({
      label: 'Stile einfügen…',
      action: () => {
        ensureWallSelected(wallId)
        askStylePaste({ kind: 'wall', ids: [...editor.selectedWallIds] })
      },
    })
  }
  const templateItems = styleTemplateMenuItems({ kind: 'wall', ids: [...editor.selectedWallIds] })
  if (templateItems.length > 0) {
    items.push({
      label: 'Stil-Vorlage anwenden',
      children: templateItems,
    })
  }
  if (wall && isStudioWall(wall)) {
    items.push({
      label: 'Drehen',
      children: [
        {
          label: 'Gegen Uhrzeigersinn (90°)',
          action: () => {
            ensureWallSelected(wallId)
            rotateSelectedStudioWalls(-1)
          },
        },
        {
          label: 'Im Uhrzeigersinn (90°)',
          action: () => {
            ensureWallSelected(wallId)
            rotateSelectedStudioWalls(1)
          },
        },
      ],
    })
  }
  items.push({
    label: 'Löschen',
    danger: true,
    action: () => {
      ensureWallSelected(wallId)
      deleteWallButton.click()
    },
  })
  return items
}

function openingContextItems(wallId: string, openingId: string): MenuItem[] {
  const wall = getWall(state, wallId)
  const opening = wall?.openings.find((o) => o.id === openingId)
  const items: MenuItem[] = [
    {
      label: visibilityMenuLabel(opening?.hidden),
      action: () => toggleOpeningHidden(wallId, openingId),
    },
    {
      label: 'Duplizieren nach links',
      action: () => {
        ensureOpeningSelected(wallId, openingId)
        runDuplicateOpenings('left')
      },
    },
    {
      label: 'Duplizieren nach rechts',
      action: () => {
        ensureOpeningSelected(wallId, openingId)
        runDuplicateOpenings('right')
      },
    },
    { label: 'Ersetzen durch', children: openingReplaceItems(wallId, openingId) },
  ]
  items.push({
    label: 'Kopieren',
    children: [
      {
        label: `Objekt (${openingObjectCopyLabel(opening?.type)})`,
        action: () => {
          ensureOpeningSelected(wallId, openingId)
          copyOpeningsToClipboard([...editor.selectedOpenings])
        },
      },
      {
        label: 'Stile',
        action: () => {
          ensureOpeningSelected(wallId, openingId)
          copyStylesFromOpening(wallId, openingId)
        },
      },
    ],
  })
  items.push(...elementPasteMenuItems({ wallId }))
  if (styleClipboard) {
    items.push({
      label: 'Stile einfügen…',
      action: () => {
        ensureOpeningSelected(wallId, openingId)
        askStylePaste({ kind: 'opening', refs: [...editor.selectedOpenings] })
      },
    })
  }
  const openingTemplateItems = styleTemplateMenuItems({
    kind: 'opening',
    refs: [...editor.selectedOpenings],
  })
  if (openingTemplateItems.length > 0) {
    items.push({
      label: 'Stil-Vorlage anwenden',
      children: openingTemplateItems,
    })
  }
  items.push({
    label: 'Löschen',
    danger: true,
    action: () => {
      ensureOpeningSelected(wallId, openingId)
      deleteOpeningButton.click()
    },
  })
  return items
}

/** Rechtsklick: Mehrfachauswahl behalten, wenn das Ziel schon ausgewählt ist. */
function ensureWallSelected(wallId: string) {
  if (editor.selectedWallIds.includes(wallId) && editor.selectedOpenings.length === 0) return
  applyState(state, {
    ...editor,
    selectedWallIds: [wallId],
    selectedOpenings: [],
    selectedEdges: [],
  })
}

function selectedWallGroupIds(): string[] {
  const building = activeBuilding()
  const groupIds = new Set(
    editor.selectedWallIds
      .map((id) => building.walls.find((wall) => wall.id === id)?.groupId)
      .filter((id): id is string => Boolean(id)),
  )
  return [...groupIds]
}

function createWallGroupFromSelection(name = 'Gruppe') {
  const building = activeBuilding()
  const ids = editor.selectedWallIds.filter((id) => building.walls.some((wall) => wall.id === id))
  if (ids.length < 2) return
  const groupId = createId()
  const groups = [...(building.groups ?? []), { id: groupId, name, memberWallIds: ids }]
  const walls = building.walls.map((wall) => (ids.includes(wall.id) ? { ...wall, groupId } : wall))
  commitState(updateActiveBuilding(state, { walls, groups }), {
    ...editor,
    selectedWallIds: ids,
    selectedOpenings: [],
    selectedEdges: [],
  })
}

function addSelectionToWallGroup(groupId: string) {
  const building = activeBuilding()
  const ids = editor.selectedWallIds.filter((id) => building.walls.some((wall) => wall.id === id))
  if (ids.length === 0) return
  const groups = (building.groups ?? []).map((group) =>
    group.id === groupId
      ? { ...group, memberWallIds: [...new Set([...group.memberWallIds, ...ids])] }
      : group,
  )
  const walls = building.walls.map((wall) => (ids.includes(wall.id) ? { ...wall, groupId } : wall))
  commitState(updateActiveBuilding(state, { walls, groups }), {
    ...editor,
    selectedWallIds: ids,
    selectedOpenings: [],
    selectedEdges: [],
  })
}

function ungroupSelectedWalls() {
  const building = activeBuilding()
  const ids = new Set(editor.selectedWallIds)
  const walls = building.walls.map((wall) => (ids.has(wall.id) ? { ...wall, groupId: undefined } : wall))
  const groups = (building.groups ?? [])
    .map((group) => ({
      ...group,
      memberWallIds: group.memberWallIds.filter((id) => !ids.has(id)),
    }))
    .filter((group) => group.memberWallIds.length > 0)
  commitState(updateActiveBuilding(state, { walls, groups }), {
    ...editor,
    selectedWallIds: [...ids],
    selectedOpenings: [],
    selectedEdges: [],
  })
}

function selectWallGroup(groupId: string) {
  const building = activeBuilding()
  const group = (building.groups ?? []).find((item) => item.id === groupId)
  if (!group) return
  applyState(state, {
    ...editor,
    selectedWallIds: [...group.memberWallIds],
    selectedOpenings: [],
    selectedEdges: [],
    selectedWallPart: 'group',
  })
}

function ensureOpeningSelected(wallId: string, openingId: string) {
  const inSel = editor.selectedOpenings.some(
    (ref) => ref.wallId === wallId && ref.openingId === openingId,
  )
  if (inSel) return
  applyState(state, {
    ...editor,
    selectedWallIds: [wallId],
    selectedOpenings: [{ wallId, openingId }],
    selectedEdges: [],
  })
}

function sceneLightContextItems(lightId: string): MenuItem[] {
  const light = sceneLightById(state, lightId)
  return [
    {
      label: light?.enabled !== false ? 'Ausblenden' : 'Einblenden',
      action: () => toggleSceneLightEnabled(lightId),
    },
    {
      label: 'Duplizieren',
      action: () => {
        const { state: next, lightId: newId } = duplicateSceneLight(state, lightId)
        if (!newId) return
        commitState(next, { ...createDefaultEditorState(), selectedSceneLightId: newId })
        planStatus.textContent = 'Punktlicht dupliziert'
      },
    },
    {
      label: 'Licht entfernen',
      action: () => {
        commitState(removeSceneLight(state, lightId), createDefaultEditorState())
        planStatus.textContent = 'Punktlicht entfernt'
      },
    },
  ]
}

function toggleSceneLightEnabled(lightId: string) {
  const light = sceneLightById(state, lightId)
  if (!light) return
  commitState(updateSceneLight(state, lightId, { enabled: !light.enabled }))
}

function showElementContextMenu(
  clientX: number,
  clientY: number,
  hit: {
    wallId?: string
    openingId?: string
    wallPart?: NonNullable<EditorState['selectedWallPart']>
    bandId?: string
    ceiling?: { buildingId: string; floorIndex: number }
    sceneLightId?: string
  },
) {
  if (hit.sceneLightId) {
    selectSceneLight(hit.sceneLightId)
    showContextMenu(clientX, clientY, sceneLightContextItems(hit.sceneLightId))
    return
  }
  if (hit.ceiling) {
    selectCeiling(hit.ceiling.buildingId, hit.ceiling.floorIndex)
    showContextMenu(clientX, clientY, ceilingContextItems(hit.ceiling.buildingId, hit.ceiling.floorIndex))
    return
  }
  if (hit.wallId && hit.openingId) {
    const inSel = editor.selectedOpenings.some(
      (ref) => ref.wallId === hit.wallId && ref.openingId === hit.openingId,
    )
    if (!inSel) selectOpening(hit.wallId, hit.openingId, false)
    showContextMenu(clientX, clientY, openingContextItems(hit.wallId, hit.openingId))
    return
  }
  if (hit.wallId && hit.wallPart === 'trimBand' && hit.bandId) {
    selectWall(hit.wallId, false, 'trimBand', hit.bandId)
    showContextMenu(clientX, clientY, trimBandContextItems(hit.wallId, hit.bandId))
    return
  }
  if (hit.wallId) {
    const inSel =
      editor.selectedWallIds.includes(hit.wallId) && editor.selectedOpenings.length === 0
    if (!inSel) selectWall(hit.wallId, false)
    showContextMenu(clientX, clientY, wallContextItems(hit.wallId))
  }
}

function trimBandContextItems(wallId: string, bandId: string): MenuItem[] {
  return [
    {
      label: `Duplizieren nach oben (+${TRIM_BAND_DUPLICATE_OFFSET} cm)`,
      action: () => commitDuplicateTrimBand(wallId, bandId, 'up'),
    },
    {
      label: `Duplizieren nach unten (−${TRIM_BAND_DUPLICATE_OFFSET} cm)`,
      action: () => commitDuplicateTrimBand(wallId, bandId, 'down'),
    },
    {
      label: 'Band entfernen',
      action: () => {
        commitState(
          removeWallTrimBand(state, scopedWallIds(), bandId, {
            anchorWallId: wallId,
            scope: editScope,
          }),
        )
      },
    },
  ]
}

function createLayerMoreButton(items: MenuItem[]): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'layer-more-btn'
  btn.title = 'Mehr'
  btn.setAttribute('aria-label', 'Mehr')
  btn.textContent = '⋯'
  btn.addEventListener('click', (event) => {
    event.stopPropagation()
    showContextMenu(event.clientX, event.clientY, items)
  })
  return btn
}

function activateBuilding(buildingId: string) {
  if (state.activeBuildingId === buildingId) return
  commitState(setActiveBuildingId(state, buildingId))
  syncFloorUI()
  rebuildFloorPlanOverlay()
}

function selectBuilding(buildingId: string) {
  if (state.activeBuildingId !== buildingId) {
    commitState(setActiveBuildingId(state, buildingId))
    syncFloorUI()
  }
  applyState(state, {
    selectedBuildingId: buildingId,
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedCeiling: undefined,
    selectedOpeningPart: undefined,
    selectedWallPart: undefined,
  })
  rebuildFloorPlanOverlay()
}

function selectCeiling(buildingId: string, floor: number) {
  if (state.activeBuildingId !== buildingId) {
    commitState(setActiveBuildingId(state, buildingId))
    syncFloorUI()
  }
  applyState(state, {
    selectedCeiling: { buildingId, floorIndex: floor },
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedBuildingId: undefined,
    selectedOpeningPart: undefined,
    selectedWallPart: undefined,
  })
}

function ceilingContextItems(buildingId: string, floor: number): MenuItem[] {
  const building = state.buildings.find((b) => b.id === buildingId)
  const plan = building?.floors[floor]
  return [
    {
      label: visibilityMenuLabel(plan?.showCeiling === false),
      action: () => toggleFloorCeiling(floor, plan?.showCeiling === false),
    },
  ]
}

function toggleBuildingHidden(buildingId: string) {
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return
  commitState(
    updateBuilding(state, buildingId, { hidden: !building.hidden }),
  )
}

function renameBuilding(buildingId: string) {
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return
  const next = window.prompt('Hausname', building.name)
  if (!next || !next.trim()) return
  commitState(updateBuilding(state, buildingId, { name: next.trim() }))
}

function toggleFloorHidden(floorIndex: number) {
  const floors = [...getFloors()]
  while (floors.length <= floorIndex) floors.push(createEmptyFloorPlan())
  const plan = floors[floorIndex]
  floors[floorIndex] = { ...plan, hidden: !plan.hidden }
  commitState(updateActiveBuilding(state, { floors }))
}

function toggleFloorCeiling(floorIndex: number, show: boolean) {
  const floors = [...getFloors()]
  while (floors.length <= floorIndex) floors.push(createEmptyFloorPlan())
  floors[floorIndex] = { ...floors[floorIndex], showCeiling: show }
  commitState(updateActiveBuilding(state, { floors }))
}

function toggleWallHidden(wallId: string) {
  commitState(
    mapAllWalls(state, (wall) =>
      wall.id === wallId ? { ...wall, hidden: !wall.hidden } : wall,
    ),
  )
}

function toggleOpeningHidden(wallId: string, openingId: string) {
  commitState(
    mapAllWalls(state, (wall) => {
      if (wall.id !== wallId) return wall
      return {
        ...wall,
        openings: wall.openings.map((opening) =>
          opening.id === openingId ? { ...opening, hidden: !opening.hidden } : opening,
        ),
      }
    }),
  )
}

function toggleRoofHidden(buildingId: string) {
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return
  const roof = normalizeRoof(building.roof)
  commitState(
    updateBuilding(state, buildingId, { roof: { ...roof, hidden: !roof.hidden } }),
  )
}

function toggleBuildingBareWalls(buildingId: string) {
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return
  commitState(
    updateBuilding(state, buildingId, { bareWalls: !building.bareWalls }),
  )
}

function addNewBuildingFromMenu(fromBuildingId: string) {
  let next = state
  if (next.activeBuildingId !== fromBuildingId) {
    next = setActiveBuildingId(next, fromBuildingId)
  }
  commitState(addBuildingBeside(next))
  currentFloor = 0
  syncFloorUI()
  rebuildFloorPlanOverlay()
  if (currentView === 'top') {
    framePlanCameraToContent()
  }
}

function buildingContextItems(buildingId: string): MenuItem[] {
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return []
  return [
    {
      label: 'Neues Haus',
      action: () => addNewBuildingFromMenu(buildingId),
    },
    {
      label: buildingShowsBareWalls(building) ? 'Fassade einblenden' : 'Nur weiße Wände',
      action: () => toggleBuildingBareWalls(buildingId),
    },
    {
      label: 'Umbenennen',
      action: () => renameBuilding(buildingId),
    },
    {
      label: visibilityMenuLabel(building.hidden),
      action: () => toggleBuildingHidden(buildingId),
    },
    {
      label: 'Drehen',
      children: [
        {
          label: 'Gegen Uhrzeigersinn (+45°)',
          action: () => commitBuildingRotate(45),
          disabled: !canRotateBuildingGeometry(state, buildingId),
        },
        {
          label: 'Im Uhrzeigersinn (−45°)',
          action: () => commitBuildingRotate(-45),
          disabled: !canRotateBuildingGeometry(state, buildingId),
        },
      ],
    },
    {
      label: 'Duplizieren',
      children: [
        { label: 'Nach Osten', action: () => runDuplicateBuilding(buildingId, 'east') },
        { label: 'Nach Westen', action: () => runDuplicateBuilding(buildingId, 'west') },
        { label: 'Nach Norden', action: () => runDuplicateBuilding(buildingId, 'north') },
        { label: 'Nach Süden', action: () => runDuplicateBuilding(buildingId, 'south') },
      ],
    },
    {
      label: 'Kopieren',
      action: () => copyBuildingToClipboard(buildingId),
    },
    ...elementPasteMenuItems(),
    {
      label: 'Löschen',
      danger: true,
      action: () => {
        if (!window.confirm('Haus inkl. aller Geschosse löschen?')) return
        commitState(removeBuilding(state, buildingId))
        syncFloorUI()
      },
    },
  ]
}

function runDuplicateBuilding(buildingId: string, direction: 'east' | 'west' | 'north' | 'south') {
  const next = finalizeWallLayout(duplicateBuilding(state, buildingId, direction))
  for (const building of next.buildings) {
    collapsedBuildings.add(building.id)
  }
  commitState(next, {
    selectedBuildingId: next.activeBuildingId,
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedCeiling: undefined,
  })
  syncFloorUI()
  if (currentView === 'top') {
    framePlanCameraToContent()
    rebuildFloorPlanOverlay()
  }
}

function floorContextItems(floor: number): MenuItem[] {
  const plan = getFloors()[floor]
  return [
    {
      label: visibilityMenuLabel(plan?.hidden),
      action: () => toggleFloorHidden(floor),
    },
    {
      label: 'Duplizieren',
      action: () => {
        void duplicateStoreyAtFloor(floor)
      },
    },
    {
      label: 'Löschen',
      danger: true,
      action: () => {
        if (!window.confirm('Letztes Geschoss löschen?')) return
        removeStoreyAtFloor(floor)
      },
    },
  ]
}

function roofContextItems(buildingId: string): MenuItem[] {
  const building = state.buildings.find((b) => b.id === buildingId)
  const roof = normalizeRoof(building?.roof)
  return [
    {
      label: visibilityMenuLabel(roof.hidden),
      action: () => toggleRoofHidden(buildingId),
    },
    {
      label: 'Löschen',
      danger: true,
      action: () => {
        commitState(
          updateBuilding(state, buildingId, {
            roof: { ...normalizeRoof(building?.roof), enabled: false, hidden: false },
          }),
          { ...editor, selectedRoofBuildingId: undefined },
        )
      },
    },
  ]
}

async function duplicateStoreyAtFloor(floor: number) {
  const copy = await askStoreyCopyOptions('Etage duplizieren')
  if (!copy) return
  const next = finalizeWallLayout(duplicateStorey(state, floor, { copyOpenings: copy.openings, copy }))
  currentFloor = Math.max(0, getActiveBuilding(next).floors.length - 1)
  commitState(next)
  syncFloorUI()
  rebuildFloorPlanOverlay()
}

function removeStoreyAtFloor(floor: number) {
  const next = finalizeWallLayout(removeStorey(state, floor))
  currentFloor = Math.min(currentFloor, Math.max(0, getActiveBuilding(next).floors.length - 1))
  if (currentFloor >= getActiveBuilding(next).floors.length) {
    currentFloor = Math.max(0, getActiveBuilding(next).floors.length - 1)
  }
  commitState(next, { selectedWallIds: [], selectedOpenings: [], selectedEdges: [] })
  syncFloorUI()
  rebuildFloorPlanOverlay()
}

function sceneLightsLayerContextItems(): MenuItem[] {
  return [
    {
      label: 'Punktlicht einfügen',
      action: () => insertSceneLightFromLibrary(),
    },
  ]
}

function renderSceneLightsLayerSection() {
  const lights = normalizeSceneLights(state.sceneLights)
  const sectionItem = document.createElement('li')
  sectionItem.className = 'layer-building layer-scene-lights'

  const collapseBtn = document.createElement('button')
  collapseBtn.type = 'button'
  collapseBtn.className = 'layer-floor-collapse'
  collapseBtn.title = 'Ein-/Ausklappen'
  collapseBtn.textContent = sceneLightsLayerCollapsed ? '▸' : '▾'
  collapseBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    sceneLightsLayerCollapsed = !sceneLightsLayerCollapsed
    renderLayerList()
  })

  const titleBtn = document.createElement('button')
  titleBtn.type = 'button'
  titleBtn.className = 'layer-floor-toggle'
  titleBtn.title = 'Szene-Lichter'
  const title = document.createElement('span')
  title.textContent = lights.length > 0 ? `Lichter (${lights.length})` : 'Lichter'
  titleBtn.append(title)
  titleBtn.addEventListener('click', () => {
    if (editor.selectedSceneLightId) {
      applyEditorSelection(createDefaultEditorState())
      return
    }
    if (lights.length > 0) selectSceneLight(lights[0]!.id)
  })

  const moreBtn = createLayerMoreButton(sceneLightsLayerContextItems())
  const header = document.createElement('div')
  header.className = 'layer-building-header layer-floor-header'
  header.append(collapseBtn, titleBtn, moreBtn)
  sectionItem.appendChild(header)

  if (!sceneLightsLayerCollapsed) {
    const body = document.createElement('ul')
    body.className = 'layer-floor-body'

    if (lights.length === 0) {
      const emptyItem = document.createElement('li')
      const emptyHint = document.createElement('p')
      emptyHint.className = 'layer-empty-hint'
      emptyHint.textContent = 'Bibliothek → Licht — hierher ziehen oder Mehr-Menü'
      emptyItem.appendChild(emptyHint)
      body.appendChild(emptyItem)
    }

    for (const light of lights) {
      const rowWrap = document.createElement('li')
      rowWrap.className = 'layer-row-wrap' + layerHiddenClass(!light.enabled)
      const row = document.createElement('div')
      row.className = 'layer-wall-row'

      const btn = document.createElement('button')
      btn.type = 'button'
      const selected = editor.selectedSceneLightId === light.id
      btn.className = (selected ? 'layer-row selected' : 'layer-row') + layerHiddenClass(!light.enabled)
      const kind = document.createElement('span')
      kind.className = 'layer-kind'
      kind.textContent = 'Licht'
      const label = document.createElement('span')
      label.className = 'layer-label'
      label.textContent = light.label?.trim() || 'Punktlicht'
      const meta = document.createElement('span')
      meta.className = 'layer-meta'
      meta.textContent = `${Math.round(light.intensity)} W`
      btn.append(kind, label, meta)
      btn.addEventListener('click', () => selectSceneLight(light.id))

      const lightMoreBtn = createLayerMoreButton(sceneLightContextItems(light.id))
      row.append(btn, lightMoreBtn)
      rowWrap.appendChild(row)
      body.appendChild(rowWrap)
    }

    sectionItem.appendChild(body)
  }

  layerList.appendChild(sectionItem)
}

function renderLayerList() {
  layerList.replaceChildren()
  renderSceneLightsLayerSection()
  let layerIndex = 0

  for (const building of [...state.buildings].reverse()) {
    const isActive = building.id === state.activeBuildingId
    const buildingCollapsed = collapsedBuildings.has(building.id)
    const byFloor = groupWallsByFloorForBuilding(building)

    const buildingItem = document.createElement('li')
    buildingItem.className =
      'layer-building' +
      (isActive ? ' layer-active-building' : '') +
      (editor.selectedBuildingId === building.id ? ' layer-selected-building' : '') +
      layerHiddenClass(building.hidden)

    const buildingCollapseBtn = document.createElement('button')
    buildingCollapseBtn.type = 'button'
    buildingCollapseBtn.className = 'layer-floor-collapse'
    buildingCollapseBtn.title = 'Ein-/Ausklappen'
    buildingCollapseBtn.textContent = buildingCollapsed ? '▸' : '▾'
    buildingCollapseBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (collapsedBuildings.has(building.id)) collapsedBuildings.delete(building.id)
      else collapsedBuildings.add(building.id)
      renderLayerList()
    })

    const buildingToggle = document.createElement('button')
    buildingToggle.type = 'button'
    buildingToggle.className = 'layer-floor-toggle'
    buildingToggle.title = isActive ? 'Aktives Haus' : 'Haus aktivieren (Schreibschutz)'
    const buildingTitle = document.createElement('span')
    buildingTitle.textContent =
      building.name +
      (isActive ? ' · aktiv' : '') +
      (buildingShowsBareWalls(building) ? ' · nur Wände' : '')
    buildingToggle.append(buildingTitle)
    buildingToggle.addEventListener('click', () => selectBuilding(building.id))

    const buildingMoreBtn = createLayerMoreButton(buildingContextItems(building.id))

    const buildingHeader = document.createElement('div')
    buildingHeader.className = 'layer-building-header layer-floor-header'
    buildingHeader.append(buildingCollapseBtn, buildingToggle, buildingMoreBtn)
    buildingHeader.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      event.stopPropagation()
      showContextMenu(event.clientX, event.clientY, buildingContextItems(building.id))
    })
    buildingItem.appendChild(buildingHeader)

    if (!buildingCollapsed) {
      const buildingBody = document.createElement('ul')
      buildingBody.className = 'layer-floor-body'

      const roofLi = document.createElement('li')
      roofLi.className = 'layer-roof'
      const roof = normalizeRoof(building.roof)
      const roofExpanded = expandedRoofs.has(building.id)
      const roofSectionSelected =
        editor.selectedRoofBuildingId === building.id && (editor.selectedRoofPart ?? 'group') === 'group'

      if (!roof.enabled) {
        const addBtn = document.createElement('button')
        addBtn.type = 'button'
        addBtn.className = 'layer-row layer-add-roof'
        addBtn.textContent = 'Dach hinzufügen'
        addBtn.disabled = !isActive || !facadeHasRoofablePlan(state)
        addBtn.addEventListener('click', () => {
          if (!isActive) activateBuilding(building.id)
          if (!facadeHasRoofablePlan(state)) return
          selectRoof(building.id, 'shell')
          commitRoofPatch({ enabled: true })
        })
        roofLi.appendChild(addBtn)
      } else {
        const roofCollapseBtn = document.createElement('button')
        roofCollapseBtn.type = 'button'
        roofCollapseBtn.className = 'layer-floor-collapse'
        roofCollapseBtn.title = 'Ein-/Ausklappen'
        roofCollapseBtn.textContent = roofExpanded ? '▾' : '▸'
        roofCollapseBtn.addEventListener('click', (event) => {
          event.stopPropagation()
          if (expandedRoofs.has(building.id)) expandedRoofs.delete(building.id)
          else expandedRoofs.add(building.id)
          renderLayerList()
        })

        const roofToggle = document.createElement('button')
        roofToggle.type = 'button'
        roofToggle.className = 'layer-floor-toggle' + (roofSectionSelected ? ' selected' : '')
        roofToggle.textContent = 'Dach'
        roofToggle.addEventListener('click', () => {
          if (!isActive) activateBuilding(building.id)
          selectRoof(building.id, 'group')
        })

        const roofMoreBtn = createLayerMoreButton(roofContextItems(building.id))
        const roofHeader = document.createElement('div')
        roofHeader.className = 'layer-floor-header'
        roofHeader.append(roofCollapseBtn, roofToggle, roofMoreBtn)
        roofLi.appendChild(roofHeader)

        if (roofExpanded) {
          const roofBody = document.createElement('ul')
          roofBody.className = 'layer-floor-body layer-roof-body'

          const addRoofPartRow = (
            kind: string,
            label: string,
            part: 'shell' | 'tiles' | 'gutter',
            hidden?: boolean,
          ) => {
            if (hidden) return
            const rowWrap = document.createElement('li')
            rowWrap.className = 'layer-row-wrap' + layerHiddenClass(roof.hidden)
            const kindEl = document.createElement('span')
            kindEl.className = 'layer-kind'
            kindEl.textContent = kind
            const btn = document.createElement('button')
            btn.type = 'button'
            const selected =
              editor.selectedRoofBuildingId === building.id && editor.selectedRoofPart === part
            btn.className = selected ? 'layer-row selected' : 'layer-row'
            const labelEl = document.createElement('span')
            labelEl.className = 'layer-label'
            labelEl.textContent = label
            btn.append(kindEl, labelEl)
            btn.addEventListener('click', () => {
              if (!isActive) activateBuilding(building.id)
              selectRoof(building.id, part)
            })
            rowWrap.append(btn)
            roofBody.appendChild(rowWrap)
          }

          addRoofPartRow('Dach', 'Mansarde', 'shell')
          addRoofPartRow('Ziegel', 'Ziegel', 'tiles')
          addRoofPartRow('Rinne', 'Rinne', 'gutter', !roof.gutter)

          roofLi.appendChild(roofBody)
        }
      }
      buildingBody.appendChild(roofLi)

      for (const floor of sortedFloorIndicesForBuilding(building)) {
        const collapsed = collapsedFloors.has(floor)
        const floorPlan = building.floors[floor]
        const floorHidden = floorPlan?.hidden === true

        const floorItem = document.createElement('li')
        floorItem.className = 'layer-floor' + layerHiddenClass(floorHidden)

        const floorToggle = document.createElement('button')
        floorToggle.type = 'button'
        floorToggle.className = 'layer-floor-toggle'
        floorToggle.title = 'Alle Wände dieser Etage auswählen'
        const floorTitle = document.createElement('span')
        floorTitle.textContent = floorLabel(floor)
        floorToggle.append(floorTitle)
        floorToggle.addEventListener('click', (event) => {
          if (!isActive) activateBuilding(building.id)
          const floorWalls = byFloor.get(floor) ?? []
          const ids = floorWalls.map((w) => w.id)
          currentFloor = floor
          syncFloorUI()
          rebuildFloorPlanOverlay()
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            const combined = [...new Set([...editor.selectedWallIds, ...ids])]
            applyState(state, { ...editor, selectedWallIds: combined, selectedOpenings: [] })
          } else {
            applyState(state, { ...editor, selectedWallIds: ids, selectedOpenings: [] })
          }
        })

        const floorMoreBtn = createLayerMoreButton(
          isActive ? floorContextItems(floor) : [{ label: 'Haus aktivieren', action: () => activateBuilding(building.id) }],
        )

        const floorCollapseBtn = document.createElement('button')
        floorCollapseBtn.type = 'button'
        floorCollapseBtn.className = 'layer-floor-collapse'
        floorCollapseBtn.title = 'Ein-/Ausklappen'
        floorCollapseBtn.textContent = collapsed ? '▸' : '▾'
        floorCollapseBtn.addEventListener('click', (event) => {
          event.stopPropagation()
          if (collapsedFloors.has(floor)) collapsedFloors.delete(floor)
          else collapsedFloors.add(floor)
          renderLayerList()
        })

        const floorHeader = document.createElement('div')
        floorHeader.className = 'layer-floor-header'
        floorHeader.append(floorCollapseBtn, floorToggle, floorMoreBtn)
        floorItem.appendChild(floorHeader)
        buildingBody.appendChild(floorItem)

        const floorBody = document.createElement('ul')
        floorBody.className = collapsed ? 'layer-floor-body collapsed' : 'layer-floor-body'

        if (isActive) {
          const ceilingSelected =
            editor.selectedCeiling?.buildingId === building.id &&
            editor.selectedCeiling.floorIndex === floor
          const ceilingItem = document.createElement('li')
          const ceilingRow = document.createElement('div')
          ceilingRow.className =
            'layer-wall-row' + layerHiddenClass(floorHidden || floorPlan?.showCeiling === false)
          const ceilingBtn = document.createElement('button')
          ceilingBtn.type = 'button'
          ceilingBtn.className = ceilingSelected ? 'layer-row selected' : 'layer-row'
          const ceilingKind = document.createElement('span')
          ceilingKind.className = 'layer-kind'
          ceilingKind.textContent = 'Decke / Boden'
          const ceilingLabel = document.createElement('span')
          ceilingLabel.className = 'layer-label'
          ceilingLabel.textContent = ''
          const ceilingMeta = document.createElement('span')
          ceilingMeta.className = 'layer-meta'
          ceilingMeta.textContent = floorPlanSpanMeta(floorPlan)
          ceilingBtn.append(ceilingKind, ceilingLabel, ceilingMeta)
          ceilingBtn.addEventListener('click', () => {
            if (!isActive) activateBuilding(building.id)
            selectCeiling(building.id, floor)
          })
          const ceilingMoreBtn = createLayerMoreButton(ceilingContextItems(building.id, floor))
          ceilingRow.append(ceilingBtn, ceilingMoreBtn)
          ceilingItem.appendChild(ceilingRow)
          floorBody.appendChild(ceilingItem)
        }

        const walls = byFloor.get(floor) ?? []
        const wallGroups = (building.groups ?? [])
          .map((group) => ({
            ...group,
            memberWalls: group.memberWallIds
              .map((id) => walls.find((wall) => wall.id === id))
              .filter((wall): wall is Wall => Boolean(wall)),
          }))
          .filter((group) => group.memberWalls.length > 0)
        const groupedWallIds = new Set(wallGroups.flatMap((group) => group.memberWalls.map((wall) => wall.id)))
        const wallEntries: Array<{ kind: 'group'; group: WallGroup; memberWalls: Wall[] } | { kind: 'wall'; wall: Wall }> = [
          ...wallGroups.map((group) => ({ kind: 'group' as const, group, memberWalls: group.memberWalls })),
          ...walls
            .filter((wall) => !groupedWallIds.has(wall.id))
            .map((wall) => ({ kind: 'wall' as const, wall })),
        ]
        for (const entry of wallEntries) {
          const wallsForEntry = entry.kind === 'group' ? entry.memberWalls : [entry.wall]
          const primaryWall = wallsForEntry[0]
          if (!primaryWall) continue
          const item = document.createElement('li')
          const wallSelected =
            wallsForEntry.every((wall) => editor.selectedWallIds.includes(wall.id)) &&
            editor.selectedOpenings.length === 0
          const wallLayerIndex = entry.kind === 'wall' ? layerIndex++ : -1

          const wallRow = document.createElement('div')
          wallRow.className = 'layer-wall-row' + layerHiddenClass(primaryWall.hidden)

          const wallToggleBtn = document.createElement('button')
          wallToggleBtn.type = 'button'
          wallToggleBtn.className = 'layer-wall-collapse'
          wallToggleBtn.title = 'Öffnungen ein-/ausklappen'
          const expandKey = entry.kind === 'group' ? entry.group.id : primaryWall.id
          const wallExpanded = expandedWalls.has(expandKey)
          const totalOpenings = wallsForEntry.reduce((sum, wall) => sum + wall.openings.length, 0)
          wallToggleBtn.textContent = totalOpenings === 0 ? '' : wallExpanded ? '▾' : '▸'
          wallToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (expandedWalls.has(expandKey)) expandedWalls.delete(expandKey)
            else expandedWalls.add(expandKey)
            renderLayerList()
          })

          const wallButton = document.createElement('button')
          wallButton.type = 'button'
          wallButton.className = wallSelected ? 'layer-row selected' : 'layer-row'
          const wallKind = document.createElement('span')
          wallKind.className = 'layer-kind'
          wallKind.textContent = entry.kind === 'group' ? 'Gruppe' : 'Wand'
          const wallName = document.createElement('span')
          wallName.className = 'layer-label'
          wallName.textContent = entry.kind === 'group' ? entry.group.name : ''
          const wallMeta = document.createElement('span')
          wallMeta.className = 'layer-meta'
          wallMeta.textContent =
            entry.kind === 'group'
              ? `${wallsForEntry.length} Wände`
              : layerWidthMeta(primaryWall.width)
          wallButton.append(wallKind, wallName, wallMeta)
          wallButton.addEventListener('click', (event) => {
            if (!isActive) activateBuilding(building.id)
            if (entry.kind === 'group') {
              selectWallGroup(entry.group.id)
              return
            }
            selectLayerItem(wallLayerIndex, event.shiftKey, event.metaKey || event.ctrlKey)
          })

          const wallMoreBtn = createLayerMoreButton(
            entry.kind === 'group'
              ? [
                  { label: 'Gruppe auswählen', action: () => selectWallGroup(entry.group.id) },
                  { label: 'Aus Gruppe lösen', action: () => { selectWallGroup(entry.group.id); ungroupSelectedWalls() } },
                ]
              : wallContextItems(primaryWall.id),
          )
          wallRow.addEventListener('contextmenu', (event) => {
            event.preventDefault()
            event.stopPropagation()
            if (entry.kind === 'group') {
              selectWallGroup(entry.group.id)
              showContextMenu(event.clientX, event.clientY, [
                { label: 'Gruppe auswählen', action: () => selectWallGroup(entry.group.id) },
                { label: 'Aus Gruppe lösen', action: () => { selectWallGroup(entry.group.id); ungroupSelectedWalls() } },
              ])
              return
            }
            showElementContextMenu(event.clientX, event.clientY, { wallId: primaryWall.id })
          })

          wallRow.append(wallToggleBtn, wallButton, wallMoreBtn)
          item.appendChild(wallRow)

          if (wallExpanded && totalOpenings > 0) {
            const openingList = document.createElement('ul')
            openingList.className = 'layer-opening-list'
            for (const wall of wallsForEntry) {
              for (const opening of wall.openings) {
              const openingSelected = editor.selectedOpenings.some(
                (r) => r.wallId === wall.id && r.openingId === opening.id,
              )
              const openingItem = document.createElement('li')
              const openingBtn = document.createElement('button')
              openingBtn.type = 'button'
              openingBtn.className =
                (openingSelected ? 'layer-row layer-opening-row selected' : 'layer-row layer-opening-row') +
                layerHiddenClass(opening.hidden)
              const openingKind = document.createElement('span')
              openingKind.className = 'layer-kind'
              openingKind.textContent =
                opening.type === 'door'
                  ? 'Tür'
                  : opening.type === 'cutout'
                    ? 'Nische'
                    : opening.type === 'conch'
                      ? 'Konche'
                      : 'Fenster'
              const openingLabel = document.createElement('span')
              openingLabel.className = 'layer-label'
              openingLabel.textContent = ''
              const openingMeta = document.createElement('span')
              openingMeta.className = 'layer-meta'
              openingMeta.textContent = layerOpeningWidthMeta(opening)
              openingBtn.append(openingKind, openingLabel, openingMeta)
              openingBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                if (!isActive) activateBuilding(building.id)
                selectOpening(
                  wall.id,
                  opening.id,
                  e.shiftKey || e.ctrlKey || e.metaKey,
                  'group',
                )
              })
              const openingMoreBtn = createLayerMoreButton(openingContextItems(wall.id, opening.id))
              const openingRow = document.createElement('div')
              openingRow.className = 'layer-wall-row'
              openingRow.addEventListener('contextmenu', (event) => {
                event.preventDefault()
                event.stopPropagation()
                showElementContextMenu(event.clientX, event.clientY, {
                  wallId: wall.id,
                  openingId: opening.id,
                })
              })
              openingRow.append(openingBtn, openingMoreBtn)
              openingItem.appendChild(openingRow)
              openingList.appendChild(openingItem)

              if (opening.type === 'door' && opening.stairs?.enabled) {
                const stairs = normalizeOpeningStairs(opening.stairs, opening)
                const stairsSelected =
                  openingSelected && editor.selectedOpeningPart === 'stairs'
                const stairsItem = document.createElement('li')
                const stairsBtn = document.createElement('button')
                stairsBtn.type = 'button'
                stairsBtn.className =
                  (stairsSelected ? 'layer-row layer-opening-row selected' : 'layer-row layer-opening-row') +
                  layerHiddenClass(opening.hidden)
                const stairsKind = document.createElement('span')
                stairsKind.className = 'layer-kind'
                stairsKind.textContent = 'Treppe'
                const stairsLabel = document.createElement('span')
                stairsLabel.className = 'layer-label'
                stairsLabel.textContent = ''
                const stairsMeta = document.createElement('span')
                stairsMeta.className = 'layer-meta'
                stairsMeta.textContent = `${stairs.count} Stufen`
                stairsBtn.append(stairsKind, stairsLabel, stairsMeta)
                stairsBtn.addEventListener('click', (e) => {
                  e.stopPropagation()
                  if (!isActive) activateBuilding(building.id)
                  applyState(state, {
                    selectedWallIds: [wall.id],
                    selectedOpenings: [{ wallId: wall.id, openingId: opening.id }],
                    selectedEdges: [],
                    selectedOpeningPart: 'stairs',
                    selectedRoofBuildingId: undefined,
                    selectedRoofPart: undefined,
                    selectedCeiling: undefined,
                    selectedBuildingId: undefined,
                  })
                })
                const stairsMoreBtn = createLayerMoreButton([
                  {
                    label: visibilityMenuLabel(opening.hidden),
                    action: () => toggleOpeningHidden(wall.id, opening.id),
                  },
                ])
                const stairsRow = document.createElement('div')
                stairsRow.className = 'layer-wall-row'
                stairsRow.append(stairsBtn, stairsMoreBtn)
                stairsItem.appendChild(stairsRow)
                openingList.appendChild(stairsItem)
              }
            }
            }
            item.appendChild(openingList)
          }

          floorBody.appendChild(item)
        }

        floorItem.appendChild(floorBody)
      }

      buildingItem.appendChild(buildingBody)
    }

    layerList.appendChild(buildingItem)
  }
}


function selectRoof(buildingId: string, part: 'group' | 'shell' | 'tiles' | 'gutter' = 'group') {
  if (state.activeBuildingId !== buildingId) {
    commitState(setActiveBuildingId(state, buildingId))
  }
  applyState(state, {
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedOpeningPart: undefined,
    selectedWallPart: undefined,
    selectedCeiling: undefined,
    selectedBuildingId: undefined,
    selectedRoofBuildingId: buildingId,
    selectedRoofPart: part,
  })
}

// Toolbar sitzt fest in #ui-right – keine Overlay-Positionierung nötig.
function positionToolbar() {}

function hexToRgbChannels(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbChannelsToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

function rgbToHslChannels(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h, s, l }
}

function hslToRgbChannels(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: r * 255, g: g * 255, b: b * 255 }
}

function makeColorNumberInput(min: number, max: number, step: number): HTMLInputElement {
  const el = document.createElement('input')
  el.type = 'number'
  el.min = String(min)
  el.max = String(max)
  el.step = String(step)
  el.className = 'color-channel-input'
  return el
}

function renderColorControl(
  container: HTMLElement,
  active: string,
  onPick: (color: string) => void,
  onPreview?: (color: string | null) => void,
  options?: { allowTransparent?: boolean },
) {
  if (isColorPickerSessionActive()) return

  type ColorHost = HTMLElement & {
    __colorPick?: (color: string) => void
    __colorPreview?: (color: string | null) => void
    __colorPicking?: boolean
  }
  const host = container as ColorHost
  host.__colorPick = onPick
  host.__colorPreview = onPreview
  host.classList.add('color-picker-row')

  const isTransparent = active === TRANSPARENT_GLASS
  const hex = isTransparent || !/^#[0-9a-fA-F]{6}$/i.test(active) ? '#ffffff' : active.toUpperCase()

  const beginPick = () => {
    if (!host.__colorPicking) {
      host.__colorPicking = true
      activeColorPickerCount += 1
    }
  }
  const endPick = () => {
    if (host.__colorPicking) {
      host.__colorPicking = false
      activeColorPickerCount = Math.max(0, activeColorPickerCount - 1)
    }
  }

  let top = host.querySelector<HTMLDivElement>('.color-picker-top')
  if (!top) {
    top = document.createElement('div')
    top.className = 'color-picker-top'
    host.insertBefore(top, host.firstChild)
  }

  let input = host.querySelector<HTMLInputElement>('input[type="color"]')
  let hexInput = host.querySelector<HTMLInputElement>('input.color-hex-input')
  let rgbR = host.querySelector<HTMLInputElement>('input.color-rgb-r')
  let rgbG = host.querySelector<HTMLInputElement>('input.color-rgb-g')
  let rgbB = host.querySelector<HTMLInputElement>('input.color-rgb-b')
  let hslH = host.querySelector<HTMLInputElement>('input.color-hsl-h')
  let hslS = host.querySelector<HTMLInputElement>('input.color-hsl-s')
  let hslL = host.querySelector<HTMLInputElement>('input.color-hsl-l')

  const applyHex = (nextHex: string, preview: boolean) => {
    const value = nextHex.toUpperCase()
    input!.value = value
    hexInput!.value = value
    const rgb = hexToRgbChannels(value)
    rgbR!.value = String(rgb.r)
    rgbG!.value = String(rgb.g)
    rgbB!.value = String(rgb.b)
    const hsl = rgbToHslChannels(rgb.r, rgb.g, rgb.b)
    hslH!.value = String(Math.round(hsl.h * 360))
    hslS!.value = String(Math.round(hsl.s * 100))
    hslL!.value = String(Math.round(hsl.l * 100))
    if (preview) host.__colorPreview?.(value)
    else {
      host.__colorPreview?.(null)
      host.__colorPick?.(value)
    }
  }

  if (!input) {
    input = document.createElement('input')
    input.type = 'color'
    top.appendChild(input)
  } else if (input.parentElement !== top) {
    top.appendChild(input)
  }
  if (!input.dataset.colorControlBound) {
    input.dataset.colorControlBound = '1'
    input.addEventListener('pointerdown', beginPick)
    input.addEventListener('input', () => {
      beginPick()
      applyHex(input!.value, true)
    })
    input.addEventListener('change', () => {
      endPick()
      applyHex(input!.value, false)
    })
    input.addEventListener('blur', () => {
      if (!host.__colorPicking) return
      endPick()
      host.__colorPreview?.(null)
    })
  }

  const ensureRow = (space: string, label: string): HTMLDivElement => {
    let row = host.querySelector<HTMLDivElement>(`.color-channel-row[data-space="${space}"]`)
    if (!row) {
      row = document.createElement('div')
      row.className = 'color-channel-row'
      row.dataset.space = space
      const tag = document.createElement('span')
      tag.className = 'color-channel-label'
      tag.textContent = label
      row.appendChild(tag)
      host.appendChild(row)
    }
    return row
  }

  const rgbRow = ensureRow('rgb', 'RGB')
  const hslRow = ensureRow('hsl', 'HSL')
  const hexRow = ensureRow('hex', 'HEX')

  const bindChannelCommit = (el: HTMLInputElement, readHex: () => string | null) => {
    el.addEventListener('focus', beginPick)
    el.addEventListener('input', () => {
      beginPick()
      const next = readHex()
      if (next) applyHex(next, true)
    })
    el.addEventListener('change', () => {
      const next = readHex()
      endPick()
      if (next) applyHex(next, false)
      else host.__colorPreview?.(null)
    })
    el.addEventListener('blur', () => {
      endPick()
      host.__colorPreview?.(null)
    })
  }

  if (!rgbR || !rgbG || !rgbB) {
    rgbR = makeColorNumberInput(0, 255, 1)
    rgbR.classList.add('color-rgb-r')
    rgbG = makeColorNumberInput(0, 255, 1)
    rgbG.classList.add('color-rgb-g')
    rgbB = makeColorNumberInput(0, 255, 1)
    rgbB.classList.add('color-rgb-b')
    rgbRow.append(rgbR, rgbG, rgbB)
    const readRgb = () =>
      rgbChannelsToHex(Number(rgbR!.value), Number(rgbG!.value), Number(rgbB!.value))
    bindChannelCommit(rgbR, readRgb)
    bindChannelCommit(rgbG, readRgb)
    bindChannelCommit(rgbB, readRgb)
  }

  if (!hslH || !hslS || !hslL) {
    hslH = makeColorNumberInput(0, 360, 1)
    hslH.classList.add('color-hsl-h')
    hslS = makeColorNumberInput(0, 100, 1)
    hslS.classList.add('color-hsl-s')
    hslL = makeColorNumberInput(0, 100, 1)
    hslL.classList.add('color-hsl-l')
    hslRow.append(hslH, hslS, hslL)
    const readHsl = () => {
      const h = ((Number(hslH!.value) % 360) + 360) % 360 / 360
      const s = Math.max(0, Math.min(100, Number(hslS!.value))) / 100
      const l = Math.max(0, Math.min(100, Number(hslL!.value))) / 100
      const rgb = hslToRgbChannels(h, s, l)
      return rgbChannelsToHex(rgb.r, rgb.g, rgb.b)
    }
    bindChannelCommit(hslH, readHsl)
    bindChannelCommit(hslS, readHsl)
    bindChannelCommit(hslL, readHsl)
  }

  if (!hexInput) {
    hexInput = document.createElement('input')
    hexInput.type = 'text'
    hexInput.className = 'color-hex-input'
    hexInput.spellcheck = false
    hexInput.maxLength = 7
    hexInput.addEventListener('focus', beginPick)
    hexInput.addEventListener('input', () => {
      beginPick()
      const raw = hexInput!.value.trim()
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) applyHex(raw, true)
    })
    hexInput.addEventListener('change', () => {
      const raw = hexInput!.value.trim()
      endPick()
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) applyHex(raw, false)
      else host.__colorPreview?.(null)
    })
    hexInput.addEventListener('blur', () => {
      endPick()
      host.__colorPreview?.(null)
    })
    hexRow.appendChild(hexInput)
  } else if (hexInput.parentElement !== hexRow) {
    hexRow.appendChild(hexInput)
  }

  const channelInputs = [input, hexInput, rgbR, rgbG, rgbB, hslH, hslS, hslL]
  const channelFocused = channelInputs.some((el) => el && document.activeElement === el)
  if (!host.__colorPicking && !channelFocused) {
    input.value = hex
    hexInput.value = isTransparent ? 'transparent' : hex
    const rgb = hexToRgbChannels(hex)
    rgbR.value = String(rgb.r)
    rgbG.value = String(rgb.g)
    rgbB.value = String(rgb.b)
    const hsl = rgbToHslChannels(rgb.r, rgb.g, rgb.b)
    hslH.value = String(Math.round(hsl.h * 360))
    hslS.value = String(Math.round(hsl.s * 100))
    hslL.value = String(Math.round(hsl.l * 100))
  }
  input.title = isTransparent ? 'Transparent — Farbe wählen zum Einfärben' : hex
  hexInput.title = 'HEX-Farbe (#RRGGBB)'
  input.disabled = false
  const disableFields = isTransparent
  hexInput.disabled = disableFields
  rgbR.disabled = disableFields
  rgbG.disabled = disableFields
  rgbB.disabled = disableFields
  hslH.disabled = disableFields
  hslS.disabled = disableFields
  hslL.disabled = disableFields
  input.style.opacity = isTransparent ? '0.55' : '1'

  if (options?.allowTransparent) {
    let clearBtn = host.querySelector<HTMLButtonElement>('button.transparent-swatch')
    if (!clearBtn) {
      clearBtn = document.createElement('button')
      clearBtn.type = 'button'
      clearBtn.className = 'preset-btn color-swatch transparent-swatch'
      clearBtn.textContent = 'Transparent'
      clearBtn.title = 'Transparent'
      clearBtn.addEventListener('pointerenter', () => host.__colorPreview?.(TRANSPARENT_GLASS))
      clearBtn.addEventListener('pointerleave', () => host.__colorPreview?.(null))
      clearBtn.addEventListener('click', () => {
        host.__colorPreview?.(null)
        host.__colorPick?.(TRANSPARENT_GLASS)
      })
      top.appendChild(clearBtn)
    } else if (clearBtn.parentElement !== top) {
      top.appendChild(clearBtn)
    }
    clearBtn.classList.toggle('active', isTransparent)
  } else {
    host.querySelector('button.transparent-swatch')?.remove()
  }
}

/** @deprecated Alias — nutzt freie Color-Picker. */
function renderColorSwatches(
  container: HTMLElement,
  palette: ColorPalette,
  active: string,
  onPick: (color: string) => void,
  onPreview?: (color: string | null) => void,
) {
  void palette
  renderColorControl(container, active, onPick, onPreview, {
    allowTransparent: active === TRANSPARENT_GLASS || palette === 'glass',
  })
}

function previewPanelPatch(
  build: (value: string) => Partial<StudioPanelConfig>,
): (color: string | null) => void {
  return (value) => {
    if (value === null) {
      syncSelectionHighlightSuppressed()
      facade.setState(state)
      facade.setEditor(editor)
      svgView.setState(state, editor)
      if (currentView === 'front') syncFrontView()
      markViewportDirty()
      return
    }
    facade.setSelectionHighlightSuppressed(true)
    svgView.setSelectionHighlightSuppressed(true)
    const ids = scopedWallIds()
    const next = updateStudioPanel(state, ids, build(value))
    const buildingIds = [
      ...new Set(
        ids
          .map((id) => findBuildingForWall(state, id)?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    facade.setState(next, { rebuildBuildingIds: buildingIds.length > 0 ? buildingIds : undefined })
    svgView.setState(next, editor)
    if (currentView === 'front') syncFrontView()
    markViewportDirty()
  }
}

/** Hover-Vorschau ohne orange Selektion; kein renderUi während des Pickens. */
function previewSelectionColor(build: (color: string) => FacadeState): (color: string | null) => void {
  return (color) => {
    if (color === null) {
      syncSelectionHighlightSuppressed()
      facade.setState(state)
      facade.setEditor(editor)
      svgView.setState(state, editor)
      if (currentView === 'front') syncFrontView()
      markViewportDirty()
      return
    }
    facade.setSelectionHighlightSuppressed(true)
    svgView.setSelectionHighlightSuppressed(true)
    const next = build(color)
    facade.setState(next)
    svgView.setState(next, editor)
    if (currentView === 'front') syncFrontView()
    markViewportDirty()
  }
}

function activeJointColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_JOINT_COLOR
  const first = walls[0].panel?.jointColor ?? DEFAULT_JOINT_COLOR
  return walls.every((wall) => (wall.panel?.jointColor ?? DEFAULT_JOINT_COLOR) === first)
    ? first
    : DEFAULT_JOINT_COLOR
}

function activeWallColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_WALL_COLOR
  const first = walls[0].wallColor ?? DEFAULT_WALL_COLOR
  return walls.every((wall) => (wall.wallColor ?? DEFAULT_WALL_COLOR) === first) ? first : DEFAULT_WALL_COLOR
}

function activeInteriorColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_INTERIOR_COLOR
  const first = walls[0].interiorColor ?? DEFAULT_INTERIOR_COLOR
  return walls.every((wall) => (wall.interiorColor ?? DEFAULT_INTERIOR_COLOR) === first)
    ? first
    : DEFAULT_INTERIOR_COLOR
}

function activeCeilingColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_CEILING_COLOR
  const colors: string[] = []
  for (const wall of walls) {
    const building = findBuildingForWall(state, wall.id)
    if (!building) continue
    const idx = floorIndex(wall, building.wallHeight)
    colors.push(building.floors[idx]?.ceilingColor ?? DEFAULT_CEILING_COLOR)
  }
  if (colors.length === 0) return DEFAULT_CEILING_COLOR
  const first = colors[0]!
  return colors.every((color) => color === first) ? first : DEFAULT_CEILING_COLOR
}

function activeCladdingColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_WALL_COLOR
  const first = walls[0].claddingColor ?? walls[0].wallColor ?? DEFAULT_WALL_COLOR
  return walls.every((wall) => (wall.claddingColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR) === first)
    ? first
    : DEFAULT_WALL_COLOR
}

function activeProfileColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_PROFILE_COLOR
  const first = walls[0].profileColor ?? DEFAULT_PROFILE_COLOR
  return walls.every((wall) => (wall.profileColor ?? DEFAULT_PROFILE_COLOR) === first)
    ? first
    : DEFAULT_PROFILE_COLOR
}

function activeCorniceColor(): string {
  const walls = selectedWalls()
  if (walls.length === 0) return DEFAULT_PROFILE_COLOR
  const colors = walls.map(
    (wall) => wallCornice(wall).color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR,
  )
  const first = colors[0]
  return colors.every((color) => color === first) ? first : DEFAULT_PROFILE_COLOR
}

function activeTrimColor(): string {
  const colors = editor.selectedOpenings.map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.trim?.color ?? wall?.profileColor ?? DEFAULT_PROFILE_COLOR
  })
  if (colors.length === 0) return DEFAULT_PROFILE_COLOR
  const first = colors[0]
  return colors.every((color) => color === first) ? first : DEFAULT_PROFILE_COLOR
}

function activeFrameColor(): string {
  const refs =
    editor.selectedOpenings.length > 0
      ? editor.selectedOpenings
      : selectedWindowOpeningRefs()
  const colors = refs
    .map((ref) => {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      return opening?.frameColor ?? defaultOpeningFrameColor(opening?.type === 'door' ? 'door' : 'window')
    })
    .filter(Boolean)
  if (colors.length === 0) return DEFAULT_FRAME_COLOR
  const first = colors[0]
  return colors.every((color) => color === first) ? first : DEFAULT_FRAME_COLOR
}

function activeGlassColor(): string {
  const refs =
    editor.selectedOpenings.length > 0
      ? editor.selectedOpenings
      : selectedWindowOpeningRefs()
  const colors = refs
    .map((ref) => {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      return opening?.glassColor ?? DEFAULT_GLASS_COLOR
    })
    .filter(Boolean)
  if (colors.length === 0) return DEFAULT_GLASS_COLOR
  const first = colors[0]
  return colors.every((color) => color === first) ? first : DEFAULT_GLASS_COLOR
}

function selectedWindowOpeningRefs(): OpeningRef[] {
  return selectedWindowOpeningRefsForWalls(editor.selectedWallIds)
}

function commitFrameColor(color: string) {
  if (editor.selectedOpenings.length > 0) {
    commitState(updateOpeningFrameColors(state, scopedOpeningRefs(), color))
    return
  }
  commitState(updateWindowFrameColorsForWalls(state, scopedWallIds(), color))
}

function commitGlassColor(color: string) {
  if (editor.selectedOpenings.length > 0) {
    commitState(updateOpeningGlassColors(state, scopedOpeningRefs(), color))
    return
  }
  commitState(updateWindowGlassColorsForWalls(state, scopedWallIds(), color))
}

function previewFrameColor(color: string): FacadeState {
  if (editor.selectedOpenings.length > 0) {
    return updateOpeningFrameColors(state, scopedOpeningRefs(), color)
  }
  return updateWindowFrameColorsForWalls(state, scopedWallIds(), color)
}

function previewGlassColor(color: string): FacadeState {
  if (editor.selectedOpenings.length > 0) {
    return updateOpeningGlassColors(state, scopedOpeningRefs(), color)
  }
  return updateWindowGlassColorsForWalls(state, scopedWallIds(), color)
}

function selectedOpeningGlassSample(): Opening | null {
  const refs =
    editor.selectedOpenings.length > 0
      ? editor.selectedOpenings
      : selectedWindowOpeningRefs()
  if (refs.length === 0) return null
  const wall = getWall(state, refs[0].wallId)
  return wall?.openings.find((item) => item.id === refs[0].openingId) ?? null
}

function syncGlassPhysicalControls(visible: boolean) {
  glassPhysicalSection.hidden = !visible
  if (!visible) return
  const opening = selectedOpeningGlassSample()
  if (!opening) {
    glassPhysicalSection.hidden = true
    return
  }
  const physical = opening.glassMode === 'physical'
  glassModePhysical.checked = physical
  glassPhysicalOptions.hidden = !physical
  glassIorInput.value = String(opening.glassIor ?? DEFAULT_GLASS_IOR)
  glassRoughnessInput.value = String(opening.glassRoughness ?? DEFAULT_GLASS_ROUGHNESS)
  glassTransmissionInput.value = String(opening.glassTransmission ?? DEFAULT_GLASS_TRANSMISSION)
  glassThicknessInput.value = String(opening.glassThickness ?? DEFAULT_GLASS_THICKNESS_CM)
}

function commitGlassPhysicalPatch(
  patch: Partial<
    Pick<
      Opening,
      'glassMode' | 'glassIor' | 'glassRoughness' | 'glassTransmission' | 'glassThickness'
    >
  >,
) {
  const refs =
    editor.selectedOpenings.length > 0
      ? scopedOpeningRefs()
      : selectedWindowOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningGlassSettings(state, refs, patch))
  syncGlassPhysicalControls(true)
}

glassModePhysical.addEventListener('change', () => {
  commitGlassPhysicalPatch({ glassMode: glassModePhysical.checked ? 'physical' : 'tint' })
  facade.setState(state)
})
for (const [input, key] of [
  [glassIorInput, 'glassIor'],
  [glassRoughnessInput, 'glassRoughness'],
  [glassTransmissionInput, 'glassTransmission'],
  [glassThicknessInput, 'glassThickness'],
] as const) {
  input.addEventListener('change', () => {
    commitGlassPhysicalPatch({ [key]: Number.parseFloat(input.value) })
    facade.setState(state)
  })
}

function activeRevealExteriorColor(): string {
  const refs =
    editor.selectedOpenings.length > 0
      ? editor.selectedOpenings
      : selectedWindowOpeningRefs()
  const colors = refs.map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return (
      opening?.revealExteriorColor ?? wall?.wallColor ?? DEFAULT_WALL_COLOR
    )
  })
  if (colors.length === 0) return DEFAULT_WALL_COLOR
  const first = colors[0]!
  return colors.every((color) => color === first) ? first : DEFAULT_WALL_COLOR
}

function activeRevealInteriorColor(): string {
  const refs =
    editor.selectedOpenings.length > 0
      ? editor.selectedOpenings
      : selectedWindowOpeningRefs()
  const colors = refs.map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return (
      opening?.revealInteriorColor ?? wall?.interiorColor ?? DEFAULT_INTERIOR_COLOR
    )
  })
  if (colors.length === 0) return DEFAULT_INTERIOR_COLOR
  const first = colors[0]!
  return colors.every((color) => color === first) ? first : DEFAULT_INTERIOR_COLOR
}

function commitRevealExteriorColor(color: string) {
  commitState(updateOpeningRevealColors(state, scopedOpeningRefs(), { exterior: color }))
}

function commitRevealInteriorColor(color: string) {
  commitState(updateOpeningRevealColors(state, scopedOpeningRefs(), { interior: color }))
}

function previewRevealExteriorColor(color: string): FacadeState {
  return updateOpeningRevealColors(state, scopedOpeningRefs(), { exterior: color })
}

function previewRevealInteriorColor(color: string): FacadeState {
  return updateOpeningRevealColors(state, scopedOpeningRefs(), { interior: color })
}

function syncRevealColorSwatches(visible: boolean) {
  revealExteriorColorSection.hidden = !visible
  revealInteriorColorSection.hidden = !visible
  if (!visible) return
  renderColorSwatches(
    revealExteriorColorSwatches,
    'wall',
    activeRevealExteriorColor(),
    commitRevealExteriorColor,
    previewSelectionColor(previewRevealExteriorColor),
  )
  renderColorSwatches(
    revealInteriorColorSwatches,
    'wall',
    activeRevealInteriorColor(),
    commitRevealInteriorColor,
    previewSelectionColor(previewRevealInteriorColor),
  )
}

function syncOpeningColorSwatches(
  frameContainer: HTMLDivElement,
  frameSection: HTMLDivElement | null,
  glassContainer: HTMLDivElement,
  glassSection: HTMLDivElement | null,
  visible: boolean,
) {
  if (frameSection) frameSection.hidden = !visible
  if (glassSection) glassSection.hidden = !visible
  syncGlassPhysicalControls(visible)
  if (!visible) return
  renderColorSwatches(
    frameContainer,
    'frame',
    activeFrameColor(),
    commitFrameColor,
    previewSelectionColor(previewFrameColor),
  )
  renderColorSwatches(
    glassContainer,
    'glass',
    activeGlassColor(),
    commitGlassColor,
    previewSelectionColor(previewGlassColor),
  )
}

function syncColorSwatches(_wall: Wall) {
  renderColorSwatches(
    wallColorSwatches,
    'wall',
    activeWallColor(),
    (color) => {
      commitState(updateWallColors(state, scopedWallIds(), color, 'wallColor'))
    },
    previewSelectionColor((color) => updateWallColors(state, scopedWallIds(), color, 'wallColor')),
  )
  moduleWallFinishSelect.value =
    _wall.wallFinish === 'glossy' || _wall.wallFinish === 'metal' ? _wall.wallFinish : 'matte'

  renderColorSwatches(
    profileColorSwatches,
    'profile',
    activeProfileColor(),
    (color) => {
      commitState(updateWallColors(state, scopedWallIds(), color, 'profileColor'))
    },
    previewSelectionColor((color) => updateWallColors(state, scopedWallIds(), color, 'profileColor')),
  )
  moduleProfileFinishSelect.value =
    _wall.profileFinish === 'glossy' || _wall.profileFinish === 'metal' ? _wall.profileFinish : 'matte'

  syncOpeningColorSwatches(
    frameColorSwatchesWall,
    frameColorSectionWall,
    glassColorSwatchesWall,
    glassColorSectionWall,
    editor.selectedOpenings.length > 0,
  )

  if (editor.selectedOpenings.length > 0) {
    syncOpeningColorSwatches(
      frameColorSwatches,
      frameColorSection,
      glassColorSwatches,
      glassColorSection,
      true,
    )
    syncRevealColorSwatches(true)
    openingFrameFinishSelect.value = (() => {
      const sel = selectedWindowOpening()
      const finish = sel?.opening.frameFinish
      return finish === 'glossy' || finish === 'metal' ? finish : 'matte'
    })()
  } else {
    syncRevealColorSwatches(false)
  }
}

function showShareStatus(message: string) {
  shareStatus.hidden = false
  shareStatus.textContent = message
  window.setTimeout(() => {
    shareStatus.hidden = true
  }, 3000)
}

function fillCladdingSelect(wall: Wall) {
  const matches = matchingCladdings(wall)
  claddingSection.hidden = matches.length === 0
  claddingSelect.replaceChildren()
  if (matches.length === 0) return

  const active = resolveCladding(wall)
  const none = document.createElement('option')
  none.value = 'none'
  none.textContent = 'Keine'
  claddingSelect.appendChild(none)
  for (const spec of matches) {
    const option = document.createElement('option')
    option.value = spec.id
    option.textContent = spec.label
    claddingSelect.appendChild(option)
  }
  claddingSelect.value = active?.id ?? 'none'
}

function openingProfileId(wall: Wall, openingId: string): string | null {
  const assigned = wall.profiles.filter((profile) => profile.openingId === openingId)
  if (assigned.length === 0) return null
  const ids = new Set(assigned.map((profile) => profile.profileId))
  return ids.size === 1 ? assigned[0].profileId : null
}

function openingEdgesForSelection(ref: OpeningRef): OpeningEdge[] {
  const wall = getWall(state, ref.wallId)
  if (!wall) return [...ALL_EDGES]
  const profileId = openingProfileId(wall, ref.openingId)
  const assigned =
    profileId && isWindowTrimProfile(profileId)
      ? openingProfileEdges(wall, ref.openingId, profileId)
      : openingProfileEdges(wall, ref.openingId)
  return assigned.length > 0 ? assigned : [...ALL_EDGES]
}

function trimValueForSelection(field: keyof OpeningTrimConfig): string | number | boolean {
  const values = editor.selectedOpenings.map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.trim?.[field]
  })
  const first = values[0]
  const same = values.length > 0 && values.every((value) => value === first)
  if (!same || first === undefined) {
    if (field === 'cornerJoin') return 'miter'
    if (field === 'flipOutward' || field === 'flipForward') return false
    if (field === 'scale') return 1
    return 0
  }
  return first
}

function currentTrimOrientation(): Pick<OpeningTrimConfig, 'rotationDeg' | 'flipOutward' | 'flipForward'> {
  return {
    rotationDeg: Number(trimValueForSelection('rotationDeg')) || 0,
    flipOutward: Boolean(trimValueForSelection('flipOutward')),
    flipForward: Boolean(trimValueForSelection('flipForward')),
  }
}

function drawSectionPreview(
  svg: SVGSVGElement,
  profileId: string,
  orient: { rotationDeg?: number; flipOutward?: boolean; flipForward?: boolean },
  color: string,
  anchored = false,
  axisScale?: { outward?: number; forward?: number },
  hangFromWallEdge = false,
) {
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const profile = profileId ? resolveProfile(profileId, state.customProfiles) : undefined
  if (!profile?.section) return

  let section = (anchored ? transformProfileSectionAnchored : transformProfileSection)(
    profile.section,
    orient.rotationDeg ?? 0,
    orient.flipOutward ?? false,
    orient.flipForward ?? false,
  )
  const scaleOut = axisScale?.outward ?? 1
  const scaleFwd = axisScale?.forward ?? 1
  if (scaleOut !== 1 || scaleFwd !== 1) {
    section = scaleProfileSectionAxes(section, scaleOut, scaleFwd)
  }
  let minOut = 0
  let maxOut = 1
  let minFwd = 0
  let maxFwd = 1
  for (const point of section) {
    minOut = Math.min(minOut, point.outward)
    maxOut = Math.max(maxOut, point.outward)
    minFwd = Math.min(minFwd, point.forward)
    maxFwd = Math.max(maxFwd, point.forward)
  }
  const pad = 1.2
  const ns = 'http://www.w3.org/2000/svg'
  const yOf = (outward: number) => (hangFromWallEdge ? outward : -outward)
  const yTop = hangFromWallEdge ? minOut - pad : -maxOut - pad
  const yBottom = hangFromWallEdge ? maxOut + pad : -minOut + pad
  const vbMinX = minFwd - pad
  const vbMinY = Math.min(yTop, yBottom)
  const vbW = maxFwd - minFwd + pad * 2
  const vbH = Math.abs(yBottom - yTop)
  svg.setAttribute('viewBox', `${vbMinX} ${vbMinY} ${vbW} ${vbH}`)

  const wall = document.createElementNS(ns, 'line')
  wall.setAttribute('x1', '0')
  wall.setAttribute('y1', String(yTop))
  wall.setAttribute('x2', '0')
  wall.setAttribute('y2', String(yBottom))
  wall.setAttribute('stroke', '#888')
  wall.setAttribute('stroke-dasharray', '0.4 0.4')
  wall.setAttribute('stroke-width', '0.15')
  svg.appendChild(wall)

  const edge = document.createElementNS(ns, 'line')
  edge.setAttribute('x1', String(minFwd - pad))
  edge.setAttribute('y1', '0')
  edge.setAttribute('x2', String(maxFwd + pad))
  edge.setAttribute('y2', '0')
  edge.setAttribute('stroke', '#c45c26')
  edge.setAttribute('stroke-dasharray', '0.4 0.4')
  edge.setAttribute('stroke-width', '0.15')
  svg.appendChild(edge)

  const poly = document.createElementNS(ns, 'polygon')
  const points = section
    .map((point) => `${point.forward},${yOf(point.outward)}`)
    .join(' ')
  poly.setAttribute('points', points)
  poly.setAttribute('fill', color)
  poly.setAttribute('stroke', '#8a7349')
  poly.setAttribute('stroke-width', '0.2')
  svg.appendChild(poly)
}

function frameProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(FRAME_PROFILE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function pedimentProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(PEDIMENT_PROFILE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function pedimentConsoleProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(PEDIMENT_CONSOLE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function profileCardDisplayLabel(label: string): string {
  if (label === 'Fensterverdachung') return 'Verdachung'
  if (label === 'Fenster-/Türprofil') return 'Rahmenprofil'
  if (label === 'Fensterprofil 32×120') return '32×120'
  if (label === 'Fensterprofil 35×130') return '35×130'
  if (label === 'Fensterprofil 40×140') return '40×140'
  if (label === 'Traufgesims 70×150') return 'Traufe 70'
  if (label === 'Traufgesims 110×135') return 'Traufe 110'
  if (label === 'Traufgesims 200×200') return 'Traufe 200'
  if (label === 'Standard-Sockel') return 'Standard'
  if (label === 'Sockelprofil') return 'Profil'
  return label
}

function buildProfilePickerCards(
  container: HTMLElement,
  profiles: ProfileDefinition[],
  selectedId: string,
  options: {
    noneLabel?: string
    color?: string
    disabled?: boolean
    axisScale?: { outward?: number; forward?: number }
    hangFromWallEdge?: boolean
    onSelect: (profileId: string) => void
  },
) {
  container.replaceChildren()
  const color = options.color ?? DEFAULT_PROFILE_COLOR
  const disabled = options.disabled ?? false

  if (options.noneLabel) {
    const noneBtn = document.createElement('button')
    noneBtn.type = 'button'
    noneBtn.className = 'tpl-card'
    noneBtn.dataset.value = ''
    noneBtn.disabled = disabled
    noneBtn.classList.toggle('active', !selectedId)
    noneBtn.innerHTML = `<div class="tpl-card-thumb tpl-card-thumb-empty">${options.noneLabel}</div><span>${options.noneLabel}</span>`
    noneBtn.addEventListener('click', () => options.onSelect(''))
    container.appendChild(noneBtn)
  }

  for (const profile of profiles) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tpl-card'
    btn.dataset.value = profile.id
    btn.disabled = disabled
    btn.classList.toggle('active', profile.id === canonicalProfileId(selectedId))
    btn.title = profile.label

    const thumb = document.createElement('div')
    thumb.className = 'tpl-card-thumb'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '-2 -2 18 18')
    svg.classList.add('tpl-profile-preview')
    thumb.appendChild(svg)
    drawSectionPreview(
      svg,
      profile.id,
      { rotationDeg: 0, flipOutward: false, flipForward: false },
      color,
      false,
      options.axisScale,
      options.hangFromWallEdge,
    )

    const label = document.createElement('span')
    label.textContent = profileCardDisplayLabel(profile.label)
    btn.append(thumb, label)
    btn.addEventListener('click', () => options.onSelect(profile.id))
    container.appendChild(btn)
  }
}

function activeFrameProfileId(): string {
  return profileSelectCards.querySelector<HTMLButtonElement>('.tpl-card.active')?.dataset.value ?? ''
}

function rebuildFrameProfileCards(disabled = false) {
  const ids = editor.selectedOpenings.map((ref) => {
    const wall = getWall(state, ref.wallId)
    if (!wall) return null
    return openingProfileId(wall, ref.openingId)
  })
  const first = ids[0] ?? ''
  const same = ids.length > 0 && ids.every((id) => id === first)
  const selectedId = same && first ? first : ''
  buildProfilePickerCards(profileSelectCards, frameProfileDefinitions(), selectedId, {
    noneLabel: 'Kein Profil',
    color: activeTrimColor(),
    disabled,
    onSelect: (profileId) => {
      const refs = openingRefsForLibrary()
      if (refs.length === 0) return
      if (!profileId) {
        commitState(removeProfilesFromOpenings(state, refs, [...ALL_EDGES]))
      } else {
        commitState(assignProfilesToOpenings(state, refs, [...ALL_EDGES], profileId))
      }
      rebuildFrameProfileCards()
      syncProfileTrimControls()
    },
  })
}

function rebuildPedimentProfileCards(disabled = false) {
  const sel = selectedWindowOpening()
  const pediment = sel ? normalizeOpeningPediment(sel.opening.pediment) : null
  const profileId = pediment?.enabled ? pediment.profileId : ''
  buildProfilePickerCards(pedimentProfileCards, pedimentProfileDefinitions(), profileId ?? '', {
    noneLabel: 'Keines',
    color: sel?.opening.pediment?.color ?? activeTrimColor(),
    disabled,
    onSelect: (id) => {
      if (!id) commitOpeningPedimentPatch({ enabled: false })
      else commitOpeningPedimentPatch({ enabled: true, profileId: id })
    },
  })
}

function rebuildPedimentConsoleCards(disabled = false) {
  const sel = selectedWindowOpening()
  const pediment = sel ? normalizeOpeningPediment(sel.opening.pediment) : null
  const profileId =
    pediment?.enabled && pediment.consoles?.enabled ? (pediment.consoles.profileId ?? '') : ''
  buildProfilePickerCards(pedimentConsoleCards, pedimentConsoleProfileDefinitions(), profileId, {
    noneLabel: 'Keine',
    color: sel?.opening.pediment?.color ?? activeTrimColor(),
    disabled,
    onSelect: (id) => {
      if (!id) commitOpeningPedimentPatch({ consoles: { enabled: false, profileId: undefined } })
      else commitOpeningPedimentPatch({ consoles: { enabled: true, profileId: id } })
    },
  })
}

function drawCorniceSectionPreview() {
  const wall = selectedWalls()[0]
  const cornice = wall ? wallCornice(wall) : undefined
  const orient = {
    rotationDeg: cornice?.rotationDeg ?? 0,
    flipOutward: Boolean(cornice?.flipOutward),
    flipForward: Boolean(cornice?.flipForward),
  }
  const profileId = cornice?.profileId ?? 'traufgesims70x150'
  const color = activeCorniceColor()
  drawSectionPreview(studioCornicePreview, profileId, orient, color, false, undefined, true)
  drawSectionPreview(wallCornicePreview, profileId, orient, color, false, undefined, true)
}

function sillOuterProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(SILL_OUTER_PROFILE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function corniceProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(CORNICE_PROFILE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function plinthProfileDefinitions(): ProfileDefinition[] {
  const allowed = new Set<string>(PLINTH_PROFILE_IDS)
  return allProfiles(state.customProfiles).filter((profile) => allowed.has(profile.id))
}

function activePlinthProfileColor(wall?: Wall): string {
  const panel = wall?.panel ?? selectedWalls()[0]?.panel
  return panel?.plinthProfileColor ?? wall?.profileColor ?? selectedWalls()[0]?.profileColor ?? DEFAULT_PROFILE_COLOR
}

function plinthSectionAxisScale(panel?: { plinthHeight?: number; plinthDepth?: number }, profileId?: string) {
  const profile = profileId ? resolveProfile(profileId, state.customProfiles) : undefined
  const section = profile?.section
  if (!section?.length) return { outward: 1, forward: 1 }
  const nativeH = Math.max(...section.map((p) => p.outward), 0)
  const nativeD = Math.max(...section.map((p) => p.forward), 0)
  const heightCm = panel?.plinthHeight && panel.plinthHeight > 0 ? panel.plinthHeight : nativeH || 32
  const depthCm = panel?.plinthDepth && panel.plinthDepth > 0 ? panel.plinthDepth : nativeD || 8
  return {
    outward: nativeH > 1e-6 ? heightCm / nativeH : 1,
    forward: nativeD > 1e-6 ? depthCm / nativeD : 1,
  }
}

function drawPlinthSectionPreview(wall?: Wall) {
  const w = wall ?? selectedWalls()[0]
  const panel = w?.panel
  const profileId = panel?.plinthProfileId ?? DEFAULT_PLINTH_PROFILE_ID
  const orient = {
    rotationDeg: panel?.plinthProfileRotationDeg ?? 0,
    flipOutward: Boolean(panel?.plinthProfileFlipOutward),
    flipForward: Boolean(panel?.plinthProfileFlipForward),
  }
  drawSectionPreview(
    studioPlinthPreview,
    profileId,
    orient,
    activePlinthProfileColor(w),
    false,
    plinthSectionAxisScale(panel, profileId),
  )
}

function rebuildPlinthProfileCards(wall?: Wall) {
  const w = wall ?? selectedWalls()[0]
  const panel = w?.panel
  const plinthOn = panel?.plinthEnabled !== false
  const selectedId = plinthOn ? (panel?.plinthProfileId ?? DEFAULT_PLINTH_PROFILE_ID) : ''
  const color = activePlinthProfileColor(w)
  const axisScale = plinthSectionAxisScale(panel, selectedId || DEFAULT_PLINTH_PROFILE_ID)
  buildProfilePickerCards(studioPlinthProfileCards, plinthProfileDefinitions(), selectedId, {
    noneLabel: 'Keiner',
    color,
    axisScale,
    onSelect: (id) => {
      if (!id) {
        commitStudioPanelPatch({ plinthEnabled: false })
      } else {
        commitStudioPanelPatch({ plinthEnabled: true, plinthProfileId: id })
      }
      syncPlinthProfileControls()
    },
  })
  drawPlinthSectionPreview(w)
}

function syncEndBossControls(wall: Wall, allWalls: Wall[]) {
  const panel = wall.panel
  if (!panel) {
    studioEndBossSection.hidden = true
    return
  }
  const panelsOn = panel.enabled !== false && panel.pattern !== 'none' && (panel.taperDepth ?? 0) > 0
  const startFree = !findAdjacentWall(wall, 'start', allWalls)
  const endFree = !findAdjacentWall(wall, 'end', allWalls)
  const startAdj = findAdjacentWall(wall, 'start', allWalls)
  const endAdj = findAdjacentWall(wall, 'end', allWalls)
  studioEndBossSection.hidden = !panelsOn
  studioEndBossStartRow.hidden = !panelsOn
  studioEndBossEndRow.hidden = !panelsOn
  if (!panelsOn) return
  studioEndBossStart.value = panel.endBossStart ?? 'off'
  studioEndBossEnd.value = panel.endBossEnd ?? 'off'
  studioEndBossStart.disabled = !startFree
  studioEndBossEnd.disabled = !endFree
  studioEndBossStartJoin.hidden = !startAdj
  studioEndBossEndJoin.hidden = !endAdj
  studioEndBossStartJoin.value = panel.endBossStartJoin ?? ''
  studioEndBossEndJoin.value = panel.endBossEndJoin ?? ''
}

function commitEndBossPatch(
  patch: Partial<{
    endBossStart: EndBossPattern
    endBossEnd: EndBossPattern
    endBossStartJoin: EndBossJoin | undefined
    endBossEndJoin: EndBossJoin | undefined
  }>,
) {
  const ids = scopedWallIds().filter((id) => isStudioWall(getWall(state, id)!))
  if (ids.length === 0) return
  commitState(updateStudioPanel(state, ids, patch))
}

studioEndBossStart.addEventListener('change', () => {
  commitEndBossPatch({ endBossStart: studioEndBossStart.value as EndBossPattern })
})
studioEndBossEnd.addEventListener('change', () => {
  commitEndBossPatch({ endBossEnd: studioEndBossEnd.value as EndBossPattern })
})
studioEndBossStartJoin.addEventListener('change', () => {
  const v = studioEndBossStartJoin.value
  commitEndBossPatch({ endBossStartJoin: v === 'flush' || v === 'miter' ? v : undefined })
})
studioEndBossEndJoin.addEventListener('change', () => {
  const v = studioEndBossEndJoin.value
  commitEndBossPatch({ endBossEndJoin: v === 'flush' || v === 'miter' ? v : undefined })
})

function syncEndPieceControls(wall: Wall) {
  let parent = wall
  if (wall.endPieceParentId) {
    const linked = getWall(state, wall.endPieceParentId)
    if (linked) parent = linked
  }
  const show = Boolean(parent.endPiece) && isStudioWall(parent)
  studioEndPieceSection.hidden = !show
  if (!show) return
  studioEndPieceAngle.value = String(parent.endPiece?.angleDeg ?? END_PIECE_DEFAULT_ANGLE_DEG)
}

function clampEndPieceAngleInput(value: number): number {
  const snapped = Math.round(value / 10) * 10
  return Math.max(40, Math.min(140, snapped))
}

function pickWallHitAtClient(
  clientX: number,
  clientY: number,
): { wallId: string; localX: number; localY: number } | null {
  return pickWallAtClient(clientX, clientY)
}

function bayWindowParentEligible(wall: Wall | undefined): wall is Wall {
  return Boolean(
    wall &&
      isStudioWall(wall) &&
      !wall.bayWindow &&
      !wall.bayParentId &&
      !wall.endPieceParentId,
  )
}

function applyBayWindowOnWall(
  preset: (typeof BAY_WINDOW_PRESETS)[number],
  wall: Wall,
  mode: 'replace' | 'left' | 'right' | 'above',
  localX: number,
) {
  if (!canEditActiveBuildingNow()) return
  const building = activeBuilding()
  if (mode === 'replace') {
    const walls = buildBayWindowAtPose(
      {
        originX: wall.originX ?? wall.x,
        originZ: wall.originZ ?? 0,
        y: wall.y,
        yawDeg: wall.yawDeg ?? 0,
        panelFlip: wall.panelFlip ?? true,
        height: wall.height,
      },
      preset,
      wall,
    )
    if (walls.length === 0) {
      planStatus.textContent = 'Erker konnte die Wand nicht ersetzen'
      return
    }
    const others = building.walls.filter((item) => item.id !== wall.id)
    if (incomingWallsCollide(others, walls)) {
      planStatus.textContent = 'Erker würde bestehende Wände überlagern'
      return
    }
    const groupId = createId()
    const grouped = walls.map((item) => ({ ...item, groupId }))
    const wallsNext = others.concat(grouped)
    const groups = [
      ...(building.groups ?? []).filter((group) => group.id !== wall.groupId),
      { id: groupId, name: preset.label, memberWallIds: grouped.map((item) => item.id) },
    ]
    let next = updateActiveBuilding(state, { walls: wallsNext, groups })
    next = linkStudioWalls(next, grouped.map((item) => item.id))
    next = syncFloorPlansFromWalls(next)
    next = finalizeStudioGeometry(next)
    commitState(next, {
      selectedWallIds: grouped.map((item) => item.id),
      selectedOpenings: [],
      selectedEdges: [],
    })
    rebuildFloorPlanOverlay()
    planStatus.textContent = `${preset.label} ersetzt die Wand`
    return
  }
  let attachCenter = localX
  if (mode === 'left' || mode === 'right') {
    const end = visualSideToWallEnd(wall, mode)
    attachCenter = end === 'start' ? preset.frontWidthCm / 2 : wall.width - preset.frontWidthCm / 2
  } else if (mode === 'above') {
    attachCenter = wall.width / 2
  }
  const built = buildBayWindowWalls(wall, preset, attachCenter)
  if (!built) {
    planStatus.textContent = 'Erker passt nicht auf diese Wand'
    return
  }
  if (incomingWallsCollide(building.walls, built.walls)) {
    planStatus.textContent = 'Erker würde bestehende Wände überlagern'
    return
  }
  const removeBayIds = new Set(wall.bayWindow?.wallIds ?? [])
  const groupId = createId()
  const groupedWalls = built.walls.map((child) => ({ ...child, groupId }))
  let walls = building.walls.filter((item) => !removeBayIds.has(item.id))
  walls = walls.map((item) => (item.id === wall.id ? built.parent : item))
  walls.push(...groupedWalls)
  const groups = [
    ...(building.groups ?? []),
    { id: groupId, name: preset.label, memberWallIds: groupedWalls.map((item) => item.id) },
  ]
  let next = updateActiveBuilding(state, { walls, groups })
  next = linkStudioWalls(next, [wall.id, ...groupedWalls.map((item) => item.id)])
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: groupedWalls.map((item) => item.id),
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = `${preset.label} an die Wand angegliedert`
}

function askBayWindowPlacement(presetId: string, wallId: string, localX: number) {
  const dialog = document.querySelector<HTMLDialogElement>('#bay-window-place-dialog')
  const preset = BAY_WINDOW_PRESETS.find((item) => item.id === presetId)
  const wall = getWall(state, wallId)
  if (!dialog || !preset || !bayWindowParentEligible(wall)) return
  const onClose = () => {
    dialog.removeEventListener('close', onClose)
    const value = dialog.returnValue
    if (value === 'replace' || value === 'left' || value === 'right' || value === 'above') {
      applyBayWindowOnWall(preset, wall, value, localX)
    }
  }
  dialog.addEventListener('close', onClose)
  dialog.showModal()
}

function placeBayWindowAtWall(presetId: string, clientX: number, clientY: number) {
  if (!canEditActiveBuildingNow()) return
  const preset = BAY_WINDOW_PRESETS.find((item) => item.id === presetId)
  if (!preset) return
  const hit = pickWallHitAtClient(clientX, clientY)
  if (hit) {
    const wall = getWall(state, hit.wallId)
    if (bayWindowParentEligible(wall)) {
      askBayWindowPlacement(presetId, wall.id, hit.localX)
      return
    }
    planStatus.textContent = 'Erker: gültige Wand wählen (ohne Erker/Endstück) oder in die Fläche legen'
    return
  }
  const grid = pickGroundGridFromClient(clientX, clientY)
  if (!grid) {
    if (currentView !== 'top') {
      setView('top')
      planStatus.textContent = 'Erker: in der Draufsicht ablegen oder auf eine Wand ziehen'
    }
    return
  }
  addBayWindowPresetAtPlan(presetId, grid.gx, grid.gz)
}

function placeBayWindowFromLibrary(presetId: string) {
  if (!canEditActiveBuildingNow()) return
  const ids = editor.selectedWallIds.filter((id) => bayWindowParentEligible(getWall(state, id)))
  if (ids.length === 1) {
    const wall = getWall(state, ids[0])!
    askBayWindowPlacement(presetId, wall.id, wall.width / 2)
    return
  }
  if (currentView !== 'top') {
    setView('top')
    planStatus.textContent = 'Erker: in der Draufsicht ablegen oder auf eine markierte Wand ziehen'
    return
  }
  const grid = planViewCenterGrid()
  addBayWindowPresetAtPlan(presetId, grid.gx, grid.gz)
}

function dropEndPieceAtClient(clientX: number, clientY: number, hand: EndPieceHand) {
  if (!canEditActiveBuildingNow()) return
  const hit = pickWallHitAtClient(clientX, clientY)
  if (hit) {
    const wall = getWall(state, hit.wallId)
    if (wall && isStudioWall(wall) && !wall.endPieceParentId && !wall.bayParentId) {
      attachEndPieceToWall(wall.id, hand)
      return
    }
  }
  const grid = pickGroundGridFromClient(clientX, clientY)
  if (!grid) {
    if (currentView !== 'top') {
      setView('top')
      planStatus.textContent = 'Endstück: in der Draufsicht ablegen oder an ein Wandende ziehen'
    }
    return
  }
  addEndPiecePresetAtPlan(hand === 'right' ? 'wall-end-48-right' : 'wall-end-48-left', grid.gx, grid.gz)
}

function attachEndPieceToWall(
  wallId: string,
  hand: EndPieceHand,
  options?: { side?: 'start' | 'end'; selectParentOnly?: boolean },
) {
  if (!canEditActiveBuildingNow()) return
  const building = activeBuilding()
  const parent = building.walls.find((w) => w.id === wallId)
  if (!parent || !isStudioWall(parent)) return
  const side = options?.side ?? visualSideToWallEnd(parent, hand)
  if (!wallEndIsFree(parent, side, building.walls)) {
    planStatus.textContent = 'Dieses Wandende ist nicht frei'
    return
  }
  const existingArms = parent.endPiece?.armWallIds?.map((id) => building.walls.find((w) => w.id === id))
  const existingGroupId = existingArms?.find((wall) => wall?.groupId)?.groupId
  const angleDeg = parent.endPiece?.angleDeg ?? END_PIECE_DEFAULT_ANGLE_DEG
  const ret = buildEndPieceReturnWall(parent, hand, angleDeg, existingArms?.[0])
  if (endPieceArmsCollide(building.walls, parent, [ret], [parent.id])) {
    planStatus.textContent = 'Endstück würde Wände überlagern'
    return
  }
  const removeIds = new Set(parent.endPiece?.armWallIds ?? [])
  const groupId = existingGroupId ?? createId()
  const updatedParent: Wall = {
    ...parent,
    endPiece: {
      side,
      hand,
      angleDeg,
      armWallIds: [ret.id],
    },
  }
  let walls = building.walls.filter((w) => !removeIds.has(w.id))
  walls = walls.map((w) => (w.id === parent.id ? updatedParent : w))
  const groupedRet = { ...ret, groupId }
  walls.push(groupedRet)
  const groups = [
    ...(building.groups ?? []).filter((group) => group.id !== groupId),
    {
      id: groupId,
      name: hand === 'left' ? 'Endstück 48 links' : 'Endstück 48 rechts',
      memberWallIds: [groupedRet.id],
    },
  ]
  let next = updateActiveBuilding(state, { walls, groups })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: options?.selectParentOnly ? [parent.id] : [parent.id, groupedRet.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = `Endstück 48 ${hand === 'left' ? 'links' : 'rechts'} an die Wand gesetzt`
}

function placeWallEndPieceFromLibrary(hand: EndPieceHand) {
  const ids = editor.selectedWallIds.filter((id) => {
    const wall = getWall(state, id)
    return wall && isStudioWall(wall) && !wall.endPieceParentId
  })
  if (ids.length === 1) {
    attachEndPieceToWall(ids[0], hand)
    return
  }
  if (currentView !== 'top') {
    setView('top')
    planStatus.textContent = 'Endstück: in der Draufsicht ablegen oder eine Wand markieren'
    return
  }
  const grid = planViewCenterGrid()
  addEndPiecePresetAtPlan(hand === 'right' ? 'wall-end-48-right' : 'wall-end-48-left', grid.gx, grid.gz)
}

function updateSelectedEndPieceAngle(deltaDeg: number) {
  const wall = selectedWalls()[0]
  if (!wall) return
  let parent = wall
  if (wall.endPieceParentId) {
    const linked = getWall(state, wall.endPieceParentId)
    if (linked) parent = linked
  }
  if (!parent.endPiece) return
  const nextAngle = clampEndPieceAngleInput((parent.endPiece.angleDeg ?? END_PIECE_DEFAULT_ANGLE_DEG) + deltaDeg)
  studioEndPieceAngle.value = String(nextAngle)
  commitEndPieceAngle(parent.id, nextAngle)
}

function commitEndPieceAngle(parentId: string, angleDeg: number) {
  if (!canEditActiveBuildingNow()) return
  const building = activeBuilding()
  const parent = building.walls.find((w) => w.id === parentId)
  if (!parent?.endPiece) return
  const side = parent.endPiece.side
  const hand: EndPieceHand =
    parent.endPiece.hand ?? (endPieceSideForHand(parent.panelFlip ?? true, 'left') === side ? 'left' : 'right')
  const angle = clampEndPieceAngleInput(angleDeg)
  const existingArms = parent.endPiece.armWallIds?.map((id) => building.walls.find((w) => w.id === id))
  const groupId = existingArms?.find((wall) => wall?.groupId)?.groupId ?? createId()
  const ret = buildEndPieceReturnWall(parent, hand, angle, existingArms?.[0])
  if (endPieceArmsCollide(building.walls, parent, [ret], [parent.id])) {
    planStatus.textContent = 'Endstück-Winkel würde Wände überlagern'
    syncEndPieceControls(parent)
    return
  }
  const armIds = new Set(parent.endPiece.armWallIds ?? [])
  const updatedParent: Wall = {
    ...parent,
    endPiece: { side, hand, angleDeg: angle, armWallIds: [ret.id] },
  }
  let walls = building.walls.filter((w) => !armIds.has(w.id) || w.id === parent.id)
  walls = walls.map((w) => (w.id === parent.id ? updatedParent : w))
  const groupedRet = { ...ret, groupId }
  walls.push(groupedRet)
  const groups = [
    ...(building.groups ?? []).filter((group) => group.id !== groupId),
    {
      id: groupId,
      name: hand === 'left' ? 'Endstück 48 links' : 'Endstück 48 rechts',
      memberWallIds: [groupedRet.id],
    },
  ]
  let next = updateActiveBuilding(state, { walls, groups })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [parent.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
}

function removeSelectedEndPiece() {
  const wall = selectedWalls()[0]
  if (!wall) return
  let parent = wall
  if (wall.endPieceParentId) {
    const linked = getWall(state, wall.endPieceParentId)
    if (linked) parent = linked
  }
  if (!parent.endPiece) return
  if (!canEditActiveBuildingNow()) return
  const removeIds = new Set(parent.endPiece.armWallIds ?? [])
  const building = activeBuilding()
  const groupIds = new Set(
    building.walls
      .filter((w) => removeIds.has(w.id))
      .map((w) => w.groupId)
      .filter((id): id is string => Boolean(id)),
  )
  const walls = building.walls
    .filter((w) => !removeIds.has(w.id))
    .map((w) => (w.id === parent.id ? { ...w, endPiece: undefined } : w))
  const groups = (building.groups ?? []).filter((group) => !groupIds.has(group.id))
  let next = updateActiveBuilding(state, { walls, groups })
  next = syncFloorPlansFromWalls(next)
  next = finalizeStudioGeometry(next)
  commitState(next, {
    selectedWallIds: [parent.id],
    selectedOpenings: [],
    selectedEdges: [],
  })
  rebuildFloorPlanOverlay()
  planStatus.textContent = 'Endstück entfernt'
}

function syncPlinthProfileControls(wall?: Wall) {
  const w = wall ?? selectedWalls()[0]
  const panel = w?.panel
  if (!panel) return
  const profileId = panel.plinthProfileId ?? DEFAULT_PLINTH_PROFILE_ID
  const decorative = profileId !== 'sockelStandard' && Boolean(profileId)
  studioPlinthProfileOptions.hidden = !decorative
  studioPlinthDepthRow.hidden = false
  studioPlinthOffsetRow.hidden = false
  studioPlinthProfileScale.value = String(panel.plinthProfileScale ?? 1)
  studioPlinthFlipOutward.classList.toggle('active', Boolean(panel.plinthProfileFlipOutward))
  studioPlinthFlipForward.classList.toggle('active', Boolean(panel.plinthProfileFlipForward))
  rebuildPlinthProfileCards(w)
  const sockelColor =
    panel.plinthColor ?? panel.plinthProfileColor ?? w.wallColor ?? DEFAULT_WALL_COLOR
  renderColorSwatches(
    studioPlinthColorSwatches,
    'wall',
    sockelColor,
    (next) => commitStudioPanelPatch({ plinthColor: next, plinthProfileColor: next }),
    previewSelectionColor((next) =>
      updateStudioPanel(state, scopedWallIds(), { plinthColor: next, plinthProfileColor: next }),
    ),
  )
  if (decorative) {
    renderColorSwatches(
      studioPlinthProfileColorSwatches,
      'profile',
      activePlinthProfileColor(w),
      (next) => commitStudioPanelPatch({ plinthProfileColor: next }),
      previewSelectionColor((next) =>
        updateStudioPanel(state, scopedWallIds(), { plinthProfileColor: next }),
      ),
    )
  }
}

function buildPatternPickerCards(
  container: HTMLElement | null,
  patterns: StudioPanelPattern[],
  selected: StudioPanelPattern,
  onSelect: (pattern: StudioPanelPattern) => void,
) {
  if (!container) return
  container.replaceChildren()
  for (const pattern of patterns) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tpl-card'
    btn.dataset.value = pattern
    btn.classList.toggle('active', pattern === selected)
    btn.title = PATTERN_LABELS[pattern]

    const thumb = document.createElement('div')
    thumb.className = 'tpl-card-thumb'
    const svg = clonePatternPreviewSvg(pattern)
    thumb.appendChild(svg)

    const label = document.createElement('span')
    label.textContent = PATTERN_LABELS[pattern]
    btn.append(thumb, label)
    btn.addEventListener('click', () => onSelect(pattern))
    container.appendChild(btn)
  }
}

function updatePatternCardSelection(
  container: HTMLElement | null,
  selected: StudioPanelPattern,
) {
  if (!container) return
  container.querySelectorAll<HTMLButtonElement>('.tpl-card').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === selected)
  })
}

let lastStudioPatternCardsKey = ''

function rebuildStudioPatternCardsIfNeeded() {
  const wall = anchorWall()
  const panel = wall?.panel
  const pattern = panel?.pattern ?? 'strip'
  const key = `${pattern}:${panel?.panelWidth ?? 32}:${panel?.panelHeight ?? 32}`
  if (
    key === lastStudioPatternCardsKey &&
    studioPatternPanelCards.childElementCount > 0
  ) {
    updatePatternCardSelection(studioPatternPanelCards, pattern)
    updatePatternCardSelection(studioPatternMasonryCards, pattern)
    return
  }
  lastStudioPatternCardsKey = key
  rebuildStudioPatternCards()
}

function rebuildStudioPatternCards() {
  const wall = anchorWall()
  const pattern = wall?.panel?.pattern ?? 'strip'
  const selectPattern = (next: StudioPanelPattern) => {
    commitStudioPanelPatch({ pattern: next, enabled: next !== 'none' })
    refreshStudioPanelVisibility()
    rebuildStudioPatternCards()
  }
  buildPatternPickerCards(
    studioPatternPanelCards,
    ['none', ...PANEL_KIND_PATTERNS],
    pattern,
    selectPattern,
  )
  buildPatternPickerCards(studioPatternMasonryCards, MASONRY_KIND_PATTERNS, pattern, selectPattern)
}

let lastRoofPatternCardsKey = ''

function rebuildRoofPatternCardsIfNeeded() {
  if (!editor.selectedRoofBuildingId) return
  const roof = normalizeRoof(activeBuilding().roof)
  const key = `${roof.tilePattern}:${roof.tileWidth}:${roof.tileHeight}`
  if (key === lastRoofPatternCardsKey && roofTilePatternCards.childElementCount > 0) {
    updatePatternCardSelection(roofTilePatternCards, roof.tilePattern)
    return
  }
  lastRoofPatternCardsKey = key
  rebuildRoofPatternCards()
}

function rebuildRoofPatternCards() {
  const roof = normalizeRoof(activeBuilding().roof)
  buildPatternPickerCards(
    roofTilePatternCards,
    [...PANEL_KIND_PATTERNS.filter((p) => p !== 'strip'), ...MASONRY_KIND_PATTERNS],
    roof.tilePattern,
    (pattern) => {
      commitRoofPatch({ tilePattern: pattern })
      rebuildRoofPatternCards()
    },
  )
}

function rebuildSillOuterProfileCards() {
  const sel = selectedWindowOpening()
  const normalized = sel?.opening.sillOuter
    ? normalizeOpeningSillOuter(sel.opening.sillOuter)
    : normalizeOpeningSillOuter({ enabled: true, mode: 'board' })
  const selectedId = normalized.mode === 'profile' ? (normalized.profileId ?? '') : ''
  buildProfilePickerCards(sillOuterProfileCards, sillOuterProfileDefinitions(), selectedId, {
    noneLabel: 'Keines (Brett)',
    color: normalized.color ?? activeTrimColor(),
    onSelect: (profileId) => {
      if (!profileId) {
        commitOpeningSillPatch({ outer: { mode: 'board', profileId: undefined } })
      } else {
        commitOpeningSillPatch({ outer: { mode: 'profile', profileId } })
      }
      rebuildSillOuterProfileCards()
      syncWindowSillControls()
    },
  })
}

function rebuildCorniceProfileCards(
  cardsEl: HTMLElement,
  profileId: string,
  color: string,
  onSelect: (id: string) => void,
) {
  buildProfilePickerCards(cardsEl, corniceProfileDefinitions(), profileId, {
    noneLabel: 'Keines',
    color,
    hangFromWallEdge: true,
    onSelect: (id) => {
      onSelect(id)
      drawCorniceSectionPreview()
    },
  })
}

function refreshAllProfileCards() {
  rebuildFrameProfileCards()
  rebuildPedimentProfileCards()
  rebuildPedimentConsoleCards()
  rebuildSillOuterProfileCards()
  rebuildPlinthProfileCards()
  const wall = selectedWalls()[0]
  if (wall) {
    const cornice = wallCornice(wall)
    const profileId = cornice.enabled ? (cornice.profileId ?? 'traufgesims70x150') : ''
    const color = cornice.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR
    rebuildCorniceProfileCards(studioCorniceProfileCards, profileId, color, (id) => {
      commitCornicePatch(id ? { enabled: true, profileId: id } : { enabled: false })
    })
    rebuildCorniceProfileCards(wallCorniceProfileCards, profileId, color, (id) => {
      commitCornicePatch(id ? { enabled: true, profileId: id } : { enabled: false })
    })
  }
}

function fillAllProfileSelects() {
  refreshAllProfileCards()
  if (libraryTab === 'profiles' || libraryTab === 'pediment') initOpeningLibrary()
}

function drawProfileSectionPreview() {
  drawSectionPreview(
    profileSectionPreview,
    activeFrameProfileId(),
    currentTrimOrientation(),
    activeTrimColor(),
  )
}

function selectedWindowOpening() {
  const ref = editor.selectedOpenings[0]
  if (!ref) return null
  const wall = getWall(state, ref.wallId)
  const opening = wall?.openings.find((item) => item.id === ref.openingId)
  if (!wall || !opening) return null
  return { wall, opening, ref }
}

function syncWindowSillControls() {
  const sel = selectedWindowOpening()
  const isWindow = Boolean(sel && openingActsAsWindow(sel.opening))
  const isBasement = Boolean(sel && isBasementWindowOpening(sel.opening))
  const showSills = Boolean(isWindow && !isBasement && sel && sel.opening.y > 0)
  windowSillSection.hidden = !isWindow || isBasement
  const sillInnerAcc = document.querySelector<HTMLElement>('#sill-inner-accordion')
  const sillOuterAcc = document.querySelector<HTMLElement>('#sill-outer-accordion')
  if (sillInnerAcc) sillInnerAcc.hidden = !showSills
  if (sillOuterAcc) sillOuterAcc.hidden = !showSills
  if (!showSills || !sel) return
  const inner = sel.opening.sillInner
  const outer = normalizeOpeningSillOuter(sel.opening.sillOuter)
  sillInnerEnabled.checked = inner?.enabled !== false
  sillInnerOverhang.value = String(inner?.overhang ?? 8)
  sillInnerDepth.value = String(inner?.depth ?? 16)
  sillInnerThickness.value = String(inner?.thickness ?? 4)
  renderColorSwatches(
    sillInnerColorSwatches,
    'profile',
    inner?.color ?? '#ffffff',
    (color) => {
      commitOpeningSillPatch({ inner: { color } })
    },
    previewSelectionColor((color) =>
      updateOpeningSills(state, scopedOpeningRefs(), { inner: { color } }),
    ),
  )
  sillInnerFinishSelect.value =
    inner?.finish === 'glossy' || inner?.finish === 'metal' || inner?.finish === 'matte'
      ? inner.finish
      : sel.wall.profileFinish === 'glossy' || sel.wall.profileFinish === 'metal'
        ? sel.wall.profileFinish
        : 'matte'
  sillOuterEnabled.checked = outer.enabled !== false
  rebuildSillOuterProfileCards()
  sillOuterOverhang.value = String(outer.overhang ?? 16)
  sillOuterDepth.value = String(outer.depth ?? 16)
  sillOuterThickness.value = String(outer.thickness ?? 4)
  sillOuterAngle.value = String(outer.angleDeg ?? 5)
  sillOuterScale.value = String(outer.scale ?? 1)
  sillOuterCornerJoin.value = String(outer.cornerJoin ?? 'miter')
  const profileMode = outerSillUsesProfile(outer)
  sillOuterProfileOptions.hidden = !profileMode
  sillOuterFlipOutward.classList.toggle('active', Boolean(outer.flipOutward))
  sillOuterFlipForward.classList.toggle('active', Boolean(outer.flipForward))
  if (profileMode) drawSillOuterSectionPreview()
  renderColorSwatches(
    sillOuterColorSwatches,
    'profile',
    outer.color ?? activeTrimColor(),
    (color) => {
      commitOpeningSillPatch({ outer: { color } })
    },
    previewSelectionColor((color) =>
      updateOpeningSills(state, scopedOpeningRefs(), { outer: { color } }),
    ),
  )
  sillOuterFinishSelect.value =
    outer.finish === 'glossy' || outer.finish === 'metal' || outer.finish === 'matte'
      ? outer.finish
      : sel.wall.profileFinish === 'glossy' || sel.wall.profileFinish === 'metal'
        ? sel.wall.profileFinish
        : 'matte'
}

function syncPedimentControls() {
  const sel = selectedWindowOpening()
  const supports = Boolean(sel && openingSupportsPediment(sel.opening))
  const pedimentSummary = document.querySelector<HTMLElement>('#pediment-summary')
  const pedimentEnabledLabel = document.querySelector<HTMLElement>('#pediment-enabled-label')
  if (!supports || !sel) return
  const isDoor = sel.opening.type === 'door'
  if (pedimentSummary) {
    pedimentSummary.textContent = isDoor ? 'Türverdachung' : 'Fensterverdachung'
  }
  if (pedimentEnabledLabel) {
    pedimentEnabledLabel.textContent = isDoor
      ? 'Verdachung über der Tür anzeigen'
      : 'Verdachung über dem Fenster anzeigen'
  }
  const pediment = normalizeOpeningPediment(sel.opening.pediment)
  pedimentEnabled.checked = pediment.enabled
  pedimentOptions.hidden = !pediment.enabled
  pedimentOptions.classList.toggle('is-disabled', !pediment.enabled)
  pedimentOptions.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    'input, select, button',
  ).forEach((el) => {
    if (el.id === 'pediment-enabled') return
    el.disabled = !pediment.enabled
  })
  if (!pediment.enabled) return
  for (const btn of pedimentFormCards.querySelectorAll<HTMLButtonElement>('.pediment-form-btn')) {
    btn.classList.toggle('active', btn.dataset.form === pediment.form)
    btn.disabled = false
  }
  if ([...PEDIMENT_PROFILE_IDS].includes(pediment.profileId as (typeof PEDIMENT_PROFILE_IDS)[number])) {
    rebuildPedimentProfileCards(!pediment.enabled)
  }
  pedimentOverhang.value = String(pediment.overhang ?? 8)
  pedimentGableHeight.value = String(pediment.gableHeight ?? 24)
  pedimentOffsetUp.value = String(pediment.offsetUp ?? 0)
  pedimentOffsetForward.value = String(pediment.offsetForward ?? 0)
  const selWall = sel?.wall ?? null
  const autoLift = selWall ? openingTopProfileLiftCm(selWall, sel!.opening) : 0
  pedimentOffsetUp.title =
    autoLift > 0
      ? `Zusätzlich zur automatischen Anhebung um ${roundCm(autoLift)} cm (Sturzprofil). Negativ = nach unten.`
      : 'Versatz der Verdachung: positiv = über dem Sturz, negativ = nach unten Richtung Öffnung'
  pedimentGableWidth.value = String(pediment.gableWidth ?? 0)
  pedimentSideArmWidth.value = String(pediment.sideArmWidth ?? 0)
  pedimentScale.value = String(pediment.scale ?? 1)
  pedimentExtentOut.value =
    pediment.extentOutCm != null && pediment.extentOutCm > 0 ? String(pediment.extentOutCm) : ''
  pedimentExtentForward.value =
    pediment.extentForwardCm != null && pediment.extentForwardCm > 0
      ? String(pediment.extentForwardCm)
      : ''
  const showGable = pediment.form !== 'straight'
  pedimentGableLabel.hidden = !showGable
  /** Breite folgt der Öffnung; nur Überstand und Firsthöhe sind editierbar. */
  pedimentGableSizeRow.hidden = true
  if (pedimentSideArmsRow) pedimentSideArmsRow.hidden = true
  if (pedimentSideArmLabel) pedimentSideArmLabel.hidden = true
  const overhangRow = pedimentOverhang.closest<HTMLElement>('.toolbar-row-2')
  if (overhangRow) overhangRow.hidden = false
  pedimentConsolesEnabled.checked = Boolean(pediment.consoles?.enabled)
  pedimentConsoleOptions.hidden = !pediment.consoles?.enabled
  pedimentConsoleOptions.classList.toggle('is-disabled', !pediment.enabled || !pediment.consoles?.enabled)
  pedimentConsoleWallOffset.value = String(pediment.consoles?.wallOffset ?? 0)
  pedimentConsoleWallOffset.disabled = !pediment.enabled || !pediment.consoles?.enabled
  rebuildPedimentConsoleCards(!pediment.enabled || !pediment.consoles?.enabled)
  renderColorSwatches(
    pedimentColorSwatches,
    'profile',
    pediment.color ?? activeTrimColor(),
    (color) => {
      commitOpeningPedimentPatch({ color })
    },
    previewSelectionColor((color) =>
      updateOpeningPediment(state, scopedOpeningRefs(), { color }),
    ),
  )
  const pedimentWall = sel?.wall
  pedimentFinishSelect.value =
    pediment.finish === 'glossy' || pediment.finish === 'metal' || pediment.finish === 'matte'
      ? pediment.finish
      : pedimentWall?.profileFinish === 'glossy' || pedimentWall?.profileFinish === 'metal'
        ? pedimentWall.profileFinish
        : 'matte'
}

function syncTaperedFieldControls() {
  const sel = selectedWindowOpening()
  const supports = Boolean(sel && openingSupportsPediment(sel.opening))
  if (!supports || !sel) return
  const field = normalizeOpeningTaperedField(sel.opening.taperedField)
  taperedFieldEnabled.checked = field.enabled
  taperedFieldOptions.hidden = !field.enabled
  taperedFieldCourses.value = String(field.courses ?? 3)
  taperedFieldOverhang.value = String(field.overhangCm ?? 8)
  taperedFieldRatio.value = String(field.topWidthRatio ?? 0.55)
  taperedFieldOffsetUp.value = String(field.offsetUpCm ?? 0)
  taperedFieldInvert.checked = Boolean(field.invert)
  for (const el of [
    taperedFieldCourses,
    taperedFieldOverhang,
    taperedFieldRatio,
    taperedFieldOffsetUp,
    taperedFieldInvert,
  ]) {
    el.disabled = !field.enabled
  }
}


function syncOpeningPositionControls() {
  const sel = selectedWindowOpening()
  if (!sel) return
  openingPosX.value = String(sel.opening.x)
  openingPosY.value = String(sel.opening.y)
  openingWidthInput.value = String(sel.opening.width)
  openingHeightInput.value = String(sel.opening.height)
  const stairsEnabledForDoor = sel.opening.type === 'door' && Boolean(sel.opening.stairs?.enabled)
  openingPosY.disabled = stairsEnabledForDoor
  openingPosY.readOnly = stairsEnabledForDoor

  const fill = normalizeOpeningFill(sel.opening.fill)
  const isCutout = sel.opening.type === 'cutout'
  const isConch = openingIsConch(sel.opening)
  const lacksChrome = openingLacksWindowChrome(sel.opening)
  openingTypeSection.hidden = isCutout
  openingTypeSelect.value =
    sel.opening.type === 'door' ? 'door' : sel.opening.type === 'conch' ? 'conch' : 'window'
  // Konche steuert Form über Kalotte — kein Cutout-Shape, Flush entfällt.
  const openingOpt = openingFillMode.querySelector<HTMLOptionElement>('option[value="opening"]')
  if (openingOpt) {
    openingOpt.textContent = isCutout ? 'Durchbruch' : isConch ? 'Konche' : 'Fenster / Tür'
    openingOpt.hidden = isConch
  }
  const flushOpt = openingFillMode.querySelector<HTMLOptionElement>('option[value="flush"]')
  if (flushOpt) flushOpt.hidden = lacksChrome
  const nicheOpt = openingFillMode.querySelector<HTMLOptionElement>('option[value="niche"]')
  if (nicheOpt) nicheOpt.textContent = isConch ? 'Kalotte (Nische)' : 'Nische'
  openingFillMode.value = isConch
    ? 'niche'
    : isCutout && fill.mode === 'flush'
      ? 'niche'
      : fill.mode
  openingFillMode.disabled = isConch
  openingNicheDepth.value = String(fill.nicheDepthCm ?? DEFAULT_NICHE_DEPTH_CM)
  openingNicheDepthRow.hidden = fill.mode !== 'niche' && !isConch
  openingCutoutShapeRow.hidden = !isCutout
  openingCutoutShape.value = sel.opening.cutoutShape === 'round' ? 'round' : 'rect'

  const reveal = normalizeRevealFrame(sel.opening.revealFrame)
  openingRevealFrameEnabled.checked = reveal.enabled
  openingRevealEmbed.value = String(reveal.embedCm ?? DEFAULT_REVEAL_EMBED_CM)
  openingRevealInset.value = String(reveal.insetCm ?? DEFAULT_REVEAL_INSET_CM)
  // Embed-/Inset-Zahlen bleiben in der Sidebar ausgeblendet (nur Checkbox sichtbar).
  openingRevealFrameOptions.hidden = true

  const clearance = normalizePanelClearance(sel.opening.panelClearance)
  openingPanelClearanceEnabled.checked = clearance.enabled
  openingPanelClearanceCm.value = String(clearance.cm ?? DEFAULT_PANEL_CLEARANCE_CM)
  const panelsOn = wallHasPanels(sel.wall)
  const autoClearanceDepth = panelsOn
    ? (sel.wall.panel?.projectDepth ?? DEFAULT_PANEL_CLEARANCE_DEPTH_CM)
    : DEFAULT_PANEL_CLEARANCE_DEPTH_CM
  openingPanelClearanceDepth.value = String(clearance.depthCm ?? autoClearanceDepth)
  openingPanelClearanceDepth.min = String(PANEL_CLEARANCE_DEPTH_MIN)
  openingPanelClearanceDepth.max = String(PANEL_CLEARANCE_DEPTH_MAX)
  openingPanelClearanceFinish.value = clearance.finish === 'taper' ? 'taper' : 'empty'
  openingPanelClearanceOptions.hidden = !clearance.enabled
  openingPanelClearanceFinish.hidden = !panelsOn
  openingPanelClearanceFinishLabel.hidden = !panelsOn

  const arch = normalizeOpeningArch(sel.opening.arch)
  const archForm = arch.form ?? 'rect'
  openingArchEnabled.checked = arch.enabled
  openingArchOptions.hidden = archForm !== 'round'
  openingArchRiseRow.hidden = archForm === 'rect'
  const resolvedRise = resolveArchRiseForOpening(
    archForm,
    sel.opening.width,
    sel.opening.height,
    arch.riseCm,
  )
  openingArchRise.step = String(ARCH_RISE_STEP_CM)
  openingArchRise.min = String(ARCH_RISE_STEP_CM)
  openingArchRise.max = String(Math.max(ARCH_RISE_STEP_CM, maxArchRiseForOpening(sel.opening.height)))
  openingArchRise.value = String(Math.round(resolvedRise) || ARCH_RISE_STEP_CM)
  openingArchRise.dataset.manual = arch.riseCm != null ? '1' : '0'
  openingArchRise.title =
    arch.riseCm != null
      ? 'Manuelles Stichmaß (8 cm)'
      : `Auto: ${Math.round(defaultArchRise(archForm, sel.opening.width) || 0)} cm (Form-Standard)`
  syncOpeningArchFormCards(archForm)
  const panel = sel.wall.panel ?? DEFAULT_STUDIO_PANEL
  const geom = openingArchGeom(sel.opening)
  const autoCount = geom ? archVoussoirCount(geom, panel.panelWidth) : 7
  const autoRing = archRingThickness(panel.panelHeight)
  const voussoirsOn = archForm === 'round' && Boolean(arch.voussoirs ?? arch.keystones)
  openingArchVoussoirs.checked = voussoirsOn
  openingArchVoussoirOpts.hidden = !voussoirsOn
  if (openingArchPreview) openingArchPreview.hidden = !voussoirsOn
  openingArchJambs.checked = Boolean(arch.jambs)
  openingArchJambOpts.hidden = !arch.jambs
  const autoJambCount = geom
    ? archJambCountAuto(archJambClearHeight(geom.cy, geom.y0, panel.joint ?? 0.8), panel.panelHeight)
    : 4
  openingArchJambCount.value = String(arch.jambCount ?? autoJambCount)
  openingArchJambCount.dataset.manual = arch.jambCount != null ? '1' : '0'
  openingArchJambCount.title =
    arch.jambCount == null ? `Auto: ${autoJambCount} (aus Steinhöhe)` : 'Manuell'
  openingArchCount.value = String(arch.keystoneCount ?? autoCount)
  openingArchCount.dataset.manual = arch.keystoneCount != null ? '1' : '0'
  openingArchCount.title =
    arch.keystoneCount == null ? `Auto: ${autoCount} (aus Steinbreite)` : 'Manuell'
  openingArchRing.value = String(arch.ringThicknessCm ?? autoRing)
  openingArchRing.dataset.manual = arch.ringThicknessCm != null ? '1' : '0'
  openingArchRing.title =
    arch.ringThicknessCm == null ? `Auto: ${autoRing} cm (aus Steinhöhe)` : 'Manuell'
  openingArchThetaStart.value = String(arch.thetaStartDeg ?? 180)
  openingArchThetaEnd.value = String(arch.thetaEndDeg ?? 0)
  openingArchSpandrel.value = arch.spandrel === 'rect' ? 'rect' : 'bond'
  drawOpeningArchPreview(sel)
}

function drawOpeningArchPreview(sel: { wall: Wall; opening: Opening }) {
  if (!openingArchPreview) return
  while (openingArchPreview.firstChild) openingArchPreview.removeChild(openingArchPreview.firstChild)
  const panel = sel.wall.panel ?? DEFAULT_STUDIO_PANEL
  const arch = normalizeOpeningArch(sel.opening.arch)
  if (!arch.enabled || !openingArchVoussoirsEnabled(sel.opening)) {
    openingArchPreview.hidden = true
    openingArchPreview.setAttribute('viewBox', '0 0 200 100')
    return
  }
  openingArchPreview.hidden = false
  const spec = buildSemicircularArchSpec(sel.opening, {
    panelWidth: panel.panelWidth,
    panelHeight: panel.panelHeight,
    joint: panel.joint ?? 0.8,
  })
  if (!spec) return
  const hybrid = openingArchHybridMasonryEnabled(sel.opening, panel.pattern)
  const { rowCuts } = visiblePanelRowRange(sel.wall.height, panel)
  const courseYs = hybrid
    ? archHybridCourseYs(rowCuts, spec.cy, spec.cy + spec.rOuter, panel.panelHeight)
    : undefined
  const svg = archVoussoirSvg(spec, {
    hybrid,
    courseYs,
    panelWidth: panel.panelWidth,
  })
  openingArchPreview.setAttribute('viewBox', svg.viewBox)
  const ns = 'http://www.w3.org/2000/svg'
  const cx = document.createElementNS(ns, 'circle')
  cx.setAttribute('cx', String(svg.center.x))
  cx.setAttribute('cy', String(svg.center.y))
  cx.setAttribute('r', '1.6')
  cx.setAttribute('fill', '#8a8178')
  openingArchPreview.appendChild(cx)
  for (const d of svg.radials) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#c4b8a8')
    path.setAttribute('stroke-width', '0.45')
    openingArchPreview.appendChild(path)
  }
  for (const d of svg.spandrels) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', '#efe8dc')
    path.setAttribute('stroke', '#8a8178')
    path.setAttribute('stroke-width', '0.55')
    openingArchPreview.appendChild(path)
  }
  for (const d of svg.jambs) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', '#e8e0d4')
    path.setAttribute('stroke', '#5a5248')
    path.setAttribute('stroke-width', '0.7')
    openingArchPreview.appendChild(path)
  }
  for (const d of svg.wedges) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', '#e8e0d4')
    path.setAttribute('stroke', '#5a5248')
    path.setAttribute('stroke-width', '0.8')
    openingArchPreview.appendChild(path)
  }
  for (const [d, stroke] of [
    [svg.intrados, '#2a6f9b'],
    [svg.extrados, '#8b4513'],
  ] as const) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', '1.4')
    openingArchPreview.appendChild(path)
  }
}

function syncDoorStairsControls() {
  const sel = selectedWindowOpening()
  const show = editor.selectedOpenings.length === 1 && Boolean(sel && sel.opening.type === 'door')
  const part = editor.selectedOpeningPart ?? 'group'
  doorStairsSection.hidden = !show || (part !== 'stairs' && part !== 'group')
  if (!show || !sel) {
    stairsOptions.hidden = true
    return
  }
  const stairs = { ...defaultOpeningStairs(sel.opening), ...sel.opening.stairs }
  stairsEnabled.checked = Boolean(stairs.enabled)
  stairsOptions.hidden = !stairs.enabled
  stairsCount.value = String(stairs.count)
  stairsRise.value = String(stairs.rise)
  stairsTread.value = String(stairs.tread)
  stairsLandingDepth.value = String(stairs.landingDepth ?? stairs.tread)
  stairsExtend.value = String(Math.max(stairs.extendLeft, stairs.extendRight))
  stairsSplay.value = String(Math.max(stairs.splayLeft, stairs.splayRight))
  const stairColor = stairs.color ?? sel.wall.wallColor ?? DEFAULT_WALL_COLOR
  renderColorSwatches(
    stairsColorSwatches,
    'wall',
    stairColor,
    (color) => commitStairPatch({ color }),
    previewSelectionColor((color) => updateOpeningStairs(state, scopedOpeningRefs(), { color })),
  )
  stairsFinishSelect.value =
    stairs.finish === 'glossy' || stairs.finish === 'metal' ? stairs.finish : 'matte'
}

let rollerShutterPhase: 'raise' | 'lower' = 'lower'

function rollerDropLabel(drop: number): string {
  if (drop <= 0.02) return 'Offen'
  if (drop >= 0.98) return 'Geschlossen'
  return `${Math.round(drop * 100)} %`
}

function syncRollerShutterControls() {
  const sel = selectedWindowOpening()
  const supports = Boolean(sel && openingSupportsRollerShutter(sel.opening))
  // Tab/Sektion immer bei Fenster/Tür — nur die Optionen hängen an der Checkbox.
  const show = editor.selectedOpenings.length >= 1 && supports
  openingRollerShutterSection.hidden = !show
  if (!show || !sel) {
    rollerShutterOptions.hidden = true
    return
  }
  const shutter = normalizeOpeningRollerShutter(sel.opening.rollerShutter)
  rollerShutterEnabled.checked = shutter.enabled
  rollerShutterOptions.hidden = !shutter.enabled
  if (!shutter.enabled) return

  const pct = Math.round(shutter.drop * 100)
  rollerShutterDrop.value = String(pct)
  rollerShutterDropPct.value = String(pct)
  rollerShutterDropLabel.textContent = rollerDropLabel(shutter.drop)
  rollerShutterFinish.value =
    shutter.finish === 'glossy' || shutter.finish === 'metal' ? shutter.finish : 'matte'
  rollerShutterSlatHeight.value = String(shutter.slatHeightCm ?? 5)
  rollerShutterGap.value = String(shutter.gapCm ?? 0.85)
  const curve = rollerShutterPhase === 'raise' ? shutter.motion!.raise : shutter.motion!.lower
  rollerShutterDuration.value = String(curve.durationMs)
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#roller-shutter-phase-group .preset-btn')) {
    btn.classList.toggle('active', btn.dataset.rollerPhase === rollerShutterPhase)
  }
  renderColorSwatches(
    rollerShutterColorSwatches,
    'profile',
    shutter.color ?? DEFAULT_ROLLER_COLOR,
    (color) => commitRollerShutterPatch({ color }),
    previewSelectionColor((color) =>
      updateOpeningRollerShutter(state, scopedOpeningRefs(), { color }),
    ),
  )
}

function commitRollerShutterPatch(
  patch: Parameters<typeof updateOpeningRollerShutter>[2],
  options?: { liveDrop?: boolean },
) {
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening && openingSupportsRollerShutter(opening)
  })
  if (refs.length === 0) return
  const next = updateOpeningRollerShutter(state, refs, patch)
  if (options?.liveDrop && typeof patch.drop === 'number') {
    for (const ref of refs) {
      facade.applyRollerShutterDrop(ref.wallId, ref.openingId, patch.drop)
    }
    previewState(next)
    syncRollerShutterControls()
    markViewportDirty()
    return
  }
  commitState(next)
}

function isBasementWindowOpening(opening: { type: string; basementWindow?: { enabled?: boolean } }): boolean {
  return opening.type === 'window' && Boolean(opening.basementWindow?.enabled)
}

function openingSupportsPediment(opening: { type: string; basementWindow?: { enabled?: boolean } }): boolean {
  if (opening.type === 'cutout') return false
  if (opening.type === 'window' && opening.basementWindow?.enabled) return false
  return opening.type === 'window' || opening.type === 'door' || opening.type === 'conch'
}

function activeSelectionToolbar(): HTMLElement | null {
  if (editor.selectedSceneLightId) return toolbarSceneLight
  if (editor.selectedOpenings.length > 0) return toolbarOpening
  if (editor.selectedCeiling) return document.querySelector<HTMLElement>('#toolbar-ceiling')
  if (editor.selectedRoofBuildingId) return document.querySelector<HTMLElement>('#toolbar-roof')
  if (selectionIsStudioWall()) return toolbarStudio
  if (editor.selectedWallIds.length > 0) return toolbarWall
  return null
}

function settingsSectionSkipsTab(section: HTMLElement): boolean {
  return (
    section.dataset.settingsInlineAll !== undefined || section.dataset.settingsNoTab !== undefined
  )
}

function settingsSectionVisibleForUi(section: HTMLElement): boolean {
  if (section.hidden) return false
  // Verschachtelte Sektionen (z. B. Bank in #window-sill-section) zählen nicht,
  // wenn ein Vorfahre per hidden ausgeblendet ist.
  let ancestor = section.parentElement
  while (ancestor) {
    if (ancestor.hidden) return false
    if (
      ancestor.id === 'toolbar-opening' ||
      ancestor.id === 'toolbar-studio' ||
      ancestor.id === 'toolbar-wall' ||
      ancestor.id === 'toolbar-roof' ||
      ancestor.id === 'toolbar-ceiling' ||
      ancestor.id === 'toolbar-scene-light' ||
      ancestor.id === 'lighting-accordion'
    ) {
      break
    }
    ancestor = ancestor.parentElement
  }
  if (!isAdvancedUi() && section.dataset.uiLevel === 'advanced') return false
  return true
}

function collectSelectionTabSections(toolbar: HTMLElement): HTMLElement[] {
  return [...toolbar.querySelectorAll<HTMLElement>('.settings-section')]
    .filter(
      (section) =>
        settingsSectionVisibleForUi(section) &&
        section.dataset.settingsSection &&
        !settingsSectionSkipsTab(section),
    )
    .sort(
      (a, b) =>
        Number(a.dataset.settingsOrder ?? 999) - Number(b.dataset.settingsOrder ?? 999),
    )
}

function applySelectionToolbarTabFilter(toolbar: HTMLElement | null) {
  if (!toolbar) return
  for (const section of toolbar.querySelectorAll<HTMLElement>('.settings-section')) {
    if (!settingsSectionVisibleForUi(section)) {
      section.classList.remove('selection-tab-filtered-out')
      continue
    }
    let show: boolean
    if (section.dataset.settingsInlineAll !== undefined) {
      show = true
    } else {
      const id = section.dataset.settingsSection
      show = Boolean(id && selectionToolbarTab === id)
    }
    section.classList.toggle('selection-tab-filtered-out', !show)
  }
}

function syncBottomBarMode(_showSelectionOptions: boolean) {
  // Untere Leiste bleibt immer die Element-Bibliothek
  libraryModeEl.hidden = false
  openingLibraryEl.setAttribute('aria-label', 'Bibliothek')
}

function syncSelectionToolbarTabs() {
  const toolbar = activeSelectionToolbar()
  const kind = toolbar?.id ?? ''
  if (kind !== selectionToolbarKind) {
    selectionToolbarKind = kind
    if (!selectionToolbarTabLocked) {
      selectionToolbarTab = pendingSelectionToolbarTab ?? ''
      pendingSelectionToolbarTab = null
    }
  } else if (pendingSelectionToolbarTab) {
    selectionToolbarTab = pendingSelectionToolbarTab
    pendingSelectionToolbarTab = null
  }
  selectionRightTabs.replaceChildren()

  const showSelectionOptions = Boolean(toolbar && !toolbar.hidden)
  syncBottomBarMode(showSelectionOptions)

  if (!showSelectionOptions || !toolbar) {
    applySelectionToolbarTabFilter(null)
    return
  }

  const tabSections = collectSelectionTabSections(toolbar)
  const orderedIds: string[] = []
  const labels = new Map<string, string>()
  for (const section of tabSections) {
    const id = section.dataset.settingsSection!
    if (labels.has(id)) continue
    labels.set(id, section.dataset.settingsLabel ?? id)
    orderedIds.push(id)
  }

  if (orderedIds.length === 0) {
    selectionToolbarTab = ''
    applySelectionToolbarTabFilter(toolbar)
    return
  }

  if (!selectionToolbarTab || !labels.has(selectionToolbarTab)) {
    selectionToolbarTab = orderedIds[0]!
  }

  for (const id of orderedIds) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `selection-tab-btn${selectionToolbarTab === id ? ' active' : ''}`
    btn.setAttribute('role', 'tab')
    btn.setAttribute('aria-selected', selectionToolbarTab === id ? 'true' : 'false')
    btn.dataset.settingsTab = id
    btn.textContent = labels.get(id) ?? id
    btn.addEventListener('click', () => {
      selectionToolbarTab = id
      syncSelectionToolbarTabs()
    })
    selectionRightTabs.appendChild(btn)
  }
  applySelectionToolbarTabFilter(toolbar)
  const wall = anchorWall()
  if (wall && selectionIsStudioWall()) {
    syncStudioPanelColorControls(wall)
  }
}

function syncStudioPanelColorControls(wall: Wall) {
  const panel = wall.panel
  if (!panel) return
  renderColorSwatches(
    jointColorSwatchesStudio,
    'wall',
    activeJointColor(),
    (color) => {
      commitStudioPanelPatch({ jointColor: color })
    },
    previewPanelPatch((color) => ({ jointColor: color })),
  )
}

function applySceneToolbarTabFilter() {
  if (!sceneToolbarPanels) return
  for (const section of sceneToolbarPanels.querySelectorAll<HTMLElement>('.settings-section')) {
    if (!settingsSectionVisibleForUi(section)) {
      section.classList.remove('selection-tab-filtered-out')
      continue
    }
    let show: boolean
    if (section.dataset.settingsInlineAll !== undefined) {
      show = sceneToolbarTab === 'all'
    } else if (sceneToolbarTab === 'all') {
      show = true
    } else {
      const id = section.dataset.settingsSection
      show = !id || sceneToolbarTab === id
    }
    section.classList.toggle('selection-tab-filtered-out', !show)
  }
}

function syncSceneToolbarTabs() {
  if (!sceneToolbarTabs || !sceneToolbarPanels) return
  sceneToolbarTabs.replaceChildren()
  if (lightingAccordion.hidden) {
    sceneToolbarTabs.hidden = true
    applySceneToolbarTabFilter()
    return
  }
  sceneToolbarTabs.hidden = false

  const allBtn = document.createElement('button')
  allBtn.type = 'button'
  allBtn.className = `selection-tab-btn${sceneToolbarTab === 'all' ? ' active' : ''}`
  allBtn.textContent = 'Übersicht'
  allBtn.addEventListener('click', () => {
    sceneToolbarTab = 'all'
    syncSceneToolbarTabs()
  })
  sceneToolbarTabs.appendChild(allBtn)

  const tabSections = [...sceneToolbarPanels.querySelectorAll<HTMLElement>('.settings-section')]
    .filter(
      (section) =>
        settingsSectionVisibleForUi(section) &&
        section.dataset.settingsSection &&
        !settingsSectionSkipsTab(section),
    )
    .sort(
      (a, b) =>
        Number(a.dataset.settingsOrder ?? 999) - Number(b.dataset.settingsOrder ?? 999),
    )

  const seen = new Set<string>()
  for (const section of tabSections) {
    const id = section.dataset.settingsSection!
    if (seen.has(id)) continue
    seen.add(id)
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `selection-tab-btn${sceneToolbarTab === id ? ' active' : ''}`
    btn.textContent = section.dataset.settingsLabel ?? id
    btn.addEventListener('click', () => {
      sceneToolbarTab = id
      syncSceneToolbarTabs()
    })
    sceneToolbarTabs.appendChild(btn)
  }
  if (sceneToolbarTab !== 'all' && !seen.has(sceneToolbarTab)) {
    sceneToolbarTab = 'all'
    syncSceneToolbarTabs()
    return
  }
  applySceneToolbarTabFilter()
}

/** Toolbar-Blöcke je nach gewähltem Opening-Teil ein-/ausblenden. */
function applyOpeningPartVisibility() {
  const part = editor.selectedOpeningPart ?? 'group'
  const sel = selectedWindowOpening()
  const isWindow = sel?.opening.type === 'window' || Boolean(sel && openingActsAsWindow(sel.opening))
  const isDoor = sel?.opening.type === 'door'
  const lacksChrome = Boolean(sel && openingLacksWindowChrome(sel.opening))
  const isConch = Boolean(sel && openingIsConch(sel.opening))
  const hideFrameChrome = lacksChrome || isConch
  const isBasement = Boolean(sel && isBasementWindowOpening(sel.opening))
  const focusPart = part !== 'group'
  const showFrame = !hideFrameChrome && (part === 'group' || part === 'frame' || part === 'grille')
  const showTrim = !isBasement && !lacksChrome && (part === 'group' || part === 'trim')
  let showSillInner = !isBasement && (part === 'group' || part === 'sillInner')
  let showSillOuter = !isBasement && (part === 'group' || part === 'sillOuter')
  let showPediment = !isBasement && (part === 'group' || part === 'pediment')
  let showConsoles = !isBasement && (part === 'group' || part === 'pediment' || part === 'consoles')
  let showStairs = isDoor && (part === 'group' || part === 'stairs')

  // Bänke nur bei Fenstern; Verdachung/Konsolen bei Fenster und Tür.
  if (!isWindow) {
    showSillInner = false
    showSillOuter = false
    if (part === 'sillInner' || part === 'sillOuter') {
      editor.selectedOpeningPart = 'group'
    }
  } else if (isBasement) {
    showSillInner = false
    showSillOuter = false
    showPediment = false
    showConsoles = false
    if (part === 'sillInner' || part === 'sillOuter' || part === 'pediment' || part === 'consoles' || part === 'trim') {
      editor.selectedOpeningPart = 'group'
    }
  }
  if (!isDoor) {
    showStairs = false
    if (part === 'stairs') {
      editor.selectedOpeningPart = 'group'
    }
  }

  const supportsPediment = Boolean(sel && openingSupportsPediment(sel.opening))
  if (!supportsPediment) {
    showPediment = false
    showConsoles = false
  }

  const showSills = isWindow && !isBasement && (showSillInner || showSillOuter)

  if (!showFrame || hideFrameChrome) {
    windowStyleSection.hidden = true
    const styleAcc = document.querySelector<HTMLElement>('#window-style-accordion')
    if (styleAcc) styleAcc.hidden = true
    if (!isBasement) {
      frameColorSection.hidden = true
      glassColorSection.hidden = true
      if (openingModelSelect.parentElement) openingModelSelect.parentElement.hidden = true
    }
  } else {
    const styleAcc = document.querySelector<HTMLElement>('#window-style-accordion')
    if (styleAcc && !windowStyleSection.hidden) styleAcc.hidden = false
    if (isBasement) {
      frameColorSection.hidden = false
      glassColorSection.hidden = false
      if (openingModelSelect.parentElement) openingModelSelect.parentElement.hidden = false
    }
  }

  const profileAssign = document.querySelector<HTMLElement>('#profile-assign-section')
  if (profileAssign) profileAssign.hidden = !showTrim
  if (!showTrim) {
    profileEdgeSection.hidden = true
    profileTrimSection.hidden = true
  } else {
    // Nach Teil-Fokus wieder anzeigen; Trim nur wenn Fensterprofil aktiv
    syncProfileEdgeButtons()
    syncProfileTrimControls()
  }

  const sillInnerAcc = document.querySelector<HTMLElement>('#sill-inner-accordion')
  const sillOuterAcc = document.querySelector<HTMLElement>('#sill-outer-accordion')
  const pedimentSection = document.querySelector<HTMLElement>('#opening-pediment-section')
  const consolesSection = document.querySelector<HTMLElement>('#opening-consoles-section')
  if (!isWindow || isBasement) {
    windowSillSection.hidden = true
  } else if (part === 'sillInner') {
    windowSillSection.hidden = false
    if (sillInnerAcc) sillInnerAcc.hidden = false
    if (sillOuterAcc) sillOuterAcc.hidden = true
  } else if (part === 'sillOuter') {
    windowSillSection.hidden = false
    if (sillInnerAcc) sillInnerAcc.hidden = true
    if (sillOuterAcc) sillOuterAcc.hidden = false
  } else if (showSills) {
    if (sillInnerAcc) sillInnerAcc.hidden = !showSillInner
    if (sillOuterAcc) sillOuterAcc.hidden = !showSillOuter
    windowSillSection.hidden = false
  } else {
    windowSillSection.hidden = true
  }

  if (pedimentSection) pedimentSection.hidden = !supportsPediment || !showPediment
  if (consolesSection) consolesSection.hidden = !supportsPediment || !showConsoles

  const taperedFieldSection = document.querySelector<HTMLElement>('#opening-tapered-field-section')
  if (taperedFieldSection) taperedFieldSection.hidden = !supportsPediment || !showPediment

  if (!isDoor || !showStairs) doorStairsSection.hidden = true
  else doorStairsSection.hidden = false

  const supportsShutter = Boolean(sel && openingSupportsRollerShutter(sel.opening))
  // Reiter immer sichtbar bei unterstützter Öffnung; Fokus auf anderem Teil blendet ihn nicht aus.
  openingRollerShutterSection.hidden = !supportsShutter || Boolean(lacksChrome)

  const measuresSection = document.querySelector<HTMLElement>('#opening-measures-section')
  if (measuresSection) measuresSection.hidden = focusPart
  const actionsSection = document.querySelector<HTMLElement>('#opening-actions-section')
  if (actionsSection) actionsSection.hidden = focusPart

  // Fenstergitter-Checkbox bei jedem Fenster; Gitterhöhe nur wenn aktiv (Default: nur Kellerfenster an)
  const showBasementToggle = isWindow && !lacksChrome && !isConch && (!focusPart || part === 'grille')
  windowBasementRow.hidden = !showBasementToggle
  windowBasementGrilleOptions.hidden = !showBasementToggle || !isBasement

  const revealSection = document.querySelector<HTMLElement>('#opening-reveal-frame-section')
  const archSection = document.querySelector<HTMLElement>('#opening-arch-section')
  const fillSection = document.querySelector<HTMLElement>('#opening-fill-section')
  if (revealSection) revealSection.hidden = Boolean(lacksChrome)
  // Konche erzwingt Rundbogen-Maske — Form-UI ausblenden
  if (archSection) archSection.hidden = Boolean(lacksChrome)
  if (fillSection) fillSection.hidden = false
  openingTypeSection.hidden = focusPart
  if (lacksChrome || isConch) {
    windowStyleSection.hidden = true
    const styleAcc = document.querySelector<HTMLElement>('#window-style-accordion')
    if (styleAcc) styleAcc.hidden = true
    frameColorSection.hidden = true
    glassColorSection.hidden = true
    if (openingModelSelect.parentElement) openingModelSelect.parentElement.hidden = true
    windowSillSection.hidden = true
    doorStairsSection.hidden = true
    openingRollerShutterSection.hidden = true
    windowBasementRow.hidden = true
    windowBasementGrilleOptions.hidden = true
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
  }

  const motionSection = document.querySelector<HTMLElement>('#opening-motion-section')
  if (motionSection) {
    motionSection.hidden =
      lacksChrome || isConch || (!isWindow && !isDoor) || (focusPart && part !== 'frame')
  }

  const colorsSection = document.querySelector<HTMLElement>('#opening-colors-section')
  if (colorsSection) {
    const showColors =
      !focusPart || part === 'frame' || part === 'grille' || part === 'trim'
    colorsSection.hidden = !showColors || Boolean(lacksChrome && part !== 'group')
  }
  const frameFinishSection = document.querySelector<HTMLElement>('#frame-finish-section')
  if (frameFinishSection) {
    frameFinishSection.hidden =
      Boolean(lacksChrome) ||
      Boolean(isBasement) ||
      (focusPart && part !== 'frame' && part !== 'grille')
  }
  const styleSection = document.querySelector<HTMLElement>('#window-style-accordion')
  if (styleSection && focusPart && part !== 'frame') {
    styleSection.hidden = true
    windowStyleSection.hidden = true
  }
  if (profileAssign && focusPart && part !== 'trim') {
    profileAssign.hidden = true
  }
  if (focusPart && part === 'stairs') {
    if (colorsSection) colorsSection.hidden = true
    if (motionSection) motionSection.hidden = true
    if (styleSection) styleSection.hidden = true
    if (profileAssign) profileAssign.hidden = true
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
    windowSillSection.hidden = true
  }
  if (focusPart && part === 'rollerShutter') {
    if (colorsSection) colorsSection.hidden = true
    if (motionSection) motionSection.hidden = true
    if (styleSection) styleSection.hidden = true
    if (profileAssign) profileAssign.hidden = true
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
    windowSillSection.hidden = true
    doorStairsSection.hidden = true
    openingRollerShutterSection.hidden = !supportsShutter
  }
  if (focusPart && (part === 'sillInner' || part === 'sillOuter')) {
    if (colorsSection) colorsSection.hidden = true
    if (motionSection) motionSection.hidden = true
    if (styleSection) styleSection.hidden = true
    if (profileAssign) profileAssign.hidden = true
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
    doorStairsSection.hidden = true
  }
  if (focusPart && (part === 'pediment' || part === 'consoles')) {
    if (colorsSection) colorsSection.hidden = true
    if (motionSection) motionSection.hidden = true
    if (styleSection) styleSection.hidden = true
    if (profileAssign) profileAssign.hidden = true
    windowSillSection.hidden = true
    doorStairsSection.hidden = true
    if (part === 'pediment' && consolesSection) consolesSection.hidden = true
    if (part === 'consoles' && pedimentSection) pedimentSection.hidden = true
  }
  if (focusPart && part === 'trim') {
    if (motionSection) motionSection.hidden = true
    if (styleSection) styleSection.hidden = true
    windowSillSection.hidden = true
    doorStairsSection.hidden = true
    if (pedimentSection) pedimentSection.hidden = true
    if (consolesSection) consolesSection.hidden = true
    // Farben-Hub: nur Profilfarbe sinnvoll
    if (frameColorSection) frameColorSection.hidden = true
    if (glassColorSection) glassColorSection.hidden = true
    if (frameFinishSection) frameFinishSection.hidden = true
  }
}

function applyWallPartVisibility() {
  const hasOpening = editor.selectedOpenings.length > 0
  if (hasOpening) return

  const part = editor.selectedWallPart ?? 'group'
  const focusPart = part !== 'group' && part !== 'cladding'
  const toolbar = document.querySelector<HTMLElement>('#toolbar-studio')
  if (!toolbar) return

  const sections = toolbar.querySelectorAll<HTMLElement>('.settings-section[data-settings-section]')
  for (const section of sections) {
    const id = section.dataset.settingsSection
    if (!id) continue
    if (!focusPart) {
      section.hidden = false
      continue
    }
    // Nur der zum Teil gehörige Reiter bleibt sichtbar.
    if (part === 'cornice') section.hidden = id !== 'cornice'
    else if (part === 'trimBand') section.hidden = id !== 'trimBands'
    else if (part === 'plinth') section.hidden = id !== 'plinth'
    else if (part === 'label') section.hidden = id !== 'label'
    else section.hidden = false
  }

  // Maße nur bei Ganz-Wand-Auswahl.
  const dims = toolbar.querySelector<HTMLElement>('[data-settings-section="dimensions"]')
  if (dims) dims.hidden = focusPart
  const colors = toolbar.querySelector<HTMLElement>('[data-settings-section="colors"]')
  if (colors) {
    colors.hidden = focusPart && part !== 'label'
  }
}

function nudgeSelectedOpenings(dx: number, dy: number) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    next = moveOpening(next, ref.wallId, ref.openingId, dx, dy, { mode: 'nudge' })
  }
  commitState(next)
}

function commitStairPatch(patch: Parameters<typeof updateOpeningStairs>[2]) {
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.type === 'door'
  })
  if (refs.length === 0) return
  commitState(updateOpeningStairs(state, refs, patch))
}

function sillOuterValueForSelection(
  field: 'rotationDeg' | 'flipOutward' | 'flipForward' | 'cornerJoin',
): string | number | boolean {
  const values = scopedOpeningRefs().map((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.sillOuter?.[field]
  })
  const first = values[0]
  const same = values.length > 0 && values.every((value) => value === first)
  if (!same || first === undefined) {
    if (field === 'cornerJoin') return 'miter'
    if (field === 'flipOutward' || field === 'flipForward') return false
    return 0
  }
  return first
}

function drawSillOuterSectionPreview() {
  const sel = selectedWindowOpening()
  const outer = sel?.opening.sillOuter
    ? normalizeOpeningSillOuter(sel.opening.sillOuter)
    : null
  const profileId = outer?.profileId ?? 'fensterprofil32x120'
  if (!outer || !outerSillUsesProfile(outer)) return
  drawSectionPreview(
    sillOuterSectionPreview,
    profileId,
    {
      rotationDeg: Number(sillOuterValueForSelection('rotationDeg')) || 0,
      flipOutward: Boolean(sillOuterValueForSelection('flipOutward')),
      flipForward: Boolean(sillOuterValueForSelection('flipForward')),
    },
    sel?.opening.sillOuter?.color ?? activeTrimColor(),
    false,
  )
}

function syncProfileSelect() {
  rebuildFrameProfileCards()
}

function syncProfileEdgeButtons() {
  const show = editor.selectedOpenings.length > 0 && selectedOpeningHasFrameProfile()
  profileEdgeSection.hidden = !show

  for (const button of profileEdgeButtons) {
    const edge = button.dataset.edge as OpeningEdge
    button.classList.toggle('active', editor.selectedEdges.includes(edge))
  }
}

function selectedOpeningHasFrameProfile(): boolean {
  return editor.selectedOpenings.some((ref) => {
    const wall = getWall(state, ref.wallId)
    if (!wall) return false
    const profileId = openingProfileId(wall, ref.openingId)
    return profileId !== null && isFrameProfile(profileId)
  })
}

function syncProfileTrimControls() {
  const show = selectedOpeningHasFrameProfile()
  profileTrimSection.hidden = !show
  if (!show) return

  profileCornerJoinSelect.value = String(trimValueForSelection('cornerJoin'))
  profileScaleInput.value = String(trimValueForSelection('scale') || 1)
  const extentOut = trimValueForSelection('extentOutCm')
  const extentFwd = trimValueForSelection('extentForwardCm')
  const measured = measuredFrameProfileExtents()
  profileExtentOutInput.value =
    extentOut != null && Number(extentOut) > 0 ? String(extentOut) : ''
  profileExtentForwardInput.value =
    extentFwd != null && Number(extentFwd) > 0 ? String(extentFwd) : ''
  profileExtentOutInput.placeholder = measured ? String(roundCm(measured.outward)) : 'auto'
  profileExtentForwardInput.placeholder = measured ? String(roundCm(measured.forward)) : 'auto'
  profileOffsetXInput.value = String(trimValueForSelection('offsetX'))
  profileOffsetYInput.value = String(trimValueForSelection('offsetY'))
  profileOffsetForwardInput.value = String(trimValueForSelection('offsetForward'))
  profileFlipOutwardButton.classList.toggle('active', Boolean(trimValueForSelection('flipOutward')))
  profileFlipForwardButton.classList.toggle('active', Boolean(trimValueForSelection('flipForward')))
  renderColorSwatches(
    trimColorSwatches,
    'profile',
    activeTrimColor(),
    (color) => {
      commitOpeningTrim({ color })
    },
    previewSelectionColor((color) => updateOpeningTrim(state, scopedOpeningRefs(), { color })),
  )
  const trimFinish = trimValueForSelection('finish')
  openingTrimFinishSelect.value =
    trimFinish === 'glossy' || trimFinish === 'metal' || trimFinish === 'matte'
      ? String(trimFinish)
      : (() => {
          const wall = selectedWindowOpening()?.wall
          const f = wall?.profileFinish
          return f === 'glossy' || f === 'metal' ? f : 'matte'
        })()
  drawProfileSectionPreview()
  syncOpeningColorsHub()
}

function roundCm(value: number): number {
  return Math.round(value * 10) / 10
}

/** Effektive Querschnitt-Maße des Rahmenprofils (nach Scale/Extent), für Placeholder und Lift. */
function measuredFrameProfileExtents(): { outward: number; forward: number } | null {
  const ref = editor.selectedOpenings[0]
  if (!ref) return null
  const wall = getWall(state, ref.wallId)
  const opening = wall?.openings.find((item) => item.id === ref.openingId)
  if (!wall || !opening) return null
  const assignment = wall.profiles.find(
    (item) => item.openingId === opening.id && item.edge === 'top',
  ) ?? wall.profiles.find((item) => item.openingId === opening.id)
  if (!assignment) return null
  const profile = resolveProfile(assignment.profileId, state.customProfiles)
  if (!profile?.section?.length) return null
  const scales = trimSectionScales(opening.trim, profile.section)
  return {
    outward: profileSectionNativeExtents(profile.section).outward * scales.outward,
    forward: profileSectionNativeExtents(profile.section).forward * scales.forward,
  }
}

function syncOpeningColorsHub() {
  if (editor.selectedOpenings.length === 0) return

  const sel = selectedWindowOpening()
  openingFrameFinishSelect.value = (() => {
    const finish = sel?.opening.frameFinish
    return finish === 'glossy' || finish === 'metal' ? finish : 'matte'
  })()

  const showTrim = selectedOpeningHasFrameProfile()
  trimColorHubSection.hidden = !showTrim
  if (showTrim) {
    renderColorSwatches(
      trimColorSwatchesHub,
      'profile',
      activeTrimColor(),
      (color) => {
        commitOpeningTrim({ color })
      },
      previewSelectionColor((color) => updateOpeningTrim(state, scopedOpeningRefs(), { color })),
    )
  }

  const showSillOuter = Boolean(
    sel && openingActsAsWindow(sel.opening) && !isBasementWindowOpening(sel.opening) && sel.opening.y > 0,
  )
  sillOuterColorHubSection.hidden = !showSillOuter
  if (showSillOuter && sel) {
    const outer = normalizeOpeningSillOuter(sel.opening.sillOuter)
    renderColorSwatches(
      sillOuterColorSwatchesHub,
      'profile',
      outer.color ?? activeTrimColor(),
      (color) => {
        commitOpeningSillPatch({ outer: { color } })
      },
      previewSelectionColor((color) =>
        updateOpeningSills(state, scopedOpeningRefs(), { outer: { color } }),
      ),
    )
  }

  const supportsPediment = Boolean(sel && openingSupportsPediment(sel.opening))
  const pediment = sel ? normalizeOpeningPediment(sel.opening.pediment) : null
  const showPedimentColor = supportsPediment && Boolean(pediment?.enabled)
  pedimentColorHubSection.hidden = !showPedimentColor
  if (showPedimentColor) {
    renderColorSwatches(
      pedimentColorSwatchesHub,
      'profile',
      pediment!.color ?? activeTrimColor(),
      (color) => {
        commitOpeningPedimentPatch({ color })
      },
      previewSelectionColor((color) =>
        updateOpeningPediment(state, scopedOpeningRefs(), { color }),
      ),
    )
  }

  syncRevealColorSwatches(true)
}

function selectedWindowRefsFromEditor() {
  return scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.type === 'window' || opening?.type === 'door'
  })
}

function commitGruenderzeitPatch(patch: Partial<GruenderzeitWindowConfig>) {
  const refs = selectedWindowRefsFromEditor()
  if (refs.length === 0) return
  commitState(updateOpeningGruenderzeit(state, refs, patch))
}

function leafOpenLabel(leaf: { region: 'sash' | 'transom'; index: number; hinge: 'left' | 'right' }, casements: number) {
  if (leaf.region === 'transom') {
    return casements === 1 ? 'Oberlicht' : `OL ${leaf.hinge === 'left' ? 'L' : 'R'}`
  }
  if (casements === 1) return 'Flügel'
  if (leaf.index === 0) return 'Flügel L'
  if (leaf.index === casements - 1) return 'Flügel R'
  return `Flügel ${leaf.index + 1}`
}

let windowOpenDragBase: FacadeState | null = null

function syncWindowOpenControls(
  opening: Pick<Opening, 'width' | 'height' | 'type' | 'glazingArch' | 'arch'>,
  config: GruenderzeitWindowConfig,
) {
  const layout = layoutGruenderzeitWindow(
    opening.width,
    opening.height,
    config,
    openingGlazingArchForm(opening),
    normalizeOpeningArch(opening.arch).riseCm,
  )
  const key = layout.leaves.map((leaf) => `${leaf.region}-${leaf.index}`).join('|')
  if (windowOpenGroup.dataset.key !== key) {
    windowOpenGroup.dataset.key = key
    windowOpenGroup.replaceChildren()
    for (const leaf of layout.leaves) {
      const row = document.createElement('label')
      const title = document.createElement('span')
      title.textContent = leafOpenLabel(leaf, config.casements)
      const input = document.createElement('input')
      input.type = 'range'
      input.min = '0'
      input.max = '80'
      input.step = '1'
      input.dataset.region = leaf.region
      input.dataset.index = String(leaf.index)
      input.value = String(Math.round(leaf.openDeg))
      const output = document.createElement('output')
      output.textContent = `${Math.round(leaf.openDeg)}°`
      const applyDeg = (deg: number, commit: boolean) => {
        const refs = selectedWindowRefsFromEditor()
        if (refs.length === 0) return
        const base = windowOpenDragBase ?? state
        const baseWall = getWall(base, refs[0].wallId)
        const baseOpening = baseWall?.openings.find((item) => item.id === refs[0].openingId)
        if (!baseOpening) return
        const current = gruenderzeitConfigForOpening(baseOpening)
        const leafOpenDeg = [...(current.leafOpenDeg ?? [])]
        const transomOpenDeg = [...(current.transomOpenDeg ?? [])]
        if (leaf.region === 'transom') transomOpenDeg[leaf.index] = deg
        else leafOpenDeg[leaf.index] = deg
        const next = updateOpeningGruenderzeit(base, refs, { leafOpenDeg, transomOpenDeg })
        if (commit) {
          state = base
          commitState(next)
          windowOpenDragBase = null
        } else {
          previewState(next)
        }
      }
      input.addEventListener('pointerdown', () => {
        stopOpeningMotionPlayback(false)
        windowOpenDragBase = cloneFacadeState(state)
      })
      input.addEventListener('input', () => {
        output.textContent = `${input.value}°`
        applyDeg(Number(input.value), false)
      })
      input.addEventListener('change', () => {
        applyDeg(Number(input.value), true)
      })
      row.append(title, input, output)
      windowOpenGroup.appendChild(row)
    }
    return
  }

  for (const input of windowOpenGroup.querySelectorAll('input')) {
    const region = input.dataset.region
    const index = Number(input.dataset.index)
    const leaf = layout.leaves.find((item) => item.region === region && item.index === index)
    if (!leaf || document.activeElement === input) continue
    input.value = String(Math.round(leaf.openDeg))
    const output = input.parentElement?.querySelector('output')
    if (output) output.textContent = `${Math.round(leaf.openDeg)}°`
  }
}

function syncBasementWindowStyleUi(isBasement: boolean) {
  const casement3 = document.querySelector<HTMLElement>('#window-casement-group [data-casements="3"]')
  if (casement3) casement3.hidden = isBasement
  const transomLabel = windowTransomInput.closest('label')
  if (transomLabel) transomLabel.hidden = isBasement
  if (isBasement) windowTransomOptions.hidden = true
  const splitVSection = windowSplitVCountButtons[0]?.closest('.toolbar-group')
  const splitHSection = windowSplitHCountButtons[0]?.closest('.toolbar-group')
  if (splitVSection) splitVSection.hidden = isBasement
  if (splitHSection) splitHSection.hidden = isBasement
  const guardSection = document.querySelector<HTMLElement>('#window-guard-section')
  if (guardSection) guardSection.hidden = isBasement
  for (const opt of windowPresetSelect.options) {
    const preset = WINDOW_STYLE_PRESETS[opt.value as keyof typeof WINDOW_STYLE_PRESETS]
    opt.hidden =
      isBasement &&
      Boolean(preset && (preset.transom || preset.bottomPanel || preset.casements > 2))
  }
  for (const button of windowMuntinVButtons) {
    button.hidden = isBasement && Number(button.dataset.muntinV) > 1
  }
  for (const button of windowMuntinHButtons) {
    button.hidden = isBasement && Number(button.dataset.muntinH) > 1
  }
}

function syncWindowStyleSection() {
  const refs = selectedWindowRefsFromEditor()
  const accordion = document.querySelector<HTMLElement>('#window-style-accordion')
  windowStyleSection.hidden = refs.length === 0
  if (accordion) accordion.hidden = refs.length === 0
  windowBasementRow.hidden = true
  windowBasementGrilleOptions.hidden = true
  if (refs.length === 0) return
  const wall = getWall(state, refs[0].wallId)
  const opening = wall?.openings.find((item) => item.id === refs[0].openingId)
  if (!opening) {
    windowStyleSection.hidden = true
    if (accordion) accordion.hidden = true
    return
  }
  const isBasement = isBasementWindowOpening(opening)
  // Bei jedem Fenster: Keller mit Stabgitter an-/ausschalten; Höhe nur wenn aktiv
  windowBasementRow.hidden = opening.type !== 'window'
  windowBasementEnabled.checked = isBasement
  windowBasementGrilleOptions.hidden = opening.type !== 'window' || !isBasement
  if (isBasement) {
    const pct = Math.round((opening.basementWindow?.grilleHeight ?? 0.5) * 100)
    windowBasementGrilleHeight.value = String(pct)
    windowBasementGrilleHeightOut.textContent = `${pct} %`
  }
  syncBasementWindowStyleUi(isBasement)
  const config = gruenderzeitConfigForOpening(opening)
  const timber = resolveTimber(config.timber)
  const preset = detectWindowPreset(config)
  windowBoxInput.checked = Boolean(config.boxWindow)
  windowBoxOptions.hidden = !config.boxWindow
  windowInnerFrameColor.value =
    config.innerFrameColor ?? opening.frameColor ?? defaultOpeningFrameColor(opening.type)
  windowProfiledBars.checked = Boolean(config.profiledBars)
  windowHardware.checked = Boolean(config.hardware)
  windowTimberBlend.value = String(timber.blend)
  windowTimberSash.value = String(timber.sash)
  windowTimberMuntin.value = String(timber.muntin)
  windowTimberKaempfer.value = String(timber.kaempfer)
  windowTimberStulp.value = String(timber.stulp)
  syncWindowHingeModeList(config)
  const guard = opening.guard
  windowGuardEnabled.checked = Boolean(guard?.enabled)
  windowGuardOptions.hidden = !guard?.enabled
  windowGuardMode.value = guard?.mode === 'balcony' ? 'balcony' : 'grille'
  windowGuardSpacing.value = String(guard?.barSpacingCm ?? 12)
  windowGuardHeight.value = String(guard?.heightCm ?? 96)
  const shade = opening.interiorShade
  windowShadeEnabled.checked = Boolean(shade?.enabled)
  windowShadeOptions.hidden = !shade?.enabled
  windowShadeMode.value = shade?.mode === 'blind' ? 'blind' : 'curtain'
  windowShadeDrop.value = String(Math.round((shade?.drop ?? 0) * 100))
  const isDoor = opening.type === 'door'
  windowDoorExtras.hidden = !isDoor
  if (isDoor) {
    windowDoorCassettes.value = String(opening.door?.cassetteCount ?? 2)
    windowDoorHandle.checked = opening.door?.handle !== false
    windowDoorLetter.checked = Boolean(opening.door?.letterSlot)
  }
  windowTransomInput.checked = config.transom
  windowTransomOptions.hidden = !config.transom
  windowTransomRatioInput.value = String(Math.round(config.transomRatio * 100))
  windowPresetSelect.value = preset
  for (const button of windowCasementButtons) {
    button.classList.toggle('active', Number(button.dataset.casements) === config.casements)
  }
  for (const button of windowTransomBarsButtons) {
    button.classList.toggle('active', button.dataset.transomBars === config.transomBars)
  }
  const paneCount = paneCountForSplit(config.splitVCount, config.splitHCount)
  windowPaneSelection = windowPaneSelection.filter((i) => i >= 0 && i < paneCount)
  for (const button of windowSplitVCountButtons) {
    button.classList.toggle('active', Number(button.dataset.splitVCount) === config.splitVCount)
  }
  for (const button of windowSplitHCountButtons) {
    button.classList.toggle('active', Number(button.dataset.splitHCount) === config.splitHCount)
  }
  windowSplitVRatioGroup.hidden = config.splitVCount !== 2
  windowSplitHRatioGroup.hidden = config.splitHCount !== 2
  for (const button of windowSplitVRatioButtons) {
    button.classList.toggle('active', button.dataset.splitVRatio === config.splitVRatio)
  }
  for (const button of windowSplitHRatioButtons) {
    button.classList.toggle('active', button.dataset.splitHRatio === config.splitHRatio)
  }
  windowPanelSection.hidden = !isDoor
  if (isDoor) {
    windowBottomPanelInput.checked = Boolean(config.bottomPanel)
    windowPanelRatioGroup.hidden = !config.bottomPanel
    for (const button of windowPanelRatioButtons) {
      button.classList.toggle('active', button.dataset.panelRatio === config.bottomPanelRatio)
    }
  }
  windowMuntinSection.hidden = false
  const sample = config.paneMuntins[0] ?? { v: 0, h: 0 }
  const allSameV =
    config.paneMuntins.length === 0 || config.paneMuntins.every((m) => (m?.v ?? 0) === sample.v)
  const allSameH =
    config.paneMuntins.length === 0 || config.paneMuntins.every((m) => (m?.h ?? 0) === sample.h)
  for (const button of windowMuntinVButtons) {
    button.classList.toggle('active', allSameV && Number(button.dataset.muntinV) === sample.v)
  }
  for (const button of windowMuntinHButtons) {
    button.classList.toggle('active', allSameH && Number(button.dataset.muntinH) === sample.h)
  }
  windowStylePreview.setAttribute('viewBox', `0 0 ${opening.width} ${opening.height}`)
  windowStylePreview.replaceChildren()
  const styleLayout = layoutGruenderzeitWindow(
    opening.width,
    opening.height,
    config,
    openingGlazingArchForm(opening),
    normalizeOpeningArch(opening.arch).riseCm,
  )
  appendGruenderzeitSvg(
    windowStylePreview,
    styleLayout,
    0,
    0,
    opening.height,
    opening.frameColor ?? defaultOpeningFrameColor(opening.type),
    opening.glassColor ?? DEFAULT_GLASS_COLOR,
    false,
  )
  appendPrimaryPaneHitAreas(windowStylePreview, styleLayout, opening.height, config)
  syncWindowOpenControls(opening, config)
}

/** Klickbare Fensterteile (Primärraster) — Mehrfachauswahl für Sprossen. */
function appendPrimaryPaneHitAreas(
  svg: SVGSVGElement,
  layout: ReturnType<typeof layoutGruenderzeitWindow>,
  openingHeight: number,
  config: GruenderzeitWindowConfig,
) {
  const leaf = layout.leaves.find((item) => item.region === 'sash')
  if (!leaf) return
  const sash = TIMBER.sash
  let glassX = sash
  let glassY = sash
  let glassW = leaf.w - sash * 2
  let glassH = leaf.h - sash * 2
  if (leaf.panel) {
    glassY = leaf.panel.y + leaf.panel.h + sash
    glassH = leaf.h - sash - glassY
  }
  if (glassW < 4 || glassH < 4) return
  const rowWeights = axisWeights(config.splitVCount, config.splitVRatio)
  const colWeights = axisWeights(config.splitHCount, config.splitHRatio)
  const rowCount = rowWeights.length
  const colCount = colWeights.length
  const primary = TIMBER.sash
  const rowSum = rowWeights.reduce((a: number, b: number) => a + b, 0) || 1
  const colSum = colWeights.reduce((a: number, b: number) => a + b, 0) || 1
  const innerH = glassH - primary * (rowCount - 1)
  const innerW = glassW - primary * (colCount - 1)
  const rowHeights = rowWeights.map((wt: number) => (innerH * wt) / rowSum)
  const colWidths = colWeights.map((wt: number) => (innerW * wt) / colSum)
  const ns = 'http://www.w3.org/2000/svg'
  let cursorY = glassY
  let index = 0
  for (let r = 0; r < rowCount; r += 1) {
    const rowH = rowHeights[r]
    let cursorX = glassX
    for (let c = 0; c < colCount; c += 1) {
      const cellW = colWidths[c]
      const paneIndex = index
      index += 1
      const selected = windowPaneSelection.includes(paneIndex)
      const rect = document.createElementNS(ns, 'rect')
      rect.setAttribute('x', String(leaf.x + cursorX))
      rect.setAttribute('y', String(openingHeight - (leaf.y + cursorY + rowH)))
      rect.setAttribute('width', String(cellW))
      rect.setAttribute('height', String(rowH))
      rect.setAttribute('fill', selected ? 'rgba(255,136,0,0.28)' : 'rgba(0,0,0,0)')
      rect.setAttribute('stroke', selected ? '#ff8800' : 'rgba(0,0,0,0.15)')
      rect.setAttribute('stroke-width', selected ? '1.4' : '0.6')
      rect.style.cursor = 'pointer'
      rect.addEventListener('click', (event) => {
        event.stopPropagation()
        if (windowPaneSelection.includes(paneIndex)) {
          windowPaneSelection = windowPaneSelection.filter((i) => i !== paneIndex)
        } else {
          windowPaneSelection = [...windowPaneSelection, paneIndex].sort((a, b) => a - b)
        }
        syncWindowStyleSection()
      })
      svg.appendChild(rect)
      cursorX += cellW + primary
    }
    cursorY += rowH + primary
  }
}

function updateValidationHint() {
  const invalid = selectedWalls()
    .flatMap((wall) => wall.openings.map((opening) => validateOpeningPlacement(opening, wall)))
    .find((result) => !result.valid)

  if (!invalid) {
    validationHint.hidden = true
    validationHint.textContent = ''
    return
  }

  validationHint.hidden = false
  validationHint.textContent = invalid.message ?? 'Ungültige Öffnung.'
}

function selectLayerItem(index: number, shiftKey: boolean, additive = false) {
  if (index < 0) return
  const item = buildLayerOrderForState()[index]
  if (!item) return

  if (additive) {
    const exists = editor.selectedWallIds.includes(item.wallId)
    const selectedWallIds = exists
      ? editor.selectedWallIds.filter((id) => id !== item.wallId)
      : [...editor.selectedWallIds, item.wallId]
    lastSelectionAnchor = index
    applyState(state, {
      selectedWallIds,
      selectedOpenings: [],
      selectedEdges: [],
      selectedRoofBuildingId: undefined,
    })
    return
  }

  if (shiftKey && lastSelectionAnchor !== null) {
    applyState(state, editorFromLayerRange(lastSelectionAnchor, index))
    return
  }

  lastSelectionAnchor = index
  applyState(state, {
    selectedWallIds: [item.wallId],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
  })
}

function wallPartToSettingsTab(
  wallPart: NonNullable<EditorState['selectedWallPart']>,
): string | null {
  switch (wallPart) {
    case 'cornice':
      return 'cornice'
    case 'trimBand':
      return 'trimBands'
    case 'plinth':
      return 'plinth'
    case 'cladding':
      return 'panels'
    case 'label':
      return 'label'
    default:
      return null
  }
}

function openingPartToSettingsTab(part: OpeningPart): string | null {
  switch (part) {
    case 'trim':
      return 'profile'
    case 'sillInner':
      return 'sill-inner'
    case 'sillOuter':
      return 'sill-outer'
    case 'pediment':
      return 'pediment'
    case 'consoles':
      return 'consoles'
    case 'stairs':
      return 'stairs'
    case 'rollerShutter':
      return 'roller-shutter'
    case 'frame':
    case 'grille':
      return 'colors'
    default:
      return null
  }
}

function selectWall(
  id: string | null,
  additive: boolean,
  wallPart: NonNullable<EditorState['selectedWallPart']> = 'group',
  trimBandId?: string,
) {
  if (id === null) {
    if (additive) return
    lastSelectionAnchor = null
    applyEditorSelection({
      selectedWallIds: [],
      selectedOpenings: [],
      selectedEdges: [],
      selectedRoofBuildingId: undefined,
      selectedRoofPart: undefined,
      selectedCeiling: undefined,
      selectedBuildingId: undefined,
      selectedWallPart: undefined,
      selectedTrimBandId: undefined,
      selectedOpeningPart: undefined,
    })
    return
  }

  const preferredTab = wallPartToSettingsTab(wallPart)
  if (preferredTab && !selectionToolbarTabLocked) {
    pendingSelectionToolbarTab = preferredTab
  }
  const wall = getWall(state, id)
  if (!additive) {
    const bayIds = bayWallSelectionIds(getAllWalls(state), id)
    if (bayIds && bayIds.length > 1 && wallPart === 'group') {
      lastSelectionAnchor = layerIndexForWall(state, bayIds[0]!)
      applyEditorSelection({
        selectedWallIds: [...bayIds],
        selectedOpenings: [],
        selectedEdges: [],
        selectedRoofBuildingId: undefined,
        selectedRoofPart: undefined,
        selectedCeiling: undefined,
        selectedBuildingId: undefined,
        selectedWallPart: 'group',
        selectedTrimBandId: undefined,
        selectedOpeningPart: undefined,
      })
      if (isGalleryModeActive() && currentView === '3d') {
        const focused = bayIds
          .map((wid) => getWall(state, wid))
          .filter((w): w is Wall => Boolean(w))
        if (focused.length > 0) focusGalleryOnWalls(focused, false)
      }
      return
    }
  }
  if (!additive && wall?.groupId && wallPart === 'group') {
    const group = activeBuilding().groups?.find((item) => item.id === wall.groupId)
    if (group && group.memberWallIds.length > 1) {
      lastSelectionAnchor = layerIndexForWall(state, group.memberWallIds[0])
      applyEditorSelection({
        selectedWallIds: [...group.memberWallIds],
        selectedOpenings: [],
        selectedEdges: [],
        selectedRoofBuildingId: undefined,
        selectedRoofPart: undefined,
        selectedCeiling: undefined,
        selectedBuildingId: undefined,
        selectedWallPart: 'group',
        selectedTrimBandId: undefined,
        selectedOpeningPart: undefined,
      })
      return
    }
  }

  if (additive) {
    const exists = editor.selectedWallIds.includes(id)
    const selectedWallIds = exists
      ? editor.selectedWallIds.filter((item) => item !== id)
      : [...editor.selectedWallIds, id]
    lastSelectionAnchor = layerIndexForWall(state, id)
    applyEditorSelection({
      selectedWallIds,
      selectedOpenings: [],
      selectedEdges: [],
      selectedRoofBuildingId: undefined,
      selectedRoofPart: undefined,
      selectedCeiling: undefined,
      selectedBuildingId: undefined,
      selectedWallPart: selectedWallIds.length === 1 ? wallPart : 'group',
      selectedTrimBandId:
        selectedWallIds.length === 1 && wallPart === 'trimBand' ? trimBandId : undefined,
      selectedOpeningPart: undefined,
    })
    if (isGalleryModeActive() && currentView === '3d' && selectedWallIds.length > 0) {
      const focused = selectedWallIds
        .map((wid) => getWall(state, wid))
        .filter((w): w is Wall => Boolean(w))
      if (focused.length > 0) focusGalleryOnWalls(focused, false)
    }
    return
  }

  lastSelectionAnchor = layerIndexForWall(state, id)
  applyEditorSelection({
    selectedWallIds: [id],
    selectedOpenings: [],
    selectedEdges: [],
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedCeiling: undefined,
    selectedBuildingId: undefined,
    selectedWallPart: wallPart,
    selectedTrimBandId: wallPart === 'trimBand' ? trimBandId : undefined,
    selectedOpeningPart: undefined,
  })
  if (isGalleryModeActive() && currentView === '3d') {
    const focused = getWall(state, id)
    if (focused) focusGalleryOnWalls([focused], false)
  }
}

function selectOpening(
  wallId: string,
  openingId: string,
  additive: boolean,
  openingPartArg: OpeningPart = 'group',
) {
  // Rahmen/Glas → Ganz-Öffnung (Farben/Maße); sonst Teil-Fokus behalten.
  const openingPart: OpeningPart =
    openingPartArg === 'frame' || openingPartArg === 'grille' ? 'group' : openingPartArg
  const preferredTab = openingPartToSettingsTab(openingPartArg)
  if (preferredTab && !selectionToolbarTabLocked) {
    pendingSelectionToolbarTab = preferredTab
  }
  lastSelectionAnchor = null
  const ref: OpeningRef = { wallId, openingId }

  if (additive) {
    const exists = editor.selectedOpenings.some(
      (item) => item.wallId === wallId && item.openingId === openingId,
    )
    const nextOpenings = exists
      ? editor.selectedOpenings.filter(
          (item) => !(item.wallId === wallId && item.openingId === openingId),
        )
      : [...editor.selectedOpenings, ref]
    applyEditorSelection({
      selectedWallIds: [...new Set(nextOpenings.map((item) => item.wallId))],
      selectedOpenings: nextOpenings,
      selectedEdges: nextOpenings.length === 1 ? openingEdgesForSelection(nextOpenings[0]) : [],
      selectedOpeningPart: nextOpenings.length === 1 ? openingPart : 'group',
      selectedWallPart: undefined,
      selectedRoofBuildingId: undefined,
      selectedRoofPart: undefined,
      selectedCeiling: undefined,
      selectedBuildingId: undefined,
    })
    return
  }

  applyEditorSelection({
    selectedWallIds: [wallId],
    selectedOpenings: [ref],
    selectedEdges: openingEdgesForSelection(ref),
    selectedOpeningPart: openingPart,
    selectedWallPart: undefined,
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedCeiling: undefined,
    selectedBuildingId: undefined,
  })
  if (isGalleryModeActive() && currentView === '3d') {
    const focused = getWall(state, wallId)
    if (focused) focusGalleryOnWalls([focused], false)
  }
}

await loadInitialState()
// Fassaden-Builder 2.0: Fokus auf 2D-Front + Render-Modus; 3D wieder per Button wählbar
presentationMode = 'render'
savePresentationMode('render')
uiMode = 'complex'
try {
  localStorage.setItem(UI_MODE_STORAGE_KEY, 'complex')
} catch {
  /* ignore */
}
syncUiModeChrome()
applyTodaySunDate()
syncSunUi()
applySceneAppearance()
syncSceneColorInputs()
syncSceneLineStrokeInputs()
syncViewChromeButtons()
syncBloomFogUi()
syncLodUi()

const facade = new FacadeController(scene, state)
facadeReady = true
syncCladdingReceiveShadows()
sceneReflectionHideRoots.push(
  atmosphereSky.root,
  facade.selectionGroup,
  facade.guideGroup,
  facade.lineGroup,
  placementGridGroup,
  sceneLightRuntime.root,
)
buildLabelFontCards()
facade.setLodSettings(lodSettings)
applyPresentationMode()
syncSceneLightRuntime()
for (const group of [
  facade.wallGroup,
  facade.profileGroup,
  facade.windowGroup,
  facade.casingGroup,
  facade.claddingGroup,
  facade.selectionGroup,
  facade.indoorFloorGroup,
  facade.pointLightOccluderGroup,
  facade.roofGroup,
  facade.lineGroup,
  facade.guideGroup,
  facade.openingDragGhostGroup,
]) {
  siteOffset.add(group)
}
const svgView = new FacadeSvgView(svgContainer, state, editor)
syncSiteTransform()
applyLineStrokeScale()

type OpeningMotionPlayMode = 'open' | 'close' | 'cycle'
type OpeningMotionPlayPhase = 'open' | 'hold' | 'close'

interface OpeningMotionPlayback {
  refs: OpeningRef[]
  motion: OpeningMotion
  mode: OpeningMotionPlayMode
  phase: OpeningMotionPlayPhase
  t0: number
  startByKey: Map<string, number>
}

let openingMotionPlayback: OpeningMotionPlayback | null = null
let openingMotionEditor: ReturnType<typeof initOpeningMotionEditor> | null = null

function leafMotionStartKey(wallId: string, openingId: string, region: string, index: number): string {
  return `${wallId}:${openingId}:${region}:${index}`
}

function captureOpeningMotionStarts(refs: OpeningRef[]): Map<string, number> {
  const starts = new Map<string, number>()
  for (const ref of refs) {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!opening) continue
    const cfg = gruenderzeitConfigForOpening(opening)
    ;(cfg.leafOpenDeg ?? []).forEach((deg, index) => {
      starts.set(leafMotionStartKey(ref.wallId, ref.openingId, 'sash', index), deg)
    })
    ;(cfg.transomOpenDeg ?? []).forEach((deg, index) => {
      starts.set(leafMotionStartKey(ref.wallId, ref.openingId, 'transom', index), deg)
    })
  }
  return starts
}

function applyOpeningMotionPose(playback: OpeningMotionPlayback, v: number, phase: OpeningMotionPlayPhase) {
  for (const ref of playback.refs) {
    facade.applyOpeningLeafDegrees(ref.wallId, ref.openingId, (tag) => {
      if (phase === 'close') {
        const start =
          playback.startByKey.get(leafMotionStartKey(ref.wallId, ref.openingId, tag.region, tag.index)) ?? 0
        return v * start
      }
      return v * playback.motion.maxDeg
    })
  }
}

function commitOpeningMotionLeafAngles(playback: OpeningMotionPlayback, v: number, phase: OpeningMotionPlayPhase) {
  let next = state
  for (const ref of playback.refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!opening) continue
    const cfg = gruenderzeitConfigForOpening(opening)
    const leafOpenDeg = [...(cfg.leafOpenDeg ?? [])]
    const transomOpenDeg = [...(cfg.transomOpenDeg ?? [])]
    if (phase === 'close') {
      for (let i = 0; i < leafOpenDeg.length; i += 1) {
        leafOpenDeg[i] = Math.round(
          v * (playback.startByKey.get(leafMotionStartKey(ref.wallId, ref.openingId, 'sash', i)) ?? 0),
        )
      }
      for (let i = 0; i < transomOpenDeg.length; i += 1) {
        transomOpenDeg[i] = Math.round(
          v * (playback.startByKey.get(leafMotionStartKey(ref.wallId, ref.openingId, 'transom', i)) ?? 0),
        )
      }
    } else {
      const deg = Math.round(v * playback.motion.maxDeg)
      for (let i = 0; i < leafOpenDeg.length; i += 1) leafOpenDeg[i] = deg
      for (let i = 0; i < transomOpenDeg.length; i += 1) transomOpenDeg[i] = deg
    }
    next = updateOpeningGruenderzeit(next, [ref], { leafOpenDeg, transomOpenDeg })
  }
  openingMotionPlayback = null
  openingMotionEditor?.setPlayhead(null)
  openingMotionEditor?.sync()
  syncSelectionHighlightSuppressed()
  commitState(next)
}

function syncSelectionHighlightSuppressed() {
  const suppress =
    Boolean(openingMotionPlayback) ||
    Boolean(rollerShutterPlayback) ||
    isColorPickerSessionActive()
  facade.setSelectionHighlightSuppressed(suppress)
  svgView.setSelectionHighlightSuppressed(suppress)
}

function stopOpeningMotionPlayback(commitRest: boolean) {
  const playback = openingMotionPlayback
  openingMotionPlayback = null
  openingMotionEditor?.setPlayhead(null)
  syncSelectionHighlightSuppressed()
  if (!playback) {
    openingMotionEditor?.sync()
    return
  }
  if (commitRest) {
    for (const ref of playback.refs) facade.resetOpeningLeafRest(ref.wallId, ref.openingId)
  }
  openingMotionEditor?.sync()
  markViewportDirty()
}

function playbackRefsExist(playback: OpeningMotionPlayback): boolean {
  return playback.refs.some((ref) => {
    const wall = getWall(state, ref.wallId)
    return Boolean(wall?.openings.some((item) => item.id === ref.openingId))
  })
}

function tickOpeningMotionPlayback(now: number) {
  const playback = openingMotionPlayback
  if (!playback) return
  if (!playbackRefsExist(playback)) {
    stopOpeningMotionPlayback(false)
    return
  }
  if (playback.phase === 'hold') {
    applyOpeningMotionPose(playback, 1, 'open')
    openingMotionEditor?.setPlayhead(1)
    const hold = playback.motion.open.holdMs ?? 0
    if (now - playback.t0 >= hold) {
      for (const key of playback.startByKey.keys()) playback.startByKey.set(key, playback.motion.maxDeg)
      playback.phase = 'close'
      playback.t0 = now
    }
    markViewportDirty()
    return
  }
  const curve = playback.phase === 'close' ? playback.motion.close : playback.motion.open
  const t = Math.min(1, (now - playback.t0) / Math.max(80, curve.durationMs))
  const v = evalMotionCurve(curve, t)
  applyOpeningMotionPose(playback, v, playback.phase)
  openingMotionEditor?.setPlayhead(t)
  if (t >= 1) {
    if (playback.mode === 'cycle' && playback.phase === 'open') {
      const hold = playback.motion.open.holdMs ?? 0
      if (hold > 0) {
        playback.phase = 'hold'
        playback.t0 = now
      } else {
        for (const key of playback.startByKey.keys()) playback.startByKey.set(key, playback.motion.maxDeg)
        playback.phase = 'close'
        playback.t0 = now
      }
    } else {
      commitOpeningMotionLeafAngles(playback, v, playback.phase)
      return
    }
  }
  markViewportDirty()
}

function reapplyOpeningMotionPlayback() {
  if (!openingMotionPlayback) return
  tickOpeningMotionPlayback(performance.now())
}

function playOpeningMotion(mode: OpeningMotionPlayMode) {
  const refs = selectedWindowRefsFromEditor()
  const sel = selectedWindowOpening()
  if (refs.length === 0 || !sel || (sel.opening.type !== 'window' && sel.opening.type !== 'door')) return
  stopOpeningMotionPlayback(false)
  const motion = openingMotionFromOpening(sel.opening)
  for (const ref of refs) facade.ensureHighDetailForWall(ref.wallId)
  openingMotionPlayback = {
    refs,
    motion,
    mode,
    phase: mode === 'close' ? 'close' : 'open',
    t0: performance.now(),
    startByKey: captureOpeningMotionStarts(refs),
  }
  syncSelectionHighlightSuppressed()
  tickOpeningMotionPlayback(performance.now())
  openingMotionEditor?.sync()
}

function syncOpeningMotionEditor() {
  openingMotionEditor?.sync()
}

type RollerShutterPlayMode = 'raise' | 'lower' | 'cycle'
type RollerShutterPlayPhase = 'raise' | 'lower' | 'hold'

interface RollerShutterPlayback {
  refs: OpeningRef[]
  mode: RollerShutterPlayMode
  phase: RollerShutterPlayPhase
  t0: number
  startDrop: number
  targetDrop: number
  durationMs: number
  raiseCurve: MotionCurve
  lowerCurve: MotionCurve
}

let rollerShutterPlayback: RollerShutterPlayback | null = null

function syncRollerShutterStopButton() {
  rollerShutterStop.hidden = !rollerShutterPlayback
}

function stopRollerShutterPlayback(commitDrop: boolean) {
  const playback = rollerShutterPlayback
  rollerShutterPlayback = null
  syncRollerShutterStopButton()
  syncSelectionHighlightSuppressed()
  if (!playback) return
  if (commitDrop) {
    // Drop already applied visually; persist last applied value from first ref
    const wall = getWall(state, playback.refs[0]!.wallId)
    const opening = wall?.openings.find((o) => o.id === playback.refs[0]!.openingId)
    const current = normalizeOpeningRollerShutter(opening?.rollerShutter)
    // Keep state as-is if we already committed; on stop mid-way commit visual drop
    const drop =
      playback.phase === 'hold'
        ? playback.targetDrop
        : current.drop
    void drop
  }
  syncRollerShutterControls()
  markViewportDirty()
}

function playRollerShutter(mode: RollerShutterPlayMode) {
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening && openingSupportsRollerShutter(opening) && opening.rollerShutter?.enabled
  })
  const sel = selectedWindowOpening()
  if (refs.length === 0 || !sel) return
  stopRollerShutterPlayback(false)
  stopOpeningMotionPlayback(false)
  const shutter = normalizeOpeningRollerShutter(sel.opening.rollerShutter)
  const startDrop = shutter.drop
  const phase: RollerShutterPlayPhase = mode === 'raise' ? 'raise' : 'lower'
  const targetDrop = phase === 'raise' ? 0 : 1
  const curve = phase === 'raise' ? shutter.motion!.raise : shutter.motion!.lower
  for (const ref of refs) facade.ensureHighDetailForWall(ref.wallId)
  rollerShutterPlayback = {
    refs,
    mode,
    phase,
    t0: performance.now(),
    startDrop,
    targetDrop,
    durationMs: curve.durationMs,
    raiseCurve: shutter.motion!.raise,
    lowerCurve: shutter.motion!.lower,
  }
  syncSelectionHighlightSuppressed()
  syncRollerShutterStopButton()
  tickRollerShutterPlayback(performance.now())
}

function tickRollerShutterPlayback(now: number) {
  const playback = rollerShutterPlayback
  if (!playback) return
  if (
    !playback.refs.some((ref) => {
      const wall = getWall(state, ref.wallId)
      return Boolean(wall?.openings.some((item) => item.id === ref.openingId))
    })
  ) {
    stopRollerShutterPlayback(false)
    return
  }

  if (playback.phase === 'hold') {
    for (const ref of playback.refs) {
      facade.applyRollerShutterDrop(ref.wallId, ref.openingId, playback.targetDrop)
    }
    if (now - playback.t0 >= 600) {
      playback.phase = 'raise'
      playback.startDrop = 1
      playback.targetDrop = 0
      playback.durationMs = playback.raiseCurve.durationMs
      playback.t0 = now
    }
    markViewportDirty()
    return
  }

  const curve = playback.phase === 'raise' ? playback.raiseCurve : playback.lowerCurve
  const t = Math.min(1, (now - playback.t0) / Math.max(80, curve.durationMs))
  const v = evalMotionCurve(curve, t)
  const drop = playback.startDrop + (playback.targetDrop - playback.startDrop) * v
  for (const ref of playback.refs) {
    facade.applyRollerShutterDrop(ref.wallId, ref.openingId, drop)
  }
  rollerShutterDrop.value = String(Math.round(drop * 100))
  rollerShutterDropPct.value = String(Math.round(drop * 100))
  rollerShutterDropLabel.textContent = rollerDropLabel(drop)

  if (t >= 1) {
    if (playback.mode === 'cycle' && playback.phase === 'lower') {
      playback.phase = 'hold'
      playback.targetDrop = 1
      playback.t0 = now
      markViewportDirty()
      return
    }
    const finalDrop = playback.targetDrop
    rollerShutterPlayback = null
    syncRollerShutterStopButton()
    syncSelectionHighlightSuppressed()
    commitState(updateOpeningRollerShutter(state, playback.refs, { drop: finalDrop }))
    return
  }
  markViewportDirty()
}

function reapplyRollerShutterPlayback() {
  if (!rollerShutterPlayback) return
  tickRollerShutterPlayback(performance.now())
}

openingMotionEditor = initOpeningMotionEditor({
  getOpening: () => selectedWindowOpening()?.opening ?? null,
  commitMotion: (motion) => {
    const refs = selectedWindowRefsFromEditor()
    if (refs.length === 0) return
    commitState(updateOpeningMotion(state, refs, motion))
  },
  play: playOpeningMotion,
  stop: () => stopOpeningMotionPlayback(true),
  isPlaying: () => Boolean(openingMotionPlayback),
})

function setFacadeMeshesVisible(visible: boolean) {
  facade.wallGroup.visible = visible
  facade.windowGroup.visible = visible
  facade.casingGroup.visible = visible
  facade.claddingGroup.visible = visible
  facade.profileGroup.visible = visible
  facade.indoorFloorGroup.visible = visible
}

function syncTopCamera2(opts?: { deferGrid?: boolean }) {
  planZoom = clampPlanZoom(planZoom)
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  syncPlanCamera(
    topCamera,
    width / height,
    planZoom,
    planOffsetX,
    planOffsetZ,
    topViewYawDeg,
    sceneContentMaxY(),
  )
  if (!opts?.deferGrid && !orbitLite) {
    floorPlanView.syncGridToCamera(topCamera)
  }
  if (currentView === 'top' && !orbitLite) updateGroundPlane()
  if (currentView === 'top') markViewportDirty()
}

function panPlanByPixels(dx: number, dy: number) {
  cancelViewZoomAnim()
  beginViewNavLite()
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  const halfW = (topCamera.right - topCamera.left) / 2
  const halfH = (topCamera.top - topCamera.bottom) / 2
  const scaleX = (2 * halfW) / Math.max(width, 1)
  const scaleY = (2 * halfH) / Math.max(height, 1)
  const yawRad = THREE.MathUtils.degToRad(topViewYawDeg)
  const cos = Math.cos(yawRad)
  const sin = Math.sin(yawRad)
  const rightX = -cos
  const rightZ = -sin
  const upX = sin
  const upZ = -cos
  planOffsetX -= dx * scaleX * rightX + dy * scaleY * upX
  planOffsetZ -= dx * scaleX * rightZ + dy * scaleY * upZ
  syncTopCamera2({ deferGrid: orbitLite })
}

function syncTopView() {
  const width = viewportRenderWidth()
  const height = viewportRenderHeight()
  canvas.style.left = ''
  canvas.style.top = ''
  canvas.style.width = ''
  canvas.style.height = ''
  applyRendererPixelRatio()
  renderer.setSize(width, height)
  syncTopCamera2()
  atmosphereSky.setVisible(
    !presentationUsesWorkLikeShading(presentationMode) && currentRenderStyle !== 'line',
  )
  viewport.style.background = sceneAppearance.background
  ground.visible = true
  updateGroundPlane()
  setFacadeMeshesVisible(true)
  floorPlanView.root.visible = false
  planSidebar.hidden = true
  planLabelLayer.hidden = true
  renderUi()
  markViewportDirty()
}

selectionToolbar.addEventListener('pointerdown', (event) => {
  event.stopPropagation()
})

deleteWallButton.addEventListener('click', () => {
  let next = state
  for (const id of editor.selectedWallIds) {
    next = removeWall(next, id)
  }
  commitState(next, {
    selectedWallIds: editor.selectedWallIds.filter((id) => getAllWalls(next).some((wall) => wall.id === id)),
    selectedOpenings: editor.selectedOpenings.filter((ref) =>
      getAllWalls(next).some((wall) => wall.id === ref.wallId),
    ),
    selectedEdges: editor.selectedEdges,
  })
})

duplicateWallButton.addEventListener('click', () => {
  runDuplicateWalls('right')
})

function runDuplicateWalls(side: 'left' | 'right', opts?: { wallIds?: string[] }) {
  const sourceIds = opts?.wallIds ?? [...editor.selectedWallIds]
  if (sourceIds.length === 0) return
  const beforeIds = new Set(getAllWalls(state).map((wall) => wall.id))
  const hasStudio = sourceIds.some((id) => {
    const item = getWall(state, id)
    return item && isStudioWall(item)
  })
  let next = duplicateWalls(state, sourceIds, side, { planLinked: hasStudio, viewerRight: viewerRightXZ() })
  const newIds = getAllWalls(next)
    .filter((wall) => !beforeIds.has(wall.id))
    .map((wall) => wall.id)
  if (hasStudio && newIds.length > 0) {
    next = linkStudioWalls(next, [...sourceIds, ...newIds])
    next = inheritFrontsFromNeighbors(next, newIds, sourceIds)
    next = finalizeStudioGeometry(next)
  } else {
    next = hasStudio ? finalizeStudioGeometry(next) : finalizeWallLayout(next)
  }
  commitState(next, {
    selectedWallIds: newIds,
    selectedOpenings: [],
    selectedEdges: [],
  })
}

deleteOpeningButton.addEventListener('click', () => {
  let next = state
  for (const ref of editor.selectedOpenings) {
    next = removeOpening(next, ref.wallId, ref.openingId)
  }
  commitState(next)
})

duplicateOpeningButton.addEventListener('click', () => {
  runDuplicateOpenings('right')
})

resetOpeningButton.addEventListener('click', () => {
  if (editor.selectedOpenings.length === 0) return
  commitState(resetOpenings(state, editor.selectedOpenings))
})

function runDuplicateOpenings(side: 'left' | 'right') {
  if (editor.selectedOpenings.length === 0) return
  const { state: next, newRefs, failed } = duplicateOpenings(state, editor.selectedOpenings, side, {
    viewerRight: viewerRightXZ(),
  })
  if (failed && newRefs.length === 0) {
    validationHint.textContent = 'Kein freier Platz für Duplizierung gefunden.'
    validationHint.hidden = false
    return
  }
  commitState(next, {
    selectedWallIds: [...new Set(newRefs.map((ref) => ref.wallId))],
    selectedOpenings: newRefs,
    selectedEdges: editor.selectedEdges,
  })
  if (failed) {
    validationHint.textContent = 'Einige Öffnungen konnten nicht dupliziert werden.'
    validationHint.hidden = false
  }
}

openingModelSelect.addEventListener('change', () => {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const value = openingModelSelect.value
  let patch: Partial<import('./types/facade').Opening>

  if (value.startsWith('door:')) {
    const [w, h] = value.slice(5).split('x').map(Number)
    patch = { width: w, height: h, windowModel: undefined }
  } else {
    const model = BLENDER_WINDOW_MODELS.find((m) => m.name === value)
    if (!model) return
    patch = { width: model.width, height: model.height, windowModel: model.name }
  }

  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const oldOpening = wall?.openings.find((o) => o.id === ref.openingId)
    let syncedPatch: Partial<Opening> =
      oldOpening?.type === 'door' && oldOpening.stairs?.enabled && patch.width !== undefined
        ? {
            ...patch,
            stairs: syncStairsToDoorWidth(oldOpening.stairs, {
              ...oldOpening,
              width: patch.width,
              height: patch.height ?? oldOpening.height,
            }),
          }
        : patch
    if (oldOpening && patch.width !== undefined) {
      syncedPatch = {
        ...syncedPatch,
        x: centeredOpeningX(oldOpening, patch.width, STUDIO_MASONRY),
      }
    }
    next = updateOpening(next, ref.wallId, ref.openingId, syncedPatch)
  }
  commitState(next)
})

for (const button of windowCasementButtons) {
  button.addEventListener('click', () => {
    const casements = Number(button.dataset.casements) as 1 | 2 | 3
    if (casements !== 1 && casements !== 2 && casements !== 3) return
    commitGruenderzeitPatch({ casements })
  })
}

windowTransomInput.addEventListener('change', () => {
  commitGruenderzeitPatch({ transom: windowTransomInput.checked })
})

windowTransomRatioInput.addEventListener('input', () => {
  commitGruenderzeitPatch({ transomRatio: Number(windowTransomRatioInput.value) / 100 })
})

for (const button of windowTransomBarsButtons) {
  button.addEventListener('click', () => {
    const transomBars = button.dataset.transomBars as GruenderzeitTransomBars
    if (transomBars !== 'none' && transomBars !== 'match' && transomBars !== 'cross') return
    commitGruenderzeitPatch({ transom: true, transomBars })
  })
}

for (const button of windowSplitVCountButtons) {
  button.addEventListener('click', () => {
    const splitVCount = Number(button.dataset.splitVCount)
    if (!isSplitCount(splitVCount)) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    const current = opening ? gruenderzeitConfigForOpening(opening) : undefined
    const splitHCount = current?.splitHCount ?? 1
    const splitHRatio = current?.splitHRatio ?? '1/1'
    const splitVRatio = splitVCount === 2 ? (current?.splitVRatio ?? '1/1') : '1/1'
    windowPaneSelection = []
    commitGruenderzeitPatch({
      splitVCount,
      splitVRatio,
      splitHCount,
      splitHRatio,
      paneMuntins: Array.from({ length: paneCountForSplit(splitVCount, splitHCount) }, () => ({
        v: 0,
        h: 0,
      })),
    })
  })
}

for (const button of windowSplitHCountButtons) {
  button.addEventListener('click', () => {
    const splitHCount = Number(button.dataset.splitHCount)
    if (!isSplitCount(splitHCount)) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    if (!opening) return
    const current = gruenderzeitConfigForOpening(opening)
    const splitHRatio = splitHCount === 2 ? current.splitHRatio : '1/1'
    windowPaneSelection = []
    commitGruenderzeitPatch({
      splitVCount: current.splitVCount,
      splitVRatio: current.splitVRatio,
      splitHCount,
      splitHRatio,
      paneMuntins: Array.from(
        { length: paneCountForSplit(current.splitVCount, splitHCount) },
        () => ({ v: 0, h: 0 }),
      ),
    })
  })
}

for (const button of windowSplitVRatioButtons) {
  button.addEventListener('click', () => {
    const splitVRatio = button.dataset.splitVRatio
    if (!isBinaryRatio(splitVRatio)) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    if (!opening) return
    const current = gruenderzeitConfigForOpening(opening)
    if (current.splitVCount !== 2) return
    commitGruenderzeitPatch({
      splitVCount: current.splitVCount,
      splitVRatio,
      splitHCount: current.splitHCount,
      splitHRatio: current.splitHRatio,
      paneMuntins: current.paneMuntins,
    })
  })
}

for (const button of windowSplitHRatioButtons) {
  button.addEventListener('click', () => {
    const splitHRatio = button.dataset.splitHRatio
    if (!isBinaryRatio(splitHRatio)) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    if (!opening) return
    const current = gruenderzeitConfigForOpening(opening)
    if (current.splitHCount !== 2) return
    commitGruenderzeitPatch({
      splitVCount: current.splitVCount,
      splitVRatio: current.splitVRatio,
      splitHCount: current.splitHCount,
      splitHRatio,
      paneMuntins: current.paneMuntins,
    })
  })
}

windowBottomPanelInput.addEventListener('change', () => {
  commitGruenderzeitPatch({
    bottomPanel: windowBottomPanelInput.checked,
    bottomPanelRatio: windowBottomPanelInput.checked ? '1/2' : undefined,
  })
})

for (const button of windowPanelRatioButtons) {
  button.addEventListener('click', () => {
    const bottomPanelRatio = button.dataset.panelRatio
    if (!isPanelRatio(bottomPanelRatio)) return
    commitGruenderzeitPatch({ bottomPanel: true, bottomPanelRatio })
  })
}

for (const button of windowMuntinVButtons) {
  button.addEventListener('click', () => {
    const v = Number(button.dataset.muntinV) as 0 | 1 | 2
    if (v !== 0 && v !== 1 && v !== 2) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    if (!opening) return
    const current = gruenderzeitConfigForOpening(opening)
    const count = paneCountForSplit(current.splitVCount, current.splitHCount)
    const paneMuntins = Array.from({ length: count }, (_, i) => ({
      ...(current.paneMuntins[i] ?? { v: 0, h: 0 }),
      v,
    }))
    commitGruenderzeitPatch({
      splitVCount: current.splitVCount,
      splitVRatio: current.splitVRatio,
      splitHCount: current.splitHCount,
      splitHRatio: current.splitHRatio,
      paneMuntins,
    })
  })
}

for (const button of windowMuntinHButtons) {
  button.addEventListener('click', () => {
    const h = Number(button.dataset.muntinH) as 0 | 1 | 2
    if (h !== 0 && h !== 1 && h !== 2) return
    const refs = selectedWindowRefsFromEditor()
    const wall = refs[0] ? getWall(state, refs[0].wallId) : undefined
    const opening = wall?.openings.find((o) => o.id === refs[0]?.openingId)
    if (!opening) return
    const current = gruenderzeitConfigForOpening(opening)
    const count = paneCountForSplit(current.splitVCount, current.splitHCount)
    const paneMuntins = Array.from({ length: count }, (_, i) => ({
      ...(current.paneMuntins[i] ?? { v: 0, h: 0 }),
      h,
    }))
    commitGruenderzeitPatch({
      splitVCount: current.splitVCount,
      splitVRatio: current.splitVRatio,
      splitHCount: current.splitHCount,
      splitHRatio: current.splitHRatio,
      paneMuntins,
    })
  })
}

windowPresetSelect.addEventListener('change', () => {
  const id = windowPresetSelect.value as GruenderzeitPresetId
  const preset = WINDOW_STYLE_PRESETS[id]
  if (!preset) return
  windowPaneSelection = []
  commitGruenderzeitPatch({
    casements: preset.casements,
    transom: preset.transom,
    transomRatio: preset.transomRatio,
    bottomPanel: preset.bottomPanel,
    bottomPanelRatio: preset.bottomPanel ? '1/2' : '1/2',
    splitVCount: 1,
    splitVRatio: '1/1',
    splitHCount: 1,
    splitHRatio: '1/1',
    paneMuntins: [{ v: 0, h: 0 }],
    sashBarsH: 0,
    sashBarsV: 0,
    transomBars: 'match',
    leafOpenDeg: Array.from({ length: preset.casements }, () => 0),
    transomOpenDeg: Array.from({ length: preset.casements }, () => 0),
  })
})

windowBoxInput.addEventListener('change', () => {
  commitGruenderzeitPatch({ boxWindow: windowBoxInput.checked })
})

windowProfiledBars.addEventListener('change', () => {
  commitGruenderzeitPatch({ profiledBars: windowProfiledBars.checked })
})

windowHardware.addEventListener('change', () => {
  commitGruenderzeitPatch({ hardware: windowHardware.checked })
})

windowInnerFrameColor.addEventListener('input', () => {
  commitGruenderzeitPatch({ innerFrameColor: windowInnerFrameColor.value })
})

function commitTimberFromInputs() {
  commitGruenderzeitPatch({
    timber: {
      blend: Number(windowTimberBlend.value),
      sash: Number(windowTimberSash.value),
      muntin: Number(windowTimberMuntin.value),
      kaempfer: Number(windowTimberKaempfer.value),
      stulp: Number(windowTimberStulp.value),
    },
  })
}
for (const el of [
  windowTimberBlend,
  windowTimberSash,
  windowTimberMuntin,
  windowTimberKaempfer,
  windowTimberStulp,
]) {
  el.addEventListener('change', commitTimberFromInputs)
}

function syncWindowHingeModeList(config: ReturnType<typeof gruenderzeitConfigForOpening>) {
  windowHingeModeList.replaceChildren()
  for (let i = 0; i < config.casements; i += 1) {
    const row = document.createElement('div')
    row.className = 'toolbar-row-2'
    const hinge = config.leafHinges?.[i] ?? (i === config.casements - 1 && config.casements > 1 ? 'right' : 'left')
    const mode = config.leafOpenModes?.[i] ?? 'turn'
    row.innerHTML = `<span class="toolbar-label">Flügel ${i + 1}</span>
      <select data-hinge-idx="${i}">
        <option value="left"${hinge === 'left' ? ' selected' : ''}>Scharnier links</option>
        <option value="right"${hinge === 'right' ? ' selected' : ''}>Scharnier rechts</option>
      </select>
      <select data-mode-idx="${i}">
        <option value="turn"${mode === 'turn' ? ' selected' : ''}>Dreh</option>
        <option value="tilt"${mode === 'tilt' ? ' selected' : ''}>Kipp</option>
        <option value="turnTilt"${mode === 'turnTilt' ? ' selected' : ''}>Drehkipp</option>
      </select>`
    windowHingeModeList.appendChild(row)
  }
  windowHingeModeList.querySelectorAll<HTMLSelectElement>('select[data-hinge-idx]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = Number(sel.dataset.hingeIdx)
      const hinges = [...(config.leafHinges ?? [])]
      while (hinges.length < config.casements) {
        hinges.push(hinges.length === config.casements - 1 && config.casements > 1 ? 'right' : 'left')
      }
      hinges[idx] = sel.value === 'right' ? 'right' : 'left'
      commitGruenderzeitPatch({ leafHinges: hinges })
    })
  })
  windowHingeModeList.querySelectorAll<HTMLSelectElement>('select[data-mode-idx]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = Number(sel.dataset.modeIdx)
      const modes = [...(config.leafOpenModes ?? Array.from({ length: config.casements }, () => 'turn' as const))]
      while (modes.length < config.casements) modes.push('turn')
      const v = sel.value
      modes[idx] = v === 'tilt' || v === 'turnTilt' ? v : 'turn'
      commitGruenderzeitPatch({ leafOpenModes: modes })
    })
  })
}

function patchSelectedOpenings(patch: Partial<import('./types/facade').Opening>) {
  const refs = selectedWindowRefsFromEditor()
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    next = updateOpening(next, ref.wallId, ref.openingId, patch)
  }
  commitState(next)
}

windowGuardEnabled.addEventListener('change', () => {
  patchSelectedOpenings({
    guard: normalizeOpeningGuard({
      enabled: windowGuardEnabled.checked,
      mode: windowGuardMode.value === 'balcony' ? 'balcony' : 'grille',
      barSpacingCm: Number(windowGuardSpacing.value),
      heightCm: Number(windowGuardHeight.value),
    }),
  })
})
windowGuardMode.addEventListener('change', () => {
  patchSelectedOpenings({
    guard: normalizeOpeningGuard({
      enabled: true,
      mode: windowGuardMode.value === 'balcony' ? 'balcony' : 'grille',
      barSpacingCm: Number(windowGuardSpacing.value),
      heightCm: Number(windowGuardHeight.value),
    }),
  })
})
for (const el of [windowGuardSpacing, windowGuardHeight]) {
  el.addEventListener('change', () => {
    patchSelectedOpenings({
      guard: normalizeOpeningGuard({
        enabled: windowGuardEnabled.checked,
        mode: windowGuardMode.value === 'balcony' ? 'balcony' : 'grille',
        barSpacingCm: Number(windowGuardSpacing.value),
        heightCm: Number(windowGuardHeight.value),
      }),
    })
  })
}

windowShadeEnabled.addEventListener('change', () => {
  patchSelectedOpenings({
    interiorShade: normalizeOpeningInteriorShade({
      enabled: windowShadeEnabled.checked,
      mode: windowShadeMode.value === 'blind' ? 'blind' : 'curtain',
      drop: Number(windowShadeDrop.value) / 100,
    }),
  })
})
windowShadeMode.addEventListener('change', () => {
  patchSelectedOpenings({
    interiorShade: normalizeOpeningInteriorShade({
      enabled: true,
      mode: windowShadeMode.value === 'blind' ? 'blind' : 'curtain',
      drop: Number(windowShadeDrop.value) / 100,
    }),
  })
})
windowShadeDrop.addEventListener('input', () => {
  patchSelectedOpenings({
    interiorShade: normalizeOpeningInteriorShade({
      enabled: windowShadeEnabled.checked,
      mode: windowShadeMode.value === 'blind' ? 'blind' : 'curtain',
      drop: Number(windowShadeDrop.value) / 100,
    }),
  })
})

function commitDoorExtras() {
  patchSelectedOpenings({
    door: normalizeOpeningDoor({
      cassetteCount: Number(windowDoorCassettes.value) as 1 | 2 | 3 | 4,
      handle: windowDoorHandle.checked,
      letterSlot: windowDoorLetter.checked,
    }),
  })
}
windowDoorCassettes.addEventListener('change', commitDoorExtras)
windowDoorHandle.addEventListener('change', commitDoorExtras)
windowDoorLetter.addEventListener('change', commitDoorExtras)

wallModuleSelect.addEventListener('change', () => {
  const moduleName = wallModuleSelect.value
  if (!moduleName) return
  commitState(
    finalizeWallLayout(applyWallModule(state, editor.selectedWallIds, moduleName)),
  )
})

claddingSelect.addEventListener('change', () => {
  commitState(updateWallCladding(state, scopedWallIds(), claddingSelect.value))
})

for (const button of attachButtons) {
  button.addEventListener('click', () => {
    const ids = [...editor.selectedWallIds]
    if (ids.length === 0) return
    const side = button.dataset.side as WallSide
    let next = state
    const addedIds: string[] = []
    for (const id of ids) {
      const before = new Set(getAllWalls(next).map((wall) => wall.id))
      next = addAdjacentWall(next, id, side)
      const added = getAllWalls(next).find((wall) => !before.has(wall.id))
      if (added) addedIds.push(added.id)
    }
    commitState(finalizeWallLayout(next), {
      selectedWallIds: addedIds.length > 0 ? addedIds : ids,
      selectedOpenings: [],
      selectedEdges: [],
    })
  })
}

sillOuterEnabled.addEventListener('change', () => {
  commitOpeningSillPatch({ outer: { enabled: sillOuterEnabled.checked } })
})
sillInnerEnabled.addEventListener('change', () => {
  commitOpeningSillPatch({ inner: { enabled: sillInnerEnabled.checked } })
})
sillInnerOverhang.addEventListener('change', () => {
  commitOpeningSillPatch({
    inner: { overhang: snapToGrid(Number(sillInnerOverhang.value), STUDIO_MASONRY) },
  })
})
sillInnerDepth.addEventListener('change', () => {
  commitOpeningSillPatch({ inner: { depth: Number(sillInnerDepth.value) } })
})
sillInnerThickness.addEventListener('change', () => {
  commitOpeningSillPatch({ inner: { thickness: Number(sillInnerThickness.value) } })
})
sillOuterOverhang.addEventListener('change', () => {
  commitOpeningSillPatch({
    outer: {
      overhang: snapToGrid(Number(sillOuterOverhang.value), STUDIO_MASONRY),
      overhangLeft: undefined,
      overhangRight: undefined,
      width: undefined,
    },
  })
})
sillOuterDepth.addEventListener('change', () => {
  const depth = clampOuterSillDepth(Number(sillOuterDepth.value))
  sillOuterDepth.value = String(depth)
  commitOpeningSillPatch({ outer: { depth } })
})
sillOuterThickness.addEventListener('change', () => {
  commitOpeningSillPatch({ outer: { thickness: Number(sillOuterThickness.value) } })
})
sillOuterAngle.addEventListener('change', () => {
  commitOpeningSillPatch({ outer: { angleDeg: Number(sillOuterAngle.value) } })
})
sillOuterScale.addEventListener('change', () => {
  commitOpeningSillPatch({ outer: { scale: Number(sillOuterScale.value) } })
  drawSillOuterSectionPreview()
})
sillOuterCornerJoin.addEventListener('change', () => {
  commitOpeningSillPatch({
    outer: { cornerJoin: sillOuterCornerJoin.value as OpeningTrimConfig['cornerJoin'] },
  })
})
sillOuterRotateCcw.addEventListener('click', () => {
  const current = Number(sillOuterValueForSelection('rotationDeg')) || 0
  commitOpeningSillPatch({ outer: { rotationDeg: (current + 270) % 360 } })
  drawSillOuterSectionPreview()
})
sillOuterRotateCw.addEventListener('click', () => {
  const current = Number(sillOuterValueForSelection('rotationDeg')) || 0
  commitOpeningSillPatch({ outer: { rotationDeg: (current + 90) % 360 } })
  drawSillOuterSectionPreview()
})
sillOuterFlipOutward.addEventListener('click', () => {
  commitOpeningSillPatch({
    outer: { flipOutward: !Boolean(sillOuterValueForSelection('flipOutward')) },
  })
  syncWindowSillControls()
})
sillOuterFlipForward.addEventListener('click', () => {
  commitOpeningSillPatch({
    outer: { flipForward: !Boolean(sillOuterValueForSelection('flipForward')) },
  })
  syncWindowSillControls()
})

pedimentEnabled.addEventListener('change', () => {
  commitOpeningPedimentPatch({ enabled: pedimentEnabled.checked })
  syncPedimentControls()
})

taperedFieldEnabled.addEventListener('change', () => {
  commitOpeningTaperedFieldPatch({ enabled: taperedFieldEnabled.checked })
  syncTaperedFieldControls()
})
taperedFieldCourses.addEventListener('change', () => {
  commitOpeningTaperedFieldPatch({
    courses: Math.max(1, Math.min(12, Math.round(Number(taperedFieldCourses.value) || 3))),
  })
  syncTaperedFieldControls()
})
taperedFieldOverhang.addEventListener('change', () => {
  commitOpeningTaperedFieldPatch({
    overhangCm: snapToGrid(Number(taperedFieldOverhang.value), STUDIO_MASONRY),
  })
  syncTaperedFieldControls()
})
taperedFieldRatio.addEventListener('change', () => {
  const raw = Number(taperedFieldRatio.value)
  commitOpeningTaperedFieldPatch({
    topWidthRatio: Number.isFinite(raw) ? raw : 0.55,
  })
  syncTaperedFieldControls()
})
taperedFieldOffsetUp.addEventListener('change', () => {
  commitOpeningTaperedFieldPatch({
    offsetUpCm: snapToGrid(Number(taperedFieldOffsetUp.value), STUDIO_MASONRY),
  })
  syncTaperedFieldControls()
})
taperedFieldInvert.addEventListener('change', () => {
  commitOpeningTaperedFieldPatch({ invert: taperedFieldInvert.checked })
  syncTaperedFieldControls()
})

pedimentFormCards.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.pediment-form-btn')
  if (!btn?.dataset.form) return
  const form = btn.dataset.form as PedimentForm
  commitOpeningPedimentPatch({
    enabled: true,
    form,
    ...(pedimentFormIsClosed(form) ? { sideArmWidth: 0 } : {}),
  })
  syncPedimentControls()
})
pedimentOverhang.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    overhang: snapToGrid(Number(pedimentOverhang.value), STUDIO_MASONRY),
  })
})
pedimentGableHeight.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    gableHeight: snapToGrid(Number(pedimentGableHeight.value), STUDIO_MASONRY),
  })
})
pedimentOffsetUp.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    offsetUp: snapToGrid(Number(pedimentOffsetUp.value), STUDIO_MASONRY),
  })
})
pedimentOffsetForward.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    offsetForward: Number(pedimentOffsetForward.value) || 0,
  })
})
pedimentGableWidth.addEventListener('change', () => {
  const raw = Number(pedimentGableWidth.value)
  commitOpeningPedimentPatch({
    gableWidth: Number.isFinite(raw) && raw > 0 ? snapToGrid(raw, STUDIO_MASONRY) : 0,
  })
  syncPedimentControls()
})
pedimentSideArmWidth.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    sideArmWidth: snapToGrid(Number(pedimentSideArmWidth.value), STUDIO_MASONRY),
  })
})
pedimentSideArmsEnabled.addEventListener('change', () => {
  if (pedimentSideArmsEnabled.checked) {
    const current = Number(pedimentSideArmWidth.value)
    commitOpeningPedimentPatch({
      sideArmWidth: current > 0 ? current : STUDIO_MASONRY,
    })
  } else {
    commitOpeningPedimentPatch({ sideArmWidth: 0 })
  }
  syncPedimentControls()
})
pedimentScale.addEventListener('change', () => {
  commitOpeningPedimentPatch({ scale: Number(pedimentScale.value) })
})
pedimentExtentOut.addEventListener('change', () => {
  const n = Number(pedimentExtentOut.value)
  commitOpeningPedimentPatch({
    extentOutCm: Number.isFinite(n) && n > 0 ? n : undefined,
  })
})
pedimentExtentForward.addEventListener('change', () => {
  const n = Number(pedimentExtentForward.value)
  commitOpeningPedimentPatch({
    extentForwardCm: Number.isFinite(n) && n > 0 ? n : undefined,
  })
})
pedimentConsolesEnabled.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    enabled: true,
    consoles: { enabled: pedimentConsolesEnabled.checked },
  })
  syncPedimentControls()
})
pedimentConsoleWallOffset.addEventListener('change', () => {
  commitOpeningPedimentPatch({
    enabled: true,
    consoles: {
      enabled: true,
      wallOffset: snapToGrid(Number(pedimentConsoleWallOffset.value), STUDIO_MASONRY),
    },
  })
})

windowBasementEnabled.addEventListener('change', () => {
  // Nur die aktuelle Auswahl — nie Etage/Fassade mit umschreiben
  const refs = [...editor.selectedOpenings]
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!wall || !opening || opening.type !== 'window') continue
    if (!isBasementWindowOpening(opening) && !windowBasementEnabled.checked) continue
    next = updateOpening(next, ref.wallId, ref.openingId, {
      basementWindow: windowBasementEnabled.checked
        ? { enabled: true, grilleHeight: opening.basementWindow?.grilleHeight ?? 0.5 }
        : { enabled: false, grilleHeight: opening.basementWindow?.grilleHeight ?? 0.5 },
      sillInner: opening.sillInner
        ? { ...opening.sillInner, enabled: windowBasementEnabled.checked ? false : opening.sillInner.enabled }
        : opening.sillInner,
      sillOuter: opening.sillOuter
        ? { ...opening.sillOuter, enabled: windowBasementEnabled.checked ? false : opening.sillOuter.enabled }
        : opening.sillOuter,
      pediment: windowBasementEnabled.checked
        ? { ...normalizeOpeningPediment(opening.pediment), enabled: false }
        : opening.pediment,
    })
  }
  // Rahmenprofil-Zuweisungen an der Wand für Kellerfenster entfernen
  if (windowBasementEnabled.checked) {
    for (const ref of refs) {
      const wall = getWall(next, ref.wallId)
      if (!wall) continue
      next = mapAllWalls(next, (w) =>
        w.id !== wall.id
          ? w
          : {
              ...w,
              profiles: w.profiles.filter((p) => p.openingId !== ref.openingId),
            },
      )
    }
  }
  if (windowBasementEnabled.checked) {
    next = updateOpeningGruenderzeit(next, refs, {})
  }
  commitState(next)
  syncWindowStyleSection()
  applyOpeningPartVisibility()
})

function commitBasementGrilleHeight(ratio: number) {
  const refs = [...editor.selectedOpenings]
  if (refs.length === 0) return
  const grilleHeight = Math.max(0.25, Math.min(0.85, ratio))
  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!wall || !opening || opening.type !== 'window') continue
    if (!isBasementWindowOpening(opening)) continue
    next = updateOpening(next, ref.wallId, ref.openingId, {
      basementWindow: { enabled: true, grilleHeight },
    })
  }
  commitState(next)
}

windowBasementGrilleHeight.addEventListener('input', () => {
  const pct = Number(windowBasementGrilleHeight.value)
  windowBasementGrilleHeightOut.textContent = `${pct} %`
})
windowBasementGrilleHeight.addEventListener('change', () => {
  commitBasementGrilleHeight(Number(windowBasementGrilleHeight.value) / 100)
})

openingNudgeLeft.addEventListener('click', () => nudgeSelectedOpenings(-heldNudgeStepCm(), 0))
openingNudgeRight.addEventListener('click', () => nudgeSelectedOpenings(heldNudgeStepCm(), 0))
openingNudgeUp.addEventListener('click', () => nudgeSelectedOpenings(0, heldNudgeStepCm()))
openingNudgeDown.addEventListener('click', () => nudgeSelectedOpenings(0, -heldNudgeStepCm()))
openingPosX.addEventListener('change', () => {
  const sel = selectedWindowOpening()
  if (!sel) return
  const x = snapToGrid(Number(openingPosX.value), STUDIO_MASONRY)
  nudgeSelectedOpenings(x - sel.opening.x, 0)
})
openingPosY.addEventListener('change', () => {
  const sel = selectedWindowOpening()
  if (!sel) return
  if (sel.opening.type === 'door' && sel.opening.stairs?.enabled) {
    syncOpeningPositionControls()
    return
  }
  const y = snapToGrid(Number(openingPosY.value), STUDIO_MASONRY)
  nudgeSelectedOpenings(0, y - sel.opening.y)
})

function commitOpeningSizePatch(patch: { width?: number; height?: number }) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    if (!opening) continue
    let openingPatch: Partial<Opening> = { ...patch }
    if (patch.width !== undefined) {
      openingPatch = {
        ...openingPatch,
        x: centeredOpeningX(opening, patch.width, STUDIO_MASONRY),
      }
    }
    if (patch.width !== undefined && opening.type === 'door' && opening.stairs?.enabled) {
      openingPatch = {
        ...openingPatch,
        stairs: syncStairsToDoorWidth(opening.stairs, { ...opening, width: patch.width }),
      }
    }
    next = updateOpening(next, ref.wallId, ref.openingId, openingPatch)
  }
  commitState(next)
  syncOpeningPositionControls()
  syncDoorStairsControls()
}

openingWidthInput.addEventListener('change', () => {
  const width = snapToGrid(Number(openingWidthInput.value), STUDIO_MASONRY)
  if (!Number.isFinite(width) || width < STUDIO_MASONRY) {
    syncOpeningPositionControls()
    return
  }
  commitOpeningSizePatch({ width })
})

openingHeightInput.addEventListener('change', () => {
  const height = snapToGrid(Number(openingHeightInput.value), STUDIO_MASONRY)
  if (!Number.isFinite(height) || height < STUDIO_MASONRY) {
    syncOpeningPositionControls()
    return
  }
  commitOpeningSizePatch({ height })
})

function commitOpeningFillPatch() {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const uiMode = openingFillMode.value as 'opening' | 'flush' | 'niche'
  const nicheDepthCm = Math.max(1, Number(openingNicheDepth.value) || DEFAULT_NICHE_DEPTH_CM)
  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    const mode = opening && openingIsConch(opening) ? 'niche' : uiMode
    next = updateOpening(next, ref.wallId, ref.openingId, {
      fill: normalizeOpeningFill({ mode, nicheDepthCm }),
    })
  }
  commitState(next)
  syncOpeningPositionControls()
  applyOpeningPartVisibility()
}

openingFillMode.addEventListener('change', () => commitOpeningFillPatch())
openingNicheDepth.addEventListener('change', () => commitOpeningFillPatch())

openingTypeSelect.addEventListener('change', () => {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const type =
    openingTypeSelect.value === 'door'
      ? 'door'
      : openingTypeSelect.value === 'conch'
        ? 'conch'
        : 'window'
  let next = state
  for (const ref of refs) {
    const wall = getWall(next, ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    if (!opening || opening.type === type) continue
    const rise = Math.min(opening.width / 2, opening.height)
    const patch: Partial<Opening> =
      type === 'conch'
        ? {
            type: 'conch',
            fill: {
              mode: 'niche',
              nicheDepthCm: Math.max(
                opening.fill?.nicheDepthCm ?? DEFAULT_NICHE_DEPTH_CM,
                rise,
              ),
            },
            arch: { enabled: true, form: 'round', riseCm: rise },
            cutoutShape: undefined,
            basementWindow: undefined,
            stairs: undefined,
          }
        : type === 'door'
          ? {
              type: 'door',
              fill: { mode: 'opening' },
              y: 0,
              cutoutShape: undefined,
              basementWindow: undefined,
            }
          : {
              type: 'window',
              fill: { mode: 'opening' },
              cutoutShape: undefined,
            }
    next = updateOpening(next, ref.wallId, ref.openingId, patch)
  }
  commitState(next)
  syncOpeningPositionControls()
  applyOpeningPartVisibility()
  syncLibraryTabs()
})

openingCutoutShape.addEventListener('change', () => {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const cutoutShape = openingCutoutShape.value === 'round' ? 'round' : 'rect'
  let next = state
  for (const ref of refs) {
    next = updateOpening(next, ref.wallId, ref.openingId, { cutoutShape })
  }
  commitState(next)
  syncOpeningPositionControls()
})

function commitOpeningPanelClearancePatch() {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const enabled = openingPanelClearanceEnabled.checked
  const cm = Math.max(0, Math.round(Number(openingPanelClearanceCm.value) || DEFAULT_PANEL_CLEARANCE_CM))
  const finish = openingPanelClearanceFinish.value === 'taper' ? 'taper' : 'empty'
  const depthCm = Math.max(
    PANEL_CLEARANCE_DEPTH_MIN,
    Math.min(PANEL_CLEARANCE_DEPTH_MAX, Number(openingPanelClearanceDepth.value) || 0),
  )
  openingPanelClearanceCm.value = String(cm)
  openingPanelClearanceDepth.value = String(depthCm)
  let next = state
  for (const ref of refs) {
    next = updateOpening(next, ref.wallId, ref.openingId, {
      panelClearance: normalizePanelClearance({ enabled, cm, depthCm, finish }),
    })
  }
  commitState(next)
  syncOpeningPositionControls()
}

openingPanelClearanceEnabled.addEventListener('change', () => commitOpeningPanelClearancePatch())
openingPanelClearanceCm.addEventListener('change', () => commitOpeningPanelClearancePatch())
openingPanelClearanceDepth.addEventListener('input', () => commitOpeningPanelClearancePatch())
openingPanelClearanceFinish.addEventListener('change', () => commitOpeningPanelClearancePatch())

function commitOpeningRevealFramePatch() {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  const enabled = openingRevealFrameEnabled.checked
  const embedCm = Math.max(0, Number(openingRevealEmbed.value) || DEFAULT_REVEAL_EMBED_CM)
  const insetCm = Math.max(0, Number(openingRevealInset.value) || DEFAULT_REVEAL_INSET_CM)
  let next = state
  for (const ref of refs) {
    next = updateOpening(next, ref.wallId, ref.openingId, {
      revealFrame: normalizeRevealFrame({ enabled, embedCm, insetCm }),
    })
  }
  commitState(next)
  syncOpeningPositionControls()
}

openingRevealFrameEnabled.addEventListener('change', () => commitOpeningRevealFramePatch())
openingRevealEmbed.addEventListener('change', () => commitOpeningRevealFramePatch())
openingRevealInset.addEventListener('change', () => commitOpeningRevealFramePatch())

function commitOpeningArchPatch(patch?: {
  enabled?: boolean
  form?: ArchFormId
  riseCm?: number | null
  voussoirs?: boolean
  keystoneCount?: number | null
  jambCount?: number | null
  ringThicknessCm?: number | null
  thetaStartDeg?: number
  thetaEndDeg?: number
  spandrel?: 'bond' | 'rect'
  jambs?: boolean
}) {
  // Bogenform/-höhe: Gültigkeitsbereich (Auswahl = nur markierte Fenster/Türen).
  const refs = editArchOpeningTargets(state, editor, editScope, editFacadeYawFilter)
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((o) => o.id === ref.openingId)
    const prev = normalizeOpeningArch(opening?.arch)
    let form: ArchFormId = prev.form ?? 'rect'
    if (patch?.form != null) form = patch.form
    else if (patch?.enabled === true && form === 'rect') form = 'round'
    else if (patch?.enabled === false) form = 'rect'
    const prevForm = prev.form ?? 'rect'
    const formChanged = patch?.form != null && form !== prevForm
    const switchedToRound =
      form === 'round' &&
      (formChanged || (patch?.enabled === true && prevForm === 'rect'))
    // Keilstein-Ring nicht automatisch beim Rundbogen — nur wenn Checkbox / Patch an.
    const voussoirs =
      form !== 'round'
        ? false
        : patch?.voussoirs != null
          ? patch.voussoirs
          : openingArchVoussoirs.checked
    const nextArch: Parameters<typeof normalizeOpeningArch>[0] = {
      enabled: form !== 'rect',
      form,
      voussoirs,
      keystones: voussoirs,
      thetaStartDeg: patch?.thetaStartDeg ?? (Number(openingArchThetaStart.value) || 180),
      thetaEndDeg: patch?.thetaEndDeg ?? (Number(openingArchThetaEnd.value) || 0),
      spandrel:
        patch?.spandrel ??
        (switchedToRound && voussoirs
          ? 'rect'
          : openingArchSpandrel.value === 'rect'
            ? 'rect'
            : 'bond'),
      jambs: form === 'round' ? (patch?.jambs ?? openingArchJambs.checked) : false,
    }
    if (form === 'rect') {
      // kein Stichmaß
    } else if (patch && 'riseCm' in patch) {
      if (patch.riseCm != null && patch.riseCm > 0) nextArch.riseCm = snapArchRiseCm(patch.riseCm)
    } else if (!formChanged && prev.riseCm != null) {
      nextArch.riseCm = prev.riseCm
    } else if (!formChanged && openingArchRise.dataset.manual === '1') {
      const n = Number(openingArchRise.value)
      if (Number.isFinite(n) && n > 0) nextArch.riseCm = snapArchRiseCm(n)
    }
    if (patch && 'keystoneCount' in patch) {
      if (patch.keystoneCount != null) nextArch.keystoneCount = patch.keystoneCount
    } else if (prev.keystoneCount != null) {
      nextArch.keystoneCount = prev.keystoneCount
    } else {
      const n = Number(openingArchCount.value)
      if (Number.isFinite(n) && openingArchCount.dataset.manual === '1') {
        nextArch.keystoneCount = n
      }
    }
    if (patch && 'jambCount' in patch) {
      if (patch.jambCount != null) nextArch.jambCount = patch.jambCount
    } else if (prev.jambCount != null) {
      nextArch.jambCount = prev.jambCount
    } else if (openingArchJambCount.dataset.manual === '1') {
      const n = Number(openingArchJambCount.value)
      if (Number.isFinite(n)) nextArch.jambCount = n
    }
    if (patch && 'ringThicknessCm' in patch) {
      if (patch.ringThicknessCm != null) nextArch.ringThicknessCm = patch.ringThicknessCm
    } else if (prev.ringThicknessCm != null) {
      nextArch.ringThicknessCm = prev.ringThicknessCm
    } else if (openingArchRing.dataset.manual === '1') {
      const n = Number(openingArchRing.value)
      if (Number.isFinite(n)) nextArch.ringThicknessCm = n
    }
    next = updateOpening(next, ref.wallId, ref.openingId, {
      arch: normalizeOpeningArch(nextArch),
    })
  }
  commitState(next)
  syncOpeningPositionControls()
}


function ensureOpeningArchFormCards(): void {
  if (!openingArchFormCards || openingArchFormCards.childElementCount > 0) return
  for (const form of ARCH_FORM_IDS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tpl-card opening-arch-form-btn'
    btn.dataset.form = form
    btn.title = archFormLabel(form)
    btn.setAttribute('role', 'option')
    const thumb = document.createElement('div')
    thumb.className = 'tpl-card-thumb'
    thumb.ariaHidden = 'true'
    thumb.innerHTML = archFormPreviewSvg(form)
    const label = document.createElement('span')
    label.textContent = archFormLabel(form)
    btn.append(thumb, label)
    openingArchFormCards.appendChild(btn)
  }
}

function syncOpeningArchFormCards(form: ArchFormId): void {
  ensureOpeningArchFormCards()
  for (const btn of openingArchFormCards.querySelectorAll<HTMLButtonElement>('.opening-arch-form-btn')) {
    btn.classList.toggle('active', btn.dataset.form === form)
  }
}

function fillArchThumbPlaceholders(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-arch-thumb]')) {
    const id = el.dataset.archThumb
    if (!id || el.childElementCount > 0) continue
    if ((ARCH_FORM_IDS as readonly string[]).includes(id)) {
      el.innerHTML = archFormPreviewSvg(id as ArchFormId)
    }
  }
}

ensureOpeningArchFormCards()
fillArchThumbPlaceholders()
openingArchFormCards.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.opening-arch-form-btn')
  if (!btn?.dataset.form) return
  const form = btn.dataset.form as ArchFormId
  commitOpeningArchPatch({ form, enabled: form !== 'rect' })
})
openingArchRise.addEventListener('change', () => {
  openingArchRise.dataset.manual = '1'
  const n = Number(openingArchRise.value)
  if (!Number.isFinite(n) || n <= 0) return
  commitOpeningArchPatch({ riseCm: snapArchRiseCm(n) })
})
openingArchRiseAuto.addEventListener('click', () => {
  openingArchRise.dataset.manual = '0'
  commitOpeningArchPatch({ riseCm: null })
})

openingArchEnabled.addEventListener('change', () => {
  commitOpeningArchPatch({ enabled: openingArchEnabled.checked })
})
openingArchVoussoirs.addEventListener('change', () => {
  commitOpeningArchPatch({ voussoirs: openingArchVoussoirs.checked })
})
openingArchJambs.addEventListener('change', () => {
  commitOpeningArchPatch({ jambs: openingArchJambs.checked })
})
openingArchJambCount.addEventListener('change', () => {
  openingArchJambCount.dataset.manual = '1'
  const n = Number(openingArchJambCount.value)
  if (!Number.isFinite(n)) return
  commitOpeningArchPatch({ jambCount: clampJambCount(n) })
})
openingArchJambCountAuto.addEventListener('click', () => {
  openingArchJambCount.dataset.manual = '0'
  commitOpeningArchPatch({ jambCount: null })
})
openingArchCount.addEventListener('change', () => {
  openingArchCount.dataset.manual = '1'
  const n = Number(openingArchCount.value)
  if (!Number.isFinite(n)) return
  commitOpeningArchPatch({ keystoneCount: n })
})
openingArchCountAuto.addEventListener('click', () => {
  openingArchCount.dataset.manual = '0'
  commitOpeningArchPatch({ keystoneCount: null })
})
openingArchRing.addEventListener('change', () => {
  openingArchRing.dataset.manual = '1'
  const n = Number(openingArchRing.value)
  if (!Number.isFinite(n)) return
  commitOpeningArchPatch({ ringThicknessCm: n })
})
openingArchRingAuto.addEventListener('click', () => {
  openingArchRing.dataset.manual = '0'
  commitOpeningArchPatch({ ringThicknessCm: null })
})
openingArchThetaStart.addEventListener('change', () => {
  commitOpeningArchPatch({ thetaStartDeg: Number(openingArchThetaStart.value) || 180 })
})
openingArchThetaEnd.addEventListener('change', () => {
  commitOpeningArchPatch({ thetaEndDeg: Number(openingArchThetaEnd.value) || 0 })
})
openingArchSpandrel.addEventListener('change', () => {
  commitOpeningArchPatch({
    spandrel: openingArchSpandrel.value === 'rect' ? 'rect' : 'bond',
  })
})



stairsEnabled.addEventListener('change', () => {
  commitStairPatch({ enabled: stairsEnabled.checked })
  syncDoorStairsControls()
})
stairsCount.addEventListener('change', () => commitStairPatch({ count: Number(stairsCount.value) }))
stairsRise.addEventListener('change', () => {
  commitStairPatch({ rise: snapStairMeasure(Number(stairsRise.value), STUDIO_MASONRY, 48) })
})
stairsTread.addEventListener('change', () => {
  commitStairPatch({ tread: snapStairMeasure(Number(stairsTread.value), STUDIO_MASONRY, 96) })
})
stairsLandingDepth.addEventListener('change', () => {
  commitStairPatch({
    landingDepth: snapStairMeasure(Number(stairsLandingDepth.value), STUDIO_MASONRY, 192),
  })
})
stairsExtend.addEventListener('change', () => {
  const value = snapStairMeasure(Number(stairsExtend.value), 0, 192)
  commitStairPatch({ extendLeft: value, extendRight: value })
})
stairsSplay.addEventListener('change', () => {
  const value = snapStairMeasure(Number(stairsSplay.value), 0, 96)
  commitStairPatch({ splayLeft: value, splayRight: value })
})

rollerShutterEnabled.addEventListener('change', () => {
  commitRollerShutterPatch({ enabled: rollerShutterEnabled.checked })
  syncRollerShutterControls()
})

function setRollerDropFromUi(pct: number, live: boolean) {
  const drop = Math.max(0, Math.min(1, pct / 100))
  rollerShutterDrop.value = String(Math.round(drop * 100))
  rollerShutterDropPct.value = String(Math.round(drop * 100))
  rollerShutterDropLabel.textContent = rollerDropLabel(drop)
  commitRollerShutterPatch({ drop }, { liveDrop: live })
}

rollerShutterDrop.addEventListener('input', () => {
  setRollerDropFromUi(Number(rollerShutterDrop.value), true)
})
rollerShutterDrop.addEventListener('change', () => {
  setRollerDropFromUi(Number(rollerShutterDrop.value), false)
})
rollerShutterDropPct.addEventListener('change', () => {
  setRollerDropFromUi(Number(rollerShutterDropPct.value), false)
})
rollerShutterFinish.addEventListener('change', () => {
  commitRollerShutterPatch({
    finish: rollerShutterFinish.value as 'matte' | 'glossy' | 'metal',
  })
})
rollerShutterSlatHeight.addEventListener('change', () => {
  commitRollerShutterPatch({ slatHeightCm: Number(rollerShutterSlatHeight.value) })
})
rollerShutterGap.addEventListener('change', () => {
  commitRollerShutterPatch({ gapCm: Number(rollerShutterGap.value) })
})
rollerShutterDuration.addEventListener('change', () => {
  const durationMs = Math.max(80, Math.round(Number(rollerShutterDuration.value) || 1800))
  const sel = selectedWindowOpening()
  if (!sel) return
  const shutter = normalizeOpeningRollerShutter(sel.opening.rollerShutter)
  if (rollerShutterPhase === 'raise') {
    commitRollerShutterPatch({
      motion: { raise: { ...shutter.motion!.raise, durationMs }, lower: shutter.motion!.lower },
    })
  } else {
    commitRollerShutterPatch({
      motion: { raise: shutter.motion!.raise, lower: { ...shutter.motion!.lower, durationMs } },
    })
  }
})
for (const btn of document.querySelectorAll<HTMLButtonElement>('#roller-shutter-phase-group .preset-btn')) {
  btn.addEventListener('click', () => {
    const phase = btn.dataset.rollerPhase
    if (phase !== 'raise' && phase !== 'lower') return
    rollerShutterPhase = phase
    syncRollerShutterControls()
  })
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('#roller-shutter-preset-group .preset-btn')) {
  btn.addEventListener('click', () => {
    const id = btn.dataset.rollerPreset
    if (id !== 'soft' && id !== 'linear') return
    commitRollerShutterPatch({ motion: rollerShutterMotionPreset(id) })
  })
}
rollerShutterPlayLower.addEventListener('click', () => playRollerShutter('lower'))
rollerShutterPlayRaise.addEventListener('click', () => playRollerShutter('raise'))
rollerShutterPlayCycle.addEventListener('click', () => playRollerShutter('cycle'))
rollerShutterStop.addEventListener('click', () => {
  if (!rollerShutterPlayback) return
  const drop = Number(rollerShutterDrop.value) / 100
  const refs = rollerShutterPlayback.refs
  rollerShutterPlayback = null
  syncRollerShutterStopButton()
  commitState(updateOpeningRollerShutter(state, refs, { drop }))
})

for (const button of profileEdgeButtons) {
  button.addEventListener('click', () => {
    const refs = scopedOpeningRefs()
    if (refs.length === 0) return
    const edge = button.dataset.edge as OpeningEdge
    const selected = editor.selectedEdges.includes(edge)
    const nextEdges = selected
      ? editor.selectedEdges.filter((item) => item !== edge)
      : [...editor.selectedEdges, edge]

    let next = state
    const profileId = activeFrameProfileId()
    if (profileId) {
      if (selected) {
        next = removeProfilesFromOpenings(next, refs, [edge])
      } else {
        next = assignProfilesToOpenings(next, refs, [edge], profileId)
      }
    }

    commitState(next, { ...editor, selectedEdges: nextEdges })
  })
}

function commitOpeningTrim(patch: Partial<OpeningTrimConfig>) {
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningTrim(state, refs, patch))
}

profileCornerJoinSelect.addEventListener('change', () => {
  commitOpeningTrim({
    cornerJoin: profileCornerJoinSelect.value as OpeningTrimConfig['cornerJoin'],
  })
})

profileOffsetXInput.addEventListener('change', () => {
  commitOpeningTrim({ offsetX: Number(profileOffsetXInput.value) || 0 })
})

profileOffsetYInput.addEventListener('change', () => {
  commitOpeningTrim({ offsetY: Number(profileOffsetYInput.value) || 0 })
})

profileOffsetForwardInput.addEventListener('change', () => {
  commitOpeningTrim({ offsetForward: Number(profileOffsetForwardInput.value) || 0 })
})

profileScaleInput.addEventListener('change', () => {
  const scale = Math.min(8, Math.max(0.25, Number(profileScaleInput.value) || 1))
  profileScaleInput.value = String(scale)
  commitOpeningTrim({ scale })
})

profileExtentOutInput.addEventListener('change', () => {
  const n = Number(profileExtentOutInput.value)
  commitOpeningTrim({
    extentOutCm: Number.isFinite(n) && n > 0 ? n : undefined,
  })
})
profileExtentForwardInput.addEventListener('change', () => {
  const n = Number(profileExtentForwardInput.value)
  commitOpeningTrim({
    extentForwardCm: Number.isFinite(n) && n > 0 ? n : undefined,
  })
})

profileRotateCcwButton.addEventListener('click', () => {
  const current = Number(trimValueForSelection('rotationDeg')) || 0
  commitOpeningTrim({ rotationDeg: (current + 270) % 360 })
})

profileRotateCwButton.addEventListener('click', () => {
  const current = Number(trimValueForSelection('rotationDeg')) || 0
  commitOpeningTrim({ rotationDeg: (current + 90) % 360 })
})

profileFlipOutwardButton.addEventListener('click', () => {
  commitOpeningTrim({ flipOutward: !Boolean(trimValueForSelection('flipOutward')) })
})

profileFlipForwardButton.addEventListener('click', () => {
  commitOpeningTrim({ flipForward: !Boolean(trimValueForSelection('flipForward')) })
})

svgView.setWallsMoveHandler((positions, commit) => {
  if (commit) {
    finishDragUndo()
    wallMoveDragBase = null
    applyState(moveWalls(state, positions, { flush: true }), editor)
    return
  }
  beginDragUndo()
  if (!wallMoveDragBase) wallMoveDragBase = cloneFacadeState(state)
  const next = moveWalls(wallMoveDragBase, positions, { flush: false })
  previewMeshDrag(next, editor, () => {
    facade.applyLiveWallOffsets(
      wallMoveDragBase!,
      state,
      positions.map((item) => item.id),
    )
  })
})

svgView.setOpeningSelectHandler((wallId, id, additive, openingPart) => {
  selectOpening(wallId, id, additive, openingPart)
})

svgView.setWallSelectHandler((id, additive) => {
  selectWall(id, additive)
})

svgView.setContextMenuHandler((event, hit) => {
  showElementContextMenu(event.clientX, event.clientY, hit)
})

svgView.setOpeningsMoveHandler((dx, dy, commit, source) => {
  const inSel = editor.selectedOpenings.some(
    (ref) => ref.wallId === source.wallId && ref.openingId === source.openingId,
  )
  const refs = inSel ? scopedOpeningRefs() : [source]
  if (commit) {
    openingDragBase = null
    facade.clearOpeningGuides()
    svgView.clearOpeningGuides()
    commitState(state, {
      ...editor,
      selectedOpenings: inSel ? editor.selectedOpenings : [source],
      selectedWallIds: [...new Set(refs.map((ref) => ref.wallId))],
    })
    return
  }
  if (dx === 0 && dy === 0) return
  if (!openingDragBase) openingDragBase = cloneFacadeState(state)
  let next = openingDragBase
  for (const ref of refs) {
    next = moveOpening(next, ref.wallId, ref.openingId, dx, dy, { mode: 'drag' })
  }
  previewOpeningDrag(next, refs, () => {
    facade.applyLiveOpeningOffsets(openingDragBase!, state, refs)
  })
  refreshOpeningGuides(source.wallId, source.openingId)
})

function refreshOpeningGuides(wallId: string, openingId: string) {
  const sourceWall = getWall(state, wallId)
  const sourceOpening = sourceWall?.openings.find((o) => o.id === openingId)
  if (!sourceWall || !sourceOpening) {
    facade.clearOpeningGuides()
    svgView.clearOpeningGuides()
    return
  }
  const inSel = editor.selectedOpenings.some(
    (ref) => ref.wallId === wallId && ref.openingId === openingId,
  )
  const refs = (inSel ? scopedOpeningRefs() : [{ wallId, openingId }]).filter((ref) => {
    const w = getWall(state, ref.wallId)
    const o = w?.openings.find((item) => item.id === ref.openingId)
    return o?.type === sourceOpening.type
  })
  const byWall = computeOpeningGuidesForRefs(getAllWalls(state), refs)
  const distByWall = computeOpeningDistanceLinesForRefs(getAllWalls(state), refs)
  if (byWall.size === 0 && distByWall.size === 0) {
    facade.clearOpeningGuides()
    svgView.clearOpeningGuides()
    return
  }
  const wallIds = new Set([...byWall.keys(), ...distByWall.keys()])
  const batch = [...wallIds].map((id) => ({
    wall: getWall(state, id)!,
    wallId: id,
    guides: byWall.get(id) ?? [],
    distanceLines: distByWall.get(id) ?? [],
  }))
  facade.setOpeningGuidesBatch(batch.map(({ wall, guides, distanceLines }) => ({ wall, guides, distanceLines })))
  svgView.setOpeningGuidesBatch(batch.map(({ wallId, guides, distanceLines }) => ({ wallId, guides, distanceLines })))
}

const raycaster = new THREE.Raycaster()
const pointerNdc = new THREE.Vector2()
let pointerDown: {
  x: number
  y: number
  additive: boolean
} | null = null

// Pending-Click-State: selectOpening wird erst beim pointerup ohne Bewegung ausgeführt
let planNavPendingSelect: {
  wallId: string
  openingId: string
  shiftKey: boolean
  openingPart?: OpeningPart
} | null = null
let drag3dPendingSelect: {
  wallId: string
  openingId: string
  shiftKey: boolean
  openingPart?: OpeningPart
} | null = null
// Ob beim aktuellen Drag bereits eine Bewegung erkannt wurde
let planNavDragMoved = false
let drag3dMoved = false

// 3D-Drag-State für Öffnungen
let drag3dOpening: { wallId: string; openingId: string } | null = null
let drag3dStartOpeningX = 0
let drag3dStartOpeningY = 0
let drag3dWallPlane: THREE.Plane | null = null
let drag3dWallCenterX = 0
let drag3dWallCenterZ = 0
let drag3dWallOriginY = 0
let drag3dWallYawRad = 0
let drag3dStartLocalHit = { x: 0, y: 0 }

/** 3D/2D: Studio-Wand per Raster verschieben (inkl. Paneel-Drag). */
let drag3dWallMove: {
  seedWallIds: string[]
  lastWallIds: string[]
  startGx: number
  startGz: number
  startState: FacadeState
  startClientX: number
  startClientY: number
  lastDgx: number
  lastDgz: number
} | null = null
let drag3dWallMoved = false

/** 3D-Drag für Wandbeschriftung (wie Öffnung auf der Fassadenebene). */
let drag3dLabel: { wallId: string } | null = null
let drag3dLabelMoved = false
let drag3dSceneLight: {
  lightId: string
  planeY: number
  /** 2D-Front: Ebene senkrecht zur Blickrichtung (Tiefe bleibt fix). */
  anchorWorld: THREE.Vector3 | null
  startState: FacadeState
} | null = null
let drag3dSceneLightMoved = false
let drag3dStartLabelX = 0
let drag3dStartLabelY = 0
/** Zierband: nur vertikal (Y) verschieben. */
let drag3dTrimBand: { wallId: string; bandId: string } | null = null
let drag3dTrimBandMoved = false
let drag3dStartTrimBandY = 0

function setup3dDragForWall(wall: Wall, opening: { x: number; y: number; width: number }): void {
  const yawDeg = wall.yawDeg ?? 0
  const yawRad = (yawDeg * Math.PI) / 180
  const outward = facadeOutward(yawDeg, wall.panelFlip ?? true)
  const normal = new THREE.Vector3(outward.x, 0, outward.z)
  const originX = wall.originX ?? wall.x
  const originZ = wall.originZ ?? 0
  const along = wallAlongDelta(yawDeg, wall.width / 2)
  const cx = originX + along.x
  const cz = originZ + along.z
  const coplanar = new THREE.Vector3(cx, wall.y, cz)
  drag3dWallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, coplanar)
  drag3dWallCenterX = originX
  drag3dWallCenterZ = originZ
  drag3dWallOriginY = wall.y
  drag3dWallYawRad = yawRad
  drag3dStartOpeningX = opening.x
  drag3dStartOpeningY = opening.y
}

function pick3dLocalAt(clientX: number, clientY: number): { x: number; y: number } | null {
  const plane = drag3dWallPlane
  if (!plane) return null
  const rect = canvas.getBoundingClientRect()
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((clientY - rect.top) / rect.height) * 2 + 1
  const tmpRay = new THREE.Raycaster()
  tmpRay.setFromCamera(new THREE.Vector2(nx, ny), getActiveCamera())
  const hit = new THREE.Vector3()
  if (!tmpRay.ray.intersectPlane(plane, hit)) return null
  const cos = Math.cos(drag3dWallYawRad)
  const sin = Math.sin(drag3dWallYawRad)
  const dx = hit.x - drag3dWallCenterX
  const dz = hit.z - drag3dWallCenterZ
  return {
    x: dx * cos - dz * sin,
    y: hit.y - drag3dWallOriginY,
  }
}

function pick3dLocal(event: PointerEvent): { x: number; y: number } | null {
  return pick3dLocalAt(event.clientX, event.clientY)
}

function pickNearestFacadeHit(ray: THREE.Ray): {
  wall: Wall
  t: number
  localX: number
  localY: number
} | null {
  let best: { wall: Wall; t: number; localX: number; localY: number } | null = null
  for (const wall of getAllWalls(state)) {
    if (!isStudioWall(wall) || wall.hidden) continue
    const building = findBuildingForWall(state, wall.id)
    if (building?.hidden) continue
    const originX = wall.originX ?? wall.x
    const originZ = wall.originZ ?? 0
    const n = facadeOutward(wall.yawDeg ?? 0, wall.panelFlip ?? true)
    const denom = ray.direction.x * n.x + ray.direction.z * n.z
    if (Math.abs(denom) < 1e-8) continue
    const t = ((originX - ray.origin.x) * n.x + (originZ - ray.origin.z) * n.z) / denom
    if (t < 0.05) continue
    const px = ray.origin.x + ray.direction.x * t
    const py = ray.origin.y + ray.direction.y * t
    const pz = ray.origin.z + ray.direction.z * t
    const yawRad = ((wall.yawDeg ?? 0) * Math.PI) / 180
    const dx = px - originX
    const dz = pz - originZ
    const localX = dx * Math.cos(yawRad) - dz * Math.sin(yawRad)
    const localY = py - wall.y
    if (localX < -2 || localX > wall.width + 2) continue
    if (localY < -2 || localY > wall.height + 2) continue
    if (!best || t < best.t) best = { wall, t, localX, localY }
  }
  return best
}

function pickFromEvent(event: { clientX: number; clientY: number }): {
  wallId?: string
  openingId?: string
  openingPart?: OpeningPart
  wallPart?: NonNullable<EditorState['selectedWallPart']>
  bandId?: string
  ceiling?: { buildingId: string; floorIndex: number }
  sceneLightId?: string
} | null {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, getActiveCamera())
  const lightHits = raycaster.intersectObject(sceneLightRuntime.root, true)
  if (lightHits.length > 0) {
    const sceneLightId = sceneLightRuntime.pickObject(lightHits[0]!.object)
    if (sceneLightId) return { sceneLightId }
  }
  const hits = raycaster.intersectObjects(
    [
      facade.indoorFloorGroup,
      facade.claddingGroup,
      facade.profileGroup,
      facade.windowGroup,
      facade.casingGroup,
      facade.wallGroup,
    ],
    true,
  )
  const front = pickNearestFacadeHit(raycaster.ray)
  const behindSlack = 6

  const resolveCeilingHit = (
    object: THREE.Object3D,
  ): { ceiling: { buildingId: string; floorIndex: number } } | null => {
    let current: THREE.Object3D | null = object
    while (current) {
      const role = current.userData.indoorRole as string | undefined
      const kind = current.userData.kind as string | undefined
      if (role === 'ceiling' || kind === 'ceiling') {
        const buildingId = current.userData.buildingId as string | undefined
        const floorIndex = current.userData.floorIndex as number | undefined
        if (buildingId && floorIndex !== undefined) {
          return { ceiling: { buildingId, floorIndex } }
        }
      }
      current = current.parent
    }
    return null
  }

  const resolveHit = (
    object: THREE.Object3D,
  ): {
    wallId: string
    openingId?: string
    openingPart?: OpeningPart
    wallPart?: NonNullable<EditorState['selectedWallPart']>
    bandId?: string
  } | null => {
    let current: THREE.Object3D | null = object
    while (current) {
      const wallId = current.userData.wallId as string | undefined
      const openingId = current.userData.openingId as string | undefined
      const kind = current.userData.kind as string | undefined
      const openingPart = current.userData.openingPart as OpeningPart | undefined
      const wallPart = current.userData.wallPart as EditorState['selectedWallPart'] | undefined
      const bandId = current.userData.bandId as string | undefined
      if (wallId && kind === 'opening' && openingId) {
        return { wallId, openingId, openingPart: openingPart ?? 'group' }
      }
      if (wallId && kind === 'wall' && wallPart && wallPart !== 'group') {
        return { wallId, wallPart, bandId }
      }
      if (wallId && kind === 'wall') {
        return { wallId, wallPart: 'group' as const }
      }
      current = current.parent
    }
    return null
  }

  const isBehindFrontFacade = (distance: number, wallId?: string) =>
    Boolean(front && distance > front.t + behindSlack && wallId !== front.wall.id)

  for (const hit of hits) {
    const ceiling = resolveCeilingHit(hit.object)
    if (!ceiling) continue
    if (front && hit.distance > front.t + behindSlack) continue
    return ceiling
  }
  for (const hit of hits) {
    const resolved = resolveHit(hit.object)
    if (!resolved) continue
    if (isBehindFrontFacade(hit.distance, resolved.wallId)) continue
    if (resolved.openingId && resolved.openingPart === 'stairs') return resolved
    if (resolved.openingId) return resolved
    if (resolved.wallId && !resolved.openingId) {
      const wall = getWall(state, resolved.wallId)
      if (!wall) return resolved
      const originX = wall.originX ?? wall.x
      const originZ = wall.originZ ?? 0
      const yawRad = ((wall.yawDeg ?? 0) * Math.PI) / 180
      const dx = hit.point.x - originX
      const dz = hit.point.z - originZ
      const localX = dx * Math.cos(yawRad) - dz * Math.sin(yawRad)
      const localY = hit.point.y - wall.y
      const opening = wall.openings.find((item) => openingContainsPoint(item, localX, localY))
      if (opening) {
        return { wallId: wall.id, openingId: opening.id, openingPart: 'group' }
      }
      return resolved
    }
  }
  if (front) {
    const opening = front.wall.openings.find(
      (item) => !item.hidden && openingContainsPoint(item, front.localX, front.localY),
    )
    if (opening) {
      return { wallId: front.wall.id, openingId: opening.id, openingPart: 'group' }
    }
    return { wallId: front.wall.id, wallPart: 'group' }
  }
  return null
}

function isSelectablePickHit(hit: ReturnType<typeof pickFromEvent>): boolean {
  if (!hit) return false
  return Boolean(hit.wallId || hit.openingId || hit.ceiling || hit.sceneLightId)
}


function offsetStudioWallsByGrid(
  facadeState: FacadeState,
  wallIds: string[],
  dgx: number,
  dgz: number,
): FacadeState | null {
  if (dgx === 0 && dgz === 0) return facadeState
  const idSet = new Set(wallIds)
  const buildingNow =
    facadeState.buildings.find((b) => b.id === facadeState.activeBuildingId) ?? facadeState.buildings[0]
  if (buildingNow && selectionLockedToUnselected(buildingNow.walls, idSet)) {
    planStatus.textContent = 'Zuerst Wand lösen (Rechtsklick)'
    return null
  }
  let dx = dgx * PLAN_GRID
  let dz = dgz * PLAN_GRID
  // Magnet: Endpunkte in Reichweite an Nachbarenden ziehen (auch bei ungeraden Wandbreiten)
  const MAGNET_CM = PLAN_GRID
  const fixedEnds: Array<{ x: number; z: number }> = []
  for (const wall of buildingNow?.walls ?? []) {
    if (!isStudioWall(wall) || idSet.has(wall.id)) continue
    const floorY = currentFloor * activeWallHeight(facadeState)
    if (Math.abs((wall.y ?? 0) - floorY) >= 1) continue
    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    fixedEnds.push(s, e)
  }
  let bestDist = MAGNET_CM + 1e-6
  let bestAdj: { dx: number; dz: number } | null = null
  for (const wall of buildingNow?.walls ?? []) {
    if (!idSet.has(wall.id) || !isStudioWall(wall)) continue
    for (const pt of [wallStartPoint(wall), wallEndPoint(wall)]) {
      const mx = pt.x + dx
      const mz = pt.z + dz
      for (const t of fixedEnds) {
        const d = Math.hypot(mx - t.x, mz - t.z)
        if (d < bestDist) {
          bestDist = d
          bestAdj = { dx: dx + (t.x - mx), dz: dz + (t.z - mz) }
        }
      }
    }
  }
  if (bestAdj) {
    dx = bestAdj.dx
    dz = bestAdj.dz
  }
  let next = updateActiveBuilding(facadeState, (building) => ({
    ...building,
    walls: building.walls.map((wall) => {
      if (!idSet.has(wall.id) || !isStudioWall(wall)) return wall
      return {
        ...wall,
        originX: (wall.originX ?? wall.x) + dx,
        originZ: (wall.originZ ?? 0) + dz,
        x: wall.x + dx,
      }
    }),
  }))
  const building = next.buildings.find((b) => b.id === next.activeBuildingId) ?? next.buildings[0]
  for (const wall of building?.walls ?? []) {
    if (!idSet.has(wall.id) || !isStudioWall(wall)) continue
    if (studioWallsCollideIdentical(building.walls, wall, idSet)) {
      planStatus.textContent = 'Verschieben würde Wände überlagern'
      return null
    }
  }
  next = finalizeStudioGeometry(next)
  return next
}

function tryStartBuildingDrag(event: PointerEvent): boolean {
  if (floorPlanMode === 'draw') return false
  const grid = pickPlanGridFromEvent(event)
  if (!grid) return false
  const picked = floorPlanView.pickBuildingAtGrid(state.buildings, grid.gx, grid.gz)
  if (!picked) return false
  if (editor.selectedBuildingId !== picked) {
    selectBuilding(picked)
  }
  const building = state.buildings.find((b) => b.id === picked)
  const bounds = building ? planGridBoundsForBuilding(building) : null
  if (!bounds) return false
  planBuildingDrag = {
    buildingId: picked,
    startBounds: bounds,
    startGx: grid.gx,
    startGz: grid.gz,
    startState: cloneFacadeState(state),
  }
  planBuildingDragMoved = false
  canvas.setPointerCapture(event.pointerId)
  return true
}

canvas.addEventListener('pointerdown', (event) => {
  if (currentView === 'front') {
    if (event.button === 2 || event.button === 1) {
      const lightHit = pickFromEvent(event)
      if (lightHit?.sceneLightId) return
      event.preventDefault()
      frontPanActive = true
      frontPanLastX = event.clientX
      frontPanLastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
      return
    }
    if (event.button === 0 && event.shiftKey && !isSelectablePickHit(pickFromEvent(event))) {
      event.preventDefault()
      frontPanActive = true
      frontPanLastX = event.clientX
      frontPanLastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
      return
    }
  }
  if (currentView === 'top') {
    if (event.button === 0 && (event.metaKey || event.ctrlKey || modKeyHeld)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      beginNav3d(event)
      return
    }
    if (event.button === 1) {
      event.preventDefault()
      planPanActive = true
      planPanLastX = event.clientX
      planPanLastZ = event.clientY
      canvas.setPointerCapture(event.pointerId)
      return
    }
    if (event.button === 0 && event.shiftKey && !isSelectablePickHit(pickFromEvent(event))) {
      event.preventDefault()
      planPanActive = true
      planPanLastX = event.clientX
      planPanLastZ = event.clientY
      canvas.setPointerCapture(event.pointerId)
      return
    }
  }
  if (event.button !== 0 || !isSceneEditView()) return

  const additive = event.shiftKey || event.metaKey || event.ctrlKey

  if (currentView === '3d') controls.enabled = false

  const hit = pickFromEvent(event)
  if (hit?.sceneLightId) {
    const light = sceneLightById(state, hit.sceneLightId)
    selectSceneLight(hit.sceneLightId)
    if (light && (currentView === '3d' || currentView === 'front')) {
      drag3dSceneLight = {
        lightId: hit.sceneLightId,
        planeY: light.y,
        anchorWorld:
          currentView === 'front' ? sceneLightLocalToWorld(light, new THREE.Vector3()) : null,
        startState: cloneFacadeState(state),
      }
      drag3dSceneLightMoved = false
      if (currentView === '3d') controls.enabled = false
      canvas.setPointerCapture(event.pointerId)
    }
    return
  }
  if (hit?.ceiling) {
    selectCeiling(hit.ceiling.buildingId, hit.ceiling.floorIndex)
    return
  }
  if (hit?.openingId && hit.wallId) {
    const wall = getWall(state, hit.wallId)
    const opening = wall?.openings.find(o => o.id === hit.openingId)
    if (wall && opening && isStudioWall(wall)) {
      drag3dOpening = { wallId: hit.wallId, openingId: hit.openingId }
      setup3dDragForWall(wall, opening)
      drag3dStartLocalHit = pick3dLocal(event) ?? { x: opening.x, y: opening.y }
      drag3dMoved = false
      const alreadySelected3d = editor.selectedOpenings.some(
        (r) => r.wallId === hit.wallId && r.openingId === hit.openingId,
      )
      if (!alreadySelected3d || additive) {
        selectOpening(hit.wallId, hit.openingId, additive, hit.openingPart)
        drag3dPendingSelect = null
      } else {
        drag3dPendingSelect = {
          wallId: hit.wallId,
          openingId: hit.openingId,
          shiftKey: false,
          openingPart: hit.openingPart,
        }
      }
      canvas.setPointerCapture(event.pointerId)
      return
    }
  }
  if (hit?.wallId && !hit.openingId) {
    const wall = getWall(state, hit.wallId)
    if (wall && isStudioWall(wall) && canEditWallNow(hit.wallId)) {
      if (hit.wallPart === 'trimBand' && hit.bandId) {
        const band = wallTrimBands(wall).find((item) => item.id === hit.bandId)
        if (band) {
          selectWall(hit.wallId, additive, 'trimBand', hit.bandId)
          drag3dTrimBand = { wallId: hit.wallId, bandId: hit.bandId }
          drag3dTrimBandMoved = false
          drag3dStartTrimBandY = band.yFromBottom
          setup3dDragForWall(wall, {
            x: wall.width / 2,
            y: band.yFromBottom,
            width: 1,
          })
          drag3dStartLocalHit =
            pick3dLocal(event) ?? { x: wall.width / 2, y: band.yFromBottom }
          canvas.setPointerCapture(event.pointerId)
          return
        }
      }
      selectWall(hit.wallId, additive, hit.wallPart ?? 'group', hit.bandId)
      if (hit.wallPart === 'label' && wallHasLabel(wall)) {
        const label = wallLabel(wall)
        drag3dLabel = { wallId: hit.wallId }
        drag3dLabelMoved = false
        drag3dStartLabelX = label.x ?? wall.width / 2
        drag3dStartLabelY = label.y ?? wall.height / 2
        setup3dDragForWall(wall, {
          x: drag3dStartLabelX,
          y: drag3dStartLabelY,
          width: 1,
        })
        drag3dStartLocalHit =
          pick3dLocal(event) ?? { x: drag3dStartLabelX, y: drag3dStartLabelY }
        canvas.setPointerCapture(event.pointerId)
        return
      }
      // Zierband / Gesims / Sockel: kein Wand-Drag in der Grundrissebene
      if (
        hit.wallPart === 'trimBand' ||
        hit.wallPart === 'cornice' ||
        hit.wallPart === 'plinth' ||
        hit.wallPart === 'label'
      ) {
        return
      }
      const grid = pickGroundGridFromClient(event.clientX, event.clientY)
      if (grid) {
        const seeds = expandPlanLinkedWallIds(
          activeBuilding().walls,
          editor.selectedWallIds.length > 0 && editor.selectedWallIds.includes(hit.wallId)
            ? [...editor.selectedWallIds]
            : [hit.wallId],
        )
        const wallIds = wallIdsForMoveDrag(state, seeds, false)
        drag3dWallMove = {
          seedWallIds: seeds,
          lastWallIds: wallIds,
          startGx: grid.gx,
          startGz: grid.gz,
          startState: cloneFacadeState(state),
          startClientX: event.clientX,
          startClientY: event.clientY,
          lastDgx: 0,
          lastDgz: 0,
        }
        drag3dWallMoved = false
        canvas.setPointerCapture(event.pointerId)
        return
      }
    }
  }
  pointerDown = { x: event.clientX, y: event.clientY, additive }
})

canvas.addEventListener('pointermove', (event) => {
  if (currentView === 'front' && frontPanActive) {
    panFrontByPixels(event.clientX - frontPanLastX, event.clientY - frontPanLastY)
    frontPanLastX = event.clientX
    frontPanLastY = event.clientY
    return
  }
  if (currentView === 'top' && planPanActive) {
    panPlanByPixels(event.clientX - planPanLastX, event.clientY - planPanLastZ)
    planPanLastX = event.clientX
    planPanLastZ = event.clientY
    return
  }

  if (currentView === '3d' && moveNav3d(event)) return
  if (currentView === 'top' && moveNav3d(event)) return

  if (isSceneEditView() && drag3dSceneLight) {
    const pos =
      currentView === 'front' && drag3dSceneLight.anchorWorld
        ? pickSceneLightOnViewPlane(
            event.clientX,
            event.clientY,
            drag3dSceneLight.anchorWorld,
          )
        : pickWorldOnHorizontalPlane(event.clientX, event.clientY, drag3dSceneLight.planeY)
    if (!pos) return
    drag3dSceneLightMoved = true
    state = updateSceneLight(state, drag3dSceneLight.lightId, { x: pos.x, z: pos.z })
    syncSceneLightRuntime()
    syncSceneLightToolbar()
    markViewportDirty()
    if (currentView === '3d') render3dFrame()
    return
  }

  if (isSceneEditView() && drag3dWallMove) {
    const dist2 =
      (event.clientX - drag3dWallMove.startClientX) ** 2 +
      (event.clientY - drag3dWallMove.startClientY) ** 2
    if (!drag3dWallMoved && dist2 < 36) return
    drag3dWallMoved = true
    if (currentView === '3d') controls.enabled = false
    const grid = pickGroundGridFromClient(event.clientX, event.clientY)
    if (!grid) return
    const dgx = grid.gx - drag3dWallMove.startGx
    const dgz = grid.gz - drag3dWallMove.startGz
    if (dgx === drag3dWallMove.lastDgx && dgz === drag3dWallMove.lastDgz) return
    const wallIds = wallIdsForMoveDrag(
      drag3dWallMove.startState,
      drag3dWallMove.seedWallIds,
      event.shiftKey,
    )
    const next = offsetStudioWallsByGrid(
      drag3dWallMove.startState,
      wallIds,
      dgx,
      dgz,
    )
    if (!next) {
      drag3dWallMove.lastDgx = dgx
      drag3dWallMove.lastDgz = dgz
      updateWallMoveDockHighlight(drag3dWallMove.lastWallIds)
      return
    }
    drag3dWallMove.lastDgx = dgx
    drag3dWallMove.lastDgz = dgz
    drag3dWallMove.lastWallIds = wallIds
    previewMeshDrag(
      next,
      {
        ...editor,
        selectedWallIds: wallIds,
        selectedOpenings: [],
      },
      () => {
        facade.applyLiveWallOffsets(drag3dWallMove!.startState, state, wallIds)
      },
    )
    updateWallMoveDockHighlight(wallIds)
    return
  }

  if (isSceneEditView() && drag3dLabel) {
    drag3dLabelMoved = true
    if (currentView === '3d') controls.enabled = false
    const wall = getWall(state, drag3dLabel.wallId)
    if (wall) {
      const local = pick3dLocal(event)
      if (local !== null) {
        const newX = Math.round((drag3dStartLabelX + local.x - drag3dStartLocalHit.x) / STUDIO_MASONRY) * STUDIO_MASONRY
        const newY = Math.round((drag3dStartLabelY + local.y - drag3dStartLocalHit.y) / STUDIO_MASONRY) * STUDIO_MASONRY
        const clampedX = Math.max(0, Math.min(wall.width, newX))
        const clampedY = Math.max(0, Math.min(wall.height, newY))
        const label = wallLabel(wall)
        if (clampedX !== label.x || clampedY !== label.y) {
          if (!labelDragBase) labelDragBase = cloneFacadeState(state)
          const next = updateWallLabel(labelDragBase, [drag3dLabel.wallId], {
            x: clampedX,
            y: clampedY,
          })
          previewMeshDrag(next, editor, () => {
            facade.applyLiveLabelOffset(labelDragBase!, state, drag3dLabel!.wallId)
          })
          const updated = getWall(state, drag3dLabel.wallId)
          if (updated) syncLabelControls(updated)
        }
      }
    }
    return
  }

  if (isSceneEditView() && drag3dTrimBand) {
    drag3dTrimBandMoved = true
    if (currentView === '3d') controls.enabled = false
    const wall = getWall(state, drag3dTrimBand.wallId)
    if (wall) {
      const local = pick3dLocal(event)
      if (local !== null) {
        const newY =
          Math.round(
            (drag3dStartTrimBandY + local.y - drag3dStartLocalHit.y) / STUDIO_MASONRY,
          ) * STUDIO_MASONRY
        const clampedY = Math.max(0, Math.min(wall.height, newY))
        const band = wallTrimBands(wall).find((item) => item.id === drag3dTrimBand!.bandId)
        if (band && clampedY !== band.yFromBottom) {
          if (!trimDragBase) trimDragBase = cloneFacadeState(state)
          const next = patchWallTrimBand(
            trimDragBase,
            [drag3dTrimBand.wallId],
            drag3dTrimBand.bandId,
            { yFromBottom: clampedY },
            { anchorWallId: drag3dTrimBand.wallId, scope: 'element' },
          )
          previewMeshDrag(next, editor, () => {
            facade.applyLiveTrimOffset(
              trimDragBase!,
              state,
              drag3dTrimBand!.wallId,
              drag3dTrimBand!.bandId,
            )
          })
          const updated = getWall(state, drag3dTrimBand.wallId)
          if (updated) syncTrimBandsControls(updated)
        }
      }
    }
    return
  }

  if (isSceneEditView() && drag3dOpening) {
    drag3dMoved = true
    const wall = getWall(state, drag3dOpening.wallId)
    if (wall) {
      const local = pick3dLocal(event)
      if (local !== null) {
        // Absolut vom Drag-Start (Base-State) — kein Inkrement auf schon gesnapptem x (sonst Springen).
        const dx = local.x - drag3dStartLocalHit.x
        const dy = local.y - drag3dStartLocalHit.y
        if (!openingDragBase) openingDragBase = cloneFacadeState(state)
        const inSel = editor.selectedOpenings.some(
          (r) => r.wallId === drag3dOpening!.wallId && r.openingId === drag3dOpening!.openingId,
        )
        const refs = inSel ? scopedOpeningRefs() : [drag3dOpening]
        let next = openingDragBase
        for (const ref of refs) {
          next = moveOpening(next, ref.wallId, ref.openingId, dx, dy, { mode: 'drag' })
        }
        const opening = wall.openings.find((item) => item.id === drag3dOpening!.openingId)
        const moved = getWall(next, drag3dOpening.wallId)?.openings.find(
          (item) => item.id === drag3dOpening!.openingId,
        )
        if (
          opening &&
          moved &&
          (Math.abs(moved.x - opening.x) > 1e-6 || Math.abs(moved.y - opening.y) > 1e-6)
        ) {
          previewOpeningDrag(next, refs, () => {
            facade.applyLiveOpeningOffsets(openingDragBase!, state, refs)
          })
          refreshOpeningGuides(drag3dOpening!.wallId, drag3dOpening!.openingId)
          showWallFacePlacementGrid(placementGridGroup, wall, getAllWalls(state))
        }
      }
    }
    return
  }
})

canvas.addEventListener('dblclick', (event) => {
  if (currentView === 'front' && event.button === 0) {
    event.preventDefault()
    const { nx, ny } = canvasNdcFromClient(event.clientX, event.clientY)
    const { halfW, halfH } = frontFrustumHalfExtents()
    const factor = DBLCLICK_ZOOM_FACTOR
    const nextPan = zoomPanOffsetsAtCursor({
      nx,
      ny,
      factor,
      panX: frontPanScreenX,
      panY: frontPanScreenY,
      halfW,
      halfH,
    })
    startViewZoomAnim('front', {
      frontZoom: clampFrontZoom(frontZoom * factor),
      frontPanX: nextPan.panX,
      frontPanY: nextPan.panY,
    })
    return
  }
  if (currentView === 'top' && event.button === 0) {
    event.preventDefault()
    startViewZoomAnim('top', planZoomTargetAtClient(event.clientX, event.clientY, DBLCLICK_ZOOM_FACTOR))
    return
  }
  if (currentView !== '3d' || !isGalleryModeActive() || event.button !== 0) return
  const hit = pickWallAtClient(event.clientX, event.clientY)
  if (!hit) return
  const wall = getWall(state, hit.wallId)
  if (!wall) return
  event.preventDefault()
  selectWall(hit.wallId, false)
  focusGalleryOnWalls([wall], true)
  planStatus.textContent = 'Galerie: Orbit um die gewählte Wand'
})

canvas.addEventListener('pointerup', (event) => {
  if (currentView === '3d') {
    if (event.button === 2) {
      controls.enablePan = false
      if (orbitLite && !nav3d) setOrbitLite(false)
    }
    const navResult = endNav3d(event)
    if (navResult === 'drag') return
    if (navResult === 'click') {
      handleNav3dClick(event)
      return
    }
  }
  if (currentView === 'top') {
    const navResult = endNav3d(event)
    if (navResult === 'drag') return
  }
  if (currentView === 'top' && planPanActive) {
    planPanActive = false
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }
  if (currentView === 'front' && frontPanActive) {
    frontPanActive = false
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }
  if (event.button !== 0 || !isSceneEditView()) return

  if (isSceneEditView() && drag3dSceneLight) {
    if (drag3dSceneLightMoved) {
      commitState(state, {
        ...createDefaultEditorState(),
        selectedSceneLightId: drag3dSceneLight.lightId,
      })
      flushSunShadowMap()
      planStatus.textContent = 'Punktlicht verschoben'
    }
    drag3dSceneLight = null
    drag3dSceneLightMoved = false
    if (currentView === '3d') controls.enabled = true
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }

  if (isSceneEditView() && drag3dWallMove) {
    if (drag3dWallMoved) {
      const movedIds = [...drag3dWallMove.lastWallIds]
      commitState(state, {
        ...editor,
        selectedWallIds: movedIds,
        selectedOpenings: [],
      })
      planStatus.textContent = 'Wand verschoben'
      promptJoinIfTouching(movedIds)
    } else if (drag3dWallMove.lastWallIds.length === 1) {
      const hit = pickFromEvent(event)
      selectWall(
        drag3dWallMove.lastWallIds[0]!,
        false,
        hit?.wallPart ?? editor.selectedWallPart ?? 'group',
      )
    }
    drag3dWallMove = null
    drag3dWallMoved = false
    wallMoveDragBase = null
    clearWallDockPreview()
    if (currentView === '3d') controls.enabled = true
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }

  if (isSceneEditView() && drag3dLabel) {
    if (drag3dLabelMoved) {
      commitState(state, {
        ...editor,
        selectedWallIds: [drag3dLabel.wallId],
        selectedWallPart: 'label',
        selectedOpenings: [],
      })
      planStatus.textContent = 'Schrift verschoben'
    }
    drag3dLabel = null
    drag3dLabelMoved = false
    labelDragBase = null
    drag3dWallPlane = null
    if (currentView === '3d') controls.enabled = true
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }

  if (isSceneEditView() && drag3dTrimBand) {
    if (drag3dTrimBandMoved) {
      commitState(state, {
        ...editor,
        selectedWallIds: [drag3dTrimBand.wallId],
        selectedWallPart: 'trimBand',
        selectedTrimBandId: drag3dTrimBand.bandId,
        selectedOpenings: [],
      })
      planStatus.textContent = 'Zierband verschoben'
    }
    drag3dTrimBand = null
    drag3dTrimBandMoved = false
    trimDragBase = null
    drag3dWallPlane = null
    if (currentView === '3d') controls.enabled = true
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }

  if (isSceneEditView() && drag3dOpening) {
    if (!drag3dMoved && drag3dPendingSelect) {
      selectOpening(
        drag3dPendingSelect.wallId,
        drag3dPendingSelect.openingId,
        drag3dPendingSelect.shiftKey,
        drag3dPendingSelect.openingPart,
      )
    }
    drag3dPendingSelect = null
    drag3dMoved = false
    facade.clearOpeningGuides()
    svgView.clearOpeningGuides()
    clearPlacementGridOverlay()
    commitState(state)
    drag3dOpening = null
    openingDragBase = null
    drag3dWallPlane = null
    if (currentView === '3d') controls.enabled = true
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    return
  }

  if (currentView === '3d') {
    controls.enabled = true
  }

  if (!pointerDown) return
  const dx = event.clientX - pointerDown.x
  const dy = event.clientY - pointerDown.y
  const additive = pointerDown.additive
  pointerDown = null

  if (dx * dx + dy * dy > 16) return
  if (trySwapDraftWallSegmentAtClick(event)) return
  const hit = pickFromEvent(event)
  if (!hit) {
    selectWall(null, additive)
    return
  }
  if (hit.sceneLightId) {
    selectSceneLight(hit.sceneLightId)
    return
  }
  if (hit.ceiling) {
    selectCeiling(hit.ceiling.buildingId, hit.ceiling.floorIndex)
    return
  }
  if (hit.openingId && hit.wallId) {
    selectOpening(hit.wallId, hit.openingId, additive, hit.openingPart)
    return
  }
  if (hit.wallId) {
    selectWall(hit.wallId, additive, hit.wallPart ?? 'group')
  }
})

canvas.addEventListener('pointercancel', (event) => {
  if (currentView === '3d') {
    endNav3d(event)
    return
  }
  if (currentView === 'top' && planPanActive) {
    planPanActive = false
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }
  if (currentView === 'front' && frontPanActive) {
    frontPanActive = false
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }
})

function wallsForElevation(): Wall[] {
  const elev = currentElevation
  if (elev.kind === 'all') return getAllWalls(state)
  if (elev.kind === 'yaw') return wallsForYaw(getAllWalls(state), elev.yaw)
  if (elev.kind === 'wall') return getAllWalls(state).filter((w) => w.id === elev.wallId)
  return getAllWalls(state)
}

function applyElevation() {
  resetFrontNav()
  svgView.setElevation(currentElevation)
  if (currentView === 'front') syncFrontView()
  applySunLighting({ updateShadowMap: true })
  updateViewCompass()
}

let lastCompassKey = ''

function updateViewCompass() {
  let yaw = 0
  if (currentView === '3d') {
    const lookX = controls.target.x - camera.position.x
    const lookZ = controls.target.z - camera.position.z
    yaw = viewedFacadeYaw(lookX, lookZ)
  } else if (currentView === 'top') {
    yaw = topViewYawDeg
  } else if (currentElevation.kind === 'yaw') {
    yaw = currentElevation.yaw
  } else if (currentElevation.kind === 'wall') {
    yaw = getWall(state, currentElevation.wallId)?.yawDeg ?? 0
  } else {
    const studio = getAllWalls(state).find(isStudioWall)
    yaw = studio?.yawDeg ?? 0
  }
  const label = wallCompassLabel(yaw)
  const needleDeg = (360 - yaw) % 360
  const compassKey = `${currentView}:${label}:${Math.round(needleDeg)}:${currentElevation.kind}`
  if (compassKey === lastCompassKey) {
    viewCompass.hidden = false
    return
  }
  lastCompassKey = compassKey
  viewCompassLabel.textContent = label
  viewCompassNeedle.setAttribute('transform', `rotate(${needleDeg} 44 44)`)
  viewCompass.querySelectorAll<SVGTextElement>('.view-compass-cardinal').forEach((el) => {
    const cardYaw = Number(el.dataset.yaw)
    el.classList.toggle('active', currentElevation.kind === 'yaw' && currentElevation.yaw === cardYaw)
  })
  viewCompass.hidden = false
}

function setView(mode: AppView) {
  const leavingExport = currentView === 'export' && mode !== 'export'
  const enteringExport = mode === 'export' && currentView !== 'export'
  if (enteringExport) {
    exportChromeSnapshot = {
      leftCollapsed: isUiLeftCollapsed(),
      bottomCollapsed: appRoot.classList.contains('ui-bottom-collapsed'),
    }
    setUiLeftCollapsed(true)
    appRoot.classList.add('ui-bottom-collapsed')
  }
  if (leavingExport && exportChromeSnapshot) {
    setUiLeftCollapsed(exportChromeSnapshot.leftCollapsed)
    appRoot.classList.toggle('ui-bottom-collapsed', exportChromeSnapshot.bottomCollapsed)
    exportChromeSnapshot = null
  }

  currentView = mode
  if (mode !== '3d' && (orbitLite || nav3d || orbitLitePointer)) {
    orbitLitePointer = false
    if (nav3d) endNav3d()
    else setOrbitLite(false)
  }
  const app = document.getElementById('app')
  viewport.classList.toggle('view-front', mode === 'front')
  viewport.classList.toggle('view-3d', mode === '3d')
  viewport.classList.toggle('view-top', mode === 'top')
  viewport.classList.toggle('view-export', mode === 'export')
  app?.classList.toggle('view-front', mode === 'front')
  app?.classList.toggle('view-3d', mode === '3d')
  app?.classList.toggle('view-top', mode === 'top')
  app?.classList.toggle('view-export', mode === 'export')
  syncViewChromeButtons()
  controls.enabled = mode === '3d'
  planSidebar.hidden = true
  planLabelLayer.hidden = true
  floorPlanView.root.visible = false

  exportStage.hidden = mode !== 'export'
  exportSidebar.hidden = mode !== 'export'
  uiRightMain.hidden = mode === 'export'

  if (mode === 'front' || mode === '3d' || mode === 'top') {
    applySceneAppearance()
    setFacadeMeshesVisible(true)
  }

  // 2D-Aufriss Farbe: Paneele empfangen Werfschatten (Nord). Zeichnung und
  // Streiflicht (Ost/West bei Südsonne) aus — sonst Mauerwerk-Schraffur.
  syncCladdingReceiveShadows()
  if (facadeReady) {
    facade.setOrthographicGlassSeeThrough(mode === 'front')
  }

  persistApp()
  syncSiteTransform()
  applySunLighting()

  if (mode === 'top') {
    planZoom = 1
    topViewYawDeg = currentElevation.kind === 'yaw' ? currentElevation.yaw : 0
    framePlanCameraToContent()
    ground.visible = true
    updateGroundPlane()
  }

  if (mode === 'front' || mode === '3d' || mode === 'top') {
    resizeCanvasView()
  }

  if (mode === 'front') {
    applyElevation()
    centerSvgViewScroll()
  }

  updateViewCompass()

  if (mode === '3d') {
    ground.visible = true
    updateGroundPlane()
    if (!cameraInitialized) {
      initCameraTarget()
    }
    focusCameraExterior(getAllWalls(state))
  }

  if (mode === 'export') {
    ensureExportState()
    syncExportSidebar()
    void refreshExportPreview()
  }

  renderUi()

  requestAnimationFrame(positionToolbar)
  markViewportDirty()
}

function syncViewChromeButtons() {
  for (const btn of viewModeButtons) {
    btn.classList.toggle('active', btn.dataset.chrome === currentView)
  }
  for (const btn of renderStyleButtons) {
    btn.classList.toggle('active', btn.dataset.chrome === currentRenderStyle)
  }
  viewLineStrokeRow.hidden = currentRenderStyle !== 'line'
}

function applyLineStrokeScale() {
  const scale = sceneAppearance.lineStrokeScale
  svgView.setLineStrokeScale(scale)
  facade.setLineStrokeScale(scale)
  floorPlanView.setLineStrokeScale(scale)
  rebuildFloorPlanOverlay()
  if (currentView === '3d') {
    facade.setLineResolution(viewportRenderWidth(), viewportRenderHeight())
  }
}

function syncSceneLineStrokeInputs() {
  const scale = sceneAppearance.lineStrokeScale
  sceneLineStroke.value = String(scale)
  sceneLineStrokeNum.value = String(scale)
  sceneLineStrokeValue.textContent = scale.toFixed(2)
}

viewBtnTop.addEventListener('click', () => {
  setView('top')
})
viewBtnFront.addEventListener('click', () => {
  setView('front')
})
viewBtn3d.addEventListener('click', () => {
  setView('3d')
})
viewBtnExport.addEventListener('click', () => {
  setView('export')
})

const exportStage = document.querySelector<HTMLDivElement>('#export-stage')!
const exportGrid = document.querySelector<HTMLDivElement>('#export-grid')!
const exportSidebar = document.querySelector<HTMLElement>('#export-sidebar')!
const uiRightMain = document.querySelector<HTMLDivElement>('#ui-right-main')!
const exportOrientPortrait = document.querySelector<HTMLButtonElement>('#export-orient-portrait')!
const exportOrientLandscape = document.querySelector<HTMLButtonElement>('#export-orient-landscape')!
const exportAspectGroup = document.querySelector<HTMLDivElement>('#export-aspect-group')!
const exportViewToggles = document.querySelector<HTMLDivElement>('#export-view-toggles')!
const exportWallpaper = document.querySelector<HTMLInputElement>('#export-wallpaper')!
const exportWallpaperOptions = document.querySelector<HTMLDivElement>('#export-wallpaper-options')!
const exportWallpaperPct = document.querySelector<HTMLInputElement>('#export-wallpaper-pct')!
const exportPassepartoutPct = document.querySelector<HTMLInputElement>('#export-passepartout-pct')!
const exportPassepartoutColor = document.querySelector<HTMLInputElement>('#export-passepartout-color')!
const exportDownloadPng = document.querySelector<HTMLButtonElement>('#export-download-png')!
const exportDownloadJpg = document.querySelector<HTMLButtonElement>('#export-download-jpg')!

let exportUiState: ExportModeUiState | null = null
let exportChromeSnapshot: { leftCollapsed: boolean; bottomCollapsed: boolean } | null = null
const exportCaptureCache = new Map<string, HTMLCanvasElement>()

function buildingFacadeYaws(): number[] {
  const walls = getAllWalls(state).filter(isStudioWall)
  return [...new Set(walls.map((wall) => normalizeYawDeg(wall.yawDeg ?? 0)))].sort((a, b) => a - b)
}

function ensureExportState() {
  const yaws = buildingFacadeYaws()
  if (!exportUiState) exportUiState = createDefaultExportState(yaws)
  else exportUiState = syncExportSlotsWithYaws(exportUiState, yaws)
}

function focusedExportSlot() {
  ensureExportState()
  const stateUi = exportUiState!
  return (
    stateUi.slots.find((slot) => slot.id === stateUi.focusedSlotId) ??
    stateUi.slots.find((slot) => slot.enabled) ??
    stateUi.slots[0] ??
    null
  )
}

function aspectButtonLabel(aspectId: ExportAspectId, orientation: ExportOrientation): string {
  const [a, b] = aspectId.split(':')
  if (aspectId === '1:1') return '1:1'
  return orientation === 'portrait' ? `${a}:${b}` : `${b}:${a}`
}

function syncExportSidebar() {
  ensureExportState()
  const ui = exportUiState!
  exportOrientPortrait.classList.toggle('active', ui.orientation === 'portrait')
  exportOrientLandscape.classList.toggle('active', ui.orientation === 'landscape')
  for (const btn of exportAspectGroup.querySelectorAll<HTMLButtonElement>('[data-aspect]')) {
    const id = btn.dataset.aspect as ExportAspectId
    btn.classList.toggle('active', id === ui.aspectId)
    btn.textContent = aspectButtonLabel(id, ui.orientation)
  }
  exportViewToggles.replaceChildren()
  for (const slot of ui.slots) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'preset-btn'
    btn.textContent = exportSlotLabel(slot.view)
    btn.classList.toggle('active', slot.enabled)
    btn.addEventListener('click', () => {
      slot.enabled = !slot.enabled
      if (slot.enabled) ui.focusedSlotId = slot.id
      syncExportSidebar()
      void refreshExportPreview()
    })
    exportViewToggles.appendChild(btn)
  }
  exportWallpaper.checked = ui.wallpaper
  exportWallpaperOptions.hidden = !ui.wallpaper
  exportWallpaperPct.value = String(ui.wallpaperTopPct)
  const focused = focusedExportSlot()
  if (focused) {
    exportPassepartoutPct.value = String(focused.passepartoutPct)
    exportPassepartoutColor.value = focused.passepartoutColor
  }
}

function captureExportView(view: ExportViewKind, width: number, height: number): HTMLCanvasElement {
  const key = `${view.kind === 'top' ? 'top' : `yaw-${normalizeYawDeg(view.yaw)}`}:${width}x${height}`
  const cached = exportCaptureCache.get(key)
  if (cached) return cached

  const prevSize = renderer.getSize(new THREE.Vector2())
  const prevPR = renderer.getPixelRatio()
  const prevGround = ground.visible
  const prevSkyVisible = atmosphereSky.root.visible
  facade.forceAllHighDetail()
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)

  let cam: THREE.Camera = frontCamera
  if (view.kind === 'yaw') {
    ground.visible = false
    atmosphereSky.setVisible(false)
    applyFrontCameraView({ width, height, yaw: view.yaw, fitOnly: true })
    cam = frontCamera
  } else {
    ground.visible = true
    atmosphereSky.setVisible(true)
    framePlanCameraToContent()
    syncPlanCamera(
      topCamera,
      width / height,
      planZoom,
      planOffsetX,
      planOffsetZ,
      topViewYawDeg,
      sceneContentMaxY(),
    )
    cam = topCamera
  }

  renderer.render(scene, cam)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.drawImage(renderer.domElement, 0, 0, width, height)

  ground.visible = prevGround
  atmosphereSky.setVisible(prevSkyVisible)
  renderer.setPixelRatio(prevPR)
  renderer.setSize(Math.max(1, prevSize.x), Math.max(1, prevSize.y), false)
  exportCaptureCache.set(key, out)
  return out
}

function clearExportCaptureCache() {
  exportCaptureCache.clear()
}

async function refreshExportPreview() {
  if (currentView !== 'export') return
  ensureExportState()
  const ui = exportUiState!
  const ratio = exportFrameAspectRatio(ui.orientation, ui.aspectId)
  exportGrid.replaceChildren()
  const enabled = ui.slots.filter((slot) => slot.enabled)
  const captureSize = exportFramePixelSize(ui.orientation, ui.aspectId, 960)

  for (const slot of enabled) {
    const card = document.createElement('div')
    card.className = 'export-slot'
    card.classList.toggle('is-focused', slot.id === ui.focusedSlotId)
    card.addEventListener('click', () => {
      ui.focusedSlotId = slot.id
      syncExportSidebar()
      for (const el of exportGrid.querySelectorAll('.export-slot')) {
        el.classList.toggle('is-focused', el === card)
      }
    })
    const frame = document.createElement('div')
    frame.className = 'export-slot-frame'
    frame.style.aspectRatio = `${ratio}`
    frame.style.background = slot.passepartoutColor
    const pad = `${slot.passepartoutPct}%`
    const topInset = ui.wallpaper
      ? `calc(${slot.passepartoutPct}% + ${ui.wallpaperTopPct}%)`
      : pad
    if (ui.wallpaper) {
      const safe = document.createElement('div')
      safe.className = 'export-wallpaper-safe'
      safe.style.height = `${ui.wallpaperTopPct}%`
      frame.appendChild(safe)
    }
    const img = document.createElement('img')
    img.alt = exportSlotLabel(slot.view)
    const captured = captureExportView(slot.view, captureSize.width, captureSize.height)
    img.src = captured.toDataURL('image/png')
    img.style.left = pad
    img.style.right = pad
    img.style.bottom = pad
    img.style.top = topInset
    img.style.width = 'auto'
    img.style.height = 'auto'
    img.style.maxWidth = `calc(100% - ${slot.passepartoutPct * 2}%)`
    img.style.maxHeight = ui.wallpaper
      ? `calc(100% - ${slot.passepartoutPct * 2}% - ${ui.wallpaperTopPct}%)`
      : `calc(100% - ${slot.passepartoutPct * 2}%)`
    img.style.margin = 'auto'
    img.style.objectFit = 'contain'
    frame.appendChild(img)
    card.appendChild(frame)
    const label = document.createElement('div')
    label.className = 'export-slot-label'
    label.textContent = exportSlotLabel(slot.view)
    card.appendChild(label)
    exportGrid.appendChild(card)
  }
}

function downloadExportComposite(format: 'png' | 'jpg') {
  ensureExportState()
  const ui = exportUiState!
  const enabled = ui.slots.filter((slot) => slot.enabled)
  if (enabled.length === 0) return
  const size = exportFramePixelSize(ui.orientation, ui.aspectId)
  const frames = enabled.map((slot) => ({
    image: captureExportView(slot.view, size.width, size.height),
    slot,
  }))
  const composed = composeExportGrid(frames, size.width, size.height, ui.wallpaper, ui.wallpaperTopPct)
  if (format === 'png') {
    downloadCanvasBlob(composed, buildExportFilename('png'), 'image/png')
  } else {
    downloadCanvasBlob(composed, buildExportFilename('jpg'), 'image/jpeg', EXPORT_JPG_QUALITY)
  }
}

exportOrientPortrait.addEventListener('click', () => {
  ensureExportState()
  exportUiState!.orientation = 'portrait'
  syncExportSidebar()
  void refreshExportPreview()
})
exportOrientLandscape.addEventListener('click', () => {
  ensureExportState()
  exportUiState!.orientation = 'landscape'
  syncExportSidebar()
  void refreshExportPreview()
})
exportAspectGroup.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-aspect]')
  if (!btn) return
  ensureExportState()
  exportUiState!.aspectId = btn.dataset.aspect as ExportAspectId
  syncExportSidebar()
  void refreshExportPreview()
})
exportWallpaper.addEventListener('change', () => {
  ensureExportState()
  exportUiState!.wallpaper = exportWallpaper.checked
  syncExportSidebar()
  void refreshExportPreview()
})
exportWallpaperPct.addEventListener('change', () => {
  ensureExportState()
  exportUiState!.wallpaperTopPct = Math.max(4, Math.min(24, Number(exportWallpaperPct.value) || 11))
  syncExportSidebar()
  void refreshExportPreview()
})
exportPassepartoutPct.addEventListener('change', () => {
  ensureExportState()
  const focused = focusedExportSlot()
  if (!focused) return
  focused.passepartoutPct = Math.max(0, Math.min(30, Number(exportPassepartoutPct.value) || 0))
  void refreshExportPreview()
})
exportPassepartoutColor.addEventListener('input', () => {
  ensureExportState()
  const focused = focusedExportSlot()
  if (!focused) return
  focused.passepartoutColor = exportPassepartoutColor.value
  void refreshExportPreview()
})
exportDownloadPng.addEventListener('click', () => downloadExportComposite('png'))
exportDownloadJpg.addEventListener('click', () => downloadExportComposite('jpg'))

const viewGalleryBtn = document.querySelector<HTMLButtonElement>('#view-gallery-btn')!
const gallerySettingsSection = document.querySelector<HTMLElement>('#gallery-settings-section')!
const gallerySpacingInput = document.querySelector<HTMLInputElement>('#gallery-spacing')!
const galleryReshuffleBtn = document.querySelector<HTMLButtonElement>('#gallery-reshuffle')!
const galleryExitBtn = document.querySelector<HTMLButtonElement>('#gallery-exit')!

const galleryHost: GalleryModeHost = {
  getFacade: () => state,
  getEditor: () => editor,
  applyTransient(facade, nextEditor) {
    applyState(facade, nextEditor)
  },
  restoreProject(facade, nextEditor) {
    applyState(facade, nextEditor)
  },
  focusExterior() {
    focusCameraExterior(getAllWalls(state))
  },
  setView3d() {
    if (currentView !== '3d') setView('3d')
  },
  onGalleryActiveChange(active) {
    appRoot.classList.toggle('gallery-mode', active)
    if (active) {
      applyGalleryOrbitTuning()
    } else {
      clearGalleryOrbitTuning()
    }
    syncSceneToolbarTabs()
    planStatus.textContent = active
      ? 'Galerie: Wand anklicken = Orbit darum; Doppelklick = heranzoomen'
      : ''
  },
}

initGalleryUi(galleryHost, {
  enterBtn: viewGalleryBtn,
  exitBtn: galleryExitBtn,
  spacingInput: gallerySpacingInput,
  reshuffleBtn: galleryReshuffleBtn,
  section: gallerySettingsSection,
})
viewBtnColor.addEventListener('click', () => {
  setRenderStyle('color')
})
viewBtnLine.addEventListener('click', () => {
  setRenderStyle('line')
})
document.querySelector('#light-presentation-btn')?.addEventListener('click', () => {
  setPresentationMode('draft')
})
document.querySelector('#edit-presentation-btn')?.addEventListener('click', () => {
  setPresentationMode('preview')
})
document.querySelector('#render-presentation-btn')?.addEventListener('click', () => {
  setPresentationMode('render')
})

navHelpButton.addEventListener('click', () => {
  navHelpDialog.showModal()
})

initReleaseNotesUi(appVersionBtn, releaseNotesDialog, releaseNotesBody, releaseNotesRepoLink)
initCreditsUi(appCreditsBtn, creditsDialog, creditsBody)

function setRenderStyle(style: 'color' | 'line') {
  currentRenderStyle = style
  facade.setRenderStyle(style)
  svgView.setRenderStyle(style)
  floorPlanView.setRenderStyle(style)
  syncCladdingReceiveShadows()
  applySceneAppearance()
  applyLineStrokeScale()
  syncViewChromeButtons()
  rebuildFloorPlanOverlay()
}

function bindSunSlider(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  apply: (value: number) => void,
  format: (value: number) => string,
) {
  input.addEventListener('input', () => {
    const value = Number.parseFloat(input.value)
    apply(value)
    output.textContent = format(value)
    applySunLighting({ live: true })
    if (sunSliderPersistTimer) window.clearTimeout(sunSliderPersistTimer)
    if (!sunPathAnimating) {
      sunSliderPersistTimer = window.setTimeout(() => {
        sunSliderPersistTimer = 0
        persistApp()
      }, 400)
    }
  })
  input.addEventListener('change', () => {
    flushSunShadowMap()
    if (sunSliderPersistTimer) {
      window.clearTimeout(sunSliderPersistTimer)
      sunSliderPersistTimer = 0
    }
    if (!sunPathAnimating) persistApp()
  })
}

let sunPathAnimFrame = 0
let sunPathAnimating = false

function stopSunPathAnimation(persist = true) {
  if (sunPathAnimFrame) cancelAnimationFrame(sunPathAnimFrame)
  sunPathAnimFrame = 0
  sunPathAnimating = false
  sunPathPlayButton.hidden = false
  sunPathStopButton.hidden = true
  flushSunShadowMap()
  if (persist) persistApp()
}

function startSunPathAnimation() {
  stopSunPathAnimation(false)
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  const { fromHours, toHours, approxHint } = resolveAnimTimeRange(sunSettings)
  sunAnimHint.hidden = !approxHint
  const start = fromHours
  const end = toHours
  const duration = Math.max(1, sunSettings.animDurationSec) * 1000
  const t0 = performance.now()
  const followCompass = sunSettings.animUseCompass
  const camFromAz = sunSettings.animFromAzimuth
  const camToAz = sunSettings.animToAzimuth
  sunPathAnimating = true
  sunPathPlayButton.hidden = true
  sunPathStopButton.hidden = false

  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / duration)
    sunSettings.timeOfDay = start + (end - start) * t
    sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: true })
    sunTimeInput.value = String(sunSettings.timeOfDay)
    sunTimeValue.textContent = formatTimeOfDay(sunSettings.timeOfDay)
    sunAzimuthInput.value = String(Math.round(sunSettings.azimuth))
    sunAzimuthValue.textContent = `${Math.round(sunSettings.azimuth)}°`
    sunColorTempInput.value = String(sunSettings.colorTemperature)
    sunColorTempValue.textContent = `${Math.round(sunSettings.colorTemperature)} K`
    sunSoftnessInput.value = String(sunSettings.shadowSoftness)
    sunSoftnessValue.textContent = sunSettings.shadowSoftness.toFixed(1)
    sunIntensityInput.value = String(sunSettings.intensity)
    sunIntensityValue.textContent = sunSettings.intensity.toFixed(1)
    applySunLighting({ live: true })
    // Kamera nur bei „Himmelsrichtung“ — bei nur Uhrzeit bleibt die Nutzer-Perspektive
    if (followCompass) {
      orbitViewToSunAzimuth(lerpYawDeg(camFromAz, camToAz, t))
    }
    if (t < 1 && sunPathAnimating) {
      sunPathAnimFrame = requestAnimationFrame(tick)
    } else {
      stopSunPathAnimation(true)
    }
  }
  sunPathAnimFrame = requestAnimationFrame(tick)
}

sunDateInput.addEventListener('change', () => {
  stopSunPathAnimation(false)
  const parsed = parseDateInput(sunDateInput.value)
  if (!parsed) return
  sunSettings.month = parsed.month
  sunSettings.day = parsed.day
  commitSunFromDateTime(true)
  persistApp()
})

sunAnimUseCompass.addEventListener('change', () => {
  setSunAnimChannel('compass', sunAnimUseCompass.checked)
})
sunAnimUseTime.addEventListener('change', () => {
  setSunAnimChannel('time', sunAnimUseTime.checked)
})

sunAnimFromCompass.addEventListener('change', () => {
  sunSettings.animFromAzimuth = Number(sunAnimFromCompass.value)
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
})
sunAnimToCompass.addEventListener('change', () => {
  sunSettings.animToAzimuth = Number(sunAnimToCompass.value)
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
})
sunAnimFromTime.addEventListener('change', () => {
  const parsed = parseTimeInput(sunAnimFromTime.value)
  if (parsed === null) return
  sunSettings.animFromTime = parsed
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
})
sunAnimToTime.addEventListener('change', () => {
  const parsed = parseTimeInput(sunAnimToTime.value)
  if (parsed === null) return
  sunSettings.animToTime = parsed
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
})
sunAnimDuration.addEventListener('change', () => {
  sunSettings.animDurationSec = Number(sunAnimDuration.value)
  sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: false })
  syncSunUi()
  persistApp()
})

bindSunSlider(
  sunTimeInput,
  sunTimeValue,
  (value) => {
    stopSunPathAnimation(false)
    sunSettings.timeOfDay = value
    sunSettings = syncSunSettingsFromSolar(sunSettings, { applySolarLook: true })
    sunAzimuthInput.value = String(Math.round(sunSettings.azimuth))
    sunAzimuthValue.textContent = `${Math.round(sunSettings.azimuth)}°`
    sunColorTempInput.value = String(sunSettings.colorTemperature)
    sunColorTempValue.textContent = `${Math.round(sunSettings.colorTemperature)} K`
    sunSoftnessInput.value = String(sunSettings.shadowSoftness)
    sunSoftnessValue.textContent = sunSettings.shadowSoftness.toFixed(1)
    sunIntensityInput.value = String(sunSettings.intensity)
    sunIntensityValue.textContent = sunSettings.intensity.toFixed(1)
  },
  (value) => formatTimeOfDay(value),
)

sunPathPlayButton.addEventListener('click', () => startSunPathAnimation())
sunPathStopButton.addEventListener('click', () => stopSunPathAnimation(true))

bindSunSlider(
  sunAzimuthInput,
  sunAzimuthValue,
  (value) => {
    stopSunPathAnimation(false)
    sunSettings.azimuth = ((value % 360) + 360) % 360
  },
  (value) => `${Math.round(value)}°`,
)

bindSunSlider(
  sunIntensityInput,
  sunIntensityValue,
  (value) => {
    sunSettings.intensity = value
  },
  (value) => value.toFixed(1),
)

let sunSoftnessPersistTimer = 0

sunSoftnessInput.addEventListener('input', () => {
  const value = Number.parseFloat(sunSoftnessInput.value)
  sunSettings.shadowSoftness = value
  sunSoftnessValue.textContent = value.toFixed(1)
  applyPcssSoftnessLive()
  if (sunSoftnessPersistTimer) window.clearTimeout(sunSoftnessPersistTimer)
  if (!sunPathAnimating) {
    sunSoftnessPersistTimer = window.setTimeout(() => {
      sunSoftnessPersistTimer = 0
      persistApp()
    }, 350)
  }
})

bindSunSlider(
  sunAmbientInput,
  sunAmbientValue,
  (value) => {
    sunSettings.ambient = value
  },
  (value) => value.toFixed(2),
)

bindSunSlider(
  sunShadowContrastInput,
  sunShadowContrastValue,
  (value) => {
    sunSettings.shadowContrast = value
  },
  (value) => value.toFixed(2),
)

bindSunSlider(
  sunShadowDensityInput,
  sunShadowDensityValue,
  (value) => {
    sunSettings.shadowDensity = value
  },
  (value) => value.toFixed(2),
)

bindSunSlider(
  sunColorTempInput,
  sunColorTempValue,
  (value) => {
    sunSettings.colorTemperature = value
  },
  (value) => `${Math.round(value)} K`,
)

// ─── Szene-Farben (Hintergrund / Untergrund / Himmel für Glas) ───────────────

/** Setzt die Szenenfarben aus dem aktuellen sceneAppearance-Zustand (alle Ansichten). */
function applySceneAppearance(override?: Partial<SceneAppearance>) {
  const appearance = override ? { ...sceneAppearance, ...override } : sceneAppearance
  const line = currentRenderStyle === 'line'
  const bg = line ? '#ffffff' : appearance.background
  const groundColor = line ? '#ffffff' : appearance.ground
  const skyColor = line ? '#ffffff' : appearance.skyReflection
  groundMat.color.set(groundColor)
  setGlassSkyReflectionColor(skyColor)
  setGlassGroundReflectionColor(groundColor)
  atmosphereSky.setGroundAlbedo(groundColor)
  applySceneBackground(scene, renderer, bg)
  const wantSky = !presentationUsesWorkLikeShading(presentationMode) && !line && currentView !== 'front'
  atmosphereSky.setVisible(wantSky)
  viewport.style.background = bg
  svgContainer.style.background = bg
  applyBloomRenderer()
  applyFogToScene()
  applySunLighting({ updateShadowMap: false })
  markSceneReflectionsDirty()
  markViewportDirty()
}

function previewSceneAppearance(patch: Partial<SceneAppearance> | null) {
  if (patch === null) {
    applySceneAppearance()
    return
  }
  applySceneAppearance(patch)
}

/** Spiegelt sceneAppearance zurück in die Farb-Inputs (RGB/HSL/HEX). */
function syncSceneColorInputs() {
  if (isColorPickerSessionActive()) return
  const hostOf = (input: HTMLInputElement) => input.parentElement
  const allHost = hostOf(sceneAllColorInput)
  const bgHost = hostOf(sceneBgColorInput)
  const groundHost = hostOf(sceneGroundColorInput)
  const skyHost = hostOf(sceneSkyColorInput)
  if (allHost) {
    renderColorControl(allHost, sceneAppearance.background, applyAllSceneColors, (hex) => {
      previewSceneAppearance(hex ? { background: hex, ground: hex, skyReflection: hex } : null)
    })
  }
  if (bgHost) {
    renderColorControl(
      bgHost,
      sceneAppearance.background,
      (hex) => {
        sceneAppearance = { ...sceneAppearance, background: hex }
        applySceneAppearance()
        persistApp()
        scheduleShareHashWrite()
      },
      (hex) => previewSceneAppearance(hex ? { background: hex } : null),
    )
  }
  if (groundHost) {
    renderColorControl(
      groundHost,
      sceneAppearance.ground,
      (hex) => {
        sceneAppearance = { ...sceneAppearance, ground: hex }
        applySceneAppearance()
        persistApp()
        scheduleShareHashWrite()
      },
      (hex) => previewSceneAppearance(hex ? { ground: hex } : null),
    )
  }
  if (skyHost) {
    renderColorControl(
      skyHost,
      sceneAppearance.skyReflection,
      (hex) => {
        sceneAppearance = { ...sceneAppearance, skyReflection: hex }
        applySceneAppearance()
        persistApp()
        scheduleShareHashWrite()
      },
      (hex) => previewSceneAppearance(hex ? { skyReflection: hex } : null),
    )
  }
}

function applyAllSceneColors(hex: string) {
  sceneAppearance = {
    ...sceneAppearance,
    background: hex,
    ground: hex,
    skyReflection: hex,
  }
  syncSceneColorInputs()
  applySceneAppearance()
  persistApp()
  scheduleShareHashWrite()
  markViewportDirty()
}

function commitLineStrokeScale(value: number) {
  const scale = Math.min(3, Math.max(0.25, value))
  sceneAppearance = { ...sceneAppearance, lineStrokeScale: scale }
  syncSceneLineStrokeInputs()
  applyLineStrokeScale()
  persistApp()
}

sceneLineStroke.addEventListener('input', () => {
  commitLineStrokeScale(Number.parseFloat(sceneLineStroke.value))
})
sceneLineStrokeNum.addEventListener('input', () => {
  commitLineStrokeScale(Number.parseFloat(sceneLineStrokeNum.value))
})
sceneLineStrokeNum.addEventListener('change', () => {
  commitLineStrokeScale(Number.parseFloat(sceneLineStrokeNum.value))
})

function syncBloomUi() {
  bloomEnabledInput.checked = bloomSettings.enabled
  bloomOptions.hidden = !bloomSettings.enabled
  bloomThreshold.value = String(bloomSettings.threshold)
  bloomThresholdNum.value = String(bloomSettings.threshold)
  bloomThresholdValue.textContent = bloomSettings.threshold.toFixed(3)
  bloomStrength.value = String(bloomSettings.strength)
  bloomStrengthNum.value = String(bloomSettings.strength)
  bloomStrengthValue.textContent = bloomSettings.strength.toFixed(3)
  bloomRadius.value = String(bloomSettings.radius)
  bloomRadiusNum.value = String(bloomSettings.radius)
  bloomRadiusValue.textContent = bloomSettings.radius.toFixed(3)
  bloomExposure.value = String(bloomSettings.exposure)
  bloomExposureNum.value = String(bloomSettings.exposure)
  bloomExposureValue.textContent = bloomSettings.exposure.toFixed(3)
}

function syncFogUi() {
  fogEnabledInput.checked = fogSettings.enabled
  fogOptions.hidden = !fogSettings.enabled
  fogTypeSelect.value = fogSettings.type
  if (!isColorPickerSessionActive()) {
    const fogHost = fogColorInput.parentElement
    if (fogHost) {
      renderColorControl(fogHost, fogSettings.color, (hex) => {
        commitFogPatch({ color: hex })
      })
    }
  }
  fogLinearOptions.hidden = fogSettings.type !== 'linear'
  fogExpOptions.hidden = fogSettings.type !== 'exponential'
  fogNear.value = String(fogSettings.near)
  fogNearNum.value = String(fogSettings.near)
  fogNearValue.textContent = String(Math.round(fogSettings.near))
  fogFar.value = String(fogSettings.far)
  fogFarNum.value = String(fogSettings.far)
  fogFarValue.textContent = String(Math.round(fogSettings.far))
  fogDensity.value = String(fogSettings.density)
  fogDensityNum.value = String(fogSettings.density)
  fogDensityValue.textContent = fogSettings.density.toFixed(6)
}

function syncBloomFogUi() {
  syncBloomUi()
  syncFogUi()
}

function syncLodUi() {
  lodEnabledInput.checked = lodSettings.enabled
  lodOptions.hidden = !lodSettings.enabled
  lodPresetControls.hidden = !lodSettings.enabled
  lodTileHigh.value = String(lodSettings.thresholds.tileHighPx)
  lodTileHighNum.value = String(lodSettings.thresholds.tileHighPx)
  lodTileHighValue.textContent = lodSettings.thresholds.tileHighPx.toFixed(1)
  lodTileMedium.value = String(lodSettings.thresholds.tileMediumPx)
  lodTileMediumNum.value = String(lodSettings.thresholds.tileMediumPx)
  lodTileMediumValue.textContent = lodSettings.thresholds.tileMediumPx.toFixed(1)
  lodBuildingFar.value = String(lodSettings.thresholds.buildingFarPx)
  lodBuildingFarNum.value = String(lodSettings.thresholds.buildingFarPx)
  lodBuildingFarValue.textContent = String(Math.round(lodSettings.thresholds.buildingFarPx))
  lodSimplifyFacadeInput.checked = lodSettings.simplify.facadePattern
  lodSimplifyWindowsInput.checked = lodSettings.simplify.windows
  lodSimplifyProfilesInput.checked = lodSettings.simplify.profiles
  lodSimplifyRevealsInput.checked = lodSettings.simplify.reveals
  lodSimplifyFarHullInput.checked = lodSettings.simplify.farHull
}

function commitLodSettings(next: LodSettings) {
  lodSettings = normalizeLodSettings(next)
  facade.setLodSettings(lodSettings)
  syncLodUi()
  persistApp()
  if (currentView === '3d') {
    facade.updatePerformanceLod(camera, viewportRenderHeight())
    render3dFrame()
  }
}

function commitLodPatch(patch: {
  enabled?: boolean
  simplify?: Partial<LodSettings['simplify']>
  thresholds?: Partial<LodSettings['thresholds']>
}) {
  commitLodSettings(
    normalizeLodSettings({
      ...lodSettings,
      ...patch,
      simplify: patch.simplify ? { ...lodSettings.simplify, ...patch.simplify } : lodSettings.simplify,
      thresholds: patch.thresholds
        ? { ...lodSettings.thresholds, ...patch.thresholds }
        : lodSettings.thresholds,
    }),
  )
}

function commitBloomPatch(patch: Partial<BloomSettings>) {
  bloomSettings = normalizeBloomSettings({ ...bloomSettings, ...patch })
  applyBloomRenderer()
  // Sichtbarkeit der Optionen; Werte setzt bindSceneDualControl / Checkbox selbst.
  // Kein volles syncBloomUi() — Slider.value während input bricht den Drag ab.
  bloomEnabledInput.checked = bloomSettings.enabled
  bloomOptions.hidden = !bloomSettings.enabled
  if (patch.threshold != null) {
    bloomThreshold.value = String(bloomSettings.threshold)
    bloomThresholdNum.value = String(bloomSettings.threshold)
    bloomThresholdValue.textContent = bloomSettings.threshold.toFixed(3)
  }
  if (patch.strength != null) {
    bloomStrength.value = String(bloomSettings.strength)
    bloomStrengthNum.value = String(bloomSettings.strength)
    bloomStrengthValue.textContent = bloomSettings.strength.toFixed(3)
  }
  if (patch.radius != null) {
    bloomRadius.value = String(bloomSettings.radius)
    bloomRadiusNum.value = String(bloomSettings.radius)
    bloomRadiusValue.textContent = bloomSettings.radius.toFixed(3)
  }
  if (patch.exposure != null) {
    bloomExposure.value = String(bloomSettings.exposure)
    bloomExposureNum.value = String(bloomSettings.exposure)
    bloomExposureValue.textContent = bloomSettings.exposure.toFixed(3)
  }
  persistApp()
  syncSceneLightRuntime()
  markViewportDirty()
  if (currentView === '3d') render3dFrame()
  else if (currentView === 'front') renderLitSceneFrame(frontCamera)
}

function commitFogPatch(patch: Partial<FogSettings>) {
  fogSettings = normalizeFogSettings({ ...fogSettings, ...patch })
  applyFogToScene()
  syncFogUi()
  persistApp()
  markViewportDirty()
  if (currentView === '3d') render3dFrame()
}

function bindSceneDualControl(
  slider: HTMLInputElement,
  num: HTMLInputElement,
  output: HTMLOutputElement,
  onChange: (value: number) => void,
  format: (value: number) => string,
) {
  const apply = (raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    slider.value = String(value)
    num.value = String(value)
    output.textContent = format(value)
    onChange(value)
  }
  slider.addEventListener('input', () => apply(slider.value))
  num.addEventListener('input', () => apply(num.value))
  num.addEventListener('change', () => apply(num.value))
}

bloomEnabledInput.addEventListener('change', () => {
  commitBloomPatch({ enabled: bloomEnabledInput.checked })
})

sceneLightXInput.addEventListener('input', () => {
  patchSelectedSceneLight({ x: Number.parseFloat(sceneLightXInput.value) })
})
sceneLightYInput.addEventListener('input', () => {
  patchSelectedSceneLight({ y: Number.parseFloat(sceneLightYInput.value) })
})
sceneLightZInput.addEventListener('input', () => {
  patchSelectedSceneLight({ z: Number.parseFloat(sceneLightZInput.value) })
})
function bindSceneLightDeferredNumber(
  input: HTMLInputElement,
  apply: (value: number) => void,
): void {
  const commit = () => {
    const value = Number.parseFloat(input.value)
    if (!Number.isFinite(value)) return
    apply(value)
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      input.blur()
    }
  })
  input.addEventListener('change', commit)
}
bindSceneLightDeferredNumber(sceneLightIntensityInput, (value) => {
  patchSelectedSceneLight({ intensity: normalizePowerWatts(value) })
})
bindSceneLightDeferredNumber(sceneLightDistanceInput, (value) => {
  patchSelectedSceneLight({ distance: Math.max(0, value) })
})
bindSceneLightDeferredNumber(sceneLightDecayInput, (value) => {
  patchSelectedSceneLight({ decay: Math.min(3, Math.max(0, value)) })
})
sceneLightColorTempInput.addEventListener('input', () => {
  const kelvin = Number.parseFloat(sceneLightColorTempInput.value)
  if (!Number.isFinite(kelvin)) return
  const color = kelvinToHex(kelvin)
  sceneLightColorTempValue.textContent = `${Math.round(kelvin)} K`
  sceneLightColorSwatch.style.backgroundColor = color
  patchSelectedSceneLight({ colorTemperature: kelvin, color })
})
sceneLightShowMarkerInput.addEventListener('change', () => {
  patchSelectedSceneLight({ showMarker: sceneLightShowMarkerInput.checked })
  sceneLightMarkerSizeRow.hidden = !sceneLightShowMarkerInput.checked
})
bindSceneDualControl(
  sceneLightMarkerSizeSlider,
  sceneLightMarkerSizeNum,
  sceneLightMarkerSizeValue,
  (value) => patchSelectedSceneLight({ markerSizeCm: value }),
  (value) => String(Math.round(value)),
)
sceneLightEnabledInput.addEventListener('change', () => {
  patchSelectedSceneLight({ enabled: sceneLightEnabledInput.checked })
})
sceneLightCastShadowInput.addEventListener('change', () => {
  patchSelectedSceneLight({ castShadow: sceneLightCastShadowInput.checked })
})
sceneLightDeleteBtn.addEventListener('click', () => {
  const id = editor.selectedSceneLightId
  if (!id) return
  commitState(removeSceneLight(state, id), createDefaultEditorState())
})
bindSceneDualControl(
  sceneLightDepthSlider,
  sceneLightDepthNum,
  sceneLightDepthValue,
  (value) => patchSceneLightViewDepth(value),
  (value) => String(Math.round(value)),
)

bindSceneDualControl(
  bloomThreshold,
  bloomThresholdNum,
  bloomThresholdValue,
  (value) => commitBloomPatch({ threshold: value }),
  (value) => value.toFixed(3),
)
bindSceneDualControl(
  bloomStrength,
  bloomStrengthNum,
  bloomStrengthValue,
  (value) => commitBloomPatch({ strength: value }),
  (value) => value.toFixed(3),
)
bindSceneDualControl(
  bloomRadius,
  bloomRadiusNum,
  bloomRadiusValue,
  (value) => commitBloomPatch({ radius: value }),
  (value) => value.toFixed(3),
)
bindSceneDualControl(
  bloomExposure,
  bloomExposureNum,
  bloomExposureValue,
  (value) => commitBloomPatch({ exposure: value }),
  (value) => value.toFixed(3),
)

fogEnabledInput.addEventListener('change', () => {
  commitFogPatch({ enabled: fogEnabledInput.checked })
})

if (localStorage.getItem('perf-overlay') === '1') {
  perfOverlayEnabledInput.checked = true
  setPerfOverlayEnabled(true)
  markViewportDirty()
}
perfOverlayEnabledInput.addEventListener('change', () => {
  const on = perfOverlayEnabledInput.checked
  localStorage.setItem('perf-overlay', on ? '1' : '0')
  setPerfOverlayEnabled(on)
  if (on) markViewportDirty()
})
fogTypeSelect.addEventListener('change', () => {
  commitFogPatch({ type: fogTypeSelect.value === 'exponential' ? 'exponential' : 'linear' })
})
bindSceneDualControl(
  fogNear,
  fogNearNum,
  fogNearValue,
  (value) => commitFogPatch({ near: value }),
  (value) => String(Math.round(value)),
)
bindSceneDualControl(
  fogFar,
  fogFarNum,
  fogFarValue,
  (value) => commitFogPatch({ far: value }),
  (value) => String(Math.round(value)),
)
bindSceneDualControl(
  fogDensity,
  fogDensityNum,
  fogDensityValue,
  (value) => commitFogPatch({ density: value }),
  (value) => value.toFixed(6),
)

lodEnabledInput.addEventListener('change', () => {
  commitLodPatch({ enabled: lodEnabledInput.checked })
})

lodPresetNavigationBtn.addEventListener('click', () => {
  commitLodSettings(applyLodPreset('navigation'))
})
lodPresetBalancedBtn.addEventListener('click', () => {
  commitLodSettings(applyLodPreset('balanced'))
})
lodPresetQualityBtn.addEventListener('click', () => {
  commitLodSettings(applyLodPreset('quality'))
})

lodForceHighBtn.addEventListener('click', () => {
  facade.forceAllHighDetail()
  if (currentView === '3d') render3dFrame()
})

lodSimplifyFacadeInput.addEventListener('change', () => {
  commitLodPatch({ simplify: { facadePattern: lodSimplifyFacadeInput.checked } })
})
lodSimplifyWindowsInput.addEventListener('change', () => {
  commitLodPatch({ simplify: { windows: lodSimplifyWindowsInput.checked } })
})
lodSimplifyProfilesInput.addEventListener('change', () => {
  commitLodPatch({ simplify: { profiles: lodSimplifyProfilesInput.checked } })
})
lodSimplifyRevealsInput.addEventListener('change', () => {
  commitLodPatch({ simplify: { reveals: lodSimplifyRevealsInput.checked } })
})
lodSimplifyFarHullInput.addEventListener('change', () => {
  commitLodPatch({ simplify: { farHull: lodSimplifyFarHullInput.checked } })
})

bindSceneDualControl(
  lodTileHigh,
  lodTileHighNum,
  lodTileHighValue,
  (value) => commitLodPatch({ thresholds: { tileHighPx: value } }),
  (value) => value.toFixed(1),
)
bindSceneDualControl(
  lodTileMedium,
  lodTileMediumNum,
  lodTileMediumValue,
  (value) => commitLodPatch({ thresholds: { tileMediumPx: value } }),
  (value) => value.toFixed(1),
)
bindSceneDualControl(
  lodBuildingFar,
  lodBuildingFarNum,
  lodBuildingFarValue,
  (value) => commitLodPatch({ thresholds: { buildingFarPx: value } }),
  (value) => String(Math.round(value)),
)

saveJsonButton.addEventListener('click', () => {
  downloadFacadeJson(state)
  showShareStatus('JSON-Datei wurde heruntergeladen.')
})

loadJsonButton.addEventListener('click', () => {
  loadJsonInput.click()
})

loadJsonInput.addEventListener('change', async () => {
  const file = loadJsonInput.files?.[0]
  loadJsonInput.value = ''
  if (!file) return
  try {
    const next = await loadFacadeFromFile(file)
    editHistory.clear()
    commitState(next, createDefaultEditorState())
    showShareStatus('JSON-Entwurf geladen.')
  } catch {
    showShareStatus('JSON-Datei konnte nicht geladen werden.')
  }
})

copyLinkButton.addEventListener('click', async () => {
  try {
    const link = await copyFacadeLink(sharePayloadFromApp())
    showShareStatus(navigator.clipboard ? 'Link in Zwischenablage kopiert.' : `Link: ${link}`)
  } catch {
    showShareStatus('Link konnte nicht erstellt werden.')
  }
})

undoButton.addEventListener('click', () => {
  const previous = editHistory.undo(currentSnapshot())
  if (previous) applyState(previous.facade, previous.editor)
})

document.querySelector<HTMLButtonElement>('#plan-zoom-in')!.addEventListener('click', () => {
  planZoom = clampPlanZoom(planZoom * (1 / 0.9))
  syncTopCamera2()
})
document.querySelector<HTMLButtonElement>('#plan-zoom-out')!.addEventListener('click', () => {
  planZoom = clampPlanZoom(planZoom * 0.9)
  framePlanIfZoomedOut(0.9)
  syncTopCamera2()
})
document.querySelector<HTMLButtonElement>('#plan-zoom-reset')!.addEventListener('click', () => {
  planZoom = 1
  framePlanCameraToContent()
  syncTopCamera2()
})

redoButton.addEventListener('click', () => {
  const next = editHistory.redo(currentSnapshot())
  if (next) applyState(next.facade, next.editor)
})

window.addEventListener('keydown', (event) => {
  if (event.key === 'Meta' || event.key === 'Control') modKeyHeld = true
  if (!isTypingInInput()) {
    const mult = nudgeMultiplierFromKey(event.key, event.code)
    if (mult != null) nudgeMultiplierHeld = mult
  }

  // Wand-Preset-Drag: R wechselt die Achse der Andock-Vorschau
  if (
    activeWallDragPresetId &&
    (event.key === 'r' || event.key === 'R') &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault()
    wallDockAxisOverride = wallDockAxisOverride === 'x' ? 'z' : wallDockAxisOverride === 'z' ? 'x' : 'z'
    if (lastWallDockClient) {
      updateWallDockPreviewAtClient(lastWallDockClient.x, lastWallDockClient.y, activeWallDragPresetId)
    }
    return
  }

  const mod = event.metaKey || event.ctrlKey

  // Undo/Redo
  if (mod && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undoButton.click()
    return
  }
  if (mod && event.key === 'z' && event.shiftKey) {
    event.preventDefault()
    redoButton.click()
    return
  }

  if (handle3dCameraArrowKeys(event)) return

  // Pfeiltasten: Öffnungen in 8-cm-Schritten (Numpad 1–9 = Vielfaches; ohne ⌘/Ctrl/⇧)
  if (!mod && !event.shiftKey && isSceneEditView() && editor.selectedOpenings.length > 0) {
    const MOVE = heldNudgeStepCm()
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -MOVE
    else if (event.key === 'ArrowRight') dx = MOVE
    else if (event.key === 'ArrowUp') dy = MOVE
    else if (event.key === 'ArrowDown') dy = -MOVE
    else return
    event.preventDefault()
    event.stopImmediatePropagation()
    nudgeSelectedOpenings(dx, dy)
  }

  // 2D-Front-Zoom per Tastatur
  if (currentView === 'front') {
    if (event.key === '+' || event.key === '=' || event.key === 'NumpadAdd') {
      event.preventDefault()
      beginViewNavLite()
      frontZoom = clampFrontZoom(frontZoom * (1 / 0.9))
      syncFrontCamera()
      return
    }
    if (event.key === '-' || event.key === 'NumpadSubtract') {
      event.preventDefault()
      beginViewNavLite()
      frontZoom = clampFrontZoom(frontZoom * 0.9)
      syncFrontCamera()
      return
    }
    if ((mod && event.key === '0') || event.key === 'Numpad0' || event.key === 'Backspace') {
      if (event.key === 'Backspace' && document.activeElement?.tagName === 'INPUT') return
      event.preventDefault()
      resetFrontNav()
      syncFrontCamera()
      return
    }
  }

  // Draufsicht-Zoom per Tastatur
  if (currentView === 'top') {
    if (event.key === '+' || event.key === '=' || event.key === 'NumpadAdd') {
      event.preventDefault()
      beginViewNavLite()
      planZoom = clampPlanZoom(planZoom * (1 / 0.9))
      syncTopCamera2()
      return
    }
    if (event.key === '-' || event.key === 'NumpadSubtract') {
      event.preventDefault()
      beginViewNavLite()
      planZoom = clampPlanZoom(planZoom * 0.9)
      framePlanIfZoomedOut(0.9)
      syncTopCamera2()
      return
    }
    if ((mod && event.key === '0') || event.key === 'Numpad0' || event.key === 'Backspace') {
      // Backspace nur wenn kein draw-Modus aktiv und kein Input fokussiert
      if (event.key === 'Backspace' && (floorPlanMode === 'draw' || document.activeElement?.tagName === 'INPUT')) return
      event.preventDefault()
      planZoom = 1
      framePlanCameraToContent()
      syncTopCamera2()
      return
    }
  }
})

window.addEventListener('keyup', (event) => {
  if (event.key === 'Meta' || event.key === 'Control') modKeyHeld = false
  if (nudgeMultiplierFromKey(event.key, event.code) != null) nudgeMultiplierHeld = 1
})

window.addEventListener('blur', () => {
  modKeyHeld = false
  nudgeMultiplierHeld = 1
})

function resizeCanvasView() {
  if (currentView === 'front') {
    syncFrontView()
    return
  }
  if (currentView === 'top') {
    syncTopView()
    return
  }
  if (currentView === '3d') {
    canvas.style.left = ''
    canvas.style.top = ''
    canvas.style.width = ''
    canvas.style.height = ''
    ground.visible = true
    syncGroundDepthForView()
    syncCameraDistanceLimits()
    const width = viewportRenderWidth()
    const height = viewportRenderHeight()
    applyRendererPixelRatio()
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    resizeComposer()
    if (currentRenderStyle === 'line') {
      facade.setLineResolution(width, height)
    }
    markViewportDirty()
  }
}

window.addEventListener('resize', () => {
  if (currentView === 'front' || currentView === '3d' || currentView === 'top') {
    resizeCanvasView()
  }
  positionToolbar()
})

if (typeof ResizeObserver !== 'undefined') {
  let viewportResizeRaf = 0
  const viewportResizeObserver = new ResizeObserver(() => {
    if (viewportResizeRaf) cancelAnimationFrame(viewportResizeRaf)
    viewportResizeRaf = requestAnimationFrame(() => {
      viewportResizeRaf = 0
      resizeCanvasView()
    })
  })
  viewportResizeObserver.observe(viewportStage)
}

canvas.addEventListener('wheel', (event) => {
  if (currentView === 'front') {
    queueViewWheelZoom(event, 'front')
    return
  }
  if (currentView === 'top') {
    queueViewWheelZoom(event, 'top')
  }
}, { passive: false })

window.addEventListener('blur', () => {
  modKeyHeld = false
  if (currentView === '3d') {
    controls.enabled = true
    orbitLitePointer = false
    if (nav3d) endNav3d()
    else if (orbitLite) setOrbitLite(false)
  }
})

canvas.addEventListener(
  'pointerdown',
  (event) => {
    if (currentView !== '3d' && currentView !== 'top') return
    if (event.button === 0 && (event.metaKey || event.ctrlKey || modKeyHeld)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      beginNav3d(event)
      return
    }
    if (currentView !== '3d') return
    if (event.button === 2) {
      if (event.metaKey || event.ctrlKey) {
        controls.enablePan = true
        setOrbitLite(true)
        return
      }
      event.stopImmediatePropagation()
      return
    }
  },
  true,
)

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  if (event.metaKey || event.ctrlKey) return
  if (!isSceneEditView()) return
  const hit = pickFromEvent(event)
  if (hit) {
    showElementContextMenu(event.clientX, event.clientY, hit)
    return
  }
  const stageItems = elementPasteMenuItems()
  if (stageItems.length > 0) {
    showContextMenu(event.clientX, event.clientY, stageItems)
  }
})

controls.addEventListener('start', () => {
  orbitLitePointer = true
  setOrbitLite(true)
})
controls.addEventListener('change', () => {
  setOrbitLite(true)
  if (!orbitLitePointer && !nav3d) scheduleOrbitLiteEnd()
  syncGalleryNavigationFeel()
  markViewportDirty()
  updateWallLibraryGizmos()
})
controls.addEventListener('end', () => {
  orbitLitePointer = false
  scheduleOrbitLiteEnd()
})

function animate() {
  requestAnimationFrame(animate)
  if (openingMotionPlayback) tickOpeningMotionPlayback(performance.now())
  if (rollerShutterPlayback) tickRollerShutterPlayback(performance.now())
  const perfOn = isPerfOverlayEnabled()
  let perfT0 = 0
  if (perfOn) perfT0 = markPerfFrameStart()
  let perfRendered = false
  if (currentView === '3d') {
    if (facade.consumeWallLabelsShadowDirty()) {
      renderer.shadowMap.needsUpdate = true
      viewportDirty = true
    }
    if (
      sceneLightingReady &&
      !viewportDirty &&
      !perfOn &&
      !sunPathAnimating &&
      !openingMotionPlayback &&
      !rollerShutterPlayback
    ) {
      return
    }
    viewportDirty = false
    if (isGalleryModeActive()) syncGalleryNavigationFeel()
    if (lodSettings.enabled && !orbitLite && !openingMotionPlayback && !rollerShutterPlayback) {
      facade.updatePerformanceLod(camera, viewportRenderHeight())
    }
    render3dFrame()
    perfRendered = true
    updateViewCompass()
    // Gizmos während Orbit nur bei Bedarf — spart Traverse pro Frame.
    if (!orbitLite) updateWallLibraryGizmos()
  } else if (currentView === 'front') {
    if (
      sceneLightingReady &&
      !viewportDirty &&
      !perfOn &&
      !viewZoomAnim &&
      !sunPathAnimating &&
      !openingMotionPlayback &&
      !rollerShutterPlayback
    ) {
      return
    }
    viewportDirty = false
    renderLitSceneFrame(frontCamera)
    perfRendered = true
    if (!orbitLite) updateWallLibraryGizmos()
  } else if (currentView === 'top') {
    if (
      sceneLightingReady &&
      !viewportDirty &&
      !perfOn &&
      !viewZoomAnim &&
      !openingMotionPlayback &&
      !rollerShutterPlayback
    ) {
      return
    }
    viewportDirty = false
    if (orbitLite) {
      renderer.render(scene, topCamera)
    } else {
      renderLitSceneFrame(topCamera)
    }
    perfRendered = true
    updateViewCompass()
    if (!orbitLite) updateWallLibraryGizmos()
  }
  if (perfOn && perfRendered) markPerfFrameEnd(perfT0, renderer)
}

for (const module of BLENDER_WALL_MODULES) {
  const option = document.createElement('option')
  option.value = module.name
  option.textContent = module.name
  wallModuleSelect.appendChild(option)
}

// Gesims-Profile werden als Kacheln gerendert (rebuildCorniceProfileCards).

floorPlanExampleButton.addEventListener('click', () => {
  setFloorPlan(exampleRectFloorPlan(4, 3))
  floorPlan = currentFloorPlan()
  floorPlanDrawStart = null
  floorPlanDrawPreview = null
  floorPlanLoopStart = null
  setView('top')
})

/** Synchronisiert das Etagen-Dropdown mit den vorhandenen Etagen. */
function syncFloorUI() {
  const floors = getFloors()
  const prevValue = floorSelect.value
  while (floorSelect.options.length > 0) floorSelect.remove(0)
  floors.forEach((_, i) => {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = i === 0 ? 'Erdgeschoss' : `${i}. Obergeschoss`
    floorSelect.appendChild(opt)
  })
  floorSelect.value = prevValue
  if (!floorSelect.value) floorSelect.value = String(currentFloor)
  floorRemoveBtn.disabled = false
}

floorSelect.addEventListener('change', () => {
  currentFloor = Number(floorSelect.value)
  floorPlanDrawStart = null
  floorPlanDrawPreview = null
  floorPlanLoopStart = null
  rebuildFloorPlanOverlay()
})

floorAddBtn.addEventListener('click', () => {
  if (!canEditActiveBuildingNow()) return
  const floors = [...getFloors(), createEmptyFloorPlan()]
  state = updateActiveBuilding(state, { floors })
  currentFloor = floors.length - 1
  floorSelect.value = String(currentFloor)
  persistApp()
  rebuildFloorPlanOverlay()
  syncFloorUI()
})

buildingAddBtn.addEventListener('click', () => {
  commitState(addBuildingBeside(state))
  currentFloor = 0
  syncFloorUI()
  rebuildFloorPlanOverlay()
})

floorRemoveBtn.addEventListener('click', () => {
  if (!window.confirm('Letztes Geschoss löschen?')) return
  removeStoreyAtFloor(currentFloor)
})

/** Schaltet den Grundriss-Zeichenmodus um. */
function setPlanMode(mode: 'navigate' | 'draw' | 'edit') {
  floorPlanMode = mode
  planModeNavBtn.classList.toggle('active', mode === 'navigate')
  planModeDrawBtn.classList.toggle('active', mode === 'draw')
  planModeEditBtn.classList.toggle('active', mode === 'edit')
  planEditSelectedNodeId = null
  planEditSelectedEdgeId = null
  planEditDragNodeId = null
  planEditDragEdgeId = null
  rebuildFloorPlanOverlay()
}

planModeNavBtn.addEventListener('click', () => setPlanMode('navigate'))
planModeDrawBtn.addEventListener('click', () => setPlanMode('draw'))
planModeEditBtn.addEventListener('click', () => setPlanMode('edit'))

planGenerateButton.addEventListener('click', () => {
  generateWallsFromFloorPlan()
})

planClearButton.addEventListener('click', () => {
  clearFloorPlanCanvas()
})

deleteWallStudioButton.addEventListener('click', () => {
  deleteWallButton.click()
})

studioWallUnlinkButton.addEventListener('click', () => {
  unlinkSelectedStudioWalls()
})

function stretchSelectedWall(side: 'start' | 'end', sign: 1 | -1) {
  if (editor.selectedWallIds.length !== 1) return
  const wallId = editor.selectedWallIds[0]
  const wall = getWall(state, wallId)
  if (!wall || !isStudioWall(wall)) return
  if (selectionLockedToUnselected(activeBuilding().walls, [wallId])) {
    planStatus.textContent = 'Zuerst Wand lösen (Rechtsklick)'
    return
  }
  const yaw = wall.yawDeg ?? 0
  const delta = snapWallWidthDelta(wall.width, sign * wallWidthStepCm(yaw), yaw)
  if (delta === 0) return
  commitState(finalizeStudioGeometry(stretchStudioFacade(state, wallId, side, delta)))
}

studioStretchStartMinus.addEventListener('click', () => {
  stretchSelectedWall('start', -1)
})
studioStretchStartPlus.addEventListener('click', () => {
  stretchSelectedWall('start', 1)
})
studioStretchEndMinus.addEventListener('click', () => {
  stretchSelectedWall('end', -1)
})
studioStretchEndPlus.addEventListener('click', () => {
  stretchSelectedWall('end', 1)
})

studioHeightMinus.addEventListener('click', () => {
  resizeSelectedStoreyHeight(-STUDIO_WALL_HEIGHT_STEP)
})

studioWallYawMinus?.addEventListener('click', () => rotateSelectedStudioWalls(-1, 10))
studioWallYawPlus?.addEventListener('click', () => rotateSelectedStudioWalls(1, 10))
studioWallYawInput?.addEventListener('change', () => {
  setSelectedStudioWallsYaw(Number(studioWallYawInput.value))
})
studioEndPieceMinus?.addEventListener('click', () => updateSelectedEndPieceAngle(-10))
studioEndPiecePlus?.addEventListener('click', () => updateSelectedEndPieceAngle(10))
studioEndPieceAngle?.addEventListener('change', () => {
  const wall = selectedWalls()[0]
  if (!wall) return
  let parent = wall
  if (wall.endPieceParentId) {
    const linked = getWall(state, wall.endPieceParentId)
    if (linked) parent = linked
  }
  if (!parent.endPiece) return
  commitEndPieceAngle(parent.id, clampEndPieceAngleInput(Number(studioEndPieceAngle.value)))
})
studioEndPieceRemove?.addEventListener('click', () => removeSelectedEndPiece())

const wallLibraryGizmos = document.querySelector<HTMLDivElement>('#wall-library-gizmos')
wallLibraryGizmos?.addEventListener('pointerdown', (event) => event.stopPropagation())
wallLibraryGizmos?.addEventListener('click', (event) => {
  event.stopPropagation()
  const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-act]')
  if (!btn || btn.disabled) return
  const side = btn.closest<HTMLElement>('.wall-library-gizmo')?.dataset.side
  const act = btn.dataset.act
  if (side !== 'left' && side !== 'right' && side !== 'above') return
  if (act === 'plus') {
    if (side === 'above') void addLibraryWallAbove()
    else addArmedLibraryWallBeside(side)
    return
  }
  if (act === 'minus') {
    if (side === 'above') removeLibraryStoreyAbove()
    else removeLibraryWallOnSide(side)
  }
})

const wallResizeGizmos = document.querySelector<HTMLDivElement>('#wall-resize-gizmos')
wallResizeGizmos?.addEventListener(
  'pointerdown',
  (event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const gripEl = (event.target as HTMLElement | null)?.closest<HTMLElement>('.wall-resize-grip')
    const grip = gripEl?.dataset.grip as WallResizeGrip | undefined
    if (!grip) return
    if (grip === 'front' && gripEl?.classList.contains('is-locked')) return
    const wall = selectedStudioWallsForGizmos()[0] ?? selectedStudioWallForResize()
    if (!wall) return
    beginWallResizeDrag(wall, grip, event)
  },
  true,
)

studioWallDepthInput.addEventListener('change', () => {
  const raw = Number(studioWallDepthInput.value)
  const depth = Math.max(8, Math.min(80, snapToGrid(raw, 8)))
  studioWallDepthInput.value = String(depth)
  commitState(finalizeStudioGeometry(applyGlobalWallDepth(state, depth)))
})

studioHeightPlus.addEventListener('click', () => {
  resizeSelectedStoreyHeight(STUDIO_WALL_HEIGHT_STEP)
})

function resizeSelectedStoreyHeight(delta: number) {
  if (editor.selectedWallIds.length === 0) return
  const wall = getWall(state, editor.selectedWallIds[0])
  if (!wall) return
  const fi = floorIndex(wall, wallHeightForWall(wall))
  commitState(finalizeWallLayout(resizeStoreyHeight(state, fi, delta)))
}

studioWallHeightInput.addEventListener('change', () => {
  if (editor.selectedWallIds.length === 0) return
  const wall = getWall(state, editor.selectedWallIds[0])
  if (!wall) return
  const nextHeight = snapToGrid(Number(studioWallHeightInput.value), STUDIO_WALL_HEIGHT_STEP)
  if (!Number.isFinite(nextHeight) || nextHeight < STUDIO_MIN_SIZE) {
    studioWallHeightInput.value = String(wall.height)
    return
  }
  const delta = nextHeight - wall.height
  if (delta === 0) return
  const fi = floorIndex(wall, wallHeightForWall(wall))
  studioWallHeightInput.value = String(nextHeight)
  commitState(finalizeWallLayout(resizeStoreyHeight(state, fi, delta)))
})

function commitStudioPanelPatch(patch: Parameters<typeof updateStudioPanel>[2]) {
  if (!canEditActiveBuildingNow()) return
  const ids = scopedWallIds().filter((id) => canEditWallNow(id))
  if (ids.length === 0) return
  let next = state
  next = updateStudioPanel(next, ids, patch)
  if (patch.hideRowsTop !== undefined) {
    next = syncWallDecorToTopBareBand(next, ids)
  }
  commitState(next)
  if (patch.hideRowsTop !== undefined) {
    const anchor = anchorWall()
    if (anchor) syncLabelControls(anchor)
  }
}

studioPanelsEnabled.addEventListener('change', () => {
  if (studioPanelsEnabled.checked) {
    const wall = anchorWall()
    const pattern =
      wall?.panel?.pattern === 'none' || !wall?.panel?.pattern ? 'strip' : wall.panel.pattern
    commitStudioPanelPatch({ enabled: true, pattern })
  } else {
    commitStudioPanelPatch({ enabled: false, pattern: 'none' })
  }
  refreshStudioPanelVisibility()
  rebuildStudioPatternCards()
})

studioCornerJoinSelect.addEventListener('change', () => {
  commitStudioPanelPatch({
    cornerJoin: studioCornerJoinSelect.value as StudioCornerJoin,
  })
})

studioPlinthEnabled.addEventListener('change', () => {
  commitStudioPanelPatch({ plinthEnabled: studioPlinthEnabled.checked })
  refreshStudioPanelVisibility()
})

studioPanelWidthInput.min = String(STUDIO_PANEL_MIN)
studioPanelWidthInput.max = String(STUDIO_PANEL_SOFT_MAX)
studioPanelWidthInput.step = String(STUDIO_PANEL_STEP)
studioPanelHeightInput.min = String(STUDIO_PANEL_MIN)
studioPanelHeightInput.max = String(STUDIO_PANEL_SOFT_MAX)
studioPanelHeightInput.step = String(STUDIO_PANEL_STEP)

studioPanelWidthInput.addEventListener('change', () => {
  const panelWidth = clampStudioPanelSize(Number(studioPanelWidthInput.value))
  studioPanelWidthInput.value = String(panelWidth)
  commitStudioPanelPatch({ panelWidth })
})

studioPanelHeightInput.addEventListener('change', () => {
  const panelHeight = clampStudioPanelSize(Number(studioPanelHeightInput.value))
  studioPanelHeightInput.value = String(panelHeight)
  commitStudioPanelPatch({ panelHeight })
})

function commitTwoHorizontalBands(options: {
  splitYCm: number
  lowerPanelWidth: number
  upperPanelWidth: number
} | null) {
  if (!canEditActiveBuildingNow()) return
  const ids = scopedWallIds().filter((id) => canEditWallNow(id))
  if (ids.length === 0) return
  commitState(updateTwoHorizontalCladdingBands(state, ids, options))
  const anchor = anchorWall()
  if (anchor) syncStudioToolbar(anchor)
  else refreshStudioPanelVisibility()
}

studioCladdingTwoBands.addEventListener('change', () => {
  const wall = anchorWall()
  if (!wall?.panel) return
  if (!studioCladdingTwoBands.checked) {
    commitTwoHorizontalBands(null)
    return
  }
  const lower = clampStudioPanelSize(wall.panel.panelWidth)
  commitTwoHorizontalBands({
    splitYCm: clampCladdingSplitY(wall.height * 0.5, wall.height),
    lowerPanelWidth: lower,
    upperPanelWidth: defaultUpperBandWidth(lower),
  })
})

studioCladdingSplitY.addEventListener('change', () => {
  const wall = anchorWall()
  if (!wall || !isTwoHorizontalBandCladding(wall)) return
  const bands = readTwoHorizontalBandOptions(wall)
  const splitYCm = clampCladdingSplitY(Number(studioCladdingSplitY.value), wall.height)
  studioCladdingSplitY.value = String(splitYCm)
  commitTwoHorizontalBands({ ...bands, splitYCm })
})

studioCladdingWidthLower.addEventListener('change', () => {
  const wall = anchorWall()
  if (!wall || !isTwoHorizontalBandCladding(wall)) return
  const bands = readTwoHorizontalBandOptions(wall)
  const lowerPanelWidth = clampStudioPanelSize(Number(studioCladdingWidthLower.value))
  studioCladdingWidthLower.value = String(lowerPanelWidth)
  commitTwoHorizontalBands({ ...bands, lowerPanelWidth })
})

studioCladdingWidthUpper.addEventListener('change', () => {
  const wall = anchorWall()
  if (!wall || !isTwoHorizontalBandCladding(wall)) return
  const bands = readTwoHorizontalBandOptions(wall)
  const upperPanelWidth = clampStudioPanelSize(Number(studioCladdingWidthUpper.value))
  studioCladdingWidthUpper.value = String(upperPanelWidth)
  commitTwoHorizontalBands({ ...bands, upperPanelWidth })
})

function commitHideRowsPatch(side: 'bottom' | 'top', rawValue: number) {
  const wall = anchorWall()
  if (!wall?.panel) return
  const courseCount = panelCourseCount(wall.height, { ...wall.panel, panelHeight: wall.panel.panelHeight })
  const maxHide = Math.max(0, courseCount - 1)
  const value = clampHideRows(rawValue, maxHide)
  if (side === 'bottom') {
    studioHideRowsBottomInput.value = String(value)
    commitStudioPanelPatch({ hideRowsBottom: value })
  } else {
    studioHideRowsTopInput.value = String(value)
    commitStudioPanelPatch({ hideRowsTop: value })
  }
}

studioHideRowsBottomInput.addEventListener('change', () => {
  commitHideRowsPatch('bottom', Number(studioHideRowsBottomInput.value))
})

studioHideRowsTopInput.addEventListener('change', () => {
  commitHideRowsPatch('top', Number(studioHideRowsTopInput.value))
})
studioHideRowsTopInput.addEventListener('input', () => {
  commitHideRowsPatch('top', Number(studioHideRowsTopInput.value))
})

studioJointInput.addEventListener('change', () => {
  commitStudioPanelPatch({ joint: Number(studioJointInput.value) })
  refreshStudioPanelVisibility()
})
studioJointInput.addEventListener('input', () => {
  refreshStudioPanelVisibility()
})

studioProjectDepthInput.addEventListener('change', () => {
  commitStudioPanelPatch({ projectDepth: Number(studioProjectDepthInput.value) })
})
studioPlinthHeightInput.addEventListener('input', () => {
  if (studioPlinthHeightInput.value === '') return
  const wall = anchorWall()
  const plinthHeight = clampPlinthHeight(Number(studioPlinthHeightInput.value), wall?.height)
  studioPlinthHeightInput.value = String(plinthHeight)
  commitStudioPanelPatch({ plinthHeight })
})
studioPlinthDepthInput.min = '0'
studioPlinthDepthInput.removeAttribute('max')
studioPlinthDepthInput.step = '1'
studioPlinthDepthInput.addEventListener('change', () => {
  const plinthDepth = clampPlinthDepth(Number(studioPlinthDepthInput.value))
  studioPlinthDepthInput.value = String(plinthDepth)
  commitStudioPanelPatch({ plinthDepth })
})
studioPlinthOffsetInput.min = '0'
studioPlinthOffsetInput.removeAttribute('max')
studioPlinthOffsetInput.step = '1'
studioPlinthOffsetInput.addEventListener('change', () => {
  const plinthOffsetForward = clampPlinthOffsetForward(Number(studioPlinthOffsetInput.value))
  studioPlinthOffsetInput.value = String(plinthOffsetForward)
  commitStudioPanelPatch({ plinthOffsetForward })
})

studioPlinthProfileScale.addEventListener('change', () => {
  const scale = Math.min(8, Math.max(0.25, Number(studioPlinthProfileScale.value) || 1))
  studioPlinthProfileScale.value = String(scale)
  commitStudioPanelPatch({ plinthProfileScale: scale })
})
studioPlinthRotateCcw.addEventListener('click', () => {
  const panel = selectedWalls()[0]?.panel
  const current = panel?.plinthProfileRotationDeg ?? 0
  commitStudioPanelPatch({ plinthProfileRotationDeg: (current + 270) % 360 })
})
studioPlinthRotateCw.addEventListener('click', () => {
  const panel = selectedWalls()[0]?.panel
  const current = panel?.plinthProfileRotationDeg ?? 0
  commitStudioPanelPatch({ plinthProfileRotationDeg: (current + 90) % 360 })
})
studioPlinthFlipOutward.addEventListener('click', () => {
  const panel = selectedWalls()[0]?.panel
  commitStudioPanelPatch({ plinthProfileFlipOutward: !Boolean(panel?.plinthProfileFlipOutward) })
})
studioPlinthFlipForward.addEventListener('click', () => {
  const panel = selectedWalls()[0]?.panel
  commitStudioPanelPatch({ plinthProfileFlipForward: !Boolean(panel?.plinthProfileFlipForward) })
})
studioProjectDepthInput.addEventListener('input', () => {
  commitStudioPanelPatch({ projectDepth: Number(studioProjectDepthInput.value) })
})
studioTileVariance.addEventListener('input', () => {
  const v = Number(studioTileVariance.value)
  studioTileVarianceValue.textContent = String(v)
  studioTileVarietyRow.hidden = v <= 0
  if (v > 0 && Number(studioTileVariety.value) <= 0) {
    studioTileVariety.value = '40'
    studioTileVarietyValue.textContent = '40'
    commitStudioPanelPatch({ tileColorVariance: v, tileColorVariety: 40 })
    return
  }
  commitStudioPanelPatch({ tileColorVariance: v })
})
studioTileVariety.addEventListener('input', () => {
  const v = Number(studioTileVariety.value)
  studioTileVarietyValue.textContent = String(v)
  commitStudioPanelPatch({ tileColorVariety: v })
})

studioJointDepthInput.addEventListener('change', () => {
  commitStudioPanelPatch({ jointDepth: Number(studioJointDepthInput.value) })
})

studioTaperInput.addEventListener('change', () => {
  commitStudioPanelPatch({ taper: Number(studioTaperInput.value) })
})

studioTaperDepthInput.addEventListener('change', () => {
  const v = Number(studioTaperDepthInput.value)
  commitStudioPanelPatch({ taperDepth: v })
  studioTaperInput.disabled = v <= 0
  studioTaperInput.title = v <= 0 ? 'Bossen-Vorstand muss > 0 sein, damit Bossenprofil sichtbar wird.' : ''
  refreshStudioPanelVisibility()
})
studioTaperDepthInput.addEventListener('input', () => {
  const v = Number(studioTaperDepthInput.value)
  commitStudioPanelPatch({ taperDepth: v })
  studioTaperInput.disabled = v <= 0
  studioTaperInput.title = v <= 0 ? 'Bossen-Vorstand muss > 0 sein, damit Bossenprofil sichtbar wird.' : ''
  refreshStudioPanelVisibility()
})

studioPanelsAlternate.addEventListener('change', () => {
  const alternate = studioPanelsAlternate.checked
  if (alternate) {
    studioLayer1ProjectDepth.value = studioProjectDepthInput.value
    studioLayer1TaperDepth.value = studioTaperDepthInput.value
    studioLayer1Taper.value = studioTaperInput.value
  } else {
    studioProjectDepthInput.value = studioLayer1ProjectDepth.value
    studioTaperDepthInput.value = studioLayer1TaperDepth.value
    studioTaperInput.value = studioLayer1Taper.value
  }
  commitStudioPanelPatch({ alternateFloors: alternate })
  refreshStudioPanelVisibility()
})

function commitAlternateLayer1() {
  const projectDepth = Number(studioLayer1ProjectDepth.value)
  const taperDepth = Number(studioLayer1TaperDepth.value)
  const taper = Number(studioLayer1Taper.value)
  commitStudioPanelPatch({
    projectDepth: Number.isFinite(projectDepth) ? projectDepth : undefined,
    taperDepth: Number.isFinite(taperDepth) ? taperDepth : undefined,
    taper: Number.isFinite(taper) ? taper : undefined,
  })
  studioLayer1Taper.disabled = (taperDepth ?? 0) <= 0
  refreshStudioPanelVisibility()
}

function commitAlternateLayer2() {
  const recessedProjectDepth = Number(studioLayer2ProjectDepth.value)
  const recessedTaperDepth = Number(studioLayer2TaperDepth.value)
  const recessedTaper = Number(studioLayer2Taper.value)
  commitStudioPanelPatch({
    recessedProjectDepth: Number.isFinite(recessedProjectDepth) ? recessedProjectDepth : undefined,
    recessedTaperDepth: Number.isFinite(recessedTaperDepth) ? recessedTaperDepth : undefined,
    recessedTaper: Number.isFinite(recessedTaper) ? recessedTaper : undefined,
  })
  studioLayer2Taper.disabled = (recessedTaperDepth ?? 0) <= 0
  refreshStudioPanelVisibility()
}

for (const input of [
  studioLayer1ProjectDepth,
  studioLayer1TaperDepth,
  studioLayer1Taper,
]) {
  input.addEventListener('change', commitAlternateLayer1)
  input.addEventListener('input', commitAlternateLayer1)
}
for (const input of [
  studioLayer2ProjectDepth,
  studioLayer2TaperDepth,
  studioLayer2Taper,
]) {
  input.addEventListener('change', commitAlternateLayer2)
  input.addEventListener('input', commitAlternateLayer2)
}

studioOpeningJoinMiter.addEventListener('change', () => {
  commitStudioPanelPatch({
    openingJoin: studioOpeningJoinMiter.checked ? 'miter' : 'flush',
  })
})

function corniceTargetWallIds(): string[] {
  return scopedWallIds()
}

function commitCornicePatch(patch: Partial<WallCorniceConfig>) {
  if (editor.selectedWallIds.length === 0) return
  commitState(updateWallCornice(state, corniceTargetWallIds(), patch))
}

function commitLabelPatch(patch: Partial<WallLabelConfig>) {
  if (!canEditActiveBuildingNow()) return
  const ids = scopedWallIds().filter((id) => canEditWallNow(id))
  if (ids.length === 0) return
  const enablingFresh =
    patch.enabled === true &&
    ids.some((id) => {
      const wall = getWall(state, id)
      return wall && !wallLabel(wall).enabled
    })
  let next = updateWallLabel(state, ids, patch)
  if (enablingFresh) {
    next = syncWallDecorToTopBareBand(next, ids)
  }
  commitState(next)
  const anchor = anchorWall()
  if (anchor) syncLabelControls(anchor)
}

studioLabelEnabled.addEventListener('change', () => {
  const wall = anchorWall()
  const patch: Partial<WallLabelConfig> = { enabled: studioLabelEnabled.checked }
  if (studioLabelEnabled.checked && wall && !(wallLabel(wall).text ?? '').trim()) {
    const heightCm = clampStudioPanelSize(DEFAULT_WALL_LABEL.heightCm)
    const anchor = defaultWallLabelAnchor(wall, heightCm)
    patch.text = 'Text'
    patch.heightCm = heightCm
    patch.x = anchor.x
    patch.y = anchor.y
    patch.align = 'center'
  }
  commitLabelPatch(patch)
})

studioWallFinishSelect.addEventListener('change', () => {
  const finish = studioWallFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitState(updateWallFinishes(state, scopedWallIds(), finish, 'wallFinish'))
})
studioCladdingFinishSelect.addEventListener('change', () => {
  const finish = studioCladdingFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitState(updateWallFinishes(state, scopedWallIds(), finish, 'claddingFinish'))
})
studioProfileFinishSelect.addEventListener('change', () => {
  const finish = studioProfileFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitState(updateWallFinishes(state, scopedWallIds(), finish, 'profileFinish'))
})
studioLabelFinishSelect.addEventListener('change', () => {
  const finish = studioLabelFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitLabelPatch({ finish })
})
openingFrameFinishSelect.addEventListener('change', () => {
  const finish = openingFrameFinishSelect.value as 'matte' | 'glossy' | 'metal'
  const refs = scopedOpeningRefs()
  if (refs.length === 0) return
  commitState(updateOpeningFrameFinishes(state, refs, finish))
})
openingTrimFinishSelect.addEventListener('change', () => {
  const finish = openingTrimFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitOpeningTrim({ finish })
})
stairsFinishSelect.addEventListener('change', () => {
  const finish = stairsFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitStairPatch({ finish })
})
sillInnerFinishSelect.addEventListener('change', () => {
  const finish = sillInnerFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitOpeningSillPatch({ inner: { finish } })
})
sillOuterFinishSelect.addEventListener('change', () => {
  const finish = sillOuterFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitOpeningSillPatch({ outer: { finish } })
})
pedimentFinishSelect.addEventListener('change', () => {
  const finish = pedimentFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitOpeningPedimentPatch({ finish })
})
studioCorniceFinishSelect.addEventListener('change', () => {
  const finish = studioCorniceFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitCornicePatch({ finish })
})
wallCorniceFinishSelect.addEventListener('change', () => {
  const finish = wallCorniceFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitCornicePatch({ finish })
})
moduleWallFinishSelect.addEventListener('change', () => {
  const finish = moduleWallFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitState(updateWallFinishes(state, scopedWallIds(), finish, 'wallFinish'))
})
moduleProfileFinishSelect.addEventListener('change', () => {
  const finish = moduleProfileFinishSelect.value as 'matte' | 'glossy' | 'metal'
  commitState(updateWallFinishes(state, scopedWallIds(), finish, 'profileFinish'))
})

function commitLabelText() {
  const text = studioLabelText.value
  const patch: Partial<WallLabelConfig> = { text }
  const wall = anchorWall()
  const wantEnabled = text.trim().length > 0 || studioLabelEnabled.checked
  const currentlyEnabled = wall ? wallLabel(wall).enabled : false
  if (wantEnabled !== currentlyEnabled) {
    patch.enabled = wantEnabled
  }
  commitLabelPatch(patch)
}

studioLabelText.addEventListener('change', commitLabelText)
studioLabelTextSave.addEventListener('click', commitLabelText)
studioLabelText.addEventListener('input', () => syncLabelFontCards())
studioLabelText.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  commitLabelText()
})

studioLabelHeight.addEventListener('change', () => {
  const heightCm = clampStudioPanelSize(Number(studioLabelHeight.value))
  studioLabelHeight.value = String(heightCm)
  commitLabelPatch({ heightCm })
})

studioLabelX.addEventListener('change', () => {
  const wall = anchorWall()
  const x = snapToGrid(Number(studioLabelX.value), STUDIO_MASONRY)
  studioLabelX.value = String(wall ? Math.max(0, Math.min(wall.width, x)) : x)
  commitLabelPatch({ x: Number(studioLabelX.value) })
})
studioLabelX.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    studioLabelX.dispatchEvent(new Event('change'))
  }
})

studioLabelY.addEventListener('change', () => {
  const wall = anchorWall()
  const y = snapToGrid(Number(studioLabelY.value), STUDIO_MASONRY)
  studioLabelY.value = String(wall ? Math.max(0, Math.min(wall.height, y)) : y)
  commitLabelPatch({ y: Number(studioLabelY.value) })
})
studioLabelY.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    studioLabelY.dispatchEvent(new Event('change'))
  }
})

studioLabelAlign.addEventListener('change', () => {
  commitLabelPatch({ align: studioLabelAlign.value as WallLabelConfig['align'] })
})

studioLabelDepthFlat.addEventListener('click', () => {
  commitLabelPatch({ depth: 'flat' as WallLabelDepth })
  studioLabelDepthFlat.classList.add('active')
  studioLabelDepthExtruded.classList.remove('active')
  studioLabelExtrudeRow.hidden = true
})

studioLabelDepthExtruded.addEventListener('click', () => {
  studioLabelDepthExtruded.classList.add('active')
  studioLabelDepthFlat.classList.remove('active')
  studioLabelExtrudeRow.hidden = false
  const fontId = resolveLabelFontId(anchorWall() ? wallLabel(anchorWall()!).fontId : undefined)
  // Typeface zuerst laden, dann speichern — sonst erscheint kurz/dauerhaft die Flachschrift.
  void retryWallLabelExtrudedFont(fontId).then(() => {
    commitLabelPatch({ depth: 'extruded' as WallLabelDepth })
    facade.refreshWallLabels({ afterFontLoad: true })
    applySunLighting({ updateShadowMap: true })
  })
})

studioLabelExtrude.addEventListener('change', () => {
  commitLabelPatch({ extrudeCm: Number(studioLabelExtrude.value) })
})

studioLabelOffsetForward.addEventListener('change', () => {
  commitLabelPatch({ offsetForward: Number(studioLabelOffsetForward.value) })
})

studioTrimBandAdd.addEventListener('click', () => {
  const ids = scopedWallIds().filter((id) => {
    const wall = getWall(state, id)
    return Boolean(wall && isStudioWall(wall))
  })
  if (ids.length === 0) return
  commitState(addWallTrimBand(state, ids))
  pendingSelectionToolbarTab = 'trimBands'
})

studioCorniceEnabled.addEventListener('change', () => {
  commitCornicePatch({ enabled: studioCorniceEnabled.checked })
  refreshStudioPanelVisibility()
})
wallCorniceEnabled.addEventListener('change', () => {
  commitCornicePatch({ enabled: wallCorniceEnabled.checked })
})

studioCorniceTop.addEventListener('click', () => {
  commitCornicePatch({ enabled: true, edge: 'top' })
})
wallCorniceTop.addEventListener('click', () => {
  commitCornicePatch({ enabled: true, edge: 'top' })
})
studioCorniceBottom.addEventListener('click', () => {
  commitCornicePatch({ enabled: true, edge: 'bottom' })
})
wallCorniceBottom.addEventListener('click', () => {
  commitCornicePatch({ enabled: true, edge: 'bottom' })
})

studioCorniceScale.min = '8'
studioCorniceScale.removeAttribute('max')
wallCorniceScale.min = '8'
wallCorniceScale.removeAttribute('max')
studioCorniceOffsetForward.min = '4'
studioCorniceOffsetForward.step = '4'
studioCorniceOffsetForward.removeAttribute('max')

function corniceNativeHeightCm(profileId: string): number {
  const profile = resolveProfile(profileId, state.customProfiles)
  if (!profile?.section?.length) return 15
  return Math.max(...profile.section.map((point) => point.outward), 1)
}

function corniceNativeForwardCm(profileId: string): number {
  const profile = resolveProfile(profileId, state.customProfiles)
  if (!profile?.section?.length) return 15
  return Math.max(...profile.section.map((point) => point.forward), 1)
}

function cornicePanelStep(_wall?: Wall): number {
  return STUDIO_MASONRY
}

function snapCorniceHeightCm(heightCm: number, step: number): number {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return step
  return Math.max(step, Math.round(heightCm / step) * step)
}

function syncCorniceHeightInputs(wall: Wall, cornice: WallCorniceConfig) {
  const profileId = cornice.profileId ?? 'traufgesims70x150'
  const step = cornicePanelStep(wall)
  const native = corniceNativeHeightCm(profileId)
  const heightCm = snapCorniceHeightCm((cornice.scale ?? 1) * native, step)
  studioCorniceScale.step = String(step)
  wallCorniceScale.step = String(step)
  studioCorniceScale.value = String(heightCm)
  wallCorniceScale.value = String(heightCm)
  const nativeFwd = corniceNativeForwardCm(profileId)
  const depthScale = cornice.sectionScaleForward ?? cornice.scale ?? 1
  const depthCm = snapCorniceDepthCm(depthScale * nativeFwd)
  studioCorniceOffsetForward.value = String(depthCm)
}

function snapCorniceDepthCm(depthCm: number): number {
  if (!Number.isFinite(depthCm) || depthCm <= 0) return 4
  return Math.max(4, Math.round(depthCm / 4) * 4)
}

function commitCorniceScale(input: HTMLInputElement) {
  const wall = selectedWalls()[0]
  const cornice = selectedCornice()
  const profileId = cornice.profileId ?? 'traufgesims70x150'
  const step = cornicePanelStep(wall)
  const heightCm = snapCorniceHeightCm(Number(input.value), step)
  const native = corniceNativeHeightCm(profileId)
  const scale = clampCorniceScale(heightCm / native)
  input.value = String(heightCm)
  studioCorniceScale.value = String(heightCm)
  wallCorniceScale.value = String(heightCm)
  commitCornicePatch({ enabled: true, scale })
}

studioCorniceScale.addEventListener('change', () => {
  commitCorniceScale(studioCorniceScale)
})
wallCorniceScale.addEventListener('change', () => {
  commitCorniceScale(wallCorniceScale)
})

function selectedCornice() {
  const wall = selectedWalls()[0]
  return wall ? wallCornice(wall) : normalizeWallCornice()
}

studioCorniceRotateCcw.addEventListener('click', () => {
  commitCornicePatch({ rotationDeg: ((selectedCornice().rotationDeg ?? 0) + 270) % 360 })
})
wallCorniceRotateCcw.addEventListener('click', () => {
  commitCornicePatch({ rotationDeg: ((selectedCornice().rotationDeg ?? 0) + 270) % 360 })
})
studioCorniceRotateCw.addEventListener('click', () => {
  commitCornicePatch({ rotationDeg: ((selectedCornice().rotationDeg ?? 0) + 90) % 360 })
})
wallCorniceRotateCw.addEventListener('click', () => {
  commitCornicePatch({ rotationDeg: ((selectedCornice().rotationDeg ?? 0) + 90) % 360 })
})

studioCorniceFlipOutward.addEventListener('click', () => {
  commitCornicePatch({ flipOutward: !Boolean(selectedCornice().flipOutward) })
})
wallCorniceFlipOutward.addEventListener('click', () => {
  commitCornicePatch({ flipOutward: !Boolean(selectedCornice().flipOutward) })
})
studioCorniceFlipForward.addEventListener('click', () => {
  commitCornicePatch({ flipForward: !Boolean(selectedCornice().flipForward) })
})
wallCorniceFlipForward.addEventListener('click', () => {
  commitCornicePatch({ flipForward: !Boolean(selectedCornice().flipForward) })
})

studioCorniceOffsetForward.addEventListener('change', () => {
  const cornice = selectedCornice()
  const profileId = cornice.profileId ?? 'traufgesims70x150'
  const native = corniceNativeForwardCm(profileId)
  const depthCm = snapCorniceDepthCm(Number(studioCorniceOffsetForward.value) || native)
  const sectionScaleForward = clampCorniceScale(depthCm / native)
  studioCorniceOffsetForward.value = String(depthCm)
  commitCornicePatch({ enabled: true, sectionScaleForward })
})
wallCorniceOffsetForward.addEventListener('change', () => {
  commitCornicePatch({ offsetForward: Number(wallCorniceOffsetForward.value) || 0 })
})

function commitWindowDepthOffset(input: HTMLInputElement) {
  const raw = Number(input.value)
  if (!Number.isFinite(raw)) return
  const facadeDepthCm = raw
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.type === 'window' || opening?.type === 'door'
  })
  if (refs.length > 0) {
    let next = state
    for (const ref of refs) {
      const wall = getWall(state, ref.wallId)
      const opening = wall?.openings.find((item) => item.id === ref.openingId)
      if (!opening) continue
      const depthOffset = depthOffsetFromFacadeDepthCm(facadeDepthCm, opening)
      next = updateOpening(next, ref.wallId, ref.openingId, { depthOffset })
    }
    commitState(next)
    syncWindowDepthControls()
    return
  }
  commitState(
    updateActiveBuilding(state, {
      windowDepthOffset: buildingDepthOffsetFromFacadeDepthCm(facadeDepthCm),
    }),
  )
  syncWindowDepthControls()
}

function resetOpeningWindowDepth() {
  const refs = scopedOpeningRefs().filter((ref) => {
    const wall = getWall(state, ref.wallId)
    const opening = wall?.openings.find((item) => item.id === ref.openingId)
    return opening?.type === 'window' || opening?.type === 'door'
  })
  if (refs.length === 0) return
  let next = state
  for (const ref of refs) {
    next = updateOpening(next, ref.wallId, ref.openingId, { depthOffset: undefined })
  }
  commitState(next)
  syncWindowDepthControls()
}

openingWindowDepthOffset.addEventListener('change', () => {
  commitWindowDepthOffset(openingWindowDepthOffset)
})
openingWindowDepthOffset.addEventListener('input', () => {
  commitWindowDepthOffset(openingWindowDepthOffset)
})
openingWindowDepthReset.addEventListener('click', () => {
  resetOpeningWindowDepth()
})

viewport.addEventListener('dragover', (event) => {
  const types = [...(event.dataTransfer?.types ?? [])]
  if (
    !activeLibraryAssetDrag &&
    !types.some(
      (t) =>
        t === 'application/x-library-asset' ||
        t === 'application/x-opening-preset' ||
        t === 'application/x-opening-template' ||
        t === 'application/x-wall-preset' ||
        t === 'application/x-bay-preset' ||
        t === 'application/x-panel-preset' ||
        t === 'application/x-scene-light' ||
        t === 'text/plain',
    )
  ) {
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  viewport.classList.add('library-drop-target')
  if (activeWallDragPresetId) {
    updateWallDockPreviewAtClient(event.clientX, event.clientY, activeWallDragPresetId)
  }
})

viewport.addEventListener('dragleave', (event) => {
  const related = event.relatedTarget as Node | null
  // relatedTarget === null feuert oft fälschlich mitten im Drag — Preview behalten
  if (!related) return
  if (viewport.contains(related)) return
  viewport.classList.remove('library-drop-target')
  clearWallDockPreview()
})

viewport.addEventListener('drop', (event) => {
  event.preventDefault()
  viewport.classList.remove('library-drop-target')
  clearWallDockPreview()
  activeWallDragPresetId = null
  wallDockAxisOverride = null
  lastWallDockClient = null
  const sceneLightDrag = event.dataTransfer?.getData('application/x-scene-light')
  if (sceneLightDrag) {
    placeSceneLightFromLibraryDrop(event.clientX, event.clientY)
    return
  }
  let libraryAsset = activeLibraryAssetDrag
  activeLibraryAssetDrag = null
  if (!libraryAsset) {
    const raw = event.dataTransfer?.getData('application/x-library-asset') ?? ''
    if (raw) {
      try {
        libraryAsset = JSON.parse(raw) as LibraryAsset
      } catch {
        libraryAsset = null
      }
    }
  }
  if (libraryAsset) {
    applyLibraryAsset(libraryAsset, libraryHitFromClient(event.clientX, event.clientY))
    return
  }
  const bayPresetId = event.dataTransfer?.getData('application/x-bay-preset') ?? ''
  if (bayPresetId && BAY_WINDOW_PRESETS.some((p) => p.id === bayPresetId)) {
    placeBayWindowAtWall(bayPresetId, event.clientX, event.clientY)
    return
  }
  const panelPatternId =
    event.dataTransfer?.getData('application/x-panel-preset') ||
    ''
  const panelFromActive = activePanelDragPatternId
  activePanelDragPatternId = null
  const panelPattern =
    panelPatternId ||
    (panelFromActive &&
    ((PANEL_KIND_PATTERNS as readonly string[]).includes(panelFromActive) ||
      (MASONRY_KIND_PATTERNS as readonly string[]).includes(panelFromActive))
      ? panelFromActive
      : '')
  if (
    panelPattern &&
    ((PANEL_KIND_PATTERNS as readonly string[]).includes(panelPattern) ||
      (MASONRY_KIND_PATTERNS as readonly string[]).includes(panelPattern))
  ) {
    const wallId = pickWallAtClient(event.clientX, event.clientY)?.wallId ?? null
    if (!wallId) {
      planStatus.textContent = 'Paneel: auf eine Wand ablegen'
      return
    }
    applyPanelPresetFromLibrary(panelPattern as StudioPanelPattern, { wallId })
    return
  }
  const wallPresetId =
    event.dataTransfer?.getData('application/x-wall-preset') ||
    (() => {
      const plain = event.dataTransfer?.getData('text/plain') ?? ''
      if (endPieceHandFromPresetId(plain)) return plain
      return WALL_LENGTH_PRESETS.some((p) => p.id === plain) || WALL_WITH_OPENING_PRESETS.some((p) => p.id === plain) ? plain : ''
    })()
  if (wallPresetId) {
    const endHand = endPieceHandFromPresetId(wallPresetId)
    if (endHand) {
      dropEndPieceAtClient(event.clientX, event.clientY, endHand)
      return
    }
    const grid = pickGroundGridFromClient(event.clientX, event.clientY)
    if (!grid) {
      if (currentView !== 'top') {
        setView('top')
        planStatus.textContent = 'Wand-Preset: in der Draufsicht ablegen'
      }
      return
    }
    addWallPresetAtPlan(wallPresetId, grid.gx, grid.gz)
    return
  }
  const templateId = event.dataTransfer?.getData('application/x-opening-template')
  if (templateId) {
    const template = openingTemplates.find((t) => t.id === templateId)
    if (!template) return
    const hit = pickWallAtClient(event.clientX, event.clientY)
    if (!hit) return
    void addOpeningTemplateToSelection(templateId, {
      wallId: hit.wallId,
      at: {
        x: hit.localX - template.draft.width / 2,
        y: hit.localY - template.draft.height / 2,
      },
    })
    return
  }
  const presetId =
    event.dataTransfer?.getData('application/x-opening-preset') ||
    event.dataTransfer?.getData('text/plain')
  if (!presetId) return
  const preset = WALL_OPENING_PRESETS.find((item) => item.id === presetId)
  if (!preset) return
  const hit = pickWallAtClient(event.clientX, event.clientY)
  if (!hit) return
  addOpeningPresetToSelection(presetId, {
    wallId: hit.wallId,
    at: {
      x: hit.localX - preset.width / 2,
      y: hit.localY - preset.height / 2,
    },
  })
})

planSidebar.hidden = true
planLabelLayer.hidden = true
floorPlanView.root.visible = false

function initOpeningTemplateUi() {
  const dialog = document.querySelector<HTMLDialogElement>('#opening-template-dialog')!
  const nameInput = document.querySelector<HTMLInputElement>('#tpl-name')!
  const typeInput = document.querySelector<HTMLInputElement>('#tpl-type')!
  const widthInput = document.querySelector<HTMLInputElement>('#tpl-width')!
  const heightInput = document.querySelector<HTMLInputElement>('#tpl-height')!
  const styleInput = document.querySelector<HTMLInputElement>('#tpl-style')!
  const trimEnabledInput = document.querySelector<HTMLInputElement>('#tpl-trim-enabled')!
  const trimProfileInput = document.querySelector<HTMLInputElement>('#tpl-trim-profile')!
  const sillOuterInput = document.querySelector<HTMLInputElement>('#tpl-sill-outer')!
  const sillInnerInput = document.querySelector<HTMLInputElement>('#tpl-sill-inner')!
  const pedimentEnabledInput = document.querySelector<HTMLInputElement>('#tpl-pediment-enabled')!
  const pedimentFormSelect = document.querySelector<HTMLSelectElement>('#tpl-pediment-form')!
  const pedimentFormRow = document.querySelector<HTMLDivElement>('#tpl-pediment-form-row')!
  const pedimentGroup = document.querySelector<HTMLDivElement>('#tpl-pediment-group')!
  const preview = document.querySelector<HTMLDivElement>('#tpl-preview')!
  const typeCards = document.querySelector<HTMLDivElement>('#tpl-type-cards')!
  const sizeCards = document.querySelector<HTMLDivElement>('#tpl-size-cards')!
  const styleCards = document.querySelector<HTMLDivElement>('#tpl-style-cards')!
  const profileCards = document.querySelector<HTMLDivElement>('#tpl-profile-cards')!
  const sillCards = document.querySelector<HTMLDivElement>('#tpl-sill-cards')!
  const styleGroup = document.querySelector<HTMLDivElement>('#tpl-style-group')!
  const sillGroup = document.querySelector<HTMLDivElement>('#tpl-sill-group')!
  const libraryHost = document.querySelector<HTMLDivElement>('#opening-library')!

  const markActive = (row: HTMLElement, value: string) => {
    for (const btn of row.querySelectorAll<HTMLButtonElement>('.tpl-card')) {
      btn.classList.toggle('active', btn.dataset.value === value)
    }
  }

  const currentStyleConfig = () => {
    const type = typeInput.value as 'door' | 'window'
    const width = Number(widthInput.value) || 96
    const height = Number(heightInput.value) || 192
    let gruenderzeit = defaultGruenderzeitConfig(width, height, type)
    const style = WINDOW_STYLE_PRESETS[styleInput.value as GruenderzeitPresetId]
    if (type === 'window' && style) {
      gruenderzeit = {
        ...gruenderzeit,
        casements: style.casements,
        transom: style.transom,
        transomRatio: style.transomRatio,
        bottomPanel: style.bottomPanel,
        bottomPanelRatio: style.bottomPanel ? '1/2' : '1/2',
        splitVCount: 1,
        splitVRatio: '1/1',
        splitHCount: 1,
        splitHRatio: '1/1',
        paneMuntins: [{ v: 0, h: 0 }],
        sashBarsH: 0,
        sashBarsV: 0,
        transomBars: 'match',
        leafOpenDeg: Array.from({ length: style.casements }, () => 0),
        transomOpenDeg: Array.from({ length: style.casements }, () => 0),
      }
    }
    return { type, width, height, gruenderzeit }
  }

  const refreshPreview = () => {
    const { type, width, height, gruenderzeit } = currentStyleConfig()
    preview.innerHTML = openingSizePreviewSvg(
      width,
      height,
      type,
      type === 'window' ? gruenderzeit : undefined,
    )
  }

  const syncTypeUi = () => {
    const isWindow = typeInput.value === 'window'
    const isDoor = typeInput.value === 'door'
    styleGroup.hidden = !isWindow
    sillGroup.hidden = !isWindow
    pedimentGroup.hidden = !isWindow && !isDoor
    if (!isWindow) {
      sillOuterInput.value = '0'
      sillInnerInput.value = '0'
      markActive(sillCards, '')
      for (const btn of sillCards.querySelectorAll<HTMLButtonElement>('.tpl-card')) {
        btn.classList.remove('active')
      }
    } else {
      for (const btn of sillCards.querySelectorAll<HTMLButtonElement>('.tpl-card')) {
        const on =
          (btn.dataset.value === 'outer' && sillOuterInput.value === '1') ||
          (btn.dataset.value === 'inner' && sillInnerInput.value === '1')
        btn.classList.toggle('active', on)
      }
    }
    if (!isWindow && !isDoor) {
      pedimentEnabledInput.checked = false
    }
    pedimentFormRow.hidden = !pedimentEnabledInput.checked || pedimentGroup.hidden
    markActive(typeCards, typeInput.value)
    markActive(sizeCards, `${widthInput.value}x${heightInput.value}`)
    markActive(styleCards, styleInput.value)
    const profileValue =
      trimEnabledInput.value === '1' ? trimProfileInput.value : 'none'
    markActive(profileCards, profileValue)
    refreshPreview()
  }

  const buildTypeCards = () => {
    typeCards.replaceChildren()
    for (const item of [
      { value: 'window', label: 'Fenster', w: 96, h: 192 },
      { value: 'door', label: 'Tür', w: 96, h: 320 },
    ] as const) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tpl-card'
      btn.dataset.value = item.value
      btn.innerHTML = `<div class="tpl-card-thumb">${openingSizePreviewSvg(item.w, item.h, item.value)}</div><span>${item.label}</span>`
      btn.addEventListener('click', () => {
        typeInput.value = item.value
        const match = WALL_OPENING_PRESETS.find((p) => p.type === item.value)
        if (match) {
          widthInput.value = String(match.width)
          heightInput.value = String(match.height)
        }
        if (item.value === 'window') {
          sillOuterInput.value = '1'
          sillInnerInput.value = '1'
        }
        syncTypeUi()
      })
      typeCards.appendChild(btn)
    }
  }

  const buildSizeCards = () => {
    sizeCards.replaceChildren()
    for (const preset of WALL_OPENING_PRESETS.filter((p) => p.type !== 'cutout')) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tpl-card'
      btn.dataset.value = `${preset.width}x${preset.height}`
      btn.dataset.type = preset.type
      btn.title = preset.label
      btn.innerHTML = `<div class="tpl-card-thumb">${openingPreviewSvg(preset)}</div><span>${preset.width}×${preset.height}</span>`
      btn.addEventListener('click', () => {
        typeInput.value = preset.type
        widthInput.value = String(preset.width)
        heightInput.value = String(preset.height)
        buildStyleCards()
        syncTypeUi()
      })
      sizeCards.appendChild(btn)
    }
  }

  const buildStyleCards = () => {
    styleCards.replaceChildren()
    for (const [id, style] of Object.entries(WINDOW_STYLE_PRESETS) as Array<
      [GruenderzeitPresetId, (typeof WINDOW_STYLE_PRESETS)[GruenderzeitPresetId]]
    >) {
      const width = Number(widthInput.value) || 96
      const height = Number(heightInput.value) || 192
      let cfg = defaultGruenderzeitConfig(width, height, 'window')
      cfg = {
        ...cfg,
        casements: style.casements,
        transom: style.transom,
        transomRatio: style.transomRatio,
        bottomPanel: style.bottomPanel,
        bottomPanelRatio: style.bottomPanel ? '1/2' : '1/2',
        splitVCount: 1,
        splitVRatio: '1/1',
        splitHCount: 1,
        splitHRatio: '1/1',
        paneMuntins: [{ v: 0, h: 0 }],
        sashBarsH: 0,
      }
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tpl-card'
      btn.dataset.value = id
      btn.innerHTML = `<div class="tpl-card-thumb">${openingSizePreviewSvg(width, height, 'window', cfg)}</div><span>${style.label}</span>`
      btn.addEventListener('click', () => {
        styleInput.value = id
        syncTypeUi()
      })
      styleCards.appendChild(btn)
    }
  }

  const buildProfileCards = () => {
    profileCards.replaceChildren()
    const noneBtn = document.createElement('button')
    noneBtn.type = 'button'
    noneBtn.className = 'tpl-card'
    noneBtn.dataset.value = 'none'
    noneBtn.innerHTML = `<div class="tpl-card-thumb tpl-card-thumb-empty">Kein Profil</div><span>Ohne</span>`
    noneBtn.addEventListener('click', () => {
      trimEnabledInput.value = '0'
      syncTypeUi()
    })
    profileCards.appendChild(noneBtn)

    for (const profile of PROFILE_LIST) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tpl-card'
      btn.dataset.value = profile.id
      const thumb = document.createElement('div')
      thumb.className = 'tpl-card-thumb'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '-2 -2 18 18')
      svg.classList.add('tpl-profile-preview')
      thumb.appendChild(svg)
      drawSectionPreview(
        svg,
        profile.id,
        { rotationDeg: 0, flipOutward: false, flipForward: false },
        DEFAULT_PROFILE_COLOR,
      )
      const label = document.createElement('span')
      label.textContent = profile.label
      btn.append(thumb, label)
      btn.addEventListener('click', () => {
        trimEnabledInput.value = '1'
        trimProfileInput.value = profile.id
        syncTypeUi()
      })
      profileCards.appendChild(btn)
    }
  }

  const buildSillCards = () => {
    sillCards.replaceChildren()
    for (const item of [
      { value: 'outer', label: 'Außenbank' },
      { value: 'inner', label: 'Innenbank' },
    ] as const) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tpl-card'
      btn.dataset.value = item.value
      btn.innerHTML = `<div class="tpl-card-thumb tpl-card-thumb-sill" data-sill="${item.value}"></div><span>${item.label}</span>`
      btn.addEventListener('click', () => {
        const input = item.value === 'outer' ? sillOuterInput : sillInnerInput
        input.value = input.value === '1' ? '0' : '1'
        syncTypeUi()
      })
      sillCards.appendChild(btn)
    }
  }

  buildTypeCards()
  buildSizeCards()
  buildStyleCards()
  buildProfileCards()
  buildSillCards()

  const openDialog = () => {
    const selected = editor.selectedOpenings[0]
    const opening = selected
      ? getWall(state, selected.wallId)?.openings.find((o) => o.id === selected.openingId)
      : undefined
    if (opening) {
      nameInput.value = `${opening.type === 'door' ? 'Tür' : 'Fenster'} ${opening.width}×${opening.height}`
      typeInput.value = opening.type
      widthInput.value = String(opening.width)
      heightInput.value = String(opening.height)
      const detected = opening.gruenderzeit ? detectWindowPreset(opening.gruenderzeit) : ''
      styleInput.value = detected || '2fl'
      sillOuterInput.value = opening.sillOuter?.enabled ? '1' : '0'
      sillInnerInput.value = opening.sillInner?.enabled ? '1' : '0'
      pedimentEnabledInput.checked = Boolean(opening.pediment?.enabled)
      pedimentFormSelect.value = opening.pediment?.form ?? 'straight'
      const wall = getWall(state, selected!.wallId)
      const profile = wall?.profiles.find((p) => p.openingId === opening.id)
      trimEnabledInput.value = profile ? '1' : '0'
      if (profile) trimProfileInput.value = profile.profileId
    } else {
      nameInput.value = ''
      typeInput.value = libraryTab === 'doors' ? 'door' : 'window'
      widthInput.value = libraryTab === 'doors' ? '96' : '96'
      heightInput.value = libraryTab === 'doors' ? '320' : '192'
      styleInput.value = '2fl'
      trimEnabledInput.value = '1'
      trimProfileInput.value = WINDOW_TRIM_PROFILE_IDS[0] ?? 'fensterprofil32x120'
      sillOuterInput.value = '1'
      sillInnerInput.value = '1'
      pedimentEnabledInput.checked = false
      pedimentFormSelect.value = 'straight'
    }
    buildStyleCards()
    syncTypeUi()
    dialog.showModal()
  }

  pedimentEnabledInput.addEventListener('change', () => syncTypeUi())
  pedimentFormSelect.addEventListener('change', () => syncTypeUi())

  libraryHost.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('#opening-template-new')) {
      event.preventDefault()
      openDialog()
    }
  })

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'save') return
    const type = typeInput.value as 'door' | 'window'
    const width = Math.max(8, Number(widthInput.value) || 96)
    const height = Math.max(8, Number(heightInput.value) || 192)
    const { gruenderzeit } = currentStyleConfig()
    const selected = editor.selectedOpenings[0]
    const fromWall = selected ? getWall(state, selected.wallId) : undefined
    const fromOpening = selected
      ? fromWall?.openings.find((o) => o.id === selected.openingId)
      : undefined
    const draft: OpeningTemplateDraft = {
      ...(fromOpening ? draftFromOpening(fromOpening) : {}),
      type,
      width,
      height,
      gruenderzeit: type === 'window' ? gruenderzeit : undefined,
      sillInner:
        type === 'window'
          ? {
              enabled: sillInnerInput.value === '1',
              depth: fromOpening?.sillInner?.depth ?? 16,
              thickness: fromOpening?.sillInner?.thickness ?? 4,
              color: fromOpening?.sillInner?.color ?? '#ffffff',
            }
          : undefined,
      sillOuter:
        type === 'window'
          ? {
              enabled: sillOuterInput.value === '1',
              profileId: fromOpening?.sillOuter?.profileId ?? 'fensterprofil32x120',
              scale: fromOpening?.sillOuter?.scale ?? 1,
              depth: fromOpening?.sillOuter?.depth ?? defaultOuterSillDepth(fromWall),
              thickness: fromOpening?.sillOuter?.thickness ?? 4,
              angleDeg: fromOpening?.sillOuter?.angleDeg ?? 5,
              rotationDeg: fromOpening?.sillOuter?.rotationDeg ?? 0,
              flipOutward: fromOpening?.sillOuter?.flipOutward ?? false,
              flipForward: fromOpening?.sillOuter?.flipForward ?? false,
            }
          : undefined,
      pediment:
        type === 'window' && pedimentEnabledInput.checked
          ? normalizeOpeningPediment({
              ...fromOpening?.pediment,
              enabled: true,
              form: pedimentFormSelect.value as PedimentForm,
            })
          : type === 'window'
            ? normalizeOpeningPediment({ enabled: false })
            : undefined,
      profileId: trimEnabledInput.value === '1' ? trimProfileInput.value : undefined,
    }
    const label =
      nameInput.value.trim() ||
      `${type === 'door' ? 'Tür' : 'Fenster'} ${width}×${height}`
    openingTemplates = [...openingTemplates, createOpeningTemplate(label, draft)]
    persistOpeningTemplates()
    initOpeningLibrary()
  })
}

document.querySelector('#ui-mode-simple')?.addEventListener('click', () => setUiMode('simple'))
document.querySelector('#ui-mode-complex')?.addEventListener('click', () => setUiMode('complex'))
for (const btn of document.querySelectorAll<HTMLButtonElement>('.library-tab')) {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.libraryTab as LibraryTab | undefined
    if (tab) setLibraryTab(tab)
  })
}
syncUiModeChrome()
installFieldInfo()

initOpeningTemplateUi()
initOpeningLibrary()
rebuildFloorPlanOverlay()


viewCompass.querySelectorAll<SVGTextElement>('.view-compass-cardinal').forEach((el) => {
  const activate = () => setCompassYaw(Number(el.dataset.yaw))
  el.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    activate()
  })
  el.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  })
})

const viewCompassSvg = document.querySelector<SVGSVGElement>('#view-compass-svg')!
function yawFromCompassPointer(event: MouseEvent): number | null {
  const svg = viewCompassSvg
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const local = pt.matrixTransform(ctm.inverse())
  return yawFromCompassSvgPoint(local.x, local.y)
}
viewCompassSvg.addEventListener('click', (event) => {
  const target = event.target as Element | null
  if (target?.classList.contains('view-compass-cardinal')) return
  event.preventDefault()
  event.stopPropagation()
  const yaw = yawFromCompassPointer(event)
  if (yaw === null) return
  setCompassYaw(yaw)
})
viewCompassSvg.addEventListener('mousedown', (event) => {
  event.preventDefault()
})

editScopeElement.addEventListener('click', () => setEditScope('element'))
editScopeType.addEventListener('click', () => setEditScope('type'))
editScopeFloor.addEventListener('click', () => setEditScope('floor'))
editScopeFacade.addEventListener('click', () => setEditScope('facade'))

viewShowCeiling?.addEventListener('change', () => {
  commitViewOptions({ showCeiling: viewShowCeiling!.checked })
})
viewShowIntermediateFloors?.addEventListener('change', () => {
  commitViewOptions({ showIntermediateFloors: viewShowIntermediateFloors!.checked })
})
viewShowLightMarkers?.addEventListener('change', () => {
  commitViewOptions({ showLightMarkers: viewShowLightMarkers!.checked })
})

roofEnabled.addEventListener('change', () => {
  commitRoofPatch({ enabled: roofEnabled.checked })
})
roofPitchLower.addEventListener('change', () => {
  commitRoofPatch({ pitchLower: Number(roofPitchLower.value) })
})
roofPitchUpper.addEventListener('change', () => {
  commitRoofPatch({ pitchUpper: Number(roofPitchUpper.value) })
})
roofOverhang.addEventListener('change', () => {
  commitRoofPatch({ overhang: Number(roofOverhang.value) })
})
roofRidgeHeight.addEventListener('change', () => {
  commitRoofPatch({ ridgeHeight: Number(roofRidgeHeight.value) })
})
roofTileProfile.addEventListener('change', () => {
  commitRoofPatch({ tileProfile: roofTileProfile.value as RoofConfig['tileProfile'] })
})
roofTileWidth.addEventListener('change', () => {
  commitRoofPatch({ tileWidth: Number(roofTileWidth.value) })
})
roofTileHeight.addEventListener('change', () => {
  commitRoofPatch({ tileHeight: Number(roofTileHeight.value) })
})
roofTileJoint.addEventListener('change', () => {
  commitRoofPatch({ tileJoint: Number(roofTileJoint.value) })
})
roofTileDepth.addEventListener('change', () => {
  commitRoofPatch({ tileProjectDepth: Number(roofTileDepth.value) })
})
roofTileTaperDepth.addEventListener('change', () => {
  commitRoofPatch({ tileTaperDepth: Number(roofTileTaperDepth.value) })
})
roofTileTaper.addEventListener('input', () => {
  roofTileTaperValue.textContent = Number(roofTileTaper.value).toFixed(2)
})
roofTileTaper.addEventListener('change', () => {
  commitRoofPatch({ tileTaper: Number(roofTileTaper.value) })
})
roofGutter.addEventListener('change', () => {
  commitRoofPatch({ gutter: roofGutter.checked })
})

buildingRotateCcw.addEventListener('click', () => commitBuildingRotate(45))
buildingRotateCw.addEventListener('click', () => commitBuildingRotate(-45))

try {
  setView(currentView)
  applyState(state, editor)
  sceneLightingReady = true
  markViewportDirty()
  animate()
  void bootstrapSceneLighting()
} catch (err) {
  console.error('Startup failed', err)
} finally {
  dismissAppLoading()
}
