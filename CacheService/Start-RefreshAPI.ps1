#Requires -Version 5.1
<#
.SYNOPSIS
    SCCM Dashboard - Manual Refresh API (Lightweight HTTP Listener)
.DESCRIPTION
    Provides an HTTP endpoint to trigger cache refresh manually from the dashboard UI.
    Runs as a scheduled task at system startup.
#>

[CmdletBinding()]
param(
    [string]$ConfigPath = "C:\SCCMDashboard\Config\config.json"
)

$ErrorActionPreference = "Continue"

# ── Load config ──
$installPath = Split-Path -Parent (Split-Path -Parent $ConfigPath)
$outputPath  = Join-Path $installPath "Web\data"
$port        = 9091
$allowedOrigins = @()

try {
    $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
    if ($config.refreshApiPort) { $port = $config.refreshApiPort }
    if ($config.outputPath)     { $outputPath = $config.outputPath }
    if ($config.allowedOrigins) { $allowedOrigins = @($config.allowedOrigins) }
} catch {
    Write-Warning "Config okunamadi, varsayilan degerler kullaniliyor: $_"
}

# ── Origin dogrulama (CSRF korumasi) ──
# allowedOrigins bos ise: sadece bu makineyi isaret eden origin'ler kabul edilir.
#   Host adlari + FQDN + tum yerel IP adresleri (IIS binding'i IP uzerinden olabilir).
#   Port ve sema karsilastirilmaz: dashboard 9090, API 9091 gibi farkli portlarda calisir.
# allowedOrigins dolu ise: yalnizca listedeki tam origin string'leri kabul edilir.
$localHostNames = [System.Collections.Generic.HashSet[string]]::new()
foreach ($n in @('localhost', '127.0.0.1', '::1', $env:COMPUTERNAME)) {
    if ($n) { [void]$localHostNames.Add($n.ToLowerInvariant()) }
}
try {
    $hostEntry = [System.Net.Dns]::GetHostEntry($env:COMPUTERNAME)
    if ($hostEntry.HostName) { [void]$localHostNames.Add($hostEntry.HostName.ToLowerInvariant()) }
    foreach ($addr in $hostEntry.AddressList) {
        [void]$localHostNames.Add(($addr.IPAddressToString -split '%')[0].ToLowerInvariant())
    }
} catch {
    Write-Warning "Yerel host adlari cozumlenemedi: $_"
}
try {
    foreach ($ip in (Get-NetIPAddress -ErrorAction SilentlyContinue)) {
        if ($ip.IPAddress) { [void]$localHostNames.Add((($ip.IPAddress) -split '%')[0].ToLowerInvariant()) }
    }
} catch { }   # Get-NetIPAddress eski sistemlerde olmayabilir — DNS listesi yeterli

function Test-OriginAllowed {
    param([string]$Origin)
    if ([string]::IsNullOrWhiteSpace($Origin)) { return $true }   # Origin yok = tarayici disi istemci (curl, task)
    if ($allowedOrigins.Count -gt 0) {
        return ($allowedOrigins -contains $Origin)
    }
    try {
        $uri = [Uri]$Origin
        # IPv6 origin'lerinde Uri.Host koseli parantezle gelir: [::1]
        $h = $uri.Host.ToLowerInvariant().Trim('[', ']')
        return $localHostNames.Contains($h)
    } catch { return $false }
}

$refreshScript = Join-Path $installPath "CacheService\Run-CacheRefresh.ps1"
$prefix = "http://+:$port/"

# ── Logging ──
$logPath = Join-Path $installPath "CacheService\logs"
if (!(Test-Path $logPath)) { New-Item -Path $logPath -ItemType Directory -Force | Out-Null }

function Write-APILog {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logFile = Join-Path $logPath "api_$(Get-Date -Format 'yyyyMMdd').log"
    Add-Content -Path $logFile -Value "[$ts] $Message" -Encoding UTF8
}

# ── Start Listener ──
$listener = $null
$script:refreshJob = $null

