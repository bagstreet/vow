import { useState } from 'react'
import { Bell, Shield, Key, User, Smartphone, Plus, Trash2, MessageCircle, Hash, Monitor, Globe, Clock, AlertTriangle } from 'lucide-react'
import { useAuth } from '../lib/auth'

const TIMEZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [Intl.DateTimeFormat().resolvedOptions().timeZone]

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

const CHANNEL_ICONS: Record<string, typeof Globe> = {
  telegram: MessageCircle,
  discord: Hash,
  slack: Monitor,
  web: Globe,
}

interface Reminder {
  id: string
  label: string
  time: string
  days: string[]
  channel: string
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [saved, setSaved] = useState(false)
  const [timezone, setTimezone] = useState(() => localStorage.getItem('vow.timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMyData = () => {
    // Clears every local mock-state key this dashboard writes (T51 will replace with a real account-delete API call).
    Object.keys(localStorage).filter(k => k.startsWith('vow.') || k === 'vow_user').forEach(k => localStorage.removeItem(k))
    logout()
  }

  // Linked accounts (multi-channel identity)
  const [linkedAccounts, setLinkedAccounts] = useState<{ provider: string; username: string; linked: boolean }[]>([
    { provider: 'telegram', username: user?.provider === 'telegram' ? user.name : '', linked: user?.provider === 'telegram' },
    { provider: 'discord', username: user?.provider === 'discord' ? user.name : '', linked: user?.provider === 'discord' },
    { provider: 'slack', username: user?.provider === 'slack' ? user.name : '', linked: user?.provider === 'slack' },
    { provider: 'web', username: user?.provider === 'web' ? user.name : '', linked: user?.provider === 'web' },
  ])

  // Individual reminders (per-medication, per-supplement, etc.)
  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', label: 'Vitamin D', time: '08:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], channel: 'telegram' },
    { id: '2', label: 'Omega-3', time: '08:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], channel: 'telegram' },
    { id: '3', label: 'Magnesium', time: '20:00', days: ['Mon','Wed','Fri'], channel: 'slack' },
  ])

  const updateReminder = (id: string, patch: Partial<Reminder>) =>
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const toggleDay = (id: string, d: string) =>
    setReminders(prev => prev.map(r => {
      if (r.id !== id) return r
      const days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d]
      return days.length ? { ...r, days } : r // keep at least one day
    }))

  // Active roles: several can be on at once (min 1); first one stays the legacy single `preset`.
  const [activeRoles, setActiveRoles] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('vow.activeRoles') || 'null')
      if (Array.isArray(v) && v.length) return v.filter((x: string) => PRESETS.some(p => p.id === x))
    } catch { /* ignore */ }
    return [user?.preset || 'fitness']
  })
  const toggleRole = (id: string) => {
    const next = activeRoles.includes(id) ? activeRoles.filter(x => x !== id) : [...activeRoles, id]
    if (!next.length) return
    setActiveRoles(next)
    try { localStorage.setItem('vow.activeRoles', JSON.stringify(next)) } catch { /* ignore */ }
    updateUser({ preset: next[0] })
  }

  const [showAddReminder, setShowAddReminder] = useState(false)
  const [newReminder, setNewReminder] = useState({ label: '', time: '08:00', channel: 'telegram' })

  // Tone: a prompt modifier only — never overrides role scope or safety text (DASHBOARD_UX_AUDIT §A5).
  const [tone, setTone] = useState(() => localStorage.getItem('vow.tone') || 'neutral')
  const setToneAndSave = (id: string) => {
    setTone(id)
    try { localStorage.setItem('vow.tone', id) } catch { /* ignore */ }
  }

  const addReminder = () => {
    if (!newReminder.label.trim()) return
    setReminders(prev => [...prev, {
      id: Date.now().toString(),
      label: newReminder.label,
      time: newReminder.time,
      days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      channel: newReminder.channel,
    }])
    setNewReminder({ label: '', time: '08:00', channel: 'telegram' })
    setShowAddReminder(false)
  }

  const removeReminder = (id: string) => setReminders(prev => prev.filter(r => r.id !== id))

  const toggleLink = (provider: string) => {
    setLinkedAccounts(prev => prev.map(a =>
      a.provider === provider ? { ...a, linked: !a.linked, username: a.linked ? '' : `${user?.name || 'User'}` } : a
    ))
  }

  const save = () => {
    updateUser({ name })
    try { localStorage.setItem('vow.timezone', timezone) } catch { /* ignore */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const allDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Profile */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <User size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Display name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Timezone (used for reminder times)</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {TIMEZONES.map((tz: string) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <button onClick={save} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:brightness-110"
            style={{ background: '#0E9C86', color: '#000' }}>
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Account — identities + destructive actions */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <h2 className="text-sm font-semibold">Danger zone</h2>
        </div>
        <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Deletes everything this preview dashboard stores locally (profile, linked channels, reminders, roles) and signs you out. Does not affect data already delivered to Telegram/Slack/Discord bots.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444433' }}>
            Delete my data
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={deleteMyData}
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110"
              style={{ background: '#ef4444', color: '#fff' }}>
              Confirm delete
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 rounded-lg text-xs cursor-pointer hover:bg-white/5"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Linked Accounts — cross-channel identity */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Smartphone size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Linked Accounts</h2>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Link all your channels so the bot can find you wherever you are online. It checks presence in order: Telegram, Slack, Discord, then Web push.
        </p>
        <div className="space-y-2">
          {linkedAccounts.map(a => {
            const Icon = CHANNEL_ICONS[a.provider] || Globe
            return (
              <div key={a.provider} className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: 'var(--recessed)', border: '1px solid var(--border)' }}>
                <Icon size={16} style={{ color: a.linked ? '#0E9C86' : 'var(--text-muted)' }} />
                <span className="text-sm flex-1 capitalize">{a.provider}</span>
                {a.linked && <span className="text-[10px] font-mono" style={{ color: '#0E9C86' }}>{a.username}</span>}
                <button onClick={() => toggleLink(a.provider)}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  style={{
                    background: a.linked ? '#ef444415' : '#0E9C8615',
                    color: a.linked ? '#ef4444' : '#0E9C86',
                    border: `1px solid ${a.linked ? '#ef444433' : '#0E9C8633'}`,
                  }}>
                  {a.linked ? 'Unlink' : 'Link'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Active preset */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Active Roles</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => toggleRole(p.id)} aria-pressed={activeRoles.includes(p.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
              style={{
                background: activeRoles.includes(p.id) ? `${p.color}15` : 'var(--recessed)',
                border: `1px solid ${activeRoles.includes(p.id) ? p.color : 'var(--border)'}`,
                color: activeRoles.includes(p.id) ? p.color : 'var(--text-sec)',
              }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tone — prompt modifier, never overrides role scope/safety text */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Tone</h2>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
          How the bot phrases replies. Crisis wording and dosage safety language are never changed by tone.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TONES.map(t => (
            <button key={t.id} onClick={() => setToneAndSave(t.id)} aria-pressed={tone === t.id}
              className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
              style={{
                background: tone === t.id ? '#0E9C8615' : 'var(--recessed)',
                border: `1px solid ${tone === t.id ? '#0E9C86' : 'var(--border)'}`,
                color: tone === t.id ? '#0E9C86' : 'var(--text-sec)',
              }}>
              <span className="font-medium">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Individual Reminders — per-medication/supplement scheduling */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: '#0E9C86' }} />
            <h2 className="text-sm font-semibold">Individual Reminders</h2>
          </div>
          <button onClick={() => setShowAddReminder(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:brightness-110"
            style={{ background: '#0E9C86', color: '#000' }}>
            <Plus size={12} /> Add
          </button>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Set per-item reminders (supplements, meds, habits). Each sends to its chosen channel at the scheduled time.
        </p>

        <div className="space-y-2">
          {reminders.map(r => {
            const ChIcon = CHANNEL_ICONS[r.channel] || Globe
            return (
              <div key={r.id} className="p-3 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <input value={r.label} onChange={e => updateReminder(r.id, { label: e.target.value })} aria-label="Reminder name"
                    className="text-sm font-medium flex-1 min-w-0 bg-transparent outline-none border-b border-transparent focus:border-[#0E9C86]" />
                  <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10} />
                    <input type="time" value={r.time} onChange={e => updateReminder(r.id, { time: e.target.value })} aria-label="Time"
                      className="bg-transparent outline-none text-[11px]" />
                  </label>
                  <label className="flex items-center gap-1 text-[10px]" style={{ color: '#0E9C86' }}>
                    <ChIcon size={10} />
                    <select value={r.channel} onChange={e => updateReminder(r.id, { channel: e.target.value })} aria-label="Channel"
                      className="bg-transparent outline-none text-[11px] cursor-pointer">
                      <option value="telegram">telegram</option><option value="slack">slack</option>
                      <option value="discord">discord</option><option value="web">web</option>
                    </select>
                  </label>
                  <button onClick={() => removeReminder(r.id)} className="p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex gap-1">
                  {allDays.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(r.id, d)} aria-pressed={r.days.includes(d)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                      style={{
                        background: r.days.includes(d) ? '#0E9C8620' : 'transparent',
                        color: r.days.includes(d) ? '#0E9C86' : 'var(--text-muted)',
                        border: `1px solid ${r.days.includes(d) ? '#0E9C8633' : 'var(--border)'}`,
                      }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add reminder form */}
        {showAddReminder && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--recessed)', border: '1px solid #0E9C8633' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <input value={newReminder.label} onChange={e => setNewReminder(p => ({ ...p, label: e.target.value }))}
                placeholder="Supplement name..."
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              <input type="time" value={newReminder.time} onChange={e => setNewReminder(p => ({ ...p, time: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              <select value={newReminder.channel} onChange={e => setNewReminder(p => ({ ...p, channel: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <option value="telegram">Telegram</option>
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
                <option value="web">Web push</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={addReminder} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110"
                style={{ background: '#0E9C86', color: '#000' }}>Add reminder</button>
              <button onClick={() => setShowAddReminder(false)} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Security / Keys */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Delegate Keys</h2>
        </div>
        <div className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
          <div className="flex justify-between"><span>Owner key</span><span className="font-mono">0x...{user?.id.slice(-6) || 'none'}</span></div>
          <div className="flex justify-between"><span>Delegate key</span><span className="font-mono text-[#22c55e]">active</span></div>
          <div className="flex justify-between"><span>Namespace</span><span className="font-mono">{user?.name.toLowerCase().replace(/\s/g, '-') || 'default'}</span></div>
        </div>
        <button className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <Shield size={12} className="inline mr-1" /> Rotate delegate key
        </button>
      </section>
    </div>
  )
}
