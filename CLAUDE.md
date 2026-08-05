# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SCCM Dashboard is a monitoring tool for Microsoft System Center Configuration Manager (SCCM/MECM). It has two layers:

1. **CacheService** — PowerShell scripts that query the SCCM SQL database and write results as static JSON files
2. **Web** — A static HTML/JS frontend served by IIS that reads those JSON files

There is no build step, no npm, and no framework. The frontend uses vanilla JavaScript with vendored libraries (jQuery, DataTables, Chart.js in `Web/js/lib/`).

## Running the Cache Service

```powershell
# One-time cache refresh (runs all SQL queries, writes JSON to Web/data/)
powershell -ExecutionPolicy Bypass -File C:\SCCMDashboard\CacheService\Run-CacheRefresh.ps1

# Start the manual-refresh HTTP API (long-running, listens on port 9091)
powershell -ExecutionPolicy Bypass -File C:\SCCMDashboard\CacheService\Start-RefreshAPI.ps1
```

Both scripts accept `-ConfigPath` to override the default `C:\SCCMDashboard\Config\config.json`.

The refresh API exposes three endpoints: `POST /api/refresh`, `GET /api/status`, `GET /api/health`.

The API is CSRF-hardened:
- `Access-Control-Allow-Origin` echoes the caller's origin only when allowed — never `*`
- Allowed origins: entries in `config.allowedOrigins`, or (when that list is empty) any origin whose **host** resolves to this machine — `localhost`, `127.0.0.1`, `::1`, `COMPUTERNAME`, the FQDN, and every local interface IP. Local IPs matter because IIS bindings are often reached by address (`http://10.x.x.x:9090`); omitting them silently breaks the manual refresh button for those users.
- Only the host is compared — not the scheme or port — because the dashboard (9090) and the API (9091) are deliberately on different ports
- A disallowed `Origin` header gets 403 on every endpoint
- `POST /api/refresh` additionally requires the `X-Dashboard-Refresh` header, which forces a CORS preflight and blocks cross-site form POSTs

Requests with no `Origin` header (curl, scheduled tasks) are accepted.

## Architecture

### Data Flow

```
CacheService/queries/*.sql  →  Run-CacheRefresh.ps1  →  Web/data/*.json  →  Browser fetch()
```

Each `.sql` file in `CacheService/queries/` maps 1:1 to a JSON file in `Web/data/`. The filename (without extension) is the data endpoint name used by the frontend's `Dashboard.fetchData('name')`.

### Key Metadata Files (Web/data/)

- `_cache_meta.json` — Last refresh timestamp, per-query status/duration/record counts
- `_sync_status.json` — Live progress during a refresh (phase, completed count, errors)
- `_thresholds.json` — Copied from `Config/thresholds.json` each refresh cycle
- `_config_public.json` — Frontend-visible subset of `Config/config.json` (refresh API port, auto-refresh interval, stale threshold). Written every refresh; contains no server/database names.
- `_history.json` — Rolling trend snapshots, one entry appended per refresh, pruned to `historyRetentionDays`. Powers the Trend page.

Note on `_history.json`: PowerShell 5.1's `$raw | ConvertFrom-Json` emits a JSON array as a *single* `Object[]` pipeline item, and `ConvertTo-Json` on an accumulated array produces nested `{"value":…,"Count":…}` wrappers plus depth-truncated strings. `Run-CacheRefresh.ps1` therefore uses `ConvertFrom-Json -InputObject` + `ConvertTo-FlatArray` when reading, and serializes each snapshot separately then joins them with `[` … `]` when writing. Don't "simplify" this back to a plain `ConvertTo-Json $array`.

### Frontend Module Structure

