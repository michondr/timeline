import { useCallback, useEffect, useRef, useState } from 'react'
import type { Category, Habit, TimelineEvent, ViewState } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  view: ViewState
  today: Date
  birthdate: Date
  categories: Category[]
  events: TimelineEvent[]
  habits: Habit[]
  showHabits: boolean
  showBooks: boolean
  onToggleHabits: () => void
  onToggleBooks: () => void
  filterIds: Set<string> | null
  onPan: (shiftMs: number) => void
  onZoom: (dy: number, ratio: number, w: number) => void
  onEventClick: (id: string) => void
  onBackgroundClick: () => void
}

const DAY_MS = 86_400_000
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

export function Timeline({ view, today, birthdate, categories, events, habits, showHabits, showBooks, onToggleHabits, onToggleBooks, filterIds, onPan, onZoom, onEventClick, onBackgroundClick }: Props) {
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

  const AXIS_Y   = Math.round(h * 0.42)
  const OPEN_Y   = Math.round(h * 0.07)
  const PINS_Y   = AXIS_Y + 36
  const HABITS_Y = AXIS_Y + Math.round(h * 0.18)
  const BOOKS_Y  = AXIS_Y + Math.round(h * 0.32)

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

  const catById = useCallback((id: string) => categories.find(c => c.id === id) ?? { id, name: id, color: '#888', isSystem: false, systemSlug: null }, [categories])

  // Effective opacity: filtered-out events fade hard, otherwise honour hover highlight
  const evOpacity = (id: string) => {
    if (filterIds && !filterIds.has(id)) return 0.06
    return !hlId || hlId === id ? 1 : 0.15
  }

  // ── Split events by type ──────────────────────────────────────────────────
  const rangeEvs = events.filter(e => e.type === 'range')
  const openEvs  = events.filter(e => e.type === 'open')
  const pinEvs   = events.filter(e => e.type === 'pin')

  // ── Build SVG strings ─────────────────────────────────────────────────────
  const grid = getGridDates(view.startMs, view.endMs)
  const pieces: string[] = []

  // Zone separators
  pieces.push(`<line x1="0" y1="${PINS_Y}" x2="${w}" y2="${PINS_Y}" stroke="#1c1c1e" stroke-width="1"/>`)
  pieces.push(`<line x1="0" y1="${HABITS_Y - 14}" x2="${w}" y2="${HABITS_Y - 14}" stroke="#1c1c1e" stroke-width="1"/>`)
  pieces.push(`<line x1="0" y1="${BOOKS_Y - 14}" x2="${w}" y2="${BOOKS_Y - 14}" stroke="#1c1c1e" stroke-width="1"/>`)

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

  let basePx = BASE_OFF   // pixels above the axis for this block's bottom lane
  for (const block of catBlocks) {
    for (const it of block.items) {
      const laneFromBottom = block.lanes - 1 - it.lane   // lane 0 (longest) → top
      const y   = AXIS_Y - (basePx + laneFromBottom * LANE_H)
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

  // ── Pin events (below axis, grouped by category viewport count) ──────────
  // Sort pin categories by count of visible pins in current view
  const pinCatCounts: Record<string, number> = {}
  pinEvs.forEach(ev => {
    if (!ev.startDate) return
    const x = dateX(new Date(ev.startDate))
    if (x >= EVT_PAD && x <= w - EVT_PAD) {
      pinCatCounts[ev.categoryId] = (pinCatCounts[ev.categoryId] ?? 0) + 1
    }
  })
  const sortedPins = [...pinEvs].sort((a, b) => (pinCatCounts[b.categoryId] ?? 0) - (pinCatCounts[a.categoryId] ?? 0))

  sortedPins.forEach((ev, i) => {
    if (!ev.startDate) return
    const x   = dateX(new Date(ev.startDate))
    if (x < EVT_PAD || x > w - EVT_PAD) return
    const y   = PINS_Y + 16 + i * 26
    const col = catById(ev.categoryId).color
    const sub = `Pin · ${fmtDate(new Date(ev.startDate))}`

    pieces.push(`<g class="ev" data-id="${ev.id}" data-tip="${encodeURIComponent(JSON.stringify({ name: ev.name, sub }))}" style="cursor:pointer;opacity:${evOpacity(ev.id)}">`)
    pieces.push(`<line x1="${x}" y1="${AXIS_Y}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="1.5" opacity="0.25"/>`)
    pieces.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${col}"/>`)
    pieces.push(`<text x="${x + 9}" y="${y + 4}" fill="${col}" font-size="11" font-family="system-ui">${ev.name}</text>`)
    pieces.push(`</g>`)
  })

  // ── Habits ────────────────────────────────────────────────────────────────
  const DAY_MS_LOCAL = DAY_MS
  if (showHabits) habits.forEach((habit, hi) => {
    const y = HABITS_Y + 10 + hi * 22

    // Name label (left of PAD, right-aligned)
    const maxLabelW = ZONE_W - 6
    const label = habit.name.length > 24 ? habit.name.slice(0, 23) + '…' : habit.name
    pieces.push(`<text x="${PAD - 6}" y="${y + 4}" text-anchor="end" fill="#3a3a46" font-size="10" font-family="system-ui" clip-path="none">${label}</text>`)

    // Daily circles
    let doneCount = 0
    let totalPast = 0
    let streak = 0
    let streakBroken = false

    // Iterate from today backwards to count streak
    const todayStr = today.toISOString().slice(0, 10)
    const allDates = Object.keys(habit.logs).sort().reverse()
    for (const d of allDates) {
      if (d > todayStr) continue
      if (habit.logs[d] === 'done') {
        if (!streakBroken) streak++
      } else {
        streakBroken = true
      }
    }

    // Draw circles for visible range
    for (let t = view.startMs; t <= view.endMs; t += DAY_MS_LOCAL) {
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
      if (status === 'done') {
        fill = habit.color
      } else if (status === 'fail') {
        fill = '#5a1818'
      } else {
        fill = '#252528'
      }

      pieces.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${fill}"/>`)
    }

    // Stats on right: streak + completion rate
    const pct  = totalPast > 0 ? Math.round((doneCount / totalPast) * 100) : 0
    const statsX = w - PAD + 6
    const statsTxt = streak > 0 ? `🔥 ${streak} · ${pct}%` : `${pct}%`
    pieces.push(`<text x="${statsX}" y="${y + 4}" fill="#3a3a46" font-size="10" font-family="system-ui">${statsTxt}</text>`)
  })

  const svgContent = pieces.join('\n')

  // ── Zone labels ───────────────────────────────────────────────────────────
  const zones: { label: string; top: number; checked?: boolean; onToggle?: () => void }[] = [
    { label: 'open',   top: OPEN_Y + 12 },
    { label: 'axis',   top: AXIS_Y },
    { label: 'pins',   top: PINS_Y + 42 },
    { label: 'habits', top: HABITS_Y + 30, checked: showHabits, onToggle: onToggleHabits },
    { label: 'books',  top: BOOKS_Y + 28, checked: showBooks,  onToggle: onToggleBooks },
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
  } | null>(null)

  const latestRef = useRef({ TL_W, span, PAD, w, onPan, onZoom, onEventClick, onBackgroundClick })
  useEffect(() => { latestRef.current = { TL_W, span, PAD, w, onPan, onZoom, onEventClick, onBackgroundClick } })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        touchStateRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, prevX: e.touches[0].clientX, prevDist: null, moved: false, isVertical: null, startTarget: e.target }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchStateRef.current = { startX: 0, prevX: 0, prevDist: Math.sqrt(dx * dx + dy * dy), moved: true, startTarget: null }
      }
    }

    function onTouchMove(e: TouchEvent) {
      const s = touchStateRef.current
      if (!s) return
      const { TL_W: tlw, span: sp, PAD: pad, w: cw, onPan: pan, onZoom: zoom } = latestRef.current
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
        pan((dx / tlw) * sp)
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (s.prevDist !== null) {
          const delta = s.prevDist - dist
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const rect = el.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (midX - rect.left - pad) / tlw))
          zoom(delta, ratio, cw)
        }
        s.prevDist = dist
      }
    }

    function onTouchEnd() {
      const s = touchStateRef.current
      if (s && !s.moved && s.startTarget) {
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
        if (!found) latestRef.current.onBackgroundClick()
      }
      touchStateRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
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
            position: 'absolute', right: 10, top: z.top, transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, userSelect: 'none',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: 'var(--muted)',
            }}>{z.label}</div>
            {z.onToggle && (
              <input
                type="checkbox"
                checked={z.checked}
                onChange={z.onToggle}
                title={z.checked ? `Hide ${z.label}` : `Show ${z.label}`}
                style={{ width: 12, height: 12, cursor: 'pointer', accentColor: 'var(--accent)', margin: 0 }}
              />
            )}
          </div>
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
            ? { display: 'block', width: '100%', height: Math.max(h, BOOKS_Y + 60 + habits.length * 22), cursor: 'grab' }
            : { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: dragRef.current ? 'grabbing' : 'grab' }
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
            <span><kbd style={kbdStyle}>pinch</kbd> zoom</span>
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
