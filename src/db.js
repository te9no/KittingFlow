import Dexie from 'dexie';

export const db = new Dexie('kittingflow_local');
db.version(1).stores({
  parts: 'id,name',
  progress: 'key',
  settings: 'key'
});

export async function initSampleDataIfEmpty() {
  const count = await db.parts.count();
  if (count === 0) {
    await db.transaction('rw', db.parts, db.progress, db.settings, async () => {
      await db.parts.bulkAdd([
        { id: 'P001', name: 'MX Switch', qty: 60, stock: 500, imageUrl: '' },
        { id: 'P002', name: 'Diode 1N4148', qty: 60, stock: 1000, imageUrl: '' },
        { id: 'P003', name: 'TRRS Jack', qty: 2, stock: 120, imageUrl: '' }
      ]);
      await db.progress.bulkPut([
        { key: 'state', value: '準備中' },
        { key: 'currentIndex', value: 0 },
        { key: 'productId', value: 'MK-Local-0001' }
      ]);
      await db.settings.bulkPut([
        { key: 'alertThreshold', value: 5 },
        { key: 'labelPrefix', value: 'MK-' }
      ]);
    });
  }
}

export async function getProgress() {
  const [state, currentIndex, productId] = await Promise.all([
    db.progress.get('state'),
    db.progress.get('currentIndex'),
    db.progress.get('productId')
  ]);
  return {
    state: state?.value ?? '準備中',
    currentIndex: Number(currentIndex?.value ?? 0),
    productId: productId?.value ?? 'MK-Local-0001'
  };
}

export async function setProgress(p) {
  await db.transaction('rw', db.progress, async () => {
    if (p.state !== undefined) await db.progress.put({ key: 'state', value: p.state });
    if (p.currentIndex !== undefined) await db.progress.put({ key: 'currentIndex', value: p.currentIndex });
    if (p.productId !== undefined) await db.progress.put({ key: 'productId', value: p.productId });
  });
}
