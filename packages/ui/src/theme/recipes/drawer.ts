import { drawerAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const drawer = defineSlotRecipe({
  className: 'drawer',
  slots: drawerAnatomy.keys(),
  base: {
    backdrop: {
      background: 'black.a7',
      height: '100dvh',
      left: '0',
      position: 'fixed',
      top: '0',
      width: '100dvw',
      zIndex: 'overlay',
      _open: {
        animationName: 'fade-in',
        animationTimingFunction: 'emphasized-in',
        animationDuration: 'normal',
      },
      _closed: {
        animationName: 'fade-out',
        animationTimingFunction: 'emphasized-out',
        animationDuration: 'fast',
      },
    },
    positioner: {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 'modal',
      pointerEvents: 'none',
    },
    content: {
      pointerEvents: 'auto',
      background: 'white',
      color: 'fg.default',
      width: '100%',
      maxH: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTopRadius: 'l3',
      boxShadow: 'lg',
      overflow: 'hidden',
    },
    grabber: {
      display: 'flex',
      justifyContent: 'center',
      py: '2',
      flexShrink: '0',
    },
    grabberIndicator: {
      width: '2.5rem',
      height: '0.25rem',
      borderRadius: 'full',
      bg: 'gray.7',
    },
    title: {
      fontWeight: 'semibold',
      textStyle: 'md',
    },
    description: {
      textStyle: 'sm',
      color: 'fg.muted',
    },
    closeTrigger: {},
    trigger: {},
    swipeArea: {},
  },
})
