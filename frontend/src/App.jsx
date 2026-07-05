import { useEffect, useState } from 'react'
import { supabase, demoMode } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Tasks from './pages/Tasks'
import Gpa from './pages/Gpa'
import Reflections from './pages/Reflections'
import Resources from './pages/Resources'
import Schedule from './pages/Schedule'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', color: 'mint', el: Dashboard },
  { id: 'calendar', label: 'Calendar', color: 'peach', el: Calendar },
  { id: 'tasks', label: 'Tasks', color: 'peach', el: Tasks },
  { id: 'gpa', label: 'GPA', color: 'mint', el: Gpa },
  { id: 'journal', label: 'Journal', color: 'lilac', el: Reflections },
  { id: 'library', label: 'Library', color: 'sky', el: Resources },
  { id: 'schedule', label: 'Planner', color: 'butter', el: Schedule },
]

function AuthGate({ onDone }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { data, error } = await fn
    setBusy(false)
    if (error) return setError(error.message)
    if (mode === 'signup' && !data.session) {
      return setNotice('Check your inbox — confirm your email, then sign in.')
    }
    onDone()
  }

  return (
    <div className="authwrap">
      <div className="card authcard fade-in">
        <div className="logo">Study<em style={{ color: 'var(--coral-deep)', fontStyle: 'normal' }}>Base</em></div>
        <div className="sub">your semester, sorted</div>
        <form onSubmit={submit}>
          <label className="field"><span>Email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu" />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <button className="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          {error && <div className="error-note">{error}</div>}
          {notice && <div className="verdict" style={{ marginTop: 10 }}>{notice}</div>}
        </form>
        <div className="switchmode">
          {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(demoMode)

  useEffect(() => {
    if (demoMode) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!demoMode && !session) return <AuthGate onDone={() => {}} />

  const Active = TABS.find(t => t.id === tab).el

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>Study<em>Base</em></h1>
          <span className="tagline">your semester, sorted</span>
        </div>
        {!demoMode && (
          <button className="signout" onClick={() => supabase.auth.signOut()}>
            sign out
          </button>
        )}
      </div>

      {demoMode && (
        <div className="demo-banner">
          demo mode — no login configured yet, data is shared locally
        </div>
      )}

      <nav className="tabs" aria-label="Sections">
        {TABS.map(t => (
          <button
            key={t.id}
            data-c={t.color}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="fade-in" key={tab}>
        <Active />
      </div>
    </div>
  )
}