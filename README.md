# StudyBase — your semester, sorted

A pastel-themed student productivity app: tasks, GPA reverse-solver, daily journal with mood tracking, resource library, and a day planner.

**React + Vite · Flask · SQLAlchemy · Supabase (Postgres + Auth) · Recharts · YouTube Data API · Hugging Face Inference API**

---

## Part 0 — Run it locally in 2 minutes (zero API keys needed)

The app has a built-in **demo mode**: if no keys are configured, it uses SQLite, skips login, and gracefully disables mood analysis + YouTube metadata. Everything else works. Do this FIRST so you know the code runs before touching any keys.

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
python app.py                      # runs on http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                        # runs on http://localhost:5173
```

Open http://localhost:5173. You should see the pastel dashboard with a "demo mode" banner.

---

## Part 1 — API keys, explained like you've never done this before

An API key is just a **password that identifies your app** to someone else's service. Three rules:

1. **Keys never go in your code or on GitHub.** They go in environment variables (a settings screen on Render/Vercel, or a local `.env` file that's gitignored).
2. **Frontend vs backend keys are different animals.** Anything starting with `VITE_` is bundled into the browser code and is *public by design* (Supabase anon key is safe to expose — that's what Row Level Security is for). The YouTube key, HF key, and JWT secret live **only on the backend** where nobody can see them.
3. If you ever paste a key somewhere public by accident, don't panic — every service below has a "regenerate key" button. Old key dies, new key works.

You need **4 things** from **3 free services**. ~20 minutes total.

### 1a. Supabase (database + login) — 3 values

1. Go to https://supabase.com → sign up with GitHub → **New project**. Pick a name, a strong DB password (save it somewhere), region = Mumbai (closest to you).
2. Wait ~2 min for it to provision. Then collect:
   - **Project Settings → API** → copy `Project URL` → this is `VITE_SUPABASE_URL`
   - Same page → `anon public` key → this is `VITE_SUPABASE_ANON_KEY`
   - Same page → scroll to **JWT Settings** → `JWT Secret` → this is `SUPABASE_JWT_SECRET` (backend only!)
   - **Project Settings → Database → Connection string → URI** → this is `DATABASE_URL`. Replace `[YOUR-PASSWORD]` in it with the DB password you chose. Use the **"Transaction" pooler** string (port 6543) — Render's free tier plays nicer with it.
3. **Authentication → Providers → Email**: make sure Email is enabled. (Optional while testing: turn OFF "Confirm email" so signups work instantly.)

### 1b. YouTube Data API — 1 key

1. Go to https://console.cloud.google.com → sign in with Google → top bar → **New Project** → name it `studybase`.
2. Menu → **APIs & Services → Library** → search "YouTube Data API v3" → **Enable**.
3. **APIs & Services → Credentials → + Create Credentials → API key**. Copy it → this is `YOUTUBE_API_KEY`.
4. (Good habit) Click the key → **API restrictions → Restrict key → YouTube Data API v3** → Save. Now even if it leaks, it can only look up videos.

Free quota: 10,000 units/day; each lookup costs 1 unit. You will not hit this.

### 1c. Hugging Face (mood analysis) — 1 token

1. Go to https://huggingface.co → sign up → click your avatar → **Settings → Access Tokens → + Create new token**.
2. Token type: **Read** is enough. Name it `studybase`. Copy it → this is `HF_API_KEY`.

That's every key you need. Total: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `YOUTUBE_API_KEY`, `HF_API_KEY` (backend) + `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (frontend).

---

## Part 2 — Deploy the backend on Render

1. Push this project to a GitHub repo (one repo, `backend/` and `frontend/` folders inside is fine).
2. https://render.com → sign up with GitHub → **New → Web Service** → pick your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Instance type:** Free
4. Scroll to **Environment Variables** → add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase URI (with real password) |
   | `SUPABASE_JWT_SECRET` | from Supabase JWT settings |
   | `YOUTUBE_API_KEY` | from Google Cloud |
   | `HF_API_KEY` | from Hugging Face |
   | `FRONTEND_ORIGIN` | leave blank for now — you'll fill it after Vercel |
5. Deploy. When it's live, copy your backend URL, e.g. `https://studybase-api.onrender.com`. Test it: open `https://studybase-api.onrender.com/api/health` — you should see `{"ok": true, "demo_mode": false}`. If `demo_mode` is `true`, your JWT secret didn't save.

> ⚠️ Free Render services sleep after 15 min idle; the first request after that takes ~30–50s. **For the judging demo, open the site 2 minutes early** so it's warm.

## Part 3 — Deploy the frontend on Vercel

1. https://vercel.com → sign up with GitHub → **Add New → Project** → same repo.
2. **Root Directory:** `frontend`. Framework preset: Vite (auto-detected).
3. **Environment Variables:**
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render URL, e.g. `https://studybase-api.onrender.com` (no trailing slash) |
   | `VITE_SUPABASE_URL` | from Supabase |
   | `VITE_SUPABASE_ANON_KEY` | from Supabase |
4. Deploy → copy your Vercel URL, e.g. `https://studybase.vercel.app`.
5. **Close the loop:** go back to Render → Environment → set `FRONTEND_ORIGIN=https://studybase.vercel.app` → save (it redeploys). This is CORS — the backend now only accepts browser requests from your real site.

Done. Create an account on your live site and everything persists in Supabase.

## Part 4 — (Recommended) Row Level Security in Supabase

The Flask API already scopes every query by user, but since the spec calls for RLS, run this in Supabase **SQL Editor** after tables exist (they're created on the backend's first boot):

```sql
alter table tasks enable row level security;
alter table courses enable row level security;
alter table grade_components enable row level security;
alter table resources enable row level security;
alter table reflections enable row level security;
alter table time_slots enable row level security;
```

Because only your Flask backend talks to the DB (via the connection string, which bypasses RLS as the `postgres` role), this is defense-in-depth — it blocks anyone who somehow gets your anon key from reading tables directly.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Frontend loads, every action fails with CORS error | `FRONTEND_ORIGIN` on Render doesn't exactly match your Vercel URL (https, no trailing slash) |
| "Invalid token" on every request | `SUPABASE_JWT_SECRET` is wrong — recopy from Supabase → Settings → API → JWT Settings |
| Mood shows "pending" forever | `HF_API_KEY` missing/wrong, or the free HF model is cold — hit "recompute mood" |
| YouTube links save but titles are generic | `YOUTUBE_API_KEY` missing or API not enabled — thumbnails still work via fallback |
| First request takes 40s | Render free tier waking up. Normal. Warm it before demos |
| `psycopg2` build error locally | You don't need Postgres locally — just unset `DATABASE_URL` and it uses SQLite |

## Project structure

```
backend/
  app.py        Flask routes (tasks, courses, solve, resources, reflections, schedule)
  models.py     SQLAlchemy tables
  solver.py     GPA math + greedy scheduler (pure functions)
  services.py   YouTube / title-scrape / HF sentiment (all fail soft)
  auth.py       Supabase JWT verification + demo mode
frontend/
  src/styles.css     pastel design system (sticky-note tabs, washi tape)
  src/App.jsx        auth gate + tab shell
  src/pages/         Tasks, Gpa, Reflections, Resources, Schedule
  src/lib/           api fetch wrapper, supabase client
```
