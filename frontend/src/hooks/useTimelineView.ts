import { useCallback, useState } from 'react'
import type { ViewState } from '../types'

const DAY_MS = 86_400_000
const YEAR_MS = 365 * DAY_MS

// Place "now" at ~90% from the left so history fills the view
function nowAtRightEdge(todayMs: number, totalMs: number): ViewState {
  return { startMs: todayMs - totalMs * 0.9, endMs: todayMs + totalMs * 0.1 }
}

export function useTimelineView(today: Date) {
  const [view, setView] = useState<ViewState>(() => nowAtRightEdge(today.getTime(), YEAR_MS))

  const setPreset = useCallback((months: number) => {
    setView(nowAtRightEdge(today.getTime(), months * 30.44 * DAY_MS))
  }, [today])

  const pan = useCallback((shiftMs: number) => {
    setView(prev => ({ startMs: prev.startMs + shiftMs, endMs: prev.endMs + shiftMs }))
  }, [])

  const fitRange = useCallback((startMs: number, endMs: number) => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return
    const MIN = 14 * DAY_MS
    let lo = startMs, hi = endMs
    if (hi - lo < MIN) { const c = (lo + hi) / 2; lo = c - MIN / 2; hi = c + MIN / 2 }
    const pad = (hi - lo) * 0.08
    setView({ startMs: lo - pad, endMs: hi + pad })
  }, [])

  const zoom = useCallback((
    deltaY: number,
    mouseRatio: number,
    _containerWidth: number,
  ) => {
    setView(prev => {
      const span     = prev.endMs - prev.startMs
      const focusMs  = prev.startMs + mouseRatio * span
      const factor   = deltaY > 0 ? 1.06 : 1 / 1.06
      const newSpan  = Math.max(7 * DAY_MS, Math.min(120 * 365 * DAY_MS, span * factor))
      const startMs  = focusMs - mouseRatio * newSpan
      return { startMs, endMs: startMs + newSpan }
    })
  }, [])

  // Zoom to a target span, keeping "now" at the same visual ratio
  const setSpan = useCallback((spanMs: number) => {
    setView(prev => {
      const span     = prev.endMs - prev.startMs
      const nowMs    = today.getTime()
      const nowRatio = (nowMs - prev.startMs) / span
      const anchor   = nowRatio >= 0 && nowRatio <= 1 ? nowRatio : 0.5
      const anchorMs = prev.startMs + anchor * span
      const clamped  = Math.max(7 * DAY_MS, Math.min(120 * 365 * DAY_MS, spanMs))
      const startMs  = anchorMs - anchor * clamped
      return { startMs, endMs: startMs + clamped }
    })
  }, [today])

  // Continuous zoom by a raw multiplier (used for pinch-to-zoom on touch)
  const zoomBy = useCallback((factor: number, mouseRatio: number) => {
    setView(prev => {
      const span    = prev.endMs - prev.startMs
      const focusMs = prev.startMs + mouseRatio * span
      const newSpan = Math.max(7 * DAY_MS, Math.min(120 * 365 * DAY_MS, span * factor))
      const startMs = focusMs - mouseRatio * newSpan
      return { startMs, endMs: startMs + newSpan }
    })
  }, [])

  // Move the view so `centerMs` is in the middle, keeping the current span
  const seekTo = useCallback((centerMs: number) => {
    setView(prev => {
      const span = prev.endMs - prev.startMs
      return { startMs: centerMs - span / 2, endMs: centerMs + span / 2 }
    })
  }, [])

  return { view, setView, setPreset, pan, zoom, zoomBy, fitRange, setSpan, seekTo }
}