function Test-RefreshRunning {
    if ($null -eq $script:refreshJob) { return $false }
    if ($script:refreshJob.State -eq 'Running') { return $true }
    # Job bitti, temizle
    Remove-Job $script:refreshJob -Force -ErrorAction SilentlyContinue
    $script:refreshJob = $null
    return $false
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    Write-APILog "Refresh API baslatildi - port $port"
    Write-Host "SCCM Dashboard Refresh API dinleniyor: http://localhost:$port"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $origin       = $request.Headers["Origin"]
        $originOk     = Test-OriginAllowed $origin

        # CORS Headers — yalnizca izinli origin'e yanit ver ("*" degil)
        if ($origin -and $originOk) {
            $response.Headers.Add("Access-Control-Allow-Origin", $origin)
            $response.Headers.Add("Vary", "Origin")
        }
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Dashboard-Refresh")
        $response.Headers.Add("Access-Control-Max-Age", "600")
        $response.ContentType = "application/json; charset=utf-8"

        # OPTIONS preflight
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = if ($originOk) { 204 } else { 403 }
            $response.Close()
            continue
        }

        $path = $request.Url.AbsolutePath.TrimEnd('/')
        $body = ''

        # Izinsiz origin'den gelen her istegi reddet
        if (-not $originOk) {
            Write-APILog ("Reddedilen origin: " + $origin + " -> " + $path)
            $body = '{"status":"forbidden","message":"Origin izinli degil"}'
            $response.StatusCode = 403
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($body)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/refresh" -or $path -eq "/refresh") {
            # Sadece POST + ozel header: basit cross-site form POST'unu engeller (preflight zorunlu kilar)
            if ($request.HttpMethod -ne "POST") {
                $body = '{"status":"error","message":"POST bekleniyor"}'
                $response.StatusCode = 405
            }
            elseif (-not $request.Headers["X-Dashboard-Refresh"]) {
                Write-APILog "Refresh reddedildi: X-Dashboard-Refresh header eksik"
                $body = '{"status":"forbidden","message":"Gecersiz istek"}'
                $response.StatusCode = 403
            }
            elseif (Test-RefreshRunning) {
                $body = '{"status":"running","message":"Cache refresh zaten calisiyor"}'
                $response.StatusCode = 409
            } else {
                Write-APILog "Manuel cache refresh tetiklendi"
                try {
                    $script:refreshJob = Start-Job -ScriptBlock {
                        param($script, $cfg)
                        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $script -ConfigPath $cfg
                    } -ArgumentList $refreshScript, $ConfigPath

                    $body = '{"status":"started","message":"Cache refresh baslatildi"}'
                    $response.StatusCode = 200
                } catch {
                    $body = '{"status":"error","message":"' + $_.ToString().Replace('"','\"').Replace("`n",' ') + '"}'
                    $response.StatusCode = 500
                    Write-APILog ("Refresh hatasi: " + $_)
                }
            }
        }
        elseif ($path -eq "/api/status" -or $path -eq "/status") {
            # Return cache meta + sync status
            $metaFile = Join-Path $outputPath "_cache_meta.json"
            $syncFile = Join-Path $outputPath "_sync_status.json"
            $isRunning = Test-RefreshRunning

            if (Test-Path $syncFile) {
                $syncData = Get-Content $syncFile -Raw -Encoding UTF8
                $body = $syncData
            } elseif (Test-Path $metaFile) {
                $body = Get-Content $metaFile -Raw -Encoding UTF8
            } else {
                $body = '{"status":"no_data","message":"Henuz cache refresh calistirilmamis"}'
            }
            $response.StatusCode = 200
        }
        elseif ($path -eq "/api/health") {
            $isRunning = Test-RefreshRunning
            $body = '{"status":"ok","port":' + $port + ',"refreshRunning":' + ($isRunning.ToString().ToLower()) + ',"timestamp":"' + (Get-Date -Format "yyyy-MM-ddTHH:mm:ss") + '"}'
            $response.StatusCode = 200
        }
        else {
            $body = '{"error":"Not found","endpoints":["/api/refresh","/api/status","/api/health"]}'
            $response.StatusCode = 404
        }

        $buffer = [System.Text.Encoding]::UTF8.GetBytes($body)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.Close()
    }
} catch {
    Write-APILog ("API hatasi: " + $_)
    Write-Error $_
} finally {
    if ($script:refreshJob) {
        Stop-Job $script:refreshJob -ErrorAction SilentlyContinue
        Remove-Job $script:refreshJob -Force -ErrorAction SilentlyContinue
    }
    if ($listener) {
        $listener.Stop()
        $listener.Close()
        Write-APILog "Refresh API durduruldu"
    }
}
