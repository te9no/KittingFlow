import React, { useEffect, useState } from 'react';
import { db, getProgress, setProgress, getPartsForProduct } from '../db';

export default function PickingUI() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [parts, setParts] = useState([]);
  const [progress, setProg] = useState({ state:'準備中', currentIndex:0 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const ps = await db.products.toArray();
      setProducts(ps);
      const first = ps[0]?.id || '';
      setProductId(first);
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      setParts(await getPartsForProduct(productId));
      setProg(await getProgress(productId));
    })();
  }, [productId]);

  const current = parts[progress.currentIndex] || null;
  const atEnd = progress.currentIndex >= parts.length - 1;

  async function next() {
    if (!current) return;
    const p = await db.parts.get(current.partId);
    if (p) await db.parts.update(p.id, { stock: Number(p.stock) - Number(current.qty) });
    const nextIndex = Math.min(progress.currentIndex + 1, parts.length - 1);
    await setProgress(productId, { state: atEnd ? '完了' : '進行中', currentIndex: nextIndex });
    setMsg(atEnd ? '✅ すべて完了しました' : '➡️ 次の部品へ');
    setParts(await getPartsForProduct(productId));
    setProg(await getProgress(productId));
  }

  async function resetFlow() {
    await setProgress(productId, { state: '準備中', currentIndex: 0 });
    setMsg('リセットしました');
    setParts(await getPartsForProduct(productId));
    setProg(await getProgress(productId));
  }

  return (
    <div style={{maxWidth:620, margin:'0 auto', padding:'16px', textAlign:'center'}}>
      <h3>📦 ピッキング</h3>

      <div style={{margin:'8px 0'}}>
        <label>製品：
          <select value={productId} onChange={e=>setProductId(e.target.value)} style={{marginLeft:8, padding:'6px 8px'}}>
            {products.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
        </label>
      </div>

      {!current ? (
        <p style={{marginTop:16, color:'#666'}}>レシピがありません。Recipe.csv を読み込んでください。</p>
      ) : (
        <div>
          <p><b>状態:</b> {progress.state}　<b>工程:</b> {progress.currentIndex+1}/{parts.length}</p>
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
      )}
    </div>
  );
}
