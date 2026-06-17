import React, { useEffect, useRef, useState } from 'react'
import type { Category, EventType, TimelineEvent } from '../types'
import { PanelShell } from './PanelShell'

interface Props {
  open: boolean
  event: TimelineEvent | null
  categories: Category[]
  events: TimelineEvent[]
  isNew: boolean
  defaultCategoryId: string
  onClose: () => void
  onSave: (patch: Partial<TimelineEvent> & { id?: string }) => void
  onDelete: (id: string) => void
  onPinCreate: (parent: TimelineEvent, date: string, name: string) => void | Promise<void>
  onPinUpdate: (id: string, name: string) => void | Promise<void>
  onPinDelete: (id: string) => void | Promise<void>
}

export function SidePanel({ open, event, categories, events, isNew, defaultCategoryId, onClose, onSave, onDelete, onPinCreate, onPinUpdate, onPinDelete }: Props) {
  const nameRef                 = useRef<HTMLInputElement>(null)
  const [name, setName]         = useState('')
  const [type, setType]         = useState<EventType>('range')
  const [categoryId, setCatId]  = useState('')
  const [startDate, setStart]   = useState('')
  const [endDate, setEnd]       = useState('')
  const [notify, setNotify]         = useState(false)
  const [rangeEventId, setRangeEvId] = useState<string>('')
  const [note, setNote]              = useState('')

  useEffect(() => {
    // Don't re-sync while closing — keeps the body from blanking mid slide-out
    if (!open) return
    if (event) {
      setName(event.name)
      setType(event.type === 'open' ? 'range' : event.type)
      setCatId(event.categoryId)
      setStart(event.startDate ?? '')
      setEnd(event.endDate ?? '')
      setNotify(event.notifyForEnd)
      setRangeEvId(event.rangeEventId ?? '')
      setNote(event.note ?? '')
    } else {
      setName('')
      setType('range')
      const fallback = categories.find(c => c.id === defaultCategoryId) ? defaultCategoryId : categories[0]?.id ?? ''
      setCatId(fallback)
      setStart('')
      setEnd('')
      setNotify(false)
      setRangeEvId('')
      setNote('')
    }
  }, [open, event, categories, isNew, defaultCategoryId])

  // Focus the name field when the panel opens for a brand-new event.
  // preventScroll: the panel is still mid slide-in, so a normal focus would
  // scroll the not-yet-settled input into view and reflow the timeline.
  useEffect(() => {
    if (isNew && !event) { const t = setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 80); return () => clearTimeout(t) }
  }, [isNew, event])

  const cat = categories.find(c => c.id === categoryId)

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
      rangeEventId: type === 'pin' ? (rangeEventId || null) : null,
    })
  }

  return (
    <PanelShell
      open={open}
      eyebrow={cat?.name ?? ''}
      eyebrowColor={cat?.color ?? 'var(--muted)'}
      title={isNew ? 'New event' : name}
      onClose={onClose}
    >
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <Field label="Name">
            <input ref={nameRef} className="fi" value={name} onChange={e => setName(e.target.value)} style={fiStyle} />
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

          {type === 'pin' && (
            <Field label="Part of range event">
              <select
                value={rangeEventId}
                onChange={e => setRangeEvId(e.target.value)}
                style={{ ...fiStyle, appearance: 'none' }}
              >
                <option value="">— none —</option>
                {events
                  .filter(e => (e.type === 'range' || e.type === 'open') && e.categoryId === categoryId)
                  .map(e => (
                    <option key={e.id} value={e.id}>{e.name}{e.type === 'open' ? ' (open)' : ''}</option>
                  ))}
              </select>
            </Field>
          )}

          {!isNew && event && type !== 'pin' && (
            <PinnedEvents
              pins={events.filter(e => e.type === 'pin' && e.rangeEventId === event.id)}
              onCreate={(date, name) => onPinCreate(event, date, name)}
              onUpdate={onPinUpdate}
              onDelete={onPinDelete}
            />
          )}

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
    </PanelShell>
  )
}

