import Dexie from 'dexie';

export let db;

export const PROGRESS_STATE_READY = '準備中';
export const PROGRESS_STATE_DONE = '完了';

const CITY_NAMES = [
  'Tokyo',
  'Osaka',
  'Kyoto',
  'Nagoya',
  'Sapporo',
  'Fukuoka',
  'Kobe',
  'Sendai',
  'Yokohama',
  'Naha',
  'Kanazawa',
  'Hiroshima',
  'Kagoshima',
  'Hakodate',
  'Matsuyama',
  'Takayama',
  'Nikko',
  'Nara',
  'Kamakura',
  'Okayama',
  'Shizuoka',
  'Kumamoto',
  'Toyama',
  'Nagano',
  'Fukui',
  'Aomori',
  'Akita',
  'Miyazaki',
  'Oita',
  'Ishigaki',
  'Singapore',
  'Seoul',
  'Taipei',
  'Shanghai',
  'Bangkok',
  'Jakarta',
  'Sydney',
  'Melbourne',
  'Auckland',
  'Vancouver',
  'Seattle',
  'SanJose',
  'Denver',
  'Boston',
  'London',
  'Paris',
  'Lisbon',
  'Madrid',
  'Rome',
  'Vienna',
  'Prague',
  'Berlin',
  'Helsinki',
  'Dublin',
  'Zurich'
];

const ANIMAL_NAMES = [
  'Tiger',
  'Crane',
  'Fox',
  'Bear',
  'Eagle',
  'Koi',
  'Wolf',
  'Hawk',
  'Dolphin',
  'Rabbit',
  'Lion',
  'Panda',
  'Falcon',
  'Otter',
  'Swan',
  'Whale',
  'Giraffe',
  'Walrus',
  'Orca',
  'Pelican',
  'Osprey',
  'Heron',
  'Buffalo',
  'Bison',
  'Gazelle',
  'Panther',
  'Leopard',
  'Lynx',
  'Koala',
  'Kangaroo',
  'Wombat',
  'Seal',
  'Penguin',
  'Alpaca',
  'Mink',
  'Jaguar',
  'Coyote',
  'Moose',
  'Badger',
  'Beaver',
  'Sandpiper',
  'Egret',
  'Stork',
  'Phoenix'
];

function defaultProgress(productId) {
  return { productId, state: PROGRESS_STATE_READY, currentIndex: 0 };
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomCode(length = 4) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateUniqueFancyId(prefix = 'MK') {
  const city = randomChoice(CITY_NAMES);
  const animal = randomChoice(ANIMAL_NAMES);
  const code = randomCode(3);
  return `${prefix}-${city}-${animal}-${code}`;
}

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
      await db.progress.put(defaultProgress('MK-Delhi-Deer-SM63'));
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
  return pr || defaultProgress(productId);
}

export async function setProgress(productId, patch) {
  if (!db?.isOpen()) await initDB();
  const cur = await getProgress(productId);
  await db.progress.put({ ...cur, ...patch, productId });
}

export async function getProductsWithProgress() {
  if (!db?.isOpen()) await initDB();
  const [products, progresses] = await Promise.all([
    db.products.toArray(),
    db.progress.toArray()
  ]);
  const map = new Map(progresses.map(pr => [pr.productId, pr]));
  return products.map(product => ({
    ...product,
    progress: map.get(product.id) || defaultProgress(product.id)
  }));
}

export async function getProductTemplates() {
  if (!db?.isOpen()) await initDB();
  const [products, recipes] = await Promise.all([
    db.products.toArray(),
    db.recipes.toArray()
  ]);
  const templates = new Map();
  for (const product of products) {
    if (!product.internalId) continue;
    if (!templates.has(product.internalId)) {
      templates.set(product.internalId, { internalId: product.internalId, name: product.name || product.internalId });
    }
  }
  for (const recipe of recipes) {
    if (!templates.has(recipe.productId)) {
      templates.set(recipe.productId, { internalId: recipe.productId, name: recipe.productName || recipe.productId });
    }
  }
  return Array.from(templates.values());
}

export async function createProductInstance({ id, internalId, name }) {
  if (!internalId) throw new Error('テンプレートを選択してください');
  if (!db?.isOpen()) await initDB();

  let fancyId = (id || '').trim();
  let attempts = 0;

  while (!fancyId || (await db.products.get(fancyId))) {
    fancyId = generateUniqueFancyId();
    attempts += 1;
    if (attempts > 20) throw new Error('Fancy ID を生成できませんでした');
  }

  const templateProduct = await db.products.where('internalId').equals(internalId).first();
  const templateRecipe = await db.recipes.where('productId').equals(internalId).first();
  const templateName =
    name ||
    templateProduct?.name ||
    templateRecipe?.productName ||
    internalId;

  await db.transaction('rw', db.products, db.progress, async () => {
    await db.products.add({
      id: fancyId,
      name: templateName,
      internalId,
      status: 'active'
    });
    await db.progress.put(defaultProgress(fancyId));
  });

  return { id: fancyId, internalId, name: templateName };
}
