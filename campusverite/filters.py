from __future__ import annotations

from datetime import datetime, timezone

from flask import Flask

from .constants import PUBLICATION_TYPES


def type_label(publication_type: str) -> str:
    return PUBLICATION_TYPES.get(publication_type, publication_type)


def relative_time(value: str) -> str:
    try:
        created_at = datetime.fromisoformat(value)
    except ValueError:
        return value

    now = datetime.now(timezone.utc)
    seconds = max(0, int((now - created_at).total_seconds()))

    if seconds < 60:
        return "a l'instant"
    if seconds < 3600:
        minutes = seconds // 60
        return f"il y a {minutes} min"
    if seconds < 86400:
        hours = seconds // 3600
        return f"il y a {hours} h"

    days = seconds // 86400
    return f"il y a {days} j"


def register_filters(app: Flask) -> None:
    app.add_template_filter(type_label, "type_label")
    app.add_template_filter(relative_time, "relative_time")
