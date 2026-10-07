import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Reverse path (T54 §C point 4): user sends /login to the bot, bot replies with this link,
// one-time token is exchanged for the account here, then we drop them into the dashboard.
export default function LoginPage() {
  const [params] = useSearchParams()
  const { loginWithUserId } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'error'>('checking')

  useEffect(() => {
    const token = params.get('t')
    if (!token) { setState('error'); return }
    fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(r => r.json())
      .then(data => {
        if (data?.ok && data.userId) {
          loginWithUserId(data.userId, 'telegram', data.displayName)
          navigate('/dashboard', { replace: true })
        } else {
          setState('error')
        }
      })
      .catch(() => setState('error'))
  }, [params, loginWithUserId, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {state === 'checking' ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Signing you in…</p>
      ) : (
        <div className="text-center max-w-sm px-4">
          <p className="text-sm font-medium mb-2">That sign-in link is invalid or expired.</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Send <code>/login</code> to the bot again to get a fresh link (valid 10 minutes, one use).</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#0E9C86', color: '#000' }}>
            Back to home
          </button>
        </div>
      )}
    </div>
  )
}
