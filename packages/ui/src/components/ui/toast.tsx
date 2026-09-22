import { Toaster as ArkToaster, createToaster, Toast, useToastContext } from '@ark-ui/solid/toast'
import { CheckCircleIcon, CircleAlertIcon, CircleXIcon } from 'lucide-solid'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createStyleContext, HStack, Stack, styled } from 'styled-system/jsx'
import { toast } from 'styled-system/recipes'
import { Button } from './button'
import { CloseButton } from './close-button'
import { Icon, type IconProps } from './icon'
import { LinearIndeterminate } from './progress'

const { withProvider, withContext } = createStyleContext(toast)

const Root = withProvider(Toast.Root, 'root')
const Title = withContext(Toast.Title, 'title')
const Description = withContext(Toast.Description, 'description')
const ActionTrigger = withContext(Toast.ActionTrigger, 'actionTrigger')
const CloseTrigger = withContext(Toast.CloseTrigger, 'closeTrigger')
const StyledToaster = styled(ArkToaster)

const iconMap: Record<string, any> = {
  warning: CircleAlertIcon,
  success: CheckCircleIcon,
  error: CircleXIcon,
}

const Indicator = (props: IconProps) => {
  const toast = useToastContext()

  const StatusIcon = () => iconMap[toast().type]

  return (
    <Show when={StatusIcon()}>
      {(Icon_) => (
        <Icon data-type={toast().type} {...props}>
          <Icon_ />
        </Icon>
      )}
    </Show>
  )
}

export type ScopeOfferToastMeta = {
  type?: boolean
  floor?: boolean
  facade?: boolean
}

function readScopeOfferMeta(meta: Record<string, unknown> | undefined): ScopeOfferToastMeta {
  const raw = meta?.scopeOffer
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as ScopeOfferToastMeta
  return {
    type: o.type === true,
    floor: o.floor === true,
    facade: o.facade === true,
  }
}

function clickScopePropagate(kind: 'type' | 'floor' | 'facade'): void {
  document.getElementById(`scope-propagate-${kind}`)?.click()
}

export const toaster = createToaster({
  placement: 'bottom-end',
  pauseOnPageIdle: true,
  overlap: true,
  max: 5,
})

export const Toaster = () => {
  return (
    <Portal>
      <StyledToaster toaster={toaster} insetInline={{ mdDown: '4' }} zIndex="var(--z-index-toast, 10000)">
        {(toast) => {
          const scopeOffer = () => readScopeOfferMeta(toast().meta)
          const scopeOfferVisible = () => {
            const m = scopeOffer()
            return m.type || m.floor || m.facade
          }
          return (
          <Root>
            <Show when={toast().type === 'loading'} fallback={<Indicator />}>
              <LinearIndeterminate size="xs" trackWidth="3rem" colorPalette="gray" />
            </Show>

            <Stack gap="3" alignItems="start">
              <Stack gap="1">
                <Show when={toast().title}>
                  <Title>{toast().title}</Title>
                </Show>
                <Show when={toast().description}>
                  <Description>{toast().description}</Description>
                </Show>
              </Stack>
              <Show when={toast().action}>
                {(action) => <ActionTrigger>{action().label}</ActionTrigger>}
              </Show>
              <Show when={scopeOfferVisible()}>
                <HStack gap="2" flexWrap="wrap">
                  <Show when={scopeOffer().type}>
                    <Button size="sm" variant="outline" onClick={() => clickScopePropagate('type')}>
                      Typ
                    </Button>
                  </Show>
                  <Show when={scopeOffer().floor}>
                    <Button size="sm" variant="outline" onClick={() => clickScopePropagate('floor')}>
                      Etage
                    </Button>
                  </Show>
                  <Show when={scopeOffer().facade}>
                    <Button size="sm" variant="outline" onClick={() => clickScopePropagate('facade')}>
                      Fassade
                    </Button>
                  </Show>
                </HStack>
              </Show>
            </Stack>
            <Show when={toast().closable}>
              <CloseTrigger>
                <CloseButton size="sm" />
              </CloseTrigger>
            </Show>
          </Root>
          )
        }}
      </StyledToaster>
    </Portal>
  )
}
