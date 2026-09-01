import window48 from '../assets/windows/window-48x192.glb?url'
import window96 from '../assets/windows/window-96x192.glb?url'
import window144 from '../assets/windows/window-144x192.glb?url'
import window192 from '../assets/windows/window-192x192.glb?url'
import window288 from '../assets/windows/window-288x192.glb?url'
import { BLENDER_WINDOW_MODELS } from '../blender/windowModels'

export interface WindowModelSpec {
  name: string
  width: number
  height: number
  url: string
}

const WINDOW_GLB: Record<string, string> = {
  '2-48x192': window48,
  '3-96x192': window96,
  '4-144x192': window144,
  '5-192x192': window192,
  '6-288x192': window288,
}

export const WINDOW_MODELS: WindowModelSpec[] = BLENDER_WINDOW_MODELS.map((model) => ({
  name: model.name,
  width: model.width,
  height: model.height,
  url: WINDOW_GLB[model.name],
}))

export function windowModelKey(width: number, height: number): string {
  return `${width}x${height}`
}

export function windowModelByName(name: string): WindowModelSpec | undefined {
  return WINDOW_MODELS.find((model) => model.name === name)
}
