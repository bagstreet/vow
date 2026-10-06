import { useEffect, useState } from 'react'
import { COLORS, type RoleId } from '../lib/roles'

// Mascot per role (files in /public/mascots). Sobriety reuses the nutrition mascot until it gets its own.
export const MASCOT: Record<RoleId, string> = {
  fitness: '/mascots/fitness.png',
  medication: '/mascots/medication.png',
  sobriety: '/mascots/nutrition.png',
  health: '/mascots/health.png',
  study: '/mascots/study.png',
}

/** Avatar for one role (message bubbles) or, with several roles, a rotating one (chat header). */
export function RoleAvatar({ roles, size = 32, intervalMs = 3000 }: { roles: RoleId[]; size?: number; intervalMs?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (roles.length < 2) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI(n => n + 1), intervalMs)
    return () => clearInterval(t)
  }, [roles.length, intervalMs])
  const role = roles[roles.length ? i % roles.length : 0]
  if (!role) return <div className="rounded-full flex-shrink-0" style={{ width: size, height: size, border: '2px solid #0E9C86', background: '#0E9C8620' }} />
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 transition-colors duration-500"
      style={{ width: size, height: size, border: '2px solid ' + COLORS[role], background: COLORS[role] + '22' }}>
      <img key={role} src={MASCOT[role]} alt="" width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'vowFade 500ms ease' }} />
    </div>
  )
}
