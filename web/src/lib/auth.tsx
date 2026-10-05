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
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: () => {},
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
  }

  const logout = () => setUser(null)

  const updateUser = (patch: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...patch } : null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
