import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initSampleDataIfEmpty } from './db';
import PartsTable from './components/PartsTable';
import PickingUI from './components/PickingUI';
import ImportExportPanel from './components/ImportExportPanel';

function App() {
  const [tab, setTab] = useState('picking');
  useEffect(() => { initSampleDataIfEmpty(); }, []);

  return (
    <div>
      <header style={{position:'sticky', top:0, background:'#0f172a', color:'#fff', padding:'12px 16px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', maxWidth:1100, margin:'0 auto'}}>
          <div style={{fontWeight:700}}>KittingFlow Local Edition v1.1</div>
          <nav style={{display:'flex', gap:8}}>
            <button onClick={()=>setTab('picking')} style={btnStyle(tab==='picking')}>ピッキング</button>
            <button onClick={()=>setTab('parts')} style={btnStyle(tab==='parts')}>部品</button>
            <button onClick={()=>setTab('io')} style={btnStyle(tab==='io')}>CSV入出力</button>
          </nav>
        </div>
      </header>

      <main>
        {tab==='picking' && <PickingUI />}
        {tab==='parts' && <PartsTable />}
        {tab==='io' && <ImportExportPanel />}
      </main>

      <footer style={{textAlign:'center', padding:'16px', color:'#666'}}>© KittingFlow Local</footer>
    </div>
  );
}

function btnStyle(active) {
  return {
    background: active ? '#22c55e' : '#1f2937',
    color:'#fff',
    border:'none',
    borderRadius:8,
    padding:'8px 12px',
    cursor:'pointer'
  };
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
