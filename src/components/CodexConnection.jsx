import React, { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, initDB } from '../db';
import { workspaceId } from '../api/database.mjs';
import { executeCatalog } from '../api/catalog.mjs';

export default function CodexConnection() {
  const [url, setUrl] = useState(`${location.protocol === 'https:' ? 'wss' : 'ws'}://127.0.0.1:17321`);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('未接続');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const connection = useRef(null);
  useEffect(() => () => { connection.current?.socket.close(); connection.current?.subscription?.unsubscribe(); }, []);
  async function connect() {
    setBusy(true);
    try {
      const endpoint = new URL(url);
      if (endpoint.hostname !== '127.0.0.1' || !['ws:', 'wss:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw Error('接続先は127.0.0.1の中継サーバーを指定してください。');
      if (location.protocol === 'https:' && endpoint.protocol !== 'wss:') throw Error('公開サイトではwss://で始まる接続先を指定してください。');
      if (!code.trim()) throw Error('Codexで取得した接続コードを入力してください。');
      await initDB();
      const workspace = await workspaceId(db);
      const socket = new WebSocket(url);
      const current = { socket, sessionId: null };
      const deadline = setTimeout(() => { current.error = '接続がタイムアウトしました。証明書とブラウザのローカル接続権限を確認してください。'; socket.close(); }, 15000);
      connection.current = current;
      setStatus('接続中…');
      socket.onopen = () => { socket.send(JSON.stringify({ type: 'pair', code: code.trim(), workspaceId: workspace, apiVersion: 1 })); setCode(''); };
      socket.onmessage = async event => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { socket.close(); return; }
        if (msg.type === 'paired') {
          clearTimeout(deadline);
          current.sessionId = msg.sessionId;
          setConnected(true); setBusy(false); setStatus(`接続済み — ${workspace}`);
          current.subscription = liveQuery(() => db.apiMeta.get('workspace')).subscribe(row => {
            if (row?.value !== workspace) socket.close(1000, 'Workspace changed');
          });
        } else if (msg.type === 'call' && current.sessionId && connection.current === current) {
          const result = await executeCatalog(db, msg.tool, msg.args, current.sessionId);
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'result', id: msg.id, result }));
        }
      };
      socket.onerror = () => { current.error = '接続できません。MCPの起動・証明書の信頼・ブラウザのローカル接続権限を確認してください。'; };
      socket.onclose = () => {
        clearTimeout(deadline);
        current.subscription?.unsubscribe();
        if (connection.current === current) { connection.current = null; setConnected(false); setBusy(false); setStatus(current.error || '未接続 — 再接続にはCodexで接続コードを取得してください。'); }
      };
    } catch (error) { setStatus(error.message); setBusy(false); }
  }
  return <details style={{ marginBottom: 20, padding: 14, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Codex接続 {connected ? '● 接続済み' : '○ 未接続'}</summary>
    <p>このブラウザの部品・レシピの検索・追加と、部品価格の編集をCodexから行えます。Codexで接続情報を取得し、表示されたコードを入力してください。</p>
    <p>保存先: {location.origin} / kittingflow_local</p>
    {location.protocol === 'https:' && <p>この公開サイトのデータを、このPCのCodexと直接やり取りします。初回はローカル中継の証明書設定が必要です。ブラウザにローカルネットワークへの接続許可が表示された場合は、接続先を確認して許可してください。</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label>接続先 <input aria-label="Codex接続先" value={url} disabled={busy || connected} onChange={e => setUrl(e.target.value)} /></label>
      <label>接続コード <input aria-label="Codex接続コード" type="password" autoComplete="off" value={code} disabled={busy || connected} onChange={e => setCode(e.target.value)} /></label>
      <button disabled={busy || connected} onClick={connect}>接続する</button>
      <button disabled={!busy && !connected} onClick={() => connection.current?.socket.close()}>接続を解除</button>
    </div>
    <p role="status">{status}</p>
  </details>;
}
