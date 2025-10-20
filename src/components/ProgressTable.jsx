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

const containerStyle = {
  maxWidth: 1100,
  margin: "24px auto 48px",
  padding: "0 16px"
};

const tableWrapperStyle = {
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
  overflow: "hidden"
};

const headerCellStyle = {
  padding: "14px 16px",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  userSelect: "none"
};

const bodyCellStyle = {
  padding: "16px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.95rem",
  color: "#1f2937",
  verticalAlign: "middle",
  background: "#ffffff"
};

const emptyStateStyle = {
  padding: "48px 32px",
  borderRadius: 18,
  background: "rgba(241, 245, 249, 0.65)",
  textAlign: "center",
  color: "#475569",
  fontSize: "0.95rem"
};

const progressBarTrackStyle = {
  height: 10,
  borderRadius: 9999,
  background: "#e2e8f0",
  overflow: "hidden"
};

const progressBarFillStyle = {
  height: "100%",
  borderRadius: 9999,
  background: "linear-gradient(135deg, #22c55e, #16a34a)",
  transition: "width 0.25s ease"
};

const stateBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 9999,
  background: "rgba(59, 130, 246, 0.12)",
  color: "#1d4ed8",
  padding: "6px 14px",
  fontWeight: 600,
  fontSize: "0.85rem"
};

const stepButtonBaseStyle = {
  width: 36,
  height: 36,
  borderRadius: 9999,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#1f2937",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s ease, color 0.2s ease, border 0.2s ease"
};

const modalButtonRowStyle = {
  display: "flex",
  justifyContent: "center",
  gap: 16,
  marginTop: 24,
  flexWrap: "wrap"
};

const qrImageStyle = {
  width: 220,
  height: 220,
  objectFit: "contain",
  borderRadius: 12,
  background: "#f1f5f9",
  padding: 8,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)"
};

