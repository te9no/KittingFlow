import React, { useEffect, useState } from "react";
import { getParts, getProgress, updateProgress } from "../api";

export default function PickingView() {
  const [parts, setParts] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    const [p, pr] = await Promise.all([getParts(), getProgress()]);
    setParts(p);
    setProgress(pr);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>読み込み中...</p>;

  const currentIndex = parts.findIndex(x => x["部品ID"] === progress["現在の部品ID"]);
  const current = currentIndex >= 0 ? parts[currentIndex] : (parts[0] || {});
  const nextPart = currentIndex >= 0 ? parts[currentIndex + 1] : parts[1];

  async function handleNext() {
    if (!nextPart) {
      setMsg("✅ すべて完了しました！");
      return;
    }
    const res = await updateProgress(nextPart["部品ID"]);
    setMsg(res);
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3>📦 ピッキング進行</h3>
      <p><b>製品ID:</b> {progress["製品ID"] || "-"}</p>
      <p><b>状態:</b> {progress["状態"] || "-"}</p>
      <p><b>部品:</b> {current["部品名"]}（必要数 {current["必要数"]}）</p>

      {current["画像URL"] && (
        <img
          src={current["画像URL"]}
          width="220"
          height="220"
          alt={current["部品名"]}
          style={{ borderRadius: 8, border: "1px solid #ccc" }}
        />
      )}

      <p style={{ marginTop: 10 }}>在庫: {current["在庫"]}</p>

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleNext}
          style={{ fontSize: "1.2rem", padding: "0.6rem 2rem", borderRadius: 10, backgroundColor: "#008cff", color: "white", border: "none" }}
        >
          {nextPart ? "次の部品へ ▶" : "完了"}
        </button>
      </div>

      {msg && <p style={{ marginTop: "1rem", color: "#333" }}>{msg}</p>}
    </div>
  );
}
