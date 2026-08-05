/**
 * SCCM Dashboard — CSV Export
 */
var CSVExport = (function () {
  'use strict';

  function escapeCsvField(val) {
    if (val == null) return '';
    var str = String(val);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Export array of objects to CSV and trigger download.
   * @param {Array} data - array of row objects
   * @param {string} filename - e.g. 'update_deployment.csv'
   * @param {Array} [columns] - optional [{key, label}] to control column order/names
   */
  function exportToCSV(data, filename, columns) {
    if (!data || data.length === 0) {
      alert('Disa aktarilacak veri bulunamadi.');
      return;
    }

    var cols = columns;
    if (!cols) {
      var keys = Object.keys(data[0]);
      cols = keys.map(function (k) { return { key: k, label: k }; });
    }

    var lines = [];
    // Header
    lines.push(cols.map(function (c) { return escapeCsvField(c.label); }).join(','));
    // Rows
    data.forEach(function (row) {
      var line = cols.map(function (c) { return escapeCsvField(row[c.key]); }).join(',');
      lines.push(line);
    });

    var csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel Turkish char support
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export DataTable data to CSV.
   * @param {object} dt - DataTable instance
   * @param {string} filename
   */
  function exportDataTable(dt, filename) {
    var headers = [];
    dt.columns().header().each(function (th) {
      headers.push(th.textContent.trim());
    });

    var rows = [];
    dt.rows({ search: 'applied' }).data().each(function (rowData) {
      var obj = {};
      headers.forEach(function (h, i) {
        // strip HTML tags
        var val = rowData[i];
        if (typeof val === 'string') val = val.replace(/<[^>]+>/g, '');
        obj[h] = val;
      });
      rows.push(obj);
    });

    var cols = headers.map(function (h) { return { key: h, label: h }; });
    exportToCSV(rows, filename, cols);
  }

  /**
   * Export to HTML table format for printing.
   * @param {Array} data - array of row objects
   * @param {string} title - report title
   * @param {Array} [columns] - optional [{key, label}]
   */
  function exportToHTML(data, title, columns) {
    if (!data || data.length === 0) {
      alert('Disa aktarilacak veri bulunamadi.');
      return;
    }

    var cols = columns;
    if (!cols) {
      var keys = Object.keys(data[0]);
      cols = keys.map(function (k) { return { key: k, label: k }; });
    }

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>' + (title || 'Rapor') + '</title>' +
      '<style>' +
        'body{font-family:Segoe UI,sans-serif;margin:20px;color:#333}' +
        'h1{font-size:18px;margin-bottom:4px}' +
        '.meta{font-size:12px;color:#666;margin-bottom:16px}' +
        'table{width:100%;border-collapse:collapse;font-size:13px}' +
        'th{background:#2c3e50;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}' +
        'td{padding:6px 10px;border-bottom:1px solid #ddd}' +
        'tr:nth-child(even){background:#f9f9f9}' +
        'tr:hover{background:#e8f4fd}' +
        '.footer{margin-top:20px;font-size:11px;color:#999;border-top:1px solid #ddd;padding-top:8px}' +
        '@media print{body{margin:0}.footer{position:fixed;bottom:10px}}' +
      '</style></head><body>' +
      '<h1>' + (title || 'SCCM Dashboard Raporu') + '</h1>' +
      '<div class="meta">Olusturulma: ' + new Date().toLocaleString('tr-TR') + ' | Kayit: ' + data.length + '</div>' +
      '<table><thead><tr>';

    cols.forEach(function (c) { html += '<th>' + c.label + '</th>'; });
    html += '</tr></thead><tbody>';

    data.forEach(function (row) {
      html += '<tr>';
      cols.forEach(function (c) {
        var val = row[c.key];
        html += '<td>' + (val != null ? String(val) : '') + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table>' +
      '<div class="footer">SCCM Dashboard Monitoring System</div>' +
      '</body></html>';

    var blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (title || 'rapor').replace(/\s+/g, '_') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export to JSON format.
   * @param {Array} data
   * @param {string} filename
   */
  function exportToJSON(data, filename) {
    if (!data || data.length === 0) {
      alert('Disa aktarilacak veri bulunamadi.');
      return;
    }
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    exportToCSV: exportToCSV,
    exportDataTable: exportDataTable,
    exportToHTML: exportToHTML,
    exportToJSON: exportToJSON
  };
})();
