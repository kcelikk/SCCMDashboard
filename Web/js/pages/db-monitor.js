/**
 * SCCM Dashboard — DB Monitor Page
 */
(function () {
  'use strict';

  var _compData = null;
  var _siteData = null;
  var _dbData = null;
  var _backupData = null;
  var _dtComp = null;
  var _dtSite = null;

  async function init() {
    await Dashboard.init('db-monitor', Lang.get('page.dbMonitor'));

    _compData = await Dashboard.fetchData('db_monitor');
    _siteData = await Dashboard.fetchData('db_monitor_site');
    _dbData = await Dashboard.fetchData('db_monitor_dbinfo');
    _backupData = await Dashboard.fetchData('db_monitor_backup');

    renderMetrics();
    renderCharts();
    renderDBInfo();
    renderCompTable();
    renderSiteTable();
    renderBackupTable();
    bindTabs();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var totalComp = (_compData || []).length;
    var totalErrors = (_compData || []).reduce(function (s, d) { return s + (d.Errors || 0); }, 0);
    var totalWarnings = (_compData || []).reduce(function (s, d) { return s + (d.Warnings || 0); }, 0);

    var dbSize = 'N/A';
    if (_dbData && _dbData.length > 0) {
      dbSize = (_dbData[0].SizeMB / 1024).toFixed(2) + ' GB';
    }

    var lastBackup = 'N/A';
    var backupAge = null;
    if (_backupData && _backupData.length > 0) {
      lastBackup = Dashboard.formatDate(_backupData[0].LastBackupDate);
      backupAge = _backupData[0].HoursSinceBackup;
    }

    c.appendChild(Dashboard.createMetricCard('Components', Dashboard.formatNumber(totalComp), {
      icon: '&#9881;', color: 'blue'
    }));

    var errColor = Dashboard.thresholdColor('dbMonitor', 'componentErrors', totalErrors, { warning: 1, critical: 5 }, true);
    c.appendChild(Dashboard.createMetricCard(Lang.get('health.errors'), Dashboard.formatNumber(totalErrors), {
      icon: '&#10007;', color: errColor, statusClass: Dashboard.getStatusClass(errColor)
    }));

    c.appendChild(Dashboard.createMetricCard(Lang.get('health.warnings'), Dashboard.formatNumber(totalWarnings), {
      icon: '&#9888;', color: totalWarnings > 0 ? 'yellow' : 'green'
    }));

    // backupAgeDays config'te GUN cinsinden, veri SAAT cinsinden geliyor
    var ageDays = Dashboard.threshold('dbMonitor', 'backupAgeDays', { warning: 1, critical: 3 });
    var backupColor = 'green';
    if (backupAge !== null) {
      backupColor = Dashboard.getThresholdColor(backupAge, ageDays.warning * 24, ageDays.critical * 24, true);
    }
    // Yedek yasi olculuyor ve renklendiriliyor — kart bunu gostermeli.
    // (Onceden backupColor hesaplaniyor ama kullanilmiyordu; kart sabit
    // 'purple' ciziliyordu, yani gecikmis yedek gorsel olarak fark edilmiyordu.)
    c.appendChild(Dashboard.createMetricCard(Lang.get('db.lastBackup'), lastBackup, {
      icon: '&#128190;',
      color: backupAge === null ? 'blue' : backupColor,
      statusClass: backupAge === null ? '' : Dashboard.getStatusClass(backupColor),
      sub: backupAge === null
        ? Lang.get('db.noBackup')
        : Lang.get('db.dbSize') + ': ' + dbSize + ' · ' + backupAge + ' ' + Lang.get('db.hoursAgo')
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    // Normal/Uyari/Hata KIMLIK degil DURUM anlatir -> rezerve durum renkleri
    var st = Dashboard.statusColors();

    if (!_compData || _compData.length === 0) return;

    var ok = _compData.filter(function (d) { return d.Errors === 0 && d.Warnings === 0; }).length;
    var warn = _compData.filter(function (d) { return d.Errors === 0 && d.Warnings > 0; }).length;
    var err = _compData.filter(function (d) { return d.Errors > 0; }).length;

    Dashboard.chart('chartComponents', {
      type: 'doughnut',
      data: {
        labels: ['Normal', Lang.get('common.warning'), Lang.get('common.error')],
        datasets: [{ data: [ok, warn, err], backgroundColor: [st.good, st.warning, st.critical] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });
  }

  function renderDBInfo() {
    var panel = document.getElementById('dbSizePanel');
    if (!_dbData || _dbData.length === 0) {
      panel.innerHTML = '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
      return;
    }

    var db = _dbData[0];
    var totalGB = (db.SizeMB / 1024).toFixed(2);
    var dataGB = (db.DataSizeMB / 1024).toFixed(2);
    var logGB = (db.LogSizeMB / 1024).toFixed(2);
    var dataPercent = db.SizeMB > 0 ? (db.DataSizeMB / db.SizeMB * 100).toFixed(0) : 0;

    panel.innerHTML =
      '<div style="margin-bottom:16px">' +
        '<div style="font-weight:600;font-size:var(--font-size-lg);margin-bottom:12px">' + Dashboard.escapeHtml(db.DatabaseName) + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div class="panel-info-item"><div class="label">' + Lang.get('common.total') + '</div><div class="value">' + totalGB + ' GB</div></div>' +
          '<div class="panel-info-item"><div class="label">Data</div><div class="value">' + dataGB + ' GB</div></div>' +
          '<div class="panel-info-item"><div class="label">Log</div><div class="value">' + logGB + ' GB</div></div>' +
          '<div class="panel-info-item"><div class="label">Data %</div><div class="value">' + dataPercent + '%</div></div>' +
        '</div>' +
        '<div class="progress-bar" style="margin-top:12px"><div class="fill green" style="width:' + dataPercent + '%"></div></div>' +
        '<div style="font-size:var(--font-size-xs);color:var(--text-secondary);margin-top:4px">Data: ' + dataPercent + '% | Log: ' + (100 - dataPercent) + '%</div>' +
      '</div>';
  }

  function renderCompTable() {
    if (!_compData) return;
    var rows = _compData.map(function (d) {
      var badge;
      if (d.Errors > 0) badge = Dashboard.statusBadge(Lang.get('common.error'), 'danger');
      else if (d.Warnings > 0) badge = Dashboard.statusBadge(Lang.get('common.warning'), 'warning');
      else badge = Dashboard.statusBadge('Normal', 'success');

      return [
        Dashboard.escapeHtml(d.ComponentName),
        Dashboard.escapeHtml(d.SiteCode),
        badge,
        d.Errors || 0,
        d.Warnings || 0,
        d.State != null ? d.State : '-'
      ];
    });

    _dtComp = $('#compTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 20,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [3,4], className: 'dt-right' }]
    });

    document.querySelector('.btn-export[data-target="comp"]').addEventListener('click', function () {
      CSVExport.exportDataTable(_dtComp, 'component_status.csv');
    });
  }

  function renderSiteTable() {
    if (!_siteData) return;
    var rows = _siteData.map(function (d) {
      var badge;
      var st = d.Status;
      if (st === 0) badge = Dashboard.statusBadge('Normal', 'success');
      else if (st === 1) badge = Dashboard.statusBadge(Lang.get('common.warning'), 'warning');
      else badge = Dashboard.statusBadge(Lang.get('common.error'), 'danger');

      return [
        Dashboard.escapeHtml(d.SiteSystem),
        Dashboard.escapeHtml(d.Role),
        Dashboard.escapeHtml(d.SiteCode),
        badge,
        d.AvailabilityState != null ? d.AvailabilityState : '-'
      ];
    });

    _dtSite = $('#siteTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 20,
      language: Lang.dtLang()
    });

    document.querySelector('.btn-export[data-target="site"]').addEventListener('click', function () {
      CSVExport.exportDataTable(_dtSite, 'site_system_status.csv');
    });
  }

  function renderBackupTable() {
    // Yedek gecmisi bos olabilir (msdb.backupset'e erisim yoksa ya da bu
    // instance'ta hic yedek alinmamissa). Bos tablo yerine nedenini soyle.
    if (!_backupData || _backupData.length === 0) {
      var host = document.getElementById('backupTable');
      if (host && host.parentNode) {
        host.parentNode.innerHTML = Dashboard.emptyStateHtml(
          { kind: _backupData ? 'empty' : 'fetch-error' },
          { title: Lang.get('db.noBackup'), hint: Lang.get('db.noBackupHint') }
        );
      }
      return;
    }

    var backupTypeLabel = function (t) {
      switch (t) { case 'D': return 'Full'; case 'I': return 'Differential'; case 'L': return 'Log'; default: return t; }
    };

    var rows = _backupData.map(function (d) {
      var ageColor = d.HoursSinceBackup > 72 ? 'danger' : (d.HoursSinceBackup > 24 ? 'warning' : 'success');
      return [
        Dashboard.escapeHtml(d.DatabaseName),
        backupTypeLabel(d.BackupType),
        Dashboard.formatDate(d.LastBackupDate),
        Dashboard.statusBadge(d.HoursSinceBackup + ' ' + Lang.get('db.hoursAgo'), ageColor)
      ];
    });

    $('#backupTable').DataTable({
      data: rows, paging: false, searching: false, info: false,
      language: Lang.dtLang()
    });
  }

  function bindTabs() {
    document.querySelectorAll('.tab-bar .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab-bar .tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (tc) { tc.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
