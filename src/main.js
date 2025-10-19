/**
 * Spreadsheet UI helpers (menu + quick actions).
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('KittingFlow')
    .addItem('Generate FancyID', 'uiGenerateId')
    .addItem('Print QR Label…', 'uiPrintLabel')
    .addSeparator()
    .addItem('Open Picking UI', 'uiOpenPickingPage')
    .addItem('Mark Picking Completed', 'uiCompletePicking')
    .addSeparator()
    .addItem('Show Current Snapshot', 'uiShowSnapshot')
    .addToUi();
}

function uiGenerateId() {
  const id = generateFancyId_();
  const cell = SpreadsheetApp.getActiveSheet().getActiveCell();
  cell.setValue(id);
  SpreadsheetApp.getUi().alert('FancyID を生成しました: ' + id);
}

function uiPrintLabel() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('QR ラベルを印刷する FancyID を入力してください。', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const id = cleanString_(response.getResponseText());
  if (!id) {
    ui.alert('FancyID が入力されていません。');
    return;
  }
  printPhomemoLabel(id);
}

function uiOpenPickingPage() {
  const url = ScriptApp.getService().getUrl();
  const content = url
    ? '<a href="' + url + '?page=start" target="_blank">ピッキング画面を開く</a>'
    : '<p>デプロイ済みの Web アプリ URL が取得できませんでした。</p>';
  openDialog_(content, 'KittingFlow', 320, 120);
}

function uiCompletePicking() {
  const progress = readProgressState_();
  if (!progress.fancyId) {
    SpreadsheetApp.getUi().alert('進行中のピッキングが見つかりません。');
    return;
  }

  try { delete loadProducts_._products; } catch (err) { /* noop */ }
  const timestamp = setProgressState_({
    status: STATUS.COMPLETED,
    fancyId: progress.fancyId,
    recipeId: progress.recipeId,
    partId: ''
  });

  const products = loadProducts_();
  const entry = products.map[progress.fancyId];
  if (entry) {
    updateProductState_(products, entry, {
      status: STATUS.COMPLETED,
      partId: '',
      lastUpdate: timestamp
    });
  }

  SpreadsheetApp.getUi().alert('ピッキングを完了に更新しました。');
}

function uiShowSnapshot() {
  const progress = readProgressState_();
  if (!progress.fancyId) {
    SpreadsheetApp.getUi().alert('進行中のピッキングがありません。');
    return;
  }
  try { delete loadProducts_._products; } catch (err) { /* noop */ }
  const snap = buildSnapshot_(null, progress.fancyId, progress.recipeId || progress.fancyId, progress.partId, null);
  const html = [
    '<div style="font-family:sans-serif;">',
    '<div><strong>FancyID:</strong> ' + snap.id + '</div>',
    '<div><strong>製品名:</strong> ' + (snap.name || '-') + '</div>',
    '<div><strong>部品ID:</strong> ' + (snap.partId || '-') + '</div>',
    '<div><strong>部品名:</strong> ' + (snap.partName || '-') + '</div>',
    '<div><strong>数量:</strong> ' + (snap.qty || '-') + '</div>',
    (snap.img ? '<div style="margin-top:8px;"><img src="' + snap.img + '" style="max-width:220px;max-height:220px;object-fit:contain;border:1px solid #eee;"></div>' : ''),
    '</div>'
  ].join('\n');
  openDialog_(html, '現在のステータス', 360, 420);
}

function generateFancyId_() {
  const now = new Date();
  return 'MK-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
}
