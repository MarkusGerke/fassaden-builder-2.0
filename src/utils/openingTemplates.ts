import type { Opening } from '../types/facade'
import { createId } from './id'

const STORAGE_KEY = 'fassaden-builder-opening-templates-v1'

/** Gespeicherte Öffnungs-Vorlage = gruppierten Snapshot bestehender Felder. */
export interface OpeningTemplate {
  id: string
  name: string
  /** Ohne id/x — Position wird beim Einfügen gesetzt. */
  draft: OpeningTemplateDraft
}

export type OpeningTemplateDraft = Omit<Partial<Opening>, 'id' | 'x'> & {
  type: 'door' | 'window'
  width: number
  height: number
  /** Profil an allen Öffnungskanten (wall.profiles), optional. */
  profileId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeOpeningTemplate(raw: unknown): OpeningTemplate | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  if (!isRecord(raw.draft)) return null
  const type = raw.draft.type
  if (type !== 'door' && type !== 'window') return null
  const width = Number(raw.draft.width)
  const height = Number(raw.draft.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) return null
  return {
    id: raw.id,
    name: raw.name.trim() || 'Vorlage',
    draft: { ...(raw.draft as OpeningTemplateDraft), type, width, height },
  }
}

export function loadOpeningTemplates(): OpeningTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeOpeningTemplate).filter((t): t is OpeningTemplate => Boolean(t))
  } catch {
    return []
  }
}

export function saveOpeningTemplates(templates: OpeningTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore
  }
}

export function createOpeningTemplate(name: string, draft: OpeningTemplateDraft): OpeningTemplate {
  return {
    id: createId(),
    name: name.trim() || 'Vorlage',
    draft: { ...draft },
  }
}

/** Snapshot einer bestehenden Öffnung als Vorlagen-Draft (ohne Position). */
export function draftFromOpening(opening: Opening): OpeningTemplateDraft {
  const { id: _id, x: _x, ...rest } = opening
  return {
    ...rest,
    type: opening.type === 'door' ? 'door' : 'window',
    width: opening.width,
    height: opening.height,
  }
}

/** Wendet den Draft auf eine frisch erzeugte Opening an (id/x bleiben vom base). */
export function applyTemplateDraft(base: Opening, draft: OpeningTemplateDraft): Opening {
  return {
    ...base,
    ...draft,
    id: base.id,
    x: base.x,
    type: draft.type,
    width: draft.width,
    height: draft.height,
    y: draft.y !== undefined ? draft.y : base.y,
    gruenderzeit: draft.gruenderzeit ? { ...draft.gruenderzeit } : base.gruenderzeit,
    trim: draft.trim ? { ...draft.trim } : base.trim,
    sillInner: draft.sillInner ? { ...draft.sillInner } : base.sillInner,
    sillOuter: draft.sillOuter ? { ...draft.sillOuter } : base.sillOuter,
    pediment: draft.pediment
      ? {
          ...draft.pediment,
          consoles: draft.pediment.consoles ? { ...draft.pediment.consoles } : undefined,
        }
      : base.pediment,
    stairs: draft.stairs ? { ...draft.stairs } : base.stairs,
    basementWindow: draft.basementWindow
      ? { ...draft.basementWindow }
      : base.basementWindow,
  }
}
