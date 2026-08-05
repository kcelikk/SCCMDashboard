/**
 * SCCM Dashboard — LAPS Page
 */
(function () {
  'use strict';

  var _data = null;
  var _dt = null;

  async function init() {
    await Dashboard.init('laps', Lang.get('page.laps'));
    _data = await Dashboard.fetchData('laps');
    if (await Dashboard.bailIfEmpty('laps', _data)) return;
    renderAlerts();
    renderMetrics();
    renderCharts();
    renderTable();
  }

  function parseLapsExpiry(val) {
    if (!val) return null;
    // LAPS expiry is Windows FileTime (100-nanosecond intervals since 1601)
    // or ISO date string depending on SCCM version
    if (typeof val === 'string' && val.indexOf('T') > -1) return new Date(val);
    if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
      var ft = Number(val);
      if (ft > 100000000000000) {
        // Windows FileTime to JS Date
        return new Date(ft / 10000 - 11644473600000);
      }
      return new Date(ft);
    }
    return null;
  }

  function getLapsStatus(d) {
    if (!d.PasswordExpiry) return { managed: false, expired: false, daysUntilExpiry: null };
    var expiry = parseLapsExpiry(d.PasswordExpiry);
    if (!expiry || isNaN(expiry.getTime())) return { managed: false, expired: false, daysUntilExpiry: null };
    var now = new Date();
    var diffDays = Math.round((expiry - now) / 86400000);
    return { managed: true, expired: diffDays < 0, daysUntilExpiry: diffDays, expiryDate: expiry };
  }

  function renderAlerts() {
    var area = document.getElementById('alertArea');
    var alerts = [];
    var noLaps = _data.filter(function (d) { return !getLapsStatus(d).managed; });
    var expired = _data.filter(function (d) { var s = getLapsStatus(d); return s.managed && s.expired; });
    var total = _data.length;
    var coverage = total > 0 ? ((total - noLaps.length) / total * 100) : 0;

    if (coverage < 70) alerts.push({ level: 'critical', text: Lang.get('laps.coverageCritical') + ': ' + coverage.toFixed(0) + '% (' + noLaps.length + ' ' + Lang.get('laps.devicesOutside') + ')' });
    else if (coverage < 90) alerts.push({ level: 'warning', text: Lang.get('laps.coverage') + ': ' + coverage.toFixed(0) + '% (' + noLaps.length + ' ' + Lang.get('laps.devicesOutside') + ')' });
    if (expired.length > 0) alerts.push({ level: 'warning', text: expired.length + ' ' + Lang.get('laps.pwdExpired') });

    area.innerHTML = alerts.map(function (a) {
      return '<div class="alert-banner ' + a.level + '">' + (a.level === 'critical' ? '&#9888; ' : '&#9432; ') + a.text + '</div>';
    }).join('');
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var total = _data.length;
    var managed = _data.filter(function (d) { return getLapsStatus(d).managed; }).length;
    var notManaged = total - managed;
    var expired = _data.filter(function (d) { var s = getLapsStatus(d); return s.managed && s.expired; }).length;
    var coverage = total > 0 ? (managed / total * 100) : 0;
    var covColor = Dashboard.thresholdColor('laps', 'coveragePercent', coverage, { warning: 90, critical: 70 }, false);

    c.appendChild(Dashboard.createMetricCard(Lang.get('dash.totalDevices'), Dashboard.formatNumber(total), {
      icon: '&#128273;', color: 'blue'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('laps.coverage'), Dashboard.formatPercent(coverage), {
      icon: '&#10003;', color: covColor, statusClass: Dashboard.getStatusClass(covColor),
      sub: managed + ' / ' + total + ' ' + Lang.get('common.device')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('laps.notManaged'), Dashboard.formatNumber(notManaged), {
      icon: '&#9888;', color: notManaged > 0 ? 'red' : 'green',
      statusClass: Dashboard.getStatusClass(notManaged > 0 ? 'red' : 'green')
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('laps.expired'), Dashboard.formatNumber(expired), {
      icon: '&#9201;', color: expired > 0 ? 'yellow' : 'green',
      sub: Lang.get('laps.pwdRenew')
    }));
  }

  function renderCharts() {
    var colors = Dashboard.chartColors();

    // Coverage donut
    var managed = _data.filter(function (d) { return getLapsStatus(d).managed; }).length;
    var notManaged = _data.length - managed;
    // Iki degerin karsilastirmasi -> cubuk. Yonetiliyor/yonetilmiyor DURUM'dur.
    var st = Dashboard.statusColors();
    Dashboard.chart('chartCoverage', {
      type: 'bar',
      data: {
        labels: [Lang.get('laps.lapsActive'), Lang.get('laps.lapsNone')],
        datasets: [{ data: [managed, notManaged], backgroundColor: [st.good, st.critical] }]
      },
      options: {
        indexAxis: 'y',
        scales: { x: { grid: { display: true } }, y: { grid: { display: false } } }
      }
    });

    // Password age distribution
    var buckets = { '0-7 gun': 0, '8-14 gun': 0, '15-30 gun': 0, '30+ gun': 0 };
    buckets[Lang.get('laps.expired')] = 0;
    _data.forEach(function (d) {
      var s = getLapsStatus(d);
      if (!s.managed) return;
      if (s.expired) buckets[Lang.get('laps.expired')]++;
      else if (s.daysUntilExpiry <= 7) buckets['0-7 gun']++;
      else if (s.daysUntilExpiry <= 14) buckets['8-14 gun']++;
      else if (s.daysUntilExpiry <= 30) buckets['15-30 gun']++;
      else buckets['30+ gun']++;
    });
    var ageLabels = Object.keys(buckets);
    Dashboard.chart('chartAge', {
      type: 'bar',
      data: {
        labels: ageLabels,
        datasets: [{ data: ageLabels.map(function (k) { return buckets[k]; }), backgroundColor: [colors[1], colors[2], colors[3], colors[0], colors[4]], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: Dashboard.chartFontColor() }, grid: { color: Dashboard.chartGridColor() } },
          x: { ticks: { color: Dashboard.chartFontColor() }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTable() {
    var rows = _data.map(function (d) {
      var s = getLapsStatus(d);
      var statusBadge, expiryText, ageText;

      if (s.managed) {
        statusBadge = s.expired ? Dashboard.statusBadge(Lang.get('laps.expired'), 'danger') : Dashboard.statusBadge(Lang.get('common.active'), 'success');
        expiryText = s.expiryDate ? Dashboard.formatDate(s.expiryDate.toISOString()) : '-';
        ageText = s.daysUntilExpiry != null ? String(s.daysUntilExpiry) : '-';
      } else {
        statusBadge = Dashboard.statusBadge(Lang.get('laps.lapsNone'), 'secondary');
        expiryText = '-';
        ageText = '-';
      }

      return [
        Dashboard.escapeHtml(d.Hostname),
        Dashboard.escapeHtml((d.OS || '')),
        d.DeviceType,
        Dashboard.escapeHtml(d.Domain),
        statusBadge,
        expiryText,
        ageText
      ];
    });

    _dt = $('#lapsTable').DataTable({
      data: rows, order: [[4, 'asc']], pageLength: 20,
      language: Lang.dtLang()
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      CSVExport.exportDataTable(_dt, 'laps.csv');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
