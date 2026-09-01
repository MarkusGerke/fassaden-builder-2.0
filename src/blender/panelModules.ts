/** Paneele v1/v2 aus Blender — gekoppelt an Wandmodul-Namen. */
export interface BlenderPanel {
  moduleName: string
  variant: 'v1' | 'v2'
}

export const BLENDER_PANELS: BlenderPanel[] = [
  { moduleName: '3-96x416-48x192', variant: 'v1' },
  { moduleName: '3-96x416-48x192', variant: 'v2' },
  { moduleName: '4-192x416-48x192', variant: 'v1' },
  { moduleName: '4-192x416-48x192', variant: 'v2' },
  { moduleName: '4-192x416-96x192', variant: 'v1' },
  { moduleName: '4-192x416-96x192', variant: 'v2' },
  { moduleName: '4-192x416-144x192', variant: 'v1' },
  { moduleName: '5-384x416-48x192', variant: 'v1' },
  { moduleName: '5-384x416-96x192', variant: 'v1' },
  { moduleName: '5-384x416-96x192', variant: 'v2' },
  { moduleName: '5-384x416-144x192', variant: 'v1' },
  { moduleName: '5-384x416-144x192', variant: 'v2' },
  { moduleName: '5-384x416-192x192', variant: 'v1' },
  { moduleName: '5-384x416-192x192', variant: 'v2' },
  { moduleName: '5-384x416-288x192', variant: 'v1' },
  { moduleName: '5-384x416-288x192', variant: 'v2' },
]

export function panelId(moduleName: string, variant: 'v1' | 'v2'): string {
  return `${moduleName}-${variant}`
}
