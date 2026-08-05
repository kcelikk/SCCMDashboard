/**
 * SCCM Dashboard — SCCM Alerts Page (SOC-style)
 * Active alerts, severity tracking, alert timeline
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('sccm-alerts', Lang.get('page.sccmAlerts'));
    _data = await Dashboard.fetchData('sccm_alerts');
    if (await Dashboard.bailIfEmpty('sccm_alerts', _data)) return;
    renderBanner();
    renderMetrics();
    renderCharts();
    renderActiveAlerts();
    renderTable();
    bindFilters();
  }

  // ── SOC-style top banner ──
  function renderBanner() {
    var banner = document.getElementById('alertBanner');
    var active = _data.filter(function (d) { return d.AlertState === 0; });
    var errors = active.filter(function (d) { return d.Severity === 1; });
    var warnings = active.filter(function (d) { return d.Severity === 2; });

    if (errors.length > 0) {
      banner.innerHTML = '<div class="soc-banner soc-critical">' +
        '<span class="soc-pulse"></span>' +
        '<strong>' + errors.length + ' ' + Lang.get('alert.critActive') + '</strong> | ' +
        warnings.length + ' ' + Lang.get('common.warning') + ' | ' + Lang.get('common.total') + ' ' + active.length + ' aktif alert' +
        '</div>';
    } else if (warnings.length > 0) {
      banner.innerHTML = '<div class="soc-banner soc-warning">' +
        '<strong>' + warnings.length + ' ' + Lang.get('alert.warnActive') + '</strong> | ' + Lang.get('common.total') + ' ' + active.length + ' aktif alert' +
        '</div>';
    } else if (active.length > 0) {
      banner.innerHTML = '<div class="soc-banner soc-info">' +
        '<strong>' + active.length + ' aktif alert</strong> (' + Lang.get('common.info_level') + ')' +
        '</div>';
    } else {
      banner.innerHTML = '<div class="soc-banner soc-ok">' +
        '&#10003; ' + Lang.get('alert.noActiveAlerts') +
        '</div>';
    }
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var active = _data.filter(function (d) { return d.AlertState === 0; }).length;
    var errors = _data.filter(function (d) { return d.Severity === 1; }).length;
    var warnings = _data.filter(function (d) { return d.Severity === 2; }).length;
    var postponed = _data.filter(function (d) { return d.AlertState === 1; }).length;

    c.appendChild(Dashboard.createMetricCard(Lang.get('alert.totalAlerts'), Dashboard.formatNumber(total), {
      icon: '&#9888;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.active'), Dashboard.formatNumber(active), {
      icon: '&#128308;', color: active > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(active > 0 ? 'red' : 'green')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.error'), Dashboard.formatNumber(errors), {
      icon: '&#10007;', color: errors > 0 ? 'red' : 'green'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.warning'), Dashboard.formatNumber(warnings), {
      icon: '&#9888;', color: warnings > 0 ? 'yellow' : 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    var st = Dashboard.statusColors();

    // Severity distribution
    var errorCount = _data.filter(function (d) { return d.Severity === 1; }).length;
    var warnCount = _data.filter(function (d) { return d.Severity === 2; }).length;
    var infoCount = _data.filter(function (d) { return d.Severity === 3; }).length;
    Dashboard.chart('chartSeverity', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('common.error'), Lang.get('common.warning'), Lang.get('common.info_level')],
        // Hata/Uyari/Bilgi DURUM anlatir -> rezerve durum renkleri.
        // Bilgi seviyesi "kotu" degildir; notr bir seri rengi alir.
        datasets: [{ data: [errorCount, warnCount, infoCount], backgroundColor: [st.critical, st.warning, colors[0]] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Alert state distribution
    var stateMap = {};
    _data.forEach(function (d) {
      var s = d.AlertStateName || 'Unknown';
      stateMap[s] = (stateMap[s] || 0) + 1;
    });
    var state = Dashboard.foldCategories(Object.keys(stateMap).map(function (k) {
      return { label: k, value: stateMap[k] };
    }), 6);
    Dashboard.chart('chartAlertState', {
      type: 'doughnut',
      data: {
        labels: state.labels,
        datasets: [{ data: state.values, backgroundColor: state.colors }]
      }
    });
  }

  // ── SOC-style active alerts list ──
  function renderActiveAlerts() {
    var container = document.getElementById('activeAlertsList');
    var active = _data.filter(function (d) { return d.AlertState === 0; })
      .sort(function (a, b) { return (a.Severity || 99) - (b.Severity || 99); });

    if (active.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--color-success)">&#10003; ' + Lang.get('alert.noActiveFound') + '</div>';
      return;
    }

    var html = '<div class="soc-alert-list">';
    active.forEach(function (d) {
      var sevClass = d.Severity === 1 ? 'soc-error' : (d.Severity === 2 ? 'soc-warn' : 'soc-info-item');
      var sevIcon = d.Severity === 1 ? '&#10007;' : (d.Severity === 2 ? '&#9888;' : '&#9432;');
      var sevLabel = d.Severity === 1 ? 'ERROR' : (d.Severity === 2 ? 'WARNING' : 'INFO');
      var age = d.DateCreated ? Dashboard.timeAgo(d.DateCreated) : '-';
      var lastMod = d.DateLastModified ? Dashboard.timeAgo(d.DateLastModified) : '-';

      html += '<div class="soc-alert-item ' + sevClass + '">' +
        '<div class="soc-alert-severity">' + sevIcon + ' ' + sevLabel + '</div>' +
        '<div class="soc-alert-body">' +
          '<div class="soc-alert-name">' + Dashboard.escapeHtml(d.AlertName) + '</div>' +
          '<div class="soc-alert-meta">' +
            Lang.get('alert.created') + ': ' + Dashboard.formatDate(d.DateCreated) + ' (' + age + ') | ' +
            Lang.get('alert.lastModified') + ': ' + lastMod + ' | ' +
            Lang.get('alert.occurrence') + ': ' + (d.OccurrenceCount || 1) + ' | ' +
            Lang.get('alert.source') + ': ' + Dashboard.escapeHtml(d.SourceSiteCode || '-') +
          '</div>' +
          (d.Comment ? '<div class="soc-alert-comment">' + Dashboard.escapeHtml(d.Comment) + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var sevBadge = d.Severity === 1 ? Dashboard.statusBadge(Lang.get('common.error'), 'danger') :
                     d.Severity === 2 ? Dashboard.statusBadge(Lang.get('common.warning'), 'warning') :
                     Dashboard.statusBadge(Lang.get('common.info_level'), 'info');

      var stateBadge = d.AlertState === 0 ? Dashboard.statusBadge('Active', 'danger') :
                       d.AlertState === 1 ? Dashboard.statusBadge('Postponed', 'warning') :
                       d.AlertState === 2 ? Dashboard.statusBadge('Canceled', 'secondary') :
                       Dashboard.statusBadge(d.AlertStateName || '-', 'secondary');

      return [
        sevBadge,
        Dashboard.escapeHtml(d.AlertName),
        stateBadge,
        Dashboard.escapeHtml(d.SourceSiteCode || '-'),
        Dashboard.formatDate(d.DateCreated),
        Dashboard.formatDate(d.DateLastModified),
        d.OccurrenceCount || 1
      ];
    });

    _dt = $('#alertTable').DataTable({
      data: rows, order: [[2, 'asc'], [0, 'asc']], pageLength: 25,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [6], className: 'dt-right' }]
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'sccm_alerts.csv');
    });
  }

  function bindFilters() {
    var filterSev = document.getElementById('filterSeverity');
    var filterState = document.getElementById('filterAlertState');

    function apply() {
      _dt.columns(0).search(filterSev.value);
      _dt.columns(2).search(filterState.value);
      _dt.draw();
    }
    if (filterSev) filterSev.addEventListener('change', apply);
    if (filterState) filterState.addEventListener('change', apply);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
