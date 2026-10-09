import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Hash, Monitor, Laptop, Smartphone, ArrowDown, ArrowUp, Copy, Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

type Bot = 'telegram' | 'slack' | 'discord'
const BOTS: { id: Bot; name: string; icon: typeof Hash; note: string; cmd: string }[] = [
  { id: 'telegram', name: 'Telegram', icon: MessageCircle, note: 'Quick-reply buttons work. Telegram bots cannot see your online status, so last activity is used.', cmd: '/link CODE' },
  { id: 'slack', name: 'Slack', icon: Monitor, note: 'DM the app. Vow also checks whether you are active in Slack right now.', cmd: '/link CODE' },
  { id: 'discord', name: 'Discord', icon: Hash, note: 'Add the app to your account, then run the command anywhere or in DM.', cmd: '/link code:CODE' },
]
const OPEN: Record<Bot, { label: string; url: (code: string) => string; hint: string }> = {
  telegram: { label: 'Open in Telegram', url: (c) => `https://t.me/VoW_rebot?start=${c}`, hint: 'Press Start in the chat: the code is sent for you.' },
  slack: { label: 'Open in Slack', url: () => 'https://slack.com/app_redirect?app=A0C6WKX1SNB&team=T0BA1NY055L', hint: 'Slack cannot pre-fill the message: paste the command below.' },
  discord: { label: 'Add Vow to Discord', url: () => 'https://discord.com/oauth2/authorize?client_id=1557286978905571428&scope=bot+applications.commands&permissions=412317240384', hint: 'Add the app, then run the command in any channel or DM.' },
}
const PLANNED = [
  { name: 'Desktop helper', icon: Laptop, note: 'Fastest channel: native notification with buttons. Planned.' },
  { name: 'Mobile push', icon: Smartphone, note: 'Planned.' },
]
const ago = (iso: string | null) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }
const card = { background: 'var(--surface)', border: '1px solid var(--border)' }
const field = { background: 'var(--recessed)', border: '1px solid var(--border)' }

