import { render } from 'solid-js/web'
import { SceneSunIsland, type BoundSlider } from './islands/SceneSunIsland'

export type { BoundSlider }

export function mountSceneSunIsland(
  host: HTMLElement,
  opts: {
    sliders: BoundSlider[]
    readValue: (id: string) => number
    writeValue: (id: string, value: number) => void
    subscribe?: (listener: () => void) => () => void
  },
): () => void {
  host.replaceChildren()
  return render(
    () => (
      <SceneSunIsland
        sliders={opts.sliders}
        readValue={opts.readValue}
        writeValue={opts.writeValue}
        subscribe={opts.subscribe}
      />
    ),
    host,
  )
}
