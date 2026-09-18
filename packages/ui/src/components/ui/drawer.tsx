import { Drawer } from '@ark-ui/solid/drawer'
import type { ComponentProps } from 'solid-js'
import { createStyleContext } from 'styled-system/jsx'
import { drawer } from 'styled-system/recipes'

const { withRootProvider, withContext } = createStyleContext(drawer)

export type RootProps = ComponentProps<typeof Root>
export const Root = withRootProvider(Drawer.Root)
export const RootProvider = withRootProvider(Drawer.RootProvider)
export const Backdrop = withContext(Drawer.Backdrop, 'backdrop')
export const CloseTrigger = withContext(Drawer.CloseTrigger, 'closeTrigger')
export const Content = withContext(Drawer.Content, 'content')
export const Description = withContext(Drawer.Description, 'description')
export const Positioner = withContext(Drawer.Positioner, 'positioner')
export const Title = withContext(Drawer.Title, 'title')
export const Trigger = withContext(Drawer.Trigger, 'trigger')
export const Grabber = withContext(Drawer.Grabber, 'grabber')
export const GrabberIndicator = withContext(Drawer.GrabberIndicator, 'grabberIndicator')

export { DrawerContext as Context } from '@ark-ui/solid/drawer'
