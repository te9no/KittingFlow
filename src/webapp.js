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
        const candidates = ['製品管理','管理','Manage','Products'];
        let manage = null;
        for (var i=0;i<candidates.length;i++){ manage = ss.getSheetByName(candidates[i]); if(manage) break; }
        const rows = manage ? manage.getDataRange().getValues() : [];
        let items = [];
        if (rows.length>0){
          const H = (rows[0]||[]).map(String);
          const idIdx = localGetHeaderIndex_(H, ['製品ID','ProductId','product_id','ID','Id']);
          const nameIdx = localGetHeaderIndex_(H, ['製品名','Name','name']);
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
      const candidates = ['製品管理','管理','Manage','Products'];
      let manage = null;
      for (var i=0;i<candidates.length;i++){ manage = ss.getSheetByName(candidates[i]); if(manage) break; }
      const rows = manage ? manage.getDataRange().getValues() : [];
      // 先頭行をヘッダとみなす
      let items = [];
      if (rows.length>0){
        const H = (rows[0]||[]).map(String);
        const idIdx = localGetHeaderIndex_(H, ['製品ID','ProductId','product_id','ID','Id']);
        const nameIdx = localGetHeaderIndex_(H, ['製品名','Name','name']);
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
      let s = ss.getSheetByName('ピッキング進捗');
      if (!s){
        s = ss.insertSheet('ピッキング進捗');
        s.getRange('A1').setValue('ステータス');
        s.getRange('B1').setValue('部品ID');
        s.getRange('C1').setValue('製品ID');
        s.getRange('D1').setValue('製品モデルID');
      }
      s.getRange('C2').setValue(data.id);
      s.getRange('A2').setValue('進行中');
      // resolve model id
      const manage = ss.getSheetByName('製品管理');
      if (manage){
        const mv = manage.getDataRange().getValues();
        const idx = localGetHeaderIndex_(mv[0], ['レシピID','RecipeId','recipe_id']);
        const row = mv.slice(1).find(r => String(r[0]) === String(data.id));
        if (row && idx >= 0) s.getRange('D2').setValue(String(row[idx]||''));
      }
      // init part if needed
      const parts = ss.getSheetByName('部品リスト');
      if (parts){
        const pv = parts.getDataRange().getValues();
        if (pv.length>1){
          const H = pv[0].map(String);
          const prodCol = H.indexOf('製品ID');
          const partCol = H.indexOf('部品ID');
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
  h += '<input id="resumeId" placeholder="製品ID (MK-...)" style="width:100%;font-size:18px;padding:10px">';
  h += '<button onclick="(function(){var v=document.getElementById(\'resumeId\').value.trim(); if(!v){alert(\'製品IDを入力\');return;} try{ top.location.href=\''+base+'?id=\'+encodeURIComponent(v);}catch(e){ location.href=\''+base+'?id=\'+encodeURIComponent(v);} })()">▶ 再開</button>';
  h += '<script>try{ if (top !== self) top.location.href = location.href; }catch(e){}</script>';
  h += '<div class="note">ブックマークしてiPadホームに追加すると便利です。</div>';
  h += '</body></html>';
  return h;
}

function renderStart_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
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
  h += 'document.getElementById(\'go\').onclick=function(){var id=sel.value;if(!id){alert(\'製品IDを選択\');return;} google.script.run.withSuccessHandler(function(){ try{ top.location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(id);}catch(e){ location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(id);} }).startPickingWithProduct(id);};';
  h += '<script>try{ if (top !== self) top.location.href = location.href; }catch(e){}</script>';
  h += '</script></body></html>';
  return h;
}

function renderPick_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r=rows.find(function(x){return String(x[0])===String(id)}); if(r) name=String(r[1]||'');
  const prog = ss.getSheetByName('ピッキング進捗');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';
  const parts = ss.getSheetByName('部品リスト');
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = H.indexOf('製品ID');
      const partCol = H.indexOf('部品ID');
      const nameCol = H.indexOf('部品名');
      const imgCol  = H.indexOf('画像URL');
      const qtyCol  = H.indexOf('必要数');
      let list = pv.slice(1).filter(function(x){return String(x[prodCol]) === (modelId||id)});
      const hit  = list.find(function(x){return String(x[partCol])===partId}) || list[0];
      if (hit){ partName = nameCol>=0? String(hit[nameCol]||''):''; qty = qtyCol>=0? String(hit[qtyCol]||''):''; img = imgCol>=0? String(hit[imgCol]||''):''; }
    }
  }
  const base = ScriptApp.getService().getUrl();
  const data = JSON.stringify({id:id, name:name, partId:partId, partName:partName, qty:qty, img:img});
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px}';
  h += 'h2{margin:6px 0 14px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}.img{width:220px;height:220px;object-fit:contain;border:1px solid #eee;margin:8px auto;display:block}';
  h += 'button{width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ccc;background:#fff;font-size:18px}</style></head><body>';
  h += '<div id="app"></div><script>const v='+data+';';
  h += 'document.getElementById(\'app\').innerHTML="<h2>ピッキング</h2><div class=\\\"card\\\"><div><b>製品ID:</b> "+v.id+"</div><div><b>製品名:</b> "+(v.name||"")+"</div><div style=\\\"margin-top:8px;\\\"><b>部品:</b> "+(v.partId||"")+ (v.partName?" / "+v.partName:"")+ (v.qty?" / 必要数 "+v.qty:"")+"</div>"+(v.img?"<img class=img src=\\\""+v.img+"\\\">":"")+"<button id=next>次へ ▶</button><button id=pause>⏸ 中断</button><button id=label>🏷 ラベル印刷</button></div>";';
  h += 'document.getElementById(\'next\').onclick=function(){ if(!window.google||!google.script||!google.script.run){alert(\'実行環境エラー\');return;} google.script.run.withFailureHandler(function(e){alert(\'エラー: \'+(e&&e.message?e.message:e));}).withSuccessHandler(function(){location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(v.id)+\'&t=\'+Date.now();}).nextPart();};';
  h += 'document.getElementById(\'pause\').onclick=function(){ if(!window.google||!google.script||!google.script.run){alert(\'実行環境エラー\');return;} google.script.run.withFailureHandler(function(e){alert(\'エラー: \'+(e&&e.message?e.message:e));}).withSuccessHandler(function(){alert(\'中断しました\');}).pausePicking();};';
  h += 'document.getElementById(\'label\').onclick=function(){ location.href=\''+base+'?page=label&id=\'+encodeURIComponent(v.id); };';
  h += '</script></body></html>';
  return h;
}

