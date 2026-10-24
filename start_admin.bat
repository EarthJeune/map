@echo off
title DA-LARES Interactive Map — Admin Mode
cd /d "%~dp0"

:: Check if server is already running on port 8080
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] DA-LARES Map server is already running. Opening Admin Mode...
    start http://localhost:8080/?admin=1
    exit /b 0
)

echo [INFO] Starting DA-LARES Map Server...
start "" "C:\Program Files\nodejs\node.exe" server.js

:: Wait for server to initialize on port 8080
timeout /t 3 /nobreak >nul 2>&1

echo [INFO] Launching Interactive Map in Admin Mode...
start http://localhost:8080/?admin=1
exit /b 0
