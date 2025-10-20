import React, { useEffect, useMemo, useState } from "react";
import { db, getProgress, setProgress, getPartsForProduct } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const STATE_READY = "準備中";

export default function ProgressTable() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const resetHoverHandlers = useMemo(
    () => createHoverHandlers(() => ({ ...buttonStyles.secondary }), hoverStyles.secondary, true),
    []
  );
  const deleteHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.danger, hoverStyles.danger, true),
    []
  );

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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>製造管理</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>製品ID</th>
            <th style={{ textAlign: "left", padding: 8 }}>製品名</th>
            <th style={{ textAlign: "center", padding: 8 }}>状態</th>
            <th style={{ textAlign: "center", padding: 8 }}>工程</th>
            <th style={{ padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: 8 }}>{row.productId}</td>
              <td style={{ padding: 8 }}>{row.productName}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{row.state}</td>
              <td style={{ padding: 8, textAlign: "center" }}>
                {row.total ? `${row.currentIndex + 1}/${row.total}` : "0/0"}
              </td>
              <td
                style={{
                  padding: 8,
                  textAlign: "center",
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap"
                }}
              >
                <button
                  onClick={() => reset(row.productId)}
                  style={buttonStyles.secondary}
                  {...resetHoverHandlers}
                >
                  リセット
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
                  onClick={() => remove(row.productId)}
                  style={buttonStyles.danger()}
                  {...deleteHoverHandlers}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#666" }}>
                製品がありません。Products.csv を取り込んでください。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

