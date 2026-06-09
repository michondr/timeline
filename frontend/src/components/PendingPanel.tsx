import type { Category, TimelineEvent } from '../types'
import { PanelShell } from './PanelShell'

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
  const catById = (id: string) => categories.find(c => c.id === id)

  return (
    <PanelShell
      open={open}
      eyebrow="Needs attention"
      eyebrowColor="var(--warn)"
      title="Pending events"
      subtitle="Events awaiting an end date"
      onClose={onClose}
    >
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
    </PanelShell>
  )
}
