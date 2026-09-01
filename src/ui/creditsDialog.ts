import {
  CREDITS_INTRO,
  LIBRARY_CREDITS,
  METHOD_CREDITS,
  type CreditEntry,
} from '../credits'

export function initCreditsUi(button: HTMLButtonElement, dialog: HTMLDialogElement, body: HTMLElement): void {
  button.addEventListener('click', () => {
    renderCredits(body)
    dialog.showModal()
  })
}

function renderCredits(body: HTMLElement): void {
  body.replaceChildren()

  const intro = document.createElement('p')
  intro.className = 'credits-intro'
  intro.textContent = CREDITS_INTRO
  body.appendChild(intro)

  appendHeading(body, 'Bibliotheken und Schriften')
  for (const entry of LIBRARY_CREDITS) body.appendChild(creditArticle(entry))

  appendHeading(body, 'Verfahren (selbst implementiert)')
  for (const entry of METHOD_CREDITS) body.appendChild(creditArticle(entry))
}

function appendHeading(parent: HTMLElement, text: string): void {
  const h = document.createElement('h3')
  h.className = 'credits-heading'
  h.textContent = text
  parent.appendChild(h)
}

function creditArticle(entry: CreditEntry): HTMLElement {
  const article = document.createElement('article')
  article.className = 'credit-entry'
  const title = document.createElement('h4')
  title.textContent = `${entry.name} — ${entry.license}`
  const used = document.createElement('p')
  used.textContent = entry.usedAs
  const thanks = document.createElement('p')
  thanks.className = 'credit-thanks'
  thanks.textContent = entry.thanks
  article.append(title, used, thanks)
  if (entry.url) {
    const p = document.createElement('p')
    const a = document.createElement('a')
    a.href = entry.url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = entry.url.replace(/^https:\/\//, '')
    p.appendChild(a)
    article.appendChild(p)
  }
  return article
}
