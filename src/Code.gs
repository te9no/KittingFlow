/**
 * KittingFlow Backend (Google Apps Script)
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("KittingFlow Settings")
    .addItem("Open Settings", "openSettingsSidebar")
    .addToUi();
}

function openSettingsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("SettingsSidebar")
    .setTitle("KittingFlow Settings");
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  if (!sheet) {
    throw new Error("Settings sheet not found. Please create a sheet named 'Settings'.");
  }
  const rows = sheet.getDataRange().getValues();
  const settings = {};
  rows.forEach(row => {
    if (row[0]) {
      settings[row[0]] = row[1];
    }
  });
  return settings;
}

function saveSettings(obj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  if (!sheet) {
    throw new Error("Settings sheet not found. Please create a sheet named 'Settings'.");
  }
  const rows = sheet.getDataRange().getValues();
  const keys = rows.map(row => row[0]);
  Object.keys(obj).forEach(key => {
    const idx = keys.indexOf(key);
    if (idx >= 0) {
      sheet.getRange(idx + 1, 2).setValue(obj[key]);
    } else {
      sheet.appendRow([key, obj[key]]);
    }
  });
}

function _respond(body, mimeType) {
  const output = ContentService.createTextOutput(body);
  output.setMimeType(mimeType);
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "GET, POST");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return output;
}

function _txt(body) {
  return _respond(body, ContentService.MimeType.TEXT);
}

function _json(obj) {
  return _respond(JSON.stringify(obj), ContentService.MimeType.JSON);
}

function doOptions() {
  return _txt("");
}

function _parsePayload(e) {
  if (!e || !e.postData) return {};
  const { type, contents } = e.postData;
  if (type === "application/json") {
    try {
      return JSON.parse(contents || "{}");
    } catch (err) {
      return {};
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    const params = e.parameter || {};
    const payload = {};
    Object.keys(params).forEach(key => {
      payload[key] = params[key];
    });
    return payload;
  }
  try {
    return contents ? JSON.parse(contents) : {};
  } catch (err) {
    return {};
  }
}

function doPost(e) {
  const payload = _parsePayload(e);
  const action = payload.action;

  if (action === "resume" && payload.id_token) {
    const verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + payload.id_token;
    const res = UrlFetchApp.fetch(verifyUrl);
    const info = JSON.parse(res.getContentText());

    const settings = getSettings();
    const allowed = (settings.ALLOWED_USERS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (!allowed.includes(info.email)) {
      return _txt("Unauthorized user");
    }

    return _txt("認証成功: " + info.email);
  }

  if (action === "next" && payload.partId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Progress");
    sheet.getRange("B2").setValue(payload.partId);
    sheet.getRange("A2").setValue("進行中");
    return _txt("次の部品に進みました: " + payload.partId);
  }

  return _txt("invalid request");
}

function doGet(e) {
  const action = (e.parameter.action || "").toString();

  if (action === "parts") {
    return sendSheet("Parts");
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
  const rows = data.map(row => {
    const record = {};
    header.forEach((key, idx) => {
      record[key] = row[idx];
    });
    return record;
  });
  return _json(rows);
}

function sendProgress() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Progress");
  const values = sheet.getRange("A2:C2").getValues()[0];
  const [state, partId, productId] = values;
  return _json({
    状態: state,
    現在の部品ID: partId,
    製品ID: productId
  });
}
