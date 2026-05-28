import { useState } from 'react'
import type { HabitIntegration } from '../types'

interface Props {
  open: boolean
  integration: HabitIntegration | null
  onClose: () => void
  onSave: (token: string) => Promise<void>
  onSync: () => Promise<void>
}

export function HabitSettingsPanel({ open, integration, onClose, onSave, onSync }: Props) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(token) } finally { setSaving(false) }
  }

  async function handleSync() {
    setSyncing(true)
    try { await onSync() } finally { setSyncing(false) }
  }

  return (
    <aside style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 380,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.45)', zIndex: 20,
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
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
            Integration
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>TickTick Habits</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {integration && (
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
            padding: '10px 12px', marginBottom: 16, fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: !integration.hasToken ? 'var(--muted)' : integration.lastRunStatus === 'ok' ? '#34c759' : integration.lastRunStatus === 'error' ? '#ff3b30' : 'var(--muted)',
              }} />
              <span style={{ color: 'var(--text)' }}>
                {!integration.hasToken ? 'No token configured' : integration.lastRunStatus === 'ok' ? 'Synced' : integration.lastRunStatus === 'error' ? 'Sync error' : 'Not synced yet'}
              </span>
              {integration.lastRunAt && (
                <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{formatAgo(integration.lastRunAt)}</span>
              )}
            </div>
            {integration.lastRunError && (
              <div style={{ color: '#ff3b30', marginTop: 6, fontSize: 11, wordBreak: 'break-all' }}>
                {integration.lastRunError}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
            Session token
          </div>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste your TickTick session token here"
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 12,
              outline: 'none', resize: 'vertical', minHeight: 72, fontFamily: 'monospace',
            }}
          />
        </div>

        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>How to get your cookie string</div>
          <div>1. Open <strong>ticktick.com</strong> and log in</div>
          <div>2. Open DevTools → Network → find any <code style={{ background: 'var(--s3)', padding: '1px 4px', borderRadius: 3 }}>/api/v2/habits</code> request</div>
          <div>3. In Request Headers, copy the full value of the <code style={{ background: 'var(--s3)', padding: '1px 4px', borderRadius: 3 }}>Cookie</code> header</div>
          <div>4. Paste the entire string above and save</div>
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleSave}
          disabled={saving || !token.trim()}
          style={{
            flex: 1, padding: '7px 13px', borderRadius: 7, border: 'none',
            background: token.trim() ? 'var(--accent)' : 'var(--s3)',
            color: token.trim() ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 500,
          }}
        >
          {saving ? 'Saving…' : 'Save token'}
        </button>
        {integration?.hasToken && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: '7px 13px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }}
          >
            {syncing ? '…' : '↻ Sync now'}
          </button>
        )}
      </div>
    </aside>
  )
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
