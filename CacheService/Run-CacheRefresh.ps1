#Requires -Version 5.1
<#
.SYNOPSIS
    SCCM Dashboard Cache Refresh Service
.DESCRIPTION
    Reads SQL queries from the queries folder, executes them against the SCCM database,
    and writes results as JSON files to the Web/data folder.
    Writes incremental sync status so the dashboard can show live progress.
#>

[CmdletBinding()]
param(
    [string]$ConfigPath = "C:\SCCMDashboard\Config\config.json"
)

$ErrorActionPreference = "Continue"

# ── Load Configuration ──
try {
    $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
} catch {
    Write-Error ("Config dosyasi okunamadi - " + $ConfigPath + " - " + $_)
    exit 1
}

$SqlServer   = $config.sqlServer
$Database    = $config.database
$OutputPath  = $config.outputPath
$QueriesPath = $config.queriesPath
$LogPath     = $config.logPath

# ── Ayarlanabilir degerler (config'te yoksa varsayilan kullanilir) ──
function Get-ConfigValue {
    param($Config, [string]$Name, $Default)
    $prop = $Config.PSObject.Properties[$Name]
    if ($null -eq $prop -or $null -eq $prop.Value -or "$($prop.Value)" -eq "") { return $Default }
    return $prop.Value
}

$QueryTimeout       = [int](Get-ConfigValue $config "queryTimeoutSeconds"      300)
$ConnTimeout        = [int](Get-ConfigValue $config "connectionTimeoutSeconds"  30)
$LogRetentionDays   = [int](Get-ConfigValue $config "logRetentionDays"          30)
$HistoryRetention   = [int](Get-ConfigValue $config "historyRetentionDays"      90)
$StaleThresholdMin  = [int](Get-ConfigValue $config "staleThresholdMinutes"     90)
$AutoRefreshSeconds = [int](Get-ConfigValue $config "autoRefreshSeconds"       120)
$RefreshApiPort     = [int](Get-ConfigValue $config "refreshApiPort"          9091)
$RefreshIntervalMin = [int](Get-ConfigValue $config "refreshIntervalMinutes"    60)

# Thresholds path — config dizininden al (portable)
$configDir = Split-Path -Parent $ConfigPath
$ThresholdsSource = Join-Path $configDir "thresholds.json"
$ThresholdsDest   = Join-Path $OutputPath "_thresholds.json"

# Status files
$metaFile    = Join-Path $OutputPath "_cache_meta.json"
$syncFile    = Join-Path $OutputPath "_sync_status.json"
$publicCfg   = Join-Path $OutputPath "_config_public.json"
$historyFile = Join-Path $OutputPath "_history.json"

# ── Logging ──
$logDate = Get-Date -Format "yyyyMMdd"
$logFile = Join-Path $LogPath "cache_$logDate.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    if ($Level -eq "ERROR") { Write-Error $Message }
    elseif ($Level -eq "WARN") { Write-Warning $Message }
    else { Write-Host $line }
}

# ── Sync Status Writer (web'den canli izlenebilir) ──
function Write-SyncStatus {
    param(
        [string]$Phase,
        [string]$CurrentQuery,
        [int]$CompletedCount,
        [int]$TotalCount,
        [array]$QueryResults,
        [string]$ErrorMessage
    )
    $status = @{
        phase          = $Phase                                          # connecting | running | completed | error
        currentQuery   = $CurrentQuery
        completedCount = $CompletedCount
        totalCount     = $TotalCount
        progressPercent = if ($TotalCount -gt 0) { [math]::Round(($CompletedCount / $TotalCount) * 100, 0) } else { 0 }
        startTime      = $script:startTime.ToString("yyyy-MM-ddTHH:mm:ss")
        elapsedSeconds = [math]::Round(((Get-Date) - $script:startTime).TotalSeconds, 1)
        lastUpdate     = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        error          = $ErrorMessage
        queries        = $QueryResults | ForEach-Object {
            @{
                name     = $_.Name
                records  = $_.Records
                status   = $_.Status
                error    = $_.Error
                duration = $_.Duration
            }
        }
    }
    $json = $status | ConvertTo-Json -Depth 3 -Compress
    [System.IO.File]::WriteAllText($syncFile, $json, [System.Text.Encoding]::UTF8)
}

