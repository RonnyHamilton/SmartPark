@echo off
setlocal enabledelayedexpansion
title SmartPark - Full Stack Application Runner

echo =====================================================================
echo                     SMARTPARK SYSTEM LAUNCHER
echo =====================================================================
echo.

cd /d "%~dp0"

:: -----------------------------------------------------------------------
:: 1. Verify Prerequisites
:: -----------------------------------------------------------------------
echo [1/5] Checking prerequisites...

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker was not found in PATH!
    echo Please install Docker Desktop and make sure it is added to your PATH.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker daemon is not running!
    echo Please start Docker Desktop and wait until the engine is ready, then run this script again.
    pause
    exit /b 1
)

where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Java was not found in PATH!
    echo Please install Java JDK 21 or higher and add it to your PATH.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js was not found in PATH!
    echo Please install Node.js v18 or higher and add it to your PATH.
    pause
    exit /b 1
)

echo    - Docker: OK
echo    - Java: OK
echo    - Node.js: OK
echo.

:: -----------------------------------------------------------------------
:: 2. Ensure Environment Configuration
:: -----------------------------------------------------------------------
echo [2/5] Checking configuration files...
if not exist ".env" (
    if exist ".env.example" (
        echo    - Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
    )
)
echo    - Environment file (.env): Ready
echo.

:: -----------------------------------------------------------------------
:: 3. Start Database & Database UI Containers
:: -----------------------------------------------------------------------
echo [3/5] Starting PostgreSQL 16 and Adminer via Docker Compose...
docker compose up -d

echo    - Waiting for PostgreSQL to be healthy...
set /a retries=0
:wait_postgres
set /a retries+=1
if %retries% geq 20 (
    echo [WARNING] PostgreSQL is taking longer than usual to report ready. Proceeding anyway...
    goto postgres_ready
)
docker exec smartpark-postgres pg_isready -U smartpark -d smartpark >nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 1 /nobreak >nul 2>&1 || ping -n 2 127.0.0.1 >nul 2>&1
    goto wait_postgres
)
:postgres_ready
echo    - PostgreSQL database is ready on port 5432!
echo    - Adminer database web UI is ready on port 8085!
echo.

:: -----------------------------------------------------------------------
:: 4. Start Backend Service (Spring Boot)
:: -----------------------------------------------------------------------
echo [4/5] Preparing backend service...

set JAR_FILE=backend\target\smartpark-backend-1.0.0.jar
if not exist "%JAR_FILE%" (
    echo    - JAR not found. Attempting to build backend with Maven...
    set MAVEN_CMD=mvn
    where mvn >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        if exist "C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\plugins\maven\lib\maven3\bin\mvn.cmd" (
            set "MAVEN_CMD=C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\plugins\maven\lib\maven3\bin\mvn.cmd"
        )
    )
    pushd backend
    call !MAVEN_CMD! clean package -DskipTests
    popd
    if not exist "%JAR_FILE%" (
        echo [ERROR] Failed to compile backend JAR. Please check Maven build errors.
        pause
        exit /b 1
    )
)

echo    - Launching Spring Boot backend in a dedicated window (Port 8080)...
start "SmartPark Backend (Port 8080)" cmd /k "title SmartPark Backend (Port 8080) && cd /d ""%~dp0backend"" && echo Starting SmartPark Backend on http://localhost:8080 ... && java -jar target\smartpark-backend-1.0.0.jar"
echo.

:: -----------------------------------------------------------------------
:: 5. Start Frontend Service (Vite React)
:: -----------------------------------------------------------------------
echo [5/5] Preparing frontend service...

if not exist "frontend\node_modules" (
    echo    - Installing frontend dependencies with npm install...
    pushd frontend
    call npm install
    popd
)

echo    - Launching Vite dev server in a dedicated window (Port 5173)...
start "SmartPark Frontend (Port 5173)" cmd /k "title SmartPark Frontend (Port 5173) && cd /d ""%~dp0frontend"" && echo Starting Vite Dev Server on http://localhost:5173 ... && npm run dev"
echo.

:: -----------------------------------------------------------------------
:: Application Summary & Launch Browser
:: -----------------------------------------------------------------------
echo =====================================================================
echo              SMARTPARK APPLICATION STARTED SUCCESSFULLY!
echo =====================================================================
echo.
echo  Access Points:
echo   - Web Application (Frontend):  http://localhost:5173
echo   - Backend REST API:            http://localhost:8080/api/v1
echo   - Swagger API Documentation:   http://localhost:8080/swagger-ui.html
echo   - Actuator Health Endpoint:    http://localhost:8080/actuator/health
echo   - Adminer (Database Web UI):   http://localhost:8085
echo.
echo  Default Demo Logins:
echo   - Admin Account: admin@smartpark.local  /  Admin@12345!
echo   - User Account:  demo@smartpark.local   /  Demo@12345!
echo.
echo  Database Access:
echo   - Engine:   PostgreSQL 16
echo   - Host:     localhost:5432  (or 'postgres' inside Adminer web UI)
echo   - Database: smartpark
echo   - Username: smartpark
echo   - Password: smartpark_dev_password
echo.
echo  See 'instructions.md' for full database documentation and query guide.
echo =====================================================================
echo.

:: Wait 3 seconds then open frontend in default browser
timeout /t 3 /nobreak >nul 2>&1 || ping -n 4 127.0.0.1 >nul 2>&1
start http://localhost:5173

echo Both Backend and Frontend windows are running. Keep those windows open.
echo To shut down all services later, run 'stop-app.cmd' or close the windows.
echo.
pause
