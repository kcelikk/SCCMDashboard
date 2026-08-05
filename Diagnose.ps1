#Requires -Version 5.1
<#
.SYNOPSIS
    SCCM Dashboard Diagnostik & Uyumluluk Kontrol Scripti
.DESCRIPTION
    Canli SCCM ortaminda dashboard'un saglikli calisip calisamayacagini kontrol eder.
    SQL baglantisi, view varlik kontrolu, sorgu testleri, config tutarliligi ve
    hardcoded deger tespiti yapar.
#>

[CmdletBinding()]
param(
    [string]$ConfigPath = "C:\SCCMDashboard\Config\config.json"
)

$ErrorActionPreference = "Continue"

# ── Renkli cikti fonksiyonlari ──
function Write-OK    { param($m) Write-Host "   [OK] $m" -ForegroundColor Green }
function Write-FAIL  { param($m) Write-Host "   [FAIL] $m" -ForegroundColor Red }
function Write-WARN  { param($m) Write-Host "   [WARN] $m" -ForegroundColor Yellow }
function Write-INFO  { param($m) Write-Host "   [INFO] $m" -ForegroundColor Cyan }
function Write-Step  { param($m) Write-Host "`n>> $m" -ForegroundColor White }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   SCCM Dashboard Diagnostik Raporu" -ForegroundColor Cyan
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# ══════════════════════════════════════════════
# 1. CONFIG KONTROLU
# ══════════════════════════════════════════════
Write-Step "1. Konfigurasyon Kontrolu"

