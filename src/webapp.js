// Mobile Web App (menu, start, pick, label, resume)

function doGet(e){
  const p = (e && e.parameter) || {};
  const page = String(p.page || '').toLowerCase();
  try{ logInfo_('doGet', { page: page, id: p.id }); }catch(_){ }
  if (!page || page === 'menu') return HtmlService.createHtmlOutput(renderMenu_());
  if (page === 'start') return HtmlService.createHtmlOutput(renderStart_());
  if (page === 'pick')  return HtmlService.createHtmlOutput(p.id ? renderPick_(p.id) : renderMissingId_('pick'));
  if (page === 'label') return HtmlService.createHtmlOutput(p.id ? renderLabel_(p.id, p.size, p.margin, p.name) : renderMissingId_('label'));
  if (typeof p.id !== 'undefined') return HtmlService.createHtmlOutput(p.id ? renderResume_(p.id) : renderMissingId_('resume'));
  return HtmlService.createHtmlOutput(renderMenu_());
}

function doPost(e){
  try{
    const raw = (e && e.postData && e.postData.contents) || '{}';
    let data = {};
    try { data = JSON.parse(raw); } catch (err) { data = {}; }
    const action = String((data.action || '')).toLowerCase();
    Logger.log('raw=' + raw);
    Logger.log('parsed=' + JSON.stringify(data));
    Logger.log('action=' + action);
    try{ logInfo_('doPost:recv', { action: action, hasToken: !!data.token, id: data.id, rawLen: raw.length }); }catch(_){ }
    // shared token check (optional). Set Script Properties: API_TOKEN
    const sp = PropertiesService.getScriptProperties();
    const expected = sp.getProperty('API_TOKEN');
    const debugResp = (String(sp.getProperty('DEBUG_RESPONSE')||'').toLowerCase()==='true') || (data && (data.debug===true || data.debug===1 || String(data.debug||'').toLowerCase()==='true'));
    if (expected && String(data.token || '') !== String(expected)) {
      return jsonResponse_({ ok:false, error:'forbidden' }, debugResp);
    }

    // フェイルセーフ: action未指定なら一覧を返す
    if (!action) {
      const items = (function(){
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const candidates = ['Products'];
        let manage = null;
        for (var i=0;i<candidates.length;i++){ manage = ss.getSheetByName(candidates[i]); if(manage) break; }
        const rows = manage ? manage.getDataRange().getValues() : [];
        let items = [];
        if (rows.length>0){
          const H = (rows[0]||[]).map(String);
          const idIdx = localGetHeaderIndex_(H, ['ProductID']);
          const nameIdx = localGetHeaderIndex_(H, ['ProductName']);
          items = rows.slice(1).map(function(r){ return { id: String(idIdx>=0? r[idIdx]: r[0]||''), name: String(nameIdx>=0? r[nameIdx]: r[1]||'') }; }).filter(function(x){ return x.id; });
        }
        return items;
      })();
      try{ logInfo_('list:ok', { count: items.length }); }catch(_){ }
      return jsonResponse_({ ok:true, data: items }, debugResp);
    }

    // list: 製品一覧を返す
    if (action === 'list'){
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      // 管理シート名の候補
      const candidates = ['Products'];
      let manage = null;
      for (var i=0;i<candidates.length;i++){ manage = ss.getSheetByName(candidates[i]); if(manage) break; }
      const rows = manage ? manage.getDataRange().getValues() : [];
      // 先頭行をヘッダとみなす
      let items = [];
      if (rows.length>0){
        const H = (rows[0]||[]).map(String);
        const idIdx = localGetHeaderIndex_(H, ['ProductID']);
        const nameIdx = localGetHeaderIndex_(H, ['ProductName']);
        items = rows.slice(1).map(function(r){ return { id: String(idIdx>=0? r[idIdx]: r[0]||''), name: String(nameIdx>=0? r[nameIdx]: r[1]||'') }; }).filter(function(x){ return x.id; });
      }
      return jsonResponse_({ ok:true, data: items }, debugResp);
    }
  if (action === 'snapshot'){
      const snap = getPickingSnapshotFixed_(data.id);
      try{ logInfo_('snapshot:ok', { id: data.id, partId: snap.partId, partName: snap.partName, qty: snap.qty }); }catch(_){ }
      return jsonResponse_({ ok:true, data:snap }, debugResp);
    }
    if (action === 'next'){
      if (typeof nextPart === 'function') nextPart();
      const snap = getPickingSnapshotFixed_(data.id);
      try{ logInfo_('next:ok', { id: data.id, partId: snap.partId, partName: snap.partName, qty: snap.qty }); }catch(_){ }
      return jsonResponse_({ ok:true, data:snap }, debugResp);
    }
    if (action === 'pause'){
      if (typeof pausePicking === 'function') pausePicking();
      try{ logInfo_('pause:ok', { id: data.id }); }catch(_){ }
      return jsonResponse_({ ok:true }, debugResp);
    }
    if (action === 'start'){
      if (typeof startPickingWithProduct === 'function') startPickingWithProduct(data.id);
      const snap = getPickingSnapshotFixed_(data.id);
      try{ logInfo_('start:ok', { id: data.id, partId: snap.partId, partName: snap.partName, qty: snap.qty }); }catch(_){ }
      return jsonResponse_({ ok:true, data:snap }, debugResp);
    }
    if (action === 'resume'){
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let s = ss.getSheetByName('Progress');
      if (!s){
        s = ss.insertSheet('Progress');
        s.getRange('A1').setValue('Status');
        s.getRange('B1').setValue('PartID');
        s.getRange('C1').setValue('FancyID');
        s.getRange('D1').setValue('RecipeID');
      }
      s.getRange('C2').setValue(data.id);
      s.getRange('A2').setValue('進行中');
      // resolve model id
      const manage = ss.getSheetByName('Products');
      if (manage){
        const mv = manage.getDataRange().getValues();
        const idx = localGetHeaderIndex_(mv[0], ['RecipeID']);
        const row = mv.slice(1).find(r => String(r[0]) === String(data.id));
        if (row && idx >= 0) s.getRange('D2').setValue(String(row[idx]||''));
      }
      // init part if needed
      const parts = ss.getSheetByName('Parts');
      if (parts){
        const pv = parts.getDataRange().getValues();
        if (pv.length>1){
          const H = pv[0].map(String);
          const prodCol = H.indexOf('ProductID');
          const partCol = H.indexOf('PartID');
          const key = String(s.getRange('D2').getValue()||data.id);
          let list = pv.slice(1).filter(r => String(r[prodCol]) === key);
          const cur = String(s.getRange('B2').getValue()||'');
          const exists = cur && list.some(r => String(r[partCol]) === cur);
          if (!exists && list.length) s.getRange('B2').setValue(String(list[0][partCol]));
        }
      }
      if (typeof updateManageProgress_ === 'function'){
        const cur = String(s.getRange('B2').getValue()||'');
        updateManageProgress_(data.id, cur, '進行中');
      }
      const snap = getPickingSnapshotFixed_(data.id);
      return jsonResponse_({ ok:true, data:snap }, debugResp);
    }
  }catch(err){
    try{ logError_('doPost:error', { message: err && err.message, stack: String(err && err.stack || '') }); }catch(_){ }
    return jsonResponse_({ ok:false, error: err.message }, true);
  }
  return jsonResponse_({ ok:false, error:'bad request' }, true);
}

