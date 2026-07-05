"""StudyBase — Flask API.

Run locally:
    pip install -r requirements.txt
    python app.py                      # SQLite, demo mode, no keys needed

Env vars (all optional locally, set on Render for production):
    DATABASE_URL          Supabase Postgres connection string
    SUPABASE_JWT_SECRET   turns real auth ON
    YOUTUBE_API_KEY       enables YouTube metadata
    HF_API_KEY            enables mood analysis
    FRONTEND_ORIGIN       your deployed Vercel URL, for CORS
"""
import os
from datetime import datetime, timezone, date as date_cls

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from models import Base, Task, Course, GradeComponent, Resource, Reflection
from solver import current_standing, solve, target_to_pct, pct_to_scale, generate_schedule
from services import (resource_metadata, analyze_sentiment, fetch_book_meta,
                      fetch_holidays, chat_completion)
from auth import require_user

# ------------------------------------------------------------------ setup --
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///studybase.db")
# Render/Supabase sometimes hand out postgres:// which SQLAlchemy 2 rejects.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = scoped_session(sessionmaker(bind=engine))
Base.metadata.create_all(engine)

app = Flask(__name__)
CORS(app, origins=[
    os.environ.get("FRONTEND_ORIGIN", "*"),
    "http://localhost:5173",
])

DEFAULT_BREAKDOWN = [
    {"name": "Assignments", "weight_pct": 20},
    {"name": "Midterm", "weight_pct": 30},
    {"name": "Final", "weight_pct": 40},
    {"name": "Attendance", "weight_pct": 10},
]


@app.teardown_appcontext
def cleanup(_exc):
    Session.remove()


@app.get("/api/health")
def health():
    return {"ok": True, "demo_mode": not os.environ.get("SUPABASE_JWT_SECRET")}


def _parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date() if s else None


# ------------------------------------------------------------------ tasks --
@app.get("/api/tasks")
@require_user
def list_tasks():
    q = Session.query(Task).filter_by(user_id=g.user_id)
    status = request.args.get("status")
    if status:
        q = q.filter_by(status=status)
    tasks = q.order_by(Task.status, Task.due_date.is_(None), Task.due_date).all()
    return jsonify([t.to_dict() for t in tasks])


@app.post("/api/tasks")
@require_user
def create_task():
    b = request.get_json(force=True)
    if not b.get("title", "").strip():
        return jsonify({"error": "Title is required"}), 400
    t = Task(
        user_id=g.user_id,
        title=b["title"].strip(),
        description=b.get("description"),
        due_date=_parse_date(b.get("due_date")),
        priority=b.get("priority", "medium"),
        duration_mins=b.get("duration_mins"),
    )
    Session.add(t)
    Session.commit()
    return jsonify(t.to_dict()), 201


@app.patch("/api/tasks/<task_id>")
@require_user
def update_task(task_id):
    t = Session.query(Task).filter_by(id=task_id, user_id=g.user_id).first()
    if not t:
        return jsonify({"error": "Task not found"}), 404
    b = request.get_json(force=True)
    for field in ("title", "description", "priority", "duration_mins"):
        if field in b:
            setattr(t, field, b[field])
    if "due_date" in b:
        t.due_date = _parse_date(b["due_date"])
    if "status" in b:
        t.status = b["status"]
        t.completed_at = datetime.now(timezone.utc) if b["status"] == "done" else None
    Session.commit()
    return jsonify(t.to_dict())


@app.delete("/api/tasks/<task_id>")
@require_user
def delete_task(task_id):
    t = Session.query(Task).filter_by(id=task_id, user_id=g.user_id).first()
    if not t:
        return jsonify({"error": "Task not found"}), 404
    Session.delete(t)
    Session.commit()
    return "", 204


# ---------------------------------------------------------------- courses --
@app.get("/api/courses")
@require_user
def list_courses():
    courses = Session.query(Course).filter_by(user_id=g.user_id).all()
    out = []
    for c in courses:
        d = c.to_dict()
        standing, graded_weight = current_standing(d["components"])
        d["standing_pct"] = standing
        d["graded_weight"] = graded_weight
        d["standing_on_scale"] = (
            pct_to_scale(standing, c.scale) if standing is not None else None
        )
        out.append(d)
    return jsonify(out)


@app.post("/api/courses")
@require_user
def create_course():
    b = request.get_json(force=True)
    if not b.get("name", "").strip():
        return jsonify({"error": "Course name is required"}), 400
    breakdown = b.get("components") or DEFAULT_BREAKDOWN
    if round(sum(x["weight_pct"] for x in breakdown), 2) != 100:
        return jsonify({"error": "Component weights must sum to 100"}), 400
    c = Course(
        user_id=g.user_id,
        name=b["name"].strip(),
        credit_hours=b.get("credit_hours", 1),
        scale=b.get("scale", "4.0"),
    )
    for comp in breakdown:
        c.components.append(GradeComponent(
            name=comp["name"], weight_pct=comp["weight_pct"],
            score_pct=comp.get("score_pct"),
        ))
    Session.add(c)
    Session.commit()
    return jsonify(c.to_dict()), 201


