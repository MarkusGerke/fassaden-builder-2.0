import { absoluteCenter } from './absolute-center'
import { accordion } from './accordion'
import { alert } from './alert'
import { badge } from './badge'
import { button } from './button'
import { card } from './card'
import { checkbox } from './checkbox'
import { clipboard } from './clipboard'
import { collapsible } from './collapsible'
import { colorPicker } from './color-picker'
import { combobox } from './combobox'
import { datePicker } from './date-picker'
import { dialog } from './dialog'
import { field } from './field'
import { group } from './group'
import { hoverCard } from './hover-card'
import { icon } from './icon'
import { input } from './input'
import { menu } from './menu'
import { numberInput } from './number-input'
import { popover } from './popover'
import { progress } from './progress'
import { radioGroup } from './radio-group'
import { segmentGroup } from './segment-group'
import { select } from './select'
import { slider } from './slider'
import { spinner } from './spinner'
import { switchRecipe } from './switch'
import { tabs } from './tabs'
import { tagsInput } from './tags-input'
import { textarea } from './textarea'
import { toast } from './toast'
import { toggleGroup } from './toggle-group'
import { tooltip } from './tooltip'
import { treeView } from './tree-view'
import { splitter } from './splitter'
import { navigationMenu } from './navigation-menu'
import { scrollArea } from './scroll-area'
import { drawer } from './drawer'

/** Einzel-Recipes (kein Slot). */
export const recipes = {
  button,
  input,
  textarea,
  group,
  icon,
  spinner,
  absoluteCenter,
  badge,
}

/**
 * Slot-Recipes (Ark-Anatomie).
 * Park-CLI legt neue Slot-Recipes oft fälschlich unter `recipes` ab — hier korrigieren.
 */
export const slotRecipes = {
  select,
  checkbox,
  dialog,
  tabs,
  menu,
  numberInput,
  field,
  switchRecipe,
  toast,
  slider,
  radioGroup,
  accordion,
  tooltip,
  toggleGroup,
  collapsible,
  popover,
  colorPicker,
  datePicker,
  alert,
  progress,
  clipboard,
  segmentGroup,
  card,
  combobox,
  hoverCard,
  tagsInput,
  treeView,
  splitter,
  navigationMenu,
  scrollArea,
  drawer,
}
