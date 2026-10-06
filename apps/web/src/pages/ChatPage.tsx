import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Shield } from 'lucide-react'
import { useAuth } from '../lib/auth'

interface Message {
  id: string
  from: 'user' | 'bot'
  text: string
  timestamp: Date
  receipt?: string
  buttons?: string[]
}

// Simulated bot responses (will be replaced with real Groq API)
const BOT_RESPONSES: Record<string, { text: string; receipt?: string; buttons?: string[] }> = {
  default: {
    text: "I hear you! Let me log that check-in. Your commitment is being sealed on Walrus right now.",
    receipt: "vow_0x" + Math.random().toString(16).slice(2, 10) + "..." + Math.random().toString(16).slice(2, 6),
    buttons: ['View receipt', 'Next check-in', 'My streak'],
  },
  '/streak': {
    text: "Your current streak: 3 days. All entries verified on-chain. Keep it up!",
    buttons: ['View chain', 'Export history'],
  },
  '/help': {
    text: "Available commands:\n/checkin - Log a check-in\n/streak - View your streak\n/correct - Add an honest correction\n/export - Export your data\n/settings - Adjust reminders",
  },
}

function getReply(input: string): { text: string; receipt?: string; buttons?: string[] } {
  const cmd = input.trim().toLowerCase()
  if (BOT_RESPONSES[cmd]) return BOT_RESPONSES[cmd]
  if (cmd.includes('streak')) return BOT_RESPONSES['/streak']
  if (cmd.includes('help')) return BOT_RESPONSES['/help']
  return {
    ...BOT_RESPONSES.default,
    receipt: "vow_0x" + Math.random().toString(16).slice(2, 10) + "..." + Math.random().toString(16).slice(2, 6),
  }
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      from: 'bot',
      text: `Welcome${user?.name ? ', ' + user.name : ''}! I'm your Vow companion. Tell me what you're tracking today, or pick a preset from Settings.\n\nType /help to see available commands.`,
      timestamp: new Date(),
      buttons: ['Start tracking', 'View presets', '/help'],
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const send = (text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { id: Date.now().toString(), from: 'user', text: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)

    // Simulate bot thinking (replace with real Groq API call)
    setTimeout(() => {
      const reply = getReply(text)
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: reply.text,
        timestamp: new Date(),
        receipt: reply.receipt,
        buttons: reply.buttons,
      }
      setMessages(prev => [...prev, botMsg])
      setTyping(false)
    }, 800 + Math.random() * 1200)
  }

  const handleButton = (label: string) => send(label)

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#0E9C8620' }}>
          <Shield size={14} style={{ color: '#0E9C86' }} />
        </div>
        <div>
          <div className="text-sm font-semibold">Vow Bot</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {typing ? 'typing...' : 'online'}
          </div>
        </div>
        <div className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#0E9C8615', color: '#0E9C86' }}>
          {user?.preset || 'No preset'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(m => (
          <div key={m.id}>
            <div className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] sm:max-w-[60%]">
                <div className="px-3 py-2.5 rounded-2xl text-sm whitespace-pre-line"
                  style={{
                    background: m.from === 'user' ? '#0E9C86' : 'var(--surface)',
                    color: m.from === 'user' ? '#000' : 'var(--text-sec)',
                    border: m.from === 'bot' ? '1px solid var(--border)' : 'none',
                    borderRadius: m.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}>
                  {m.text}
                </div>
                {m.receipt && (
                  <div className="mt-1 px-2 py-1 rounded-lg inline-flex items-center gap-1.5 text-[10px] font-mono" style={{ background: '#0E9C8610', color: '#0E9C86' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0E9C86' }} />
                    Receipt: {m.receipt}
                  </div>
                )}
                <div className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            {m.buttons && (
              <div className={`flex flex-wrap gap-1.5 mt-1.5 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.buttons.map((b, i) => (
                  <button key={i} onClick={() => handleButton(b)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:brightness-110"
                    style={{ background: '#0E9C8618', color: '#0E9C86', border: '1px solid #0E9C8633' }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--shell)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
          <Mic size={18} />
        </button>
        <input ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Type a message or /command..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <button onClick={() => send(input)}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-opacity disabled:opacity-30"
          style={{ background: '#0E9C86', color: '#000' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
