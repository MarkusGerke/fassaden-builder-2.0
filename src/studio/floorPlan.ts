import type { Building, FacadeState, StudioPanelConfig, StudioYawDeg, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { updateActiveBuilding } from '../utils/buildings'
import { floorIndex } from '../utils/layers'
import { createId } from '../utils/id'
import { PLAN_GRID, normalizeStudioPanel } from './constants'
import { createStudioWall, isStudioWall, wallEndPoint, wallStartPoint } from './walls'

export interface PlanNode {
  id: string
  gx: number
  gz: number
}

export interface PlanEdge {
  id: string
  fromId: string
  toId: string
}

export interface FloorPlan {
  nodes: PlanNode[]
  edges: PlanEdge[]
  /** Decke über dieser Etage in 3D (Default true). */
  showCeiling?: boolean
  /** Decken- und Bodenfarbe (HEX); Default Weiß. */
  ceilingColor?: string
  /** Etage ausblenden. */
  hidden?: boolean
}

export function createEmptyFloorPlan(): FloorPlan {
  return { nodes: [], edges: [] }
}

export function planNodeWorld(node: PlanNode): { x: number; z: number } {
  return { x: node.gx * PLAN_GRID, z: node.gz * PLAN_GRID }
}

export function edgeGridDelta(from: PlanNode, to: PlanNode): { dx: number; dz: number } {
  return { dx: to.gx - from.gx, dz: to.gz - from.gz }
}

export function isValidPlanEdge(from: PlanNode, to: PlanNode): boolean {
  return isValidPlanLine(from.gx, from.gz, to.gx, to.gz)
}

export function edgeLengthCm(from: PlanNode, to: PlanNode): number {
  const { dx, dz } = edgeGridDelta(from, to)
  return PLAN_GRID * Math.hypot(dx, dz)
}

export function edgeYawDeg(from: PlanNode, to: PlanNode): StudioYawDeg {
  const { dx, dz } = edgeGridDelta(from, to)
  const deg = (Math.atan2(dz, dx) * 180) / Math.PI
  const normalized = ((deg % 360) + 360) % 360
  const snapped = (Math.round(normalized / 45) * 45) % 360
  return snapped as StudioYawDeg
}

export function isValidPlanLine(fromGx: number, fromGz: number, toGx: number, toGz: number): boolean {
  const dx = toGx - fromGx
  const dz = toGz - fromGz
  if (dx === 0 && dz === 0) return false
  const ax = Math.abs(dx)
  const az = Math.abs(dz)
  return ax === az || ax === 0 || az === 0
}

export function planLineStepCount(fromGx: number, fromGz: number, toGx: number, toGz: number): number {
  return Math.max(Math.abs(toGx - fromGx), Math.abs(toGz - fromGz))
}

/** Gesamtlänge aller Wandsegmente entlang der Linie (cm). */
export function planLineLengthCm(fromGx: number, fromGz: number, toGx: number, toGz: number): number {
  const steps = planLineStepCount(fromGx, fromGz, toGx, toGz)
  const dx = Math.abs(toGx - fromGx)
  const dz = Math.abs(toGz - fromGz)
  const segmentLen = dx === dz && dx > 0 ? PLAN_GRID * Math.SQRT2 : PLAN_GRID
  return steps * segmentLen
}

export function planLineCells(
  fromGx: number,
  fromGz: number,
  toGx: number,
  toGz: number,
): Array<{ gx: number; gz: number }> {
  const steps = planLineStepCount(fromGx, fromGz, toGx, toGz)
  const dx = toGx - fromGx
  const dz = toGz - fromGz
  const cells: Array<{ gx: number; gz: number }> = []
  for (let i = 0; i <= steps; i += 1) {
    cells.push({
      gx: fromGx + Math.round((dx * i) / steps),
      gz: fromGz + Math.round((dz * i) / steps),
    })
  }
  return cells
}

export function formatPlanLengthCm(lengthCm: number): string {
  return `${Math.round(lengthCm)} cm`
}

export function getPlanNodeAt(plan: FloorPlan, gx: number, gz: number): PlanNode | undefined {
  return plan.nodes.find((node) => node.gx === gx && node.gz === gz)
}

/** Linie zeichnen: Start- und Endknoten verbinden (keine Zwischenschritte im 48-cm-Raster). */
export function drawPlanLine(
  plan: FloorPlan,
  fromGx: number,
  fromGz: number,
  toGx: number,
  toGz: number,
): FloorPlan {
  if (!isValidPlanLine(fromGx, fromGz, toGx, toGz)) return plan

  let next = plan
  next = addPlanNode(next, fromGx, fromGz)
  next = addPlanNode(next, toGx, toGz)
  const from = getPlanNodeAt(next, fromGx, fromGz)
  const to = getPlanNodeAt(next, toGx, toGz)
  if (from && to) next = connectPlanNodes(next, from.id, to.id)
  return next
}

/**
 * Orthogonales Wandsegment fester Länge (cm) ins Raster einfügen.
 * `axis: 'x'` → nach +X, `axis: 'z'` → nach +Z. Länge muss Vielfaches von PLAN_GRID sein.
 */
export function insertWallSegmentInPlan(
  plan: FloorPlan,
  fromGx: number,
  fromGz: number,
  lengthCm: number,
  axis: 'x' | 'z',
): FloorPlan {
  const cells = Math.round(lengthCm / PLAN_GRID)
  if (cells < 1) return plan
  const toGx = axis === 'x' ? fromGx + cells : fromGx
  const toGz = axis === 'z' ? fromGz + cells : fromGz
  return drawPlanLine(plan, fromGx, fromGz, toGx, toGz)
}

/** Nächsten Plan-Knoten innerhalb von `maxCells` finden (Manhattan/Chebyshev). */

/** Orientierung a→b→c für Schnitt-Tests (−1 / 0 / +1). */
function orientGrid(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  const v = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
  if (v > 0) return 1
  if (v < 0) return -1
  return 0
}

/** Echte Überlappung/Kreuzung zweier Rastersegmente (gemeinsame Endpunkte erlaubt). */
export function gridSegmentsOverlap(
  a0x: number,
  a0z: number,
  a1x: number,
  a1z: number,
  b0x: number,
  b0z: number,
  b1x: number,
  b1z: number,
): boolean {
  if (
    (a0x === a1x && a0z === a1z) ||
    (b0x === b1x && b0z === b1z)
  ) {
    return false
  }
  const o1 = orientGrid(a0x, a0z, a1x, a1z, b0x, b0z)
  const o2 = orientGrid(a0x, a0z, a1x, a1z, b1x, b1z)
  const o3 = orientGrid(b0x, b0z, b1x, b1z, a0x, a0z)
  const o4 = orientGrid(b0x, b0z, b1x, b1z, a1x, a1z)

  // Allgemeine Kreuzung (nicht nur Endpunkt)
  if (o1 !== o2 && o3 !== o4) {
    const shareEndpoint =
      (a0x === b0x && a0z === b0z) ||
      (a0x === b1x && a0z === b1z) ||
      (a1x === b0x && a1z === b0z) ||
      (a1x === b1x && a1z === b1z)
    if (!shareEndpoint) return true
    // Kreuzung genau am Endpunkt: nur dann Overlap, wenn zusätzlich kollinear überlappend
  }

  // Kollinear: Intervalle überlappen mit positiver Länge
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    const dx = a1x - a0x
    const dz = a1z - a0z
    const len2 = dx * dx + dz * dz
    if (len2 === 0) return false
    const t = (px: number, pz: number) => ((px - a0x) * dx + (pz - a0z) * dz) / len2
    const ts = [t(b0x, b0z), t(b1x, b1z)].sort((a, b) => a - b)
    const lo = Math.max(0, ts[0])
    const hi = Math.min(1, ts[1])
    // Strikte Überlappung (nicht nur gemeinsamer Endpunkt)
    return hi - lo > 1e-9
  }

  // T-Stoß (Endpunkt mittig auf fremder Kante, nicht kollinear): erlaubt für Innenwände
  return false
}

