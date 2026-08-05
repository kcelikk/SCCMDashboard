/**
 * SCCM Dashboard — Asset Inventory Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('asset', Lang.get('page.asset'));
    _data = await Dashboard.fetchData('asset');
    if (await Dashboard.bailIfEmpty('asset', _data)) return;

    renderMetrics();
    renderCharts();
    renderTable();
    bindFilters();
  }

  function isStale(d) {
    if (!d.LastActiveTime) return true;
    var days = Dashboard.threshold('asset', 'staleDeviceDays', 30);
    return (Date.now() - new Date(d.LastActiveTime).getTime()) > days * 86400000;
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var active = _data.filter(function (d) { return !isStale(d); }).length;
    var stale = total - active;
    var servers = _data.filter(function (d) { return d.DeviceType === 'Server'; }).length;
    var workstations = total - servers;

    c.appendChild(Dashboard.createMetricCard(Lang.get('dash.totalDevices'), Dashboard.formatNumber(total), {
      icon: '&#9000;', color: 'blue', sub: servers + ' server, ' + workstations + ' workstation'
    }));
    // Saglik orani = aktif cihaz yuzdesi; esik Config/thresholds.json'dan gelir
    var healthPct = total > 0 ? active / total * 100 : 0;
    var healthColor = Dashboard.thresholdColor('asset', 'clientHealthPercent', healthPct,
      { warning: 85, critical: 70 }, false);

    c.appendChild(Dashboard.createMetricCard(Lang.get('asset.active30'), Dashboard.formatNumber(active), {
      icon: '&#10003;', color: healthColor, statusClass: Dashboard.getStatusClass(healthColor),
      sub: Dashboard.formatPercent(healthPct)
    }));

    c.appendChild(Dashboard.createMetricCard('Stale', Dashboard.formatNumber(stale), {
      icon: '&#9888;', color: stale > 0 ? 'yellow' : 'green',
      sub: Dashboard.threshold('asset', 'staleDeviceDays', 30) + ' ' + Lang.get('time.dayAgo')
    }));

    var users = new Set(_data.map(function (d) { return d.AssignedUser; }).filter(Boolean));
    c.appendChild(Dashboard.createMetricCard(Lang.get('asset.users'), Dashboard.formatNumber(users.size), {
      icon: '&#9786;', color: 'purple'
    }));
  }

  function renderCharts() {
    // OS dagilimi — parca/butun. 6'dan fazla OS varsa kuyruk 'Diger'e katlanir;
    // yeni hue uretilmez (9. renk CVD altinda ayirt edilemez).
    var osMap = {};
    _data.forEach(function (d) {
      var os = d.OS || Lang.get('common.unknown');
      osMap[os] = (osMap[os] || 0) + 1;
    });
    var os = Dashboard.foldCategories(Object.keys(osMap).map(function (k) {
      return { label: k, value: osMap[k] };
    }), 6);

    Dashboard.chart('chartOS', {
      type: 'doughnut',
      data: {
        labels: os.labels,
        datasets: [{ data: os.values, backgroundColor: os.colors }]
      }
    });

    // Cihaz tipi — tek olcum (cihaz sayisi), iki nominal kategori.
    // Tek seri = tek renk: hue burada bilgi tasimaz, uzunluk tasir.
    var servers = _data.filter(function (d) { return d.DeviceType === 'Server'; }).length;
    var wks = _data.length - servers;

    Dashboard.chart('chartType', {
      type: 'bar',
      data: {
        labels: ['Server', 'Workstation'],
        datasets: [{ _slot: 1, data: [servers, wks], backgroundColor: Dashboard.chartColors()[0] }]
      },
      options: {
        indexAxis: 'y',
        scales: { x: { grid: { display: true } }, y: { grid: { display: false } } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var stale = isStale(d);
      var statusBadge = stale
        ? Dashboard.statusBadge('Stale', 'warning')
        : Dashboard.statusBadge(Lang.get('common.active'), 'success');

      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml(d.OS || ''),
        d.DeviceType,
        Dashboard.escapeHtml(d.IPAddress),
        Dashboard.escapeHtml(d.Model),
        Dashboard.escapeHtml(d.AssignedUser),
        Dashboard.formatDate(d.LastActiveTime),
        statusBadge
      ];
    });

    _dt = $('#assetTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang(),
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#assetTable tbody').on('click', 'tr', function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      var hostname = rowData[0];
      var device = _data.find(function (d) { return d.Hostname === hostname; });
      if (device) showDetail(device);
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'asset_inventory.csv');
    });
  }

  function bindFilters() {
    var filterType = document.getElementById('filterType');
    var filterStatus = document.getElementById('filterStatus');

    function applyFilters() {
      var type = filterType.value;
      var status = filterStatus.value;

      _dt.columns(2).search(type);
      if (status === 'active') _dt.columns(7).search(Lang.get('common.active'));
      else if (status === 'stale') _dt.columns(7).search('Stale');
      else _dt.columns(7).search('');
      _dt.draw();
    }

    filterType.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
  }

  function showDetail(d) {
    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.hostname') + '</div><div class="value">' + Dashboard.escapeHtml(d.Hostname) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.os') + '</div><div class="value">' + Dashboard.escapeHtml(d.OS) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">OS Build</div><div class="value">' + Dashboard.escapeHtml(d.OSBuild) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.model') + '</div><div class="value">' + Dashboard.escapeHtml(d.Model) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('hw.manufacturer') + '</div><div class="value">' + Dashboard.escapeHtml(d.Manufacturer) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.ipAddress') + '</div><div class="value">' + Dashboard.escapeHtml(d.IPAddress) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Domain</div><div class="value">' + Dashboard.escapeHtml(d.Domain) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">AD Site</div><div class="value">' + Dashboard.escapeHtml(d.ADSite) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.user') + '</div><div class="value">' + Dashboard.escapeHtml(d.AssignedUser) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Client Version</div><div class="value">' + Dashboard.escapeHtml(d.ClientVersion) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.lastActivity') + '</div><div class="value">' + Dashboard.formatDate(d.LastActiveTime) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Son HW Scan</div><div class="value">' + Dashboard.formatDate(d.LastHW) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.type') + '</div><div class="value">' + d.DeviceType + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Virtual</div><div class="value">' + (d.IsVirtual ? Lang.get('common.yes') : Lang.get('common.no')) + '</div></div>' +
      '</div>' +
      '<div style="margin-top:16px;text-align:center">' +
        '<a href="/pages/device-detail.html?host=' + encodeURIComponent(d.Hostname) + '" class="btn btn-primary" style="text-decoration:none;display:inline-block">' + Lang.get('asset.goDetail') + '</a>' +
      '</div>';

    SlidePanel.open(d.Hostname, html);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
