from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Détecter si l'application tourne sur Vercel (environnement serverless en lecture seule)
IS_VERCEL = os.environ.get("VERCEL") == "1"

if IS_VERCEL:
    DEFAULT_DB_PATH = Path("/tmp") / "campusverite.db"
else:
    DEFAULT_DB_PATH = BASE_DIR / "data" / "campusverite.db"

# Charger le fichier .env s'il existe
load_dotenv(BASE_DIR / ".env")



class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "campusverite-dev-key")
    DATABASE_PATH = Path(os.environ.get("CAMPUSVERITE_DB_PATH", DEFAULT_DB_PATH))
    PETITION_THRESHOLD = int(os.environ.get("PETITION_THRESHOLD", "10"))
    REPORT_HIDE_THRESHOLD = int(os.environ.get("REPORT_HIDE_THRESHOLD", "5"))
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
    JSON_SORT_KEYS = False



class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TESTING = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(24).hex())
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


CONFIGS = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

