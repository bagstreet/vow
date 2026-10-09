import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Guardian { id: string; status: 'pending' | 'active'; name: string | null; code?: string; expiresAt?: string; missedCheckins: number; silenceHours: number }
interface Watching { id: string; name: string; missedCheckins: number; silenceHours: number }
interface Notice { id: string; text: string; created_at: string }
interface Overview { guardians: Guardian[]; watching: Watching[]; notices: Notice[] }

const ERR: Record<string, string> = {
  invalid_or_expired_code: 'This code is invalid or has expired. Ask for a new one.', self_link: 'You cannot be your own trusted contact.',
  already_linked: 'You already watch this person.', watch_limit: 'You watch the maximum number of accounts (10).', guardian_limit: 'You have the maximum number of trusted contacts (3).',
}
const card = { background: 'var(--surface)', border: '1px solid var(--border)' }
const btn = 'px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 active:scale-[0.98]'

export default function TrustedPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [msg, setMsg] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await api<Overview>('guardian-list'); if (r.ok) setData(r.data) }, [])
  useEffect(() => { void load() }, [load])
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok = '') => {
    setBusy(true); setMsg(''); const r = await fn(); setBusy(false)
    setMsg(r.ok ? ok : ERR[r.error ?? ''] ?? 'Something went wrong. Try again.'); if (r.ok) void load()
  }
  const rules = (g: Watching, patch: Partial<{ missedCheckins: number; silenceHours: number }>) => run(() => api('guardian-rules', 'PATCH', { id: g.id, ...patch }), 'Rules updated.')
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Trusted contact</h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Name another Vow user who is told if you go quiet. They see only that check-ins were missed, never your messages or memory. Vow is not an emergency service.</p>
      {msg && <p role="status" className="text-xs" style={{ color: 'var(--text-sec)' }}>{msg}</p>}

      <section className="p-5 rounded-xl space-y-3" style={card}>
        <h2 className="text-sm font-semibold">Your trusted contacts</h2>
        {data?.guardians.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None yet.</p>}
        {data?.guardians.map(g => (
          <div key={g.id} className="flex items-center justify-between gap-3 text-xs">
            <div>{g.status === 'active' ? <b>{g.name ?? 'Vow user'}</b> : <>Waiting for acceptance. Share code <b className="font-mono">{g.code}</b> (valid 10 minutes)</>}
              {g.status === 'active' && <span style={{ color: 'var(--text-muted)' }}> · alerts after {g.missedCheckins} missed check-ins or {g.silenceHours} h silence</span>}</div>
            <button disabled={busy} onClick={() => void run(() => api('guardian-revoke', 'DELETE', { id: g.id }), g.status === 'active' ? 'Trusted contact removed.' : 'Invite cancelled.')} className={btn} style={{ border: '1px solid var(--border)' }}>{g.status === 'active' ? 'Remove' : 'Cancel'}</button>
          </div>))}
        <button disabled={busy} onClick={() => void run(() => api('guardian-invite', 'POST', {}), 'Invite created. Send the code to your contact; they enter it on this page.')} className={btn} style={{ background: '#0E9C86', color: '#000' }}>Invite a trusted contact</button>
      </section>

      <section className="p-5 rounded-xl space-y-3" style={card}>
        <h2 className="text-sm font-semibold">People you watch</h2>
        {data?.watching.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nobody. Enter an invite code below to accept.</p>}
        {data?.watching.map(w => (
          <div key={w.id} className="flex flex-wrap items-center gap-3 text-xs">
            <b className="mr-auto">{w.name}</b>
            <label>Missed check-ins <input type="number" min={1} max={10} defaultValue={w.missedCheckins} disabled={busy} onBlur={e => Number(e.target.value) !== w.missedCheckins && void rules(w, { missedCheckins: Number(e.target.value) })} className="w-14 ml-1 px-2 py-1 rounded bg-transparent" style={{ border: '1px solid var(--border)' }} /></label>
            <label>Silence, h <input type="number" min={1} max={720} defaultValue={w.silenceHours} disabled={busy} onBlur={e => Number(e.target.value) !== w.silenceHours && void rules(w, { silenceHours: Number(e.target.value) })} className="w-16 ml-1 px-2 py-1 rounded bg-transparent" style={{ border: '1px solid var(--border)' }} /></label>
            <button disabled={busy} onClick={() => void run(() => api('guardian-revoke', 'DELETE', { id: w.id }), 'You stopped watching this person.')} className={btn} style={{ border: '1px solid var(--border)' }}>Stop watching</button>
          </div>))}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(() => api('guardian-accept', 'POST', { code }), 'You are now a trusted contact.').then(() => setCode('')) }}>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Invite code" maxLength={12} aria-label="Invite code" className="flex-1 px-3 py-2 rounded-lg text-xs font-mono bg-transparent" style={{ border: '1px solid var(--border)' }} />
          <button disabled={busy || !code.trim()} className={btn} style={{ background: '#0E9C86', color: '#000' }}>Accept invite</button>
        </form>
      </section>

      {!!data?.notices.length && <section className="p-5 rounded-xl space-y-2" style={card}>
        <h2 className="text-sm font-semibold">Recent notices</h2>
        {data.notices.map(n => <p key={n.id} className="text-xs" style={{ color: 'var(--text-sec)' }}>{new Date(n.created_at).toLocaleString()} · {n.text}</p>)}
      </section>}
    </div>
  )
}
