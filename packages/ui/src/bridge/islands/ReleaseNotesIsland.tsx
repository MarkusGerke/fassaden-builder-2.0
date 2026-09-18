import { For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Button, CloseButton, Dialog } from '@/components/ui'
import type { ReleaseNotesModel } from '../types'

export type ReleaseNotesIslandProps = {
  model: ReleaseNotesModel
}

/**
 * Erste Live-Insel: Version-Badge + Release-Notes-Dialog (Park Dialog).
 * Domäne nur über `ReleaseNotesModel` — keine Facade-/Editor-Typen.
 */
export function ReleaseNotesIsland(props: ReleaseNotesIslandProps) {
  const model = () => props.model

  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild={(triggerProps) => (
          <Button
            {...triggerProps()}
            variant="outline"
            size="xs"
            title="Release Notes anzeigen"
            aria-haspopup="dialog"
          >
            v{model().version}
          </Button>
        )}
      />
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack justify="space-between" alignItems="flex-start" gap="3" w="full">
                <Stack gap="1" minW="0">
                  <Dialog.Title>Release Notes</Dialog.Title>
                  <Show when={model().repoUrl}>
                    {(url) => (
                      <Dialog.Description>
                        Repository:{' '}
                        <a href={url()} target="_blank" rel="noopener noreferrer">
                          {model().repoLabel ?? url().replace(/^https:\/\//, '')}
                        </a>
                      </Dialog.Description>
                    )}
                  </Show>
                </Stack>
                <Dialog.CloseTrigger>
                  <CloseButton aria-label="Schließen" />
                </Dialog.CloseTrigger>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack class="park-no-scrollbar" gap="6" w="full" maxH="55vh" overflowY="auto">
                <For each={model().releases}>
                  {(release) => (
                    <article>
                      <Stack gap="2">
                        <HStack gap="3" flexWrap="wrap" alignItems="baseline">
                          <Box fontWeight="semibold" textStyle="sm">
                            v{release.version}
                          </Box>
                          <Box as="time" textStyle="xs" color="fg.muted" dateTime={release.date}>
                            {release.dateLabel}
                          </Box>
                        </HStack>
                        <Show when={release.title}>
                          {(title) => (
                            <Box textStyle="sm" fontWeight="medium">
                              {title()}
                            </Box>
                          )}
                        </Show>
                        <Stack as="ul" gap="1" pl="4" textStyle="sm" listStyleType="disc">
                          <For each={release.changes}>
                            {(change) => (
                              <Box as="li" display="list-item">
                                {change}
                              </Box>
                            )}
                          </For>
                        </Stack>
                        <Show when={release.githubUrl}>
                          {(href) => (
                            <Box textStyle="xs">
                              <a href={href()} target="_blank" rel="noopener noreferrer">
                                GitHub Release
                              </a>
                            </Box>
                          )}
                        </Show>
                      </Stack>
                    </article>
                  )}
                </For>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger>Schließen</Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
