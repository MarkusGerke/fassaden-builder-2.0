import { applyHauswandGeneration } from '../arrivieren/applyHauswandGeneration'
import { generateHauswand, parseHauswandSeed } from '../arrivieren/generateHauswand'
import { ALL_EDGES } from '../constants/presets'
import { assignProfilesToOpenings } from '../utils/openings'
import { getAllWalls } from '../utils/buildings'
import { createDefaultFacadeState, type FacadeState, type OpeningRef, type Wall } from '../types/facade'
import { normalizeStudioPanel } from '../studio/constants'
import { isStudioWall } from '../studio/walls'
import { PLAY_WHITE, type PlayStarterDef } from './playTypes'

/** Einfaches Standard-Fensterprofil für Starter (nicht nacktes Loch). */
export const PLAY_STARTER_FRAME_PROFILE = 'fensterprofil32x120'

/** Standard-Sockelhöhe für Start-Häuser (Arrivieren selbst lässt Sockel aus). */
export const PLAY_STARTER_PLINTH_HEIGHT_CM = 48

/**
 * Kuratierte weiße Start-Fassaden (Hülle + einfache Fenster/Türen).
 * Seeds sind fest, damit der Katalog stabil bleibt.
 */
export const PLAY_STARTERS: PlayStarterDef[] = [
  {
    id: 'stadthaus-3',
    name: 'Stadthaus',
    blurb: 'Drei Geschosse, ruhige Fensterflucht',
    seed: 405147048,
    storeysHint: '3 Geschosse',
  },
  {
    id: 'schmal-2',
    name: 'Schmales Haus',
    blurb: 'Zwei Geschosse, schmale Front',
    seed: 220011001,
    storeysHint: '2 Geschosse',
  },
  {
    id: 'breit-3',
    name: 'Breite Fassade',
    blurb: 'Mehr Achsen, Platz zum Bestücken',
    seed: 880022003,
    storeysHint: '3 Geschosse',
  },
  {
    id: 'hoch-4',
    name: 'Mehrfamilienhaus',
    blurb: 'Vier Geschosse, klassische Serie',
    seed: 110033004,
    storeysHint: '4 Geschosse',
  },
  {
    id: 'eckig-3',
    name: 'Kompaktes Mietshaus',
    blurb: 'Drei Geschosse, dichtere Öffnungen',
    seed: 550044005,
    storeysHint: '3 Geschosse',
  },
  {
    id: 'laden-3',
    name: 'Mit Ladenzeile',
    blurb: 'EG anders, OGs fluchten',
    seed: 770055006,
    storeysHint: '3 Geschosse',
  },
  {
    id: 'hoch-5',
    name: 'Hohes Haus',
    blurb: 'Fünf Geschosse — viel Fläche',
    seed: 990066007,
    storeysHint: '5 Geschosse',
  },
  {
    id: 'mittel-4',
    name: 'Mittelgroß',
    blurb: 'Vier Geschosse, ausgewogen',
    seed: 330077008,
    storeysHint: '4 Geschosse',
  },
]

export function getPlayStarter(id: string): PlayStarterDef | undefined {
  return PLAY_STARTERS.find((s) => s.id === id)
}

function isNearWhite(hex: string | undefined): boolean {
  if (!hex) return true
  const h = hex.trim().toLowerCase()
  return h === '#fff' || h === '#ffffff' || h === 'white'
}

/** Wandfarbe / Cladding auf Weiß, Dekor bleibt aus (Arrivieren-Strip). */
export function whitenPlayFacade(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((b) => ({
      ...b,
      bareWalls: false,
      walls: b.walls.map((w) => whitenWall(w)),
      roof: b.roof
        ? {
            ...b.roof,
            tileColor: PLAY_WHITE,
            gableColor: PLAY_WHITE,
          }
        : b.roof,
    })),
  }
}

function whitenWall(wall: Wall): Wall {
  return {
    ...wall,
    wallColor: PLAY_WHITE,
    interiorColor: PLAY_WHITE,
    claddingColor: PLAY_WHITE,
    openings: (wall.openings ?? []).map((o) => ({
      ...o,
      frameColor: o.frameColor ?? PLAY_WHITE,
      revealExteriorColor: PLAY_WHITE,
      revealInteriorColor: PLAY_WHITE,
    })),
  }
}

/** Außenwände: Sockel an, 48 cm, Farbe = Weiß (wie Wand). Innenwände unverändert. */
function applyPlayStarterPlinth(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((b) => ({
      ...b,
      walls: b.walls.map((w) => {
        if (!isStudioWall(w) || w.role === 'interior') return w
        return {
          ...w,
          panel: normalizeStudioPanel({
            ...(w.panel ?? {}),
            plinthEnabled: true,
            plinthHeight: PLAY_STARTER_PLINTH_HEIGHT_CM,
            plinthDepth: w.panel?.plinthDepth && w.panel.plinthDepth > 0 ? w.panel.plinthDepth : 8,
            plinthColor: PLAY_WHITE,
            plinthProfileColor: PLAY_WHITE,
            plinthProfileId: w.panel?.plinthProfileId ?? 'sockelprofil',
          }),
        }
      }),
    })),
  }
}

function openingRefsOnState(state: FacadeState): OpeningRef[] {
  const refs: OpeningRef[] = []
  for (const wall of getAllWalls(state)) {
    for (const o of wall.openings ?? []) {
      if (o.type === 'window' || o.type === 'door') {
        refs.push({ wallId: wall.id, openingId: o.id })
      }
    }
  }
  return refs
}

/**
 * Baut ein weißes Spielhaus aus einem Starter (Arrivieren-Plan + Weiß + einfaches Profil).
 * `base` wird als Träger genutzt (aktives Gebäude); fehlt es, Default-State.
 */
export function buildPlayStarterFacade(starterId: string, base?: FacadeState): FacadeState {
  const starter = getPlayStarter(starterId)
  if (!starter) {
    throw new Error(`Unbekannter Play-Starter: ${starterId}`)
  }
  const seed = parseHauswandSeed(starter.seed)
  const plan = generateHauswand(seed)
  const carrier = base ?? createDefaultFacadeState()
  let next = applyHauswandGeneration(carrier, plan)
  next = whitenPlayFacade(next)
  next = applyPlayStarterPlinth(next)
  const refs = openingRefsOnState(next)
  if (refs.length > 0) {
    next = assignProfilesToOpenings(next, refs, [...ALL_EDGES], PLAY_STARTER_FRAME_PROFILE)
    next = whitenPlayFacade(next)
    next = applyPlayStarterPlinth(next)
  }
  return next
}

export function facadeLooksUnpainted(state: FacadeState): boolean {
  for (const wall of getAllWalls(state)) {
    if (!isNearWhite(wall.wallColor)) return false
    if (wall.panel?.enabled && !isNearWhite(wall.claddingColor ?? wall.wallColor)) return false
  }
  return true
}
