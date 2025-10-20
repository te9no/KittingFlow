/** KittingFlow Backend (Google Apps Script) */

const SHEET_SETTINGS = "Settings";
const SHEET_PARTS = "Parts";
const SHEET_PROGRESS = "Progress";
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("KittingFlow Settings")
    .addItem("Open Settings", "openSettingsSidebar")
    .addToUi();
}

function openSettingsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("SettingsSidebar").setTitle("KittingFlow Settings");
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
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

function _allowOrigin() {
  return SCRIPT_PROPERTIES.getProperty("ALLOW_ORIGIN") || "*";
}

function _respond(body, mimeType) {
  const output = ContentService.createTextOutput(body);
  output.setMimeType(mimeType);
  output.setHeader("Access-Control-Allow-Origin", _allowOrigin());
  output.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
      console.error("Failed to parse JSON payload", err);
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
    console.error("Unsupported payload type", err);
    return {};
  }
}

function _verifyGoogleToken(idToken) {
  if (!idToken) {
    throw new Error("ID token missing");
  }
  const verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const res = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("Google token verification failed: " + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function _requireAllowedUser(email) {
  const settings = getSettings();
  const allowedList = (settings.ALLOWED_USERS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (!allowedList.length) {
    throw new Error("Allowed user list is empty. Update Settings sheet.");
  }
  if (!allowedList.includes(email)) {
    throw new Error("Unauthorized user: " + email);
  }
}

function doPost(e) {
  try {
    const payload = _parsePayload(e);
    const action = payload.action;

    if (action === "resume") {
      const info = _verifyGoogleToken(payload.id_token);
      _requireAllowedUser(info.email);
      return _txt("認証成功: " + info.email);
    }

    if (action === "next") {
      if (!payload.partId) {
        throw new Error("partId missing");
      }
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROGRESS);
      if (!sheet) {
        throw new Error("Progress sheet not found.");
      }
      sheet.getRange("B2").setValue(payload.partId);
      sheet.getRange("A2").setValue("進行中");
      return _txt("次の部品に進みました: " + payload.partId);
    }

    throw new Error("Unsupported action: " + action);
  } catch (err) {
    console.error(err);
    return _txt("ERROR: " + err.message);
  }
}

function doGet(e) {
  try {
    const action = (e.parameter.action || "").toString();

    if (action === "parts") {
      return sendSheet(SHEET_PARTS);
    }
    if (action === "progress") {
      return sendProgress();
    }
    if (action === "settings") {
      return _json(getSettings());
    }
    if (action === "health") {
      return _json(runSelfTest());
    }

    return HtmlService.createHtmlOutput("<h3>KittingFlow API</h3>");
  } catch (err) {
    console.error(err);
    return _txt("ERROR: " + err.message);
  }
}

function sendSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error("Sheet not found: " + name);
  }
  const data = sheet.getDataRange().getValues();
  if (!data.length) {
    return _json([]);
  }
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROGRESS);
  if (!sheet) {
    throw new Error("Progress sheet not found.");
  }
  const values = sheet.getRange("A2:C2").getValues();
  const [state, partId, productId] = values[0] || ["", "", ""];
  return _json({
    状態: state || "",
    現在の部品ID: partId || "",
    製品ID: productId || ""
  });
}

function runSelfTest() {
  const results = {
    allowOrigin: _allowOrigin(),
    sheets: {},
    settings: {},
    ok: true
  };

  try {
    results.sheets.settings = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS) ? "ok" : "missing";
    results.sheets.parts = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTS) ? "ok" : "missing";
    results.sheets.progress = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROGRESS) ? "ok" : "missing";

    if (results.sheets.settings === "ok") {
      results.settings = getSettings();
    }
    results.ok =
      results.sheets.settings === "ok" &&
      results.sheets.parts === "ok" &&
      results.sheets.progress === "ok";
  } catch (err) {
    results.ok = false;
    results.error = err.message;
  }

  return results;
}
