"""StudyBase — SQLAlchemy models.

user_id columns store the Supabase auth user id (a uuid string).
We deliberately do NOT keep our own users table: Supabase owns auth.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Date, Time, DateTime, Numeric, Integer, ForeignKey
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _uuid() -> str:
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    due_date = Column(Date)
    priority = Column(String, default="medium")          # low | medium | high
    duration_mins = Column(Integer)
    status = Column(String, default="pending")           # pending | done
    created_at = Column(DateTime(timezone=True), default=_now)
    completed_at = Column(DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "priority": self.priority,
            "duration_mins": self.duration_mins,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    name = Column(Text, nullable=False)
    credit_hours = Column(Numeric, default=1)
    scale = Column(String, default="4.0")                 # 4.0 | 5.0 | 10.0 | percentage

    components = relationship(
        "GradeComponent", cascade="all, delete-orphan", backref="course"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "credit_hours": float(self.credit_hours or 1),
            "scale": self.scale,
            "components": [c.to_dict() for c in self.components],
        }


class GradeComponent(Base):
    __tablename__ = "grade_components"

    id = Column(String, primary_key=True, default=_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    weight_pct = Column(Numeric, nullable=False)
    score_pct = Column(Numeric)                            # NULL = not graded yet

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "weight_pct": float(self.weight_pct),
            "score_pct": float(self.score_pct) if self.score_pct is not None else None,
        }


class Resource(Base):
    __tablename__ = "resources"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    url = Column(Text, nullable=False)
    title = Column(Text)
    thumbnail = Column(Text)
    source_type = Column(String, default="other")          # youtube | article | book | other
    tags = Column(Text)                                    # comma-separated for portability
    course_id = Column(String, ForeignKey("courses.id"))
    created_at = Column(DateTime(timezone=True), default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "thumbnail": self.thumbnail,
            "source_type": self.source_type,
            "tags": [t for t in (self.tags or "").split(",") if t],
            "course_id": self.course_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Reflection(Base):
    __tablename__ = "reflections"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False)
    entry_text = Column(Text, nullable=False)
    mood_label = Column(String)                            # positive | neutral | negative
    mood_score = Column(Numeric)                           # -1 .. 1
    created_at = Column(DateTime(timezone=True), default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "entry_text": self.entry_text,
            "mood_label": self.mood_label,
            "mood_score": float(self.mood_score) if self.mood_score is not None else None,
        }


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