function PinnedEvents({
  pins, onCreate, onUpdate, onDelete,
}: {
  pins: TimelineEvent[]
  onCreate: (date: string, name: string) => void | Promise<void>
  onUpdate: (id: string, name: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [newDate, setNewDate]     = useState('')
  const [newName, setNewName]     = useState('')

  const nameRefs = useRef<(HTMLDivElement | null)[]>([])
  const delRefs  = useRef<(HTMLButtonElement | null)[]>([])
  const editRef  = useRef<HTMLInputElement>(null)

  const sorted = [...pins].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))

  // Focus the edit field once it renders in place of the name.
  useEffect(() => { if (editingId) editRef.current?.focus() }, [editingId])

  function startEdit(p: TimelineEvent) {
    setEditName(p.name)
    setEditingId(p.id)
  }

  function commitEdit(refocusIndex?: number) {
    if (editingId) {
      const trimmed  = editName.trim()
      const original = sorted.find(p => p.id === editingId)
      if (trimmed && original && trimmed !== original.name) onUpdate(editingId, trimmed)
    }
    setEditingId(null)
    if (refocusIndex != null) requestAnimationFrame(() => nameRefs.current[refocusIndex]?.focus())
  }

  function add() {
    const trimmed = newName.trim()
    if (!trimmed) return
    onCreate(newDate, trimmed)
    setNewDate('')
    setNewName('')
  }

  return (
    <Field label="Pinned events">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No pinned events yet.</div>
        )}
        {sorted.map((p, i) => {
          const editing = editingId === p.id
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 78, fontVariantNumeric: 'tabular-nums' }}>
                {p.startDate ?? '—'}
              </span>
              {editing ? (
                <input
                  ref={editRef}
                  className="fi"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')       { e.preventDefault(); commitEdit(i) }
                    else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); requestAnimationFrame(() => nameRefs.current[i]?.focus()) }
                  }}
                  style={{ ...fiStyle, flex: 1, padding: '4px 8px' }}
                />
              ) : (
                <div
                  ref={el => { nameRefs.current[i] = el }}
                  tabIndex={0}
                  onClick={() => startEdit(p)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')           { e.preventDefault(); startEdit(p) }
                    else if (e.key === 'ArrowDown')  { e.preventDefault(); nameRefs.current[i + 1]?.focus() }
                    else if (e.key === 'ArrowUp')    { e.preventDefault(); nameRefs.current[i - 1]?.focus() }
                    else if (e.key === 'ArrowRight') { e.preventDefault(); delRefs.current[i]?.focus() }
                  }}
                  style={{ flex: 1, fontSize: 13, cursor: 'text', padding: '4px 6px', outline: 'none', borderRadius: 5 }}
                >
                  {p.name}
                </div>
              )}
              <button
                ref={el => { delRefs.current[i] = el }}
                onClick={() => editing ? commitEdit(i) : onDelete(p.id)}
                onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); nameRefs.current[i]?.focus() } }}
                title={editing ? 'Save' : 'Delete'}
                style={{
                  flexShrink: 0, width: 24, height: 24, display: 'grid', placeItems: 'center',
                  border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 5,
                  color: editing ? '#34c759' : '#ff3b30', fontSize: 15, lineHeight: 1,
                }}
              >
                {editing ? '✓' : '✕'}
              </button>
            </div>
          )
        })}

        {/* Add row — date + text is enough to create a pin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ ...fiStyle, width: 'auto', minWidth: 78, padding: '4px 8px', fontSize: 11 }}
          />
          <input
            className="fi"
            value={newName}
            placeholder="Add pinned event…"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            style={{ ...fiStyle, flex: 1, padding: '4px 8px' }}
          />
          <button
            onClick={add}
            disabled={!newName.trim()}
            title="Add"
            style={{
              flexShrink: 0, width: 24, height: 24, display: 'grid', placeItems: 'center',
              border: 'none', background: 'transparent', cursor: newName.trim() ? 'pointer' : 'default',
              borderRadius: 5, color: newName.trim() ? 'var(--accent)' : 'var(--muted)', fontSize: 18, lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      </div>
    </Field>
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
