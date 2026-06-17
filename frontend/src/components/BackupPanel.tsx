import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { ExportFile } from '../api'
import { PanelShell } from './PanelShell'
import { useToast } from './Toast'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void | Promise<void>
}

/**
 * Backup drawer: lists the server-side JSON exports (written daily by the
 * export cron, plus on-demand here) with download links, and imports a
 * timeline-export dump back into the account. Exports keep the stored
 * ciphertext, so an import only decrypts on an instance with the same
 * passphrase-derived key.
 */
export function BackupPanel({ open, onClose, onImported }: Props) {
  const toast = useToast()
  const [files,     setFiles]     = useState<ExportFile[]>([])
  const [loading,   setLoading]   = useState(false)
  const [running,   setRunning]   = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try { setFiles(await api.fetchExports()) }
    catch { toast('Could not load exports', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) refresh() }, [open])

  async function handleRun() {
    setRunning(true)
    try {
      const r = await api.runExport()
      toast(r.changed ? 'Export written' : 'No changes since last export', 'success')
      await refresh()
    } catch {
      toast('Export failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  async function handleDownload(name: string) {
    try {
      const blob = await api.downloadExport(name)
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: name })
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'error')
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const r    = await api.importBackup(text)
      toast(`Imported ${r.imported.events} events, ${r.imported.categories} categories`, 'success')
      await onImported()
      await refresh()
    } catch (err) {
      toast(err instanceof api.ApiError ? err.message : 'Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <PanelShell open={open} eyebrow="Backup" title="Export & import" onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          A full JSON backup is written automatically each day (and on demand).
          Event and category text stays encrypted, so an import only restores
          readable data on a device with the same passphrase.
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Export files
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No exports yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {new Date(f.createdAt).toLocaleString()}
                    {f.noChange && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px' }}>
                        no change
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.name} · {formatSize(f.size)}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(f.name)}
                  style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12 }}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleRun}
          disabled={running}
          style={{ flex: 1, padding: '7px 13px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }}
        >
          {running ? 'Exporting…' : '↻ Export now'}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          style={{ flex: 1, padding: '7px 13px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500 }}
        >
          {importing ? 'Importing…' : '↥ Import file'}
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
      </div>
    </PanelShell>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
