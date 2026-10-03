@echo off
title DA-LARES Interactive Map Server
cd /d "%~dp0"

:: Check if server is already running on port 8080
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] DA-LARES Map server is already running. Opening browser in Kiosk Mode...
    start http://localhost:8080/?mode=kiosk
    exit /b 0
)

echo [INFO] Starting DA-LARES Map Server and Cloudflare Tunnel...
start "" "C:\Program Files\nodejs\node.exe" server.js

:: Wait for server to initialize on port 8080
timeout /t 3 /nobreak >nul 2>&1

echo [INFO] Launching Interactive Map in Kiosk Mode...
start http://localhost:8080/?mode=kiosk
exit /b 0
