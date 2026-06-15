import multiprocessing
import os

# Port de liaison
port = os.environ.get("PORT", "5000")
bind = f"0.0.0.0:{port}"

# Performance
workers = int(os.environ.get("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
threads = int(os.environ.get("WEB_THREADS", 2))

# Type de worker (sync est suffisant pour sqlite car threads = I/O concurrents)
worker_class = "gthread"

# Timeout & Limites
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 30))
keepalive = 2

# Logging
accesslog = "-"  # Redirige les logs d'accès vers stdout
errorlog = "-"   # Redirige les logs d'erreurs vers stderr
loglevel = os.environ.get("LOG_LEVEL", "info")

# Sécurité proxy (pour bien récupérer les IPs réelles et le protocole https)
forwarded_allow_ips = "*"
secure_scheme_headers = {
    "X-FORWARDED-PROTOCOL": "ssl",
    "X-FORWARDED-PROTO": "https",
    "X-FORWARDED-SSL": "on",
}
