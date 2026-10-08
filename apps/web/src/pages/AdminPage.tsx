import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

interface U { id: string; display_name: string | null; email: string | null; created_at: string; blocked: boolean; channels: string[]; blobs: number; messages: number }
interface S { memory_write_mode: 'instant' | 'digest'; digest_hours: number }

// Admin = a normal user plus this page. Admins come from server env (ADMIN_USER_IDS / ADMIN_EMAILS), never from the UI.
export default function AdminPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<U[]>([]); const [s, setS] = useState<S | null>(null)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const load = async () => {
    const [u, st] = await Promise.all([api<{ users: U[] }>('admin-users'), api<{ settings: S }>('admin-settings')])
    if (u.ok) setUsers(u.data.users); if (st.ok) setS(st.data.settings)
  }
  useEffect(() => { void load() }, [])
  if (!profile?.isAdmin) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Admins only.</div>
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (busy) return; setBusy(true); setMsg('')
    const r = await fn(); setMsg(r.ok ? done : `Failed (${r.error ?? 'error'})`); await load(); setBusy(false)
  }
  const save = (patch: Partial<S>) => run(() => api('admin-settings', 'PATCH', patch), 'Saved.')
  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold">Admin</h1>
      <section className="space-y-2" aria-label="Memory writes">
        <h2 className="text-sm font-medium">Memory write mode</h2>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}><b>instant</b>: every durable fact becomes its own Walrus blob. <b>digest</b>: facts are buffered and written as one blob per user every N hours (or on “flush now”). Fewer blobs, less noise.</p>
        {s && <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={s.memory_write_mode} disabled={busy} onChange={e => void save({ memory_write_mode: e.target.value as S['memory_write_mode'] })} aria-label="Memory write mode" className="px-2 py-1 rounded bg-transparent disabled:opacity-50" style={{ border: '1px solid var(--border)' }}>
            <option value="instant">instant</option><option value="digest">digest</option></select>
          <label className="flex items-center gap-1">every <input type="number" min={1} max={168} defaultValue={s.digest_hours} key={s.digest_hours} disabled={busy || s.memory_write_mode !== 'digest'}
            onBlur={e => { const n = Number(e.target.value); if (n !== s.digest_hours) void save({ digest_hours: n }) }} aria-label="Digest hours" className="w-16 px-2 py-1 rounded bg-transparent disabled:opacity-50" style={{ border: '1px solid var(--border)' }} /> h</label>
          <button disabled={busy} onClick={() => void run(() => api('admin-flush', 'POST', {}), 'Buffers flushed.')} className="px-2 py-1 rounded cursor-pointer disabled:opacity-50 hover:opacity-80" style={{ border: '1px solid var(--border)' }}>Flush now</button>
        </div>}
      </section>
      <section className="space-y-2" aria-label="Users">
        <h2 className="text-sm font-medium">Users ({users.length})</h2>
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg" style={{ border: '1px solid var(--border)', opacity: u.blocked ? 0.6 : 1 }}>
            <span className="min-w-0 truncate"><b>{u.display_name || u.email || u.id.slice(0, 8)}</b>{u.email ? ` · ${u.email}` : ''} · joined {String(u.created_at).slice(0, 10)} · {u.channels.join(', ') || 'no channels'} · {u.messages} msgs · {u.blobs} blobs{u.blocked ? ' · BLOCKED' : ''}</span>
            {u.id !== profile.id && <button disabled={busy} onClick={() => void run(() => api('admin-block', 'POST', { id: u.id, blocked: !u.blocked }), u.blocked ? 'Unblocked.' : 'Blocked.')}
              className="px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 hover:opacity-80" style={{ border: '1px solid var(--border)' }}>{u.blocked ? 'Unblock' : 'Block'}</button>}
          </div>))}
      </section>
      {msg && <p role="status" className="text-xs" style={{ color: msg.startsWith('Failed') ? '#ef4444' : 'var(--text-muted)' }}>{msg}</p>}
    </div>
  )
}
