const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function req(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('timeline_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const r = await fetch(BASE + path, { ...opts, headers })
  if (r.status === 401) {
    localStorage.removeItem('timeline_token')
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }
  return r
}

async function json<T>(r: Response): Promise<T> {
  const body = await r.json()
  if (!r.ok) throw new ApiError(r.status, body.error ?? 'Request failed')
  return body as T
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthService {
  name: string
  status: 'ok' | 'error'
}

export async function fetchHealth(): Promise<HealthService[]> {
  try {
    const r = await fetch(BASE + '/health')
    const body = await r.json()
    return body.services ?? []
  } catch {
    return [{ name: 'backend', status: 'error' }]
  }
}

// ── Passkey auth ──────────────────────────────────────────────────────────────

export async function passkeyLoginChallenge() {
  return json<{ challenge: string; rpId: string; timeout: number }>(
    await req('/auth/passkey/login/challenge', { method: 'POST' }),
  )
}

export async function passkeyLoginVerify(userHandle: string) {
  const r = await req('/auth/passkey/login/verify', {
    method: 'POST',
    body: JSON.stringify({ userHandle }),
  })
  if (r.status === 404) {
    const body = await r.json()
    return { found: false as const, userHandle: body.userHandle as string }
  }
  return json<{ found: true; userHandle: string; kdfSalt: string; verificationBlob: string }>(r)
}

export async function passkeyRegisterChallenge() {
  return json<{ challenge: string; rpId: string; rpName: string; userId: string; timeout: number }>(
    await req('/auth/passkey/register/challenge', { method: 'POST' }),
  )
}

export async function passkeyRegisterFinish(data: {
  userHandle: string
  birthdate: string
  kdfSalt: string
  verificationBlob: string
  authKeyHex: string
}) {
  return json<{ apiToken: string; birthdate: string }>(
    await req('/auth/passkey/register/finish', { method: 'POST', body: JSON.stringify(data) }),
  )
}

export async function loginFinish(userHandle: string, authKeyHex: string) {
  return json<{ apiToken: string; birthdate: string }>(
    await req('/auth/login/finish', {
      method: 'POST',
      body: JSON.stringify({ userHandle, authKeyHex }),
    }),
  )
}

export async function getMe() {
  return json<{ birthdate: string; kdfSalt: string; verificationBlob: string }>(
    await req('/auth/me'),
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface RawCategory {
  id: string
  name: string
  color: string
  isSystem: boolean
  systemSlug: string | null
}

export async function fetchCategories() {
  return json<RawCategory[]>(await req('/categories'))
}

export async function createCategory(name: string, color: string) {
  return json<RawCategory>(
    await req('/categories', { method: 'POST', body: JSON.stringify({ name, color }) }),
  )
}

export async function deleteCategory(id: string) {
  const r = await req(`/categories/${id}`, { method: 'DELETE' })
  if (!r.ok && r.status !== 204) throw new ApiError(r.status, 'Delete failed')
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface RawEvent {
  id: string
  categoryId: string
  name: string
  type: 'range' | 'open' | 'pin'
  startDate: string | null
  endDate: string | null
  notifyForEnd: boolean
  note: string | null
  rangeEventId: string | null
}

export async function fetchEvents() {
  return json<RawEvent[]>(await req('/events'))
}

export async function createEvent(data: Omit<RawEvent, 'id'>) {
  return json<RawEvent>(
    await req('/events', { method: 'POST', body: JSON.stringify(data) }),
  )
}

export async function updateEvent(id: string, data: Partial<Omit<RawEvent, 'id'>>) {
  return json<RawEvent>(
    await req(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  )
}

export async function deleteEvent(id: string) {
  const r = await req(`/events/${id}`, { method: 'DELETE' })
  if (!r.ok && r.status !== 204) throw new ApiError(r.status, 'Delete failed')
}

// ── Habits ────────────────────────────────────────────────────────────────────

export interface RawHabit {
  id: string
  name: string
  color: string
  startDate: string | null
  logs: Record<string, 'done' | 'skip' | 'fail'>
}

export interface RawHabitIntegration {
  hasToken: boolean
  lastRunAt: string | null
  lastRunStatus: 'ok' | 'error' | null
  lastRunError: string | null
}

export async function fetchHabits(from: string, to: string) {
  return json<RawHabit[]>(await req(`/habits?from=${from}&to=${to}`))
}

export async function fetchHabitIntegration() {
  return json<RawHabitIntegration>(await req('/habits/integration'))
}

export async function saveHabitToken(sessionToken: string) {
  return json<{ ok: boolean }>(
    await req('/habits/integration', { method: 'PUT', body: JSON.stringify({ sessionToken }) }),
  )
}

export async function triggerHabitSync() {
  return json<{ ok: boolean }>(await req('/habits/sync', { method: 'POST' }))
}

// ── Audiobookshelf ────────────────────────────────────────────────────────────

export interface RawAbsIntegration {
  hasCredentials: boolean
  url: string
  lastRunAt: string | null
  lastRunStatus: 'ok' | 'error' | null
  lastRunError: string | null
}

export interface RawBook {
  id: string
  absItemId: string
  title: string
  author: string | null
  startedAt: string | null
  finishedAt: string | null
  isFinished: boolean
  currentTime: number | null
}

export async function fetchAbsIntegration() {
  return json<RawAbsIntegration>(await req('/abs/integration'))
}

export async function saveAbsIntegration(url: string, token: string) {
  return json<{ ok: boolean }>(
    await req('/abs/integration', { method: 'PUT', body: JSON.stringify({ url, token }) }),
  )
}

export async function triggerAbsSync() {
  return json<{ ok: boolean }>(await req('/abs/sync', { method: 'POST' }))
}

export async function fetchBooks() {
  return json<RawBook[]>(await req('/abs/books'))
}

// ── TickTick todos ────────────────────────────────────────────────────────────

export interface RawTodo {
  id: string
  title: string
  projectId: string
}

export async function fetchTodos() {
  return json<RawTodo[]>(await req('/ticktick/todos'))
}

export async function completeTodo(id: string, projectId: string) {
  return json<{ ok: boolean }>(
    await req(`/ticktick/todos/${id}/done`, { method: 'POST', body: JSON.stringify({ projectId }) }),
  )
}

export async function abandonTodo(id: string, projectId: string) {
  return json<{ ok: boolean }>(
    await req(`/ticktick/todos/${id}/wontdo`, { method: 'POST', body: JSON.stringify({ projectId }) }),
  )
}
