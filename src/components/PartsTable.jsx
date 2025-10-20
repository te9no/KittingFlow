import React, { useEffect, useState } from 'react';
import { db } from '../db';

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [stockVal, setStockVal] = useState('');

  async function load() {
    setParts(await db.parts.toArray());
  }
  useEffect(() => { load(); }, []);

  async function updateStock(id) {
    const n = Number(stockVal);
    if (isNaN(n)) return;
    await db.parts.update(id, { stock: n });
    setEditing(null);
    setStockVal('');
    load();
  }

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'16px'}}>
      <h3>🧾 部品一覧 / 在庫</h3>
      <table style={{width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:8, overflow:'hidden'}}>
        <thead style={{background:'#eef2f7'}}>
          <tr>
            <th style={{textAlign:'left', padding:'8px'}}>部品ID</th>
            <th style={{textAlign:'left', padding:'8px'}}>部品名</th>
            <th style={{textAlign:'right', padding:'8px'}}>在庫</th>
            <th style={{padding:'8px'}}>操作</th>
          </tr>
        </thead>
        <tbody>
          {parts.map(p => (
            <tr key={p.id} style={{borderTop:'1px solid #e5e7eb'}}>
              <td style={{padding:'8px'}}>{p.id}</td>
              <td style={{padding:'8px'}}>{p.name}</td>
              <td style={{padding:'8px', textAlign:'right'}}>{p.stock}</td>
              <td style={{padding:'8px', textAlign:'center'}}>
                {editing === p.id ? (
                  <span>
                    <input value={stockVal} onChange={e=>setStockVal(e.target.value)} style={{width:90}}/>
                    <button onClick={()=>updateStock(p.id)} style={{marginLeft:8}}>保存</button>
                    <button onClick={()=>setEditing(null)} style={{marginLeft:4}}>取消</button>
                  </span>
                ) : (
                  <button onClick={()=>{setEditing(p.id); setStockVal(String(p.stock));}}>在庫編集</button>
                )}
              </td>
            </tr>
          ))}
          {!parts.length && (
            <tr><td colSpan="4" style={{padding:'12px', textAlign:'center', color:'#666'}}>データがありません。CSVをインポートしてください。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
