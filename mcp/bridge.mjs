import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:https';
import { fail, errorResult } from '../src/api/schema.mjs';

export async function createBridge({ port = 17321, origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], timeout = 30000, tls } = {}) {
  let connection = null;
  let pairing = null;
  const pending = new Map();
  const httpsServer = tls ? createServer({ ...tls, minVersion: 'TLSv1.2' }, (req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.url === '/health' ? 'KittingFlow local bridge is running. Return to KittingFlow to pair.' : 'Not found');
  }) : null;
  const wss = new WebSocketServer({ ...(httpsServer ? { server: httpsServer } : { host: '127.0.0.1', port }), maxPayload: 1048576,
    verifyClient: ({ origin, req }) => origins.includes(origin) && /^127\.0\.0\.1:\d+$/.test(req.headers.host || '')
  });
  await new Promise((resolve, reject) => {
    const listener = httpsServer || wss;
    listener.once('listening', resolve); listener.once('error', reject);
    if (httpsServer) httpsServer.listen(port, '127.0.0.1');
  });
  const rejectPending = () => {
    for (const { resolve, timer } of pending.values()) {
      clearTimeout(timer);
      resolve(errorResult({ code: 'RESULT_UNKNOWN', message: '接続が切れました。同じrequestIdで結果を照会してください。' }));
    }
    pending.clear();
  };
  wss.on('connection', (socket, req) => {
    let authenticated = false;
    const deadline = setTimeout(() => socket.close(1008, 'Pairing timeout'), 10000);
    socket.on('error', () => {});
    socket.on('message', bytes => {
      try {
        const msg = JSON.parse(bytes.toString());
        if (!authenticated) {
          const code = Buffer.from(typeof msg.code === 'string' ? msg.code : '');
          const expected = Buffer.from(pairing?.code || '');
          if (connection || !pairing || pairing.expiresAt < Date.now() || msg.type !== 'pair' || code.length !== expected.length || !timingSafeEqual(code, expected)
            || typeof msg.workspaceId !== 'string' || !/^[\w-]{1,128}$/.test(msg.workspaceId) || msg.apiVersion !== 1) {
            socket.close(1008, 'Pairing rejected'); return;
          }
          authenticated = true;
          clearTimeout(deadline);
          pairing = null;
          connection = { socket, workspaceId: msg.workspaceId, sessionId: randomUUID(), origin: req.headers.origin, apiVersion: 1 };
          socket.send(JSON.stringify({ type: 'paired', sessionId: connection.sessionId }));
          return;
        }
        if (connection?.socket !== socket || msg.type !== 'result' || typeof msg.id !== 'string' || typeof msg.result?.ok !== 'boolean') return;
        const item = pending.get(msg.id);
        if (item) { clearTimeout(item.timer); pending.delete(msg.id); item.resolve(msg.result); }
      } catch { socket.close(1008, 'Invalid message'); }
    });
    socket.on('close', () => {
      clearTimeout(deadline);
      if (connection?.socket === socket) { connection = null; rejectPending(); }
    });
  });
  return {
    getConnection() {
      if (connection) {
        const { socket, ...data } = connection;
        return { ok: true, data: { connected: true, ...data } };
      }
      if (!pairing || pairing.expiresAt < Date.now()) pairing = { code: randomBytes(16).toString('hex'), expiresAt: Date.now() + 300000 };
      const address = `127.0.0.1:${wss.address().port}`;
      return { ok: true, data: { connected: false, bridgeUrl: `${tls ? 'wss' : 'ws'}://${address}`, ...(tls ? { healthUrl: `https://${address}/health` } : {}), pairingCode: pairing.code, expiresAt: new Date(pairing.expiresAt).toISOString(), allowedOrigins: origins } };
    },
    async call(tool, args) {
      try {
        if (!connection || connection.socket.readyState !== WebSocket.OPEN) fail('APP_NOT_CONNECTED', 'KittingFlowのCodex接続画面で接続してください。');
        if (args.workspaceId !== connection.workspaceId || args.sessionId !== connection.sessionId) fail('SESSION_MISMATCH', '保存領域またはセッションが異なります。');
        if (pending.size >= 32) fail('VALIDATION_ERROR', '同時要求数の上限です。');
        const id = randomUUID();
        return await new Promise(resolve => {
          const timer = setTimeout(() => {
            pending.delete(id);
            resolve(errorResult({ code: 'RESULT_UNKNOWN', message: '応答待ちが終了しました。同じrequestIdで照会・再送してください。' }, args.requestId));
          }, timeout);
          pending.set(id, { resolve, timer });
          connection.socket.send(JSON.stringify({ type: 'call', id, tool, args }), error => {
            if (error) { clearTimeout(timer); pending.delete(id); resolve(errorResult({ code: 'RESULT_UNKNOWN', message: '送信結果を確認できません。' }, args.requestId)); }
          });
        });
      } catch (error) { return errorResult(error, args?.requestId); }
    },
    async close() {
      rejectPending();
      for (const socket of wss.clients) socket.terminate();
      await new Promise(resolve => wss.close(resolve));
      if (httpsServer) await new Promise(resolve => httpsServer.close(resolve));
    }
  };
}
