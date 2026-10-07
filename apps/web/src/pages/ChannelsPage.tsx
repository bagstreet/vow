import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Hash, Monitor, Globe, Smartphone, Laptop, ArrowDown, ArrowUp, Copy, Check } from 'lucide-react'
import { loadPref, savePref, type LabelMode } from '../lib/roles'
import { useAuth } from '../lib/auth'

type ChanId = 'web' | 'telegram' | 'slack' | 'discord' | 'desktop' | 'push'
interface Chan { id: ChanId; name: string; icon: typeof Globe; connected: boolean; note: string; how: string }

const DEFAULTS: Chan[] = [
  { id: 'web', name: 'Web app', icon: Globe, connected: true, note: 'Always available. Chat and history live here.', how: 'Built in' },
  { id: 'telegram', name: 'Telegram', icon: MessageCircle, connected: false, note: 'Open the bot and press Start. Quick-reply buttons work. No online status is available, so last activity is used.', how: 'Sign in with Telegram, then press Start in the bot' },
  { id: 'slack', name: 'Slack', icon: Monitor, connected: false, note: 'Install the app to your workspace, DM it, press Connect here, then send the code it gives you.', how: 'Install to Slack, then send the bot /link CODE' },
  { id: 'discord', name: 'Discord', icon: Hash, connected: false, note: 'Invite the bot to a server you share with it, press Connect here, then run the code it gives you.', how: 'Invite the bot, then run /link code:CODE' },
  { id: 'desktop', name: 'Desktop helper', icon: Laptop, connected: false, note: 'Fastest channel: native notification with buttons. Planned.', how: 'Planned (T47)' },
  { id: 'push', name: 'Mobile push', icon: Smartphone, connected: false, note: 'Planned.', how: 'Planned' },
]
const LABELS: { v: LabelMode; t: string }[] = [{ v: 'always', t: 'Always' }, { v: 'change', t: 'On change' }, { v: 'off', t: 'Off' }]

