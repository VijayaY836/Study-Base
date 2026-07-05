import { useEffect, useMemo, useState } from 'react'
import { supabase, demoMode } from '../lib/supabase'
import { get } from '../lib/api'

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function Account({ onBack }) {
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [courses, setCourses] = useState([])
  const [reflections, setReflections] = useState([])

  useEffect(() => {
    if (demoMode) {
      setProfile({ name: 'Demo Student', email: 'demo@studybase.app', created: null, avatar: null })
    } else {
      supabase.auth.getUser().then(({ data }) => {
        const u = data?.user
        const meta = u?.user_metadata || {}
        setProfile({
          name: meta.full_name || meta.name || (u?.email || '').split('@')[0],
          email: u?.email,
          created: u?.created_at || null,
          avatar: meta.avatar_url || meta.picture || null,
        })
      })
    }
    Promise.all([
      get('/api/tasks').catch(() => []),
      get('/api/courses').catch(() => []),
      get('/api/reflections').catch(() => []),
    ]).then(([t, c, r]) => { setTasks(t); setCourses(c); setReflections(r) })
  }, [])

  const stats = useMemo(() => {
    const done = tasks.filter(t => t.status === 'done').length
    const pending = tasks.length - done
    const graded = courses.filter(c => c.standing_pct != null)
    const totCred = graded.reduce((s, c) => s + (c.credit_hours || 1), 0)
    const overall = totCred
      ? graded.reduce((s, c) => s + c.standing_pct * (c.credit_hours || 1), 0) / totCred
      : null
    const dates = new Set(reflections.map(r => r.date))
    let streak = 0
    for (let i = 0; ; i++) {
      const d = iso(new Date(Date.now() - i * 864e5))
      if (dates.has(d)) streak++
      else if (i === 0) continue
      else break
    }
    return { done, pending, courses: courses.length, overall,
      entries: reflections.length, streak }
  }, [tasks, courses, reflections])

  const initials = (profile?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const memberSince = profile?.created
    ? new Date(profile.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 16 }}>← back</button>

      <div className="pagehead" style={{ '--tape': 'var(--lilac)' }}>
        <h2>My Account</h2>
        <p>Your profile and a snapshot of everything you've tracked in StudyBase.</p>
      </div>

      <div className="card acct-profile">
        {profile?.avatar
          ? <img className="acct-avatar" src={profile.avatar} alt="" />
          : <div className="acct-avatar initials">{initials}</div>}
        <div className="acct-meta">
          <div className="acct-name">{profile?.name || '…'}</div>
          <div className="acct-email">{profile?.email || ''}</div>
          {memberSince && <div className="acct-since">Member since {memberSince}</div>}
        </div>
        {!demoMode && (
          <button className="signout" onClick={() => supabase.auth.signOut()}>sign out</button>
        )}
      </div>

      <div className="dash-kpis" style={{ marginTop: 18 }}>
        <Stat tint="var(--mint)" value={stats.overall == null ? '—' : `${stats.overall.toFixed(1)}%`} label="overall standing" />
        <Stat tint="var(--peach)" value={stats.pending} label="tasks pending" />
        <Stat tint="var(--sky)" value={stats.done} label="tasks completed" />
        <Stat tint="var(--butter)" value={stats.courses} label="courses" />
        <Stat tint="var(--lilac)" value={`${stats.streak}d`} label="journal streak" />
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="kpi" style={{ '--ov': 'var(--coral)', maxWidth: 220 }}>
          <span className="kpi-num">{stats.entries}</span>
          <span className="kpi-label">journal entries</span>
        </div>
      </div>
    </>
  )
}

function Stat({ tint, value, label }) {
  return (
    <div className="kpi" style={{ '--ov': tint }}>
      <span className="kpi-num">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  )
}