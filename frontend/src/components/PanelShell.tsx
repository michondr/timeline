import React from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  open: boolean
  side?: 'left' | 'right'
  width?: number
  eyebrow?: string
  eyebrowColor?: string
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

/**
 * Shared slide-in drawer shell. Owns the backdrop, positioning, slide-in
 * animation and the standard header (eyebrow + title + subtitle + ✕).
 * Panels render their body (and any footer) as children.
 *
 * Only the active panel is mounted (returns null when closed), so switching
 * straight from one panel to another never shows two drawers at once — the
 * old one unmounts instantly while the new one slides in.
 *
 * Layering: backdrop at zIndex 24, drawer at 25 — both below the Topbar
 * (zIndex 30) so its buttons stay clickable while a panel is open.
 */
export function PanelShell({
  open, side = 'right', width = 380,
  eyebrow, eyebrowColor, title, subtitle, onClose, children,
}: Props) {
  const isMobile = useIsMobile()

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 24, background: 'rgba(0,0,0,0.35)', animation: 'backdrop-in 0.18s ease' }}
      />
      <aside style={{
        position: 'absolute', [side]: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : width,
        background: 'var(--surface)',
        ...(side === 'right'
          ? { borderLeft:  isMobile ? 'none' : '1px solid var(--border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.45)' }
          : { borderRight: isMobile ? 'none' : '1px solid var(--border)', boxShadow:  '8px 0 32px rgba(0,0,0,0.45)' }),
        zIndex: 25,
        display: 'flex', flexDirection: 'column',
        animation: `${side === 'right' ? 'panel-in-right' : 'panel-in-left'} 0.22s cubic-bezier(0.4,0,0.2,1)`,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 18px 13px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            {eyebrow && (
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4, color: eyebrowColor ?? 'var(--muted)' }}>
                {eyebrow}
              </div>
            )}
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>
        {children}
      </aside>
    </>
  )
}
