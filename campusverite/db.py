from __future__ import annotations

import sqlite3
from pathlib import Path

from flask import Flask, current_app, g

from .constants import CATEGORIES


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        db_path = Path(current_app.config["DATABASE_PATH"])
        db_path.parent.mkdir(exist_ok=True)
        connection = sqlite3.connect(db_path)
        connection.row_factory = sqlite3.Row
        g.db = connection

    return g.db


def close_db(error: BaseException | None = None) -> None:
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def init_db() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('rant', 'suggestion')),
            content TEXT NOT NULL,
            useful_votes INTEGER NOT NULL DEFAULT 0,
            report_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'published'
                CHECK(status IN ('published', 'petition', 'hidden')),
            created_at TEXT NOT NULL,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS campus_moods (
            mood_key TEXT PRIMARY KEY,
            mood_label TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0
        );
        """
    )
    db.executemany(
        """
        INSERT INTO categories (slug, name)
        VALUES (?, ?)
        ON CONFLICT(slug) DO UPDATE SET name = excluded.name
        """,
        CATEGORIES,
    )
    db.commit()

    # Seed moods if empty
    if db.execute("SELECT COUNT(*) FROM campus_moods").fetchone()[0] == 0:
        db.executemany(
            """
            INSERT INTO campus_moods (mood_key, mood_label, count)
            VALUES (?, ?, ?)
            """,
            [
                ("happy", "😊 Zen", 24),
                ("stressed", "😰 Stressé", 45),
                ("tired", "😴 Fatigué", 56),
                ("angry", "😡 En Colère", 18),
                ("motivated", "🔥 Déterminé", 32)
            ]
        )
        db.commit()

    # Seed chat messages if empty
    if db.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0] == 0:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc).replace(microsecond=0)
        db.executemany(
            """
            INSERT INTO chat_messages (username, content, created_at)
            VALUES (?, ?, ?)
            """,
            [
                ("Étudiant #31", "Salut tout le monde ! Quelqu'un sait si le gymnase est ouvert ce soir ?", (now - timedelta(minutes=45)).isoformat()),
                ("Anonyme #12", "Oui, c'est ouvert jusqu'à 22h le lundi !", (now - timedelta(minutes=42)).isoformat()),
                ("Étudiant #45", "Le sujet d'exam de maths de cet après-midi était d'une violence... 💀", (now - timedelta(minutes=15)).isoformat()),
                ("CaféineLover", "Totalement d'accord, j'ai rendu copie blanche sur la dernière partie", (now - timedelta(minutes=10)).isoformat()),
                ("Anonyme #99", "Courage les gars, ce sont bientôt les vacances ! 🏖️", (now - timedelta(minutes=5)).isoformat())
            ]
        )
        db.commit()


    # Seed initial posts if DB is empty
    if db.execute("SELECT COUNT(*) FROM posts").fetchone()[0] == 0:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc).replace(microsecond=0)
        
        def get_cat_id(slug):
            row = db.execute("SELECT id FROM categories WHERE slug = ?", (slug,)).fetchone()
            return row[0] if row else None

        seed_posts = [
            (
                get_cat_id("cafeteria"),
                "rant",
                "La queue à la cafétéria est interminable aujourd'hui (plus de 30min)... C'est insupportable quand on n'a que 45 minutes de pause déjeuner.",
                12,
                0,
                "petition",
                (now - timedelta(hours=2)).isoformat()
            ),
            (
                get_cat_id("securite"),
                "rant",
                "Problème d'éclairage dans le parking B3, c'est complètement sombre et très dangereux la nuit. Il faudrait remplacer les ampoules au plus vite.",
                8,
                0,
                "published",
                (now - timedelta(hours=5)).isoformat()
            ),
            (
                get_cat_id("cours_profs"),
                "suggestion",
                "Ce serait super d'avoir les enregistrements vidéo de tous les cours magistraux d'amphi sur la plateforme pour pouvoir réviser sereinement.",
                15,
                0,
                "petition",
                (now - timedelta(hours=8)).isoformat()
            ),
            (
                get_cat_id("evenements"),
                "suggestion",
                "Pourquoi ne pas organiser un grand festival d'intégration inter-facs en plein air en début d'année pour rassembler tous les campus ?",
                4,
                0,
                "published",
                (now - timedelta(days=1)).isoformat()
            ),
            (
                get_cat_id("administration"),
                "rant",
                "Le secrétariat ferme pile aux heures où les étudiants n'ont pas cours (12h-14h). C'est impossible de venir récupérer sa carte d'étudiant ou ses certificats !",
                9,
                0,
                "published",
                (now - timedelta(days=1, hours=3)).isoformat()
            ),
            (
                get_cat_id("equipements"),
                "suggestion",
                "Il manque cruellement de prises électriques fonctionnelles dans la bibliothèque universitaire. Nos ordinateurs tombent tous en panne en milieu de journée.",
                11,
                0,
                "petition",
                (now - timedelta(days=2)).isoformat()
            )
        ]
        db.executemany(
            """
            INSERT INTO posts (category_id, type, content, useful_votes, report_count, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [p for p in seed_posts if p[0] is not None]
        )
        db.commit()



def init_app(app: Flask) -> None:
    app.teardown_appcontext(close_db)

    @app.cli.command("init-db")
    def init_db_command() -> None:
        init_db()
        print("Base CampusVerite initialisee.")

    with app.app_context():
        init_db()
