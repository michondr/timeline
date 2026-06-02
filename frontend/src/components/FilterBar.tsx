import React, { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  query: string
  error: string | null
  matched: number
  total: number
  categoryNames: string[]
  onChange: (q: string) => void
  onClose: () => void
  onClear: () => void
}

const SEP_RE = /\s+and\s+/gi

// Split the query into "everything up to the active clause" + "the clause being typed"
function splitActive(query: string): { prefix: string; frag: string } {
  let lastEnd = 0
  let m: RegExpExecArray | null
  SEP_RE.lastIndex = 0
  while ((m = SEP_RE.exec(query)) !== null) lastEnd = m.index + m[0].length
  return { prefix: query.slice(0, lastEnd), frag: query.slice(lastEnd) }
}

function buildSuggestions(frag: string, categoryNames: string[]): string[] {
  const dateOpts = ['this year', 'last year', 'this month']
  const ops      = ['since', 'after', 'before']

  // Already inside "since|after|before …" → suggest categories / years
  const inOp = frag.match(/^(\s*)(since|after|before)\s+(.*)$/i)
  if (inOp) {
    const op   = inOp[2]
    const rest = inOp[3].toLowerCase()
    const cats = categoryNames.filter(c => c.toLowerCase().includes(rest))
    const years = /\d/.test(rest) ? [] : ['2020', '2015', String(new Date().getFullYear())]
    return [...cats, ...(rest ? [] : years)].map(x => `${op} ${x}`).slice(0, 7)
  }

  const f = frag.toLowerCase().trim()
  const all = [...dateOpts, ...ops.map(o => `${o} `), ...categoryNames]
  const list = f ? all.filter(x => x.toLowerCase().includes(f)) : all
  // drop a suggestion that's already exactly typed
  return list.filter(x => x.toLowerCase().trim() !== f).slice(0, 7)
}

export function FilterBar({ open, query, error, matched, total, categoryNames, onChange, onClose, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [idx, setIdx] = useState(-1)

  useEffect(() => { if (open) { inputRef.current?.focus(); setIdx(-1) } }, [open])
  if (!open) return null

  const { prefix, frag } = splitActive(query)
  const suggestions = buildSuggestions(frag, categoryNames)

  function change(v: string) { onChange(v); setIdx(-1) }
  function accept(s: string) {
    change(prefix + s)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Tab')       { if (suggestions.length) { e.preventDefault(); accept(suggestions[Math.max(idx, 0)]) } }
    else if (e.key === 'Enter')     { e.preventDefault(); idx >= 0 && suggestions[idx] ? accept(suggestions[idx]) : onClose() }
    else if (e.key === 'Escape')    { e.preventDefault(); onClose() }
  }

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '11vh',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 92%)', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--muted)', fontSize: 15 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => change(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Filter… e.g. "this year", "Work AND since 2020", "after Travel"'
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15 }}
          />
          {query && (
            <button onClick={onClear} style={{
              background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
            }}>clear</button>
          )}
        </div>

        <div style={{ padding: '9px 14px', fontSize: 12, color: error ? '#ff9f0a' : 'var(--muted)' }}>
          {error ?? (query ? `${matched} of ${total} events match` : 'Type a filter — ↑↓ to pick, Tab to complete, Enter to apply')}
        </div>

        {suggestions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', maxHeight: 230, overflowY: 'auto', padding: '6px 0' }}>
            {suggestions.map((s, i) => (
              <div
                key={s}
                onMouseDown={e => { e.preventDefault(); accept(s) }}
                onMouseEnter={() => setIdx(i)}
                style={{
                  padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                  color: i === idx ? 'var(--text)' : 'var(--muted)',
                  background: i === idx ? 'var(--s3)' : 'transparent',
                }}
              >{s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
