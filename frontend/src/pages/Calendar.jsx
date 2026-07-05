import { useEffect, useMemo, useState } from 'react'
import { get, patch } from '../lib/api'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const RANK = { high: 3, medium: 2, low: 1 }

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const COUNTRIES = [
  ['IN', '🇮🇳 India'], ['US', '🇺🇸 USA'], ['GB', '🇬🇧 UK'], ['CA', '🇨🇦 Canada'],
  ['AU', '🇦🇺 Australia'], ['DE', '🇩🇪 Germany'], ['FR', '🇫🇷 France'],
  ['SG', '🇸🇬 Singapore'], ['AE', '🇦🇪 UAE'], ['JP', '🇯🇵 Japan'],
]

export default function Calendar() {
  const [tasks, setTasks] = useState([])
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(iso(new Date()))
  const [country, setCountry] = useState(() => localStorage.getItem('sb_country') || 'IN')
  const [holidays, setHolidays] = useState({})   // { 'YYYY-MM-DD': name }
  const [error, setError] = useState('')

  const load = () => get('/api/tasks?status=pending').then(setTasks).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  // fetch holidays whenever the displayed year or country changes
  const year = cursor.getFullYear()
  useEffect(() => {
    localStorage.setItem('sb_country', country)
    get(`/api/holidays?year=${year}&country=${country}`)
      .then(list => setHolidays(Object.fromEntries(list.map(h => [h.date, h.name || h.localName]))))
      .catch(() => setHolidays({}))
  }, [year, country])

  const todayIso = iso(new Date())

  // Group pending tasks by their due date
  const byDay = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!t.due_date) continue
      ;(map[t.due_date] ||= []).push(t)
    }
    return map
  }, [tasks])

  // Build the 6-week grid for the current month
  const cells = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())          // back up to the Sunday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      return { date: d, key: iso(d), inMonth: d.getMonth() === month }
    })
  }, [cursor])

  const stepMonth = (delta) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  const goToday = () => {
    const d = new Date()
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(iso(d))
  }

  const complete = async (t) => {
    await patch(`/api/tasks/${t.id}`, { status: 'done' })
    load()
  }

  const dueToday = (byDay[todayIso] || []).length
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < todayIso).length
  const noDate = tasks.filter(t => !t.due_date).length

  const selectedTasks = byDay[selected] || []
  const selDate = new Date(selected + 'T00:00:00')

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--coral)' }}>
        <h2>Calendar</h2>
        <p>Every day is tinted by the most urgent thing due on it. Red edges are overdue.
          Tap a day to see what's on it.</p>
      </div>

      <div className="overview">
        <div className="ov-card" style={{ '--ov': 'var(--peach)' }}>
          <span className="ov-num">{dueToday}</span>
          <span className="ov-label">due today</span>
        </div>
        <div className="ov-card" style={{ '--ov': 'var(--danger)' }}>
          <span className="ov-num">{overdueCount}</span>
          <span className="ov-label">overdue</span>
        </div>
        <div className="ov-card" style={{ '--ov': 'var(--mint)' }}>
          <span className="ov-num">{tasks.length}</span>
          <span className="ov-label">pending total</span>
        </div>
        <div className="ov-card" style={{ '--ov': 'var(--sky)' }}>
          <span className="ov-num">{noDate}</span>
          <span className="ov-label">no due date</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <div className="card cal-wrap">
          <div className="cal-head">
            <div className="cal-title">
              {MONTHS[cursor.getMonth()]} <span>{cursor.getFullYear()}</span>
            </div>
            <div className="cal-nav">
              <select className="cal-country" value={country} onChange={e => setCountry(e.target.value)}
                aria-label="Country for holidays">
                {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
              <button className="ghost" onClick={goToday}>today</button>
              <button className="cal-arrow" onClick={() => stepMonth(-1)} aria-label="Previous month">‹</button>
              <button className="cal-arrow" onClick={() => stepMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>

          <div className="cal-grid cal-dow">
            {DOW.map(d => <div key={d} className="cal-dowcell">{d}</div>)}
          </div>

          <div className="cal-grid">
            {cells.map(({ date, key, inMonth }) => {
              const items = byDay[key] || []
              const top = items.reduce((m, t) => Math.max(m, RANK[t.priority] || 0), 0)
              const tint = top === 3 ? 'high' : top === 2 ? 'medium' : top === 1 ? 'low' : ''
              const overdue = items.length > 0 && key < todayIso
              const holiday = holidays[key]
              return (
                <button
                  key={key}
                  className={[
                    'cal-cell',
                    inMonth ? '' : 'other-month',
                    tint ? `t-${tint}` : '',
                    overdue ? 'overdue' : '',
                    holiday ? 'holiday' : '',
                    key === todayIso ? 'today' : '',
                    key === selected ? 'selected' : '',
                  ].join(' ')}
                  onClick={() => setSelected(key)}
                  title={holiday || undefined}
                >
                  <span className="cal-topline">
                    <span className="cal-num">{date.getDate()}</span>
                    {holiday && <span className="cal-holiday" aria-label={holiday}>★</span>}
                  </span>
                  {items.length > 0 && (
                    <span className="cal-dots">
                      {items.slice(0, 3).map((t, i) =>
                        <span key={i} className={`dot ${t.priority}`} />)}
                      {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="cal-legend">
            <span><span className="dot high" /> high</span>
            <span><span className="dot medium" /> medium</span>
            <span><span className="dot low" /> low</span>
            <span className="leg-over">▎overdue</span>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 4 }}>
            {selDate.toLocaleDateString(undefined, { weekday: 'long' })}
          </h3>
          <div className="chip" style={{ marginBottom: 14 }}>
            {selDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            {selected === todayIso && ' · today'}
          </div>

          {holidays[selected] && (
            <div className="holiday-banner">★ {holidays[selected]}</div>
          )}

          {selectedTasks.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>Nothing due this day. Breathe.</div>
          ) : (
            <div className="tasklist">
              {selectedTasks
                .sort((a, b) => (RANK[b.priority] || 0) - (RANK[a.priority] || 0))
                .map(t => (
                  <div className="taskitem" key={t.id} style={{ padding: '11px 14px' }}>
                    <button className="t-check" onClick={() => complete(t)} aria-label="Mark done">✓</button>
                    <div className="t-main">
                      <div className="t-title" style={{ fontSize: '0.92rem' }}>{t.title}</div>
                      <div className="t-meta">
                        <span className={`chip ${t.priority}`}>{t.priority}</span>
                        {t.duration_mins && <span className="chip">{t.duration_mins} min</span>}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {error && <div className="error-note">{error}</div>}
        </div>
      </div>
    </>
  )
}