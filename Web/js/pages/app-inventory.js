/**
 * SCCM Dashboard — App Inventory Page
 */
(function () {
  'use strict';

  var _data = null;
  var _detailData = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('app-inventory', Lang.get('page.appInventory'));
    _data = await Dashboard.fetchData('app_inventory');
    // _detailData lazy load: tiklama aninda yuklenir
    if (await Dashboard.bailIfEmpty('app_inventory', _data)) return;
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var totalApps = _data.length;
    var publishers = new Set(_data.map(function (d) { return d.Publisher; }).filter(Boolean));
    var totalInstalls = _data.reduce(function (s, d) { return s + (d.InstalledCount || 0); }, 0);

    c.appendChild(Dashboard.createMetricCard(Lang.get('inv.appInventory'), Dashboard.formatNumber(totalApps), {
      icon: '&#9776;', color: 'blue', sub: 'Benzersiz uygulama/version'
    }));
    c.appendChild(Dashboard.createMetricCard('Publisher', Dashboard.formatNumber(publishers.size), {
      icon: '&#9733;', color: 'purple'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('inv.installedDevices'), Dashboard.formatNumber(totalInstalls), {
      icon: '&#9881;', color: 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();

    // Top 10 apps by install count
    var top10 = _data.slice(0, 10);
    Dashboard.chart('chartTop', {
      type: 'bar',
      data: {
        labels: top10.map(function (d) { var n = d.AppName || ''; return n.length > 25 ? n.substr(0, 25) + '...' : n; }),
        datasets: [{ data: top10.map(function (d) { return d.InstalledCount; }), backgroundColor: colors[0], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { ticks: { color: Dashboard.chartFontColor(), stepSize: 1 }, grid: { color: Dashboard.chartGridColor() } },
          y: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Top 10 publishers
    var pubMap = {};
    _data.forEach(function (d) {
      var p = d.Publisher || Lang.get('common.unknown');
      pubMap[p] = (pubMap[p] || 0) + (d.InstalledCount || 0);
    });
    var pubEntries = Object.entries(pubMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    Dashboard.chart('chartPublisher', {
      type: 'bar',
      data: {
        labels: pubEntries.map(function (e) { var n = e[0]; return n.length > 25 ? n.substr(0, 25) + '...' : n; }),
        datasets: [{ data: pubEntries.map(function (e) { return e[1]; }), backgroundColor: colors[2], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { ticks: { color: Dashboard.chartFontColor(), stepSize: 1 }, grid: { color: Dashboard.chartGridColor() } },
          y: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      return [
        Dashboard.escapeHtml(d.AppName),
        Dashboard.escapeHtml(d.Publisher),
        Dashboard.escapeHtml(d.Version),
        d.InstalledCount || 0
      ];
    });

    _dt = $('#appTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 25,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [3], className: 'dt-right' }],
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#appTable tbody').on('click', 'tr', async function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      await showDetail(rowData[0], rowData[1], rowData[2]);
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'app_inventory.csv');
    });
  }

  async function showDetail(appName, publisher, version) {
    // Lazy load: ilk tiklama'da yukle
    if (!_detailData) { _detailData = await Dashboard.fetchData('app_inventory_detail') || []; }
    var details = _detailData.filter(function (d) {
      return d.AppName === appName && d.Version === version;
    });

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('inv.appName') + '</div><div class="value">' + Dashboard.escapeHtml(appName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Publisher</div><div class="value">' + Dashboard.escapeHtml(publisher) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Version</div><div class="value">' + Dashboard.escapeHtml(version) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('inv.installedDevices') + '</div><div class="value">' + details.length + '</div></div>' +
      '</div>';

    if (details.length > 0) {
      html += '<table class="panel-table"><thead><tr><th>' + Lang.get('asset.hostname') + '</th><th>' + Lang.get('upd.date') + '</th></tr></thead><tbody>';
      details.forEach(function (d) {
        html += '<tr><td>' + Dashboard.escapeHtml(d.Hostname) + '</td><td>' + Dashboard.escapeHtml(d.InstallDate) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    SlidePanel.open(appName, html, {
      exportData: details,
      exportFilename: 'app_detail_' + appName.replace(/[^a-zA-Z0-9]/g, '_') + '.csv'
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
