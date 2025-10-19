// Minimal Netlify Function to proxy requests to Apps Script Web App
// Set env var GAS_ENDPOINT to your deployed Web App URL (ending with /exec)

const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

exports.handler = async (event) => {
  const t0 = Date.now();
  const reqId = getReqId(event);
  log('INFO', 'request:start', reqId, {
    method: event.httpMethod,
    path: event.path,
    ct: (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || undefined,
    bodyLen: (event.body && Buffer.byteLength(event.body, 'utf8')) || 0
  });
  if (event.httpMethod === 'OPTIONS') {
    const res = { statusCode: 200, headers: withResMeta(corsHeaders(), reqId, t0), body: '' };
    log('INFO', 'request:options', reqId, { ms: Date.now() - t0 });
    return res;
  }
  try {
    const endpoint = process.env.GAS_ENDPOINT;
    if (!endpoint) return json({ ok: false, error: 'Missing GAS_ENDPOINT' }, 500);
    // merge payload and attach shared token (do not leak this to client)
    let bodyObj = {};
    try { bodyObj = JSON.parse(event.body || '{}'); } catch (_) { bodyObj = {}; }
    if (process.env.API_TOKEN) bodyObj.token = process.env.API_TOKEN;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let payload;
    if (ct.includes('application/json')) {
      try {
        payload = await res.json();
      } catch {
        payload = { ok: false, error: 'invalid-json-from-gas' };
      }
    } else {
      const text = await res.text();
      // Treat any non-JSON response as error; include a small preview for debugging
      const looksHtml = /<!doctype html|<html/i.test(text) || ct.includes('text/html');
      payload = { ok: false, error: looksHtml ? 'html-from-gas' : 'non-json-from-gas', detail: text.slice(0, 4000) };
    }
    if (typeof payload.ok === 'undefined') payload.ok = res.ok;
    const out = { status: res.status, ...payload };
    log('INFO', 'request:done', reqId, {
      gasStatus: res.status,
      ok: !!payload.ok,
      ct,
      ms: Date.now() - t0,
      error: payload.ok ? undefined : (payload.error || undefined)
    });
    // Always return 200; front checks ok/status to handle errors uniformly
    return { statusCode: 200, headers: withResMeta({ 'Content-Type': 'application/json', ...corsHeaders() }, reqId, t0), body: JSON.stringify(out) };
  } catch (err) {
    log('ERROR', 'request:catch', reqId, { ms: Date.now() - t0, error: String(err) });
    // Return 200 with error payload to ease CORS/debug handling
    return { statusCode: 200, headers: withResMeta({ 'Content-Type': 'application/json', ...corsHeaders() }, reqId, t0), body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};

function corsHeaders() {
  const allow = process.env.ALLOW_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };
}
function json(obj, status = 200) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(obj) };
}

function getReqId(event){
  const hdr = (event && event.headers) || {};
  return hdr['x-nf-request-id'] || hdr['X-NF-Request-ID'] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
function withResMeta(headers, reqId, t0){
  return { ...headers, 'X-Request-Id': reqId, 'X-Handler-Time': String(Date.now() - t0) };
}
function log(level, tag, reqId, meta){
  try{
    const base = { level, tag, reqId, ts: new Date().toISOString() };
    // Avoid logging secrets
    const safe = { ...meta };
    if (safe.token) safe.token = '***';
    console.log(JSON.stringify({ ...base, ...safe }));
  }catch(e){ /* noop */ }
}
