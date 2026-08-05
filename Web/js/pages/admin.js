/**
 * SCCM Dashboard — Admin / RBAC Page
 * Rol tabanli erisim kontrolu yonetimi
 */
(function () {
  'use strict';

  var ROLES_KEY = 'sccm_rbac_roles';
  var USERS_KEY = 'sccm_rbac_users';
  var AUDIT_KEY = 'sccm_rbac_audit';

  var ALL_PAGES = [
    { id: 'index', label: 'Dashboard' },
    { id: 'update-deployment', label: Lang.get('page.updateDeployment') },
    { id: 'asset', label: Lang.get('page.asset') },
    { id: 'client-pc', label: Lang.get('page.clientPc') },
    { id: 'server', label: Lang.get('page.server') },
    { id: 'app-deployment', label: Lang.get('page.appDeployment') },
    { id: 'app-inventory', label: Lang.get('page.appInventory') },
    { id: 'bitlocker', label: Lang.get('page.bitlocker') },
    { id: 'cmg', label: Lang.get('page.cmg') },
    { id: 'db-monitor', label: Lang.get('page.dbMonitor') },
    { id: 'reports', label: Lang.get('page.reports') },
    { id: 'device-detail', label: 'Device Detail' },
    { id: 'system-health', label: Lang.get('page.systemHealth') },
    { id: 'trend', label: Lang.get('page.trend') },
    { id: 'admin', label: Lang.get('page.admin') }
  ];

  // Default roles
  var DEFAULT_ROLES = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Tam erisim — tum sayfalar ve yonetim paneli',
      pages: ALL_PAGES.map(function (p) { return p.id; }),
      isSystem: true
    },
    {
      id: 'helpdesk',
      name: 'Helpdesk',
      description: 'Cihaz ve envanter sayfalarini goruntuleyebilir',
      pages: ['index', 'asset', 'client-pc', 'server', 'device-detail', 'app-inventory'],
      isSystem: false
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Dashboard ve raporlara erisim',
      pages: ['index', 'reports', 'asset', 'trend'],
      isSystem: false
    },
    {
      id: 'readonly',
      name: 'Read Only',
      description: 'Sadece dashboard gorunumu',
      pages: ['index'],
      isSystem: false
    }
  ];

  async function init() {
    await Dashboard.init('admin', Lang.get('page.admin'));

    // Ensure default roles exist
    if (!getRoles().length) saveRoles(DEFAULT_ROLES);

    renderRbacStatus();
    renderCurrentUserSelect();
    renderMetrics();
    renderRolesTable();
    renderAccessMatrix();
    renderUsersTable();
    renderAuditTable();
    bindTabs();
    bindActions();

    // Log page visit
    addAuditLog(Lang.get('page.admin') + ' acildi', 'admin');
  }

  // ─── Storage ───
  function getRoles() {
    try { return JSON.parse(localStorage.getItem(ROLES_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveRoles(roles) { localStorage.setItem(ROLES_KEY, JSON.stringify(roles)); }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function getAuditLogs() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveAuditLogs(logs) {
    // Keep last 500 entries
    if (logs.length > 500) logs = logs.slice(-500);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
  }

  function addAuditLog(action, page, detail) {
    var logs = getAuditLogs();
    logs.push({
      timestamp: new Date().toISOString(),
      user: getCurrentUser(),
      page: page || '-',
      action: action,
      detail: detail || ''
    });
    saveAuditLogs(logs);
  }

  function getCurrentUser() {
    var u = Dashboard.getCurrentUser();
    return (u && u.name) || 'Sistem';
  }

  // ─── Aktif Kullanici (RBAC kimligi) ───
  function renderRbacStatus() {
    var area = document.getElementById('alertArea');
    if (!area) return;
    var state = Dashboard.getRbacState();
    if (state === 'no-identity') {
      area.innerHTML = '<div class="alert-banner warning">&#9432; ' +
        Dashboard.escapeHtml(Lang.get('rbac.inactive')) + '</div>';
    } else {
      area.innerHTML = '';
    }
  }

  function renderCurrentUserSelect() {
    var sel = document.getElementById('currentUserSelect');
    if (!sel) return;

    var users = getUsers();
    var roles = getRoles();
    var current = Dashboard.getCurrentUser();

    var html = '<option value="">— ' + Dashboard.escapeHtml(Lang.get('rbac.notSelected')) + ' —</option>';
    users.forEach(function (u) {
      var role = roles.find(function (r) { return r.id === u.roleId; });
      var label = u.name + (role ? ' (' + role.name + ')' : '');
      html += '<option value="' + Dashboard.escapeHtml(u.id) + '"' +
              (current && current.id === u.id ? ' selected' : '') + '>' +
              Dashboard.escapeHtml(label) + '</option>';
    });
    sel.innerHTML = html;

    sel.onchange = function () {
      Dashboard.setCurrentUser(sel.value || null);
      var u = Dashboard.getCurrentUser();
      addAuditLog('Aktif kullanici degistirildi: ' + (u ? u.name : 'yok'), 'admin');
      renderRbacStatus();
      renderAuditTable();
      var userEl = document.getElementById('user-name');
      if (userEl) userEl.textContent = u ? u.name : '';
    };
  }

  // ─── Metrics ───
  function renderMetrics() {
    var c = document.getElementById('metrics');
    c.innerHTML = '';
    var roles = getRoles();
    var users = getUsers();
    var logs = getAuditLogs();

    c.appendChild(Dashboard.createMetricCard('Roller', roles.length, {
      icon: '&#9733;', color: 'purple', sub: roles.filter(function (r) { return r.isSystem; }).length + ' sistem rolu'
    }));
    c.appendChild(Dashboard.createMetricCard(Lang.get('asset.users'), users.length, {
      icon: '&#9786;', color: 'blue', sub: 'kullanici/grup atamasi'
    }));
    c.appendChild(Dashboard.createMetricCard('Audit Log', logs.length, {
      icon: '&#9776;', color: 'green', sub: 'kayitli islem'
    }));
    c.appendChild(Dashboard.createMetricCard('Sayfa', ALL_PAGES.length, {
      icon: '&#9632;', color: 'blue', sub: 'erisim kontrollü sayfa'
    }));
  }

  // ─── Roles Table ───
  function renderRolesTable() {
    var roles = getRoles();
    var users = getUsers();

    var rows = roles.map(function (r) {
      var userCount = users.filter(function (u) { return u.roleId === r.id; }).length;
      var pageCount = r.pages.length + ' / ' + ALL_PAGES.length;

      return [
        '<strong>' + Dashboard.escapeHtml(r.name) + '</strong>' +
          (r.isSystem ? ' ' + Dashboard.statusBadge('Sistem', 'info') : ''),
        Dashboard.escapeHtml(r.description),
        pageCount,
        Dashboard.formatNumber(userCount),
        r.isSystem ? '<span class="text-muted">-</span>' :
          '<button class="btn btn-secondary btn-sm" data-edit-role="' + r.id + '">Duzenle</button> ' +
          '<button class="btn btn-danger btn-sm" data-delete-role="' + r.id + '">Sil</button>'
      ];
    });

    if ($.fn.DataTable.isDataTable('#rolesTable')) {
      $('#rolesTable').DataTable().destroy();
    }

    $('#rolesTable').DataTable({
      data: rows, paging: false, searching: false, info: false,
      language: Lang.dtLang()
    });

    // Bind edit/delete
    $('#rolesTable').off('click').on('click', '[data-edit-role]', function () {
      editRole($(this).attr('data-edit-role'));
    }).on('click', '[data-delete-role]', function () {
      deleteRole($(this).attr('data-delete-role'));
    });
  }

  // ─── Access Matrix ───
  function renderAccessMatrix() {
    var roles = getRoles();
    var c = document.getElementById('accessMatrix');

    var html = '<table class="panel-table" style="width:100%"><thead><tr><th>Sayfa</th>';
    roles.forEach(function (r) {
      html += '<th style="text-align:center">' + Dashboard.escapeHtml(r.name) + '</th>';
    });
    html += '</tr></thead><tbody>';

    ALL_PAGES.forEach(function (page) {
      html += '<tr><td>' + Dashboard.escapeHtml(page.label) + '</td>';
      roles.forEach(function (r) {
        var hasAccess = r.pages.indexOf(page.id) !== -1;
        html += '<td style="text-align:center">' +
          (hasAccess ? '<span style="color:var(--color-success);font-size:1.2em">&#10003;</span>'
                     : '<span style="color:var(--color-danger);font-size:1.2em">&#10007;</span>') +
          '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    c.innerHTML = html;
  }

  // ─── Users Table ───
  function renderUsersTable() {
    var users = getUsers();
    var roles = getRoles();

    var rows = users.map(function (u) {
      var role = roles.find(function (r) { return r.id === u.roleId; });
      return [
        Dashboard.escapeHtml(u.name),
        Dashboard.statusBadge(u.type === 'group' ? 'Grup' : Lang.get('asset.user'), u.type === 'group' ? 'info' : 'secondary'),
        role ? Dashboard.escapeHtml(role.name) : Dashboard.statusBadge('Atanmamis', 'warning'),
        Dashboard.formatDate(u.assignedAt),
        '<button class="btn btn-secondary btn-sm" data-edit-user="' + u.id + '">Duzenle</button> ' +
        '<button class="btn btn-danger btn-sm" data-delete-user="' + u.id + '">Sil</button>'
      ];
    });

    if ($.fn.DataTable.isDataTable('#usersTable')) {
      $('#usersTable').DataTable().destroy();
    }

    $('#usersTable').DataTable({
      data: rows, paging: true, pageLength: 20,
      language: Lang.dtLang()
    });

    $('#usersTable').off('click').on('click', '[data-edit-user]', function () {
      editUser($(this).attr('data-edit-user'));
    }).on('click', '[data-delete-user]', function () {
      deleteUser($(this).attr('data-delete-user'));
    });
  }

  // ─── Audit Table ───
  function renderAuditTable() {
    var logs = getAuditLogs().reverse(); // newest first

    var rows = logs.map(function (l) {
      return [
        Dashboard.formatDate(l.timestamp),
        Dashboard.escapeHtml(l.user),
        Dashboard.escapeHtml(l.page),
        Dashboard.escapeHtml(l.action),
        Dashboard.escapeHtml(l.detail)
      ];
    });

    if ($.fn.DataTable.isDataTable('#auditTable')) {
      $('#auditTable').DataTable().destroy();
    }

    var dt = $('#auditTable').DataTable({
      data: rows, order: [[0, 'desc']], pageLength: 25,
      language: Lang.dtLang()
    });

    // onclick: renderAuditTable birden fazla kez cagrildiginda listener birikmesin
    document.getElementById('btnExportAudit').onclick = function () {
      CSVExport.exportDataTable(dt, 'erisim_logu.csv');
    };
  }

  // ─── CRUD Actions ───
  function bindActions() {
    document.getElementById('btnAddRole').addEventListener('click', addRole);
    document.getElementById('btnAddUser').addEventListener('click', addUser);
  }

  function addRole() {
    var name = prompt('Rol adi:');
    if (!name) return;
    var desc = prompt('Rol aciklamasi:') || '';

    // Page selection
    var pageIds = prompt(
      'Erisim verilecek sayfalar (virgul ile ayirin):\n\n' +
      ALL_PAGES.map(function (p) { return p.id; }).join(', ')
    );
    if (!pageIds) return;

    var pages = pageIds.split(',').map(function (s) { return s.trim(); }).filter(function (s) {
      return ALL_PAGES.some(function (p) { return p.id === s; });
    });

    var roles = getRoles();
    roles.push({
      id: 'role_' + Date.now(),
      name: name,
      description: desc,
      pages: pages,
      isSystem: false
    });
    saveRoles(roles);
    addAuditLog('Yeni rol olusturuldu: ' + name, 'admin');

    renderRolesTable();
    renderAccessMatrix();
    renderMetrics();
  }

  function editRole(roleId) {
    var roles = getRoles();
    var role = roles.find(function (r) { return r.id === roleId; });
    if (!role) return;

    var name = prompt('Rol adi:', role.name);
    if (!name) return;
    role.name = name;
    role.description = prompt('Aciklama:', role.description) || role.description;

    var pageIds = prompt(
      'Erisim sayfalari (virgul ile):\n\nMevcut: ' + role.pages.join(', ') + '\n\nTum sayfalar: ' +
      ALL_PAGES.map(function (p) { return p.id; }).join(', '),
      role.pages.join(', ')
    );
    if (pageIds) {
      role.pages = pageIds.split(',').map(function (s) { return s.trim(); }).filter(function (s) {
        return ALL_PAGES.some(function (p) { return p.id === s; });
      });
    }

    saveRoles(roles);
    addAuditLog('Rol duzenlendi: ' + name, 'admin');
    renderRolesTable();
    renderAccessMatrix();
  }

  function deleteRole(roleId) {
    if (!confirm('Bu rol silinecek. Emin misiniz?')) return;
    var roles = getRoles().filter(function (r) { return r.id !== roleId; });
    saveRoles(roles);
    addAuditLog('Rol silindi: ' + roleId, 'admin');
    renderRolesTable();
    renderAccessMatrix();
    renderMetrics();
  }

  function addUser() {
    var name = prompt('Kullanici adi veya AD grubu (ornek: DOMAIN\\kullanici):');
    if (!name) return;

    var type = prompt('Tip (1 = Kullanici, 2 = Grup):', '1');
    var typeVal = type === '2' ? 'group' : 'user';

    var roles = getRoles();
    var roleOptions = roles.map(function (r, i) { return (i + 1) + ' = ' + r.name; }).join('\n');
    var roleIdx = prompt('Rol secin:\n' + roleOptions);
    if (!roleIdx) return;

    var selectedRole = roles[parseInt(roleIdx, 10) - 1];
    if (!selectedRole) {
      alert('Gecersiz secim.');
      return;
    }

    var users = getUsers();
    users.push({
      id: 'usr_' + Date.now(),
      name: name,
      type: typeVal,
      roleId: selectedRole.id,
      assignedAt: new Date().toISOString()
    });
    saveUsers(users);
    addAuditLog('Kullanici atandi: ' + name + ' -> ' + selectedRole.name, 'admin');

    renderUsersTable();
    renderCurrentUserSelect();
    renderRbacStatus();
    renderMetrics();
  }

  function editUser(userId) {
    var users = getUsers();
    var user = users.find(function (u) { return u.id === userId; });
    if (!user) return;

    var roles = getRoles();
    var roleOptions = roles.map(function (r, i) { return (i + 1) + ' = ' + r.name; }).join('\n');
    var currentRole = roles.find(function (r) { return r.id === user.roleId; });

    var roleIdx = prompt(
      'Yeni rol secin (mevcut: ' + (currentRole ? currentRole.name : '-') + '):\n' + roleOptions
    );
    if (!roleIdx) return;

    var selectedRole = roles[parseInt(roleIdx, 10) - 1];
    if (!selectedRole) {
      alert('Gecersiz secim.');
      return;
    }

    user.roleId = selectedRole.id;
    user.assignedAt = new Date().toISOString();
    saveUsers(users);
    addAuditLog('Kullanici rolu degistirildi: ' + user.name + ' -> ' + selectedRole.name, 'admin');

    renderUsersTable();
    renderCurrentUserSelect();
  }

  function deleteUser(userId) {
    if (!confirm('Bu kullanici atamasi silinecek. Emin misiniz?')) return;
    var users = getUsers();
    var user = users.find(function (u) { return u.id === userId; });
    var filtered = users.filter(function (u) { return u.id !== userId; });
    saveUsers(filtered);
    if (user) addAuditLog('Kullanici silindi: ' + user.name, 'admin');

    // Silinen kullanici bu tarayicinin aktif kimligiyse secimi temizle
    var cu = Dashboard.getCurrentUser();
    if (cu && cu.id === userId) Dashboard.setCurrentUser(null);

    renderUsersTable();
    renderCurrentUserSelect();
    renderRbacStatus();
    renderMetrics();
  }

  // ─── Tabs ───
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
