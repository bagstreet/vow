import { useSyncExternalStore } from 'react'

// Global "something is loading" signal. A request that takes longer than SHOW_AFTER_MS shows a spinner bottom-right,
// so the user always sees that the interface is working, but fast requests never flicker.
const SHOW_AFTER_MS = 400
let pending = 0, visible = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function trackBusy<T>(p: Promise<T>): Promise<T> {
  pending++
  let shown = false
  const timer = setTimeout(() => { if (pending > 0) { shown = true; visible++; emit() } }, SHOW_AFTER_MS)
  const done = () => { clearTimeout(timer); pending--; if (shown) { visible--; emit() } }
  return p.finally(done)
}

export function BusyIndicator() {
  const n = useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => visible)
  if (!n) return null
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-xs shadow-lg"
      style={{ background: 'var(--raised)', border: '1px solid var(--border-vis)', color: 'var(--text-sec)', backdropFilter: 'blur(8px)' }}>
      <span className="vow-spinner" aria-hidden="true" /> Working…
    </div>
  )
}
