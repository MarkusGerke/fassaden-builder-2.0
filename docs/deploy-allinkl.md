# Deployment: All-Inkl + GitHub Actions

Automatischer Build und Upload nach jedem Push auf `main`. Der Webspace liefert nur statische Dateien; der Build läuft auf GitHub.

## Nutzer / Betrieb

| Was | Wie |
|-----|-----|
| Live-URL | z. B. `https://fassaden.deine-domain.de` (Subdomain empfohlen) |
| Update | `git push` auf `main` → Workflow baut und lädt `dist/` hoch |
| Manuell starten | GitHub → Actions → „Deploy to All-Inkl“ → Run workflow |
| Passwortschutz | KAS → Tools → Verzeichnisschutz (bleibt beim Deploy erhalten) |

## Einmalige Einrichtung All-Inkl (KAS)

1. **Subdomain** (empfohlen): KAS → Domain → Subdomain anlegen, z. B. `fassaden.deine-domain.de`. Zielverzeichnis notieren (typisch `/www/htdocs/w012345abc/fassaden.deine-domain.de/`).
2. **SSL**: KAS → Domain → SSL-Schutz → Let's Encrypt für die Subdomain; optional HTTP→HTTPS-Umleitung.
3. **Deploy-FTP-User**: KAS → Tools → FTP-Übersicht → Neuer Nutzer, **Pfad nur** auf das Subdomain-Verzeichnis (nicht Haupt-FTP-User für CI).
4. **Zugangsdaten notieren**: Server `w….kasserver.com`, Benutzername, Passwort. Pfadangaben: KAS → FAQ/Support → Pfadangaben.
5. **Optional Passwort**: KAS → Tools → Verzeichnisschutz → Verzeichnis + Benutzer/Passwort (aktiv nach ca. 5–15 Min.).
6. **Manuell testen**: Lokal `npm run build`, Inhalt von `dist/` per FTPS (Port 21, explizites TLS) hochladen, URL im Browser prüfen.

**Tarif:** Privat+ → FTPS (diese Anleitung). Premium/Business → optional SFTP/SSH statt FTPS.

**Unterordner statt Subdomain:** Wenn die App unter `deine-domain.de/fassaden/` laufen soll, in `vite.config.ts` `base: '/fassaden/'` setzen — Subdomain vermeidet das.

## GitHub Secrets (einmalig)

Repository → Settings → Secrets and variables → Actions:

| Secret | Beispiel | Beschreibung |
|--------|----------|--------------|
| `FTP_SERVER` | `w012345abc.kasserver.com` | FTP-Host aus KAS |
| `FTP_USERNAME` | `w012345abc-deploy` | Deploy-User |
| `FTP_PASSWORD` | `…` | Passwort des Deploy-Users |
| `FTP_REMOTE_DIR` | `/` | Remote-Ziel relativ zum FTP-Login; meist `/`, wenn der User bereits im Subdomain-Root „chrooted“ ist, sonst z. B. `/fassaden.deine-domain.de/` |

Ohne diese vier Secrets schlägt der Workflow beim Upload fehl.

## Workflow

Datei: [`.github/workflows/deploy-allinkl.yml`](../.github/workflows/deploy-allinkl.yml)

- Trigger: Push auf `main`, optional `workflow_dispatch`
- `npm ci` → `npx vite build` → FTPS-Upload von `./dist/` (ohne `tsc`, damit `*.test.ts` den Deploy nicht blockiert)
- `dangerous-clean-slate: true`: Remote-Ziel wird vor Upload geleert (nur sicher, wenn der FTP-User **nur** das App-Verzeichnis sieht)

## Bekannte Fallstricke

| Symptom | Ursache / Fix |
|---------|----------------|
| `pathspec … did not match` | Workflow-Datei fehlt im Repo — committen und pushen |
| FTP-Verbindung fehlgeschlagen | FTPS, Port 21; Zugangsdaten aus KAS |
| Leere Seite / 404 | `index.html` muss im Document Root der Subdomain liegen |
| Alte Assets nach Deploy | Hard-Refresh; bei Bedarf `dangerous-clean-slate` prüfen |
| Verhalten ≠ localhost | **Gleicher Code**, aber **eigenes `localStorage`** pro Domain; **Teilen-Links** öffneten bis v2.0.355 fast immer den **2D-Aufriss** (weniger Schatten auf Paneele, anderes Innenlicht) — ab v2.0.356 steckt `view` im Link. Alte Links ohne `view`: Aufriss wenn `viewYaw`, sonst 3D. Version unter dem Titel prüfen; Hard-Refresh. |
| Verzeichnisschutz weg | Schutz im KAS anlegen, nicht per Upload in `.htaccess` im `dist/` überschreiben |
| `http://` ok, `https://` Zertifikatsfehler / kein Auto-Redirect | Port 443 liefert oft noch **\*.kasserver.com** statt Let's Encrypt für die Subdomain — im KAS **SSL-Schutz** explizit für `fassaden.…` aktivieren, Zertifikat ausstellen lassen, 15–60 Min. warten; dann optional HTTP→HTTPS-Umleitung im KAS. Prüfen: `curl -vI https://…` → `subjectAltName` muss die Subdomain enthalten. |

## Dateien

| Datei | Rolle |
|-------|--------|
| `.github/workflows/deploy-allinkl.yml` | CI/CD-Pipeline |
| `vite.config.ts` | Build-Ausgabe nach `dist/` |
| `docs/deploy-allinkl.md` | Diese Anleitung |
