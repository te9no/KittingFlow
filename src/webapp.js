// Mobile Web App (menu, start, pick, label, resume)

function doGet(e){
  const p = (e && e.parameter) || {};
  const page = String(p.page || '').toLowerCase();
  if (!page || page === 'menu') return HtmlService.createHtmlOutput(renderMenu_());
  if (page === 'start') return HtmlService.createHtmlOutput(renderStart_());
  if (page === 'pick')  return HtmlService.createHtmlOutput(p.id ? renderPick_(p.id) : renderMissingId_('pick'));
  if (page === 'label') return HtmlService.createHtmlOutput(p.id ? renderLabel_(p.id, p.size, p.margin, p.name) : renderMissingId_('label'));
  if (typeof p.id !== 'undefined') return HtmlService.createHtmlOutput(p.id ? renderResume_(p.id) : renderMissingId_('resume'));
  return HtmlService.createHtmlOutput(renderMenu_());
}

function doPost(e){
  try{
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // shared token check (optional). Set Script Properties: API_TOKEN
    const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (expected && String(data.token || '') !== String(expected)) {
      return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const action = String(data.action || '').toLowerCase();
    if (action === 'snapshot'){
      const snap = getPickingSnapshot_(data.id);
      return ContentService.createTextOutput(JSON.stringify({ ok:true, data:snap }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'next'){
      if (typeof nextPart === 'function') nextPart();
      const snap = getPickingSnapshot_(data.id);
      return ContentService.createTextOutput(JSON.stringify({ ok:true, data:snap }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'pause'){
      if (typeof pausePicking === 'function') pausePicking();
      return ContentService.createTextOutput(JSON.stringify({ ok:true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'start'){
      if (typeof startPickingWithProduct === 'function') startPickingWithProduct(data.id);
      const snap = getPickingSnapshot_(data.id);
      return ContentService.createTextOutput(JSON.stringify({ ok:true, data:snap }))
        .setMimeType(ContentService.MimeType.JSON);
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
          const list = pv.slice(1).filter(r => String(r[prodCol]) === key);
          const cur = String(s.getRange('B2').getValue()||'');
          const exists = cur && list.some(r => String(r[partCol]) === cur);
          if (!exists && list.length) s.getRange('B2').setValue(String(list[0][partCol]));
        }
      }
      if (typeof updateManageProgress_ === 'function'){
        const cur = String(s.getRange('B2').getValue()||'');
        updateManageProgress_(data.id, cur, '進行中');
      }
      const snap = getPickingSnapshot_(data.id);
      return ContentService.createTextOutput(JSON.stringify({ ok:true, data:snap }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ ok:false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'bad request' }))
    .setMimeType(ContentService.MimeType.JSON);
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
  const partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
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
      const list = pv.slice(1).filter(function(x){return String(x[prodCol]) === (modelId||id)});
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
// Mobile Web App (menu, start, pick, label, resume)

function doGet(e){
  const p = (e && e.parameter) || {};
  const page = String(p.page || '').toLowerCase();
  if (!page || page === 'menu') return HtmlService.createHtmlOutput(renderMenu_());
  if (page === 'start') return HtmlService.createHtmlOutput(renderStart_());
  if (page === 'pick')  return HtmlService.createHtmlOutput(p.id ? renderPick_(p.id) : renderMissingId_('pick'));
  if (page === 'label') return HtmlService.createHtmlOutput(p.id ? renderLabel_(p.id, p.size, p.margin, p.name) : renderMissingId_('label'));
  if (typeof p.id !== 'undefined') return HtmlService.createHtmlOutput(p.id ? renderResume_(p.id) : renderMissingId_('resume'));
  return HtmlService.createHtmlOutput(renderMenu_());
}

function doPost(e){
  try{
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'resume'){
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
      // resolve model id (レシピID)
      const manage = ss.getSheetByName('製品管理');
      if (manage){
        const mv = manage.getDataRange().getValues();
        const idx = localGetHeaderIndex_(mv[0], ['レシピID']);
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
          const list = pv.slice(1).filter(r => String(r[prodCol]) === key);
          const cur = String(s.getRange('B2').getValue()||'');
          const exists = cur && list.some(r => String(r[partCol]) === cur);
          if (!exists && list.length) s.getRange('B2').setValue(String(list[0][partCol]));
        }
      }
      if (typeof updateManageProgress_ === 'function'){
        const cur = String(s.getRange('B2').getValue()||'');
        updateManageProgress_(data.id, cur, '進行中');
      }
      return ContentService.createTextOutput('再開しました: '+data.id);
    }
  }catch(err){
    return ContentService.createTextOutput('エラー: '+err.message);
  }
  return ContentService.createTextOutput('不正な操作');
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
  h += '<a class="btn" href="'+base+'?page=start">📦 ピッキング開始</a>';
  h += '<a class="btn" href="'+base+'?page=label">🏷 ラベル印刷</a>';
  h += '<div class="btn" onclick="var id=prompt(\'製品IDを入力\'); if(id) location.href=\''+base+'?id=\'+encodeURIComponent(id)">▶ QR再開（手入力）</div>';
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
  h += 'document.getElementById(\'go\').onclick=function(){var id=sel.value;if(!id){alert(\'製品IDを選択\');return;} google.script.run.withSuccessHandler(function(){location.href=\''+base+'?page=pick&id=\'+encodeURIComponent(id);}).startPickingWithProduct(id);};';
  h += '</script></body></html>';
  return h;
}

function renderPick_(id){
  const snap = getPickingSnapshot_(id);
  const base = ScriptApp.getService().getUrl();
  const data = JSON.stringify(snap);
  var h='';
  h += '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  h += '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif;margin:16px}';
  h += 'h2{margin:6px 0 14px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}.img{width:220px;height:220px;object-fit:contain;border:1px solid #eee;margin:8px auto;display:block}';
  h += 'button{width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ccc;background:#fff;font-size:18px}</style></head><body>';
  h += '<h2>ピッキング</h2><div class="card">';
  h += '<div><b>製品ID:</b> <span id="pid"></span></div>';
  h += '<div><b>製品名:</b> <span id="pname"></span></div>';
  h += '<div style="margin-top:8px;"><b>部品:</b> <span id="partline"></span></div>';
  h += '<img id="pimg" class="img" style="display:none">';
  h += '<button id="next">次へ ▶</button><button id="pause">⏸ 中断</button><button id="label">🏷 ラベル印刷</button>';
  h += '</div><script>const v='+data+';';
  h += 'function setView(x){document.getElementById("pid").textContent=x.id;document.getElementById("pname").textContent=x.name||"";var line=(x.partId||"")+(x.partName?" / "+x.partName:"")+(x.qty?" / 必要数 "+x.qty:"");document.getElementById("partline").textContent=line;var img=document.getElementById("pimg");if(x.img){img.src=x.img;img.style.display="block";}else{img.style.display="none";}}';
  h += 'setView(v);';
  h += 'document.getElementById("next").onclick=function(){ if(!window.google||!google.script||!google.script.run){alert("実行環境エラー");return;} google.script.run.withFailureHandler(function(e){alert("エラー: "+(e&&e.message?e.message:e));}).withSuccessHandler(function(nx){ setView(nx); }).nextPartAndGetSnapshot(v.id); };';
  h += 'document.getElementById("pause").onclick=function(){ if(!window.google||!google.script||!google.script.run){alert("実行環境エラー");return;} google.script.run.withFailureHandler(function(e){alert("エラー: "+(e&&e.message?e.message:e));}).withSuccessHandler(function(){alert("中断しました");}).pausePicking(); };';
  h += 'document.getElementById("label").onclick=function(){ try{ top.location.href="'+base+'?page=label&id="+encodeURIComponent(v.id);}catch(e){ location.href="'+base+'?page=label&id="+encodeURIComponent(v.id);} };';
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
  h += '<h3>IDが指定されていません</h3><p>'+title+'の対象となる製品IDを入力してください。</p><input id="pid" placeholder="製品ID (例: MK-...)" autofocus><button onclick="(function(){var v=document.getElementById(\'pid\').value.trim(); if(!v){alert(\'製品IDを入力してください\');return;} var base=\''+base+'\'; try{ top.location.href = base + (\'?page='+ (next==='label'?'label':'pick') +'&id=\'+encodeURIComponent(v)); }catch(e){ location.href = base + (\'?page='+ (next==='label'?'label':'pick') +'&id=\'+encodeURIComponent(v)); } })()">続行</button><p style="margin-top:8px"><a target="_top" href="'+base+'?page=menu">メニューに戻る</a></p>';
  h += '</body></html>';
  return h;
}

// ----- Helpers -----
function localGetHeaderIndex_(headerRow, names){
  const norm = function(s){ return String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase(); };
  const arr = headerRow.map(norm);
  for (var i=0;i<names.length;i++){
    var idx = arr.indexOf(norm(names[i]));
    if (idx >= 0) return idx;
  }
  return -1;
}


// Snapshot helpers for pick page
function getPickingSnapshot_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r=rows.find(x => String(x[0])===String(id)); if(r) name=String(r[1]||'');
  const prog = ss.getSheetByName('ピッキング進捗');
  const partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
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
      const list = pv.slice(1).filter(x => String(x[prodCol]) === (modelId||id));
      const hit  = list.find(x => String(x[partCol])===partId) || list[0];
      if (hit){ partName = nameCol>=0? String(hit[nameCol]||''):''; qty = qtyCol>=0? String(hit[qtyCol]||''):''; img = imgCol>=0? String(hit[imgCol]||''):''; }
    }
  }
  return { id, name, partId, partName, qty, img };
}
function nextPartAndGetSnapshot(id){ if (typeof nextPart === 'function') nextPart(); return getPickingSnapshot_(id); }



// ----- Snapshot helpers (avoid navigation) -----
function getPickingSnapshot_(id){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manage = ss.getSheetByName('製品管理');
  const rows = manage ? manage.getDataRange().getValues() : [];
  var name=''; var r = rows.find(x => String(x[0])===String(id)); if (r) name = String(r[1]||'');
  const prog = ss.getSheetByName('ピッキング進捗');
  const partId = prog ? String(prog.getRange('B2').getValue()||'') : '';
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
      const list = pv.slice(1).filter(x => String(x[prodCol]) === (modelId||id));
      const hit  = list.find(x => String(x[partCol])===partId) || list[0];
      if (hit){ partName = nameCol>=0? String(hit[nameCol]||''):''; qty = qtyCol>=0? String(hit[qtyCol]||''):''; img = imgCol>=0? String(hit[imgCol]||''):''; }
    }
  }
  return { id:id, name:name, partId:partId, partName:partName, qty:qty, img:img };
}
function nextPartAndGetSnapshot(id){ if (typeof nextPart === 'function') nextPart(); return getPickingSnapshot_(id); }
