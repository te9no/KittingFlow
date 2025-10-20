import React, { useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const TITLE = "📘 レシピ（製品→部品の対応）";
const COLUMN_PRODUCT = "製品";
const COLUMN_PART = "部品";
const COLUMN_QTY = "数量";
const COLUMN_ACTION = "操作";
const EMPTY_MESSAGE = "データがありません。Recipe.csv をインポートしてください。";
const ADD_ROW_LABEL = "レシピを追加";
const SELECT_PRODUCT_LABEL = "製品を選択";
const SELECT_PART_LABEL = "部品を選択";
const ADD_BUTTON_LABEL = "追加";
const DELETE_BUTTON_LABEL = "削除";

const sorters = {
  product: (a, b, productLabelFn) => productLabelFn(a).localeCompare(productLabelFn(b), "ja"),
  part: (a, b, _, partLabelFn) => partLabelFn(a).localeCompare(partLabelFn(b), "ja"),
  qty: (a, b) => Number(a.qty ?? 0) - Number(b.qty ?? 0)
};

function sortIndicator(active, direction) {
  if (!active) return "";
  return direction === "asc" ? " ▲" : " ▼";
}

export default function RecipeTable() {
  const [recipes, setRecipes] = useState([]);
  const [parts, setParts] = useState([]);
  const [products, setProducts] = useState([]);
  const [newRow, setNewRow] = useState({ productId: "", partId: "", qty: 1 });
  const [sortKey, setSortKey] = useState("product");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [recipeRows, partRows, productRows] = await Promise.all([
      db.recipes.toArray(),
      db.parts.toArray(),
      db.products.toArray()
    ]);
    setRecipes(recipeRows);
    setParts(partRows);
    setProducts(productRows);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const partMap = useMemo(() => {
    const map = new Map();
    for (const part of parts) map.set(part.id, part);
    return map;
  }, [parts]);

  const productMaps = useMemo(() => {
    const byId = new Map();
    const byInternal = new Map();
    for (const product of products) {
      byId.set(product.id, product);
      if (product.internalId) byInternal.set(product.internalId, product);
    }
    return { byId, byInternal };
  }, [products]);

  const partLabel = (recipe) => {
    const p = partMap.get(recipe.partId);
    return `${recipe.partId} - ${p?.name ?? recipe.partId}`;
  };

  const productLabel = (recipe) => {
    const byInternal = productMaps.byInternal.get(recipe.productId);
    const byId = productMaps.byId.get(recipe.productId);
    const name = recipe.productName || byInternal?.name || byId?.name || recipe.productId;
    return `${recipe.productId} - ${name}`;
  };

  const sortedRecipes = useMemo(() => {
    const sorter = sorters[sortKey] || sorters.product;
    const list = [...recipes].sort((a, b) => sorter(a, b, productLabel, partLabel));
    return sortDir === "asc" ? list : list.reverse();
  }, [recipes, sortKey, sortDir]);

  async function saveQty(row, qty) {
    const value = Number(qty);
    if (!Number.isFinite(value) || value <= 0) return;
    await db.recipes.update(row.id, { qty: value });
    load();
  }

  async function removeRow(id) {
    await db.recipes.delete(id);
    load();
  }

  async function addRow() {
    if (!newRow.productId || !newRow.partId) return;
    const product = productMaps.byId.get(newRow.productId) || productMaps.byInternal.get(newRow.productId);
    const productId = product?.internalId || newRow.productId;
    const productNameValue = product?.name || undefined;
    const qty = Number(newRow.qty || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    await db.recipes.add({
      productId,
      productName: productNameValue,
      partId: newRow.partId,
      qty
    });
    setNewRow({ productId: "", partId: "", qty: 1 });
    load();
  }

  const canAdd = Boolean(newRow.productId && newRow.partId && Number(newRow.qty) > 0);
  const addButtonStyle = useMemo(() => buttonStyles.primary(canAdd), [canAdd]);
  const addHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, () => canAdd),
    [canAdd]
  );
  const deleteHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.danger, hoverStyles.danger, true),
    []
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>{TITLE}</h3>

      <div
        style={{
          marginBottom: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12
        }}
      >
        <b>{ADD_ROW_LABEL}</b>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            製品
            <select
              value={newRow.productId}
              onChange={(event) => setNewRow({ ...newRow, productId: event.target.value })}
              style={{ padding: "6px 8px" }}
            >
              <option value="">{SELECT_PRODUCT_LABEL}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{`${product.id} - ${product.name}`}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            部品
            <select
              value={newRow.partId}
              onChange={(event) => setNewRow({ ...newRow, partId: event.target.value })}
              style={{ padding: "6px 8px" }}
            >
              <option value="">{SELECT_PART_LABEL}</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>{`${part.id} - ${part.name ?? part.id}`}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            必要数量
            <input
              type="number"
              min="1"
              value={newRow.qty}
              onChange={(event) => setNewRow({ ...newRow, qty: event.target.value })}
              style={{ padding: "6px 8px" }}
            />
          </label>
        </div>
        <div>
          <button
            onClick={addRow}
            style={addButtonStyle}
            {...addHoverHandlers}
            disabled={!canAdd}
          >
            {ADD_BUTTON_LABEL}
          </button>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>
              <button
                onClick={() => toggleSort("product")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                {COLUMN_PRODUCT}
                {sortIndicator(sortKey === "product", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: "8px" }}>
              <button
                onClick={() => toggleSort("part")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                {COLUMN_PART}
                {sortIndicator(sortKey === "part", sortDir)}
              </button>
            </th>
            <th style={{ textAlign: "right", padding: "8px" }}>
              <button
                onClick={() => toggleSort("qty")}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
              >
                {COLUMN_QTY}
                {sortIndicator(sortKey === "qty", sortDir)}
              </button>
            </th>
            <th style={{ padding: "8px" }}>{COLUMN_ACTION}</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecipes.map((recipe) => (
            <tr key={recipe.id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px" }}>{productLabel(recipe)}</td>
              <td style={{ padding: "8px" }}>{partLabel(recipe)}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>
                <input
                  type="number"
                  min="1"
                  defaultValue={recipe.qty}
                  onBlur={(event) => saveQty(recipe, event.target.value)}
                  style={{ width: 80 }}
                />
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                <button onClick={() => removeRow(recipe.id)} style={buttonStyles.danger()} {...deleteHoverHandlers}>
                  {DELETE_BUTTON_LABEL}
                </button>
              </td>
            </tr>
          ))}
          {!sortedRecipes.length && (
            <tr>
              <td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "#666" }}>
                {EMPTY_MESSAGE}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
