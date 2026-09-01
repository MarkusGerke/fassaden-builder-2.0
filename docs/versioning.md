# Versionierung und Release Notes

## Verhalten für den Nutzer

Unter dem Titel **Fassaden-Konfigurator** stehen die aktuelle Versionsnummer (z. B. `v0.7.136`) und daneben **Quellen**. Version öffnet die Release Notes; Quellen listet eingebundene Bibliotheken, Schriften und Danksagungen (`src/credits.ts`, siehe [credits.md](credits.md)).

## Quelle der Wahrheit

| Datei | Rolle |
|---|---|
| `src/version.ts` | `APP_VERSION`, `RELEASES[]`, `GITHUB_REPO` |
| `package.json` | `version` — synchron zu `APP_VERSION` halten |
| `docs/changelog.md` | Technisches Architektur-/Feature-Protokoll (ergänzend zu `RELEASES`) |
| `src/ui/releaseNotes.ts` | Rendert den Dialog aus `RELEASES` |
| `src/credits.ts` / `src/ui/creditsDialog.ts` | Quellen und Danksagung neben der Version |
| `index.html` | `#app-version-btn`, `#app-credits-btn`, `#release-notes-dialog`, `#credits-dialog` |

## Automatische Pflege (Agent / Entwickler)

Bei **jeder nutzerrelevanten Änderung** (Feature, Fix, UX-Anpassung):

1. **`APP_VERSION`** in `src/version.ts` anheben (SemVer: Patch = Fix, Minor = Feature, Major = Breaking).
2. **`package.json`** → `"version"` auf denselben Wert setzen.
3. **Neuen Eintrag** oben in `RELEASES` anlegen mit `date` (ISO `YYYY-MM-DD`), kurzem `title` und konkreten `changes` (Nutzer-sichtbar formuliert).
4. Optional **`githubTag`** setzen, wenn auf GitHub ein Release-Tag existiert (Link: `{GITHUB_REPO}/releases/tag/{tag}`).

Kein manuelles Erinnern nötig — die Cursor-Regel in `.cursor/rules/dokumentation.mdc` verlangt das mit.

## GitHub

Standard-Repository: `https://github.com/MarkusGerke/fassaden-builder` (`GITHUB_REPO` in `src/version.ts`).

- Repository-Link erscheint immer im Dialog, wenn `GITHUB_REPO` gesetzt ist.
- Pro Release optional `githubTag: 'v0.2.0'` für direkten Release-Link.

## Bekannte Fallstricke

- HTML-Button `#app-version-btn` zeigt Platzhaltertext; der sichtbare Text kommt aus `main.ts` via `APP_VERSION`.
- **Quellen** (`#app-credits-btn`) muss zu `src/credits.ts` passen — keine Bibliothek nennen, die nicht importiert wird.
- Ohne Eintrag in `RELEASES` bleibt der Dialog leer — bei jeder Version mindestens einen Eintrag pflegen.
- Neue Defaults dürfen **Bestandsprojekte nicht still umformen**. Beim Laden:
  - **Hydrate:** fehlende Felder mit Feature **aus** / neutralen Defaults füllen (`src/utils/hydrate.ts`)
  - klar abgeleitete Pflichtfelder nachziehen (z. B. `stairs.width` aus Türbreite)
  - **Migrate:** dokumentierte Steps in `SCHEMA_MIGRATIONS` (`src/utils/schemaMigrations.ts`)
  - **Korrektur an Bestandsdaten:** abgeleitetes jedes Load (`finalizeStudioGeometry`); persistierte Fehlstände als Schema-Step — Checkliste in [migration.md](migration.md)
  - **Breaking:** `needsReview` am Element + Statuszeile (`facadeHasNeedsReview`)
  - keine Profil-, Öffnungs- oder Geometrie-Rewrites ohne explizite, dokumentierte **Schema-Migration** (siehe [migration.md](migration.md))
- `APP_VERSION` ≠ `FACADE_SCHEMA_VERSION`: App-SemVer für Nutzer-Releases; Schema nur bei Datenmodell-Änderungen anheben.
- Checkliste neues Feld: Typ → Hydrate → create* → ggf. Schema-Step + Docs + Test ([migration.md](migration.md)).