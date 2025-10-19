/**
 * KittingFlow Apps Script backend.
 * Provides a JSON API (list/start/snapshot/next/pause/resume) consumed via Netlify.
 *
 * The implementation expects the following Google Sheets:
 *  - Products: tracks FancyID / ProductName / Status / RecipeID / ProgPartID / LastUpdate
 *  - Recipe:   maps ProductID => ordered PartID list
 *  - Parts:    provides details for each PartID (name, qty, image, etc.)
 *  - Progress: single-row state (Status, PartID, FancyID, RecipeID, LastUpdate)
 */

const STATUS = {
  PICKING: 'PICKING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

const HEADER_KEYS = {
  fancyId: ['FancyID', 'ProductID', '製品ID', 'Fancy Id'],
  productName: ['ProductName', '製品名', 'Name'],
  status: ['Status', '状態'],
  recipeId: ['RecipeID', 'レシピID', 'ModelID'],
  progPartId: ['ProgPartID', 'ProgressPartID', 'CurrentPartID', '進行中部品ID'],
  lastUpdate: ['LastUpdate', '最終更新', '更新日時'],

  recipeProductId: ['ProductID', 'FancyID', '製品ID', 'ModelID'],
  recipePartId: ['PartID', '部品ID', 'パーツID'],

  partsProductId: ['ProductID', 'FancyID', '製品ID', 'ModelID'],
  partsPartId: ['PartID', '部品ID', 'パーツID'],
  partsName: ['PartName', '部品名', '名称'],
  partsQty: ['Qty', 'Quantity', '数量', '必要数', '個数'],
  partsImg: ['ImageURL', 'Image', '画像URL']
};

const SHEET_NAMES = {
  products: ['Products', '製品管理'],
  recipe: ['Recipe', 'レシピ'],
  parts: ['Parts', '部品表', 'パーツ'],
  progress: ['Progress', '進捗'],
  logs: ['Logs', 'ログ']
};

/**
 * Entry point for Netlify -> GAS JSON proxy.
 */
function doPost(e) {
  const ctx = createContext_(e);
  try {
    const token = ctx.sp.getProperty('API_TOKEN');
    if (token && String(ctx.request.token || '') !== String(token)) {
      ctx.log('WARN', 'auth:forbidden', { hasToken: !!ctx.request.token });
      return jsonResponse_(ctx, { ok: false, error: 'forbidden' });
    }

    const action = ctx.action;
    const fancyId = String(ctx.request.id || '').trim();

    switch (action) {
      case '':
      case 'list': {
        const items = handleList_(ctx);
        return jsonResponse_(ctx, { ok: true, data: items });
      }
      case 'start': {
        requireFancyId_(fancyId);
        const data = handleStart_(ctx, fancyId);
        return jsonResponse_(ctx, { ok: true, data: data });
      }
      case 'snapshot': {
        requireFancyId_(fancyId);
        const data = handleSnapshot_(ctx, fancyId);
        return jsonResponse_(ctx, { ok: true, data: data });
      }
      case 'next': {
        requireFancyId_(fancyId);
        const data = handleNext_(ctx, fancyId);
        return jsonResponse_(ctx, { ok: true, data: data });
      }
      case 'pause': {
        requireFancyId_(fancyId);
        handlePause_(ctx, fancyId);
        return jsonResponse_(ctx, { ok: true });
      }
      case 'resume': {
        requireFancyId_(fancyId);
        const data = handleResume_(ctx, fancyId);
        return jsonResponse_(ctx, { ok: true, data: data });
      }
      default:
        ctx.log('WARN', 'action:unknown', { action: action });
        return jsonResponse_(ctx, { ok: false, error: 'unknown-action' });
    }
  } catch (err) {
    ctx.log('ERROR', 'doPost:error', { message: err && err.message, stack: String(err && err.stack || '') });
    return jsonResponse_(ctx, { ok: false, error: err && err.message ? err.message : String(err || 'error') });
  }
}

/**
 * Helper to throw when FancyID is required.
 */
function requireFancyId_(id) {
  if (!id) throw new Error('missing-id');
}

/**
 * list: return FancyID/ProductName pairs.
 */
function handleList_(ctx) {
  const products = loadProducts_();
  const items = products.entries.map(function (entry) {
    return { id: entry.id, name: entry.name };
  });
  ctx.log('INFO', 'list:success', { count: items.length });
  return items;
}

/**
 * start: register picking progress and return first snapshot.
 */
function handleStart_(ctx, fancyId) {
  const products = loadProducts_();
  const product = products.map[fancyId] || null;
  const recipeId = product && product.recipeId ? product.recipeId : fancyId;
  const sequence = collectPartSequence_(ctx, recipeId);
  const firstPart = sequence.length ? sequence[0] : '';

  const timestamp = setProgressState_({
    status: STATUS.PICKING,
    fancyId: fancyId,
    recipeId: recipeId,
    partId: firstPart
  });

  if (product) {
    updateProductState_(products, product, {
      status: STATUS.PICKING,
      partId: firstPart,
      lastUpdate: timestamp
    });
  }

  ctx.log('INFO', 'start:updated', {
    id: fancyId,
    recipeId: recipeId,
    partId: firstPart,
    partCount: sequence.length
  });

  return buildSnapshot_(ctx, fancyId, recipeId, firstPart, product);
}

/**
 * snapshot: return current picking state.
 */
function handleSnapshot_(ctx, fancyId) {
  const progress = readProgressState_();
  const products = loadProducts_();
  const product = products.map[fancyId] || null;
  let recipeId = progress.recipeId || (product && product.recipeId) || fancyId;
  let partId = progress.partId;

  if (!partId) {
    const sequence = collectPartSequence_(ctx, recipeId);
    partId = sequence.length ? sequence[0] : '';
  }

  const snap = buildSnapshot_(ctx, fancyId, recipeId, partId, product);
  ctx.log('INFO', 'snapshot:success', {
    id: fancyId,
    recipeId: recipeId,
    partId: snap.partId,
    hasImage: !!snap.img
  });
  return snap;
}

/**
 * next: advance to the next part in the recipe.
 */
function handleNext_(ctx, fancyId) {
  const progress = readProgressState_();
  const products = loadProducts_();
  const product = products.map[fancyId] || null;
  const recipeId = progress.recipeId || (product && product.recipeId) || fancyId;
  const sequence = collectPartSequence_(ctx, recipeId);

  const currentId = progress.partId;
  const currentIdx = currentId ? sequence.findIndex(function (id) { return idsEqual_(id, currentId); }) : -1;
  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 0;

  var nextId = '';
  var status = STATUS.COMPLETED;
  if (sequence.length) {
    if (nextIdx < sequence.length) {
      nextId = sequence[nextIdx];
      status = STATUS.PICKING;
    }
  }

  const timestamp = setProgressState_({
    status: status,
    fancyId: fancyId,
    recipeId: recipeId,
    partId: nextId
  });

  if (product) {
    updateProductState_(products, product, {
      status: status,
      partId: nextId,
      lastUpdate: timestamp
    });
  }

  ctx.log('INFO', 'next:advanced', {
    id: fancyId,
    recipeId: recipeId,
    current: currentId || null,
    next: nextId || null,
    status: status,
    remaining: sequence.length ? Math.max(sequence.length - nextIdx - (status === STATUS.PICKING ? 0 : 1), 0) : 0
  });

  return buildSnapshot_(ctx, fancyId, recipeId, nextId, product);
}

/**
 * pause: set status to paused but keep current part.
 */
function handlePause_(ctx, fancyId) {
  const progress = readProgressState_();
  const products = loadProducts_();
  const product = products.map[fancyId] || null;
  const recipeId = progress.recipeId || (product && product.recipeId) || fancyId;
  const timestamp = setProgressState_({
    status: STATUS.PAUSED,
    fancyId: fancyId,
    recipeId: recipeId,
    partId: progress.partId
  });

  if (product) {
    updateProductState_(products, product, {
      status: STATUS.PAUSED,
      partId: progress.partId,
      lastUpdate: timestamp
    });
  }

  ctx.log('INFO', 'pause:set', { id: fancyId, recipeId: recipeId, partId: progress.partId || null });
}

/**
 * resume: mark status back to picking and return latest snapshot.
 */
function handleResume_(ctx, fancyId) {
  const progress = readProgressState_();
  const products = loadProducts_();
  const product = products.map[fancyId] || null;
  const recipeId = progress.recipeId || (product && product.recipeId) || fancyId;
  const timestamp = setProgressState_({
    status: STATUS.PICKING,
    fancyId: fancyId,
    recipeId: recipeId,
    partId: progress.partId
  });

  if (product) {
    updateProductState_(products, product, {
      status: STATUS.PICKING,
      partId: progress.partId,
      lastUpdate: timestamp
    });
  }

  ctx.log('INFO', 'resume:set', { id: fancyId, recipeId: recipeId, partId: progress.partId || null });
  return buildSnapshot_(ctx, fancyId, recipeId, progress.partId, product);
}

/**
 * Build snapshot payload using Products/Parts sheets.
 */
function buildSnapshot_(ctx, fancyId, recipeId, partId, product) {
  product = product || (loadProducts_().map[fancyId] || null);
  const partDetails = getPartDetails_(recipeId, partId);
  const snap = {
    id: fancyId,
    name: product ? product.name : '',
    partId: partDetails.id || (partId || ''),
    partName: partDetails.name || '',
    qty: partDetails.qty || '',
    img: partDetails.img || ''
  };
  if (snap.partId && !partId && ctx && typeof ctx.log === 'function') {
    ctx.log('INFO', 'snapshot:filledPartId', { id: fancyId, recipeId: recipeId, partId: snap.partId });
  }
  return snap;
}

/**
 * Read or create the Progress sheet and persist row-2 state.
 */
function setProgressState_(state) {
  const sheet = ensureProgressSheet_();
  const now = new Date();

  if (typeof state.status !== 'undefined') {
    sheet.getRange('A2').setValue(state.status || '');
  }
  if (typeof state.partId !== 'undefined') {
    sheet.getRange('B2').setValue(state.partId || '');
  }
  if (typeof state.fancyId !== 'undefined') {
    sheet.getRange('C2').setValue(state.fancyId || '');
  }
  if (typeof state.recipeId !== 'undefined') {
    sheet.getRange('D2').setValue(state.recipeId || '');
  }
  if (state.touchTimestamp !== false) {
    sheet.getRange('E2').setValue(now);
  }
  return now;
}

/**
 * Read current progress row.
 */
function readProgressState_() {
  const sheet = getSheet_(SHEET_NAMES.progress);
  if (!sheet) {
    return { status: '', partId: '', fancyId: '', recipeId: '', lastUpdate: null };
  }
  const values = sheet.getRange(2, 1, 1, 5).getValues();
  const row = values && values.length ? values[0] : [];
  return {
    status: String(row[0] || ''),
    partId: String(row[1] || '').trim(),
    fancyId: String(row[2] || '').trim(),
    recipeId: String(row[3] || '').trim(),
    lastUpdate: row[4] instanceof Date ? row[4] : null
  };
}

/**
 * Load product table (cached per invocation).
 */
function loadProducts_() {
  const cacheKey = '_products';
  if (loadProducts_[cacheKey]) return loadProducts_[cacheKey];

  const sheet = getSheet_(SHEET_NAMES.products);
  const result = {
    sheet: sheet,
    header: [],
    entries: [],
    map: {},
    indexes: {}
  };
  if (!sheet) {
    loadProducts_[cacheKey] = result;
    return result;
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    loadProducts_[cacheKey] = result;
    return result;
  }

  const header = values[0];
  const rows = values.slice(1);
  const idxFancy = getHeaderIndex_(header, HEADER_KEYS.fancyId);
  const idxName = getHeaderIndex_(header, HEADER_KEYS.productName);
  const idxStatus = getHeaderIndex_(header, HEADER_KEYS.status);
  const idxRecipe = getHeaderIndex_(header, HEADER_KEYS.recipeId);
  const idxProgPart = getHeaderIndex_(header, HEADER_KEYS.progPartId);
  const idxLastUpdate = getHeaderIndex_(header, HEADER_KEYS.lastUpdate);

  const entries = rows.map(function (row, i) {
    const id = idxFancy >= 0 ? cleanString_(row[idxFancy]) : cleanString_(row[0]);
    if (!id) return null;
    return {
      id: id,
      name: idxName >= 0 ? cleanString_(row[idxName]) : '',
      status: idxStatus >= 0 ? cleanString_(row[idxStatus]) : '',
      recipeId: idxRecipe >= 0 ? cleanString_(row[idxRecipe]) : '',
      progPartId: idxProgPart >= 0 ? cleanString_(row[idxProgPart]) : '',
      lastUpdate: idxLastUpdate >= 0 ? row[idxLastUpdate] : null,
      rowNumber: i + 2
    };
  }).filter(function (x) { return !!x; });

  const map = {};
  entries.forEach(function (entry) { map[entry.id] = entry; });

  result.header = header;
  result.entries = entries;
  result.map = map;
  result.indexes = {
    fancyId: idxFancy,
    productName: idxName,
    status: idxStatus,
    recipeId: idxRecipe,
    progPartId: idxProgPart,
    lastUpdate: idxLastUpdate
  };

  loadProducts_[cacheKey] = result;
  return result;
}

/**
 * Update products sheet row with latest status/part/timestamp.
 */
function updateProductState_(products, entry, updates) {
  if (!products.sheet || !entry) return;
  const idx = products.indexes;
  const sheet = products.sheet;
  const row = entry.rowNumber;

  if (typeof updates.status !== 'undefined' && idx.status >= 0) {
    sheet.getRange(row, idx.status + 1).setValue(updates.status || '');
  }
  if (typeof updates.partId !== 'undefined' && idx.progPartId >= 0) {
    sheet.getRange(row, idx.progPartId + 1).setValue(updates.partId || '');
  }
  const ts = typeof updates.lastUpdate !== 'undefined' ? updates.lastUpdate : new Date();
  if (idx.lastUpdate >= 0) {
    sheet.getRange(row, idx.lastUpdate + 1).setValue(ts);
  }
}

/**
 * Resolve ordered part IDs for recipe/product.
 */
function collectPartSequence_(ctx, recipeId) {
  const cleanId = cleanString_(recipeId);
  if (!cleanId) return [];

  // Try Recipe sheet first
  const recipeSheet = getSheet_(SHEET_NAMES.recipe);
  if (recipeSheet) {
    const values = recipeSheet.getDataRange().getValues();
    if (values.length > 1) {
      const header = values[0];
      const idxProduct = getHeaderIndex_(header, HEADER_KEYS.recipeProductId);
      const idxPart = getHeaderIndex_(header, HEADER_KEYS.recipePartId);
      if (idxPart >= 0) {
        const list = values.slice(1).filter(function (row) {
          if (idxProduct < 0) return true;
          return idsEqual_(row[idxProduct], cleanId);
        }).map(function (row) {
          return cleanString_(row[idxPart]);
        }).filter(Boolean);
        if (list.length) {
          ctx.log('INFO', 'parts:fromRecipe', { recipeId: cleanId, count: list.length });
          return list;
        }
      }
    }
  }

  // Fallback to Parts sheet
  const partsSheet = getSheet_(SHEET_NAMES.parts);
  if (!partsSheet) return [];
  const data = partsSheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data[0];
  const idxProduct = getHeaderIndex_(header, HEADER_KEYS.partsProductId);
  const idxPart = getHeaderIndex_(header, HEADER_KEYS.partsPartId);
  const list = data.slice(1).filter(function (row) {
    if (idxProduct < 0) return true;
    return idsEqual_(row[idxProduct], cleanId);
  }).map(function (row) {
    return idxPart >= 0 ? cleanString_(row[idxPart]) : cleanString_(row[0]);
  }).filter(Boolean);
  if (list.length) {
    ctx.log('INFO', 'parts:fromPartsSheet', { recipeId: cleanId, count: list.length });
  } else {
    ctx.log('WARN', 'parts:notFound', { recipeId: cleanId });
  }
  return list;
}

/**
 * Fetch detail for specific part ID.
 */
function getPartDetails_(recipeId, partId) {
  const sheet = getSheet_(SHEET_NAMES.parts);
  if (!sheet) {
    return { id: cleanString_(partId), name: '', qty: '', img: '' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { id: cleanString_(partId), name: '', qty: '', img: '' };
  }
  const header = data[0];
  const idxProduct = getHeaderIndex_(header, HEADER_KEYS.partsProductId);
  const idxPart = getHeaderIndex_(header, HEADER_KEYS.partsPartId);
  const idxName = getHeaderIndex_(header, HEADER_KEYS.partsName);
  const idxQty = getHeaderIndex_(header, HEADER_KEYS.partsQty);
  const idxImg = getHeaderIndex_(header, HEADER_KEYS.partsImg);

  const filtered = data.slice(1).filter(function (row) {
    if (!recipeId || idxProduct < 0) return true;
    return idsEqual_(row[idxProduct], recipeId);
  });

  var target = null;
  if (partId && idxPart >= 0) {
    target = filtered.find(function (row) { return idsEqual_(row[idxPart], partId); }) ||
      data.slice(1).find(function (row) { return idsEqual_(row[idxPart], partId); }) ||
      null;
  }
  if (!target) target = filtered.length ? filtered[0] : (data.length > 1 ? data[1] : null);
  if (!target) {
    return { id: cleanString_(partId), name: '', qty: '', img: '' };
  }

  return {
    id: idxPart >= 0 ? cleanString_(target[idxPart]) : cleanString_(partId),
    name: idxName >= 0 ? String(target[idxName] || '') : '',
    qty: idxQty >= 0 ? String(target[idxQty] || '') : '',
    img: idxImg >= 0 ? String(target[idxImg] || '') : ''
  };
}

/**
 * Create or fetch the Progress sheet object.
 */
function ensureProgressSheet_() {
  const sheet = getSheet_(SHEET_NAMES.progress);
  if (sheet) return sheet;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = ss.insertSheet('Progress');
  created.getRange(1, 1, 1, 5).setValues([['Status', 'PartID', 'FancyID', 'RecipeID', 'LastUpdate']]);
  return created;
}

/**
 * Wrapper around Script Properties + Logger for capturing debug info.
 */
function createContext_(e) {
  const raw = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '{}';
  let request = {};
  try {
    request = JSON.parse(raw);
  } catch (err) {
    request = {};
  }
  const action = String(request.action || '').trim().toLowerCase();
  const sp = PropertiesService.getScriptProperties();

  const debugFlag = isTruthy_(sp.getProperty('DEBUG_RESPONSE')) || isTruthy_(request.debug);
  const sheetLogEnabled = isTruthy_(sp.getProperty('ENABLE_SHEET_LOG'));
  const logSheetName = sp.getProperty('LOG_SHEET') || SHEET_NAMES.logs[0];

  // clear per-invocation caches
  try { delete loadProducts_._products; } catch (err) { /* noop */ }

  const ctx = {
    raw: raw,
    request: request,
    action: action,
    sp: sp,
    debug: debugFlag,
    logs: [],
    logSheet: sheetLogEnabled ? logSheetName : null
  };

  ctx.log = function (level, tag, meta) {
    const entry = {
      ts: new Date(),
      level: level || 'INFO',
      tag: tag || '',
      meta: meta || {}
    };
    const line = entry.ts.toISOString() + ' [' + entry.level + '] ' + entry.tag + ' ' + JSON.stringify(entry.meta);
    ctx.logs.push(line);
    try {
      Logger.log('[' + entry.level + '] ' + entry.tag + ' ' + JSON.stringify(entry.meta));
    } catch (err) {
      // ignore
    }
    if (ctx.logSheet) {
      appendSheetLog_(ctx.logSheet, entry);
    }
  };

  return ctx;
}

/**
 * Attach debug log (optional) and build JSON response.
 */
function jsonResponse_(ctx, payload) {
  const out = Object.assign({}, payload);
  if (ctx && ctx.debug) {
    out._debug = { log: ctx.logs.join('\n') };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Append a row to sheet-based log if enabled.
 */
function appendSheetLog_(sheetName, entry) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'Level', 'Tag', 'Meta']);
    }
    sheet.appendRow([entry.ts, entry.level, entry.tag, JSON.stringify(entry.meta || {})]);
  } catch (err) {
    Logger.log('[WARN] appendSheetLog failed: ' + err);
  }
}

/**
 * Resolve sheet by candidate names.
 */
function getSheet_(names) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const sheet = ss.getSheetByName(name);
      if (sheet) return sheet;
    } catch (err) {
      // ignore
    }
  }
  return null;
}

/**
 * Normalize header row search.
 */
function getHeaderIndex_(headerRow, candidates) {
  if (!headerRow || !headerRow.length) return -1;
  const normalized = headerRow.map(function (value) { return normalizeHeader_(value); });
  for (var i = 0; i < candidates.length; i++) {
    const target = normalizeHeader_(candidates[i]);
    const idx = normalized.indexOf(target);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function cleanString_(value) {
  return String(value || '').trim();
}

function idsEqual_(a, b) {
  return normalizeId_(a) === normalizeId_(b);
}

function normalizeId_(value) {
  return String(value || '').trim().toLowerCase();
}

function isTruthy_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
