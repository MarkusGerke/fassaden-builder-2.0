import { navigationMenuAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const navigationMenu = defineSlotRecipe({
  className: 'navigation-menu',
  slots: navigationMenuAnatomy.keys(),
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      isolation: 'isolate',
      minW: '0',
      width: 'full',
      _vertical: {
        flexDirection: 'column',
        alignItems: 'stretch',
      },
    },
    list: {
      display: 'flex',
      alignItems: 'center',
      listStyle: 'none',
      m: '0',
      p: '0',
      gap: '0',
      minW: '0',
      width: 'full',
      _vertical: {
        flexDirection: 'column',
        alignItems: 'stretch',
      },
    },
    item: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      minW: '0',
      width: 'full',
    },
    trigger: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      appearance: 'none',
      borderWidth: '0',
      borderRadius: 'l2',
      bg: 'transparent',
      color: 'fg.muted',
      cursor: 'pointer',
      flexShrink: '0',
      minW: '7',
      minH: '7',
      p: '0',
      _icon: { boxSize: '4' },
      _hover: {
        bg: 'gray.a3',
        color: 'fg.default',
      },
      _open: {
        bg: 'gray.a3',
        color: 'fg.default',
      },
      _focusVisible: {
        focusVisibleRing: 'outside',
      },
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5',
      p: '1',
      minW: '40',
    },
    link: {
      alignItems: 'center',
      borderRadius: 'l2',
      cursor: 'pointer',
      display: 'flex',
      minH: '9',
      outline: '0',
      px: '2',
      textAlign: 'start',
      textDecoration: 'none',
      textStyle: 'sm',
      userSelect: 'none',
      width: '100%',
      color: 'fg.default',
      _highlighted: {
        bg: 'gray.surface.bg.hover',
      },
      _disabled: {
        layerStyle: 'disabled',
      },
      '&[data-danger]': {
        color: 'red.9',
      },
    },
    viewportPositioner: {
      position: 'absolute',
      zIndex: 'dropdown',
      left: 'var(--viewport-x)',
      top: 'var(--viewport-y)',
      pointerEvents: 'none',
    },
    viewport: {
      bg: 'gray.surface.bg',
      borderRadius: 'l3',
      boxShadow: 'md',
      height: 'var(--viewport-height)',
      minW: '40',
      overflow: 'hidden',
      pointerEvents: 'auto',
      width: 'var(--viewport-width)',
      zIndex: 'dropdown',
      _open: {
        animationStyle: 'scale-fade-in',
        animationDuration: 'fast',
      },
      _closed: {
        animationStyle: 'scale-fade-out',
        animationDuration: 'faster',
      },
    },
    indicator: {
      display: 'none',
    },
    itemIndicator: {
      display: 'none',
    },
    arrow: {
      '--arrow-size': 'sizes.2',
      '--arrow-background': 'colors.gray.surface.bg',
    },
  },
})
