import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

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

  const containerStyle = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing(4)
  };

  const tableContainerStyle = {
    ...card({ padding: "0" }),
    overflowX: "auto"
  };

  return (
    <div style={containerStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing(3) }}>
        <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>📜 レシピ一覧（セル編集）</h3>
        <button
          onClick={addRow}
          style={{
            padding: "8px 16px",
            borderRadius: spacing(2),
            border: `1px solid ${palette.primaryDark}`,
            background: palette.primary,
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          + 行を追加
        </button>
      </header>

      {message && (
        <div style={{ marginBottom: spacing(3), padding: `${spacing(2)} ${spacing(3)}`, background: "#fef3c7", border: `1px solid ${palette.warning}33`, borderRadius: spacing(2), color: "#92400e" }}>
          {message}
        </div>
      )}

      <div style={tableContainerStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead style={{ background: palette.surfaceAlt }}>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} style={{ padding: `${spacing(2)} ${spacing(3)}`, textAlign: column.align, fontWeight: 600, borderBottom: `1px solid ${palette.border}` }}>
                  {column.label}
                </th>
              ))}
              <th style={{ padding: `${spacing(2)} ${spacing(3)}`, textAlign: "center", borderBottom: `1px solid ${palette.border}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe, rowIndex) => (
              <tr key={recipe.id} style={{ borderBottom: `1px solid ${palette.border}` }}>
                {COLUMNS.map((column) => {
                  const editableIndex = EDITABLE_KEYS.indexOf(column.key);
                  const isEditable = editableIndex !== -1;
                  return (
                    <td key={column.key} style={{ padding: `${spacing(1.5)} ${spacing(2)}`, textAlign: column.align }}>
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
                            border: `1px solid ${palette.border}`,
                            borderRadius: spacing(1.5),
                            fontSize: typography.size.sm,
                            textAlign: column.align,
                            background: palette.surfaceAlt
                          }}
                        />
                      ) : (
                        <span>{displayValue(recipe.id, column.key) || "—"}</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: `${spacing(1.5)} ${spacing(2)}`, textAlign: "center" }}>
                  <button
                    onClick={() => deleteRow(recipe.id)}
                    style={{
                      padding: "6px 12px",
                      border: `1px solid ${palette.danger}`,
                      borderRadius: spacing(1.5),
                      background: "#fee2e2",
                      color: palette.danger,
                      cursor: "pointer"
                    }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {recipes.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: spacing(3), textAlign: "center", color: palette.textMuted }}>
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
