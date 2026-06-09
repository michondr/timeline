import { useState } from 'react'
import type { AbsIntegration } from '../types'
import { PanelShell } from './PanelShell'

interface Props {
  open: boolean
  integration: AbsIntegration | null
  onClose: () => void
  onSave: (url: string, token: string) => Promise<void>
  onSync: () => Promise<void>
}

export function AbsSettingsPanel({ open, integration, onClose, onSave, onSync }: Props) {
  const [url,     setUrl]     = useState('')
  const [token,   setToken]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(url.trim(), token.trim()) } finally { setSaving(false) }
  }

  async function handleSync() {
    setSyncing(true)
    try { await onSync() } finally { setSyncing(false) }
  }

  const canSave = url.trim().length > 0 && token.trim().length > 0

  return (
    <PanelShell open={open} eyebrow="Integration" title="Audiobookshelf" onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {integration && (
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
            padding: '10px 12px', fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: dotColor(integration) }} />
              <span style={{ color: 'var(--text)' }}>{statusLabel(integration)}</span>
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

        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
            Server URL
          </div>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={integration?.url || 'https://abs.example.com'}
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
            API token
          </div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste your API token"
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13,
              outline: 'none', fontFamily: 'monospace',
            }}
          />
        </div>

        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>How to get your API token</div>
          <div>1. Open your Audiobookshelf instance and log in</div>
          <div>2. Go to <strong>Settings → Users</strong> and click your user</div>
          <div>3. Copy the <strong>API token</strong> shown on the user page</div>
          <div style={{ marginTop: 4 }}>The connection is tested before saving.</div>
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          style={{
            flex: 1, padding: '7px 13px', borderRadius: 7, border: 'none',
            background: canSave ? 'var(--accent)' : 'var(--s3)',
            color: canSave ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 500,
          }}
        >
          {saving ? 'Testing & saving…' : 'Save'}
        </button>
        {integration?.hasCredentials && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: '7px 13px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }}
          >
            {syncing ? '…' : '↻ Sync now'}
          </button>
        )}
      </div>
    </PanelShell>
  )
}

function dotColor(i: AbsIntegration): string {
  if (!i.hasCredentials) return 'var(--muted)'
  if (i.lastRunStatus === 'error') return '#ff3b30'
  if (i.lastRunStatus === 'ok') return '#34c759'
  return 'var(--muted)'
}

function statusLabel(i: AbsIntegration): string {
  if (!i.hasCredentials) return 'No credentials configured'
  if (i.lastRunStatus === 'error') return 'Sync error'
  if (i.lastRunStatus === 'ok') return 'Synced'
  return 'Not synced yet'
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
