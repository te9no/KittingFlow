import React, { useEffect, useMemo, useState } from "react";
import { db, getProgress, setProgress, getPartsForProduct } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const STATE_READY = "準備中";
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px"
};

const modalStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  width: "min(420px, 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
  textAlign: "center",
  fontFamily: "Inter, system-ui, sans-serif"
};

const sorters = {
  productId: (a, b) => a.productId.localeCompare(b.productId, "ja"),
  productName: (a, b) => (a.productName || "").localeCompare(b.productName || "", "ja"),
  state: (a, b) => (a.state || "").localeCompare(b.state || "", "ja"),
  progress: (a, b) => {
    const progressA = a.total ? (a.currentIndex + 1) / a.total : 0;
    const progressB = b.total ? (b.currentIndex + 1) / b.total : 0;
    return progressA - progressB;
  }
};

function sortIndicator(active, direction) {
  if (!active) return "";
  return direction === "asc" ? " ▲" : " ▼";
}

export default function ProgressTable() {
  const [rows, setRows] = useState([]);
  const [qrTarget, setQrTarget] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [sortKey, setSortKey] = useState("productId");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const products = await db.products.toArray();
    const list = [];
    for (const product of products) {
      const progress = await getProgress(product.id);
      const parts = await getPartsForProduct(product.id);
      list.push({
        productId: product.id,
        productName: product.name,
        total: parts.length,
        currentIndex: Number(progress.currentIndex ?? 0),
        state: progress.state || STATE_READY
      });
    }
    setRows(list);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    const sorter = sorters[sortKey] || sorters.productId;
    const list = [...rows].sort(sorter);
    return sortDir === "asc" ? list : list.reverse();
  }, [rows, sortKey, sortDir]);

  const operationsCellStyle = useMemo(
    () => ({
      padding: 8,
      display: "grid",
      gridTemplateColumns: "auto auto auto auto",
      alignItems: "center",
      justifyContent: "end",
      gap: 12
    }),
    []
  );

  const stepLabelStyle = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.95rem",
      color: "#1f2937"
    }),
    []
  );

  const resetHoverHandlers = useMemo(
    () => createHoverHandlers(() => ({ ...buttonStyles.secondary }), hoverStyles.secondary, true),
    []
  );
  const deleteHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.danger, hoverStyles.danger, true),
    []
  );
  const qrHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, true),
    []
  );
  const modalCloseHover = useMemo(
    () => createHoverHandlers(() => buttonStyles.secondary, hoverStyles.secondary, true),
    []
  );

  const resetButtonStyle = useMemo(
    () => ({ ...buttonStyles.secondary, minWidth: 90, justifySelf: "end" }),
    []
  );
  const qrButtonStyle = useMemo(
    () => ({ ...buttonStyles.primary(true), minWidth: 120, justifySelf: "end" }),
    []
  );
  const deleteButtonStyle = useMemo(
    () => ({ ...buttonStyles.danger(true), minWidth: 90, justifySelf: "end" }),
    []
  );

  async function reset(productId) {
    await setProgress(productId, { state: STATE_READY, currentIndex: 0 });
    await load();
  }

  async function updateIndex(productId, index, total) {
    const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    await setProgress(productId, { currentIndex: safeIndex });
    await load();
  }

  async function remove(productId) {
    await db.transaction("rw", db.products, db.progress, async () => {
      await db.products.delete(productId);
      await db.progress.delete(productId);
    });
    await load();
  }

  async function openQrModal(row) {
    setQrTarget(row);
    setQrDataUrl("");
    setQrError("");
    setQrLoading(true);
    try {
      const payload = JSON.stringify({ productId: row.productId, productName: row.productName });
      const response = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`
      );
      if (!response.ok) throw new Error("QRコードの生成に失敗しました");
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      setQrError(error.message || "QRコードの取得に失敗しました");
    } finally {
      setQrLoading(false);
    }
  }

  function closeQrModal() {
    setQrTarget(null);
    setQrDataUrl("");
    setQrError("");
  }

  function printQrLabel() {
    if (!qrTarget || !qrDataUrl) return;
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    const labelCss = `
      @page {
        size: 40mm 30mm;
        margin: 2mm;
      }
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', system-ui, sans-serif;
        color: #111827;
      }
      .label {
        text-align: center;
      }
      .label img {
        width: 180px;
        height: 180px;
        object-fit: contain;
      }
      .label h2 {
        font-size: 14px;
        margin: 6px 0 0;
      }
      .label p {
        font-size: 12px;
        margin: 4px 0 0;
      }
    `;
    printWindow.document.write(`
      <html>
        <head>
          <title>${qrTarget.productId} - QR</title>
          <style>${labelCss}</style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR code" />
            <h2>${qrTarget.productId}</h2>
            <p>${qrTarget.productName || ""}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>製造管理</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>
              <button
                onClick={() => toggleSort("productId")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                製品ID{sortIndicator(sortKey === "productId", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: 8 }}>
              <button
                onClick={() => toggleSort("productName")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                製品名{sortIndicator(sortKey === "productName", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "center", padding: 8 }}>
              <button
                onClick={() => toggleSort("state")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                状態{sortIndicator(sortKey === "state", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "center", padding: 8 }}>
              <button
                onClick={() => toggleSort("progress")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                工程{sortIndicator(sortKey === "progress", sortDir)}
              </button>
            </th>
            <th style={{ padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.productId} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: 8 }}>{row.productId}</td>
              <td style={{ padding: 8 }}>{row.productName}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{row.state}</td>
              <td style={{ padding: 8, textAlign: "center" }}>
                {row.total ? `${row.currentIndex + 1}/${row.total}` : "0/0"}
              </td>
              <td style={operationsCellStyle}>
                <button
                  onClick={() => reset(row.productId)}
                  style={resetButtonStyle}
                  {...resetHoverHandlers}
                >
                  リセット
                </button>
                <label style={stepLabelStyle}>
                  <span>工程:</span>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(row.total, 1)}
                    defaultValue={row.total ? row.currentIndex + 1 : 1}
                    onBlur={(event) =>
                      updateIndex(row.productId, Number(event.target.value) - 1, row.total)
                    }
                    style={{ width: 70 }}
                  />
                </label>
                <button
                  onClick={() => openQrModal(row)}
                  style={qrButtonStyle}
                  {...qrHoverHandlers}
                >
                  QRラベル
                </button>
                <button
                  onClick={() => remove(row.productId)}
                  style={deleteButtonStyle}
                  {...deleteHoverHandlers}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
          {!sortedRows.length && (
            <tr>
              <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#666" }}>
                製品がありません。Products.csv を取り込んでください。
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {qrTarget && (
        <div style={modalOverlayStyle} onClick={closeQrModal}>
          <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <h4 style={{ margin: "0 0 12px" }}>QRコードラベル</h4>
            <p style={{ margin: "0 0 16px", color: "#4b5563" }}>
              印刷前にブラウザの印刷設定でラベルサイズを 40mm × 30mm 程度に調整してください。
            </p>
            {qrLoading ? (
              <p style={{ color: "#4b5563" }}>QRコードを生成しています…</p>
            ) : qrError ? (
              <p style={{ color: "#dc2626" }}>{qrError}</p>
            ) : (
              <>
                <img
                  src={qrDataUrl}
                  alt="QRコード"
                  style={{ width: 220, height: 220, objectFit: "contain", marginBottom: 12 }}
                />
                <div style={{ fontSize: 14, color: "#111827", marginBottom: 16 }}>
                  <div>{qrTarget.productId}</div>
                  <div>{qrTarget.productName}</div>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                onClick={printQrLabel}
                style={buttonStyles.primary(Boolean(qrDataUrl && !qrLoading && !qrError))}
                {...createHoverHandlers(
                  buttonStyles.primary,
                  hoverStyles.primary,
                  () => Boolean(qrDataUrl && !qrLoading && !qrError)
                )}
                disabled={!qrDataUrl || qrLoading || Boolean(qrError)}
              >
                印刷
              </button>
              <button
                onClick={closeQrModal}
                style={buttonStyles.secondary}
                {...modalCloseHover}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
