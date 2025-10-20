import React, { useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const sorters = {
  id: (a, b) => a.id.localeCompare(b.id, "ja"),
  name: (a, b) => (a.name || "").localeCompare(b.name || "", "ja"),
  stock: (a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0)
};

function renderSortLabel(label, active, direction) {
  if (!active) return label;
  return `${label} ${direction === "asc" ? "▲" : "▼"}`;
}

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ stock: "", imageUrl: "" });
  const [newPart, setNewPart] = useState({ id: "", name: "", stock: "0", imageUrl: "" });
  const [feedback, setFeedback] = useState("");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setParts(await db.parts.toArray());
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedParts = useMemo(() => {
    const sorter = sorters[sortKey] || sorters.id;
    const list = [...parts].sort(sorter);
    return sortDir === "asc" ? list : list.reverse();
  }, [parts, sortKey, sortDir]);

  async function updatePart(id) {
    const stockNumber = Number(editValues.stock);
    if (!Number.isFinite(stockNumber)) return;
    await db.parts.update(id, {
      stock: stockNumber,
      imageUrl: editValues.imageUrl?.trim() ?? ""
    });
    setEditingId(null);
    setEditValues({ stock: "", imageUrl: "" });
    setFeedback("部品を更新しました");
    load();
  }

  async function addPart() {
    const id = newPart.id.trim();
    const name = newPart.name.trim();
    const stockNumber = Number(newPart.stock);
    if (!id) {
      setFeedback("部品IDを入力してください");
      return;
    }
    if (!name) {
      setFeedback("部品名を入力してください");
      return;
    }
    if (!Number.isFinite(stockNumber)) {
      setFeedback("在庫には数値を入力してください");
      return;
    }
    const exists = await db.parts.get(id);
    if (exists) {
      setFeedback("同じ部品IDが既に存在します");
      return;
    }
    await db.parts.add({
      id,
      name,
      stock: stockNumber,
      imageUrl: newPart.imageUrl.trim()
    });
    setNewPart({ id: "", name: "", stock: "0", imageUrl: "" });
    setFeedback("部品を追加しました");
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
  const addButtonStyle = useMemo(
    () => buttonStyles.primary(Boolean(newPart.id.trim() && newPart.name.trim())),
    [newPart.id, newPart.name]
  );
  const addHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => Boolean(newPart.id.trim() && newPart.name.trim())),
    [newPart.id, newPart.name]
  );

  const updateButtonStyle = buttonStyles.primary();
  const editButtonStyle = buttonStyles.subtle;
  const cancelButtonStyle = { ...buttonStyles.secondary, marginLeft: 8 };
  const linkStyle = { ...buttonStyles.subtle, minWidth: 80, padding: "6px 12px" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>部品一覧 / 在庫</h3>
      <div
        style={{
          display: "grid",
          gap: 12,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16
        }}
      >
        <b>部品を追加</b>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            部品ID
            <input
              value={newPart.id}
              onChange={(event) => setNewPart((prev) => ({ ...prev, id: event.target.value }))}
              placeholder="例: P001"
              style={{ padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            部品名
            <input
              value={newPart.name}
              onChange={(event) => setNewPart((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="例: MX Switch"
              style={{ padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            在庫
            <input
              value={newPart.stock}
              onChange={(event) => setNewPart((prev) => ({ ...prev, stock: event.target.value }))}
              type="number"
              min="0"
              style={{ padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            画像URL
            <input
              value={newPart.imageUrl}
              onChange={(event) => setNewPart((prev) => ({ ...prev, imageUrl: event.target.value }))}
              placeholder="https://..."
              style={{ padding: "6px 8px" }}
            />
          </label>
        </div>
        <div>
          <button
            onClick={addPart}
            style={addButtonStyle}
            {...addHoverHandlers}
            disabled={!(newPart.id.trim() && newPart.name.trim())}
          >
            追加
          </button>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>
              <button onClick={() => toggleSort("id")} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>
                {renderSortLabel("部品ID", sortKey === "id", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: "8px" }}>
              <button onClick={() => toggleSort("name")} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>
                {renderSortLabel("部品名", sortKey === "name", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "center", padding: "8px" }}>画像</th>
            <th style={{ textAlign: "right", padding: "8px" }}>
              <button onClick={() => toggleSort("stock")} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>
                {renderSortLabel("在庫", sortKey === "stock", sortDir)}
              </button>
            </th>
            <th style={{ padding: "8px" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {sortedParts.map((part) => (
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
                      <button onClick={() => updatePart(part.id)} style={updateButtonStyle} {...updateHoverHandlers}>
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
          {!sortedParts.length && (
            <tr>
              <td colSpan={5} style={{ padding: "12px", textAlign: "center", color: "#666" }}>
                部品がありません。Products.csv を取り込んでください。
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {feedback && <p style={{ marginTop: 12, color: "#2563eb" }}>{feedback}</p>}
    </div>
  );
}
