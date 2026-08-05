/**
 * SCCM Dashboard — Internationalization (i18n)
 * TR / EN dual language support
 */
var Lang = (function () {
  'use strict';

  var _lang = localStorage.getItem('sccm-lang') || 'tr';

  var _strings = {
    // ── Common ──
    'common.loading':           { tr: 'Yukleniyor...', en: 'Loading...' },
    'common.noData':            { tr: 'Veri yuklenemedi.', en: 'Data could not be loaded.' },
    'common.search':            { tr: 'Ara:', en: 'Search:' },
    'common.records':           { tr: '_MENU_ kayit goster', en: 'Show _MENU_ entries' },
    'common.info':              { tr: '_TOTAL_ kayittan _START_-_END_', en: 'Showing _START_ to _END_ of _TOTAL_' },
    'common.next':              { tr: '>', en: '>' },
    'common.prev':              { tr: '<', en: '<' },
    'common.emptyTable':        { tr: 'Kayit bulunamadi', en: 'No records found' },
    'common.zeroRecords':       { tr: 'Eslesen kayit yok', en: 'No matching records' },
    'common.csvExport':         { tr: 'CSV Export', en: 'CSV Export' },
    'common.yes':               { tr: 'Evet', en: 'Yes' },
    'common.no':                { tr: 'Hayir', en: 'No' },
    'common.unknown':           { tr: 'Bilinmiyor', en: 'Unknown' },
    'common.all':               { tr: 'Tumu', en: 'All' },
    'common.active':            { tr: 'Aktif', en: 'Active' },
    'common.stale':             { tr: 'Stale', en: 'Stale' },
    'common.ok':                { tr: 'Basarili', en: 'OK' },
    'common.error':             { tr: 'Hata', en: 'Error' },
    'common.warning':           { tr: 'Uyari', en: 'Warning' },
    'common.info_level':        { tr: 'Bilgi', en: 'Info' },
    'common.device':            { tr: 'cihaz', en: 'device' },
    'common.devices':           { tr: 'cihaz', en: 'devices' },
    'common.total':             { tr: 'Toplam', en: 'Total' },
    'common.refresh':           { tr: 'Yenile', en: 'Refresh' },
    'common.refreshApiDown':    { tr: 'Refresh API erisilemedi', en: 'Refresh API unreachable' },
    'common.cacheNotFound':     { tr: 'Cache bulunamadi', en: 'Cache not found' },
    'common.accessDenied':      { tr: 'Bu sayfaya erisim yetkiniz bulunmamaktadir.', en: 'You do not have permission to access this page.' },

    // ── Time ──
    'time.secAgo':              { tr: 'sn once', en: 'sec ago' },
    'time.minAgo':              { tr: 'dk once', en: 'min ago' },
    'time.hourAgo':             { tr: 'saat once', en: 'hours ago' },
    'time.dayAgo':              { tr: 'gun once', en: 'days ago' },

    // ── Sidebar ──
    'nav.general':              { tr: 'Genel', en: 'General' },
    'nav.devicesInventory':     { tr: 'Cihazlar & Envanter', en: 'Devices & Inventory' },
    'nav.softwareUpdates':      { tr: 'Yazilim & Guncellemeler', en: 'Software & Updates' },
    'nav.securityCompliance':   { tr: 'Guvenlik & Uyumluluk', en: 'Security & Compliance' },
    'nav.sccmInfra':            { tr: 'SCCM Altyapi', en: 'SCCM Infrastructure' },
    'nav.reportingAdmin':       { tr: 'Raporlama & Yonetim', en: 'Reporting & Admin' },

    // ── Page Titles ──
    'page.dashboard':           { tr: 'Dashboard', en: 'Dashboard' },
    'page.asset':               { tr: 'Asset Envanteri', en: 'Asset Inventory' },
    'page.clientPc':            { tr: 'Client PC', en: 'Client PC' },
    'page.server':              { tr: 'Server', en: 'Server' },
    'page.hardwareFirmware':    { tr: 'Hardware & Firmware', en: 'Hardware & Firmware' },
    'page.updateDeployment':    { tr: 'Update Deployment', en: 'Update Deployment' },
    'page.appDeployment':       { tr: 'App Deployment', en: 'App Deployment' },
    'page.appInventory':        { tr: 'Uygulama Envanteri', en: 'App Inventory' },
    'page.contentDist':         { tr: 'Content Distribution', en: 'Content Distribution' },
    'page.taskDeployment':      { tr: 'OS / Task Deployment', en: 'OS / Task Deployment' },
    'page.bitlocker':           { tr: 'BitLocker', en: 'BitLocker' },
    'page.laps':                { tr: 'LAPS', en: 'LAPS' },
    'page.sccmHealth':          { tr: 'SCCM Health', en: 'SCCM Health' },
    'page.sccmAlerts':          { tr: 'SCCM Alerts', en: 'SCCM Alerts' },
    'page.cmg':                 { tr: 'CMG', en: 'CMG' },
    'page.dbMonitor':           { tr: 'DB Monitor', en: 'DB Monitor' },
    'page.reports':             { tr: 'Raporlar', en: 'Reports' },
    'page.systemHealth':        { tr: 'Sistem Sagligi', en: 'System Health' },
    'page.admin':               { tr: 'Yonetim (RBAC)', en: 'Admin (RBAC)' },

    // ── Dashboard / Index ──
    'dash.totalDevices':        { tr: 'Toplam Cihaz', en: 'Total Devices' },
    'dash.activeDevices':       { tr: 'Aktif Cihaz', en: 'Active Devices' },
    'dash.updateCompliance':    { tr: 'Update Compliance', en: 'Update Compliance' },
    'dash.staleDevices':        { tr: 'Stale Cihaz', en: 'Stale Devices' },
    'dash.pageSummaries':       { tr: 'Sayfa Ozetleri', en: 'Page Summaries' },
    'dash.deviceDist':          { tr: 'Cihaz Dagilimi', en: 'Device Distribution' },
    'dash.complianceSummary':   { tr: 'Update Compliance Ozeti', en: 'Update Compliance Summary' },
    'dash.server':              { tr: 'server', en: 'server' },
    'dash.workstation':         { tr: 'workstation', en: 'workstation' },
    'dash.failedUpdates':       { tr: 'basarisiz update tespit edildi', en: 'failed updates detected' },
    'dash.compErrors':          { tr: 'component hatasi tespit edildi', en: 'component errors detected' },
    'dash.cacheError':          { tr: 'Cache servisi hata veriyor', en: 'Cache service has errors' },
    'dash.cacheSomeErrors':     { tr: 'Bazi cache sorgulari basarisiz oldu', en: 'Some cache queries failed' },
    'dash.deployment':          { tr: 'deployment', en: 'deployment' },
    'dash.failed':              { tr: 'basarisiz', en: 'failed' },
    'dash.protected':           { tr: 'korumali', en: 'protected' },
    'dash.internetClient':      { tr: 'internet client', en: 'internet client' },

    // ── Asset ──
    'asset.osDist':             { tr: 'OS Dagilimi', en: 'OS Distribution' },
    'asset.deviceType':         { tr: 'Cihaz Tipi', en: 'Device Type' },
    'asset.assetList':          { tr: 'Asset Listesi', en: 'Asset List' },
    'asset.allTypes':           { tr: 'Tum Tipler', en: 'All Types' },
    'asset.allStatus':          { tr: 'Tum Durumlar', en: 'All Status' },
    'asset.hostname':           { tr: 'Hostname', en: 'Hostname' },
    'asset.os':                 { tr: 'OS', en: 'OS' },
    'asset.type':               { tr: 'Tip', en: 'Type' },
    'asset.ipAddress':          { tr: 'IP Adresi', en: 'IP Address' },
    'asset.model':              { tr: 'Model', en: 'Model' },
    'asset.user':               { tr: 'Kullanici', en: 'User' },
    'asset.lastActivity':       { tr: 'Son Aktivite', en: 'Last Activity' },
    'asset.status':             { tr: 'Durum', en: 'Status' },
    'asset.active30':           { tr: 'Aktif (30 gun)', en: 'Active (30 days)' },
    'asset.users':              { tr: 'Kullanici', en: 'Users' },
    'asset.goDetail':           { tr: 'Tam Detay Sayfasina Git', en: 'Go to Full Details' },

    // ── Client PC ──
    'client.totalClient':       { tr: 'Toplam Client', en: 'Total Clients' },
    'client.clientInstalled':   { tr: 'Client Kurulu', en: 'Client Installed' },
    'client.diffVersion':       { tr: 'Farkli Version', en: 'Different Versions' },
    'client.healthStatus':      { tr: 'Client Health Durumu', en: 'Client Health Status' },
    'client.versionDist':       { tr: 'Client Version Dagilimi', en: 'Client Version Distribution' },
    'client.clientList':        { tr: 'Client PC Listesi', en: 'Client PC List' },
    'client.missing':           { tr: 'eksik', en: 'missing' },

    // ── Server ──
    'server.total':             { tr: 'Toplam Server', en: 'Total Servers' },
    'server.virtual':           { tr: 'sanal', en: 'virtual' },
    'server.physical':          { tr: 'fiziksel', en: 'physical' },
    'server.highUptime':        { tr: 'Yuksek Uptime (>90g)', en: 'High Uptime (>90d)' },
    'server.rebootNeeded':      { tr: 'Yeniden baslatma onerilen', en: 'Reboot recommended' },
    'server.osDist':            { tr: 'Server OS Dagilimi', en: 'Server OS Distribution' },
    'server.physVirt':          { tr: 'Fiziksel / Sanal', en: 'Physical / Virtual' },
    'server.serverList':        { tr: 'Server Listesi', en: 'Server List' },
    'server.lastBoot':          { tr: 'Son Boot', en: 'Last Boot' },
    'server.days':              { tr: 'gun', en: 'days' },

    // ── Update Deployment ──
    'upd.totalDeployment':      { tr: 'Toplam Deployment', en: 'Total Deployments' },
    'upd.compliance':           { tr: 'Compliance', en: 'Compliance' },
    'upd.failedUpdates':        { tr: 'Basarisiz Guncelleme', en: 'Failed Updates' },
    'upd.pending':              { tr: 'Bekleyen', en: 'Pending' },
    'upd.pendingInstall':       { tr: 'Kurulum bekleyen', en: 'Pending install' },
    'upd.compStatus':           { tr: 'Compliance Durumu', en: 'Compliance Status' },
    'upd.last30trend':          { tr: 'Son 30 Gun Trend', en: 'Last 30 Days Trend' },
    'upd.deploymentList':       { tr: 'Update Deployment Listesi', en: 'Update Deployment List' },
    'upd.deploymentName':       { tr: 'Deployment Adi', en: 'Deployment Name' },
    'upd.date':                 { tr: 'Tarih', en: 'Date' },
    'upd.activeDeployment':     { tr: 'Aktif update deployment', en: 'Active update deployments' },
    'upd.noData':               { tr: 'Veri yok', en: 'No data' },

    // ── App Deployment ──
    'app.deployStatusDist':     { tr: 'Deployment Durum Dagilimi', en: 'Deployment Status Distribution' },
    'app.topFailed':            { tr: 'En Cok Basarisiz (Top 5)', en: 'Most Failed (Top 5)' },
    'app.successful':           { tr: 'Basarili', en: 'Successful' },
    'app.inProgress':           { tr: 'Devam Eden', en: 'In Progress' },
    'app.successRate':          { tr: 'Basari %', en: 'Success %' },
    'app.advName':              { tr: 'Advertisement Adi', en: 'Advertisement Name' },
    'app.package':              { tr: 'Paket', en: 'Package' },
    'app.running':              { tr: 'Calisanlar', en: 'Running' },
    'app.appModel':             { tr: 'Application Model', en: 'Application Model' },
    'app.pkgProgram':           { tr: 'Package / Program', en: 'Package / Program' },
    'app.appDeployment':        { tr: 'Application Deployment', en: 'Application Deployment' },
    'app.pkgDeployment':        { tr: 'Package/Program Deployment', en: 'Package/Program Deployment' },

    // ── App Inventory ──
    'inv.topApps':              { tr: 'En Yaygin Uygulamalar (Top 10)', en: 'Most Common Apps (Top 10)' },
    'inv.topPublishers':        { tr: 'En Cok Publisher (Top 10)', en: 'Top Publishers (Top 10)' },
    'inv.appInventory':         { tr: 'Uygulama Envanteri', en: 'Application Inventory' },
    'inv.appName':              { tr: 'Uygulama Adi', en: 'Application Name' },
    'inv.installedDevices':     { tr: 'Kurulu Cihaz', en: 'Installed Devices' },

    // ── Content Distribution ──
    'cd.distStatus':            { tr: 'Dagitim Durumu', en: 'Distribution Status' },
    'cd.pkgTypeDist':           { tr: 'Paket Tipi Dagilimi', en: 'Package Type Distribution' },
    'cd.distPoints':            { tr: 'Distribution Points', en: 'Distribution Points' },
    'cd.totalPackage':          { tr: 'Toplam Paket', en: 'Total Packages' },
    'cd.successRate':           { tr: 'Basari Orani', en: 'Success Rate' },
    'cd.distribution':          { tr: 'dagitim', en: 'distributions' },
    'cd.failedDist':            { tr: 'basarisiz content dagitimi tespit edildi', en: 'failed content distributions detected' },
    'cd.lastCopy':              { tr: 'Son Kopyalama', en: 'Last Copied' },
    'cd.cdStatus':              { tr: 'Content Distribution Durumu', en: 'Content Distribution Status' },

    // ── Hardware & Firmware ──
    'hw.mfrDist':               { tr: 'Uretici Dagilimi', en: 'Manufacturer Distribution' },
    'hw.tpmStatus':             { tr: 'TPM Durumu', en: 'TPM Status' },
    'hw.uefiSecureBoot':        { tr: 'UEFI / SecureBoot', en: 'UEFI / SecureBoot' },
    'hw.topModels':             { tr: 'En Yaygin Modeller (Top 10)', en: 'Most Common Models (Top 10)' },
    'hw.details':               { tr: 'Hardware & Firmware Detaylari', en: 'Hardware & Firmware Details' },
    'hw.manufacturer':          { tr: 'Uretici', en: 'Manufacturer' },
    'hw.tpmActive':             { tr: 'TPM Aktif', en: 'TPM Enabled' },
    'hw.tpmPassive':            { tr: 'TPM Pasif', en: 'TPM Disabled' },
    'hw.tpmNA':                 { tr: 'TPM Yok/Bilinmiyor', en: 'TPM N/A' },

    // ── BitLocker ──
    'bl.encStatus':             { tr: 'Sifreleme Durumu', en: 'Encryption Status' },
    'bl.encMethodDist':         { tr: 'Encryption Method Dagilimi', en: 'Encryption Method Distribution' },
    'bl.blStatus':              { tr: 'BitLocker Durumu', en: 'BitLocker Status' },
    'bl.protected':             { tr: 'Korumali', en: 'Protected' },
    'bl.unprotected':           { tr: 'Korumasiz', en: 'Unprotected' },
    'bl.cProtected':            { tr: 'C: Korumali', en: 'C: Protected' },
    'bl.compliant':             { tr: 'Uyumlu', en: 'Compliant' },
    'bl.policyCompliant':       { tr: 'BitLocker policy uyumlu', en: 'BitLocker policy compliant' },
    'bl.fullyEncrypted':        { tr: 'Tam Sifrelenmis', en: 'Fully Encrypted' },
    'bl.encrypting':            { tr: 'Sifreleniyor', en: 'Encrypting' },
    'bl.decrypting':            { tr: 'Cozuluyor', en: 'Decrypting' },
    'bl.notEncrypted':          { tr: 'Sifrelenmemis', en: 'Not Encrypted' },
    'bl.drive':                 { tr: 'Surucu', en: 'Drive' },
    'bl.protection':            { tr: 'Koruma', en: 'Protection' },
    'bl.conversion':            { tr: 'Donusum', en: 'Conversion' },
    'bl.encMethod':             { tr: 'Sifreleme Metodu', en: 'Encryption Method' },

    // ── LAPS ──
    'laps.coverageStatus':      { tr: 'LAPS Kapsam Durumu', en: 'LAPS Coverage Status' },
    'laps.pwdAgeDist':          { tr: 'Parola Yasi Dagilimi', en: 'Password Age Distribution' },
    'laps.lapsStatus':          { tr: 'LAPS Durumu', en: 'LAPS Status' },
    'laps.coverage':            { tr: 'LAPS Kapsam', en: 'LAPS Coverage' },
    'laps.notManaged':          { tr: 'LAPS Disinda', en: 'Not Managed' },
    'laps.expired':             { tr: 'Suresi Dolmus', en: 'Expired' },
    'laps.pwdRenew':            { tr: 'Parola yenilenmeli', en: 'Password needs renewal' },
    'laps.lapsActive':          { tr: 'LAPS Aktif', en: 'LAPS Active' },
    'laps.lapsNone':            { tr: 'LAPS Yok', en: 'No LAPS' },
    'laps.pwdExpiry':           { tr: 'Parola Expiry', en: 'Password Expiry' },
    'laps.pwdAgeDays':          { tr: 'Parola Yasi (gun)', en: 'Password Age (days)' },
    'laps.coverageCritical':    { tr: 'LAPS kapsami kritik', en: 'LAPS coverage critical' },
    'laps.devicesOutside':      { tr: 'cihaz LAPS disinda', en: 'devices without LAPS' },
    'laps.pwdExpired':          { tr: 'cihazin LAPS parolasi suresi dolmus', en: 'devices have expired LAPS passwords' },

    // ── SCCM Health ──
    'health.serviceDist':       { tr: 'Servis Durumu Dagilimi', en: 'Service Status Distribution' },
    'health.compErrors':        { tr: 'Component Hata/Uyari', en: 'Component Errors/Warnings' },
    'health.components':        { tr: 'Servisler / Componentlar', en: 'Services / Components' },
    'health.siteSystems':       { tr: 'Site Sistemleri', en: 'Site Systems' },
    'health.inboxQueue':        { tr: 'Inbox Kuyrugu', en: 'Inbox Queue' },
    'health.compStatus':        { tr: 'SCCM Component Durumlari', en: 'SCCM Component Status' },
    'health.siteRoles':         { tr: 'Site Sistem Rolleri', en: 'Site System Roles' },
    'health.inboxStatus':       { tr: 'Inbox Kuyruk Durumu', en: 'Inbox Queue Status' },
    'health.totalComp':         { tr: 'Toplam Component', en: 'Total Components' },
    'health.healthy':           { tr: 'Saglikli', en: 'Healthy' },
    'health.stoppedServices':   { tr: 'Durmus Servisler', en: 'Stopped Services' },
    'health.critWarn':          { tr: 'Kritik / Uyari', en: 'Critical / Warning' },
    'health.running':           { tr: 'Calisiyor', en: 'Running' },
    'health.stopped':           { tr: 'Durmus', en: 'Stopped' },
    'health.other':             { tr: 'Diger', en: 'Other' },
    'health.noErrors':          { tr: 'Hata yok', en: 'No errors' },
    'health.errors':            { tr: 'Hatalar', en: 'Errors' },
    'health.warnings':          { tr: 'Uyarilar', en: 'Warnings' },
    'health.serviceStatus':     { tr: 'Servis Durumu', en: 'Service Status' },
    'health.lastMsg':           { tr: 'Son Mesaj', en: 'Last Message' },
    'health.criticalComp':      { tr: 'component kritik durumda', en: 'components in critical state' },
    'health.stoppedComp':       { tr: 'servis durdurulmus', en: 'services stopped' },
    'health.totalCompErrors':   { tr: 'Toplam component hatasi mevcut', en: 'Total component errors found' },
    'health.inboxBacklog':      { tr: 'inbox kuyruğunda birikmis dosya var', en: 'inbox queues have backlogged files' },
    'health.availability':      { tr: 'Kullanilabilirlik', en: 'Availability' },
    'health.online':            { tr: 'Online', en: 'Online' },
    'health.offline':           { tr: 'Offline', en: 'Offline' },
    'health.fileCount':         { tr: 'Dosya Sayisi', en: 'File Count' },
    'health.lastWrite':         { tr: 'Son Yazma', en: 'Last Write' },
    'health.inboxEmpty':        { tr: 'Inbox kuyrugunde dosya yok', en: 'No files in inbox queue' },

    // ── SCCM Alerts ──
    'alert.sevDist':            { tr: 'Alert Severity Dagilimi', en: 'Alert Severity Distribution' },
    'alert.stateDist':          { tr: 'Alert Durum Dagilimi', en: 'Alert State Distribution' },
    'alert.activeAlerts':       { tr: 'Aktif Alertler', en: 'Active Alerts' },
    'alert.allAlerts':          { tr: 'Tum Alertler', en: 'All Alerts' },
    'alert.totalAlerts':        { tr: 'Toplam Alert', en: 'Total Alerts' },
    'alert.critActive':         { tr: 'KRITIK ALERT AKTIF', en: 'CRITICAL ALERTS ACTIVE' },
    'alert.warnActive':         { tr: 'UYARI AKTIF', en: 'WARNINGS ACTIVE' },
    'alert.noActiveAlerts':     { tr: 'Aktif alert yok — tum sistemler normal', en: 'No active alerts — all systems normal' },
    'alert.noActiveFound':      { tr: 'Aktif alert bulunmuyor', en: 'No active alerts found' },
    'alert.allSeverity':        { tr: 'Tum Severity', en: 'All Severity' },
    'alert.allStates':          { tr: 'Tum Durumlar', en: 'All States' },
    'alert.source':             { tr: 'Kaynak', en: 'Source' },
    'alert.created':            { tr: 'Olusturulma', en: 'Created' },
    'alert.lastModified':       { tr: 'Son Degisiklik', en: 'Last Modified' },
    'alert.occurrence':         { tr: 'Tekrar', en: 'Occurrence' },

    // ── CMG ──
    'cmg.clientConnType':       { tr: 'Client Baglanti Tipi', en: 'Client Connection Type' },
    'cmg.infra':                { tr: 'CMG Altyapi', en: 'CMG Infrastructure' },
    'cmg.clientList':           { tr: 'Client Listesi', en: 'Client List' },

    // ── DB Monitor ──
    'db.compStatusDist':        { tr: 'Component Durum Dagilimi', en: 'Component Status Distribution' },
    'db.dbSize':                { tr: 'DB Boyutu', en: 'DB Size' },
    'db.compStatus':            { tr: 'Component Durumu', en: 'Component Status' },
    'db.siteSystemStatus':      { tr: 'Site System Durumu', en: 'Site System Status' },
    'db.backupInfo':            { tr: 'Backup Bilgisi', en: 'Backup Info' },
    'db.database':              { tr: 'Veritabani', en: 'Database' },
    'db.backupType':            { tr: 'Backup Tipi', en: 'Backup Type' },
    'db.lastBackup':            { tr: 'Son Backup', en: 'Last Backup' },
    'db.hoursAgo':              { tr: 'Saat Once', en: 'Hours Ago' },

    // ── System Health ──
    'sys.querySuccessRate':     { tr: 'Sorgu Basari / Hata Orani', en: 'Query Success / Error Rate' },
    'sys.queryTimes':           { tr: 'Sorgu Calisma Sureleri', en: 'Query Execution Times' },
    'sys.liveSyncStatus':       { tr: 'Canli Sync Durumu', en: 'Live Sync Status' },
    'sys.queryStatus':          { tr: 'Sorgu Durumlari', en: 'Query Status' },
    'sys.cacheLog':             { tr: 'Cache Log', en: 'Cache Log' },
    'sys.dataFiles':            { tr: 'Veri Dosyalari', en: 'Data Files' },
    'sys.cacheQueryStatus':     { tr: 'Cache Sorgu Durumlari', en: 'Cache Query Status' },
    'sys.lastCacheLog':         { tr: 'Son Cache Refresh Logu', en: 'Last Cache Refresh Log' },
    'sys.dataFileStatus':       { tr: 'Veri Dosyalari Durumu', en: 'Data Files Status' },

    // ── Reports ──
    'rpt.readyReports':         { tr: 'Hazir Raporlar', en: 'Ready Reports' },
    'rpt.customReport':         { tr: 'Ozel Rapor Olustur', en: 'Create Custom Report' },
    'rpt.scheduledReports':     { tr: 'Zamanlanmis Raporlar', en: 'Scheduled Reports' },
    'rpt.reportName':           { tr: 'Rapor Adi', en: 'Report Name' },
    'rpt.dataSource':           { tr: 'Veri Kaynagi', en: 'Data Source' },
    'rpt.columns':              { tr: 'Kolonlar', en: 'Columns' },
    'rpt.filterColumn':         { tr: 'Filtre Kolonu', en: 'Filter Column' },
    'rpt.filterOp':             { tr: 'Filtre Operatoru', en: 'Filter Operator' },
    'rpt.filterValue':          { tr: 'Filtre Degeri', en: 'Filter Value' },
    'rpt.sortBy':               { tr: 'Siralama', en: 'Sort By' },
    'rpt.sortDir':              { tr: 'Siralama Yonu', en: 'Sort Direction' },
    'rpt.limit':                { tr: 'Limit', en: 'Limit' },
    'rpt.preview':              { tr: 'Onizleme', en: 'Preview' },
    'rpt.downloadCsv':          { tr: 'CSV Indir', en: 'Download CSV' },
    'rpt.schedule':             { tr: 'Zamanla / Kaydet', en: 'Schedule / Save' },
    'rpt.clearAll':             { tr: 'Tumunu Temizle', en: 'Clear All' },
    'rpt.contains':             { tr: 'Icerir', en: 'Contains' },
    'rpt.equals':               { tr: 'Esittir', en: 'Equals' },
    'rpt.notEquals':            { tr: 'Esit Degil', en: 'Not Equals' },
    'rpt.greaterThan':          { tr: 'Buyuktur', en: 'Greater Than' },
    'rpt.lessThan':             { tr: 'Kucuktur', en: 'Less Than' },
    'rpt.ascending':            { tr: 'Artan (A-Z)', en: 'Ascending (A-Z)' },
    'rpt.descending':           { tr: 'Azalan (Z-A)', en: 'Descending (Z-A)' },
    'rpt.customDesigner':       { tr: 'Ozel Rapor Tasarlayici', en: 'Custom Report Designer' },
    'rpt.savedScheduled':       { tr: 'Kayitli & Zamanlanmis Raporlar', en: 'Saved & Scheduled Reports' },
    'rpt.selectFirst':          { tr: 'Once veri kaynagi secin', en: 'Select data source first' },
    'rpt.noFilter':             { tr: 'Filtre yok', en: 'No filter' },
    'rpt.default':              { tr: 'Varsayilan', en: 'Default' },
    'rpt.allRecords':           { tr: 'Tum kayitlar', en: 'All records' },
    'rpt.first10':              { tr: 'Ilk 10', en: 'First 10' },
    'rpt.first25':              { tr: 'Ilk 25', en: 'First 25' },
    'rpt.first50':              { tr: 'Ilk 50', en: 'First 50' },
    'rpt.first100':             { tr: 'Ilk 100', en: 'First 100' },
    'rpt.colHint':              { tr: 'secim yapilmazsa tum kolonlar dahil edilir', en: 'if no selection all columns included' },

    // ── Task Deployment ──
    'task.deployStatus':        { tr: 'Deployment Status', en: 'Deployment Status' },
    'task.deployMethod':        { tr: 'Deployment Method', en: 'Deployment Method' },
    'task.deployList':          { tr: 'OS / Task Sequence Deployments', en: 'OS / Task Sequence Deployments' },
    'task.taskSequence':        { tr: 'Task Sequence', en: 'Task Sequence' },
    'task.deployment':          { tr: 'Deployment', en: 'Deployment' },
    'task.method':              { tr: 'Method', en: 'Method' },
    'task.purpose':             { tr: 'Purpose', en: 'Purpose' },
    'task.success':             { tr: 'Success', en: 'Success' },

    // ── System Health table columns ──
    'sys.query':                { tr: 'Sorgu', en: 'Query' },
    'sys.recordCount':          { tr: 'Kayit Sayisi', en: 'Record Count' },
    'sys.duration':             { tr: 'Sure (sn)', en: 'Duration (sec)' },
    'sys.lastRun':              { tr: 'Son Calistirma', en: 'Last Run' },
    'sys.file':                 { tr: 'Dosya', en: 'File' },
    'sys.size':                 { tr: 'Boyut', en: 'Size' },

    // ── DB Monitor extra ──
    'db.compTab':               { tr: 'Component Status', en: 'Component Status' },
    'db.siteTab':               { tr: 'Site System', en: 'Site System' },
    'db.backupTab':             { tr: 'Backup', en: 'Backup' },

    // ── Bos Durum / Veri Kalitesi ──
    'empty.noData':             { tr: 'Bu ortamda kayit bulunmuyor', en: 'No records in this environment' },
    'empty.noDataHint':         { tr: 'Sorgu basariyla calisti ancak sonuc dondurmedi. Bu bir hata degildir — SCCM ortaminda bu alana ait veri henuz olusmamis olabilir.', en: 'The query ran successfully but returned no rows. This is not an error — the SCCM environment may simply have no data for this area yet.' },
    'empty.fetchError':         { tr: 'Veri dosyasi okunamadi', en: 'Data file could not be read' },
    'empty.fetchErrorHint':     { tr: 'Cache servisi henuz calismamis ya da JSON dosyasi eksik olabilir. Sag ustteki yenileme dugmesini deneyin.', en: 'The cache service may not have run yet, or the JSON file is missing. Try the refresh button in the top right.' },
    'empty.queryError':         { tr: 'Sorgu hata verdi', en: 'The query failed' },
    'empty.queryErrorHint':     { tr: 'Son cache yenilemesinde bu sorgu basarisiz oldu, bu nedenle veri gosterilemiyor.', en: 'This query failed during the last cache refresh, so no data can be shown.' },
    'empty.staleData':          { tr: 'Gosterilen veri son yenilemeden degil', en: 'Showing data from before the last refresh' },

    // ── Grafik ──
    'chart.other':              { tr: 'Diger', en: 'Other' },

    // ── Sayfaya ozel bos durum aciklamalari ──
    'ts.noDeployments':         { tr: 'Task Sequence dagitimi bulunamadi', en: 'No task sequence deployments found' },
    'ts.noDeploymentsHint':     { tr: 'Bu ortamda isletim sistemi dagitimi (OSD) yapilandirilmamis ya da v_TaskSequencePackage view erisilebilir degil olabilir.', en: 'OS deployment (OSD) may not be configured in this environment, or the v_TaskSequencePackage view may not be accessible.' },
    'cmg.noClients':            { tr: 'CMG istemcisi bulunamadi', en: 'No CMG clients found' },
    'cmg.noClientsHint':        { tr: 'Cloud Management Gateway yapilandirilmamis olabilir ya da hicbir istemci internet uzerinden baglanmiyor.', en: 'Cloud Management Gateway may not be configured, or no clients are connecting over the internet.' },
    'app.noPackages':           { tr: 'Package/Program dagitimi yok', en: 'No package/program deployments' },
    'app.noPackagesHint':       { tr: 'Bu ortamda klasik Package/Program dagitimi kullanilmiyor olabilir. Uygulama dagitimlari icin ilk sekmeye bakin.', en: 'This environment may not use classic Package/Program deployments. See the first tab for application deployments.' },
    'db.noBackup':              { tr: 'Yedek kaydi bulunamadi', en: 'No backup records found' },
    'db.noBackupHint':          { tr: 'msdb.dbo.backupset tablosunda bu veritabanina ait kayit yok. Yedek alinmamis ya da sorgu hesabinin msdb erisimi olmayabilir.', en: 'No rows for this database in msdb.dbo.backupset. Either no backup has been taken, or the query account lacks msdb access.' },
    'upd.noTrendHint':          { tr: 'Son 30 gunde dagitim tarihi olan bir update deployment bulunmuyor.', en: 'No update deployment with a deployment date in the last 30 days.' },

    // ── Cache / Otomatik Yenileme ──
    'cache.fresh':              { tr: 'Cache guncel', en: 'Cache is up to date' },
    'cache.stale':              { tr: 'Cache eskimis — refresh calismamis olabilir', en: 'Cache is stale — refresh may not have run' },
    'cache.serviceError':       { tr: 'Cache servisi hata veriyor', en: 'Cache service is reporting an error' },
    'cache.failedQueries':      { tr: 'sorgu basarisiz', en: 'failed queries' },
    'cache.newData':            { tr: 'Yeni veri', en: 'New data' },
    'cache.newDataHint':        { tr: 'Cache yenilendi — sayfayi yenilemek icin tiklayin', en: 'Cache refreshed — click to reload the page' },

    // ── RBAC ──
    'rbac.currentUser':         { tr: 'Aktif Kullanici', en: 'Current User' },
    'rbac.notSelected':         { tr: 'Secilmedi', en: 'Not selected' },
    'rbac.selectUser':          { tr: 'Bu tarayici icin kullanici sec', en: 'Select user for this browser' },
    'rbac.inactive':            { tr: 'RBAC pasif: bu tarayicida kullanici secilmedigi icin tum sayfalar acik.', en: 'RBAC inactive: no user selected in this browser, so all pages are open.' },
    'rbac.clientSideWarning':   { tr: 'Bu erisim kontrolu yalnizca arayuz seviyesindedir (localStorage). Gercek guvenlik icin IIS Windows Authentication ve klasor izinlerini kullanin.', en: 'This access control is UI-level only (localStorage). Use IIS Windows Authentication and folder permissions for real security.' },

    // ── Trend ──
    'page.trend':               { tr: 'Trend Analizi', en: 'Trend Analysis' },
    'trend.noHistory':          { tr: 'Henuz trend verisi yok. Cache refresh her calistiginda bir kayit eklenir.', en: 'No trend data yet. A snapshot is added on every cache refresh.' },
    'trend.range':              { tr: 'Zaman Araligi', en: 'Time Range' },
    'trend.last7':              { tr: 'Son 7 gun', en: 'Last 7 days' },
    'trend.last30':             { tr: 'Son 30 gun', en: 'Last 30 days' },
    'trend.all':                { tr: 'Tumu', en: 'All' },
    'trend.snapshots':          { tr: 'Anlik Goruntu', en: 'Snapshots' },
    'trend.period':             { tr: 'Kapsanan Sure', en: 'Period Covered' },
    'trend.days':               { tr: 'gun', en: 'days' },
    'trend.deviceCount':        { tr: 'Cihaz Sayisi', en: 'Device Count' },
    'trend.complianceTrend':    { tr: 'Update Compliance (%)', en: 'Update Compliance (%)' },
    'trend.failureTrend':       { tr: 'Basarisiz Deployment', en: 'Failed Deployments' },
    'trend.bitlockerTrend':     { tr: 'BitLocker Koruma Orani (%)', en: 'BitLocker Protection Rate (%)' },
    'trend.healthTrend':        { tr: 'Component Hatalari & Alertler', en: 'Component Errors & Alerts' },
    'trend.durationTrend':      { tr: 'Cache Refresh Suresi (sn)', en: 'Cache Refresh Duration (sec)' },
    'trend.change':             { tr: 'Degisim', en: 'Change' },
    'trend.table':              { tr: 'Gecmis Kayitlar', en: 'History Records' },
    'trend.timestamp':          { tr: 'Zaman', en: 'Timestamp' }
  };

  function get(key) {
    var entry = _strings[key];
    if (!entry) return key;
    return entry[_lang] || entry['en'] || key;
  }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('sccm-lang', lang);
  }

  function getLang() {
    return _lang;
  }

  function toggleLang() {
    var next = _lang === 'tr' ? 'en' : 'tr';
    setLang(next);
    return next;
  }

  // DataTables dil ayarlari
  function dtLang() {
    return {
      search: get('common.search'),
      lengthMenu: get('common.records'),
      info: get('common.info'),
      paginate: { next: get('common.next'), previous: get('common.prev') },
      emptyTable: get('common.emptyTable'),
      zeroRecords: get('common.zeroRecords')
    };
  }

  return {
    get: get,
    setLang: setLang,
    getLang: getLang,
    toggleLang: toggleLang,
    dtLang: dtLang
  };
})();
