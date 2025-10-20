import Dexie from 'dexie';

export let db;

async function initDB() {
  try {
    db = new Dexie('kittingflow_local');
    db.version(2).stores({
      parts: 'id,name,stock,imageUrl',       // 主キー: id
      recipes: '++id,productId,partId,qty',  // 自動ID
      products: 'id,name,status',            // 主キー: id
      progress: 'productId'                  // 主キー: productId
    });
    await db.open();
  } catch (e) {
    if (e.name === 'UpgradeError') {
      console.warn('Detected old DB schema — resetting...');
      await Dexie.delete('kittingflow_local');
      // 再初期化
      db = new Dexie('kittingflow_local');
      db.version(2).stores({
        parts: 'id,name,stock,imageUrl',
        recipes: '++id,productId,partId,qty',
        products: 'id,name,status',
        progress: 'productId'
      });
      await db.open();
    } else {
      throw e;
    }
  }
}
await initDB();

// 初期サンプル投入（空のときのみ）
export async function initSampleDataIfEmpty() {
  const count = await db.parts.count();
  if (count === 0) {
    await db.transaction('rw', db.parts, db.recipes, db.products, db.progress, async () => {
      await db.parts.bulkAdd([
        { id: 'P001', name: 'MX Switch', stock: 500, imageUrl: '' },
        { id: 'P002', name: 'Diode 1N4148', stock: 1000, imageUrl: '' },
        { id: 'P003', name: 'TRRS Jack', stock: 120, imageUrl: '' }
      ]);
      await db.products.bulkAdd([
        { id: 'PRD-001', name: '60% Keyboard', status: 'active' }
      ]);
      await db.recipes.bulkAdd([
        { productId: 'PRD-001', partId: 'P001', qty: 60 },
        { productId: 'PRD-001', partId: 'P002', qty: 60 },
        { productId: 'PRD-001', partId: 'P003', qty: 2 }
      ]);
      await db.progress.put({ productId: 'PRD-001', state: '準備中', currentIndex: 0 });
    });
  }
}

// 進捗
export async function getProgress(productId) {
  const pr = await db.progress.get(productId);
  if (!pr) return { productId, state: '準備中', currentIndex: 0 };
  return { productId, state: pr.state ?? '準備中', currentIndex: Number(pr.currentIndex ?? 0) };
}
export async function setProgress(productId, patch) {
  const cur = await getProgress(productId);
  await db.progress.put({ ...cur, ...patch, productId });
}

// 製品の部品一覧（JOIN）
export async function getPartsForProduct(productId) {
  const [recipes, parts] = await Promise.all([
    db.recipes.where({ productId }).toArray(),
    db.parts.toArray()
  ]);
  const map = Object.fromEntries(parts.map(p => [p.id, p]));
  return recipes.map(r => ({
    id: r.id,
    productId: r.productId,
    partId: r.partId,
    qty: Number(r.qty),
    name: map[r.partId]?.name ?? r.partId,
    stock: Number(map[r.partId]?.stock ?? 0),
    imageUrl: map[r.partId]?.imageUrl ?? ''
  }));
}
