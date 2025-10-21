import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  db,
  getProgress,
  setProgress,
  getPartsForProduct,
  getProductsWithProgress,
  getProductTemplates,
  createProductInstance,
  PROGRESS_STATE_DONE,
  PROGRESS_STATE_READY
} from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const STATE_READY = PROGRESS_STATE_READY;
const STATE_WORKING = "進行中";
const STATE_DONE = PROGRESS_STATE_DONE;

const LABEL_PICKING = "ピッキング";
const LABEL_PRODUCT = "製品";
const LABEL_STATE = "状態";
const LABEL_STAGE = "工程";
const LABEL_STOCK = "在庫";
const LABEL_IMAGE_NONE = "画像なし";
const LABEL_RESET = "リセット";
const LABEL_DONE = "完了";
const LABEL_DONE_ALREADY = "完了済み";
const LABEL_NEXT = "次へ ▶";
const LABEL_CREATE_SECTION = "新規製造開始";
const LABEL_CREATE = "登録";
const LABEL_TEMPLATE = "商品テンプレート";
const LABEL_CREATED_ID = "新規Fancy ID";
const LABEL_GENERATE = "自動生成";
const MSG_ALREADY_DONE = "すでに完了済みです";
const MSG_DONE = "✅ すべて完了しました";
const MSG_NEXT = "➡ 次の部品へ";
const MSG_RESET = "リセットしました";
const MSG_NO_RECIPE = "レシピがありません。Recipe.csv を読み込んでください。";
const MSG_NO_ACTIVE = "ピッキング対象がありません。新規製造開始を実行してください。";
const MSG_CREATED = "をピッキング対象に追加しました";
const MSG_TEMPLATE_REQUIRED = "テンプレートを選択してください";
const INITIAL_PROGRESS = { state: STATE_READY, currentIndex: 0 };


export default function PickingUI() {
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [productId, setProductId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generatedFancyId, setGeneratedFancyId] = useState("");
  const [parts, setParts] = useState([]);
  const [progress, setProg] = useState(INITIAL_PROGRESS);
  const [msg, setMsg] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const loadProductContext = useCallback(async (targetId) => {
    if (!targetId) {
      setParts([]);
      setProg(INITIAL_PROGRESS);
      return;
    }
    const [partsList, progressData] = await Promise.all([
      getPartsForProduct(targetId),
      getProgress(targetId)
    ]);
    setParts(partsList);
    setProg(progressData);
  }, []);

  const refreshProducts = useCallback(async (preferredId) => {
    const [productRows, templateRows] = await Promise.all([
      getProductsWithProgress(),
      getProductTemplates()
    ]);
    const active = productRows.filter(row => row.progress.state !== STATE_DONE);

    setProducts(active);
    setTemplates(templateRows);
    setSelectedTemplate(prev => {
      if (prev && templateRows.some(t => t.internalId === prev)) return prev;
      return templateRows[0]?.internalId ?? "";
    });

    setProductId(prev => {
      const desired = preferredId ?? prev;
      if (desired && active.some(item => item.id === desired)) {
        return desired;
      }
      return active[0]?.id ?? "";
    });

  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    loadProductContext(productId);
    setMsg("");
  }, [productId, loadProductContext]);

  const current = parts[progress.currentIndex] ?? null;
  const lastStep = current != null && progress.currentIndex >= parts.length - 1;
  const isCompleted = lastStep && progress.state === STATE_DONE;
  const canProceed = !!current && !isCompleted;

  const buttonLabel = isCompleted ? LABEL_DONE_ALREADY : lastStep ? LABEL_DONE : LABEL_NEXT;
  const primaryStyle = useMemo(() => buttonStyles.primary(canProceed), [canProceed]);
  const primaryHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => canProceed),
    [canProceed]
  );
  const resetStyle = useMemo(() => ({ ...buttonStyles.secondary, marginLeft: 8 }), []);
  const resetHoverHandlers = useMemo(
    () => createHoverHandlers(() => ({ ...buttonStyles.secondary, marginLeft: 8 }), hoverStyles.secondary, true),
    []
  );
  const canCreate = Boolean(selectedTemplate);
  const createButtonStyle = useMemo(() => buttonStyles.primary(canCreate), [canCreate]);
  const createHoverHandlersObj = useMemo(

    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => canCreate),
    [canCreate]
  );
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

    await loadProductContext(productId);
    if (reachedEnd) {
      await refreshProducts();
      setShowDialog(true);
    }
  }

  async function resetFlow() {
    if (!productId) return;
    await setProgress(productId, { state: STATE_READY, currentIndex: 0 });
    setMsg(MSG_RESET);
    await loadProductContext(productId);
    await refreshProducts(productId);
  }

  async function createNewProduction() {
    if (!canCreate) {
      setMsg(MSG_TEMPLATE_REQUIRED);
      return;
    }
    try {
      const result = await createProductInstance({ internalId: selectedTemplate });
      setMsg(`${result.name} (${result.id}) ${MSG_CREATED}`);
      setGeneratedFancyId(result.id);
      await refreshProducts(result.id);
    } catch (e) {
      setMsg(e.message || "作成に失敗しました");
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px", textAlign: "center" }}>
      <h3>{"📦 " + LABEL_PICKING}</h3>

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

      {!productId ? (
        <p style={{ marginTop: 16, color: "#666" }}>{MSG_NO_ACTIVE}</p>
      ) : !current ? (
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
          <p style={{ fontSize: "1.1rem", marginTop: 8 }}>{`${current.name} × ${current.qty}`}</p>
          <p style={{ color: "#444" }}>{LABEL_STOCK}: {current.stock}</p>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={next}
              style={primaryStyle}
              {...primaryHoverHandlers}
              disabled={!canProceed}
            >
              {buttonLabel}
            </button>
            <button
              onClick={resetFlow}
              style={resetStyle}
              {...resetHoverHandlers}
            >
              {LABEL_RESET}
            </button>
          </div>
          {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}

      {templates.length > 0 && (
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px", textAlign: "left" }}>
          <b>{LABEL_CREATE_SECTION}</b>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              {LABEL_TEMPLATE}
              <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)} style={{ marginTop: 4 }}>
                {templates.map((template) => (
                  <option key={template.internalId} value={template.internalId}>{`${template.internalId} - ${template.name}`}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span>{LABEL_CREATED_ID}</span>
              <input
                value={generatedFancyId}
                readOnly
                placeholder="未生成"
                style={{ marginTop: 4, width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "#f9fafb" }}
              />
            </div>
            <button
              onClick={createNewProduction}
              disabled={!canCreate}
              style={createButtonStyle}
              {...createHoverHandlersObj}
            >
              {LABEL_CREATE}
            </button>
          </div>
        </div>
      )}
      {showDialog && (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.4)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 999
    }}>
      <div style={{
        background: '#fff', padding: 24, borderRadius: 8, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
      }}>
        <h3>🎉 ピッキング完了！</h3>
        <p>全ての部品のピッキングが完了しました。お疲れさまでした。</p>
        <button onClick={() => setShowDialog(false)} style={{marginTop:12}}>閉じる</button>
      </div>
    </div>
    )}
    </div>
  );
}
