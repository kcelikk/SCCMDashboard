/**
 * SCCM Dashboard — Server Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('server', Lang.get('page.server'));
    _data = await Dashboard.fetchData('server');
    if (await Dashboard.bailIfEmpty('server', _data)) return;
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function isActive(d) {
    if (!d.LastActiveTime) return false;
    return (Date.now() - new Date(d.LastActiveTime).getTime()) < 30 * 86400000;
  }

  function uptimeDays(d) {
    if (!d.LastBootUpTime0) return null;
    return Math.floor((Date.now() - new Date(d.LastBootUpTime0).getTime()) / 86400000);
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var active = _data.filter(isActive).length;
    var virtual = _data.filter(function (d) { return d.IsVirtual; }).length;

    var highUptime = _data.filter(function (d) { var u = uptimeDays(d); return u !== null && u > 90; }).length;

    c.appendChild(Dashboard.createMetricCard(Lang.get('server.total'), Dashboard.formatNumber(total), {
      icon: '&#9641;', color: 'blue', sub: virtual + ' ' + Lang.get('server.virtual') + ', ' + (total - virtual) + ' ' + Lang.get('server.physical')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.active'), Dashboard.formatNumber(active), {
      icon: '&#10003;', color: 'green', sub: Dashboard.formatPercent(total > 0 ? active / total * 100 : 0)
    }));

    var uptimeColor = Dashboard.thresholdColor('server', 'highUptimeCount', highUptime, { warning: 2, critical: 5 }, true);
    c.appendChild(Dashboard.createMetricCard(Lang.get('server.highUptime'), Dashboard.formatNumber(highUptime), {
      icon: '&#9203;', color: uptimeColor, statusClass: Dashboard.getStatusClass(uptimeColor),
      sub: Lang.get('server.rebootNeeded')
    }));

    var stale = total - active;
    c.appendChild(Dashboard.createMetricCard('Stale', Dashboard.formatNumber(stale), {
      icon: '&#9888;', color: stale > 0 ? 'yellow' : 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();

    // OS distribution
    var osMap = {};
    _data.forEach(function (d) {
      var os = d.OS || Lang.get('common.unknown');
      osMap[os] = (osMap[os] || 0) + 1;
    });
    // 6'dan fazla OS surumu varsa kuyruk 'Diger'e katlanir — 9. bir hue
    // uretmek CVD altinda ayirt edilemeyen renk demektir.
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

    // Physical vs Virtual
    var virt = _data.filter(function (d) { return d.IsVirtual; }).length;
    var phys = _data.length - virt;
    // Fizik/sanal KIMLIK'tir (durum degil) ve iki degerdir -> tek renkli cubuk.
    // Hue burada bilgi tasimaz; uzunluk tasir.
    Dashboard.chart('chartVirtual', {
      type: 'bar',
      data: {
        labels: [Lang.get('server.physical'), Lang.get('server.virtual')],
        datasets: [{ _slot: 1, data: [phys, virt], backgroundColor: colors[0] }]
      },
      options: {
        indexAxis: 'y',
        scales: { x: { grid: { display: true } }, y: { grid: { display: false } } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var active = isActive(d);
      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml(d.OS || ''),
        Dashboard.escapeHtml(d.IPAddress),
        Dashboard.escapeHtml(d.Model),
        Dashboard.formatDate(d.LastBootUpTime0),
        Dashboard.formatDate(d.LastActiveTime),
        active ? Dashboard.statusBadge(Lang.get('common.active'), 'success') : Dashboard.statusBadge('Stale', 'warning')
      ];
    });

    _dt = $('#serverTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang(),
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#serverTable tbody').on('click', 'tr', function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      var device = _data.find(function (d) { return d.Hostname === rowData[0]; });
      if (device) showDetail(device);
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'server_list.csv');
    });
  }

  function showDetail(d) {
    var memGB = d.TotalMemoryKB ? (d.TotalMemoryKB / 1024 / 1024).toFixed(1) + ' GB' : 'N/A';
    var diskInfo = d.DiskSizeGB ? (d.DiskDrive + ': ' + d.DiskFreeGB + ' / ' + d.DiskSizeGB + ' GB bos') : 'N/A';
    var uptime = uptimeDays(d);

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.hostname') + '</div><div class="value">' + Dashboard.escapeHtml(d.Hostname) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.os') + '</div><div class="value">' + Dashboard.escapeHtml(d.OS) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">OS Build</div><div class="value">' + Dashboard.escapeHtml(d.OSBuild) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">IP</div><div class="value">' + Dashboard.escapeHtml(d.IPAddress) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.model') + '</div><div class="value">' + Dashboard.escapeHtml(d.Manufacturer) + ' ' + Dashboard.escapeHtml(d.Model) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Virtual</div><div class="value">' + (d.IsVirtual ? Lang.get('common.yes') : Lang.get('common.no')) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">CPU</div><div class="value">' + Dashboard.escapeHtml(d.ProcessorName) + ' (' + (d.CPUCores || '?') + ' core)</div></div>' +
        '<div class="panel-info-item"><div class="label">RAM</div><div class="value">' + memGB + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Disk</div><div class="value">' + diskInfo + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Client Version</div><div class="value">' + Dashboard.escapeHtml(d.ClientVersion) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('server.lastBoot') + '</div><div class="value">' + Dashboard.formatDate(d.LastBootUpTime0) + (uptime !== null ? ' (' + uptime + ' ' + Lang.get('server.days') + ')' : '') + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.lastActivity') + '</div><div class="value">' + Dashboard.formatDate(d.LastActiveTime) + '</div></div>' +
      '</div>' +
      '<div style="margin-top:16px;text-align:center">' +
        '<a href="/pages/device-detail.html?host=' + encodeURIComponent(d.Hostname) + '" class="btn btn-primary" style="text-decoration:none;display:inline-block">' + Lang.get('asset.goDetail') + '</a>' +
      '</div>';

    SlidePanel.open(d.Hostname, html);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
