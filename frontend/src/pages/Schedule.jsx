import { useEffect, useState } from 'react'
import { get, post } from '../lib/api'

export default function Schedule() {
  const [tasks, setTasks] = useState([])
  const [slots, setSlots] = useState([{ start: '14:00', end: '16:00' }])
  const [picked, setPicked] = useState(new Set())
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('/api/tasks?status=pending').then(ts => {
      setTasks(ts)
      setPicked(new Set(ts.filter(t => t.duration_mins).map(t => t.id)))
    }).catch(e => setError(e.message))
  }, [])

  const setSlot = (i, field) => (e) =>
    setSlots(slots.map((s, j) => j === i ? { ...s, [field]: e.target.value } : s))

  const togglePick = (id) => {
    const next = new Set(picked)
    next.has(id) ? next.delete(id) : next.add(id)
    setPicked(next)
  }

  const generate = async () => {
    setError(''); setPlan(null)
    try {
      setPlan(await post('/api/schedule/generate', {
        date: new Date().toISOString().slice(0, 10),
        slots: slots.filter(s => s.start && s.end && s.start < s.end),
        task_ids: [...picked],
      }))
    } catch (err) { setError(err.message) }
  }

  const titleOf = (id) => tasks.find(t => t.id === id)?.title || id

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--butter)' }}>
        <h2>Planner</h2>
        <p>Tell it when you're free — it slots your tasks in by priority, soonest deadline first.</p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Free time today</h3>
          {slots.map((s, i) => (
            <div className="slotrow" key={i}>
              <label className="field" style={{ marginBottom: 0 }}><span>From</span>
                <input type="time" value={s.start} onChange={setSlot(i, 'start')} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}><span>To</span>
                <input type="time" value={s.end} onChange={setSlot(i, 'end')} />
              </label>
              <button className="ghost danger" style={{ flex: 'none' }}
                onClick={() => setSlots(slots.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="ghost" onClick={() => setSlots([...slots, { start: '', end: '' }])}>
            + add slot
          </button>

          <h3 style={{ marginTop: 20 }}>Tasks to fit in</h3>
          {tasks.length === 0 && <div className="empty">No pending tasks — add some on the Tasks tab.</div>}
          <div className="tasklist">
            {tasks.map(t => (
              <div className="taskitem" key={t.id} style={{ padding: '9px 13px' }}>
                <button className={`t-check ${picked.has(t.id) ? 'on' : ''}`}
                  onClick={() => togglePick(t.id)}
                  disabled={!t.duration_mins}
                  aria-label="Include in plan">✓</button>
                <div className="t-main">
                  <div className="t-title" style={{ fontSize: '0.92rem' }}>{t.title}</div>
                  <div className="t-meta">
                    <span className={`chip ${t.priority}`}>{t.priority}</span>
                    {t.duration_mins
                      ? <span className="chip">{t.duration_mins} min</span>
                      : <span className="chip" style={{ background: 'var(--peach)', color: 'var(--peach-deep)' }}>needs a duration</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="primary" onClick={generate} disabled={picked.size === 0}>
              Build my plan
            </button>
          </div>
          {error && <div className="error-note">{error}</div>}
        </div>

        <div className="card">
          <h3>Today's plan</h3>
          {!plan && <div className="empty">Your plan shows up here.</div>}
          {plan && plan.scheduled.length === 0 && (
            <div className="empty">Nothing fit — try adding more free time.</div>
          )}
          {plan && (
            <>
              <div className="plan">
                {plan.scheduled.map((s, i) => (
                  <div className="planitem" key={i}>
                    <span className="time">{s.slot_start}–{s.slot_end}</span>
                    <span>{s.title}{s.split && ' (part)'}</span>
                  </div>
                ))}
              </div>
              {plan.unscheduled.length > 0 && (
                <div className="warn">
                  Didn't fit today: {plan.unscheduled.map(titleOf).join(', ')}.
                  Free up more time or push these to tomorrow.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
