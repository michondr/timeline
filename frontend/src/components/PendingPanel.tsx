import type { Category, TimelineEvent } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  events: TimelineEvent[]
  categories: Category[]
  open: boolean
  onClose: () => void
  onSelect: (event: TimelineEvent) => void
}

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s: string) {
  const d = new Date(s)
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function PendingPanel({ events, categories, open, onClose, onSelect }: Props) {
  const isMobile = useIsMobile()
  const catById = (id: string) => categories.find(c => c.id === id)

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0, zIndex: 24,
            background: 'rgba(0,0,0,0.35)',
          }}
        />
      )}
    <aside style={{
      position: 'absolute', right: 0, top: 0, bottom: 0,
      width: isMobile ? '100%' : 360,
      background: 'var(--surface)', borderLeft: isMobile ? 'none' : '1px solid var(--border)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.45)', zIndex: 25,
      display: 'flex', flexDirection: 'column',
      transform: open ? 'translateX(0)' : 'translateX(105%)',
      transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 18px 13px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4, color: 'var(--warn)' }}>
            Needs attention
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Pending events</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Events awaiting an end date</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>No pending events.</div>
        )}
        {events.map(ev => {
          const cat = catById(ev.categoryId)
          return (
            <div
              key={ev.id}
              onClick={() => onSelect(ev)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--s2)', border: '1px solid #352800',
                borderRadius: 8, padding: '10px 11px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.name}</div>
                <div style={{ fontSize: 11, color: cat?.color ?? 'var(--muted)', marginTop: 2 }}>
                  {cat?.name} · started {ev.startDate ? fmtDate(ev.startDate) : '—'}
                </div>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 'auto' }}>→</span>
            </div>
          )
        })}
      </div>
    </aside>
    </>
  )
}
