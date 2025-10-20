import React, { useEffect, useState } from "react";
import { db, getProgress, setProgress, getPartsForProduct } from "../db";

const STATE_READY = "\u51c6\u5099\u4e2d";
const STATE_WORKING = "\u9032\u884c\u4e2d";
const STATE_DONE = "\u5b8c\u4e86";

const LABEL_PICKING = "\u30d4\u30c3\u30ad\u30f3\u30b0";
const LABEL_PRODUCT = "\u88fd\u54c1";
const LABEL_STATE = "\u72b6\u614b";
const LABEL_STAGE = "\u5de5\u7a0b";
const LABEL_STOCK = "\u5728\u5eab";
const LABEL_IMAGE_NONE = "\u753b\u50cf\u306a\u3057";
const LABEL_RESET = "\u30ea\u30bb\u30c3\u30c8";
const LABEL_DONE = "\u5b8c\u4e86";
const LABEL_DONE_ALREADY = "\u5b8c\u4e86\u6e08\u307f";
const LABEL_NEXT = "\u6b21\u3078 \u25b6";

const MSG_ALREADY_DONE = "\u3059\u3067\u306b\u5b8c\u4e86\u6e08\u307f\u3067\u3059";
const MSG_DONE = "\u2705 \u3059\u3079\u3066\u5b8c\u4e86\u3057\u307e\u3057\u305f";
const MSG_NEXT = "\u27a1 \u6b21\u306e\u90e8\u54c1\u3078";
const MSG_RESET = "\u30ea\u30bb\u30c3\u30c8\u3057\u307e\u3057\u305f";
const MSG_NO_RECIPE = "\u30ec\u30b7\u30d4\u304c\u3042\u308a\u307e\u305b\u3093\u3002Recipe.csv \u3092\u8aad\u307f\u8fbc\u3093\u3067\u304f\u3060\u3055\u3044\u3002";

const INITIAL_PROGRESS = { state: STATE_READY, currentIndex: 0 };

export default function PickingUI() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [parts, setParts] = useState([]);
  const [progress, setProg] = useState(INITIAL_PROGRESS);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const productRows = await db.products.toArray();
      setProducts(productRows);
      const firstId = productRows[0]?.id ?? "";
      setProductId(firstId);
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      setParts(await getPartsForProduct(productId));
      setProg(await getProgress(productId));
      setMsg("");
    })();
  }, [productId]);

  const current = parts[progress.currentIndex] ?? null;
  const lastStep = current != null && progress.currentIndex >= parts.length - 1;
  const isCompleted = lastStep && progress.state === STATE_DONE;
  const canProceed = !!current && !isCompleted;

  const buttonLabel = isCompleted ? LABEL_DONE_ALREADY : lastStep ? LABEL_DONE : LABEL_NEXT;

  async function next() {
    if (!current) return;
    if (isCompleted) {
      setMsg(MSG_ALREADY_DONE);
      return;
    }

    const part = await db.parts.get(current.partId);
    if (part) {
      await db.parts.update(part.id, { stock: Number(part.stock) - Number(current.qty) });
    }

    const reachedEnd = progress.currentIndex >= parts.length - 1;
    const nextIndex = reachedEnd ? progress.currentIndex : progress.currentIndex + 1;
    const nextState = reachedEnd ? STATE_DONE : STATE_WORKING;

    await setProgress(productId, { state: nextState, currentIndex: nextIndex });
    setMsg(reachedEnd ? MSG_DONE : MSG_NEXT);

    setParts(await getPartsForProduct(productId));
    setProg(await getProgress(productId));
  }

  async function resetFlow() {
    if (!productId) return;
    await setProgress(productId, { state: STATE_READY, currentIndex: 0 });
    setMsg(MSG_RESET);
    setParts(await getPartsForProduct(productId));
    setProg(await getProgress(productId));
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px", textAlign: "center" }}>
      <h3>{"\uD83D\uDCE6 " + LABEL_PICKING}</h3>

      <div style={{ margin: "8px 0" }}>
        <label>
          {LABEL_PRODUCT}:
          <select value={productId} onChange={(event) => setProductId(event.target.value)} style={{ marginLeft: 8, padding: "6px 8px" }}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{`${product.id} - ${product.name}`}</option>
            ))}
          </select>
        </label>
      </div>

      {!current ? (
        <p style={{ marginTop: 16, color: "#666" }}>{MSG_NO_RECIPE}</p>
      ) : (
        <div>
          <p>
            <b>{LABEL_STATE}:</b> {progress.state} <b>{LABEL_STAGE}:</b> {progress.currentIndex + 1}/{parts.length}
          </p>
          {current.imageUrl ? (
            <img
              src={current.imageUrl}
              alt={current.name}
              width={220}
              height={220}
              style={{ border: "1px solid #ddd", borderRadius: 8 }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                border: "1px dashed #bbb",
                borderRadius: 8,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#777"
              }}
            >
              {LABEL_IMAGE_NONE}
            </div>
          )}
          <p style={{ fontSize: "1.1rem", marginTop: 8 }}>{`${current.name} \u00d7 ${current.qty}`}</p>
          <p style={{ color: "#444" }}>{LABEL_STOCK}: {current.stock}</p>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={next}
              style={{
                fontSize: "1.2rem",
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: canProceed ? "#2563eb" : "#94a3b8",
                color: "#fff",
                cursor: canProceed ? "pointer" : "not-allowed"
              }}
              disabled={!canProceed}
            >
              {buttonLabel}
            </button>
            <button
              onClick={resetFlow}
              style={{ fontSize: "1rem", padding: "8px 16px", borderRadius: 8, border: "1px solid #999", background: "#fff", marginLeft: 8 }}
            >
              {LABEL_RESET}
            </button>
          </div>
          {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}

