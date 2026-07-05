import { useEffect, useState } from 'react'
import { get, post, del } from '../lib/api'

export default function Resources() {
  const [resources, setResources] = useState([])
  const [courses, setCourses] = useState([])
  const [mode, setMode] = useState('link')       // 'link' | 'book'
  const [url, setUrl] = useState('')
  const [bookQuery, setBookQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [tags, setTags] = useState('')
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (cid = filter) =>
    get(`/api/resources${cid ? `?course_id=${cid}` : ''}`)
      .then(setResources).catch(e => setError(e.message))

  useEffect(() => {
    load()
    get('/api/courses').then(setCourses).catch(() => {})
  }, [])

  const add = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const payload = mode === 'book'
        ? { book_query: bookQuery, course_id: courseId || null, tags: tagList }
        : { url, course_id: courseId || null, tags: tagList }
      await post('/api/resources', payload)
      setUrl(''); setBookQuery(''); setTags('')
      await load()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const remove = async (id) => { await del(`/api/resources/${id}`); load() }

  const changeFilter = (cid) => { setFilter(cid); load(cid) }

  return (
    <>
      <div className="pagehead" style={{ '--tape': 'var(--sky)' }}>
        <h2>Library</h2>
        <p>Paste any link — YouTube videos pull in their own title and thumbnail.
          Tag resources to a course so exam week is one click away.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="seg">
          <button type="button" className={`seg-btn ${mode === 'link' ? 'on' : ''}`}
            onClick={() => setMode('link')}>🔗 Link</button>
          <button type="button" className={`seg-btn ${mode === 'book' ? 'on' : ''}`}
            onClick={() => setMode('book')}>📖 Book</button>
        </div>
        <form onSubmit={add}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            {mode === 'link' ? (
              <label className="field" style={{ flex: 2, marginBottom: 0 }}><span>URL</span>
                <input required value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…" />
              </label>
            ) : (
              <label className="field" style={{ flex: 2, marginBottom: 0 }}><span>Book title or ISBN</span>
                <input required value={bookQuery} onChange={e => setBookQuery(e.target.value)}
                  placeholder="Introduction to Algorithms  ·  or  9780262033848" />
              </label>
            )}
            <label className="field" style={{ marginBottom: 0 }}><span>Course (optional)</span>
              <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                <option value="">—</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0 }}><span>Tags (comma sep)</span>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="DSA, midterm-prep" />
            </label>
            <button className="primary" disabled={busy} style={{ flex: 'none' }}>
              {busy ? 'Fetching…' : mode === 'book' ? 'Find book' : 'Save'}
            </button>
          </div>
          {mode === 'book' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 8 }}>
              Pulls the cover, title, and author automatically from Open Library.
            </p>
          )}
          {error && <div className="error-note">{error}</div>}
        </form>
      </div>

      {courses.length > 0 && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="ghost" style={filter === '' ? { color: 'var(--ink)', borderColor: 'var(--ink-soft)' } : {}}
            onClick={() => changeFilter('')}>all</button>
          {courses.map(c => (
            <button key={c.id} className="ghost"
              style={filter === c.id ? { color: 'var(--ink)', borderColor: 'var(--ink-soft)' } : {}}
              onClick={() => changeFilter(c.id)}>{c.name}</button>
          ))}
        </div>
      )}

      {resources.length === 0 && (
        <div className="empty">Nothing saved yet. Your future 2am-before-the-exam self will thank you.</div>
      )}
      <div className="res-grid">
        {resources.map(r => (
          <div className="rescard" key={r.id}>
            {r.thumbnail
              ? <img className="thumb" src={r.thumbnail} alt="" loading="lazy" />
              : <div className="thumb blank">{r.source_type === 'youtube' ? '▶' : '🔗'}</div>}
            <div className="body">
              <a href={r.url} target="_blank" rel="noreferrer">{r.title || r.url}</a>
              <div className="t-meta">
                <span className="chip">{r.source_type}</span>
                {r.tags.map(t => <span className="chip" key={t}>{t}</span>)}
              </div>
              <button className="ghost danger" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
                onClick={() => remove(r.id)}>remove</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}