import React, { useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [stockValue, setStockValue] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setParts(await db.parts.toArray());
  }

  async function updateStock(id) {
    const value = Number(stockValue);
    if (!Number.isFinite(value)) return;
    await db.parts.update(id, { stock: value });
    setEditingId(null);
    setStockValue("");
    load();
  }

  const updateHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, true),
    []
  );
  const editHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.subtle, hoverStyles.subtle, true),
    []
  );
  const cancelHoverHandlers = useMemo(
    () => createHoverHandlers(() => ({ ...buttonStyles.secondary, marginLeft: 8 }), hoverStyles.secondary, true),
    []
  );

  const updateButtonStyle = buttonStyles.primary();
  const editButtonStyle = buttonStyles.subtle;
  const cancelButtonStyle = { ...buttonStyles.secondary, marginLeft: 8 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>部品一覧 / 在庫</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>部品ID</th>
            <th style={{ textAlign: "left", padding: "8px" }}>部品名</th>
            <th style={{ textAlign: "right", padding: "8px" }}>在庫</th>
            <th style={{ padding: "8px" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px" }}>{part.id}</td>
              <td style={{ padding: "8px" }}>{part.name}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{part.stock}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {editingId === part.id ? (
                  <span style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
                    <input
                      value={stockValue}
                      onChange={(event) => setStockValue(event.target.value)}
                      style={{ width: 100 }}
                    />
                    <button
                      onClick={() => updateStock(part.id)}
                      style={updateButtonStyle}
                      {...updateHoverHandlers}
                    >
                      更新
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setStockValue("");
                      }}
                      style={cancelButtonStyle}
                      {...cancelHoverHandlers}
                    >
                      キャンセル
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(part.id);
                      setStockValue(String(part.stock ?? ""));
                    }}
                    style={editButtonStyle}
                    {...editHoverHandlers}
                  >
                    在庫を編集
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!parts.length && (
            <tr>
              <td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "#666" }}>
                部品がありません。Products.csv を取り込んでください。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
