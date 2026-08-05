/**
 * SCCM Dashboard — System Health (Self-Monitoring) Page
 * Live sync status, query performance, data file monitoring
 */
(function () {
  'use strict';

  var DATA_FILES = [
    'asset', 'server', 'client_pc', 'app_inventory', 'app_inventory_detail',
    'update_deployment', 'update_deployment_detail', 'app_deployment',
    'app_deployment_detail', 'app_deployment_pkg', 'bitlocker',
    'cmg', 'cmg_clients', 'db_monitor', 'db_monitor_dbinfo',
    'db_monitor_site', 'db_monitor_backup', 'sccm_health',
    'sccm_health_inbox', 'sccm_health_inbox_files', 'sccm_health_replication',
    'task_deployment', 'task_deployment_detail', 'hardware_firmware',
    'laps', 'content_distribution', 'sccm_alerts'
  ];

  var _meta = null;
  var _syncTimer = null;

  async function init() {
    await Dashboard.init('system-health', Lang.get('page.systemHealth'));
    window._pageReload = reload;

    _meta = await Dashboard.fetchData('_cache_meta');
    renderAlerts();
    renderMetrics();
    renderQueryTable();
    renderCharts();
    await renderDataFiles();
    await renderSyncStatus();
    renderLog();
    bindTabs();
  }

  // ── Alerts ──
  function renderAlerts() {
    var area = document.getElementById('alertArea');
    var alerts = [];

    if (!_meta) {
      alerts.push({ level: 'critical', text: Lang.get('common.cacheNotFound') + '! Cache servisi henuz calistirilmamis olabilir.' });
    } else {
      if (_meta.status === 'error') {
        alerts.push({ level: 'critical', text: Lang.get('dash.cacheError') + '!' });
      } else if (_meta.status === 'partial_error') {
        var errCount = _meta.queries ? _meta.queries.filter(function (q) { return q.status !== 'OK'; }).length : 0;
        alerts.push({ level: 'warning', text: errCount + ' ' + Lang.get('dash.cacheSomeErrors') });
      }

      if (_meta.lastRefresh) {
        var ageMs = Date.now() - new Date(_meta.lastRefresh).getTime();
        if (ageMs > 120 * 60 * 1000) {
          alerts.push({ level: 'critical', text: 'Cache verisi 2 saatten eski! Son: ' + Dashboard.timeAgo(_meta.lastRefresh) });
        } else if (ageMs > 90 * 60 * 1000) {
          alerts.push({ level: 'warning', text: 'Cache verisi bayatlamis. Son: ' + Dashboard.timeAgo(_meta.lastRefresh) });
        }
      }
    }

    area.innerHTML = alerts.map(function (a) {
      return '<div class="alert-banner ' + a.level + '">' +
        (a.level === 'critical' ? '&#9888; ' : '&#9432; ') + a.text + '</div>';
    }).join('');
  }

  // ── Metrics ──
  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var totalQueries = _meta && _meta.queries ? _meta.queries.length : 0;
    var successQueries = _meta && _meta.queries ? _meta.queries.filter(function (q) { return q.status === 'OK'; }).length : 0;
    var errorQueries = totalQueries - successQueries;
    var successRate = totalQueries > 0 ? (successQueries / totalQueries * 100) : 0;
    var rateColor = Dashboard.thresholdColor('systemHealth', 'querySuccessPercent', successRate, { warning: 90, critical: 70 }, false);

    c.appendChild(Dashboard.createMetricCard('Cache', _meta ? (_meta.status === 'ok' ? Lang.get('common.ok') : Lang.get('common.error')) : Lang.get('common.unknown'), {
      icon: '&#9881;',
      color: _meta && _meta.status === 'ok' ? 'green' : 'red',
      statusClass: Dashboard.getStatusClass(_meta && _meta.status === 'ok' ? 'green' : 'red'),
      sub: _meta ? Dashboard.timeAgo(_meta.lastRefresh) : '-'
    }));

    c.appendChild(Dashboard.createMetricCard(Lang.get('sys.querySuccessRate'), Dashboard.formatPercent(successRate), {
      icon: '&#10003;', color: rateColor, statusClass: Dashboard.getStatusClass(rateColor),
      sub: successQueries + ' / ' + totalQueries
    }));

    c.appendChild(Dashboard.createMetricCard(Lang.get('common.error'), errorQueries, {
      icon: '&#9888;', color: errorQueries > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(errorQueries > 0 ? 'red' : 'green')
    }));

    var duration = _meta ? _meta.duration : '-';
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.total') + ' ' + 'Sure', typeof duration === 'number' ? duration.toFixed(1) + ' sn' : duration, {
      icon: '&#9201;', color: 'blue', sub: 'son cache refresh suresi'
    }));
  }

  // ── Query Table ──
  function renderQueryTable() {
    if (!_meta || !_meta.queries) {
      document.getElementById('queryTable').closest('.table-card').innerHTML +=
        '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
      return;
    }

    var rows = _meta.queries.map(function (q) {
      var statusBadge = q.status === 'OK'
        ? Dashboard.statusBadge(Lang.get('common.ok'), 'success')
        : Dashboard.statusBadge(Lang.get('common.error'), 'danger');

      return [
        Dashboard.escapeHtml(q.name || ''),
        statusBadge,
        q.records != null ? Dashboard.formatNumber(q.records) : '-',
        q.duration != null ? q.duration.toFixed(2) + ' sn' : '-',
        Dashboard.formatDate(_meta.lastRefresh),
        q.error ? '<span class="text-danger">' + Dashboard.escapeHtml(q.error.substring(0, 100)) + '</span>' : '-'
      ];
    });

    $('#queryTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 25, paging: false,
      language: Lang.dtLang()
    });
  }

  // ── Charts ──
  function renderCharts() {
    if (!_meta || !_meta.queries) return;
    var colors = Dashboard.chartColors();

    // Query status pie
    var ok = _meta.queries.filter(function (q) { return q.status === 'OK'; }).length;
    var err = _meta.queries.length - ok;

    Dashboard.chart('chartQueryStatus', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('common.ok'), Lang.get('common.error')],
        datasets: [{ data: [ok, err], backgroundColor: [colors[1], colors[4]], }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } }
      }
    });

    // Query duration bar
    var queryNames = _meta.queries.map(function (q) {
      var name = q.name || '';
      return name.length > 25 ? name.substring(0, 25) + '..' : name;
    });
    var durations = _meta.queries.map(function (q) { return q.duration || 0; });
    var barColors = _meta.queries.map(function (q) { return q.status === 'OK' ? colors[1] : colors[4]; });

    Dashboard.chart('chartQueryTimes', {
      type: 'bar',
      data: {
        labels: queryNames,
        datasets: [{ label: 'Sure (sn)', data: durations, backgroundColor: barColors, borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          y: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // ── Data Files ──
  async function renderDataFiles() {
    var fetches = DATA_FILES.map(function (name) {
      return Dashboard.fetchData(name).then(function (data) {
        var status, count, size;
        if (data === null) {
          status = Dashboard.statusBadge(Lang.get('common.error'), 'danger');
          count = '-';
          size = '-';
        } else if (Array.isArray(data)) {
          status = Dashboard.statusBadge('OK', 'success');
          count = Dashboard.formatNumber(data.length);
          size = roughSize(JSON.stringify(data).length);
        } else {
          status = Dashboard.statusBadge('OK', 'success');
          count = '1';
          size = roughSize(JSON.stringify(data).length);
        }
        return [name + '.json', size, count, status];
      });
    });

    var rows = await Promise.all(fetches);

    $('#dataFilesTable').DataTable({
      data: rows, order: [[0, 'asc']], paging: false,
      language: Lang.dtLang()
    });
  }

  // ══════════════════════════════════════════════════════
  // LIVE SYNC STATUS
  // ══════════════════════════════════════════════════════
  async function renderSyncStatus() {
    var container = document.getElementById('syncStatusPanel');
    if (!container) return;

    await updateSyncStatus(container);

    // Auto-refresh her 3 saniye (sync calisiyor ise)
    _syncTimer = setInterval(function () { updateSyncStatus(container); }, 3000);
  }

  async function updateSyncStatus(container) {
    var sync = null;
    try {
      var resp = await fetch('/data/_sync_status.json?_=' + Date.now());
      if (resp.ok) sync = await resp.json();
    } catch (e) { /* dosya yok */ }

    if (!sync) {
      container.innerHTML = '<div class="sync-idle"><span class="sync-dot idle"></span> ' + Lang.get('common.unknown') + '</div>';
      return;
    }

    var isRunning = (sync.phase === 'running' || sync.phase === 'connecting');
    var isComplete = sync.phase === 'completed';
    var isError = sync.phase === 'error';

    // Timer'i durdur tamamlandiysa veya hata aldiysa
    if (!isRunning && _syncTimer) {
      clearInterval(_syncTimer);
      _syncTimer = null;
    }
    // Yeni refresh basladiysa timer'i tekrar baslat
    if (isRunning && !_syncTimer) {
      _syncTimer = setInterval(function () { updateSyncStatus(container); }, 3000);
    }

    var html = '<div class="sync-panel">';

    // Durum satiri
    var phaseText = {
      'connecting': 'SQL baglantiyor...',
      'running': 'Sorgular calisiyor...',
      'completed': 'Tamamlandi',
      'error': Lang.get('common.error') + '!'
    };
    var dotClass = isRunning ? 'running' : (isError ? 'error' : (isComplete ? 'complete' : 'idle'));
    html += '<div class="sync-header">';
    html += '<span class="sync-dot ' + dotClass + '"></span> ';
    html += '<strong>' + (phaseText[sync.phase] || sync.phase) + '</strong>';
    if (sync.elapsedSeconds != null) html += ' <span class="sync-elapsed">' + sync.elapsedSeconds.toFixed(0) + ' sn</span>';
    html += '</div>';

    // Progress bar
    var pct = sync.progressPercent || 0;
    html += '<div class="sync-progress-wrap">';
    html += '<div class="sync-progress-bar" style="width:' + pct + '%"></div>';
    html += '</div>';
    html += '<div class="sync-progress-text">' + (sync.completedCount || 0) + ' / ' + (sync.totalCount || 0) + ' sorgu (' + pct + '%)</div>';

    // Aktif sorgu
    if (sync.currentQuery) {
      html += '<div class="sync-current">Calisan sorgu: <strong>' + Dashboard.escapeHtml(sync.currentQuery) + '</strong></div>';
    }

    // Sorgu detay tablosu
    if (sync.queries && sync.queries.length > 0) {
      html += '<table class="sync-table"><thead><tr><th>Sorgu</th><th>' + Lang.get('asset.status') + '</th><th>Kayit</th><th>Sure</th></tr></thead><tbody>';
      sync.queries.forEach(function (q) {
        var icon = q.status === 'OK' ? '<span style="color:var(--color-success)">&#10003;</span>' : '<span style="color:var(--color-danger)">&#10007;</span>';
        html += '<tr>';
        html += '<td>' + Dashboard.escapeHtml(q.name) + '</td>';
        html += '<td>' + icon + '</td>';
        html += '<td>' + Dashboard.formatNumber(q.records) + '</td>';
        html += '<td>' + (q.duration != null ? q.duration.toFixed(1) + ' sn' : '-') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    // Bekleyen sorgular
    if (isRunning && sync.totalCount > 0 && sync.completedCount < sync.totalCount) {
      var remaining = sync.totalCount - sync.completedCount;
      html += '<div class="sync-remaining">' + remaining + ' sorgu kaldi</div>';
    }

    if (sync.error) {
      html += '<div class="sync-error">' + Lang.get('common.error') + ': ' + Dashboard.escapeHtml(sync.error) + '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ── Log Viewer ──
  function renderLog() {
    var viewer = document.getElementById('logViewer');
    if (!_meta) {
      viewer.textContent = Lang.get('common.cacheNotFound') + '. Henuz cache refresh calistirilmamis olabilir.';
      return;
    }

    var log = '';
    log += '=== Cache Refresh Sonuclari ===\n';
    log += 'Son Calistirma : ' + (_meta.lastRefresh || '-') + '\n';
    log += 'Durum          : ' + (_meta.status || '-') + '\n';
    log += 'Toplam Sure    : ' + (_meta.duration || '-') + ' sn\n';
    log += 'Sorgu Sayisi   : ' + (_meta.queries ? _meta.queries.length : 0) + '\n\n';

    if (_meta.queries && _meta.queries.length > 0) {
      log += '=== Sorgu Detaylari ===\n';
      log += 'Sorgu                          Durum   Kayit        Sure        Hata\n';
      log += '-----------------------------  ------  -----------  ----------  ----\n';

      _meta.queries.forEach(function (q) {
        var name = (q.name || '?').padEnd(30);
        var status = (q.status === 'OK' ? '  OK  ' : ' FAIL ');
        var records = String(q.records != null ? q.records : '-').padStart(10);
        var dur = q.duration != null ? (q.duration.toFixed(2) + ' sn').padStart(10) : '         -';
        var err = q.error ? q.error.substring(0, 60) : '';
        log += name + status + records + '  ' + dur + '  ' + err + '\n';
      });

      // Performans ozeti
      log += '\n=== Performans Ozeti ===\n';
      var sorted = _meta.queries.slice().sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); });
      log += 'En yavas 5 sorgu:\n';
      sorted.slice(0, 5).forEach(function (q, i) {
        log += '  ' + (i + 1) + '. ' + (q.name || '?') + ' — ' + (q.duration || 0).toFixed(2) + ' sn (' + (q.records || 0) + ' kayit)\n';
      });
    }

    viewer.textContent = log;
  }

  function roughSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function bindTabs() {
    document.querySelectorAll('.tab-bar .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab-bar .tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var target = document.getElementById(tab.getAttribute('data-tab'));
        if (target) target.classList.add('active');
      });
    });
  }

  async function reload() {
    _meta = await Dashboard.fetchData('_cache_meta');
    renderAlerts();
    renderMetrics();
    renderLog();
    // Sync status panelini tekrar baslat
    var container = document.getElementById('syncStatusPanel');
    if (container) {
      await updateSyncStatus(container);
      if (!_syncTimer) {
        _syncTimer = setInterval(function () { updateSyncStatus(container); }, 3000);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
