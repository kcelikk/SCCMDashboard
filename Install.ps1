#Requires -RunAsAdministrator
<#
.SYNOPSIS
    SCCM Dashboard - Tek Komutla Kurulum Scripti (Portable Installer)
.DESCRIPTION
    Bu script, Installer klasorunun icindeki dosyalari hedef dizine kopyalar,
    config'i gunceller, IIS'i yapilandirir, Scheduled Task ve Refresh API olusturur.
    Herhangi bir SCCM sunucusuna tasindiktan sonra tek komutla kurulum yapar.

.PARAMETER SqlServer
    SCCM SQL Server adi (ornek: sccm-sql01 veya sccm-sql01.domain.local)

.PARAMETER Database
    SCCM site veritabani adi (ornek: CM_ABC)

.PARAMETER Port
    IIS port numarasi (varsayilan: 9090)

.PARAMETER InstallPath
    Kurulum dizini (varsayilan: C:\SCCMDashboard)

.PARAMETER RefreshInterval
    Cache yenileme araligi dakika (varsayilan: 60)

.PARAMETER RefreshApiPort
    Manuel refresh API portu (varsayilan: 9091)

.PARAMETER SkipIIS
    IIS kurulumunu atla (sadece config guncelle)

.EXAMPLE
    .\Install.ps1 -SqlServer "sccm-sql01" -Database "CM_ABC"