if (!(Test-Path $ConfigPath)) {
    Write-FAIL "config.json bulunamadi: $ConfigPath"
    exit 1
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
Write-OK "config.json okundu"
Write-INFO "  sqlServer   = $($config.sqlServer)"
Write-INFO "  database    = $($config.database)"
Write-INFO "  outputPath  = $($config.outputPath)"
Write-INFO "  queriesPath = $($config.queriesPath)"

$Database = $config.database
$SqlServer = $config.sqlServer

# Dizin kontrolleri
if (Test-Path $config.outputPath) { Write-OK "outputPath mevcut" } else { Write-FAIL "outputPath bulunamadi: $($config.outputPath)" }
if (Test-Path $config.queriesPath) { Write-OK "queriesPath mevcut" } else { Write-FAIL "queriesPath bulunamadi: $($config.queriesPath)" }
if (Test-Path $config.logPath) { Write-OK "logPath mevcut" } else { Write-WARN "logPath bulunamadi (ilk calistirmada olusturulur): $($config.logPath)" }

# ══════════════════════════════════════════════
# 2. HARDCODED DEGER TESPITI
# ══════════════════════════════════════════════
Write-Step "2. Hardcoded Deger Tespiti (SQL dosyalari)"

$sqlFiles = Get-ChildItem -Path $config.queriesPath -Filter "*.sql" -ErrorAction SilentlyContinue
$hardcodedIssues = @()

foreach ($f in $sqlFiles) {
    $content = Get-Content $f.FullName -Raw
    # CM_ ile baslayan hardcoded DB adlari ara (config'deki DB haric genel pattern)
    $matches = [regex]::Matches($content, "CM_[A-Z0-9]+")
    foreach ($m in $matches) {
        $hardcodedIssues += [PSCustomObject]@{
            File  = $f.Name
            Value = $m.Value
            Line  = ($content.Substring(0, $m.Index) -split "`n").Count
        }
    }
}

if ($hardcodedIssues.Count -gt 0) {
    Write-WARN "Hardcoded DB referanslari bulundu:"
    foreach ($h in $hardcodedIssues) {
        $status = if ($h.Value -eq $Database) { "[ESLESIR]" } else { "[UYUMSUZ]" }
        Write-Host "     $status $($h.File):$($h.Line) -> $($h.Value)" -ForegroundColor $(if ($h.Value -eq $Database) { "Green" } else { "Red" })
    }
} else {
    Write-OK "Hardcoded DB referansi bulunamadi"
}

# ══════════════════════════════════════════════
# 3. SQL BAGLANTI TESTI
# ══════════════════════════════════════════════
Write-Step "3. SQL Server Baglanti Testi"

$conn = $null
try {
    $connStr = "Server=$SqlServer;Database=$Database;Integrated Security=True;Connection Timeout=15;"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    Write-OK "SQL baglantisi basarili ($SqlServer / $Database)"

    # Site Code kontrol
    try {
        $cmd = New-Object System.Data.SqlClient.SqlCommand("SELECT TOP 1 SiteCode FROM v_Site", $conn)
        $siteCode = $cmd.ExecuteScalar()
        Write-OK "Site Code: $siteCode"
        $cmd.Dispose()
    } catch {
        Write-WARN "Site code alinamadi: $_"
    }
} catch {
    Write-FAIL "SQL baglantisi basarisiz: $_"
    Write-Host "`n  Script SQL baglantisi olmadan devam edemiyor." -ForegroundColor Red
    exit 1
}

# ══════════════════════════════════════════════
# 4. VIEW / TABLO VARLIK KONTROLU
# ══════════════════════════════════════════════
Write-Step "4. Gerekli View/Tablo Varlik Kontrolu"

$requiredViews = @(
    # asset.sql
    "v_R_System", "v_GS_OPERATING_SYSTEM", "v_GS_COMPUTER_SYSTEM",
    "v_GS_NETWORK_ADAPTER_CONFIGURATION", "v_CH_ClientSummary",
    # client_pc.sql / server.sql
    "v_GS_PROCESSOR", "v_GS_X86_PC_MEMORY", "v_GS_LOGICAL_DISK",
    # update
    "v_CIAssignment", "v_CIAssignmentToCI", "v_UpdateComplianceStatus", "v_UpdateInfo",
    # app deployment
    "v_ApplicationAssignment", "vAppDeploymentAssetDetails",
    # app deployment pkg
    "v_Advertisement", "v_Collection", "v_Package", "v_Program", "v_ClientAdvertisementStatus",
    # app inventory
    "v_GS_ADD_REMOVE_PROGRAMS", "v_GS_ADD_REMOVE_PROGRAMS_64",
    # bitlocker
    "v_GS_ENCRYPTABLE_VOLUME", "v_GS_BITLOCKER_DETAILS",
    # cmg
    "v_CloudManagementGatewayInfo",
    # db monitor
    "v_ComponentSummarizer", "v_SiteSystemSummarizer"
)

# Tekrarlari kaldir
$requiredViews = $requiredViews | Select-Object -Unique

$viewResults = @()
foreach ($view in $requiredViews) {
    try {
        $sql = "SELECT OBJECT_ID('$view')"
        $cmd = New-Object System.Data.SqlClient.SqlCommand($sql, $conn)
        $result = $cmd.ExecuteScalar()
        $cmd.Dispose()

        if ($null -eq $result -or $result -is [DBNull]) {
            Write-FAIL "$view bulunamadi"
            $viewResults += [PSCustomObject]@{ View = $view; Exists = $false }
        } else {
            Write-OK "$view mevcut"
            $viewResults += [PSCustomObject]@{ View = $view; Exists = $true }
        }
    } catch {
        Write-FAIL "$view kontrol hatasi: $_"
        $viewResults += [PSCustomObject]@{ View = $view; Exists = $false }
    }
}

$missingViews = $viewResults | Where-Object { -not $_.Exists }

# ══════════════════════════════════════════════
# 5. KOLON VARLIK KONTROLU (kritik kolonlar)
# ══════════════════════════════════════════════
Write-Step "5. Kritik Kolon Varlik Kontrolu"

$columnChecks = @(
    @{ View = "v_R_System"; Column = "InternetEnabled0" },
    @{ View = "v_R_System"; Column = "AlwaysInternet0" },
    @{ View = "v_R_System"; Column = "ManagementAuthority" },
    @{ View = "v_R_System"; Column = "Is_Virtual_Machine0" },
    @{ View = "v_R_System"; Column = "Distinguished_Name0" },
    @{ View = "v_GS_BITLOCKER_DETAILS"; Column = "Compliant0" },
    @{ View = "v_GS_BITLOCKER_DETAILS"; Column = "KeyProtectorTypes0" },
    @{ View = "v_GS_BITLOCKER_DETAILS"; Column = "ConversionStatus0" },
    @{ View = "v_GS_BITLOCKER_DETAILS"; Column = "EncryptionMethod0" },
    @{ View = "v_CH_ClientSummary"; Column = "IsActiveDDR" },
    @{ View = "v_CH_ClientSummary"; Column = "IsActiveHW" },
    @{ View = "v_CH_ClientSummary"; Column = "IsActiveSW" },
    @{ View = "v_CH_ClientSummary"; Column = "ClientStateDescription" },
    @{ View = "v_CloudManagementGatewayInfo"; Column = "StorageUsage" },
    @{ View = "v_CloudManagementGatewayInfo"; Column = "TrafficOutUsage" },
    @{ View = "v_CloudManagementGatewayInfo"; Column = "NetworkOutUsage" }
)

$missingColumns = @()
foreach ($check in $columnChecks) {
    # View yoksa kolon kontrolu atla
    $viewExists = ($viewResults | Where-Object { $_.View -eq $check.View -and $_.Exists }).Count -gt 0
    if (-not $viewExists) {
        Write-WARN "$($check.View).$($check.Column) - view mevcut degil, atlanıyor"
        $missingColumns += [PSCustomObject]@{ View = $check.View; Column = $check.Column; Reason = "view_missing" }
        continue
    }

    try {
        $sql = "SELECT TOP 0 [$($check.Column)] FROM $($check.View)"
        $cmd = New-Object System.Data.SqlClient.SqlCommand($sql, $conn)
        [void]$cmd.ExecuteNonQuery()
        $cmd.Dispose()
        Write-OK "$($check.View).$($check.Column)"
    } catch {
        Write-FAIL "$($check.View).$($check.Column) bulunamadi"
        $missingColumns += [PSCustomObject]@{ View = $check.View; Column = $check.Column; Reason = "column_missing" }
    }
}

# ══════════════════════════════════════════════
# 6. SORGU CALISTIRMA TESTI
# ══════════════════════════════════════════════
Write-Step "6. Sorgu Calistirma Testi (her SQL dosyasi)"

$queryResults = @()

foreach ($sqlFile in $sqlFiles) {
    $queryName = $sqlFile.BaseName
    $sqlText = Get-Content $sqlFile.FullName -Raw -Encoding UTF8

    try {
        $cmd = New-Object System.Data.SqlClient.SqlCommand($sqlText, $conn)
        $cmd.CommandTimeout = 30

        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        [void]$adapter.Fill($dt)

        $rowCount = $dt.Rows.Count
        Write-OK "$queryName -> $rowCount kayit"
        $queryResults += [PSCustomObject]@{ Query = $queryName; Status = "OK"; Rows = $rowCount; Error = "" }

        $dt.Dispose()
        $adapter.Dispose()
        $cmd.Dispose()
    } catch {
        $errMsg = $_.Exception.Message
        # Kisa hata mesaji
        if ($errMsg.Length -gt 120) { $errMsg = $errMsg.Substring(0, 120) + "..." }
        Write-FAIL "$queryName -> $errMsg"
        $queryResults += [PSCustomObject]@{ Query = $queryName; Status = "FAIL"; Rows = 0; Error = $errMsg }
    }
}

# ══════════════════════════════════════════════
# 7. MEVCUT DATA DOSYALARI
# ══════════════════════════════════════════════
Write-Step "7. Mevcut Data Dosyalari Kontrolu"

$dataPath = $config.outputPath
if (Test-Path $dataPath) {
    $dataFiles = Get-ChildItem -Path $dataPath -Filter "*.json"
    if ($dataFiles.Count -gt 0) {
        foreach ($df in $dataFiles) {
            $age = [math]::Round(((Get-Date) - $df.LastWriteTime).TotalMinutes, 0)
            $sizeKB = [math]::Round($df.Length / 1KB, 1)
            $ageColor = if ($age -gt 120) { "Red" } elseif ($age -gt 90) { "Yellow" } else { "Green" }
            Write-Host "   $($df.Name.PadRight(35)) ${sizeKB}KB   (${age} dk once)" -ForegroundColor $ageColor
        }
    } else {
        Write-WARN "Data klasorunde JSON dosyasi yok"
    }
} else {
    Write-FAIL "Data klasoru bulunamadi: $dataPath"
}

# ══════════════════════════════════════════════
# 8. CACHE META KONTROLU
# ══════════════════════════════════════════════
Write-Step "8. Cache Meta Kontrolu"

$metaFile = Join-Path $dataPath "_cache_meta.json"
if (Test-Path $metaFile) {
    $meta = Get-Content $metaFile -Raw | ConvertFrom-Json
    Write-INFO "Son refresh : $($meta.lastRefresh)"
    Write-INFO "Durum       : $($meta.status)"
    Write-INFO "Sure        : $($meta.duration) sn"
    if ($meta.queries) {
        $errorQueries = $meta.queries | Where-Object { $_.status -eq "ERROR" }
        if ($errorQueries) {
            Write-WARN "Hatali sorgular:"
            foreach ($eq in $errorQueries) {
                Write-Host "     $($eq.name): $($eq.error)" -ForegroundColor Red
            }
        } else {
            Write-OK "Tum sorgular basarili"
        }
    }
} else {
    Write-WARN "_cache_meta.json bulunamadi (henuz cache refresh calistirilmamis olabilir)"
}

# ══════════════════════════════════════════════
# 9. SCHEDULED TASK KONTROLU
# ══════════════════════════════════════════════
Write-Step "9. Scheduled Task Kontrolu"

$task = Get-ScheduledTask -TaskName "SCCMDashboard-CacheRefresh" -ErrorAction SilentlyContinue
if ($task) {
    Write-OK "Task mevcut: $($task.TaskName)"
    Write-INFO "  Durum     : $($task.State)"
    $taskInfo = Get-ScheduledTaskInfo -TaskName "SCCMDashboard-CacheRefresh" -ErrorAction SilentlyContinue
    if ($taskInfo) {
        Write-INFO "  Son calisma  : $($taskInfo.LastRunTime)"
        Write-INFO "  Son sonuc    : $($taskInfo.LastTaskResult)"
        Write-INFO "  Sonraki calisma: $($taskInfo.NextRunTime)"
    }
} else {
    Write-FAIL "Scheduled Task bulunamadi"
}

# ══════════════════════════════════════════════
# 10. IIS KONTROLU
# ══════════════════════════════════════════════
Write-Step "10. IIS Site Kontrolu"

try {
    Import-Module WebAdministration -ErrorAction Stop
    $site = Get-Website -Name "SCCMDashboard" -ErrorAction SilentlyContinue
    if ($site) {
        Write-OK "IIS Site mevcut"
        Write-INFO "  Durum    : $($site.State)"
        Write-INFO "  Port     : $(($site.Bindings.Collection | Select-Object -First 1).bindingInformation)"
        Write-INFO "  Path     : $($site.PhysicalPath)"
    } else {
        Write-FAIL "SCCMDashboard IIS sitesi bulunamadi"
    }
} catch {
    Write-WARN "WebAdministration modulu yuklenemedi: $_"
}

# ══════════════════════════════════════════════
# OZET RAPOR
# ══════════════════════════════════════════════
if ($conn -and $conn.State -eq 'Open') {
    $conn.Close()
    $conn.Dispose()
}

$failedQueries = $queryResults | Where-Object { $_.Status -eq "FAIL" }
$passedQueries = $queryResults | Where-Object { $_.Status -eq "OK" }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   OZET RAPOR" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Toplam SQL sorgusu   : $($queryResults.Count)" -ForegroundColor White
Write-Host "  Basarili             : $($passedQueries.Count)" -ForegroundColor Green
Write-Host "  Basarisiz            : $($failedQueries.Count)" -ForegroundColor $(if ($failedQueries.Count -gt 0) { "Red" } else { "Green" })
Write-Host "  Eksik View/Tablo     : $($missingViews.Count)" -ForegroundColor $(if ($missingViews.Count -gt 0) { "Red" } else { "Green" })
Write-Host "  Eksik Kolon          : $(($missingColumns | Where-Object { $_.Reason -eq 'column_missing' }).Count)" -ForegroundColor $(if (($missingColumns | Where-Object { $_.Reason -eq 'column_missing' }).Count -gt 0) { "Yellow" } else { "Green" })

if ($hardcodedIssues | Where-Object { $_.Value -ne $Database }) {
    $badHardcoded = ($hardcodedIssues | Where-Object { $_.Value -ne $Database })
    Write-Host "  Uyumsuz Hardcoded    : $($badHardcoded.Count)" -ForegroundColor Red
}

Write-Host ""

if ($failedQueries.Count -gt 0) {
    Write-Host "  BASARISIZ SORGULAR:" -ForegroundColor Red
    foreach ($fq in $failedQueries) {
        Write-Host "    - $($fq.Query): $($fq.Error)" -ForegroundColor Red
    }
    Write-Host ""
}

if ($missingViews.Count -gt 0) {
    Write-Host "  EKSIK VIEW'LAR:" -ForegroundColor Red
    foreach ($mv in $missingViews) {
        Write-Host "    - $($mv.View)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "  Rapor tamamlandi. Ciktiyi Claude'a yapistirin." -ForegroundColor Yellow
Write-Host ""
