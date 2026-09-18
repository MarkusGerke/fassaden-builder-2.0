import { Progress } from '@ark-ui/solid/progress'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { createStyleContext } from 'styled-system/jsx'
import { progress } from 'styled-system/recipes'

const { withProvider, withContext } = createStyleContext(progress)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Progress.Root, 'root')
export const RootProvider = withProvider(Progress.RootProvider, 'root')
export const Circle = withContext(Progress.Circle, 'circle')
export const CircleRange = withContext(Progress.CircleRange, 'circleRange')
export const CircleTrack = withContext(Progress.CircleTrack, 'circleTrack')
export const Label = withContext(Progress.Label, 'label')
export const Range = withContext(Progress.Range, 'range')
export const Track = withContext(Progress.Track, 'track')
export const ValueText = withContext(Progress.ValueText, 'valueText')
export const View = withContext(Progress.View, 'view')

/** Ark Progress Linear — indeterminate (Laden ohne Prozent). */
export function LinearIndeterminate(
  props: ComponentProps<typeof Root> & { trackWidth?: string },
) {
  const [local, rest] = splitProps(props, ['trackWidth', 'children'])
  return (
    <Root value={null} {...rest}>
      <Track width={local.trackWidth ?? '100%'} minW="0">
        <Range />
      </Track>
    </Root>
  )
}
