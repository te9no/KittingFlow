// Netlify 環境変数からGAS URLを読み込み（Site settings → Environment variables）
// 例: VITE_GAS_URL = https://script.google.com/macros/s/XXXXXX/exec
const GAS_URL = import.meta.env.VITE_GAS_URL;

export async function verifyAndResume(idToken) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resume", id_token: idToken })
  });
  return await res.text();
}

export async function getParts() {
  const res = await fetch(`${GAS_URL}?action=parts`);
  return await res.json();
}

export async function getProgress() {
  const res = await fetch(`${GAS_URL}?action=progress`);
  return await res.json();
}

export async function updateProgress(nextPartId) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "next", partId: nextPartId })
  });
  return await res.text();
}
