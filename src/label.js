function getManageSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = ['製品管理','管理','Manage','Products'];
  for (var i=0;i<names.length;i++){ var sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  return null;
}

function printFancyLabelQR(id) {
  const manage = getManageSheet_();
  if (!id && manage) id = manage.getRange(manage.getLastRow(), 1).getValue();
  const webAppUrl = ScriptApp.getService().getUrl();
  const target = webAppUrl ? `${webAppUrl}?id=${id}` : String(id);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(target)}`;
  const html = `
    <div style="font-family:sans-serif; text-align:center; border:1px solid #ccc; padding:8px; width:280px;">
      <div style="font-size:16px; font-weight:600;">${id}</div>
      <img src="${qrUrl}" width="160" height="160" style="margin-top:6px;">
    </div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), 'QRラベルプレビュー');
}

function printPhomemoLabel(productId, opts) {
  const o = Object.assign({ widthMm: 40, heightMm: 30, marginMm: 2, showName: true }, opts || {});
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = getManageSheet_();
  let name = '';
  if (manage) {
    const rows = manage.getDataRange().getValues();
    const row = rows.find(r => String(r[0]) === String(productId));
    if (row) name = String(row[1] || '');
  }
  const webAppUrl = ScriptApp.getService().getUrl();
  const qrTarget = webAppUrl ? `${webAppUrl}?id=${productId}` : String(productId);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrTarget)}`;

  const style = `:root{--scale:1}
    @page { size: ${o.widthMm}mm ${o.heightMm}mm; margin: ${o.marginMm}mm; }
    html,body{height:100%}
    body{margin:0; display:flex; align-items:center; justify-content:center; background:#fff;}
    .outer{width:100%; height:100%; display:flex; align-items:center; justify-content:center;}
    .paper{width:${o.widthMm}mm; height:${o.heightMm}mm; box-sizing:border-box; display:flex; align-items:center; justify-content:center;}
    .label{width:100%;height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif;}
    .qr{width:calc(100% - ${o.marginMm*2}mm); height:auto;}
    .id{font-weight:700; font-size:10pt; margin-top:1mm;}
    .name{font-size:8pt; margin-top:0.5mm; text-align:center; padding:0 2mm; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:100%;}
    @media screen { body{padding:16px} .paper{transform:scale(var(--scale)); transform-origin: top left;} }
    @media print  { .paper{transform:none} }`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${style}</style></head>
  <body>
    <div class="outer"><div class="paper"><div class="label">
      <img class="qr" src="${qrUrl}" alt="QR">
      <div class="id">${productId}</div>
      ${o.showName && name ? `<div class="name">${name}</div>` : ''}
    </div></div></div>
    <script>(function(){
      function fit(){
        var paper=document.querySelector('.paper');
        var outer=document.querySelector('.outer');
        if(!paper||!outer) return;
        var sw=outer.clientWidth-8, sh=outer.clientHeight-8;
        var pw=paper.offsetWidth, ph=paper.offsetHeight;
        var s=Math.min(sw/pw, sh/ph, 1);
        document.documentElement.style.setProperty('--scale', s);
      }
      window.addEventListener('resize', fit); fit();
      setTimeout(function(){ window.print(); }, 400);
    })();</script>
  </body></html>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(520), 'ラベル印刷');
}

