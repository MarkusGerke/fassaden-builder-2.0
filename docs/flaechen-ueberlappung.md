# Keine deckungsgleichen Flächen

Konvention seit 2026-09-22. Gilt für jede Geometrie, nicht nur fürs Dach.

## Verhalten

Zwei oder mehr Flächen dürfen nicht in derselben Ebene übereinanderliegen. Eine gemeinsame Kante ist in Ordnung: das Dach darf auf der Wand sitzen. Verboten ist die Fläche, die dieselbe Ebene über ein Stück Fläche belegt — auch wenn die Farben verschieden sind oder die Flächen in verschiedenen Meshes liegen.

`polygonOffset` und ähnliche Tiefen-Tricks ersetzen das nicht. Die Flächen müssen geometrisch auseinander: eine weg, oder messbar versetzt (kein Abstand 0).

## Beispiele aus dem Dach (v2.0.579)

| Stelle | Was schief lag | Was gilt |
|---|---|---|
| Schräge an Giebel und Pult | Füllwand lag auf der Dachkante | Füllwand 0,4 cm in der Wand, Plattenrand bleibt auf der Kante |
| Über der Regenrinne | Stirnbrett lag auf dem Plattenrand | Brett 0,4 cm vor der Kante, oder der Rand entfällt |
| Traufecke | Kappe in der Wandebene schnitt die überstehende Platte | Eckstück an der Außenkante; Wandkappe nur, wenn der Nachbar bündig ist |
| Ortgang-Rückführung (v2.0.580) | Plattenrand und Endkappe lagen in derselben Ebene | Rand nur neben der Wand, Rückführung nur die Kappe |
| Mansardenecke (v2.0.580) | Seitenrand der Schräge lag in der Stirnebene | Unterseite springt nach innen; der Seitenrand entfällt dort |

## Dateien

- Regel: `.cursor/rules/keine-flaechen-ueberlappung.mdc`
- Dach, das die Regel ausgelöst hat: `src/studio/roofForms.ts`, `src/studio/roof.ts`, [roof.md](roof.md)