function renderLabel_(id, size, margin, showName){
  const s = String(size||'40x30').split('x'); const w=Number(s[0]||40), h=Number(s[1]||30); const m=Number(margin||2); const sn = showName!=='0' && showName!=='false';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
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
  h += '<h3>製品ID: '+id+'</h3><button id="go">▶ 再開する</button><p id="msg"></p>';
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
  h += '<h3>IDが指定されていません</h3><p>'+title+'の対象となる製品IDを入力してください。</p><input id="pid" placeholder="製品ID (例: MK-...)" autofocus><button onclick="(function(){var v=document.getElementById(\'pid\').value.trim(); if(!v){alert(\'製品IDを入力してください\');return;} var base=\''+base+'\'; '+go+'; })()">続行</button><p style="margin-top:8px"><a href="'+base+'?page=menu">メニューに戻る</a></p>';
  h += '</body></html>';
  return h;
}

// ===== Active snapshot helpers =====
function getPickingSnapshot_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r = rows.find(function(x){ return String(x[0])===String(id); }); if (r) name = String(r[1]||'');
  const prog = ss.getSheetByName('ピッキング進行');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';
  const parts = ss.getSheetByName('部品リスト');
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = H.indexOf('製品ID');
      const partCol = H.indexOf('部品ID');
      const nameCol = H.indexOf('部品名');
      const imgCol  = H.indexOf('画像URL');
      const qtyCol  = H.indexOf('必要数');
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

