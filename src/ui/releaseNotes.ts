import {
  APP_VERSION,
  formatReleaseDate,
  GITHUB_REPO,
  githubReleaseUrl,
  RELEASES,
} from '../version'

export function initReleaseNotesUi(
  versionBtn: HTMLButtonElement,
  dialog: HTMLDialogElement,
  bodyEl: HTMLElement,
  repoLinkEl: HTMLElement,
): void {
  versionBtn.textContent = `v${APP_VERSION}`
  versionBtn.title = 'Release Notes anzeigen'

  versionBtn.addEventListener('click', () => {
    renderReleaseNotes(bodyEl, repoLinkEl)
    dialog.showModal()
  })
}

function renderReleaseNotes(bodyEl: HTMLElement, repoLinkEl: HTMLElement): void {
  bodyEl.replaceChildren()

  if (GITHUB_REPO) {
    repoLinkEl.hidden = false
    repoLinkEl.replaceChildren()
    const link = document.createElement('a')
    link.href = GITHUB_REPO
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = GITHUB_REPO.replace(/^https:\/\//, '')
    repoLinkEl.append('Repository: ', link)
  } else {
    repoLinkEl.hidden = true
  }

  for (const release of RELEASES) {
    const entry = document.createElement('article')
    entry.className = 'release-entry'

    const head = document.createElement('div')
    head.className = 'release-entry-head'

    const version = document.createElement('span')
    version.className = 'release-entry-version'
    version.textContent = `v${release.version}`

    const date = document.createElement('time')
    date.className = 'release-entry-date'
    date.dateTime = release.date
    date.textContent = formatReleaseDate(release.date)

    head.append(version, date)

    if (release.title) {
      const title = document.createElement('p')
      title.className = 'release-entry-title'
      title.textContent = release.title
      head.appendChild(title)
    }

    const list = document.createElement('ul')
    list.className = 'release-entry-changes'
    for (const change of release.changes) {
      const li = document.createElement('li')
      li.textContent = change
      list.appendChild(li)
    }

    entry.append(head, list)

    if (release.githubTag && GITHUB_REPO) {
      const tagLink = document.createElement('p')
      tagLink.className = 'release-entry-link'
      const a = document.createElement('a')
      a.href = githubReleaseUrl(release.githubTag)
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = `GitHub Release ${release.githubTag}`
      tagLink.appendChild(a)
      entry.appendChild(tagLink)
    }

    bodyEl.appendChild(entry)
  }
}
