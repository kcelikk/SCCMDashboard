/**
 * SCCM Dashboard — Slide Panel (Right Drawer)
 */
var SlidePanel = (function () {
  'use strict';

  var _panelEl = null;
  var _overlayEl = null;

  function _ensureDOM() {
    if (_overlayEl) return;

    _overlayEl = document.createElement('div');
    _overlayEl.className = 'slide-panel-overlay';
    _overlayEl.addEventListener('click', close);

    _panelEl = document.createElement('div');
    _panelEl.className = 'slide-panel';
    _panelEl.innerHTML =
      '<div class="slide-panel-header">' +
        '<h3 id="panel-title">Detay</h3>' +
        '<div class="panel-actions">' +
          '<button class="btn btn-secondary btn-export-panel" style="display:none">CSV Export</button>' +
          '<button class="btn-close" id="panel-close">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="slide-panel-body" id="panel-body"></div>';

    document.body.appendChild(_overlayEl);
    document.body.appendChild(_panelEl);

    _panelEl.querySelector('#panel-close').addEventListener('click', close);

    // ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function open(title, contentHtml, opts) {
    _ensureDOM();
    opts = opts || {};

    _panelEl.querySelector('#panel-title').textContent = title || 'Detay';
    _panelEl.querySelector('#panel-body').innerHTML = contentHtml;

    // CSV export button
    var exportBtn = _panelEl.querySelector('.btn-export-panel');
    if (opts.exportData && opts.exportFilename) {
      exportBtn.style.display = '';
      exportBtn.onclick = function () {
        if (window.CSVExport) {
          CSVExport.exportToCSV(opts.exportData, opts.exportFilename);
        }
      };
    } else {
      exportBtn.style.display = 'none';
    }

    // Show
    requestAnimationFrame(function () {
      _overlayEl.classList.add('open');
      _panelEl.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  function close() {
    if (!_panelEl) return;
    _overlayEl.classList.remove('open');
    _panelEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  function setBody(html) {
    if (_panelEl) _panelEl.querySelector('#panel-body').innerHTML = html;
  }

  return { open: open, close: close, setBody: setBody };
})();
