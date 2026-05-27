import { useCallback, useEffect, useState } from 'react'
import { Category, TimelineEvent } from './types'
import { useTimelineView } from './hooks/useTimelineView'
import { Topbar } from './components/Topbar'
import { Timeline } from './components/Timeline'
import { SidePanel } from './components/SidePanel'
import { PendingPanel } from './components/PendingPanel'
import { CategoryModal } from './components/CategoryModal'

// ── Demo data (replace with API calls once auth is wired) ────────────────────
const TODAY    = new Date('2026-05-27')
const BIRTH    = new Date('1993-09-15')

const DEMO_CATS: Category[] = [
  { id: 'work',   name: 'Work',      color: '#4a9eff', isSystem: false, systemSlug: null },
  { id: 'travel', name: 'Travel',    color: '#34c759', isSystem: false, systemSlug: null },
  { id: 'health', name: 'Health',    color: '#ff6b6b', isSystem: false, systemSlug: null },
  { id: 'edu',    name: 'Education', color: '#bf5af2', isSystem: false, systemSlug: null },
  { id: 'habits', name: 'Habits',    color: '#ff9f0a', isSystem: true,  systemSlug: 'habits' },
  { id: 'books',  name: 'Books',     color: '#ff9500', isSystem: true,  systemSlug: 'books'  },
]

const DEMO_EVENTS: TimelineEvent[] = [
  { id: 'c1', categoryId: 'work',   name: 'Prague Sprint',   type: 'range', startDate: '2026-03-01', endDate: '2026-05-10', notifyForEnd: false, note: null },
  { id: 'c2', categoryId: 'travel', name: 'Italy Trip',      type: 'range', startDate: '2026-07-20', endDate: '2026-08-02', notifyForEnd: false, note: null },
  { id: 'c3', categoryId: 'work',   name: 'Berlin Conf.',    type: 'range', startDate: '2026-04-10', endDate: '2026-04-13', notifyForEnd: false, note: null },
  { id: 'c4', categoryId: 'health', name: 'Half Marathon',   type: 'range', startDate: '2026-05-03', endDate: '2026-05-03', notifyForEnd: false, note: null },
  { id: 'c5', categoryId: 'travel', name: 'Tenerife',        type: 'range', startDate: '2026-02-10', endDate: '2026-02-17', notifyForEnd: false, note: null },
  { id: 'o1', categoryId: 'edu',    name: 'Learning Symfony',type: 'open',  startDate: '2025-11-01', endDate: null,         notifyForEnd: true,  note: null },
  { id: 'o2', categoryId: 'health', name: 'Marathon Training',type:'open',  startDate: '2026-03-15', endDate: null,         notifyForEnd: true,  note: null },
  { id: 'p1', categoryId: 'health', name: 'Birthday 🎂',     type: 'pin',   startDate: '2026-09-15', endDate: null,         notifyForEnd: false, note: null },
  { id: 'p2', categoryId: 'work',   name: 'Contract signed', type: 'pin',   startDate: '2026-02-15', endDate: null,         notifyForEnd: false, note: null },
  { id: 'p3', categoryId: 'health', name: 'Dentist',         type: 'pin',   startDate: '2026-06-10', endDate: null,         notifyForEnd: false, note: null },
  { id: 'p4', categoryId: 'work',   name: 'Visa expires',    type: 'pin',   startDate: '2026-11-01', endDate: null,         notifyForEnd: false, note: null },
]

export default function App() {
  const [categories, setCategories] = useState<Category[]>(DEMO_CATS)
  const [events, setEvents]         = useState<TimelineEvent[]>(DEMO_EVENTS)

  const [editEvent, setEditEvent]       = useState<TimelineEvent | null>(null)
  const [isNewEvent, setIsNewEvent]     = useState(false)
  const [pendingOpen, setPendingOpen]   = useState(false)
  const [catModalOpen, setCatModal]     = useState(false)
  const [activePreset, setActivePreset] = useState(12)

  const { view, setPreset, pan, zoom } = useTimelineView(TODAY)

  const pendingEvents = events.filter(e => e.notifyForEnd && !e.endDate)

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (catModalOpen) {
        if (e.key === 'Escape') setCatModal(false)
        return
      }
      if (e.key === 'Escape') {
        setEditEvent(null)
        setIsNewEvent(false)
        setPendingOpen(false)
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
    setEditEvent(null)
    setIsNewEvent(true)
    setPendingOpen(false)
  }

  function handleEventClick(id: string) {
    const ev = events.find(e => e.id === id)
    if (ev) {
      setEditEvent(ev)
      setIsNewEvent(false)
      setPendingOpen(false)
    }
  }

  function handleSave(patch: Partial<TimelineEvent> & { id?: string }) {
    if (patch.id) {
      setEvents(prev => prev.map(e => e.id === patch.id ? { ...e, ...patch } : e))
    } else {
      const newEv: TimelineEvent = {
        id: `ev_${Date.now()}`,
        categoryId: patch.categoryId ?? categories[0]?.id ?? '',
        name: patch.name ?? '',
        type: patch.type ?? 'range',
        startDate: patch.startDate ?? null,
        endDate: patch.endDate ?? null,
        notifyForEnd: patch.notifyForEnd ?? false,
        note: patch.note ?? null,
      }
      setEvents(prev => [...prev, newEv])
    }
    setEditEvent(null)
    setIsNewEvent(false)
  }

  function handleDelete(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
    setEditEvent(null)
  }

  function handleCreateCat(name: string, color: string) {
    const newCat: Category = { id: `cat_${Date.now()}`, name, color, isSystem: false, systemSlug: null }
    setCategories(prev => [...prev, newCat])
  }

  function handleDeleteCat(id: string) {
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  function handlePreset(months: number) {
    setActivePreset(months)
    setPreset(months)
  }

  const panCb  = pan
  const zoomCb = zoom

  const panelVisible = (editEvent !== null || isNewEvent)

  return (
    <>
      <Topbar
        pendingCount={pendingEvents.length}
        onNewEvent={openNew}
        onPending={() => { setPendingOpen(p => !p); setEditEvent(null); setIsNewEvent(false) }}
        onCategories={() => setCatModal(true)}
        onPreset={handlePreset}
        activePreset={activePreset}
      />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <Timeline
          view={view}
          today={TODAY}
          birthdate={BIRTH}
          categories={categories}
          events={events}
          onPan={panCb}
          onZoom={zoomCb}
          onEventClick={handleEventClick}
        />

        {/* Backdrop closes both panels */}
        {(panelVisible || pendingOpen) && !catModalOpen && (
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 15, cursor: 'pointer' }}
            onClick={() => { setEditEvent(null); setIsNewEvent(false); setPendingOpen(false) }}
          />
        )}

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
      </div>

      <CategoryModal
        open={catModalOpen}
        categories={categories}
        onClose={() => setCatModal(false)}
        onCreate={handleCreateCat}
        onDelete={handleDeleteCat}
      />
    </>
  )
}
