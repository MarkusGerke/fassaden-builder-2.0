import { defineTokens } from '@pandacss/dev'

/** Park-Recipes nutzen `l1`/`l2`/`l3` — fehlen in Panda-Default (nur xs…full). */
export const radii = defineTokens.radii({
  l1: { value: '0.125rem' },
  l2: { value: '0.25rem' },
  l3: { value: '0.375rem' },
})