const modalErrorStyle = {
  color: "#b91c1c",
  background: "rgba(239, 68, 68, 0.08)",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: "0.95rem",
  fontWeight: 600
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

function escapeHtml(value) {
  if (value == null) return "";
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
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

    const productId = qrTarget.productId || "";
    const productName = qrTarget.productName || "";
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
    const printScript = `
      window.addEventListener('load', () => {
        const img = document.getElementById('qr-image');
        const finish = () => {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 150);
        };
        if (img) {
          if (img.complete) {
            finish();
          } else {
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
          }
        } else {
          finish();
        }
        window.addEventListener('afterprint', () => window.close(), { once: true });
      });
    `;
    const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(productId ? `${productId} - QR` : "QR")}</title>
    <style>${labelCss}</style>
  </head>
  <body>
    <div class="label">
      <img id="qr-image" src="${qrDataUrl}" alt="QR code" />
      <h2>${escapeHtml(productId)}</h2>
      <p>${escapeHtml(productName)}</p>
    </div>
    <script>${printScript}</script>
  </body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function buildStepButtonStyle(disabled) {
    return {
      ...stepButtonBaseStyle,
      background: disabled ? "#f8fafc" : "#fff",
      color: disabled ? "#94a3b8" : "#0f172a",
      borderColor: disabled ? "#e2e8f0" : "#d1d5db",
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : "0 6px 16px rgba(15, 23, 42, 0.12)"
    };
  }

  const hasRows = sortedRows.length > 0;
  const canPrint = Boolean(qrDataUrl) && !qrLoading && !qrError;
  const modalPrintButtonStyle = buttonStyles.primary(canPrint);

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>製造工程の進捗</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.95rem" }}>
            製品ごとのステップ数とQRラベルを管理します
          </p>
        </div>
        <div style={{ color: "#475569", fontWeight: 600, fontSize: "0.95rem" }}>登録数: {rows.length} 件</div>
      </div>

      {hasRows ? (
        <div style={{ overflowX: "auto" }}>
          <div style={tableWrapperStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{ ...headerCellStyle, cursor: "pointer" }}
                    onClick={() => toggleSort("productId")}
                  >
                    製品ID{sortIndicator(sortKey === "productId", sortDir)}
                  </th>
                  <th
                    scope="col"
                    style={{ ...headerCellStyle, cursor: "pointer" }}
                    onClick={() => toggleSort("productName")}
                  >
                    製品名{sortIndicator(sortKey === "productName", sortDir)}
                  </th>
                  <th
                    scope="col"
                    style={{ ...headerCellStyle, cursor: "pointer" }}
                    onClick={() => toggleSort("progress")}
                  >
                    進捗{sortIndicator(sortKey === "progress", sortDir)}
                  </th>
                  <th
                    scope="col"
                    style={{ ...headerCellStyle, cursor: "pointer" }}
                    onClick={() => toggleSort("state")}
                  >
                    状態{sortIndicator(sortKey === "state", sortDir)}
                  </th>
                  <th scope="col" style={{ ...headerCellStyle, textAlign: "right", cursor: "default" }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => {
                  const total = Math.max(row.total, 0);
                  const currentStep = total ? Math.min(row.currentIndex + 1, total) : 0;
                  const progressPercent = total ? Math.min(((currentStep / total) || 0) * 100, 100) : 0;
                  const canDecrease = total > 0 && row.currentIndex > 0;
                  const canIncrease = total > 0 && row.currentIndex < total - 1;
                  const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                  return (
                    <tr key={row.productId} style={{ background: rowBackground }}>
                      <td style={bodyCellStyle}>
                        <div style={{ fontWeight: 700 }}>{row.productId}</div>
                      </td>
                      <td style={bodyCellStyle}>
                        <div style={{ fontSize: "0.98rem" }}>{row.productName || "名称未設定"}</div>
                      </td>
                      <td style={bodyCellStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={progressBarTrackStyle}>
                            <div
                              style={{
                                ...progressBarFillStyle,
                                width: `${progressPercent}%`,
                                background:
                                  progressPercent >= 99
                                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                                    : progressBarFillStyle.background
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#475569",
                              display: "flex",
                              justifyContent: "space-between"
                            }}
                          >
                            <span>
                              {total
                                ? `工程 ${currentStep} / ${total}`
                                : "レシピに紐づく部品が登録されていません"}
                            </span>
                            {total ? <span>{Math.round(progressPercent)}%</span> : null}
                          </div>
                        </div>
                      </td>
                      <td style={bodyCellStyle}>
                        <span style={stateBadgeStyle}>{row.state || STATE_READY}</span>
                      </td>
                      <td style={{ ...bodyCellStyle, borderBottom: "1px solid #f1f5f9" }}>
                        <div style={operationsCellStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "end" }}>
                            <button
                              type="button"
                              onClick={() => updateIndex(row.productId, row.currentIndex - 1, total)}
                              disabled={!canDecrease}
                              style={buildStepButtonStyle(!canDecrease)}
                              aria-label="前の工程へ戻す"
                            >
                              −
                            </button>
                            <div style={stepLabelStyle}>
                              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>現在</span>
                              <strong>{total ? `${currentStep}/${total}` : "-"}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateIndex(row.productId, row.currentIndex + 1, total)}
                              disabled={!canIncrease}
                              style={buildStepButtonStyle(!canIncrease)}
                              aria-label="次の工程へ進める"
                            >
                              ＋
                            </button>
                          </div>
                          <button
                            type="button"
                            style={resetButtonStyle}
                            {...resetHoverHandlers}
                            onClick={() => reset(row.productId)}
                          >
                            リセット
                          </button>
                          <button
                            type="button"
                            style={qrButtonStyle}
                            {...qrHoverHandlers}
                            onClick={() => openQrModal(row)}
                          >
                            QRラベル
                          </button>
                          <button
                            type="button"
                            style={deleteButtonStyle}
                            {...deleteHoverHandlers}
                            onClick={() => remove(row.productId)}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 8 }}>製品がまだ登録されていません</div>
          <div>「製品」タブから製品を登録すると、この画面で進捗管理とQRラベル出力ができます。</div>
        </div>
      )}

      {qrTarget ? (
        <div style={modalOverlayStyle} onClick={closeQrModal}>
          <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.35rem", color: "#0f172a" }}>
              {qrTarget.productId} のQRラベル
            </h3>
            <p style={{ margin: "0 0 16px", color: "#475569" }}>{qrTarget.productName || "名称未設定"}</p>
            {qrError ? <div style={modalErrorStyle}>{qrError}</div> : null}
            {qrLoading ? (
              <div style={{ margin: "32px 0", color: "#475569", fontWeight: 600 }}>QRコードを生成中です…</div>
            ) : (
              qrDataUrl && <img src={qrDataUrl} alt="QR code" style={qrImageStyle} />
            )}
            <div style={modalButtonRowStyle}>
              <button
                type="button"
                onClick={printQrLabel}
                style={modalPrintButtonStyle}
                disabled={!canPrint}
              >
                印刷する
              </button>
              <button
                type="button"
                style={{ ...buttonStyles.secondary, minWidth: 140 }}
                {...modalCloseHover}
                onClick={closeQrModal}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
