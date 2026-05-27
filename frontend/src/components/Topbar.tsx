import React from 'react'

interface Props {
  pendingCount: number
  onNewEvent: () => void
  onPending: () => void
  onCategories: () => void
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

export function Topbar({ pendingCount, onNewEvent, onPending, onCategories, onPreset, activePreset }: Props) {
  return (
    <header style={{
      height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0, zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)', flexShrink: 0 }} />
        <div style={{ width: 16, height: 1.5, background: 'var(--muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.3px', padding: '0 4px' }}>timeline</span>
        <div style={{ width: 16, height: 1.5, background: 'var(--muted)' }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)', flexShrink: 0 }} />
      </div>

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

      <div style={{ flex: 1 }} />

      <button onClick={onCategories} style={btnGhost}>⊞ Categories</button>

      {pendingCount > 0 && (
        <button onClick={onPending} style={btnWarn}>
          ⚠ Pending{' '}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: 'var(--warn)', color: '#000', fontSize: 10, fontWeight: 700,
          }}>
            {pendingCount}
          </span>
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
