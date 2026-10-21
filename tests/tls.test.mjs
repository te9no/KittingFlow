import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createBridge } from '../mcp/bridge.mjs';
import { tlsFixture } from './tls-fixture.mjs';

test('WSS verifies certificate and permits only the configured HTTPS site', { skip: process.platform !== 'win32' }, async t => {
  const fixture = tlsFixture();
  const bridge = await createBridge({ port: 0, tls: fixture.tls, origins: ['https://kittingflow-test.example'] });
  t.after(() => bridge.close());
  const info = bridge.getConnection().data;
  assert.ok(info.bridgeUrl.startsWith('wss://'));
  const wrong = new WebSocket(info.bridgeUrl, { ca: fixture.ca, origin: 'https://wrong.example' });
  assert.match((await once(wrong, 'error'))[0].message, /40[13]/);
  const untrusted = new WebSocket(info.bridgeUrl, { origin: 'https://kittingflow-test.example' });
  assert.match((await once(untrusted, 'error'))[0].message, /self-signed certificate/);
  const socket = new WebSocket(info.bridgeUrl, { ca: fixture.ca, origin: 'https://kittingflow-test.example' });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'pair', code: info.pairingCode, workspaceId: 'workspace', apiVersion: 1 }));
  assert.equal(JSON.parse((await once(socket, 'message'))[0].toString()).type, 'paired');
  socket.close();
  await once(socket, 'close');
});
