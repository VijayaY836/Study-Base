import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { get, post, patch, del } from '../lib/api'

export default function Gpa() {
  const [courses, setCourses] = useState([])
  const [name, setName] = useState('')
  const [scale, setScale] = useState('4.0')
  const [error, setError] = useState('')

  const load = () => get('/api/courses').then(setCourses).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  const addCourse = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await post('/api/courses', { name, scale })
      setName('')
      load()
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--mint)' }}>
        <h2>GPA</h2>
        <p>
          Track each course with its real grade breakdown — then flip it around and ask:
          <em> what do I need on the final?</em>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Add a course</h3>
        <form onSubmit={addCourse} className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 2 }}><span>Course name</span>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Data Structures" />
          </label>
          <label className="field"><span>Scale</span>
            <select value={scale} onChange={e => setScale(e.target.value)}>
              <option value="4.0">4.0 GPA</option>
              <option value="5.0">5.0 GPA</option>
              <option value="10.0">10.0 CGPA</option>
              <option value="percentage">Percentage</option>
            </select>
          </label>
          <button className="primary" style={{ flex: 'none' }}>Add course</button>
        </form>
        {error && <div className="error-note">{error}</div>}
      </div>

      {courses.length === 0 && (
        <div className="empty">No courses yet. Every new course starts with the standard
          Assignments / Midterm / Final / Attendance split — fully editable.</div>
      )}
      <div className="grid">
        {courses.map(c => <CourseCard key={c.id} course={c} onChange={load} />)}
      </div>
    </>
  )
}

function CourseCard({ course, onChange }) {
  const [comps, setComps] = useState(course.components)
  const [target, setTarget] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { setComps(course.components); setResult(null) }, [course])

  const weightSum = comps.reduce((s, c) => s + Number(c.weight_pct || 0), 0)

  const edit = (i, field) => (e) => {
    const next = comps.map((c, j) =>
      j === i ? { ...c, [field]: e.target.value === '' ? null : e.target.value } : c)
    setComps(next)
  }

  const addComp = () => setComps([...comps, { name: 'New component', weight_pct: 0, score_pct: null }])
  const removeComp = (i) => setComps(comps.filter((_, j) => j !== i))

  const save = async () => {
    setError('')
    try {
      await patch(`/api/courses/${course.id}/components`, {
        components: comps.map(c => ({
          name: c.name,
          weight_pct: Number(c.weight_pct),
          score_pct: c.score_pct === null || c.score_pct === '' ? null : Number(c.score_pct),
        })),
      })
      onChange()
    } catch (err) { setError(err.message) }
  }

  const solve = async () => {
    setError('')
    try {
      setResult(await post(`/api/courses/${course.id}/solve`, {
        target: Number(target), target_scale: course.scale,
      }))
    } catch (err) { setError(err.message) }
  }

  const removeCourse = async () => { await del(`/api/courses/${course.id}`); onChange() }

  return (
    <div className="card coursecard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>{course.name}</h3>
          <span className="chip">{course.scale === 'percentage' ? '% scale' : `${course.scale} scale`}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="standing">
            {course.standing_pct === null ? '—' :
              course.scale === 'percentage'
                ? `${course.standing_pct}%`
                : course.standing_on_scale}
            <small> {course.standing_pct !== null && course.scale !== 'percentage' && `(${course.standing_pct}%)`}</small>
          </div>
          <small style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', fontSize: '0.7rem' }}>
            based on {course.graded_weight}% graded so far
          </small>
        </div>
      </div>

      <table className="comp-table">
        <thead>
          <tr><th>Component</th><th>Weight %</th><th>Score % (blank = ungraded)</th><th /></tr>
        </thead>
        <tbody>
          {comps.map((c, i) => (
            <tr key={i}>
              <td><input value={c.name} onChange={edit(i, 'name')} /></td>
              <td><input type="number" min="0" max="100" value={c.weight_pct ?? ''} onChange={edit(i, 'weight_pct')} /></td>
              <td><input type="number" min="0" max="100" value={c.score_pct ?? ''} onChange={edit(i, 'score_pct')} placeholder="—" /></td>
              <td><button className="ghost danger" onClick={() => removeComp(i)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
        <button className="ghost" onClick={addComp} style={{ flex: 'none' }}>+ component</button>
        <span className="chip" style={weightSum !== 100 ? { background: 'var(--peach)', color: 'var(--peach-deep)' } : {}}>
          weights: {weightSum}/100
        </span>
        <button className="primary" onClick={save} disabled={weightSum !== 100} style={{ flex: 'none' }}>
          Save grades
        </button>
        <button className="ghost danger" onClick={removeCourse} style={{ flex: 'none', marginLeft: 'auto' }}>
          delete course
        </button>
      </div>

      <div className="row" style={{ marginTop: 18, alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Target ({course.scale === 'percentage' ? '%' : course.scale})</span>
          <input type="number" step="0.1" value={target} onChange={e => setTarget(e.target.value)}
            placeholder={course.scale === 'percentage' ? '75' : course.scale === '10.0' ? '8.5' : '3.5'} />
        </label>
        <button className="primary" onClick={solve} disabled={!target} style={{ flex: 'none' }}>
          What do I need?
        </button>
      </div>

      {error && <div className="error-note">{error}</div>}
      {result && <SolveResult r={result} />}
    </div>
  )
}

function SolveResult({ r }) {
  if (r.mode === 'none') {
    return (
      <div className={`verdict ${r.met ? '' : 'bad'}`}>
        All components are graded — you finished at <b>{r.final_pct}%</b>.{' '}
        {r.met ? 'Target met 🎉' : 'Just short of the target.'}
      </div>
    )
  }
  if (r.mode === 'single') {
    if (r.already_guaranteed) {
      return <div className="verdict">You've already locked this in — even a 0 on
        <b> {r.unknown_name}</b> keeps you above target. 🎉</div>
    }
    if (!r.achievable) {
      return <div className="verdict bad">Not reachable anymore — you'd need
        <span className="big">{r.required_score}%</span> on <b>{r.unknown_name}</b>,
        which is over 100. Consider a slightly lower target.</div>
    }
    return <div className="verdict">You need
      <span className="big">{r.required_score}%</span> on <b>{r.unknown_name}</b> to hit your target.</div>
  }
  // what-if chart
  const data = r.table.map(row => ({ ...row, b: row.achievable ? row.b : null }))
  const anyAchievable = r.table.some(row => row.achievable)
  return (
    <div style={{ marginTop: 14 }}>
      <div className="verdict" style={{ marginTop: 0, marginBottom: 10 }}>
        Two unknowns ({r.unknown_a} + {r.unknown_b}) — here's the trade-off curve.
        {!anyAchievable && ' No combination reaches this target — try lowering it.'}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: -14 }}>
          <XAxis dataKey="a" tick={{ fontFamily: 'DM Mono', fontSize: 11 }}
            label={{ value: `${r.unknown_a} %`, position: 'insideBottom', offset: -2, fontFamily: 'DM Mono', fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v}%`, `${r.unknown_b} needed`]}
            labelFormatter={(l) => `${r.unknown_a}: ${l}%`}
            contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontFamily: 'DM Mono', fontSize: 12 }} />
          <ReferenceLine y={100} stroke="#e05c6e" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="b" stroke="#3f9d6e" strokeWidth={2.5}
            dot={{ r: 3, fill: '#3f9d6e' }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
