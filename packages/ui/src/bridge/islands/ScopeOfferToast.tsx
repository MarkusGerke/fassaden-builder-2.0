import { onCleanup, onMount } from 'solid-js'
import { toaster, Toaster } from '@/components/ui/toast'
import { clickId } from '../vanillaBind'

const SHOW = 'fb-scope-offer'
const HIDE = 'fb-scope-offer-hide'

type OfferDetail = { type?: boolean; floor?: boolean; facade?: boolean }

/**
 * Ark-Toast für „Übernehmen? Typ / Etage / Fassade“.
 * Die Vanilla-Leiste `#scope-propagate-offer` bleibt im geclippten `#scope-bar-slot`.
 */
export function ScopeOfferToast() {
  onMount(() => {
    let currentId = ''
    /** Vanilla hide → Toast dismiss; kein erneutes scope-propagate-dismiss. */
    let suppressDismissSync = false

    const hide = () => {
      if (!currentId) return
      suppressDismissSync = true
      toaster.dismiss(currentId)
    }

    const show = (ev: Event) => {
      const detail = (ev as CustomEvent<OfferDetail>).detail ?? {}
      if (!detail.type && !detail.floor && !detail.facade) return
      hide()
      currentId = `scope-propagate-${Date.now()}`
      toaster.create({
        id: currentId,
        title: 'Übernehmen?',
        duration: 7000,
        closable: true,
        meta: {
          scopeOffer: {
            type: detail.type === true,
            floor: detail.floor === true,
            facade: detail.facade === true,
          },
        },
        onStatusChange: (d) => {
          if (d.status !== 'dismissing' || d.src !== currentId) return
          const suppressed = suppressDismissSync
          suppressDismissSync = false
          currentId = ''
          if (!suppressed) clickId('scope-propagate-dismiss')
        },
      })
    }

    window.addEventListener(SHOW, show)
    window.addEventListener(HIDE, hide)
    onCleanup(() => {
      window.removeEventListener(SHOW, show)
      window.removeEventListener(HIDE, hide)
      hide()
    })
  })

  return <Toaster />
}
