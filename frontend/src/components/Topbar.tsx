import React, { useRef } from 'react'
import type { HabitIntegration, ViewState } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

const DAY_MS = 86_400_000
const MIN_SPAN_MS = 0.5 * 30.44 * DAY_MS   // "week" preset
const MAX_SPAN_MS = 120 * 30.44 * DAY_MS   // "decade" preset

function spanToRatio(ms: number): number {
  return Math.log(ms / MIN_SPAN_MS) / Math.log(MAX_SPAN_MS / MIN_SPAN_MS)
}
function ratioToSpan(r: number): number {
  return MIN_SPAN_MS * Math.pow(MAX_SPAN_MS / MIN_SPAN_MS, r)
}

const ZOOM_TICKS = [
  { label: 'week',   ms: 0.5 * 30.44 * DAY_MS },
  { label: 'month',  ms: 12  * 30.44 * DAY_MS },
  { label: 'year',   ms: 36  * 30.44 * DAY_MS },
  { label: 'decade', ms: 120 * 30.44 * DAY_MS },
].map(t => ({ label: t.label, ratio: spanToRatio(t.ms) }))

const MOBILE_SPANS = [
  { label: 'week',   ms: 0.5 * 30.44 * DAY_MS },
  { label: 'month',  ms: 12  * 30.44 * DAY_MS },
  { label: 'year',   ms: 36  * 30.44 * DAY_MS },
  { label: 'decade', ms: 120 * 30.44 * DAY_MS },
]

interface Props {
  pendingCount: number
  habitIntegration: HabitIntegration | null
  view: ViewState
  today: Date
  birthdate: Date
  panEndMs: number
  onNewEvent: () => void
  onPending: () => void
  onCategories: () => void
  onExport: () => void
  onHabitSettings: () => void
  onHabitSync: () => void
  onSetSpan: (spanMs: number) => void
  onSeek: (centerMs: number) => void
}

const logo = (
  <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none', flexShrink: 0 }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)', flexShrink: 0 }} />
    <div style={{ width: 16, height: 1.5, background: 'var(--muted)' }} />
    <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.3px', padding: '0 4px' }}>timeline</span>
    <div style={{ width: 16, height: 1.5, background: 'var(--muted)' }} />
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)', flexShrink: 0 }} />
  </div>
)

const badge = (n: number) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
    background: 'var(--warn)', color: '#000', fontSize: 10, fontWeight: 700,
  }}>{n}</span>
)

const Divider = () => (
  <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
)

function Scrollbar({ ticks, thumbStart, thumbEnd, onSeek }: {
  ticks: { ratio: number; label: string }[]
  thumbStart: number
  thumbEnd: number
  onSeek: (ratio: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  function ratioAt(clientX: number): number {
    if (!trackRef.current) return 0
    const { left, width } = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - left) / width))
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    onSeek(ratioAt(e.clientX))
    const onMove = (ev: MouseEvent) => onSeek(ratioAt(ev.clientX))
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const ts = Math.max(0, Math.min(1, thumbStart))
  const te = Math.max(0, Math.min(1, thumbEnd))

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, padding: '0 10px' }}>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative', height: 22, flex: 1,
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 4, cursor: 'pointer', userSelect: 'none', overflow: 'hidden',
        }}
      >
        {/* Thumb */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${ts * 100}%`,
          width: `${Math.max(1.5, (te - ts) * 100)}%`,
          minWidth: 3,
          background: '#3a3a46',
          borderRadius: 3,
        }} />
        {/* Labels centred vertically; edge labels inset by the same gap as top/bottom */}
        {ticks.map(({ ratio, label }, i) => {
          const isFirst = i === 0
          const isLast  = i === ticks.length - 1
          // vertical pad ≈ (trackH 22px − lineHeight ~11px) / 2 → 6px
          const edgePad = 6
          const pos: React.CSSProperties = isFirst
            ? { left: edgePad }
            : isLast
            ? { right: edgePad }
            : { left: `${ratio * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }
          return (
            <span key={label} style={{
              position: 'absolute', top: '50%',
              ...pos,
              ...(isFirst || isLast ? { transform: 'translateY(-50%)' } : {}),
              fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap',
              userSelect: 'none', pointerEvents: 'none',
            }}>{label}</span>
          )
        })}
      </div>
    </div>
  )
}

