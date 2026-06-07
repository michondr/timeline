import { useEffect, useMemo, useRef, useState } from 'react'
import type { AbsIntegration, Book, Category, Habit, HabitIntegration, TickTickTodo, TimelineEvent } from './types'
import type { DerivedKeys } from './crypto'
import { decryptField, encryptField } from './crypto'
import * as api from './api'
import { useTimelineView } from './hooks/useTimelineView'
import { Topbar } from './components/Topbar'
import { Timeline } from './components/Timeline'
import { SidePanel } from './components/SidePanel'
import { PendingPanel } from './components/PendingPanel'
import { TodoPanel } from './components/TodoPanel'
import { ToastProvider } from './components/Toast'
import { CategoryPanel } from './components/CategoryPanel'
import { HabitSettingsPanel } from './components/HabitSettingsPanel'
import { AbsSettingsPanel } from './components/AbsSettingsPanel'
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
  const [, setDateFormat] = useState<DateFormat>('DMY-dot')

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents]         = useState<TimelineEvent[]>([])

  const [habits, setHabits]                   = useState<Habit[]>([])
  const [todos, setTodos]                     = useState<TickTickTodo[]>([])
  const [todosLoading, setTodosLoading]       = useState(false)
  const [habitIntegration, setHabitIntegration] = useState<HabitIntegration | null>(null)
  const [habitSettingsOpen, setHabitSettings]   = useState(false)

  const [books, setBooks]                       = useState<Book[]>([])
  const [absIntegration, setAbsIntegration]     = useState<AbsIntegration | null>(null)
  const [absSettingsOpen, setAbsSettings]       = useState(false)

  const [editEvent, setEditEvent]       = useState<TimelineEvent | null>(null)
  const [isNewEvent, setIsNewEvent]     = useState(false)
  const [pendingOpen, setPendingOpen]   = useState(false)
  const [todoOpen, setTodoOpen]         = useState(false)
  const [catModalOpen, setCatModal]     = useState(false)
  const [activePreset, setActivePreset] = useState(12)

  const [filterOpen, setFilterOpen]   = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const [catAutoFocusNew, setCatAutoFocusNew] = useState(false)
  const [catExpandId, setCatExpandId]         = useState<string | null>(null)

  const [lastCatId, setLastCatId]   = useState(() => localStorage.getItem('timeline_last_cat') ?? '')
  const [showHabits, setShowHabits] = useState(() => localStorage.getItem('timeline_show_habits') !== 'false')
  const [showBooks, setShowBooks]   = useState(() => localStorage.getItem('timeline_show_books') !== 'false')
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(
    () => new Set<string>(JSON.parse(localStorage.getItem('timeline_hidden_cats') ?? '[]')))

  const habitFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { view, setPreset, pan, zoom, zoomBy, fitRange, setSpan, seekTo } = useTimelineView(TODAY)
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const pendingEvents = events.filter(e => e.notifyForEnd && (!e.startDate || !e.endDate))

  // Pan scrollbar upper bound: latest range-event end, or today+1y if nothing extends further
  const panEndMs = useMemo(() => {
    const DAY_MS = 86_400_000
    const floor  = TODAY.getTime() + 365 * DAY_MS
    const evMax  = events
      .filter(e => e.type === 'range')
      .reduce((m, e) => {
        const d = e.endDate ?? e.startDate
        return d ? Math.max(m, new Date(d + 'T00:00:00').getTime()) : m
      }, -Infinity)
    return Number.isFinite(evMax) ? Math.max(floor, evMax) : floor
  }, [events])

  // A query starting with new/edit/toggle is a command, not a filter → no live dimming
  const commandLike = /^\s*(new|edit|toggle)\b/i.test(filterQuery)
  const filter = useMemo(
    () => commandLike ? { ids: null, error: null, matched: 0 } : applyFilter(filterQuery, events, categories),
    [filterQuery, events, categories, commandLike])

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

  // ── Load ABS integration and books once on ready ──────────────────────
  useEffect(() => {
    if (phase !== 'ready') return
    api.fetchAbsIntegration()
      .then(raw => {
        setAbsIntegration(raw)
        if (raw.hasCredentials) {
          api.fetchBooks().then(setBooks).catch(() => {})
        }
      })
      .catch(() => {})
  }, [phase])

  // ── Load todos when integration is confirmed active ────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !habitIntegration?.hasToken) return
    setTodosLoading(true)
    api.fetchTodos().then(setTodos).catch(() => {}).finally(() => setTodosLoading(false))
  }, [phase, habitIntegration?.hasToken])

  async function handleTodoDone(id: string, projectId: string) {
    await api.completeTodo(id, projectId)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function handleTodoWontDo(id: string, projectId: string) {
    await api.abandonTodo(id, projectId)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  // ── Visibility controls ───────────────────────────────────────────────
  function setHabitsVis(v: boolean) { setShowHabits(v); localStorage.setItem('timeline_show_habits', String(v)) }
  function setBooksVis(v: boolean)  { setShowBooks(v);  localStorage.setItem('timeline_show_books',  String(v)) }

  function persistHidden(s: Set<string>) { localStorage.setItem('timeline_hidden_cats', JSON.stringify([...s])) }

  function toggleCatVis(id: string) {
    setHiddenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      persistHidden(next)
      return next
    })
  }

  function showAllCats() {
    const empty = new Set<string>(); setHiddenCats(empty); persistHidden(empty)
    setHabitsVis(true); setBooksVis(true)
  }

  function hideAllCats() {
    const all = new Set(categories.map(c => c.id)); setHiddenCats(all); persistHidden(all)
    setHabitsVis(false); setBooksVis(false)
  }

  async function handleHabitSave(token: string) {
    await api.saveHabitToken(token)
    const integration = await api.fetchHabitIntegration()
    setHabitIntegration(integration)
  }

  async function handleHabitSync() {
    await api.triggerHabitSync()
    setTimeout(async () => {
      const [integration] = await Promise.all([
        api.fetchHabitIntegration(),
        api.fetchTodos().then(setTodos).catch(() => {}),
      ])
      setHabitIntegration(integration)
    }, 3000)
  }

  async function handleAbsSave(url: string, token: string) {
    await api.saveAbsIntegration(url, token)
    const integration = await api.fetchAbsIntegration()
    setAbsIntegration(integration)
    if (integration.hasCredentials) {
      api.fetchBooks().then(setBooks).catch(() => {})
    }
  }

  async function handleRefresh() {
    if (!encKey) return
    const key = encKey
    const from = new Date(view.startMs).toISOString().slice(0, 10)
    const to   = new Date(view.endMs).toISOString().slice(0, 10)
    await Promise.all([
      Promise.all([api.fetchCategories(), api.fetchEvents()])
        .then(async ([rawCats, rawEvts]) => {
          const cats = await Promise.all(rawCats.map(async c => ({ ...c, name: await decryptField(key, c.name) })))
          const evts = await Promise.all(rawEvts.map(async e => ({ ...e, name: await decryptField(key, e.name), note: e.note ? await decryptField(key, e.note) : null })))
          setCategories(cats); setEvents(evts)
        }),
      api.fetchHabits(from, to).then(raw => setHabits(raw.map(h => ({ ...h, logs: h.logs ?? {} })))).catch(() => {}),
      api.fetchHabitIntegration().then(setHabitIntegration).catch(() => {}),
      api.fetchAbsIntegration().then(raw => { setAbsIntegration(raw); if (raw.hasCredentials) api.fetchBooks().then(setBooks).catch(() => {}) }).catch(() => {}),
      api.fetchTodos().then(setTodos).catch(() => {}),
    ])
  }

  async function handleAbsSync() {
    await api.triggerAbsSync()
    setTimeout(async () => {
      const [integration] = await Promise.all([
        api.fetchAbsIntegration(),
        api.fetchBooks().then(setBooks).catch(() => {}),
      ])
      setAbsIntegration(integration)
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
    const DAY_MS = 86_400_000
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') {
        setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setTodoOpen(false); setCatModal(false); setFilterOpen(false)
        return
      }
      if (typing || filterOpen) return
      if (e.key === ' ') {
        e.preventDefault(); setFilterOpen(true)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const { startMs, endMs } = viewRef.current
        const span     = endMs - startMs
        const spanDays = span / DAY_MS
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const unit =
            spanDays <= 3    ? 6 * 3_600_000 :
            spanDays <= 21   ? DAY_MS :
            spanDays <= 400  ? 30 * DAY_MS :
            spanDays <= 1500 ? 91 * DAY_MS :
                               365 * DAY_MS
          pan(e.key === 'ArrowLeft' ? -unit : unit)
        } else {
          setSpan(span * (e.key === 'ArrowUp' ? 1 / 1.3 : 1.3))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filterOpen, pan, setSpan])

  function openNew() {
    setEditEvent(null); setIsNewEvent(true); setPendingOpen(false); setTodoOpen(false)
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
    if (ev) { setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false); setTodoOpen(false) }
  }

  function handleEditEventFromCat(ev: TimelineEvent) {
    setEditEvent(ev); setIsNewEvent(false); setPendingOpen(false); setTodoOpen(false)
  }

  // ── Command palette dispatch (keywords typed in the filter input) ──────
  function matchByName<T extends { name: string }>(name: string, items: T[]): T | undefined {
    const q = name.trim().toLowerCase()
    if (!q) return undefined
    return items.find(i => i.name.toLowerCase() === q)
        ?? items.find(i => i.name.toLowerCase().startsWith(q))
        ?? items.find(i => i.name.toLowerCase().includes(q))
  }

  function openNewCategory() {
    closeAll(); setCatExpandId(null); setCatAutoFocusNew(true); setCatModal(true)
  }

  function openEditCategory(cat: Category) {
    closeAll(); setCatAutoFocusNew(false); setCatExpandId(cat.id); setCatModal(true)
  }

  // Returns true if the query was a recognised command (executed), false → treat as filter
  function runQuery(raw: string): void {
    const q  = raw.trim()
    const lc = q.toLowerCase()

    if (lc === 'new' || lc === 'new event') { setFilterOpen(false); setFilterQuery(''); openNew(); return }
    if (lc === 'new category' || lc === 'new cat') { setFilterOpen(false); setFilterQuery(''); openNewCategory(); return }

    // toggle visibility — keep the palette open so several can be flipped in a row
    const mTog = q.match(/^toggle\s+(?:category\s+)?(.+)$/i)
    if (mTog) {
      const tl = mTog[1].trim().toLowerCase()
      if (tl === 'habits' || tl === 'habit') { setHabitsVis(!showHabits); setFilterQuery(''); return }
      if (tl === 'books'  || tl === 'book')  { setBooksVis(!showBooks);   setFilterQuery(''); return }
      const cat = matchByName(mTog[1].trim(), categories)
      if (cat) { toggleCatVis(cat.id); setFilterQuery('') }
      return
    }

    const mCat = q.match(/^edit\s+category\s+(.+)$/i)
    if (mCat) {
      const cat = matchByName(mCat[1], categories)
      if (cat) { setFilterOpen(false); setFilterQuery(''); openEditCategory(cat) }
      return
    }
    const mEdit = q.match(/^edit\s+(.+)$/i)
    if (mEdit) {
      const ev = matchByName(mEdit[1], events)
      if (ev) { setFilterOpen(false); setFilterQuery(''); handleEventClick(ev.id); return }
      const cat = matchByName(mEdit[1], categories)
      if (cat) { setFilterOpen(false); setFilterQuery(''); openEditCategory(cat); return }
      return   // no match → leave palette open so the user can adjust
    }

    closeFilter()   // not a command → apply filter + fit
  }

  function closeAll() {
    setEditEvent(null); setIsNewEvent(false); setPendingOpen(false); setTodoOpen(false); setCatModal(false); setHabitSettings(false); setAbsSettings(false)
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
        rangeEventId: patch.rangeEventId ?? null,
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
        rangeEventId: patch.rangeEventId ?? null,
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
        rangeEventId: created.rangeEventId,
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
    <ToastProvider>
      <Topbar
        pendingCount={pendingEvents.length}
        todoCount={todos.length}
        todosLoading={todosLoading}
        habitIntegration={habitIntegration}
        absIntegration={absIntegration}
        view={view}
        today={TODAY}
        birthdate={birthdate}
        panEndMs={panEndMs}
        onNewEvent={openNew}
        onPending={() => { setTodoOpen(false); setPendingOpen(p => !p) }}
        onTodos={() => { setPendingOpen(false); setTodoOpen(t => !t) }}
        onCategories={() => { setCatAutoFocusNew(false); setCatExpandId(null); setCatModal(c => !c) }}
        onExport={handleExport}
        onHabitSettings={() => { closeAll(); setHabitSettings(true) }}
        onHabitSync={handleHabitSync}
        onAbsSettings={() => { closeAll(); setAbsSettings(true) }}
        onAbsSync={handleAbsSync}
        onRefresh={handleRefresh}
        onSetSpan={setSpan}
        onSeek={seekTo}
      />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <Timeline
          view={view}
          today={TODAY}
          birthdate={birthdate}
          categories={categories}
          events={events}
          habits={habits}
          books={books}
          showHabits={showHabits}
          showBooks={showBooks}
          hiddenCats={hiddenCats}
          filterIds={filter.ids}
          onPan={pan}
          onZoom={zoom}
          onZoomBy={zoomBy}
          onEventClick={handleEventClick}
          onBackgroundClick={closeAll}
          onDoubleTap={() => setFilterOpen(true)}
        />

        <SidePanel
          event={editEvent}
          categories={categories}
          events={events}
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

        <TodoPanel
          todos={todos}
          open={todoOpen}
          onClose={() => setTodoOpen(false)}
          onDone={handleTodoDone}
          onWontDo={handleTodoWontDo}
        />

        <CategoryPanel
          open={catModalOpen}
          categories={categories}
          events={events}
          autoFocusNew={catAutoFocusNew}
          expandId={catExpandId}
          onClose={() => { setCatModal(false); setCatAutoFocusNew(false); setCatExpandId(null) }}
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

        <AbsSettingsPanel
          open={absSettingsOpen}
          integration={absIntegration}
          onClose={() => setAbsSettings(false)}
          onSave={handleAbsSave}
          onSync={handleAbsSync}
        />

        <FilterBar
          open={filterOpen}
          query={filterQuery}
          error={commandLike || !filterQuery.trim() ? null : filter.error}
          matched={filter.matched}
          total={events.length}
          events={events}
          categories={categories}
          hiddenCats={hiddenCats}
          showHabits={showHabits}
          showBooks={showBooks}
          activePreset={activePreset}
          onChange={setFilterQuery}
          onSubmit={runQuery}
          onClose={() => setFilterOpen(false)}
          onClear={() => { setFilterQuery(''); setFilterOpen(false) }}
          onToggleCat={toggleCatVis}
          onSetHabits={setHabitsVis}
          onSetBooks={setBooksVis}
          onShowAll={showAllCats}
          onHideAll={hideAllCats}
          onPreset={handlePreset}
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
    </ToastProvider>
  )
}
