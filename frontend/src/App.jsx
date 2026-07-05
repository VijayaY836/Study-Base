import { useEffect, useState } from 'react'
import { supabase, demoMode } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Account from './pages/Account'
import Chatbot from './pages/Chatbot'
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

  const googleSignIn = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // On success the browser redirects to Google, so nothing runs after this.
    if (error) setError(error.message)
  }

  return (
    <div className="authwrap">
      <div className="card authcard fade-in">
        <div className="logo">Study<em style={{ color: 'var(--coral-deep)', fontStyle: 'normal' }}>Base</em></div>
        <div className="sub">your semester, sorted</div>

        <button type="button" className="google-btn" onClick={googleSignIn}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or with email</span></div>

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
  const [showAccount, setShowAccount] = useState(false)
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
        <div className="topbar-actions">
          <button className="signout" onClick={() => setShowAccount(true)}>my account</button>
          {!demoMode && (
            <button className="signout" onClick={() => supabase.auth.signOut()}>
              sign out
            </button>
          )}
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">
          demo mode — no login configured yet, data is shared locally
        </div>
      )}

      {showAccount ? (
        <div className="fade-in">
          <Account onBack={() => setShowAccount(false)} />
        </div>
      ) : (
        <>
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
        </>
      )}

      <Chatbot />
    </div>
  )
}