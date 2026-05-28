import { useEffect, useState } from 'react'
import type { Category, TimelineEvent } from './types'
import type { DerivedKeys } from './crypto'
import { decryptField, encryptField } from './crypto'
import * as api from './api'
import { useTimelineView } from './hooks/useTimelineView'
import { Topbar } from './components/Topbar'
import { Timeline } from './components/Timeline'
import { SidePanel } from './components/SidePanel'
import { PendingPanel } from './components/PendingPanel'
import { CategoryPanel } from './components/CategoryPanel'
import { AuthFlow } from './components/AuthFlow'
import type { DateFormat } from './components/AuthFlow'

type Phase = 'loading' | 'auth' | 'unlock' | 'ready'

const TODAY = new Date()

export default function App() {
  const [phase, setPhase]           = useState<Phase>('loading')
  const [encKey, setEncKey]         = useState<CryptoKey | null>(null)
  const [birthdate, setBirthdate]   = useState(new Date())
  const [dateFormat, setDateFormat] = useState<DateFormat>('DMY-dot')

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents]         = useState<TimelineEvent[]>([])

  const [editEvent, setEditEvent]       = useState<TimelineEvent | null>(null)
  const [isNewEvent, setIsNewEvent]     = useState(false)
  const [pendingOpen, setPendingOpen]   = useState(false)
  const [catModalOpen, setCatModal]     = useState(false)
  const [activePreset, setActivePreset] = useState(12)

  const { view, setPreset, pan, zoom } = useTimelineView(TODAY)
  const pendingEvents = events.filter(e => e.notifyForEnd && (!e.startDate || !e.endDate))

  // ── Check stored token on mount ───────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('timeline_token')
    if (!token) { setPhase('auth'); return }
    api.getMe()
      .then(() => setPhase('unlock'))
      .catch(() => { localStorage.removeItem('timeline_token'); setPhase('auth') })
  }, [])

  // ── Handle token expiry from API ──────────────────────────────────────
  useEffect(() => {
    function onExpired() {
      setEncKey(null)
      setCategories([])
      setEvents([])
      setPhase('auth')
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  // ── Load data when authenticated ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !encKey) return
    const key = encKey
    Promise.all([api.fetchCategories(), api.fetchEvents()])
      .then(async ([rawCats, rawEvts]) => {
        const cats = await Promise.all(rawCats.map(async c => ({
          ...c,
          name: await decryptField(key, c.name),
        })))
        const evts = await Promise.all(rawEvts.map(async e => ({
          ...e,
          name: await decryptField(key, e.name),
          note: e.note ? await decryptField(key, e.note) : null,
        })))
        setCategories(cats)
        setEvents(evts)
      })
      .catch(console.error)
  }, [phase, encKey])

  function onAuth(keys: DerivedKeys, _token: string, birthdateStr: string, fmt: DateFormat) {
    setEncKey(keys.encKey)
    setBirthdate(new Date(birthdateStr + 'T00:00:00'))
    setDateFormat(fmt)
    setPhase('ready')
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setCatModal(false)
        return
      }
      if ((e.key === 'n' || e.key === 'N') &&
          (e.target as HTMLElement).tagName !== 'INPUT' &&
          (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        openNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catModalOpen])

  function openNew() {
    setEditEvent(null); setIsNewEvent(true); setPendingOpen(false)
  }

  function handleEventClick(id: string) {
    const ev = events.find(e => e.id === id)
    if (ev) { setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false) }
  }

  function handleEditEventFromCat(ev: TimelineEvent) {
    setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false)
  }

  function closeAll() {
    setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setCatModal(false)
  }

  async function handleSave(patch: Partial<TimelineEvent> & { id?: string }) {
    if (!encKey) return
    const encName = await encryptField(encKey, patch.name ?? '')
    const encNote = patch.note ? await encryptField(encKey, patch.note) : null

    if (patch.id) {
      await api.updateEvent(patch.id, {
        name: encName, note: encNote,
        type: patch.type, categoryId: patch.categoryId,
        startDate: patch.startDate ?? null,
        endDate: patch.endDate ?? null,
        notifyForEnd: patch.notifyForEnd,
      })
      setEvents(prev => prev.map(e => e.id === patch.id ? { ...e, ...patch } : e))
    } else {
      const created = await api.createEvent({
        categoryId: patch.categoryId ?? categories[0]?.id ?? '',
        name: encName,
        type: patch.type ?? 'range',
        startDate: patch.startDate ?? null,
        endDate: patch.endDate ?? null,
        notifyForEnd: patch.notifyForEnd ?? false,
        note: encNote,
      })
      setEvents(prev => [...prev, {
        id: created.id,
        categoryId: created.categoryId,
        name: patch.name ?? '',
        type: created.type,
        startDate: created.startDate,
        endDate: created.endDate,
        notifyForEnd: created.notifyForEnd,
        note: patch.note ?? null,
      }])
    }
    setEditEvent(null)
    setIsNewEvent(false)
  }

  async function handleDelete(id: string) {
    await api.deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setEditEvent(null)
  }

  async function handleCreateCat(name: string, color: string) {
    if (!encKey) return
    const encName = await encryptField(encKey, name)
    const created = await api.createCategory(encName, color)
    setCategories(prev => [...prev, { ...created, name }])
  }

  async function handleDeleteCat(id: string) {
    await api.deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  function handlePreset(months: number) {
    setActivePreset(months); setPreset(months)
  }

  function handleExport() {
    const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id
    const escape  = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header  = ['name', 'category', 'type', 'start', 'end', 'notifyForEnd', 'note']
    const rows    = events.map(ev => [
      ev.name,
      catName(ev.categoryId),
      ev.type,
      ev.startDate ?? '',
      ev.endDate   ?? '',
      ev.notifyForEnd ? 'yes' : 'no',
      ev.note ?? '',
    ])
    const csv  = [header, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'timeline.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Auth screens ──────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (phase === 'auth') {
    return <AuthFlow mode="auth" onAuth={onAuth} />
  }

  if (phase === 'unlock') {
    return <AuthFlow mode="unlock" onAuth={onAuth} />
  }

  // ── Timeline ──────────────────────────────────────────────────────────
  return (
    <>
      <Topbar
        pendingCount={pendingEvents.length}
        onNewEvent={openNew}
        onPending={() => setPendingOpen(p => !p)}
        onCategories={() => setCatModal(c => !c)}
        onExport={handleExport}
        onPreset={handlePreset}
        activePreset={activePreset}
      />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <Timeline
          view={view}
          today={TODAY}
          birthdate={birthdate}
          categories={categories}
          events={events}
          onPan={pan}
          onZoom={zoom}
          onEventClick={handleEventClick}
          onBackgroundClick={closeAll}
        />

        <SidePanel
          event={editEvent}
          categories={categories}
          isNew={isNewEvent}
          onClose={() => { setEditEvent(null); setIsNewEvent(false) }}
          onSave={handleSave}
          onDelete={handleDelete}
        />

        <PendingPanel
          events={pendingEvents}
          categories={categories}
          open={pendingOpen}
          onClose={() => setPendingOpen(false)}
          onSelect={ev => { setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false) }}
        />

        <CategoryPanel
          open={catModalOpen}
          categories={categories}
          events={events}
          onClose={() => setCatModal(false)}
          onCreate={handleCreateCat}
          onDelete={handleDeleteCat}
          onEditEvent={handleEditEventFromCat}
        />
      </div>
    </>
  )
}
