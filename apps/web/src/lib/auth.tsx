import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface User {
  id: string
  name: string
  provider: 'telegram' | 'discord' | 'slack' | 'web'
  avatar?: string
  preset?: string
  createdAt: string
}

interface AuthCtx {
  user: User | null
  login: (provider: User['provider']) => void
  loginWithUserId: (id: string, provider: User['provider'], name?: string) => void
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: () => {},
  loginWithUserId: () => {},
  logout: () => {},
  updateUser: () => {},
})

const STORAGE_KEY = 'vow_user'

// Demo user names per provider
const DEMO_NAMES: Record<string, string> = {
  telegram: 'Telegram User',
  discord: 'Discord User',
  slack: 'Slack User',
  web: 'Web User',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  }, [user])

  const login = (provider: User['provider']) => {
    const newUser: User = {
      id: `user_${Date.now().toString(36)}`,
      name: DEMO_NAMES[provider] || 'User',
      provider,
      createdAt: new Date().toISOString(),
    }
    setUser(newUser)
    // Best-effort: replace the client-only id with a real backend account (T54) so channel-linking has
    // something real to attach to. Falls back silently to the local-only id (e.g. no API in local dev).
    fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: newUser.name }) })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.ok && data.userId) setUser(prev => (prev ? { ...prev, id: data.userId } : prev)) })
      .catch(() => { /* stays on the local-only id */ })
  }

  const logout = () => setUser(null)

  // Used by the /login page (T54 reverse path): the bot already proved who this is via a one-time
  // token, so we trust the returned userId directly instead of calling /api/account again.
  const loginWithUserId = (id: string, provider: User['provider'], name?: string) => {
    setUser({ id, name: name || DEMO_NAMES[provider] || 'User', provider, createdAt: new Date().toISOString() })
  }

  const updateUser = (patch: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...patch } : null)
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithUserId, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
