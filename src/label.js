/**
 * Helper utilities for printing QR labels from Google Sheets.
 */

function printFancyLabelQR(id) {
  const products = getSheet_(SHEET_NAMES.products);
  let targetId = cleanString_(id);

  if (!targetId && products) {
    const lastRow = products.getLastRow();
    if (lastRow >= 2) {
      targetId = cleanString_(products.getRange(lastRow, 1).getValue());
    }
  }
  if (!targetId) {
    SpreadsheetApp.getUi().alert('製品IDが見つかりません。');
    return;
  }

  const webAppUrl = ScriptApp.getService().getUrl();
  const qrTarget = webAppUrl ? (webAppUrl + '?id=' + encodeURIComponent(targetId)) : targetId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(qrTarget);

  const html = [
    '<div style="font-family:sans-serif;text-align:center;border:1px solid #ccc;padding:12px;width:280px;">',
    '  <div style="font-size:17px;font-weight:600;">' + targetId + '</div>',
    '  <img src="' + qrUrl + '" width="160" height="160" style="margin-top:8px;" alt="QR">',
    '</div>'
  ].join('\n');

  openDialog_(html, 'QRラベルプレビュー', 320, 320);
}

function printPhomemoLabel(productId, options) {
  const opts = Object.assign({
    widthMm: 40,
    heightMm: 30,
    marginMm: 2,
    showName: true
  }, options || {});

  const sheet = getSheet_(SHEET_NAMES.products);
  const targetId = cleanString_(productId);
  if (!targetId) {
    SpreadsheetApp.getUi().alert('製品IDを指定してください。');
    return;
  }
  let productName = '';

  if (sheet && targetId) {
    const values = sheet.getDataRange().getValues();
    if (values.length > 1) {
      const header = values[0];
      const idxId = getHeaderIndex_(header, HEADER_KEYS.fancyId);
      const idxName = getHeaderIndex_(header, HEADER_KEYS.productName);
      const row = values.slice(1).find(function (r) { return idsEqual_(r[idxId >= 0 ? idxId : 0], targetId); });
      if (row && idxName >= 0) productName = String(row[idxName] || '');
    }
  }

  const webAppUrl = ScriptApp.getService().getUrl();
  const qrTarget = webAppUrl ? (webAppUrl + '?id=' + encodeURIComponent(targetId)) : targetId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qrTarget);

  const style = [
    ':root{--scale:1;}',
    '@page{size:' + opts.widthMm + 'mm ' + opts.heightMm + 'mm;margin:' + opts.marginMm + 'mm;}',
    'html,body{height:100%;}',
    'body{margin:0;display:flex;align-items:center;justify-content:center;background:#fff;}',
    '.outer{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}',
    '.paper{width:' + opts.widthMm + 'mm;height:' + opts.heightMm + 'mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;}',
    '.label{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;}',
    '.qr{width:calc(100% - ' + (opts.marginMm * 2) + 'mm);height:auto;}',
    '.id{font-weight:700;font-size:10pt;margin-top:1mm;}',
    '.name{font-size:8pt;margin-top:0.5mm;text-align:center;padding:0 2mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%;}',
    '@media screen{body{padding:16px;} .paper{transform:scale(var(--scale));transform-origin:top left;}}',
    '@media print{.paper{transform:none;}}'
  ].join('\n');

  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>' + style + '</style>',
    '</head><body>',
    '<div class="outer"><div class="paper"><div class="label">',
    '  <img class="qr" src="' + qrUrl + '" alt="QRコード">',
    '  <div class="id">' + targetId + '</div>',
    opts.showName && productName ? '  <div class="name">' + productName + '</div>' : '',
    '</div></div></div>',
    '<script>(function(){',
    'function fit(){',
    '  var paper=document.querySelector(".paper");',
    '  var outer=document.querySelector(".outer");',
    '  if(!paper||!outer) return;',
    '  var sw=outer.clientWidth-8, sh=outer.clientHeight-8;',
    '  var pw=paper.offsetWidth, ph=paper.offsetHeight;',
    '  var scale=Math.min(sw/pw, sh/ph, 1);',
    '  document.documentElement.style.setProperty("--scale", scale);',
    '}',
    'window.addEventListener("resize", fit);',
    'fit();',
    'setTimeout(function(){ window.print(); }, 400);',
    '})();</script>',
    '</body></html>'
  ].join('\n');

  openDialog_(html, 'ラベル印刷', 520, 520);
}

function openDialog_(html, title, width, height) {
  const out = HtmlService.createHtmlOutput(html);
  if (typeof width === 'number') out.setWidth(width);
  if (typeof height === 'number') out.setHeight(height);
  SpreadsheetApp.getUi().showModalDialog(out, title || 'Preview');
}