// ----- Picking state mutators -----
function ensureProgressSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('ピッキング進行');
  if (!sh){
    sh = ss.insertSheet('ピッキング進行');
    sh.getRange('A1').setValue('ステータス');
    sh.getRange('B1').setValue('部品ID');
    sh.getRange('C1').setValue('製品ID');
    sh.getRange('D1').setValue('モデルID');
  }
  return sh;
}
function getPartsListFor_(modelId){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const parts = ss.getSheetByName('部品リスト') || ss.getSheetByName('部品') || ss.getSheetByName('Parts');
  if (!parts) return [];
  const pv = parts.getDataRange().getValues();
  if (pv.length < 2) return [];
  const H = pv[0].map(String);
  const prodCol = localGetHeaderIndex_(H, ['製品ID','ProductId','product_id']);
  const partCol = localGetHeaderIndex_(H, ['部品ID','PartId','part_id']);
  let rows = pv.slice(1).filter(r => prodCol<0 ? true : String(r[prodCol]) === String(modelId));
  if (!rows.length) {
    // Fallback: ignore model filter and take all rows
    try{ logInfo_('parts:list:fallbackAll', { modelId }); }catch(_){ }
    rows = pv.slice(1);
  }
  return rows.map(r => String(partCol>=0 ? r[partCol] : r[0])).filter(Boolean);
}
function startPickingWithProduct(id){
  const sh = ensureProgressSheet_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // モデルIDは製品IDと同一で扱う（必要なら管理シートから変換）
  let modelId = String(id);
  try{
    const manage = ss.getSheetByName('製品管理') || ss.getSheetByName('管理') || ss.getSheetByName('Manage') || ss.getSheetByName('Products');
    if (manage){
      const mv = manage.getDataRange().getValues();
      if (mv.length>1){
        const H = mv[0].map(String);
        const idIdx = 0; // 製品IDは1列目想定
        const modelIdx = localGetHeaderIndex_(H, ['レシピID','RecipeId','recipe_id','モデルID']);
        const row = mv.slice(1).find(r => String(r[idIdx]) === String(id));
        if (row && modelIdx>=0) modelId = String(row[modelIdx] || id);
      }
    }
  }catch(_){ }
  const list = getPartsListFor_(modelId);
  const first = list.length ? list[0] : '';
  sh.getRange('A2').setValue('開始');
  sh.getRange('C2').setValue(id);
  sh.getRange('D2').setValue(modelId);
  if (first) sh.getRange('B2').setValue(first);
  try{ logInfo_('startPickingWithProduct', { id, modelId, first }); }catch(_){ }
}
function nextPart(){
  const sh = ensureProgressSheet_();
  const modelId = String(sh.getRange('D2').getValue()||sh.getRange('C2').getValue()||'');
  const cur = String(sh.getRange('B2').getValue()||'');
  const list = getPartsListFor_(modelId);
  if (!list.length) return;
  const idx = Math.max(0, list.indexOf(cur));
  const next = list[Math.min(idx+1, list.length-1)];
  sh.getRange('B2').setValue(next);
  try{ logInfo_('nextPart', { modelId, from: cur, to: next, total: list.length }); }catch(_){ }
}
function pausePicking(){
  const sh = ensureProgressSheet_();
  sh.getRange('A2').setValue('中断');
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
  const manageCandidates = ['製品管理','管理','Manage','Products'];
  let manage = null;
  for (var i=0;i<manageCandidates.length;i++){ manage = ss.getSheetByName(manageCandidates[i]); if (manage) break; }
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r = rows.find(function(x){ return String(x[0])===String(id); }); if (r) name = String(r[1]||'');

  // 進行シート
  const prog = ss.getSheetByName('ピッキング進行');
  let partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
  const modelId = prog ? String(prog.getRange('D2').getValue()||'') : '';

  // 部品一覧
  const partsCandidates = ['部品リスト','部品','Parts'];
  let parts = null;
  for (var j=0;j<partsCandidates.length;j++){ parts = ss.getSheetByName(partsCandidates[j]); if (parts) break; }
  var partName='', qty='', img='';
  if (parts){
    const pv = parts.getDataRange().getValues();
    if (pv.length>1){
      const H = pv[0].map(String);
      const prodCol = localGetHeaderIndex_(H, ['製品ID','ProductId','product_id']);
      const partCol = localGetHeaderIndex_(H, ['部品ID','PartId','part_id']);
      const nameCol = localGetHeaderIndex_(H, ['部品名','Name','name']);
      const imgCol  = localGetHeaderIndex_(H, ['画像URL','Image','image','img']);
      const qtyCol  = localGetHeaderIndex_(H, ['必要数','Qty','quantity']);
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
