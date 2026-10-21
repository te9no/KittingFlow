import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createBridge } from '../../mcp/bridge.mjs';
import { tlsFixture } from '../tls-fixture.mjs';

test('HTTPS app pairs over WSS and writes to its own IndexedDB', async () => {
  test.skip(process.platform !== 'win32', 'Windows TLS setup');
  const fixture = tlsFixture();
  const root = resolve('dist');
  const site = createServer(fixture.tls, async (req, res) => {
    const pathname = new URL(req.url, 'https://127.0.0.1').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      const data = await readFile(file);
      res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${site.address().port}`;
  const bridge = await createBridge({ port: 0, tls: fixture.tls, origins: [origin] });
  const browser = await chromium.launch({ channel: 'msedge', args: [`--ignore-certificate-errors-spki-list=${fixture.spki}`] });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page.locator('summary').filter({ hasText: 'Codex接続' }).click();
    const info = bridge.getConnection().data;
    await page.getByLabel('Codex接続先', { exact: true }).fill(info.bridgeUrl);
    await page.getByLabel('Codex接続コード', { exact: true }).fill(info.pairingCode);
    await page.getByRole('button', { name: '接続する', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('接続済み');
    const connection = bridge.getConnection().data;
    expect(connection.origin).toBe(origin);
    const input = { workspaceId: connection.workspaceId, sessionId: connection.sessionId, requestId: 'https-test', parts: [{ partId: 'HTTPS001', name: '公開サイト用部品', stock: 9 }] };
    expect((await bridge.call('kitting_create_parts', input)).ok).toBe(true);
    expect((await bridge.call('kitting_create_parts', input)).replayed).toBe(true);
    const listed = await bridge.call('kitting_list_parts', { workspaceId: input.workspaceId, sessionId: input.sessionId, query: 'HTTPS001' });
    expect(listed.data.items[0].stock).toBe(9);
    await page.reload();
    const records = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('kittingflow_local');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const row = db.transaction('parts').objectStore('parts').get('HTTPS001');
        row.onsuccess = () => { resolve(row.result); db.close(); };
      };
    }));
    expect(records.stock).toBe(9);
  } finally {
    await browser.close(); await bridge.close();
    await new Promise(resolve => site.close(resolve));
  }
});
