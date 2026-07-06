# StudyBase 🌱

**Your semester, sorted.**

StudyBase is a full-stack productivity web app for students that brings tasks, grades, reflection, resources, and planning into one calm, pastel-themed workspace — with a data-aware AI study companion built in.

🔗 **Live demo:** https://study-base-nine.vercel.app

> **👩‍⚖️ Reviewing this? Two ways in:**
> **(1)** Create your own account (email/password or one-tap Google), **or**
> **(2)** click **"✨ Explore the sample account"** right on the login page — no signup — to jump straight into a fully-loaded, fully-interactive StudyBase pre-filled with courses, grades, tasks, a semester of journal entries, and saved resources.

---

## Table of Contents

- [What it is](#what-it-is)
- [Feature highlights](#feature-highlights)
- [Data visualizations](#data-visualizations)
- [Free public APIs](#free-public-apis)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started (local)](#getting-started-local)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Authentication](#authentication)
- [Future scope](#future-scope)
- [Acknowledgements](#acknowledgements)

---

## What it is

Most student tools do one thing. StudyBase pulls the whole semester together: what's due, how your grades are actually tracking, how you're feeling week to week, the resources you're collecting, and a plan for the day — then layers an AI companion on top that can *see* all of it and help you prioritize.

It was built to satisfy three goals at once:

- **Free public APIs** — real third-party integrations, no paid tiers.
- **Data visualization** — charts that turn raw data into insight (mood over time, grade what-ifs, momentum).
- **Constraint-solving, decision-support features** — a GPA reverse-solver that tells you exactly what you need on the final, and a Focus Advisor that tells you which course to study next for the biggest GPA payoff.

Everything is single-user-per-account and fully private (row-level security in Postgres).

---

## Feature highlights

### 📊 Dashboard
The landing screen — a real at-a-glance overview: KPI cards (overall standing, pending, due this week, journal streak, recent mood), plus the mood-over-time chart, standing-by-course bars, a priority donut, weekly completion momentum, and your next deadlines.

### 🎯 Focus Advisor (decision-support)
The smartest thing StudyBase does: it answers *"what should I study next?"* Rather than just showing grades, it looks across **all** your courses and ranks them by how many points your **overall credit-weighted GPA** could still gain — blending how much is still ungraded, how you're currently doing, and each course's credit weight. So it recommends the course where your next study hour actually pays off most (often a weaker course with a big exam left, not the one with the most ungraded work). It even softens its nudge if your recent mood has been low. Pure, deterministic math — no black box.

### 📋 Tasks
Create, edit, complete, and delete tasks with priority, due date, and an estimated duration. Completed tasks cross out and collapse. The duration feeds the planner.

### 🗓️ Calendar
A month view where **every day is tinted by its most urgent pending task** (high / medium / low), overdue days get a red edge, and today is highlighted. Tap a day to see and complete its tasks. **Public holidays** for your country are overlaid automatically, with a country selector.

### 🎓 GPA Calculator
The differentiator. Each course has a fully editable grade breakdown (Assignments / Midterm / Final / Attendance by default) across multiple scales (4.0, 5.0, 10.0, or percentage). Two modes:
- **Current standing** — weighted average of graded components, normalized so a mid-semester check doesn't assume zeros.
- **Reverse-solve** — "what do I need on the final to hit my target?" With one unknown it gives an exact number (and flags impossible or already-secured cases); with two unknowns it renders a **what-if trade-off chart**.

### 📓 Journal + mood
One reflection entry per day (append-only). Each entry is scored for sentiment and plotted on a **mood-over-time chart** so you can see the shape of your semester. *(Sentiment scoring is wired and fail-soft — see [Future scope](#future-scope).)*

### 📚 Library
Save any link and it self-populates. **Books** look up their cover, title, and author automatically via Open Library (paste a title or ISBN). Resources can be tagged to a course so exam week is one filter away.

### 🧭 Planner
Tell it your free time slots for the day and it greedily schedules your tasks by priority and soonest deadline, splitting anything too big for a single slot and flagging what won't fit.

### 🤖 AI study companion ("Base")
A floating chat assistant that can **see a snapshot of your real data** — tasks, grades, mood — and use it to motivate you, help you prioritize, and clarify study doubts. Supportive by design (never clinical), and fail-soft so it never breaks the app.

### 👤 Accounts & sample mode
Email/password **and** Google sign-in via Supabase Auth. A **My Account** page shows your profile and a snapshot of everything you've tracked. And a one-click **sample account** lets anyone explore a fully-populated, fully-interactive StudyBase with no signup — ideal for demos and reviewers (see [below](#sample-account)).

### 🎨 Craft
A cohesive pastel "stationery" design system — sticky-note tabs, washi-tape headers, dotted-notebook texture — with a gentle animated background (drifting gradient blobs + floating doodles), all dependency-free and motion-reduced-friendly.

---

<a name="sample-account"></a>
## 🎬 Sample account (instant demo)

Clicking **"Explore the sample account"** on the login page enters an **isolated, in-memory demo** — not a shared login. It's seeded with a realistic semester (4 courses across different grading scales, ~15 tasks, ~14 journal entries forming a mood curve, and a mix of video/article/book resources), and every page works for real: you can add tasks, complete them, run the GPA solver, generate a schedule, and chat with Base.

Why in-memory instead of a shared account:

- **Always pristine** — every visitor gets the same perfect starting state; nobody can corrupt it for the next person.
- **Instant** — loads immediately even if the (free-tier) backend is asleep, so a demo never stalls on a cold start.
- **Zero key dependencies** — works whether or not the AI/auth services are configured.

Under the hood it's an in-memory mirror of the real REST API (`frontend/src/lib/sample.js`), including JS ports of the GPA solver and greedy scheduler, so the entire app runs unchanged against sample data.

---

## Data visualizations

Built with **Recharts**:

| Visualization | Where | What it shows |
|---|---|---|
| Mood over time | Dashboard + Journal | Sentiment score across the semester (area chart) |
| GPA what-if | GPA calculator | Trade-off curve when two components are ungraded |
| Standing by course | Dashboard | Every course normalized to % for fair comparison (bar) |
| Pending by priority | Dashboard | High / medium / low split (donut) |
| Weekly momentum | Dashboard | Tasks completed per day, last 7 days (bar) |

---

## Free public APIs

All keyless or free-tier, integrated **server-side** and **fail-soft** (a missing key or a down service never breaks the app):

| API | Used for | Auth |
|---|---|---|
| [Open Library](https://openlibrary.org/developers/api) | Book covers, titles, authors in the Library | None |
| [Nager.Date](https://date.nager.at/) | Public holidays overlaid on the Calendar | None |
| [OpenRouter](https://openrouter.ai/) | The AI study companion (free model router) | Free key |

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite, Recharts, custom CSS design system |
| Backend | Flask (Python), SQLAlchemy |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth — email/password + Google OAuth (ES256 JWT, verified server-side via JWKS) |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| External APIs | Open Library, Nager.Date, OpenRouter |

---

## Architecture

```
Browser (React on Vercel)
   │  supabase-js  →  Supabase Auth  (email + Google OAuth)
   │  fetch /api/* (Bearer token)   ── or ──  in-memory sample API (demo mode)
   ▼
Flask API (Render)
   │  verifies Supabase JWT (ES256 via JWKS, HS256 fallback)
   │  SQLAlchemy
   ▼
PostgreSQL (Supabase, row-level security)

Flask also calls (server-side, keys never exposed):
   • Open Library   → book metadata
   • Nager.Date     → public holidays
   • OpenRouter     → AI companion replies (with a summary of the user's data as context)
```

Every request is scoped to the authenticated user's `user_id`; the backend never trusts the client for identity.

---

## Project structure

```
studybase/
├── backend/
│   ├── app.py              Flask routes (tasks, courses, solve, resources,
│   │                       reflections, schedule, holidays, chat)
│   ├── models.py           SQLAlchemy tables
│   ├── solver.py           GPA math + greedy scheduler (pure functions)
│   ├── services.py         External APIs (Open Library, Nager.Date, OpenRouter,
│   │                       + fail-soft YouTube & Hugging Face helpers)
│   ├── auth.py             Supabase JWT verification (ES256/HS256) + demo mode
│   ├── requirements.txt
│   └── .python-version     pins Python 3.12 for deployment
└── frontend/
    ├── src/
    │   ├── App.jsx         Auth gate, sample mode, tab shell, account view
    │   ├── Background.jsx  Animated ambient background
    │   ├── main.jsx
    │   ├── styles.css      Pastel design system
    │   ├── lib/
    │   │   ├── supabase.js Supabase client
    │   │   ├── api.js      API fetch wrapper (routes to sample mock in demo mode)
    │   │   └── sample.js   In-memory sample account (seed data + mock API)
    │   └── pages/          Dashboard, FocusAdvisor, Calendar, Tasks, Gpa,
    │                       Reflections, Resources, Schedule, Account, Chatbot
    ├── index.html
    └── package.json
```

---

## Getting started (local)

### Demo mode (zero keys)

The app runs with **no configuration** at all: it falls back to SQLite, skips login, and gracefully disables the AI/metadata features. Great for a first run. (You can also click **"Explore the sample account"** any time to browse a fully-populated, isolated demo.)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
python app.py                      # http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Open http://localhost:5173.

### Full mode (with auth, DB, and AI)

1. Create a [Supabase](https://supabase.com) project.
2. Create `frontend/.env` (see below) and set backend environment variables in your terminal.
3. Restart both servers. A login screen replaces demo mode.

---

## Environment variables

### Backend (set on Render, or in your terminal locally)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (prod) | Supabase Postgres connection string |
| `SUPABASE_URL` | Yes (prod) | Enables ES256 token verification |
| `SUPABASE_JWT_SECRET` | Optional | HS256 fallback for older Supabase projects |
| `OPENROUTER_API_KEY` | For AI chat | Powers the study companion |
| `OPENROUTER_MODEL` | Optional | Defaults to `openrouter/free` |
| `FRONTEND_ORIGIN` | Yes (prod) | CORS allow-list (your Vercel URL) |

> With none of the above set, the backend runs in demo mode on SQLite.

### Frontend (set on Vercel, or in `frontend/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Your deployed backend URL (blank locally — Vite proxies to Flask) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public by design) |

> **Never** put backend secrets (OpenRouter, JWT secret, DB URL) in `VITE_` variables — those ship to the browser. Backend keys stay on the backend.

---

## Deployment

| Piece | Service | Notes |
|---|---|---|
| Database + Auth | Supabase (free) | 500 MB Postgres, built-in auth, RLS |
| Backend | Render (free web service) | `Root: backend`, start `gunicorn app:app`; sleeps when idle (first request ~30–50s) |
| Frontend | Vercel (free) | `Root: frontend`, Vite preset, auto-deploys on push |

**Order of operations**

1. Deploy the backend on Render with its env vars → copy the Render URL.
2. Deploy the frontend on Vercel with `VITE_API_URL` = the Render URL.
3. Set `FRONTEND_ORIGIN` on Render to your exact Vercel URL (closes the CORS loop).

> Render's free tier sleeps after ~15 min idle. Warm the site a couple of minutes before a demo — or just use the **sample account**, which needs no backend and loads instantly.

---

## Authentication

- **Email/password** and **Google SSO**, both via Supabase Auth.
- After sign-in the frontend holds a Supabase access token (ES256-signed on newer projects) and sends it as a Bearer token.
- The Flask backend verifies that token against Supabase's public keys (JWKS), with an HS256 fallback for older projects — so **it works regardless of how the user signed in**, and the same account links across email and Google.
- All tables carry a `user_id` and are protected by row-level security.
- A **sample account** path bypasses auth entirely for a read/write in-memory demo — no credentials, no persistence.

---

## Future scope

Two more free public APIs are already **coded and fail-soft** in `services.py` — they light up the moment their keys are added, no code changes needed:

- **Hugging Face Inference API** — sentiment analysis to auto-score journal moods (the mood chart already renders whatever scores exist; this populates them automatically). Add `HF_API_KEY`.
- **YouTube Data API v3** — pull real titles, thumbnails, and channel names for saved video links (a public-thumbnail fallback already works without the key). Add `YOUTUBE_API_KEY`.

Further ideas on the roadmap:

- AI-generated flashcards / quizzes from saved resources.
- Natural-language task capture ("finish DBMS lab by Friday, ~2h, high priority").
- Weekly AI reflection summaries paired with the mood chart.
- Semantic search across saved resources (embeddings).
- Shared/classroom features and a native mobile app.

---

## Acknowledgements

- [Supabase](https://supabase.com) — auth + Postgres
- [Open Library](https://openlibrary.org), [Nager.Date](https://date.nager.at), [OpenRouter](https://openrouter.ai) — free public APIs
- [Recharts](https://recharts.org) — charts
- Fonts: Syne, DM Sans, DM Mono

---

<p align="center"><em>Built with care for students who have a lot on their plate. 🌱</em></p>