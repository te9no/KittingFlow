import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createBridge } from '../mcp/bridge.mjs';

async function setup(t) {
  const bridge = await createBridge({ port: 0, timeout: 50 });
  t.after(() => bridge.close());
  return bridge;
}
async function pair(bridge, code) {
  const info = bridge.getConnection().data;
  const socket = new WebSocket(info.bridgeUrl, { origin: 'http://localhost:5173' });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'pair', code: code || info.pairingCode, workspaceId: 'workspace', apiVersion: 1 }));
  return socket;
}
test('bridge rejects foreign origin', async t => {
  const bridge = await setup(t);
  const socket = new WebSocket(bridge.getConnection().data.bridgeUrl, { origin: 'https://attacker.example' });
  const [error] = await once(socket, 'error');
  assert.match(error.message, /40[13]/);
  assert.equal(bridge.getConnection().data.connected, false);
});
test('wrong pairing code rejected, correct session routes and timeout remains unknown', async t => {
  const bridge = await setup(t);
  const wrong = await pair(bridge, 'wrong');
  assert.equal((await once(wrong, 'close'))[0], 1008);
  const socket = await pair(bridge);
  const paired = JSON.parse((await once(socket, 'message'))[0].toString());
  const context = { workspaceId: 'workspace', sessionId: paired.sessionId, requestId: 'r' };
  assert.equal((await bridge.call('kitting_list_parts', { ...context, sessionId: 'wrong' })).error.code, 'SESSION_MISMATCH');
  const resultPromise = bridge.call('kitting_create_parts', context);
  const call = JSON.parse((await once(socket, 'message'))[0].toString());
  socket.send(JSON.stringify({ type: 'result', id: call.id, result: { ok: true, data: { created: 1 } } }));
  assert.equal((await resultPromise).ok, true);
  assert.equal((await bridge.call('kitting_create_parts', context)).error.code, 'RESULT_UNKNOWN');
  socket.close();
  await once(socket, 'close');
});
