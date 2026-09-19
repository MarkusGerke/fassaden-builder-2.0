import { splitterAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const splitter = defineSlotRecipe({
  className: 'splitter',
  slots: splitterAnatomy.keys(),
  base: {
    root: {
      display: 'flex',
      height: '100%',
      width: '100%',
      minH: '0',
      minW: '0',
      overflow: 'hidden',
      colorPalette: 'gray',
      _horizontal: {
        flexDirection: 'row',
      },
      _vertical: {
        flexDirection: 'column',
      },
    },
    panel: {
      display: 'flex',
      flexDirection: 'column',
      minH: '0',
      minW: '0',
      overflow: 'hidden',
      bg: 'gray.1',
    },
    resizeTrigger: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      zIndex: 'docked',
      outline: 'none',
      background: 'transparent',
      borderWidth: '0',
      padding: '0',
      overflow: 'visible',
      color: 'fg.muted',
      _before: {
        content: '""',
        position: 'absolute',
        bg: 'transparent',
      },
      _horizontal: {
        width: '8px',
        minW: '8px',
        alignSelf: 'stretch',
        cursor: 'col-resize',
        _before: {
          insetBlock: '0',
          insetInline: '-4px',
        },
        _after: {
          content: '""',
          position: 'absolute',
          insetBlock: '0',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '1px',
          bg: 'gray.5',
          pointerEvents: 'none',
        },
      },
      _vertical: {
        height: '8px',
        minH: '8px',
        alignSelf: 'stretch',
        cursor: 'row-resize',
        _before: {
          insetInline: '0',
          insetBlock: '-4px',
        },
      },
      _hover: {
        color: 'colorPalette.9',
        '& [data-part="resize-trigger-indicator"]': {
          bg: 'colorPalette.9',
        },
      },
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.focusRing',
      },
    },
    resizeTriggerIndicator: {
      position: 'relative',
      display: 'block',
      flexShrink: '0',
      pointerEvents: 'none',
      borderRadius: 'full',
      bg: 'white',
      borderWidth: '1px',
      borderColor: 'gray.4',
      boxShadow: 'sm',
      _horizontal: {
        width: '6px',
        minH: '2.75rem',
        height: '2.75rem',
      },
      _vertical: {
        height: '6px',
        minW: '2.75rem',
        width: '2.75rem',
      },
    },
  },
})
