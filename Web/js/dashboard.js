/**
 * SCCM Dashboard — Core Functions
 */
const Dashboard = (function () {
  'use strict';

  let _thresholds = null;
  let _cacheMeta = null;
  let _config = null;

  // Cache servisinin uretttigi public config icin varsayilanlar
  const DEFAULT_CONFIG = {
    refreshApiPort: 0,            // 0 = bilinmiyor, port taramasina dus
    refreshIntervalMinutes: 60,
    staleThresholdMinutes: 90,
    autoRefreshSeconds: 120       // 0 = otomatik yenileme kapali
  };

  // ── Data Fetching ──
  async function fetchData(endpoint) {
    try {
      const resp = await fetch('/data/' + endpoint + '.json?_=' + Date.now());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } catch (err) {
      console.error('fetchData(' + endpoint + ') failed:', err);
      return null;
    }
  }

  // ── Public Config (_config_public.json — cache servisi yazar) ──
  async function getConfig() {
    if (_config) return _config;
    var loaded = await fetchData('_config_public');
    _config = {};
    Object.keys(DEFAULT_CONFIG).forEach(function (k) {
      _config[k] = (loaded && loaded[k] != null) ? loaded[k] : DEFAULT_CONFIG[k];
    });
    return _config;
  }

  async function getThresholds() {
    if (_thresholds) return _thresholds;
    try {
      const resp = await fetch('/data/_thresholds.json?_=' + Date.now());
      if (resp.ok) { _thresholds = await resp.json(); return _thresholds; }
    } catch (e) { /* ignore */ }
    // Fallback — _thresholds.json okunamazsa. Config/thresholds.json ile ayni
    // yapida tutun; oradaki her alanin burada da karsiligi olmali.
    _thresholds = {
      updateDeployment: { compliancePercent: { warning: 80, critical: 60 }, failedCount: { warning: 3, critical: 10 } },
      asset: { staleDeviceDays: 30, clientHealthPercent: { warning: 85, critical: 70 } },
      clientPC: { pendingRestartPercent: { warning: 20, critical: 40 }, clientVersionMismatchPercent: { warning: 15, critical: 30 } },
      server: { pendingUpdateCount: { warning: 5, critical: 15 }, uptimeDays: { warning: 90, critical: 180 } },
      appDeployment: { successRatePercent: { warning: 85, critical: 70 }, failedCount: { warning: 5, critical: 15 } },
      bitlocker: { encryptionPercent: { warning: 90, critical: 75 } },
      cmg: { onlineClientsPercent: { warning: 80, critical: 50 } },
      dbMonitor: { dbSizeGB: { warning: 50, critical: 80 }, componentErrors: { warning: 1, critical: 5 }, backupAgeDays: { warning: 1, critical: 3 } }
    };
    return _thresholds;
  }

  async function getCacheMeta(force) {
    if (_cacheMeta && !force) return _cacheMeta;
    _cacheMeta = await fetchData('_cache_meta');
    return _cacheMeta;
  }

  // ── Threshold Config Erisimi ──
  // Config/thresholds.json her refresh'te _thresholds.json olarak yayinlanir.
  // Sayfalar esik degerlerini kodda gommek yerine buradan okumalidir, aksi
  // halde thresholds.json'u degistirmek hicbir sey yapmaz.
  //
  //   Dashboard.threshold('bitlocker', 'encryptionPercent')  -> {warning:90, critical:75}
  //   Dashboard.threshold('asset', 'staleDeviceDays', 30)    -> 30 (skaler)
  function threshold(domain, key, fallback) {
    try {
      var t = _thresholds && _thresholds[domain];
      if (t && t[key] !== undefined && t[key] !== null) return t[key];
    } catch (e) { /* yoksay */ }
    return fallback;
  }

  // Esik nesnesini dogrudan renge cevirir; sayfalarda en sik kullanilan bicim.
  //   Dashboard.thresholdColor('bitlocker','encryptionPercent', pct, {warning:90,critical:75})
  function thresholdColor(domain, key, value, fallback, lowerIsBetter) {
    var t = threshold(domain, key, fallback) || {};
    return getThresholdColor(
      value,
      t.warning !== undefined ? t.warning : (fallback || {}).warning,
      t.critical !== undefined ? t.critical : (fallback || {}).critical,
      lowerIsBetter
    );
  }

  // ── Threshold Color Logic ──
  function getThresholdColor(value, warningThreshold, criticalThreshold, lowerIsBetter) {
    if (lowerIsBetter) {
      if (value >= criticalThreshold) return 'red';
      if (value >= warningThreshold) return 'yellow';
      return 'green';
    } else {
      if (value <= criticalThreshold) return 'red';
      if (value <= warningThreshold) return 'yellow';
      return 'green';
    }
  }

  function getStatusClass(color) {
    if (color === 'red') return 'status-critical';
    if (color === 'yellow') return 'status-warning';
    return 'status-ok';
  }

  // ── Metric Card Creation ──
  function createMetricCard(title, value, opts) {
    opts = opts || {};
    var icon = opts.icon || '&#9632;';
    var color = opts.color || 'blue';
    var sub = opts.sub || '';
    var statusClass = opts.statusClass || '';
    var clickFn = opts.onClick || null;

    var card = document.createElement('div');
    card.className = 'metric-card' + (statusClass ? ' ' + statusClass : '') + (clickFn ? ' clickable' : '');

    // icon sabit HTML entity'dir (kod icinden gelir), value/sub veri kaynaklidir -> escape edilir
    card.innerHTML =
      '<div class="metric-icon ' + escapeHtml(color) + '">' + icon + '</div>' +
      '<div class="metric-body">' +
        '<div class="metric-title">' + escapeHtml(title) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
        (sub ? '<div class="metric-sub">' + escapeHtml(sub) + '</div>' : '') +
      '</div>';

    if (clickFn) card.addEventListener('click', clickFn);
    return card;
  }

  // ── Formatting Helpers ──
  function formatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('tr-TR');
  }

  function formatPercent(n, digits) {
    if (n == null || isNaN(n)) return '0%';
    return Number(n).toFixed(digits !== undefined ? digits : 1) + '%';
  }

  function formatDate(d) {
    if (!d) return '-';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var yy = dt.getFullYear();
    var hh = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return dd + '.' + mm + '.' + yy + ' ' + hh + ':' + mi;
  }

  function timeAgo(d) {
    if (!d) return '-';
    var dt = new Date(d);
    var now = new Date();
    var diff = Math.floor((now - dt) / 1000);
    if (diff < 60) return diff + ' ' + Lang.get('time.secAgo');
    if (diff < 3600) return Math.floor(diff / 60) + ' ' + Lang.get('time.minAgo');
    if (diff < 86400) return Math.floor(diff / 3600) + ' ' + Lang.get('time.hourAgo');
    return Math.floor(diff / 86400) + ' ' + Lang.get('time.dayAgo');
  }

  function escapeHtml(str) {
    // Dikkat: 0 ve false gecerli degerlerdir — yalnizca null/undefined bos doner.
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Veri Durumu ──
  // "Getirilemedi", "sorgu hata verdi" ve "sorgu calisti ama sonuc bos" farkli
  // seylerdir. Sayfalar eskiden yalnizca null'i yakaliyordu; bos dizi gecerli
  // sayilip "0 / 0", "%0" ve bos doughnut'lar ciziliyordu — bu, olculmus bir
  // sifir gibi gorunuyor ama degil.
  async function dataState(endpoint, data) {
    if (data === null || data === undefined) {
      return { ok: false, kind: 'fetch-error' };
    }
    if (Array.isArray(data) && data.length === 0) {
      var meta = await getCacheMeta();
      var q = null;
      if (meta && meta.queries) {
        q = meta.queries.filter(function (x) { return x.name === endpoint; })[0] || null;
      }
      if (q && q.status === 'ERROR') {
        return { ok: false, kind: 'query-error', error: q.error };
      }
      return { ok: false, kind: 'empty', lastRefresh: meta && meta.lastRefresh };
    }
    return { ok: true };
  }

  function emptyStateHtml(state, opts) {
    opts = opts || {};
    var icon, title, hint;

    if (state.kind === 'fetch-error') {
      icon = '&#9888;';
      title = Lang.get('empty.fetchError');
      hint = Lang.get('empty.fetchErrorHint');
    } else if (state.kind === 'query-error') {
      icon = '&#9888;';
      title = Lang.get('empty.queryError');
      hint = Lang.get('empty.queryErrorHint') + (state.error ? ' — ' + escapeHtml(String(state.error).slice(0, 300)) : '');
    } else {
      icon = '&#9673;';
      title = opts.title || Lang.get('empty.noData');
      hint = opts.hint || Lang.get('empty.noDataHint');
    }

    return '<div class="empty-state">' +
      '<div class="empty-icon">' + icon + '</div>' +
      '<div class="empty-title">' + escapeHtml(title) + '</div>' +
      '<div class="empty-hint">' + hint + '</div>' +
      '</div>';
  }

  // Sayfa govdesini bos durumla degistirir. Veri yoksa true doner ki
  // sayfa kodu "if (await Dashboard.bailIfEmpty(...)) return;" diyebilsin.
  async function bailIfEmpty(endpoint, data, opts) {
    var state = await dataState(endpoint, data);
    if (state.ok) return false;

    var host = document.querySelector('.main-content');
    if (host) {
      host.innerHTML = '<div class="table-card">' + emptyStateHtml(state, opts) + '</div>';
    }
    return true;
  }

  // ── Component Loading ──
  async function loadComponent(selector, url) {
    try {
      var el = document.querySelector(selector);
      if (!el) return;
      var resp = await fetch(url + '?_=' + Date.now());
      if (resp.ok) {
        el.innerHTML = await resp.text();
      }
    } catch (e) {
      console.error('loadComponent failed:', e);
    }
  }

  // ── Theme ──
  function initTheme() {
    var saved = localStorage.getItem('sccm-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sccm-theme', next);
    updateThemeIcon(next);
    // CSS degiskenleri yeni degerlerini alsin diye bir frame bekle
    requestAnimationFrame(retintCharts);
  }

  function updateThemeIcon(theme) {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
  }

  // ── Cache Status ──
  async function updateCacheStatus(force) {
    var meta = await getCacheMeta(force);
    var cfg = await getConfig();
    var timeEl = document.getElementById('cache-time');
    var dotEl = document.querySelector('#cache-status .dot');
    var statusEl = document.getElementById('cache-status');

    if (!meta || !meta.lastRefresh) {
      if (timeEl) timeEl.textContent = Lang.get('common.cacheNotFound');
      if (dotEl) dotEl.className = 'dot error';
      return;
    }

    if (timeEl) timeEl.textContent = timeAgo(meta.lastRefresh);

    var ageMs = Date.now() - new Date(meta.lastRefresh).getTime();
    var isStale = ageMs > cfg.staleThresholdMinutes * 60 * 1000;
    var failed = (meta.queries || []).filter(function (q) { return q.status === 'ERROR'; });

    if (dotEl) {
      if (meta.status === 'error') dotEl.className = 'dot error';
      else if (isStale) dotEl.className = 'dot stale';
      else if (failed.length) dotEl.className = 'dot stale';
      else dotEl.className = 'dot';
    }

    if (statusEl) {
      if (meta.status === 'error') {
        statusEl.title = Lang.get('cache.serviceError');
      } else if (failed.length) {
        statusEl.title = failed.length + ' ' + Lang.get('cache.failedQueries') + ': ' +
          failed.map(function (q) { return q.name; }).join(', ');
      } else if (isStale) {
        statusEl.title = Lang.get('cache.stale');
      } else {
        statusEl.title = Lang.get('cache.fresh');
      }
    }
  }

  // ── Otomatik Yenileme ──
  // _cache_meta.json periyodik kontrol edilir. Yeni veri geldiginde:
  //   - sayfa kendi reload fonksiyonunu tanimladiysa (window._pageReload) onu cagirir
  //   - aksi halde basliktaki "yeni veri" rozetini gosterir (kullanicinin filtresi bozulmaz)
  var _autoRefreshTimer = null;
  var _lastSeenRefresh = null;

  async function startAutoRefresh() {
    var cfg = await getConfig();
    if (!cfg.autoRefreshSeconds || cfg.autoRefreshSeconds <= 0) return;

    var meta = await getCacheMeta();
    _lastSeenRefresh = meta && meta.lastRefresh;

    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = setInterval(function () {
      checkForNewData();
    }, cfg.autoRefreshSeconds * 1000);

    // Sekme tekrar one geldiginde hemen kontrol et
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkForNewData();
    });
  }

  async function checkForNewData() {
    var fresh = await fetchData('_cache_meta');
    if (!fresh || !fresh.lastRefresh) return;

    if (_lastSeenRefresh && fresh.lastRefresh !== _lastSeenRefresh) {
      _lastSeenRefresh = fresh.lastRefresh;
      _cacheMeta = fresh;
      await updateCacheStatus();
      if (typeof window._pageReload === 'function') {
        window._pageReload();
      } else {
        showNewDataBadge();
      }
    } else {
      _cacheMeta = fresh;
      _lastSeenRefresh = fresh.lastRefresh;
      await updateCacheStatus();   // "x dk once" metnini tazele
    }
  }

  function showNewDataBadge() {
    if (document.getElementById('new-data-badge')) return;
    var host = document.querySelector('.header-right');
    if (!host) return;

    var badge = document.createElement('button');
    badge.id = 'new-data-badge';
    badge.className = 'btn-refresh new-data';
    badge.textContent = '↻ ' + Lang.get('cache.newData');
    badge.title = Lang.get('cache.newDataHint');
    badge.addEventListener('click', function () { location.reload(); });
    host.insertBefore(badge, host.firstChild);
  }

  // ── Site Code (dynamic from DB info) ──
  async function updateSiteCode() {
    var label = document.getElementById('site-code-label');
    if (!label) return;
    var dbInfo = await fetchData('db_monitor_dbinfo');
    if (dbInfo && dbInfo.length > 0 && dbInfo[0].DatabaseName) {
      label.textContent = dbInfo[0].DatabaseName + ' Monitoring';
    }
  }

  // ── Manual Refresh ──
  var _refreshApiPort = 0;
  var _refreshApiDetected = false;

  async function detectRefreshApiPort() {
    // Arka planda calis, sayfa yuklemesini bloklamasin
    if (_refreshApiDetected) return;
    _refreshApiDetected = true;

    var cfg = await getConfig();
    // Once config'teki port denenir; bulunamazsa eski davranis (tarama) devreye girer
    var ports = [];
    if (cfg.refreshApiPort) ports.push(cfg.refreshApiPort);
    [9091, 9092, 9093, 9094, 9095].forEach(function (p) {
      if (ports.indexOf(p) === -1) ports.push(p);
    });

    var idx = 0;
    function tryNext() {
      if (idx >= ports.length) { updateRefreshBtnState(false); return; }
      var p = ports[idx++];
      fetch('http://' + location.hostname + ':' + p + '/api/health', { mode: 'cors', signal: AbortSignal.timeout(1000) })
        .then(function (r) { if (r.ok) { _refreshApiPort = p; updateRefreshBtnState(true); } else { tryNext(); } })
        .catch(function () { tryNext(); });
    }
    tryNext();
  }

  function updateRefreshBtnState(available) {
    var btn = document.getElementById('btn-manual-refresh');
    if (!btn) return;
    if (!available) { btn.style.opacity = '0.4'; btn.title = 'Refresh API erisilemedi'; }
  }

  async function triggerManualRefresh() {
    var btn = document.getElementById('btn-manual-refresh');
    var icon = document.getElementById('refresh-icon');
    if (!btn) return;

    if (!_refreshApiPort) {
      btn.classList.add('error');
      btn.title = 'Refresh API erisilemedi';
      setTimeout(function () { btn.classList.remove('error'); }, 2000);
      return;
    }

    btn.disabled = true;
    btn.classList.add('spinning');

    try {
      var apiUrl = 'http://' + location.hostname + ':' + _refreshApiPort + '/api/refresh';
      // X-Dashboard-Refresh: API'nin CSRF korumasi bu header'i sart kosar (preflight tetikler)
      var resp = await fetch(apiUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'X-Dashboard-Refresh': '1' }
      });
      var data = await resp.json();

      if (data.status === 'started' || data.status === 'running') {
        btn.classList.add('success');
        // Poll for completion
        setTimeout(function () { pollRefreshStatus(btn); }, 5000);
      } else {
        btn.classList.add('error');
        setTimeout(function () { resetRefreshBtn(btn); }, 3000);
      }
    } catch (err) {
      console.error('Manual refresh failed:', err);
      btn.classList.add('error');
      btn.title = 'Refresh API erisilemedi (port ' + _refreshApiPort + ')';
      setTimeout(function () { resetRefreshBtn(btn); }, 3000);
    }
  }

  function pollRefreshStatus(btn) {
    // Reload cache meta and check if it changed
    _cacheMeta = null;
    updateCacheStatus(true);
    resetRefreshBtn(btn);
    // Reload current page data
    if (typeof window._pageReload === 'function') window._pageReload();
    else showNewDataBadge();
  }

  function resetRefreshBtn(btn) {
    btn.disabled = false;
    btn.classList.remove('spinning', 'success', 'error');
  }

  // ── RBAC ──
  // ONEMLI: Bu kontrol tamamen istemci taraflidir (localStorage). Gercek bir guvenlik
  // siniri DEGILDIR — arayuzu kullanicinin rolune gore sadelestirmek icindir.
  // Sunucu tarafi yetkilendirme icin IIS Windows Authentication + klasor ACL kullanin.
  var CURRENT_USER_KEY = 'sccm_current_user';

  function _readStore(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (e) { return []; }
  }

  function getCurrentUser() {
    var id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return null;
    var users = _readStore('sccm_rbac_users');
    return users.find(function (u) { return u.id === id; }) || null;
  }

  function setCurrentUser(userId) {
    if (userId) localStorage.setItem(CURRENT_USER_KEY, userId);
    else localStorage.removeItem(CURRENT_USER_KEY);
  }

  function getCurrentRole() {
    var user = getCurrentUser();
    if (!user) return null;
    var roles = _readStore('sccm_rbac_roles');
    return roles.find(function (r) { return r.id === user.roleId; }) || null;
  }

  // 'enforced' | 'no-identity' | 'not-configured'
  function getRbacState() {
    var roles = _readStore('sccm_rbac_roles');
    var users = _readStore('sccm_rbac_users');
    if (roles.length === 0 || users.length === 0) return 'not-configured';
    if (!getCurrentUser()) return 'no-identity';
    return 'enforced';
  }

  function checkPageAccess(pageId) {
    try {
      var state = getRbacState();
      // RBAC kurulmamis ya da bu tarayicida kimlik secilmemis -> eski davranis (erisim serbest)
      if (state !== 'enforced') return true;

      // Admin sayfasi her zaman acik kalir: yanlis rol atamasinda kilitlenmeyi onler
      if (pageId === 'admin') return true;

      var role = getCurrentRole();
      if (!role || !role.pages) return false;
      return role.pages.indexOf(pageId) !== -1;
    } catch (e) { return true; }
  }

  // Sidebar'da erisilemeyen sayfalari gizle
  function applyNavPermissions() {
    if (getRbacState() !== 'enforced') return;
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(function (a) {
      if (!checkPageAccess(a.getAttribute('data-page'))) a.style.display = 'none';
    });
  }

  // ── DOM Translation (data-i18n attributes) ──
  function translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = Lang.get(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', Lang.get(key));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', Lang.get(key));
    });
  }

  // ── Page Init ──
  async function init(pageId, pageTitle) {
    initTheme();

    // Esikler sayfa kodundan once hazir olmali: Dashboard.threshold() senkron.
    await getThresholds();

    await loadComponent('.sidebar', '/shared/sidebar.html');
    await loadComponent('.header', '/shared/header.html');

    // translate all data-i18n elements (sidebar, header, page)
    translateDOM();

    // set page title
    var titleEl = document.getElementById('page-title');
    if (titleEl && pageTitle) titleEl.textContent = pageTitle;

    // highlight active nav
    var links = document.querySelectorAll('.sidebar-nav a');
    links.forEach(function (a) {
      if (a.getAttribute('data-page') === pageId) a.classList.add('active');
    });

    // theme toggle
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // language toggle
    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = Lang.getLang().toUpperCase();
      langBtn.addEventListener('click', function () {
        var next = Lang.toggleLang();
        langBtn.textContent = next.toUpperCase();
        location.reload();
      });
    }

    // cache status
    await updateCacheStatus();

    // site code from DB
    await updateSiteCode();

    // manual refresh button (arka planda port tespit et, sayfa yuklemesini bekleme)
    var refreshBtn = document.getElementById('btn-manual-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', triggerManualRefresh);
    detectRefreshApiPort();

    // user name display (RBAC'te secili kimlik)
    var userEl = document.getElementById('user-name');
    if (userEl) {
      var cu = getCurrentUser();
      userEl.textContent = cu ? cu.name : '';
      if (cu) {
        var role = getCurrentRole();
        userEl.title = role ? role.name : '';
      }
    }

    // RBAC access check
    applyNavPermissions();
    if (!checkPageAccess(pageId)) {
      var main = document.querySelector('.main-content');
      if (main) {
        main.innerHTML = '<div class="alert-banner critical" style="margin-top:20px">' +
          '&#9888; ' + escapeHtml(Lang.get('common.accessDenied')) + '</div>';
      }
      return;   // erisim yoksa otomatik yenilemeyi de baslatma
    }

    // otomatik veri yenileme
    startAutoRefresh();
  }

  // ── Status Badge Helper ──
  function statusBadge(text, type) {
    return '<span class="badge badge-' + type + '">' + escapeHtml(text) + '</span>';
  }

  // ── Chart.js Tema & Palet ──
  // Renkler CSS custom property'lerinden okunur, boylece palet tek yerde
  // (style.css) tanimli kalir ve tema degisince ayni isimler yeni degeri verir.
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallback;
    } catch (e) { return fallback; }
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // Kategorik palet — SABIT SIRALI 8 slot, asla dongusel kullanilmaz.
  // 9. bir seri gerekiyorsa kuyruk 'Diger'e katlanmali (bkz. seriesColors).
  function chartColors() {
    var out = [];
    for (var i = 1; i <= 8; i++) out.push(cssVar('--series-' + i, '#2a78d6'));
    return out;
  }

  // Durum renkleri — anlam tasidiginda (iyi/uyari/ciddi/kritik) kullanilir,
  // kategorik seri rengi olarak ASLA kullanilmaz.
  function statusColors() {
    return {
      good:     cssVar('--status-good', '#0ca30c'),
      warning:  cssVar('--status-warning', '#fab219'),
      serious:  cssVar('--status-serious', '#ec835a'),
      critical: cssVar('--status-critical', '#d03b3b')
    };
  }

  // 'green' | 'yellow' | 'red' -> grafik dolgusu icin durum rengi
  function statusFill(color) {
    var s = statusColors();
    if (color === 'red') return s.critical;
    if (color === 'yellow') return s.serious;
    if (color === 'green') return s.good;
    return cssVar('--series-1', '#2a78d6');
  }

  function chartFontColor() { return cssVar('--chart-ink', isDark() ? '#c3c2b7' : '#52514e'); }
  function chartMutedColor() { return cssVar('--chart-ink-muted', '#898781'); }
  function chartGridColor() { return cssVar('--chart-grid', isDark() ? '#2c3450' : '#e1e0d9'); }
  function chartAxisColor() { return cssVar('--chart-axis', isDark() ? '#3d4867' : '#c3c2b7'); }
  function chartSurface() { return cssVar('--chart-surface', isDark() ? '#16213e' : '#ffffff'); }

  // ── Grafik Fabrikasi ──
  // Tum grafikler bundan gecer. Yaptiklari:
  //   1. Ayni canvas'taki onceki instance'i yok eder (yerinde yeniden cizim
  //      "Canvas is already in use" hatasi vermesin diye)
  //   2. Ortak tema varsayilanlarini uygular (hairline solid grid, recessive
  //      eksen, tr-TR sayi formatli tooltip)
  //   3. Instance'i kayitta tutar, boylece tema degisince yeniden renklendirilir
  var _charts = {};

  function chart(canvasId, config) {
    var el = document.getElementById(canvasId);
    if (!el) return null;

    if (_charts[canvasId]) {
      try { _charts[canvasId].destroy(); } catch (e) { /* zaten yok */ }
      delete _charts[canvasId];
    }
    if (!config) return null;   // sadece temizlemek icin config'siz cagrilabilir

    _charts[canvasId] = new Chart(el, applyChartTheme(config));
    return _charts[canvasId];
  }

  function destroyChart(canvasId) { chart(canvasId, null); }

  function getChart(canvasId) { return _charts[canvasId] || null; }

  // Ortak gorunum: ince markalar, hairline solid grid, notr metin.
  //
  // force=true (yalnizca retintCharts kullanir): temadan turetilen renkler
  // MEVCUT degerin uzerine yazilir. Aksi halde "mevcut kazanir" birlestirmesi
  // yuzunden tema degistiginde eski temanin grid/eksen renkleri kalirdi.
  function applyChartTheme(config, force) {
    var ink = chartFontColor();
    var muted = chartMutedColor();
    var grid = chartGridColor();
    var axis = chartAxisColor();
    var surface = chartSurface();
    var type = config.type;

    // Temadan turetilen bir alani yaz: force ise her zaman, degilse yalnizca bos ise
    function themed(obj, key, value) {
      if (force || obj[key] === undefined) obj[key] = value;
    }

    config.options = config.options || {};
    var o = config.options;

    if (o.responsive === undefined) o.responsive = true;
    if (o.maintainAspectRatio === undefined) o.maintainAspectRatio = false;

    o.plugins = o.plugins || {};

    // Legend: iki ve uzeri seride her zaman var, tek seride gereksiz
    // (baslik zaten neyin cizildigini soyluyor).
    var seriesCount = (config.data && config.data.datasets) ? config.data.datasets.length : 0;
    var isPartToWhole = (type === 'doughnut' || type === 'pie');
    if (!o.plugins.legend) o.plugins.legend = {};
    if (o.plugins.legend.display === undefined) {
      o.plugins.legend.display = isPartToWhole ? true : seriesCount > 1;
    }
    o.plugins.legend.position = o.plugins.legend.position || 'bottom';
    o.plugins.legend.labels = Object.assign({
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      pointStyle: 'circle',
      padding: 14
    }, o.plugins.legend.labels || {});
    themed(o.plugins.legend.labels, 'color', ink);

    // Tooltip: sayilar tr-TR formatinda. Tooltip degeri "kapatmaz" —
    // her sayfada ayni veriyi veren bir tablo da var.
    o.plugins.tooltip = Object.assign({
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 10,
      cornerRadius: 6,
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
      callbacks: Object.assign({
        label: function (ctx) {
          var label = ctx.dataset.label || ctx.label || '';
          var val = (ctx.parsed && ctx.parsed.y !== undefined && ctx.parsed.y !== null)
            ? ctx.parsed.y
            : ctx.parsed;
          if (typeof val === 'number') val = formatNumber(val);
          return label ? label + ': ' + val : String(val);
        }
      }, (o.plugins.tooltip && o.plugins.tooltip.callbacks) || {})
    }, o.plugins.tooltip || {});
    themed(o.plugins.tooltip, 'backgroundColor',
      isDark() ? 'rgba(13,13,13,0.92)' : 'rgba(11,11,11,0.88)');

    // Hover: isabet alani markadan buyuk olsun
    if (!o.interaction) {
      o.interaction = (type === 'line')
        ? { mode: 'index', intersect: false }
        : { mode: 'nearest', intersect: true };
    }

    var datasets = (config.data && config.data.datasets) || [];

    // Seri rengi: _slot verilmisse palet slotundan turet. Boylece sayfa
    // yalnizca slot numarasi vererek dogru rengi (ve tema adimini) alir.
    datasets.forEach(function (ds) {
      if (!ds._slot) return;
      var col = cssVar('--series-' + ds._slot, null);
      if (!col) return;
      if (Array.isArray(ds.backgroundColor)) return;   // dilim dizisi ayri yonetilir
      if (type === 'line') {
        themed(ds, 'borderColor', col);
        themed(ds, 'backgroundColor', ds.fill ? withAlpha(col, 0.1) : col);
      } else {
        themed(ds, 'backgroundColor', col);
      }
    });

    if (isPartToWhole) {
      if (o.cutout === undefined && type === 'doughnut') o.cutout = '68%';
      // Dilimler arasi ayirici: cizgi degil, yuzey rengi bosluk
      datasets.forEach(function (ds) {
        if (ds.borderWidth === undefined) ds.borderWidth = 2;
        if (ds.hoverOffset === undefined) ds.hoverOffset = 4;
        themed(ds, 'borderColor', surface);
      });
    } else {
      // Kartezyen eksenler: hairline SOLID grid (asla kesikli), recessive eksen
      o.scales = o.scales || {};
      ['x', 'y'].forEach(function (k) {
        o.scales[k] = o.scales[k] || {};
        var sc = o.scales[k];
        sc.ticks = Object.assign({ font: { size: 11 } }, sc.ticks || {});
        themed(sc.ticks, 'color', muted);

        sc.grid = Object.assign({
          borderDash: [],          // kesikli grid anti-pattern
          drawTicks: false,
          display: k === 'y'       // dikey grid gereksiz gurultu
        }, sc.grid || {});
        themed(sc.grid, 'color', grid);
        themed(sc.grid, 'borderColor', axis);

        sc.border = sc.border || {};
        themed(sc.border, 'color', axis);
      });
      if (o.scales.y.beginAtZero === undefined) o.scales.y.beginAtZero = true;

      // Mark spesifikasyonlari
      datasets.forEach(function (ds) {
        if (type === 'bar') {
          if (ds.borderRadius === undefined) ds.borderRadius = 4;   // veri ucu yuvarlak
          if (ds.borderWidth === undefined) ds.borderWidth = 0;
          if (ds.maxBarThickness === undefined) ds.maxBarThickness = 24;
        } else if (type === 'line') {
          if (ds.borderWidth === undefined) ds.borderWidth = 2;
          if (ds.tension === undefined) ds.tension = 0.3;
          if (ds.pointRadius === undefined) ds.pointRadius = 3;
          if (ds.pointHoverRadius === undefined) ds.pointHoverRadius = 6;
          if (ds.pointBorderWidth === undefined) ds.pointBorderWidth = 2;  // yuzey halkasi
          themed(ds, 'pointBorderColor', surface);
        }
      });
    }

    return config;
  }

  // Tema degisince tum canli grafikleri yeniden renklendir.
  // Onceden renkler yalnizca kurulumda okunuyordu; dark'a gecince eksen ve
  // legend rengi sayfa yenilenene kadar eski temada kaliyordu.
  function retintCharts() {
    Object.keys(_charts).forEach(function (id) {
      var c = _charts[id];
      if (!c) return;
      try {
        // force=true: eksen, grid, legend, tooltip ve _slot'li seri renkleri
        // yeni temanin degerleriyle EZILIR (mevcut deger korunmaz).
        applyChartTheme({ type: c.config.type, data: c.data, options: c.options }, true);

        // Dilim dizisi olan datasetler (doughnut/pie) ayrica yenilenir
        (c.data.datasets || []).forEach(function (ds) {
          if (Array.isArray(ds._slots)) {
            ds.backgroundColor = ds._slots.map(function (s) {
              return typeof s === 'number' ? cssVar('--series-' + s, '#2a78d6') : s;
            });
          }
        });

        c.update('none');
      } catch (e) { console.error('retintCharts(' + id + ')', e); }
    });
  }

  // Alan dolgusu icin: seri hue'su ~%10 opaklikta bir yikama
  function withAlpha(hex, alpha) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return hex;
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // 8'den fazla kategori: kuyrugu 'Diger'e katla, asla yeni hue uretme.
  // items: [{label, value}] -> {labels, values, colors}
  function foldCategories(items, maxSlots) {
    maxSlots = maxSlots || 8;
    var sorted = items.slice().sort(function (a, b) { return b.value - a.value; });
    var palette = chartColors();
    if (sorted.length <= maxSlots) {
      return {
        labels: sorted.map(function (i) { return i.label; }),
        values: sorted.map(function (i) { return i.value; }),
        colors: sorted.map(function (_, i) { return palette[i]; })
      };
    }
    var head = sorted.slice(0, maxSlots - 1);
    var tail = sorted.slice(maxSlots - 1);
    var otherTotal = tail.reduce(function (s, i) { return s + i.value; }, 0);
    return {
      labels: head.map(function (i) { return i.label; }).concat([Lang.get('chart.other')]),
      values: head.map(function (i) { return i.value; }).concat([otherTotal]),
      colors: head.map(function (_, i) { return palette[i]; }).concat([chartMutedColor()]),
      foldedCount: tail.length
    };
  }

  // Public API
  return {
    fetchData: fetchData,
    getConfig: getConfig,
    getThresholds: getThresholds,
    getCacheMeta: getCacheMeta,
    updateCacheStatus: updateCacheStatus,
    checkPageAccess: checkPageAccess,
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    getCurrentRole: getCurrentRole,
    getRbacState: getRbacState,
    getThresholdColor: getThresholdColor,
    getStatusClass: getStatusClass,
    createMetricCard: createMetricCard,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    formatDate: formatDate,
    timeAgo: timeAgo,
    escapeHtml: escapeHtml,
    loadComponent: loadComponent,
    initTheme: initTheme,
    toggleTheme: toggleTheme,
    init: init,
    triggerManualRefresh: triggerManualRefresh,
    statusBadge: statusBadge,

    // Esikler (Config/thresholds.json)
    threshold: threshold,
    thresholdColor: thresholdColor,

    // Veri durumu / bos ekran
    dataState: dataState,
    bailIfEmpty: bailIfEmpty,
    emptyStateHtml: emptyStateHtml,

    // Grafik fabrikasi
    chart: chart,
    getChart: getChart,
    destroyChart: destroyChart,
    retintCharts: retintCharts,
    foldCategories: foldCategories,
    withAlpha: withAlpha,

    // Palet
    chartColors: chartColors,
    statusColors: statusColors,
    statusFill: statusFill,
    chartFontColor: chartFontColor,
    chartMutedColor: chartMutedColor,
    chartGridColor: chartGridColor,
    chartAxisColor: chartAxisColor,
    chartSurface: chartSurface
  };
})();
