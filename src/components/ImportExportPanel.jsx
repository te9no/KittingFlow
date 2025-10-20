import React, { useEffect, useMemo, useRef, useState } from "react";
import { exportAllCSV, importCSV } from "../csv";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";
import {
  applyDatasetToDB,
  collectDatasetFromDB,
  loadDatasetFromGist,
  saveDatasetToGist
} from "../gist";

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
  const [gistId, setGistId] = useState(() => localStorage.getItem("kittingflow_gist_id") ?? "");
  const [gistToken, setGistToken] = useState(() => localStorage.getItem("kittingflow_gist_token") ?? "");
  const [gistLoading, setGistLoading] = useState(false);

  const exportHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, true),
    []
  );

  const canImportGist = useMemo(() => Boolean(gistId) && !gistLoading, [gistId, gistLoading]);
  const canExportGist = useMemo(
    () => Boolean(gistId && gistToken) && !gistLoading,
    [gistId, gistToken, gistLoading]
  );

  const gistImportHover = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => canImportGist),
    [canImportGist]
  );
  const gistExportHover = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => canExportGist),
    [canExportGist]
  );
  const gistOpenHover = useMemo(
    () => createHoverHandlers(() => buttonStyles.secondary, hoverStyles.secondary, true),
    []
  );

  useEffect(() => {
    localStorage.setItem("kittingflow_gist_id", gistId);
  }, [gistId]);

  useEffect(() => {
    if (gistToken) {
      localStorage.setItem("kittingflow_gist_token", gistToken);
    } else {
      localStorage.removeItem("kittingflow_gist_token");
    }
  }, [gistToken]);

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

  async function importFromGist() {
    if (!gistId) {
      setMessage("⚠️ Gist ID を入力してください");
      return;
    }
    setGistLoading(true);
    setMessage("⌛ Gist からデータを取得しています…");
    try {
      const dataset = await loadDatasetFromGist(gistId.trim(), gistToken.trim() || undefined);
      await applyDatasetToDB(dataset);
      setMessage("✅ Gist からデータベースへ読み込みました");
    } catch (error) {
      console.error(error);
      setMessage(`⚠️ Gist からの読み込みに失敗しました: ${error.message}`);
    } finally {
      setGistLoading(false);
    }
  }

  async function exportToGist() {
    if (!gistId) {
      setMessage("⚠️ Gist ID を入力してください");
      return;
    }
    if (!gistToken) {
      setMessage("⚠️ Gist に書き込むにはトークンが必要です");
      return;
    }
    setGistLoading(true);
    setMessage("⌛ Gist へデータを書き出しています…");
    try {
      const dataset = await collectDatasetFromDB();
      await saveDatasetToGist(gistId.trim(), gistToken.trim(), dataset);
      setMessage("✅ データを Gist に書き出しました");
    } catch (error) {
      console.error(error);
      setMessage(`⚠️ Gist への書き出しに失敗しました: ${error.message}`);
    } finally {
      setGistLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>データ入出力</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <b>CSVインポート（KittingFlow v1.0 形式）</b>
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
          <b>CSVエクスポート</b>
          <p style={{ margin: "8px 0" }}>現在のDB内容を4つのCSV（Parts / Recipe / Products / Progress）で保存します。</p>
          <button onClick={exportAllCSV} style={buttonStyles.primary()} {...exportHoverHandlers}>
            CSVを書き出す
          </button>
        </div>

        <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <b>GitHub Gist と同期</b>
          <p style={{ margin: "8px 0" }}>
            CSVの代わりに GitHub Gist をバックアップ先として使用できます。データは JSON ファイル（parts.json など）として保存されます。
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              Gist ID
              <input
                value={gistId}
                onChange={(event) => setGistId(event.target.value)}
                placeholder="例: abcd1234ef5678901234"
                style={{ marginTop: 4, width: "100%", boxSizing: "border-box", padding: "6px 8px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              個人アクセストークン（書き込み時に必要）
              <input
                value={gistToken}
                onChange={(event) => setGistToken(event.target.value)}
                placeholder="github_pat_..."
                type="password"
                style={{ marginTop: 4, width: "100%", boxSizing: "border-box", padding: "6px 8px" }}
              />
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={importFromGist}
                disabled={!canImportGist}
                style={buttonStyles.primary(canImportGist)}
                {...gistImportHover}
              >
                Gistから読み込み
              </button>
              <button
                onClick={exportToGist}
                disabled={!canExportGist}
                style={buttonStyles.primary(canExportGist)}
                {...gistExportHover}
              >
                Gistへ書き出し
              </button>
              <button
                onClick={() => {
                  if (!gistId) return;
                  window.open(`https://gist.github.com/${gistId}`, "_blank", "noopener");
                }}
                disabled={!gistId}
                style={{ ...buttonStyles.secondary, minWidth: 120 }}
                {...gistOpenHover}
              >
                Gistを開く
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              トークンはブラウザのローカルストレージに平文で保存されます。共有PCをご利用の際は利用後に削除してください。
            </p>
          </div>
        </div>
      </div>
      {message && <p style={{ marginTop: 10 }}>{message}</p>}
      {gistLoading && <p style={{ marginTop: 10, color: "#2563eb" }}>処理中...</p>}
    </div>
  );
}

