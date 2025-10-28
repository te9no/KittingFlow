import React, { useEffect, useState } from "react";
import { db, getProductTemplates } from "../db";

const SELECTION_STATE_KEY = "requirementSummary.selection";
const RESULTS_STATE_KEY = "requirementSummary.results";

const readStoredState = (key) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to read summary state", err);
    return null;
  }
};

const writeStoredState = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn("Failed to persist summary state", err);
  }
};

export default function RequirementSummarySelect() {
  const [templates, setTemplates] = useState([]);
  const [selection, setSelection] = useState([{ id: "", qty: 1 }]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    getProductTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    const savedSelection = readStoredState(SELECTION_STATE_KEY);
    const savedSummary = readStoredState(RESULTS_STATE_KEY);
    if (Array.isArray(savedSelection) && savedSelection.length > 0) {
      setSelection(savedSelection);
    }
    if (Array.isArray(savedSummary)) {
      setSummary(savedSummary);
    }
  }, []);

  const handleSelectChange = (index, field, value) => {
    const updated = [...selection];
    updated[index][field] = field === "qty" ? Number(value) : value;
    setSelection(updated);
    writeStoredState(SELECTION_STATE_KEY, updated);
  };

  const addRow = () => {
    const next = [...selection, { id: "", qty: 1 }];
    setSelection(next);
    writeStoredState(SELECTION_STATE_KEY, next);
  };

  /** ✅ 必要セット・個数別の計算ロジック */
  const calculateSummary = async () => {
    const [allRecipes, allParts, allProducts] = await Promise.all([
      db.recipes.toArray(),
      db.parts.toArray(),
      db.products.toArray(),
    ]);

    const partMap = Object.fromEntries(
      allParts.map((p) => [String(p.partId ?? p.id ?? p["Part ID"] ?? ""), p])
    );

    const productToTemplate = Object.fromEntries(
      allProducts.map((pr) => [
        String(pr.productId),
        String(pr.templateId ?? pr.internalId ?? ""),
      ])
    );

    const acc = {}; // { partId: { partId, name, sets, perSet, required, stock } }

    for (const item of selection) {
      const rawId = String(item.id || "").trim();
      const units = Number(item.qty || 0);
      if (!rawId || units <= 0) continue;

      // internalId or FancyID両対応
      let keyForRecipe = rawId;
      let recipes = allRecipes.filter(
        (r) => String(r.productId) === keyForRecipe
      );
      if (recipes.length === 0 && productToTemplate[rawId]) {
        keyForRecipe = productToTemplate[rawId];
        recipes = allRecipes.filter(
          (r) => String(r.productId) === keyForRecipe
        );
      }

      for (const rec of recipes) {
        const partId = String(rec.partId || "").trim();
        const perSet = Number(rec.qty || rec["必要数"] || 0);
        if (!partId || !Number.isFinite(perSet)) continue;

        if (!acc[partId]) {
          const p = partMap[partId] || {};
          acc[partId] = {
            partId,
            name: p.name || partId,
            sets: 0,
            perSet,
            required: 0,
            stock: Number(p.stock || 0),
          };
        }

        // 同じ部品を別製品で共用する場合、setsは単純加算
        acc[partId].sets += units;
        acc[partId].required += units * perSet;
      }
    }

    const list = Object.values(acc).map((r) => ({
      ...r,
      shortage: Math.max(0, r.required - r.stock),
    }));

    setSummary(list);
    writeStoredState(RESULTS_STATE_KEY, list);
  };

  /** ✅ CSV出力 */
  const exportCSV = () => {
    if (!summary.length) return alert("集計結果がありません");
    const header = ["部品ID", "名称", "必要セット数", "セットあたり個数", "合計必要個数", "在庫", "不足数"];
    const rows = summary.map((r) => [
      r.partId,
      r.name,
      r.sets,
      r.perSet,
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
      <h3>🧮 部品集計（必要セット・個数別）</h3>

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
                <th style={th}>必要セット数</th>
                <th style={th}>セットあたり個数</th>
                <th style={th}>合計必要個数</th>
                <th style={th}>在庫</th>
                <th style={th}>不足数</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.partId}>
                  <td style={td}>{r.partId}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.sets}</td>
                  <td style={td}>{r.perSet}</td>
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
