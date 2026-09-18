import { Dialog, useDialogContext } from '@ark-ui/solid/dialog'
import { ark } from '@ark-ui/solid/factory'
import type { ComponentProps } from 'solid-js'
import { createStyleContext, styled } from 'styled-system/jsx'
import { dialog } from 'styled-system/recipes'
import { Button, type ButtonProps } from './button'

const { withRootProvider, withContext } = createStyleContext(dialog)

export type RootProps = ComponentProps<typeof Root>
export const Root = withRootProvider(Dialog.Root, {
  defaultProps: () => ({ unmountOnExit: true, lazyMount: true }),
})
export const RootProvider = withRootProvider(Dialog.RootProvider, {
  defaultProps: () => ({ unmountOnExit: true, lazyMount: true }),
})
export const Backdrop = withContext(Dialog.Backdrop, 'backdrop')
export const CloseTrigger = withContext(Dialog.CloseTrigger, 'closeTrigger')
export const Content = withContext(Dialog.Content, 'content')
export const Description = withContext(Dialog.Description, 'description')
export const Positioner = withContext(Dialog.Positioner, 'positioner')
export const Title = withContext(Dialog.Title, 'title')
export const Trigger = withContext(Dialog.Trigger, 'trigger')
export const Body = withContext(ark.div, 'body')
export const Header = withContext(ark.div, 'header')
export const Footer = withContext(ark.div, 'footer')

/** Schließen-Aktion — Park `Button`, nicht nacktes `ark.button` (sonst Vanilla-Styles in der Live-App). */
export const ActionTrigger = (props: ButtonProps) => {
  const dialog = useDialogContext()
  return (
    <Button
      variant="outline"
      size="sm"
      {...props}
      onClick={(e) => {
        if (typeof props.onClick === 'function') props.onClick(e)
        dialog().setOpen(false)
      }}
    />
  )
}

export { DialogContext as Context } from '@ark-ui/solid/dialog'
