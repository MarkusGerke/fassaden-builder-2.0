import { accordionAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const accordion = defineSlotRecipe({
  className: 'accordion',
  slots: accordionAnatomy.extendWith('itemBody').keys(),
  base: {
    root: {
      width: 'full',
      '--accordion-radius': 'radii.l2',
    },
    item: {
      overflowAnchor: 'none',
    },
    itemTrigger: {
      alignItems: 'center',
      borderRadius: 'var(--accordion-radius)',
      color: 'fg.default',
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 'semibold',
      gap: '3',
      justifyContent: 'space-between',
      textAlign: 'start',
      textStyle: 'lg',
      width: 'full',
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.focusRing',
      },
      _disabled: {
        layerStyle: 'disabled',
      },
    },
    itemIndicator: {
      transition: 'rotate 0.2s',
      transformOrigin: 'center',
      color: 'fg.subtle',
      _open: {
        rotate: '180deg',
      },
      _icon: {
        width: '1.2em',
        height: '1.2em',
      },
    },
    itemBody: {
      px: 'var(--accordion-padding-x)',
      pb: 'calc(var(--accordion-padding-y) * 2)',
      color: 'fg.muted',
    },
    itemContent: {
      overflow: 'hidden',
      borderRadius: 'var(--accordion-radius)',
      // Kein expand-height: controlled Open beim Mount misst --height=0 → Inhalt klebt unsichtbar.
      // Höhe steuert Zag/Collapsible; Park-CSS erzwingt open→auto / closed→0 (style.css).
      _open: {
        animationName: 'fade-in',
        animationDuration: 'fast',
      },
      _closed: {
        animationName: 'fade-out',
        animationDuration: 'fast',
      },
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'outline',
  },
  variants: {
    variant: {
      outline: {
        item: {
          borderBottomWidth: '1px',
        },
      },
      plain: {},
    },
    size: {
      md: {
        root: {
          '--accordion-padding-x': 'spacing.4',
          '--accordion-padding-y': 'spacing.2.5',
        },
        itemTrigger: {
          textStyle: 'md',
          py: 'var(--accordion-padding-y)',
        },
      },
    },
  },
})
