<#
.SYNOPSIS
    1-Command iGUIDE Docker Server Update Script (run on the Desktop Server PC)
.DESCRIPTION
    Pulls latest commits from GitHub, rebuilds and restarts iguide-app without
    touching iguide-db or uploaded images, runs pending DB migrations, and
    verifies health on http://127.0.0.1:4321/api/tunnel.
#>
$ErrorActionPreference = "Stop"

Write-Host "`n=== iGUIDE Server Update ===" -ForegroundColor Cyan

Write-Host "[1/4] Pulling latest code from GitHub (master)..." -ForegroundColor Yellow
git pull origin master

Write-Host "[2/4] Rebuilding & restarting iguide-app + iguide-tunnel containers..." -ForegroundColor Yellow
docker compose --profile production up -d --build --force-recreate iguide-app iguide-tunnel

Write-Host "[3/4] Running database migrations..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
docker compose exec -T iguide-app npm run migrate

Write-Host "[4/4] Verifying live server health..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$health = Invoke-RestMethod -Uri "http://127.0.0.1:4321/api/tunnel" -TimeoutSec 10
Write-Host "Health OK: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
Write-Host "`niGUIDE update complete!`n" -ForegroundColor Green
