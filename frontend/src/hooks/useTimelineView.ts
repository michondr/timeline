import { useCallback, useState } from 'react'
import { ViewState } from '../types'

const DAY_MS = 86_400_000
const HALF_YEAR = 182 * DAY_MS

export function useTimelineView(today: Date) {
  const [view, setView] = useState<ViewState>(() => ({
    startMs: today.getTime() - HALF_YEAR,
    endMs:   today.getTime() + HALF_YEAR,
  }))

  const setPreset = useCallback((months: number) => {
    const halfMs = months * 30.44 * DAY_MS / 2
    setView({
      startMs: today.getTime() - halfMs,
      endMs:   today.getTime() + halfMs,
    })
  }, [today])

  const pan = useCallback((shiftMs: number) => {
    setView(prev => ({ startMs: prev.startMs + shiftMs, endMs: prev.endMs + shiftMs }))
  }, [])

  const zoom = useCallback((
    deltaY: number,
    mouseRatio: number,
    containerWidth: number,
  ) => {
    setView(prev => {
      const span     = prev.endMs - prev.startMs
      const focusMs  = prev.startMs + mouseRatio * span
      const factor   = deltaY > 0 ? 1.06 : 1 / 1.06
      const newSpan  = Math.max(2 * DAY_MS, Math.min(120 * 365 * DAY_MS, span * factor))
      const startMs  = focusMs - mouseRatio * newSpan
      return { startMs, endMs: startMs + newSpan }
    })
  }, [])

  return { view, setView, setPreset, pan, zoom }
}
