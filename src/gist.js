import { db } from "./db";

const GIST_FILES = {
  parts: "parts.json",
  recipes: "recipes.json",
  products: "products.json",
  progress: "progress.json"
};

async function fetchGist(gistId, token, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...options.headers
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

function ensureArray(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  throw new Error(`${key} のデータ形式が不正です`);
}

export async function loadDatasetFromGist(gistId, token) {
  const gist = await fetchGist(gistId, token);
  const files = gist.files || {};
  const parse = (name, key) => {
    const file = files[name];
    if (!file || !file.content) return [];
    try {
      return ensureArray(JSON.parse(file.content), key);
    } catch (e) {
      throw new Error(`${name} のJSON解析に失敗しました: ${e.message}`);
    }
  };
  return {
    parts: parse(GIST_FILES.parts, "parts"),
    recipes: parse(GIST_FILES.recipes, "recipes"),
    products: parse(GIST_FILES.products, "products"),
    progress: parse(GIST_FILES.progress, "progress")
  };
}

export async function saveDatasetToGist(gistId, token, dataset) {
  if (!token) throw new Error("Gistへ書き込むにはGitHubトークンが必要です");
  const files = {};
  for (const [key, filename] of Object.entries(GIST_FILES)) {
    const payload = JSON.stringify(dataset[key] ?? [], null, 2);
    files[filename] = { content: payload };
  }
  await fetchGist(gistId, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
}

export async function applyDatasetToDB(dataset) {
  const { parts = [], recipes = [], products = [], progress = [] } = dataset;
  await db.transaction("rw", db.parts, db.recipes, db.products, db.progress, async () => {
    await db.parts.clear();
    await db.recipes.clear();
    await db.products.clear();
    await db.progress.clear();
    if (parts.length) await db.parts.bulkAdd(parts);
    if (recipes.length) await db.recipes.bulkAdd(recipes);
    if (products.length) await db.products.bulkAdd(products);
    for (const item of progress) {
      if (item?.productId) {
        await db.progress.put(item);
      }
    }
  });
}

export async function collectDatasetFromDB() {
  const [parts, recipes, products, progress] = await Promise.all([
    db.parts.toArray(),
    db.recipes.toArray(),
    db.products.toArray(),
    db.progress.toArray()
  ]);
  return { parts, recipes, products, progress };
}
