import React, { useEffect, useState } from "react";
import { db, getProductTemplates } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

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

  const calculateSummary = async () => {
    const [allRecipes, allParts, allProducts] = await Promise.all([
      db.recipes.toArray(),
      db.parts.toArray(),
      db.products.toArray()
    ]);

    const partMap = Object.fromEntries(
      allParts.map((p) => [String(p.partId ?? p.id ?? p["Part ID"] ?? ""), p])
    );

    const productToTemplate = Object.fromEntries(
      allProducts.map((pr) => [
        String(pr.productId),
        String(pr.templateId ?? pr.internalId ?? "")
      ])
    );

    const acc = {};

    for (const item of selection) {
      const rawId = String(item.id || "").trim();
      const units = Number(item.qty || 0);
      if (!rawId || units <= 0) continue;

      let keyForRecipe = rawId;
      let recipes = allRecipes.filter((r) => String(r.productId) === keyForRecipe);
      if (recipes.length === 0 && productToTemplate[rawId]) {
        keyForRecipe = productToTemplate[rawId];
        recipes = allRecipes.filter((r) => String(r.productId) === keyForRecipe);
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
            stock: Number(p.stock || 0)
          };
        }

        acc[partId].sets += units;
        acc[partId].required += units * perSet;
      }
    }

    const list = Object.values(acc).map((r) => ({
      ...r,
      shortage: Math.max(0, r.required - r.stock)
    }));

    setSummary(list);
    writeStoredState(RESULTS_STATE_KEY, list);
  };

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
      r.shortage
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
    <div className="mobile-page requirements-page" style={{ maxWidth: layout.maxWidth, margin: "0 auto", padding: spacing(4) }}>
      <h3 style={{ marginBottom: spacing(3), fontWeight: typography.headingWeight }}>🧮 部品集計（必要セット・個数別）</h3>

      <div style={card({ display: "grid", gap: spacing(2) })}>
        {selection.map((sel, idx) => (
          <div className="requirements-row" key={idx} style={{ display: "flex", gap: spacing(2) }}>
            <select
              value={sel.id}
              onChange={(e) => handleSelectChange(idx, "id", e.target.value)}
              style={{ flex: 3, padding: "8px 10px", borderRadius: spacing(1.5), border: `1px solid ${palette.border}` }}
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
              style={{ width: 100, padding: "8px 10px", textAlign: "center", borderRadius: spacing(1.5), border: `1px solid ${palette.border}` }}
            />
          </div>
        ))}

        <div className="requirements-actions" style={{ display: "flex", gap: spacing(2), marginTop: spacing(1) }}>
          <button onClick={addRow} style={{ ...buttonBase, background: palette.surfaceAlt }}>
            + 製品を追加
          </button>
          <button
            onClick={calculateSummary}
            style={{ ...buttonBase, background: palette.primary, color: "#fff", borderColor: palette.primaryDark }}
          >
            集計する
          </button>
        </div>
      </div>

      {summary.length > 0 && (
        <div style={{ marginTop: spacing(4) }}>
          <div className="requirements-desktop-table" style={card({ padding: "0", overflowX: "auto" })}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: typography.size.sm
              }}
            >
              <thead style={{ background: palette.surfaceAlt }}>
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
                        color: r.shortage > 0 ? palette.danger : palette.text,
                        fontWeight: r.shortage > 0 ? 600 : 400
                      }}
                    >
                      {r.shortage > 0 ? `-${r.shortage}` : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="requirements-mobile-results" aria-label="必要部品の集計結果">
            {summary.map((r) => (
              <article className={`requirements-result-card${r.shortage > 0 ? " requirements-result-card--shortage" : ""}`} key={`mobile-${r.partId}`}>
                <div className="requirements-result-card__header">
                  <div><span>{r.partId}</span><h3>{r.name}</h3></div>
                  <strong>{r.shortage > 0 ? `${r.shortage}個不足` : "在庫OK"}</strong>
                </div>
                <div className="requirements-result-card__numbers">
                  <div><span>必要数</span><b>{r.required}</b></div>
                  <div><span>在庫</span><b>{r.stock}</b></div>
                  <div><span>セット</span><b>{r.sets}</b></div>
                  <div><span>1セット</span><b>{r.perSet}</b></div>
                </div>
              </article>
            ))}
          </div>

          <button className="requirements-export" onClick={exportCSV} style={{ marginTop: spacing(3), ...buttonBase, background: palette.surfaceAlt }}>
            CSV出力
          </button>
        </div>
      )}
    </div>
  );
}

const buttonBase = {
  padding: "8px 16px",
  borderRadius: spacing(2),
  border: `1px solid ${palette.border}`,
  fontWeight: 600,
  cursor: "pointer"
};

const th = { borderBottom: `1px solid ${palette.border}`, padding: `${spacing(2)} ${spacing(3)}`, textAlign: "center" };
const td = { borderBottom: `1px solid ${palette.border}`, padding: `${spacing(1.5)} ${spacing(2)}`, textAlign: "center" };