export default function ChannelsPage() {
  const { user } = useAuth()
  const [chans, setChans] = useState<Chan[]>(() => {
    const saved = loadPref<{ id: ChanId; connected: boolean }[]>('channels', [])
    return DEFAULTS.map(c => ({ ...c, connected: saved.find(s => s.id === c.id)?.connected ?? c.connected }))
  })
  const [order, setOrder] = useState<ChanId[]>(() => loadPref<ChanId[]>('order', ['desktop', 'telegram', 'slack', 'discord', 'web']))
  const [wait, setWait] = useState(() => loadPref<number>('waitMin', 10))
  const [mode, setMode] = useState<LabelMode>(() => loadPref<LabelMode>('labelMode', 'change'))
  const [quiet, setQuiet] = useState(() => loadPref('quiet', { from: '22:00', to: '07:00' }))

  // Real link-code flow against the live backend (T54), for every bot channel (telegram/slack/discord —
  // they all run through the same /api/link-code + /api/link-status pair, see account.mjs CHANNELS).
  // Only the deep-link button is Telegram-specific; Slack/Discord show the code and the exact command to run.
  const LINKABLE: ChanId[] = ['telegram', 'slack', 'discord']
  const [linkChan, setLinkChan] = useState<ChanId | null>(null)
  const [linkState, setLinkState] = useState<{ code: string; deepLink?: string; expiresAt: string } | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const startLink = async (channel: ChanId) => {
    setLinkError(null)
    setLinkChan(channel)
    if (!user) { setLinkError('Sign in first.'); return }
    try {
      const r = await fetch('/api/link-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, channel }),
      }).then(x => x.json())
      if (!r.ok) { setLinkError(r.error === 'user_not_found' ? 'Account not ready yet — reload and try again.' : 'Could not create a link code.'); return }
      setLinkState({ code: r.code, deepLink: r.deepLink, expiresAt: r.expiresAt })
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/link-status?userId=${encodeURIComponent(user.id)}&channel=${channel}`).then(x => x.json())
          if (s?.ok && s.linked) {
            if (pollRef.current) clearInterval(pollRef.current)
            setLinkState(null); setLinkChan(null)
            toggle(channel, true)
          }
        } catch { /* keep polling, transient network errors are expected */ }
      }, 3000)
    } catch {
      setLinkError('Network error reaching the backend — is it deployed?')
    }
  }

  const planned = (id: ChanId) => id === 'desktop' || id === 'push'
  const toggle = (id: ChanId, forceConnect = false) => {
    if (planned(id)) return
    const next = chans.map(c => (c.id === id ? { ...c, connected: id === 'web' ? true : (forceConnect ? true : !c.connected) } : c))
    setChans(next); savePref('channels', next.map(c => ({ id: c.id, connected: c.connected })))
  }
  const onConnectClick = (id: ChanId) => {
    if (LINKABLE.includes(id) && !byIdSafe(id)?.connected) { startLink(id); return }
    toggle(id)
  }
  const LINK_CMD: Record<string, string> = { telegram: '/link CODE', slack: '/link CODE', discord: '/link code:CODE' }
  const byIdSafe = (id: ChanId) => chans.find(c => c.id === id)
  const move = (id: ChanId, d: -1 | 1) => {
    const i = order.indexOf(id), j = i + d
    if (i < 0 || j < 0 || j >= order.length) return
    const n = [...order]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); savePref('order', n)
  }
  const byId = (id: ChanId) => chans.find(c => c.id === id)!
  const live = order.filter(id => byId(id).connected)

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: '#0E9C8618', color: '#0E9C86' }}>
        Every bot channel (Telegram, Slack, Discord) links the same way: press Connect, get a one-time code, run it as a command in the bot.
      </div>
      <section>
        <h1 className="text-lg font-semibold mb-1">Channels</h1>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Connect any channel, disconnect it any time. Sign-in works through any connected channel; a Sui wallet is optional.</p>
        <div className="grid gap-2">
          {chans.map(c => (
            <div key={c.id}>
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <c.icon size={18} style={{ color: c.connected ? '#0E9C86' : 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{c.name} <span className="text-[10px] ml-1" style={{ color: c.connected ? '#0E9C86' : 'var(--text-muted)' }}>{planned(c.id) ? 'planned' : c.connected ? 'connected' : 'not connected'}</span></div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.note}</div>
                  {!c.connected && !planned(c.id) && <div className="text-[10px] mt-1 opacity-70">How: {c.how}</div>}
                </div>
                <button disabled={planned(c.id) || c.id === 'web'} onClick={() => onConnectClick(c.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-30"
                  style={{ background: c.connected ? 'transparent' : '#0E9C86', color: c.connected ? 'var(--text)' : '#000', border: '1px solid var(--border)' }}>
                  {c.connected ? 'Disconnect' : LINKABLE.includes(c.id) ? 'Get link code' : 'Connect'}
                </button>
              </div>

              {c.id === linkChan && linkState && (
                <div className="mt-1 p-3 rounded-xl text-xs space-y-2" style={{ background: 'var(--recessed)', border: '1px solid #0E9C8633' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {c.id === 'telegram' ? <>Open the bot and tap Start, or send <code className="font-mono">/link {linkState.code}</code> manually.</> : <>In the bot, run <code className="font-mono">{LINK_CMD[c.id].replace('CODE', linkState.code)}</code>.</>} Expires in 10 minutes, one use.
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 rounded font-mono text-sm tracking-wider" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>{linkState.code}</code>
                    <button onClick={() => { navigator.clipboard?.writeText(linkState.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                      className="p-1.5 rounded cursor-pointer hover:bg-white/10" aria-label="Copy code" style={{ color: 'var(--text-muted)' }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    {linkState.deepLink && (
                      <a href={linkState.deepLink} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#0E9C86', color: '#000' }}>
                        Open bot
                      </a>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>Waiting for confirmation…</div>
                </div>
              )}
              {c.id === linkChan && linkError && (
                <div className="mt-1 p-2 rounded-lg text-[11px]" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444433' }}>{linkError}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Delivery order</h2>
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>A reminder goes to the first connected channel. If you do not react within the wait time, it moves to the next one, so you are not spammed everywhere.</p>
        <ol className="space-y-1">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: byId(id).connected ? 1 : 0.4 }}>
              <span className="w-4 opacity-60">{i + 1}</span><span className="flex-1">{byId(id).name}{!byId(id).connected && ' (not connected, skipped)'}</span>
              <button onClick={() => move(id, -1)} className="cursor-pointer"><ArrowUp size={13} /></button>
              <button onClick={() => move(id, 1)} className="cursor-pointer"><ArrowDown size={13} /></button>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 mt-3 text-xs">
          <label>Wait before next channel</label>
          <input type="number" min={1} max={120} value={wait} onChange={e => { const v = Math.max(1, Math.min(120, Number(e.target.value) || 1)); setWait(v); savePref('waitMin', v) }}
            className="w-16 px-2 py-1 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid var(--border)' }} />
          <span style={{ color: 'var(--text-muted)' }}>minutes (default 10)</span>
        </div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Current path: {live.length ? live.map(id => byId(id).name).join(' → ') : 'nothing connected'}</div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Quiet hours</h2>
        <div className="flex items-center gap-2 text-xs">
          {(['from', 'to'] as const).map(k => (
            <input key={k} type="time" value={quiet[k]} onChange={e => { const q = { ...quiet, [k]: e.target.value }; setQuiet(q); savePref('quiet', q) }}
              className="px-2 py-1 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid var(--border)' }} />
          ))}
          <span style={{ color: 'var(--text-muted)' }}>no reminders in this window</span>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Role label</h2>
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Shows which role is answering under the message. “On change” shows it only when the role switches.</p>
        <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {LABELS.map(l => (
            <button key={l.v} onClick={() => { setMode(l.v); savePref('labelMode', l.v) }} className="px-3 py-1.5 text-xs cursor-pointer"
              style={{ background: mode === l.v ? '#0E9C86' : 'transparent', color: mode === l.v ? '#000' : 'var(--text)' }}>{l.t}</button>
          ))}
        </div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>In chat apps address a role with /study or “study: …”. “@” works only in the web chat.</div>
      </section>
    </div>
  )
}