- **`dashboard.js`** — Core singleton (`Dashboard`): data fetching, threshold logic, metric card creation, formatting helpers (`formatNumber`, `formatPercent`, `formatDate`, `timeAgo`), theme toggle, cache status display, manual refresh trigger, RBAC check, i18n DOM translation. All pages call `Dashboard.init(pageId, pageTitle)` on load.
- **`lang.js`** — i18n module (`Lang`): TR/EN string dictionary. UI elements use `data-i18n` attributes for automatic translation.
- **`export.js`** — Export module (`CSVExport`): CSV, HTML (printable), and JSON export. Includes BOM for Turkish character support in Excel.
- **`slide-panel.js`** — Right-side drawer (`SlidePanel`) for detail views, used by page scripts to show row details.
- **Chart factory** — every chart goes through `Dashboard.chart(canvasId, config)`; never call `new Chart()` directly. It destroys any prior instance on that canvas (so in-place re-render doesn't throw "Canvas is already in use"), applies the shared theme, and registers the instance so `retintCharts()` can recolor it when the theme toggles.
- **`sidebar.js`** — Mobile sidebar toggle.
- **`js/pages/*.js`** — One JS file per dashboard page. Each follows the same pattern: `init()` calls `Dashboard.init()`, fetches its data endpoint, then renders metrics/charts/DataTable.

### Page Pattern

Every page (in `Web/pages/`) follows this structure:
- HTML loads shared CSS, vendored libs, `lang.js`, `dashboard.js`, `sidebar.js`, `slide-panel.js`, `export.js`, then its own `js/pages/<page>.js`
- Sidebar and header are loaded dynamically from `Web/shared/` via `Dashboard.loadComponent()`
- Page JS calls `Dashboard.init(pageId, title)` then fetches data via `Dashboard.fetchData(endpointName)`
- Immediately after fetching: `if (await Dashboard.bailIfEmpty('<endpoint>', data)) return;`

### Empty data is not zero data

`fetchData` returns `null` when the file is missing and `[]` when the query ran and matched nothing — **these mean different things and `[]` is truthy.** The old `if (!_data)` guard caught only the first, so an empty result rendered "0 / 0", "%0" and empty doughnuts, which reads as a measured zero rather than an absence. In this environment `bitlocker`, `task_deployment`, `cmg`, `app_deployment_pkg` and `db_monitor_backup` all legitimately return zero rows.

`Dashboard.dataState(endpoint, data)` distinguishes three cases — `fetch-error`, `query-error` (cross-checked against that query's status in `_cache_meta.json`), and `empty` — and `bailIfEmpty` renders the matching explanation. Pass `{title, hint}` to say *why* a particular area is empty in SCCM terms (e.g. "OSD may not be configured here"), rather than the generic message. For a single empty tab inside an otherwise populated page, use `Dashboard.emptyStateHtml(state, opts)` in place of that tab's table instead of bailing on the whole page.

### Configuration

- **`Config/config.json`** — SQL server, database name, output path, queries path, log path, plus:
  - `refreshApiPort`, `refreshIntervalMinutes`
  - `queryTimeoutSeconds` (SQL `CommandTimeout`), `connectionTimeoutSeconds`
  - `logRetentionDays` — logs older than this are deleted at the start of each refresh (0 disables)
  - `historyRetentionDays` — how long `_history.json` snapshots are kept
  - `staleThresholdMinutes` — after this age the header cache dot turns "stale"
  - `autoRefreshSeconds` — frontend poll interval for new data (0 disables)
  - `allowedOrigins` — refresh API CORS allowlist; empty means "this machine's own hostnames"
- **`Config/thresholds.json`** — Warning/critical thresholds per domain (updateDeployment, asset, bitlocker, taskDeployment, contentDistribution, laps, hardwareFirmware, sccmHealth, systemHealth, dbMonitor, …)

Thresholds must be read through `Dashboard.threshold(domain, key, fallback)` or `Dashboard.thresholdColor(domain, key, value, fallback, lowerIsBetter)` — **never hardcode a threshold number in a page script.** `Dashboard.init()` loads `_thresholds.json` before page code runs, so both helpers are synchronous afterwards. The `fallback` argument is the last resort if the JSON is unreachable; keep it equal to the value in `thresholds.json` and mirror any new key into `getThresholds()`'s fallback object. Note `dbMonitor.backupAgeDays` is in **days** while the query returns **hours** — convert at the call site.

Keep new tunables out of page scripts: add them to `config.json`, surface the frontend-relevant ones through `_config_public.json` in `Write-PublicConfig`, and read them via `Dashboard.getConfig()`.

### Auto-refresh

`Dashboard.startAutoRefresh()` polls `_cache_meta.json` every `autoRefreshSeconds` (and immediately when the tab regains focus). When `lastRefresh` changes it calls `window._pageReload()` if the page defined one, otherwise it shows a clickable "new data" badge in the header. Pages should **not** force a full `location.reload()` — that would discard the user's DataTable filters. Define `window._pageReload` in a page script to get in-place refresh.

### RBAC

**This is UI-level convenience, not a security boundary.** Roles and user assignments live in `localStorage` and any user can edit them with devtools. Real access control comes from IIS Windows Authentication on the site plus NTFS permissions — the `SCCMDashboard` site has anonymous auth disabled.

Managed via the Admin page (`pages/admin.html`, `js/pages/admin.js`). Roles map to allowed page IDs. Because a static site has no way to read the IIS-authenticated identity, the *active* user is chosen per browser on the Admin page and stored under `sccm_current_user`.

`Dashboard.checkPageAccess(pageId)` resolves current user → role → allowed pages, and `Dashboard.getRbacState()` reports which mode is in effect:

- `not-configured` — no roles or no users defined → everything is allowed
- `no-identity` — roles exist but no active user picked in this browser → everything is allowed, Admin page shows a warning banner
- `enforced` — active user set → role's page list is enforced, and `applyNavPermissions()` hides disallowed sidebar links

The `admin` page is always reachable so a bad role assignment can't lock you out.

## Data Visualization

The chart layer follows a fixed method — these are not style preferences, they change whether a chart can be read.

**Palette.** Eight categorical slots as CSS custom properties (`--series-1` … `--series-8`) in `style.css`, with a separate set of steps for dark. Both sets were validated against this dashboard's own card surfaces (light `#ffffff`, dark `#16213e`) and pass every gate: lightness band, chroma floor, colorblind separation (worst adjacent ΔE 9.1 light / 8.4 dark), and normal-vision separation. **The slot order is the colorblind-safety mechanism, not decoration — do not reorder it.** Three light-mode slots sit below 3:1 contrast; that is allowed here because every chart ships beside a DataTable showing the same values.

Read colors through `Dashboard.chartColors()` (never hardcode hex in a page) so a theme switch resolves the right step.

**Never cycle past 8 slots.** A ninth category is not a generated hue — it folds into "Diğer" via `Dashboard.foldCategories(items, maxSlots)`, which also keeps the total honest (the old `.slice(0, 8)` silently dropped the tail).

**Status colors are reserved.** `--status-good/warning/serious/critical` (via `Dashboard.statusColors()`) are for when a color *means* good/bad — Success/Failed, Normal/Warning/Error, Protected/Unprotected. They are never used as "series 4", and a categorical slot is never used for status. Every status color ships beside a text label, so color never carries the meaning alone.

**Form.** Magnitude across categories → bar (one measure = one color; hue carries no information there). Part-to-whole at a glance, ≤6 segments → doughnut. Change over time → line. **A two-slice doughnut is always wrong** — the KPI card above it already states both numbers; use a bar. Never a dual-axis chart.

**Marks.** The factory applies these; don't re-specify them per page: bars capped at 24px with a 4px rounded data-end, 2px lines, ≥3px points carrying a 2px surface-color ring, area fills at 10% opacity, and hairline **solid** gridlines (dashed gridlines read as a threshold that isn't there). Doughnut slices are separated by a 2px surface-color gap, never a stroke.

**Legend and labels.** Two or more series always get a legend; a single series gets none (the card title already names it). Never label every data point. Chart text uses text tokens, never the series color.

To re-validate after changing any palette value, run the `dataviz` skill's `scripts/validate_palette.js` against both surfaces — don't eyeball colorblind safety.

## Conventions

- SQL connection uses Windows Integrated Authentication — no credentials in config
- Log messages and code comments are in Turkish
- Number formatting uses Turkish locale (`tr-TR`)
- Dates display as `DD.MM.YYYY HH:MM`
- The CSS uses CSS custom properties for theming (light/dark); both themes are defined in `Web/css/style.css`
- All frontend JS uses IIFE modules and ES5-compatible syntax (no classes, no arrow functions, no `let`/`const` in page scripts except dashboard.js)
- Anything derived from SQL data must go through `Dashboard.escapeHtml()` before reaching `innerHTML`. `createMetricCard` escapes `title`/`value`/`sub` itself — only `icon` is raw HTML, so it must stay a hard-coded entity. Note that `escapeHtml` deliberately passes `0` and `false` through (only `null`/`undefined` become `''`).

## Installer

Portable installer files are at `C:\Installer\`. This directory contains:

- **`Install.ps1`** — Tek komutla kurulum: dosya kopyalama, config, IIS, Scheduled Task, Firewall, URL ACL
- **`Uninstall.ps1`** — IIS site/pool, task, firewall kurallarını kaldırır (`-RemoveFiles` ile dosyaları da siler)
- **`Diagnose.ps1`** — SQL bağlantı, view/kolon varlık, sorgu çalıştırma, IIS/task durum kontrolü
- **`Audit-SCCMData.ps1`** — Kapsamlı veri ve sorgu audit raporu
- **`install-readme.txt`** — Kurulum rehberi
- **`CacheService/`**, **`Config/`**, **`Web/`** — Hedefe kopyalanacak uygulama dosyaları

Installer subdirectory'leri (`CacheService/`, `Config/`, `Web/`) kaynak koddaki (`C:\SCCMDashboard\`) aynı dizinlerin kopyasıdır. Kaynak kodda değişiklik yapıldığında installer tarafı da güncellenmelidir.

## Adding a New Dashboard Page

1. Create `CacheService/queries/<name>.sql` with the SCCM query
2. Create `Web/pages/<name>.html` following the existing page template
3. Create `Web/js/pages/<name>.js` following the init/fetch/render pattern
4. Add nav link in `Web/shared/sidebar.html`
5. Add i18n strings in `Web/js/lang.js`
6. Add the page ID to `ALL_PAGES` in `Web/js/pages/admin.js` so RBAC can grant it
7. The cache service will auto-discover the new `.sql` file on next refresh

The Trend page (`pages/trend.html`) is the exception to step 1 — it reads `_history.json`, which `Run-CacheRefresh.ps1` computes from the other JSON outputs rather than from its own `.sql` file. To trend a new metric, add it to the `$snapshot` hashtable in `Add-HistorySnapshot`.