/** Prüft, ob das neue Segment bestehende Plan-Kanten kreuzt oder kollinear überlappt. */
export function planSegmentOverlaps(
  plan: FloorPlan,
  fromGx: number,
  fromGz: number,
  toGx: number,
  toGz: number,
): boolean {
  if (fromGx === toGx && fromGz === toGz) return false
  for (const edge of plan.edges) {
    const a = plan.nodes.find((n) => n.id === edge.fromId)
    const b = plan.nodes.find((n) => n.id === edge.toId)
    if (!a || !b) continue
    if (
      gridSegmentsOverlap(fromGx, fromGz, toGx, toGz, a.gx, a.gz, b.gx, b.gz)
    ) {
      return true
    }
  }
  return false
}

export function snapPlanGridToNearestNode(
  plan: FloorPlan,
  gx: number,
  gz: number,
  maxCells = 1,
): { gx: number; gz: number } {
  let best: PlanNode | undefined
  let bestDist = Infinity
  for (const node of plan.nodes) {
    const dist = Math.max(Math.abs(node.gx - gx), Math.abs(node.gz - gz))
    if (dist <= maxCells && dist < bestDist) {
      best = node
      bestDist = dist
    }
  }
  return best ? { gx: best.gx, gz: best.gz } : { gx, gz }
}

export function addPlanNode(plan: FloorPlan, gx: number, gz: number): FloorPlan {
  const exists = plan.nodes.some((node) => node.gx === gx && node.gz === gz)
  if (exists) return plan
  return {
    ...plan,
    nodes: [...plan.nodes, { id: createId(), gx, gz }],
  }
}

export function togglePlanNode(plan: FloorPlan, gx: number, gz: number): FloorPlan {
  const existing = plan.nodes.find((node) => node.gx === gx && node.gz === gz)
  if (!existing) return addPlanNode(plan, gx, gz)
  const nodeIds = new Set([existing.id])
  return {
    nodes: plan.nodes.filter((node) => node.id !== existing.id),
    edges: plan.edges.filter(
      (edge) => !nodeIds.has(edge.fromId) && !nodeIds.has(edge.toId),
    ),
  }
}

