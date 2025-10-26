import React, { useEffect, useState } from "react";
import { getProductTemplates, db } from "../db";

export default function RequirementSummarySelect() {
  const [templates, setTemplates] = useState([]);
  const [selection, setSelection] = useState([{ id: "", qty: 1 }]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    getProductTemplates().then(setTemplates);
  }, []);

  const handleSelectChange = (index, field, value) => {
    const updated = [...selection];
    updated[index][field] = field === "qty" ? Number(value) : value;
    setSelection(updated);
  };

  const addRow = () => setSelection([...selection, { id: "", qty: 1 }]);

  /** ✅ 必要数計算ロジック（製品ごとのレシピqty × 台数を反映） */
  const calculateSummary = async () => {
    const [allRecipes, allParts] = await Promise.all([
      db.recipes.toArray(),
      db.parts.toArray(),
    ]);
    const partMap = Object.fromEntries(
      allParts.map((p) => [p.partId || p.id || p["Part ID"], p])
    );

    const acc = {}; // { [partId]: { partId, name, required, stock } }

    for (const item of selection) {
      const internalId = item.id;
      const units = Number(item.qty || 0);
      if (!internalId || units <= 0) continue;

      const recipes = allRecipes.filter(
        (r) => String(r.productId) === String(internalId)
      );

      for (const rec of recipes) {
        const partId = rec.partId;
        const perUnit = Number(rec.qty || 0);
        const add = perUnit * units;

        if (!partId || add <= 0) continue;

        if (!acc[partId]) {
          const p = partMap[partId] || {};
          acc[partId] = {
            partId,
            name: p.name || partId,
            required: 0,
            stock: Number(p.stock || 0),
          };
        }
        acc[partId].required += add;
      }
    }

    const list = Object.values(acc).map((r) => ({
      ...r,
      shortage: Math.max(0, r.required - r.stock),
    }));

    setSummary(list);
  };

  /** ✅ CSV出力 */
  const exportCSV = () => {
    if (!summary.length) return alert("集計結果がありません");
    const header = ["部品ID", "名称", "必要数", "在庫", "不足数"];
    const rows = summary.map((r) => [
      r.partId,
      r.name,
      r.required,
      r.stock,
      r.shortage,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirement_summary.csv";
    a.click();
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h3>🧮 部品集計（製品選択）</h3>

      {selection.map((sel, idx) => (
        <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={sel.id}
            onChange={(e) => handleSelectChange(idx, "id", e.target.value)}
            style={{ flex: 3, padding: "6px 8px" }}
          >
            <option value="">製品を選択</option>
            {templates.map((t) => (
              <option key={t.internalId} value={t.internalId}>
                {t.internalId} - {t.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={sel.qty}
            onChange={(e) => handleSelectChange(idx, "qty", e.target.value)}
            style={{ width: 80, textAlign: "center" }}
          />
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={addRow}>+ 製品を追加</button>
        <button onClick={calculateSummary}>集計する</button>
      </div>

      {summary.length > 0 && (
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 16,
              fontSize: "0.9rem",
            }}
          >
            <thead style={{ background: "#f3f4f6" }}>
              <tr>
                <th style={th}>部品ID</th>
                <th style={th}>名称</th>
                <th style={th}>必要数</th>
                <th style={th}>在庫</th>
                <th style={th}>不足数</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.partId}>
                  <td style={td}>{r.partId}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.required}</td>
                  <td style={td}>{r.stock}</td>
                  <td
                    style={{
                      ...td,
                      color: r.shortage > 0 ? "red" : "#222",
                      fontWeight: r.shortage > 0 ? 600 : 400,
                    }}
                  >
                    {r.shortage > 0 ? `-${r.shortage}` : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={exportCSV} style={{ marginTop: 12 }}>
            CSV出力
          </button>
        </div>
      )}
    </div>
  );
}

const th = { border: "1px solid #ccc", padding: "6px", textAlign: "center" };
const td = { border: "1px solid #ddd", padding: "6px", textAlign: "center" };