// ----- Pages -----
function renderMenu_(){
  const base = ScriptApp.getService().getUrl();
  var h = '';
  h += '<!doctype html><html><head><meta charset="utf-8">';
  h += '<meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px}';
  h += 'h2{margin:8px 0 16px} a.btn,button{display:block;width:100%;padding:14px 16px;margin:10px 0;font-size:18px;text-align:center;border-radius:10px;border:1px solid #ccc;background:#fff}';
  h += '.note{color:#666;font-size:12px;margin-top:10px}</style></head><body>';
  h += '<h2>KittingFlow モバイル</h2>';
  h += '<a class="btn" target="_top" rel="noopener" href="'+base+'?page=start">📦 ピッキング開始</a>';
  h += '<a class="btn" target="_top" rel="noopener" href="'+base+'?page=label">🏷 ラベル印刷</a>';
  h += '<div style="margin-top:14px">QR/手入力で再開:</div>';
  h += '<input id="resumeId" placeholder="ProductID (MK-...)" style="width:100%;font-size:18px;padding:10px">';
  h += '<button onclick="(function(){var v=document.getElementById(\'resumeId\').value.trim(); if(!v){alert(\'ProductIDを入力\');return;} try{ top.location.href=\''+base+'?id=\'+encodeURIComponent(v);}catch(e){ location.href=\''+base+'?id=\'+encodeURIComponent(v);} })()">▶ 再開</button>';
  h += '<script>try{ if (top !== self) top.location.href = location.href; }catch(e){}</script>';
  h += '<div class="note">ブックマークしてiPadホームに追加すると便利です。</div>';
  h += debugFooterHtml_();
  h += debugFooterHtml_();
  h += debugFooterHtml_();
  h += debugFooterHtml_();
  h += '</body></html>';
  return h;
}

