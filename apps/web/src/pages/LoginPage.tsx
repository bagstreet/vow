import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

// Both sign-in paths end here: /login?t=<bot one-time token> (from the bot's /login) and /magic?t=<email token>.
export default function LoginPage({ kind = 'bot' }: { kind?: 'bot' | 'magic' }) {
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const oauthErr = params.get('error')
  const OAUTH_MSG: Record<string, string> = { cancelled: 'You cancelled the sign-in.', provider_unavailable: 'That sign-in method is not configured yet.', bad_state: 'The sign-in session expired. Please try again.', failed: 'The provider refused the sign-in. Please try again.' }

  useEffect(() => {
    const token = params.get('t')
    if (oauthErr || !token) { setFailed(true); return }
    let alive = true
    api(kind === 'magic' ? 'magic-verify' : 'login', 'POST', { token }).then(async (r) => {
      if (!alive) return
      if (!r.ok) { setFailed(true); return }
      const me = await api('me')
      if (!me.ok && me.error === 'blocked') { await api('logout', 'POST', {}); setBlocked(true); return }
      await refresh(); navigate('/dashboard', { replace: true })
    })
    return () => { alive = false }
  }, [params, kind, refresh, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {blocked ? <p className="text-sm max-w-sm text-center px-4">This account is suspended. Contact the project administrator.</p> : !failed ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Signing you in…</p> : (
        <div className="text-center max-w-sm px-4">
          <p className="text-sm font-medium mb-2">{oauthErr ? (OAUTH_MSG[oauthErr] ?? 'Sign-in failed.') : 'That sign-in link is invalid or expired.'}</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{oauthErr ? 'You can try again from the home page.' : 'Links work once and expire after 10 minutes. Send <code>/login</code> to the bot, or request an email link on the home page.'}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#0E9C86', color: '#000' }}>Back to home</button>
        </div>
      )}
    </div>
  )
}