@app.patch("/api/courses/<course_id>/components")
@require_user
def update_components(course_id):
    c = Session.query(Course).filter_by(id=course_id, user_id=g.user_id).first()
    if not c:
        return jsonify({"error": "Course not found"}), 404
    b = request.get_json(force=True)
    comps = b.get("components", [])
    if round(sum(x["weight_pct"] for x in comps), 2) != 100:
        return jsonify({"error": "Component weights must sum to 100"}), 400
    c.components.clear()
    for comp in comps:
        c.components.append(GradeComponent(
            name=comp["name"], weight_pct=comp["weight_pct"],
            score_pct=comp.get("score_pct"),
        ))
    Session.commit()
    return jsonify(c.to_dict())


@app.delete("/api/courses/<course_id>")
@require_user
def delete_course(course_id):
    c = Session.query(Course).filter_by(id=course_id, user_id=g.user_id).first()
    if not c:
        return jsonify({"error": "Course not found"}), 404
    Session.delete(c)
    Session.commit()
    return "", 204


@app.post("/api/courses/<course_id>/solve")
@require_user
def solve_course(course_id):
    c = Session.query(Course).filter_by(id=course_id, user_id=g.user_id).first()
    if not c:
        return jsonify({"error": "Course not found"}), 404
    b = request.get_json(force=True)
    target = float(b.get("target", 0))
    scale = b.get("target_scale", c.scale)
    target_pct = target_to_pct(target, scale)
    result = solve([x.to_dict() for x in c.components], target_pct)
    result["target_pct"] = round(target_pct, 2)
    return jsonify(result)


# -------------------------------------------------------------- resources --
@app.get("/api/resources")
@require_user
def list_resources():
    q = Session.query(Resource).filter_by(user_id=g.user_id)
    if request.args.get("course_id"):
        q = q.filter_by(course_id=request.args["course_id"])
    return jsonify([r.to_dict() for r in q.order_by(Resource.created_at.desc())])


@app.post("/api/resources")
@require_user
def create_resource():
    b = request.get_json(force=True)

    # Book flow: look up by title/ISBN via Open Library
    book_query = (b.get("book_query") or "").strip()
    if book_query:
        meta = fetch_book_meta(book_query)
        if not meta or not meta.get("title"):
            return jsonify({"error": "Couldn't find that book. Try the full title or an ISBN."}), 404
        tags = list(b.get("tags", []))
        if meta.get("author"):
            tags = [f"by {meta['author']}"] + tags
        r = Resource(
            user_id=g.user_id,
            url=meta.get("url") or "https://openlibrary.org",
            title=meta["title"],
            thumbnail=meta.get("thumbnail"),
            source_type="book",
            tags=",".join(tags),
            course_id=b.get("course_id"),
        )
        Session.add(r)
        Session.commit()
        return jsonify(r.to_dict()), 201

    url = (b.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "Enter a full URL (starting with https://)"}), 400
    meta = resource_metadata(url)
    r = Resource(
        user_id=g.user_id,
        url=url,
        title=b.get("title") or meta["title"] or url,
        thumbnail=meta["thumbnail"],
        source_type=b.get("source_type") or meta["source_type"],
        tags=",".join(b.get("tags", [])),
        course_id=b.get("course_id"),
    )
    Session.add(r)
    Session.commit()
    return jsonify(r.to_dict()), 201


@app.delete("/api/resources/<res_id>")
@require_user
def delete_resource(res_id):
    r = Session.query(Resource).filter_by(id=res_id, user_id=g.user_id).first()
    if not r:
        return jsonify({"error": "Resource not found"}), 404
    Session.delete(r)
    Session.commit()
    return "", 204


# ------------------------------------------------------------ reflections --
@app.get("/api/reflections")
@require_user
def list_reflections():
    q = Session.query(Reflection).filter_by(user_id=g.user_id)
    if request.args.get("from"):
        q = q.filter(Reflection.date >= _parse_date(request.args["from"]))
    if request.args.get("to"):
        q = q.filter(Reflection.date <= _parse_date(request.args["to"]))
    return jsonify([r.to_dict() for r in q.order_by(Reflection.date)])


@app.post("/api/reflections")
@require_user
def create_reflection():
    b = request.get_json(force=True)
    text = (b.get("entry_text") or "").strip()
    if not text:
        return jsonify({"error": "Write something first"}), 400
    d = _parse_date(b.get("date")) or date_cls.today()
    existing = Session.query(Reflection).filter_by(user_id=g.user_id, date=d).first()
    if existing:
        return jsonify({"error": "You already wrote a reflection for this day"}), 409
    label, score = analyze_sentiment(text)
    r = Reflection(user_id=g.user_id, date=d, entry_text=text,
                   mood_label=label, mood_score=score)
    Session.add(r)
    Session.commit()
    return jsonify(r.to_dict()), 201


