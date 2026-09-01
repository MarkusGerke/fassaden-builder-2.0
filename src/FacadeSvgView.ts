import {
  GRID_SIZE,
  GROUND_MARGIN,
  JOIN_OVERLAP,
  PROFILE_OFFSET_CLASSICAL_V2,
  WALL_MOVE_SNAP,
} from './constants/presets'
import {
  DEFAULT_GLASS_COLOR,
  DEFAULT_PROFILE_COLOR,
  DEFAULT_WALL_COLOR,
  defaultOpeningFrameColor,
} from './constants/colorPalettes'
import { resolveCladding } from './meshes/catalog'
import { resolveProfile } from './profiles/registry'
import type { EditorState, FacadeState, Opening, OpeningEdge, Wall } from './types/facade'
import { openingCutsWall, openingGlazingArchForm, openingShowsGlazing, openingMaskSvgPath, openingMaskPolyline, openingPanelClearance, openingClearanceBandSvgPath, normalizeOpeningArch } from './utils/openingGeometry'
import { cloneFacadeState } from './types/facade'
import { appendGruenderzeitSvg, gruenderzeitConfigForOpening, layoutGruenderzeitWindow } from './windows/gruenderzeit'
import { studioPlinthActive } from './studio/constants'
import { snapToGrid } from './utils/grid'
import { buildProfilePaths, clipProfileSectionAboveCm, profileBandPolygon, scaleProfileSectionAxes, transformProfileSection, type ProfilePath } from './utils/profilePaths'
import { edgeIsJoined, getWall, connectedWallsOnFloor, type WallMovePosition } from './utils/walls'
import { buildingShowsBareWalls, findBuildingForWall, findWall, getAllWalls, getVisibleWalls } from './utils/buildings'
import { openingHasProfile } from './utils/openings'
import { layoutStairTreads } from './studio/stairs'
import { pedimentBaseLiftCm } from './studio/openingProfileLift'
import { normalizeOpeningPediment, pedimentFormIsClosed, pedimentOutlineWallXy } from './studio/pediment'
import { basementWindowEnabled, basementWindowGrilleHeight } from './studio/basementWindow'
import {
  elevationBounds,
  layoutElevation,
  wallsForYaw,
  type ElevationFilter,
} from './studio/elevation'
import type { OpeningGuide } from './studio/openingGuides'
import { isMidStyleGuide, isSelfGuide } from './studio/openingGuides'

export type OpeningSelectHandler = (
  wallId: string,
  id: string,
  additive: boolean,
  openingPart?: import('./types/facade').OpeningPart,
) => void
export type WallSelectHandler = (id: string | null, additive: boolean) => void
export type WallsMoveHandler = (positions: WallMovePosition[], commit: boolean) => void
export type OpeningsMoveHandler = (
  dx: number,
  dy: number,
  commit: boolean,
  source: { wallId: string; openingId: string },
) => void
export type ContextMenuHandler = (
  event: MouseEvent,
  hit: { wallId?: string; openingId?: string },
) => void

const NS = 'http://www.w3.org/2000/svg'
const DRAG_THRESHOLD = 3
const PAD = GROUND_MARGIN
const AXIS_LEN = 40

export class FacadeSvgView {
  private readonly container: HTMLElement
  private readonly svg: SVGSVGElement
  private state: FacadeState
  private editor: EditorState
  private onOpeningSelect: OpeningSelectHandler | null = null
  private onWallSelect: WallSelectHandler | null = null
  private onWallsMove: WallsMoveHandler | null = null
  private onOpeningsMove: OpeningsMoveHandler | null = null
  private onContextMenu: ContextMenuHandler | null = null
  private frozenViewBox: string | null = null
  private elevation: ElevationFilter = { kind: 'all' }
  private layout = new Map<string, { x: number; y: number }>()
  private suppressSelectionHighlight = false

  private openingDragging: {
    startClientX: number
    startClientY: number
    scaleX: number
    scaleY: number
    moved: boolean
    additive: boolean
    wallId: string
    openingId: string
    openingPart?: import('./types/facade').OpeningPart
  } | null = null
  private renderStyle: 'color' | 'line' = 'color'
  private lineStrokeScale = 1
  private guideOverlay: { wallId: string; guides: OpeningGuide[] }[] | null = null

  private wallDragging: {
    wallIds: string[]
    starts: WallMovePosition[]
    startClientX: number
    startClientY: number
    scaleX: number
    scaleY: number
    moved: boolean
    shiftKey: boolean
    clickWallId: string
    pendingOpeningSelect: { wallId: string; openingId: string } | null
  } | null = null

  constructor(container: HTMLElement, initialState: FacadeState, editor: EditorState) {
    this.container = container
    this.state = cloneFacadeState(initialState)
    this.editor = cloneEditor(editor)

    this.svg = document.createElementNS(NS, 'svg')
    this.svg.setAttribute('class', 'facade-svg')
    this.container.insertBefore(this.svg, this.container.firstChild)

    this.svg.addEventListener('pointerdown', this.onPointerDown)
    this.svg.addEventListener('pointermove', this.onPointerMove)
    this.svg.addEventListener('pointerup', this.onPointerUp)
    this.svg.addEventListener('pointerleave', this.onPointerUp)
    this.svg.addEventListener('contextmenu', this.onSvgContextMenu)

    this.render()
  }

  setRenderStyle(style: 'color' | 'line') {
    this.renderStyle = style
    this.render()
  }

  setLineStrokeScale(scale: number) {
    this.lineStrokeScale = Math.min(3, Math.max(0.25, scale))
    if (this.renderStyle === 'line') this.render()
  }

  private lineW(base: number): string {
    return String(base * this.lineStrokeScale)
  }

