import React, { useRef, useState } from 'react';
import { exportCSV, importCSV } from '../csv';
import { initSampleDataIfEmpty } from '../db';

export default function ImportExportPanel() {
  const partsRef = useRef();
  const progRef = useRef();
  const setRef = useRef();
  const [msg, setMsg] = useState('');

  async function handleImport(ref, target) {
    const file = ref.current.files?.[0];
    if (!file) return;
    try {
      await importCSV(file, target);
      setMsg(`✅ ${target} を取り込みました`);
    } catch (e) {
      console.error(e);
      setMsg(`❌ 取り込み失敗: ${e.message}`);
    } finally {
      ref.current.value = '';
    }
  }

  async function loadSamples() {
    await initSampleDataIfEmpty();
    setMsg('🧪 サンプルデータを投入しました（空のときのみ）');
  }

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'16px'}}>
      <h3>📥 インポート / 📤 エクスポート</h3>
      <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'12px'}}>
        <div style={{background:'#fff', padding:'12px', border:'1px solid #e5e7eb', borderRadius:8}}>
          <b>インポート（CSV）</b>
          <div style={{marginTop:8}}>
            <label>parts.csv: <input type="file" accept=".csv" ref={partsRef} onChange={()=>handleImport(partsRef,'parts')} /></label>
          </div>
          <div style={{marginTop:8}}>
            <label>progress.csv: <input type="file" accept=".csv" ref={progRef} onChange={()=>handleImport(progRef,'progress')} /></label>
          </div>
          <div style={{marginTop:8}}>
            <label>settings.csv: <input type="file" accept=".csv" ref={setRef} onChange={()=>handleImport(setRef,'settings')} /></label>
          </div>
          <p style={{color:'#666', fontSize:'0.9rem'}}>※ ヘッダ付きCSV。partsの列は {`id,name,qty,stock,imageUrl`} 推奨。</p>
          <button onClick={loadSamples} style={{marginTop:8}}>サンプル投入（空のときのみ）</button>
        </div>

        <div style={{background:'#fff', padding:'12px', border:'1px solid #e5e7eb', borderRadius:8}}>
          <b>エクスポート（CSV）</b>
          <p style={{margin:'8px 0'}}>現在のデータをCSVで保存します。</p>
          <button onClick={exportCSV}>CSVを3ファイル保存</button>
        </div>
      </div>
      {msg && <p style={{marginTop:10}}>{msg}</p>}
    </div>
  );
}