.EXAMPLE
    .\Install.ps1 -SqlServer "sccm-sql01.domain.local" -Database "CM_P01" -Port 8080 -RefreshInterval 30
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "SCCM SQL Server adi")]
    [string]$SqlServer,

    [Parameter(Mandatory = $true, HelpMessage = "SCCM site veritabani adi (CM_XXX)")]
    [string]$Database,

    [int]$Port = 9090,

    [string]$InstallPath = "C:\SCCMDashboard",

    [int]$RefreshInterval = 60,

    [int]$RefreshApiPort = 9091,

    [switch]$SkipIIS
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------
# RENKLI OUTPUT
# ------------------------------------------------
function Write-Step  { param([string]$msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK    { param([string]$msg) Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Skip  { param([string]$msg) Write-Host "   [SKIP] $msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$msg) Write-Host "   [HATA] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "      SCCM Dashboard Kurulum Sihirbazi          " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  SQL Server   : $SqlServer"
Write-Host "  Database     : $Database"
Write-Host "  Install Path : $InstallPath"
Write-Host "  Port         : $Port"
Write-Host "  Refresh      : $RefreshInterval dk"
Write-Host "  API Port     : $RefreshApiPort"
Write-Host ""

# ------------------------------------------------
# 1. ONKOSUL KONTROLLERI
# ------------------------------------------------
Write-Step "Onkosullar kontrol ediliyor..."

# Parametre validasyonu
if ($Port -lt 1 -or $Port -gt 65535) {
    Write-Err "Gecersiz port: $Port (1-65535 arasi olmali)"
    exit 1
}
if ($RefreshApiPort -lt 1 -or $RefreshApiPort -gt 65535) {
    Write-Err "Gecersiz API port: $RefreshApiPort (1-65535 arasi olmali)"
    exit 1
}
if ($Port -eq $RefreshApiPort) {
    Write-Err "Web portu ($Port) ve API portu ($RefreshApiPort) ayni olamaz"
    exit 1
}
if ($RefreshInterval -lt 1 -or $RefreshInterval -gt 1440) {
    Write-Err "Gecersiz refresh araligi: $RefreshInterval (1-1440 dakika arasi olmali)"
    exit 1
}
if ($Database -notmatch '^CM_') {
    Write-Err "Veritabani adi CM_ ile baslamali: $Database"
    exit 1
}
Write-OK "Parametreler gecerli"

# PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Err "PowerShell 5.1+ gerekli. Mevcut: $($PSVersionTable.PSVersion)"
    exit 1
}
Write-OK "PowerShell $($PSVersionTable.PSVersion)"

# IIS kontrolu
if (-not $SkipIIS) {
    $iisFeature = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
    if ($iisFeature -and -not $iisFeature.Installed) {
        Write-Step "IIS kuruluyor (Web-Server feature)..."
        Install-WindowsFeature -Name Web-Server, Web-Windows-Auth, Web-Static-Content, Web-Default-Doc -IncludeManagementTools
        Write-OK "IIS kuruldu"
    } elseif ($iisFeature) {
        Write-OK "IIS zaten kurulu"
    } else {
        $iisOptional = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -ErrorAction SilentlyContinue
        if ($iisOptional -and $iisOptional.State -ne 'Enabled') {
            Write-Err "IIS kurulu degil. Lutfen once IIS'i kurun."
            Write-Host "   Server: Install-WindowsFeature Web-Server -IncludeManagementTools"
            exit 1
        }
        Write-OK "IIS mevcut"
    }

    # Windows Auth feature
    $winAuth = Get-WindowsFeature -Name Web-Windows-Auth -ErrorAction SilentlyContinue
    if ($winAuth -and -not $winAuth.Installed) {
        Install-WindowsFeature -Name Web-Windows-Auth
        Write-OK "Windows Authentication feature kuruldu"
    }
}

# ------------------------------------------------
# 2. SQL BAGLANTI TESTI
# ------------------------------------------------
Write-Step "SQL Server baglantisi test ediliyor..."
try {
    $testConn = New-Object System.Data.SqlClient.SqlConnection
    $testConn.ConnectionString = "Server=$SqlServer;Database=$Database;Integrated Security=True;Connection Timeout=10;"
    $testConn.Open()

    $cmd = New-Object System.Data.SqlClient.SqlCommand("SELECT TOP 1 SiteCode FROM v_Site", $testConn)
    $siteCode = $cmd.ExecuteScalar()
    $cmd.Dispose()
    $testConn.Close()
    $testConn.Dispose()

    Write-OK "SQL baglantisi basarili - Site Code: $siteCode"

    # View varlik kontrolu
    Write-Step "SQL view uyumlulugu kontrol ediliyor..."
    $criticalViews = @("v_R_System","v_GS_OPERATING_SYSTEM","v_GS_COMPUTER_SYSTEM","v_CH_ClientSummary","v_CIAssignment","v_Package","v_ComponentSummarizer","v_Site","v_Alert")
    $optionalViews = @("v_GS_TPM","v_GS_PC_BIOS","v_GS_FIRMWARE","v_ContentDistributionReport","v_GS_MS_MCS_ADMPWD","v_TaskSequencePackage","v_DeploymentSummary")

    $viewConn = New-Object System.Data.SqlClient.SqlConnection("Server=$SqlServer;Database=$Database;Integrated Security=True;Connection Timeout=10;")
    $viewConn.Open()

    foreach ($v in $criticalViews) {
        $checkCmd = New-Object System.Data.SqlClient.SqlCommand("SELECT OBJECT_ID('$v')", $viewConn)
        $exists = $checkCmd.ExecuteScalar()
        $checkCmd.Dispose()
        if ($null -eq $exists -or $exists -is [DBNull]) {
            Write-Err "Kritik view bulunamadi: $v"
        } else {
            Write-OK "$v"
        }
    }
    foreach ($v in $optionalViews) {
        $checkCmd = New-Object System.Data.SqlClient.SqlCommand("SELECT OBJECT_ID('$v')", $viewConn)
        $exists = $checkCmd.ExecuteScalar()
        $checkCmd.Dispose()
        if ($null -eq $exists -or $exists -is [DBNull]) {
            Write-Skip "$v bulunamadi (ilgili sayfa bos gorunecek)"
        } else {
            Write-OK "$v"
        }
    }
    $viewConn.Close(); $viewConn.Dispose()

} catch {
    Write-Err "SQL baglanamadi: $_"
    Write-Host ""
    Write-Host "   Kontrol edin:" -ForegroundColor Yellow
    Write-Host "   1. SQL Server adi dogru mu? ($SqlServer)"
    Write-Host "   2. Veritabani adi dogru mu? ($Database)"
    Write-Host "   3. Bu sunucunun hesabi SQL'e erisebiliyor mu?"
    Write-Host ""
    $continue = Read-Host "SQL olmadan devam etmek istiyor musunuz? (E/H)"
    if ($continue -ne 'E') { exit 1 }
}

# ------------------------------------------------
# 3. DOSYA KOPYALAMA (Installer -> InstallPath)
# ------------------------------------------------
Write-Step "Dosyalar hazirlaniyor..."

$installerPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Installer icindeki kaynak klasorler
$sourceConfig  = Join-Path $installerPath "Config"
$sourceCache   = Join-Path $installerPath "CacheService"
$sourceWeb     = Join-Path $installerPath "Web"

# Hedef klasorler
$targetConfig  = Join-Path $InstallPath "Config"
$targetCache   = Join-Path $InstallPath "CacheService"
$targetWeb     = Join-Path $InstallPath "Web"
$dataPath      = Join-Path $targetWeb "data"
$logPath       = Join-Path $targetCache "logs"

# Installer ve hedef ayni dizin degil mi kontrol et
$isInPlace = ($installerPath -eq $InstallPath)

if (-not $isInPlace) {
    # Hedef dizini olustur
    if (!(Test-Path $InstallPath)) {
        New-Item -Path $InstallPath -ItemType Directory -Force | Out-Null
    }

    # Kaynak dosyalari kopyala
    if (Test-Path $sourceConfig) { Copy-Item -Path $sourceConfig -Destination $InstallPath -Recurse -Force }
    if (Test-Path $sourceCache)  { Copy-Item -Path $sourceCache  -Destination $InstallPath -Recurse -Force }
    if (Test-Path $sourceWeb)    { Copy-Item -Path $sourceWeb    -Destination $InstallPath -Recurse -Force }

    Write-OK "Dosyalar kopyalandi: $installerPath -> $InstallPath"
} else {
    Write-Skip "Installer dizini = hedef dizin, kopyalama gereksiz"
}

# Alt klasorleri olustur
if (!(Test-Path $dataPath)) { New-Item -Path $dataPath -ItemType Directory -Force | Out-Null }
if (!(Test-Path $logPath))  { New-Item -Path $logPath -ItemType Directory -Force | Out-Null }
Write-OK "Dizin yapisi hazir"

# ------------------------------------------------
# 4. KONFIGURASYON GUNCELLEME
# ------------------------------------------------
Write-Step "Konfigurasyon guncelleniyor..."

$configFile = Join-Path $targetConfig "config.json"
$config = @{
    sqlServer              = $SqlServer
    database               = $Database
    outputPath             = $dataPath
    queriesPath            = Join-Path $targetCache "queries"
    logPath                = $logPath
    refreshIntervalMinutes = $RefreshInterval
    refreshApiPort         = $RefreshApiPort

    # SQL zaman asimlari
    queryTimeoutSeconds      = 300
    connectionTimeoutSeconds = 30

    # Saklama sureleri (0 = temizleme kapali)
    logRetentionDays     = 30
    historyRetentionDays = 90

    # Arayuz davranisi
    staleThresholdMinutes = 90
    autoRefreshSeconds    = 120

    # Refresh API CORS allowlist — bos: yalnizca bu makinenin host adlari
    allowedOrigins = @()
}

$config | ConvertTo-Json -Depth 3 | Set-Content -Path $configFile -Encoding UTF8
Write-OK "config.json guncellendi"

# Thresholds dosyasi kontrol
$thresholdsFile = Join-Path $targetConfig "thresholds.json"
if (!(Test-Path $thresholdsFile)) {
    @{
        updateDeployment = @{ compliancePercent = @{ warning = 80; critical = 60 }; failedCount = @{ warning = 3; critical = 10 } }
        asset = @{ staleDeviceDays = 30; clientHealthPercent = @{ warning = 85; critical = 70 } }
        clientPC = @{ pendingRestartPercent = @{ warning = 20; critical = 40 }; clientVersionMismatchPercent = @{ warning = 15; critical = 30 } }
        server = @{ pendingUpdateCount = @{ warning = 5; critical = 15 }; uptimeDays = @{ warning = 90; critical = 180 } }
        appDeployment = @{ successRatePercent = @{ warning = 85; critical = 70 }; failedCount = @{ warning = 5; critical = 15 } }
        bitlocker = @{ encryptionPercent = @{ warning = 90; critical = 75 } }
        cmg = @{ onlineClientsPercent = @{ warning = 80; critical = 50 } }
        dbMonitor = @{ dbSizeGB = @{ warning = 50; critical = 80 }; componentErrors = @{ warning = 1; critical = 5 }; backupAgeDays = @{ warning = 1; critical = 3 } }
    } | ConvertTo-Json -Depth 3 | Set-Content -Path $thresholdsFile -Encoding UTF8
    Write-OK "thresholds.json olusturuldu"
} else {
    Write-OK "thresholds.json hazir"
}

# ------------------------------------------------
# 5. ESKI TEST VERILERINI TEMIZLE
# ------------------------------------------------
Write-Step "Eski veriler temizleniyor..."

$existingJsons = Get-ChildItem -Path $dataPath -Filter "*.json" -ErrorAction SilentlyContinue
if ($existingJsons.Count -gt 0) {
    foreach ($f in $existingJsons) {
        Remove-Item $f.FullName -Force
    }
    Write-OK "$($existingJsons.Count) eski JSON dosyasi temizlendi"
} else {
    Write-Skip "Temizlenecek eski veri yok"
}

# ------------------------------------------------
# 6. IIS KURULUMU
# ------------------------------------------------
if (-not $SkipIIS) {
    Write-Step "IIS yapilandiriliyor..."

    Import-Module WebAdministration

    $poolName = "SCCMDashboardPool"
    $siteName = "SCCMDashboard"
    $sitePath = $targetWeb

    # App Pool
    if (!(Test-Path "IIS:\AppPools\$poolName")) {
        $pool = New-WebAppPool -Name $poolName
        Set-ItemProperty "IIS:\AppPools\$poolName" -Name managedRuntimeVersion -Value ""
        Set-ItemProperty "IIS:\AppPools\$poolName" -Name managedPipelineMode -Value 1
        Write-OK "App Pool olusturuldu: $poolName"
    } else {
        Write-Skip "App Pool zaten mevcut: $poolName"
    }

    # Web Site
    $existingSite = Get-Website -Name $siteName -ErrorAction SilentlyContinue
    if (!$existingSite) {
        # Port cakismasi kontrolu
        $portInUse = Get-Website | Where-Object { $_.Bindings.Collection.bindingInformation -match ":${Port}:" }
        if ($portInUse) {
            Write-Err "Port $Port baska bir site tarafindan kullaniliyor: $($portInUse.Name)"
            Write-Host "   Farkli port icin: .\Install.ps1 ... -Port 8080"
            exit 1
        }

        New-Website -Name $siteName -PhysicalPath $sitePath -Port $Port -ApplicationPool $poolName -Force
        Write-OK "Web Site olusturuldu: $siteName (port $Port)"
    } else {
        Set-ItemProperty "IIS:\Sites\$siteName" -Name physicalPath -Value $sitePath
        Write-Skip "Web Site guncellendi: $siteName"
    }

    # Authentication — site-specific olarak apphost'a yaz (SCCM IIS ayarlarini etkilemez)
    try {
        & "$env:windir\system32\inetsrv\appcmd.exe" set config "$siteName" /section:anonymousAuthentication /enabled:false /commit:apphost 2>$null
        & "$env:windir\system32\inetsrv\appcmd.exe" set config "$siteName" /section:windowsAuthentication /enabled:true /commit:apphost 2>$null
        Write-OK "Windows Authentication yapilandirildi (site-specific)"
    } catch {
        Write-Err "Authentication ayarlari yapilanamadi: $_"
        Write-Host "   IIS Manager'dan manuel olarak $siteName icin Windows Auth aktif edin" -ForegroundColor Yellow
    }

    # MIME Type (.json)
    try {
        $jsonMime = Get-WebConfigurationProperty -Filter "//staticContent/mimeMap[@fileExtension='.json']" `
            -PSPath "IIS:\Sites\$siteName" -Name "." -ErrorAction SilentlyContinue
        if (!$jsonMime) {
            Add-WebConfigurationProperty -Filter "//staticContent" -PSPath "IIS:\Sites\$siteName" `
                -Name "." -Value @{fileExtension='.json'; mimeType='application/json'}
            Write-OK ".json MIME type eklendi"
        }
    } catch {
        Write-Skip ".json MIME type zaten tanimli (parent config)"
    }

    # Default Document
    try {
        $existingDefault = Get-WebConfigurationProperty -Filter "//defaultDocument/files/add[@value='pages/index.html']" `
            -PSPath "IIS:\Sites\$siteName" -Name "value" -ErrorAction SilentlyContinue
        if (!$existingDefault) {
            Add-WebConfigurationProperty -Filter "//defaultDocument/files" `
                -PSPath "IIS:\Sites\$siteName" `
                -Name "." -Value @{value="pages/index.html"}
            Write-OK "Default document eklendi"
        }
    } catch {
        Write-Skip "Default document zaten tanimli"
    }

    # GZip sikistirma (JSON/JS/CSS/HTML icin)
    try {
        $compFeature = Get-WindowsFeature -Name Web-Dynamic-Compression -ErrorAction SilentlyContinue
        if ($compFeature -and -not $compFeature.Installed) {
            Install-WindowsFeature -Name Web-Dynamic-Compression, Web-Static-Compression -ErrorAction SilentlyContinue
        }
        & "$env:windir\system32\inetsrv\appcmd.exe" set config "$siteName" /section:urlCompression /doStaticCompression:true /doDynamicCompression:true /commit:apphost 2>$null
        Write-OK "GZip sikistirma aktif"
    } catch {
        Write-Skip "GZip yapilandirilamadi (manuel aktif edin)"
    }

    # Start Site
    Start-Website -Name $siteName -ErrorAction SilentlyContinue
    Write-OK "Site baslatildi"

} else {
    Write-Skip "IIS kurulumu atlandi (-SkipIIS)"
}

# ------------------------------------------------
# 7. SCHEDULED TASK — CACHE REFRESH
# ------------------------------------------------
Write-Step "Scheduled Task yapilandiriliyor..."

$taskName = "SCCMDashboard-CacheRefresh"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "   Eski task silindi, yenisi olusturuluyor..." -ForegroundColor Yellow
}

$scriptPath = Join-Path $targetCache "Run-CacheRefresh.ps1"
$configArg  = Join-Path $targetConfig "config.json"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$scriptPath`" -ConfigPath `"$configArg`""

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $RefreshInterval) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "SCCM Dashboard Cache Refresh - Her $RefreshInterval dakikada SQL verilerini JSON'a aktarir"

Write-OK "Scheduled Task olusturuldu: Her $RefreshInterval dakika"

# ------------------------------------------------
# 8. SCHEDULED TASK — REFRESH API (at startup)
# ------------------------------------------------
Write-Step "Refresh API yapilandiriliyor..."

$apiTaskName = "SCCMDashboard-RefreshAPI"
$existingApiTask = Get-ScheduledTask -TaskName $apiTaskName -ErrorAction SilentlyContinue

if ($existingApiTask) {
    Unregister-ScheduledTask -TaskName $apiTaskName -Confirm:$false
}

$apiScriptPath = Join-Path $targetCache "Start-RefreshAPI.ps1"

$apiAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$apiScriptPath`" -ConfigPath `"$configArg`""

$apiTrigger = New-ScheduledTaskTrigger -AtStartup
$apiSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $apiTaskName `
    -Action $apiAction `
    -Trigger $apiTrigger `
    -Settings $apiSettings `
    -Principal $principal `
    -Description "SCCM Dashboard Refresh API - Manuel cache yenileme icin HTTP endpoint (port $RefreshApiPort)"

# Hemen baslat
Start-ScheduledTask -TaskName $apiTaskName -ErrorAction SilentlyContinue
Write-OK "Refresh API baslatildi (port $RefreshApiPort)"

# ------------------------------------------------
# 9. FIREWALL KURALLARI
# ------------------------------------------------
Write-Step "Firewall kurallari kontrol ediliyor..."

# Web port
$fwRule = Get-NetFirewallRule -DisplayName "SCCMDashboard-HTTP" -ErrorAction SilentlyContinue
if (!$fwRule) {
    New-NetFirewallRule -DisplayName "SCCMDashboard-HTTP" `
        -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow `
        -Description "SCCM Dashboard web erisimi (port $Port)" | Out-Null
    Write-OK "Firewall kurali eklendi: TCP/$Port"
} else {
    Write-Skip "Firewall kurali zaten mevcut: TCP/$Port"
}

# API port
$fwRuleApi = Get-NetFirewallRule -DisplayName "SCCMDashboard-RefreshAPI" -ErrorAction SilentlyContinue
if (!$fwRuleApi) {
    New-NetFirewallRule -DisplayName "SCCMDashboard-RefreshAPI" `
        -Direction Inbound -Protocol TCP -LocalPort $RefreshApiPort -Action Allow `
        -Description "SCCM Dashboard Refresh API (port $RefreshApiPort)" | Out-Null
    Write-OK "Firewall kurali eklendi: TCP/$RefreshApiPort (API)"
} else {
    Write-Skip "Firewall kurali zaten mevcut: TCP/$RefreshApiPort"
}

# ------------------------------------------------
# 10. HTTP URL ACL (RefreshAPI icin gerekli)
# ------------------------------------------------
Write-Step "HTTP URL ACL yapilandiriliyor..."
try {
    & netsh http add urlacl url="http://+:$RefreshApiPort/" user="NT AUTHORITY\SYSTEM" 2>$null
    Write-OK "URL ACL eklendi: port $RefreshApiPort"
} catch {
    Write-Skip "URL ACL zaten mevcut veya eklenemedi"
}

# ------------------------------------------------
# 11. ILK CACHE REFRESH
# ------------------------------------------------
Write-Step "Ilk cache yenilemesi baslatiliyor..."
Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Write-OK "Cache yenilemesi baslatildi (arka planda calisiyor)"

# ------------------------------------------------
# OZET
# ------------------------------------------------
$hostname = $env:COMPUTERNAME
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "       Kurulum Basariyla Tamamlandi!             " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard URL   : http://${hostname}:${Port}" -ForegroundColor White
Write-Host "  Lokal URL       : http://localhost:${Port}" -ForegroundColor White
Write-Host "  Refresh API     : http://localhost:${RefreshApiPort}/api/health" -ForegroundColor White
Write-Host "  Install Path    : $InstallPath" -ForegroundColor White
Write-Host "  SQL Server      : $SqlServer" -ForegroundColor White
Write-Host "  Database        : $Database" -ForegroundColor White
Write-Host "  Cache Refresh   : Her $RefreshInterval dakika" -ForegroundColor White
Write-Host "  Auth            : Windows Authentication" -ForegroundColor White
Write-Host ""
Write-Host "  Sonraki adimlar:" -ForegroundColor Yellow
Write-Host "  1. Tarayicida http://localhost:${Port} adresini acin"
Write-Host "  2. Cache refresh tamamlanana kadar 1-2 dakika bekleyin"
Write-Host "  3. Header'daki 'Yenile' butonu ile manuel refresh yapabilirsiniz"
Write-Host ""
