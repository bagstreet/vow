import { useState, useMemo } from 'react'
import { FileCheck, ExternalLink, Shield, AlertTriangle, ChevronLeft, ChevronRight, Search, Calendar, Clock } from 'lucide-react'

interface BlobEntry {
  id: string
  blobId: string
  text: string
  type: 'checkin' | 'correction' | 'seal'
  preset: string
  timestamp: string
  verified: boolean
  chainPos: number
  expiresAt: string  // blob retention expiration
  sizeBytes: number
}

// Mock data — will be replaced with real Walrus blob reads
const MOCK_HISTORY: BlobEntry[] = Array.from({ length: 35 }, (_, i) => {
  const presets = ['fitness', 'medication', 'study', 'health', 'nutrition']
  const texts = [
    '5km run completed', 'Vitamin D + Omega-3 taken', 'React hooks study - 2h',
    'Correction: 5km > 3km (knee pain)', 'Day 28 - cycle log (encrypted)',
    'Morning vitamins taken', 'Sober today - day 47', 'Evening jog 3km',
    'Magnesium + B12 taken', 'Exam prep session 1.5h',
  ]
  const d = new Date(2026, 9, 5)
  d.setHours(d.getHours() - i * 6)
  const exp = new Date(d)
  exp.setDate(exp.getDate() + 42) // ~6 weeks retention
  return {
    id: String(i),
    blobId: `vow_0x${(0x3c91a7b2 + i * 0x1111).toString(16).slice(0, 8)}`,
    text: texts[i % texts.length],
    type: i === 3 ? 'correction' : i === 6 ? 'seal' : 'checkin',
    preset: presets[i % presets.length],
    timestamp: d.toISOString(),
    verified: i !== 6,
    chainPos: 35 - i,
    expiresAt: exp.toISOString(),
    sizeBytes: 256 + Math.floor(Math.random() * 512),
  }
})

const TYPE_COLORS: Record<string, string> = { checkin: '#22c55e', correction: '#f59e0b', seal: '#ef4444' }
const PAGE_SIZE = 10

export default function HistoryPage() {
  const [filterPreset, setFilterPreset] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const presets = [...new Set(MOCK_HISTORY.map(e => e.preset))]

  const filtered = useMemo(() => {
    let r = MOCK_HISTORY
    if (filterPreset !== 'all') r = r.filter(e => e.preset === filterPreset)
    if (filterType !== 'all') r = r.filter(e => e.type === filterType)
    if (search) r = r.filter(e => e.text.toLowerCase().includes(search.toLowerCase()) || e.blobId.includes(search))
    if (dateFrom) r = r.filter(e => e.timestamp >= dateFrom)
    if (dateTo) r = r.filter(e => e.timestamp <= dateTo + 'T23:59:59Z')
    return r
  }, [filterPreset, filterType, search, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const daysUntilExpiry = (exp: string) => {
    const d = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)
    return d
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Blob History</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} of {MOCK_HISTORY.length} entries. All sealed on Walrus.
          </p>
        </div>
      </div>

      {/* Extended filters */}
      <div className="p-3 rounded-xl mb-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search entries or blob IDs..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>
        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <select value={filterPreset} onChange={e => { setFilterPreset(e.target.value); setPage(0) }}
            className="px-3 py-1.5 rounded-lg text-xs cursor-pointer outline-none"
            style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <option value="all">All presets</option>
            {presets.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }}
            className="px-3 py-1.5 rounded-lg text-xs cursor-pointer outline-none"
            style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <option value="all">All types</option>
            <option value="checkin">Check-in</option>
            <option value="correction">Correction</option>
            <option value="seal">Seal/Tamper</option>
          </select>
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Calendar size={12} />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="px-2 py-1 rounded text-xs outline-none"
              style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }} />
            <span>to</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="px-2 py-1 rounded text-xs outline-none"
              style={{ background: 'var(--recessed)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />
        <div className="space-y-3">
          {pageItems.map(entry => {
            const expDays = daysUntilExpiry(entry.expiresAt)
            return (
              <div key={entry.id} className="relative pl-10">
                <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full border-2"
                  style={{ background: 'var(--bg)', borderColor: TYPE_COLORS[entry.type] || '#0E9C86' }} />
                <div className="p-4 rounded-xl transition-colors hover:brightness-105"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
                          style={{ background: `${TYPE_COLORS[entry.type]}15`, color: TYPE_COLORS[entry.type] }}>
                          {entry.type}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--recessed)', color: 'var(--text-muted)' }}>
                          {entry.preset}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>#{entry.chainPos}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{entry.sizeBytes}B</span>
                      </div>
                      <p className="text-sm mb-2">{entry.text}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: '#0E9C86' }}>{entry.blobId}</span>
                        {/* Blob expiration */}
                        <span className="flex items-center gap-1 text-[10px]"
                          style={{ color: expDays < 7 ? '#ef4444' : expDays < 14 ? '#f59e0b' : 'var(--text-muted)' }}>
                          <Clock size={9} />
                          {expDays > 0 ? `expires in ${expDays}d` : 'expired'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.verified ? (
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: '#22c55e' }}>
                          <FileCheck size={12} /> verified
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: '#ef4444' }}>
                          <AlertTriangle size={12} /> tampered
                        </div>
                      )}
                      <a href={`https://walruscan.com/blob/${entry.blobId}`} target="_blank" rel="noopener"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        title="Verify on Walruscan">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {page + 1} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Chain integrity */}
      <div className="mt-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Shield size={20} style={{ color: '#22c55e' }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>Chain Integrity: Intact</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            SHA-256 hash chain verified. {MOCK_HISTORY.filter(e => e.verified).length}/{MOCK_HISTORY.length} entries confirmed.
            Blob retention: ~42 days per entry (extend before expiry).
          </div>
        </div>
      </div>
    </div>
  )
}
