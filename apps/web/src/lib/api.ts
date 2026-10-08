// Thin client for the dashboard API (one serverless router, /api/dash/<op>). Session lives in an HttpOnly cookie.
export interface ApiResult<T = Record<string, unknown>> { ok: boolean; status: number; error?: string; data: T & { ok?: boolean; error?: string } }

export async function api<T = Record<string, unknown>>(op: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: unknown): Promise<ApiResult<T>> {
  try {
    const qs = method === 'GET' && body ? '?' + new URLSearchParams(body as Record<string, string>).toString() : ''
    const r = await fetch(`/api/dash/${op}${qs}`, {
      method, credentials: 'same-origin',
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' || body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok && data?.ok !== false, status: r.status, error: data?.error, data }
  } catch {
    return { ok: false, status: 0, error: 'network', data: {} as never }
  }
}