function renderStart_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('Products');
  const rows = manage ? manage.getDataRange().getValues() : [];
  const items = rows.slice(1).map(r=>({id:String(r[0]||''), name:String(r[1]||'')})).filter(x=>x.id);
  const data = JSON.stringify(items);
  const base = ScriptApp.getService().getUrl();
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8">';
  h += '<meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px}';
  h += 'h2{margin:8px 0 12px} select,input{width:100%;font-size:18px;padding:10px} button{width:100%;padding:12px;margin-top:10px;border-radius:10px;border:1px solid #ccc;background:#fff}</style></head><body>';
  h += '<h2>商品を選択</h2><input id="q" placeholder="検索 (ID/名称)"><select id="sel" size="12" style="margin-top:8px;"></select><button id="go">開始</button>';
  h += '<script>const data='+data+';const sel=document.getElementById(\'sel\');';
  h += 'function r(list){sel.innerHTML=list.map(function(p){return \"<option value=\\\"\"+p.id+\"\\\">\"+p.id+(p.name?\" - \"+p.name:\"\")+\"</option>\";}).join(\"\"); if(sel.options.length) sel.selectedIndex=0;}';
  h += 'r(data);document.getElementById(\'q\').oninput=function(e){var q=e.target.value.toLowerCase(); r(data.filter(function(p){return (p.id+\" \"+(p.name||\"\")).toLowerCase().indexOf(q)>-1;}));};';
  h += 'document.getElementById(\'go\').onclick=function(){var id=sel.value;if(!id){alert(\'ProductIDを選択\');return;} google.script.run.withSuccessHandler(function(){ try{ top.location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(id);}catch(e){ location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(id);} }).startPickingWithProduct(id);};';
  h += '<script>try{ if (top !== self) top.location.href = location.href; }catch(e){}</script>';
  h += '</script>';
  h += debugFooterHtml_();
  h += debugFooterHtml_();
  h += '</body></html>';
  return h;
}

function renderPick_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('Products');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r=rows.find(function(x){return String(x[0])===String(id)}); if(r) name=String(r[1]||'');
  const prog = ss.getSheetByName('Progress');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';
  const parts = ss.getSheetByName('Parts');
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = H.indexOf('ProductID');
      const partCol = H.indexOf('PartID');
      const nameCol = H.indexOf('PartName');
      const imgCol  = H.indexOf('ImageURL');
      const qtyCol  = H.indexOf('Qty');
      logInfo_('renderPick:lookup', { id: id, modelId: modelId, partId: partId });
      let list = pv.slice(1).filter(function(x){return String(x[prodCol]) === (modelId||id)});
      const hit  = list.find(function(x){return String(x[partCol])===partId}) || list[0];
      if (hit){ partName = nameCol>=0? String(hit[nameCol]||''):''; qty = qtyCol>=0? String(hit[qtyCol]||''):''; img = imgCol>=0? String(hit[imgCol]||''):''; }
    }
  }

  const base = ScriptApp.getService().getUrl();
  const data = JSON.stringify({id:id, name:name, partId:partId, partName:partName, qty:qty, img:img});
  console.log('renderPick data=' + data);
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px}';
  h += 'h2{margin:6px 0 14px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}.img{width:220px;height:220px;object-fit:contain;border:1px solid #eee;margin:8px auto;display:block}';
  h += 'button{width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ccc;background:#fff;font-size:18px}</style></head><body>';
  h += '<div id="app"></div><script>const v='+data+';';
  h += 'document.getElementById(\'app\').innerHTML="<h2>ピッキング</h2><div class=\\\"card\\\"><div><b>ProductID:</b> "+v.id+"</div><div><b>製品名:</b> "+(v.name||"")+"</div><div style=\\\"margin-top:8px;\\\"><b>部品:</b> "+(v.partId||"")+ (v.partName?" / "+v.partName:"")+ (v.qty?" / Qty "+v.qty:"")+"</div>"+(v.img?"<img class=img src=\\\""+v.img+"\\\">":"")+"<button id=next>次へ ▶</button><button id=pause>⏸ 中断</button><button id=label>🏷 ラベル印刷</button></div>";';
  h += 'document.getElementById(\'next\').onclick=function(){ if(!window.google||!google.script||!google.script.run){alert(\'実行環境エラー\');return;} google.script.run.withFailureHandler(function(e){alert(\'エラー: \'+(e&&e.message?e.message:e));}).withSuccessHandler(function(){location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(v.id)+\'&t=\'+Date.now();}).nextPart();};';
  h += 'document.getElementById(\'pause\').onclick=function(){ if(!window.google||!google.script||!google.script.run){alert(\'実行環境エラー\');return;} google.script.run.withFailureHandler(function(e){alert(\'エラー: \'+(e&&e.message?e.message:e));}).withSuccessHandler(function(){alert(\'中断しました\');}).pausePicking();};';
  h += 'document.getElementById(\'label\').onclick=function(){ location.href=\''+base+'?page=label&id=\'+encodeURIComponent(v.id); };';
  h += '</script>';
  h += debugFooterHtml_();
  h += '</body></html>';
  return h;
}

