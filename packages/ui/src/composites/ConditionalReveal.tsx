import type { ParentProps } from 'solid-js'
import { Show } from 'solid-js'
import { Box } from 'styled-system/jsx'

export type ConditionalRevealProps = ParentProps<{
  /** Wenn false: Kinder aus dem Baum (inaktive Einstellungen ausblenden). */
  when: boolean
  class?: string
}>

/** Mini-Helper (Grill 10A) — kein Layout-Composite. */
export function ConditionalReveal(props: ConditionalRevealProps) {
  return (
    <Show when={props.when}>
      <Box class={props.class} minW="0">
        {props.children}
      </Box>
    </Show>
  )
}
