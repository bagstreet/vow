import { useEffect, useMemo, useState } from 'react'
import { Bell, Shield, Key, User, Plus, Trash2, MessageCircle, Hash, Monitor, Globe, Clock, AlertTriangle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import AgentTokens from '../components/AgentTokens'

const ALL_TZ: string[] = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC']
// Time zones grouped by region, labelled "(UTC+03:00) Tallinn · Europe/Tallinn" and sorted by the current offset, so UTC+1 and UTC+2 are distinguishable.
function offsetMin(tz: string): number {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName')?.value ?? 'GMT'
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p); if (!m) return 0
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
  } catch { return 0 }
}
const fmtOffset = (min: number) => `UTC${min < 0 ? '-' : '+'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`
function buildTzGroups(extra: string) {
  const list = ALL_TZ.includes(extra) ? ALL_TZ : [extra, ...ALL_TZ]
  const groups = new Map<string, { id: string; label: string; off: number }[]>()
  for (const id of list) {
    const [region, ...rest] = id.split('/')
    const g = rest.length ? region : 'Other'
    const off = offsetMin(id)
    const city = (rest.length ? rest.join(' / ') : id).replace(/_/g, ' ')
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push({ id, label: `(${fmtOffset(off)}) ${city}`, off })
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([g, items]) => [g, items.sort((x, y) => x.off - y.off || x.label.localeCompare(y.label))] as const)
}
const PRESETS = [
  { id: 'fitness', label: 'Health & Fitness', color: '#22c55e' },
  { id: 'medication', label: 'Medication Tracker', color: '#f59e0b' },
  { id: 'nutrition', label: 'Nutritionist', color: '#ef4444' },
  { id: 'health', label: 'Health Companion', color: '#ec4899' },
  { id: 'study', label: 'Study & Exam', color: '#8b5cf6' },
]
const TONES = [
  { id: 'friendly', label: 'Friendly', hint: 'Warm, encouraging, a little informal' },
  { id: 'neutral', label: 'Neutral', hint: 'Plain and matter-of-fact (default)' },
  { id: 'concise', label: 'Concise', hint: 'Shortest possible replies' },
  { id: 'strict', label: 'Strict', hint: 'No fluff, direct accountability language' },
]
const LABELS = [{ v: 'always', t: 'Always' }, { v: 'on_change', t: 'On change' }, { v: 'off', t: 'Off' }]
const CHANNEL_ICONS: Record<string, typeof Globe> = { telegram: MessageCircle, discord: Hash, slack: Monitor }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // index + 1 = ISO weekday stored in the DB

interface Reminder { id: string; title: string; role: string; time: string; days: number[]; channel: string | null; enabled: boolean }
const card = { background: 'var(--surface)', border: '1px solid var(--border)' }
const field = { background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }

