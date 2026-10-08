import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from './api'

export interface Profile {
  id: string; display_name: string | null; email: string | null; tz: string; tone: string
  role_label: 'always' | 'on_change' | 'off'; default_role: string | null
  quiet_start: string | null; quiet_end: string | null; ack_min: number; channel_priority: string[]; isAdmin?: boolean
}
export interface ChannelLink { id: string; channel: 'telegram' | 'slack' | 'discord'; lastSeenAt: string | null; linkedAt: string }
export interface User { id: string; name: string; email: string | null }

interface AuthCtx {
  user: User | null
  profile: Profile | null
  channels: ChannelLink[]
  roles: string[]
  loading: boolean
  refresh: () => Promise<void>
  patchLocal: (profile: Partial<Profile>, roles?: string[]) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({ user: null, profile: null, channels: [], roles: [], loading: true, refresh: async () => {}, patchLocal: () => {}, logout: async () => {} })

// The browser keeps NO identity of its own: who you are is decided by the server from the HttpOnly session cookie.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ profile: Profile | null; channels: ChannelLink[]; roles: string[]; loading: boolean }>({ profile: null, channels: [], roles: [], loading: true })

  const refresh = useCallback(async () => {
    const r = await api<{ profile: Profile; channels: ChannelLink[]; roles: string[] }>('me')
    setState(r.ok ? { profile: r.data.profile, channels: r.data.channels, roles: r.data.roles, loading: false } : { profile: null, channels: [], roles: [], loading: false })
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const patchLocal = (pp: Partial<Profile>, roles?: string[]) => setState(st => ({ ...st, profile: st.profile ? { ...st.profile, ...pp } : st.profile, roles: roles ?? st.roles }))
  const logout = async () => { await api('logout', 'POST', {}); setState({ profile: null, channels: [], roles: [], loading: false }) }
  const p = state.profile
  const user: User | null = p ? { id: p.id, name: p.display_name || p.email || 'You', email: p.email } : null

  return <AuthContext.Provider value={{ user, profile: p, channels: state.channels, roles: state.roles, loading: state.loading, refresh, patchLocal, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
