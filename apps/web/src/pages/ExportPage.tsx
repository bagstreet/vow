import { useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../lib/api'

function save(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a')
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function ExportPage() {
  const [err, setErr] = useState('')
  const run = async (kind: 'json' | 'csv') => {
    setErr('')
    const r = await api<{ exportedAt: string; data: { memory: Record<string, unknown>[] } }>('export')
    if (!r.ok) { setErr('Export failed. Try again.'); return }
    const stamp = Date.now()
    if (kind === 'json') save(`vow-export-${stamp}.json`, 'application/json', JSON.stringify(r.data, null, 2))
    else {
      const rows = [['created_at', 'channel', 'kind', 'text', 'walrus_job', 'walrus_blob'], ...r.data.data.memory.map(m => [m.created_at, m.channel, m.kind, m.preview, m.job_id, m.blob_id])]
      save(`vow-memory-${stamp}.csv`, 'text/csv', rows.map(x => x.map(csvCell).join(',')).join('\n'))
    }
  }
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Export</h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your data is yours. JSON has everything: profile, channels, roles, reminders, chat history and memory writes. CSV has the memory log with Walrus ids.</p>
      <section className="p-5 rounded-xl flex gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button onClick={() => void run('json')} className="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110" style={{ background: '#0E9C86', color: '#000' }}><Download size={12} className="inline mr-1.5" />Export JSON</button>
        <button onClick={() => void run('csv')} className="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5" style={{ border: '1px solid var(--border)', color: 'var(--text-sec)' }}><Download size={12} className="inline mr-1.5" />Export CSV</button>
      </section>
      {err && <p role="alert" className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}
    </div>
  )
}
