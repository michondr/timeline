import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book, Category, Habit, TimelineEvent, ViewState } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  view: ViewState
  today: Date
  birthdate: Date
  categories: Category[]
  events: TimelineEvent[]
  habits: Habit[]
  books: Book[]
  showHabits: boolean
  showBooks: boolean
  hiddenCats: Set<string>
  filterIds: Set<string> | null
  onPan: (shiftMs: number) => void
  onZoom: (dy: number, ratio: number, w: number) => void
  onZoomBy: (factor: number, ratio: number) => void
  onEventClick: (id: string) => void
  onBackgroundClick: () => void
  onDoubleTap: () => void
}

const DAY_MS = 86_400_000
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d: Date) {
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
function fmtDays(ms: number) {
  const d = Math.round(ms / DAY_MS)
  if (d === 0) return 'single day'
  if (d < 30) return `${d}d`
  if (d < 365) return `${Math.round(d / 30)}mo`
  return `${(d / 365).toFixed(1)}y`
}

function getGridDates(startT: number, endT: number) {
  const spanDays = (endT - startT) / DAY_MS
  const result: { date: Date; major: boolean; label: string | null }[] = []

  if (spanDays <= 3) {
    const d = new Date(startT); d.setMinutes(0, 0, 0)
    while (d.getTime() <= endT) {
      const major = d.getHours() === 0
      result.push({ date: new Date(d), major, label: major ? `${d.getDate()} ${MONTH[d.getMonth()]}` : `${d.getHours()}:00` })
      d.setHours(d.getHours() + 6)
    }
  } else if (spanDays <= 21) {
    const d = new Date(startT); d.setHours(0, 0, 0, 0)
    while (d.getTime() <= endT) {
      const major = d.getDay() === 1
      result.push({ date: new Date(d), major, label: major ? `${d.getDate()} ${MONTH[d.getMonth()]}` : null })
      d.setDate(d.getDate() + 1)
    }
  } else if (spanDays <= 400) {
    const d = new Date(new Date(startT).getFullYear(), new Date(startT).getMonth(), 1)
    while (d.getTime() <= endT) {
      const label = d.getMonth() === 0 ? `Jan ${d.getFullYear()}` : MONTH[d.getMonth()]
      result.push({ date: new Date(d), major: true, label })
      d.setMonth(d.getMonth() + 1)
    }
  } else if (spanDays <= 1500) {
    const d = new Date(new Date(startT).getFullYear(), 0, 1)
    while (d.getTime() <= endT) {
      const major = d.getMonth() === 0
      result.push({ date: new Date(d), major, label: major ? String(d.getFullYear()) : MONTH[d.getMonth()] })
      d.setMonth(d.getMonth() + 3)
    }
  } else {
    const d = new Date(new Date(startT).getFullYear(), 0, 1)
    while (d.getTime() <= endT) {
      result.push({ date: new Date(d), major: true, label: String(d.getFullYear()) })
      d.setFullYear(d.getFullYear() + 1)
    }
  }
  return result
}

export function Timeline({ view, today, birthdate, categories, events, habits, books, showHabits, showBooks, hiddenCats, filterIds, onPan, onZoom, onZoomBy, onEventClick, onBackgroundClick, onDoubleTap }: Props) {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const svgRef    = useRef<SVGSVGElement>(null)
  const dragRef   = useRef<{ prevX: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)
  const [hlId, setHlId]       = useState<string | null>(null)
  const [dims, setDims]       = useState({ w: 1200, h: 600 })
  const isMobile  = useIsMobile()

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const { w, h } = dims
  const ZONE_W   = isMobile ? 44 : 60
  const PAD      = Math.max(isMobile ? 16 : 120, w * 0.08)  // used for habits + axis labels
  const EVT_PAD  = 0                                         // events render edge-to-edge
  const TL_W     = w - PAD * 2
  const span = view.endMs - view.startMs

  const toX   = (t: number) => PAD + ((t - view.startMs) / span) * TL_W
  const dateX = (d: Date)   => toX(d.getTime())

  const AXIS_Y  = Math.round(h * 0.42)
  const OPEN_Y  = Math.round(h * 0.07)
  const BOOKS_Y = AXIS_Y + 32   // books zone directly below axis

  // ── Books lane computation (needed before HABITS_Y) ───────────────────
  const coversBase   = import.meta.env.VITE_API_URL ?? ''
  const BOOK_ROW_H   = 50
  const BOOK_BAR_OFF = 38   // bar Y offset within its lane row

  const visBooks        = showBooks ? books : []
  const finishedBooks   = visBooks.filter(b => b.isFinished && b.startedAt && b.finishedAt)
  const unfinishedBooks = visBooks.filter(b => !b.isFinished && b.startedAt)
  const booksToRender = [...finishedBooks, ...unfinishedBooks]
    .sort((a, b) => (a.startedAt! < b.startedAt! ? -1 : 1))

  // Label-aware greedy lane assignment:
  // A book fits in a lane only when its bar doesn't time-overlap AND
  // its label box doesn't pixel-overlap with the last label shown in that lane.
  const BCHAR_W   = 6.2
  const BLABEL_PAD = 10

  function bookLabelRange(book: Book, sx: number): { lx: number; rx: number } | null {
    const pinned  = !book.isFinished && sx < EVT_PAD
    const inView  = sx > EVT_PAD - 30 && sx < w - 30
    if (!pinned && !inView) return null
    const lx = pinned ? EVT_PAD + 4 : sx + 4
    return { lx, rx: lx + 28 + Math.min(book.title.length, 30) * BCHAR_W + BLABEL_PAD }
  }

  // Cap lanes to what fits vertically (habits zone height is independent of books)
  const habitsH  = showHabits && habits.length > 0 ? habits.length * 22 + 10 : 0
  const maxLanes = Math.max(1, Math.floor((h - BOOKS_Y - (habitsH > 0 ? habitsH + 36 : 24)) / BOOK_ROW_H))

  type BookLane  = { book: Book; start: Date; end: Date; lane: number }
  type LaneState = { timeEnd: number; labelEndX: number }

  const bookLanes:  BookLane[]  = []
  const laneStates: LaneState[] = []

  for (const book of booksToRender) {
    const start  = new Date(book.startedAt!)
    const end    = book.isFinished ? new Date(book.finishedAt!) : today
    const sx     = dateX(start)
    const lr     = bookLabelRange(book, sx)

    let lane = laneStates.findIndex(s =>
      s.timeEnd <= start.getTime() &&
      (!lr || s.labelEndX + 2 <= lr.lx)
    )
    // If no lane fits and we're at the cap, skip this book
    if (lane === -1) {
      if (laneStates.length >= maxLanes) continue
      lane = laneStates.length
      laneStates.push({ timeEnd: 0, labelEndX: -Infinity })
    }

    laneStates[lane] = {
      timeEnd:   end.getTime(),
      labelEndX: lr ? lr.rx : laneStates[lane].labelEndX,
    }
    bookLanes.push({ book, start, end, lane })
  }

  const BOOKS_H   = showBooks && bookLanes.length > 0 ? laneStates.length * BOOK_ROW_H : 0
  const BOOKS_SEP = BOOKS_Y + BOOKS_H + (BOOKS_H > 0 ? 4 : 0)
  const HABITS_Y  = BOOKS_SEP + (BOOKS_H > 0 ? 16 : 0)
  const HABITS_H  = showHabits && habits.length > 0 ? habits.length * 22 + 10 : 0
  const HABITS_SEP = HABITS_Y + HABITS_H + 4

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

  const catById = useCallback((id: string) => categories.find(c => c.id === id) ?? { id, name: id, color: '#888', isSystem: false, systemSlug: null }, [categories])

  // Effective opacity: filtered-out events fade hard, otherwise honour hover highlight
  const evOpacity = (id: string) => {
    if (filterIds && !filterIds.has(id)) return 0.06
    return !hlId || hlId === id ? 1 : 0.15
  }

  // ── Split events by type (hidden categories removed entirely) ─────────────
  const visEvents = hiddenCats.size ? events.filter(e => !hiddenCats.has(e.categoryId)) : events
  const rangeEvs = visEvents.filter(e => e.type === 'range')
  const openEvs  = visEvents.filter(e => e.type === 'open')
  const pinEvs   = visEvents.filter(e => e.type === 'pin')

  // ── Build SVG strings ─────────────────────────────────────────────────────
  const grid = getGridDates(view.startMs, view.endMs)
  const pieces: string[] = []

  // Zone separators
  if (BOOKS_H > 0) {
    pieces.push(`<line x1="0" y1="${BOOKS_SEP}" x2="${w}" y2="${BOOKS_SEP}" stroke="#1c1c1e" stroke-width="1"/>`)
  }
  pieces.push(`<line x1="0" y1="${HABITS_SEP}" x2="${w}" y2="${HABITS_SEP}" stroke="#1c1c1e" stroke-width="1"/>`)

  // Grid lines
  grid.forEach(({ date, major }) => {
    const x = dateX(date)
    if (x < 0 || x > w) return
    pieces.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${major ? '#222225' : '#191919'}" stroke-width="1"/>`)
  })

  // Axis
  pieces.push(`<line x1="${PAD}" y1="${AXIS_Y}" x2="${w - PAD}" y2="${AXIS_Y}" stroke="#3c3c42" stroke-width="2"/>`)

  // Time labels
  grid.forEach(({ date, major, label }) => {
    if (!major || !label) return
    const x = dateX(date)
    if (x < PAD || x > w - PAD) return
    pieces.push(`<text x="${x + 4}" y="${AXIS_Y + 17}" fill="#3a3a44" font-size="11" font-family="system-ui">${label}</text>`)
    pieces.push(`<line x1="${x}" y1="${AXIS_Y - 4}" x2="${x}" y2="${AXIS_Y + 4}" stroke="#3c3c42" stroke-width="1"/>`)
  })

  // Age circles (birth year +0 to +100)
  for (let age = 0; age <= 100; age++) {
    const bday = new Date(birthdate)
    bday.setFullYear(birthdate.getFullYear() + age)
    const x = dateX(bday)
    if (x < PAD - 14 || x > w - PAD + 14) continue
    pieces.push(`<circle cx="${x}" cy="${AXIS_Y}" r="13" fill="#131315" stroke="#3c3c42" stroke-width="1.5"/>`)
    pieces.push(`<text x="${x}" y="${AXIS_Y + 4}" text-anchor="middle" fill="#5a5a64" font-size="9" font-family="system-ui">${age}</text>`)
  }

  // Today
  const todayX = toX(today.getTime())
  pieces.push(`<line x1="${todayX}" y1="24" x2="${todayX}" y2="${h - 14}" stroke="#ff3b30" stroke-width="1.5" opacity="0.65" stroke-dasharray="5,4"/>`)
  pieces.push(`<circle cx="${todayX}" cy="${AXIS_Y}" r="4" fill="#ff3b30"/>`)
  pieces.push(`<text x="${todayX + 7}" y="40" fill="#ff3b30" font-size="11" font-family="system-ui" font-weight="500">today</text>`)

  // ── Closed/Range events: swimlanes grouped by category ───────────────────
  // Each category gets its own vertical block above the axis. Within a category,
  // events whose date ranges overlap are pushed onto separate lanes; the
  // longest-lasting events settle into the top lanes.
  type LaneItem = { ev: TimelineEvent; start: Date; end: Date; dur: number; lane: number }

  const rangeByCat = new Map<string, LaneItem[]>()
  for (const ev of rangeEvs) {
    if (!ev.startDate) continue
    const start = new Date(ev.startDate)
    const end   = ev.endDate ? new Date(ev.endDate) : start
    const list  = rangeByCat.get(ev.categoryId) ?? []
    list.push({ ev, start, end, dur: end.getTime() - start.getTime(), lane: 0 })
    rangeByCat.set(ev.categoryId, list)
  }

  // Keep category order stable (follow the categories list, then any orphans)
  const rangeCatOrder = [
    ...categories.map(c => c.id).filter(id => rangeByCat.has(id)),
    ...[...rangeByCat.keys()].filter(id => !categories.some(c => c.id === id)),
  ]

  // Assign lanes per category — greedy, longest first so long events take lane 0
  const catBlocks = rangeCatOrder.map(catId => {
    const items = rangeByCat.get(catId)!
    items.sort((a, b) => b.dur - a.dur)
    const laneEnds: number[] = []   // last occupied end-time per lane
    for (const it of items) {
      let lane = laneEnds.findIndex(endMs => endMs <= it.start.getTime())
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
      laneEnds[lane] = it.end.getTime()
      it.lane = lane
    }
    return { items, lanes: laneEnds.length }
  })

  // Fit all lanes within the band between the open-event zone and the axis
  const totalLanes = catBlocks.reduce((s, b) => s + b.lanes, 0)
  const CAT_GAP  = 10
  const BASE_OFF = 26
  const bandTop  = Math.round(h * 0.12)
  const avail    = Math.max(60, AXIS_Y - BASE_OFF - bandTop)
  const LANE_H   = Math.max(12, Math.min(isMobile ? 18 : 22,
                     (avail - catBlocks.length * CAT_GAP) / Math.max(1, totalLanes)))

  const rangeEvYPos = new Map<string, number>()

  let basePx = BASE_OFF   // pixels above the axis for this block's bottom lane
  for (const block of catBlocks) {
    for (const it of block.items) {
      const laneFromBottom = block.lanes - 1 - it.lane   // lane 0 (longest) → top
      const y   = AXIS_Y - (basePx + laneFromBottom * LANE_H)
      rangeEvYPos.set(it.ev.id, y)
      const { ev, start, end, dur } = it
      const x1  = dateX(start)
      const x2  = Math.max(dateX(end), x1 + 18)
      const mid = (x1 + x2) / 2
      const col = catById(ev.categoryId).color
      if (x2 < EVT_PAD || x1 > w - EVT_PAD) continue

      const sub = `${fmtDate(start)} – ${fmtDate(end)} · ${fmtDays(dur)}`
      pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
      pieces.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="2"/>`)
      pieces.push(`<circle cx="${x1}" cy="${y}" r="4" fill="${col}"/>`)
      pieces.push(`<circle cx="${x2}" cy="${y}" r="4" fill="${col}"/>`)
      pieces.push(`<text x="${mid}" y="${y - 6}" text-anchor="middle" fill="${col}" font-size="10" font-family="system-ui" font-weight="500">${ev.name}</text>`)
      pieces.push(`</g>`)
    }
    basePx += block.lanes * LANE_H + CAT_GAP
  }

  // ── Open events (above axis, stacked) ────────────────────────────────────
  openEvs.forEach((ev, i) => {
    if (!ev.startDate && !ev.endDate) return
    const col    = catById(ev.categoryId).color
    const y      = OPEN_Y + 10 + i * 38
    const labelY = y - 8
    rangeEvYPos.set(ev.id, y)

    if (!ev.startDate && ev.endDate) {
      // End-only: arrow from left edge pointing toward end date
      const end    = new Date(ev.endDate)
      const endX   = dateX(end)
      if (endX < EVT_PAD) return
      const x2     = clamp(endX, EVT_PAD, w - EVT_PAD)
      const x1     = EVT_PAD
      const sub    = `Open · ends ${fmtDate(end)}`
      const endsInView = endX <= w - EVT_PAD
      pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
      pieces.push(`<polygon points="${x1 + 12},${y - 5} ${x1},${y} ${x1 + 12},${y + 5}" fill="${col}"/>`)
      pieces.push(`<line x1="${x1 + 12}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="2"/>`)
      if (endsInView) {
        pieces.push(`<circle cx="${endX}" cy="${y}" r="5" fill="${col}"/>`)
        pieces.push(`<line x1="${endX}" y1="${y}" x2="${endX}" y2="${AXIS_Y}" stroke="${col}" stroke-width="1" opacity="0.12"/>`)
      }
      if (ev.notifyForEnd) {
        pieces.push(`<text x="${x1 + 26}" y="${labelY + 1}" fill="#ff9f0a" font-size="11" font-family="system-ui">⚠</text>`)
        pieces.push(`<text x="${x1 + 40}" y="${labelY}" fill="${col}" font-size="11" font-family="system-ui" font-weight="500">${ev.name}</text>`)
      } else {
        pieces.push(`<text x="${x1 + 26}" y="${labelY}" fill="${col}" font-size="11" font-family="system-ui" font-weight="500">${ev.name}</text>`)
      }
      pieces.push(`</g>`)
      return
    }

    const start  = new Date(ev.startDate!)
    const startX = dateX(start)
    const x1     = clamp(startX, EVT_PAD, w - EVT_PAD)
    const x2     = w - EVT_PAD
    const sub    = `Open · started ${fmtDate(start)}`

    if (startX > w - EVT_PAD) return

    const startsInView = startX >= EVT_PAD
    pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
    if (startsInView) {
      pieces.push(`<line x1="${startX}" y1="${y}" x2="${startX}" y2="${AXIS_Y}" stroke="${col}" stroke-width="1" opacity="0.12"/>`)
      pieces.push(`<circle cx="${startX}" cy="${y}" r="5" fill="${col}"/>`)
    }
    pieces.push(`<line x1="${x1}" y1="${y}" x2="${x2 - 14}" y2="${y}" stroke="${col}" stroke-width="2"/>`)
    pieces.push(`<polygon points="${x2 - 12},${y - 5} ${x2},${y} ${x2 - 12},${y + 5}" fill="${col}"/>`)
    if (ev.notifyForEnd) {
      pieces.push(`<text x="${x1 + 12}" y="${labelY + 1}" fill="#ff9f0a" font-size="11" font-family="system-ui">⚠</text>`)
      pieces.push(`<text x="${x1 + 26}" y="${labelY}" fill="${col}" font-size="11" font-family="system-ui" font-weight="500">${ev.name}</text>`)
    } else {
      pieces.push(`<text x="${x1 + 12}" y="${labelY}" fill="${col}" font-size="11" font-family="system-ui" font-weight="500">${ev.name}</text>`)
    }
    pieces.push(`</g>`)
  })

  // ── Pin events ────────────────────────────────────────────────────────────
  // Free pins (no parent range event): hang above the axis, stacking upward.
  // Attached pins: render below their parent's swimlane with a connecting line.
  const pinCatCounts: Record<string, number> = {}
  pinEvs.forEach(ev => {
    if (!ev.startDate) return
    const x = dateX(new Date(ev.startDate))
    if (x >= EVT_PAD && x <= w - EVT_PAD) {
      pinCatCounts[ev.categoryId] = (pinCatCounts[ev.categoryId] ?? 0) + 1
    }
  })
  const sortedPins = [...pinEvs].sort((a, b) => (pinCatCounts[b.categoryId] ?? 0) - (pinCatCounts[a.categoryId] ?? 0))

  const freePins     = sortedPins.filter(ev => !ev.rangeEventId)
  const attachedPins = sortedPins.filter(ev =>  ev.rangeEventId)

  freePins.forEach((ev, i) => {
    if (!ev.startDate) return
    const x   = dateX(new Date(ev.startDate))
    if (x < EVT_PAD || x > w - EVT_PAD) return
    const y   = AXIS_Y - 14 - i * 20
    const col = catById(ev.categoryId).color
    const sub = `Pin · ${fmtDate(new Date(ev.startDate))}`

    pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
    pieces.push(`<line x1="${x}" y1="${AXIS_Y}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="1.5" opacity="0.25"/>`)
    pieces.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${col}"/>`)
    pieces.push(`<text x="${x + 9}" y="${y + 4}" fill="${col}" font-size="11" font-family="system-ui">${ev.name}</text>`)
    pieces.push(`</g>`)
  })

  attachedPins.forEach(ev => {
    if (!ev.startDate || !ev.rangeEventId) return
    const x        = dateX(new Date(ev.startDate))
    if (x < EVT_PAD || x > w - EVT_PAD) return
    const parentY  = rangeEvYPos.get(ev.rangeEventId)
    if (parentY === undefined) return
    const y        = parentY + LANE_H / 2 + 12
    const col      = catById(ev.categoryId).color
    const sub      = `Pin · ${fmtDate(new Date(ev.startDate))}`

    pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
    pieces.push(`<line x1="${x}" y1="${parentY}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="1" opacity="0.2"/>`)
    pieces.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${col}"/>`)
    pieces.push(`<text x="${x + 9}" y="${y + 4}" fill="${col}" font-size="11" font-family="system-ui">${ev.name}</text>`)
    pieces.push(`</g>`)
  })

  // ── Habits ────────────────────────────────────────────────────────────────
  const spanDays      = span / DAY_MS
  const weeklyHabits  = spanDays > 60   && spanDays <= 400
  const monthlyHabits = spanDays > 400  && spanDays <= 1500
  const yearlyHabits  = spanDays > 1500

  if (showHabits) habits.forEach((habit, hi) => {
    const y = HABITS_Y + 10 + hi * 22

    // Name label (left of PAD, right-aligned)
    const label = habit.name.length > 24 ? habit.name.slice(0, 23) + '…' : habit.name
    pieces.push(`<text x="${PAD - 6}" y="${y + 4}" text-anchor="end" fill="#3a3a46" font-size="10" font-family="system-ui" clip-path="none">${label}</text>`)

    const todayStr = today.toISOString().slice(0, 10)

    // Current streak (days, from today backwards)
    let streak = 0
    let streakBroken = false
    const allDates = Object.keys(habit.logs).sort().reverse()
    for (const d of allDates) {
      if (d > todayStr) continue
      if (habit.logs[d] === 'done') {
        if (!streakBroken) streak++
      } else {
        streakBroken = true
      }
    }

    let doneCount = 0
    let totalPast = 0

    if (yearlyHabits) {
      // Yearly squares — iterate calendar years
      for (let t = view.startMs; t <= view.endMs; t += DAY_MS) {
        const d = new Date(t)
        if (d > today) break
        const dateKey = d.toISOString().slice(0, 10)
        totalPast++
        if (habit.logs[dateKey] === 'done') doneCount++
      }

      const firstYear = new Date(view.startMs).getFullYear()
      const lastYear  = new Date(view.endMs).getFullYear()

      for (let yr = firstYear; yr <= lastYear; yr++) {
        const yearStart = new Date(yr, 0, 1).getTime()
        const yearEnd   = new Date(yr + 1, 0, 1).getTime()

        let yearDone = 0, yearTotal = 0, bestStreak = 0, cur = 0
        for (let d = yearStart; d < yearEnd; d += DAY_MS) {
          if (d > today.getTime()) break
          const dateKey = new Date(d).toISOString().slice(0, 10)
          yearTotal++
          if (habit.logs[dateKey] === 'done') { yearDone++; cur++; bestStreak = Math.max(bestStreak, cur) }
          else { cur = 0 }
        }
        if (yearDone === 0) continue

        const cx = toX(yearStart)
        if (cx < PAD + 10 || cx > w - PAD - 10) continue

        const pct = Math.round((yearDone / yearTotal) * 100)
        pieces.push(`<rect x="${cx - 9}" y="${y - 8}" width="18" height="16" rx="2" fill="#141417" stroke="#38383e" stroke-width="1"/>`)
        pieces.push(`<text x="${cx}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" fill="#5a5a6e" font-size="7" font-family="system-ui">${pct}%</text>`)
        if (bestStreak > 1) {
          pieces.push(`<text x="${cx + 8}" y="${y - 7}" text-anchor="middle" font-size="8" font-family="system-ui">🔥</text>`)
          pieces.push(`<text x="${cx + 16}" y="${y - 5}" fill="#5a5a6e" font-size="6" font-family="system-ui">${bestStreak}</text>`)
        }
      }

    } else if (monthlyHabits) {
      // Monthly squares — iterate calendar months
      for (let t = view.startMs; t <= view.endMs; t += DAY_MS) {
        const d = new Date(t)
        if (d > today) break
        const dateKey = d.toISOString().slice(0, 10)
        totalPast++
        if (habit.logs[dateKey] === 'done') doneCount++
      }

      const s0 = new Date(view.startMs)
      let mo   = new Date(s0.getFullYear(), s0.getMonth(), 1)

      while (mo.getTime() <= view.endMs) {
        const monthStart = mo.getTime()
        const monthEnd   = new Date(mo.getFullYear(), mo.getMonth() + 1, 1).getTime()

        let mDone = 0, mTotal = 0, bestStreak = 0, cur = 0
        for (let d = monthStart; d < monthEnd; d += DAY_MS) {
          if (d > today.getTime()) break
          const dateKey = new Date(d).toISOString().slice(0, 10)
          mTotal++
          if (habit.logs[dateKey] === 'done') { mDone++; cur++; bestStreak = Math.max(bestStreak, cur) }
          else { cur = 0 }
        }

        if (mDone > 0) {
          const cx = toX(monthStart)
          if (cx >= PAD + 8 && cx <= w - PAD - 8) {
            const pct = Math.round((mDone / mTotal) * 100)
            pieces.push(`<rect x="${cx - 8}" y="${y - 8}" width="16" height="16" rx="2" fill="${habit.color}" opacity="0.8"/>`)
            pieces.push(`<text x="${cx}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="7" font-family="system-ui">${pct}%</text>`)
            if (bestStreak > 1) {
              pieces.push(`<text x="${cx + 7}" y="${y - 7}" text-anchor="middle" font-size="8" font-family="system-ui">🔥</text>`)
              pieces.push(`<text x="${cx + 15}" y="${y - 5}" fill="${habit.color}" font-size="6" font-weight="bold" font-family="system-ui">${bestStreak}</text>`)
            }
          }
        }

        mo = new Date(mo.getFullYear(), mo.getMonth() + 1, 1)
      }

    } else if (weeklyHabits) {
      // Weekly circles
      for (let t = view.startMs; t <= view.endMs; t += DAY_MS) {
        const d = new Date(t)
        if (d > today) break
        const dateKey = d.toISOString().slice(0, 10)
        totalPast++
        if (habit.logs[dateKey] === 'done') doneCount++
      }

      const startDate = new Date(view.startMs)
      const dow = startDate.getDay()
      const daysToMon = dow === 0 ? 6 : dow - 1
      const firstMonday = new Date(startDate)
      firstMonday.setDate(firstMonday.getDate() - daysToMon)
      firstMonday.setHours(0, 0, 0, 0)

      const streakStartMs = today.getTime() - streak * DAY_MS

      for (let weekStart = firstMonday.getTime(); weekStart <= view.endMs; weekStart += 7 * DAY_MS) {
        const weekEnd = weekStart + 7 * DAY_MS

        let weekDone = 0
        for (let d = weekStart; d < weekEnd; d += DAY_MS) {
          if (d > today.getTime()) break
          const dateKey = new Date(d).toISOString().slice(0, 10)
          if (habit.logs[dateKey] === 'done') weekDone++
        }

        if (weekDone === 0) continue

        const cx = toX(weekStart)
        if (cx < PAD + 8 || cx > w - PAD - 8) continue

        const weekLastMs = Math.min(weekEnd - DAY_MS, today.getTime())
        const onStreak = streak > 0 && weekLastMs >= streakStartMs

        if (onStreak) {
          pieces.push(`<text x="${cx}" y="${y + 4}" text-anchor="middle" font-size="11" font-family="system-ui">🔥</text>`)
          pieces.push(`<text x="${cx + 9}" y="${y + 4}" fill="${habit.color}" font-size="8" font-weight="bold" font-family="system-ui">${weekDone}</text>`)
        } else {
          pieces.push(`<circle cx="${cx}" cy="${y}" r="8" fill="${habit.color}" opacity="0.75"/>`)
          pieces.push(`<text x="${cx}" y="${y + 3}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="8" font-family="system-ui">${weekDone}</text>`)
        }
      }

    } else {
      // Daily circles — snap loop start to midnight so circles stay on day boundaries
      const d0 = new Date(view.startMs); d0.setHours(0, 0, 0, 0)
      for (let t = d0.getTime(); t <= view.endMs; t += DAY_MS) {
        const x = toX(t)
        if (x < PAD + 2 || x > w - PAD - 2) continue

        const d = new Date(t)
        if (d > today) continue

        const dateKey = d.toISOString().slice(0, 10)
        const status  = habit.logs[dateKey]

        if (dateKey <= todayStr) {
          totalPast++
          if (status === 'done') doneCount++
        }

        let fill: string
        if (status === 'done')       fill = habit.color
        else if (status === 'fail')  fill = '#5a1818'
        else                         fill = '#252528'

        pieces.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${fill}"/>`)
      }
    }

    // Stats on right: streak + completion rate
    const pct    = totalPast > 0 ? Math.round((doneCount / totalPast) * 100) : 0
    const statsX = w - PAD + 6
    const statsTxt = streak > 0 ? `🔥 ${streak} · ${pct}%` : `${pct}%`
    pieces.push(`<text x="${statsX}" y="${y + 4}" fill="#3a3a46" font-size="10" font-family="system-ui">${statsTxt}</text>`)
  })

  // ── Books ─────────────────────────────────────────────────────────────────
  if (showBooks && bookLanes.length > 0) {
    bookLanes.forEach(({ book, start, end, lane }) => {
      const barY   = BOOKS_Y + BOOK_BAR_OFF + lane * BOOK_ROW_H
      const startX = dateX(start)
      const endX   = dateX(end)
      const col    = '#7c7c8a'

      // Skip if bar is entirely off-screen
      if (endX < EVT_PAD || startX > w - EVT_PAD) return

      const x1 = clamp(startX, EVT_PAD, w - EVT_PAD)
      const x2 = book.isFinished ? clamp(endX, x1 + 16, w - EVT_PAD) : w - EVT_PAD

      // Label is guaranteed non-overlapping by lane assignment
      const lr = bookLabelRange(book, startX)
      if (lr) {
        const labelX = lr.lx
        const coverY = barY - 30
        const titleTxt  = escXml(book.title.length > 30 ? book.title.slice(0, 29) + '…' : book.title)
        const authorTxt = book.author ? escXml(book.author.length > 28 ? book.author.slice(0, 27) + '…' : book.author) : ''
        pieces.push(`<image href="${coversBase}/covers/${escXml(book.absItemId)}.jpg" x="${labelX - 2}" y="${coverY}" width="20" height="28" preserveAspectRatio="xMidYMid meet"/>`)
        pieces.push(`<text x="${labelX + 24}" y="${barY - 16}" fill="#8a8a9a" font-size="10" font-family="system-ui" font-weight="500">${titleTxt}</text>`)
        if (authorTxt) {
          pieces.push(`<text x="${labelX + 24}" y="${barY - 5}" fill="#5a5a6e" font-size="9" font-family="system-ui">${authorTxt}</text>`)
        }
      }

      if (book.isFinished) {
        pieces.push(`<line x1="${x1}" y1="${barY}" x2="${x2}" y2="${barY}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`)
        pieces.push(`<circle cx="${x1}" cy="${barY}" r="4" fill="${col}"/>`)
        pieces.push(`<circle cx="${x2}" cy="${barY}" r="4" fill="${col}"/>`)
      } else {
        if (startX >= EVT_PAD) {
          pieces.push(`<circle cx="${startX}" cy="${barY}" r="4" fill="${col}"/>`)
        }
        pieces.push(`<line x1="${x1}" y1="${barY}" x2="${x2 - 14}" y2="${barY}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`)
        pieces.push(`<polygon points="${x2 - 12},${barY - 5} ${x2},${barY} ${x2 - 12},${barY + 5}" fill="${col}"/>`)
      }

    })

    // Total listening hours for books whose bars overlap the current viewport
    const totalSecs = booksToRender
      .filter(book => {
        const s = new Date(book.startedAt!).getTime()
        const e = book.isFinished ? new Date(book.finishedAt!).getTime() : today.getTime()
        return s <= view.endMs && e >= view.startMs
      })
      .reduce((sum, book) => sum + (book.currentTime ?? 0), 0)
    if (totalSecs > 0) {
      const hrs    = totalSecs / 3600
      const hrsTxt = hrs >= 10 ? `${Math.round(hrs)}h` : `${Math.round(hrs * 10) / 10}h`
      pieces.push(`<text x="${w - 2}" y="${BOOKS_Y + 14}" text-anchor="end" fill="#3a3a46" font-size="10" font-family="system-ui">${hrsTxt} total</text>`)
    }

    // Hidden-books notice
    const hiddenCount = booksToRender.length - bookLanes.length
    if (hiddenCount > 0) {
      pieces.push(`<text x="${w - 2}" y="${BOOKS_Y + BOOKS_H - 4}" text-anchor="end" fill="#3a3a46" font-size="10" font-family="system-ui">+${hiddenCount} more</text>`)
    }
  }

  const svgContent = pieces.join('\n')

  // ── Zone labels ───────────────────────────────────────────────────────────
  const zones = [
    { label: 'open',   top: OPEN_Y + 12 },
    { label: 'axis',   top: AXIS_Y },
    ...(BOOKS_H > 0 ? [{ label: 'books',  top: BOOKS_Y + BOOKS_H / 2 }] : []),
    { label: 'habits', top: HABITS_Y + Math.max(10, HABITS_H / 2) },
  ]

  // ── Event handlers on SVG ─────────────────────────────────────────────────
  function getSvgTarget(e: React.MouseEvent): SVGGElement | null {
    let el = e.target as Element | null
    while (el && el !== svgRef.current) {
      if (el.classList?.contains('ev')) return el as SVGGElement
      el = el.parentElement
    }
    return null
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const dx = dragRef.current.prevX - e.clientX
      dragRef.current.prevX = e.clientX
      onPan((dx / TL_W) * span)
      return
    }

    const g = getSvgTarget(e)
    if (g) {
      const raw = g.dataset.tip
      if (raw) {
        const { name, sub } = JSON.parse(decodeURIComponent(raw))
        setTooltip({ x: e.clientX, y: e.clientY, content: `<strong>${name}</strong><br>${sub}` })
      }
      setHlId(g.dataset.id ?? null)
    } else {
      setTooltip(null)
      setHlId(null)
    }
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    if (getSvgTarget(e)) return
    dragRef.current = { prevX: e.clientX }
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (dragRef.current) { dragRef.current = null; return }
    const g = getSvgTarget(e)
    if (g?.dataset.id) onEventClick(g.dataset.id)
    else onBackgroundClick()
  }

  function handleMouseLeave() {
    dragRef.current = null
    setTooltip(null)
    setHlId(null)
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const rect = wrapRef.current!.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD) / TL_W))
      onZoom(e.deltaY, ratio, w)
    } else {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      onPan(delta * span * 0.0008)
    }
  }

  // ── Touch pan / pinch-zoom ────────────────────────────────────────────────
  const touchStateRef = useRef<{
    startX: number; startY: number; prevX: number
    prevDist: number | null
    moved: boolean; isVertical: boolean | null; startTarget: EventTarget | null
    lastT: number; vx: number   // for flick momentum: timestamp + smoothed px/ms velocity
  } | null>(null)
  const momentumRef = useRef<number | null>(null)

  const latestRef = useRef({ TL_W, span, PAD, w, onPan, onZoom, onZoomBy, onEventClick, onBackgroundClick, onDoubleTap })
  useEffect(() => { latestRef.current = { TL_W, span, PAD, w, onPan, onZoom, onZoomBy, onEventClick, onBackgroundClick, onDoubleTap } })
  const lastTapRef = useRef(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    function stopMomentum() {
      if (momentumRef.current !== null) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null }
    }

    // Continue panning after a flick, decaying velocity with friction each frame.
    function startMomentum(vx: number) {
      let v = vx
      let last = performance.now()
      const step = (now: number) => {
        const dt = Math.min(32, now - last)
        last = now
        const { TL_W: tlw, span: sp, onPan: pan } = latestRef.current
        pan(((v * dt) / tlw) * sp)
        v *= Math.pow(0.997, dt)          // ~exponential decay, framerate-independent
        if (Math.abs(v) < 0.015) { momentumRef.current = null; return }  // ~15 px/s floor
        momentumRef.current = requestAnimationFrame(step)
      }
      momentumRef.current = requestAnimationFrame(step)
    }

    function onTouchStart(e: TouchEvent) {
      stopMomentum()  // a new touch grabs control, halting any ongoing fling
      if (e.touches.length === 1) {
        touchStateRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, prevX: e.touches[0].clientX, prevDist: null, moved: false, isVertical: null, startTarget: e.target, lastT: e.timeStamp, vx: 0 }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchStateRef.current = { startX: 0, startY: 0, prevX: 0, prevDist: Math.sqrt(dx * dx + dy * dy), moved: true, isVertical: null, startTarget: null, lastT: e.timeStamp, vx: 0 }
      }
    }

    function onTouchMove(e: TouchEvent) {
      const s = touchStateRef.current
      if (!s) return
      const { TL_W: tlw, span: sp, PAD: pad, onPan: pan } = latestRef.current
      if (e.touches.length === 1 && s.prevDist === null) {
        const adx = Math.abs(e.touches[0].clientX - s.startX)
        const ady = Math.abs(e.touches[0].clientY - s.startY)
        if (s.isVertical === null && (adx > 4 || ady > 4)) {
          s.isVertical = ady > adx
        }
        if (s.isVertical) return  // let browser handle vertical scroll natively
        e.preventDefault()
        const dx = s.prevX - e.touches[0].clientX
        s.prevX = e.touches[0].clientX
        if (adx > 5) s.moved = true
        // Smoothed velocity (px/ms) for post-release momentum
        const dt = Math.max(1, e.timeStamp - s.lastT)
        s.lastT  = e.timeStamp
        s.vx     = 0.7 * (dx / dt) + 0.3 * s.vx
        pan((dx / tlw) * sp)
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (s.prevDist !== null && dist > 5) {
          // Use actual ratio for smooth continuous zoom (clamped to avoid jumps on dropped frames)
          const rawFactor = s.prevDist / dist
          const factor    = Math.max(0.88, Math.min(1.12, rawFactor))
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const rect = el!.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (midX - rect.left - pad) / tlw))
          latestRef.current.onZoomBy(factor, ratio)
        }
        s.prevDist = dist
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const s = touchStateRef.current
      // Flick: if the finger lifted while still moving fast horizontally, coast.
      if (s && s.moved && !s.isVertical && s.prevDist === null && Math.abs(s.vx) > 0.3 && e.timeStamp - s.lastT < 80) {
        startMomentum(s.vx)
      }
      if (s && !s.moved && s.startTarget) {
        // Prevent browser from firing synthetic mousedown/mouseup/click after this tap,
        // which would otherwise immediately call onBackgroundClick and close any panel we open.
        e.preventDefault()
        let cur = s.startTarget as Element | null
        let found = false
        while (cur) {
          if (cur.classList?.contains('ev')) {
            const id = (cur as SVGGElement).dataset?.id
            if (id) latestRef.current.onEventClick(id)
            found = true
            break
          }
          cur = cur.parentElement
        }
        if (!found) {
          // Double-tap on empty space opens the filter (mobile equivalent of Space)
          const now = Date.now()
          if (now - lastTapRef.current < 300) {
            lastTapRef.current = 0
            latestRef.current.onDoubleTap()
          } else {
            lastTapRef.current = now
            latestRef.current.onBackgroundClick()
          }
        }
      }
      touchStateRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      stopMomentum()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, []) // uses latestRef for live values

  return (
    <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Zone labels */}
      <div style={{ width: ZONE_W, minWidth: ZONE_W, background: 'var(--surface)', borderRight: '1px solid var(--border)', position: 'relative', flexShrink: 0, zIndex: 1 }}>
        {zones.map(z => (
          <div key={z.label} style={{
            position: 'absolute', right: 10, fontSize: 9, fontWeight: 600, letterSpacing: '0.8px',
            textTransform: 'uppercase', color: 'var(--muted)', transform: 'translateY(-50%)',
            userSelect: 'none', top: z.top,
          }}>{z.label}</div>
        ))}
      </div>

      {/* Timeline canvas */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, position: 'relative', background: 'var(--bg)',
          overflowX: 'hidden',
          overflowY: isMobile ? 'auto' : 'hidden',
          touchAction: isMobile ? 'pan-y' : 'none',
        }}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          style={isMobile
            ? { display: 'block', width: '100%', height: Math.max(h, BOOKS_Y + 60), cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }
            : { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: dragRef.current ? 'grabbing' : 'grab', userSelect: 'none', WebkitUserSelect: 'none' }
          }
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Keyboard hints — desktop only */}
        {!isMobile && (
          <div style={{ position: 'absolute', bottom: 13, right: 13, display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', pointerEvents: 'none', userSelect: 'none' }}>
            <span><kbd style={kbdStyle}>scroll</kbd> pan</span>
            <span><kbd style={kbdStyle}>←→</kbd> pan</span>
            <span><kbd style={kbdStyle}>↑↓</kbd> zoom</span>
            <span><kbd style={kbdStyle}>N</kbd> new</span>
            <span><kbd style={kbdStyle}>Esc</kbd> close</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 254), top: tooltip.y - 38,
          background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 11px',
          fontSize: 11, color: 'var(--text)', pointerEvents: 'none', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', maxWidth: 240, lineHeight: 1.5,
        }} dangerouslySetInnerHTML={{ __html: tooltip.content }} />
      )}
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '1px 5px', fontSize: 10,
}
