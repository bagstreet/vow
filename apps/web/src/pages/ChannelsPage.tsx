import { useState } from 'react'
import { MessageCircle, Hash, Monitor, Globe, Smartphone, Laptop, ArrowDown, ArrowUp } from 'lucide-react'
import { loadPref, savePref, type LabelMode } from '../lib/roles'

type ChanId = 'web' | 'telegram' | 'slack' | 'discord' | 'desktop' | 'push'
interface Chan { id: ChanId; name: string; icon: typeof Globe; connected: boolean; note: string; how: string }

const DEFAULTS: Chan[] = [
  { id: 'web', name: 'Web app', icon: Globe, connected: true, note: 'Always available. Chat and history live here.', how: 'Built in' },
  { id: 'telegram', name: 'Telegram', icon: MessageCircle, connected: false, note: 'Open the bot and press Start. Quick-reply buttons work. No online status is available, so last activity is used.', how: 'Sign in with Telegram, then press Start in the bot' },
  { id: 'slack', name: 'Slack', icon: Monitor, connected: false, note: 'Install the app to your workspace. Online status is available.', how: 'Add to Slack (permissions: send messages, open DMs, read presence)' },
  { id: 'discord', name: 'Discord', icon: Hash, connected: false, note: 'Invite the bot, then allow DMs. Online status is not used in the first version.', how: 'Invite link and DM permission' },
  { id: 'desktop', name: 'Desktop helper', icon: Laptop, connected: false, note: 'Fastest channel: native notification with buttons. Planned.', how: 'Planned (T47)' },
  { id: 'push', name: 'Mobile push', icon: Smartphone, connected: false, note: 'Planned.', how: 'Planned' },
]
const LABELS: { v: LabelMode; t: string }[] = [{ v: 'always', t: 'Always' }, { v: 'change', t: 'On change' }, { v: 'off', t: 'Off' }]

export default function ChannelsPage() {
  const [chans, setChans] = useState<Chan[]>(() => {
    const saved = loadPref<{ id: ChanId; connected: boolean }[]>('channels', [])
    return DEFAULTS.map(c => ({ ...c, connected: saved.find(s => s.id === c.id)?.connected ?? c.connected }))
  })
  const [order, setOrder] = useState<ChanId[]>(() => loadPref<ChanId[]>('order', ['desktop', 'telegram', 'slack', 'discord', 'web']))
  const [wait, setWait] = useState(() => loadPref<number>('waitMin', 10))
  const [mode, setMode] = useState<LabelMode>(() => loadPref<LabelMode>('labelMode', 'change'))
  const [quiet, setQuiet] = useState(() => loadPref('quiet', { from: '22:00', to: '07:00' }))

  const planned = (id: ChanId) => id === 'desktop' || id === 'push'
  const toggle = (id: ChanId) => {
    if (planned(id)) return
    const next = chans.map(c => (c.id === id ? { ...c, connected: id === 'web' ? true : !c.connected } : c))
    setChans(next); savePref('channels', next.map(c => ({ id: c.id, connected: c.connected })))
  }
  const move = (id: ChanId, d: -1 | 1) => {
    const i = order.indexOf(id), j = i + d
    if (i < 0 || j < 0 || j >= order.length) return
    const n = [...order]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); savePref('order', n)
  }
  const byId = (id: ChanId) => chans.find(c => c.id === id)!
  const live = order.filter(id => byId(id).connected)

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: '#f59e0b18', color: '#f59e0b' }}>
        Preview with mock data: connect and disconnect are stored in this browser only. Real OAuth installs arrive with the backend (T50, T51).
      </div>
      <section>
        <h1 className="text-lg font-semibold mb-1">Channels</h1>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Connect any channel, disconnect it any time. Sign-in works through any connected channel; a Sui wallet is optional.</p>
        <div className="grid gap-2">
          {chans.map(c => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <c.icon size={18} style={{ color: c.connected ? '#0E9C86' : 'var(--text-muted)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{c.name} <span className="text-[10px] ml-1" style={{ color: c.connected ? '#0E9C86' : 'var(--text-muted)' }}>{planned(c.id) ? 'planned' : c.connected ? 'connected' : 'not connected'}</span></div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.note}</div>
                {!c.connected && !planned(c.id) && <div className="text-[10px] mt-1 opacity-70">How: {c.how}</div>}
              </div>
              <button disabled={planned(c.id) || c.id === 'web'} onClick={() => toggle(c.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-30"
                style={{ background: c.connected ? 'transparent' : '#0E9C86', color: c.connected ? 'var(--text)' : '#000', border: '1px solid var(--border)' }}>
                {c.connected ? 'Disconnect' : 'Connect'}
              </button>
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
