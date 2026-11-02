@echo off
setlocal enabledelayedexpansion
title SmartPark - Stop All Services

echo =====================================================================
echo                     STOPPING SMARTPARK SERVICES
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Stopping Docker Compose containers (PostgreSQL and Adminer)...
docker compose down

echo.
echo [2/3] Checking and stopping processes on port 8080 (Spring Boot Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo    - Terminating Backend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [3/3] Checking and stopping processes on port 5173 (Vite Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo    - Terminating Frontend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo =====================================================================
echo              ALL SMARTPARK SERVICES HAVE BEEN STOPPED
echo =====================================================================
echo.
pause
