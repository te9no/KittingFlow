import React, { useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ stock: "", imageUrl: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setParts(await db.parts.toArray());
  }

  async function updatePart(id) {
    const stockNumber = Number(editValues.stock);
    if (!Number.isFinite(stockNumber)) return;
    await db.parts.update(id, {
      stock: stockNumber,
      imageUrl: editValues.imageUrl?.trim() ?? ""
    });
    setEditingId(null);
    setEditValues({ stock: "", imageUrl: "" });
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
  const linkHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.subtle, hoverStyles.subtle, true),
    []
  );

  const updateButtonStyle = buttonStyles.primary();
  const editButtonStyle = buttonStyles.subtle;
  const cancelButtonStyle = { ...buttonStyles.secondary, marginLeft: 8 };
  const linkStyle = { ...buttonStyles.subtle, minWidth: 80, padding: "6px 12px" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>部品一覧 / 在庫</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>部品ID</th>
            <th style={{ textAlign: "left", padding: "8px" }}>部品名</th>
            <th style={{ textAlign: "center", padding: "8px" }}>画像</th>
            <th style={{ textAlign: "right", padding: "8px" }}>在庫</th>
            <th style={{ padding: "8px" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px" }}>{part.id}</td>
              <td style={{ padding: "8px" }}>{part.name}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {part.imageUrl ? (
                  <button
                    onClick={() => window.open(part.imageUrl, "_blank", "noopener")}
                    style={linkStyle}
                    {...linkHoverHandlers}
                  >
                    表示
                  </button>
                ) : (
                  <span style={{ color: "#9ca3af" }}>なし</span>
                )}
              </td>
              <td style={{ padding: "8px", textAlign: "right" }}>{part.stock}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {editingId === part.id ? (
                  <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      在庫
                      <input
                        value={editValues.stock}
                        onChange={(event) => setEditValues((prev) => ({ ...prev, stock: event.target.value }))}
                        style={{ width: 120 }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      画像URL
                      <input
                        value={editValues.imageUrl}
                        onChange={(event) => setEditValues((prev) => ({ ...prev, imageUrl: event.target.value }))}
                        placeholder="https://..."
                        style={{ width: 260 }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => updatePart(part.id)}
                        style={updateButtonStyle}
                        {...updateHoverHandlers}
                      >
                        更新
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditValues({ stock: "", imageUrl: "" });
                        }}
                        style={cancelButtonStyle}
                        {...cancelHoverHandlers}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(part.id);
                      setEditValues({ stock: String(part.stock ?? ""), imageUrl: part.imageUrl ?? "" });
                    }}
                    style={editButtonStyle}
                    {...editHoverHandlers}
                  >
                    編集
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!parts.length && (
            <tr>
              <td colSpan={5} style={{ padding: "12px", textAlign: "center", color: "#666" }}>
                部品がありません。Products.csv を取り込んでください。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
