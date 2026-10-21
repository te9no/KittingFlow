export function defineSchema(db) {
  const tables = {
    parts: 'id,name,stock,imageUrl,supplier',
    recipes: '++id,productId,partId,qty,productName',
    products: 'id,name,internalId,status,salePrice', progress: 'productId'
  };
  db.version(5).stores(tables);
  db.version(6).stores({ ...tables, apiRequests: '&key', apiMeta: '&key' });
  db.on('versionchange', () => db.close());
  return db;
}
export async function workspaceId(db) {
  return db.transaction('rw', db.apiMeta, async () => {
    let row = await db.apiMeta.get('workspace');
    if (!row) {
      row = { key: 'workspace', value: crypto.randomUUID() };
      await db.apiMeta.add(row);
    }
    return row.value;
  });
}
// Call inside the same transaction as a restore/import.
export async function resetApiWorkspace(db) {
  await db.apiRequests.clear();
  await db.apiMeta.put({ key: 'workspace', value: crypto.randomUUID() });
}
