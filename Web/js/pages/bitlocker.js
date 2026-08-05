/**
 * SCCM Dashboard — BitLocker Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('bitlocker', Lang.get('page.bitlocker'));
    _data = await Dashboard.fetchData('bitlocker');
    if (await Dashboard.bailIfEmpty('bitlocker', _data)) return;
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function protectionLabel(status) {
    switch (status) {
      case 0: return { text: Lang.get('bl.unprotected'), badge: 'danger' };
      case 1: return { text: Lang.get('bl.protected'), badge: 'success' };
      case 2: return { text: Lang.get('common.unknown'), badge: 'secondary' };
      default: return { text: status != null ? String(status) : 'N/A', badge: 'secondary' };
    }
  }

  function conversionLabel(status) {
    switch (status) {
      case 0: return Lang.get('bl.fullyEncrypted');
      case 1: return Lang.get('bl.encrypting');
      case 2: return Lang.get('bl.decrypting');
      case 3: return Lang.get('bl.notEncrypted');
      default: return status != null ? String(status) : 'N/A';
    }
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var uniqueDevices = new Set(_data.map(function (d) { return d.ResourceID; }));
    var totalDevices = uniqueDevices.size;

    // C: drive protection
    var cDrives = _data.filter(function (d) { return d.DriveLetter === 'C:'; });
    var protectedC = cDrives.filter(function (d) { return d.ProtectionStatus === 1; }).length;
    var unprotectedC = cDrives.length - protectedC;

    var encRate = cDrives.length > 0 ? (protectedC / cDrives.length) * 100 : 0;
    var encColor = Dashboard.thresholdColor('bitlocker', 'encryptionPercent', encRate, { warning: 90, critical: 75 }, false);

    var compliant = _data.filter(function (d) { return d.Compliant === 1; });
    var compliantDevices = new Set(compliant.map(function (d) { return d.ResourceID; })).size;

    c.appendChild(Dashboard.createMetricCard(Lang.get('dash.totalDevices'), Dashboard.formatNumber(totalDevices), {
      icon: '&#9919;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('bl.cProtected'), Dashboard.formatPercent(encRate), {
      icon: '&#128274;', color: encColor, statusClass: Dashboard.getStatusClass(encColor),
      sub: protectedC + ' / ' + cDrives.length + ' ' + Lang.get('common.device')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('bl.unprotected'), Dashboard.formatNumber(unprotectedC), {
      icon: '&#9888;', color: unprotectedC > 0 ? 'red' : 'green'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('bl.compliant'), Dashboard.formatNumber(compliantDevices), {
      icon: '&#10003;', color: 'green',
      sub: Lang.get('bl.policyCompliant')
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();
    var st = Dashboard.statusColors();

    // Protection status (C: drives)
    var cDrives = _data.filter(function (d) { return d.DriveLetter === 'C:'; });
    var prot = cDrives.filter(function (d) { return d.ProtectionStatus === 1; }).length;
    var unprot = cDrives.filter(function (d) { return d.ProtectionStatus === 0; }).length;
    var unknown = cDrives.length - prot - unprot;

    Dashboard.chart('chartProtection', {
      type: 'doughnut',
      data: {
        labels: [Lang.get('bl.protected'), Lang.get('bl.unprotected'), Lang.get('common.unknown')],
        // Korumali/Korumasiz DURUM anlatir -> rezerve durum renkleri
        datasets: [{ data: [prot, unprot, unknown], backgroundColor: [st.good, st.critical, Dashboard.chartMutedColor()] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: Dashboard.chartFontColor() } } } }
    });

    // Encryption method distribution
    var methodMap = {};
    _data.forEach(function (d) {
      var m = d.EncryptionMethod != null ? String(d.EncryptionMethod) : 'N/A';
      methodMap[m] = (methodMap[m] || 0) + 1;
    });
    var methodLabels = Object.keys(methodMap);
    Dashboard.chart('chartMethod', {
      type: 'bar',
      data: {
        labels: methodLabels,
        datasets: [{ data: methodLabels.map(function (k) { return methodMap[k]; }), backgroundColor: colors[2], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: Dashboard.chartFontColor(), stepSize: 1 }, grid: { color: Dashboard.chartGridColor() } },
          x: { ticks: { color: Dashboard.chartFontColor() }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var p = protectionLabel(d.ProtectionStatus);
      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml(d.DriveLetter),
        Dashboard.statusBadge(p.text, p.badge),
        conversionLabel(d.ConversionStatus),
        d.EncryptionMethod != null ? String(d.EncryptionMethod) : 'N/A',
        d.Compliant === 1 ? Dashboard.statusBadge(Lang.get('common.yes'), 'success') : Dashboard.statusBadge(Lang.get('common.no'), 'danger')
      ];
    });

    _dt = $('#blTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 20,
      language: Lang.dtLang()
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'bitlocker.csv');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
