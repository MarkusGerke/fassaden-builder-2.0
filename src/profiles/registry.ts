import { classicalProfile } from './classical'
import { projectingProfile } from './projecting'
import {
  fensterprofil32x120Profile,
  fensterprofil35x130Profile,
  fensterprofil40x140Profile,
  sockelprofilProfile,
  traufgesims110x135Profile,
  traufgesims200x200Profile,
  traufgesims70x150Profile,
} from './uploadedSilhouettes'
import { customProfileToDefinition, type CustomProfileDef } from './custom'
import type { ProfileDefinition } from './types'

/** Alte IDs ohne SVG-Vorlage → nächstliegendes SVG-Profil. */
const LEGACY_PROFILE_MAP: Record<string, string> = {
  windowTrim: 'fensterprofil32x120',
  windowTrimV1: 'fensterprofil32x120',
  windowTrimV2: 'fensterprofil35x130',
  kranzgesims: 'traufgesims70x150',
  gurtgesims: 'traufgesims110x135',
  sockelgesims: 'traufgesims70x150',
  konsolgesims: 'traufgesims200x200',
  fensterverdachung: 'fensterprofil40x140',
  sohlbankProfil: 'fensterprofil32x120',
  sockelStandard: 'sockelprofil',
}

export function canonicalProfileId(id: string): string {
  return LEGACY_PROFILE_MAP[id] ?? id
}

export const PROFILES: Record<string, ProfileDefinition> = {
  projecting: projectingProfile,
  classical: classicalProfile,
  fensterprofil32x120: fensterprofil32x120Profile,
  fensterprofil35x130: fensterprofil35x130Profile,
  fensterprofil40x140: fensterprofil40x140Profile,
  traufgesims70x150: traufgesims70x150Profile,
  traufgesims110x135: traufgesims110x135Profile,
  traufgesims200x200: traufgesims200x200Profile,
  sockelprofil: sockelprofilProfile,
}

export const PROFILE_LIST = Object.values(PROFILES)

export function getProfile(id: string): ProfileDefinition | undefined {
  return PROFILES[canonicalProfileId(id)]
}

export function resolveProfile(
  id: string,
  custom: CustomProfileDef[] | undefined,
): ProfileDefinition | undefined {
  const resolved = canonicalProfileId(id)
  const builtIn = PROFILES[resolved]
  if (builtIn) return builtIn
  const def = custom?.find((item) => item.id === resolved || item.id === id)
  return def ? customProfileToDefinition(def) : undefined
}

export function allProfiles(custom: CustomProfileDef[] | undefined): ProfileDefinition[] {
  const extras = (custom ?? []).map(customProfileToDefinition)
  return [...PROFILE_LIST, ...extras]
}
