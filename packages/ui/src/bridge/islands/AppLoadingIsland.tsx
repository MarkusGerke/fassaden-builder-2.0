import { Stack } from 'styled-system/jsx'
import { Progress } from '@/components/ui'

/**
 * Start-Overlay: Park Progress wie Sandbox „Laden“ (indeterminate, value=null).
 * Fade/Dismiss bleibt bei `#app-loading` / `dismissAppLoading`.
 */
export function AppLoadingIsland() {
  return (
    <Stack gap="2" align="center" color="fg.default">
      <Progress.Root value={null} size="sm" colorPalette="gray">
        <Progress.Label>Studio wird geladen …</Progress.Label>
        <Progress.Track width="6rem" minW="0" mt="2">
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Stack>
  )
}