function renderLabel_(id, size, margin, showName){
  const s = String(size||'40x30').split('x'); const w=Number(s[0]||40), h=Number(s[1]||30); const m=Number(margin||2); const sn = showName!=='0' && showName!=='false';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('Products');
  var name=''; if (manage){ var rows=manage.getDataRange().getValues(); var r=rows.find(function(x){return String(x[0])===String(id)}); if(r) name=String(r[1]||''); }
  const url = ScriptApp.getService().getUrl();
  const target = url ? (url+'?id='+id) : String(id);
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data='+encodeURIComponent(target);
  var css = '@page { size:'+w+'mm '+h+'mm; margin:'+m+'mm } html,body{height:100%} body{margin:0; width:'+w+'mm; height:'+h+'mm; display:flex; align-items:center; justify-content:center} .label{width:100%;height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif} .qr{width:calc(100% - '+(m*2)+'mm); height:auto} .id{font-weight:700; font-size:10pt; margin-top:1mm} .name{font-size:8pt; margin-top:0.5mm; text-align:center; padding:0 2mm; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:100%}';
  var htm = '<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body><div class="label"><img class="qr" src="'+qr+'"><div class="id">'+id+'</div>'+(sn && name?('<div class="name">'+name+'</div>'):'')+'</div><script>setTimeout(function(){window.print()},400);</script></body></html>';
  return htm;
}

function renderResume_(id){
  const url = ScriptApp.getService().getUrl();
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px} button{width:100%;padding:14px;border-radius:10px;border:1px solid #ccc;background:#fff}</style></head><body>';
  h += '<h3>ProductID: '+id+'</h3><button id="go">▶ 再開する</button><p id="msg"></p>';
  h += '<script>document.getElementById(\'go\').onclick=async function(){ var res=await fetch(\''+url+'\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({action:\'resume\',id:\''+id+'\'})}); document.getElementById(\'msg\').innerText=await res.text(); };</script>';
  h += '</body></html>';
  return h;
}

function renderMissingId_(next){
  const base = ScriptApp.getService().getUrl();
  const title = next==='label' ? 'ラベル印刷' : (next==='pick' ? 'ピッキング' : '再開');
  var go;
  if (next==='label') go = "location.href=base+'?page=label&id='+encodeURIComponent(v)";
  else if (next==='pick') go = "location.href=base+'?page=pick&id='+encodeURIComponent(v)";
  else go = "location.href=base+'?id='+encodeURIComponent(v)";
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px} input,button{width:100%;font-size:18px;padding:12px} button{margin-top:10px;border-radius:10px;border:1px solid #ccc;background:#fff}</style></head><body>';
  h += '<h3>IDが指定されていません</h3><p>'+title+'の対象となるProductIDを入力してください。</p><input id="pid" placeholder="ProductID (例: MK-...)" autofocus><button onclick="(function(){var v=document.getElementById(\'pid\').value.trim(); if(!v){alert(\'ProductIDを入力してください\');return;} var base=\''+base+'\'; '+go+'; })()">続行</button><p style="margin-top:8px"><a href="'+base+'?page=menu">メニューに戻る</a></p>';
  h += '</body></html>';
  return h;
}

// ===== Active snapshot helpers =====
function getPickingSnapshot_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('Products');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r = rows.find(function(x){ return String(x[0])===String(id); }); if (r) name = String(r[1]||'');
  const prog = ss.getSheetByName('Progress');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';
  const parts = ss.getSheetByName('Parts');
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = H.indexOf('ProductID');
      const partCol = H.indexOf('PartID');
      const nameCol = H.indexOf('PartName');
      const imgCol  = H.indexOf('ImageURL');
      const qtyCol  = H.indexOf('Qty');
      let list = pv.slice(1).filter(function(x){ return String(x[prodCol]) === (modelId||id); });
      const hit  = list.find(function(x){ return String(x[partCol])===partId; }) || list[0];
      if (hit){ partName = nameCol>=0? String(hit[nameCol]||''):''; qty = qtyCol>=0? String(hit[qtyCol]||''):''; img = imgCol>=0? String(hit[imgCol]||''):''; }
    }
  }
  return { id:id, name:name, partId:partId, partName:partName, qty:qty, img:img };
}

// ----- Logging helpers -----
function logInfo_(tag, obj){
  try{
    Logger.log(tag + ' ' + JSON.stringify(obj));
    sheetLog_('INFO', tag, obj);
  }catch(_){ }
}
function logError_(tag, obj){
  try{
    Logger.log('ERROR ' + tag + ' ' + JSON.stringify(obj));
    sheetLog_('ERROR', tag, obj);
  }catch(_){ }
}
function sheetLog_(level, tag, obj){
  try{
    var sp = PropertiesService.getScriptProperties();
    var enabled = String(sp.getProperty('ENABLE_SHEET_LOG')||'').toLowerCase();
    if (!(enabled==='1' || enabled==='true' || enabled==='yes')) return;
    var name = sp.getProperty('LOG_SHEET') || 'Logs';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.appendRow([new Date(), level, tag, JSON.stringify(obj||{})]);
  }catch(_){ }
}

