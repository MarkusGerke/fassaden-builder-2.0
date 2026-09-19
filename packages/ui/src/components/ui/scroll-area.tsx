import { ScrollArea } from '@ark-ui/solid/scroll-area'
import type { ComponentProps, ParentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cx } from 'styled-system/css'
import { createStyleContext } from 'styled-system/jsx'
import { scrollArea as scrollAreaRecipe } from 'styled-system/recipes'

const { withProvider, withContext } = createStyleContext(scrollAreaRecipe)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(ScrollArea.Root, 'root')
export const RootProvider = withProvider(ScrollArea.RootProvider, 'root')
export const Viewport = withContext(ScrollArea.Viewport, 'viewport')
export const Content = withContext(ScrollArea.Content, 'content')
export const Thumb = withContext(ScrollArea.Thumb, 'thumb')
export const Scrollbar = withContext(ScrollArea.Scrollbar, 'scrollbar')
export const Corner = withContext(ScrollArea.Corner, 'corner')

export { ScrollAreaContext as Context } from '@ark-ui/solid/scroll-area'

/**
 * Ark Scrollbar + Thumb als direkte Kinder (ScrollbarProvider).
 * Nicht die styled `Scrollbar`/`Thumb`-Exports — deren Wrapper leitet `children`
 * nicht zuverlässig an Ark weiter → Thumb ohne Scrollbar-Kontext → Crash.
 */
export function ScrollbarWithThumb(
  props: ComponentProps<typeof ScrollArea.Scrollbar> & { class?: string },
) {
  const [local, rest] = splitProps(props, ['orientation', 'class'])
  const slot = scrollAreaRecipe()
  return (
    <ScrollArea.Scrollbar
      orientation={local.orientation}
      class={cx(slot.scrollbar, local.class)}
      {...rest}
    >
      <ScrollArea.Thumb class={slot.thumb} />
    </ScrollArea.Scrollbar>
  )
}

type FrameProps = ParentProps<RootProps & { horizontal?: boolean }>

/** Scrollen ohne sichtbare Scrollleisten (Viewport overflow, native Bars aus). */
export function Frame(props: FrameProps) {
  const [local, rootProps] = splitProps(props, ['children', 'horizontal', 'class'])
  return (
    <Root {...rootProps} class={cx('park-scroll-frame', local.class)}>
      <Viewport>
        <Content>{local.children}</Content>
      </Viewport>
    </Root>
  )
}