function EmailBox({ email, onChanged, flash }: { email: string | null; onChanged: () => void; flash: (m: string) => void }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const msgs: Record<string, string> = { bad_email: 'Enter a valid email address.', email_in_use: 'This email belongs to another Vow account.', already_yours: 'This email is already on your account.', daily_limit: 'Too many requests today. Try again tomorrow.', last_login_method: 'This is your only sign-in method. Connect a channel first.' }
  const add = async () => {
    setBusy(true); const r = await api('email-add', 'POST', { email: val }); setBusy(false)
    if (r.ok) { setSent(true); flash('Confirmation link sent') } else flash(msgs[r.error ?? ''] ?? `Could not send (${r.error ?? 'error'})`)
  }
  const remove = async () => {
    if (!window.confirm('Detach this email? Admin rights tied to it will be removed.')) return
    setBusy(true); const r = await api('email', 'DELETE', {}); setBusy(false)
    if (r.ok) { flash('Email detached'); onChanged() } else flash(msgs[r.error ?? ''] ?? `Could not detach (${r.error ?? 'error'})`)
  }
  const field = { background: 'var(--bg-input, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'inherit' }
  if (email) return (
    <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <span>Email: <b style={{ color: 'inherit' }}>{email}</b></span>
      <button type="button" onClick={() => void remove()} disabled={busy} className="px-2 py-1 rounded-md cursor-pointer hover:brightness-125 disabled:opacity-50" style={field}>Detach</button>
    </div>
  )
  return (
    <div>
      <label className="text-xs block mb-1" htmlFor="em" style={{ color: 'var(--text-muted)' }}>Email (optional sign-in method)</label>
      <div className="flex gap-2">
        <input id="em" type="email" value={val} onChange={e => { setVal(e.target.value); setSent(false) }} placeholder="you@example.com" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={field} />
        <button type="button" onClick={() => void add()} disabled={busy || !val} aria-busy={busy} className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50" style={{ background: '#0E9C86', color: '#000' }}>{busy ? 'Sending…' : sent ? 'Resend link' : 'Send link'}</button>
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{sent ? 'Check your inbox and open the link within 10 minutes. The email attaches only after you confirm.' : 'We send a one-time confirmation link. Up to 5 requests per day.'}</p>
    </div>
  )
}

function MergeBox({ onChanged, flash }: { onChanged: () => void; flash: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const field = { background: 'var(--bg-input, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'inherit' }
  const msgs: Record<string, string> = { invalid_or_expired_code: 'Code is invalid or expired (valid 10 minutes, one use).', same_account: 'That code belongs to this account.' }
  const make = async () => { setBusy(true); const r = await api<{ code: string }>('merge-code', 'POST', {}); setBusy(false); if (r.ok) setCode(r.data.code); else flash('Could not create a code') }
  const merge = async () => {
    if (!window.confirm('Merge that account into this one? Its channels, reminders, roles and memory move here; its own settings are discarded. The other account is deleted. This cannot be undone.')) return
    setBusy(true); const r = await api('merge', 'POST', { code: val.trim().toUpperCase() }); setBusy(false)
    if (r.ok) { flash('Accounts merged'); setVal(''); onChanged() } else flash(msgs[r.error ?? ''] ?? `Could not merge (${r.error ?? 'error'})`)
  }
  const btn = 'px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50'
  return (
    <div className="space-y-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <p className="text-xs">Merge another Vow account into this one</p>
      <p>1. Sign in to the other account and create a code. 2. Sign in here and enter it. The account you are signed in to when you merge is the one that stays.</p>
      <div className="flex gap-2 items-center">
        <button type="button" onClick={() => void make()} disabled={busy} className={btn} style={field}>Create merge code</button>
        {code && <code className="px-2 py-1 rounded" style={field}>{code}</code>}
      </div>
      <div className="flex gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Code from the other account" aria-label="Merge code" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={field} />
        <button type="button" onClick={() => void merge()} disabled={busy || !val} aria-busy={busy} className={btn} style={{ background: '#0E9C86', color: '#000' }}>{busy ? 'Working…' : 'Merge here'}</button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, profile, roles, refresh, patchLocal, logout } = useAuth()
  const [saving, setSaving] = useState<string | null>(null) // id of the control whose save is in flight; it is locked meanwhile
  const tzGroups = useMemo(() => buildTzGroups(profile?.tz || 'UTC'), [profile?.tz])
  const [name, setName] = useState(user?.name || '')
  const [timezone, setTimezone] = useState(profile?.tz || 'UTC')
  const [status, setStatus] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loadingRem, setLoadingRem] = useState(true)
  const [draft, setDraft] = useState({ title: '', time: '08:00', channel: '' })
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { setName(profile?.display_name || ''); setTimezone(profile?.tz || 'UTC') }, [profile])
  const loadReminders = async () => { const r = await api<{ reminders: Reminder[] }>('reminders'); if (r.ok) setReminders(r.data.reminders); setLoadingRem(false) }
  useEffect(() => { void loadReminders() }, [])

  const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(''), 2500) }
  const savePrefs = async (patch: Record<string, unknown>, okMsg = 'Saved', lock?: string) => {
    if (lock) setSaving(lock)
    // optimistic: the UI reflects the choice immediately; rolled back if the server refuses
    const before = { profile: { ...profile } as Partial<typeof profile & object>, roles }
    const local: Record<string, unknown> = {}
    if ('tone' in patch) local.tone = patch.tone
    if ('defaultRole' in patch) local.default_role = patch.defaultRole
    if ('roleLabel' in patch) local.role_label = patch.roleLabel
    if ('tz' in patch) local.tz = patch.tz
    if ('displayName' in patch) local.display_name = patch.displayName
    patchLocal(local as never, Array.isArray(patch.roles) ? (patch.roles as string[]) : undefined)
    const r = await api('prefs', 'PATCH', patch)
    if (r.ok) { flash(okMsg); void refresh() } else { patchLocal(before.profile as never, before.roles); flash(`Could not save (${r.error ?? 'error'})`) }
    setSaving(null)
    return r.ok
  }

  const toggleRole = (id: string) => {
    const next = roles.includes(id) ? roles.filter(x => x !== id) : [...roles, id]
    if (next.length) void savePrefs({ roles: next }, 'Saved', `role:${id}`)
  }

  const patchReminder = async (id: string, patch: Record<string, unknown>) => {
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, ...patch } as Reminder : r))) // optimistic
    const r = await api<{ reminder: Reminder }>('reminders', 'PATCH', { id, ...patch })
    if (!r.ok) { flash(`Could not save reminder (${r.error ?? 'error'})`); await loadReminders() } else flash('Reminder saved')
  }
  const toggleDay = (r: Reminder, d: number) => {
    const days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d]
    if (days.length) void patchReminder(r.id, { days })
  }
  const addReminder = async () => {
    if (!draft.title.trim()) return
    const r = await api('reminders', 'POST', { title: draft.title, time: draft.time, days: [1, 2, 3, 4, 5, 6, 7], channel: draft.channel || null })
    if (!r.ok) { flash(r.error === 'role_not_enabled' ? 'Enable a role first' : `Could not add (${r.error ?? 'error'})`); return }
    setDraft({ title: '', time: '08:00', channel: '' }); setShowAdd(false); await loadReminders(); flash('Reminder added')
  }
  const removeReminder = async (id: string) => {
    const r = await api('reminders', 'DELETE', { id })
    if (r.ok) setReminders(prev => prev.filter(x => x.id !== id)); else flash('Could not delete')
  }
  const deleteAccount = async () => {
    const r = await api('account', 'DELETE', { confirm: 'DELETE' })
    if (r.ok) { await logout(); location.href = '/' } else flash('Could not delete the account')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
        <span role="status" className="text-xs" style={{ color: '#0E9C86' }}>{status}</span>
      </div>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-4"><User size={16} style={{ color: '#0E9C86' }} /><h2 className="text-sm font-semibold">Profile</h2></div>
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" htmlFor="dn" style={{ color: 'var(--text-muted)' }}>Display name</label>
            <input id="dn" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={field} />
          </div>
          <div>
            <label className="text-xs block mb-1" htmlFor="tz" style={{ color: 'var(--text-muted)' }}>Time zone</label>
            <select id="tz" value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={field}>
              {tzGroups.map(([g, items]) => <optgroup key={g} label={g}>{items.map(i => <option key={i.id} value={i.id} title={i.id}>{i.label}</option>)}</optgroup>)}
            </select>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Used for reminder times and quiet hours. Offsets shift with daylight saving.</p>
          <EmailBox email={profile?.email ?? null} onChanged={() => void refresh()} flash={flash} />
          <MergeBox onChanged={() => void refresh()} flash={flash} />
          <button onClick={() => void savePrefs({ displayName: name, tz: timezone }, 'Saved', 'profile')} disabled={saving !== null} aria-busy={saving === 'profile'} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110" style={{ background: '#0E9C86', color: '#000' }}>{saving === 'profile' ? 'Saving…' : 'Save changes'}</button>
        </div>
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-4"><Shield size={16} style={{ color: '#0E9C86' }} /><h2 className="text-sm font-semibold">Active Roles</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map(p => {
            const on = roles.includes(p.id)
            return (
              <button key={p.id} onClick={() => toggleRole(p.id)} aria-pressed={on} disabled={saving !== null} aria-busy={saving === `role:${p.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
                style={{ background: on ? `${p.color}15` : 'var(--recessed)', border: `1px solid ${on ? p.color : 'var(--border)'}`, color: on ? p.color : 'var(--text-sec)' }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />{p.label}
                {on && profile?.default_role === p.id && <span className="ml-auto text-[10px] opacity-70">default</span>}
              </button>
            )
          })}
        </div>
        {roles.length > 1 && (
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <label htmlFor="dr">Default role</label>
            <select id="dr" value={profile?.default_role ?? roles[0]} onChange={e => void savePrefs({ defaultRole: e.target.value }, 'Saved', 'dr')} disabled={saving !== null} className="px-2 py-1 rounded-lg outline-none cursor-pointer" style={field}>
              {roles.map(r => <option key={r} value={r}>{PRESETS.find(p => p.id === r)?.label ?? r}</option>)}
            </select>
            <label htmlFor="rl" className="ml-3">Role label</label>
            <select id="rl" value={profile?.role_label ?? 'on_change'} onChange={e => void savePrefs({ roleLabel: e.target.value }, 'Saved', 'rl')} disabled={saving !== null} className="px-2 py-1 rounded-lg outline-none cursor-pointer" style={field}>
              {LABELS.map(l => <option key={l.v} value={l.v}>{l.t}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-1"><MessageCircle size={16} style={{ color: '#0E9C86' }} /><h2 className="text-sm font-semibold">Tone</h2></div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>How the bot phrases replies, in every channel. Crisis wording and dosage safety language are never changed by tone.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TONES.map(t => (
            <button key={t.id} onClick={() => void savePrefs({ tone: t.id }, 'Saved', `tone:${t.id}`)} disabled={saving !== null} aria-busy={saving === `tone:${t.id}`} aria-pressed={profile?.tone === t.id} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
              style={{ background: profile?.tone === t.id ? '#0E9C8615' : 'var(--recessed)', border: `1px solid ${profile?.tone === t.id ? '#0E9C86' : 'var(--border)'}`, color: profile?.tone === t.id ? '#0E9C86' : 'var(--text-sec)' }}>
              <span className="font-medium">{t.label}</span><span className="text-[10px] opacity-70">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Bell size={16} style={{ color: '#0E9C86' }} /><h2 className="text-sm font-semibold">Reminders</h2></div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:brightness-110" style={{ background: '#0E9C86', color: '#000' }}><Plus size={12} /> Add</button>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>Times are in your timezone. Channel “auto” lets Vow pick where you are reachable; a fixed channel is tried first, then Vow escalates to the others.</p>
        {loadingRem ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p> : reminders.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No reminders yet.</p>}
        <div className="space-y-2">
          {reminders.map(r => {
            const ChIcon = (r.channel && CHANNEL_ICONS[r.channel]) || Globe
            return (
              <div key={r.id} className="p-3 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid var(--border)', opacity: r.enabled ? 1 : 0.55 }}>
                <div className="flex items-center gap-3 mb-2">
                  <input defaultValue={r.title} aria-label="Reminder name" onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.title) void patchReminder(r.id, { title: v }) }}
                    className="text-sm font-medium flex-1 min-w-0 bg-transparent outline-none border-b border-transparent focus:border-[#0E9C86]" />
                  <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><Clock size={10} />
                    <input type="time" value={r.time} aria-label="Time" onChange={e => e.target.value && void patchReminder(r.id, { time: e.target.value })} className="bg-transparent outline-none text-[11px]" /></label>
                  <label className="flex items-center gap-1 text-[10px]" style={{ color: '#0E9C86' }}><ChIcon size={10} />
                    <select value={r.channel ?? ''} aria-label="Channel" onChange={e => void patchReminder(r.id, { channel: e.target.value || null })} className="bg-transparent outline-none text-[11px] cursor-pointer">
                      <option value="">auto</option><option value="telegram">telegram</option><option value="slack">slack</option><option value="discord">discord</option>
                    </select></label>
                  <button onClick={() => void patchReminder(r.id, { enabled: !r.enabled })} aria-pressed={r.enabled} className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{r.enabled ? 'on' : 'off'}</button>
                  <button onClick={() => void removeReminder(r.id)} aria-label="Delete reminder" className="p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button>
                </div>
                <div className="flex gap-1">
                  {DAYS.map((d, i) => (
                    <button key={d} type="button" onClick={() => toggleDay(r, i + 1)} aria-pressed={r.days.includes(i + 1)} className="px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                      style={{ background: r.days.includes(i + 1) ? '#0E9C8620' : 'transparent', color: r.days.includes(i + 1) ? '#0E9C86' : 'var(--text-muted)', border: `1px solid ${r.days.includes(i + 1) ? '#0E9C8633' : 'var(--border)'}` }}>{d}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {showAdd && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid #0E9C8633' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="What should I remind you about?" aria-label="New reminder name" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ ...field, background: 'var(--surface)' }} />
              <input type="time" value={draft.time} onChange={e => setDraft(p => ({ ...p, time: e.target.value }))} aria-label="New reminder time" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ ...field, background: 'var(--surface)' }} />
              <select value={draft.channel} onChange={e => setDraft(p => ({ ...p, channel: e.target.value }))} aria-label="New reminder channel" className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ ...field, background: 'var(--surface)' }}>
                <option value="">Auto (best channel)</option><option value="telegram">Telegram</option><option value="slack">Slack</option><option value="discord">Discord</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={addReminder} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110" style={{ background: '#0E9C86', color: '#000' }}>Add reminder</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-4"><Key size={16} style={{ color: '#0E9C86' }} /><h2 className="text-sm font-semibold">Memory</h2></div>
        <div className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
          <div className="flex justify-between"><span>Storage</span><span className="font-mono">Walrus (MemWal, mainnet)</span></div>
          <div className="flex justify-between"><span>Namespace</span><span className="font-mono">vow:mem:{user?.id.slice(0, 8)}…</span></div>
          <p>Every channel writes to the same namespace: one memory, one assistant. See the proof of each write on the History page.</p>
        </div>
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-4"><Key size={16} /><h2 className="text-sm font-semibold">AI agents</h2></div>
        <AgentTokens />
      </section>

      <section className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-4"><AlertTriangle size={16} style={{ color: '#ef4444' }} /><h2 className="text-sm font-semibold">Danger zone</h2></div>
        <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>Deletes your account, linked channels, reminders and chat history from Vow and signs you out. Encrypted blobs already written to Walrus are immutable and stay on the network, but Vow forgets the keys to your namespace.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444433' }}>Delete my account</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={deleteAccount} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110" style={{ background: '#ef4444', color: '#fff' }}>Confirm delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-lg text-xs cursor-pointer hover:bg-white/5" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  )
}
