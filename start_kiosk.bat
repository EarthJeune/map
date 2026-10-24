@echo off
title DA-LARES Interactive Map Kiosk System
cd /d "%~dp0"

:: 1. Check if Node.js server is already running on port 8080
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Starting DA-LARES Local Backend Server...
    start "" /b "C:\Program Files\nodejs\node.exe" server.js
    timeout /t 2 /nobreak >nul 2>&1
) else (
    echo [INFO] DA-LARES Server is already active on port 8080.
)

:: 2. Chromium High-Performance Flags for Low-End Intel HD/UHD Graphics Kiosks
:: - ignore-gpu-blocklist: Forces hardware WebGL on older Intel HD 4000/4400/520 drivers
:: - enable-gpu-rasterization & enable-zero-copy: Direct VRAM uploads, cuts CPU usage
:: - disable-pinch & overscroll-history-navigation=0: Prevents kiosk layout distortion
:: - kiosk: True borderless touch display terminal mode
set KIOSK_URL=http://localhost:8080/?mode=kiosk
set GPU_FLAGS=--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000 --disable-component-update --autoplay-policy=no-user-gesture-required

:: 3. Detect Chrome or Edge executable
set BROWSER_EXE=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined BROWSER_EXE (
    echo [INFO] Launching Hardware-Accelerated Kiosk Terminal via %BROWSER_EXE%...
    start "" "%BROWSER_EXE%" --kiosk %GPU_FLAGS% "%KIOSK_URL%"
) else (
    echo [WARN] Dedicated Chromium browser not found in standard paths. Launching default browser...
    start "" "%KIOSK_URL%"
)

exit /b 0