// JSON response helper with optional debug log injection
function jsonResponse_(obj, debug){
  try{
    if (debug){
      var logText = '';
      try { logText = Logger.getLog(); } catch(_){ logText=''; }
      obj = Object.assign({}, obj, { _debug: { log: logText } });
    }
  }catch(_){ }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----- Debug footer injection -----
function debugFooterHtml_(){
  try{
    var css = '<style id="__dbg_css">'
      + '#__dbg_wrap{position:fixed;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);color:#fff;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;z-index:9999;box-shadow:0 -2px 6px rgba(0,0,0,.3)}'
      + '#__dbg_bar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-top:1px solid rgba(255,255,255,.15);background:rgba(30,30,30,.9)}'
      + '#__dbg_bar b{font-size:12px;opacity:.8}'
      + '#__dbg_toggle{margin-left:auto;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:2px 6px;cursor:pointer}'
      + '#__dbg_log{max-height:30vh;overflow:auto;padding:6px 8px;white-space:pre-wrap;word-break:break-word}'
      + '#__dbg_wrap.min #__dbg_log{display:none}'
      + '#__dbg_log .ln{opacity:.9}'
      + '#__dbg_log .ln.warn{color:#ffd166}'
      + '#__dbg_log .ln.error{color:#ff6b6b}'
      + '</style>';
    var html = ''
      + '<div id="__dbg_wrap" class="min">'
      + '  <div id="__dbg_bar"><b>Debug</b><span id="__dbg_status" style="opacity:.6"></span><button id="__dbg_toggle">Show</button></div>'
      + '  <div id="__dbg_log"></div>'
      + '</div>'
      + '<script>(function(){try{'
      + ' var wrap=document.getElementById("__dbg_wrap");'
      + ' var logEl=document.getElementById("__dbg_log");'
      + ' var btn=document.getElementById("__dbg_toggle");'
      + ' var statusEl=document.getElementById("__dbg_status");'
      + ' if(!wrap||!logEl||!btn){return;}'
      + ' btn.onclick=function(){ if(wrap.classList.contains("min")){ wrap.classList.remove("min"); btn.textContent="Hide"; } else { wrap.classList.add("min"); btn.textContent="Show"; } };'
      + ' function fmt(v){ try{ if(v===undefined) return "undefined"; if(v===null) return "null"; if(typeof v==="object") return JSON.stringify(v); return String(v); }catch(e){ return String(v); } }'
      + ' function add(level,args){ try{ var line=document.createElement("div"); line.className="ln "+level; var ts=new Date().toLocaleTimeString(); line.textContent="["+ts+"] ["+level.toUpperCase()+"] "+[].map.call(args,fmt).join(" "); logEl.appendChild(line); logEl.scrollTop=logEl.scrollHeight; statusEl.textContent="("+level+")"; }catch(_){ } }'
      + ' ["log","info","warn","error"].forEach(function(m){ var o=console[m]; console[m]=function(){ try{ add(m,arguments);}catch(_){ } try{ return o&&o.apply(console,arguments);}catch(e){ } }; });'
      + ' window.addEventListener("error",function(e){ add("error", [e.message || "error", e.filename+":"+e.lineno]);});'
      + ' window.__dbg = { add: add, el: logEl };'
      + '}catch(_){}})();</script>';
    return css + html;
  }catch(_){ return ''; }
}

// ----- Picking state mutators -----
function ensureProgressSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Progress');
  if (!sh){
    sh = ss.insertSheet('Progress');
    sh.getRange('A1').setValue('Status');
    sh.getRange('B1').setValue('PartID');
    sh.getRange('C1').setValue('FancyID');
    sh.getRange('D1').setValue('RecipeID');
    sh.getRange('E1').setValue('LastUpdate');
  }
  return sh;
}
function getPartsListFor_(recipeId){
  // Try Recipe first (推奨)。なければPartsのProductIDでフォールバック
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recipe = ss.getSheetByName('Recipe');
  if (recipe){
    const rv = recipe.getDataRange().getValues();
    if (rv.length>1){
      const H = rv[0].map(String);
      const prodCol = localGetHeaderIndex_(H, ['ProductID']);
      const useCol  = localGetHeaderIndex_(H, ['PartID']);
      const rows = rv.slice(1).filter(r => prodCol>=0 ? String(r[prodCol])===String(recipeId) : false);
      const ids = rows.map(r => String(useCol>=0 ? r[useCol] : (r[1]||''))).filter(Boolean);
      if (ids.length){ return ids; }
    }
  }
  // fallback: PartsからProductIDで抽出
  const parts = ss.getSheetByName('Parts') || ss.getSheetByName('部品') || ss.getSheetByName('Parts');
  if (!parts) return [];
  const pv = parts.getDataRange().getValues();
  if (pv.length < 2) return [];
  const H = pv[0].map(String);
  const prodCol = localGetHeaderIndex_(H, ['ProductID']);
  const partCol = localGetHeaderIndex_(H, ['PartID']);
  let rows = pv.slice(1).filter(r => prodCol<0 ? true : String(r[prodCol]) === String(recipeId));
  if (!rows.length) {
    try{ logInfo_('parts:list:fallbackAll', { recipeId }); }catch(_){ }
    rows = pv.slice(1);
  }
  return rows.map(r => String(partCol>=0 ? r[partCol] : r[0])).filter(Boolean);
}