export function Topbar({ pendingCount, habitIntegration, view, today: _today, birthdate, panEndMs, onNewEvent, onPending, onCategories, onExport, onHabitSettings, onHabitSync, onSetSpan, onSeek }: Props) {
  const isMobile = useIsMobile()

  // Pan scrollbar: birthdate → latest range event end (or today+1y)
  const birthYear = birthdate.getFullYear()
  const panMin    = birthdate.getTime()
  const panMax    = panEndMs
  const panRange  = panMax - panMin

  // Tick interval scales with the range so labels don't crowd
  const rangeYears   = panRange / (365.25 * DAY_MS)
  const tickInterval = rangeYears <= 5 ? 1 : rangeYears <= 20 ? 2 : rangeYears <= 50 ? 5 : 10

  // Minimum ratio gap between labels (~7% of track width) to prevent overlap
  const MIN_LABEL_GAP = 0.07

  const panTicks: { ratio: number; label: string }[] = [
    { ratio: 0, label: String(birthYear) },
  ]
  const firstTick = Math.ceil((birthYear + 0.01) / tickInterval) * tickInterval
  for (let y = firstTick; ; y += tickInterval) {
    const ms = new Date(y, 0, 1).getTime()
    if (ms >= panMax) break
    const ratio = (ms - panMin) / panRange
    if (ratio - panTicks[panTicks.length - 1].ratio >= MIN_LABEL_GAP) {
      panTicks.push({ ratio, label: String(y) })
    }
  }
  // Add end year only if far enough from the last tick
  const endYearLabel = String(new Date(panMax).getFullYear())
  if (panTicks[panTicks.length - 1].label !== endYearLabel &&
      1 - panTicks[panTicks.length - 1].ratio >= MIN_LABEL_GAP) {
    panTicks.push({ ratio: 1, label: endYearLabel })
  }

  // Zoom scrollbar: 8%-wide thumb centred on current log-scale zoom ratio
  const currentSpan = view.endMs - view.startMs
  const zoomRatio   = Math.max(0, Math.min(1, spanToRatio(currentSpan)))

  // Mobile: highlight the nearest preset
  const nearestSpanMs = MOBILE_SPANS.reduce((p, c) =>
    Math.abs(c.ms - currentSpan) < Math.abs(p.ms - currentSpan) ? c : p
  ).ms

  if (isMobile) {
    return (
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 5 }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
          {logo}
          <div style={{ flex: 1 }} />
          {pendingCount > 0 && (
            <button onClick={onPending} style={{ ...btnWarn, padding: '6px 10px', gap: 5 }}>
              ⚠ {badge(pendingCount)}
            </button>
          )}
          <SyncWidget integration={habitIntegration} onOpen={onHabitSettings} onSync={onHabitSync} compact />
          <button onClick={onCategories} style={{ ...btnGhost, padding: '6px 10px' }}>⊞</button>
          <button onClick={onExport} style={{ ...btnGhost, padding: '6px 10px' }}>↓</button>
          <button onClick={onNewEvent} style={{ ...btnPrimary, padding: '6px 14px' }}>+ New</button>
        </div>
        <div style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', flex: 1 }}>
            {MOBILE_SPANS.map(p => (
              <button key={p.ms} onClick={() => onSetSpan(p.ms)} style={{
                flex: 1, padding: '4px 0',
                background: p.ms === nearestSpanMs ? 'var(--s3)' : 'transparent',
                border: 'none', borderRight: '1px solid var(--border)',
                color: p.ms === nearestSpanMs ? 'var(--text)' : 'var(--muted)',
                fontSize: 11,
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>
    )
  }

  return (
    <header style={{
      height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 16px 0 20px',
      flexShrink: 0, zIndex: 5,
    }}>
      {logo}

      <div style={{ width: 12, flexShrink: 0 }} />
      <Divider />

      <Scrollbar
        ticks={ZOOM_TICKS}
        thumbStart={zoomRatio - 0.04}
        thumbEnd={zoomRatio + 0.04}
        onSeek={r => onSetSpan(ratioToSpan(r))}
      />

      <Scrollbar
        ticks={panTicks}
        thumbStart={(view.startMs - panMin) / panRange}
        thumbEnd={(view.endMs - panMin) / panRange}
        onSeek={r => onSeek(panMin + r * panRange)}
      />

      <Divider />
      <div style={{ width: 10, flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <SyncWidget integration={habitIntegration} onOpen={onHabitSettings} onSync={onHabitSync} />
        <button onClick={onCategories} style={btnGhost}>⊞ Categories</button>
        <button onClick={onExport} style={btnGhost}>↓ Export</button>
        {pendingCount > 0 && (
          <button onClick={onPending} style={btnWarn}>
            ⚠ Pending{' '}{badge(pendingCount)}
          </button>
        )}
        <button onClick={onNewEvent} style={btnPrimary}>+ New event</button>
      </div>
    </header>
  )
}

const base: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px',
  borderRadius: 7, border: '1px solid var(--border)', background: 'var(--s2)',
  color: 'var(--text)', fontSize: 12, whiteSpace: 'nowrap',
}
const btnGhost: React.CSSProperties   = { ...base, borderColor: 'transparent', background: 'transparent', color: 'var(--muted)' }
const btnPrimary: React.CSSProperties = { ...base, background: 'var(--accent)', borderColor: 'transparent', color: '#fff' }
const btnWarn: React.CSSProperties    = { ...base, background: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.3)', color: 'var(--warn)' }

function SyncWidget({ integration, onOpen, onSync, compact = false }: {
  integration: HabitIntegration | null
  onOpen: () => void
  onSync: () => void
  compact?: boolean
}) {
  const dotColor = !integration?.hasToken
    ? 'var(--muted)'
    : integration.lastRunStatus === 'ok'
    ? '#34c759'
    : integration.lastRunStatus === 'error'
    ? '#ff3b30'
    : 'var(--muted)'

  const label = !integration?.hasToken
    ? 'TickTick'
    : integration.lastRunAt
    ? `TickTick · ${formatAgo(integration.lastRunAt)}`
    : 'TickTick · never'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
      <div
        onClick={onOpen}
        style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, cursor: 'pointer' }}
      />
      {!compact && (
        <button onClick={onOpen} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, padding: 0, cursor: 'pointer' }}>
          {label}
        </button>
      )}
      {integration?.hasToken && (
        <button onClick={onSync} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
          ↻
        </button>
      )}
    </div>
  )
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
