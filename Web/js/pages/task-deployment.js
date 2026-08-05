/**
 * SCCM Dashboard — OS / Task Deployment Page
 */
(function () {
  'use strict';

  var _data = null;
  var _detailData = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('task-deployment', Lang.get('page.taskDeployment'));
    _data = await Dashboard.fetchData('task_deployment');
    if (await Dashboard.bailIfEmpty('task_deployment', _data, {
      title: Lang.get('ts.noDeployments'),
      hint: Lang.get('ts.noDeploymentsHint')
    })) return;

    renderAlerts();
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function renderAlerts() {
    var area = document.getElementById('alertArea');
    var failed = _data.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    if (failed > 0) {
      area.innerHTML = '<div class="alert-banner critical">&#9888; ' + failed + ' failed task sequence execution</div>';
    }
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var totalTS = new Set(_data.map(function (d) { return d.PackageID; })).size;
    var totalDeploy = _data.length;
    var totalDevices = _data.reduce(function (s, d) { return s + (d.TotalDevices || 0); }, 0);
    var totalSuccess = _data.reduce(function (s, d) { return s + (d.Success || 0); }, 0);
    var totalFailed = _data.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var totalRunning = _data.reduce(function (s, d) { return s + (d.Running || 0); }, 0);
    var successRate = totalDevices > 0 ? (totalSuccess / totalDevices) * 100 : 0;
    var srColor = Dashboard.thresholdColor('taskDeployment', 'successRatePercent', successRate, { warning: 85, critical: 70 }, false);

    var pxeCount = _data.filter(function (d) { return d.DeploymentMethod === 'PXE'; }).length;

    c.appendChild(Dashboard.createMetricCard('Task Sequences', Dashboard.formatNumber(totalTS), {
      icon: '&#9654;', color: 'blue', sub: totalDeploy + ' deployment'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('app.successRate'), Dashboard.formatPercent(successRate), {
      icon: '&#10003;', color: srColor, statusClass: Dashboard.getStatusClass(srColor),
      sub: totalSuccess + ' / ' + totalDevices
    }));
    c.appendChild(Dashboard.createMetricCard('Failed', Dashboard.formatNumber(totalFailed), {
      icon: '&#10007;', color: totalFailed > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(totalFailed > 0 ? 'red' : 'green')
    }));
    c.appendChild(Dashboard.createMetricCard('PXE Deployments', Dashboard.formatNumber(pxeCount), {
      icon: '&#9729;', color: 'purple', sub: totalRunning + ' running'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    // Success/Failed/... KIMLIK degil DURUM anlatir -> rezerve durum renkleri
    var st = Dashboard.statusColors();

    // Status distribution
    var success = _data.reduce(function (s, d) { return s + (d.Success || 0); }, 0);
    var failed = _data.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var running = _data.reduce(function (s, d) { return s + (d.Running || 0); }, 0);
    var other = _data.reduce(function (s, d) { return s + (d.Other || 0); }, 0);

    Dashboard.chart('chartStatus', {
      type: 'doughnut',
      data: {
        labels: ['Success', 'Failed', 'Running', 'Other'],
        datasets: [{ data: [success, failed, running, other], backgroundColor: [st.good, st.critical, st.warning, Dashboard.chartMutedColor()] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Method distribution
    var methodMap = {};
    _data.forEach(function (d) {
      var m = d.DeploymentMethod || 'Standard';
      methodMap[m] = (methodMap[m] || 0) + 1;
    });
    // Dagitim yontemi = kimlik (PXE / Standard / ...) -> kategorik slotlar
    var method = Dashboard.foldCategories(Object.keys(methodMap).map(function (k) {
      return { label: k, value: methodMap[k] };
    }), 6);
    Dashboard.chart('chartMethod', {
      type: 'doughnut',
      data: {
        labels: method.labels,
        datasets: [{ data: method.values, backgroundColor: method.colors }]
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var successRate = d.TotalDevices > 0 ? ((d.Success / d.TotalDevices) * 100).toFixed(0) : 0;
      return [
        Dashboard.escapeHtml(d.TaskSequenceName),
        Dashboard.escapeHtml(d.AdvertisementName),
        Dashboard.escapeHtml(d.CollectionName),
        Dashboard.statusBadge(d.DeploymentMethod || 'Standard', d.DeploymentMethod === 'PXE' ? 'info' : 'secondary'),
        Dashboard.statusBadge(d.DeploymentPurpose || '-', d.DeploymentPurpose === 'Required' ? 'warning' : 'success'),
        d.TotalDevices || 0,
        d.Success || 0,
        d.Failed || 0,
        d.Running || 0,
        Dashboard.formatDate(d.DeploymentDate)
      ];
    });

    _dt = $('#tsTable').DataTable({
      data: rows, order: [[9, 'desc']], pageLength: 20,
      language: Lang.dtLang(),
      columnDefs: [{ targets: [5, 6, 7, 8], className: 'dt-right' }],
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#tsTable tbody').on('click', 'tr', async function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      var dep = _data.find(function (d) { return d.AdvertisementName === rowData[1]; });
      if (dep) await showDetail(dep);
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'task_deployment.csv');
    });
  }

  async function showDetail(dep) {
    if (!_detailData) { _detailData = await Dashboard.fetchData('task_deployment_detail') || []; }
    var details = _detailData.filter(function (d) { return d.AdvertisementID === dep.AdvertisementID; });

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">Task Sequence</div><div class="value">' + Dashboard.escapeHtml(dep.TaskSequenceName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Deployment</div><div class="value">' + Dashboard.escapeHtml(dep.AdvertisementName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Collection</div><div class="value">' + Dashboard.escapeHtml(dep.CollectionName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Method</div><div class="value">' + (dep.DeploymentMethod || '-') + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Purpose</div><div class="value">' + (dep.DeploymentPurpose || '-') + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Date</div><div class="value">' + Dashboard.formatDate(dep.DeploymentDate) + '</div></div>' +
      '</div>';

    if (details.length > 0) {
      html += '<table class="panel-table"><thead><tr><th>Hostname</th><th>Status</th><th>Last Status</th></tr></thead><tbody>';
      details.forEach(function (d) {
        var badge = d.LastState === 13 ? Dashboard.statusBadge('Success', 'success') :
                    d.LastState === 11 ? Dashboard.statusBadge('Failed', 'danger') :
                    d.LastState === 9 ? Dashboard.statusBadge('Running', 'warning') :
                    Dashboard.statusBadge(d.StateName || '-', 'secondary');
        html += '<tr><td>' + Dashboard.escapeHtml(d.Hostname) + '</td><td>' + badge + '</td><td>' + Dashboard.formatDate(d.LastStatusTime) + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div class="empty-state">' + Lang.get('common.emptyTable') + '</div>';
    }

    SlidePanel.open(dep.TaskSequenceName, html);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
