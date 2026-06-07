import { useState } from 'react'
import type { TickTickTodo } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'
import { useToast } from './Toast'

interface Props {
  todos: TickTickTodo[]
  open: boolean
  onClose: () => void
  onDone: (id: string, projectId: string) => Promise<void>
  onWontDo: (id: string, projectId: string) => Promise<void>
}

const spinner = (
  <span style={{
    width: 12, height: 12, flexShrink: 0,
    border: '2px solid currentColor', borderTopColor: 'transparent',
    borderRadius: '50%', display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  }} />
)

export function TodoPanel({ todos, open, onClose, onDone, onWontDo }: Props) {
  const isMobile = useIsMobile()
  const addToast = useToast()
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  async function handleDone(id: string, projectId: string) {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await onDone(id, projectId)
      addToast('Task marked done', 'success')
    } catch {
      addToast('Could not complete task — try again', 'error')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleWontDo(id: string, projectId: string) {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await onWontDo(id, projectId)
      addToast('Task dismissed', 'success')
    } catch {
      addToast('Could not dismiss task — try again', 'error')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'absolute', inset: 0, zIndex: 24, background: 'rgba(0,0,0,0.35)' }}
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
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4, color: 'var(--accent)' }}>
              Timeline todos
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Tasks</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>TickTick · tag: timeline-todo</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todos.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>No pending todos.</div>
          )}
          {todos.map(todo => {
            const busy = processing.has(todo.id)
            return (
              <div key={todo.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 11px',
                opacity: busy ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
                <button
                  onClick={() => handleDone(todo.id, todo.projectId)}
                  disabled={busy}
                  title="Mark done"
                  style={{
                    flexShrink: 0, width: 24, height: 24,
                    border: '1px solid #2a6e3a', borderRadius: 5,
                    background: 'transparent', color: '#34c759', fontSize: 14,
                    cursor: busy ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >{busy ? spinner : '✓'}</button>
                <span style={{ flex: 1, fontSize: 13 }}>{todo.title}</span>
                <button
                  onClick={() => handleWontDo(todo.id, todo.projectId)}
                  disabled={busy}
                  title="Won't do"
                  style={{
                    flexShrink: 0, width: 24, height: 24,
                    border: '1px solid #5c2222', borderRadius: 5,
                    background: 'transparent', color: '#ff453a', fontSize: 14,
                    cursor: busy ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >{busy ? spinner : '✕'}</button>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
