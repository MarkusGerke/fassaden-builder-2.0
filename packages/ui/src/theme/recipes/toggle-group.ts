import { toggleGroupAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

/**
 * Park-Stock hatte fast nur Root-outline. Items + Tile-Layout ergänzt (Grill 2B/7B/8A).
 */
export const toggleGroup = defineSlotRecipe({
  className: 'toggle-group',
  slots: toggleGroupAnatomy.keys(),
  base: {
    root: {
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      isolation: 'isolate',
      gap: '1',
    },
    item: {
      alignItems: 'center',
      appearance: 'none',
      borderRadius: 'l2',
      cursor: 'pointer',
      display: 'inline-flex',
      flexShrink: '0',
      fontWeight: 'semibold',
      justifyContent: 'center',
      outline: '0',
      position: 'relative',
      transitionProperty: 'background-color, border-color, color, box-shadow',
      transitionDuration: 'normal',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      _disabled: {
        layerStyle: 'disabled',
      },
      focusVisibleRing: 'outside',
    },
  },
  variants: {
    variant: {
      outline: {
        root: {
          borderRadius: 'l3',
          borderWidth: '1px',
          borderColor: 'border.default',
          gap: '1',
          p: '1',
        },
        item: {
          borderWidth: '1px',
          borderColor: 'transparent',
          color: 'fg.muted',
          _hover: {
            bg: 'gray.a3',
            color: 'fg.default',
          },
          _on: {
            bg: 'colorPalette.subtle.bg',
            borderColor: 'colorPalette.outline.border',
            color: 'colorPalette.subtle.fg',
          },
        },
      },
      ghost: {
        item: {
          color: 'fg.muted',
          _hover: {
            bg: 'gray.a3',
            color: 'fg.default',
          },
          _on: {
            bg: 'colorPalette.subtle.bg',
            color: 'colorPalette.subtle.fg',
          },
        },
      },
    },
    size: {
      sm: {
        item: { h: '8', minW: '8', textStyle: 'xs', px: '2.5', gap: '1.5', _icon: { boxSize: '3.5' } },
      },
      md: {
        item: { h: '9', minW: '9', textStyle: 'sm', px: '3', gap: '2', _icon: { boxSize: '4' } },
      },
      lg: {
        item: { h: '10', minW: '10', textStyle: 'sm', px: '3.5', gap: '2', _icon: { boxSize: '5' } },
      },
    },
    /** Bibliothek-Kacheln: Spalte mit Preview (Grill 7B). */
    tile: {
      true: {
        root: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2',
          borderWidth: '0',
          p: '0',
          borderRadius: '0',
        },
        item: {
          flexDirection: 'column',
          alignItems: 'stretch',
          h: 'auto',
          minH: 'unset',
          minW: '4.5rem',
          maxW: '6.5rem',
          px: '2',
          py: '2',
          gap: '1',
          textStyle: 'xs',
          whiteSpace: 'normal',
          textAlign: 'center',
          borderWidth: '1px',
          borderColor: 'border.default',
          borderRadius: 'l2',
          bg: 'white',
          _hover: {
            borderColor: 'border.emphasized',
          },
          _on: {
            borderColor: 'colorPalette.solid.bg',
            outlineWidth: '1px',
            outlineStyle: 'solid',
            outlineColor: 'colorPalette.solid.bg',
            bg: 'white',
            color: 'fg.default',
          },
        },
      },
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'outline',
  },
})
