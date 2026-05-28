import React from 'react'
import type { HabitIntegration } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  pendingCount: number
  habitIntegration: HabitIntegration | null
  onNewEvent: () => void
  onPending: () => void
  onCategories: () => void
  onExport: () => void
  onHabitSettings: () => void
  onHabitSync: () => void
  onPreset: (months: number) => void
  activePreset: number
}

const PRESETS = [
  { label: 'day',    months: 0.07 },
  { label: 'week',   months: 0.5  },
  { label: 'month',  months: 12   },
  { label: 'year',   months: 36   },
  { label: 'decade', months: 120  },
]

const logo = (
  <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none' }}>
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

export function Topbar({ pendingCount, habitIntegration, onNewEvent, onPending, onCategories, onExport, onHabitSettings, onHabitSync, onPreset, activePreset }: Props) {
  const isMobile = useIsMobile()

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
          <button onClick={onCategories} style={{ ...btnGhost, padding: '6px 10px' }}>⊞</button>
          <button onClick={onExport} style={{ ...btnGhost, padding: '6px 10px' }}>↓</button>
          <button onClick={onNewEvent} style={{ ...btnPrimary, padding: '6px 14px' }}>+ New</button>
        </div>
        <div style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', flex: 1 }}>
            {PRESETS.map(p => (
              <button key={p.months} onClick={() => onPreset(p.months)} style={{
                flex: 1, padding: '4px 0',
                background: p.months === activePreset ? 'var(--s3)' : 'transparent',
                border: 'none', borderRight: '1px solid var(--border)',
                color: p.months === activePreset ? 'var(--text)' : 'var(--muted)',
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
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0, zIndex: 5,
    }}>
      {logo}

      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      <div style={{
        display: 'flex', background: 'var(--s2)', border: '1px solid var(--border)',
        borderRadius: 7, overflow: 'hidden',
      }}>
        {PRESETS.map(p => (
          <button
            key={p.months}
            onClick={() => onPreset(p.months)}
            style={{
              padding: '5px 12px', background: p.months === activePreset ? 'var(--s3)' : 'transparent',
              border: 'none', borderRight: '1px solid var(--border)',
              color: p.months === activePreset ? 'var(--text)' : 'var(--muted)',
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      <SyncWidget integration={habitIntegration} onOpen={onHabitSettings} onSync={onHabitSync} />

      <div style={{ flex: 1 }} />

      <button onClick={onCategories} style={btnGhost}>⊞ Categories</button>
      <button onClick={onExport} style={btnGhost}>↓ Export</button>

      {pendingCount > 0 && (
        <button onClick={onPending} style={btnWarn}>
          ⚠ Pending{' '}{badge(pendingCount)}
        </button>
      )}

      <button onClick={onNewEvent} style={btnPrimary}>+ New event</button>
    </header>
  )
}

const base: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px',
  borderRadius: 7, border: '1px solid var(--border)', background: 'var(--s2)',
  color: 'var(--text)', fontSize: 12, whiteSpace: 'nowrap',
}
const btnGhost: React.CSSProperties  = { ...base, borderColor: 'transparent', background: 'transparent', color: 'var(--muted)' }
const btnPrimary: React.CSSProperties = { ...base, background: 'var(--accent)', borderColor: 'transparent', color: '#fff' }
const btnWarn: React.CSSProperties   = {
  ...base,
  background: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.3)', color: 'var(--warn)',
}

function SyncWidget({ integration, onOpen, onSync }: {
  integration: HabitIntegration | null
  onOpen: () => void
  onSync: () => void
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
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <button onClick={onOpen} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, padding: 0, cursor: 'pointer' }}>
        {label}
      </button>
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
