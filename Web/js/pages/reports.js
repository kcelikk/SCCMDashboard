/**
 * SCCM Dashboard — Reports Page
 * Hazir raporlar, ozel rapor olusturucu ve zamanlama
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sccm_scheduled_reports';
  var _previewDt = null;
  var _previewData = null;
  var _currentColumns = [];

  // Hazir rapor sablonlari
  var TEMPLATES = [
    {
      id: 'asset-summary',
      name: 'Asset Ozet Raporu',
      description: 'Tum cihazlarin envanter ozeti — hostname, OS, IP, model, durum bilgileri',
      icon: '&#9000;',
      color: 'blue',
      source: 'asset',
      columns: ['Hostname', 'OS', 'DeviceType', 'IPAddress', 'Model', 'AssignedUser', 'LastActiveTime', 'ClientVersion']
    },
    {
      id: 'server-health',
      name: 'Server Saglik Raporu',
      description: 'Server durumu, uptime, bekleyen guncellemeler ve donanim bilgileri',
      icon: '&#9641;',
      color: 'purple',
      source: 'server',
      columns: null
    },
    {
      id: 'update-compliance',
      name: 'Update Uyumluluk Raporu',
      description: 'Guncelleme deployment durumlari, compliance oranlari ve basarisiz guncellemeler',
      icon: '&#8635;',
      color: 'green',
      source: 'update_deployment',
      columns: null
    },
    {
      id: 'software-inventory',
      name: 'Yazilim Envanter Raporu',
      description: 'Tum cihazlardaki yuklu yazilimlar, versiyonlar ve yayincilar',
      icon: '&#9776;',
      color: 'blue',
      source: 'app_inventory_detail',
      columns: null
    },
    {
      id: 'security-overview',
      name: 'Guvenlik Durum Raporu',
      description: 'BitLocker sifreleme durumu ve CMG internet istemci bilgileri',
      icon: '&#9919;',
      color: 'red',
      source: 'bitlocker',
      columns: null
    }
  ];

  async function init() {
    await Dashboard.init('reports', Lang.get('page.reports'));
    renderMetrics();
    renderTemplates();
    bindCustomBuilder();
    bindTabs();
    renderScheduledList();
  }

  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';
    var scheduled = getScheduledReports();
    c.appendChild(Dashboard.createMetricCard(Lang.get('rpt.readyReports'), TEMPLATES.length, {
      icon: '&#9776;', color: 'blue', sub: 'sablondan rapor olusturun'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('rpt.scheduledReports'), scheduled.length, {
      icon: '&#9733;', color: 'purple', sub: 'ozel rapor kaydi'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('rpt.dataSource'), '10', {
      icon: '&#9881;', color: 'green', sub: 'farkli veri tablosu'
    }));
    c.appendChild(Dashboard.createMetricCard('Export', 'CSV', {
      icon: '&#8681;', color: 'blue', sub: 'Excel uyumlu UTF-8'
    }));
  }

  // ─── Hazir Rapor Kartlari ───
  function renderTemplates() {
    var c = document.getElementById('reportTemplates');
    c.innerHTML = '';
    TEMPLATES.forEach(function (t) {
      var card = document.createElement('div');
      card.className = 'report-template-card';
      card.innerHTML =
        '<div class="report-template-icon ' + t.color + '">' + t.icon + '</div>' +
        '<div class="report-template-body">' +
          '<h4>' + Dashboard.escapeHtml(t.name) + '</h4>' +
          '<p>' + Dashboard.escapeHtml(t.description) + '</p>' +
          '<div class="report-template-actions">' +
            '<button class="btn btn-primary btn-sm" data-action="preview" data-id="' + t.id + '">' + Lang.get('rpt.preview') + '</button>' +
            '<button class="btn btn-success btn-sm" data-action="download" data-id="' + t.id + '">' + Lang.get('rpt.downloadCsv') + '</button>' +
          '</div>' +
        '</div>';
      c.appendChild(card);
    });

    c.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var action = btn.getAttribute('data-action');
      var template = TEMPLATES.find(function (t) { return t.id === id; });
      if (!template) return;
      if (action === 'preview') previewTemplate(template);
      else if (action === 'download') downloadTemplate(template);
    });
  }

  async function previewTemplate(template) {
    var data = await Dashboard.fetchData(template.source);
    if (!data || data.length === 0) {
      alert(Lang.get('common.noData') + ': ' + template.source);
      return;
    }

    var cols = template.columns || Object.keys(data[0]);
    var filtered = data.map(function (row) {
      var obj = {};
      cols.forEach(function (c) { obj[c] = row[c]; });
      return obj;
    });

    // Switch to custom tab and show preview
    switchTab('tab-custom');
    showPreview(template.name, cols, filtered);
  }

  async function downloadTemplate(template) {
    var data = await Dashboard.fetchData(template.source);
    if (!data || data.length === 0) {
      alert(Lang.get('common.noData'));
      return;
    }
    var cols = template.columns || Object.keys(data[0]);
    var colDefs = cols.map(function (c) { return { key: c, label: c }; });
    var filename = template.id + '_' + formatDateFile() + '.csv';
    CSVExport.exportToCSV(data, filename, colDefs);
  }

  // ─── Ozel Rapor Builder ───
  function bindCustomBuilder() {
    var sourceSelect = document.getElementById('reportSource');
    var colSelector = document.getElementById('columnSelector');
    var filterCol = document.getElementById('filterColumn');
    var sortCol = document.getElementById('sortColumn');

    sourceSelect.addEventListener('change', async function () {
      var src = sourceSelect.value;
      if (!src) {
        colSelector.innerHTML = '<div class="empty-state" style="padding:20px">' + Lang.get('rpt.dataSource') + '</div>';
        filterCol.innerHTML = '<option value="">' + Lang.get('rpt.filterColumn') + '</option>';
        sortCol.innerHTML = '<option value="">' + Lang.get('rpt.sortBy') + '</option>';
        return;
      }

      var data = await Dashboard.fetchData(src);
      if (!data || data.length === 0) {
        colSelector.innerHTML = '<div class="empty-state" style="padding:20px">' + Lang.get('common.noData') + '</div>';
        return;
      }

      var keys = Object.keys(data[0]);
      _currentColumns = keys;

      // Column checkboxes
      colSelector.innerHTML = keys.map(function (k) {
        return '<label class="column-check"><input type="checkbox" value="' + k + '" checked />' + Dashboard.escapeHtml(k) + '</label>';
      }).join('');

      // Filter and sort dropdowns
      filterCol.innerHTML = '<option value="">' + Lang.get('rpt.filterColumn') + '</option>' +
        keys.map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
      sortCol.innerHTML = '<option value="">' + Lang.get('rpt.sortBy') + '</option>' +
        keys.map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
    });

    document.getElementById('btnPreview').addEventListener('click', handlePreview);
    document.getElementById('btnDownloadCSV').addEventListener('click', handleDownloadCSV);
    document.getElementById('btnSaveSchedule').addEventListener('click', handleSaveSchedule);
  }

  async function handlePreview() {
    var config = getBuilderConfig();
    if (!config) return;
    var result = await executeReport(config);
    if (!result) return;
    showPreview(config.name || Lang.get('rpt.customReport'), result.columns, result.data);
  }

  async function handleDownloadCSV() {
    var config = getBuilderConfig();
    if (!config) return;
    var result = await executeReport(config);
    if (!result) return;
    var colDefs = result.columns.map(function (c) { return { key: c, label: c }; });
    var filename = (config.name || 'rapor').replace(/\s+/g, '_') + '_' + formatDateFile() + '.csv';
    CSVExport.exportToCSV(result.data, filename, colDefs);
  }

  function handleSaveSchedule() {
    var config = getBuilderConfig();
    if (!config) return;

    // Show schedule dialog
    var scheduleName = config.name || Lang.get('rpt.customReport');
    var scheduleType = prompt(
      'Rapor zamanlama secin:\n1 = Gunluk\n2 = Haftalik\n3 = Aylik\n4 = Sadece Kaydet (zamanlama yok)',
      '4'
    );

    if (!scheduleType) return;
    var typeMap = { '1': 'daily', '2': 'weekly', '3': 'monthly', '4': 'saved' };
    var typeLabels = { daily: 'Gunluk', weekly: 'Haftalik', monthly: 'Aylik', saved: 'Kaydedildi' };
    var type = typeMap[scheduleType] || 'saved';

    var report = {
      id: 'rpt_' + Date.now(),
      name: scheduleName,
      config: config,
      scheduleType: type,
      scheduleLabel: typeLabels[type],
      createdAt: new Date().toISOString(),
      lastRun: null
    };

    var reports = getScheduledReports();
    reports.push(report);
    saveScheduledReports(reports);

    alert('Rapor kaydedildi: ' + scheduleName + ' (' + typeLabels[type] + ')');
    renderScheduledList();
    renderMetrics();
  }

  function getBuilderConfig() {
    var source = document.getElementById('reportSource').value;
    if (!source) {
      alert(Lang.get('rpt.dataSource'));
      return null;
    }

    var checkedCols = [];
    document.querySelectorAll('#columnSelector input[type=checkbox]:checked').forEach(function (cb) {
      checkedCols.push(cb.value);
    });
    if (checkedCols.length === 0) checkedCols = _currentColumns.slice();

    return {
      name: document.getElementById('reportName').value || Lang.get('rpt.customReport'),
      source: source,
      columns: checkedCols,
      filterColumn: document.getElementById('filterColumn').value,
      filterOperator: document.getElementById('filterOperator').value,
      filterValue: document.getElementById('filterValue').value,
      sortColumn: document.getElementById('sortColumn').value,
      sortDirection: document.getElementById('sortDirection').value,
      limit: parseInt(document.getElementById('reportLimit').value, 10) || 0
    };
  }

  async function executeReport(config) {
    var data = await Dashboard.fetchData(config.source);
    if (!data || data.length === 0) {
      alert(Lang.get('common.noData') + ': ' + config.source);
      return null;
    }

    // Filter
    if (config.filterColumn && config.filterValue) {
      data = data.filter(function (row) {
        var val = String(row[config.filterColumn] || '').toLowerCase();
        var fv = config.filterValue.toLowerCase();
        switch (config.filterOperator) {
          case 'equals': return val === fv;
          case 'not_equals': return val !== fv;
          case 'greater': return parseFloat(val) > parseFloat(fv);
          case 'less': return parseFloat(val) < parseFloat(fv);
          default: return val.indexOf(fv) !== -1;
        }
      });
    }

    // Sort
    if (config.sortColumn) {
      data.sort(function (a, b) {
        var va = a[config.sortColumn], vb = b[config.sortColumn];
        if (va == null) va = '';
        if (vb == null) vb = '';
        var cmp = String(va).localeCompare(String(vb), 'tr', { numeric: true });
        return config.sortDirection === 'desc' ? -cmp : cmp;
      });
    }

    // Limit
    if (config.limit > 0) {
      data = data.slice(0, config.limit);
    }

    // Select columns
    var filtered = data.map(function (row) {
      var obj = {};
      config.columns.forEach(function (c) { obj[c] = row[c]; });
      return obj;
    });

    return { columns: config.columns, data: filtered };
  }

  function showPreview(title, columns, data) {
    var card = document.getElementById('previewCard');
    card.style.display = '';
    document.getElementById('previewTitle').textContent = title + ' ' + Lang.get('rpt.preview');
    document.getElementById('previewCount').textContent = data.length + ' kayit';

    // Destroy old DataTable
    if (_previewDt) {
      _previewDt.destroy();
      _previewDt = null;
    }

    var thead = document.getElementById('previewHead');
    thead.innerHTML = columns.map(function (c) { return '<th>' + Dashboard.escapeHtml(c) + '</th>'; }).join('');

    var rows = data.map(function (row) {
      return columns.map(function (c) {
        var v = row[c];
        if (v == null) return '';
        return Dashboard.escapeHtml(String(v));
      });
    });

    _previewDt = $('#previewTable').DataTable({
      data: rows,
      destroy: true,
      order: [[0, 'asc']],
      pageLength: 25,
      language: Lang.dtLang()
    });

    _previewData = data;

    // Scroll to preview
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── Zamanlanmis Raporlar ───
  function getScheduledReports() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) { return []; }
  }

  function saveScheduledReports(reports) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }

  function renderScheduledList() {
    var c = document.getElementById('scheduledList');
    var reports = getScheduledReports();

    if (reports.length === 0) {
      c.innerHTML = '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
      return;
    }

    var typeIcons = { daily: '&#9201;', weekly: '&#9201;', monthly: '&#9201;', saved: '&#9733;' };
    var html = '<div class="scheduled-reports-list">';

    reports.forEach(function (r) {
      html +=
        '<div class="scheduled-report-item">' +
          '<div class="scheduled-report-info">' +
            '<span class="scheduled-icon">' + (typeIcons[r.scheduleType] || '&#9733;') + '</span>' +
            '<div>' +
              '<strong>' + Dashboard.escapeHtml(r.name) + '</strong>' +
              '<div class="scheduled-meta">' +
                Dashboard.statusBadge(r.scheduleLabel, r.scheduleType === 'saved' ? 'info' : 'success') +
                ' &middot; ' + Lang.get('rpt.dataSource') + ': ' + Dashboard.escapeHtml(r.config.source) +
                ' &middot; ' + Dashboard.formatDate(r.createdAt) +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="scheduled-report-actions">' +
            '<button class="btn btn-primary btn-sm" data-run="' + r.id + '">' + Lang.get('common.refresh') + '</button>' +
            '<button class="btn btn-success btn-sm" data-download="' + r.id + '">' + Lang.get('rpt.downloadCsv') + '</button>' +
            '<button class="btn btn-danger btn-sm" data-delete="' + r.id + '">Sil</button>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    c.innerHTML = html;

    // Bind events
    c.querySelectorAll('[data-run]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-run');
        runScheduledReport(id);
      });
    });

    c.querySelectorAll('[data-download]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-download');
        downloadScheduledReport(id);
      });
    });

    c.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete');
        deleteScheduledReport(id);
      });
    });

    // Clear all
    document.getElementById('btnClearScheduled').addEventListener('click', function () {
      if (confirm('Tum kayitli raporlar silinecek. Emin misiniz?')) {
        saveScheduledReports([]);
        renderScheduledList();
        renderMetrics();
      }
    });
  }

  async function runScheduledReport(id) {
    var reports = getScheduledReports();
    var report = reports.find(function (r) { return r.id === id; });
    if (!report) return;

    var result = await executeReport(report.config);
    if (!result) return;

    // Update last run
    report.lastRun = new Date().toISOString();
    saveScheduledReports(reports);

    switchTab('tab-custom');
    showPreview(report.name, result.columns, result.data);
  }

  async function downloadScheduledReport(id) {
    var reports = getScheduledReports();
    var report = reports.find(function (r) { return r.id === id; });
    if (!report) return;

    var result = await executeReport(report.config);
    if (!result) return;

    var colDefs = result.columns.map(function (c) { return { key: c, label: c }; });
    var filename = report.name.replace(/\s+/g, '_') + '_' + formatDateFile() + '.csv';
    CSVExport.exportToCSV(result.data, filename, colDefs);

    report.lastRun = new Date().toISOString();
    saveScheduledReports(reports);
  }

  function deleteScheduledReport(id) {
    if (!confirm('Bu rapor silinecek. Emin misiniz?')) return;
    var reports = getScheduledReports().filter(function (r) { return r.id !== id; });
    saveScheduledReports(reports);
    renderScheduledList();
    renderMetrics();
  }

  // ─── Tab Navigation ───
  function bindTabs() {
    document.querySelectorAll('.tab-bar .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        switchTab(target);
      });
    });
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-bar .tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var content = document.getElementById(tabId);
    if (content) content.classList.add('active');
  }

  // ─── Helpers ───
  function formatDateFile() {
    var d = new Date();
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '_' +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
