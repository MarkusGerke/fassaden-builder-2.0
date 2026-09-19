import { scrollAreaAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const scrollArea = defineSlotRecipe({
  className: 'scroll-area',
  slots: scrollAreaAnatomy.keys(),
  base: {
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minH: '0',
      minW: '0',
      position: 'relative',
      overflow: 'hidden',
      '--scrollbar-margin': '2px',
      '--thumb-size': '6px',
      '--scrollbar-size': 'calc(var(--thumb-size) + calc(var(--scrollbar-margin) * 2))',
    },
    viewport: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      minH: '0',
      minW: '0',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minW: '0',
      maxW: '100%',
      boxSizing: 'border-box',
    },
    scrollbar: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      position: 'absolute',
      touchAction: 'none',
      userSelect: 'none',
      zIndex: 'docked',
      '--thumb-bg': 'colors.gray.7',
      _hover: {
        '--thumb-bg': 'colors.gray.9',
      },
      _vertical: {
        flexDirection: 'column',
        width: 'var(--scrollbar-size)',
        top: '0',
        bottom: 'var(--corner-height, 0px)',
        insetInlineEnd: '0',
        py: 'var(--scrollbar-margin)',
        '&:not([data-overflow-y])': {
          display: 'none',
        },
      },
      _horizontal: {
        flexDirection: 'row',
        height: 'var(--scrollbar-size)',
        left: '0',
        right: 'var(--corner-width, 0px)',
        bottom: '0',
        px: 'var(--scrollbar-margin)',
        '&:not([data-overflow-x])': {
          display: 'none',
        },
      },
    },
    thumb: {
      borderRadius: 'full',
      bg: 'var(--thumb-bg)',
      transitionDuration: 'normal',
      transitionProperty: 'background',
      _vertical: {
        width: 'var(--thumb-size)',
        height: 'var(--thumb-height)',
      },
      _horizontal: {
        height: 'var(--thumb-size)',
        width: 'var(--thumb-width)',
      },
    },
    corner: {
      position: 'absolute',
      bottom: '0',
      insetInlineEnd: '0',
      width: 'var(--corner-width)',
      height: 'var(--corner-height)',
      '&:not([data-overflow-x][data-overflow-y])': {
        display: 'none',
      },
    },
  },
  variants: {
    size: {
      sm: {
        root: { '--thumb-size': '4px' },
      },
      md: {
        root: { '--thumb-size': '6px' },
      },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
