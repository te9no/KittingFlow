import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, workspaceId, resetApiWorkspace } from '../src/api/database.mjs';
import { executeCatalog } from '../src/api/catalog.mjs';

async function setup(t) {
  const db = defineSchema(new Dexie(crypto.randomUUID()));
  await db.open();
  t.after(() => db.delete());
  const context = { workspaceId: await workspaceId(db), sessionId: 'session-test' };
  const call = (tool, args = {}) => executeCatalog(db, tool, { ...context, ...args }, context.sessionId);
  return { db, context, call };
}
const bundle = () => ({ requestId: 'bundle-1', parts: [{ partId: 'A', name: 'センサー', stock: 10 }], template: { mode: 'new', templateId: 'T', name: '試作' }, lines: [{ partId: 'A', qty: 2 }] });

const emptyPrice = { purchaseAmount: 0, purchaseQuantity: 0, manualUnitPrice: null };
const priceEdit = () => ({ requestId: 'price-1', updates: [{ partId: 'A', expected: { ...emptyPrice }, prices: { purchaseAmount: 100, purchaseQuantity: 8, manualUnitPrice: null } }] });
test('price edits preview, commit and replay without changing inventory or recipes', async t => {
  const { db, call } = await setup(t);
  await call('kitting_create_bundle', bundle());
  const original = await db.parts.get('A');
  const preview = await call('kitting_update_part_prices', { ...priceEdit(), dryRun: true });
  assert.equal(preview.preview.wouldUpdate[0].unitPrice, 12.5);
  assert.deepEqual(await db.parts.get('A'), original);
  assert.equal(await db.apiRequests.count(), 1);
  const result = await call('kitting_update_part_prices', priceEdit());
  assert.equal(result.ok, true);
  assert.equal(result.data.updated[0].unitPrice, 12.5);
  assert.deepEqual(await db.parts.get('A'), { ...original, purchaseAmount: 100, purchaseQuantity: 8, manualUnitPrice: '' });
  assert.equal((await db.recipes.toArray())[0].qty, 2);
  assert.equal((await call('kitting_update_part_prices', priceEdit())).replayed, true);
});
test('price batch rejects stale values and missing parts without partial writes', async t => {
  const { db, call } = await setup(t);
  await call('kitting_create_parts', { requestId: 'parts', parts: [{ partId: 'A', name: 'A' }, { partId: 'B', name: 'B', purchaseAmount: 30 }] });
  for (const [partId, code] of [['B', 'PRICE_CONFLICT'], ['MISSING', 'PART_NOT_FOUND']]) {
    const input = priceEdit();
    input.updates.push({ ...input.updates[0], partId });
    assert.equal((await call('kitting_update_part_prices', input)).error.code, code);
    assert.equal((await db.parts.get('A')).purchaseAmount, 0);
    assert.equal(await db.apiRequests.count(), 1);
  }
});
test('price edits reject invalid values and unrelated fields', async t => {
  const { call } = await setup(t);
  await call('kitting_create_bundle', bundle());
  for (const prices of [{ purchaseAmount: -1 }, { purchaseQuantity: 0 }, { stock: 2 }]) {
    const input = priceEdit();
    Object.assign(input.updates[0].prices, prices);
    assert.equal((await call('kitting_update_part_prices', input)).error.code, 'VALIDATION_ERROR');
  }
});

