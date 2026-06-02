import React, { useEffect, useRef, useState } from 'react'
import type { Category, TimelineEvent } from '../types'

interface Props {
  open: boolean
  query: string
  error: string | null
  matched: number
  total: number
  events: TimelineEvent[]
  categories: Category[]
  hiddenCats: Set<string>
  showHabits: boolean
  showBooks: boolean
  activePreset: number
  onChange: (q: string) => void
  onSubmit: (q: string) => void
  onClose: () => void
  onClear: () => void
  onToggleCat: (id: string) => void
  onSetHabits: (v: boolean) => void
  onSetBooks: (v: boolean) => void
  onShowAll: () => void
  onHideAll: () => void
  onPreset: (months: number) => void
}

const PRESETS = [
  { label: 'day', months: 0.07 }, { label: 'week', months: 0.5 }, { label: 'month', months: 12 },
  { label: 'year', months: 36 }, { label: 'decade', months: 120 },
]

const SEP_RE = /\s+and\s+/gi

type Sugg = { text: string; run: boolean; hint?: string }

// Split into "everything before the active clause" + "the clause being typed"
function splitActive(query: string): { prefix: string; frag: string } {
  let lastEnd = 0, m: RegExpExecArray | null
  SEP_RE.lastIndex = 0
  while ((m = SEP_RE.exec(query)) !== null) lastEnd = m.index + m[0].length
  return { prefix: query.slice(0, lastEnd), frag: query.slice(lastEnd) }
}

// Clause-level filter completions (just the clause text, no prefix)
function filterCompletions(frag: string, categoryNames: string[]): string[] {
  const dateOpts = ['this year', 'last year', 'this month']
  const ops = ['since', 'after', 'before']

  const inOp = frag.match(/^(\s*)(since|after|before)\s+(.*)$/i)
  if (inOp) {
    const op = inOp[2], rest = inOp[3].toLowerCase()
    const cats = categoryNames.filter(c => c.toLowerCase().includes(rest))
    const years = /\d/.test(rest) ? [] : ['2020', '2015', String(new Date().getFullYear())]
    return [...cats, ...(rest ? [] : years)].map(x => `${op} ${x}`).slice(0, 7)
  }
  const f = frag.toLowerCase().trim()
  const all = [...dateOpts, ...ops.map(o => `${o} `), ...categoryNames]
  return (f ? all.filter(x => x.toLowerCase().includes(f)) : all)
    .filter(x => x.toLowerCase().trim() !== f).slice(0, 7)
}

type Vis = { hidden: Set<string>; showHabits: boolean; showBooks: boolean }

function buildSuggestions(query: string, events: TimelineEvent[], categories: Category[], vis: Vis): Sugg[] {
  const lc = query.toLowerCase().trimStart()
  const first = lc.split(/\s+/)[0]
  const catNames = categories.map(c => c.name)

  // NEW …
  if (first === 'new') {
    const opts: Sugg[] = [
      { text: 'new', run: true, hint: 'create event' },
      { text: 'new category', run: true, hint: 'create category' },
    ]
    const hit = opts.filter(o => o.text.toLowerCase().startsWith(lc) || lc.startsWith(o.text.toLowerCase()))
    return hit.length ? hit : opts
  }

  // EDIT …
  if (first === 'edit') {
    const mCat = query.match(/^\s*edit\s+category\s+(.*)$/i)
    if (mCat) {
      const q = mCat[1].toLowerCase()
      return categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 7)
        .map(c => ({ text: `edit category ${c.name}`, run: true, hint: 'category' }))
    }
    const m = query.match(/^\s*edit\s+(.*)$/i)
    const q = (m?.[1] ?? '').toLowerCase()
    const evs = events.filter(e => e.name.toLowerCase().includes(q)).slice(0, 6)
      .map(e => ({ text: `edit ${e.name}`, run: true, hint: 'event' }))
    const cats = categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 3)
      .map(c => ({ text: `edit category ${c.name}`, run: true, hint: 'category' }))
    return [...evs, ...cats].slice(0, 8)
  }

  // TOGGLE <category | habits | books> visibility
  if (first === 'toggle') {
    const m = query.match(/^\s*toggle\s+(?:category\s+)?(.*)$/i)
    const q = (m?.[1] ?? '').toLowerCase()
    const cats: Sugg[] = categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6)
      .map(c => ({ text: `toggle ${c.name}`, run: true, hint: vis.hidden.has(c.id) ? 'show' : 'hide' }))
    const specials: Sugg[] = ([['Habits', vis.showHabits], ['Books', vis.showBooks]] as [string, boolean][])
      .filter(([n]) => n.toLowerCase().includes(q))
      .map(([n, on]) => ({ text: `toggle ${n}`, run: true, hint: on ? 'hide' : 'show' }))
    return [...cats, ...specials].slice(0, 8)
  }

  // FILTER (+ discoverable commands at top level)
  const { prefix, frag } = splitActive(query)
  const items: Sugg[] = filterCompletions(frag, catNames).map(t => ({ text: prefix + t, run: false }))
  if (!prefix) {
    const f = frag.toLowerCase().trim()
    const cmds: Sugg[] = [
      { text: 'new', run: true, hint: 'create event' },
      { text: 'new category', run: true, hint: 'create category' },
      { text: 'edit ', run: false, hint: 'edit event/category' },
      { text: 'toggle ', run: false, hint: 'toggle visibility' },
    ].filter(c => !f || c.text.toLowerCase().includes(f))
    return [...cmds, ...items].slice(0, 9)
  }
  return items.slice(0, 9)
}

