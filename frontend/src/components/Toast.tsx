import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error'
interface Toast { id: string; message: string; type: ToastType; dying: boolean }

const Ctx = createContext<(message: string, type: ToastType) => void>(() => {})
export function useToast() { return useContext(Ctx) }

const LIFE_MS   = 2800
const FADE_MS   = 250

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type, dying: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), FADE_MS)
    }, LIFE_MS)
  }, [])

  return (
    <Ctx.Provider value={addToast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, right: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13,
            background: t.type === 'success' ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
            border: `1px solid ${t.type === 'success' ? 'rgba(52,199,89,0.35)' : 'rgba(255,59,48,0.35)'}`,
            color: t.type === 'success' ? '#34c759' : '#ff453a',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: t.dying
              ? `toast-out ${FADE_MS}ms ease forwards`
              : 'toast-in 0.18s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
