import React, { useEffect, useState } from 'react'
import type { Category, EventType, TimelineEvent } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  event: TimelineEvent | null
  categories: Category[]
  isNew: boolean
  defaultCategoryId: string
  onClose: () => void
  onSave: (patch: Partial<TimelineEvent> & { id?: string }) => void
  onDelete: (id: string) => void
}

export function SidePanel({ event, categories, isNew, defaultCategoryId, onClose, onSave, onDelete }: Props) {
  const isMobile = useIsMobile()
  const [name, setName]         = useState('')
  const [type, setType]         = useState<EventType>('range')
  const [categoryId, setCatId]  = useState('')
  const [startDate, setStart]   = useState('')
  const [endDate, setEnd]       = useState('')
  const [notify, setNotify]     = useState(false)
  const [note, setNote]         = useState('')

  useEffect(() => {
    if (event) {
      setName(event.name)
      setType(event.type === 'open' ? 'range' : event.type)
      setCatId(event.categoryId)
      setStart(event.startDate ?? '')
      setEnd(event.endDate ?? '')
      setNotify(event.notifyForEnd)
      setNote(event.note ?? '')
    } else {
      setName('')
      setType('range')
      const fallback = categories.find(c => c.id === defaultCategoryId) ? defaultCategoryId : categories[0]?.id ?? ''
      setCatId(fallback)
      setStart('')
      setEnd('')
      setNotify(false)
      setNote('')
    }
  }, [event, categories, isNew, defaultCategoryId])

  const cat = categories.find(c => c.id === categoryId)
  const hidden = !event && !isNew

  const missingStart = type === 'range' && !startDate && !!endDate
  const showNotify   = type === 'range' && (!startDate || !endDate)
  const notifyLabel  = missingStart ? 'Notify for start date' : 'Notify for end date'
  const notifyHint   = missingStart ? 'Adds to pending list until start is filled in' : 'Adds to pending list until end is filled in'

  function handleSave() {
    const derivedType: EventType = type === 'pin' ? 'pin' : (!startDate || !endDate) ? 'open' : 'range'
    onSave({
      id: event?.id,
      name, type: derivedType, categoryId,
      startDate: startDate || null,
      endDate:   type === 'pin' ? null : endDate || null,
      notifyForEnd: showNotify ? notify : false,
      note: note || null,
    })
  }

  return (
    <aside style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : 380,
        background: 'var(--surface)', borderLeft: isMobile ? 'none' : '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.45)', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        transform: hidden ? 'translateX(105%)' : 'translateX(0)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>
        {/* Header - panel content */}
        <div style={{
          padding: '16px 18px 13px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4, color: cat?.color ?? 'var(--muted)' }}>
              {cat?.name ?? ''}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{isNew ? 'New event' : name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <Field label="Name">
            <input className="fi" value={name} onChange={e => setName(e.target.value)} style={fiStyle} />
          </Field>

          <Field label="Category">
            <select value={categoryId} onChange={e => setCatId(e.target.value)} style={{ ...fiStyle, appearance: 'none' }}>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
              {(['range', 'pin'] as EventType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: '6px 8px', background: type === t ? 'var(--s3)' : 'transparent',
                    border: 'none', borderRight: '1px solid var(--border)',
                    color: type === t ? 'var(--text)' : 'var(--muted)', fontSize: 12, textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
            <Field label={type === 'pin' ? 'Date' : 'Start'}>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={fiStyle} />
            </Field>
            {type !== 'pin' && (
              <Field label="End">
                <input type="date" value={endDate} onChange={e => setEnd(e.target.value)} style={fiStyle} />
              </Field>
            )}
          </div>

          {showNotify && (
            <Field>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px', gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 13 }}>{notifyLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{notifyHint}</div>
                </div>
                <div
                  onClick={() => setNotify(n => !n)}
                  style={{
                    width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
                    background: notify ? 'var(--accent)' : 'var(--border)', transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, width: 16, height: 16, background: 'white', borderRadius: '50%',
                    transition: 'left 0.15s, right 0.15s',
                    ...(notify ? { right: 2 } : { left: 2 }),
                  }} />
                </div>
              </div>
            </Field>
          )}

          <Field label="Note">
            <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...fiStyle, resize: 'vertical', minHeight: 60 }} />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '7px 13px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500 }}>
            Save
          </button>
          {event && !isNew && (
            <button onClick={() => onDelete(event.id)} style={{ padding: '7px 13px', borderRadius: 7, border: 'none', background: 'transparent', color: '#ff3b30', fontSize: 13 }}>
              Delete
            </button>
          )}
        </div>
      </aside>
  )
}

function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>}
      {children}
    </div>
  )
}

const fiStyle: React.CSSProperties = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none',
}
