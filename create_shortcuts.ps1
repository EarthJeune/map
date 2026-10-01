$WshShell = New-Object -ComObject WScript.Shell

# 1. Windows Startup Shortcut (launches automatically whenever user logs into Windows)
$startupFolder = [System.Environment]::GetFolderPath('Startup')
$startupShortcutPath = Join-Path $startupFolder "DA-LARES-Map-AutoStart.lnk"
$shortcut = $WshShell.CreateShortcut($startupShortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"C:\Users\LGU-SanPedro\Downloads\map\start_kiosk_silent.vbs`""
$shortcut.WorkingDirectory = "C:\Users\LGU-SanPedro\Downloads\map"
$shortcut.Description = "Auto-launch DA-LARES Interactive Map and Cloudflare Tunnel on Startup"
$shortcut.Save()
Write-Host "Created Startup shortcut: $startupShortcutPath"

# 2. Desktop Shortcut (for quick 1-click manual launch anytime)
$desktopFolder = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopFolder "DA-LARES Interactive Map.lnk"
$dShortcut = $WshShell.CreateShortcut($desktopShortcutPath)
$dShortcut.TargetPath = "wscript.exe"
$dShortcut.Arguments = "`"C:\Users\LGU-SanPedro\Downloads\map\start_kiosk_silent.vbs`""
$dShortcut.WorkingDirectory = "C:\Users\LGU-SanPedro\Downloads\map"
$dShortcut.Description = "Launch DA-LARES 3D Interactive Map and Server"
$dShortcut.Save()
Write-Host "Created Desktop shortcut: $desktopShortcutPath"