# ── Write Cache Meta (incremental — her sorgudan sonra guncellenir) ──
function Write-CacheMeta {
    param(
        [string]$Status,
        [array]$QueryResults
    )
    $meta = @{
        lastRefresh = $script:startTime.ToString("yyyy-MM-ddTHH:mm:ss")
        duration    = [math]::Round(((Get-Date) - $script:startTime).TotalSeconds, 1)
        status      = $Status
        queries     = $QueryResults | ForEach-Object {
            @{
                name     = $_.Name
                records  = $_.Records
                status   = $_.Status
                error    = $_.Error
                duration = $_.Duration
            }
        }
    }
    $json = $meta | ConvertTo-Json -Depth 3
    [System.IO.File]::WriteAllText($metaFile, $json, [System.Text.Encoding]::UTF8)
}

# ── Log Temizligi (retention) ──
function Remove-OldLogs {
    param([string]$Path, [int]$RetentionDays)
    if ($RetentionDays -le 0) { return }   # 0 veya negatif = temizleme kapali
    try {
        $cutoff = (Get-Date).AddDays(-$RetentionDays)
        $old = Get-ChildItem -Path $Path -Filter "*.log" -File -ErrorAction SilentlyContinue |
               Where-Object { $_.LastWriteTime -lt $cutoff }
        if ($old) {
            $count = ($old | Measure-Object).Count
            $old | Remove-Item -Force -ErrorAction SilentlyContinue
            Write-Log ("Eski log temizlendi - " + $count + " dosya (" + $RetentionDays + " gunden eski)")
        }
    } catch {
        Write-Log ("Log temizligi basarisiz - " + $_) "WARN"
    }
}

# ── Frontend'in okudugu public config (gizli alan icermez) ──
function Write-PublicConfig {
    $pub = @{
        refreshApiPort         = $RefreshApiPort
        refreshIntervalMinutes = $RefreshIntervalMin
        staleThresholdMinutes  = $StaleThresholdMin
        autoRefreshSeconds     = $AutoRefreshSeconds
        generatedAt            = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    }
    $json = $pub | ConvertTo-Json -Depth 2
    [System.IO.File]::WriteAllText($publicCfg, $json, [System.Text.Encoding]::UTF8)
}

# ── Trend Gecmisi ──
# Her refresh sonunda ozet metrikleri _history.json'a ekler (retention gunu kadar tutulur).
# PS 5.1'de "$raw | ConvertFrom-Json" bir JSON dizisini TEK bir Object[] ogesi olarak
# akitir; bu yuzden sonucu her zaman duzlestirmek gerekir.
function ConvertTo-FlatArray {
    param($Value)
    $out = [System.Collections.ArrayList]::new()
    if ($null -eq $Value) { return @() }
    foreach ($item in @($Value)) {
        if ($null -eq $item) { continue }
        if ($item -is [System.Array]) {
            foreach ($sub in $item) { if ($null -ne $sub) { [void]$out.Add($sub) } }
        } else {
            [void]$out.Add($item)
        }
    }
    return $out.ToArray()
}

function Read-DataJson {
    param([string]$Name)
    $f = Join-Path $OutputPath "$Name.json"
    if (!(Test-Path $f)) { return @() }
    try {
        $raw = Get-Content -Path $f -Raw -Encoding UTF8
        if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
        return ,(ConvertTo-FlatArray (ConvertFrom-Json -InputObject $raw))
    } catch {
        Write-Log ("History icin " + $Name + ".json okunamadi - " + $_) "WARN"
        return @()
    }
}

function Measure-Column {
    param($Rows, [string]$Column)
    $sum = 0
    foreach ($r in $Rows) {
        $p = $r.PSObject.Properties[$Column]
        if ($p -and $p.Value -ne $null) {
            $n = 0
            if ([double]::TryParse("$($p.Value)", [ref]$n)) { $sum += $n }
        }
    }
    return $sum
}

