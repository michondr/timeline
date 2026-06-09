import { useEffect, useRef, useState } from 'react'
import type { Category, TimelineEvent } from '../types'
import { PanelShell } from './PanelShell'

interface Props {
  open: boolean
  categories: Category[]
  events: TimelineEvent[]
  autoFocusNew?: boolean
  expandId?: string | null
  onClose: () => void
  onCreate: (name: string, color: string) => void
  onDelete: (id: string) => void
  onEditEvent: (event: TimelineEvent) => void
}

const SWATCHES = [
  '#4a9eff','#34c759','#ff6b6b','#bf5af2','#ff9f0a','#ff9500',
  '#ff453a','#ffd60a','#30d158','#64d2ff','#5e5ce6','#ff375f',
  '#ac8e68','#98989d','#48484a',
]

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function CategoryPanel({ open, categories, events, autoFocusNew, expandId, onClose, onCreate, onDelete, onEditEvent }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newName, setNewName]   = useState('')
  const [swatch, setSwatch]     = useState(SWATCHES[0])
  const nameRef = useRef<HTMLInputElement>(null)

  // When opened via a command: expand the requested category / focus the new-name input
  useEffect(() => {
    if (!open) return
    if (expandId) setExpanded(expandId)
    if (autoFocusNew) { const t = setTimeout(() => nameRef.current?.focus(), 80); return () => clearTimeout(t) }
  }, [open, expandId, autoFocusNew])

  function countFor(id: string) {
    return events.filter(e => e.categoryId === id).length
  }

  function eventsFor(id: string) {
    return events.filter(e => e.categoryId === id)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  function handleCreate() {
    const n = newName.trim()
    if (!n) return
    onCreate(n, swatch)
    setNewName('')
  }

  return (
    <PanelShell open={open} side="left" eyebrow="Manage" title="Categories" onClose={onClose}>
      {/* Category list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {categories.map(c => {
          const count   = countFor(c.id)
          const isOpen  = expanded === c.id
          const catEvts = eventsFor(c.id)

          return (
            <div key={c.id}>
              {/* Category row */}
              <div
                onClick={() => toggleExpand(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 18px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: isOpen ? 'var(--s2)' : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <span style={{
                  fontSize: 11, color: 'var(--muted)',
                  background: 'var(--s3)', borderRadius: 10,
                  padding: '1px 7px', fontWeight: 500, flexShrink: 0,
                }}>
                  {count}
                </span>
                {c.isSystem
                  ? <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--s3)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>system</span>
                  : (
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(c.id) }}
                      disabled={count > 0}
                      title={count > 0 ? 'Remove events first' : 'Delete category'}
                      style={{
                        background: 'none', border: 'none', fontSize: 13, padding: '2px 6px', flexShrink: 0,
                        color: count > 0 ? 'var(--border)' : '#ff3b30',
                        cursor: count > 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )
                }
                <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0, marginLeft: -4, transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
              </div>

              {/* Expanded events */}
              {isOpen && (
                <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {catEvts.length === 0 ? (
                    <div style={{ padding: '10px 18px 10px 42px', fontSize: 12, color: 'var(--muted)' }}>No events</div>
                  ) : (
                    catEvts.map(ev => (
                      <div
                        key={ev.id}
                        onClick={() => onEditEvent(ev)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 18px 8px 42px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{ev.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                            {fmtDate(ev.startDate)}{ev.endDate ? ` – ${fmtDate(ev.endDate)}` : ev.type === 'open' ? ' →' : ''}
                          </div>
                        </div>
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>›</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New category form */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>New category</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {SWATCHES.map(col => (
            <div
              key={col}
              onClick={() => setSwatch(col)}
              style={{
                width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                background: col, flexShrink: 0,
                border: `2px solid ${col === swatch ? 'var(--text)' : 'transparent'}`,
                transition: 'border-color 0.1s',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={nameRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Category name"
            style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
          />
          <button
            onClick={handleCreate}
            style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500 }}
          >
            Add
          </button>
        </div>
      </div>
    </PanelShell>
  )
}
