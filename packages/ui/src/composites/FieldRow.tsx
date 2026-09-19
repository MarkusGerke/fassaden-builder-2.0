import type { ParentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { css } from 'styled-system/css'

export type FieldRowProps = ParentProps<{
  /** Titel links; Einheit in Klammern, z. B. `Höhe (cm)`. */
  label: string
  htmlFor?: string
  class?: string
  hint?: string
}>

const labelClass = css({
  fontSize: 'sm',
  fontWeight: 'semibold',
  color: 'fg.muted',
  minW: '0',
})

/**
 * Dünnes Layout-Composite (Grill 5B): Titel links, Control rechts — Panda only.
 */
export function FieldRow(props: FieldRowProps) {
  const [local] = splitProps(props, ['label', 'htmlFor', 'class', 'hint', 'children'])

  return (
    <HStack
      class={local.class}
      gap="3"
      alignItems="center"
      justify="space-between"
      minW="0"
      maxW="full"
    >
      <Stack gap="1" minW="0" flex="1">
        <label for={local.htmlFor} class={labelClass}>
          {local.label}
        </label>
        <Show when={local.hint}>
          <Box fontSize="xs" color="fg.muted" fontWeight="normal">
            {local.hint}
          </Box>
        </Show>
      </Stack>
      <Box flexShrink="0" display="flex" alignItems="center" justifyContent="flex-end">
        {local.children}
      </Box>
    </HStack>
  )
}

export type StackProps = ParentProps<{ class?: string; gap?: 'section' | 'rows' }>

/** Spalte: 16px (rows) / 32px (section) — Park-Spacing-Skala. */
export function UiStack(props: StackProps) {
  return (
    <Stack class={props.class} gap={props.gap === 'section' ? '8' : '4'} minW="0" maxW="full">
      {props.children}
    </Stack>
  )
}
