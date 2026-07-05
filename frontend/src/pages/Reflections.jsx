import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { get, post } from '../lib/api'

const today = () => new Date().toISOString().slice(0, 10)

export default function Reflections() {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => get('/api/reflections').then(setEntries).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  const hasToday = entries.some(e => e.date === today())

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await post('/api/reflections', { date: today(), entry_text: text })
      setText('')
      await load()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const retryMood = async (id) => {
    await post(`/api/reflections/${id}/remood`, {})
    load()
  }

  const chartData = entries
    .filter(e => e.mood_score !== null)
    .map(e => ({ date: e.date.slice(5), score: e.mood_score }))

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--lilac)' }}>
        <h2>Journal</h2>
        <p>One entry a day, append-only. Your mood gets scored quietly in the background
          so you can see the semester's shape over time.</p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>{hasToday ? "Today's entry ✓" : 'How was today?'}</h3>
          {hasToday ? (
            <div className="empty" style={{ padding: 20 }}>
              You've already written today. Come back tomorrow — the journal is append-only on purpose.
            </div>
          ) : (
            <form onSubmit={save}>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="Brain-dump the day. Wins, worries, whatever." />
              <div style={{ marginTop: 12 }}>
                <button className="primary" disabled={busy || !text.trim()}>
                  {busy ? 'Saving…' : 'Save entry'}
                </button>
              </div>
              {error && <div className="error-note">{error}</div>}
            </form>
          )}
        </div>

        <div className="card">
          <h3>Mood over time</h3>
          {chartData.length < 2 ? (
            <div className="empty" style={{ padding: 20 }}>
              The chart appears once you have a couple of scored entries.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                <XAxis dataKey="date" tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
                <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
                <ReferenceLine y={0} stroke="var(--line)" />
                <Tooltip
                  formatter={(v) => [v, 'mood score']}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(58,53,96,0.1)', fontFamily: 'DM Mono', fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#8a6fd1" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#8a6fd1' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Past entries</h3>
        {entries.length === 0 && <div className="empty">Your journal starts with today's first entry.</div>}
        {[...entries].reverse().map(e => (
          <div className="entry" key={e.id}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="date">{e.date}</span>
              <span className={`mood-badge ${e.mood_label || 'none'}`}>
                {e.mood_label || 'mood pending'}
              </span>
              {!e.mood_label && (
                <button className="ghost" onClick={() => retryMood(e.id)}>recompute mood</button>
              )}
            </div>
            <p>{e.entry_text}</p>
          </div>
        ))}
      </div>
    </>
  )
}