export function connectPlanNodes(plan: FloorPlan, fromId: string, toId: string): FloorPlan {
  if (fromId === toId) return plan
  const from = plan.nodes.find((node) => node.id === fromId)
  const to = plan.nodes.find((node) => node.id === toId)
  if (!from || !to || !isValidPlanEdge(from, to)) return plan
  const duplicate = plan.edges.some(
    (edge) =>
      (edge.fromId === fromId && edge.toId === toId) ||
      (edge.fromId === toId && edge.toId === fromId),
  )
  if (duplicate) return plan
  return {
    ...plan,
    edges: [...plan.edges, { id: createId(), fromId, toId }],
  }
}

/** Beispiel-Grundriss: Rechteck-Umriss (nur Ecken, eine Wand pro Seite). */
export function exampleRectFloorPlan(widthNodes: number, depthNodes: number): FloorPlan {
  let plan = createEmptyFloorPlan()
  const corners: Array<[number, number]> = [
    [0, 0],
    [widthNodes, 0],
    [widthNodes, depthNodes],
    [0, depthNodes],
  ]
  const cornerIds: string[] = []
  for (const [gx, gz] of corners) {
    plan = addPlanNode(plan, gx, gz)
    const node = getPlanNodeAt(plan, gx, gz)
    if (node) cornerIds.push(node.id)
  }
  for (let i = 0; i < cornerIds.length; i += 1) {
    plan = connectPlanNodes(plan, cornerIds[i], cornerIds[(i + 1) % cornerIds.length])
  }
  return plan
}

export interface PlanSegment {
  from: PlanNode
  to: PlanNode
}

export interface PlanRing {
  nodes: PlanNode[]
  closed: boolean
}

function unitDelta(from: PlanNode, to: PlanNode): { dx: number; dz: number } {
  const dx = to.gx - from.gx
  const dz = to.gz - from.gz
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return { dx: 0, dz: 0 }
  return { dx: dx / len, dz: dz / len }
}

function ringSignedArea(nodes: PlanNode[]): number {
  let area = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i]
    const b = nodes[(i + 1) % nodes.length]
    area += a.gx * b.gz - b.gx * a.gz
  }
  return area / 2
}

function ensureCounterClockwise(nodes: PlanNode[]): PlanNode[] {
  if (nodes.length < 3) return nodes
  return ringSignedArea(nodes) < 0 ? [...nodes].reverse() : nodes
}

function simplifyCollinear(nodes: PlanNode[], closed: boolean): PlanNode[] {
  if (nodes.length < 3) return nodes
  const kept: PlanNode[] = []
  const count = nodes.length
  for (let i = 0; i < count; i += 1) {
    if (!closed && (i === 0 || i === count - 1)) {
      kept.push(nodes[i])
      continue
    }
    const prev = nodes[(i - 1 + count) % count]
    const curr = nodes[i]
    const next = nodes[(i + 1) % count]
    const a = unitDelta(prev, curr)
    const b = unitDelta(curr, next)
    if (Math.abs(a.dx - b.dx) < 1e-6 && Math.abs(a.dz - b.dz) < 1e-6) continue
    kept.push(curr)
  }
  return kept.length >= (closed ? 3 : 2) ? kept : nodes
}

/**
 * Gehrungsversatz am Knoten: tan(Drehwinkel/2) × Wandstärke (Bilderrahmen).
 * 90°-Ecken → Inset = depth (45°-Schnitt). Flush/stumpf steuert `cornerJoin` an Paneel/Sockel/Gesims,
 * nicht dieser Versatz — der Wandkörper braucht den Schnitt, sonst überlappen die Volumen.
 * 180° (kein Knick) bleibt 0.
 */
export function miterInsetCm(
  incoming: { dx: number; dz: number },
  outgoing: { dx: number; dz: number },
  depth: number,
): number {
  const cross = incoming.dx * outgoing.dz - incoming.dz * outgoing.dx
  const dot = incoming.dx * outgoing.dx + incoming.dz * outgoing.dz
  const turn = Math.atan2(cross, dot)
  if (Math.abs(turn) < 1e-6) return 0
  const inset = depth * Math.tan(turn / 2)
  const limit = depth * 4
  return Math.max(-limit, Math.min(limit, inset))
}

function unitWorld(
  from: { x: number; z: number },
  to: { x: number; z: number },
): { dx: number; dz: number } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return { dx: 0, dz: 0 }
  return { dx: dx / len, dz: dz / len }
}

/**
 * Innere Wandkante eines geschlossenen CCW-Rings.
 * Plan-Knoten liegen auf der Außenlinie; die Wanddicke geht nach innen.
 * Ecken per derselben Gehrung wie `wallsFromFloorPlan` / `miterInsetCm`,
 * damit Decke und OG-Boden bündig an der Innenfläche enden.
 */
