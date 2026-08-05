/**
 * SCCM Dashboard — Content Distribution Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('content-distribution', Lang.get('page.contentDist'));
    _data = await Dashboard.fetchData('content_distribution');
    if (await Dashboard.bailIfEmpty('content_distribution', _data)) return;
    renderAlerts();
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function renderAlerts() {
    var area = document.getElementById('alertArea');
    var totalErrors = _data.reduce(function (s, d) { return s + (d.NumberErrors || 0); }, 0);
    if (totalErrors > 0) {
      area.innerHTML = '<div class="alert-banner critical">&#9888; ' + totalErrors + ' ' + Lang.get('cd.failedDist') + '</div>';
    }
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var totalPkgs = _data.length;
    var totalTargeted = _data.reduce(function (s, d) { return s + (d.NumberTargeted || 0); }, 0);
    var totalInstalled = _data.reduce(function (s, d) { return s + (d.NumberInstalled || 0); }, 0);
    var totalErrors = _data.reduce(function (s, d) { return s + (d.NumberErrors || 0); }, 0);
    var totalInProg = _data.reduce(function (s, d) { return s + (d.NumberInProgress || 0); }, 0);
    var successRate = totalTargeted > 0 ? (totalInstalled / totalTargeted) * 100 : 0;
    var srColor = Dashboard.thresholdColor('contentDistribution', 'successRatePercent', successRate, { warning: 90, critical: 75 }, false);

    c.appendChild(Dashboard.createMetricCard(Lang.get('cd.totalPackage'), Dashboard.formatNumber(totalPkgs), {
      icon: '&#9776;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('cd.successRate'), Dashboard.formatPercent(successRate), {
      icon: '&#10003;', color: srColor, statusClass: Dashboard.getStatusClass(srColor),
      sub: totalInstalled + ' / ' + totalTargeted
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('upd.failedUpdates'), Dashboard.formatNumber(totalErrors), {
      icon: '&#10007;', color: totalErrors > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(totalErrors > 0 ? 'red' : 'green')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('app.inProgress'), Dashboard.formatNumber(totalInProg), {
      icon: '&#9203;', color: totalInProg > 0 ? 'yellow' : 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    var st = Dashboard.statusColors();

    // Status overview
    var installed = _data.reduce(function (s, d) { return s + (d.NumberInstalled || 0); }, 0);
    var errors = _data.reduce(function (s, d) { return s + (d.NumberErrors || 0); }, 0);
    var inProg = _data.reduce(function (s, d) { return s + (d.NumberInProgress || 0); }, 0);
    Dashboard.chart('chartState', {
      type: 'doughnut',
      data: {
        labels: ['Installed', 'Failed', 'In Progress'],
        // Installed/Failed/InProgress DURUM anlatir -> rezerve durum renkleri
        datasets: [{ data: [installed, errors, inProg], backgroundColor: [st.good, st.critical, st.warning] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Package type distribution
    var typeMap = {};
    _data.forEach(function (d) {
      var t = d.PackageTypeName || 'Other';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    var typeLabels = Object.keys(typeMap);
    Dashboard.chart('chartType', {
      type: 'bar',
      data: {
        labels: typeLabels,
        datasets: [{ data: typeLabels.map(function (k) { return typeMap[k]; }), backgroundColor: colors[2], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          x: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var pct = d.SuccessPercent || 0;
      var badge = pct >= 100 ? Dashboard.statusBadge(pct + '%', 'success') :
                  d.NumberErrors > 0 ? Dashboard.statusBadge(pct + '% (' + d.NumberErrors + ' err)', 'danger') :
                  Dashboard.statusBadge(pct + '%', 'warning');

      return [
        Dashboard.escapeHtml(d.PackageName),
        Dashboard.escapeHtml(d.PackageTypeName),
        d.NumberTargeted || 0,
        d.NumberInstalled || 0,
        d.NumberErrors || 0,
        badge
      ];
    });

    _dt = $('#cdTable').DataTable({
      data: rows, order: [[4, 'desc']], pageLength: 20,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [2, 3, 4], className: 'dt-right' }]
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'content_distribution.csv');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
