import React, { useMemo, useRef, useState } from "react";
import { exportAllCSV, importCSV } from "../csv";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const LABELS = {
  parts: "Parts.csv",
  recipes: "Recipe.csv",
  products: "Products.csv",
  progress: "Progress.csv"
};

export default function ImportExportPanel() {
  const partsRef = useRef();
  const recipesRef = useRef();
  const productsRef = useRef();
  const progressRef = useRef();
  const [message, setMessage] = useState("");

  const exportHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, true),
    []
  );

  async function handle(ref, target) {
    const file = ref.current?.files?.[0];
    if (!file) return;
    try {
      await importCSV(file, target);
      setMessage(`✅ ${LABELS[target] || target} を取り込みました`);
    } catch (error) {
      console.error(error);
      setMessage(`⚠️ 取り込みに失敗しました: ${error.message}`);
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>CSVインポート / エクスポート</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <b>インポート（KittingFlow v1.0 形式）</b>
          <div style={{ marginTop: 8 }}>
            <label>Parts.csv: <input type="file" accept=".csv" ref={partsRef} onChange={() => handle(partsRef, "parts")} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Recipe.csv: <input type="file" accept=".csv" ref={recipesRef} onChange={() => handle(recipesRef, "recipes")} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Products.csv: <input type="file" accept=".csv" ref={productsRef} onChange={() => handle(productsRef, "products")} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Progress.csv: <input type="file" accept=".csv" ref={progressRef} onChange={() => handle(progressRef, "progress")} /></label>
          </div>
          <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 8 }}>
            ※ 列名は英語・日本語どちらでも構いません（例: Part ID / 部品ID など）。
          </p>
        </div>

        <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <b>エクスポート</b>
          <p style={{ margin: "8px 0" }}>現在のDB内容を4つのCSV（Parts / Recipe / Products / Progress）で保存します。</p>
          <button onClick={exportAllCSV} style={buttonStyles.primary()} {...exportHoverHandlers}>
            CSVを書き出す
          </button>
        </div>
      </div>
      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
