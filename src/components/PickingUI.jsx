import React, { useEffect, useState } from 'react';
import { db, getProgress, setProgress } from '../db';

export default function PickingUI() {
  const [parts, setParts] = useState([]);
  const [progress, setProg] = useState({ state:'準備中', currentIndex:0, productId:'MK-Local-0001' });
  const [msg, setMsg] = useState('');

  async function load() {
    const p = await db.parts.toArray();
    setParts(p);
    setProg(await getProgress());
  }
  useEffect(() => { load(); }, []);

  const current = parts[progress.currentIndex] || null;
  const atEnd = progress.currentIndex >= parts.length - 1;

  async function next() {
    if (!current) return;
    await db.parts.update(current.id, { stock: Number(current.stock) - Number(current.qty) });
    const nextIndex = Math.min(progress.currentIndex + 1, parts.length - 1);
    await setProgress({ state: atEnd ? '完了' : '進行中', currentIndex: nextIndex });
    setMsg(atEnd ? '✅ すべて完了しました' : '➡️ 次の部品へ');
    load();
  }

  async function resetFlow() {
    await setProgress({ state: '準備中', currentIndex: 0 });
    setMsg('リセットしました');
    load();
  }

  if (!current) {
    return (
      <div style={{padding:'16px', textAlign:'center'}}>
        <h3>📦 ピッキング</h3>
        <p>部品データがありません。CSVを読み込むか、初期サンプルを使用してください。</p>
      </div>
    );
  }

  return (
    <div style={{maxWidth:560, margin:'0 auto', padding:'16px', textAlign:'center'}}>
      <h3>📦 ピッキング {progress.currentIndex+1}/{parts.length}</h3>
      <p><b>製品ID:</b> {progress.productId}　<b>状態:</b> {progress.state}</p>
      {current.imageUrl ? (
        <img src={current.imageUrl} alt={current.name} width="220" height="220" style={{border:'1px solid #ddd', borderRadius:8}}/>
      ) : (
        <div style={{width:220, height:220, border:'1px dashed #bbb', borderRadius:8, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', color:'#777'}}>
          画像なし
        </div>
      )}
      <p style={{fontSize:'1.1rem', marginTop:8}}>{current.name} × {current.qty}</p>
      <p style={{color:'#444'}}>在庫: {current.stock}</p>
      <div style={{marginTop:12}}>
        <button onClick={next} style={{fontSize:'1.2rem', padding:'10px 24px', borderRadius:8, border:'none', background:'#2563eb', color:'#fff'}}>
          {atEnd ? '完了' : '次へ ▶'}
        </button>
        <button onClick={resetFlow} style={{fontSize:'1rem', padding:'8px 16px', borderRadius:8, border:'1px solid #999', background:'#fff', marginLeft:8}}>
          リセット
        </button>
      </div>
      {msg && <p style={{marginTop:8}}>{msg}</p>}
    </div>
  );
}
