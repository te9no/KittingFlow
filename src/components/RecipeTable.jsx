import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db";

const COLUMNS = [
  { key: "productId", label: "製品ID", align: "left" },
  { key: "productName", label: "製品名", align: "left" },
  { key: "partId", label: "部品ID", align: "left" },
  { key: "partName", label: "部品名", align: "left", editable: false },
  { key: "qty", label: "必要数", align: "right", type: "number" }
];

const EDITABLE_COLUMNS = COLUMNS.filter((column) => column.editable !== false);
const EDITABLE_KEYS = EDITABLE_COLUMNS.map((c) => c.key);

export default function RecipeTable() {
  const [recipes, setRecipes] = useState([]);
  const [parts, setParts] = useState([]);
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [pendingFocus, setPendingFocus] = useState(null);
  const cellRefs = useRef({});

  const load = useCallback(async () => {
    const [recipeRows, partRows, productRows] = await Promise.all([
      db.recipes.toArray(),
      db.parts.toArray(),
      db.products.toArray()
    ]);
    setRecipes(recipeRows);
    setParts(partRows);
    setProducts(productRows);
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
  }, [recipes, pendingFocus]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const productMaps = useMemo(() => {
    const byId = new Map();
    const byInternal = new Map();
    for (const product of products) {
      byId.set(product.id, product);
      if (product.internalId) byInternal.set(product.internalId, product);
    }
    return { byId, byInternal };
  }, [products]);

  const partMap = useMemo(() => {
    const map = new Map();
    for (const part of parts) {
      map.set(part.id, part);
    }
    return map;
  }, [parts]);

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

  const findOriginal = (id) => recipes.find((recipe) => recipe.id === id);

  const fallbackProductName = (recipe) => {
    if (!recipe) return "";
    const product =
      productMaps.byInternal.get(recipe.productId) ||
      productMaps.byId.get(recipe.productId);
    return product?.name ?? recipe.productName ?? "";
  };

  const displayValue = (id, field) => {
    const draft = drafts[id]?.[field];
    if (draft !== undefined) return draft;
    const original = findOriginal(id);
    if (!original) return "";
    switch (field) {
      case "qty":
        return original.qty == null ? "" : String(original.qty);
      case "productName":
        return fallbackProductName(original);
      case "partName": {
        const part = partMap.get(original.partId);
        return part?.name ?? original.partName ?? "";
      }
      default:
        return original[field] ?? "";
    }
  };

  const buildRecipePatch = (updates) => {
    const patch = {};
    for (const [field, raw] of Object.entries(updates)) {
      switch (field) {
        case "productId":
          patch.productId = String(raw ?? "").trim();
          break;
        case "productName":
          patch.productName = String(raw ?? "").trim();
          break;
        case "partId":
          patch.partId = String(raw ?? "").trim();
          break;
        case "qty": {
          const num = Number(raw);
          if (!Number.isFinite(num) || num <= 0) {
            return { error: "必要数には 1 以上の数値を入力してください" };
          }
          patch.qty = num;
          break;
        }
        default:
          patch[field] = raw;
      }
    }
    return { patch };
  };

  const handleBlur = async (id, field) => {
    const rowDraft = drafts[id];
    if (!rowDraft || !(field in rowDraft)) return;
    const original = findOriginal(id);
    if (!original) {
      clearDraft(id, field);
      return;
    }

    const { patch, error } = buildRecipePatch({ [field]: rowDraft[field] });
    if (error) {
      setMessage(error);
      return;
    }

    if (field === "productId") {
      const product =
        productMaps.byInternal.get(patch.productId) ||
        productMaps.byId.get(patch.productId);
      if (product?.name) {
        patch.productName = product.name;
      }
    }

    if (field === "partId") {
      const part = partMap.get(patch.partId);
      if (!part && patch.partId) {
        setMessage(`部品ID「${patch.partId}」は登録されていません`);
        patch.partName = "";
      } else if (part?.name) {
        patch.partName = part.name;
      } else {
        patch.partName = "";
      }
    }

    const same =
      field === "qty"
        ? Number(original.qty ?? 0) === Number(patch.qty ?? 0)
        : String(original[field] ?? "") === String(patch[field] ?? "");
    if (same) {
      clearDraft(id, field);
      return;
    }

    try {
      await db.recipes.update(id, patch);
      setMessage("レシピを更新しました");
      await load();
    } catch (error) {
      console.error(error);
      setMessage("レシピの更新に失敗しました");
    }

    clearDraft(id, field);
  };

  const handleKeyDown = (event, rowIndex, columnIndex) => {
    const { key, shiftKey } = event;
    const navigate = (nextRow, nextCol) => {
      if (nextCol < 0 || nextCol >= EDITABLE_KEYS.length) return;
      const row = recipes[nextRow];
      if (!row) return;
      const keyRef = `${row.id}:${EDITABLE_KEYS[nextCol]}`;
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
    const newId = await db.recipes.add({ productId: "", productName: "", partId: "", partName: "", qty: 1 });
    await load();
    setDrafts((prev) => ({
      ...prev,
      [newId]: { productId: "", productName: "", partId: "", qty: "1", partName: "" }
    }));
    setPendingFocus({ id: newId, field: "productId" });
    setMessage("空のレシピ行を追加しました");
  };

  const deleteRow = async (id) => {
    const original = findOriginal(id);
    const label = original
      ? `${original.productId || "?"} / ${original.partId || "?"}`
      : id;
    if (!window.confirm(`レシピ「${label}」を削除しますか？`)) return;
    await db.recipes.delete(id);
    setMessage("レシピを削除しました");
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
        <h3 style={{ margin: 0 }}>📜 レシピ一覧（Excel風編集）</h3>
        <button onClick={addRow} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff" }}>
          + 行を追加
        </button>
      </header>

      {message && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, color: "#92400e" }}>
          {message}
        </div>
      )}

      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
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
            {recipes.map((recipe, rowIndex) => (
              <tr key={recipe.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {COLUMNS.map((column) => {
                  const editableIndex = EDITABLE_KEYS.indexOf(column.key);
                  const isEditable = editableIndex !== -1;
                  return (
                    <td key={column.key} style={{ padding: "4px 8px", textAlign: column.align }}>
                      {isEditable ? (
                        <input
                          ref={(node) => {
                            const key = `${recipe.id}:${column.key}`;
                            if (node) cellRefs.current[key] = node;
                            else delete cellRefs.current[key];
                          }}
                          type={column.type === "number" ? "number" : "text"}
                          value={displayValue(recipe.id, column.key)}
                          onChange={(event) => setDraftValue(recipe.id, column.key, event.target.value)}
                          onBlur={() => handleBlur(recipe.id, column.key)}
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, editableIndex)}
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
                      ) : (
                        <span>{displayValue(recipe.id, column.key) || "—"}</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                  <button
                    onClick={() => deleteRow(recipe.id)}
                    style={{ padding: "4px 8px", border: "1px solid #dc2626", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {recipes.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                  レシピデータがありません。CSV のインポートまたは行の追加を行ってください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
