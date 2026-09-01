/** Fenstermodelle aus Blender (Collection „Fenster.003“). */
export interface BlenderWindowModel {
  name: string
  width: number
  height: number
}

export const BLENDER_WINDOW_MODELS: BlenderWindowModel[] = [
  { name: '2-48x192', width: 48, height: 192 },
  { name: '3-96x192', width: 96, height: 192 },
  { name: '4-144x192', width: 144, height: 192 },
  { name: '5-192x192', width: 192, height: 192 },
  { name: '6-288x192', width: 288, height: 192 },
]

export function blenderWindowName(width: number, height: number): string | undefined {
  return BLENDER_WINDOW_MODELS.find(
    (model) => model.width === width && model.height === height,
  )?.name
}

export function getBlenderWindowModel(name: string): BlenderWindowModel | undefined {
  return BLENDER_WINDOW_MODELS.find((model) => model.name === name)
}
