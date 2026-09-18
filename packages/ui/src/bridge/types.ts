/** View-Model für eine Release-Zeile — keine App-Domain-Typen. */
export interface ReleaseNoteVm {
  version: string
  /** ISO-Datum (YYYY-MM-DD), für `<time datetime>`. */
  date: string
  /** Anzeige-Datum (bereits lokalisiert von der App). */
  dateLabel: string
  title?: string
  changes: string[]
  /** Vorgebaute GitHub-Release-URL, optional. */
  githubUrl?: string
}

/** Daten für die Release-Notes-Insel. */
export interface ReleaseNotesModel {
  /** Aktuelle App-Version ohne führendes „v“. */
  version: string
  repoUrl: string | null
  /** Anzeige-Text für Repo-Link (ohne https://). */
  repoLabel?: string
  releases: ReleaseNoteVm[]
}