  setSelectionHighlightSuppressed(suppressed: boolean) {
    if (this.suppressSelectionHighlight === suppressed) return
    this.suppressSelectionHighlight = suppressed
    this.render()
  }

  setOpeningSelectHandler(handler: OpeningSelectHandler) {
    this.onOpeningSelect = handler
  }

  setWallSelectHandler(handler: WallSelectHandler) {
    this.onWallSelect = handler
  }

  setWallsMoveHandler(handler: WallsMoveHandler) {
    this.onWallsMove = handler
  }

  setOpeningsMoveHandler(handler: OpeningsMoveHandler) {
    this.onOpeningsMove = handler
  }

  clearOpeningGuides() {
    this.guideOverlay = null
    this.svg.querySelector('#opening-guides')?.remove()
  }

  setOpeningGuides(wallId: string, guides: OpeningGuide[]) {
    this.setOpeningGuidesBatch([{ wallId, guides }])
  }

  setOpeningGuidesBatch(entries: { wallId: string; guides: OpeningGuide[] }[]) {
    const filtered = entries.filter((e) => e.guides.length > 0)
    this.guideOverlay = filtered.length > 0 ? filtered : null
    this.drawOpeningGuides()
  }

  setContextMenuHandler(handler: ContextMenuHandler) {
    this.onContextMenu = handler
  }

  setState(state: FacadeState, editor: EditorState) {
    this.state = cloneFacadeState(state)
    this.editor = cloneEditor(editor)
    this.render()
  }

  setElevation(elevation: ElevationFilter) {
    this.elevation = elevation
    this.render()
  }

  private wallsToRender(): Wall[] {
    const walls = getVisibleWalls(this.state)
    const elevation = this.elevation
    if (elevation.kind === 'yaw') {
      return wallsForYaw(walls, elevation.yaw)
    }
    if (elevation.kind === 'wall') {
      return walls.filter((w) => w.id === elevation.wallId)
    }
    return walls
  }

  private wallDrawPos(wall: Wall): { x: number; y: number } {
    return this.layout.get(wall.id) ?? { x: wall.x, y: wall.y }
  }

  /**
   * Wand unter einem Bildschirm-Punkt (2D-Ansicht). localX/localY im Wandmaß (cm, Y von unten).
   */
  hitTestClient(clientX: number, clientY: number): { wallId: string; localX: number; localY: number } | null {
    const ctm = this.svg.getScreenCTM()
    if (!ctm) return null
    const point = this.svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const svgPt = point.matrixTransform(ctm.inverse())
    const renderWalls = this.wallsToRender()
    const bounds = elevationBounds(renderWalls, this.layout)
    const layoutMaxY = bounds.maxY
    const worldY = layoutMaxY - svgPt.y

    for (const wall of [...renderWalls].reverse()) {
      const pos = this.wallDrawPos(wall)
      if (
        svgPt.x >= pos.x &&
        svgPt.x <= pos.x + wall.width &&
        worldY >= pos.y &&
        worldY <= pos.y + wall.height
      ) {
        return {
          wallId: wall.id,
          localX: svgPt.x - pos.x,
          localY: worldY - pos.y,
        }
      }
    }
    return null
  }

  getSelectionScreenRect(): { left: number; top: number; width: number; height: number } | null {
    const ctm = this.svg.getScreenCTM()
    if (!ctm) return null

    const renderWalls = this.wallsToRender()
    const bounds = elevationBounds(renderWalls, this.layout)
    const layoutMaxY = bounds.maxY
    let minX: number | null = null
    let maxX: number | null = null
    let minY: number | null = null
    let maxY: number | null = null

    const include = (x: number, y: number, width: number, height: number) => {
      minX = minX === null ? x : Math.min(minX, x)
      maxX = maxX === null ? x + width : Math.max(maxX, x + width)
      minY = minY === null ? y : Math.min(minY, y)
      maxY = maxY === null ? y + height : Math.max(maxY, y + height)
    }

    if (this.editor.selectedOpenings.length > 0) {
      for (const ref of this.editor.selectedOpenings) {
        const wall = getWall(this.state, ref.wallId)
        const opening = wall?.openings.find((item) => item.id === ref.openingId)
        if (!wall || !opening) continue
        const pos = this.wallDrawPos(wall)
        include(pos.x + opening.x, pos.y + opening.y, opening.width, opening.height)
      }
    } else {
      for (const id of this.editor.selectedWallIds) {
        const wall = getWall(this.state, id)
        if (!wall) continue
        const pos = this.wallDrawPos(wall)
        include(pos.x, pos.y, wall.width, wall.height)
      }
    }

    if (minX === null || maxX === null || minY === null || maxY === null) return null

    const svgMinX = minX
    const svgMaxX = maxX
    const svgMinY = minY
    const svgMaxY = maxY

    const toScreen = (x: number, y: number) => {
      const point = this.svg.createSVGPoint()
      point.x = x
      point.y = y
      return point.matrixTransform(ctm)
    }

    const topLeft = toScreen(svgMinX, layoutMaxY - svgMaxY)
    const bottomRight = toScreen(svgMaxX, layoutMaxY - svgMinY)
    return {
      left: Math.min(topLeft.x, bottomRight.x),
      top: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }
  }

