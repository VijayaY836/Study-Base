"""StudyBase — external API helpers (YouTube Data API v3, Hugging Face Inference).

Every function here fails SOFT: if a key is missing or a request dies,
we return None-ish data and the app keeps working. This is deliberate —
you can run the whole app with zero API keys and add them later.
"""
import os
import re
import html
from urllib.parse import urlparse, parse_qs

import requests

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
HF_API_KEY = os.environ.get("HF_API_KEY", "")

HF_MODEL_URL = (
    "https://api-inference.huggingface.co/models/"
    "distilbert-base-uncased-finetuned-sst-2-english"
)

YT_HOSTS = {"www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"}


def extract_youtube_id(url: str):
    try:
        p = urlparse(url)
        if p.netloc not in YT_HOSTS:
            return None
        if p.netloc == "youtu.be":
            return p.path.lstrip("/").split("/")[0] or None
        if p.path == "/watch":
            return parse_qs(p.query).get("v", [None])[0]
        if p.path.startswith(("/shorts/", "/embed/")):
            return p.path.split("/")[2]
    except Exception:
        pass
    return None


def fetch_youtube_meta(video_id: str):
    """Returns {title, thumbnail, channel} or None."""
    if not YOUTUBE_API_KEY:
        return None
    try:
        r = requests.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "snippet", "id": video_id, "key": YOUTUBE_API_KEY},
            timeout=8,
        )
        items = r.json().get("items", [])
        if not items:
            return None
        sn = items[0]["snippet"]
        thumbs = sn.get("thumbnails", {})
        thumb = (thumbs.get("medium") or thumbs.get("default") or {}).get("url")
        return {"title": sn.get("title"), "thumbnail": thumb,
                "channel": sn.get("channelTitle")}
    except Exception:
        return None


def scrape_title(url: str):
    """Best-effort <title> scrape for non-YouTube links."""
    try:
        r = requests.get(url, timeout=6, headers={"User-Agent": "StudyBase/1.0"})
        m = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.I | re.S)
        if m:
            return html.unescape(m.group(1).strip())[:200]
    except Exception:
        pass
    return None


def resource_metadata(url: str):
    """Detect type and fetch what we can. Never raises."""
    vid = extract_youtube_id(url)
    if vid:
        meta = fetch_youtube_meta(vid) or {}
        return {
            "source_type": "youtube",
            "title": meta.get("title"),
            # No key? Fall back to YouTube's public thumbnail URL pattern.
            "thumbnail": meta.get("thumbnail")
            or f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
        }
    return {"source_type": "article", "title": scrape_title(url), "thumbnail": None}


def analyze_sentiment(text: str):
    """Returns (label, score) where label ∈ positive|neutral|negative and
    score ∈ [-1, 1], or (None, None) if unavailable."""
    if not HF_API_KEY:
        return None, None
    try:
        r = requests.post(
            HF_MODEL_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={"inputs": text[:1000]},
            timeout=15,
        )
        data = r.json()
        # Shape: [[{"label": "POSITIVE", "score": 0.98}, {"label": "NEGATIVE", ...}]]
        scores = {d["label"]: d["score"] for d in data[0]}
        pos, neg = scores.get("POSITIVE", 0), scores.get("NEGATIVE", 0)
        signed = pos - neg                      # -1 .. 1
        if signed > 0.25:
            label = "positive"
        elif signed < -0.25:
            label = "negative"
        else:
            label = "neutral"
        return label, round(signed, 3)
    except Exception:
        return None, None


# ---------------------------------------------------------------- books ----
def fetch_book_meta(query: str):
    """Look up a book by title or ISBN via Open Library. Returns
    {title, author, thumbnail, url, year} or None. Never raises."""
    try:
        r = requests.get(
            "https://openlibrary.org/search.json",
            params={"q": query, "limit": 1,
                    "fields": "key,title,author_name,cover_i,first_publish_year"},
            headers={"User-Agent": "StudyBase/1.0 (student project)"},
            timeout=8,
        )
        docs = r.json().get("docs", [])
        if not docs:
            return None
        d = docs[0]
        cover = (f"https://covers.openlibrary.org/b/id/{d['cover_i']}-M.jpg"
                 if d.get("cover_i") else None)
        key = d.get("key", "")
        url = (f"https://openlibrary.org{key}" if key.startswith("/")
               else f"https://openlibrary.org/works/{key}")
        authors = d.get("author_name") or []
        return {
            "title": d.get("title"),
            "author": authors[0] if authors else None,
            "thumbnail": cover,
            "url": url,
            "year": d.get("first_publish_year"),
        }
    except Exception:
        return None


# ------------------------------------------------------------- holidays ----
def fetch_holidays(year, country: str):
    """Public holidays for a country/year via Nager.Date. Returns a list of
    {date, name, localName} (possibly empty). Never raises."""
    try:
        r = requests.get(
            f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country}",
            timeout=8,
        )
        if r.status_code != 200:
            return []
        return [{"date": h["date"], "name": h.get("name"), "localName": h.get("localName")}
                for h in r.json()]
    except Exception:
        return []


# ------------------------------------------------------------- ai chat ----
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/free")


def chat_completion(messages):
    """Call OpenRouter (OpenAI-compatible). Returns reply text or None if the
    key is missing or the request fails. Never raises."""
    if not OPENROUTER_API_KEY:
        return None
    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "X-Title": "StudyBase",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": messages,
                "max_tokens": 600,
                "temperature": 0.6,
            },
            timeout=30,
        )
        return r.json()["choices"][0]["message"]["content"]
    except Exception:
        return None