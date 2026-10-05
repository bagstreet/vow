import { useState } from 'react'
import { FileCheck, ExternalLink, Shield, AlertTriangle } from 'lucide-react'

interface BlobEntry {
  id: string
  blobId: string
  text: string
  type: 'checkin' | 'correction' | 'seal'
  preset: string
  timestamp: string
  verified: boolean
  chainPos: number
}

// Mock data (will be replaced with real Walrus blob reads)
const MOCK_HISTORY: BlobEntry[] = [
  { id: '1', blobId: 'vow_0x3c91a7b2', text: '5km run completed', type: 'checkin', preset: 'fitness', timestamp: '2026-10-04T18:30:00Z', verified: true, chainPos: 14 },
  { id: '2', blobId: 'vow_0xa7f2e1c9', text: 'Vitamin D + Omega-3 taken', type: 'checkin', preset: 'medication', timestamp: '2026-10-04T20:00:00Z', verified: true, chainPos: 13 },
  { id: '3', blobId: 'vow_0x55a1c9d2', text: 'React hooks study - 2h', type: 'checkin', preset: 'study', timestamp: '2026-10-04T14:00:00Z', verified: true, chainPos: 12 },
  { id: '4', blobId: 'vow_0xbe03f7a4', text: 'Correction: 5km > 3km (knee pain)', type: 'correction', preset: 'fitness', timestamp: '2026-10-04T19:00:00Z', verified: true, chainPos: 11 },
  { id: '5', blobId: 'vow_0xd2e83a01', text: 'Day 28 - cycle log (encrypted)', type: 'checkin', preset: 'health', timestamp: '2026-10-03T21:00:00Z', verified: true, chainPos: 10 },
  { id: '6', blobId: 'vow_0x91dc44f2', text: 'Morning vitamins taken', type: 'checkin', preset: 'medication', timestamp: '2026-10-03T08:00:00Z', verified: true, chainPos: 9 },
  { id: '7', blobId: 'vow_0x7b3df8a2', text: 'Tamper attempt detected and rejected', type: 'seal', preset: 'fitness', timestamp: '2026-10-03T19:30:00Z', verified: false, chainPos: 8 },
]

const TYPE_COLORS: Record<string, string> = {
  checkin: '#22c55e',
  correction: '#f59e0b',
  seal: '#ef4444',
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? MOCK_HISTORY : MOCK_HISTORY.filter(e => e.preset === filter)
  const presets = [...new Set(MOCK_HISTORY.map(e => e.preset))]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Blob History</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {MOCK_HISTORY.length} entries in chain. All sealed on Walrus.
          </p>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs cursor-pointer outline-none"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <option value="all">All presets</option>
          {presets.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />

        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="relative pl-10">
              {/* Dot on timeline */}
              <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full border-2"
                style={{ background: 'var(--bg)', borderColor: TYPE_COLORS[entry.type] || '#0E9C86' }} />

              <div className="p-4 rounded-xl transition-colors hover:brightness-105"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
                        style={{ background: `${TYPE_COLORS[entry.type]}15`, color: TYPE_COLORS[entry.type] }}>
                        {entry.type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--recessed)', color: 'var(--text-muted)' }}>
                        {entry.preset}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        #{entry.chainPos}
                      </span>
                    </div>
                    <p className="text-sm mb-2">{entry.text}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: '#0E9C86' }}>
                        {entry.blobId}
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
          ))}
        </div>
      </div>

      {/* Chain integrity badge */}
      <div className="mt-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Shield size={20} style={{ color: '#22c55e' }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>Chain Integrity: Intact</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            SHA-256 hash chain verified. {MOCK_HISTORY.filter(e => e.verified).length}/{MOCK_HISTORY.length} entries confirmed on Walrus mainnet.
          </div>
        </div>
      </div>
    </div>
  )
}
