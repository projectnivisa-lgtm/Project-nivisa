"""cPanel entry point.

cPanel's "Setup Python App" runs Phusion Passenger, and Passenger speaks
WSGI. FastAPI is ASGI. This file is the adapter between the two, and it is
the only file that exists for cPanel's benefit - `main.py` is untouched, so
Docker, uvicorn and this share one application object.

Passenger imports this file and looks for a module-level callable named
`application`. Both facts are fixed by Passenger and neither is configurable
from the cPanel UI, which is why the name looks arbitrary.

WHAT THIS COSTS
    A WSGI bridge runs the ASGI app on an event loop in a worker thread. It
    is a real cost - one thread per in-flight request, rather than one loop
    serving thousands - so this is the right shape for a staff dashboard and
    an internal storefront, and the wrong shape for a Black Friday queue. The
    day that matters, move to a host that runs `uvicorn main:app` directly:
    the application does not change, only what is in front of it.

NO INTERPRETER RE-EXEC HERE, DELIBERATELY
    Many cPanel passenger_wsgi.py files begin by re-executing themselves under
    the application's virtualenv. This one does not, because on this server
    Passenger already starts the app with the virtualenv's Python - the Flask
    app deployed alongside it relies on exactly that and imports third-party
    packages with no re-exec at all.

    Adding one is not harmless. `os.execl` replaces the process in the middle
    of Passenger's spawn handshake; Passenger then waits for a startup message
    that never arrives, and every request hangs until it times out, with
    nothing written to the log. That was mistaken for a missing dependency
    once already. If dependencies are genuinely missing, the fix is
    `pip install -r requirements.txt` with the app's virtualenv active - not a
    re-exec.

TROUBLESHOOTING
    Passenger reports a failed import as a 500 with nothing useful in the
    browser. The real error is in `~/logs` or in stderr for the app in the
    cPanel UI. The three that account for most of them:

      * `ModuleNotFoundError` for a third-party package - the virtualenv is
        missing dependencies. Activate it and run
        `pip install -r requirements.txt`; `python preflight.py` confirms.
      * `ModuleNotFoundError: app` - Passenger started outside the project
        directory. The chdir below fixes it; if it persists, the app root in
        the cPanel UI is pointing somewhere else.
      * `Refusing to start` - APP_ENV is production and a provider is still
        a stand-in. See docs/DEPLOY-CPANEL.md; internal deployments run
        APP_ENV=staging deliberately.
      * A blank 500 on the first request only - the virtualenv is missing a
        dependency. Re-run pip install from the cPanel terminal with the
        app's own environment activated.
"""
import os
import sys
import threading
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


# Passenger's working directory is not guaranteed to be the app root, and two
# things here are resolved relative to it: `import app...`, and pydantic's
# `env_file=".env"`. Without both of these the app either fails to import or
# starts with every setting at its Docker default - which is worse, because it
# boots and then cannot reach a database.
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
os.chdir(BASE_DIR)

from a2wsgi import ASGIMiddleware  # noqa: E402  (must follow the path setup)

from main import app  # noqa: E402

# One middleware instance for the life of the process, so the event loop it
# owns is created once. This matters more than it looks: SQLAlchemy's asyncpg
# pool binds its connections to the loop that opened them, and a bridge that
# span up a fresh loop per request would hand every second request a
# connection belonging to a loop that had already closed.
# Built on first request inside each worker, never at import.
#
# `ASGIMiddleware.__init__` creates an event loop and starts a daemon thread to
# run it. LiteSpeed's LSAPI (and Passenger's smart spawning) load this module
# once and then FORK their workers - and threads do not survive fork. A
# middleware built at import therefore reaches every worker holding a loop that
# nobody is running: each request waits on a future that can never complete, the
# request hangs until LSAPI's 60-second timeout, and a 500 is returned with
# nothing written to any log. Verified by forking: built before the fork the
# request hangs, built after it returns 200.
#
# Keyed by pid so a worker that inherited a parent's instance discards it and
# builds its own.
_bridge = None
_bridge_pid = None
_bridge_lock = threading.Lock()


def application(environ, start_response):
    """The WSGI callable LSAPI and Passenger look for."""
    global _bridge, _bridge_pid

    if _bridge is None or _bridge_pid != os.getpid():
        with _bridge_lock:
            # Re-checked inside the lock: two threads can arrive together on
            # the first request of a fresh worker.
            if _bridge is None or _bridge_pid != os.getpid():
                _bridge = ASGIMiddleware(app)
                _bridge_pid = os.getpid()

    return _bridge(environ, start_response)
