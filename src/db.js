import Dexie from 'dexie';

export let db;

function defineDB() {
  db = new Dexie('kittingflow_local');
  db.version(3).stores({
    parts: 'id,name,stock,imageUrl',
    recipes: '++id,productId,partId,qty,productName',
    products: 'id,name,internalId,status',
    progress: 'productId'
  });
  return db.open();
}

export async function initDB() {
  try {
    await defineDB();
  } catch (e) {
    if (e.name === 'UpgradeError') {
      await Dexie.delete('kittingflow_local');
      await defineDB();
    } else throw e;
  }
}

export async function initSampleDataIfEmpty() {
  if (!db?.isOpen()) await initDB();
  const count = await db.parts.count();
  if (count === 0) {
    await db.transaction('rw', db.parts, db.products, db.recipes, db.progress, async () => {
      await db.parts.bulkAdd([
        { id: 'PCB001', name: 'PCB Board A', stock: 50 },
        { id: 'PCB002', name: 'PCB Board B', stock: 40 }
      ]);
      await db.products.bulkAdd([
        { id: 'MK-Delhi-Deer-SM63', name: 'TB', internalId: 'P001', status: 'active' }
      ]);
      await db.recipes.bulkAdd([
        { productId: 'P001', productName: 'PCB', partId: 'PCB001', qty: 1 },
        { productId: 'P001', productName: 'PCB', partId: 'PCB002', qty: 1 }
      ]);
      await db.progress.put({ productId: 'MK-Delhi-Deer-SM63', state: '準備中', currentIndex: 0 });
    });
  }
}

export async function findInternalId(fancyId) {
  if (!db?.isOpen()) await initDB();
  const p = await db.products.get(fancyId);
  return p?.internalId || fancyId;
}
export async function findFancyId(internalId) {
  if (!db?.isOpen()) await initDB();
  const list = await db.products.toArray();
  const f = list.find(p => p.internalId === internalId);
  return f?.id || internalId;
}

export async function getPartsForProduct(productId) {
  if (!db?.isOpen()) await initDB();
  const internal = await findInternalId(productId);
  const [recipes, parts] = await Promise.all([
    db.recipes.where({ productId: internal }).toArray(),
    db.parts.toArray()
  ]);
  const map = Object.fromEntries(parts.map(p => [p.id, p]));
  return recipes.map(r => ({
    id: r.id,
    partId: r.partId,
    productId: internal,
    qty: Number(r.qty),
    name: map[r.partId]?.name ?? r.partId,
    stock: Number(map[r.partId]?.stock ?? 0),
    imageUrl: map[r.partId]?.imageUrl ?? ''
  }));
}

export async function getProgress(productId) {
  if (!db?.isOpen()) await initDB();
  const pr = await db.progress.get(productId);
  return pr || { productId, state: '準備中', currentIndex: 0 };
}

export async function setProgress(productId, patch) {
  if (!db?.isOpen()) await initDB();
  const cur = await getProgress(productId);
  await db.progress.put({ ...cur, ...patch, productId });
}
