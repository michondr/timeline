import type { Category, TimelineEvent } from './types'

export interface FilterResult {
  ids: Set<string> | null   // null = no active filter (everything shown)
  error: string | null
  matched: number
}

type Predicate = (ev: TimelineEvent) => boolean

// ── Date helpers ──────────────────────────────────────────────────────────────
function eventRange(ev: TimelineEvent): [number, number] | null {
  const s = ev.startDate ? new Date(ev.startDate + 'T00:00:00').getTime() : null
  const e = ev.endDate   ? new Date(ev.endDate   + 'T00:00:00').getTime() : null
  if (s == null && e == null) return null
  const a = s ?? e!, b = e ?? s!
  return [Math.min(a, b), Math.max(a, b)]
}
function startOf(ev: TimelineEvent): number { const r = eventRange(ev); return r ? r[0] : Infinity }
function endOf(ev: TimelineEvent):   number { const r = eventRange(ev); return r ? r[1] : -Infinity }
function overlaps(a: number, b: number): Predicate {
  return ev => { const r = eventRange(ev); return r ? r[0] <= b && r[1] >= a : false }
}
function yearBounds(year: number): [number, number] {
  return [new Date(year, 0, 1).getTime(), new Date(year, 11, 31, 23, 59, 59).getTime()]
}

function findCategory(name: string, categories: Category[]): Category | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  return (
    categories.find(c => c.name.toLowerCase() === q) ??
    categories.find(c => c.name.toLowerCase().startsWith(q)) ??
    categories.find(c => c.name.toLowerCase().includes(q)) ??
    null
  )
}

// ── Single clause → predicate (null = unrecognised) ───────────────────────────
function clauseToPredicate(clause: string, categories: Category[], events: TimelineEvent[]): Predicate | null {
  const lc = clause.toLowerCase().trim()
  if (!lc) return null

  if (lc === 'this year')  { const [a, b] = yearBounds(new Date().getFullYear());     return overlaps(a, b) }
  if (lc === 'last year')  { const [a, b] = yearBounds(new Date().getFullYear() - 1); return overlaps(a, b) }
  if (lc === 'this month') {
    const n = new Date()
    const a = new Date(n.getFullYear(), n.getMonth(), 1).getTime()
    const b = new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).getTime()
    return overlaps(a, b)
  }

  // since / after / before  <year | category>
  const m = clause.match(/^(since|after|before)\s+(.+)$/i)
  if (m) {
    const op   = m[1].toLowerCase()
    const rest = m[2].trim()
    const yr   = rest.match(/^(\d{4})$/)

    if (yr) {
      const year = parseInt(yr[1], 10)
      if (op === 'since') { const t = new Date(year, 0, 1).getTime();     return ev => endOf(ev)   >= t }
      if (op === 'after') { const t = new Date(year + 1, 0, 1).getTime(); return ev => startOf(ev) >= t }
      const t = new Date(year, 0, 1).getTime();                          return ev => startOf(ev) <  t   // before
    }

    const cat = findCategory(rest, categories)
    if (!cat) return null
    const ranges = events.filter(e => e.categoryId === cat.id).map(eventRange).filter(Boolean) as [number, number][]
    if (ranges.length === 0) return () => false
    if (op === 'since') { const anchor = Math.min(...ranges.map(r => r[0])); return ev => endOf(ev)   >= anchor }
    if (op === 'after') { const anchor = Math.max(...ranges.map(r => r[1])); return ev => startOf(ev) >  anchor }
    const anchor = Math.min(...ranges.map(r => r[0]));                       return ev => endOf(ev)   <  anchor  // before
  }

  // bare year → events that touch that year
  const yr = lc.match(/^(\d{4})$/)
  if (yr) { const [a, b] = yearBounds(parseInt(yr[1], 10)); return overlaps(a, b) }

  // bare category name
  const cat = findCategory(clause, categories)
  if (cat) return ev => ev.categoryId === cat.id

  return null
}

// ── Public: parse the whole query and resolve matching event ids ──────────────
export function applyFilter(query: string, events: TimelineEvent[], categories: Category[]): FilterResult {
  const q = query.trim()
  if (!q) return { ids: null, error: null, matched: events.length }

  const clauses = q.split(/\s+and\s+/i).map(c => c.trim()).filter(Boolean)
  const preds: Predicate[] = []
  let error: string | null = null

  for (const clause of clauses) {
    const pred = clauseToPredicate(clause, categories, events)
    if (pred) preds.push(pred)
    else error = `Don't understand "${clause}"`
  }

  if (preds.length === 0) return { ids: new Set(), error: error ?? 'No valid filter', matched: 0 }

  const ids = new Set<string>()
  for (const ev of events) if (preds.every(p => p(ev))) ids.add(ev.id)
  return { ids, error, matched: ids.size }
}
