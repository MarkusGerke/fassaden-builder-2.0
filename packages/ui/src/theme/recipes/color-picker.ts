import { colorPickerAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const colorPicker = defineSlotRecipe({
  className: 'color-picker',
  slots: colorPickerAnatomy.keys(),
  base: {
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5',
    },
    label: {
      color: 'fg.default',
      fontWeight: 'medium',
      textStyle: 'sm',
    },
    control: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '2',
      maxW: 'xs',
    },
    channelInput: {
      appearance: 'none',
      borderRadius: 'l2',
      borderWidth: '1px',
      borderColor: 'gray.outline.border',
      height: '10',
      minH: '10',
      px: '3',
      textStyle: 'sm',
      outline: '0',
      flex: '1',
      minW: '0',
      bg: 'bg.default',
      focusVisibleRing: 'inside',
    },
    trigger: {
      flexShrink: '0',
      height: '10',
      width: '10',
      minW: '10',
      borderRadius: 'l2',
      borderWidth: '1px',
      borderColor: 'gray.outline.border',
      overflow: 'hidden',
      cursor: 'pointer',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      _focusVisible: {
        focusVisibleRing: 'outside',
      },
      '& [data-part="transparency-grid"], & [data-part="swatch"]': {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        borderRadius: 'l2',
      },
    },
    content: {
      background: 'gray.surface.bg',
      borderRadius: 'l3',
      boxShadow: 'lg',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 'sm',
      p: '4',
      zIndex: 'dropdown',
      _open: {
        animation: 'fadeIn 0.25s ease-out',
      },
      _closed: {
        animation: 'fadeOut 0.2s ease-out',
      },
      _hidden: {
        display: 'none',
      },
    },
    area: {
      height: '36',
      borderRadius: 'l2',
      overflow: 'hidden',
    },
    areaThumb: {
      borderRadius: 'full',
      height: '2.5',
      width: '2.5',
      boxShadow: 'white 0px 0px 0px 2px, black 0px 0px 2px 1px',
      outline: 'none',
    },
    areaBackground: {
      height: 'full',
    },
    channelSlider: {
      borderRadius: 'l2',
    },
    channelSliderTrack: {
      height: '3',
      borderRadius: 'l2',
    },
    swatchGroup: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2',
      background: 'gray.surface.bg',
    },
    swatch: {
      height: '6',
      width: '6',
      borderRadius: 'l2',
      boxShadow:
        '0 0 0 1px var(--colors-border-emphasized), 0 0 0 2px var(--colors-bg-default) inset',
    },
    channelSliderThumb: {
      borderRadius: 'full',
      height: '2.5',
      width: '2.5',
      boxShadow: 'white 0px 0px 0px 2px, black 0px 0px 2px 1px',
      transform: 'translate(-50%, -50%)',
      outline: 'none',
    },
    transparencyGrid: {
      borderRadius: 'l2',
      width: 'full',
      height: 'full',
    },
    eyeDropperTrigger: {
      alignItems: 'center',
      appearance: 'none',
      borderRadius: 'l2',
      borderWidth: '1px',
      borderColor: 'gray.outline.border',
      cursor: 'pointer',
      display: 'inline-flex',
      height: '10',
      justifyContent: 'center',
      minW: '10',
      px: '2',
      _hover: {
        bg: 'gray.a3',
      },
    },
  },
})
