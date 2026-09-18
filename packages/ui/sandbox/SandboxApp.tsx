import { createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createListCollection } from '@ark-ui/solid/select'
import { createListCollection as createComboboxCollection } from '@ark-ui/solid/combobox'
import { parseColor } from '@ark-ui/solid/color-picker'
import { Box, Stack, HStack } from 'styled-system/jsx'
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Clipboard,
  CloseButton,
  Collapsible,
  ColorPicker,
  Combobox,
  DatePicker,
  Dialog,
  Field,
  HoverCard,
  IconButton,
  Input,
  Menu,
  NumberInput,
  Popover,
  Progress,
  RadioGroup,
  SegmentGroup,
  Select,
  Slider,
  LinearIndeterminate,
  Switch as UiSwitch,
  Tabs,
  TagsInput,
  Textarea,
  Toast,
  ToggleGroup,
  Tooltip,
} from '@/components/ui'
import {
  ConditionalReveal,
  FieldRow,
  ReleaseNotesIsland,
  UiStack,
  type ReleaseNotesModel,
} from '@fassaden/ui'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  Undo2Icon,
  Redo2Icon,
} from 'lucide-solid'
import '@fassaden/ui/park.css'

type DemoTab =
  | 'chrome'
  | 'forms'
  | 'slider-color'
  | 'chips-tiles'
  | 'settings'
  | 'nav'
  | 'overlays'
  | 'feedback'

const openingCollection = createListCollection({
  items: [
    { label: 'Fenster', value: 'window' },
    { label: 'Tür', value: 'door' },
    { label: 'Ausschnitt', value: 'cutout' },
    { label: 'Nische', value: 'niche', disabled: true },
  ],
})

const profileCollection = createListCollection({
  items: [
    { label: 'Rechteck 8×8', value: 'r88' },
    { label: 'Hohlkehle', value: 'cove' },
    { label: 'Wulst', value: 'bead' },
  ],
})

const finishCollection = createComboboxCollection({
  items: [
    { label: 'Stumpf', value: 'matte' },
    { label: 'Glänzend', value: 'gloss' },
    { label: 'Metall', value: 'metal' },
  ],
})

const SWATCHES = ['#f5f0e6', '#c4a574', '#8b7355', '#4a5568', '#2d3748', '#e53e3e', '#3182ce', '#38a169']

const LIBRARY_TILES = [
  { id: 'w1', label: 'Fenster 1-flg.' },
  { id: 'w2', label: 'Fenster 2-flg.' },
  { id: 'd1', label: 'Haustür' },
  { id: 'p1', label: 'Paneel' },
]

const MOCK_RELEASE_MODEL: ReleaseNotesModel = {
  version: '2.0.519',
  repoUrl: 'https://github.com/MarkusGerke/fassaden-builder-2.0',
  repoLabel: 'github.com/MarkusGerke/fassaden-builder-2.0',
  releases: [
    {
      version: '2.0.519',
      date: '2026-09-18',
      dateLabel: '18. September 2026',
      title: 'UI-Bridge: Release-Notes-Insel',
      changes: [
        'Erste Solid/Park-Insel in der Live-App (Version-Badge + Dialog)',
        'Bridge-View-Model ohne Domain-Typen',
      ],
    },
    {
      version: '2.0.516',
      date: '2026-09-18',
      dateLabel: '18. September 2026',
      title: 'UI-Sandbox: ColorPicker + Menu',
      changes: ['ColorPicker wie Ark-Doku; Menu-Trigger als Button'],
    },
  ],
}

function SectionTitle(props: { children: string; hint?: string }) {
  return (
    <Stack gap="1">
      <Box fontSize="md" fontWeight="semibold">
        {props.children}
      </Box>
      <Show when={props.hint}>
        <Box color="fg.muted" fontSize="sm">
          {props.hint}
        </Box>
      </Show>
    </Stack>
  )
}

