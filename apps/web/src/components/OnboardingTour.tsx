import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Compass, Radio, Bell, MessageCircle } from 'lucide-react'

// DASHBOARD_UX_AUDIT §A6: 4-step first-run tour (Roles -> Channels -> Reminders -> Chat), skippable, re-openable from Help.
const STEPS = [
  { icon: Compass, title: 'Pick your roles', body: 'Turn on one or more roles (fitness, medication, nutrition, health, study). You can combine them — the bot routes each message to the right one.', to: '/dashboard/settings', cta: 'Go to Roles' },
  { icon: Radio, title: 'Connect your channels', body: 'Link Telegram, Slack, Discord or web push. Set delivery order and quiet hours so reminders land where you actually are.', to: '/dashboard/channels', cta: 'Go to Channels' },
  { icon: Bell, title: 'Set your reminders', body: 'Add per-item reminders — supplements, meds, habits — with their own time, days and channel.', to: '/dashboard/settings', cta: 'Go to Reminders' },
  { icon: MessageCircle, title: 'Just chat', body: 'Ask a question, log a check-in, or say "@role" to address a specific one directly. The bot keeps context across turns.', to: '/dashboard', cta: 'Go to Chat' },
]

const SEEN_KEY = 'vow.tour.seen'

export function useTourAutostart() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true) } catch { setOpen(true) }
  }, [])
  return { open, setOpen }
}

export default function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) setStep(0) }, [open])

  useEffect(() => {
    if (!open) return
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, STEPS.length - 1))
      else if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const finish = () => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    onClose()
  }

  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70" onClick={finish} />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title"
        className="relative w-full max-w-sm rounded-xl p-5 outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button onClick={finish} aria-label="Skip tour"
          className="absolute top-3 right-3 p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>

        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: '#0E9C8620', color: '#0E9C86' }}>
          <s.icon size={20} />
        </div>
        <h2 id="tour-title" className="text-base font-semibold mb-1.5">{s.title}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{s.body}</p>

        {/* Dots */}
        <div className="flex items-center gap-1.5 mb-4" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all" style={{
              width: i === step ? 16 : 6,
              background: i === step ? '#0E9C86' : 'var(--border)',
            }} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button onClick={finish} className="text-xs cursor-pointer px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} aria-label="Previous step"
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <ChevronLeft size={14} />
              </button>
            )}
            <button
              onClick={() => { navigate(s.to); if (last) finish(); else setStep(step + 1) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 flex items-center gap-1"
              style={{ background: '#0E9C86', color: '#000' }}>
              {s.cta} {!last && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
