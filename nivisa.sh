#!/usr/bin/env bash
#
# Nivisa — one command for the whole stack.
#
#   ./nivisa.sh            start everything (default)
#   ./nivisa.sh up         same
#   ./nivisa.sh down       stop, keep the database
#   ./nivisa.sh reset      stop, DELETE the database, start fresh
#   ./nivisa.sh restart    restart the app containers
#   ./nivisa.sh logs [svc] follow logs (all, or one service)
#   ./nivisa.sh seed       re-run the seeder
#   ./nivisa.sh psql       open a database shell
#   ./nivisa.sh status     what is running
#
# Works in Git Bash on Windows, and on macOS and Linux.

set -uo pipefail
cd "$(dirname "$0")"

# --- Ports this stack publishes. Checked before starting, because the failure
#     Docker gives for a taken port is a wall of text that does not say which
#     port or what is holding it.
PORTS="3001:storefront 5174:dashboard 8000:api 5433:postgres 6379:redis 8025:mailpit"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

say()  { printf '%s\n' "$*"; }
step() { printf '%s==>%s %s\n' "$BOLD" "$RESET" "$*"; }
warn() { printf '%s !%s  %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '%s✗%s  %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

# --- Prerequisites ----------------------------------------------------------

require_docker() {
  command -v docker >/dev/null 2>&1 \
    || die "Docker is not installed, or not on PATH. Install Docker Desktop and try again."

  # `docker info` fails when the engine is not running. Checked separately
  # from the binary existing, because "Docker Desktop is not started" is a
  # different problem with a different fix.
  docker info >/dev/null 2>&1 \
    || die "Docker is installed but not running. Start Docker Desktop, wait for the whale icon to settle, and try again."

  docker compose version >/dev/null 2>&1 \
    || die "This needs Docker Compose v2 (the 'docker compose' subcommand). Update Docker Desktop."
}

# --- Port check -------------------------------------------------------------

port_in_use() {
  local port="$1"
  if command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -qE "[:.]${port}[[:space:]].*(LISTEN|LISTENING)"
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"
  else
    return 1  # No tool to check with; let Docker report it.
  fi
}

# Ports already published by THIS stack are fine — that is just a running
# Nivisa, not a conflict.
ours() {
  docker compose ps --services --filter status=running 2>/dev/null | grep -q .
}

check_ports() {
  local conflicts=""
  if ours; then return 0; fi

  for entry in $PORTS; do
    local port="${entry%%:*}" name="${entry##*:}"
    if port_in_use "$port"; then
      conflicts="${conflicts}  ${port}  (${name})\n"
    fi
  done

  if [ -n "$conflicts" ]; then
    warn "These ports are already in use by something else:"
    printf "$conflicts"
    say ""
    say "  Stop whatever is using them, or change the published port in"
    say "  ${DIM}docker-compose.yml${RESET}. If you move the storefront, change"
    say "  ${DIM}STOREFRONT_URL${RESET} and ${DIM}NEXT_PUBLIC_SITE_URL${RESET} with it —"
    say "  the payment gateway is told where to send the browser back to."
    say ""
    printf "Try starting anyway? [y/N] "
    read -r answer
    case "$answer" in [yY]*) ;; *) exit 1 ;; esac
  fi
}

# --- Readiness --------------------------------------------------------------

wait_for() {
  local url="$1" label="$2" tries="${3:-60}"
  printf '    %-22s' "$label"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      printf '%s ready%s\n' "$GREEN" "$RESET"
      return 0
    fi
    sleep 2
  done
  printf '%s not responding%s\n' "$YELLOW" "$RESET"
  return 1
}

banner() {
  say ""
  say "${BOLD}Nivisa is running.${RESET}"
  say ""
  say "  Storefront        http://localhost:3001"
  say "  Staff dashboard   http://localhost:5174"
  say "  API docs          http://localhost:8000/docs"
  say "  Mail inbox        http://localhost:8025"
  say "  PostgreSQL        localhost:5433   nivisa / nivisa"
  say ""
  say "  ${BOLD}Sign in to the dashboard${RESET}"
  say "    superadmin@nivisa.in"
  say "    Nivisa@2026"
  say ""
  say "  ${BOLD}Sign in to the shop${RESET}"
  say "    any of 9876543210 / 9812345678, OTP ${BOLD}123456${RESET}"
  say ""
  say "  ${DIM}./nivisa.sh logs     follow the logs${RESET}"
  say "  ${DIM}./nivisa.sh down     stop${RESET}"
  say "  ${DIM}./nivisa.sh reset    start over with an empty database${RESET}"
  say ""
}

start() {
  require_docker
  check_ports

  step "Building and starting containers"
  docker compose up -d --build || die "Compose failed to start. Run './nivisa.sh logs' to see why."

  step "Waiting for services"
  # The API seeds the database on boot, so it is the slowest to answer and
  # the one worth waiting on. The others follow quickly.
  wait_for "http://localhost:8000/api/v1/health" "API"        90
  wait_for "http://localhost:5174/"              "Dashboard"  45
  wait_for "http://localhost:3001/"              "Storefront" 60

  banner
}

# --- Commands ---------------------------------------------------------------

case "${1:-up}" in
  up|start|"")
    start
    ;;

  down|stop)
    require_docker
    step "Stopping containers (the database is kept)"
    docker compose down
    say "Stopped. ${DIM}./nivisa.sh up${RESET} to start again."
    ;;

  reset)
    require_docker
    warn "This DELETES the database and all uploaded images."
    printf "Type 'reset' to confirm: "
    read -r answer
    [ "$answer" = "reset" ] || { say "Nothing was changed."; exit 0; }
    step "Removing containers and volumes"
    docker compose down -v
    start
    ;;

  restart)
    require_docker
    step "Restarting the application containers"
    docker compose restart api web admin
    wait_for "http://localhost:8000/api/v1/health" "API" 60
    say "Restarted."
    ;;

  logs)
    require_docker
    shift || true
    docker compose logs -f --tail 100 "$@"
    ;;

  seed)
    require_docker
    step "Running the seeder (idempotent — existing data is left alone)"
    docker compose run --rm api python -m scripts.seed
    ;;

  psql|db)
    require_docker
    docker compose exec db psql -U nivisa -d nivisa
    ;;

  status|ps)
    require_docker
    docker compose ps
    ;;

  help|-h|--help)
    # Prints the header comment block and stops at the first line that is not
    # a comment, so the help can never drift out of step with a line count.
    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"
    ;;

  *)
    die "Unknown command '$1'. Try './nivisa.sh help'."
    ;;
esac
