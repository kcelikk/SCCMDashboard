/**
 * SCCM Dashboard — Device Detail (Drill-Down) Page
 * URL: /pages/device-detail.html?host=HOSTNAME
 */
(function () {
  'use strict';

  var _hostname = null;
  var _device = null;
  var _allData = {};

  async function init() {
    await Dashboard.init('device-detail', 'Device Detail');

    // Get hostname from URL
    var params = new URLSearchParams(window.location.search);
    _hostname = params.get('host');

    if (!_hostname) {
      document.getElementById('deviceHeader').innerHTML =
        '<div class="empty-state">' + Lang.get('common.noData') + '</div>';
      return;
    }

    // Set page title
    var titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = _hostname + ' — Device Detail';

    // Load all data sources in parallel
    var results = await Promise.all([
      Dashboard.fetchData('asset'),
      Dashboard.fetchData('app_inventory_detail'),
      Dashboard.fetchData('update_deployment_detail'),
      Dashboard.fetchData('bitlocker'),
      Dashboard.fetchData('cmg_clients'),
      Dashboard.fetchData('server'),
      Dashboard.fetchData('client_pc')
    ]);

    var assets = results[0] || [];
    var appDetail = results[1] || [];
    var updateDetail = results[2] || [];
    var bitlocker = results[3] || [];
    var cmgClients = results[4] || [];
    var servers = results[5] || [];
    var clientPcs = results[6] || [];

    // Find device in asset data
    _device = assets.find(function (d) {
      return d.Hostname && d.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    // Also check server and client_pc data for extra info
    var serverInfo = servers.find(function (d) {
      return d.Hostname && d.Hostname.toLowerCase() === _hostname.toLowerCase();
    });
    var clientInfo = clientPcs.find(function (d) {
      return d.Hostname && d.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    // Merge extra info
    if (_device && serverInfo) {
      Object.keys(serverInfo).forEach(function (k) {
        if (!_device[k]) _device[k] = serverInfo[k];
      });
    }
    if (_device && clientInfo) {
      Object.keys(clientInfo).forEach(function (k) {
        if (!_device[k]) _device[k] = clientInfo[k];
      });
    }

    if (!_device) {
      document.getElementById('deviceHeader').innerHTML =
        '<div class="empty-state">"' + Dashboard.escapeHtml(_hostname) + '" ' + Lang.get('common.noData') + '</div>';
      return;
    }

    // Device apps
    var deviceApps = appDetail.filter(function (a) {
      return a.Hostname && a.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    // Device updates
    var deviceUpdates = updateDetail.filter(function (u) {
      return u.Hostname && u.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    // Device BitLocker
    var deviceBitlocker = bitlocker.filter(function (b) {
      return b.Hostname && b.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    // Device CMG
    var deviceCmg = cmgClients.find(function (c) {
      return c.Hostname && c.Hostname.toLowerCase() === _hostname.toLowerCase();
    });

    _allData = {
      apps: deviceApps,
      updates: deviceUpdates,
      bitlocker: deviceBitlocker,
      cmg: deviceCmg
    };

    renderDeviceHeader();
    renderMetrics();
    renderGeneralInfo();
    renderHardwareInfo();
    renderSoftwareTable();
    renderUpdatesTable();
    renderSecurityInfo();
    bindTabs();
  }

  function isStale() {
    if (!_device.LastActiveTime) return true;
    return (Date.now() - new Date(_device.LastActiveTime).getTime()) > 30 * 86400000;
  }

  function renderDeviceHeader() {
    var stale = isStale();
    var c = document.getElementById('deviceHeader');
    c.innerHTML =
      '<div class="device-header-content">' +
        '<div class="device-header-icon ' + (_device.DeviceType === 'Server' ? 'purple' : 'blue') + '">' +
          (_device.DeviceType === 'Server' ? '&#9641;' : '&#9109;') +
        '</div>' +
        '<div class="device-header-info">' +
          '<h2>' + Dashboard.escapeHtml(_device.Hostname) + '</h2>' +
          '<div class="device-header-meta">' +
            Dashboard.statusBadge(_device.DeviceType, 'info') + ' ' +
            Dashboard.statusBadge(stale ? 'Stale' : Lang.get('common.active'), stale ? 'warning' : 'success') + ' ' +
            '<span>' + Dashboard.escapeHtml(_device.OS || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="device-header-actions">' +
          '<button class="btn btn-secondary" id="btnExportDevice">' + Lang.get('rpt.downloadCsv') + '</button>' +
        '</div>' +
      '</div>';

    document.getElementById('btnExportDevice').addEventListener('click', function () {
      var exportData = [_device];
      CSVExport.exportToCSV(exportData, _hostname + '_detay.csv');
    });
  }

  function renderMetrics() {
    var c = document.getElementById('deviceMetrics');
    c.innerHTML = '';

    var stale = isStale();
    c.appendChild(Dashboard.createMetricCard(Lang.get('asset.status'), stale ? 'Stale' : Lang.get('common.active'), {
      icon: stale ? '&#9888;' : '&#10003;',
      color: stale ? 'yellow' : 'green',
      statusClass: Dashboard.getStatusClass(stale ? 'yellow' : 'green'),
      sub: 'Son: ' + Dashboard.timeAgo(_device.LastActiveTime)
    }));

    c.appendChild(Dashboard.createMetricCard(Lang.get('page.appInventory'), Dashboard.formatNumber(_allData.apps.length), {
      icon: '&#9776;', color: 'blue', sub: 'yuklu uygulama'
    }));

    c.appendChild(Dashboard.createMetricCard(Lang.get('page.updateDeployment'), Dashboard.formatNumber(_allData.updates.length), {
      icon: '&#8635;', color: 'purple', sub: 'guncelleme kaydi'
    }));

    var blProtected = _allData.bitlocker.some(function (b) {
      return b.ProtectionStatus === 1 && b.DriveLetter === 'C:';
    });
    c.appendChild(Dashboard.createMetricCard(Lang.get('page.bitlocker'), blProtected ? Lang.get('bl.protected') : Lang.get('bl.unprotected'), {
      icon: '&#9919;', color: blProtected ? 'green' : 'red',
      statusClass: Dashboard.getStatusClass(blProtected ? 'green' : 'red')
    }));
  }

  function renderGeneralInfo() {
    var d = _device;
    var fields = [
      { label: Lang.get('asset.hostname'), value: d.Hostname },
      { label: 'FQDN', value: d.FQDN || (d.Hostname + '.' + (d.Domain || '')) },
      { label: Lang.get('asset.ipAddress'), value: d.IPAddress },
      { label: 'Domain', value: d.Domain },
      { label: 'AD Site', value: d.ADSite },
      { label: Lang.get('asset.os'), value: d.OS },
      { label: 'OS Build', value: d.OSBuild },
      { label: Lang.get('asset.type'), value: d.DeviceType },
      { label: Lang.get('asset.user'), value: d.AssignedUser },
      { label: 'Client Version', value: d.ClientVersion },
      { label: Lang.get('asset.lastActivity'), value: Dashboard.formatDate(d.LastActiveTime) },
      { label: 'Son HW Scan', value: Dashboard.formatDate(d.LastHW) },
      { label: 'Son SW Scan', value: Dashboard.formatDate(d.LastSW) },
      { label: 'Client Health', value: d.ClientHealth },
      { label: 'Virtual', value: d.IsVirtual ? Lang.get('common.yes') : Lang.get('common.no') },
      { label: 'CMG', value: _allData.cmg ? 'Internet Etkin' : 'Yok' }
    ];

    var c = document.getElementById('generalInfo');
    c.innerHTML = fields.map(function (f) {
      return '<div class="panel-info-item">' +
        '<div class="label">' + f.label + '</div>' +
        '<div class="value">' + Dashboard.escapeHtml(f.value || '-') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderHardwareInfo() {
    var d = _device;
    var fields = [
      { label: Lang.get('hw.manufacturer'), value: d.Manufacturer },
      { label: Lang.get('asset.model'), value: d.Model },
      { label: 'Serial Number', value: d.SerialNumber },
      { label: 'CPU', value: d.CPU || d.ProcessorName },
      { label: 'CPU Core', value: d.CPUCores || d.NumberOfCores },
      { label: 'RAM (GB)', value: d.TotalMemoryGB || d.TotalPhysicalMemory },
      { label: 'Disk (GB)', value: d.DiskSizeGB || d.TotalDiskSpace },
      { label: 'Free Disk (GB)', value: d.FreeDiskGB || d.FreeDiskSpace },
      { label: 'MAC', value: d.MACAddress },
      { label: 'BIOS Version', value: d.BIOSVersion }
    ];

    var c = document.getElementById('hardwareInfo');
    c.innerHTML = fields.map(function (f) {
      var val = f.value;
      if (val != null && !isNaN(val) && typeof val === 'number') val = Dashboard.formatNumber(val);
      return '<div class="panel-info-item">' +
        '<div class="label">' + f.label + '</div>' +
        '<div class="value">' + Dashboard.escapeHtml(val != null ? String(val) : '-') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderSoftwareTable() {
    if (_allData.apps.length === 0) {
      $('#softwareTable').closest('.table-card').find('h3').after(
        '<div class="empty-state" style="padding:20px">' + Lang.get('common.noData') + '</div>'
      );
      return;
    }

    var rows = _allData.apps.map(function (a) {
      return [
        Dashboard.escapeHtml(a.AppName || a.DisplayName0 || ''),
        Dashboard.escapeHtml(a.Version || a.Version0 || ''),
        Dashboard.escapeHtml(a.Publisher || a.Publisher0 || '')
      ];
    });

    var dt = $('#softwareTable').DataTable({
      data: rows, order: [[0, 'asc']], pageLength: 15,
      language: Lang.dtLang()
    });

    document.getElementById('btnExportSw').addEventListener('click', function () {
      CSVExport.exportDataTable(dt, _hostname + '_yazilimlar.csv');
    });
  }

  function renderUpdatesTable() {
    if (_allData.updates.length === 0) {
      $('#updatesTable').closest('.table-card').find('h3').after(
        '<div class="empty-state" style="padding:20px">' + Lang.get('common.noData') + '</div>'
      );
      return;
    }

    var rows = _allData.updates.map(function (u) {
      var statusText = u.Status || u.StatusDescription || '';
      var statusType = 'secondary';
      if (/install/i.test(statusText)) statusType = 'success';
      else if (/fail/i.test(statusText)) statusType = 'danger';
      else if (/required|pending/i.test(statusText)) statusType = 'warning';

      return [
        Dashboard.escapeHtml(u.UpdateName || u.ArticleID || ''),
        Dashboard.statusBadge(statusText || '-', statusType),
        Dashboard.formatDate(u.LastStatusTime || u.StatusTime)
      ];
    });

    var dt = $('#updatesTable').DataTable({
      data: rows, order: [[2, 'desc']], pageLength: 15,
      language: Lang.dtLang()
    });

    document.getElementById('btnExportUpd').addEventListener('click', function () {
      CSVExport.exportDataTable(dt, _hostname + '_guncellemeler.csv');
    });
  }

  function renderSecurityInfo() {
    var c = document.getElementById('securityInfo');
    var fields = [];

    // BitLocker info
    if (_allData.bitlocker.length > 0) {
      _allData.bitlocker.forEach(function (b) {
        fields.push({ label: Lang.get('page.bitlocker') + ' — ' + (b.DriveLetter || 'Disk'), value: b.ProtectionStatus === 1 ? Lang.get('bl.protected') : Lang.get('bl.unprotected') });
        if (b.EncryptionMethod) fields.push({ label: Lang.get('bl.encMethod'), value: b.EncryptionMethod });
      });
    } else {
      fields.push({ label: Lang.get('page.bitlocker'), value: Lang.get('common.noData') });
    }

    // CMG info
    if (_allData.cmg) {
      fields.push({ label: 'CMG', value: 'Internet Etkin' });
      fields.push({ label: 'CMG Last Online', value: Dashboard.formatDate(_allData.cmg.LastOnlineTime) });
    } else {
      fields.push({ label: 'CMG', value: 'N/A' });
    }

    c.innerHTML = fields.map(function (f) {
      return '<div class="panel-info-item">' +
        '<div class="label">' + f.label + '</div>' +
        '<div class="value">' + Dashboard.escapeHtml(f.value || '-') + '</div>' +
      '</div>';
    }).join('');
  }

  function bindTabs() {
    document.querySelectorAll('.tab-bar .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab-bar .tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var target = document.getElementById(tab.getAttribute('data-tab'));
        if (target) target.classList.add('active');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
