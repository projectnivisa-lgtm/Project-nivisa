@echo off
REM ===========================================================================
REM  Nivisa - one command for the whole stack.
REM
REM    nivisa            start everything (default)
REM    nivisa up         same
REM    nivisa down       stop, keep the database
REM    nivisa reset      stop, DELETE the database, start fresh
REM    nivisa restart    restart the app containers
REM    nivisa logs [svc] follow logs (all, or one service)
REM    nivisa seed       re-run the seeder
REM    nivisa psql       open a database shell
REM    nivisa status     what is running
REM
REM  Double-clicking this file runs "up" and keeps the window open.
REM ===========================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "CMD=%~1"
if "%CMD%"=="" set "CMD=up"

REM Keep the window open when this was double-clicked, so the URLs and the
REM password are readable instead of flashing past.
REM
REM Two conditions, not one. Explorer launches the file with no arguments AND
REM puts its path in CMDCMDLINE; a scripted "cmd /c nivisa.bat logs" matches
REM the second on its own, and pausing there would hang whatever called it.
set "PAUSE_AT_END="
if "%~1"=="" echo %CMDCMDLINE% | find /i "%~nx0" >nul 2>&1 && set "PAUSE_AT_END=1"

if /i "%CMD%"=="up"      goto :up
if /i "%CMD%"=="start"   goto :up
if /i "%CMD%"=="down"    goto :down
if /i "%CMD%"=="stop"    goto :down
if /i "%CMD%"=="reset"   goto :reset
if /i "%CMD%"=="restart" goto :restart
if /i "%CMD%"=="logs"    goto :logs
if /i "%CMD%"=="seed"    goto :seed
if /i "%CMD%"=="psql"    goto :psql
if /i "%CMD%"=="db"      goto :psql
if /i "%CMD%"=="status"  goto :status
if /i "%CMD%"=="ps"      goto :status
if /i "%CMD%"=="help"    goto :help
if /i "%CMD%"=="-h"      goto :help
if /i "%CMD%"=="--help"  goto :help

echo.
echo   Unknown command "%CMD%". Try: nivisa help
echo.
goto :end


REM ---------------------------------------------------------------- checks --
:require_docker
where docker >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Docker is not installed, or not on PATH.
  echo   Install Docker Desktop and try again.
  echo.
  goto :fail
)
REM "docker info" fails when the engine is not running. Checked separately
REM from the binary existing, because "Docker Desktop is not started" is a
REM different problem with a different fix.
docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Docker is installed but not running.
  echo   Start Docker Desktop, wait for the whale icon to settle, and try again.
  echo.
  goto :fail
)
docker compose version >nul 2>&1
if errorlevel 1 (
  echo.
  echo   This needs Docker Compose v2 ^(the "docker compose" subcommand^).
  echo   Update Docker Desktop.
  echo.
  goto :fail
)
exit /b 0


REM Ports this stack publishes. Checked before starting, because the failure
REM Docker gives for a taken port is a wall of text that does not say which
REM port or what is holding it.
:check_ports
REM A stack that is already running is not a conflict with itself.
for /f %%c in ('docker compose ps --services --filter status^=running 2^>nul ^| find /c /v ""') do set "RUNNING=%%c"
if not "%RUNNING%"=="0" exit /b 0

REM Each conflict is echoed as it is found rather than accumulated into one
REM variable: batch has no clean way to embed a newline in a variable, and the
REM version that tried printed six conflicts run together on one line.
set "CONFLICTS="
echo.
call :port_check 3001 storefront
call :port_check 5174 dashboard
call :port_check 8000 api
call :port_check 5433 postgres
call :port_check 6379 redis
call :port_check 8025 mailpit

if defined CONFLICTS (
  echo.
  echo   Stop whatever is using them, or change the published port in
  echo   docker-compose.yml. If you move the storefront, change
  echo   STOREFRONT_URL and NEXT_PUBLIC_SITE_URL with it - the payment
  echo   gateway is told where to send the browser back to.
  echo.
  set /p "ANSWER=Try starting anyway? [y/N] "
  if /i not "!ANSWER!"=="y" goto :fail
)
exit /b 0