export function FilterBar(p: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [idx, setIdx] = useState(-1)

  useEffect(() => { if (p.open) { inputRef.current?.focus(); setIdx(-1) } }, [p.open])
  if (!p.open) return null

  const typing = p.query.trim().length > 0
  const isCmd = /^\s*(new|edit|toggle)\b/i.test(p.query)
  const suggestions = typing
    ? buildSuggestions(p.query, p.events, p.categories, { hidden: p.hiddenCats, showHabits: p.showHabits, showBooks: p.showBooks })
    : []

  function change(v: string) { p.onChange(v); setIdx(-1) }
  function accept(s: Sugg) {
    change(s.text)
    if (s.run) p.onSubmit(s.text)
    else inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown')    { e.preventDefault(); setIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Tab')     { if (suggestions.length) { e.preventDefault(); accept(suggestions[Math.max(idx, 0)]) } }
    else if (e.key === 'Enter')   { e.preventDefault(); idx >= 0 && suggestions[idx] ? accept(suggestions[idx]) : p.onSubmit(p.query) }
    else if (e.key === 'Escape')  { e.preventDefault(); p.onClose() }
  }

  return (
    <div onClick={p.onClose} style={{
      position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10vh',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 92%)', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ color: 'var(--muted)', fontSize: 15 }}>⌕</span>
          <input
            ref={inputRef}
            value={p.query}
            onChange={e => change(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Filter or command… "this year", "Work AND since 2020", "new", "edit Wedding"'
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15 }}
          />
          {p.query && (
            <button onClick={p.onClear} style={{
              background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
            }}>clear</button>
          )}
        </div>

        <div style={{ padding: '9px 14px', fontSize: 12, color: p.error ? '#ff9f0a' : 'var(--muted)', flexShrink: 0 }}>
          {p.error ?? (
            isCmd ? 'Command · ↑↓ pick · Enter run'
            : typing ? `${p.matched} of ${p.total} events match · ↑↓ pick · Tab complete · Enter apply`
            : 'Type to filter or run a command · pick a timeframe & toggle categories below'
          )}
        </div>

        {/* Suggestions while typing */}
        {typing && suggestions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', overflowY: 'auto', padding: '6px 0' }}>
            {suggestions.map((s, i) => (
              <div
                key={s.text + i}
                onMouseDown={e => { e.preventDefault(); accept(s) }}
                onMouseEnter={() => setIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                  color: i === idx ? 'var(--text)' : 'var(--muted)',
                  background: i === idx ? 'var(--s3)' : 'transparent',
                }}
              >
                <span>{s.text.trim() || s.text}</span>
                {s.hint && <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.hint}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Controls when not typing */}
        {!typing && (
          <div style={{ overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
            <Section title="Timeframe">
              <div style={{ display: 'flex', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {PRESETS.map(pr => (
                  <button key={pr.months} onClick={() => p.onPreset(pr.months)} style={{
                    flex: 1, padding: '6px 0', border: 'none', borderRight: '1px solid var(--border)',
                    background: pr.months === p.activePreset ? 'var(--s3)' : 'transparent',
                    color: pr.months === p.activePreset ? 'var(--text)' : 'var(--muted)', fontSize: 12, cursor: 'pointer',
                  }}>{pr.label}</button>
                ))}
              </div>
            </Section>

            <Section
              title="Visible categories"
              action={
                <span style={{ display: 'flex', gap: 6 }}>
                  <MiniBtn onClick={p.onShowAll}>show all</MiniBtn>
                  <MiniBtn onClick={p.onHideAll}>hide all</MiniBtn>
                </span>
              }
            >
              {p.categories.map(c => (
                <Row key={c.id} checked={!p.hiddenCats.has(c.id)} onToggle={() => p.onToggleCat(c.id)} dot={c.color} label={c.name} />
              ))}
              <Row checked={p.showHabits} onToggle={() => p.onSetHabits(!p.showHabits)} label="Habits" />
              <Row checked={p.showBooks}  onToggle={() => p.onSetBooks(!p.showBooks)}  label="Books" />
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ checked, onToggle, dot, label }: { checked: boolean; onToggle: () => void; dot?: string; label: string }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} readOnly style={{ width: 13, height: 13, accentColor: 'var(--accent)', margin: 0, pointerEvents: 'none' }} />
      {dot && <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ fontSize: 13, color: checked ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
    </div>
  )
}

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6,
      color: 'var(--muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
    }}>{children}</button>
  )
}
