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
    const text = await res.text();
    // GAS might return text/plain; pass through as JSON where possible
    let body = text;
    let headers = { 'Content-Type': 'application/json', ...corsHeaders() };
    try { JSON.parse(text); } catch (_) { body = JSON.stringify({ ok: res.ok, data: text }); }
    return { statusCode: res.ok ? 200 : 500, headers, body };
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
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
