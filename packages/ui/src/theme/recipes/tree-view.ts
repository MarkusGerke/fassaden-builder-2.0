import { treeViewAnatomy } from '@ark-ui/solid/anatomy'
import { defineSlotRecipe } from '@pandacss/dev'

export const treeView = defineSlotRecipe({
  className: 'tree-view',
  slots: treeViewAnatomy.keys(),
  base: {
    root: {
      width: 'full',
      colorPalette: 'gray',
    },
    label: {
      fontWeight: 'medium',
      textStyle: 'sm',
      mb: '2',
    },
    tree: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5',
      outline: 'none',
    },
    branch: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5',
    },
    branchContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5',
      position: 'relative',
      ps: '3',
    },
    branchIndentGuide: {
      position: 'absolute',
      insetBlock: '0',
      insetInlineStart: '2',
      width: '1px',
      bg: 'border',
    },
    branchControl: {
      alignItems: 'center',
      borderRadius: 'l2',
      color: 'fg.default',
      cursor: 'pointer',
      display: 'flex',
      gap: '1.5',
      ps: '1',
      pe: '2',
      py: '1',
      textStyle: 'sm',
      userSelect: 'none',
      width: 'full',
      _hover: {
        bg: 'gray.a2',
      },
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.focusRing',
      },
      _selected: {
        bg: 'gray.a3',
        boxShadow: 'inset 0 0 0 1px {colors.orange.8}',
      },
    },
    branchText: {
      alignItems: 'center',
      display: 'flex',
      flex: '1',
      gap: '1.5',
      justifyContent: 'space-between',
      minW: '0',
    },
    branchIndicator: {
      color: 'fg.muted',
      display: 'inline-flex',
      flexShrink: '0',
      transition: 'transform 0.15s',
      _icon: {
        width: '1em',
        height: '1em',
      },
      _open: {
        transform: 'rotate(90deg)',
      },
    },
    item: {
      alignItems: 'center',
      borderRadius: 'l2',
      color: 'fg.default',
      cursor: 'pointer',
      display: 'flex',
      gap: '1.5',
      ps: '1',
      pe: '2',
      py: '1',
      textStyle: 'sm',
      userSelect: 'none',
      width: 'full',
      _hover: {
        bg: 'gray.a2',
      },
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.focusRing',
      },
      _selected: {
        bg: 'gray.a3',
        boxShadow: 'inset 0 0 0 1px {colors.orange.8}',
      },
    },
    itemText: {
      alignItems: 'center',
      display: 'flex',
      flex: '1',
      gap: '1.5',
      justifyContent: 'space-between',
      minW: '0',
      width: 'full',
    },
    itemIndicator: {
      display: 'none',
    },
    branchTrigger: {},
    nodeCheckbox: {},
    nodeRenameInput: {},
  },
})
