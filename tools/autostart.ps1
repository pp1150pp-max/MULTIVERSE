# Starts the MULTIVERSE server + friends' link by itself when Windows boots (Task Scheduler, no window,
# no sign-in needed), using `npm run always-on` (server/online-main.ts --always-on). Logs: npm run logs.
#   npm run autostart -- -Install     register the task (asks for administrator rights once)
#   npm run autostart -- -Status      is it registered / running, last result
#   npm run autostart -- -Start       start it now (e.g. after npm run stop-server)
#   npm run autostart -- -Uninstall   remove the task (does not stop a running server: npm run stop-server)
# Never press "End" on the task in Task Scheduler: like killing the window, it stops the server
# without the countdown or saving. Always stop with npm run stop-server.
param([switch]$Install, [switch]$Uninstall, [switch]$Start, [switch]$Status)
$ErrorActionPreference = 'Stop'
$TaskName = 'MULTIVERSE server'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
function Elevate([string]$switchName) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -$switchName"
  exit
}
function Pause-IfElevated { if ($isAdmin) { Write-Host ''; Read-Host 'Press Enter to close' | Out-Null } }

if ($Install) {
  # A worktree (another Claude session's copy) is deleted later: the task would point at nothing.
  if ($Root -like '*\.claude\worktrees\*') {
    Write-Host "Refused: $Root is a worktree. Run this from the main folder (where the live server runs)." -ForegroundColor Red
    exit 1
  }
  if (-not $isAdmin) { Elevate 'Install' }
  $node = (Get-Command node -ErrorAction Stop).Source
  if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
    Write-Host "Warning: $Root\dist has no build yet. Run: npx vite build" -ForegroundColor Yellow
  }
  $action = New-ScheduledTaskAction -Execute $node -Argument '--import tsx server/online-main.ts --always-on' -WorkingDirectory $Root
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $trigger.Delay = 'PT30S' # give the network a moment
  # S4U: runs as this Windows user whether or not anyone is signed in, without storing the password.
  $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $who = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
  # No time limit (the default 3 days would end the server without saving), normal priority (the default
  # is below normal), keep running on battery, one copy only.
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -Priority 4 `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $who -Settings $settings `
    -Description "MULTIVERSE game server + friends' link (npm run always-on in $Root). Stop only with npm run stop-server." -Force | Out-Null
  Write-Host ''
  Write-Host "Done: '$TaskName' starts at boot as $user" -ForegroundColor Green
  Write-Host "  folder: $Root"
  Write-Host "  node:   $node"
  Write-Host '  It is not started now. Start it with: npm run autostart -- -Start'
  Pause-IfElevated
  exit
}

if ($Uninstall) {
  if (-not $isAdmin) { Elevate 'Uninstall' }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed '$TaskName' (a server that is running keeps running: npm run stop-server)." -ForegroundColor Green
  Pause-IfElevated
  exit
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "'$TaskName' is not registered. Run: npm run autostart -- -Install"
  exit 1
}

if ($Start) {
  try {
    Start-ScheduledTask -TaskName $TaskName
  } catch {
    if (-not $isAdmin) { Elevate 'Start' }
    throw
  }
  Write-Host "Started '$TaskName'. Watch it with: npm run logs -- --follow" -ForegroundColor Green
  Pause-IfElevated
  exit
}

$info = Get-ScheduledTaskInfo -TaskName $TaskName
$listening = [bool](Get-NetTCPConnection -LocalPort 2567 -State Listen -ErrorAction SilentlyContinue)
Write-Host "Task:        $TaskName ($($task.State))"
Write-Host "Runs:        $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
Write-Host "Folder:      $($task.Actions[0].WorkingDirectory)"
Write-Host "Last start:  $($info.LastRunTime)   last result: $($info.LastTaskResult) (267009 = still running)"
Write-Host "Port 2567:   $(if ($listening) { 'server is listening' } else { 'nothing listening' })"
Write-Host "Time limit:  $($task.Settings.ExecutionTimeLimit) (PT0S = none)   priority: $($task.Settings.Priority) (4 = normal)"
