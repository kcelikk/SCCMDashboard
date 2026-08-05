/**
 * SCCM Dashboard — Hardware & Firmware Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('hardware-firmware', Lang.get('page.hardwareFirmware'));
    _data = await Dashboard.fetchData('hardware_firmware');
    if (await Dashboard.bailIfEmpty('hardware_firmware', _data)) return;
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var mfrSet = new Set(_data.map(function (d) { return d.Manufacturer; }).filter(Boolean));
    var modelSet = new Set(_data.map(function (d) { return d.Model; }).filter(Boolean));

    var tpmEnabled = _data.filter(function (d) { return d.TPMEnabled === 1; }).length;
    var tpmRate = total > 0 ? (tpmEnabled / total) * 100 : 0;
    var tpmColor = Dashboard.thresholdColor('hardwareFirmware', 'tpmPercent', tpmRate, { warning: 90, critical: 70 }, false);

    var uefiEnabled = _data.filter(function (d) { return d.UEFIEnabled === 1; }).length;
    var uefiRate = total > 0 ? (uefiEnabled / total) * 100 : 0;

    var secureBoot = _data.filter(function (d) { return d.SecureBoot === 1; }).length;
    var sbRate = total > 0 ? (secureBoot / total) * 100 : 0;

    c.appendChild(Dashboard.createMetricCard(Lang.get('dash.totalDevices'), Dashboard.formatNumber(total), {
      icon: '&#9881;', color: 'blue', sub: mfrSet.size + ' ' + Lang.get('hw.manufacturer') + ', ' + modelSet.size + ' ' + Lang.get('asset.model')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('hw.tpmActive'), Dashboard.formatPercent(tpmRate), {
      icon: '&#128273;', color: tpmColor, statusClass: Dashboard.getStatusClass(tpmColor),
      sub: tpmEnabled + ' / ' + total + ' ' + Lang.get('common.device')
    }));
    c.appendChild(Dashboard.createMetricCard('UEFI', Dashboard.formatPercent(uefiRate), {
      icon: '&#9889;', color: 'purple', sub: uefiEnabled + ' ' + Lang.get('common.device')
    }));
    c.appendChild(Dashboard.createMetricCard('SecureBoot', Dashboard.formatPercent(sbRate), {
      icon: '&#9919;', color: sbRate > 80 ? 'green' : 'yellow', sub: secureBoot + ' ' + Lang.get('common.device')
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    var st = Dashboard.statusColors();

    // Manufacturer distribution
    var mfrMap = {};
    _data.forEach(function (d) {
      var m = d.Manufacturer || Lang.get('common.unknown');
      m = m.replace('LENOVO', 'Lenovo').replace('Dell Inc.', 'Dell').replace('Hewlett-Packard', 'HP').replace('HP Inc.', 'HP');
      mfrMap[m] = (mfrMap[m] || 0) + 1;
    });
    // Onceden ilk 8 alinip gerisi sessizce atiliyordu — toplam yaniltiyordu.
    // foldCategories kuyrugu 'Diger' segmentinde toplar, hicbir cihaz kaybolmaz.
    var mfr = Dashboard.foldCategories(Object.keys(mfrMap).map(function (k) {
      return { label: k, value: mfrMap[k] };
    }), 6);
    Dashboard.chart('chartMfr', {
      type: 'doughnut',
      data: {
        labels: mfr.labels,
        datasets: [{ data: mfr.values, backgroundColor: mfr.colors }]
      }
    });

    // TPM status
    var tpmOn = _data.filter(function (d) { return d.TPMEnabled === 1; }).length;
    var tpmOff = _data.filter(function (d) { return d.TPMEnabled === 0; }).length;
    var tpmNA = _data.length - tpmOn - tpmOff;
    Dashboard.chart('chartTPM', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('hw.tpmActive'), Lang.get('hw.tpmPassive'), Lang.get('hw.tpmNA')],
        // TPM acik/kapali DURUM anlatir -> rezerve durum renkleri
        datasets: [{ data: [tpmOn, tpmOff, tpmNA], backgroundColor: [st.good, st.critical, Dashboard.chartMutedColor()] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // UEFI / SecureBoot
    var uefiOn = _data.filter(function (d) { return d.UEFIEnabled === 1; }).length;
    var sbOn = _data.filter(function (d) { return d.SecureBoot === 1; }).length;
    var legacyBios = _data.length - uefiOn;
    Dashboard.chart('chartUEFI', {
      type: 'bar',
      data: {
        labels: ['UEFI', 'Legacy BIOS', 'SecureBoot On'],
        datasets: [{ data: [uefiOn, legacyBios, sbOn], backgroundColor: [colors[1], colors[4], colors[2]], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          y: { ticks: { color: Dashboard.chartFontColor() }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Top 10 models
    var modelMap = {};
    _data.forEach(function (d) { var m = d.Model || Lang.get('common.unknown'); modelMap[m] = (modelMap[m] || 0) + 1; });
    var topModels = Object.keys(modelMap).sort(function (a, b) { return modelMap[b] - modelMap[a]; }).slice(0, 10);
    Dashboard.chart('chartModels', {
      type: 'bar',
      data: {
        labels: topModels.map(function (m) { return m.length > 25 ? m.substring(0, 25) + '..' : m; }),
        datasets: [{ data: topModels.map(function (k) { return modelMap[k]; }), backgroundColor: colors[0], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          y: { ticks: { color: Dashboard.chartFontColor(), font: { size: 10 } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var tpmBadge = d.TPMEnabled === 1 ? Dashboard.statusBadge(Lang.get('common.active'), 'success') :
                     d.TPMEnabled === 0 ? Dashboard.statusBadge('Pasif', 'danger') :
                     Dashboard.statusBadge('N/A', 'secondary');
      var uefiBadge = d.UEFIEnabled === 1 ? Dashboard.statusBadge('UEFI', 'success') : Dashboard.statusBadge('Legacy', 'warning');
      var sbBadge = d.SecureBoot === 1 ? Dashboard.statusBadge('On', 'success') : Dashboard.statusBadge('Off', 'secondary');

      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml(d.Manufacturer || ''),
        Dashboard.escapeHtml(d.Model || ''),
        Dashboard.escapeHtml(d.BIOSVersion || ''),
        tpmBadge,
        uefiBadge,
        sbBadge
      ];
    });

    _dt = $('#hwTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang()
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'hardware_firmware.csv');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
