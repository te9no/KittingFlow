import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../db';

export default function RecipeTable() {
  const [recipes, setRecipes] = useState([]);
  const [parts, setParts] = useState([]);
  const [products, setProducts] = useState([]);

  const [newRow, setNewRow] = useState({ productId: '', partId: '', qty: 1 });

  async function load() {
    const [r, p, pr] = await Promise.all([db.recipes.toArray(), db.parts.toArray(), db.products.toArray()]);
    setRecipes(r);
    setParts(p);
    setProducts(pr);
  }
  useEffect(() => { load(); }, []);

  const partName = id => parts.find(x=>x.id===id)?.name || id;
  const productName = id => products.find(x=>x.id===id)?.name || id;

  async function saveQty(row, qty) {
    const q = Number(qty);
    if (isNaN(q) || q <= 0) return;
    await db.recipes.update(row.id, { qty: q });
    load();
  }

  async function removeRow(id) {
    await db.recipes.delete(id);
    load();
  }

  async function addRow() {
    if (!newRow.productId || !newRow.partId) return;
    await db.recipes.add({ productId: newRow.productId, partId: newRow.partId, qty: Number(newRow.qty || 1) });
    setNewRow({ productId: '', partId: '', qty: 1 });
    load();
  }

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'16px'}}>
      <h3>📘 レシピ（製品→部品の対応）</h3>

      <table style={{width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:8, overflow:'hidden'}}>
        <thead style={{background:'#eef2f7'}}>
          <tr>
            <th style={{textAlign:'left', padding:'8px'}}>製品</th>
            <th style={{textAlign:'left', padding:'8px'}}>部品</th>
            <th style={{textAlign:'right', padding:'8px'}}>数量</th>
            <th style={{padding:'8px'}}>操作</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map(r => (
            <tr key={r.id} style={{borderTop:'1px solid #e5e7eb'}}>
              <td style={{padding:'8px'}}>{r.productId} — {productName(r.productId)}</td>
              <td style={{padding:'8px'}}>{r.partId} — {partName(r.partId)}</td>
              <td style={{padding:'8px', textAlign:'right'}}>
                <input type="number" min="1" defaultValue={r.qty} onBlur={e=>saveQty(r, e.target.value)} style={{width:80}}/>
              </td>
              <td style={{padding:'8px', textAlign:'center'}}>
                <button onClick={()=>removeRow(r.id)}>削除</button>
              </td>
            </tr>
          ))}
          {!recipes.length && (
            <tr><td colSpan="4" style={{padding:'12px', textAlign:'center', color:'#666'}}>データがありません。Recipe.csv をインポートしてください。</td></tr>
          )}
        </tbody>
      </table>

      <div style={{marginTop:12, background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'12px'}}>
        <b>行を追加</b>
        <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
          <select value={newRow.productId} onChange={e=>setNewRow({...newRow, productId:e.target.value})}>
            <option value="">製品を選択</option>
            {products.map(p=> <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
          <select value={newRow.partId} onChange={e=>setNewRow({...newRow, partId:e.target.value})}>
            <option value="">部品を選択</option>
            {parts.map(p=> <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
          <input type="number" min="1" value={newRow.qty} onChange={e=>setNewRow({...newRow, qty:e.target.value})} style={{width:100}}/>
          <button onClick={addRow}>追加</button>
        </div>
      </div>
    </div>
  );
}
