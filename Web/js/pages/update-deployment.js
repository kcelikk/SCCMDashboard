/**
 * SCCM Dashboard — Update Deployment Page
 */
(function () {
  'use strict';

  var _data = null;
  var _detailData = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('update-deployment', Lang.get('page.updateDeployment'));

    // Fetch data
    _data = await Dashboard.fetchData('update_deployment');
    // _detailData lazy load: tiklama aninda yuklenir

    if (await Dashboard.bailIfEmpty('update_deployment', _data)) return;

    renderMetrics();
    renderCharts();
    renderTable();
  }

  function renderMetrics() {
    var container = document.getElementById('metrics');
    container.innerHTML = '';

    var totalDeployments = _data.length;
    var totalDevices = _data.reduce(function (s, d) { return s + (d.TotalDevices || 0); }, 0);
    var totalInstalled = _data.reduce(function (s, d) { return s + (d.Installed || 0); }, 0);
    var totalFailed = _data.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var totalRequired = _data.reduce(function (s, d) { return s + (d.Required || 0); }, 0);

    var complianceRate = totalDevices > 0 ? (totalInstalled / totalDevices) * 100 : 0;
    var compColor = Dashboard.thresholdColor('updateDeployment', 'compliancePercent',
      complianceRate, { warning: 80, critical: 60 }, false);

    container.appendChild(Dashboard.createMetricCard(Lang.get('upd.totalDeployment'), Dashboard.formatNumber(totalDeployments), {
      icon: '&#8635;', color: 'blue', sub: Lang.get('upd.activeDeployment')
    }));

    container.appendChild(Dashboard.createMetricCard(Lang.get('upd.compliance'), Dashboard.formatPercent(complianceRate), {
      icon: '&#10003;', color: compColor,
      statusClass: Dashboard.getStatusClass(compColor),
      sub: Dashboard.formatNumber(totalInstalled) + ' / ' + Dashboard.formatNumber(totalDevices) + ' ' + Lang.get('common.device')
    }));

    var failColor = Dashboard.thresholdColor('updateDeployment', 'failedCount',
      totalFailed, { warning: 3, critical: 10 }, true);
    container.appendChild(Dashboard.createMetricCard(Lang.get('upd.failedUpdates'), Dashboard.formatNumber(totalFailed), {
      icon: '&#10007;', color: failColor,
      statusClass: Dashboard.getStatusClass(failColor),
      sub: Lang.get('upd.failedUpdates')
    }));

    container.appendChild(Dashboard.createMetricCard(Lang.get('upd.pending'), Dashboard.formatNumber(totalRequired), {
      icon: '&#9203;', color: totalRequired > 0 ? 'yellow' : 'green',
      sub: Lang.get('upd.pendingInstall')
    }));
  }

  function renderCharts() {
    // Compliance donut
    var totalInstalled = _data.reduce(function (s, d) { return s + (d.Installed || 0); }, 0);
    var totalRequired = _data.reduce(function (s, d) { return s + (d.Required || 0); }, 0);
    var totalFailed = _data.reduce(function (s, d) { return s + (d.Failed || 0); }, 0);
    var totalUnknown = _data.reduce(function (s, d) { return s + (d.Unknown || 0); }, 0);
    var colors = Dashboard.chartColors();

    // Uyum dagilimi — parca/butun, 4 segment.
    // Installed/Required/Failed/Unknown DURUM anlatir, kimlik degil:
    // bu yuzden kategorik slot degil, rezerve durum renkleri kullanilir.
    var st = Dashboard.statusColors();
    Dashboard.chart('chartCompliance', {
      type: 'doughnut',
      data: {
        labels: ['Installed', 'Required', 'Failed', 'Unknown'],
        datasets: [{
          data: [totalInstalled, totalRequired, totalFailed, totalUnknown],
          backgroundColor: [st.good, st.warning, st.critical, Dashboard.chartMutedColor()]
        }]
      }
    });

    // 30-day trend line
    var last30 = _data.filter(function (d) {
      if (!d.DeploymentDate) return false;
      var diff = (Date.now() - new Date(d.DeploymentDate).getTime()) / 86400000;
      return diff <= 30;
    }).sort(function (a, b) {
      return new Date(a.DeploymentDate) - new Date(b.DeploymentDate);
    });

    var trendLabels = last30.map(function (d) {
      var dt = new Date(d.DeploymentDate);
      return dt.getDate() + '.' + (dt.getMonth() + 1);
    });
    var trendCompliance = last30.map(function (d) {
      return d.TotalDevices > 0 ? ((d.Installed / d.TotalDevices) * 100).toFixed(1) : 0;
    });

    // Veri yoksa sahte bir "0" noktasi cizmek yaniltici: bos durumu goster.
    if (trendLabels.length === 0) {
      Dashboard.destroyChart('chartTrend');
      var host = document.getElementById('chartTrend');
      if (host && host.parentNode) {
        host.parentNode.innerHTML = Dashboard.emptyStateHtml(
          { kind: 'empty' },
          { title: Lang.get('upd.noData'), hint: Lang.get('upd.noTrendHint') }
        );
      }
      return;
    }

    Dashboard.chart('chartTrend', {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          _slot: 1,
          label: 'Compliance %',
          data: trendCompliance,
          borderColor: colors[0],
          backgroundColor: Dashboard.withAlpha(colors[0], 0.1),
          fill: true
        }]
      },
      options: {
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { callback: function (v) { return v + '%'; } }
          }
        }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var comp = d.TotalDevices > 0 ? ((d.Installed / d.TotalDevices) * 100) : 0;
      var compColor = Dashboard.thresholdColor('updateDeployment', 'compliancePercent',
        comp, { warning: 80, critical: 60 }, false);
      var badge = compColor === 'green' ? 'success' : (compColor === 'yellow' ? 'warning' : 'danger');

      return [
        Dashboard.escapeHtml(d.AssignmentName),
        Dashboard.escapeHtml(d.CollectionName),
        Dashboard.formatDate(d.DeploymentDate),
        d.TotalDevices || 0,
        d.Installed || 0,
        d.Required || 0,
        d.Failed || 0,
        d.Unknown || 0,
        '<span class="badge badge-' + badge + '">' + comp.toFixed(1) + '%</span>'
      ];
    });

    _dt = $('#deploymentTable').DataTable({
      data: rows,
      order: [[2, 'desc']],
      pageLength: 15,
      language: Lang.dtLang(),
      columnDefs: [
        { targets: [3,4,5,6,7], className: 'dt-right' }
      ],
      createdRow: function (row) {
        $(row).addClass('clickable-row');
      }
    });

    // Row click → slide panel
    $('#deploymentTable tbody').on('click', 'tr', async function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      var deploymentName = rowData[0];

      // Find AssignmentID
      var deployment = _data.find(function (d) { return d.AssignmentName === deploymentName; });
      if (!deployment) return;

      await showDetail(deployment);
    });

    // CSV Export
    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'update_deployment.csv');
    });
  }

  async function showDetail(deployment) {
    var assignmentId = deployment.AssignmentID;
    // Lazy load: ilk tiklama'da yukle
    if (!_detailData) { _detailData = await Dashboard.fetchData('update_deployment_detail') || []; }
    var details = _detailData.filter(function (d) { return d.AssignmentID === assignmentId; });

    var statusLabel = function (s) {
      switch (s) {
        case 0: return Dashboard.statusBadge('Unknown', 'secondary');
        case 2: return Dashboard.statusBadge('Required', 'warning');
        case 3: return Dashboard.statusBadge('Installed', 'success');
        default: return Dashboard.statusBadge('Failed', 'danger');
      }
    };

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">Deployment</div><div class="value">' + Dashboard.escapeHtml(deployment.AssignmentName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Collection</div><div class="value">' + Dashboard.escapeHtml(deployment.CollectionName) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('upd.date') + '</div><div class="value">' + Dashboard.formatDate(deployment.DeploymentDate) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('upd.compliance') + '</div><div class="value">' + (deployment.TotalDevices > 0 ? ((deployment.Installed / deployment.TotalDevices) * 100).toFixed(1) + '%' : 'N/A') + '</div></div>' +
      '</div>';

    if (details.length > 0) {
      html += '<table class="panel-table"><thead><tr>' +
        '<th>' + Lang.get('asset.hostname') + '</th><th>KB</th><th>' + Lang.get('asset.status') + '</th><th>Son Kontrol</th>' +
        '</tr></thead><tbody>';

      details.forEach(function (d) {
        html += '<tr>' +
          '<td>' + Dashboard.escapeHtml(d.Hostname) + '</td>' +
          '<td>' + Dashboard.escapeHtml(d.KB) + '</td>' +
          '<td>' + statusLabel(d.Status) + '</td>' +
          '<td>' + Dashboard.formatDate(d.LastStatusCheckTime) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
    }

    SlidePanel.open(deployment.AssignmentName, html, {
      exportData: details.map(function (d) {
        return {
          Hostname: d.Hostname,
          OS: d.OS,
          KB: d.KB,
          UpdateTitle: d.UpdateTitle,
          Status: d.Status === 3 ? 'Installed' : (d.Status === 2 ? 'Required' : (d.Status === 0 ? 'Unknown' : 'Failed')),
          LastCheck: d.LastStatusCheckTime
        };
      }),
      exportFilename: 'update_detail_' + deployment.AssignmentID + '.csv'
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
