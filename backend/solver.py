"""StudyBase — GPA math + greedy scheduler. Pure functions, easy to unit test."""
from datetime import date, datetime

SCALE_MAX = {"4.0": 4.0, "5.0": 5.0, "10.0": 10.0, "percentage": 100.0}


def target_to_pct(target: float, scale: str) -> float:
    """Convert a target on the course's scale to an overall course percentage."""
    mx = SCALE_MAX.get(scale, 4.0)
    return (target / mx) * 100.0


def pct_to_scale(pct: float, scale: str) -> float:
    mx = SCALE_MAX.get(scale, 4.0)
    return round((pct / 100.0) * mx, 2)


def current_standing(components):
    """Weighted average over graded components only, normalized by graded weight.

    components: [{weight_pct, score_pct|None}, ...]
    Returns (standing_pct | None, graded_weight_pct)
    """
    graded = [c for c in components if c.get("score_pct") is not None]
    graded_weight = sum(c["weight_pct"] for c in graded)
    if graded_weight == 0:
        return None, 0.0
    earned = sum(c["weight_pct"] * c["score_pct"] / 100.0 for c in graded)
    return round(earned / graded_weight * 100.0, 2), round(graded_weight, 2)


def solve(components, target_pct):
    """Reverse-solve for unknown components given a target course percentage.

    Returns one of:
      {"mode": "single", "required_score": float, "achievable": bool,
       "already_guaranteed": bool, "unknown_name": str}
      {"mode": "whatif", "unknown_a": str, "unknown_b": str,
       "table": [{"a": int, "b": float|None, "achievable": bool}, ...]}
      {"mode": "none", ...}   (nothing unknown — just report standing)
    """
    known = [c for c in components if c.get("score_pct") is not None]
    unknown = [c for c in components if c.get("score_pct") is None]
    banked = sum(c["weight_pct"] * c["score_pct"] / 100.0 for c in known)

    if not unknown:
        standing, _ = current_standing(components)
        return {"mode": "none", "final_pct": standing,
                "met": standing is not None and standing >= target_pct}

    if len(unknown) == 1:
        u = unknown[0]
        w = u["weight_pct"] / 100.0
        required = (target_pct - banked) / w if w > 0 else float("inf")
        return {
            "mode": "single",
            "unknown_name": u["name"],
            "required_score": round(required, 1),
            "achievable": required <= 100.0,
            "already_guaranteed": required <= 0.0,
        }

    # 2+ unknowns: sweep the first, solve the second, treat any extras
    # (rare) as scoring 0 — a conservative floor we surface in the payload.
    a, b = unknown[0], unknown[1]
    wa, wb = a["weight_pct"] / 100.0, b["weight_pct"] / 100.0
    table = []
    for a_score in range(0, 101, 5):
        rem = target_pct - banked - wa * a_score
        b_needed = rem / wb if wb > 0 else float("inf")
        table.append({
            "a": a_score,
            "b": round(min(max(b_needed, 0.0), 999.0), 1),
            "achievable": b_needed <= 100.0,
        })
    return {
        "mode": "whatif",
        "unknown_a": a["name"],
        "unknown_b": b["name"],
        "ignored_unknowns": [c["name"] for c in unknown[2:]],
        "table": table,
    }


# ---------------------------------------------------------------- scheduler --

def _mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _hhmm(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def generate_schedule(tasks, slots):
    """Greedy slotting per spec.

    tasks: [{id, title, priority, due_date|None, duration_mins}]
    slots: [{"start": "14:00", "end": "16:00"}, ...]
    """
    prio_rank = {"high": 0, "medium": 1, "low": 2}

    def sort_key(t):
        due = t.get("due_date") or "9999-12-31"
        return (prio_rank.get(t.get("priority", "medium"), 1), due)

    ordered = sorted([t for t in tasks if t.get("duration_mins")], key=sort_key)
    free = sorted(
        [{"start": _mins(s["start"]), "end": _mins(s["end"])} for s in slots],
        key=lambda s: s["start"],
    )
    largest_slot = max((s["end"] - s["start"] for s in free), default=0)

    scheduled, unscheduled = [], []
    for task in ordered:
        need = task["duration_mins"]
        splittable = need > largest_slot  # only split what can't fit anywhere whole
        placed_any = False
        for slot in free:
            room = slot["end"] - slot["start"]
            if room <= 0:
                continue
            if need <= room:
                scheduled.append({
                    "task_id": task["id"], "title": task["title"],
                    "slot_start": _hhmm(slot["start"]),
                    "slot_end": _hhmm(slot["start"] + need),
                    "split": splittable and placed_any,
                })
                slot["start"] += need
                need = 0
                placed_any = True
                break
            if splittable:
                scheduled.append({
                    "task_id": task["id"], "title": task["title"],
                    "slot_start": _hhmm(slot["start"]),
                    "slot_end": _hhmm(slot["end"]),
                    "split": True,
                })
                need -= room
                slot["start"] = slot["end"]
                placed_any = True
        if need > 0:
            unscheduled.append(task["id"])

    return {"scheduled": scheduled, "unscheduled": unscheduled}
