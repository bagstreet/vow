import { useEffect, useState } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'

interface Mem { id: string; channel: string; kind: string; preview: string; job_id: string | null; blob_id: string | null; created_at: string }
interface Msg { channel: string; direction: 'in' | 'out'; role: string | null; content: string; created_at: string }
const SCAN = 'https://walruscan.com/mainnet/blob/'

export default function HistoryPage() {
  const [mem, setMem] = useState<Mem[]>([]); const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true); const [channel, setChannel] = useState('all')
  useEffect(() => { api<{ memory: Mem[]; messages: Msg[] }>('history').then(r => { if (r.ok) { setMem(r.data.memory); setMsgs(r.data.messages) } setLoading(false) }) }, [])
  const channels = ['all', ...new Set(mem.map(m => m.channel))]
  const shown = mem.filter(m => channel === 'all' || m.channel === channel)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div><h1 className="text-xl font-bold">History</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{loading ? 'Loading…' : `${mem.length} memory writes · ${msgs.length} recent messages. Memory writes go to Walrus; the blob id appears once the network confirms the upload.`}</p></div>
      <div className="flex gap-1.5">{channels.map(c => <button key={c} onClick={() => setChannel(c)} aria-pressed={channel === c} className="px-2.5 py-1 rounded-full text-[11px] cursor-pointer" style={{ border: '1px solid var(--border)', background: channel === c ? '#0E9C8626' : 'transparent', color: channel === c ? '#0E9C86' : 'var(--text-muted)' }}>{c}</button>)}</div>
      {!loading && shown.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing here yet. Chat with Vow in any channel and the memory writes show up here.</p>}
      <div className="space-y-2">
        {shown.map(m => (
          <div key={m.id} className="p-3 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
              <Clock size={10} />{new Date(m.created_at).toLocaleString()}<span className="px-1.5 rounded" style={{ border: '1px solid var(--border)' }}>{m.channel}</span><span>{m.kind}</span>
            </div>
            <div className="text-sm">{m.preview}</div>
            <div className="mt-1.5 text-[10px] font-mono" style={{ color: '#0E9C86' }}>
              {m.blob_id ? <a href={SCAN + encodeURIComponent(m.blob_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ">blob {m.blob_id.slice(0, 14)}… <ExternalLink size={10} /> Walruscan</a>
                : m.job_id ? <span>job {m.job_id.slice(0, 12)}… (writing to Walrus)</span> : <span style={{ color: 'var(--text-muted)' }}>not stored (memory unavailable)</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
