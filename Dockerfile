# --- Etape de Build ---
FROM python:3.11-slim AS builder

WORKDIR /app

# Empecher Python d'écrire des fichiers .pyc et activer le buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Installer les dépendances dans un environnement virtuel
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Etape Finale de Production ---
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/venv/bin:$PATH"
ENV FLASK_ENV=production
ENV CAMPUSVERITE_DB_PATH=/app/data/campusverite.db

# Copier l'environnement virtuel et l'application
COPY --from=builder /opt/venv /opt/venv
COPY . .

# Créer l'utilisateur non-root
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -s /sbin/nologin -c "Docker image user" appuser

# Créer le dossier data pour SQLite et attribuer les droits
RUN mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

# Exposer le port par défaut
EXPOSE 5000

# Commande de démarrage avec gunicorn et sa config
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
