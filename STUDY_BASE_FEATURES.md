# StudyBase 🌱
### *Your semester, sorted.*

---

> **Every student has stared at a syllabus doing panicked mental math** — *"if I bomb the midterm, what do I actually need on the final?"* — while a dozen deadlines, saved links, and a quietly rising stress level pile up in three different apps. StudyBase is the one place that answers that question, and every other "where do I stand?" question, in a single glance.

---

## What is StudyBase?

**StudyBase is an all-in-one productivity web app for students.** Most study tools do just one thing — a to-do list here, a GPA calculator there, a mood journal somewhere else. StudyBase brings the entire semester into a single, calm workspace: what's due, how your grades are actually tracking, how you're feeling week to week, the resources you're collecting, and a plan for the day — all tied together, and topped with an AI companion that can *see* your data and help you act on it.

It's private (each account is fully your own), works on any device, and is built so a student can open it once a day and instantly know exactly where they stand and what to do next.

---

## ✅ Live, deployed, and ready to use — right now

StudyBase isn't a prototype or a local demo — it's **fully deployed and usable today**, frontend and backend both live in the cloud with a real database and real authentication.

🔗 **Try it live:** https://study-base-nine.vercel.app

> **👩‍⚖️ For judges — two ways in:**
> 1. **Create your own account** (email/password or one-tap Google sign-in) and start from a clean slate, **or**
> 2. **Skip the signup entirely** — click **"✨ Explore the sample account"** right on the login page to jump straight into a *fully-loaded* StudyBase, pre-filled with courses, grades, tasks, a semester of journal entries, and saved resources. It's fully interactive (add, edit, solve, chat), always pristine for the next visitor, and loads instantly.

---

## What can a user do?

### 📊 See their whole semester at a glance
- Open to a **dashboard** summarizing overall standing, pending tasks, deadlines this week, journal streak, and recent mood.
- Explore **four live data visualizations** — mood over time, grades by course, task-priority split, and weekly completion momentum.
- See upcoming deadlines ranked, with overdue items flagged.

### 🎯 Know exactly what to study next (Focus Advisor)
- Get a clear, ranked answer to *"what should I study first?"* in its own dedicated tab — StudyBase looks across **all** courses and computes where your next study hour adds the most to your **overall GPA**.
- The recommendation is genuinely smart: it blends how much is still ungraded, how you're currently doing, and each course's credit weight — so it often points you to a weaker course with a big exam left, not just the one with the most ungraded work.
- Explore it visually with a **floor → ceiling range chart** (your guaranteed minimum vs. best-case grade per course) and an **effort-vs-payoff bubble chart** (where the best return on study time is).
- Play with an **interactive what-if slider** that projects your overall standing live as you imagine scoring higher or lower on everything that's left. Real, transparent math — no black box.

### 📋 Manage tasks & plan the day
- Create, edit, complete, and delete tasks with priority, due date, notes, and estimated duration.
- **Auto-generate a daily plan** — enter free time slots and StudyBase schedules tasks by priority and deadline, splitting long ones and flagging anything that won't fit.

### 🗓️ Stay ahead with a smart calendar
- View a month where **every day is color-coded** by its most urgent task, with overdue days flagged and today highlighted.
- Tap any day to see and complete its tasks.
- See **public holidays overlaid automatically** for a selectable country.

### 🎓 Master grades with a powerful GPA tool
- Track each course with its real grade breakdown (Assignments, Midterm, Final, Attendance) across **4.0, 5.0, 10.0, or percentage** scales.
- See a live, intelligently-normalized **current standing** that never assumes zeros for ungraded work.
- **Reverse-solve the exact score needed** on a remaining component to hit a target — with clear "already secured" or "not reachable" flags.
- Get an interactive **what-if trade-off chart** when two components are still ungraded.
- View a **credit-weighted overall standing** across all courses.

### 📓 Reflect and track wellbeing
- Keep a **daily journal** with automatic mood scoring on each entry.
- Watch a **mood-over-time chart** reveal the shape of the semester — treating the student as a whole person, not just a task list.

### 📚 Build a resource library
- Save any link and have it **self-populate** its title and thumbnail.
- Add books by **title or ISBN** and auto-fetch the cover, title, and author.
- Tag resources to courses and filter — exam-week materials one click away.

### 🤖 Get help from an AI companion ("Base")
- Chat with an assistant that **actually sees your data** — tasks, grades, and mood — to prioritize your day, clarify study doubts, and offer encouragement.
- Always one tap away as a floating companion on every page.

### 🔐 Sign in and manage the account
- Log in with **email/password or Google (one tap)**.
- View a **My Account** page with profile details and a snapshot of everything tracked.
- **Explore a fully-loaded sample account instantly — no signup** — to experience the whole app in action.

### ✨ Enjoy the experience
- A calm, cohesive **pastel design** with an ambient animated background — responsive, accessible, and motion-reduced-friendly.
- Data kept **private and secure per user**.

---

## 🛠️ Under the hood — a note on technical elegance

StudyBase is designed to be as clean beneath the surface as it is on top:

- **Proper full-stack separation** — a React + Vite frontend, a Flask + SQLAlchemy REST API, and PostgreSQL, each doing one job well.
- **Authentication done right** — sign-in tokens are verified **server-side against Supabase's public keys**; the backend never trusts the browser for identity, and every row is protected by per-user security.
- **Nothing breaks when something's down** — every external integration is **fail-soft**: a slow or missing service degrades gracefully instead of crashing the app, which even runs in a zero-config demo mode.
- **Keys stay secret** — all third-party APIs are called from the backend, so no credential is ever exposed to the browser.
- **Lightweight by design** — the entire pastel design system and animated background are **pure CSS/SVG with zero heavy dependencies**, keeping the app fast and the bundle lean.
- **A genuinely clever demo** — the judges' sample account is an **isolated, in-memory mirror of the real API**, so it's instant, always pristine, and works even if the live backend is asleep.
- **Real computation, not fluff** — the GPA reverse-solver is a set of pure, testable functions that turn a grade target into an exact required score.

---

<p align="center"><em>One place for a student's whole semester — organized, insightful, genuinely supportive, and ready to use today. 🌱</em></p>