function Add-HistorySnapshot {
    try {
        $asset    = Read-DataJson "asset"
        $updates  = Read-DataJson "update_deployment"
        $apps     = Read-DataJson "app_deployment"
        $bitl     = Read-DataJson "bitlocker"
        $dbComp   = Read-DataJson "db_monitor"
        $alerts   = Read-DataJson "sccm_alerts"

        $totalDevices = ($asset | Measure-Object).Count
        $servers = @($asset | Where-Object { $_.DeviceType -eq 'Server' }).Count

        $activeCutoff = (Get-Date).AddDays(-30)
        $active = 0
        foreach ($d in $asset) {
            if ($d.LastActiveTime) {
                $dt = [datetime]::MinValue
                if ([datetime]::TryParse("$($d.LastActiveTime)", [ref]$dt) -and $dt -gt $activeCutoff) { $active++ }
            }
        }

        $installed = Measure-Column $updates "Installed"
        $target    = Measure-Column $updates "TotalDevices"
        $compliance = if ($target -gt 0) { [math]::Round(($installed / $target) * 100, 1) } else { 0 }

        # BitLocker: C: surucusu icin benzersiz cihaz sayisi
        $blTotal = @($bitl | Where-Object { $_.DriveLetter -eq 'C:' } |
                     Select-Object -ExpandProperty ResourceID -Unique).Count
        $blProt  = @($bitl | Where-Object { $_.DriveLetter -eq 'C:' -and $_.ProtectionStatus -eq 1 } |
                     Select-Object -ExpandProperty ResourceID -Unique).Count

        $snapshot = @{
            timestamp        = $script:startTime.ToString("yyyy-MM-ddTHH:mm:ss")
            totalDevices     = $totalDevices
            servers          = $servers
            workstations     = $totalDevices - $servers
            activeDevices    = $active
            staleDevices     = $totalDevices - $active
            updateCompliance = $compliance
            updateFailed     = [int](Measure-Column $updates "Failed")
            appFailed        = [int](Measure-Column $apps "Failed")
            bitlockerTotal   = $blTotal
            bitlockerProtected = $blProt
            componentErrors  = [int](Measure-Column $dbComp "Errors")
            alertCount       = ($alerts | Measure-Object).Count
            refreshDuration  = [math]::Round(((Get-Date) - $script:startTime).TotalSeconds, 1)
            queryErrors      = @($metaResults | Where-Object { $_.Status -eq "ERROR" }).Count
        }

        # Mevcut gecmisi oku
        $existing = @()
        if (Test-Path $historyFile) {
            try {
                $raw = Get-Content -Path $historyFile -Raw -Encoding UTF8
                if (-not [string]::IsNullOrWhiteSpace($raw)) {
                    $existing = ConvertTo-FlatArray (ConvertFrom-Json -InputObject $raw)
                }
            } catch {
                Write-Log "History dosyasi okunamadi, sifirdan olusturuluyor" "WARN"
                $existing = @()
            }
        }

        # Retention filtresi + yeni kaydi ekle (ArrayList: += ile tip bozulmasini onler)
        $keep = [System.Collections.ArrayList]::new()
        $cutoff = if ($HistoryRetention -gt 0) { (Get-Date).AddDays(-$HistoryRetention) } else { [datetime]::MinValue }

        foreach ($e in $existing) {
            # Bozuk/eksik kayitlari (ornegin timestamp'i olmayan) atla
            if ($null -eq $e -or -not $e.PSObject.Properties['timestamp']) { continue }
            $dt = [datetime]::MinValue
            if ([datetime]::TryParse("$($e.timestamp)", [ref]$dt) -and $dt -ge $cutoff) {
                [void]$keep.Add($e)
            }
        }
        [void]$keep.Add($snapshot)

        # Her kaydi ayri ayri serialize edip birlestir.
        # ConvertTo-Json'a diziyi butun halinde vermek ic ice sarmalama ("value"/"Count")
        # ve derinlik asimi (nesnenin string'e donmesi) sorunlarina yol aciyor.
        $parts = @($keep | ForEach-Object { $_ | ConvertTo-Json -Depth 3 -Compress })
        $json = "[" + ($parts -join ",") + "]"

        [System.IO.File]::WriteAllText($historyFile, $json, [System.Text.Encoding]::UTF8)
        Write-Log ("Trend gecmisi guncellendi - " + $keep.Count + " kayit")
    } catch {
        Write-Log ("Trend gecmisi yazilamadi - " + $_) "WARN"
    }
}

