// Thin typed bridge to the shared router/registry (single source of truth lives in packages/).
// @ts-ignore -- plain .mjs without types
import { route as _route, shouldShowRoleLabel as _show } from '@vow/core/roles/router.mjs'
// @ts-ignore
import { ROLES as _ROLES, ROLE_IDS as _IDS } from '@vow/presets/roles/index.mjs'

export type RoleId = 'fitness' | 'medication' | 'sobriety' | 'health' | 'study'
export type LabelMode = 'always' | 'change' | 'off'
export interface RoleMeta { id: RoleId; label: string; emoji: string; sensitive: boolean }
export interface Route { primary: RoleId | null; reason: string; outOfScope: boolean; crisis: boolean; needsModel: boolean }

export const ROLE_IDS: RoleId[] = _IDS
export const ROLES: Record<RoleId, RoleMeta> = _ROLES
export const COLORS: Record<RoleId, string> = { fitness: '#22c55e', medication: '#f59e0b', sobriety: '#ef4444', health: '#ec4899', study: '#8b5cf6' }
export const routeText = (text: string, enabled: RoleId[], extra: Record<string, unknown> = {}): Route =>
  _route(text, { enabled, channel: 'web', ...extra })
export const shouldShowRoleLabel = (mode: LabelMode, role: RoleId, last: RoleId | null): boolean => _show(mode, role, last)

export function loadPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('vow.' + key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
export function savePref<T>(key: string, v: T) { try { localStorage.setItem('vow.' + key, JSON.stringify(v)) } catch { /* ignore */ } }