@app.post("/api/reflections/<ref_id>/remood")
@require_user
def remood(ref_id):
    """Retry mood analysis if the API was down when the entry was saved."""
    r = Session.query(Reflection).filter_by(id=ref_id, user_id=g.user_id).first()
    if not r:
        return jsonify({"error": "Reflection not found"}), 404
    label, score = analyze_sentiment(r.entry_text)
    r.mood_label, r.mood_score = label, score
    Session.commit()
    return jsonify(r.to_dict())


# --------------------------------------------------------------- schedule --
@app.post("/api/schedule/generate")
@require_user
def schedule():
    b = request.get_json(force=True)
    task_ids = b.get("task_ids", [])
    slots = b.get("slots", [])
    tasks = (
        Session.query(Task)
        .filter(Task.user_id == g.user_id, Task.id.in_(task_ids))
        .all()
    )
    payload = [t.to_dict() for t in tasks]
    missing = [t["title"] for t in payload if not t["duration_mins"]]
    if missing:
        return jsonify({
            "error": "These tasks need an estimated duration first: "
                     + ", ".join(missing)
        }), 400
    return jsonify(generate_schedule(payload, slots))


# --------------------------------------------------------------- holidays --
_holiday_cache = {}


@app.get("/api/holidays")
@require_user
def holidays():
    year = request.args.get("year") or str(date_cls.today().year)
    country = (request.args.get("country") or "IN").upper()
    key = f"{year}:{country}"
    if key not in _holiday_cache:
        _holiday_cache[key] = fetch_holidays(year, country)
    return jsonify(_holiday_cache[key])


# ------------------------------------------------------------------- chat --
CHAT_SYSTEM = (
    "You are \"Base\", the friendly study companion built into StudyBase, a "
    "student productivity app. You can see a snapshot of the student's current "
    "data below. Use it to be specific and genuinely helpful: motivate them, "
    "help prioritize what's due, clarify study doubts, and answer questions. "
    "Be warm and encouraging, and usually concise (2-5 sentences). Reference "
    "their real tasks, grades, and mood when it's relevant. If they seem "
    "stressed or low, be kind and supportive — but you are not a therapist, so "
    "for serious distress gently suggest talking to someone they trust or a "
    "professional. Never diagnose. Don't invent data you weren't given."
)


def _user_context(user_id):
    tasks = Session.query(Task).filter_by(user_id=user_id).all()
    pending = [t for t in tasks if t.status == "pending"]
    today = date_cls.today().isoformat()
    overdue = [t for t in pending if t.due_date and t.due_date.isoformat() < today]
    due_today = [t for t in pending if t.due_date and t.due_date.isoformat() == today]

    lines = [f"Pending tasks: {len(pending)} "
             f"({len(overdue)} overdue, {len(due_today)} due today). "
             f"Completed all-time: {len(tasks) - len(pending)}."]

    upcoming = sorted([t for t in pending if t.due_date], key=lambda t: t.due_date)[:6]
    if upcoming:
        lines.append("Upcoming deadlines: " + "; ".join(
            f"{t.title} (due {t.due_date.isoformat()}, {t.priority} priority)"
            for t in upcoming))

    courses = Session.query(Course).filter_by(user_id=user_id).all()
    if courses:
        parts = []
        for c in courses:
            standing, _ = current_standing([x.to_dict() for x in c.components])
            parts.append(f"{c.name}: "
                         + (f"{standing}%" if standing is not None else "no grades yet")
                         + f" ({c.scale} scale)")
        lines.append("Courses — " + " | ".join(parts))

    refl = (Session.query(Reflection).filter_by(user_id=user_id)
            .order_by(Reflection.date.desc()).limit(7).all())
    scored = [r for r in refl if r.mood_score is not None]
    if scored:
        avg = round(sum(float(r.mood_score) for r in scored) / len(scored), 2)
        lines.append(f"Recent average mood (-1 low to +1 high): {avg} "
                     f"over the last {len(scored)} journal entries.")

    return "\n".join(lines)


@app.post("/api/chat")
@require_user
def chat():
    b = request.get_json(force=True)
    msgs = b.get("messages", [])
    if not msgs:
        return jsonify({"error": "No message"}), 400

    system = {"role": "system",
              "content": CHAT_SYSTEM + "\n\nSTUDENT SNAPSHOT:\n" + _user_context(g.user_id)}
    reply = chat_completion([system] + msgs[-12:])

    if reply is None:
        return jsonify({
            "configured": False,
            "reply": "I'm not fully switched on yet — StudyBase needs an "
                     "OpenRouter API key set up before I can come online. Once "
                     "that's added I'll be able to see your tasks, grades, and "
                     "mood and actually help you out!",
        })
    return jsonify({"configured": True, "reply": reply})


if __name__ == "__main__":
    app.run(debug=True, port=5000)