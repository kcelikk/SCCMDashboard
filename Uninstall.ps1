#Requires -RunAsAdministrator
<#
.SYNOPSIS
    SCCM Dashboard kaldirir (IIS site, App Pool, Scheduled Tasks, Firewall, API)
.PARAMETER RemoveFiles
    Dosyalari da sil (varsayilan: hayir)
#>
[CmdletBinding()]
param(
    [switch]$RemoveFiles,
    [string]$InstallPath = "C:\SCCMDashboard"
)

$ErrorActionPreference = "Continue"

Write-Host "`n=== SCCM Dashboard Kaldirma ===" -ForegroundColor Yellow

# Scheduled Tasks
foreach ($taskName in @("SCCMDashboard-CacheRefresh", "SCCMDashboard-RefreshAPI")) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "  [OK] Scheduled Task kaldirildi: $taskName" -ForegroundColor Green
    }
}

# IIS
Import-Module WebAdministration -ErrorAction SilentlyContinue
$siteName = "SCCMDashboard"
$poolName = "SCCMDashboardPool"

$site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if ($site) {
    Stop-Website -Name $siteName -ErrorAction SilentlyContinue
    Remove-Website -Name $siteName
    Write-Host "  [OK] IIS Site kaldirildi" -ForegroundColor Green
}

if (Test-Path "IIS:\AppPools\$poolName") {
    Remove-WebAppPool -Name $poolName
    Write-Host "  [OK] App Pool kaldirildi" -ForegroundColor Green
}

# Firewall
foreach ($fwName in @("SCCMDashboard-HTTP", "SCCMDashboard-RefreshAPI")) {
    $fw = Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue
    if ($fw) {
        Remove-NetFirewallRule -DisplayName $fwName
        Write-Host "  [OK] Firewall kurali kaldirildi: $fwName" -ForegroundColor Green
    }
}

# URL ACL
try {
    # Read config to get API port
    $configFile = Join-Path $InstallPath "Config\config.json"
    if (Test-Path $configFile) {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        $apiPort = if ($config.refreshApiPort) { $config.refreshApiPort } else { 9091 }
        & netsh http delete urlacl url="http://+:${apiPort}/" 2>$null
        Write-Host "  [OK] URL ACL kaldirildi: port $apiPort" -ForegroundColor Green
    }
} catch { }

# Dosyalar
if ($RemoveFiles) {
    if (Test-Path $InstallPath) {
        Remove-Item -Path $InstallPath -Recurse -Force
        Write-Host "  [OK] Dosyalar silindi: $InstallPath" -ForegroundColor Green
    }
}

Write-Host "`n=== Kaldirma tamamlandi ===" -ForegroundColor Green
