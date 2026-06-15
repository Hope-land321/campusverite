from functools import wraps
from flask import Blueprint, jsonify, redirect, render_template, request, url_for, session, current_app

from .constants import PUBLICATION_TYPES
from .services import (
    build_campus_radar,
    create_post,
    fetch_categories,
    fetch_heatmap,
    fetch_posts,
    fetch_stats,
    fetch_top_posts,
    report_post,
    validate_filters,
    validate_post_form,
    vote_post,
    fetch_all_posts_admin,
    toggle_post_visibility,
    delete_post_permanently,
    fetch_chat_messages,
    send_chat_message,
    fetch_moods,
    vote_mood,
)



main_bp = Blueprint("main", __name__)


@main_bp.get("/")
def index():
    category, publication_type = validate_filters(
        request.args.get("category") or None,
        request.args.get("type") or None,
    )
    posts = fetch_posts(category, publication_type)
    heatmap = build_campus_radar(fetch_heatmap())
    max_heat = max((int(row["score"]) for row in heatmap), default=1)
    moods = fetch_moods()
    total_mood_votes = sum(m["count"] for m in moods) or 1

    return render_template(
        "index.html",
        categories=fetch_categories(),
        posts=posts,
        top_posts=fetch_top_posts(),
        heatmap=heatmap,
        max_heat=max_heat or 1,
        stats=fetch_stats(),
        selected_category=category or "",
        selected_type=publication_type or "",
        publication_types=PUBLICATION_TYPES,
        created=request.args.get("created") == "1",
        moods=moods,
        total_mood_votes=total_mood_votes,
    )


@main_bp.get("/submit")
def submit():
    return render_template(
        "submit.html",
        categories=fetch_categories(),
        publication_types=PUBLICATION_TYPES,
        form_data={"category": "", "type": "", "content": ""},
        errors=[],
    )


@main_bp.post("/posts")
def store_post():
    form_data, errors = validate_post_form(request.form)
    if errors:
        return (
            render_template(
                "submit.html",
                categories=fetch_categories(),
                publication_types=PUBLICATION_TYPES,
                form_data=form_data,
                errors=errors,
            ),
            422,
        )

    create_post(form_data["category"], form_data["type"], form_data["content"])
    return redirect(url_for("main.index", created="1"))


@main_bp.post("/posts/<int:post_id>/vote")
def vote(post_id: int):
    payload = vote_post(post_id)
    if payload is None:
        return jsonify({"error": "Avis introuvable."}), 404

    return jsonify(payload)


@main_bp.post("/posts/<int:post_id>/report")
def report(post_id: int):
    payload = report_post(post_id)
    if payload is None:
        return jsonify({"error": "Avis introuvable."}), 404

    return jsonify(payload)


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect(url_for("main.admin_login"))
        return f(*args, **kwargs)
    return decorated_function


@main_bp.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if session.get("is_admin"):
        return redirect(url_for("main.admin_dashboard"))

    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        if username == "admin" and password == current_app.config["ADMIN_PASSWORD"]:
            session["is_admin"] = True
            return redirect(url_for("main.admin_dashboard"))
        else:
            error = "Identifiants invalides."

    return render_template("admin_login.html", error=error)


@main_bp.get("/admin/logout")
def admin_logout():
    session.pop("is_admin", None)
    return redirect(url_for("main.admin_login"))


@main_bp.get("/admin/dashboard")
@admin_required
def admin_dashboard():
    posts = fetch_all_posts_admin()
    stats = fetch_stats()
    return render_template(
        "admin_dashboard.html",
        posts=posts,
        stats=stats,
    )


@main_bp.post("/admin/posts/<int:post_id>/toggle-status")
@admin_required
def admin_toggle_status(post_id: int):
    new_status = toggle_post_visibility(post_id)
    if new_status is None:
        return jsonify({"error": "Avis introuvable."}), 404
    return jsonify({"status": new_status})


@main_bp.post("/admin/posts/<int:post_id>/delete")
@admin_required
def admin_delete_post(post_id: int):
    success = delete_post_permanently(post_id)
    if not success:
        return jsonify({"error": "Avis introuvable."}), 404
    return jsonify({"success": True})


# ── Chat ──────────────────────────────────────────────────────────────────────

@main_bp.get("/api/chat")
def api_chat_get():
    since_id = request.args.get("since", 0, type=int)
    msgs = fetch_chat_messages(limit=60)
    result = [
        {"id": m["id"], "username": m["username"],
         "content": m["content"], "created_at": m["created_at"]}
        for m in msgs if m["id"] > since_id
    ]
    return jsonify(result[::-1])  # chronological order


@main_bp.post("/api/chat")
def api_chat_post():
    data = request.get_json(force=True, silent=True) or {}
    result = send_chat_message(data.get("username", ""), data.get("content", ""))
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result), 201


# ── Moods ─────────────────────────────────────────────────────────────────────

@main_bp.get("/api/moods")
def api_moods_get():
    moods = fetch_moods()
    total = sum(m["count"] for m in moods) or 1
    return jsonify([
        {"key": m["mood_key"], "label": m["mood_label"], "count": m["count"],
         "pct": round(m["count"] / total * 100)}
        for m in moods
    ])


@main_bp.post("/api/moods/<mood_key>/vote")
def api_mood_vote(mood_key: str):
    result = vote_mood(mood_key)
    if result is None:
        return jsonify({"error": "Humeur invalide."}), 404
    return jsonify(result)


# ── Petition template ─────────────────────────────────────────────────────────

@main_bp.post("/api/petition/generate")
def api_petition_generate():
    data = request.get_json(force=True, silent=True) or {}
    title   = (data.get("title", "") or "").strip()[:120]
    issue   = (data.get("issue", "") or "").strip()[:800]
    target  = (data.get("target", "Administration") or "Administration").strip()[:80]
    demand  = (data.get("demand", "") or "").strip()[:400]
    if not title or not issue:
        return jsonify({"error": "Titre et problème requis."}), 400
    return jsonify({"title": title, "issue": issue, "target": target, "demand": demand})

