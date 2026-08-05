/**
 * SCCM Dashboard — Trend Analizi
 * _history.json icindeki anlik goruntuleri zaman serisi olarak gosterir.
 * Kayitlar her cache refresh sonunda Run-CacheRefresh.ps1 tarafindan eklenir.
 */
(function () {
  'use strict';

  var _history = [];
  var _rangeDays = 30;
  // Grafik instance yonetimi Dashboard.chart() icinde (tema degisiminde retint icin)
  var _dt = null;

  async function init() {
    await Dashboard.init('trend', Lang.get('page.trend'));
    if (!Dashboard.checkPageAccess('trend')) return;

    bindRangeButtons();
    await load();

    // Manuel/otomatik yenilemede veriyi tazele
    window._pageReload = load;
  }

  async function load() {
    var data = await Dashboard.fetchData('_history');
    _history = Array.isArray(data) ? data : [];

    // Zamana gore sirala (dosya zaten sirali ama garanti altina al)
    _history.sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    render();
  }

  function bindRangeButtons() {
    document.querySelectorAll('[data-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _rangeDays = parseInt(btn.getAttribute('data-range'), 10);
        document.querySelectorAll('[data-range]').forEach(function (b) {
          b.className = 'btn btn-secondary btn-sm';
        });
        btn.className = 'btn btn-primary btn-sm';
        render();
      });
    });
  }

  function filtered() {
    if (!_rangeDays) return _history;
    var cutoff = Date.now() - _rangeDays * 86400000;
    return _history.filter(function (h) {
      return new Date(h.timestamp).getTime() >= cutoff;
    });
  }

  function render() {
    var rows = filtered();
    var area = document.getElementById('alertArea');

    if (!_history.length) {
      area.innerHTML = '<div class="alert-banner warning">&#9432; ' +
        Dashboard.escapeHtml(Lang.get('trend.noHistory')) + '</div>';
    } else {
      area.innerHTML = '';
    }

    renderMetrics(rows);
    renderCharts(rows);
    renderTable(rows);
  }

  // ─── Ozet Metrikler (secili aralikta ilk -> son degisim) ───
  function renderMetrics(rows) {
    var c = document.getElementById('metrics');
    c.innerHTML = '';

    var first = rows[0];
    var last = rows[rows.length - 1];

    c.appendChild(Dashboard.createMetricCard(Lang.get('trend.snapshots'),
      Dashboard.formatNumber(rows.length), {
        icon: '&#9201;', color: 'blue',
        sub: periodLabel(rows)
      }));

    if (!first || !last) return;

    c.appendChild(deltaCard(Lang.get('dash.totalDevices'),
      last.totalDevices, first.totalDevices, '&#9000;', false));

    c.appendChild(deltaCard(Lang.get('dash.updateCompliance'),
      last.updateCompliance, first.updateCompliance, '&#8635;', false, '%'));

    c.appendChild(deltaCard(Lang.get('trend.failureTrend'),
      (last.updateFailed || 0) + (last.appFailed || 0),
      (first.updateFailed || 0) + (first.appFailed || 0), '&#9888;', true));
  }

  // lowerIsBetter: artis kotu ise true
  function deltaCard(title, current, previous, icon, lowerIsBetter, unit) {
    var cur = Number(current) || 0;
    var prev = Number(previous) || 0;
    var diff = Math.round((cur - prev) * 10) / 10;

    var color = 'blue';
    if (diff !== 0) {
      var improved = lowerIsBetter ? diff < 0 : diff > 0;
      color = improved ? 'green' : 'yellow';
    }

    var sign = diff > 0 ? '+' : '';
    var sub = Lang.get('trend.change') + ': ' + sign + Dashboard.formatNumber(diff) + (unit || '');

    return Dashboard.createMetricCard(title,
      Dashboard.formatNumber(cur) + (unit || ''), {
        icon: icon, color: color, sub: sub
      });
  }

  function periodLabel(rows) {
    if (rows.length < 2) return '-';
    var days = (new Date(rows[rows.length - 1].timestamp) - new Date(rows[0].timestamp)) / 86400000;
    return Math.round(days * 10) / 10 + ' ' + Lang.get('trend.days');
  }

  // ─── Grafikler ───
  function renderCharts(rows) {
    var labels = rows.map(function (h) { return Dashboard.formatDate(h.timestamp); });
    var colors = Dashboard.chartColors();

    // Seri renkleri KIMLIGE baglidir, siraya degil: bir seri filtrelenirse
    // kalanlar renk degistirmez. slot numarasi tema degisiminde de korunur.
    lineChart('chartDevices', labels, [
      { slot: 1, label: Lang.get('dash.totalDevices'),  data: rows.map(f('totalDevices')),  color: colors[0] },
      { slot: 3, label: Lang.get('dash.activeDevices'), data: rows.map(f('activeDevices')), color: colors[2] },
      { slot: 4, label: Lang.get('dash.staleDevices'),  data: rows.map(f('staleDevices')),  color: colors[3] }
    ]);

    lineChart('chartCompliance', labels, [
      { slot: 1, label: Lang.get('dash.updateCompliance'), data: rows.map(f('updateCompliance')), color: colors[0], fill: true }
    ], { max: 100 });

    lineChart('chartFailures', labels, [
      { slot: 8, label: 'Update', data: rows.map(f('updateFailed')), color: colors[7] },
      { slot: 2, label: 'App',    data: rows.map(f('appFailed')),    color: colors[1] }
    ]);

    lineChart('chartBitlocker', labels, [
      {
        slot: 3,
        label: Lang.get('page.bitlocker'),
        data: rows.map(function (h) {
          var t = Number(h.bitlockerTotal) || 0;
          return t > 0 ? Math.round((Number(h.bitlockerProtected) || 0) / t * 1000) / 10 : 0;
        }),
        color: colors[2], fill: true
      }
    ], { max: 100 });

    lineChart('chartHealth', labels, [
      { slot: 8, label: Lang.get('db.compTab'),      data: rows.map(f('componentErrors')), color: colors[7] },
      { slot: 4, label: Lang.get('page.sccmAlerts'), data: rows.map(f('alertCount')),      color: colors[3] }
    ]);

    lineChart('chartDuration', labels, [
      { slot: 7, label: Lang.get('sys.duration'), data: rows.map(f('refreshDuration')), color: colors[6], fill: true }
    ]);
  }

  // Alan okuyucu — eksik alanlar 0 olur
  function f(key) {
    return function (h) { return Number(h[key]) || 0; };
  }

  function lineChart(canvasId, labels, series, opts) {
    opts = opts || {};
    Dashboard.chart(canvasId, {
      type: 'line',
      data: {
        labels: labels,
        datasets: series.map(function (s) {
          return {
            _slot: s.slot,                       // tema degisiminde yeniden renklendirmek icin
            label: s.label,
            data: s.data,
            borderColor: s.color,
            backgroundColor: s.fill ? Dashboard.withAlpha(s.color, 0.1) : s.color,
            fill: !!s.fill,
            // Cok noktali seride isaretci gurultu yapar; hover yine calisir
            pointRadius: labels.length > 40 ? 0 : 3
          };
        })
      },
      options: {
        scales: {
          x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } },
          y: { max: opts.max }
        }
      }
    });
  }

  // ─── Tablo ───
  function renderTable(rows) {
    var data = rows.slice().reverse().map(function (h) {
      var blTotal = Number(h.bitlockerTotal) || 0;
      var blPct = blTotal > 0 ? Math.round((Number(h.bitlockerProtected) || 0) / blTotal * 1000) / 10 : 0;
      return [
        Dashboard.formatDate(h.timestamp),
        Dashboard.formatNumber(h.totalDevices),
        Dashboard.formatNumber(h.activeDevices),
        Dashboard.formatPercent(h.updateCompliance),
        Dashboard.formatNumber((h.updateFailed || 0) + (h.appFailed || 0)),
        (h.bitlockerProtected || 0) + ' / ' + blTotal + ' (' + blPct + '%)',
        (h.componentErrors || 0) + ' / ' + (h.alertCount || 0),
        Dashboard.formatNumber(h.refreshDuration)
      ];
    });

    if ($.fn.DataTable.isDataTable('#trendTable')) {
      $('#trendTable').DataTable().destroy();
    }

    _dt = $('#trendTable').DataTable({
      data: data,
      order: [],            // veri zaten yeniden eskiye sirali
      pageLength: 25,
      language: Lang.dtLang()
    });

    document.getElementById('btnExportTrend').onclick = function () {
      CSVExport.exportDataTable(_dt, 'trend_gecmisi.csv');
    };
  }

  document.addEventListener('DOMContentLoaded', init);
})();
