// Sample-account demo mode. When active, all /api/* calls are served from an
// in-memory dataset instead of the backend — so a visitor gets a fully
// populated, fully interactive StudyBase with nothing persisted. Resets on exit.

// ---------------------------------------------------------------- helpers --
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayOffset = (n) => iso(new Date(Date.now() + n * 864e5))
const nowISO = () => new Date().toISOString()
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

// ---------------------------------------------------------- GPA math (JS) --
const SCALE_MAX = { '4.0': 4.0, '5.0': 5.0, '10.0': 10.0, percentage: 100.0 }
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d
const targetToPct = (t, s) => (t / (SCALE_MAX[s] ?? 4)) * 100
const pctToScale = (p, s) => round((p / 100) * (SCALE_MAX[s] ?? 4), 2)

function currentStanding(components) {
  const graded = components.filter(c => c.score_pct != null)
  const gw = graded.reduce((s, c) => s + c.weight_pct, 0)
  if (gw === 0) return [null, 0]
  const earned = graded.reduce((s, c) => s + (c.weight_pct * c.score_pct) / 100, 0)
  return [round((earned / gw) * 100, 2), round(gw, 2)]
}

function solve(components, targetPct) {
  const known = components.filter(c => c.score_pct != null)
  const unknown = components.filter(c => c.score_pct == null)
  const banked = known.reduce((s, c) => s + (c.weight_pct * c.score_pct) / 100, 0)
  if (unknown.length === 0) {
    const [standing] = currentStanding(components)
    return { mode: 'none', final_pct: standing, met: standing != null && standing >= targetPct }
  }
  if (unknown.length === 1) {
    const u = unknown[0], w = u.weight_pct / 100
    const required = w > 0 ? (targetPct - banked) / w : Infinity
    return {
      mode: 'single', unknown_name: u.name, required_score: round(required, 1),
      achievable: required <= 100, already_guaranteed: required <= 0,
    }
  }
  const [a, b] = unknown, wa = a.weight_pct / 100, wb = b.weight_pct / 100
  const table = []
  for (let aScore = 0; aScore <= 100; aScore += 5) {
    const rem = targetPct - banked - wa * aScore
    const bNeeded = wb > 0 ? rem / wb : Infinity
    table.push({ a: aScore, b: round(Math.min(Math.max(bNeeded, 0), 999), 1), achievable: bNeeded <= 100 })
  }
  return { mode: 'whatif', unknown_a: a.name, unknown_b: b.name, ignored_unknowns: unknown.slice(2).map(c => c.name), table }
}

function generateSchedule(tasks, slots) {
  const rank = { high: 0, medium: 1, low: 2 }
  const mins = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m }
  const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
  const ordered = tasks.filter(t => t.duration_mins)
    .sort((x, y) => (rank[x.priority] - rank[y.priority]) || String(x.due_date || '9999').localeCompare(String(y.due_date || '9999')))
  const free = slots.map(s => ({ start: mins(s.start), end: mins(s.end) })).sort((a, b) => a.start - b.start)
  const largest = free.reduce((m, s) => Math.max(m, s.end - s.start), 0)
  const scheduled = [], unscheduled = []
  for (const task of ordered) {
    let need = task.duration_mins
    const splittable = need > largest
    let placedAny = false
    for (const slot of free) {
      const room = slot.end - slot.start
      if (room <= 0) continue
      if (need <= room) {
        scheduled.push({ task_id: task.id, title: task.title, slot_start: hhmm(slot.start), slot_end: hhmm(slot.start + need), split: splittable && placedAny })
        slot.start += need; need = 0; placedAny = true; break
      }
      if (splittable) {
        scheduled.push({ task_id: task.id, title: task.title, slot_start: hhmm(slot.start), slot_end: hhmm(slot.end), split: true })
        need -= room; slot.start = slot.end; placedAny = true
      }
    }
    if (need > 0) unscheduled.push(task.id)
  }
  return { scheduled, unscheduled }
}

