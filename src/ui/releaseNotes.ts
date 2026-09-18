/**
 * Adapter: App-Version → Park Release-Notes-Insel.
 * Vanilla-Hosts `#app-version-btn` / `#release-notes-dialog` bleiben im DOM (hidden).
 */
import {
  mountReleaseNotesIsland,
  type ReleaseNotesModel,
} from '@fassaden/ui'
import '@fassaden/ui/park.css'
import {
  APP_VERSION,
  formatReleaseDate,
  GITHUB_REPO,
  githubReleaseUrl,
  RELEASES,
} from '../version'

export function buildReleaseNotesModel(): ReleaseNotesModel {
  return {
    version: APP_VERSION,
    repoUrl: GITHUB_REPO || null,
    repoLabel: GITHUB_REPO ? GITHUB_REPO.replace(/^https:\/\//, '') : undefined,
    releases: RELEASES.map((release) => ({
      version: release.version,
      date: release.date,
      dateLabel: formatReleaseDate(release.date),
      title: release.title,
      changes: release.changes,
      githubUrl:
        release.githubTag && GITHUB_REPO
          ? githubReleaseUrl(release.githubTag)
          : undefined,
    })),
  }
}

/** Mountet die Solid/Park-Insel in `#ui-island-release` (oder übergebenem Host). */
export function initReleaseNotesUi(host: HTMLElement): () => void {
  return mountReleaseNotesIsland(host, buildReleaseNotesModel())
}
