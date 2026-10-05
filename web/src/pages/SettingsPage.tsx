import { useState } from 'react'
import { Bell, Shield, Key, User, Smartphone } from 'lucide-react'
import { useAuth } from '../lib/auth'

const PRESETS = [
  { id: 'habits', label: 'Health & Fitness', color: '#22c55e' },
  { id: 'medication', label: 'Medication Tracker', color: '#f59e0b' },
  { id: 'sobriety', label: 'Sobriety', color: '#ef4444' },
  { id: 'health', label: 'Health Companion', color: '#ec4899' },
  { id: 'learning', label: 'Study & Exam', color: '#8b5cf6' },
]

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [saved, setSaved] = useState(false)

  const save = () => {
    updateUser({ name })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Provider</label>
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--recessed)', color: 'var(--text-muted)' }}>
              {user?.provider || 'Not connected'}
            </div>
          </div>
          <button onClick={save} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:brightness-110"
            style={{ background: '#0E9C86', color: '#000' }}>
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Active preset */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Active Preset</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => updateUser({ preset: p.id })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
              style={{
                background: user?.preset === p.id ? `${p.color}15` : 'var(--recessed)',
                border: `1px solid ${user?.preset === p.id ? p.color : 'var(--border)'}`,
                color: user?.preset === p.id ? p.color : 'var(--text-sec)',
              }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>
        <div className="space-y-3">
          {['Morning reminder (8:00 AM)', 'Evening reminder (8:00 PM)', 'Streak milestone alerts', 'Missed check-in nudge'].map((label, i) => (
            <label key={i} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm" style={{ color: 'var(--text-sec)' }}>{label}</span>
              <input type="checkbox" defaultChecked={i < 2} className="w-4 h-4 accent-[#0E9C86] cursor-pointer" />
            </label>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Delegate Keys</h2>
        </div>
        <div className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
          <div className="flex justify-between">
            <span>Owner key</span>
            <span className="font-mono">0x...{user?.id.slice(-6) || 'none'}</span>
          </div>
          <div className="flex justify-between">
            <span>Delegate key</span>
            <span className="font-mono text-[#22c55e]">active</span>
          </div>
          <div className="flex justify-between">
            <span>Namespace</span>
            <span className="font-mono">{user?.name.toLowerCase().replace(/\s/g, '-') || 'default'}</span>
          </div>
        </div>
        <button className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <Shield size={12} className="inline mr-1" /> Rotate delegate key
        </button>
      </section>
    </div>
  )
}