export default function SandboxApp() {
  const [demo, setDemo] = createSignal<DemoTab>('chrome')
  const [viewMode, setViewMode] = createSignal('front')
  const [scope, setScope] = createSignal('element')
  const [opening, setOpening] = createSignal(['window'])
  const [checked, setChecked] = createSignal(true)
  const [switched, setSwitched] = createSignal(false)
  const [width, setWidth] = createSignal('96')
  const [stepperW, setStepperW] = createSignal('120')
  const [stroke, setStroke] = createSignal([1])
  const [menuPick, setMenuPick] = createSignal('—')
  const [edges, setEdges] = createSignal(['front'])
  const [tile, setTile] = createSignal(['w1'])
  const [radioOrient, setRadioOrient] = createSignal('horizontal')
  const [revealSill, setRevealSill] = createSignal(true)
  const [tags, setTags] = createSignal(['Nord', 'EG'])
  const [color, setColor] = createSignal(parseColor('#c4a574'))

  return (
    <Box minH="100vh" bg="gray.2" p="8" color="fg.default">
      <Toast.Toaster />
      <Stack gap="6" maxW="3xl">
        <Stack gap="2">
          <HStack gap="3" alignItems="center" flexWrap="wrap">
            <Box fontSize="xl" fontWeight="bold">
              @fassaden/ui — Park UI Sandbox
            </Box>
            <Badge>v2.0.519</Badge>
            <Badge variant="outline">Cutover-Spez</Badge>
          </HStack>
          <Box color="fg.muted" fontSize="sm">
            Park-only (Grill). Live-App unter <code>/</code>: Hard-Cutover für Chrome + Szene-Leiste (v2.0.522).
          </Box>
        </Stack>

        <Tabs.Root
          value={demo()}
          onValueChange={(d) => d.value && setDemo(d.value as DemoTab)}
          size="sm"
          variant="line"
          lazyMount
          unmountOnExit
        >
          <Tabs.List flexWrap="nowrap" overflowX="auto">
            <Tabs.Trigger value="chrome" whiteSpace="nowrap">
              Chrome
            </Tabs.Trigger>
            <Tabs.Trigger value="forms" whiteSpace="nowrap">
              Formulare
            </Tabs.Trigger>
            <Tabs.Trigger value="slider-color" whiteSpace="nowrap">
              Slider & Farbe
            </Tabs.Trigger>
            <Tabs.Trigger value="chips-tiles" whiteSpace="nowrap">
              Chips & Kacheln
            </Tabs.Trigger>
            <Tabs.Trigger value="settings" whiteSpace="nowrap">
              Einstellungen
            </Tabs.Trigger>
            <Tabs.Trigger value="nav" whiteSpace="nowrap">
              Tabs & Akkordeon
            </Tabs.Trigger>
            <Tabs.Trigger value="overlays" whiteSpace="nowrap">
              Overlays
            </Tabs.Trigger>
            <Tabs.Trigger value="feedback" whiteSpace="nowrap">
              Feedback
            </Tabs.Trigger>
            <Tabs.Indicator />
          </Tabs.List>

          <Tabs.Content value="chrome">
            <Stack gap="8" mt="6">
              <Stack gap="3">
                <SectionTitle hint="view-mode → SegmentGroup (eine Wahl)">Ansichtsmodus</SectionTitle>
                <SegmentGroup.Root
                  value={viewMode()}
                  onValueChange={(d) => d.value && setViewMode(d.value)}
                >
                  <SegmentGroup.Items
                    items={[
                      { value: 'front', label: '2D' },
                      { value: 'present', label: 'Fassade' },
                      { value: '3d', label: '3D' },
                      { value: 'export', label: 'Export' },
                      { value: 'color', label: 'Farbe' },
                      { value: 'line', label: 'Zeichnung' },
                    ]}
                  />
                  <SegmentGroup.Indicator />
                </SegmentGroup.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Scope → SegmentGroup">Bearbeitungs-Scope</SectionTitle>
                <SegmentGroup.Root
                  value={scope()}
                  onValueChange={(d) => d.value && setScope(d.value)}
                >
                  <SegmentGroup.Items
                    items={[
                      { value: 'element', label: 'Auswahl' },
                      { value: 'type', label: 'Typ' },
                      { value: 'floor', label: 'Etage' },
                      { value: 'facade', label: 'Fassade' },
                    ]}
                  />
                  <SegmentGroup.Indicator />
                </SegmentGroup.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="history / gizmo / collapse">Icon-Buttons</SectionTitle>
                <HStack gap="2" flexWrap="wrap">
                  <IconButton aria-label="Widerrufen" disabled>
                    <Undo2Icon />
                  </IconButton>
                  <IconButton aria-label="Wiederholen" variant="outline">
                    <Redo2Icon />
                  </IconButton>
                  <IconButton aria-label="Wand hinzufügen" variant="outline" size="xs">
                    <PlusIcon />
                  </IconButton>
                  <IconButton aria-label="Wand entfernen" variant="outline" size="xs">
                    <MinusIcon />
                  </IconButton>
                  <IconButton aria-label="Einklappen" variant="ghost">
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton aria-label="Ausklappen" variant="ghost">
                    <ChevronRightIcon />
                  </IconButton>
                  <CloseButton aria-label="Schließen" />
                </HStack>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="preset-btn / danger">Aktions-Buttons</SectionTitle>
                <HStack gap="2" flexWrap="wrap">
                  <Button size="sm">Öffnung speichern</Button>
                  <Button size="sm" variant="outline">
                    Link kopieren
                  </Button>
                  <Button size="sm" variant="ghost">
                    Galerie
                  </Button>
                  <Button size="sm" variant="subtle">
                    Typ übernehmen
                  </Button>
                  <Button size="sm" colorPalette="red">
                    Öffnung löschen
                  </Button>
                </HStack>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Datei-details → Menu">Datei-Menü</SectionTitle>
                <Menu.Root onSelect={(d) => d.value && setMenuPick(d.value)}>
                  <Menu.Trigger
                    asChild={(props) => (
                      <Button variant="outline" size="sm" {...props()}>
                        Datei <Menu.Indicator />
                      </Button>
                    )}
                  />
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="export">Exportieren als .json</Menu.Item>
                        <Menu.Item value="import">Importieren einer .json</Menu.Item>
                        <Menu.Separator />
                        <Menu.Item value="link">Link kopieren</Menu.Item>
                        <Menu.Item value="showcase">Showcase-Link kopieren</Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
                <Box fontSize="sm" color="fg.muted">
                  Wahl: {menuPick()}
                </Box>
              </Stack>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="forms">
            <Stack gap="6" mt="6">
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <Input placeholder="Nordfassade" />
              </Field.Root>

              <Field.Root>
                <Field.Label>Breite (cm) — NumberInput</Field.Label>
                <NumberInput.Root
                  value={width()}
                  step={8}
                  min={8}
                  max={800}
                  onValueChange={(d) => setWidth(d.value)}
                >
                  <NumberInput.Control>
                    <NumberInput.IncrementTrigger />
                    <NumberInput.DecrementTrigger />
                  </NumberInput.Control>
                  <NumberInput.Input />
                </NumberInput.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label>Notiz</Field.Label>
                <Textarea placeholder="Optional…" rows={3} />
              </Field.Root>

              <Checkbox.Root
                checked={checked()}
                onCheckedChange={(d) => setChecked(d.checked === true)}
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>Laibungsrahmen</Checkbox.Label>
                <Checkbox.HiddenInput />
              </Checkbox.Root>

              <UiSwitch.Root checked={switched()} onCheckedChange={(d) => setSwitched(d.checked)}>
                <UiSwitch.Control>
                  <UiSwitch.Thumb />
                </UiSwitch.Control>
                <UiSwitch.Label>Bloom aktiv</UiSwitch.Label>
                <UiSwitch.HiddenInput />
              </UiSwitch.Root>

              <RadioGroup.Root
                value={radioOrient()}
                onValueChange={(d) => d.value && setRadioOrient(d.value)}
              >
                <RadioGroup.Label>Orientierung</RadioGroup.Label>
                <HStack gap="4" mt="2">
                  <For
                    each={[
                      ['horizontal', 'Horizontal'],
                      ['vertical', 'Vertikal'],
                    ]}
                  >
                    {([v, label]) => (
                      <RadioGroup.Item value={v!}>
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>{label}</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                    )}
                  </For>
                </HStack>
              </RadioGroup.Root>

              <Field.Root>
                <Field.Label>Öffnungstyp</Field.Label>
                <Select.Root
                  collection={openingCollection}
                  value={opening()}
                  onValueChange={(d) => setOpening(d.value)}
                >
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Auswählen…" />
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <For each={openingCollection.items}>
                          {(item) => (
                            <Select.Item item={item}>
                              <Select.ItemText>{item.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          )}
                        </For>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                  <Select.HiddenSelect />
                </Select.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label>Oberfläche</Field.Label>
                <Combobox.Root collection={finishCollection} openOnClick>
                  <Combobox.Control>
                    <Combobox.Input placeholder="Finish wählen…" />
                    <Combobox.IndicatorGroup>
                      <Combobox.Trigger />
                    </Combobox.IndicatorGroup>
                  </Combobox.Control>
                  <Portal>
                    <Combobox.Positioner>
                      <Combobox.Content>
                        <Combobox.List>
                          <For each={finishCollection.items}>
                            {(item) => (
                              <Combobox.Item item={item}>
                                <Combobox.ItemText>{item.label}</Combobox.ItemText>
                                <Combobox.ItemIndicator />
                              </Combobox.Item>
                            )}
                          </For>
                        </Combobox.List>
                      </Combobox.Content>
                    </Combobox.Positioner>
                  </Portal>
                </Combobox.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label>Datum</Field.Label>
                <DatePicker.Root>
                  <DatePicker.Control>
                    <DatePicker.Input />
                    <DatePicker.Trigger />
                    <DatePicker.ClearTrigger />
                  </DatePicker.Control>
                  <Portal>
                    <DatePicker.Positioner>
                      <DatePicker.Content>
                        <DatePicker.View view="day">
                          <DatePicker.Context>
                            {(api) => (
                              <>
                                <DatePicker.ViewControl>
                                  <DatePicker.PrevTrigger />
                                  <DatePicker.ViewTrigger>
                                    <DatePicker.RangeText />
                                  </DatePicker.ViewTrigger>
                                  <DatePicker.NextTrigger />
                                </DatePicker.ViewControl>
                                <DatePicker.Table>
                                  <DatePicker.TableHead>
                                    <DatePicker.TableRow>
                                      <For each={api().weekDays}>
                                        {(weekDay) => (
                                          <DatePicker.TableHeader>{weekDay.short}</DatePicker.TableHeader>
                                        )}
                                      </For>
                                    </DatePicker.TableRow>
                                  </DatePicker.TableHead>
                                  <DatePicker.TableBody>
                                    <For each={api().weeks}>
                                      {(week) => (
                                        <DatePicker.TableRow>
                                          <For each={week}>
                                            {(day) => (
                                              <DatePicker.TableCell value={day}>
                                                <DatePicker.TableCellTrigger>{day.day}</DatePicker.TableCellTrigger>
                                              </DatePicker.TableCell>
                                            )}
                                          </For>
                                        </DatePicker.TableRow>
                                      )}
                                    </For>
                                  </DatePicker.TableBody>
                                </DatePicker.Table>
                              </>
                            )}
                          </DatePicker.Context>
                        </DatePicker.View>
                      </DatePicker.Content>
                    </DatePicker.Positioner>
                  </Portal>
                </DatePicker.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label>Uhrzeit</Field.Label>
                <Input type="time" defaultValue="12:00" />
              </Field.Root>

              <Field.Root>
                <Field.Label>Datei importieren</Field.Label>
                <Input type="file" accept="application/json,.json" />
              </Field.Root>

              <TagsInput.Root value={tags()} onValueChange={(d) => setTags(d.value)}>
                <TagsInput.Label>Schlagworte</TagsInput.Label>
                <TagsInput.Control>
                  <TagsInput.Items />
                  <TagsInput.Input placeholder="Tag hinzufügen…" />
                </TagsInput.Control>
                <TagsInput.HiddenInput />
              </TagsInput.Root>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="slider-color">
            <Stack gap="8" mt="6">
              <Stack gap="3">
                <SectionTitle hint="range → Slider (+ optional NumberInput)">Strichstärke</SectionTitle>
                <Slider.Root
                  value={stroke()}
                  min={0.25}
                  max={3}
                  step={0.05}
                  onValueChange={(d) => setStroke(d.value)}
                >
                  <HStack justify="space-between">
                    <Slider.Label>Strichstärke</Slider.Label>
                    <Slider.ValueText />
                  </HStack>
                  <Slider.Control>
                    <Slider.Track>
                      <Slider.Range />
                    </Slider.Track>
                    <Slider.Thumbs />
                  </Slider.Control>
                </Slider.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Swatches → ColorPicker">Farbe</SectionTitle>
                <ColorPicker.Root
                  value={color()}
                  onValueChange={(d) => setColor(d.value)}
                  lazyMount
                  unmountOnExit
                >
                  <ColorPicker.Label>Wandfarbe</ColorPicker.Label>
                  <ColorPicker.Control>
                    <ColorPicker.ChannelInput channel="hex" />
                    <ColorPicker.Trigger>
                      <ColorPicker.TransparencyGrid size="10px" />
                      <ColorPicker.ValueSwatch />
                    </ColorPicker.Trigger>
                  </ColorPicker.Control>
                  <Portal>
                    <ColorPicker.Positioner>
                      <ColorPicker.Content>
                        <Stack gap="3">
                          <ColorPicker.Area>
                            <ColorPicker.AreaBackground />
                            <ColorPicker.AreaThumb />
                          </ColorPicker.Area>
                          <HStack gap="2">
                            <ColorPicker.ChannelSlider channel="hue" flex="1">
                              <ColorPicker.ChannelSliderTrack />
                              <ColorPicker.ChannelSliderThumb />
                            </ColorPicker.ChannelSlider>
                            <ColorPicker.EyeDropperTrigger aria-label="Pipette">
                              ⌖
                            </ColorPicker.EyeDropperTrigger>
                          </HStack>
                          <ColorPicker.SwatchGroup>
                            <For each={SWATCHES}>
                              {(c) => (
                                <ColorPicker.SwatchTrigger value={c}>
                                  <ColorPicker.Swatch value={c} />
                                </ColorPicker.SwatchTrigger>
                              )}
                            </For>
                          </ColorPicker.SwatchGroup>
                        </Stack>
                      </ColorPicker.Content>
                    </ColorPicker.Positioner>
                  </Portal>
                  <ColorPicker.HiddenInput />
                </ColorPicker.Root>
                <Box fontSize="sm" color="fg.muted">
                  Wert: {color().toString('hex')}
                </Box>
              </Stack>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="chips-tiles">
            <Stack gap="8" mt="6">
              <Stack gap="3">
                <SectionTitle hint="Kanten → ToggleGroup multiple">Kanten</SectionTitle>
                <ToggleGroup.Root
                  multiple
                  variant="outline"
                  size="sm"
                  value={edges()}
                  onValueChange={(d) => setEdges(d.value)}
                >
                  <ToggleGroup.Item value="front">Vorne</ToggleGroup.Item>
                  <ToggleGroup.Item value="back">Hinten</ToggleGroup.Item>
                  <ToggleGroup.Item value="both">Beide</ToggleGroup.Item>
                </ToggleGroup.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Bibliothek → ToggleGroup tile">Bibliothek-Kacheln</SectionTitle>
                <ToggleGroup.Root
                  variant="ghost"
                  tile
                  deselectable={false}
                  value={tile()}
                  onValueChange={(d) => d.value[0] && setTile(d.value)}
                >
                  <For each={LIBRARY_TILES}>
                    {(t) => (
                      <ToggleGroup.Item value={t.id}>
                        <Box
                          aspectRatio="4/3"
                          bg="gray.3"
                          borderRadius="l1"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="fg.muted"
                          fontSize="lg"
                        >
                          ▢
                        </Box>
                        <Box>{t.label}</Box>
                      </ToggleGroup.Item>
                    )}
                  </For>
                </ToggleGroup.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Summary → Card">Zusammenfassung</SectionTitle>
                <Card.Root maxW="sm">
                  <Card.Header>
                    <Card.Title>Fenster · EG</Card.Title>
                    <Card.Description>96 × 140 cm · Holzrahmen</Card.Description>
                  </Card.Header>
                  <Card.Body>
                    <Box fontSize="sm" color="fg.muted">
                      Klick öffnet Maße.
                    </Box>
                  </Card.Body>
                  <Card.Footer>
                    <Button size="sm" variant="outline">
                      Bearbeiten
                    </Button>
                  </Card.Footer>
                </Card.Root>
              </Stack>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="settings">
            <UiStack gap="section" mt="6">
              <Stack gap="4">
                <Box
                  fontSize="sm"
                  fontWeight="bold"
                  bg="gray.3"
                  px="3"
                  py="2"
                  borderRadius="l2"
                >
                  Maße
                </Box>
                <FieldRow label="Breite (cm)">
                  <NumberInput.Root
                    value={stepperW()}
                    step={8}
                    min={8}
                    max={800}
                    onValueChange={(d) => setStepperW(d.value)}
                  >
                    <NumberInput.Control>
                    <NumberInput.IncrementTrigger />
                    <NumberInput.DecrementTrigger />
                  </NumberInput.Control>
                    <NumberInput.Input />
                  </NumberInput.Root>
                </FieldRow>
                <FieldRow label="Höhe (cm)" hint="Brüstung bis Sturz">
                  <NumberInput.Root defaultValue="140" min={40} max={400}>
                    <NumberInput.Control>
                    <NumberInput.IncrementTrigger />
                    <NumberInput.DecrementTrigger />
                  </NumberInput.Control>
                    <NumberInput.Input />
                  </NumberInput.Root>
                </FieldRow>
                <FieldRow label="Profil">
                  <Select.Root collection={profileCollection} positioning={{ sameWidth: true }}>
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Profil…" />
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Trigger>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          <For each={profileCollection.items}>
                            {(item) => (
                              <Select.Item item={item}>
                                <Select.ItemText>{item.label}</Select.ItemText>
                                <Select.ItemIndicator />
                              </Select.Item>
                            )}
                          </For>
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                    <Select.HiddenSelect />
                  </Select.Root>
                </FieldRow>
              </Stack>

              <Stack gap="4">
                <Box
                  fontSize="sm"
                  fontWeight="bold"
                  bg="gray.3"
                  px="3"
                  py="2"
                  borderRadius="l2"
                >
                  Fensterbank
                </Box>
                <Box fontSize="sm" fontWeight="semibold" color="fg.muted">
                  Innen
                </Box>
                <Checkbox.Root
                  checked={revealSill()}
                  onCheckedChange={(d) => setRevealSill(d.checked === true)}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label>Fensterbank innen</Checkbox.Label>
                  <Checkbox.HiddenInput />
                </Checkbox.Root>
                <ConditionalReveal when={revealSill()}>
                  <Stack gap="4">
                    <FieldRow label="Überstand (cm)">
                      <NumberInput.Root defaultValue="4" min={0} max={40}>
                        <NumberInput.Control>
                    <NumberInput.IncrementTrigger />
                    <NumberInput.DecrementTrigger />
                  </NumberInput.Control>
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </FieldRow>
                    <FieldRow label="Dicke (cm)">
                      <NumberInput.Root defaultValue="3" min={1} max={20}>
                        <NumberInput.Control>
                    <NumberInput.IncrementTrigger />
                    <NumberInput.DecrementTrigger />
                  </NumberInput.Control>
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </FieldRow>
                  </Stack>
                </ConditionalReveal>
              </Stack>
            </UiStack>
          </Tabs.Content>

          <Tabs.Content value="nav">
            <Stack gap="8" mt="6">
              <Stack gap="3">
                <SectionTitle hint="library-tab → Tabs">Bibliothek-Tabs</SectionTitle>
                <Tabs.Root defaultValue="windows" size="sm" variant="line">
                  <Tabs.List>
                    <Tabs.Trigger value="windows">Fenster</Tabs.Trigger>
                    <Tabs.Trigger value="doors">Türen</Tabs.Trigger>
                    <Tabs.Trigger value="panels">Fassade</Tabs.Trigger>
                    <Tabs.Trigger value="farbe">Farben</Tabs.Trigger>
                    <Tabs.Indicator />
                  </Tabs.List>
                  <Tabs.Content value="windows">
                    <Box mt="4" color="fg.muted" fontSize="sm">
                      Bibliothek Fenster …
                    </Box>
                  </Tabs.Content>
                  <Tabs.Content value="doors">
                    <Box mt="4" color="fg.muted" fontSize="sm">
                      Bibliothek Türen …
                    </Box>
                  </Tabs.Content>
                  <Tabs.Content value="panels">
                    <Box mt="4" color="fg.muted" fontSize="sm">
                      Fassaden-Paneele …
                    </Box>
                  </Tabs.Content>
                  <Tabs.Content value="farbe">
                    <Box mt="4" color="fg.muted" fontSize="sm">
                      Farb-Bibliothek …
                    </Box>
                  </Tabs.Content>
                </Tabs.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="sill accordion → Accordion">Akkordeon</SectionTitle>
                <Accordion.Root defaultValue={['sill']} collapsible>
                  <Accordion.Item value="sill">
                    <Accordion.ItemTrigger>
                      Fensterbank innen
                      <Accordion.ItemIndicator />
                    </Accordion.ItemTrigger>
                    <Accordion.ItemContent>
                      <Accordion.ItemBody>
                        Maße und Profil — ausgeblendet wenn Feature aus.
                      </Accordion.ItemBody>
                    </Accordion.ItemContent>
                  </Accordion.Item>
                  <Accordion.Item value="hood">
                    <Accordion.ItemTrigger>
                      Verdachung
                      <Accordion.ItemIndicator />
                    </Accordion.ItemTrigger>
                    <Accordion.ItemContent>
                      <Accordion.ItemBody>Form, Profil, Maße …</Accordion.ItemBody>
                    </Accordion.ItemContent>
                  </Accordion.Item>
                </Accordion.Root>
              </Stack>

              <Stack gap="3">
                <SectionTitle hint="Spalte einklappen → Collapsible">Collapsible</SectionTitle>
                <Collapsible.Root>
                  <Collapsible.Trigger
                    asChild={(props) => (
                      <Button variant="outline" size="sm" {...props()}>
                        Details ▾
                      </Button>
                    )}
                  />
                  <Collapsible.Content>
                    <Box mt="2" p="3" borderWidth="1px" borderRadius="l2" fontSize="sm" color="fg.muted">
                      Zusätzliche Optionen …
                    </Box>
                  </Collapsible.Content>
                </Collapsible.Root>
              </Stack>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="overlays">
            <Stack gap="6" mt="6">
              <HStack gap="3" flexWrap="wrap">
                <Dialog.Root>
                  <Dialog.Trigger
                    asChild={(props) => (
                      <Button {...props()} size="sm">
                        Dialog
                      </Button>
                    )}
                  />
                  <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                      <Dialog.Content>
                        <Stack gap="4" p="6">
                          <HStack justify="space-between" alignItems="flex-start">
                            <Stack gap="1">
                              <Dialog.Title>Navigation</Dialog.Title>
                              <Dialog.Description>
                                Orbit: Rechtsklick · Zoom: Rad
                              </Dialog.Description>
                            </Stack>
                            <Dialog.CloseTrigger>
                              <CloseButton />
                            </Dialog.CloseTrigger>
                          </HStack>
                          <HStack justify="flex-end">
                            <Dialog.ActionTrigger>Schließen</Dialog.ActionTrigger>
                          </HStack>
                        </Stack>
                      </Dialog.Content>
                    </Dialog.Positioner>
                  </Portal>
                </Dialog.Root>

                <Menu.Root onSelect={(d) => d.value && setMenuPick(d.value)}>
                  <Menu.Trigger
                    asChild={(props) => (
                      <Button variant="outline" size="sm" {...props()}>
                        Kontextmenü <Menu.Indicator />
                      </Button>
                    )}
                  />
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="copy">Kopieren</Menu.Item>
                        <Menu.Item value="paste">Einfügen</Menu.Item>
                        <Menu.Separator />
                        <Menu.Item value="delete">Löschen</Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>

                <Popover.Root>
                  <Popover.Trigger
                    asChild={(props) => (
                      <Button variant="subtle" size="sm" {...props()}>
                        Popover
                      </Button>
                    )}
                  />
                  <Portal>
                    <Popover.Positioner>
                      <Popover.Content>
                        <Popover.Arrow />
                        <Stack gap="2" p="4" maxW="xs">
                          <Popover.Title>Feldhinweis</Popover.Title>
                          <Popover.Description>
                            Einheit im Label (cm), nicht im NumberInput.
                          </Popover.Description>
                          <Popover.CloseTrigger>OK</Popover.CloseTrigger>
                        </Stack>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Portal>
                </Popover.Root>

                <Tooltip content="Navigation (?)" showArrow>
                  <Button variant="ghost" size="sm" aria-label="Hilfe">
                    ?
                  </Button>
                </Tooltip>

                <HoverCard.Root>
                  <HoverCard.Trigger
                    asChild={(props) => (
                      <Button variant="ghost" size="sm" {...props()}>
                        Hover-Card
                      </Button>
                    )}
                  />
                  <Portal>
                    <HoverCard.Positioner>
                      <HoverCard.Content>
                        <HoverCard.Arrow>
                          <HoverCard.ArrowTip />
                        </HoverCard.Arrow>
                        <Box p="3" fontSize="sm" maxW="xs">
                          Kurzinfo beim Hover.
                        </Box>
                      </HoverCard.Content>
                    </HoverCard.Positioner>
                  </Portal>
                </HoverCard.Root>
              </HStack>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="feedback">
            <Stack gap="8" mt="6">
              <Stack gap="3">
                <SectionTitle hint="Live-App → Bridge ReleaseNotesIsland">
                  Version / Release Notes
                </SectionTitle>
                <ReleaseNotesIsland model={MOCK_RELEASE_MODEL} />
              </Stack>

              <Alert.Root>
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Hinweis</Alert.Title>
                  <Alert.Description>
                    Inaktive Optionen und zugehörige Felder ausblenden.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>

              <HStack gap="2" flexWrap="wrap" alignItems="center">
                <Badge>Neu</Badge>
                <Badge variant="outline">Alpha</Badge>
                <LinearIndeterminate size="sm" trackWidth="6rem" />
              </HStack>

              <Progress.Root value={65}>
                <HStack justify="space-between" mb="2">
                  <Progress.Label>Laden</Progress.Label>
                  <Progress.ValueText />
                </HStack>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>

              <Clipboard.Root value="https://example.com/fassade#demo">
                <Clipboard.Label>Showcase-Link</Clipboard.Label>
                <Clipboard.Control>
                  <Clipboard.Input />
                  <Clipboard.Trigger>
                    <Clipboard.Indicator />
                  </Clipboard.Trigger>
                </Clipboard.Control>
              </Clipboard.Root>

              <HStack gap="2" flexWrap="wrap">
                <Button
                  size="sm"
                  onClick={() =>
                    Toast.toaster.create({
                      title: 'Gespeichert',
                      description: 'Projekt exportiert.',
                      type: 'success',
                    })
                  }
                >
                  Toast Erfolg
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    Toast.toaster.create({
                      title: 'Warnung',
                      description: 'Schema-Migration empfohlen.',
                      type: 'warning',
                    })
                  }
                >
                  Toast Warnung
                </Button>
              </HStack>
            </Stack>
          </Tabs.Content>
        </Tabs.Root>
      </Stack>
    </Box>
  )
}
