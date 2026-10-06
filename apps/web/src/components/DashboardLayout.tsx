import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { MessageCircle, Clock, Settings, Download, LogOut, Menu, X, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/dashboard', icon: MessageCircle, label: 'Chat', end: true },
  { to: '/dashboard/history', icon: Clock, label: 'History' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { to: '/dashboard/export', icon: Download, label: 'Export' },
]

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  if (!user) { navigate('/'); return null }

  const sidebarW = collapsed ? 'w-16' : 'w-56'

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Desktop sidebar - collapsible */}
      <aside className={`hidden md:flex flex-col ${sidebarW} flex-shrink-0 border-r transition-all duration-200`}
        style={{ background: 'var(--shell)', borderColor: 'var(--border)' }}>
        <div className="p-3 flex items-center justify-between">
          {!collapsed && (
            <NavLink to="/" className="flex items-center gap-1.5 text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity">
              <ChevronLeft size={14} />
              <span>vow</span>
            </NavLink>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5 ml-auto"
            style={{ color: 'var(--text-muted)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  isActive ? 'font-semibold' : 'opacity-60 hover:opacity-100'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? '#0E9C86' : 'var(--text)',
              })}>
              <n.icon size={16} />
              {!collapsed && n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: '#0E9C86', color: '#000' }}>
                {user.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{user.name}</div>
                <div className="text-[10px] opacity-50">{user.provider}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} w-full px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors hover:bg-white/5`}
            style={{ color: 'var(--text-muted)' }}
            title={collapsed ? 'Sign out' : undefined}>
            <LogOut size={13} />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--shell)', borderColor: 'var(--border)' }}>
          <NavLink to="/" className="text-sm font-semibold flex items-center gap-1 opacity-60">
            <ChevronLeft size={14} /> vow
          </NavLink>
          <button onClick={() => setMobileOpen(true)} className="w-11 h-11 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: 'var(--text-sec)' }}>
            <Menu size={18} />
          </button>
        </header>

        {/* Mobile sidebar - slide in from left */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/60 transition-opacity" />
            <div className="relative w-64 flex flex-col border-r animate-[slideInLeft_0.2s_ease-out]"
              style={{ background: 'var(--shell)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-semibold">vow</span>
                <button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'var(--surface)', color: 'var(--text-sec)' }}>
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 px-2 space-y-1">
                {NAV.map(n => (
                  <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer ${isActive ? 'font-semibold' : 'opacity-60'}`
                    }
                    style={({ isActive }) => ({
                      background: isActive ? 'var(--surface)' : 'transparent',
                      color: isActive ? '#0E9C86' : 'var(--text)',
                    })}>
                    <n.icon size={16} />
                    {n.label}
                  </NavLink>
                ))}
              </nav>
              {/* User info in mobile sidebar */}
              <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#0E9C86', color: '#000' }}>
                    {user.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{user.name}</div>
                    <div className="text-[10px] opacity-50">{user.provider}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile bottom tabs */}
        <nav className="md:hidden flex border-t" style={{ background: 'var(--shell)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] cursor-pointer transition-colors ${isActive ? 'font-semibold' : 'opacity-50'}`
              }
              style={({ isActive }) => ({ color: isActive ? '#0E9C86' : 'var(--text-muted)' })}>
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
