const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
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

// Auth
export async function registerInit(email: string) {
  return json<{ kdfSalt: string }>(
    await req('/auth/register/init', { method: 'POST', body: JSON.stringify({ email }) }),
  )
}

export async function registerFinish(data: {
  email: string
  birthdate: string
  kdfSalt: string
  verificationBlob: string
  authKeyHex: string
}) {
  return json<{ apiToken: string; birthdate: string }>(
    await req('/auth/register/finish', { method: 'POST', body: JSON.stringify(data) }),
  )
}

export async function loginInit(email: string) {
  return json<{ kdfSalt: string; verificationBlob: string }>(
    await req('/auth/login/init', { method: 'POST', body: JSON.stringify({ email }) }),
  )
}

export async function loginFinish(email: string, authKeyHex: string) {
  return json<{ apiToken: string; birthdate: string }>(
    await req('/auth/login/finish', { method: 'POST', body: JSON.stringify({ email, authKeyHex }) }),
  )
}

export async function getMe() {
  return json<{ email: string; birthdate: string }>(await req('/auth/me'))
}

// Categories
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

// Events
export interface RawEvent {
  id: string
  categoryId: string
  name: string
  type: 'range' | 'open' | 'pin'
  startDate: string | null
  endDate: string | null
  notifyForEnd: boolean
  note: string | null
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
