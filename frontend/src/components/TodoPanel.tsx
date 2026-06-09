import { useState } from 'react'
import type { TickTickTodo } from '../types'
import { useToast } from './Toast'
import { PanelShell } from './PanelShell'

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
    <PanelShell
      open={open}
      eyebrow="Timeline todos"
      eyebrowColor="var(--accent)"
      title="Tasks"
      subtitle="TickTick · tag: timeline-todo"
      onClose={onClose}
    >
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
    </PanelShell>
  )
}
