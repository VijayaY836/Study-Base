import { useEffect, useState } from 'react'
import { get, post, patch, del } from '../lib/api'

const BLANK = { title: '', description: '', due_date: '', priority: 'medium', duration_mins: '' }

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => get('/api/tasks').then(setTasks).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const add = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await post('/api/tasks', {
        ...form,
        due_date: form.due_date || null,
        duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
      })
      setForm(BLANK)
      await load()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const toggle = async (t) => {
    await patch(`/api/tasks/${t.id}`, { status: t.status === 'done' ? 'pending' : 'done' })
    load()
  }

  const remove = async (t) => { await del(`/api/tasks/${t.id}`); load() }

  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--peach)' }}>
        <h2>Tasks</h2>
        <p>Everything on your plate. Add a duration and the Planner can slot it into your day.</p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Add a task</h3>
          <form onSubmit={add}>
            <label className="field"><span>Title</span>
              <input required value={form.title} onChange={set('title')} placeholder="Finish DBMS assignment" />
            </label>
            <label className="field"><span>Notes (optional)</span>
              <input value={form.description} onChange={set('description')} placeholder="Chapters 4–6" />
            </label>
            <div className="row">
              <label className="field"><span>Due</span>
                <input type="date" value={form.due_date} onChange={set('due_date')} />
              </label>
              <label className="field"><span>Priority</span>
                <select value={form.priority} onChange={set('priority')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="field"><span>Mins</span>
                <input type="number" min="5" step="5" value={form.duration_mins}
                  onChange={set('duration_mins')} placeholder="60" />
              </label>
            </div>
            <button className="primary" disabled={busy}>Add task</button>
            {error && <div className="error-note">{error}</div>}
          </form>
        </div>

        <div>
          <div className="tasklist">
            {pending.length === 0 && <div className="empty">Nothing pending. Add your first task ←</div>}
            {pending.map(t => <TaskRow key={t.id} t={t} toggle={toggle} remove={remove} />)}
          </div>
          {done.length > 0 && (
            <>
              <h3 style={{ margin: '20px 0 10px', fontFamily: 'var(--font-display)' }}>
                Done ({done.length})
              </h3>
              <div className="tasklist">
                {done.map(t => <TaskRow key={t.id} t={t} toggle={toggle} remove={remove} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function TaskRow({ t, toggle, remove }) {
  return (
    <div className={`taskitem ${t.status === 'done' ? 'done' : ''}`}>
      <button
        className={`t-check ${t.status === 'done' ? 'on' : ''}`}
        onClick={() => toggle(t)}
        aria-label={t.status === 'done' ? 'Mark as pending' : 'Mark as done'}
      >✓</button>
      <div className="t-main">
        <div className="t-title">{t.title}</div>
        <div className="t-meta">
          <span className={`chip ${t.priority}`}>{t.priority}</span>
          {t.due_date && <span className="chip">due {t.due_date}</span>}
          {t.duration_mins && <span className="chip">{t.duration_mins} min</span>}
        </div>
      </div>
      <button className="ghost danger" onClick={() => remove(t)}>delete</button>
    </div>
  )
}
