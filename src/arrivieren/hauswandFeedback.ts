import type { HauswandFeedbackEntry } from './hauswandTypes'
import { HAUSWAND_FEEDBACK_STORAGE_KEY } from './constants'

export function readHauswandFeedback(): HauswandFeedbackEntry[] {
  try {
    const raw = localStorage.getItem(HAUSWAND_FEEDBACK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as HauswandFeedbackEntry[]) : []
  } catch {
    return []
  }
}

export function appendHauswandFeedback(entry: HauswandFeedbackEntry): HauswandFeedbackEntry[] {
  const list = [...readHauswandFeedback(), entry]
  localStorage.setItem(HAUSWAND_FEEDBACK_STORAGE_KEY, JSON.stringify(list))
  return list
}

export function formatHauswandFeedbackJsonl(entries: HauswandFeedbackEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '')
}

export function downloadHauswandFeedbackJsonl(entries: HauswandFeedbackEntry[], filename?: string): void {
  const blob = new Blob([formatHauswandFeedbackJsonl(entries)], {
    type: 'application/x-ndjson;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `hauswand-feedback-${new Date().toISOString().slice(0, 10)}.jsonl`
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyHauswandFeedbackJsonl(entries: HauswandFeedbackEntry[]): Promise<boolean> {
  const text = formatHauswandFeedbackJsonl(entries)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function createHauswandFeedbackEntry(
  partial: Omit<HauswandFeedbackEntry, 'ts'>,
): HauswandFeedbackEntry {
  return { ...partial, ts: new Date().toISOString() }
}