// Override: support Japanese sheet/header names for recipe/parts
function getPartsListFor_(recipeId){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Prefer recipe sheet
  var recipe = findSheet_(['Recipe']);
  if (recipe){
    var rv = recipe.getDataRange().getValues();
    if (rv.length>1){
      var H = rv[0].map(String);
      var prodCol = localGetHeaderIndex_(H, ['ProductID']);
      var useCol  = localGetHeaderIndex_(H, ['PartID']);
      var rows = rv.slice(1).filter(function(r){ return prodCol>=0 ? String(r[prodCol])===String(recipeId) : false; });
      var ids = rows.map(function(r){ return String(useCol>=0 ? r[useCol] : (r[1]||'')); }).filter(Boolean);
      if (ids.length) return ids;
    }
  }
  // Fallback to parts list
  var parts = findSheet_(['Parts']);
  if (!parts) return [];
  var pv = parts.getDataRange().getValues();
  if (pv.length < 2) return [];
  var H = pv[0].map(String);
  var prodCol = localGetHeaderIndex_(H, ['ProductID']);
  var partCol = localGetHeaderIndex_(H, ['PartId']);
  var rows = pv.slice(1).filter(function(r){ return prodCol<0 ? true : String(r[prodCol]) === String(recipeId); });
  if (!rows.length) rows = pv.slice(1);
  return rows.map(function(r){ return String(partCol>=0 ? r[partCol] : r[0]); }).filter(Boolean);
}

// --- Overrides for Progress + picking flows (English/Japanese sheet+header support) ---
function _sheet_(names){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i=0;i<names.length;i++){
    try{ var sh = ss.getSheetByName(names[i]); if (sh) return sh; }catch(_){ }
  }
  return null;
}

function _progressSheet_(){
  var sh = _sheet_(['Progress']);
  if (!sh){
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sh = ss.insertSheet('Progress');
    sh.getRange('A1').setValue('Status');
    sh.getRange('B1').setValue('PartID');
    sh.getRange('C1').setValue('FancyID');
    sh.getRange('D1').setValue('RecipeID');
    sh.getRange('E1').setValue('LastUpdate');
  }
  return sh;
}

function startPickingWithProduct(id){
  var sh = _progressSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var products = _sheet_(['Products']);
  var recipeId = String(id);
  try{
    if (products){
      var mv = products.getDataRange().getValues();
      if (mv.length>1){
        var H = mv[0].map(String);
        var fancyIdx  = localGetHeaderIndex_(H, ['FancyID']);
        var recipeIdx = localGetHeaderIndex_(H, ['RecipeID']);
        var row = mv.slice(1).find(function(r){ return String(r[fancyIdx>=0?fancyIdx:0])===String(id); });
        if (row && recipeIdx>=0) recipeId = String(row[recipeIdx]||id);
      }
    }
  }catch(_){ }

  var list = getPartsListFor_(recipeId);
  var first = list.length ? list[0] : '';
  sh.getRange('A2').setValue('進行中');
  sh.getRange('C2').setValue(id);
  sh.getRange('D2').setValue(recipeId);
  if (first) sh.getRange('B2').setValue(first);
  sh.getRange('E2').setValue(new Date());

  // Update Products (ProgPartID/LastUpdate) if columns exist
  try{
    if (products){
      var mv = products.getDataRange().getValues();
      if (mv.length>1){
        var H = mv[0].map(String);
        var fancyIdx = localGetHeaderIndex_(H, ['FancyID']);
        var progIdx  = localGetHeaderIndex_(H, ['ProgPartID']);
        var tsIdx    = localGetHeaderIndex_(H, ['LastUpdate']);
        var rowIdx = 1 + mv.slice(1).findIndex(function(r){ return String(r[fancyIdx>=0?fancyIdx:0])===String(id); });
        if (rowIdx>0){
          if (progIdx>=0) products.getRange(rowIdx+1, progIdx+1).setValue(first||'');
          if (tsIdx>=0)   products.getRange(rowIdx+1, tsIdx+1).setValue(new Date());
        }
      }
    }
  }catch(_){ }
}

function nextPart(){
  var sh = _progressSheet_();
  var recipeId = String(sh.getRange('D2').getValue()||'');
  var cur = String(sh.getRange('B2').getValue()||'');
  var list = getPartsListFor_(recipeId);
  if (!list.length) return;
  var idx = Math.max(0, list.indexOf(cur));
  var next = list[Math.min(idx+1, list.length-1)];
  sh.getRange('B2').setValue(next);
  sh.getRange('E2').setValue(new Date());
}

function pausePicking(){
  var sh = _progressSheet_();
  sh.getRange('A2').setValue('一時停止');
  sh.getRange('E2').setValue(new Date());
}

