FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Requirements are copied and installed before the source, so an edit to a
# route does not reinstall asyncpg. This layer is cached until the file
# itself changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The uploads volume mounts here. Created at build time so the directory
# exists even when the volume is empty, and owned by the user that runs the
# app rather than by root, or STORAGE_PROVIDER=local cannot write to it.
RUN mkdir -p /data/media \
    && useradd --create-home --uid 10001 nivisa \
    && chown -R nivisa:nivisa /data/media /app
USER nivisa

# The port the app listens on when nothing says otherwise. Every hosting
# platform worth using injects PORT and expects the process to honour it -
# Render, Railway, Fly and Cloud Run all do - and a container that ignores it
# passes its build, starts cleanly, and then fails every health check with
# nothing in the log to say why. Compose publishes 8000, which is this
# default, so the local stack is unaffected.
ENV PORT=8000
EXPOSE 8000

# `sh -c` because the exec form does not expand ${PORT}; it would pass the
# literal string to uvicorn, which rejects it as not an integer.
#
# No --reload. The reloader is a development convenience that spawns a second
# process to watch the filesystem, and on a small instance that is memory
# spent watching files nobody is editing. docker-compose overrides this
# command to put it back for local work.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen(f\"http://localhost:{os.environ.get('PORT','8000')}/api/v1/health\", timeout=3).status == 200 else 1)"

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
