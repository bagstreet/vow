import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Tok { id: string; label: string; roles: string[]; created_at: string; last_used_at: string | null; revoked_at: string | null }
const ROLE_IDS = ['fitness', 'medication', 'nutrition', 'health', 'study']

export default function AgentTokens() {
  const [toks, setToks] = useState<Tok[]>([]); const [label, setLabel] = useState(''); const [roles, setRoles] = useState<string[]>([])
  const [busy, setBusy] = useState(false); const [secret, setSecret] = useState<string | null>(null); const [msg, setMsg] = useState('')
  const load = () => api<{ tokens: Tok[] }>('agent-tokens').then(r => { if (r.ok) setToks(r.data.tokens) })
  useEffect(() => { void load() }, [])
  const create = async () => {
    if (busy) return; setBusy(true); setMsg('')
    const r = await api<{ token: string }>('agent-tokens', 'POST', { label, roles })
    if (r.ok) { setSecret(r.data.token); setLabel(''); setRoles([]); await load() } else setMsg(`Could not create token (${r.error ?? 'error'})`)
    setBusy(false)
  }
  const revoke = async (id: string) => { if (busy) return; setBusy(true); await api('agent-tokens', 'DELETE', { id }); await load(); setBusy(false) }
  const live = toks.filter(t => !t.revoked_at)
  return (
    <div className="space-y-3">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Let an external AI agent (or an MCP client) write <b>verified</b> facts to your memory, only for the roles you tick. It can read back only those roles. Revoke any time.</p>
      {secret && <div className="p-3 rounded-lg text-[11px] break-all font-mono" role="status" style={{ border: '1px solid #0E9C86' }}>Copy now, shown once: {secret}<button className="ml-2 underline cursor-pointer" onClick={() => setSecret(null)}>done</button></div>}
      {live.map(t => (
        <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <span><b>{t.label}</b> · {t.roles.join(', ')} · {t.last_used_at ? `used ${new Date(t.last_used_at).toLocaleDateString()}` : 'never used'}</span>
          <button onClick={() => revoke(t.id)} disabled={busy} className="px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 hover:opacity-80" style={{ border: '1px solid #ef444433', color: '#ef4444' }}>Revoke</button>
        </div>))}
      <div className="flex flex-wrap items-center gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} maxLength={40} placeholder="Agent name" aria-label="Agent name" className="px-2 py-1 rounded text-xs bg-transparent" style={{ border: '1px solid var(--border)' }} />
        {ROLE_IDS.map(r => <button key={r} type="button" aria-pressed={roles.includes(r)} onClick={() => setRoles(x => x.includes(r) ? x.filter(y => y !== r) : [...x, r])} className="px-2 py-0.5 rounded-full text-[11px] cursor-pointer" style={{ border: '1px solid var(--border)', background: roles.includes(r) ? '#0E9C8626' : 'transparent' }}>{r}</button>)}
        <button onClick={create} disabled={busy || !label.trim() || !roles.length} className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 hover:opacity-90" style={{ background: '#0E9C86', color: '#fff' }}>{busy ? 'Working…' : 'Create token'}</button>
      </div>
      {msg && <p className="text-[11px]" style={{ color: '#ef4444' }}>{msg}</p>}
    </div>
  )
}