// ------------------------------------------------------------ seed factory --
function freshStore() {
  const courses = [
    course('Data Structures', '10.0', 4, [['Assignments', 20, 88], ['Midterm', 30, 74], ['Final', 40, null], ['Attendance', 10, 100]]),
    course('DBMS', '10.0', 3, [['Assignments', 20, 92], ['Midterm', 30, 81], ['Final', 40, null], ['Attendance', 10, 95]]),
    course('Operating Systems', '4.0', 4, [['Assignments', 20, 70], ['Midterm', 30, 66], ['Final', 40, null], ['Attendance', 10, 90]]),
    course('Discrete Math', 'percentage', 3, [['Assignments', 20, 85], ['Midterm', 30, 78], ['Final', 40, 82], ['Attendance', 10, 100]]),
  ]
  const cById = Object.fromEntries(courses.map(c => [c.name, c.id]))

  const tasks = [
    task('Finish DBMS assignment', 'high', dayOffset(0), null, 90),
    task('Read OS chapter 4 (scheduling)', 'medium', dayOffset(0), null, 60),
    task('Return library books', 'high', dayOffset(-2), null, 20),
    task('Gym', 'low', dayOffset(1), null, 45),
    task('Group project sync', 'medium', dayOffset(2), null, 60),
    task('Buy a birthday gift', 'high', dayOffset(3), null, 40),
    task('Discrete Math problem set', 'medium', dayOffset(4), null, 75),
    task('Submit scholarship form', 'high', dayOffset(7), null, 30),
    // completed (spread across last week for the momentum chart)
    task('DSA lab 3', 'medium', null, 1, 60),
    task('Email professor about grade', 'low', null, 1, 15),
    task('OS quiz revision', 'high', null, 2, 90),
    task('Clean up lecture notes', 'low', null, 3, 30),
    task('Laundry', 'low', null, 4, 45),
    task('Seminar slides', 'medium', null, 5, 120),
    task('Read research paper', 'medium', null, 6, 60),
  ]

  const moods = [0.5, 0.6, -0.2, -0.5, 0.1, 0.3, 0.7, 0.5, -0.1, -0.3, 0.2, 0.6, 0.8, 0.4]
  const entries = ['Assignments piling up but manageable.', 'Good study session at the library today.',
    'Felt behind on OS, a bit stressed.', 'Rough day — exam nerves.', 'Reset a little, made a plan.',
    'Productive afternoon.', 'Finished the DSA lab, feeling good!', 'Steady day.', 'Tired but okay.',
    'Overwhelmed by deadlines.', 'Talked to a friend, felt better.', 'On top of things today.',
    'Great mood — everything clicked.', 'Solid, calm day.']
  const reflections = moods.map((ms, i) => ({
    id: uid(), date: dayOffset(-(moods.length - 1 - i)), entry_text: entries[i],
    mood_label: ms > 0.25 ? 'positive' : ms < -0.25 ? 'negative' : 'neutral', mood_score: ms,
  }))

  const resources = [
    resource('https://www.youtube.com/watch?v=RBSGKlAvoiM', 'youtube', 'Data Structures Easy to Advanced Course', 'https://i.ytimg.com/vi/RBSGKlAvoiM/mqdefault.jpg', ['DSA'], cById['Data Structures']),
    resource('https://www.youtube.com/watch?v=HXV3zeQKqGY', 'youtube', 'SQL Full Course for Beginners', 'https://i.ytimg.com/vi/HXV3zeQKqGY/mqdefault.jpg', ['DBMS', 'midterm-prep'], cById['DBMS']),
    resource('https://pages.cs.wisc.edu/~remzi/OSTEP/', 'article', 'Operating Systems: Three Easy Pieces', null, ['OS', 'textbook'], cById['Operating Systems']),
    resource('https://openlibrary.org/works/OL1234W', 'book', 'Introduction to Algorithms', 'https://covers.openlibrary.org/b/id/8291276-M.jpg', ['by Thomas H. Cormen', 'reference'], cById['Data Structures']),
    resource('https://brilliant.org/courses/logic/', 'article', 'Logic & Discrete Math practice', null, ['practice'], cById['Discrete Math']),
  ]

  return { tasks, courses, reflections, resources }
}

function course(name, scale, credit, comps) {
  return { id: uid(), name, scale, credit_hours: credit,
    components: comps.map(([n, w, s]) => ({ id: uid(), name: n, weight_pct: w, score_pct: s })) }
}
function task(title, priority, due_date, doneDaysAgo, duration_mins) {
  return { id: uid(), title, description: null, due_date, priority, duration_mins,
    status: doneDaysAgo != null ? 'done' : 'pending', created_at: nowISO(),
    completed_at: doneDaysAgo != null ? new Date(Date.now() - doneDaysAgo * 864e5).toISOString() : null }
}
function resource(url, source_type, title, thumbnail, tags, course_id) {
  return { id: uid(), url, source_type, title, thumbnail, tags, course_id, created_at: nowISO() }
}

// ------------------------------------------------------------- mock router --
let store = null
let active = false

export const sampleActive = () => active
export function enterSample() { store = freshStore(); active = true }
export function exitSample() { active = false; store = null }

export const sampleProfile = {
  name: 'Alex Rivera', email: 'alex.demo@studybase.app', created: '2026-01-15T00:00:00Z', avatar: null,
}

function courseOut(c) {
  const [standing, gw] = currentStanding(c.components)
  return { ...c, standing_pct: standing, graded_weight: gw,
    standing_on_scale: standing != null ? pctToScale(standing, c.scale) : null }
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
    if (u.pathname === '/watch') return u.searchParams.get('v')
  } catch { /* ignore */ }
  return null
}

