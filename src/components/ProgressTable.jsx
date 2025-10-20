import React, { useEffect, useState } from 'react';
import { db, getProgress, setProgress, getPartsForProduct } from '../db';

export default function ProgressTable() {
  const [rows, setRows] = useState([]);

  async function load() {
    const products = await db.products.toArray();
    const list = [];
    for (const p of products) {
      const pr = await getProgress(p.id);
      const parts = await getPartsForProduct(p.id);
      list.push({
        productId: p.id,
        productName: p.name,
        total: parts.length,
        currentIndex: pr.currentIndex || 0,
        state: pr.state || '準備中'
      });
    }
    setRows(list);
  }
  useEffect(() => { load(); }, []);

  async function reset(pid) {
    await setProgress(pid, { state: '準備中', currentIndex: 0 });
    load();
  }

  async function jump(pid, idx) {
    await setProgress(pid, { currentIndex: Number(idx) });
    load();
  }

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'16px'}}>
      <h3>📊 進捗一覧</h3>
      <table style={{width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:8, overflow:'hidden'}}>
        <thead style={{background:'#eef2f7'}}>
          <tr>
            <th style={{textAlign:'left', padding:'8px'}}>製品ID</th>
            <th style={{textAlign:'left', padding:'8px'}}>製品名</th>
            <th style={{textAlign:'center', padding:'8px'}}>状態</th>
            <th style={{textAlign:'center', padding:'8px'}}>インデックス</th>
            <th style={{padding:'8px'}}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.productId} style={{borderTop:'1px solid #e5e7eb'}}>
              <td style={{padding:'8px'}}>{r.productId}</td>
              <td style={{padding:'8px'}}>{r.productName}</td>
              <td style={{padding:'8px', textAlign:'center'}}>{r.state}</td>
              <td style={{padding:'8px', textAlign:'center'}}>{r.currentIndex+1}/{r.total}</td>
              <td style={{padding:'8px', textAlign:'center'}}>
                <button onClick={()=>reset(r.productId)}>リセット</button>
                <span style={{marginLeft:8}}>
                  <label>ジャンプ: </label>
                  <input type="number" min="1" max={r.total} defaultValue={r.currentIndex+1}
                         onBlur={e=>jump(r.productId, Math.min(Math.max(Number(e.target.value)-1,0), r.total-1))}
                         style={{width:70}}/>
                </span>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan="5" style={{padding:'12px', textAlign:'center', color:'#666'}}>製品がありません。Products.csv をインポートしてください。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
