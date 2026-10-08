import ChannelsPage from './pages/ChannelsPage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import App from './App'
import DashboardLayout from './components/DashboardLayout'
import ChatPage from './pages/ChatPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import ExportPage from './pages/ExportPage'
import LoginPage from './pages/LoginPage'
import { BusyIndicator } from './lib/busy'
import './index.css'

// PWA (DASHBOARD_UX_AUDIT §A7): app-shell cache + offline page only, never caches /api/*.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal: app still works without it */ })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/magic" element={<LoginPage kind="magic" />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <BusyIndicator />
    </AuthProvider>
  </StrictMode>,
)
