import type { Opening, Wall } from '../types/facade'
import { createId } from './id'

const STORAGE_KEY = 'fassaden-builder-style-templates-v1'

/** Gespeicherter Stil-Snapshot (Wand + erste Öffnung/Rahmen). */
export interface StyleTemplate {
  id: string
  name: string
  draft: StyleTemplateDraft
}

export interface StyleTemplateDraft {
  panel?: Wall['panel']
  wallColor?: string
  interiorColor?: string
  claddingColor?: string
  profileColor?: string
  wallFinish?: Wall['wallFinish']
  claddingFinish?: Wall['claddingFinish']
  profileFinish?: Wall['profileFinish']
  cornice?: Wall['cornice']
  panelFlip?: boolean
  opening?: Omit<Opening, 'id' | 'x'>
  frameProfileId?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeStyleTemplate(raw: unknown): StyleTemplate | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  if (!isRecord(raw.draft)) return null
  return {
    id: raw.id,
    name: raw.name.trim() || 'Stil-Vorlage',
    draft: raw.draft as StyleTemplateDraft,
  }
}

export function loadStyleTemplates(): StyleTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeStyleTemplate).filter((t): t is StyleTemplate => Boolean(t))
  } catch {
    return []
  }
}

export function saveStyleTemplates(templates: StyleTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore
  }
}

export function createStyleTemplate(name: string, draft: StyleTemplateDraft): StyleTemplate {
  return {
    id: createId(),
    name: name.trim() || 'Stil-Vorlage',
    draft: { ...draft },
  }
}

/** Snapshot aus Wand (und optional erster Öffnung + Rahmenprofil). */
export function draftFromWallStyle(
  wall: Wall,
  opening?: Opening,
  frameProfileId?: string | null,
): StyleTemplateDraft {
  const { id: _id, x: _x, ...openingRest } = opening ?? ({} as Opening)
  return {
    panel: wall.panel ? { ...wall.panel } : undefined,
    wallColor: wall.wallColor,
    interiorColor: wall.interiorColor,
    claddingColor: wall.claddingColor,
    profileColor: wall.profileColor,
    wallFinish: wall.wallFinish,
    claddingFinish: wall.claddingFinish,
    profileFinish: wall.profileFinish,
    cornice: wall.cornice ? { ...wall.cornice } : undefined,
    panelFlip: wall.panelFlip,
    opening: opening ? (openingRest as StyleTemplateDraft['opening']) : undefined,
    frameProfileId: frameProfileId ?? null,
  }
}