export function innerFaceRingWorld(
  nodes: PlanNode[],
  depth = WALL_DEPTH,
): Array<{ x: number; z: number }> {
  if (nodes.length < 3) return []
  const pts = nodes.map(planNodeWorld)
  const count = pts.length
  const result: Array<{ x: number; z: number }> = []
  for (let i = 0; i < count; i += 1) {
    const prev = pts[(i - 1 + count) % count]
    const curr = pts[i]
    const next = pts[(i + 1) % count]
    const incoming = unitWorld(prev, curr)
    const outgoing = unitWorld(curr, next)
    if (
      incoming.dx === 0 &&
      incoming.dz === 0 &&
      outgoing.dx === 0 &&
      outgoing.dz === 0
    ) {
      result.push({ x: curr.x, z: curr.z })
      continue
    }
    const dir = outgoing.dx === 0 && outgoing.dz === 0 ? incoming : outgoing
    const miter = miterInsetCm(
      incoming.dx === 0 && incoming.dz === 0 ? dir : incoming,
      dir,
      depth,
    )
    result.push({
      x: curr.x + dir.dx * miter - dir.dz * depth,
      z: curr.z + dir.dz * miter + dir.dx * depth,
    })
  }
  return result
}

function buildAdjacency(plan: FloorPlan) {
  const adj = new Map<string, Array<{ edgeId: string; neighborId: string }>>()
  const add = (nodeId: string, entry: { edgeId: string; neighborId: string }) => {
    const list = adj.get(nodeId) ?? []
    list.push(entry)
    adj.set(nodeId, list)
  }
  for (const edge of plan.edges) {
    add(edge.fromId, { edgeId: edge.id, neighborId: edge.toId })
    add(edge.toId, { edgeId: edge.id, neighborId: edge.fromId })
  }
  return adj
}

/** true, wenn P streng zwischen A und B auf der Rasterkante liegt (nicht Endpunkt). */
function pointStrictlyOnGridSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  if (orientGrid(ax, az, bx, bz, px, pz) !== 0) return false
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-12) return false
  const t = ((px - ax) * dx + (pz - az) * dz) / len2
  return t > 1e-9 && t < 1 - 1e-9
}

/**
 * T-Stoß: Knoten, der geometrisch auf einer fremden Kante liegt, splittet diese Kante.
 * Sonst bleibt ein Erker/Vorsprung eine offene Kette und fehlt in der Deckenplatte.
 */
export function splitEdgesAtTJoints(plan: FloorPlan): FloorPlan {
  let next = plan
  let guard = 0
  while (guard < 64) {
    guard += 1
    const nodeById = new Map(next.nodes.map((n) => [n.id, n]))
    let split: { edgeId: string; nodeId: string; fromId: string; toId: string } | null = null
    for (const node of next.nodes) {
      for (const edge of next.edges) {
        if (edge.fromId === node.id || edge.toId === node.id) continue
        const a = nodeById.get(edge.fromId)
        const b = nodeById.get(edge.toId)
        if (!a || !b) continue
        if (!pointStrictlyOnGridSegment(node.gx, node.gz, a.gx, a.gz, b.gx, b.gz)) continue
        split = { edgeId: edge.id, nodeId: node.id, fromId: a.id, toId: b.id }
        break
      }
      if (split) break
    }
    if (!split) break
    const { edgeId, nodeId, fromId, toId } = split
    const rest = next.edges.filter((e) => e.id !== edgeId)
    const has = (a: string, b: string) =>
      rest.some(
        (e) =>
          (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a),
      )
    const added: PlanEdge[] = []
    if (!has(fromId, nodeId)) added.push({ id: createId(), fromId, toId: nodeId })
    if (!has(nodeId, toId)) added.push({ id: createId(), fromId: nodeId, toId })
    next = { ...next, edges: [...rest, ...added] }
  }
  return next
}

function hasAlternatePath(
  plan: FloorPlan,
  fromId: string,
  toId: string,
  avoidEdgeId: string,
): boolean {
  const adj = buildAdjacency(plan)
  const queue = [fromId]
  const seen = new Set<string>([fromId])
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const link of adj.get(cur) ?? []) {
      if (link.edgeId === avoidEdgeId) continue
      if (link.neighborId === toId) return true
      if (seen.has(link.neighborId)) continue
      seen.add(link.neighborId)
      queue.push(link.neighborId)
    }
  }
  return false
}

/**
 * Sehnen entfernen: Kante zwischen zwei Verzweigungen, wenn ein Umweg existiert
 * (z. B. Parent-Segment über Erker-Mündung nach T-Split) — sonst bleibt die Decke ein Rechteck.
 */
export function removePlanChords(plan: FloorPlan): FloorPlan {
  const adj = buildAdjacency(plan)
  const remove = new Set<string>()
  for (const edge of plan.edges) {
    const degA = (adj.get(edge.fromId) ?? []).length
    const degB = (adj.get(edge.toId) ?? []).length
    if (degA < 3 || degB < 3) continue
    if (hasAlternatePath(plan, edge.fromId, edge.toId, edge.id)) {
      remove.add(edge.id)
    }
  }
  if (remove.size === 0) return plan
  return { ...plan, edges: plan.edges.filter((e) => !remove.has(e.id)) }
}

