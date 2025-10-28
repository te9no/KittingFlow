import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db";

const COLUMNS = [
  { key: "id", label: "部品ID", align: "left" },
  { key: "name", label: "名称", align: "left" },
  { key: "stock", label: "在庫", align: "right", type: "number" },
  { key: "imageUrl", label: "画像URL", align: "left" }
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);
const PLACEHOLDER_PREFIX = "__tmp_part__";

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [pendingFocus, setPendingFocus] = useState(null);
  const cellRefs = useRef({});

  const load = useCallback(async () => {
    setParts(await db.parts.toArray());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pendingFocus) return;
    const key = `${pendingFocus.id}:${pendingFocus.field}`;
    const node = cellRefs.current[key];
    if (node) {
      node.focus();
      node.select();
      setPendingFocus(null);
    }
  }, [parts, pendingFocus]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const setDraftValue = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  const clearDraft = (id, field) => {
    setDrafts((prev) => {
      const next = { ...(prev || {}) };
      if (!next[id]) return next;
      const row = { ...next[id] };
      delete row[field];
      if (Object.keys(row).length === 0) {
        delete next[id];
      } else {
        next[id] = row;
      }
      return next;
    });
  };

  const findOriginal = (id) => parts.find((part) => part.id === id);

  const displayValue = (id, field) => {
    const draft = drafts[id]?.[field];
    if (draft !== undefined) return draft;
    const original = findOriginal(id);
    if (!original) return "";
    if (field === "stock") {
      if (original.stock === null || original.stock === undefined) return "";
      return String(original.stock);
    }
    if (field === "id" && original.id.startsWith(PLACEHOLDER_PREFIX)) {
      return "";
    }
    return original[field] ?? "";
  };

  const buildPartPatch = (updates) => {
    const patch = {};
    for (const [field, raw] of Object.entries(updates)) {
      if (raw === undefined) continue;
      switch (field) {
        case "name":
          patch.name = String(raw).trim();
          break;
        case "imageUrl":
          patch.imageUrl = String(raw).trim();
          break;
        case "stock": {
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            return { error: "在庫には数値を入力してください" };
          }
          patch.stock = num;
          break;
        }
        case "id":
          patch.id = String(raw).trim();
          break;
        default:
          patch[field] = raw;
      }
    }
    return { patch };
  };

  const renamePart = async (currentId, nextId, additionalPatch = {}) => {
    const trimmed = String(nextId).trim();
    const original = findOriginal(currentId);
    if (!original) return;

    if (!trimmed) {
      setMessage("部品IDを入力してください");
      return;
    }

    try {
      if (trimmed === currentId) {
        if (Object.keys(additionalPatch).length === 0) {
          clearDraft(currentId, "id");
          return;
        }
        await db.parts.update(currentId, additionalPatch);
        setMessage("部品情報を更新しました");
      } else {
        await db.transaction("rw", db.parts, db.recipes, async () => {
          const duplicate = await db.parts.get(trimmed);
          if (duplicate) {
            const err = new Error("duplicate");
            err.code = "duplicate";
            throw err;
          }
          const fresh = await db.parts.get(currentId);
          if (!fresh) return;
          const updated = { ...fresh, ...additionalPatch, id: trimmed };
          await db.parts.delete(currentId);
          await db.parts.add(updated);
          await db.recipes.where({ partId: currentId }).modify({ partId: trimmed });
        });
        setMessage(`部品IDを ${currentId} から ${trimmed} に更新しました`);
      }
      await load();
      setDrafts((prev) => {
        const next = { ...(prev || {}) };
        const row = { ...(next[currentId] || {}) };
        delete row.id;
        delete next[currentId];
        if (Object.keys(row).length > 0) {
          next[trimmed] = { ...(next[trimmed] || {}), ...row };
        }
        return next;
      });
      setPendingFocus({ id: trimmed, field: "id" });
    } catch (error) {
      if (error?.code === "duplicate") {
        setMessage(`部品ID「${trimmed}」は既に存在します`);
      } else {
        console.error(error);
        setMessage("部品IDの更新に失敗しました");
      }
    }
  };

  const handleBlur = async (id, field) => {
    const rowDraft = drafts[id];
    if (!rowDraft || !(field in rowDraft)) return;

    if (field === "id") {
      const { patch, error } = buildPartPatch({ ...rowDraft, id: rowDraft.id });
      if (error) {
        setMessage(error);
        return;
      }
      const { id: nextId, ...rest } = patch;
      await renamePart(id, nextId, rest);
      clearDraft(id, "id");
      return;
    }

    const { patch, error } = buildPartPatch({ [field]: rowDraft[field] });
    if (error) {
      setMessage(error);
      return;
    }
    const sanitizedValue = patch[field];
    const original = findOriginal(id);
    if (!original) {
      clearDraft(id, field);
      return;
    }
    const same =
      field === "stock"
        ? Number(original.stock ?? 0) === Number(sanitizedValue ?? 0)
        : String(original[field] ?? "") === String(sanitizedValue ?? "");
    if (same) {
      clearDraft(id, field);
      return;
    }
    try {
      await db.parts.update(id, patch);
      setMessage("部品情報を更新しました");
      await load();
    } catch (error) {
      console.error(error);
      setMessage("更新に失敗しました");
    }
    clearDraft(id, field);
  };

  const handleKeyDown = (event, rowIndex, columnIndex) => {
    const { key, shiftKey } = event;
    const navigate = (nextRow, nextCol) => {
      if (nextCol < 0 || nextCol >= COLUMN_KEYS.length) return;
      const row = parts[nextRow];
      if (!row) return;
      const keyRef = `${row.id}:${COLUMN_KEYS[nextCol]}`;
      const node = cellRefs.current[keyRef];
      if (node) {
        event.preventDefault();
        node.focus();
        node.select();
      }
    };

    if (key === "Enter") {
      event.preventDefault();
      navigate(rowIndex + (shiftKey ? -1 : 1), columnIndex);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      navigate(rowIndex + 1, columnIndex);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      navigate(rowIndex - 1, columnIndex);
    } else if (key === "ArrowLeft") {
      navigate(rowIndex, columnIndex - 1);
    } else if (key === "ArrowRight") {
      navigate(rowIndex, columnIndex + 1);
    }
  };

  const addRow = async () => {
    const placeholderId = `${PLACEHOLDER_PREFIX}${Date.now()}`;
    await db.parts.add({ id: placeholderId, name: "", stock: 0, imageUrl: "" });
    await load();
    setDrafts((prev) => ({
      ...prev,
      [placeholderId]: { id: "", name: "", stock: "", imageUrl: "" }
    }));
    setPendingFocus({ id: placeholderId, field: "id" });
    setMessage("空行を追加しました");
  };

  const deleteRow = async (id) => {
    const original = findOriginal(id);
    if (!original) return;
    if (!window.confirm(`部品「${original.name || id}」を削除しますか？`)) return;
    await db.transaction("rw", db.parts, db.recipes, async () => {
      await db.parts.delete(id);
      await db.recipes.where({ partId: id }).delete();
    });
    setMessage("部品を削除しました");
    await load();
    setDrafts((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>🧩 部品一覧（Excel風編集）</h3>
        <button onClick={addRow} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff" }}>
          + 行を追加
        </button>
      </header>

      {message && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, color: "#1d4ed8" }}>
          {message}
        </div>
      )}

      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead style={{ background: "#f3f4f6" }}>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} style={{ padding: "8px 12px", textAlign: column.align, fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>
                  {column.label}
                </th>
              ))}
              <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part, rowIndex) => (
              <tr key={part.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {COLUMNS.map((column, columnIndex) => (
                  <td key={column.key} style={{ padding: "4px 8px", textAlign: column.align, verticalAlign: "middle" }}>
                    <input
                      ref={(node) => {
                        const key = `${part.id}:${column.key}`;
                        if (node) cellRefs.current[key] = node;
                        else delete cellRefs.current[key];
                      }}
                      type={column.type === "number" ? "number" : "text"}
                      value={displayValue(part.id, column.key)}
                      onChange={(event) => setDraftValue(part.id, column.key, event.target.value)}
                      onBlur={() => handleBlur(part.id, column.key)}
                      onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        fontSize: "0.9rem",
                        textAlign: column.align
                      }}
                    />
                  </td>
                ))}
                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                  <button
                    onClick={() => deleteRow(part.id)}
                    style={{ padding: "4px 8px", border: "1px solid #dc2626", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {parts.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                  部品データがありません。CSV のインポートまたは行の追加を行ってください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