:port_check
netstat -an | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
if errorlevel 1 exit /b 0
if not defined CONFLICTS echo   These ports are already in use by something else:
set "CONFLICTS=1"
echo       %~1  ^(%~2^)
exit /b 0


REM Polls a URL until it answers. Better than a fixed sleep: the API seeds the
REM database on boot, and how long that takes depends on the machine.
:wait_for
set "URL=%~1"
set "LABEL=%~2"
set "TRIES=%~3"
set /a N=0
:wait_loop
set /a N+=1
curl -fsS --max-time 3 "%URL%" >nul 2>&1
if not errorlevel 1 (
  echo     %LABEL% ready
  exit /b 0
)
if %N% GEQ %TRIES% (
  echo     %LABEL% not responding yet
  exit /b 1
)
REM "ping" as the sleep, not "timeout". timeout reads the console directly and
REM dies with "Input redirection is not supported" the moment this script's
REM output is piped or redirected - which made the loop spin through every
REM attempt in milliseconds and report a healthy API as down.
ping -n 3 127.0.0.1 >nul 2>&1
goto :wait_loop


REM ---------------------------------------------------------------- up ------
:up
call :require_docker || goto :end
call :check_ports    || goto :end

echo.
echo ==^> Building and starting containers
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo   Compose failed to start. Run "nivisa logs" to see why.
  echo.
  goto :fail
)

echo.
echo ==^> Waiting for services
call :wait_for "http://localhost:8000/api/v1/health" "API        " 45
call :wait_for "http://localhost:5174/"              "Dashboard  " 25
call :wait_for "http://localhost:3001/"              "Storefront " 30

echo.
echo  Nivisa is running.
echo.
echo    Storefront        http://localhost:3001
echo    Staff dashboard   http://localhost:5174
echo    API docs          http://localhost:8000/docs
echo    Mail inbox        http://localhost:8025
echo    PostgreSQL        localhost:5433   nivisa / nivisa
echo.
echo    Sign in to the dashboard
echo      superadmin@nivisa.in
echo      Nivisa@2026
echo.
echo    Sign in to the shop
echo      any of 9876543210 / 9812345678, OTP 123456
echo.
echo    nivisa logs     follow the logs
echo    nivisa down     stop
echo    nivisa reset    start over with an empty database
echo.
goto :end


REM ---------------------------------------------------------------- down ----
:down
call :require_docker || goto :end
echo.
echo ==^> Stopping containers ^(the database is kept^)
docker compose down
echo Stopped. "nivisa up" to start again.
echo.
goto :end


REM ---------------------------------------------------------------- reset ---
:reset
call :require_docker || goto :end
echo.
echo   This DELETES the database and all uploaded images.
set /p "ANSWER=Type 'reset' to confirm: "
if /i not "%ANSWER%"=="reset" (
  echo Nothing was changed.
  goto :end
)
echo.
echo ==^> Removing containers and volumes
docker compose down -v
goto :up


REM -------------------------------------------------------------- restart ---
:restart
call :require_docker || goto :end
echo.
echo ==^> Restarting the application containers
docker compose restart api web admin
call :wait_for "http://localhost:8000/api/v1/health" "API        " 30
echo Restarted.
echo.
goto :end


REM ---------------------------------------------------------------- misc ----
:logs
call :require_docker || goto :end
docker compose logs -f --tail 100 %2 %3 %4
goto :end

:seed
call :require_docker || goto :end
echo.
echo ==^> Running the seeder ^(idempotent - existing data is left alone^)
docker compose run --rm api python -m scripts.seed
goto :end

:psql
call :require_docker || goto :end
docker compose exec db psql -U nivisa -d nivisa
goto :end

:status
call :require_docker || goto :end
docker compose ps
goto :end

:help
echo.
echo   nivisa            start everything ^(default^)
echo   nivisa down       stop, keep the database
echo   nivisa reset      stop, DELETE the database, start fresh
echo   nivisa restart    restart the app containers
echo   nivisa logs [svc] follow logs ^(all, or one service^)
echo   nivisa seed       re-run the seeder
echo   nivisa psql       open a database shell
echo   nivisa status     what is running
echo.
goto :end


:fail
if defined PAUSE_AT_END pause
endlocal
exit /b 1

:end
if defined PAUSE_AT_END pause
endlocal
exit /b 0
