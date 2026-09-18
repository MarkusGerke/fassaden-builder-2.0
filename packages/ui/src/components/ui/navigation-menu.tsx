import { NavigationMenu } from '@ark-ui/solid/navigation-menu'
import type { ComponentProps } from 'solid-js'
import { createStyleContext } from 'styled-system/jsx'
import { navigationMenu } from 'styled-system/recipes'

const { withProvider, withContext } = createStyleContext(navigationMenu)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(NavigationMenu.Root, 'root', {
  defaultProps: () => ({ orientation: 'vertical' }) as const,
  forwardProps: ['orientation'],
})
export const RootProvider = withProvider(NavigationMenu.RootProvider, 'root')
export const List = withContext(NavigationMenu.List, 'list')
export const Item = withContext(NavigationMenu.Item, 'item')
export const Trigger = withContext(NavigationMenu.Trigger, 'trigger')
export const Content = withContext(NavigationMenu.Content, 'content')
export const Link = withContext(NavigationMenu.Link, 'link')
export const Indicator = withContext(NavigationMenu.Indicator, 'indicator')
export const ItemIndicator = withContext(NavigationMenu.ItemIndicator, 'itemIndicator')
export const Arrow = withContext(NavigationMenu.Arrow, 'arrow')
export const Viewport = withContext(NavigationMenu.Viewport, 'viewport')
export const ViewportPositioner = withContext(NavigationMenu.ViewportPositioner, 'viewportPositioner')

export {
  NavigationMenuContext as Context,
  useNavigationMenu,
  useNavigationMenuContext,
} from '@ark-ui/solid/navigation-menu'
