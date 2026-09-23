/**
 * Ark Tour — geführter Einstieg (Fassade → Paneele → Farbe → Fenster → Profile → Sockel → Gesims).
 *
 * Zag-Tour-`effect`: nach Setup **`show()`** aufrufen (nicht `next()` — das springt
 * zum Folgeschritt und erzeugt ohne gesetzte `stepId` eine Endlosschleife).
 */
import { onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Tour, useTour } from '@ark-ui/solid/tour'
import type { TourStepDetails, TourStepEffectArgs } from '@ark-ui/solid/tour'
import { Button } from '@/components/ui'

export type FacadeTourHost = {
  setLibraryTab: (tab: string) => void
  ensureWallSelected?: () => void
  ensureOpeningSelected?: () => void
}

export type FacadeTourAppProps = {
  host: FacadeTourHost
  /** Wenn true und Tour noch nicht gesehen: Auto-Start. */
  shouldAutoStart: () => boolean
  onCompleted: () => void
}

function qs(sel: string): HTMLElement | null {
  return document.querySelector(sel)
}

/** Sync-Vorbereitung, dann Schritt anzeigen (Zag: `show`, nicht `next`). */
function stepEffect(
  run: () => void,
): (args: TourStepEffectArgs) => void | (() => void) {
  return ({ show }) => {
    run()
    // Tab-Wechsel/DOM erst nach dem Tick, damit Spotlight das Ziel findet.
    queueMicrotask(() => show())
  }
}

function buildSteps(host: FacadeTourHost): TourStepDetails[] {
  return [
    {
      id: 'facade',
      type: 'tooltip',
      title: 'Fassade wählen',
      description:
        'Hier liegen die Start-Häuser. Dein aktuelles Haus ist markiert — tippe eine andere Karte, um zu wechseln.',
      target: () => qs('#library-tab-facades') ?? qs('[data-library-tab="facades"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => host.setLibraryTab('facades')),
    },
    {
      id: 'panels',
      type: 'tooltip',
      title: 'Paneele & Mauerwerk',
      description: 'Wähle ein Muster und lege es auf die Wand — so bekommt die Fassade Struktur.',
      target: () => qs('#library-tab-panels') ?? qs('[data-library-tab="panels"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => {
        host.ensureWallSelected?.()
        host.setLibraryTab('panels')
      }),
    },
    {
      id: 'color',
      type: 'tooltip',
      title: 'Einfärben',
      description: 'Unter Farben wählst du die Wandfarbe — die Vorschau zeigt den Ton direkt.',
      target: () => qs('#library-tab-farbe') ?? qs('[data-library-tab="farbe"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => host.setLibraryTab('farbe')),
    },
    {
      id: 'windows',
      type: 'tooltip',
      title: 'Fenster ändern',
      description:
        'Fenster aus der Bibliothek auf die Fassade ziehen oder bestehende Fenster anklicken und anpassen.',
      target: () => qs('#library-tab-windows') ?? qs('[data-library-tab="windows"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => {
        host.ensureWallSelected?.()
        host.setLibraryTab('windows')
      }),
    },
    {
      id: 'profiles',
      type: 'tooltip',
      title: 'Profile',
      description: 'Rahmenprofile sitzen an Fenstern und Türen. Öffnung wählen, dann Profil aus der Bibliothek.',
      target: () => qs('#library-tab-profiles') ?? qs('[data-library-tab="profiles"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => {
        host.ensureOpeningSelected?.()
        host.setLibraryTab('profiles')
      }),
    },
    {
      id: 'plinth',
      type: 'tooltip',
      title: 'Sockel',
      description: 'Der Sockel schließt die Fassade nach unten ab — aus der Bibliothek auf die Wand legen.',
      target: () => qs('#library-tab-plinth') ?? qs('[data-library-tab="plinth"]'),
      placement: 'top',
      actions: [{ label: 'Weiter', action: 'next' }],
      effect: stepEffect(() => {
        host.ensureWallSelected?.()
        host.setLibraryTab('plinth')
      }),
    },
    {
      id: 'cornice',
      type: 'tooltip',
      title: 'Gesims',
      description: 'Das Gesims krönt die Wand oben. Danach kannst du frei weiterbauen.',
      target: () => qs('#library-tab-cornice') ?? qs('[data-library-tab="cornice"]'),
      placement: 'top',
      actions: [{ label: 'Fertig', action: 'dismiss' }],
      effect: stepEffect(() => {
        host.ensureWallSelected?.()
        host.setLibraryTab('cornice')
      }),
    },
  ]
}

export function FacadeTourApp(props: FacadeTourAppProps) {
  const tour = useTour({
    get steps() {
      return buildSteps(props.host)
    },
    closeOnInteractOutside: false,
    onStatusChange(details) {
      if (details.status === 'completed' || details.status === 'dismissed') {
        props.onCompleted()
      }
    },
  })

  const startTour = () => {
    props.host.setLibraryTab('facades')
    window.setTimeout(() => tour().start(), 200)
  }

  onMount(() => {
    const onStart = () => startTour()
    window.addEventListener('fb:facade-tour-start', onStart)
    onCleanup(() => window.removeEventListener('fb:facade-tour-start', onStart))

    const wantDeep = typeof location !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(location.search)
    if (wantDeep || props.shouldAutoStart()) {
      // Erst nach App-Ready, sonst kollidiert Tour mit Loading/initOpeningLibrary.
      const kick = () => {
        if (!document.body.classList.contains('app-ready') && !wantDeep) {
          window.setTimeout(kick, 200)
          return
        }
        startTour()
      }
      window.setTimeout(kick, wantDeep ? 500 : 900)
    }
  })

  return (
    <Tour.Root tour={tour}>
      <Portal>
        <Tour.Backdrop />
        <Tour.Spotlight />
        <Tour.Positioner>
          <Tour.Content class="fb-facade-tour-content">
            <Tour.Arrow>
              <Tour.ArrowTip />
            </Tour.Arrow>
            <Tour.Title class="fb-facade-tour-title" />
            <Tour.Description class="fb-facade-tour-desc" />
            <Tour.ProgressText class="fb-facade-tour-progress" />
            <Tour.Control class="fb-facade-tour-control">
              <Tour.CloseTrigger
                asChild={(p) => (
                  <Button size="sm" variant="plain" {...p()}>
                    Schließen
                  </Button>
                )}
              />
              <Tour.Actions>
                {(actions) =>
                  actions().map((action) => (
                    <Tour.ActionTrigger
                      action={action}
                      asChild={(p) => (
                        <Button size="sm" variant="solid" {...p()}>
                          {action.label}
                        </Button>
                      )}
                    />
                  ))
                }
              </Tour.Actions>
            </Tour.Control>
          </Tour.Content>
        </Tour.Positioner>
      </Portal>
    </Tour.Root>
  )
}
