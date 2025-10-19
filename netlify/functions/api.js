// Minimal Netlify Function to proxy requests to Apps Script Web App
// Set env var GAS_ENDPOINT to your deployed Web App URL (ending with /exec)

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
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
      try {
        payload = JSON.parse(text);
      } catch {
        // JSONでない場合はテキストを error/data に反映
        payload = res.ok ? { ok: true, data: text } : { ok: false, error: text };
      }
    }
    if (typeof payload.ok === 'undefined') payload.ok = res.ok;
    // 常に200で返し、フロントは ok/stauts を見て処理（CORSやブラウザ差異を避ける）
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify({ status: res.status, ...payload }) };
  } catch (err) {
    // ここも200で返す（デバッグしやすいようにメッセージを含める）
    return json({ ok: false, error: String(err) });
  }
};

function corsHeaders(){
  const allow = process.env.ALLOW_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };
}
function json(obj, status=200){
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(obj) };
}