  private render() {
    const renderWalls = this.wallsToRender()
    this.layout = layoutElevation(getAllWalls(this.state), this.elevation)
    const bounds = elevationBounds(renderWalls, this.layout)
    const viewBox = `${bounds.minX - PAD} ${-PAD} ${bounds.width + PAD * 2} ${bounds.height + PAD * 2}`
    if (!this.frozenViewBox) {
      this.svg.setAttribute('viewBox', viewBox)
    }
    this.svg.innerHTML = ''

    const defs = createEl('defs')
    const pattern = createEl('pattern')
    pattern.setAttribute('id', 'grid-pattern')
    pattern.setAttribute('width', String(GRID_SIZE))
    pattern.setAttribute('height', String(GRID_SIZE))
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    const patternLine = createEl('path')
    patternLine.setAttribute('d', `M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`)
    patternLine.setAttribute('fill', 'none')
    patternLine.setAttribute('stroke', '#ececec')
    patternLine.setAttribute('stroke-width', '0.5')
    pattern.appendChild(patternLine)
    defs.appendChild(pattern)
    const shadow = createEl('filter')
    shadow.setAttribute('id', 'cornice-shadow')
    shadow.setAttribute('x', '-20%')
    shadow.setAttribute('y', '-20%')
    shadow.setAttribute('width', '140%')
    shadow.setAttribute('height', '160%')
    const drop = document.createElementNS(NS, 'feDropShadow')
    drop.setAttribute('dx', '3.5')
    drop.setAttribute('dy', '5')
    drop.setAttribute('stdDeviation', '2.2')
    drop.setAttribute('flood-color', '#4A453E')
    drop.setAttribute('flood-opacity', '0.35')
    shadow.appendChild(drop)
    defs.appendChild(shadow)
    this.svg.appendChild(defs)

    this.renderOrigin(bounds.maxY)

    for (const wall of renderWalls) {
      this.renderWall(wall, bounds.maxY)
    }

    this.renderProjectingProfiles(bounds.maxY)

    const widthLabel = createEl('text')
    widthLabel.setAttribute('x', String(bounds.minX + bounds.width / 2))
    widthLabel.setAttribute('y', String(bounds.height + 16))
    widthLabel.setAttribute('text-anchor', 'middle')
    widthLabel.setAttribute('fill', '#666')
    widthLabel.setAttribute('font-size', '12')
    widthLabel.textContent = `${bounds.width} cm`
    this.svg.appendChild(widthLabel)

    const heightLabel = createEl('text')
    heightLabel.setAttribute('x', String(bounds.minX - 16))
    heightLabel.setAttribute('y', String(bounds.height / 2))
    heightLabel.setAttribute('text-anchor', 'middle')
    heightLabel.setAttribute('fill', '#666')
    heightLabel.setAttribute('font-size', '12')
    heightLabel.setAttribute(
      'transform',
      `rotate(-90, ${bounds.minX - 16}, ${bounds.height / 2})`,
    )
    heightLabel.textContent = `${bounds.height} cm`
    this.svg.appendChild(heightLabel)
    this.drawOpeningGuides()
  }

  private drawOpeningGuides() {
    this.svg.querySelector('#opening-guides')?.remove()
    const overlay = this.guideOverlay
    if (!overlay || overlay.length === 0) return
    const renderWalls = this.wallsToRender()
    const bounds = elevationBounds(renderWalls, this.layout)
    const pad = 2400
    const group = createEl('g')
    group.setAttribute('id', 'opening-guides')
    group.setAttribute('pointer-events', 'none')

    let svgTop = Infinity
    let svgBottom = -Infinity
    let svgLeft = Infinity
    let svgRight = -Infinity
    for (const w of renderWalls) {
      const extraTop = edgeIsJoined(w, 'top', getAllWalls(this.state)) ? JOIN_OVERLAP : 0
      const pos = this.wallDrawPos(w)
      const originY = bounds.maxY - pos.y - w.height - extraTop
      svgTop = Math.min(svgTop, originY - pad)
      svgBottom = Math.max(svgBottom, originY + w.height + extraTop + pad)
      svgLeft = Math.min(svgLeft, pos.x - pad)
      svgRight = Math.max(svgRight, pos.x + w.width + pad)
    }

    for (const entry of overlay) {
      const wall = getWall(this.state, entry.wallId)
      if (!wall || !renderWalls.some((w) => w.id === wall.id)) continue
      const extraTop = edgeIsJoined(wall, 'top', getAllWalls(this.state)) ? JOIN_OVERLAP : 0
      const pos = this.wallDrawPos(wall)
      const originY = bounds.maxY - pos.y - wall.height - extraTop

      for (const guide of entry.guides) {
        const line = createEl('line')
        const self = isSelfGuide(guide)
        const isMid = !self && isMidStyleGuide(guide)
        line.setAttribute('stroke', self ? '#66d9ff' : isMid ? '#ff8800' : '#00e5ff')
        line.setAttribute('stroke-width', self ? '1' : '1.25')
        line.setAttribute('stroke-dasharray', self ? '3 4' : isMid ? '4 3' : '6 3')
        if (self) line.setAttribute('opacity', '0.65')

        if (guide.orientation === 'vertical') {
          const x =
            guide.space === 'elevationX' ? guide.value : pos.x + guide.value
          line.setAttribute('x1', String(x))
          line.setAttribute('x2', String(x))
          line.setAttribute('y1', String(svgTop))
          line.setAttribute('y2', String(svgBottom))
        } else {
          const y = originY + extraTop + (wall.height - guide.value)
          line.setAttribute('x1', String(svgLeft))
          line.setAttribute('x2', String(svgRight))
          line.setAttribute('y1', String(y))
          line.setAttribute('y2', String(y))
        }
        group.appendChild(line)
      }
    }
    this.svg.appendChild(group)
  }

  private renderOrigin(layoutMaxY: number) {
    const originSvgY = layoutMaxY
    const group = createEl('g')
    group.setAttribute('pointer-events', 'none')

    const xAxis = createEl('line')
    xAxis.setAttribute('x1', String(-AXIS_LEN))
    xAxis.setAttribute('y1', String(originSvgY))
    xAxis.setAttribute('x2', String(AXIS_LEN))
    xAxis.setAttribute('y2', String(originSvgY))
    xAxis.setAttribute('stroke', '#e11d48')
    xAxis.setAttribute('stroke-width', '1.5')
    group.appendChild(xAxis)

    const yAxis = createEl('line')
    yAxis.setAttribute('x1', '0')
    yAxis.setAttribute('y1', String(originSvgY))
    yAxis.setAttribute('x2', '0')
    yAxis.setAttribute('y2', String(originSvgY - AXIS_LEN))
    yAxis.setAttribute('stroke', '#16a34a')
    yAxis.setAttribute('stroke-width', '1.5')
    group.appendChild(yAxis)

    this.svg.appendChild(group)
  }