export default function ChannelsPage() {
  const { profile, channels, refresh } = useAuth()
  const [link, setLink] = useState<{ bot: Bot; code: string; deepLink?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (poll.current) clearInterval(poll.current) }, [])

  const connected = (b: Bot) => channels.find(c => c.channel === b)
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 2500) }
  const save = async (patch: Record<string, unknown>) => { const r = await api('prefs', 'PATCH', patch); if (r.ok) { await refresh(); flash('Saved') } else flash(`Could not save (${r.error ?? 'error'})`) }

  const startLink = async (bot: Bot) => {
    setError(null)
    const r = await api<{ code: string; deepLink?: string }>('link-code', 'POST', { channel: bot })
    if (!r.ok) { setError('Could not create a link code. Try again.'); return }
    setLink({ bot, code: r.data.code, deepLink: r.data.deepLink })
    if (poll.current) clearInterval(poll.current)
    poll.current = setInterval(async () => {
      const s = await api<{ linked: boolean }>('link-status', 'GET', { channel: bot })
      if (s.ok && s.data.linked) { if (poll.current) clearInterval(poll.current); setLink(null); await refresh(); flash(`${bot} connected`) }
    }, 3000)
  }
  const unlink = async (bot: Bot) => {
    const c = connected(bot); if (!c) return
    const r = await api('channels', 'DELETE', { id: c.id })
    if (r.ok) { await refresh(); flash('Disconnected') }
    else setError(r.error === 'last_login_method' ? 'This is your only sign-in method. Add another channel or sign in with an email link first, otherwise you would lose access.' : 'Could not disconnect.')
  }

  const prio = (profile?.channel_priority ?? []).filter(p => connected(p as Bot))
  const auto = prio.length === 0
  const live = channels.map(c => c.channel)
  const order = auto ? live : [...prio, ...live.filter(l => !prio.includes(l))]
  const move = (id: string, d: -1 | 1) => { const i = order.indexOf(id as Bot), j = i + d; if (j < 0 || j >= order.length) return; const n = [...order]; [n[i], n[j]] = [n[j], n[i]]; void save({ priority: n }) }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <section>
        <div className="flex items-center justify-between"><h1 className="text-lg font-semibold mb-1">Channels</h1><span role="status" className="text-xs" style={{ color: '#0E9C86' }}>{note}</span></div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>One account, one memory, one assistant across all channels. Connect as many as you like. Press Connect, then run the one-time code in the bot.</p>
        <div className="grid gap-2">
          {BOTS.map(b => {
            const c = connected(b.id)
            return (
              <div key={b.id}>
                <div className="flex items-start gap-3 p-3 rounded-xl" style={card}>
                  <b.icon size={18} style={{ color: c ? '#0E9C86' : 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{b.name} <span className="text-[10px] ml-1" style={{ color: c ? '#0E9C86' : 'var(--text-muted)' }}>{c ? `connected · active ${ago(c.lastSeenAt)}` : 'not connected'}</span></div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{b.note}</div>
                    {b.id === 'discord' && (
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        <a href="https://discord.com/oauth2/authorize?client_id=1557286978905571428&scope=bot+applications.commands&permissions=412317240384" target="_blank" rel="noreferrer" className="underline" style={{ color: '#0E9C86' }}>Add to a server</a>
                        {' · '}
                        <a href="https://discord.com/oauth2/authorize?client_id=1557286978905571428&integration_type=1&scope=applications.commands" target="_blank" rel="noreferrer" className="underline" style={{ color: '#0E9C86' }}>Add to my DMs</a>
                        {' '}(DM free text needs a server that you and Vow share)
                      </div>
                    )}
                  </div>
                  <button onClick={() => (c ? void unlink(b.id) : void startLink(b.id))} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ background: c ? 'transparent' : '#0E9C86', color: c ? 'var(--text)' : '#000', border: '1px solid var(--border)' }}>{c ? 'Disconnect' : 'Connect'}</button>
                </div>
                {link?.bot === b.id && (
                  <div className="mt-1 p-3 rounded-xl text-xs space-y-2" style={{ background: 'var(--recessed)', border: '1px solid #0E9C8633' }}>
                    <div style={{ color: 'var(--text-muted)' }}>In {b.name} send <code className="font-mono">{b.cmd.replace('CODE', link.code)}</code> (valid 10 minutes, one use).</div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded font-mono text-sm tracking-wider" style={card}>{link.code}</code>
                      <button onClick={() => { void navigator.clipboard?.writeText(link.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="p-1.5 rounded cursor-pointer hover:bg-white/10" aria-label="Copy code" style={{ color: 'var(--text-muted)' }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                      <a href={link.deepLink ?? OPEN[b.id].url(link.code)} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#0E9C86', color: '#000' }}>{OPEN[b.id].label}</a>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>{OPEN[b.id].hint}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Waiting for confirmation…</div>
                  </div>
                )}
              </div>
            )
          })}
          {PLANNED.map(p => (
            <div key={p.name} className="flex items-start gap-3 p-3 rounded-xl opacity-60" style={card}><p.icon size={18} style={{ color: 'var(--text-muted)' }} /><div><div className="text-sm font-medium">{p.name} <span className="text-[10px] ml-1">planned</span></div><div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.note}</div></div></div>
          ))}
        </div>
        {error && <div role="alert" className="mt-2 p-2 rounded-lg text-[11px]" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444433' }}>{error}</div>}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Where Vow reaches you first</h2>
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Vow sends a reminder to one channel, then escalates to the next if you do not react within the wait time. Once you react, the other copies are edited to “handled”. Auto picks Slack when you are active there, otherwise the channel you used most recently.</p>
        <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer"><input type="checkbox" checked={auto} onChange={e => void save({ priority: e.target.checked ? [] : live })} /> Auto (recommended)</label>
        {!auto && (
          <ol className="space-y-1">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={card}>
                <span className="w-4 opacity-60">{i + 1}</span><span className="flex-1 capitalize">{id}</span>
                <button onClick={() => move(id, -1)} aria-label={`Move ${id} up`} className="cursor-pointer"><ArrowUp size={13} /></button>
                <button onClick={() => move(id, 1)} aria-label={`Move ${id} down`} className="cursor-pointer"><ArrowDown size={13} /></button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs">
          <label htmlFor="ack">Wait before next channel</label>
          <input id="ack" type="number" min={1} max={120} defaultValue={profile?.ack_min ?? 10} key={profile?.ack_min}
            onBlur={e => { const v = Number(e.target.value); if (v >= 1 && v <= 120 && v !== profile?.ack_min) void save({ ackMin: v }) }} className="w-16 px-2 py-1 rounded-lg" style={field} />
          <span style={{ color: 'var(--text-muted)' }}>minutes</span>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Quiet hours</h2>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {(['from', 'to'] as const).map(k => (
            <input key={k} type="time" aria-label={`Quiet ${k}`} value={(k === 'from' ? profile?.quiet_start : profile?.quiet_end) ?? ''}
              onChange={e => { const v = e.target.value; if (!v) return; const cur = { from: profile?.quiet_start ?? '22:00', to: profile?.quiet_end ?? '07:00' }; void save({ quiet: { ...cur, [k]: v } }) }} className="px-2 py-1 rounded-lg" style={field} />
          ))}
          <span style={{ color: 'var(--text-muted)' }}>{profile?.quiet_start ? `no reminders ${profile.quiet_start}–${profile.quiet_end} (${profile.tz})` : 'off'}</span>
          {profile?.quiet_start && <button onClick={() => void save({ quiet: null })} className="px-2 py-1 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)' }}>Turn off</button>}
        </div>
      </section>
    </div>
  )
}
