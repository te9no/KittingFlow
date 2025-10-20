/* ----------------------------------------------------
 * 🧩 KittingFlow Backend (GAS Secure + GUI Settings)
 * ---------------------------------------------------- */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("⚙️ KittingFlow設定")
    .addItem("設定を開く", "openSettingsSidebar")
    .addToUi();
}

/* ===== Settings GUI ===== */
function openSettingsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("SettingsSidebar")
    .setTitle("KittingFlow 設定");
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("設定");
  if (!sheet) throw new Error("設定シートが見つかりません。作成してください。");
  const data = sheet.getDataRange().getValues();
  const settings = {};
  data.forEach(r => { if (r[0]) settings[r[0]] = r[1]; });
  return settings;
}

function saveSettings(obj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("設定");
  if (!sheet) throw new Error("設定シートが見つかりません。");
  const data = sheet.getDataRange().getValues();
  const keys = data.map(r => r[0]);
  Object.keys(obj).forEach(key => {
    const i = keys.indexOf(key);
    if (i >= 0) sheet.getRange(i+1, 2).setValue(obj[key]);
    else sheet.appendRow([key, obj[key]]);
  });
}

/* ===== CORS helper ===== */
function _txt(str) {
  return ContentService.createTextOutput(str)
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({ "Access-Control-Allow-Origin": "*" });
}
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({ "Access-Control-Allow-Origin": "*" });
}
function doOptions(e){ return _txt(""); }

/* ===== Auth + API ===== */
function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const action = payload.action;

  if (action === "resume" && payload.id_token) {
    const verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + payload.id_token;
    const res = UrlFetchApp.fetch(verifyUrl);
    const info = JSON.parse(res.getContentText());

    const settings = getSettings();
    const allowed = (settings.ALLOWED_USERS || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!allowed.includes(info.email)) return _txt("🚫 Unauthorized user");

    return _txt("✅ 認証成功: " + info.email);
  }

  if (action === "next") {
    const id = payload.partId;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ピッキング進行");
    sheet.getRange("B2").setValue(id);
    sheet.getRange("A2").setValue("🟢進行中");
    return _txt("➡️ 次の部品に進みました: " + id);
  }

  return _txt("❌ invalid request");
}

function doGet(e) {
  const action = (e.parameter.action || "").toString();

  if (action === "parts") {
    return sendSheet("部品リスト");
  }
  if (action === "progress") {
    return sendProgress();
  }
  if (action === "settings") {
    return _json(getSettings());
  }
  return HtmlService.createHtmlOutput("<h3>KittingFlow API</h3>");
}

function sendSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const data = sheet.getDataRange().getValues();
  const header = data.shift();
  const rows = data.map(r => Object.fromEntries(header.map((h,i)=>[h, r[i]])));
  return _json(rows);
}

function sendProgress() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ピッキング進行");
  const [state, part, product] = sheet.getRange("A2:C2").getValues()[0];
  return _json({ 状態: state, 現在の部品ID: part, 製品ID: product });
}