  private renderProjectingProfiles(layoutMaxY: number) {
    const group = createEl('g')
    group.setAttribute('pointer-events', 'none')
    group.setAttribute('class', 'projecting-profiles')
    const defs = createEl('defs')
    group.appendChild(defs)
    let plinthClipSeq = 0

    for (const rawPath of buildProfilePaths(this.state)) {
      const profile = resolveProfile(rawPath.profileId, this.state.customProfiles)
      if (!profile?.projecting) continue
      const wall = findWall(this.state, rawPath.wallId)
      if (wall && buildingShowsBareWalls(findBuildingForWall(this.state, wall.id))) continue
      const path = this.pathInElevation(rawPath, wall)
      const profileColor = path.color ?? wall?.profileColor ?? DEFAULT_PROFILE_COLOR
      let section = profile.section
        ? scaleProfileSectionAxes(
            transformProfileSection(
              profile.section,
              path.rotationDeg ?? 0,
              path.flipOutward ?? false,
              path.flipForward ?? false,
            ),
            path.sectionScale ?? 1,
            path.sectionScaleForward ?? path.sectionScale ?? 1,
          )
        : []
      if (path.sectionClipBelowCm != null && path.sectionClipBelowCm > 0.05) {
        section = clipProfileSectionAboveCm(section, path.sectionClipBelowCm)
        if (section.length < 2) continue
      }
      const depth = section.reduce((max, point) => Math.max(max, point.outward), profile.depth)
      const bandPts = profileBandPolygon(path, depth)
      const polygon = createEl('polygon')
      const points = bandPts
        .map((point) => `${point.x},${layoutMaxY - point.y}`)
        .join(' ')
      polygon.setAttribute('points', points)
      if (path.clipOpeningMask && wall) {
        const clipId = `plinth-opening-clip-${wall.id}-${plinthClipSeq}`
        plinthClipSeq += 1
        const clipPath = createEl('clipPath')
        clipPath.setAttribute('id', clipId)
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse')
        const clipShape = createEl('path')
        const pos = this.layout.get(wall.id) ?? { x: wall.x, y: wall.y }
        const ringSvg = (pts: { x: number; y: number }[]) =>
          pts.length < 2 ? '' : `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
        let d = ringSvg(bandPts.map((p) => ({ x: p.x, y: layoutMaxY - p.y })))
        for (const opening of wall.openings) {
          if (opening.hidden || !openingCutsWall(opening)) continue
          const clearance = openingPanelClearance(opening)
          const inflate = clearance > 0.05 ? clearance : 1
          const probe =
            opening.type === 'door' && opening.stairs?.enabled
              ? { ...opening, y: 0, height: opening.y + opening.height }
              : opening
          const hole = openingMaskPolyline(probe, inflate)
          d += ringSvg(hole.map((p) => ({ x: pos.x + p.x, y: layoutMaxY - pos.y - p.y })))
        }
        clipShape.setAttribute('d', d)
        clipShape.setAttribute('clip-rule', 'evenodd')
        clipPath.setAttribute('clip-rule', 'evenodd')
        clipPath.appendChild(clipShape)
        defs.appendChild(clipPath)
        polygon.setAttribute('clip-path', `url(#${clipId})`)
      }
      if (this.renderStyle === 'line') {
        polygon.setAttribute('fill', '#ffffff')
        polygon.setAttribute('fill-opacity', '1')
        polygon.setAttribute('stroke', '#000000')
        polygon.setAttribute('stroke-width', this.lineW(0.7))
      } else {
        polygon.setAttribute('fill', profileColor)
        polygon.setAttribute('fill-opacity', '0.92')
        polygon.setAttribute('stroke', '#8a7349')
        polygon.setAttribute('stroke-width', '0.8')
        polygon.setAttribute('filter', 'url(#cornice-shadow)')
      }
      group.appendChild(polygon)
    }

    this.svg.appendChild(group)
  }

  private pathInElevation(path: ProfilePath, wall: Wall | undefined) {
    if (!path.localSpace || !wall) return path
    const pos = this.layout.get(wall.id) ?? { x: wall.x, y: wall.y }
    return {
      ...path,
      localSpace: false,
      points: path.points.map((point) => ({
        x: pos.x + point.x + wall.width / 2,
        y: pos.y + point.y + wall.height / 2,
      })),
    }
  }

  private isWallSelected(id: string) {
    if (this.suppressSelectionHighlight) return false
    return this.editor.selectedWallIds.includes(id)
  }

  private isOpeningSelected(wallId: string, openingId: string) {
    if (this.suppressSelectionHighlight) return false
    return this.editor.selectedOpenings.some(
      (item) => item.wallId === wallId && item.openingId === openingId,
    )
  }

  private renderWall(wall: Wall, layoutMaxY: number) {
    const bare = buildingShowsBareWalls(findBuildingForWall(this.state, wall.id))
    const extraRight = edgeIsJoined(wall, 'right', getAllWalls(this.state)) ? JOIN_OVERLAP : 0
    const extraTop = edgeIsJoined(wall, 'top', getAllWalls(this.state)) ? JOIN_OVERLAP : 0
    const drawWidth = wall.width + extraRight
    const drawHeight = wall.height + extraTop
    const pos = this.wallDrawPos(wall)
    const originY = layoutMaxY - pos.y - wall.height - extraTop
    const group = createEl('g')
    group.setAttribute('transform', `translate(${pos.x} ${originY})`)

    if (bare) {
      const selected = this.isWallSelected(wall.id)
      const wallRect = createEl('rect')
      wallRect.setAttribute('width', String(drawWidth))
      wallRect.setAttribute('height', String(drawHeight))
      wallRect.setAttribute('fill', '#ffffff')
      wallRect.setAttribute('fill-opacity', '1')
      if (this.renderStyle === 'line') {
        wallRect.setAttribute('stroke', '#000000')
        wallRect.setAttribute('stroke-width', this.lineW(2))
      } else {
        wallRect.setAttribute('stroke', selected ? '#ff8800' : '#f5f5f5')
        wallRect.setAttribute('stroke-width', selected ? '3' : '0')
      }
      wallRect.dataset.wallId = wall.id
      wallRect.setAttribute('class', selected ? 'wall-rect selected' : 'wall-rect')
      wallRect.setAttribute('pointer-events', 'painted')
      group.appendChild(wallRect)
      this.svg.appendChild(group)
      return
    }

    const maskId = `facade-mask-${wall.id}`
    const defs = createEl('defs')
    const mask = createEl('mask')
    mask.setAttribute('id', maskId)
    const maskBg = createEl('rect')
    maskBg.setAttribute('width', String(drawWidth))
    maskBg.setAttribute('height', String(drawHeight))
    maskBg.setAttribute('fill', 'white')
    mask.appendChild(maskBg)

    for (const opening of wall.openings) {
      if (opening.hidden) continue
      if (!openingCutsWall(opening)) continue
      const d = openingMaskSvgPath(opening, wall.height, extraTop)
      const path = createEl('path')
      path.setAttribute('d', d)
      path.setAttribute('fill', 'black')
      mask.appendChild(path)
    }

    defs.appendChild(mask)
    group.appendChild(defs)

    const gridRect = createEl('rect')
    gridRect.setAttribute('width', String(drawWidth))
    gridRect.setAttribute('height', String(drawHeight))
    gridRect.setAttribute('fill', 'url(#grid-pattern)')
    gridRect.dataset.wallId = wall.id
    gridRect.setAttribute('class', 'wall-rect wall-grid')
    if (this.renderStyle !== 'line') {
      group.appendChild(gridRect)
    }

    const selected = this.isWallSelected(wall.id)
    const wallRect = createEl('rect')
    wallRect.setAttribute('width', String(drawWidth))
    wallRect.setAttribute('height', String(drawHeight))
    if (this.renderStyle === 'line') {
      wallRect.setAttribute('fill', '#ffffff')
      wallRect.setAttribute('fill-opacity', '1')
      wallRect.setAttribute('stroke', selected ? '#000000' : '#000000')
      wallRect.setAttribute('stroke-width', this.lineW(selected ? 2 : 2))
    } else {
      wallRect.setAttribute('fill', wall.wallColor ?? DEFAULT_WALL_COLOR)
      wallRect.setAttribute('fill-opacity', '0.92')
      wallRect.setAttribute('stroke', selected ? '#ff8800' : '#f5f5f5')
      wallRect.setAttribute('stroke-width', selected ? '3' : '0')
    }
    wallRect.setAttribute('mask', `url(#${maskId})`)
    wallRect.dataset.wallId = wall.id
    wallRect.setAttribute('class', selected ? 'wall-rect selected' : 'wall-rect')
    wallRect.setAttribute('pointer-events', 'painted')
    group.appendChild(wallRect)

    const panel = wall.panel
    const plinthHeight = panel && studioPlinthActive(panel) ? (panel.plinthHeight ?? 0) : 0
    const decorativePlinth =
      Boolean(panel?.plinthProfileId) && panel?.plinthProfileId !== 'sockelStandard'
    if (plinthHeight > 0.5 && !decorativePlinth) {
      // Volle Breite + Öffnungsmaske: Sockel umschließt Fenster unter der Sockeloberkante.
      const plinth = createEl('rect')
      plinth.setAttribute('x', '0')
      plinth.setAttribute('y', String(wall.height - plinthHeight + extraTop))
      plinth.setAttribute('width', String(drawWidth))
      plinth.setAttribute('height', String(plinthHeight))
      plinth.setAttribute('fill', this.renderStyle === 'line' ? '#ffffff' : wall.wallColor ?? DEFAULT_WALL_COLOR)
      plinth.setAttribute('fill-opacity', this.renderStyle === 'line' ? '1' : '0.98')
      plinth.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#bbb')
      plinth.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(0.4) : '0.8')
      plinth.setAttribute('mask', `url(#${maskId})`)
      plinth.setAttribute('pointer-events', 'none')
      group.appendChild(plinth)
    }

    const cladding = resolveCladding(wall)
    if (cladding && this.renderStyle !== 'line') {
      const overlay = createEl('rect')
      overlay.setAttribute('width', String(drawWidth))
      overlay.setAttribute('height', String(drawHeight))
      overlay.setAttribute(
        'fill',
        wall.claddingColor ?? wall.wallColor ?? DEFAULT_WALL_COLOR,
      )
      overlay.setAttribute('fill-opacity', '0.7')
      overlay.setAttribute('mask', `url(#${maskId})`)
      overlay.setAttribute('pointer-events', 'none')
      group.appendChild(overlay)
    }

    const profileGroup = createEl('g')
    profileGroup.setAttribute('pointer-events', 'none')
    for (const assignment of wall.profiles) {
      const opening = wall.openings.find((item) => item.id === assignment.openingId)
      const profile = resolveProfile(assignment.profileId, this.state.customProfiles)
      if (!opening || !profile || profile.projecting) continue
      if (opening.type === 'door' && assignment.edge === 'bottom') continue
      const outwardExtra =
        profile.id === 'classical' && cladding?.variant === 'v2'
          ? PROFILE_OFFSET_CLASSICAL_V2
          : 0
      profile.renderEdge(
        profileGroup,
        profileContext(
          wall.height,
          opening,
          assignment.edge,
          profile.depth,
          extraTop,
          outwardExtra,
        ),
      )
    }
    group.appendChild(profileGroup)

    for (const opening of wall.openings) {
      if (opening.hidden) continue
      const y = svgY(wall.height, opening) + extraTop
      const openingSelected = this.isOpeningSelected(wall.id, opening.id)
      const clearance = openingPanelClearance(opening)
      if (clearance > 0.05) {
        const frame = createEl('path')
        frame.setAttribute(
          'd',
          openingClearanceBandSvgPath(opening, wall.height, extraTop, clearance),
        )
        frame.setAttribute('fill-rule', opening.y <= 0.5 ? 'nonzero' : 'evenodd')
        if (this.renderStyle === 'line') {
          frame.setAttribute('fill', '#ffffff')
          frame.setAttribute('stroke', '#000000')
          frame.setAttribute('stroke-width', this.lineW(openingSelected ? 1.2 : 0.8))
        } else {
          frame.setAttribute('fill', wall.wallColor ?? DEFAULT_WALL_COLOR)
          frame.setAttribute('fill-opacity', '0.55')
          frame.setAttribute('stroke', openingSelected ? '#ff8800' : '#777')
          frame.setAttribute('stroke-width', openingSelected ? '1.8' : '1')
        }
        frame.setAttribute('pointer-events', 'none')
        group.appendChild(frame)
      }

      const openingPath = createEl('path')
      openingPath.setAttribute('d', openingMaskSvgPath(opening, wall.height, extraTop))
      if (this.renderStyle === 'line') {
        openingPath.setAttribute('fill', '#ffffff')
        openingPath.setAttribute('stroke', '#000000')
        openingPath.setAttribute('stroke-width', this.lineW(openingSelected ? 1.5 : 1))
        openingPath.setAttribute('stroke-dasharray', 'none')
      } else {
        openingPath.setAttribute(
          'fill',
          openingSelected ? 'rgba(255,136,0,0.08)' : 'rgba(0,0,0,0.06)',
        )
        openingPath.setAttribute('stroke', openingSelected ? '#ff8800' : '#888')
        openingPath.setAttribute('stroke-width', openingSelected ? '2.5' : '1.5')
        openingPath.setAttribute('stroke-dasharray', openingSelected ? 'none' : '6 4')
      }
      openingPath.setAttribute(
        'class',
        openingSelected ? 'opening-rect selected' : 'opening-rect',
      )
      openingPath.dataset.openingId = opening.id
      openingPath.dataset.wallId = wall.id
      openingPath.setAttribute('pointer-events', 'all')
      group.appendChild(openingPath)

      if (opening.type === 'door' && opening.stairs?.enabled) {
        const treads = layoutStairTreads(opening, opening.stairs)
        for (const tread of treads) {
          const step = createEl('rect')
          step.setAttribute('x', String(tread.x))
          step.setAttribute('y', String(wall.height + extraTop + tread.zOut * 0.25))
          step.setAttribute('width', String(tread.width))
          step.setAttribute('height', String(Math.max(2, tread.depth * 0.25)))
          step.setAttribute('fill', this.renderStyle === 'line' ? '#ffffff' : wall.wallColor ?? DEFAULT_WALL_COLOR)
          step.setAttribute('fill-opacity', this.renderStyle === 'line' ? '1' : '0.85')
          step.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#888')
          step.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(0.6) : '0.6')
          step.dataset.wallId = wall.id
          step.dataset.openingId = opening.id
          step.dataset.openingPart = 'stairs'
          group.appendChild(step)
        }
      }

      const inner = opening.sillInner
      if (inner?.enabled && opening.type === 'window' && opening.y > 0) {
        const overhang = 8
        const band = createEl('rect')
        band.setAttribute('x', String(opening.x - overhang))
        band.setAttribute('y', String(y + opening.height))
        band.setAttribute('width', String(opening.width + overhang * 2))
        band.setAttribute('height', String(Math.max(2, inner.thickness ?? 4)))
        band.setAttribute('fill', this.renderStyle === 'line' ? '#ffffff' : '#ffffff')
        band.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#ccc')
        band.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(0.6) : '0.5')
        band.setAttribute('fill-opacity', '1')
        band.dataset.wallId = wall.id
        band.dataset.openingId = opening.id
        band.dataset.openingPart = 'sillInner'
        group.appendChild(band)
      }

