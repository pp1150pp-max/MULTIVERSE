# Opens the MULTIVERSE server port for friends on Tailscale (100.64.0.0/10) and on your home
# network only. Run once with `npm run firewall` (or right-click > Run with PowerShell).
# Windows asks for administrator rights because firewall rules need them.
param([int]$Port = 2567)
$ErrorActionPreference = 'Stop'

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port"
  exit
}

$name = "MULTIVERSE server (port $Port)"
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port `
  -RemoteAddress @('100.64.0.0/10', 'LocalSubnet') -Action Allow -Profile Any | Out-Null

Write-Host ""
Write-Host "Done: port $Port is open for Tailscale (100.x.x.x) and your home network only." -ForegroundColor Green
Write-Host "To undo later: Remove-NetFirewallRule -DisplayName '$name'"
Write-Host ""
Read-Host "Press Enter to close"