# Ensure output and log directories exist
if (!(Test-Path $OutputPath)) { New-Item -Path $OutputPath -ItemType Directory -Force | Out-Null }
if (!(Test-Path $LogPath))    { New-Item -Path $LogPath -ItemType Directory -Force | Out-Null }

$script:startTime = Get-Date

Write-Log "=== Cache refresh baslatiliyor ==="
Write-Log ("SQL Server = " + $SqlServer + " | Database = " + $Database)

Remove-OldLogs -Path $LogPath -RetentionDays $LogRetentionDays
Write-PublicConfig

# ── SQL Execution Function ──
function Invoke-SqlQueryToJson {
    param(
        [string]$QueryFile,
        [string]$OutputFile,
        [System.Data.SqlClient.SqlConnection]$Connection
    )

    $queryName = [System.IO.Path]::GetFileNameWithoutExtension($QueryFile)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Log ("Sorgu calistiriliyor - " + $queryName)

    try {
        $sql = Get-Content -Path $QueryFile -Raw -Encoding UTF8
        $cmd = New-Object System.Data.SqlClient.SqlCommand($sql, $Connection)
        $cmd.CommandTimeout = $QueryTimeout  # config: queryTimeoutSeconds

        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dataTable = New-Object System.Data.DataTable
        [void]$adapter.Fill($dataTable)

        # Convert DataTable to array of hashtables
        $rows = [System.Collections.ArrayList]::new()
        foreach ($row in $dataTable.Rows) {
            $obj = @{}
            foreach ($col in $dataTable.Columns) {
                $val = $row[$col.ColumnName]
                if ($val -is [DBNull]) { $val = $null }
                elseif ($val -is [DateTime]) { $val = $val.ToString("yyyy-MM-ddTHH:mm:ss") }
                $obj[$col.ColumnName] = $val
            }
            [void]$rows.Add($obj)
        }

        # Write JSON
        $json = $rows | ConvertTo-Json -Depth 5 -Compress
        if ($rows.Count -eq 0) { $json = "[]" }
        elseif ($rows.Count -eq 1) { $json = "[$json]" }

        [System.IO.File]::WriteAllText($OutputFile, $json, [System.Text.Encoding]::UTF8)

        $sw.Stop()
        $dur = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        $sizeKB = [math]::Round((Get-Item $OutputFile).Length / 1KB, 1)
        Write-Log ("  -> " + $queryName + ": " + $rows.Count + " kayit, " + $sizeKB + " KB (" + $dur + " sn)")
        return @{ Name = $queryName; Records = $rows.Count; Status = "OK"; Error = $null; Duration = $dur; SizeKB = $sizeKB }

    } catch {
        $sw.Stop()
        $errMsg = $_.ToString()
        Write-Log ("  -> " + $queryName + " HATA: " + $errMsg) "ERROR"
        return @{ Name = $queryName; Records = 0; Status = "ERROR"; Error = $errMsg; Duration = [math]::Round($sw.Elapsed.TotalSeconds, 2); SizeKB = 0 }
    } finally {
        if ($cmd) { $cmd.Dispose() }
        if ($adapter) { $adapter.Dispose() }
        if ($dataTable) { $dataTable.Dispose() }
    }
}

# ── Main Execution ──
$metaResults = @()
$overallStatus = "ok"