/** Schärfste Linkskurve (positives atan2) für Face-Walk am Outer. */
function pickLeftTurnEdgeId(
  prev: PlanNode,
  curr: PlanNode,
  candidates: Array<{ edgeId: string; neighborId: string }>,
  nodeById: Map<string, PlanNode>,
): string | undefined {
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]!.edgeId
  const incoming = unitDelta(prev, curr)
  let bestId = candidates[0]!.edgeId
  let bestTurn = -Infinity
  for (const link of candidates) {
    const next = nodeById.get(link.neighborId)
    if (!next) continue
    const outgoing = unitDelta(curr, next)
    const cross = incoming.dx * outgoing.dz - incoming.dz * outgoing.dx
    const dot = incoming.dx * outgoing.dx + incoming.dz * outgoing.dz
    const turn = Math.atan2(cross, dot)
    if (turn > bestTurn) {
      bestTurn = turn
      bestId = link.edgeId
    }
  }
  return bestId
}

/** Ringe und Ketten aus dem Grundriss. Geschlossene Ringe sind gegen den Uhrzeigersinn. */
export function extractPlanRings(plan: FloorPlan): PlanRing[] {
  const nodeById = new Map(plan.nodes.map((node) => [node.id, node]))
  const adj = buildAdjacency(plan)
  const unused = new Set(plan.edges.map((edge) => edge.id))
  const rings: PlanRing[] = []

  const takeWalk = (startId: string, firstEdgeId: string): PlanNode[] => {
    const nodes: PlanNode[] = []
    const start = nodeById.get(startId)
    if (!start) return nodes
    nodes.push(start)
    let currentId = startId
    let edgeId: string | undefined = firstEdgeId
    while (edgeId && unused.has(edgeId)) {
      unused.delete(edgeId)
      const links = adj.get(currentId) ?? []
      const used = links.find((link) => link.edgeId === edgeId)
      if (!used) break
      const next = nodeById.get(used.neighborId)
      if (!next) break
      nodes.push(next)
      currentId = next.id
      if (currentId === startId) break
      const prevId = nodes[nodes.length - 2]?.id
      const prevNode = nodeById.get(prevId!)
      const currNode = nodeById.get(currentId)
      const nextLinks = (adj.get(currentId) ?? []).filter(
        (link) => unused.has(link.edgeId) && link.neighborId !== prevId,
      )
      edgeId =
        prevNode && currNode
          ? pickLeftTurnEdgeId(prevNode, currNode, nextLinks, nodeById)
          : nextLinks[0]?.edgeId
    }
    return nodes
  }

  const degree1 = [...adj.entries()]
    .filter(([, links]) => links.length === 1)
    .map(([id]) => id)

  for (const startId of degree1) {
    const links = (adj.get(startId) ?? []).filter((link) => unused.has(link.edgeId))
    if (links.length === 0) continue
    const walked = takeWalk(startId, links[0].edgeId)
    if (walked.length >= 2) {
      rings.push({ nodes: simplifyCollinear(walked, false), closed: false })
    }
  }

  while (unused.size > 0) {
    const edge = plan.edges.find((item) => unused.has(item.id))
    if (!edge) break
    const walked = takeWalk(edge.fromId, edge.id)
    if (walked.length >= 2 && walked[0].id === walked[walked.length - 1].id) {
      const loop = walked.slice(0, -1)
      if (loop.length >= 3) {
        rings.push({
          nodes: simplifyCollinear(ensureCounterClockwise(loop), true),
          closed: true,
        })
      }
    } else if (walked.length >= 2) {
      rings.push({ nodes: simplifyCollinear(walked, false), closed: false })
    }
  }

  return rings
}

export function planHasClosedRing(plan: FloorPlan): boolean {
  return extractPlanRings(plan).some((ring) => ring.closed)
}

/** Shoelace-Fläche in Welt-XZ (Absolutwert). */
export function polygonAreaXZ(pts: Array<{ x: number; z: number }>): number {
  let sum = 0
  const n = pts.length
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum) * 0.5
}