function naiveMood(text) {
  const t = text.toLowerCase()
  const pos = ['good', 'great', 'happy', 'productive', 'calm', 'finished', 'better', 'clicked', 'love', 'excited']
  const neg = ['stress', 'tired', 'behind', 'overwhelm', 'rough', 'nerves', 'sad', 'anxious', 'bad', 'hard']
  let s = 0
  pos.forEach(w => { if (t.includes(w)) s += 0.4 })
  neg.forEach(w => { if (t.includes(w)) s -= 0.4 })
  s = Math.max(-1, Math.min(1, round(s, 2)))
  return [s > 0.25 ? 'positive' : s < -0.25 ? 'negative' : 'neutral', s]
}

const CHAT_REPLIES = [
  "You're in solid shape! Data Structures (83%) and DBMS (88%) are looking strong. The thing I'd jump on first: \"Return library books\" is overdue, and \"Finish DBMS assignment\" is due today. Knock those out, then \"Read OS chapter 4\". You've got this! 🌱",
  "Looking at your week — your mood's been trending up lately, so ride that momentum. Operating Systems is your softest spot right now (68%), so I'd give the OS final some extra love. Small steps: one task at a time.",
  "Deep breath — you have 8 pending tasks but only 2 are urgent today. Everything else has room. Start with the high-priority ones and let the rest wait. Progress over perfection. 💛",
]
let chatIdx = 0

// Build a compact snapshot of the sample student's data for the AI.
function sampleContext() {
  const s = store, today = dayOffset(0)
  const pending = s.tasks.filter(t => t.status === 'pending')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const lines = [`Student: Alex Rivera. Pending tasks: ${pending.length} `
    + `(${overdue.length} overdue, ${dueToday.length} due today). `
    + `Completed all-time: ${s.tasks.length - pending.length}.`]
  const upcoming = pending.filter(t => t.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6)
  if (upcoming.length) lines.push('Upcoming: ' + upcoming
    .map(t => `${t.title} (due ${t.due_date}, ${t.priority})`).join('; '))
  const cparts = s.courses.map(c => {
    const [st] = currentStanding(c.components)
    return `${c.name}: ${st != null ? st + '%' : 'no grades yet'} (${c.scale})`
  })
  if (cparts.length) lines.push('Courses — ' + cparts.join(' | '))
  const scored = s.reflections.filter(r => r.mood_score != null)
  if (scored.length) {
    const avg = round(scored.reduce((a, r) => a + r.mood_score, 0) / scored.length, 2)
    lines.push(`Recent average mood (-1 low to +1 high): ${avg}.`)
  }
  return lines.join('\n')
}

