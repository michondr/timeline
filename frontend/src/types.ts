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