/** Ray-Cast: Punkt in Polygon (XZ), Kante auf dem Rand zählt als innen. */
export function pointInPolygonXZ(
  px: number,
  pz: number,
  pts: Array<{ x: number; z: number }>,
): boolean {
  if (pts.length < 3) return false
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x
    const zi = pts[i].z
    const xj = pts[j].x
    const zj = pts[j].z
    const intersect =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export interface PlanFaceWithHoles {
  /** Äußerer geschlossener Ring (Gebäudeumriss). */
  outer: PlanNode[]
  /** Höfe / Innenhöfe als Löcher (liegen im Outer). */
  holes: PlanNode[][]
}

/**
 * Geschlossene Ringe als Flächen mit Nesting: kleinerer Ring im größeren = Loch.
 * Verhindert, dass ein umschließendes Rechteck + Hof als zwei volle Platten (AABB) erscheinen.
 */
export function planFacesWithHoles(plan: FloorPlan): PlanFaceWithHoles[] {
  const closed = extractPlanRings(plan).filter((ring) => ring.closed && ring.nodes.length >= 3)
  if (closed.length === 0) return []

  type Entry = {
    nodes: PlanNode[]
    world: Array<{ x: number; z: number }>
    area: number
    cx: number
    cz: number
  }
  const entries: Entry[] = closed.map((ring) => {
    const world = ring.nodes.map(planNodeWorld)
    const area = polygonAreaXZ(world)
    let cx = 0
    let cz = 0
    for (const p of world) {
      cx += p.x
      cz += p.z
    }
    cx /= world.length
    cz /= world.length
    return { nodes: ring.nodes, world, area, cx, cz }
  })
  entries.sort((a, b) => b.area - a.area)

  const usedAsHole = new Set<number>()
  const faces: PlanFaceWithHoles[] = []

  for (let i = 0; i < entries.length; i += 1) {
    if (usedAsHole.has(i)) continue
    const outer = entries[i]
    const holes: PlanNode[][] = []
    for (let j = i + 1; j < entries.length; j += 1) {
      if (usedAsHole.has(j)) continue
      const inner = entries[j]
      if (inner.area >= outer.area - 1e-6) continue
      if (!pointInPolygonXZ(inner.cx, inner.cz, outer.world)) continue
      // Direktes Nesting: kein größerer Zwischenring zwischen outer und inner
      let nestedInOther = false
      for (let k = i + 1; k < j; k += 1) {
        if (usedAsHole.has(k)) continue
        const mid = entries[k]
        if (
          mid.area < outer.area - 1e-6 &&
          mid.area > inner.area + 1e-6 &&
          pointInPolygonXZ(mid.cx, mid.cz, outer.world) &&
          pointInPolygonXZ(inner.cx, inner.cz, mid.world)
        ) {
          nestedInOther = true
          break
        }
      }
      if (nestedInOther) continue
      holes.push(inner.nodes)
      usedAsHole.add(j)
    }
    faces.push({ outer: outer.nodes, holes })
  }
  return faces
}


/** Entfernt einen Knoten und alle verbundenen Kanten. */
export function removePlanNode(plan: FloorPlan, nodeId: string): FloorPlan {
  const edges = plan.edges.filter(
    (edge) => edge.fromId !== nodeId && edge.toId !== nodeId,
  )
  const nodes = plan.nodes.filter((node) => node.id !== nodeId)
  return { nodes, edges }
}

/** Entfernt eine einzelne Kante. */
export function removePlanEdge(plan: FloorPlan, edgeId: string): FloorPlan {
  return { ...plan, edges: plan.edges.filter((edge) => edge.id !== edgeId) }
}

/** Verschiebt einen Knoten auf neue Gitterkoordinaten. */
export function movePlanNode(plan: FloorPlan, nodeId: string, gx: number, gz: number): FloorPlan {
  // Nur wenn kein anderer Knoten an dieser Position ist.
  const occupied = plan.nodes.some((node) => node.id !== nodeId && node.gx === gx && node.gz === gz)
  if (occupied) return plan
  return {
    ...plan,
    nodes: plan.nodes.map((node) => (node.id === nodeId ? { ...node, gx, gz } : node)),
  }
}

export function wouldCloseFloorPlan(
  plan: FloorPlan,
  from: { gx: number; gz: number },
  to: { gx: number; gz: number },
  loopStart: { gx: number; gz: number } | null,
): boolean {
  if (!loopStart) return false
  if (to.gx !== loopStart.gx || to.gz !== loopStart.gz) return false
  if (from.gx === to.gx && from.gz === to.gz) return false
  if (!isValidPlanLine(from.gx, from.gz, to.gx, to.gz)) return false
  return plan.edges.length >= 2
}

/** Kollineare Kanten zu durchgehenden Wandsegmenten zusammenführen. */
export function mergedPlanSegments(plan: FloorPlan): PlanSegment[] {
  return extractPlanRings(plan).flatMap((ring) => {
    const nodes = ring.closed ? [...ring.nodes, ring.nodes[0]] : ring.nodes
    const segments: PlanSegment[] = []
    for (let i = 0; i < nodes.length - 1; i += 1) {
      segments.push({ from: nodes[i], to: nodes[i + 1] })
    }
    return segments
  })
}

/** Yaw so, dass lokales +X der Welt-Kante folgt (Three.js rotation.y). */
export function wallYawDegFromWorld(
  from: { x: number; z: number },
  to: { x: number; z: number },
): StudioYawDeg {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const deg = (Math.atan2(-dz, dx) * 180) / Math.PI
  const normalized = ((deg % 360) + 360) % 360
  const snapped = (Math.round(normalized / 45) * 45) % 360
  return snapped as StudioYawDeg
}

/** Yaw so, dass lokales +X der Kante folgt (Three.js rotation.y). */
export function wallYawDegFromSegment(from: PlanNode, to: PlanNode): StudioYawDeg {
  return wallYawDegFromWorld(planNodeWorld(from), planNodeWorld(to))
}

export function assignMiters(
  nodes: PlanNode[],
  closed: boolean,
  depth: number,
): Array<{ from: PlanNode; to: PlanNode; miterStart: number; miterEnd: number }> {
  const count = nodes.length
  const edges = closed ? count : count - 1
  const result: Array<{ from: PlanNode; to: PlanNode; miterStart: number; miterEnd: number }> = []

  for (let i = 0; i < edges; i += 1) {
    const from = nodes[i]
    const to = nodes[(i + 1) % count]
    let miterStart = 0
    let miterEnd = 0

    if (closed || i > 0) {
      const prev = nodes[(i - 1 + count) % count]
      miterStart = miterInsetCm(unitDelta(prev, from), unitDelta(from, to), depth)
    }
    if (closed || i < edges - 1) {
      const next = nodes[(i + 2) % count]
      miterEnd = miterInsetCm(unitDelta(from, to), unitDelta(to, next), depth)
    }

    const length = edgeLengthCm(from, to)
    const total = Math.abs(miterStart) + Math.abs(miterEnd)
    if (total > length * 0.9 && total > 0) {
      const scale = (length * 0.9) / total
      miterStart *= scale
      miterEnd *= scale
    }

    result.push({ from, to, miterStart, miterEnd })
  }

  return result
}

export function wallsFromFloorPlan(
  plan: FloorPlan,
  wallY = 0,
  panel?: StudioPanelConfig,
  wallDepth = WALL_DEPTH,
): Wall[] {
  const walls: Wall[] = []
  const studioPanel = panel ? normalizeStudioPanel(panel) : undefined

  for (const ring of extractPlanRings(plan)) {
    if (ring.nodes.length < 2) continue
    const segments = assignMiters(ring.nodes, ring.closed, wallDepth)

    for (const segment of segments) {
      const { from, to, miterStart, miterEnd } = segment
      const world = planNodeWorld(from)
      const length = edgeLengthCm(from, to)
      const yawDeg = wallYawDegFromSegment(from, to)

      walls.push({
        ...createStudioWall(world.x, wallY),
        width: length,
        originX: world.x,
        originZ: world.z,
        yawDeg,
        panelFlip: true,
        planLinked: true,
        miterStart,
        miterEnd,
        ...(studioPanel ? { panel: { ...studioPanel } } : {}),
        x: world.x,
        y: wallY,
        depth: wallDepth,
      })
    }
  }

  return walls
}

export function applyFloorPlanToState(
  state: FacadeState,
  plan: FloorPlan,
  wallY = 0,
  replace = true,
): FacadeState {
  return updateActiveBuilding(state, (building) => {
    const existingPanel = building.walls.find((wall) => wall.kind === 'studio')?.panel
    const studioWalls = wallsFromFloorPlan(plan, wallY, existingPanel, building.wallDepth ?? WALL_DEPTH)
    return {
      ...building,
      walls: replace ? studioWalls : [...building.walls, ...studioWalls],
    }
  })
}

/** Leitet den Grundriss aus verknüpften Studio-Wänden ab (Start-/Endpunkt im 48-cm-Raster). */
export function floorPlanFromWalls(walls: Wall[]): FloorPlan {
  let plan = createEmptyFloorPlan()
  for (const wall of walls) {
    if (!isStudioWall(wall)) continue
    if (wall.planLinked === false) continue
    const start = wallStartPoint(wall)
    const end = wallEndPoint(wall)
    const fromGx = Math.round(start.x / PLAN_GRID)
    const fromGz = Math.round(start.z / PLAN_GRID)
    const toGx = Math.round(end.x / PLAN_GRID)
    const toGz = Math.round(end.z / PLAN_GRID)
    if (fromGx === toGx && fromGz === toGz) continue
    plan = drawPlanLine(plan, fromGx, fromGz, toGx, toGz)
  }
  return removePlanChords(splitEdgesAtTJoints(sealNearClosedPlanGaps(plan)))
}

/**
 * Nach Raster-Snap können angedockte Wandenden 1 Zelle auseinander landen
 * (Weltstoß rundet auf zwei Nachbarzellen). Offene Ringe → keine Decke/Boden.
 * Zwei Grad-1-Enden mit Chebyshev-Abstand 1 werden verbunden bzw. verschmolzen.
 */
export function sealNearClosedPlanGaps(plan: FloorPlan): FloorPlan {
  const adj = buildAdjacency(plan)
  const degree1 = plan.nodes.filter((node) => (adj.get(node.id) ?? []).length === 1)
  if (degree1.length < 2) return plan

  let next = plan
  const used = new Set<string>()
  for (let i = 0; i < degree1.length; i += 1) {
    const a = degree1[i]!
    if (used.has(a.id)) continue
    let best: PlanNode | undefined
    let bestDist = Infinity
    for (let j = i + 1; j < degree1.length; j += 1) {
      const b = degree1[j]!
      if (used.has(b.id)) continue
      const dist = Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gz - b.gz))
      if (dist === 1 && dist < bestDist) {
        best = b
        bestDist = dist
      }
    }
    if (!best) continue
    used.add(a.id)
    used.add(best.id)
    // Gleiche Kante-Richtung: Enden verschmelzen (eine Zelle wählen), sonst kurze Kante ziehen.
    const sameAxis = a.gx === best.gx || a.gz === best.gz
    if (sameAxis) {
      // Endpunkt der längeren angebundenen Kante behalten → weniger Verzerrung.
      next = mergePlanNodes(next, a.id, best.id)
    } else {
      next = drawPlanLine(next, a.gx, a.gz, best.gx, best.gz)
    }
  }
  return next
}

