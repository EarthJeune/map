<#
.SYNOPSIS
    Automated MySQL Backup Script for iGUIDE Docker Server
.DESCRIPTION
    Exports a consistent UTF8MB4 dump of the live `kiosk` database from `iguide-db`
    into .\backups\kiosk_YYYY-MM-DD_HHmm.sql and retains the latest 14 backups.
#>
$ErrorActionPreference = "Stop"

$backupDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$envMap = @{}
$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') { $envMap[$matches[1].Trim()] = $matches[2].Trim() }
    }
}
$dbName = if ($envMap['DB_NAME']) { $envMap['DB_NAME'] } else { 'kiosk' }
$dbPass = $envMap['DB_PASSWORD']

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$outFile = Join-Path $backupDir "${dbName}_${stamp}.sql"

Write-Host "Exporting MySQL database '$dbName' from container 'iguide-db'..." -ForegroundColor Yellow
if ($dbPass) {
    docker compose exec -T iguide-db mysqldump -u root "-p$dbPass" --single-transaction --routines --triggers --default-character-set=utf8mb4 $dbName | Out-File -FilePath $outFile -Encoding utf8
} else {
    docker compose exec -T iguide-db mysqldump -u root --single-transaction --routines --triggers --default-character-set=utf8mb4 $dbName | Out-File -FilePath $outFile -Encoding utf8
}

$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Backup saved: $outFile ($sizeKB KB)" -ForegroundColor Green

# Prune older backups, keeping the 14 most recent
Get-ChildItem $backupDir -Filter "${dbName}_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