// Final override: build snapshot from your actual sheets
function getPickingSnapshotFixed_(id){
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Products → name
  var products = _sheet_(['Products']);
  var name = '';
  try{
    if (products){
      var mv = products.getDataRange().getValues();
      if (mv.length>1){
        var H = mv[0].map(String);
        var fancyIdx = localGetHeaderIndex_(H, ['FancyID']);
        var nameIdx  = localGetHeaderIndex_(H, ['ProductName']);
        var row = mv.slice(1).find(function(r){ return String(r[fancyIdx>=0?fancyIdx:0])===String(id); });
        if (row) name = String(row[nameIdx>=0?nameIdx:1]||'');
      }
    }
  }catch(_){ }

  // Progress → current part and recipe
  var prog = _progressSheet_();
  var partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  var modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';

  // Part/Parts → details
  var parts = _sheet_(['Parts']);
  var partName='', qty='', img='';
  if (parts){
    var pv = parts.getDataRange().getValues();
    if (pv.length>1){
      var H = pv[0].map(String);
      var prodCol = localGetHeaderIndex_(H, ['ProductID']);
      var partCol = localGetHeaderIndex_(H, ['PartID']);
      var nameCol = localGetHeaderIndex_(H, ['PartName']);
      var imgCol  = localGetHeaderIndex_(H, ['ImageURL']);
      var qtyCol  = localGetHeaderIndex_(H, ['Qty']);
      var list = pv.slice(1).filter(function(x){ return prodCol>=0 ? String(x[prodCol]) === (modelId||id) : true; });
      if (!list.length) list = pv.slice(1);
      var hit  = list.find(function(x){ return partCol>=0 ? String(x[partCol])===partId : false; }) || list[0];
      if (hit){
        partName = nameCol>=0? String(hit[nameCol]||''):'';
        qty      = qtyCol>=0?  String(hit[qtyCol]||''):'';
        img      = imgCol>=0?  String(hit[imgCol]||''):'';
        if (!partId && partCol>=0) partId = String(hit[partCol]||'');
      }
    }
  }
  return { id:id, name:name, partId:partId, partName:partName, qty:qty, img:img };
}
function startPickingWithProduct(id){
  const sh = ensureProgressSheet_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // FancyID -> レシピID を Productsから解決
  let recipeId = '';
  try{
    const manage = ss.getSheetByName('Products');
    if (manage){
      const mv = manage.getDataRange().getValues();
      if (mv.length>1){
        const H = mv[0].map(String);
        const fancyIdx = localGetHeaderIndex_(H, ['FancyID']);
        const recipeIdx = localGetHeaderIndex_(H, ['RecipeID']);
        const row = mv.slice(1).find(r => String(r[fancyIdx>=0?fancyIdx:0]) === String(id));
        if (row && recipeIdx>=0) recipeId = String(row[recipeIdx]||'');
      }
    }
  }catch(_){ }
  if (!recipeId) recipeId = String(id); // 最低限のフォールバック

  const list = getPartsListFor_(recipeId);
  const first = list.length ? list[0] : '';
  sh.getRange('A2').setValue('進行中');
  sh.getRange('C2').setValue(id);
  sh.getRange('D2').setValue(recipeId);
  if (first) sh.getRange('B2').setValue(first);
  sh.getRange('E2').setValue(new Date());
  // Productsの進捗PartIDも同期
  try{
    const manage = ss.getSheetByName('Products');
    if (manage){
      const mv = manage.getDataRange().getValues();
      if (mv.length>1){
        const H = mv[0].map(String);
        const fancyIdx = localGetHeaderIndex_(H, ['FancyID']);
        const progIdx  = localGetHeaderIndex_(H, ['ProgPartID']);
        const tsIdx    = localGetHeaderIndex_(H, ['LastUpdate']);
        const rowIdx = 1 + mv.slice(1).findIndex(r => String(r[fancyIdx>=0?fancyIdx:0])===String(id));
        if (rowIdx>0){
          if (progIdx>=0) manage.getRange(rowIdx+1, progIdx+1).setValue(first||'');
          if (tsIdx>=0) manage.getRange(rowIdx+1, tsIdx+1).setValue(new Date());
        }
      }
    }
  }catch(_){ }
  try{ logInfo_('startPickingWithProduct', { id, recipeId, first }); }catch(_){ }
}
function nextPart(){
  const sh = ensureProgressSheet_();
  const recipeId = String(sh.getRange('D2').getValue()||'');
  const cur = String(sh.getRange('B2').getValue()||'');
  const list = getPartsListFor_(recipeId);
  if (!list.length) return;
  const idx = Math.max(0, list.indexOf(cur));
  const next = list[Math.min(idx+1, list.length-1)];
  sh.getRange('B2').setValue(next);
  sh.getRange('E2').setValue(new Date());
  try{ logInfo_('nextPart', { recipeId, from: cur, to: next, total: list.length }); }catch(_){ }
}
function pausePicking(){
  const sh = ensureProgressSheet_();
  sh.getRange('A2').setValue('中断');
  sh.getRange('E2').setValue(new Date());
  try{ logInfo_('pausePicking', { status: '中断' }); }catch(_){ }
}
function nextPartAndGetSnapshot(id){ if (typeof nextPart === 'function') nextPart(); return getPickingSnapshot_(id); }

