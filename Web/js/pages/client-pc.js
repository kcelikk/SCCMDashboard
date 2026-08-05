/**
 * SCCM Dashboard — Client PC Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('client-pc', Lang.get('page.clientPc'));
    _data = await Dashboard.fetchData('client_pc');
    if (await Dashboard.bailIfEmpty('client_pc', _data)) return;
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function isActive(d) {
    if (!d.LastActiveTime) return false;
    return (Date.now() - new Date(d.LastActiveTime).getTime()) < 30 * 86400000;
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var active = _data.filter(isActive).length;
    var clientInstalled = _data.filter(function (d) { return d.ClientInstalled === 1; }).length;

    var versions = {};
    _data.forEach(function (d) { if (d.ClientVersion) versions[d.ClientVersion] = true; });
    var versionCount = Object.keys(versions).length;

    c.appendChild(Dashboard.createMetricCard(Lang.get('client.totalClient'), Dashboard.formatNumber(total), {
      icon: '&#9109;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('common.active'), Dashboard.formatNumber(active), {
      icon: '&#10003;', color: 'green', sub: Dashboard.formatPercent(total > 0 ? active / total * 100 : 0)
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('client.clientInstalled'), Dashboard.formatNumber(clientInstalled), {
      icon: '&#9881;', color: clientInstalled < total ? 'yellow' : 'green',
      sub: total - clientInstalled + ' ' + Lang.get('client.missing')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('client.diffVersion'), Dashboard.formatNumber(versionCount), {
      icon: '&#9878;', color: versionCount > 2 ? 'yellow' : 'green'
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();

    // Health
    var active = _data.filter(isActive).length;
    var stale = _data.length - active;
    // Iki dilimli halka anti-pattern'dir: iki degeri karsilastirmak icin cubuk
    // daha okunur, ustelik ustteki KPI kartlari ayni sayilari zaten veriyor.
    // Aktif/Stale DURUM anlatir -> rezerve durum renkleri.
    var st = Dashboard.statusColors();
    Dashboard.chart('chartHealth', {
      type: 'bar',
      data: {
        labels: [Lang.get('common.active'), 'Stale'],
        datasets: [{ data: [active, stale], backgroundColor: [st.good, st.serious] }]
      },
      options: {
        indexAxis: 'y',
        scales: { x: { grid: { display: true } }, y: { grid: { display: false } } }
      }
    });

    // Version distribution
    var vmap = {};
    _data.forEach(function (d) { var v = d.ClientVersion || 'N/A'; vmap[v] = (vmap[v] || 0) + 1; });
    var vLabels = Object.keys(vmap).sort();
    Dashboard.chart('chartVersion', {
      type: 'bar',
      data: {
        labels: vLabels,
        datasets: [{ data: vLabels.map(function (k) { return vmap[k]; }), backgroundColor: colors[0], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: Dashboard.chartFontColor(), stepSize: 1 }, grid: { color: Dashboard.chartGridColor() } },
          x: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
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
        Dashboard.escapeHtml(d.AssignedUser),
        Dashboard.escapeHtml(d.ClientVersion),
        Dashboard.formatDate(d.LastActiveTime),
        active ? Dashboard.statusBadge(Lang.get('common.active'), 'success') : Dashboard.statusBadge('Stale', 'warning')
      ];
    });

    _dt = $('#clientTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang(),
      createdRow: function (row) { $(row).addClass('clickable-row'); }
    });

    $('#clientTable tbody').on('click', 'tr', function () {
      var rowData = _dt.row(this).data();
      if (!rowData) return;
      var device = _data.find(function (d) { return d.Hostname === rowData[0]; });
      if (device) showDetail(device);
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'client_pc.csv');
    });
  }

  function showDetail(d) {
    var memGB = d.TotalMemoryKB ? (d.TotalMemoryKB / 1024 / 1024).toFixed(1) + ' GB' : 'N/A';
    var diskInfo = d.DiskSizeGB ? (d.DiskDrive + ': ' + d.DiskFreeGB + ' / ' + d.DiskSizeGB + ' GB bos') : 'N/A';

    var html =
      '<div class="panel-info-grid">' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.hostname') + '</div><div class="value">' + Dashboard.escapeHtml(d.Hostname) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.os') + '</div><div class="value">' + Dashboard.escapeHtml(d.OS) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">OS Build</div><div class="value">' + Dashboard.escapeHtml(d.OSBuild) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">IP</div><div class="value">' + Dashboard.escapeHtml(d.IPAddress) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.model') + '</div><div class="value">' + Dashboard.escapeHtml(d.Manufacturer) + ' ' + Dashboard.escapeHtml(d.Model) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.user') + '</div><div class="value">' + Dashboard.escapeHtml(d.AssignedUser) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">CPU</div><div class="value">' + Dashboard.escapeHtml(d.ProcessorName) + ' (' + (d.CPUCores || '?') + ' core)</div></div>' +
        '<div class="panel-info-item"><div class="label">RAM</div><div class="value">' + memGB + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Disk</div><div class="value">' + diskInfo + '</div></div>' +
        '<div class="panel-info-item"><div class="label">Client Version</div><div class="value">' + Dashboard.escapeHtml(d.ClientVersion) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('server.lastBoot') + '</div><div class="value">' + Dashboard.formatDate(d.LastBootUpTime0) + '</div></div>' +
        '<div class="panel-info-item"><div class="label">' + Lang.get('asset.lastActivity') + '</div><div class="value">' + Dashboard.formatDate(d.LastActiveTime) + '</div></div>' +
      '</div>' +
      '<div style="margin-top:16px;text-align:center">' +
        '<a href="/pages/device-detail.html?host=' + encodeURIComponent(d.Hostname) + '" class="btn btn-primary" style="text-decoration:none;display:inline-block">' + Lang.get('asset.goDetail') + '</a>' +
      '</div>';

    SlidePanel.open(d.Hostname, html);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
