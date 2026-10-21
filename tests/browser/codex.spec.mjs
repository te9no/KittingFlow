import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';

test('real stdio MCP through browser registers bundle, refreshes UI and replays', async ({ page }) => {
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
  const client = new Client({ name: 'integration-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('mcp/server.mjs')], env: { ...process.env, KITTINGFLOW_BRIDGE_PORT: '17329', KITTINGFLOW_CONFIG: path.resolve('test-results/isolated-bridge-config.json') } });
  await client.connect(transport);
  const call = async (name, args = {}) => (await client.callTool({ name, arguments: args })).structuredContent;
  try {
    expect((await client.listTools()).tools).toHaveLength(9);
    const info = (await call('kitting_get_connection')).data;
    await page.goto('/');
    await page.locator('summary').filter({ hasText: 'Codex接続' }).click();
    await page.getByLabel('Codex接続先', { exact: true }).fill(info.bridgeUrl);
    await page.getByLabel('Codex接続コード', { exact: true }).fill(info.pairingCode);
    await page.getByRole('button', { name: '接続する', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('接続済み');
    const connected = (await call('kitting_get_connection')).data;
    const context = { workspaceId: connected.workspaceId, sessionId: connected.sessionId };
    await page.getByRole('button', { name: '部品', exact: true }).click();
    const input = { ...context, requestId: 'browser-test', parts: [{ partId: 'E2E001', name: 'APIテスト部品', stock: 5 }], template: { mode: 'new', templateId: 'E2E-T', name: 'APIテスト製品' }, lines: [{ partId: 'E2E001', qty: 2 }] };
    const result = await call('kitting_create_bundle', input);
    expect(result.ok).toBe(true);
    await expect(page.locator('input[value="APIテスト部品"]:visible')).toBeVisible();
    expect((await call('kitting_create_bundle', input)).replayed).toBe(true);
    expect((await call('kitting_get_recipe', { ...context, templateId: 'E2E-T' })).data.lines).toHaveLength(1);
    const price = await call('kitting_update_part_prices', { ...context, requestId: 'browser-price', updates: [{ partId: 'E2E001', expected: { purchaseAmount: 0, purchaseQuantity: 0, manualUnitPrice: null }, prices: { purchaseAmount: 100, purchaseQuantity: 8, manualUnitPrice: null } }] });
    expect(price.ok).toBe(true);
    expect(price.data.updated[0].unitPrice).toBe(12.5);
    const part = (await call('kitting_list_parts', { ...context, query: 'E2E001' })).data.items[0];
    expect(part.purchaseAmount).toBe(100);
    expect(part.stock).toBe(5);
    await page.getByRole('button', { name: '接続を解除', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('未接続');
    await expect.poll(async () => (await call('kitting_get_connection')).data.connected).toBe(false);
    expect((await call('kitting_create_bundle', input)).error.code).toBe('APP_NOT_CONNECTED');
  } finally { await client.close(); }
});

test('CSV failure preserves data and restore invalidates API workspace atomically', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('summary').filter({ hasText: 'Codex接続' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const { db } = await import('/src/db.js');
    const { workspaceId } = await import('/src/api/database.mjs');
    const { importCSV } = await import('/src/csv.js');
    const { applyDatasetToDB } = await import('/src/gist.js');
    const original = await workspaceId(db);
    const parts = await db.parts.toArray();
    await db.apiRequests.add({ key: 'test-record' });
    let failed = false;
    try { await importCSV(new File(['id,name\n,Invalid'], 'invalid.csv'), 'parts'); } catch { failed = true; }
    const preserved = JSON.stringify(parts) === JSON.stringify(await db.parts.toArray()) && original === await workspaceId(db);
    let restoreFailed = false;
    try { await applyDatasetToDB({ parts: [{ id: 'X' }, { id: 'X' }] }); } catch { restoreFailed = true; }
    const failedRestorePreserved = original === await workspaceId(db) && await db.apiRequests.count() === 1;
    await applyDatasetToDB({ parts: [{ id: 'RESTORED', name: 'restored', stock: 3 }] });
    return { failed, preserved, restoreFailed, failedRestorePreserved, changed: original !== await workspaceId(db), requests: await db.apiRequests.count(), ids: await db.parts.toCollection().primaryKeys() };
  });
  expect(result).toEqual({ failed: true, preserved: true, restoreFailed: true, failedRestorePreserved: true, changed: true, requests: 0, ids: ['RESTORED'] });
});
