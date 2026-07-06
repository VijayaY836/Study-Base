import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { get } from '../lib/api'

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIP = {
  borderRadius: 12, border: '1px solid rgba(58,53,96,0.1)',
  fontFamily: 'DM Mono', fontSize: 12, boxShadow: '0 6px 20px rgba(58,53,96,0.12)',
}

const moodFace = (s) =>
  s == null ? '· · ·' : s > 0.25 ? '😊' : s < -0.25 ? '😔' : '😐'

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [courses, setCourses] = useState([])
  const [reflections, setReflections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/api/tasks').catch(() => []),
      get('/api/courses').catch(() => []),
      get('/api/reflections').catch(() => []),
    ]).then(([t, c, r]) => {
      setTasks(t); setCourses(c); setReflections(r); setLoading(false)
    })
  }, [])

  const today = iso(new Date())

  const m = useMemo(() => {
    const pending = tasks.filter(t => t.status === 'pending')
    const overdue = pending.filter(t => t.due_date && t.due_date < today)
    const weekAhead = iso(new Date(Date.now() + 7 * 864e5))
    const dueThisWeek = pending.filter(t => t.due_date && t.due_date >= today && t.due_date <= weekAhead)

    // credit-weighted overall standing (%) across graded courses
    const graded = courses.filter(c => c.standing_pct != null)
    const totCred = graded.reduce((s, c) => s + (c.credit_hours || 1), 0)
    const overall = totCred
      ? graded.reduce((s, c) => s + c.standing_pct * (c.credit_hours || 1), 0) / totCred
      : null

    // journal streak: consecutive days with an entry, counting back from today
    const dates = new Set(reflections.map(r => r.date))
    let streak = 0
    for (let i = 0; ; i++) {
      const d = iso(new Date(Date.now() - i * 864e5))
      if (dates.has(d)) streak++
      else if (i === 0) continue          // today not written yet is fine
      else break
    }

    const scored = reflections.filter(r => r.mood_score != null)
    const recentMood = scored.slice(-14)
    const avgMood = recentMood.length
      ? recentMood.reduce((s, r) => s + r.mood_score, 0) / recentMood.length : null

    // charts
    const moodSeries = scored.map(r => ({ date: r.date.slice(5), score: Number(r.mood_score.toFixed(3)) }))

    const gpaSeries = courses
      .filter(c => c.standing_pct != null)
      .map(c => ({ name: c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name,
        pct: c.standing_pct, scaleVal: c.standing_on_scale, scale: c.scale }))

    const prio = ['high', 'medium', 'low'].map(p => ({
      name: p[0].toUpperCase() + p.slice(1),
      value: pending.filter(t => t.priority === p).length, key: p,
    })).filter(x => x.value > 0)

    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 864e5)
      const key = iso(d)
      const done = tasks.filter(t =>
        t.completed_at && iso(new Date(t.completed_at)) === key).length
      return { day: DOW[d.getDay()], done }
    })

    const upcoming = pending
      .filter(t => t.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)

    return { pending, overdue, dueThisWeek, overall, streak, avgMood,
      moodSeries, gpaSeries, prio, weekly, upcoming, completedTotal: tasks.filter(t => t.status === 'done').length }
  }, [tasks, courses, reflections, today])

  const PRIO_COLOR = { high: '#e88a5d', medium: '#c99a2e', low: '#4b93c9' }

  if (loading) return <div className="empty" style={{ marginTop: 40 }}>Pulling your semester together…</div>

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--mint)' }}>
        <h2>Dashboard</h2>
        <p>Your whole semester at a glance — grades, mood, and momentum in one place.</p>
      </div>

      <div className="dash-kpis">
        <Kpi tint="var(--mint)" value={m.overall == null ? '—' : `${m.overall.toFixed(1)}%`}
          label="overall standing" sub={m.overall == null ? 'add course grades' : 'credit-weighted'} />
        <Kpi tint="var(--peach)" value={m.pending.length} label="tasks pending"
          sub={`${m.completedTotal} done all-time`} />
        <Kpi tint="var(--butter)" value={m.dueThisWeek.length} label="due this week"
          sub={m.overdue.length ? `${m.overdue.length} overdue` : 'nothing overdue'} />
        <Kpi tint="var(--lilac)" value={`${m.streak}d`} label="journal streak"
          sub={m.streak ? 'keep it going' : 'write today'} />
        <Kpi tint="var(--sky)" value={moodFace(m.avgMood)} label="recent mood"
          sub={m.avgMood == null ? 'no entries yet' : `${m.avgMood > 0 ? '+' : ''}${m.avgMood.toFixed(2)} avg`} />
      </div>

      {/* headline data-viz: mood over time */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="dash-cardhead">
          <h3>Mood over time</h3>
          <span className="chip">the semester's shape</span>
        </div>
        {m.moodSeries.length < 2 ? (
          <div className="empty" style={{ padding: 30 }}>
            Write a couple of journal entries and your mood curve appears here.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={m.moodSeries} margin={{ top: 8, right: 14, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8a6fd1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8a6fd1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,53,96,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="rgba(58,53,96,0.15)" />
              <Tooltip contentStyle={TIP} formatter={(v) => [v, 'mood']} />
              <Area type="monotone" dataKey="score" stroke="#8a6fd1" strokeWidth={2.5} fill="url(#moodFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dash-row two">
        <div className="card">
          <div className="dash-cardhead"><h3>Standing by course</h3><span className="chip">normalized to %</span></div>
          {m.gpaSeries.length === 0 ? (
            <div className="empty" style={{ padding: 26 }}>Enter some grades on the GPA tab.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.gpaSeries} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,53,96,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontFamily: 'DM Mono', fontSize: 10 }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
                <Tooltip contentStyle={TIP}
                  formatter={(v, _n, p) => [`${v}%  (${p.payload.scaleVal ?? '—'} on ${p.payload.scale})`, 'standing']} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} fill="#3f9d6e" maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="dash-cardhead"><h3>Pending by priority</h3></div>
          {m.prio.length === 0 ? (
            <div className="empty" style={{ padding: 26 }}>No pending tasks. Enjoy it.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={m.prio} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}
                  paddingAngle={3} strokeWidth={0}>
                  {m.prio.map(e => <Cell key={e.key} fill={PRIO_COLOR[e.key]} />)}
                </Pie>
                <Tooltip contentStyle={TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="donut-legend">
            {m.prio.map(e => (
              <span key={e.key}><span className="dot" style={{ background: PRIO_COLOR[e.key] }} />
                {e.name} · {e.value}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-row two">
        <div className="card">
          <div className="dash-cardhead"><h3>This week's momentum</h3><span className="chip">tasks completed</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={m.weekly} margin={{ top: 8, right: 10, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,53,96,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <Tooltip contentStyle={TIP} formatter={(v) => [v, 'done']} cursor={{ fill: 'rgba(58,53,96,0.04)' }} />
              <Bar dataKey="done" radius={[6, 6, 0, 0]} fill="#f98d77" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="dash-cardhead"><h3>Up next</h3></div>
          {m.upcoming.length === 0 ? (
            <div className="empty" style={{ padding: 26 }}>No dated tasks ahead. Add due dates to see them here.</div>
          ) : (
            <div className="tasklist">
              {m.upcoming.map(t => {
                const overdue = t.due_date < today
                return (
                  <div className="taskitem" key={t.id} style={{ padding: '11px 14px' }}>
                    <span className={`due-badge ${overdue ? 'over' : ''}`}>{t.due_date.slice(5)}</span>
                    <div className="t-main">
                      <div className="t-title" style={{ fontSize: '0.92rem' }}>{t.title}</div>
                      <div className="t-meta">
                        <span className={`chip ${t.priority}`}>{t.priority}</span>
                        {overdue && <span className="chip" style={{ background: 'var(--peach)', color: 'var(--danger)' }}>overdue</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Kpi({ tint, value, label, sub }) {
  return (
    <div className="kpi" style={{ '--ov': tint }}>
      <span className="kpi-num">{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}