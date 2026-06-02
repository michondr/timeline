import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, Habit, HabitIntegration, TimelineEvent } from './types'
import type { DerivedKeys } from './crypto'
import { decryptField, encryptField } from './crypto'
import * as api from './api'
import { useTimelineView } from './hooks/useTimelineView'
import { Topbar } from './components/Topbar'
import { Timeline } from './components/Timeline'
import { SidePanel } from './components/SidePanel'
import { PendingPanel } from './components/PendingPanel'
import { CategoryPanel } from './components/CategoryPanel'
import { HabitSettingsPanel } from './components/HabitSettingsPanel'
import { FilterBar } from './components/FilterBar'
import { applyFilter } from './filter'
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

  const [habits, setHabits]                   = useState<Habit[]>([])
  const [habitIntegration, setHabitIntegration] = useState<HabitIntegration | null>(null)
  const [habitSettingsOpen, setHabitSettings]   = useState(false)

  const [editEvent, setEditEvent]       = useState<TimelineEvent | null>(null)
  const [isNewEvent, setIsNewEvent]     = useState(false)
  const [pendingOpen, setPendingOpen]   = useState(false)
  const [catModalOpen, setCatModal]     = useState(false)
  const [activePreset, setActivePreset] = useState(12)

  const [filterOpen, setFilterOpen]   = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const [lastCatId, setLastCatId]   = useState(() => localStorage.getItem('timeline_last_cat') ?? '')
  const [showHabits, setShowHabits] = useState(() => localStorage.getItem('timeline_show_habits') !== 'false')
  const [showBooks, setShowBooks]   = useState(() => localStorage.getItem('timeline_show_books') !== 'false')

  const habitFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { view, setPreset, pan, zoom, fitRange } = useTimelineView(TODAY)
  const pendingEvents = events.filter(e => e.notifyForEnd && (!e.startDate || !e.endDate))

  const filter = useMemo(() => applyFilter(filterQuery, events, categories), [filterQuery, events, categories])

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

  // ── Load habits when view changes (debounced) ─────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return
    if (!showHabits) { setHabits([]); return }
    if (habitFetchTimer.current) clearTimeout(habitFetchTimer.current)
    habitFetchTimer.current = setTimeout(async () => {
      try {
        const from = new Date(view.startMs).toISOString().slice(0, 10)
        const to   = new Date(view.endMs).toISOString().slice(0, 10)
        const raw  = await api.fetchHabits(from, to)
        setHabits(raw.map(h => ({ ...h, logs: h.logs ?? {} })))
      } catch { /* silently ignore — no habits yet */ }
    }, 300)
  }, [phase, view.startMs, view.endMs, showHabits])

  // ── Load integration status once on ready ─────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return
    api.fetchHabitIntegration().then(setHabitIntegration).catch(() => {})
  }, [phase])

  function toggleHabits() {
    setShowHabits(v => { const nv = !v; localStorage.setItem('timeline_show_habits', String(nv)); return nv })
  }

  function toggleBooks() {
    setShowBooks(v => { const nv = !v; localStorage.setItem('timeline_show_books', String(nv)); return nv })
  }

  async function handleHabitSave(token: string) {
    await api.saveHabitToken(token)
    const integration = await api.fetchHabitIntegration()
    setHabitIntegration(integration)
  }

  async function handleHabitSync() {
    await api.triggerHabitSync()
    setTimeout(async () => {
      const integration = await api.fetchHabitIntegration()
      setHabitIntegration(integration)
    }, 3000)
  }

  function onAuth(keys: DerivedKeys, _token: string, birthdateStr: string, fmt: DateFormat) {
    setEncKey(keys.encKey)
    setBirthdate(new Date(birthdateStr + 'T00:00:00'))
    setDateFormat(fmt)
    setPhase('ready')
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') {
        setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setCatModal(false); setFilterOpen(false)
        return
      }
      if (e.key === ' ' && !typing && !filterOpen) {
        e.preventDefault(); setFilterOpen(true)
        return
      }
      if ((e.key === 'n' || e.key === 'N') && !typing) {
        openNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catModalOpen, filterOpen])

  function openNew() {
    setEditEvent(null); setIsNewEvent(true); setPendingOpen(false)
  }

  // Zoom/pan the viewport so every matching event fits in view
  function fitToFilter() {
    const ids = filter.ids
    if (!ids || ids.size === 0) return
    let lo = Infinity, hi = -Infinity
    for (const ev of events) {
      if (!ids.has(ev.id)) continue
      const s = ev.startDate ? new Date(ev.startDate + 'T00:00:00').getTime()
              : ev.endDate   ? new Date(ev.endDate   + 'T00:00:00').getTime() : null
      if (s == null) continue
      const e = ev.endDate ? new Date(ev.endDate + 'T00:00:00').getTime() : s
      lo = Math.min(lo, s, e); hi = Math.max(hi, s, e)
    }
    if (Number.isFinite(lo) && Number.isFinite(hi)) fitRange(lo, hi)
  }

  function closeFilter() {
    setFilterOpen(false)
    fitToFilter()
  }

  function handleEventClick(id: string) {
    const ev = events.find(e => e.id === id)
    if (ev) { setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false) }
  }

  function handleEditEventFromCat(ev: TimelineEvent) {
    setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false)
  }

  function closeAll() {
    setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setCatModal(false); setHabitSettings(false)
  }

  async function handleSave(patch: Partial<TimelineEvent> & { id?: string }) {
    if (!encKey) return
    if (patch.categoryId) {
      setLastCatId(patch.categoryId)
      localStorage.setItem('timeline_last_cat', patch.categoryId)
    }
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
        habitIntegration={habitIntegration}
        onNewEvent={openNew}
        onPending={() => setPendingOpen(p => !p)}
        onCategories={() => setCatModal(c => !c)}
        onExport={handleExport}
        onHabitSettings={() => { closeAll(); setHabitSettings(true) }}
        onHabitSync={handleHabitSync}
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
          habits={habits}
          showHabits={showHabits}
          showBooks={showBooks}
          onToggleHabits={toggleHabits}
          onToggleBooks={toggleBooks}
          filterIds={filter.ids}
          onPan={pan}
          onZoom={zoom}
          onEventClick={handleEventClick}
          onBackgroundClick={closeAll}
        />

        <SidePanel
          event={editEvent}
          categories={categories}
          isNew={isNewEvent}
          defaultCategoryId={lastCatId}
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

        <HabitSettingsPanel
          open={habitSettingsOpen}
          integration={habitIntegration}
          onClose={() => setHabitSettings(false)}
          onSave={handleHabitSave}
          onSync={handleHabitSync}
        />

        <FilterBar
          open={filterOpen}
          query={filterQuery}
          error={filterQuery.trim() ? filter.error : null}
          matched={filter.matched}
          total={events.length}
          categoryNames={categories.map(c => c.name)}
          onChange={setFilterQuery}
          onClose={closeFilter}
          onClear={() => { setFilterQuery(''); setFilterOpen(false) }}
        />

        {filter.ids && !filterOpen && (
          <button
            onClick={() => setFilterOpen(true)}
            style={{
              position: 'absolute', left: 14, bottom: 14, zIndex: 15,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 20,
              color: 'var(--text)', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ color: 'var(--muted)' }}>filter:</span>
            <span style={{ fontWeight: 500 }}>{filterQuery}</span>
            <span
              onClick={e => { e.stopPropagation(); setFilterQuery('') }}
              style={{ color: 'var(--muted)', marginLeft: 2 }}
            >✕</span>
          </button>
        )}
      </div>
    </>
  )
}
