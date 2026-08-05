/**
 * SCCM Dashboard — SCCM Health Page
 * Component/service status, site systems, inbox queues
 */
(function () {
  'use strict';

  var _compData = null;
  var _siteData = null;
  var _inboxData = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('sccm-health', Lang.get('page.sccmHealth'));

    var results = await Promise.all([
      Dashboard.fetchData('sccm_health'),
      Dashboard.fetchData('sccm_health_inbox'),
      Dashboard.fetchData('sccm_health_inbox_files')
    ]);
    _compData = results[0] || [];
    _siteData = results[1] || [];
    _inboxData = results[2] || [];

    renderAlerts();
    renderMetrics();
    renderCharts();
    renderComponentTable();
    renderSiteTable();
    renderInboxTable();
    bindTabs();
    bindFilters();
  }

  function renderAlerts() {
    var area = document.getElementById('alertArea');
    var alerts = [];

    var stopped = _compData.filter(function (d) { return d.State === 0; });
    var critical = _compData.filter(function (d) { return d.Status === 2; });
    var totalErrors = _compData.reduce(function (s, d) { return s + (d.Errors || 0); }, 0);

    if (critical.length > 0) {
      alerts.push({ level: 'critical', text: critical.length + ' ' + Lang.get('health.criticalComp') + '!' });
    }
    if (stopped.length > 0) {
      alerts.push({ level: 'warning', text: stopped.length + ' ' + Lang.get('health.stoppedComp') + ': ' +
        stopped.slice(0, 3).map(function (d) { return d.ComponentName; }).join(', ') +
        (stopped.length > 3 ? ' (+' + (stopped.length - 3) + ')' : '') });
    }
    if (totalErrors > 10) {
      alerts.push({ level: 'warning', text: Lang.get('common.total') + ' ' + totalErrors + ' ' + Lang.get('health.totalCompErrors') });
    }

    // Inbox queue warnings
    var bigQueues = _inboxData.filter(function (d) { return d.FileCount > 100; });
    if (bigQueues.length > 0) {
      alerts.push({ level: 'warning', text: bigQueues.length + ' ' + Lang.get('health.inboxBacklog') });
    }

    area.innerHTML = alerts.map(function (a) {
      return '<div class="alert-banner ' + a.level + '">' +
        (a.level === 'critical' ? '&#9888; ' : '&#9432; ') + a.text + '</div>';
    }).join('');
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _compData.length;
    var running = _compData.filter(function (d) { return d.State === 1; }).length;
    var stopped = _compData.filter(function (d) { return d.State === 0; }).length;
    var critical = _compData.filter(function (d) { return d.Status === 2; }).length;
    var warning = _compData.filter(function (d) { return d.Status === 1; }).length;
    var healthy = _compData.filter(function (d) { return d.Status === 0 && d.State === 1; }).length;
    var healthRate = total > 0 ? (healthy / total * 100) : 0;
    var hrColor = Dashboard.thresholdColor('sccmHealth', 'componentHealthPercent', healthRate, { warning: 90, critical: 70 }, false);

    c.appendChild(Dashboard.createMetricCard(Lang.get('health.totalComp'), Dashboard.formatNumber(total), {
      icon: '&#9881;', color: 'blue', sub: running + ' ' + Lang.get('health.running')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('health.healthy'), Dashboard.formatPercent(healthRate), {
      icon: '&#10003;', color: hrColor, statusClass: Dashboard.getStatusClass(hrColor),
      sub: healthy + ' / ' + total
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('health.stoppedServices'), Dashboard.formatNumber(stopped), {
      icon: '&#9724;', color: stopped > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(stopped > 0 ? 'red' : 'green')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('health.critWarn'), critical + ' / ' + warning, {
      icon: '&#9888;', color: critical > 0 ? 'red' : (warning > 0 ? 'yellow' : 'green'),
      statusClass: Dashboard.getStatusClass(critical > 0 ? 'red' : (warning > 0 ? 'yellow' : 'green'))
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    var st = Dashboard.statusColors();

    // State distribution
    var running = _compData.filter(function (d) { return d.State === 1; }).length;
    var stopped = _compData.filter(function (d) { return d.State === 0; }).length;
    var other = _compData.length - running - stopped;
    Dashboard.chart('chartState', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('health.running'), Lang.get('health.stopped'), Lang.get('health.other')],
        // Calisiyor/Durdu DURUM anlatir -> rezerve durum renkleri
        datasets: [{ data: [running, stopped, other], backgroundColor: [st.good, st.critical, Dashboard.chartMutedColor()] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Top error components (horizontal bar)
    var errorComps = _compData.filter(function (d) { return d.Errors > 0; })
      .sort(function (a, b) { return b.Errors - a.Errors; }).slice(0, 10);

    if (errorComps.length === 0) {
      errorComps = [{ ComponentName: Lang.get('health.noErrors'), Errors: 0, Warnings: 0 }];
    }

    Dashboard.chart('chartErrors', {
      type: 'bar',
      data: {
        labels: errorComps.map(function (d) { var n = d.ComponentName || ''; return n.length > 30 ? n.substring(0, 30) + '..' : n; }),
        datasets: [
          { label: Lang.get('health.errors'), data: errorComps.map(function (d) { return d.Errors; }), backgroundColor: colors[4], borderWidth: 0 },
          { label: Lang.get('health.warnings'), data: errorComps.map(function (d) { return d.Warnings; }), backgroundColor: colors[3], borderWidth: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { stacked: true, ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          y: { stacked: true, ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { position: 'top', labels: { color: Dashboard.chartFontColor() } } }
      }
    });
  }

  function renderComponentTable() {
    var rows = _compData.map(function (d) {
      var stateBadge = d.State === 1 ? Dashboard.statusBadge('Running', 'success') :
                       d.State === 0 ? Dashboard.statusBadge('Stopped', 'danger') :
                       Dashboard.statusBadge(d.StateName || 'Unknown', 'secondary');

      var statusBadge = d.Status === 0 ? Dashboard.statusBadge('OK', 'success') :
                        d.Status === 1 ? Dashboard.statusBadge('Warning', 'warning') :
                        d.Status === 2 ? Dashboard.statusBadge('Critical', 'danger') :
                        Dashboard.statusBadge('Unknown', 'secondary');

      return [
        Dashboard.escapeHtml(d.ComponentName),
        Dashboard.escapeHtml(d.SiteCode),
        stateBadge,
        statusBadge,
        d.Errors || 0,
        d.Warnings || 0,
        Dashboard.escapeHtml(d.TypeName || ''),
        Dashboard.formatDate(d.LastMessageTime)
      ];
    });

    _dt = $('#compTable').DataTable({
      data: rows, order: [[4, 'desc']], pageLength: 25,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [4, 5], className: 'dt-right' }]
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'sccm_health.csv');
    });
  }

  function renderSiteTable() {
    var rows = _siteData.map(function (d) {
      var statusBadge = d.Status === 0 ? Dashboard.statusBadge('OK', 'success') :
                        d.Status === 1 ? Dashboard.statusBadge('Warning', 'warning') :
                        Dashboard.statusBadge('Error', 'danger');
      var availBadge = d.AvailabilityState === 0 ? Dashboard.statusBadge(Lang.get('health.online'), 'success') :
                       d.AvailabilityState === 3 ? Dashboard.statusBadge(Lang.get('health.offline'), 'danger') :
                       Dashboard.statusBadge(Lang.get('common.unknown'), 'secondary');
      return [
        Dashboard.escapeHtml(d.SiteCode),
        Dashboard.escapeHtml(d.SiteSystem),
        Dashboard.escapeHtml(d.Role),
        statusBadge,
        availBadge
      ];
    });

    $('#siteTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 25, paging: false,
      language: Lang.dtLang()
    });
  }

  function renderInboxTable() {
    var rows = _inboxData.map(function (d) {
      return [
        Dashboard.escapeHtml(d.SiteCode),
        Dashboard.escapeHtml(d.InboxName),
        '<span style="font-weight:600;color:' + (d.FileCount > 100 ? 'var(--color-danger)' : d.FileCount > 20 ? 'var(--color-warning)' : 'var(--text-primary)') + '">' + d.FileCount + '</span>',
        Dashboard.formatDate(d.LastFileWriteTime)
      ];
    });

    $('#inboxTable').DataTable({
      data: rows, order: [[2, 'desc']], pageLength: 25, paging: false,
      language: Lang.dtLang()
    });
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

  function bindFilters() {
    var filterState = document.getElementById('filterState');
    if (filterState) {
      filterState.addEventListener('change', function () {
        var val = filterState.value;
        if (val === 'Stopped') _dt.columns(2).search('Stopped');
        else if (val === 'Started') _dt.columns(2).search('Running');
        else if (val === 'Critical') _dt.columns(3).search('Critical');
        else if (val === 'Warning') _dt.columns(3).search('Warning');
        else { _dt.columns(2).search(''); _dt.columns(3).search(''); }
        _dt.draw();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
