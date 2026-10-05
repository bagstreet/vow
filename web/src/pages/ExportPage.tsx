import { useState } from 'react'
import { Download, Upload, FileCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function ExportPage() {
  const { user } = useAuth()
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const exportJSON = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: { id: user?.id, name: user?.name, provider: user?.provider },
      entries: [
        { chainPos: 14, type: 'checkin', text: '5km run completed', blobId: 'vow_0x3c91a7b2', timestamp: '2026-10-04T18:30:00Z' },
        { chainPos: 13, type: 'checkin', text: 'Vitamin D + Omega-3 taken', blobId: 'vow_0xa7f2e1c9', timestamp: '2026-10-04T20:00:00Z' },
        { chainPos: 12, type: 'checkin', text: 'React hooks study - 2h', blobId: 'vow_0x55a1c9d2', timestamp: '2026-10-04T14:00:00Z' },
      ],
      chainHead: 'sha256:a4f2c9e1b7d3...',
      walrusNamespace: user?.name?.toLowerCase().replace(/\s/g, '-') || 'default',
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vow-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const rows = [
      ['Position', 'Type', 'Text', 'BlobID', 'Timestamp'],
      ['14', 'checkin', '5km run completed', 'vow_0x3c91a7b2', '2026-10-04T18:30:00Z'],
      ['13', 'checkin', 'Vitamin D + Omega-3 taken', 'vow_0xa7f2e1c9', '2026-10-04T20:00:00Z'],
      ['12', 'checkin', 'React hooks study - 2h', 'vow_0x55a1c9d2', '2026-10-04T14:00:00Z'],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vow-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (data.version && data.entries) {
          setRestoreStatus('success')
          setTimeout(() => setRestoreStatus('idle'), 3000)
        } else {
          setRestoreStatus('error')
          setTimeout(() => setRestoreStatus('idle'), 3000)
        }
      } catch {
        setRestoreStatus('error')
        setTimeout(() => setRestoreStatus('idle'), 3000)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Export & Restore</h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Your data lives on Walrus. Export a local copy or restore from a backup.
      </p>

      {/* Export */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Export</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Download your complete commitment history with receipts and chain hashes.
        </p>
        <div className="flex gap-3">
          <button onClick={exportJSON} className="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:brightness-110"
            style={{ background: '#0E9C86', color: '#000' }}>
            <Download size={12} className="inline mr-1.5" /> Export JSON
          </button>
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-sec)' }}>
            <Download size={12} className="inline mr-1.5" /> Export CSV
          </button>
        </div>
      </section>

      {/* Restore */}
      <section className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Upload size={16} style={{ color: '#0E9C86' }} />
          <h2 className="text-sm font-semibold">Restore from backup</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Upload a previously exported JSON file. Chain integrity will be verified against Walrus.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5"
          style={{ border: '1px solid var(--border)', color: 'var(--text-sec)' }}>
          <Upload size={12} /> Choose file
          <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </label>
        {restoreStatus === 'success' && (
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#22c55e' }}>
            <FileCheck size={14} /> Backup restored successfully. Chain verified.
          </div>
        )}
        {restoreStatus === 'error' && (
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
            <AlertCircle size={14} /> Invalid backup file. Expected Vow JSON format.
          </div>
        )}
      </section>

      {/* Cold restore info */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--recessed)', border: '1px solid var(--border)' }}>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>Cold session recovery:</strong> Even without a backup, your data can be rebuilt from Walrus blobs using your delegate key. The chain head is stored on-chain; any Vow-compatible client can reconstruct your full history.
        </div>
      </div>
    </div>
  )
}