test('bundle commits and replay/concurrent retry does not duplicate', async t => {
  const { db, call } = await setup(t);
  const results = await Promise.all([call('kitting_create_bundle', bundle()), call('kitting_create_bundle', bundle())]);
  assert.ok(results.every(r => r.ok));
  assert.equal(results.filter(r => r.replayed).length, 1);
  assert.equal(await db.parts.count(), 1);
  assert.equal(await db.recipes.count(), 1);
  assert.equal((await db.parts.get('A')).stock, 10);
  assert.equal(await db.progress.count(), 0);
  const changed = bundle(); changed.parts[0].stock = 20;
  assert.equal((await call('kitting_create_bundle', changed)).error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await call('kitting_get_request', { requestId: 'bundle-1' })).data.status, 'completed');
});
test('missing reference rolls back every table', async t => {
  const { db, call } = await setup(t);
  const input = bundle(); input.lines.push({ partId: 'MISSING', qty: 1 });
  assert.equal((await call('kitting_create_bundle', input)).error.code, 'PART_NOT_FOUND');
  for (const table of [db.parts, db.products, db.recipes, db.apiRequests]) assert.equal(await table.count(), 0);
});
test('transaction failure after inserting parts rolls them back', async t => {
  const { db, call } = await setup(t);
  db.recipes.hook('creating', () => { throw Error('simulated storage failure'); });
  assert.equal((await call('kitting_create_bundle', bundle())).error.code, 'STORAGE_ERROR');
  assert.equal(await db.parts.count(), 0);
  assert.equal(await db.products.count(), 0);
  assert.equal(await db.apiRequests.count(), 0);
});
test('dry run is side-effect free and revalidated at commit', async t => {
  const { db, call } = await setup(t);
  assert.equal((await call('kitting_create_bundle', { ...bundle(), dryRun: true })).preview.wouldCreate.parts, 1);
  assert.equal(await db.apiRequests.count(), 0);
  await db.parts.add({ id: 'A', name: 'Other' });
  assert.equal((await call('kitting_create_bundle', bundle())).error.code, 'ALREADY_EXISTS');
  assert.equal(await db.recipes.count(), 0);
});
test('duplicate recipe additions never increment quantity', async t => {
  const { db, call } = await setup(t);
  await call('kitting_create_bundle', bundle());
  const result = await call('kitting_add_recipe', { requestId: 'next', template: { mode: 'existing', templateId: 'T' }, lines: [{ partId: 'A', qty: 3 }] });
  assert.equal(result.error.code, 'RECIPE_LINE_EXISTS');
  assert.equal((await db.recipes.toArray())[0].qty, 2);
});
test('strict inputs reject invalid quantities, unknown keys and duplicate ids', async t => {
  const { call } = await setup(t);
  for (const qty of [0, -1, '2', Infinity]) {
    const input = bundle(); input.lines[0].qty = qty;
    assert.equal((await call('kitting_create_bundle', input)).error.code, 'VALIDATION_ERROR');
  }
  assert.equal((await call('kitting_create_bundle', { ...bundle(), dangerous: true })).error.code, 'VALIDATION_ERROR');
  const input = bundle(); input.parts.push(input.parts[0]);
  assert.equal((await call('kitting_create_bundle', input)).error.code, 'ALREADY_EXISTS');
});
test('workspace and session are checked, restore invalidates old requests', async t => {
  const { db, call } = await setup(t);
  assert.equal((await call('kitting_create_bundle', { ...bundle(), sessionId: 'wrong' })).error.code, 'SESSION_MISMATCH');
  await call('kitting_create_bundle', bundle());
  await db.transaction('rw', db.apiRequests, db.apiMeta, () => resetApiWorkspace(db));
  assert.equal((await call('kitting_create_bundle', bundle())).error.code, 'SESSION_MISMATCH');
  assert.equal(await db.apiRequests.count(), 0);
});
test('template lookup uses internal id and detects legacy ambiguity', async t => {
  const { db, call } = await setup(t);
  await db.products.bulkAdd([{ id: 'instance-1', internalId: 'T', name: 'One' }, { id: 'instance-2', internalId: 'T', name: 'Two' }]);
  assert.equal((await call('kitting_get_recipe', { templateId: 'T' })).error.code, 'AMBIGUOUS_TEMPLATE');
  assert.equal((await call('kitting_get_recipe', { templateId: 'instance-1' })).error.code, 'TEMPLATE_NOT_FOUND');
});
test('pagination cursors are bound to search and workspace', async t => {
  const { call } = await setup(t);
  await call('kitting_create_parts', { requestId: 'parts', parts: [{ partId: 'B', name: 'B' }, { partId: 'A', name: 'A' }] });
  const first = await call('kitting_list_parts', { limit: 1 });
  assert.equal(first.data.items[0].partId, 'A');
  const second = await call('kitting_list_parts', { cursor: first.data.nextCursor });
  assert.equal(second.data.items[0].partId, 'B');
  assert.equal((await call('kitting_list_parts', { cursor: first.data.nextCursor, query: 'B' })).error.code, 'VALIDATION_ERROR');
});
test('version 5 upgrade preserves all existing data', async () => {
  const name = crypto.randomUUID();
  const old = new Dexie(name);
  old.version(5).stores({ parts: 'id,name,stock,imageUrl,supplier', recipes: '++id,productId,partId,qty,productName', products: 'id,name,internalId,status,salePrice', progress: 'productId' });
  await old.parts.add({ id: 'existing', stock: 7 });
  await old.products.add({ id: 'individual', internalId: 'template' });
  await old.recipes.add({ productId: 'template', partId: 'existing', qty: 1 });
  await old.progress.add({ productId: 'individual', currentIndex: 1 });
  old.close();
  const upgraded = defineSchema(new Dexie(name));
  try {
    await upgraded.open();
    assert.equal((await upgraded.parts.get('existing')).stock, 7);
    assert.equal(await upgraded.products.count(), 1);
    assert.equal(await upgraded.recipes.count(), 1);
    assert.equal((await upgraded.progress.get('individual')).currentIndex, 1);
    assert.equal(await upgraded.apiRequests.count(), 0);
  } finally { await upgraded.delete(); }
});