/** Zwei Knoten zu einem verschmelzen (Kanten umbiegen, Duplikate entfernen). */
function mergePlanNodes(plan: FloorPlan, keepId: string, dropId: string): FloorPlan {
  if (keepId === dropId) return plan
  const keep = plan.nodes.find((n) => n.id === keepId)
  const drop = plan.nodes.find((n) => n.id === dropId)
  if (!keep || !drop) return plan
  const edges = plan.edges
    .map((edge) => ({
      ...edge,
      fromId: edge.fromId === dropId ? keepId : edge.fromId,
      toId: edge.toId === dropId ? keepId : edge.toId,
    }))
    .filter((edge) => edge.fromId !== edge.toId)
  // Doppelkanten entfernen
  const seen = new Set<string>()
  const unique = edges.filter((edge) => {
    const key =
      edge.fromId < edge.toId ? `${edge.fromId}|${edge.toId}` : `${edge.toId}|${edge.fromId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return {
    ...plan,
    nodes: plan.nodes.filter((n) => n.id !== dropId),
    edges: unique,
  }
}

/**
 * Übernimmt Node-/Edge-IDs aus dem vorherigen Plan bei gleichen Rasterpunkten.
 * Verhindert, dass `syncFloorPlansFromWalls` bei unveränderter Geometrie neue UUIDs
 * erzeugt und damit einen vollen Fassaden-Rebuild auslöst (z. B. nur Licht ändern).
 */
export function stabilizeFloorPlanIds(prev: FloorPlan | undefined, generated: FloorPlan): FloorPlan {
  if (!prev || prev.nodes.length === 0) return generated
  const stableNodeIdByKey = new Map(prev.nodes.map((n) => [`${n.gx},${n.gz}`, n.id]))
  const generatedKeyById = new Map(generated.nodes.map((n) => [n.id, `${n.gx},${n.gz}`]))
  const nodes = generated.nodes.map((n) => ({
    ...n,
    id: stableNodeIdByKey.get(`${n.gx},${n.gz}`) ?? n.id,
  }))
  const nodeIdByKey = new Map(nodes.map((n) => [`${n.gx},${n.gz}`, n.id]))
  const edgeIdByKey = new Map<string, string>()
  for (const edge of prev.edges) {
    const a = prev.nodes.find((n) => n.id === edge.fromId)
    const b = prev.nodes.find((n) => n.id === edge.toId)
    if (!a || !b) continue
    const ka = `${a.gx},${a.gz}`
    const kb = `${b.gx},${b.gz}`
    edgeIdByKey.set(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`, edge.id)
  }
  const edges = generated.edges.map((edge) => {
    const fromKey = generatedKeyById.get(edge.fromId)
    const toKey = generatedKeyById.get(edge.toId)
    if (!fromKey || !toKey) return edge
    const fromId = nodeIdByKey.get(fromKey) ?? edge.fromId
    const toId = nodeIdByKey.get(toKey) ?? edge.toId
    const edgeKey = fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`
    return { id: edgeIdByKey.get(edgeKey) ?? edge.id, fromId, toId }
  })
  return { nodes, edges }
}

function syncBuildingFloorPlansFromWalls(building: Building): Building {
  const byFloor = new Map<number, Wall[]>()
  for (const wall of building.walls) {
    const idx = floorIndex(wall, building.wallHeight)
    const list = byFloor.get(idx) ?? []
    list.push(wall)
    byFloor.set(idx, list)
  }
  const maxFromWalls = byFloor.size > 0 ? Math.max(...byFloor.keys()) : 0
  const floors: FloorPlan[] = (building.floors ?? [{ nodes: [], edges: [] }]).map((plan) => ({
    nodes: plan.nodes.map((node) => ({ ...node })),
    edges: plan.edges.map((edge) => ({ ...edge })),
    showCeiling: plan.showCeiling,
    ceilingColor: plan.ceilingColor,
    hidden: plan.hidden,
  }))
  while (floors.length <= maxFromWalls) {
    floors.push(createEmptyFloorPlan())
  }
  for (const [idx, walls] of byFloor) {
    const studioWalls = walls.filter(isStudioWall)
    if (studioWalls.length > 0) {
      const prev = floors[idx]
      const generated = floorPlanFromWalls(studioWalls)
      floors[idx] = {
        ...stabilizeFloorPlanIds(prev, generated),
        showCeiling: prev?.showCeiling,
        ceilingColor: prev?.ceilingColor,
        hidden: prev?.hidden,
      }
    }
  }
  return { ...building, floors }
}

/** Hält Grundrisse pro Etage mit den Studio-Wänden in 3D synchron (alle Gebäude). */
export function syncFloorPlansFromWalls(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map(syncBuildingFloorPlansFromWalls),
  }
}
