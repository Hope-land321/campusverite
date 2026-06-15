from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from flask import current_app
from werkzeug.datastructures import ImmutableMultiDict

from .constants import CATEGORIES, PUBLICATION_TYPES
from .db import get_db


def fetch_categories() -> list[sqlite3.Row]:
    return get_db().execute("SELECT * FROM categories ORDER BY name").fetchall()


def fetch_posts(category_slug: str | None, publication_type: str | None) -> list[sqlite3.Row]:
    filters = ["posts.status != 'hidden'"]
    params: list[str] = []

    if category_slug:
        filters.append("categories.slug = ?")
        params.append(category_slug)

    if publication_type:
        filters.append("posts.type = ?")
        params.append(publication_type)

    where_clause = " AND ".join(filters)
    query = f"""
        SELECT
            posts.*,
            categories.name AS category_name,
            categories.slug AS category_slug
        FROM posts
        JOIN categories ON categories.id = posts.category_id
        WHERE {where_clause}
        ORDER BY datetime(posts.created_at) DESC, posts.id DESC
    """

    return get_db().execute(query, params).fetchall()


def fetch_top_posts(limit: int = 5) -> list[sqlite3.Row]:
    return get_db().execute(
        """
        SELECT
            posts.*,
            categories.name AS category_name,
            categories.slug AS category_slug
        FROM posts
        JOIN categories ON categories.id = posts.category_id
        WHERE posts.status != 'hidden'
        ORDER BY posts.useful_votes DESC, datetime(posts.created_at) DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()


def fetch_heatmap() -> list[sqlite3.Row]:
    return get_db().execute(
        """
        SELECT
            categories.slug,
            categories.name,
            COUNT(posts.id) AS post_count,
            COALESCE(SUM(posts.useful_votes), 0) AS total_votes,
            COALESCE(SUM(CASE WHEN posts.type = 'rant' THEN 1 ELSE 0 END), 0) AS rant_count,
            COALESCE(SUM(CASE WHEN posts.type = 'suggestion' THEN 1 ELSE 0 END), 0) AS suggestion_count
        FROM categories
        LEFT JOIN posts
            ON posts.category_id = categories.id
            AND posts.status != 'hidden'
        GROUP BY categories.id
        ORDER BY total_votes DESC, post_count DESC, categories.name
        """
    ).fetchall()


def build_campus_radar(rows: list[sqlite3.Row]) -> list[dict[str, int | str]]:
    radar = []
    for row in rows:
        score = int(row["total_votes"]) * 2 + int(row["post_count"]) + int(row["rant_count"])
        if score >= 12:
            status_key = "critical"
            status_label = "Critique"
        elif score >= 5:
            status_key = "watch"
            status_label = "A surveiller"
        else:
            status_key = "calm"
            status_label = "Calme"

        radar.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "post_count": row["post_count"],
                "total_votes": row["total_votes"],
                "rant_count": row["rant_count"],
                "suggestion_count": row["suggestion_count"],
                "score": score,
                "status_key": status_key,
                "status_label": status_label,
            }
        )

    return sorted(radar, key=lambda item: (-int(item["score"]), str(item["name"])))


def fetch_stats() -> dict[str, int]:
    row = get_db().execute(
        """
        SELECT
            COUNT(*) AS total_posts,
            COALESCE(SUM(useful_votes), 0) AS total_votes,
            COALESCE(SUM(CASE WHEN status = 'petition' THEN 1 ELSE 0 END), 0) AS petitions,
            COALESCE(SUM(CASE WHEN type = 'rant' THEN 1 ELSE 0 END), 0) AS rants,
            COALESCE(SUM(CASE WHEN type = 'suggestion' THEN 1 ELSE 0 END), 0) AS suggestions
        FROM posts
        WHERE status != 'hidden'
        """
    ).fetchone()
    return {
        "total_posts": row["total_posts"],
        "total_votes": row["total_votes"],
        "petitions": row["petitions"],
        "rants": row["rants"],
        "suggestions": row["suggestions"],
    }


def validate_filters(category: str | None, publication_type: str | None) -> tuple[str | None, str | None]:
    valid_categories = {slug for slug, _ in CATEGORIES}
    if category not in valid_categories:
        category = None

    if publication_type not in PUBLICATION_TYPES:
        publication_type = None

    return category, publication_type


def validate_post_form(form: ImmutableMultiDict[str, str]) -> tuple[dict[str, str], list[str]]:
    category_slug = form.get("category", "").strip()
    publication_type = form.get("type", "").strip()
    content = form.get("content", "").strip()
    charter_accepted = form.get("charter") == "on"
    errors: list[str] = []

    category_slugs = {slug for slug, _ in CATEGORIES}
    if category_slug not in category_slugs:
        errors.append("Choisis une categorie valide.")

    if publication_type not in PUBLICATION_TYPES:
        errors.append("Choisis un type de publication valide.")

    if len(content) < 20:
        errors.append("Le message doit contenir au moins 20 caracteres.")
    elif len(content) > 900:
        errors.append("Le message ne doit pas depasser 900 caracteres.")

    if not charter_accepted:
        errors.append("Accepte la charte avant de publier.")

    return {
        "category": category_slug,
        "type": publication_type,
        "content": content,
    }, errors


def create_post(category_slug: str, publication_type: str, content: str) -> None:
    created_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    db = get_db()
    category = db.execute(
        "SELECT id FROM categories WHERE slug = ?",
        (category_slug,),
    ).fetchone()
    db.execute(
        """
        INSERT INTO posts (category_id, type, content, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (category["id"], publication_type, content, created_at),
    )
    db.commit()


def vote_post(post_id: int) -> dict[str, int | str | bool] | None:
    db = get_db()
    post = db.execute(
        "SELECT id, useful_votes FROM posts WHERE id = ? AND status != 'hidden'",
        (post_id,),
    ).fetchone()
    if post is None:
        return None

    petition_threshold = current_app.config["PETITION_THRESHOLD"]
    new_votes = post["useful_votes"] + 1
    new_status = "petition" if new_votes >= petition_threshold else "published"
    db.execute(
        """
        UPDATE posts
        SET useful_votes = ?, status = ?
        WHERE id = ?
        """,
        (new_votes, new_status, post_id),
    )
    db.commit()

    return {
        "id": post_id,
        "useful_votes": new_votes,
        "status": new_status,
        "is_petition": new_status == "petition",
    }


def report_post(post_id: int) -> dict[str, int | bool] | None:
    db = get_db()
    post = db.execute(
        "SELECT id, report_count FROM posts WHERE id = ? AND status != 'hidden'",
        (post_id,),
    ).fetchone()
    if post is None:
        return None

    new_count = post["report_count"] + 1
    new_status = "hidden" if new_count >= current_app.config["REPORT_HIDE_THRESHOLD"] else None

    if new_status:
        db.execute(
            "UPDATE posts SET report_count = ?, status = ? WHERE id = ?",
            (new_count, new_status, post_id),
        )
    else:
        db.execute(
            "UPDATE posts SET report_count = ? WHERE id = ?",
            (new_count, post_id),
        )
    db.commit()

    return {
        "id": post_id,
        "report_count": new_count,
        "hidden": bool(new_status),
    }


def fetch_all_posts_admin() -> list[sqlite3.Row]:
    query = """
        SELECT
            posts.*,
            categories.name AS category_name,
            categories.slug AS category_slug
        FROM posts
        JOIN categories ON categories.id = posts.category_id
        ORDER BY datetime(posts.created_at) DESC, posts.id DESC
    """
    return get_db().execute(query).fetchall()


def toggle_post_visibility(post_id: int) -> str | None:
    db = get_db()
    post = db.execute(
        "SELECT id, status FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()
    if post is None:
        return None

    current_status = post["status"]
    new_status = "published" if current_status == "hidden" else "hidden"

    db.execute(
        "UPDATE posts SET status = ? WHERE id = ?",
        (new_status, post_id),
    )
    db.commit()
    return new_status


def delete_post_permanently(post_id: int) -> bool:
    db = get_db()
    cursor = db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()
    return cursor.rowcount > 0


# ── Chat ──────────────────────────────────────────────────────────────────────

def fetch_chat_messages(limit: int = 60) -> list[sqlite3.Row]:
    return get_db().execute(
        "SELECT * FROM chat_messages ORDER BY datetime(created_at) DESC LIMIT ?",
        (limit,),
    ).fetchall()


def send_chat_message(username: str, content: str) -> dict:
    username = (username or "").strip()[:30] or "Anonyme"
    content = (content or "").strip()[:400]
    if len(content) < 1:
        return {"error": "Message vide."}
    created_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    db = get_db()
    cursor = db.execute(
        "INSERT INTO chat_messages (username, content, created_at) VALUES (?, ?, ?)",
        (username, content, created_at),
    )
    db.commit()
    return {"id": cursor.lastrowid, "username": username, "content": content, "created_at": created_at}


# ── Moods ─────────────────────────────────────────────────────────────────────

def fetch_moods() -> list[sqlite3.Row]:
    return get_db().execute(
        "SELECT * FROM campus_moods ORDER BY count DESC"
    ).fetchall()


def vote_mood(mood_key: str) -> dict | None:
    db = get_db()
    row = db.execute("SELECT * FROM campus_moods WHERE mood_key = ?", (mood_key,)).fetchone()
    if row is None:
        return None
    db.execute("UPDATE campus_moods SET count = count + 1 WHERE mood_key = ?", (mood_key,))
    db.commit()
    total = db.execute("SELECT SUM(count) FROM campus_moods").fetchone()[0] or 1
    all_moods = fetch_moods()
    return {
        "moods": [
            {"key": m["mood_key"], "label": m["mood_label"], "count": m["count"],
             "pct": round(m["count"] / total * 100)}
            for m in all_moods
        ]
    }
