/**
 * SCCM Dashboard — App Deployment Page
 */
(function () {
  'use strict';

  var _appData = null;
  var _pkgData = null;
  var _detailData = null;
  var _dtApp = null;
  var _dtPkg = null;

  async function init() {
    await Dashboard.init('app-deployment', Lang.get('page.appDeployment'));

    var results = await Promise.all([
      Dashboard.fetchData('app_deployment'),
      Dashboard.fetchData('app_deployment_pkg')
    ]);
    _appData = results[0];
    _pkgData = results[1];
    // _detailData lazy load: tiklama aninda yuklenir

    // Sayfanin ana veri kaynagi app_deployment; paket sekmesi bos olabilir
    // (bu ortamda klasik Package/Program dagitimi kullanilmiyor olabilir).
    if (await Dashboard.bailIfEmpty('app_deployment', _appData)) return;

    _pkgData = _pkgData || [];

    renderMetrics();
    renderCharts();
    renderAppTable();
    renderPkgTable();
    bindTabs();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var allApps = _appData;
    var totalDep = allApps.length + _pkgData.length;
    var totalSuccess = allApps.reduce(function (s, d) { return s + (d.Success || 0); }, 0);
    var totalFailed = allApps.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var totalDevices = allApps.reduce(function (s, d) { return s + (d.TotalDevices || 0); }, 0);
    var totalInProgress = allApps.reduce(function (s, d) { return s + (d.InProgress || 0); }, 0);

    var successRate = totalDevices > 0 ? (totalSuccess / totalDevices) * 100 : 0;
    var srColor = Dashboard.thresholdColor('appDeployment', 'successRatePercent', successRate, { warning: 85, critical: 70 }, false);

    c.appendChild(Dashboard.createMetricCard(Lang.get('upd.totalDeployment'), Dashboard.formatNumber(totalDep), {
      icon: '&#9654;', color: 'blue', sub: allApps.length + ' app + ' + _pkgData.length + ' package'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('app.successRate'), Dashboard.formatPercent(successRate), {
      icon: '&#10003;', color: srColor, statusClass: Dashboard.getStatusClass(srColor)
    }));

    var failColor = Dashboard.thresholdColor('appDeployment', 'failedCount', totalFailed, { warning: 5, critical: 15 }, true);
    c.appendChild(Dashboard.createMetricCard(Lang.get('upd.failedUpdates'), Dashboard.formatNumber(totalFailed), {
      icon: '&#10007;', color: failColor, statusClass: Dashboard.getStatusClass(failColor)
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('app.inProgress'), Dashboard.formatNumber(totalInProgress), {
      icon: '&#9203;', color: totalInProgress > 0 ? 'yellow' : 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    // Success/Failed/... KIMLIK degil DURUM anlatir -> rezerve durum renkleri
    var st = Dashboard.statusColors();

    // Status distribution (app deployments)
    var success = _appData.reduce(function (s, d) { return s + (d.Success || 0); }, 0);
    var failed = _appData.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var inProg = _appData.reduce(function (s, d) { return s + (d.InProgress || 0); }, 0);
    var other = _appData.reduce(function (s, d) { return s + (d.RequirementsNotMet || 0) + (d.Other || 0); }, 0);

    Dashboard.chart('chartStatus', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('app.successful'), Lang.get('upd.failedUpdates'), Lang.get('app.inProgress'), Lang.get('health.other')],
        datasets: [{ data: [success, failed, inProg, other], backgroundColor: [st.good, st.critical, st.warning, Dashboard.chartMutedColor()] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Top 5 failed
    var sorted = _appData.slice().sort(function (a, b) { return (b.Failed || 0) - (a.Failed || 0); }).slice(0, 5).filter(function (d) { return d.Failed > 0; });
    Dashboard.chart('chartFailed', {
      type: 'bar',
      data: {
        labels: sorted.map(function (d) { var n = d.AssignmentName || ''; return n.length > 30 ? n.substr(0, 30) + '...' : n; }),
        datasets: [{ label: 'Failed', data: sorted.map(function (d) { return d.Failed; }), backgroundColor: colors[4], borderWidth: 0 }]
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

  function renderAppTable() {
    var rows = _appData.map(function (d) {
      var rate = d.TotalDevices > 0 ? ((d.Success / d.TotalDevices) * 100) : 0;
      var badge = rate >= 85 ? 'success' : (rate >= 70 ? 'warning' : 'danger');
      return [
        Dashboard.escapeHtml(d.AssignmentName),
        Dashboard.escapeHtml(d.CollectionName),
        Dashboard.formatDate(d.DeploymentDate),
        d.TotalDevices || 0,
        d.Success || 0,
        d.Failed || 0,
        d.InProgress || 0,
        '<span class="badge badge-' + badge + '">' + rate.toFixed(1) + '%</span>'
      ];
    });

    _dtApp = $('#appTable').DataTable({
      data: rows, order: [[2, 'desc']], pageLength: 15,
      language: Lang.dtLang(),
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#appTable tbody').on('click', 'tr', async function () {
      var rowData = _dtApp.row(this).data();
      if (!rowData) return;
      var dep = _appData.find(function (d) { return d.AssignmentName === rowData[0]; });
      if (dep) await showAppDetail(dep);
    });

    document.querySelector('.btn-export[data-target="app"]').addEventListener('click', function () {
      CSVExport.exportDataTable(_dtApp, 'app_deployment.csv');
    });
  }

  function renderPkgTable() {
    // Klasik Package/Program dagitimi kullanilmiyorsa bu sekme bos gelir —
    // "0 satirlik tablo" degil, nedenini soyleyen bir aciklama goster.
    if (!_pkgData || _pkgData.length === 0) {
      var host = document.getElementById('pkgTable');
      if (host && host.parentNode) {
        host.parentNode.innerHTML = Dashboard.emptyStateHtml(
          { kind: 'empty' },
          { title: Lang.get('app.noPackages'), hint: Lang.get('app.noPackagesHint') }
        );
      }
      return;
    }

    var rows = (_pkgData || []).map(function (d) {
      return [
        Dashboard.escapeHtml(d.AdvertisementName),
        Dashboard.escapeHtml(d.PackageName),
        Dashboard.escapeHtml(d.CollectionName),
        Dashboard.formatDate(d.DeploymentDate),
        d.TotalDevices || 0,
        d.Success || 0,
        d.Failed || 0,
        d.Running || 0
      ];
    });

    _dtPkg = $('#pkgTable').DataTable({
      data: rows, order: [[3, 'desc']], pageLength: 15,
      language: Lang.dtLang()
    });

    document.querySelector('.btn-export[data-target="pkg"]').addEventListener('click', function () {
      CSVExport.exportDataTable(_dtPkg, 'pkg_deployment.csv');
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

  async function showAppDetail(dep) {
    // Lazy load: ilk tiklama'da yukle
    if (!_detailData) { _detailData = await Dashboard.fetchData('app_deployment_detail') || []; }
    var details = _detailData.filter(function (d) { return d.AssignmentID === dep.AssignmentID; });

    var statusLabel = function (s) {
      switch (s) {
        case 1: return Dashboard.statusBadge(Lang.get('app.successful'), 'success');
        case 2: return Dashboard.statusBadge(Lang.get('app.inProgress'), 'info');
        case 3: return Dashboard.statusBadge('Gereksinim', 'secondary');
        case 5: return Dashboard.statusBadge(Lang.get('upd.failedUpdates'), 'danger');
        default: return Dashboard.statusBadge(Lang.get('health.other'), 'secondary');
      }
    };

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">Deployment</div><div class="value">' + Dashboard.escapeHtml(dep.AssignmentName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Collection</div><div class="value">' + Dashboard.escapeHtml(dep.CollectionName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('upd.date') + '</div><div class="value">' + Dashboard.formatDate(dep.DeploymentDate) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('app.successRate') + '</div><div class="value">' + (dep.TotalDevices > 0 ? ((dep.Success / dep.TotalDevices) * 100).toFixed(1) + '%' : 'N/A') + '</div></div>' +
      '</div>';

    if (details.length > 0) {
      html += '<table class="panel-table"><thead><tr><th>' + Lang.get('asset.hostname') + '</th><th>Collection</th><th>' + Lang.get('asset.status') + '</th></tr></thead><tbody>';
      details.forEach(function (d) {
        html += '<tr><td>' + Dashboard.escapeHtml(d.Hostname) + '</td><td>' + Dashboard.escapeHtml(d.CollectionName) + '</td><td>' + statusLabel(d.StatusType) + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
    }

    SlidePanel.open(dep.AssignmentName, html, {
      exportData: details,
      exportFilename: 'app_detail_' + dep.AssignmentID + '.csv'
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
