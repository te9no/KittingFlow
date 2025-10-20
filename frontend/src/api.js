const GAS_URL = import.meta.env.VITE_GAS_URL || "";

function ensureGasUrl() {
  if (!GAS_URL) {
    throw new Error("VITE_GAS_URL is not configured.");
  }
  return GAS_URL;
}

function buildFormBody(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  });
  return params;
}

export async function verifyAndResume(idToken) {
  const res = await fetch(ensureGasUrl(), {
    method: "POST",
    body: buildFormBody({ action: "resume", id_token: idToken })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Verification failed");
  }
  return text;
}

export async function getParts() {
  const res = await fetch(`${ensureGasUrl()}?action=parts`);
  if (!res.ok) {
    throw new Error("Failed to load parts data.");
  }
  return await res.json();
}

export async function getProgress() {
  const res = await fetch(`${ensureGasUrl()}?action=progress`);
  if (!res.ok) {
    throw new Error("Failed to load progress data.");
  }
  return await res.json();
}

export async function updateProgress(nextPartId) {
  const res = await fetch(ensureGasUrl(), {
    method: "POST",
    body: buildFormBody({ action: "next", partId: nextPartId })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Failed to advance to next part");
  }
  return text;
}
