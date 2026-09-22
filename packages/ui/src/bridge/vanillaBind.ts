/** Vanilla-DOM-Kopplung für Park-Bridge (IDs bleiben, Sichtbarkeit über Park-UI). */

export function clickId(id: string): void {
  document.getElementById(id)?.click()
}

export function readNumber(id: string): number {
  const el = document.getElementById(id) as HTMLInputElement | null
  return el ? Number(el.value) : 0
}

export function writeNumber(id: string, value: number): void {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) return
  const wasDisabled = el.disabled
  if (wasDisabled) el.disabled = false
  el.value = String(value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  if (wasDisabled) el.disabled = true
}

export function readDisabled(id: string): boolean {
  const el = document.getElementById(id) as HTMLInputElement | null
  return !!el?.disabled
}

export function readChecked(id: string): boolean {
  const el = document.getElementById(id) as HTMLInputElement | null
  return !!el?.checked
}

export function writeChecked(id: string, checked: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) return
  el.checked = checked
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function readString(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
  return el?.value ?? ''
}

export function writeString(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
  if (!el) return
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function isButtonActive(id: string): boolean {
  const el = document.getElementById(id)
  return !!el?.classList.contains('active') || el?.getAttribute('aria-pressed') === 'true'
}

export function subscribeBus(eventName: string, listener: () => void): () => void {
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}

export function publishBus(eventName: string): void {
  window.dispatchEvent(new Event(eventName))
}
