import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { RoleAvatar } from '../components/RoleAvatar'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { ROLES, COLORS, type RoleId } from '../lib/roles'

interface Message { id: string; from: 'user' | 'bot'; text: string; at: Date; role?: RoleId | null; memory?: string; error?: boolean }
interface HistoryRow { direction: 'in' | 'out'; role: RoleId | null; content: string; created_at: string }

// Real chat: the same brain as the Telegram/Slack/Discord bots (roles, short-term history, Walrus recall + remember).
export default function ChatPage() {
  const { roles } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const enabled = roles as RoleId[]

  useEffect(() => {
    api<{ messages: HistoryRow[] }>('history').then(r => {
      if (!r.ok) return
      setMessages(r.data.messages.slice(-30).map((m, i) => ({ id: `h${i}`, from: m.direction === 'in' ? 'user' : 'bot', text: m.content, at: new Date(m.created_at), role: m.role })))
    })
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return
    setInput(''); setBusy(true)
    setMessages(p => [...p, { id: crypto.randomUUID(), from: 'user', text: t, at: new Date() }])
    const r = await api<{ reply: string; role: RoleId | null; remembered: number; memoryJob: string | null }>('chat', 'POST', { text: t })
    setBusy(false)
    if (!r.ok) {
      const why = r.error === 'unauthorized' ? 'Your session expired. Sign in again.' : r.status === 0 ? 'No connection.' : 'Something went wrong. Try again.'
      setMessages(p => [...p, { id: crypto.randomUUID(), from: 'bot', text: why, at: new Date(), error: true }]); return
    }
    const mem = r.data.memoryJob ? `Saved to Walrus memory · job ${r.data.memoryJob.slice(0, 8)}` : r.data.remembered ? `Used ${r.data.remembered} memories` : undefined
    setMessages(p => [...p, { id: crypto.randomUUID(), from: 'bot', text: r.data.reply, at: new Date(), role: r.data.role, memory: mem }])
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <RoleAvatar roles={enabled} size={32} />
        <div>
          <div className="text-sm font-semibold">Vow</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{busy ? 'typing…' : 'same memory as your Telegram, Slack and Discord'}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b text-[11px]" style={{ borderColor: 'var(--border)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Roles:</span>
        {enabled.map(id => <span key={id} className="px-2 py-0.5 rounded-full" style={{ border: `1px solid ${COLORS[id]}66`, background: `${COLORS[id]}26`, color: COLORS[id] }}>{ROLES[id].emoji} {ROLES[id].label}</span>)}
        <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>Address a role: “study: …”. Change roles in Settings.</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-center mt-10" style={{ color: 'var(--text-muted)' }}>Say hello. What you tell Vow here is remembered in every channel.</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex gap-2 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.from === 'bot' && <RoleAvatar roles={m.role ? [m.role] : []} size={28} />}
            <div className="max-w-[80%] sm:max-w-[60%]">
              <div className="px-3 py-2.5 rounded-2xl text-sm whitespace-pre-line"
                style={{ background: m.from === 'user' ? '#0E9C86' : 'var(--surface)', color: m.error ? '#ef4444' : m.from === 'user' ? '#000' : 'var(--text-sec)', border: m.from === 'bot' ? '1px solid var(--border)' : 'none' }}>{m.text}</div>
              {m.memory && <div className="mt-1 px-2 py-1 rounded-lg inline-flex items-center gap-1.5 text-[10px] font-mono" style={{ background: '#0E9C8610', color: '#0E9C86' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0E9C86' }} />{m.memory}</div>}
              <div className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{m.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--shell)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && void send(input)} maxLength={2000} aria-label="Message"
          placeholder="Type a message…" className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        <button onClick={() => void send(input)} disabled={!input.trim() || busy} aria-label="Send" className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-opacity disabled:opacity-30" style={{ background: '#0E9C86', color: '#000' }}><Send size={16} /></button>
      </div>
    </div>
  )
}