      const pediment = opening.pediment
      if (
        pediment?.enabled &&
        (opening.type === 'window' || opening.type === 'door') &&
        !(opening.type === 'window' && opening.basementWindow?.enabled)
      ) {
        const cfg = normalizeOpeningPediment(pediment)
        const outline = pedimentOutlineWallXy(opening, cfg, pedimentBaseLiftCm(wall, opening, cfg))
        const stroke = this.renderStyle === 'line' ? '#000000' : cfg.color ?? wall.profileColor ?? DEFAULT_PROFILE_COLOR
        if (outline.length >= 2) {
          const pointsAttr = outline.map((p) => `${p.x},${wall.height - p.y + extraTop}`).join(' ')
          const closed = pedimentFormIsClosed(cfg.form)
          if (closed && outline.length >= 3) {
            const poly = createEl('polygon')
            poly.setAttribute('points', pointsAttr)
            poly.setAttribute('fill', 'none')
            poly.setAttribute('stroke', stroke)
            poly.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(1.2) : '2')
            poly.setAttribute('stroke-linejoin', 'round')
            poly.dataset.wallId = wall.id
            poly.dataset.openingId = opening.id
            poly.dataset.openingPart = 'pediment'
            group.appendChild(poly)
          } else {
            const poly = createEl('polyline')
            poly.setAttribute('points', pointsAttr)
            poly.setAttribute('fill', 'none')
            poly.setAttribute('stroke', stroke)
            poly.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(1.2) : '2')
            poly.setAttribute('stroke-linejoin', 'round')
            poly.dataset.wallId = wall.id
            poly.dataset.openingId = opening.id
            poly.dataset.openingPart = 'pediment'
            group.appendChild(poly)
          }
        }
        if (cfg.consoles?.enabled) {
          const cw = cfg.consoles.width ?? 16
          const ch = cfg.consoles.height ?? 64
          const overhangL = cfg.overhangLeft ?? 8
          const overhangR = cfg.overhangRight ?? 8
          const xLeft = opening.x - overhangL
          const xRight = opening.x + opening.width + overhangR - cw
          const yTop = y + opening.height
          for (const x of [xLeft, xRight]) {
            const box = createEl('rect')
            box.setAttribute('x', String(x))
            box.setAttribute('y', String(yTop - ch))
            box.setAttribute('width', String(cw))
            box.setAttribute('height', String(ch))
            box.setAttribute('fill', this.renderStyle === 'line' ? '#ffffff' : stroke)
            box.setAttribute('fill-opacity', this.renderStyle === 'line' ? '1' : '0.85')
            box.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#888')
            box.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(0.6) : '0.6')
            box.dataset.wallId = wall.id
            box.dataset.openingId = opening.id
            box.dataset.openingPart = 'pediment'
            group.appendChild(box)
          }
        }
      }

      if (basementWindowEnabled(opening)) {
        const grilleHeight = basementWindowGrilleHeight(opening)
        const x0 = opening.x + 6
        const x1 = opening.x + opening.width - 6
        const yBottom = y + opening.height
        const yTop = yBottom - grilleHeight
        const verticalCount = opening.width >= 56 ? 3 : 2
        const horizontalCount = grilleHeight >= 24 ? 2 : 1

        for (let i = 0; i < verticalCount; i += 1) {
          const x = x0 + (i * (x1 - x0)) / (verticalCount - 1)
          const line = createEl('line')
          line.setAttribute('x1', String(x))
          line.setAttribute('x2', String(x))
          line.setAttribute('y1', String(yBottom))
          line.setAttribute('y2', String(yTop))
          line.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#3c3c3c')
          line.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(1) : '2')
          line.setAttribute('pointer-events', 'none')
          group.appendChild(line)
        }

        for (let i = 0; i < horizontalCount; i += 1) {
          const yLine = horizontalCount === 1 ? yBottom - grilleHeight / 2 : yBottom - (i * grilleHeight) / (horizontalCount - 1)
          const line = createEl('line')
          line.setAttribute('x1', String(x0))
          line.setAttribute('x2', String(x1))
          line.setAttribute('y1', String(yLine))
          line.setAttribute('y2', String(yLine))
          line.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : '#3c3c3c')
          line.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(1) : '2')
          line.setAttribute('pointer-events', 'none')
          group.appendChild(line)
        }
      }

      if (
        openingHasProfile(wall, opening.id, 'classical') &&
        opening.type === 'window' &&
        opening.height === 192 &&
        [48, 96, 144].includes(opening.width)
      ) {
        const casing = createEl('rect')
        casing.setAttribute('x', String(opening.x - 16))
        casing.setAttribute('y', String(y - 14))
        casing.setAttribute('width', String(opening.width + 32))
        casing.setAttribute('height', '206')
        casing.setAttribute('fill', 'none')
        casing.setAttribute('stroke', this.renderStyle === 'line' ? '#000000' : opening.frameColor ?? defaultOpeningFrameColor(opening.type))
        casing.setAttribute('stroke-width', this.renderStyle === 'line' ? this.lineW(1.5) : '3')
        casing.setAttribute('pointer-events', 'none')
        group.appendChild(casing)
      }

      if ((opening.type === 'window' || opening.type === 'door') && openingShowsGlazing(opening)) {
        const config = gruenderzeitConfigForOpening(opening)
        const layout = layoutGruenderzeitWindow(
          opening.width,
          opening.height,
          config,
          openingGlazingArchForm(opening),
          normalizeOpeningArch(opening.arch).riseCm,
        )
        appendGruenderzeitSvg(
          group,
          layout,
          opening.x,
          y,
          opening.height,
          opening.frameColor ?? defaultOpeningFrameColor(opening.type),
          opening.glassColor ?? DEFAULT_GLASS_COLOR,
          this.renderStyle === 'line',
        )
      }
    }

    this.svg.appendChild(group)
  }

  private wallIdsForDrag(clickWallId: string, additive: boolean): string[] {
    if (additive) {
      return this.editor.selectedWallIds.includes(clickWallId)
        ? this.editor.selectedWallIds
        : [...this.editor.selectedWallIds, clickWallId]
    }
    if (this.editor.selectedWallIds.includes(clickWallId)) {
      return this.editor.selectedWallIds
    }
    return connectedWallsOnFloor(this.state, clickWallId)
  }

  private resolveHitTarget(target: EventTarget | null): {
    wallId?: string
    openingId?: string
    openingPart?: import('./types/facade').OpeningPart
  } {
    let element = target as SVGElement | null
    while (element && element !== this.svg) {
      if (element.dataset.wallId) {
        return {
          wallId: element.dataset.wallId,
          openingId: element.dataset.openingId,
          openingPart: element.dataset.openingPart as import('./types/facade').OpeningPart | undefined,
        }
      }
      element = element.parentElement as SVGElement | null
    }
    return {}
  }

  private onSvgContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const hit = this.resolveHitTarget(event.target)
    this.onContextMenu?.(event, hit)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const { openingId, wallId, openingPart } = this.resolveHitTarget(event.target)

    if (openingId && wallId) {
      const rect = this.svg.getBoundingClientRect()
      const viewBox = this.svg.viewBox.baseVal
      this.frozenViewBox = this.svg.getAttribute('viewBox')
      this.openingDragging = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        scaleX: viewBox.width / rect.width,
        scaleY: viewBox.height / rect.height,
        moved: false,
        additive,
        wallId,
        openingId,
        openingPart,
      }
      this.svg.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    if (wallId) {
      const wallIds = this.wallIdsForDrag(wallId, additive)
      const rect = this.svg.getBoundingClientRect()
      const viewBox = this.svg.viewBox.baseVal
      this.frozenViewBox = this.svg.getAttribute('viewBox')
      this.wallDragging = {
        wallIds,
        starts: wallIds.map((id) => {
          const wall = getWall(this.state, id)
          return { id, x: wall?.x ?? 0, y: wall?.y ?? 0 }
        }),
        startClientX: event.clientX,
        startClientY: event.clientY,
        scaleX: viewBox.width / rect.width,
        scaleY: viewBox.height / rect.height,
        moved: false,
        shiftKey: additive,
        clickWallId: wallId,
        pendingOpeningSelect: null,
      }
      this.svg.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    this.onWallSelect?.(null, additive)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (this.openingDragging && this.onOpeningsMove) {
      const dx = (event.clientX - this.openingDragging.startClientX) * this.openingDragging.scaleX
      const dy = -(event.clientY - this.openingDragging.startClientY) * this.openingDragging.scaleY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        this.openingDragging.moved = true
      }
      if (!this.openingDragging.moved) return
      this.onOpeningsMove(dx, dy, false, {
        wallId: this.openingDragging.wallId,
        openingId: this.openingDragging.openingId,
      })
      return
    }

    if (this.wallDragging && this.onWallsMove) {
      const dx = (event.clientX - this.wallDragging.startClientX) * this.wallDragging.scaleX
      const dy = -(event.clientY - this.wallDragging.startClientY) * this.wallDragging.scaleY

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        this.wallDragging.moved = true
      }
      if (!this.wallDragging.moved) return

      const snapDx = snapToGrid(dx, WALL_MOVE_SNAP)
      const snapDy = snapToGrid(dy, WALL_MOVE_SNAP)
      this.onWallsMove(
        this.wallDragging.starts.map((start) => ({
          id: start.id,
          x: start.x + snapDx,
          y: start.y + snapDy,
        })),
        false,
      )
      return
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (this.openingDragging) {
      if (this.openingDragging.moved && this.onOpeningsMove) {
        this.onOpeningsMove(0, 0, true, {
          wallId: this.openingDragging.wallId,
          openingId: this.openingDragging.openingId,
        })
      } else {
        this.onOpeningSelect?.(
          this.openingDragging.wallId,
          this.openingDragging.openingId,
          this.openingDragging.additive,
          this.openingDragging.openingPart,
        )
      }
      this.openingDragging = null
      this.frozenViewBox = null
      this.render()
      if (this.svg.hasPointerCapture(event.pointerId)) {
        this.svg.releasePointerCapture(event.pointerId)
      }
      return
    }

    if (this.wallDragging) {
      if (this.wallDragging.moved && this.onWallsMove) {
        const dx = (event.clientX - this.wallDragging.startClientX) * this.wallDragging.scaleX
        const dy = -(event.clientY - this.wallDragging.startClientY) * this.wallDragging.scaleY
        const snapDx = snapToGrid(dx, WALL_MOVE_SNAP)
        const snapDy = snapToGrid(dy, WALL_MOVE_SNAP)
        this.onWallsMove(
          this.wallDragging.starts.map((start) => ({
            id: start.id,
            x: start.x + snapDx,
            y: start.y + snapDy,
          })),
          true,
        )
        if (!this.editor.selectedWallIds.includes(this.wallDragging.clickWallId)) {
          this.onWallSelect?.(this.wallDragging.clickWallId, this.wallDragging.shiftKey)
        }
      } else if (this.wallDragging.pendingOpeningSelect) {
        const pending = this.wallDragging.pendingOpeningSelect
        this.onOpeningSelect?.(pending.wallId, pending.openingId, this.wallDragging.shiftKey)
      } else {
        this.onWallSelect?.(this.wallDragging.clickWallId, this.wallDragging.shiftKey)
      }

      this.wallDragging = null
      this.frozenViewBox = null
      this.render()
      if (this.svg.hasPointerCapture(event.pointerId)) {
        this.svg.releasePointerCapture(event.pointerId)
      }
      return
    }
  }
}

function createEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag)
}

function svgY(wallHeight: number, opening: Opening): number {
  return wallHeight - opening.y - opening.height
}

function profileContext(
  wallHeight: number,
  opening: Opening,
  edge: OpeningEdge,
  depth: number,
  extraTop = 0,
  outwardExtra = 0,
) {
  const y = svgY(wallHeight, opening) + extraTop
  switch (edge) {
    case 'top':
      return { edge, length: opening.width, x: opening.x, y: y - depth - outwardExtra }
    case 'bottom':
      return { edge, length: opening.width, x: opening.x, y: y + opening.height + outwardExtra }
    case 'left':
      return { edge, length: opening.height, x: opening.x - depth - outwardExtra, y }
    case 'right':
      return { edge, length: opening.height, x: opening.x + opening.width + outwardExtra, y }
  }
}

function cloneEditor(editor: EditorState): EditorState {
  return {
    selectedWallIds: [...editor.selectedWallIds],
    selectedOpenings: editor.selectedOpenings.map((item) => ({ ...item })),
    selectedEdges: [...editor.selectedEdges],
  }
}
