/**
 * SCCM Dashboard — CMG Page
 */
(function () {
  'use strict';

  var _cmgData = null;
  var _clientData = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('cmg', Lang.get('page.cmg'));
    _cmgData = await Dashboard.fetchData('cmg');
    _clientData = await Dashboard.fetchData('cmg_clients');

    if (await Dashboard.bailIfEmpty('cmg_clients', _clientData, {
      title: Lang.get('cmg.noClients'),
      hint: Lang.get('cmg.noClientsHint')
    })) return;

    renderMetrics();
    renderCharts();
    renderCMGInfo();
    renderTable();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _clientData.length;
    var internetEnabled = _clientData.filter(function (d) { return d.InternetEnabled === 1; }).length;
    var alwaysInternet = _clientData.filter(function (d) { return d.AlwaysInternet === 1; }).length;
    var active = _clientData.filter(function (d) { return d.ClientActiveStatus === 1; }).length;
    var cmgCount = (_cmgData || []).length;

    c.appendChild(Dashboard.createMetricCard('CMG', Dashboard.formatNumber(cmgCount), {
      icon: '&#9729;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('client.totalClient'), Dashboard.formatNumber(total), {
      icon: '&#9109;', color: 'purple'
    }));
    c.appendChild(Dashboard.createMetricCard('Internet Etkin', Dashboard.formatNumber(internetEnabled), {
      icon: '&#127760;', color: 'green', sub: Dashboard.formatPercent(total > 0 ? internetEnabled / total * 100 : 0)
    }));
    c.appendChild(Dashboard.createMetricCard('Always Internet', Dashboard.formatNumber(alwaysInternet), {
      icon: '&#128274;', color: alwaysInternet > 0 ? 'yellow' : 'green',
      sub: 'Sadece internet uzerinden yonetilen'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();

    var intranet = _clientData.filter(function (d) { return !d.InternetEnabled && !d.AlwaysInternet; }).length;
    var internetEnabled = _clientData.filter(function (d) { return d.InternetEnabled === 1 && !d.AlwaysInternet; }).length;
    var alwaysInternet = _clientData.filter(function (d) { return d.AlwaysInternet === 1; }).length;

    Dashboard.chart('chartConnType', {
      type: 'doughnut',
      data: {
        labels: ['Intranet', 'Internet Etkin', 'Always Internet'],
        datasets: [{ data: [intranet, internetEnabled, alwaysInternet], backgroundColor: [colors[2], colors[1], colors[3]], }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });
  }

  function renderCMGInfo() {
    var panel = document.getElementById('cmgInfoPanel');
    if (!_cmgData || _cmgData.length === 0) {
      panel.innerHTML = '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
      return;
    }

    var html = '';
    _cmgData.forEach(function (cmg) {
      var stateLabel = cmg.CMGState === 1 ? Dashboard.statusBadge(Lang.get('common.active'), 'success') : Dashboard.statusBadge('Inaktif', 'warning');
      html +=
        '<div style="margin-bottom:16px;padding:12px;background:var(--bg-primary);border-radius:6px">' +
          '<div style="font-weight:600;margin-bottom:8px">' + Dashboard.escapeHtml(cmg.ServiceCName) + ' ' + stateLabel + '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:var(--font-size-sm)">' +
            '<div><span style="color:var(--text-secondary)">Region:</span> ' + Dashboard.escapeHtml(cmg.Region) + '</div>' +
            '<div><span style="color:var(--text-secondary)">VM Size:</span> ' + Dashboard.escapeHtml(cmg.VmSize) + '</div>' +
            '<div><span style="color:var(--text-secondary)">Instances:</span> ' + cmg.NumberOfInstances + '</div>' +
            '<div><span style="color:var(--text-secondary)">' + Lang.get('alert.created') + ':</span> ' + Dashboard.formatDate(cmg.CreationTime) + '</div>' +
          '</div>' +
        '</div>';
    });
    panel.innerHTML = html;
  }

  function renderTable() {
    var rows = _clientData.map(function (d) {
      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml(d.ClientVersion),
        d.InternetEnabled === 1 ? Dashboard.statusBadge(Lang.get('common.yes'), 'success') : Dashboard.statusBadge(Lang.get('common.no'), 'secondary'),
        d.AlwaysInternet === 1 ? Dashboard.statusBadge(Lang.get('common.yes'), 'warning') : Dashboard.statusBadge(Lang.get('common.no'), 'secondary'),
        Dashboard.escapeHtml(d.ManagementPoint),
        Dashboard.formatDate(d.LastActiveTime)
      ];
    });

    _dt = $('#cmgTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang()
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'cmg_clients.csv');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