// Header name resolver (active)
function localGetHeaderIndex_(headerRow, names){
  var norm = function(s){ return String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase(); };
  var arr = (headerRow||[]).map(norm);
  for (var i=0;i<names.length;i++){
    var idx = arr.indexOf(norm(names[i]));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Clean snapshot helper using sheet/header Japanese names
function getPickingSnapshotFixed_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 製品名（任意）
  const manageCandidates = ['Products'];
  let manage = null;
  for (var i=0;i<manageCandidates.length;i++){ manage = ss.getSheetByName(manageCandidates[i]); if (manage) break; }
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r = rows.find(function(x){ return String(x[0])===String(id); }); if (r) name = String(r[1]||'');

  // 進行シート
  const prog = ss.getSheetByName('Progress');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';

  // 部品一覧
  const partsCandidates = ['Parts'];
  let parts = null;
  for (var j=0;j<partsCandidates.length;j++){ parts = ss.getSheetByName(partsCandidates[j]); if (parts) break; }
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = localGetHeaderIndex_(H, ['ProductID']);
      const partCol = localGetHeaderIndex_(H, ['PartID']);
      const nameCol = localGetHeaderIndex_(H, ['PartName']);
      const imgCol  = localGetHeaderIndex_(H, ['ImageURL']);
      const qtyCol  = localGetHeaderIndex_(H, ['Qty']);
      let list = pv.slice(1).filter(function(x){ return prodCol>=0 ? String(x[prodCol]) === (modelId||id) : true; });
      if (!list.length) { list = pv.slice(1); }
      const hit  = list.find(function(x){ return partCol>=0 ? String(x[partCol])===partId : false; }) || list[0];
      if (hit){
        partName = nameCol>=0? String(hit[nameCol]||''):'';
        qty      = qtyCol>=0?  String(hit[qtyCol]||''):'';
        img      = imgCol>=0?  String(hit[imgCol]||''):'';
        if (!partId && partCol>=0) { try{ partId = String(hit[partCol]||''); logInfo_('snapshot:fillPartId', { from:'partsSheet', partId: partId }); }catch(_){ partId = String(hit[partCol]||''); }
        }
      }
    }
  }
  try{
    logInfo_('snapshot:calc', { id:id, modelId:modelId, partId:partId, partName:partName, qty:qty, hasImg: !!img });
  }catch(_){ }
  return { id:id, name:name, partId:partId, partName:partName, qty:qty, img:img };
}

// --- Override with robust Japanese/English sheet+header handling ---
// This redefinition takes precedence and fixes mojibake-related lookups.
function findSheet_(names){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i=0;i<names.length;i++){
    try{ var sh = ss.getSheetByName(names[i]); if (sh) return sh; }catch(_){ }
  }
  return null;
}

function getPickingSnapshotFixed_(id){
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Productsの候補
  var manage = findSheet_(['Products']);
  var name = '';
  try{
    if (manage){
      var mv = manage.getDataRange().getValues();
      if (mv.length>1){
        var H = mv[0].map(String);
        var idIdx   = localGetHeaderIndex_(H, ['FancyID']);
        var nameIdx = localGetHeaderIndex_(H, ['ProductName']);
        var row = mv.slice(1).find(function(r){ return String(r[idIdx>=0?idIdx:0])===String(id); });
        if (row) name = String(row[nameIdx>=0?nameIdx:1]||'');
      }
    }
  }catch(_){ }

  // 進捗シート候補（既存名も含めて探す）
  var prog = findSheet_(['Progress']);
  var partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  var modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';

  // Parts候補
  var parts = findSheet_(['Parts']);
  var partName='', qty='', img='';
  if (parts){
    var pv = parts.getDataRange().getValues();
    if (pv.length>1){
      var H = pv[0].map(String);
      var prodCol = localGetHeaderIndex_(H, ['ProductID']);
      var partCol = localGetHeaderIndex_(H, ['PartID']);
      var nameCol = localGetHeaderIndex_(H, ['PartName']);
      var imgCol  = localGetHeaderIndex_(H, ['ImageURL']);
      var qtyCol  = localGetHeaderIndex_(H, ['Qty']);
      var list = pv.slice(1).filter(function(x){ return prodCol>=0 ? String(x[prodCol]) === (modelId||id) : true; });
      if (!list.length) list = pv.slice(1);
      var hit  = list.find(function(x){ return partCol>=0 ? String(x[partCol])===partId : false; }) || list[0];
      if (hit){
        partName = nameCol>=0? String(hit[nameCol]||''):'';
        qty      = qtyCol>=0?  String(hit[qtyCol]||''):'';
        img      = imgCol>=0?  String(hit[imgCol]||''):'';
        if (!partId && partCol>=0) partId = String(hit[partCol]||'');
      }
    }
  }
  try{ logInfo_('snapshot:calc:v2', { id:id, modelId:modelId, partId:partId, partName:partName, qty:qty, hasImg: !!img }); }catch(_){ }
  return { id:id, name:name, partId:partId, partName:partName, qty:qty, img:img };
}
