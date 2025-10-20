import React, { useRef, useState } from 'react';
import { exportAllCSV, importCSV } from '../csv';

export default function ImportExportPanel() {
  const partsRef = useRef();
  const recipesRef = useRef();
  const productsRef = useRef();
  const progressRef = useRef();
  const [msg, setMsg] = useState('');

  async function handle(ref, target) {
    const f = ref.current.files?.[0];
    if (!f) return;
    try {
      await importCSV(f, target);
      setMsg(`✅ ${target} を取り込みました`);
    } catch (e) {
      console.error(e);
      setMsg('❌ 取り込み失敗: ' + e.message);
    } finally {
      ref.current.value = '';
    }
  }

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'16px'}}>
      <h3>📥 CSVインポート / 📤 エクスポート</h3>
      <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'12px'}}>
        <div style={{background:'#fff', padding:'12px', border:'1px solid #e5e7eb', borderRadius:8}}>
          <b>インポート（KittingFlow v1.0 形式に対応）</b>
          <div style={{marginTop:8}}>
            <label>Parts.csv: <input type="file" accept=".csv" ref={partsRef} onChange={()=>handle(partsRef,'parts')}/></label>
          </div>
          <div style={{marginTop:8}}>
            <label>Recipe.csv: <input type="file" accept=".csv" ref={recipesRef} onChange={()=>handle(recipesRef,'recipes')}/></label>
          </div>
          <div style={{marginTop:8}}>
            <label>Products.csv: <input type="file" accept=".csv" ref={productsRef} onChange={()=>handle(productsRef,'products')}/></label>
          </div>
          <div style={{marginTop:8}}>
            <label>Progress.csv: <input type="file" accept=".csv" ref={progressRef} onChange={()=>handle(progressRef,'progress')}/></label>
          </div>
          <p style={{color:'#666', fontSize:'0.9rem'}}>※ 列名は英語/日本語どちらでも可（例：Part ID / 部品ID）。</p>
        </div>

        <div style={{background:'#fff', padding:'12px', border:'1px solid #e5e7eb', borderRadius:8}}>
          <b>エクスポート</b>
          <p style={{margin:'8px 0'}}>現在のDB内容を、4つのCSV（Parts/Recipe/Products/Progress）で保存します。</p>
          <button onClick={exportAllCSV}>CSVを書き出す</button>
        </div>
      </div>
      {msg && <p style={{marginTop:10}}>{msg}</p>}
    </div>
  );
}