# Sync status: baslangic
Write-SyncStatus -Phase "connecting" -CurrentQuery "" -CompletedCount 0 -TotalCount 0 -QueryResults @() -ErrorMessage ""

try {
    # Open SQL connection (Windows Auth)
    $connStr = "Server=$SqlServer;Database=$Database;Integrated Security=True;Connection Timeout=$ConnTimeout;"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    Write-Log "SQL baglantisi acildi."

    # Process each .sql file
    $sqlFiles = Get-ChildItem -Path $QueriesPath -Filter "*.sql" | Sort-Object Name
    $totalQueries = $sqlFiles.Count
    $completedQueries = 0

    Write-SyncStatus -Phase "running" -CurrentQuery "" -CompletedCount 0 -TotalCount $totalQueries -QueryResults @() -ErrorMessage ""

    foreach ($sqlFile in $sqlFiles) {
        $outputName = $sqlFile.BaseName
        $outputFile = Join-Path $OutputPath "$outputName.json"

        # Sync status: bu sorgu calisiyor
        Write-SyncStatus -Phase "running" -CurrentQuery $outputName -CompletedCount $completedQueries -TotalCount $totalQueries -QueryResults $metaResults -ErrorMessage ""

        $result = Invoke-SqlQueryToJson -QueryFile $sqlFile.FullName -OutputFile $outputFile -Connection $conn
        $metaResults += $result
        $completedQueries++

        if ($result.Status -eq "ERROR") { $overallStatus = "partial_error" }

        # Incremental meta guncelle (her sorgudan sonra)
        Write-CacheMeta -Status $overallStatus -QueryResults $metaResults

        # Sync status guncelle
        Write-SyncStatus -Phase "running" -CurrentQuery "" -CompletedCount $completedQueries -TotalCount $totalQueries -QueryResults $metaResults -ErrorMessage ""
    }

    # Copy thresholds to web data folder
    if (Test-Path $ThresholdsSource) {
        Copy-Item -Path $ThresholdsSource -Destination $ThresholdsDest -Force
        Write-Log "Thresholds dosyasi kopyalandi"
    }

} catch {
    Write-Log ("Kritik hata - " + $_) "ERROR"
    $overallStatus = "error"
    Write-SyncStatus -Phase "error" -CurrentQuery "" -CompletedCount $completedQueries -TotalCount $totalQueries -QueryResults $metaResults -ErrorMessage $_.ToString()
} finally {
    if ($conn -and $conn.State -eq 'Open') {
        $conn.Close()
        $conn.Dispose()
        Write-Log "SQL baglantisi kapatildi"
    }
}

# ── Final Meta ──
Write-CacheMeta -Status $overallStatus -QueryResults $metaResults

# ── Trend gecmisine anlik goruntu ekle ──
Add-HistorySnapshot

# ── Sync status: tamamlandi ──
Write-SyncStatus -Phase "completed" -CurrentQuery "" -CompletedCount $completedQueries -TotalCount $totalQueries -QueryResults $metaResults -ErrorMessage ""

$totalDuration = [math]::Round(((Get-Date) - $script:startTime).TotalSeconds, 1)
Write-Log ("=== Cache refresh tamamlandi - " + $overallStatus + " (" + $totalDuration + " sn) ===")
Write-Log ("    Toplam sorgu: " + $totalQueries + " | Basarili: " + ($metaResults | Where-Object { $_.Status -eq "OK" }).Count + " | Hatali: " + ($metaResults | Where-Object { $_.Status -eq "ERROR" }).Count)

# ── Log ozeti (her sorgunun performansi) ──
Write-Log "--- Performans Ozeti ---"
foreach ($r in ($metaResults | Sort-Object Duration -Descending)) {
    $icon = if ($r.Status -eq "OK") { "OK" } else { "FAIL" }
    Write-Log ("  [$icon] " + $r.Name.PadRight(30) + " " + ('{0,8}' -f $r.Records) + " kayit  " + ('{0,8}' -f $r.Duration) + " sn  " + ('{0,8}' -f $r.SizeKB) + " KB")
}
Write-Log "------------------------"
