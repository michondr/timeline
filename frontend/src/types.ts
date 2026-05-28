export type EventType = 'range' | 'open' | 'pin'

export interface Category {
  id: string
  name: string
  color: string
  isSystem: boolean
  systemSlug: string | null
}

export interface TimelineEvent {
  id: string
  categoryId: string
  name: string
  type: EventType
  startDate: string | null   // YYYY-MM-DD
  endDate: string | null     // YYYY-MM-DD
  notifyForEnd: boolean
  note: string | null
}

export interface ViewState {
  startMs: number
  endMs: number
}

export interface Habit {
  id: string
  name: string
  color: string
  startDate: string | null  // YYYY-MM-DD
  logs: Record<string, 'done' | 'skip' | 'fail'>  // date → status
}

export interface HabitIntegration {
  hasToken: boolean
  lastRunAt: string | null   // ISO
  lastRunStatus: 'ok' | 'error' | null
  lastRunError: string | null
}