// The public entry point used by lib/api.js when sample mode is on.
export async function sampleApi(path, options = {}) {
  await new Promise(r => setTimeout(r, 180)) // tiny delay so it feels real
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : {}
  const [rawPath, query = ''] = path.split('?')
  const parts = rawPath.split('/').filter(Boolean) // e.g. ['api','tasks']
  const q = Object.fromEntries(new URLSearchParams(query))
  const fail = (msg) => { throw new Error(msg) }

  // ----- tasks -----
  if (parts[1] === 'tasks') {
    if (method === 'GET') {
      let ts = store.tasks
      if (q.status) ts = ts.filter(t => t.status === q.status)
      return ts
    }
    if (method === 'POST') {
      if (!body.title?.trim()) fail('Title is required')
      const t = task(body.title.trim(), body.priority || 'medium', body.due_date || null, null, body.duration_mins || null)
      t.description = body.description || null
      store.tasks.unshift(t)
      return t
    }
    const t = store.tasks.find(x => x.id === parts[2])
    if (!t) fail('Task not found')
    if (method === 'PATCH') {
      Object.assign(t, {
        title: body.title ?? t.title, description: body.description ?? t.description,
        priority: body.priority ?? t.priority, duration_mins: body.duration_mins ?? t.duration_mins,
        due_date: 'due_date' in body ? body.due_date : t.due_date,
      })
      if ('status' in body) { t.status = body.status; t.completed_at = body.status === 'done' ? nowISO() : null }
      return t
    }
    if (method === 'DELETE') { store.tasks = store.tasks.filter(x => x.id !== t.id); return null }
  }

  // ----- courses -----
  if (parts[1] === 'courses') {
    if (parts.length === 2 && method === 'GET') return store.courses.map(courseOut)
    if (parts.length === 2 && method === 'POST') {
      const breakdown = body.components || [
        { name: 'Assignments', weight_pct: 20 }, { name: 'Midterm', weight_pct: 30 },
        { name: 'Final', weight_pct: 40 }, { name: 'Attendance', weight_pct: 10 }]
      if (round(breakdown.reduce((s, x) => s + x.weight_pct, 0)) !== 100) fail('Component weights must sum to 100')
      if (!body.name?.trim()) fail('Course name is required')
      const c = { id: uid(), name: body.name.trim(), scale: body.scale || '4.0', credit_hours: body.credit_hours || 1,
        components: breakdown.map(x => ({ id: uid(), name: x.name, weight_pct: x.weight_pct, score_pct: x.score_pct ?? null })) }
      store.courses.push(c)
      return courseOut(c)
    }
    const c = store.courses.find(x => x.id === parts[2])
    if (!c) fail('Course not found')
    if (parts[3] === 'components' && method === 'PATCH') {
      if (round(body.components.reduce((s, x) => s + x.weight_pct, 0)) !== 100) fail('Component weights must sum to 100')
      c.components = body.components.map(x => ({ id: uid(), name: x.name, weight_pct: Number(x.weight_pct),
        score_pct: x.score_pct === '' || x.score_pct == null ? null : Number(x.score_pct) }))
      return courseOut(c)
    }
    if (parts[3] === 'solve' && method === 'POST') {
      const targetPct = targetToPct(Number(body.target || 0), body.target_scale || c.scale)
      return { ...solve(c.components, targetPct), target_pct: round(targetPct, 2) }
    }
    if (method === 'DELETE') { store.courses = store.courses.filter(x => x.id !== c.id); return null }
  }

  // ----- resources -----
  if (parts[1] === 'resources') {
    if (method === 'GET') {
      let rs = store.resources
      if (q.course_id) rs = rs.filter(r => r.course_id === q.course_id)
      return rs
    }
    if (method === 'POST') {
      const tags = body.tags || []
      if (body.book_query) {
        const r = resource('https://openlibrary.org', 'book', body.book_query, null, ['by Unknown author', ...tags], body.course_id || null)
        store.resources.unshift(r); return r
      }
      const url = (body.url || '').trim()
      if (!url.startsWith('http')) fail('Enter a full URL (starting with https://)')
      const vid = extractYouTubeId(url)
      const r = vid
        ? resource(url, 'youtube', url, `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, tags, body.course_id || null)
        : resource(url, 'article', url, null, tags, body.course_id || null)
      store.resources.unshift(r); return r
    }
    if (method === 'DELETE') { store.resources = store.resources.filter(x => x.id !== parts[2]); return null }
  }

  // ----- reflections -----
  if (parts[1] === 'reflections') {
    if (parts[2] && parts[3] === 'remood' && method === 'POST') {
      const r = store.reflections.find(x => x.id === parts[2])
      if (r) [r.mood_label, r.mood_score] = naiveMood(r.entry_text)
      return r
    }
    if (method === 'GET') return [...store.reflections].sort((a, b) => a.date.localeCompare(b.date))
    if (method === 'POST') {
      const text = (body.entry_text || '').trim()
      if (!text) fail('Write something first')
      const date = body.date || dayOffset(0)
      if (store.reflections.some(r => r.date === date)) fail('You already wrote a reflection for this day')
      const [label, score] = naiveMood(text)
      const r = { id: uid(), date, entry_text: text, mood_label: label, mood_score: score }
      store.reflections.push(r)
      return r
    }
  }

  // ----- schedule -----
  if (parts[1] === 'schedule' && parts[2] === 'generate' && method === 'POST') {
    const chosen = store.tasks.filter(t => (body.task_ids || []).includes(t.id))
    const missing = chosen.filter(t => !t.duration_mins).map(t => t.title)
    if (missing.length) fail('These tasks need an estimated duration first: ' + missing.join(', '))
    return generateSchedule(chosen, body.slots || [])
  }

  // ----- holidays (a small canned set around now, so the calendar shows the feature) -----
  if (parts[1] === 'holidays' && method === 'GET') {
    const year = new Date().getFullYear()
    return [
      { date: `${year}-01-01`, name: "New Year's Day", localName: "New Year's Day" },
      { date: `${year}-01-26`, name: 'Republic Day', localName: 'Republic Day' },
      { date: dayOffset(3), name: 'Sample Holiday', localName: 'Sample Holiday' },
      { date: `${year}-08-15`, name: 'Independence Day', localName: 'Independence Day' },
    ]
  }

  // ----- chat: try the live AI (guest endpoint) first, fall back to canned -----
  if (parts[1] === 'chat' && method === 'POST') {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 22000)
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/chat/guest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: body.messages || [], context: sampleContext() }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        if (data && data.reply) return { configured: true, reply: data.reply }
      }
    } catch { /* backend unreachable — use a canned reply */ }
    const reply = CHAT_REPLIES[chatIdx % CHAT_REPLIES.length]; chatIdx++
    return { configured: true, reply }
  }

  if (parts[1] === 'health') return { ok: true, demo_mode: true, sample: true }

  return null
}