import React, { useState } from "react";
import { getTotalPartsRequirement } from "../db";

export default function RequirementSummary() {
  const [list, setList] = useState([]);
  const [input, setInput] = useState(""); // JSON文字列入力など簡易UI用

  async function handleCalculate() {
    try {
      const selected = JSON.parse(input); // [{productId, quantity}]
      const res = await getTotalPartsRequirement(selected);
      setList(res);
    } catch (e) {
      alert("入力が不正です");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>📦 必要部品の集計</h3>
      <textarea
        rows={3}
        placeholder='例: [{"productId":"P001","quantity":2},{"productId":"P002","quantity":3}]'
        value={input}
        onChange={e => setInput(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={handleCalculate}>計算する</button>

      {list.length > 0 && (
        <table style={{ marginTop: 12, width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th>部品ID</th><th>部品名</th><th>必要数</th><th>在庫</th><th>不足</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.partId} style={{ background: p.shortage > 0 ? "#ffe5e5" : "white" }}>
                <td>{p.partId}</td><td>{p.name}</td>
                <td>{p.required}</td><td>{p.stock}</td><td>{p.shortage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
