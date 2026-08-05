#Requires -Version 5.1
<#
.SYNOPSIS
    SCCM Dashboard - Kapsamli Veri ve Sorgu Audit Scripti
.DESCRIPTION
    Canli SCCM veritabanina baglanarak mevcut SQL sorgularinin dogru veri donup
    donmedigini kontrol eder, eksikleri ve hatalari raporlar.
#>

[CmdletBinding()]
param(
    [string]$ConfigPath = "C:\SCCMDashboard\Config\config.json"
)

$ErrorActionPreference = "Continue"

function Write-Section { param($m) Write-Host "`n$('=' * 60)" -ForegroundColor Cyan; Write-Host "  $m" -ForegroundColor Cyan; Write-Host "$('=' * 60)" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-FAIL { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Write-WARN { param($m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-INFO { param($m) Write-Host "  [INFO] $m" -ForegroundColor White }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   SCCM Dashboard Veri Audit Raporu" -ForegroundColor Cyan
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Config
try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $SqlServer = $config.sqlServer
    $Database  = $config.database
    Write-OK "Config: $SqlServer / $Database"
} catch {
    Write-FAIL "Config okunamadi: $_"
    exit 1
}

# SQL Connection
$connStr = "Server=$SqlServer;Database=$Database;Integrated Security=True;Connection Timeout=15;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
try { $conn.Open(); Write-OK "SQL baglantisi acildi" } catch { Write-FAIL "SQL hatasi: $_"; exit 1 }

function Run-Query {
    param([string]$Sql, [int]$Timeout = 60)
    $cmd = New-Object System.Data.SqlClient.SqlCommand($Sql, $conn)
    $cmd.CommandTimeout = $Timeout
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    [void]$adapter.Fill($dt)
    $cmd.Dispose(); $adapter.Dispose()
    return $dt
}

# ══════════════════════════════════════════════
# 1. SCCM ORTAM BILGISI
# ══════════════════════════════════════════════
Write-Section "1. SCCM Ortam Bilgisi"

$siteInfo = Run-Query "SELECT SiteCode, SiteName, BuildNumber, Type FROM v_Site"
foreach ($row in $siteInfo.Rows) {
    Write-INFO "Site Code  : $($row.SiteCode)"
    Write-INFO "Site Name  : $($row.SiteName)"
    Write-INFO "Build      : $($row.BuildNumber)"
    $siteType = switch ([int]$row.Type) { 1 { "Primary" } 2 { "Secondary" } 4 { "CAS" } default { $row.Type } }
    Write-INFO "Type       : $siteType"
}

$sqlDbInfo = @"
SELECT DB_NAME() AS DB, SUM(size*8/1024) AS SizeMB
FROM sys.database_files
"@
$dbInfo = Run-Query $sqlDbInfo
Write-INFO "Database   : $($dbInfo.Rows[0].DB) ($($dbInfo.Rows[0].SizeMB) MB)"

# ══════════════════════════════════════════════
# 2. CIHAZ SAYILARI
# ══════════════════════════════════════════════
Write-Section "2. Cihaz Envanteri Kontrolu"

$sqlDevices = @"
SELECT
    COUNT(*) AS Total,
    SUM(CASE WHEN Client0 = 1 THEN 1 ELSE 0 END) AS WithClient,
    SUM(CASE WHEN Client0 = 1 AND Operating_System_Name_and0 LIKE '%Server%' THEN 1 ELSE 0 END) AS Servers,
    SUM(CASE WHEN Client0 = 1 AND Operating_System_Name_and0 NOT LIKE '%Server%' THEN 1 ELSE 0 END) AS Workstations,
    SUM(CASE WHEN Client0 = 0 OR Client0 IS NULL THEN 1 ELSE 0 END) AS NoClient,
    SUM(CASE WHEN Obsolete0 = 1 THEN 1 ELSE 0 END) AS Obsolete
FROM v_R_System
WHERE Name0 IS NOT NULL
"@
$deviceCounts = Run-Query $sqlDevices
$dc = $deviceCounts.Rows[0]
Write-INFO "Toplam kayit    : $($dc.Total)"
Write-INFO "Client kurulu   : $($dc.WithClient)"
Write-INFO "Server          : $($dc.Servers)"
Write-INFO "Workstation     : $($dc.Workstations)"
Write-INFO "Client yok      : $($dc.NoClient)"
Write-INFO "Obsolete        : $($dc.Obsolete)"

$dashAsset = Run-Query "SELECT COUNT(*) AS C FROM v_R_System WHERE Client0 = 1 OR Name0 IS NOT NULL"
Write-INFO "Dashboard asset sorgusu: $($dashAsset.Rows[0].C) kayit"

if ([int]$dc.Obsolete -gt 0) {
    Write-WARN "Obsolete cihazlar dahil ediliyor. Oneri: WHERE Obsolete0 != 1 filtresi eklenebilir"
}

# ══════════════════════════════════════════════
# 3. UPDATE DEPLOYMENT — KRITIK SORUN ANALIZI
# ══════════════════════════════════════════════
Write-Section "3. Update Deployment Analizi (Compliance %370 Sorunu)"

# 3a. AssignmentType dagilimi
Write-INFO "--- AssignmentType Dagilimi ---"
$sqlAssignTypes = @"
SELECT AssignmentType, COUNT(*) AS Cnt
FROM v_CIAssignment
GROUP BY AssignmentType
ORDER BY AssignmentType
"@
$assignTypes = Run-Query $sqlAssignTypes
foreach ($row in $assignTypes.Rows) {
    $label = switch ([int]$row.AssignmentType) {
        0 { "DCM Baseline" } 1 { "Software Update" } 2 { "Software Distribution" }
        5 { "Update Group" } 8 { "Update Group (ADR)" } default { "Diger ($($row.AssignmentType))" }
    }
    Write-INFO "  Type $($row.AssignmentType) ($label): $($row.Cnt) adet"
}

# 3b. Mevcut sorgunun dondukleri — RAW vs DISTINCT karsilastirma
Write-INFO ""
Write-INFO "--- Mevcut Sorgu Sonuclari (SUM vs COUNT DISTINCT karsilastirma) ---"
$sqlCurrentQuery = @"
SELECT
    a.AssignmentID,
    a.AssignmentName,
    a.AssignmentType,
    a.CollectionName,
    COUNT(DISTINCT ucs.ResourceID) AS TotalDevices,
    SUM(CASE WHEN ucs.Status = 3 THEN 1 ELSE 0 END) AS Installed_RAW,
    COUNT(DISTINCT CASE WHEN ucs.Status = 3 THEN ucs.ResourceID END) AS Installed_DISTINCT,
    SUM(CASE WHEN ucs.Status = 2 THEN 1 ELSE 0 END) AS Required_RAW,
    COUNT(DISTINCT CASE WHEN ucs.Status = 2 THEN ucs.ResourceID END) AS Required_DISTINCT,
    SUM(CASE WHEN ucs.Status NOT IN (0,2,3) THEN 1 ELSE 0 END) AS Failed_RAW,
    COUNT(DISTINCT CASE WHEN ucs.Status NOT IN (0,2,3) THEN ucs.ResourceID END) AS Failed_DISTINCT,
    COUNT(DISTINCT ac.CI_ID) AS UpdateCount
FROM v_CIAssignment a
JOIN v_CIAssignmentToCI ac ON a.AssignmentID = ac.AssignmentID
JOIN v_UpdateComplianceStatus ucs ON ac.CI_ID = ucs.CI_ID
WHERE a.AssignmentType IN (1,5)
GROUP BY a.AssignmentID, a.AssignmentName, a.AssignmentType, a.CollectionName
ORDER BY a.AssignmentName
"@
$currentQuery = Run-Query $sqlCurrentQuery

foreach ($row in $currentQuery.Rows) {
    $rawPct = if ([int]$row.TotalDevices -gt 0) { [math]::Round(([int]$row.Installed_RAW / [int]$row.TotalDevices) * 100, 1) } else { 0 }
    $distinctPct = if ([int]$row.TotalDevices -gt 0) { [math]::Round(([int]$row.Installed_DISTINCT / [int]$row.TotalDevices) * 100, 1) } else { 0 }
    Write-INFO ""
    Write-INFO "  [$($row.AssignmentType)] $($row.AssignmentName)"
    Write-INFO "       Collection: $($row.CollectionName)"
    Write-INFO "       Updates in group: $($row.UpdateCount) | Target Devices: $($row.TotalDevices)"
    Write-INFO "       Installed  - RAW(SUM): $($row.Installed_RAW) ($rawPct%) | DISTINCT: $($row.Installed_DISTINCT) ($distinctPct%)"
    Write-INFO "       Required   - RAW(SUM): $($row.Required_RAW) | DISTINCT: $($row.Required_DISTINCT)"
    Write-INFO "       Failed     - RAW(SUM): $($row.Failed_RAW) | DISTINCT: $($row.Failed_DISTINCT)"
    if ($rawPct -gt 100) {
        Write-FAIL "       >>> Compliance $rawPct% > 100%! SUM yerine COUNT DISTINCT kullanilmali <<<"
    }
}

# 3c. Tum update deployment listesi (AssignmentType filtresi genisletilmis)
Write-INFO ""
Write-INFO "--- TUM Update Deployments (Type 1,5,8) ---"
$sqlAllDeploy = @"
SELECT
    a.AssignmentID,
    a.AssignmentName,
    a.AssignmentType,
    a.CollectionName,
    a.StartTime,
    a.Enabled
FROM v_CIAssignment a
WHERE a.AssignmentType IN (1,5,8)
ORDER BY a.StartTime DESC
"@
$allUpdDeploy = Run-Query $sqlAllDeploy

Write-INFO "  Toplam: $($allUpdDeploy.Rows.Count) deployment"
foreach ($row in $allUpdDeploy.Rows) {
    $enabled = if ($row.Enabled) { "Aktif" } else { "Pasif" }
    $startDate = if ($row.StartTime -and $row.StartTime -isnot [DBNull]) { $row.StartTime.ToString('yyyy-MM-dd') } else { "-" }
    Write-INFO "  [$($row.AssignmentType)] [$enabled] $startDate | $($row.AssignmentName) | $($row.CollectionName)"
}

# 3d. ADR kontrol
Write-INFO ""
Write-INFO "--- ADR (Automatic Deployment Rules) ---"
try {
    $sqlADR = "SELECT RuleID, Name, IsEnabled, LastRunTime, LastErrorCode, CollectionName FROM vSMS_AutoDeployments ORDER BY Name"
    $adrs = Run-Query $sqlADR
    if ($adrs.Rows.Count -eq 0) {
        Write-WARN "ADR tablosu bos"
    } else {
        foreach ($row in $adrs.Rows) {
            $status = if ($row.IsEnabled) { "Aktif" } else { "Pasif" }
            $lastRun = if ($row.LastRunTime -and $row.LastRunTime -isnot [DBNull]) { $row.LastRunTime.ToString("yyyy-MM-dd HH:mm") } else { "Hic" }
            Write-INFO "  $($row.Name) | $status | Son: $lastRun | Collection: $($row.CollectionName)"
        }
    }
} catch {
    Write-WARN "vSMS_AutoDeployments erisilemedi, alternatif deneniyor..."
    try {
        $sqlADR2 = "SELECT DISTINCT Name, IsEnabled, LastRunTime FROM v_AutoDeploymentRules ORDER BY Name"
        $adrs2 = Run-Query $sqlADR2
        foreach ($row in $adrs2.Rows) { Write-INFO "  $($row.Name) | Enabled: $($row.IsEnabled)" }
    } catch {
        Write-WARN "ADR view bulunamadi. Sadece v_CIAssignment bazli liste gosteriliyor."
    }
}

# ══════════════════════════════════════════════
# 4. APP DEPLOYMENT KONTROLU
# ══════════════════════════════════════════════
Write-Section "4. App Deployment Kontrolu"

$appDeploy = Run-Query "SELECT COUNT(*) AS C FROM v_ApplicationAssignment"
Write-INFO "Application Model deployments: $($appDeploy.Rows[0].C)"

$pkgDeploy = Run-Query "SELECT COUNT(*) AS C FROM v_Advertisement"
Write-INFO "Package/Program deployments  : $($pkgDeploy.Rows[0].C)"

$sqlDashApp = @"
SELECT COUNT(DISTINCT aa.AssignmentID) AS C
FROM v_ApplicationAssignment aa
LEFT JOIN vAppDeploymentAssetDetails ad ON aa.AssignmentID = ad.AssignmentID
"@
$dashApp = Run-Query $sqlDashApp
Write-INFO "Dashboard app_deployment     : $($dashApp.Rows[0].C) deployment"

if ([int]$dashApp.Rows[0].C -ne [int]$appDeploy.Rows[0].C) {
    Write-WARN "Sayilar farki var: Dashboard $($dashApp.Rows[0].C) vs gercek $($appDeploy.Rows[0].C)"
}

# ══════════════════════════════════════════════
# 5. BITLOCKER KONTROLU
# ══════════════════════════════════════════════
Write-Section "5. BitLocker Kontrolu"

$blTotal = Run-Query "SELECT COUNT(DISTINCT ResourceID) AS C FROM v_GS_ENCRYPTABLE_VOLUME WHERE DriveLetter0 IS NOT NULL"
$blProtected = Run-Query "SELECT COUNT(DISTINCT ResourceID) AS C FROM v_GS_ENCRYPTABLE_VOLUME WHERE ProtectionStatus0 = 1 AND DriveLetter0 = 'C:'"
Write-INFO "BitLocker veri olan cihaz : $($blTotal.Rows[0].C)"
Write-INFO "C: korumali               : $($blProtected.Rows[0].C)"

$sqlDashBL = @"
SELECT COUNT(*) AS Total,
    SUM(CASE WHEN ev.ProtectionStatus0 = 1 THEN 1 ELSE 0 END) AS Protected
FROM v_R_System s
LEFT JOIN v_GS_ENCRYPTABLE_VOLUME ev ON s.ResourceID = ev.ResourceID
LEFT JOIN v_GS_BITLOCKER_DETAILS bd ON s.ResourceID = bd.ResourceID
WHERE ev.DriveLetter0 IS NOT NULL
"@
$dashBL = Run-Query $sqlDashBL
$blTotalDash = $dashBL.Rows[0].Total
$blProtDash = $dashBL.Rows[0].Protected
Write-INFO "Dashboard sorgusu          : $blTotalDash satir ($blProtDash korumali)"

if ([int]$blTotalDash -gt [int]$blTotal.Rows[0].C * 2) {
    Write-WARN "Cok fazla satir - birden fazla DriveLetter veya JOIN duplikasyonu olabilir"
}

# ══════════════════════════════════════════════
# 6. CMG KONTROLU
# ══════════════════════════════════════════════
Write-Section "6. CMG Kontrolu"

try {
    $cmg = Run-Query "SELECT * FROM v_CloudManagementGatewayInfo"
    Write-INFO "CMG kayit sayisi: $($cmg.Rows.Count)"
    foreach ($row in $cmg.Rows) {
        Write-INFO "  CNAME: $($row.ServiceCName) | State: $($row.State)"
    }
} catch {
    Write-WARN "CMG view erisilemedi"
}

Write-INFO ""
Write-INFO "--- CMG Client Kolonlari ---"
foreach ($col in @("InternetEnabled0", "AlwaysInternet0", "ManagementAuthority")) {
    try {
        Run-Query "SELECT TOP 1 [$col] FROM v_R_System" | Out-Null
        Write-OK "v_R_System.$col mevcut"
    } catch {
        Write-FAIL "v_R_System.$col BULUNAMADI"
    }
}

# ══════════════════════════════════════════════
# 7. DB MONITOR KONTROLU
# ══════════════════════════════════════════════
Write-Section "7. DB Monitor Kontrolu"

$sqlComp = @"
SELECT
    SUM(CASE WHEN Errors > 0 THEN 1 ELSE 0 END) AS WithErrors,
    SUM(Errors) AS TotalErrors,
    SUM(Warnings) AS TotalWarnings,
    COUNT(*) AS TotalComponents
FROM v_ComponentSummarizer
"@
$compStatus = Run-Query $sqlComp
Write-INFO "Toplam component : $($compStatus.Rows[0].TotalComponents)"
Write-INFO "Hatali component : $($compStatus.Rows[0].WithErrors)"
Write-INFO "Toplam error     : $($compStatus.Rows[0].TotalErrors)"
Write-INFO "Toplam warning   : $($compStatus.Rows[0].TotalWarnings)"

$sqlBackup = @"
SELECT bs.database_name, bs.type,
    MAX(bs.backup_finish_date) AS LastBackup,
    DATEDIFF(HOUR, MAX(bs.backup_finish_date), GETDATE()) AS HoursAgo
FROM msdb.dbo.backupset bs
WHERE bs.database_name = DB_NAME()
GROUP BY bs.database_name, bs.type
"@
try {
    $backup = Run-Query $sqlBackup
    if ($backup.Rows.Count -eq 0) {
        Write-WARN "Bu DB icin backup kaydi bulunamadi"
    } else {
        foreach ($row in $backup.Rows) {
            $typeLabel = switch ($row.type) { "D" { "Full" } "I" { "Diff" } "L" { "Log" } default { $row.type } }
            Write-INFO "  $typeLabel backup: $($row.LastBackup) ($($row.HoursAgo) saat once)"
        }
    }
} catch { Write-WARN "Backup bilgisi alinamadi: $_" }

# ══════════════════════════════════════════════
# 8. VERI HACMI VE PERFORMANS
# ══════════════════════════════════════════════
Write-Section "8. Veri Hacmi ve Performans"

$volChecks = @(
    @{ Name = "asset"; Sql = "SELECT COUNT(*) AS C FROM v_R_System WHERE Client0 = 1 OR Name0 IS NOT NULL" }
    @{ Name = "client_pc"; Sql = "SELECT COUNT(*) AS C FROM v_R_System WHERE Operating_System_Name_and0 NOT LIKE '%Server%' AND Name0 IS NOT NULL" }
    @{ Name = "server"; Sql = "SELECT COUNT(*) AS C FROM v_R_System WHERE Operating_System_Name_and0 LIKE '%Server%' AND Name0 IS NOT NULL" }
    @{ Name = "app_deployment_detail"; Sql = "SELECT COUNT(*) AS C FROM vAppDeploymentAssetDetails" }
    @{ Name = "bitlocker"; Sql = "SELECT COUNT(*) AS C FROM v_GS_ENCRYPTABLE_VOLUME WHERE DriveLetter0 IS NOT NULL" }
)

Write-INFO ("{0,-30} {1,12}" -f "Sorgu", "Kayit Sayisi")
Write-INFO ("{0,-30} {1,12}" -f "-----", "-----------")

foreach ($v in $volChecks) {
    try {
        $result = Run-Query $v.Sql
        $count = [int]$result.Rows[0].C
        $flag = if ($count -gt 100000) { " << BUYUK" } elseif ($count -gt 50000) { " << ORTA" } else { "" }
        Write-INFO ("{0,-30} {1,12:N0}{2}" -f $v.Name, $count, $flag)
    } catch {
        Write-FAIL ("{0,-30} HATA" -f $v.Name)
    }
}

# app_inventory_detail (en buyuk potansiyel)
try {
    $sqlAppInvDetail = @"
SELECT COUNT(*) AS C FROM (
    SELECT ResourceID, DisplayName0 FROM v_GS_ADD_REMOVE_PROGRAMS WHERE DisplayName0 IS NOT NULL
    UNION ALL
    SELECT ResourceID, DisplayName0 FROM v_GS_ADD_REMOVE_PROGRAMS_64 WHERE DisplayName0 IS NOT NULL
) x
"@
    $appInvDetail = Run-Query $sqlAppInvDetail
    $count = [int]$appInvDetail.Rows[0].C
    $flag = if ($count -gt 100000) { " << BUYUK" } elseif ($count -gt 50000) { " << ORTA" } else { "" }
    Write-INFO ("{0,-30} {1,12:N0}{2}" -f "app_inventory_detail", $count, $flag)
} catch { Write-FAIL "app_inventory_detail HATA" }

# update_deployment_detail
try {
    $sqlUpdDetail = @"
SELECT COUNT(*) AS C
FROM v_CIAssignment a
JOIN v_CIAssignmentToCI ac ON a.AssignmentID = ac.AssignmentID
JOIN v_UpdateComplianceStatus ucs ON ac.CI_ID = ucs.CI_ID
WHERE a.AssignmentType IN (1,5)
"@
    $updDetail = Run-Query $sqlUpdDetail
    $count = [int]$updDetail.Rows[0].C
    $flag = if ($count -gt 100000) { " << BUYUK" } elseif ($count -gt 50000) { " << ORTA" } else { "" }
    Write-INFO ("{0,-30} {1,12:N0}{2}" -f "update_deployment_detail", $count, $flag)
} catch { Write-FAIL "update_deployment_detail HATA" }

# ══════════════════════════════════════════════
# 9. JSON DOSYALARI
# ══════════════════════════════════════════════
Write-Section "9. Mevcut JSON Dosyalari"

$dataPath = $config.outputPath
if (Test-Path $dataPath) {
    $files = Get-ChildItem $dataPath -Filter "*.json" | Sort-Object Name
    Write-INFO ("{0,-35} {1,10} {2,10} {3}" -f "Dosya", "Boyut", "Yas(dk)", "Durum")
    Write-INFO ("{0,-35} {1,10} {2,10} {3}" -f "-----", "------", "-------", "-----")
    foreach ($f in $files) {
        $age = [math]::Round(((Get-Date) - $f.LastWriteTime).TotalMinutes, 0)
        $sizeKB = "{0:N1} KB" -f ($f.Length / 1KB)
        $status = if ($f.Length -eq 0) { "BOS!" } elseif ($age -gt 120) { "ESKI" } else { "OK" }
        Write-INFO ("{0,-35} {1,10} {2,10} {3}" -f $f.Name, $sizeKB, $age, $status)
    }
} else {
    Write-FAIL "Data klasoru bulunamadi: $dataPath"
}

# ══════════════════════════════════════════════
# 10. KOLON UYUMLULUK
# ══════════════════════════════════════════════
Write-Section "10. SQL Kolon Uyumlulugu"

$colTests = @(
    "v_R_System|Is_Virtual_Machine0",
    "v_R_System|Distinguished_Name0",
    "v_R_System|InternetEnabled0",
    "v_R_System|AlwaysInternet0",
    "v_R_System|ManagementAuthority",
    "v_CH_ClientSummary|IsActiveDDR",
    "v_CH_ClientSummary|IsActiveHW",
    "v_CH_ClientSummary|IsActiveSW",
    "v_CH_ClientSummary|ClientStateDescription",
    "v_GS_BITLOCKER_DETAILS|Compliant0",
    "v_GS_BITLOCKER_DETAILS|KeyProtectorTypes0",
    "v_GS_BITLOCKER_DETAILS|ConversionStatus0",
    "v_GS_BITLOCKER_DETAILS|EncryptionMethod0"
)

$missingCols = @()
foreach ($t in $colTests) {
    $parts = $t -split '\|'
    $view = $parts[0]
    $col = $parts[1]
    try {
        Run-Query "SELECT TOP 0 [$col] FROM $view" | Out-Null
        Write-OK "$view.$col"
    } catch {
        Write-FAIL "$view.$col BULUNAMADI"
        $missingCols += "$view.$col"
    }
}

# ══════════════════════════════════════════════
# OZET
# ══════════════════════════════════════════════
$conn.Close(); $conn.Dispose()

Write-Section "OZET - TESPIT EDILEN SORUNLAR"

Write-Host ""
Write-Host "  KRITIK:" -ForegroundColor Red
Write-Host "  1. update_deployment.sql: SUM() yerine COUNT(DISTINCT) kullanilmali" -ForegroundColor Red
Write-Host "     Installed/Required/Failed degerler update x device carpimi veriyor" -ForegroundColor Red
Write-Host "     Bu yuzden compliance yuzde 100'u asabiliyor" -ForegroundColor Red
Write-Host ""
Write-Host "  KONTROL GEREKTIREN:" -ForegroundColor Yellow
Write-Host "  2. AssignmentType: Sadece (1,5) mi yoksa (1,5,8) mi olmali?" -ForegroundColor Yellow
Write-Host "     Yukaridaki listeden ADR deployment type'larini kontrol edin" -ForegroundColor Yellow
Write-Host "  3. Buyuk veri dosyalari performans etkisi" -ForegroundColor Yellow
if ($missingCols.Count -gt 0) {
    Write-Host "  4. Eksik kolonlar ($($missingCols.Count) adet):" -ForegroundColor Yellow
    foreach ($mc in $missingCols) { Write-Host "     - $mc" -ForegroundColor Yellow }
}
Write-Host ""
Write-Host "  Bu ciktiyi Claude'a yapistirin." -ForegroundColor Cyan
Write-Host ""
