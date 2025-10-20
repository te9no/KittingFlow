import React, { useEffect, useMemo, useState } from "react";
import { db } from "../db";

const TITLE = "\uD83D\uDCD8 \u30EC\u30B7\u30D4(\u88FD\u54C1\u2192\u90E8\u54C1\u306E\u5BFE\u5FDC)";
const COLUMN_PRODUCT = "\u88FD\u54C1";
const COLUMN_PART = "\u90E8\u54C1";
const COLUMN_QTY = "\u6570\u91CF";
const COLUMN_ACTION = "\u64CD\u4F5C";
const EMPTY_MESSAGE = "\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002Recipe.csv \u3092\u30A4\u30F3\u30DD\u30FC\u30C8\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
const ADD_ROW_LABEL = "\u884C\u3092\u8FFD\u52A0";
const SELECT_PRODUCT_LABEL = "\u88FD\u54C1\u3092\u9078\u629E";
const SELECT_PART_LABEL = "\u90E8\u54C1\u3092\u9078\u629E";
const ADD_BUTTON_LABEL = "\u8FFD\u52A0";
const DELETE_BUTTON_LABEL = "\u524A\u9664";

export default function RecipeTable() {
  const [recipes, setRecipes] = useState([]);
  const [parts, setParts] = useState([]);
  const [products, setProducts] = useState([]);
  const [newRow, setNewRow] = useState({ productId: "", partId: "", qty: 1 });

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

  const partName = id => partMap.get(id)?.name || id;
  const productLabel = recipe => {
    const byInternal = productMaps.byInternal.get(recipe.productId);
    const byId = productMaps.byId.get(recipe.productId);
    const name = recipe.productName || byInternal?.name || byId?.name || recipe.productId;
    return `${recipe.productId} - ${name}`;
  };

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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <h3>{TITLE}</h3>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead style={{ background: "#eef2f7" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>{COLUMN_PRODUCT}</th>
            <th style={{ textAlign: "left", padding: "8px" }}>{COLUMN_PART}</th>
            <th style={{ textAlign: "right", padding: "8px" }}>{COLUMN_QTY}</th>
            <th style={{ padding: "8px" }}>{COLUMN_ACTION}</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr key={recipe.id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px" }}>{productLabel(recipe)}</td>
              <td style={{ padding: "8px" }}>{`${recipe.partId} - ${partName(recipe.partId)}`}</td>
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
                <button onClick={() => removeRow(recipe.id)}>{DELETE_BUTTON_LABEL}</button>
              </td>
            </tr>
          ))}
          {!recipes.length && (
            <tr>
              <td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "#666" }}>
                {EMPTY_MESSAGE}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px" }}>
        <b>{ADD_ROW_LABEL}</b>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <select value={newRow.productId} onChange={(event) => setNewRow({ ...newRow, productId: event.target.value })}>
            <option value="">{SELECT_PRODUCT_LABEL}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{`${product.id} - ${product.name}`}</option>
            ))}
          </select>
          <select value={newRow.partId} onChange={(event) => setNewRow({ ...newRow, partId: event.target.value })}>
            <option value="">{SELECT_PART_LABEL}</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>{`${part.id} - ${part.name}`}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={newRow.qty}
            onChange={(event) => setNewRow({ ...newRow, qty: event.target.value })}
            style={{ width: 100 }}
          />
          <button onClick={addRow}>{ADD_BUTTON_LABEL}</button>
        </div>
      </div>
    </div>
  );
}
