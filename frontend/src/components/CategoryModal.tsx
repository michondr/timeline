import { useState } from 'react'
import type { Category } from '../types'

interface Props {
  open: boolean
  categories: Category[]
  onClose: () => void
  onCreate: (name: string, color: string) => void
  onDelete: (id: string) => void
}

const SWATCHES = [
  '#4a9eff','#34c759','#ff6b6b','#bf5af2','#ff9f0a','#ff9500',
  '#ff453a','#ffd60a','#30d158','#64d2ff','#5e5ce6','#ff375f',
  '#ac8e68','#98989d','#48484a',
]

export function CategoryModal({ open, categories, onClose, onCreate, onDelete }: Props) {
  const [newName, setNewName]   = useState('')
  const [swatch, setSwatch]     = useState(SWATCHES[0])

  function handleCreate() {
    const n = newName.trim()
    if (!n) return
    onCreate(n, swatch)
    setNewName('')
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.18s',
      }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        transform: open ? 'scale(1)' : 'scale(0.96)', transition: 'transform 0.18s',
      }}>
        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Categories</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>{c.name}</div>
              {c.isSystem
                ? <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--s2)', borderRadius: 4, padding: '2px 6px' }}>system</span>
                : <button onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', color: '#ff3b30', fontSize: 13, padding: '2px 8px' }}>✕</button>
              }
            </div>
          ))}
        </div>

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
                  transition: 'border-color 0.1s, transform 0.1s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Category name"
              style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
            <button onClick={handleCreate} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500 }}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
