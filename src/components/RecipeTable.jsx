import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

const t = {
  recipeEdit: "\u30ec\u30b7\u30d4\u7de8\u96c6",
  headerHelp: "\u30c9\u30e9\u30c3\u30b0\u3067\u8ffd\u52a0\u3057\u3001\u7d30\u304b\u3044\u6570\u5024\u306f\u8868\u3067\u76f4\u63a5\u7de8\u96c6\u3067\u304d\u307e\u3059\u3002",
  dragEdit: "\u30c9\u30e9\u30c3\u30b0\u7de8\u96c6",
  tableEdit: "\u8868\u7de8\u96c6",
  addRow: "+ \u884c\u3092\u8ffd\u52a0",
  productId: "\u88fd\u54c1ID",
  productName: "\u88fd\u54c1\u540d",
  partId: "\u90e8\u54c1ID",
  partName: "\u90e8\u54c1\u540d",
  qty: "\u5fc5\u8981\u6570",
  choosePart: "\u90e8\u54c1\u3092\u9078\u3076",
  choosePartHelp: "\u30af\u30ea\u30c3\u30af\u3067\u9078\u629e\u3001\u307e\u305f\u306f\u30c9\u30e9\u30c3\u30b0\u3057\u3066\u53f3\u5074\u306e\u30b0\u30eb\u30fc\u30d7\u3078\u5165\u308c\u307e\u3059\u3002",
  editGroups: "\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u3092\u7de8\u96c6\u3059\u308b",
  newGroup: "\u65b0\u3057\u3044\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7",
  newGroupHelp: "\u88fd\u54c1ID\u3068\u540d\u524d\u3092\u5165\u529b\u3057\u3066\u3001\u7a7a\u306e\u30b0\u30eb\u30fc\u30d7\u3092\u4f5c\u6210\u3057\u307e\u3059\u3002",
  add: "\u8ffd\u52a0",
  addSelectedPart: "\u9078\u629e\u90e8\u54c1\u3092\u8ffd\u52a0",
  rename: "\u540d\u524d\u3092\u5909\u66f4",
  save: "\u4fdd\u5b58",
  duplicateGroup: "\u3053\u306e\u30b0\u30eb\u30fc\u30d7\u3092\u8907\u88fd",
  duplicate: "\u8907\u88fd",
  registeredParts: "\u767b\u9332\u90e8\u54c1",
  deleteGroup: "\u30b0\u30eb\u30fc\u30d7\u524a\u9664",
  delete: "\u524a\u9664",
  operation: "\u64cd\u4f5c",
  noParts: "\u90e8\u54c1\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
  noGroups: "\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u304c\u3042\u308a\u307e\u305b\u3093\u3002\u4e0a\u306e\u30d5\u30a9\u30fc\u30e0\u304b\u3089\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  dropHere: "\u3053\u3053\u306b\u90e8\u54c1\u3092\u30c9\u30ed\u30c3\u30d7\u3001\u307e\u305f\u306f\u9078\u629e\u90e8\u54c1\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  emptyRecipes: "\u30ec\u30b7\u30d4\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002CSV \u306e\u30a4\u30f3\u30dd\u30fc\u30c8\u3001\u307e\u305f\u306f\u884c\u306e\u8ffd\u52a0\u3092\u884c\u3063\u3066\u304f\u3060\u3055\u3044\u3002",
  dragHelp: "\u90e8\u54c1\u3092\u9078\u3093\u3067\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u3078\u8ffd\u52a0\u3057\u307e\u3059\u3002\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u306e\u4f5c\u6210\u3001\u540d\u524d\u5909\u66f4\u3001\u8907\u88fd\u3001\u524a\u9664\u3082\u3053\u3053\u3067\u884c\u3048\u307e\u3059\u3002",
  stock: "\u5728\u5eab"
};

const COLUMNS = [
  { key: "productId", label: t.productId, editable: true },
  { key: "productName", label: t.productName, editable: true },
  { key: "partId", label: t.partId, editable: true },
  { key: "partName", label: t.partName, editable: false },
  { key: "qty", label: t.qty, editable: true, type: "number" }
];

const inputStyle = (hasError = false) => ({
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  border: `1px solid ${hasError ? palette.danger : palette.border}`,
  borderRadius: spacing(1.5),
  background: hasError ? "#fff1f2" : palette.surfaceAlt,
  color: palette.text
});

export default function RecipeTable() {
  const [recipes, setRecipes] = useState([]);
  const [parts, setParts] = useState([]);
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [draggingPartId, setDraggingPartId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [editMode, setEditMode] = useState("drag");
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupNameDrafts, setGroupNameDrafts] = useState({});
  const [duplicateDrafts, setDuplicateDrafts] = useState({});

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const partMap = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);

  const productMap = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      if (product.id) map.set(product.id, product);
      if (product.internalId) map.set(product.internalId, product);
    }
    return map;
  }, [products]);

  const productGroups = useMemo(() => {
    const groups = new Map();

    for (const product of products) {
      if (product.status !== "template") continue;
      const productId = product.internalId || product.id;
      if (!productId) continue;
      groups.set(productId, {
        productId,
        productName: product.name || productId,
        recipes: []
      });
    }

    for (const recipe of recipes) {
      if (!recipe.productId) continue;
      if (!groups.has(recipe.productId)) {
        groups.set(recipe.productId, {
          productId: recipe.productId,
          productName: recipe.productName || recipe.productId,
          recipes: []
        });
      }
      groups.get(recipe.productId).recipes.push(recipe);
    }

    return Array.from(groups.values()).sort((a, b) => a.productId.localeCompare(b.productId));
  }, [products, recipes]);

  const productOptions = useMemo(() => {
    const ids = new Set();
    for (const product of products) {
      if (product.id) ids.add(product.id);
      if (product.internalId) ids.add(product.internalId);
    }
    for (const recipe of recipes) {
      if (recipe.productId) ids.add(recipe.productId);
    }
    return Array.from(ids).sort();
  }, [products, recipes]);

  const partOptions = useMemo(() => parts.map((part) => part.id).sort(), [parts]);

  const getPartName = useCallback(
    (partId) => partMap.get(partId)?.name || partId || "-",
    [partMap]
  );

  const normalizeRecipePatch = (field, rawValue) => {
    if (field === "qty") {
      const qty = Number(rawValue);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { error: "\u5fc5\u8981\u6570\u306b\u306f 1 \u4ee5\u4e0a\u306e\u6570\u5024\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002" };
      }
      return { patch: { qty } };
    }

    const value = String(rawValue ?? "").trim();
    const patch = { [field]: value };

    if (field === "productId") {
      const product = productMap.get(value);
      if (product?.name) patch.productName = product.name;
    }

    if (field === "partId") {
      const part = partMap.get(value);
      if (!part && value) return { error: `\u90e8\u54c1ID\u300c${value}\u300d\u306f\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002` };
      patch.partName = part?.name || "";
    }

    return { patch };
  };

  const updateRecipe = async (id, field, value) => {
    const { patch, error } = normalizeRecipePatch(field, value);
    if (error) {
      setMessage(error);
      return;
    }

    try {
      await db.recipes.update(id, patch);
      setMessage("\u30ec\u30b7\u30d4\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002");
      await load();
    } catch (error) {
      console.error(error);
      setMessage("\u30ec\u30b7\u30d4\u306e\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
    }
  };

  const addEmptyRow = async () => {
    await db.recipes.add({ productId: "", productName: "", partId: "", partName: "", qty: 1 });
    setMessage("\u7a7a\u306e\u30ec\u30b7\u30d4\u884c\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002");
    await load();
  };

  const duplicateRecipe = async (recipe) => {
    await db.recipes.add({
      productId: recipe.productId || "",
      productName: recipe.productName || "",
      partId: recipe.partId || "",
      partName: recipe.partName || "",
      qty: Number(recipe.qty || 1)
    });
    setMessage("\u30ec\u30b7\u30d4\u3092\u8907\u88fd\u3057\u307e\u3057\u305f\u3002");
    await load();
  };

  const deleteRecipe = async (recipe) => {
    const label = `${recipe.productId || "?"} / ${recipe.partId || "?"}`;
    if (!window.confirm(`\u30ec\u30b7\u30d4\u300c${label}\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f`)) return;
    await db.recipes.delete(recipe.id);
    setMessage("\u30ec\u30b7\u30d4\u3092\u524a\u9664\u3057\u307e\u3057\u305f\u3002");
    await load();
  };

  const removeRecipeFromGroup = async (recipe) => {
    await db.recipes.delete(recipe.id);
    setMessage(`${getPartName(recipe.partId)} \u3092\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u304b\u3089\u524a\u9664\u3057\u307e\u3057\u305f\u3002`);
    await load();
  };

  const addProductGroup = async () => {
    const productId = newGroupId.trim();
    const productName = newGroupName.trim() || productId;

    if (!productId) {
      setMessage("\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7ID\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    if (productGroups.some((group) => group.productId === productId)) {
      setMessage(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u300c${productId}\u300d\u306f\u65e2\u306b\u3042\u308a\u307e\u3059\u3002`);
      return;
    }

    if (await db.products.get(productId)) {
      setMessage(`\u88fd\u54c1ID\u300c${productId}\u300d\u306f\u65e2\u306b\u4f7f\u308f\u308c\u3066\u3044\u307e\u3059\u3002\u5225\u306eID\u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
      return;
    }

    await db.products.add({ id: productId, name: productName, internalId: productId, status: "template" });
    setNewGroupId("");
    setNewGroupName("");
    setMessage(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u300c${productName}\u300d\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002`);
    await load();
  };

  const deleteProductGroup = async (group) => {
    const count = group.recipes.length;
    const suffix = count ? `\u95a2\u9023\u3059\u308b\u30ec\u30b7\u30d4 ${count} \u4ef6\u3082\u524a\u9664\u3055\u308c\u307e\u3059\u3002` : "\u7a7a\u306e\u30b0\u30eb\u30fc\u30d7\u3092\u524a\u9664\u3057\u307e\u3059\u3002";
    if (!window.confirm(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u300c${group.productName}\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f\n${suffix}`)) return;

    await db.transaction("rw", db.products, db.recipes, async () => {
      const relatedRecipes = await db.recipes.where("productId").equals(group.productId).toArray();
      await db.recipes.bulkDelete(relatedRecipes.map((recipe) => recipe.id));
      const templateProducts = products.filter((product) => product.status === "template" && (product.id === group.productId || product.internalId === group.productId));
      if (templateProducts.length) await db.products.bulkDelete(templateProducts.map((product) => product.id));
    });

    setMessage(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u300c${group.productName}\u300d\u3092\u524a\u9664\u3057\u307e\u3057\u305f\u3002`);
    await load();
  };

  const setGroupNameDraft = (productId, value) => setGroupNameDrafts((prev) => ({ ...prev, [productId]: value }));
  const setDuplicateDraft = (productId, field, value) => setDuplicateDrafts((prev) => ({ ...prev, [productId]: { ...(prev[productId] || {}), [field]: value } }));

  const updateProductGroupName = async (group) => {
    const productName = (groupNameDrafts[group.productId] ?? group.productName).trim();
    if (!productName) {
      setMessage("\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    await db.transaction("rw", db.products, db.recipes, async () => {
      const templateProducts = products.filter((product) => product.status === "template" && (product.id === group.productId || product.internalId === group.productId));
      await Promise.all(templateProducts.map((product) => db.products.update(product.id, { name: productName })));
      const relatedRecipes = await db.recipes.where("productId").equals(group.productId).toArray();
      await Promise.all(relatedRecipes.map((recipe) => db.recipes.update(recipe.id, { productName })));
    });

    setGroupNameDrafts((prev) => {
      const next = { ...prev };
      delete next[group.productId];
      return next;
    });
    setMessage(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u540d\u3092\u300c${productName}\u300d\u306b\u5909\u66f4\u3057\u307e\u3057\u305f\u3002`);
    await load();
  };

  const duplicateProductGroup = async (group) => {
    const draft = duplicateDrafts[group.productId] || {};
    const productId = String(draft.id || `${group.productId}-COPY`).trim();
    const productName = String(draft.name || `${group.productName} Copy`).trim();
    if (!productId) {
      setMessage("\u8907\u88fd\u5148\u306e\u88fd\u54c1ID\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }
    if (productGroups.some((item) => item.productId === productId) || (await db.products.get(productId))) {
      setMessage(`\u88fd\u54c1ID\u300c${productId}\u300d\u306f\u65e2\u306b\u4f7f\u308f\u308c\u3066\u3044\u307e\u3059\u3002\u5225\u306eID\u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
      return;
    }
    await db.transaction("rw", db.products, db.recipes, async () => {
      await db.products.add({ id: productId, name: productName || productId, internalId: productId, status: "template" });
      if (group.recipes.length) {
        await db.recipes.bulkAdd(group.recipes.map((recipe) => ({ productId, productName: productName || productId, partId: recipe.partId || "", partName: recipe.partName || "", qty: Number(recipe.qty || 1) })));
      }
    });
    setDuplicateDrafts((prev) => {
      const next = { ...prev };
      delete next[group.productId];
      return next;
    });
    setMessage(`\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u300c${group.productName}\u300d\u3092\u300c${productName || productId}\u300d\u3068\u3057\u3066\u8907\u88fd\u3057\u307e\u3057\u305f\u3002`);
    await load();
  };

  const addPartToProduct = async (productId, partId) => {
    if (!productId || !partId) return;
    const part = partMap.get(partId);
    if (!part) {
      setMessage(`\u90e8\u54c1ID\u300c${partId}\u300d\u306f\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002`);
      return;
    }
    const group = productGroups.find((item) => item.productId === productId);
    const existing = recipes.find((recipe) => recipe.productId === productId && recipe.partId === partId);
    if (existing) {
      await db.recipes.update(existing.id, { qty: Number(existing.qty || 0) + 1, partName: part.name || part.id });
      setMessage(`${group?.productName || productId} \u306e\u300c${part.name || partId}\u300d\u3092 +1 \u3057\u307e\u3057\u305f\u3002`);
    } else {
      await db.recipes.add({ productId, productName: group?.productName || productId, partId, partName: part.name || part.id, qty: 1 });
      setMessage(`${group?.productName || productId} \u306b\u300c${part.name || partId}\u300d\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002`);
    }
    await load();
  };

  const handleDragStart = (event, partId) => {
    setDraggingPartId(partId);
    setSelectedPartId(partId);
    event.dataTransfer.setData("text/plain", partId);
    event.dataTransfer.setData("application/x-kittingflow-part-id", partId);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (event, productId) => {
    event.preventDefault();
    const partId = event.dataTransfer.getData("application/x-kittingflow-part-id") || event.dataTransfer.getData("text/plain") || draggingPartId || selectedPartId;
    setDraggingPartId("");
    addPartToProduct(productId, partId);
  };

  const containerStyle = { maxWidth: layout.maxWidth, margin: "0 auto", padding: spacing(4) };
  const toolbarStyle = { position: "sticky", top: 88, zIndex: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing(3), padding: `${spacing(2)} 0`, marginBottom: spacing(3), background: palette.background };
  const buttonStyle = { padding: "8px 14px", borderRadius: spacing(2), border: `1px solid ${palette.primaryDark}`, background: palette.primary, color: "#fff", fontWeight: 700, cursor: "pointer" };
  const modeToggleStyle = { display: "inline-flex", padding: 4, border: `1px solid ${palette.border}`, borderRadius: spacing(2.5), background: palette.surface, boxShadow: "0 1px 4px rgba(15, 23, 42, 0.08)" };
  const modeButtonStyle = (active) => ({ padding: "7px 12px", border: 0, borderRadius: spacing(2), background: active ? palette.primary : "transparent", color: active ? "#fff" : palette.textMuted, fontWeight: 700, cursor: "pointer" });
  const quickEditLayoutStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing(4), alignItems: "start" };
  const partChipStyle = { display: "grid", gap: spacing(0.5), padding: `${spacing(2)} ${spacing(3)}`, border: `1px solid ${palette.border}`, borderRadius: spacing(2), background: palette.surfaceAlt, cursor: "grab" };
  const selectedPartChipStyle = { borderColor: palette.primary, background: palette.primarySoft, boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.12)" };
  const smallInputStyle = { padding: "7px 9px", border: `1px solid ${palette.border}`, borderRadius: spacing(1.5), background: palette.surfaceAlt, color: palette.text, minWidth: 0 };
  const secondaryButtonStyle = { padding: "7px 11px", border: `1px solid ${palette.primaryDark}`, borderRadius: spacing(1.5), background: palette.primarySoft, color: palette.primaryDark, cursor: "pointer", fontWeight: 700 };
  const dangerButtonStyle = { padding: "7px 11px", border: `1px solid ${palette.danger}`, borderRadius: spacing(1.5), background: "#fee2e2", color: palette.danger, cursor: "pointer", fontWeight: 700 };
  const sectionTitleStyle = { display: "flex", alignItems: "center", gap: spacing(2), marginBottom: spacing(2), fontWeight: 800 };
  const sectionBadgeStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, background: palette.primarySoft, color: palette.primaryDark, fontSize: typography.size.xs, fontWeight: 800 };
  const groupToolbarStyle = { display: "grid", gap: spacing(2), padding: spacing(3), border: `1px solid ${palette.border}`, borderRadius: spacing(3), background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)", marginBottom: spacing(3) };
  const groupFormStyle = { display: "grid", gridTemplateColumns: "minmax(110px, 0.8fr) minmax(140px, 1fr) auto", gap: spacing(2), alignItems: "center" };
  const groupCardHeaderStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: spacing(2), paddingBottom: spacing(2), borderBottom: `1px solid ${palette.border}` };
  const groupActionPanelStyle = { display: "grid", gap: spacing(2), padding: spacing(2), border: `1px solid ${palette.border}`, borderRadius: spacing(2), background: palette.surface };
  const mutedHelpStyle = { margin: 0, color: palette.textMuted, fontSize: typography.size.sm };
  const productGroupStyle = (isActive = false) => ({ border: `1px solid ${isActive ? palette.primary : palette.border}`, borderRadius: spacing(3), padding: spacing(3), background: isActive ? "#eff6ff" : "#fbfdff", minHeight: 130, boxShadow: isActive ? "0 12px 28px rgba(37, 99, 235, 0.12)" : "0 4px 16px rgba(15, 23, 42, 0.06)" });
  const tableGridStyle = { display: "grid", gridTemplateColumns: "minmax(110px, 1fr) minmax(140px, 1.1fr) minmax(110px, 1fr) minmax(140px, 1.1fr) minmax(80px, 0.5fr) minmax(120px, 0.7fr)", gap: spacing(2), alignItems: "center" };

  return (
    <div style={containerStyle}>
      <header style={toolbarStyle}>
        <div>
          <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>{t.recipeEdit}</h3>
          <p style={{ margin: `${spacing(1)} 0 0`, color: palette.textMuted, fontSize: typography.size.sm }}>{t.headerHelp}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing(2), flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={modeToggleStyle} aria-label="recipe edit mode">
            <button type="button" onClick={() => setEditMode("drag")} style={modeButtonStyle(editMode === "drag")} aria-pressed={editMode === "drag"}>{t.dragEdit}</button>
            <button type="button" onClick={() => setEditMode("table")} style={modeButtonStyle(editMode === "table")} aria-pressed={editMode === "table"}>{t.tableEdit}</button>
          </div>
          <button onClick={addEmptyRow} style={buttonStyle}>{t.addRow}</button>
        </div>
      </header>

      {message && <div style={{ marginBottom: spacing(3), padding: `${spacing(2)} ${spacing(3)}`, background: "#fef3c7", border: `1px solid ${palette.warning}55`, borderRadius: spacing(2), color: "#92400e" }}>{message}</div>}

      {editMode === "drag" && (
        <section style={{ ...card(), marginBottom: spacing(4) }}>
          <h4 style={{ margin: 0, fontSize: typography.size.lg }}>{t.dragEdit}</h4>
          <p style={{ margin: `${spacing(1)} 0 ${spacing(4)}`, color: palette.textMuted }}>{t.dragHelp}</p>
          <div style={quickEditLayoutStyle}>
            <div>
              <div style={sectionTitleStyle}><span style={sectionBadgeStyle}>1</span><span>{t.choosePart}</span></div>
              <p style={mutedHelpStyle}>{t.choosePartHelp}</p>
              <div style={{ display: "grid", gap: spacing(2), marginTop: spacing(2), maxHeight: 380, overflowY: "auto" }}>
                {parts.map((part) => (
                  <div key={part.id} draggable onClick={() => setSelectedPartId(part.id)} onDragStart={(event) => handleDragStart(event, part.id)} onDragEnd={() => setDraggingPartId("")} style={{ ...partChipStyle, ...(selectedPartId === part.id ? selectedPartChipStyle : {}) }} title={t.addSelectedPart}>
                    <span style={{ fontWeight: 700 }}>{part.name || part.id}</span>
                    <span style={{ color: palette.textMuted, fontSize: typography.size.sm }}>{part.id} / {t.stock} {Number(part.stock || 0)}</span>
                  </div>
                ))}
                {parts.length === 0 && <p style={{ color: palette.textMuted }}>{t.noParts}</p>}
              </div>
            </div>

            <div>
              <div style={sectionTitleStyle}><span style={sectionBadgeStyle}>2</span><span>{t.editGroups}</span></div>
              <div style={groupToolbarStyle}>
                <div><b>{t.newGroup}</b><p style={mutedHelpStyle}>{t.newGroupHelp}</p></div>
                <div style={groupFormStyle}>
                  <input value={newGroupId} onChange={(event) => setNewGroupId(event.target.value)} placeholder={t.productId} style={smallInputStyle} />
                  <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder={t.productName} style={smallInputStyle} />
                  <button type="button" onClick={addProductGroup} style={secondaryButtonStyle}>{t.add}</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: spacing(3), marginTop: spacing(2) }}>
                {productGroups.map((group) => (
                  <div key={group.productId} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, group.productId)} style={productGroupStyle(Boolean(draggingPartId))}>
                    <div style={groupCardHeaderStyle}>
                      <div><div style={{ fontWeight: 900, fontSize: typography.size.lg }}>{group.productName}</div><div style={{ color: palette.textMuted, fontSize: typography.size.sm }}>{group.productId}</div></div>
                      <button type="button" onClick={() => addPartToProduct(group.productId, selectedPartId)} disabled={!selectedPartId} style={{ padding: "7px 11px", border: `1px solid ${selectedPartId ? palette.primaryDark : palette.border}`, borderRadius: spacing(1.5), background: selectedPartId ? palette.primary : palette.surfaceAlt, color: selectedPartId ? "#fff" : palette.textMuted, cursor: selectedPartId ? "pointer" : "not-allowed", fontWeight: 800, whiteSpace: "nowrap" }}>{t.addSelectedPart}</button>
                    </div>
                    <div style={{ display: "grid", gap: spacing(2), margin: `${spacing(3)} 0` }}>
                      <div style={groupActionPanelStyle}>
                        <b>{t.rename}</b>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: spacing(2) }}>
                          <input value={groupNameDrafts[group.productId] ?? group.productName} onChange={(event) => setGroupNameDraft(group.productId, event.target.value)} placeholder={t.productName} style={smallInputStyle} />
                          <button type="button" onClick={() => updateProductGroupName(group)} style={secondaryButtonStyle}>{t.save}</button>
                        </div>
                      </div>
                      <div style={groupActionPanelStyle}>
                        <b>{t.duplicateGroup}</b>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1fr) auto", gap: spacing(2) }}>
                          <input value={duplicateDrafts[group.productId]?.id ?? ""} onChange={(event) => setDuplicateDraft(group.productId, "id", event.target.value)} placeholder={`${group.productId}-COPY`} style={smallInputStyle} />
                          <input value={duplicateDrafts[group.productId]?.name ?? ""} onChange={(event) => setDuplicateDraft(group.productId, "name", event.target.value)} placeholder={`${group.productName} Copy`} style={smallInputStyle} />
                          <button type="button" onClick={() => duplicateProductGroup(group)} style={secondaryButtonStyle}>{t.duplicate}</button>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: spacing(1) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing(2) }}><b>{t.registeredParts}</b><button type="button" onClick={() => deleteProductGroup(group)} style={dangerButtonStyle}>{t.deleteGroup}</button></div>
                      {group.recipes.map((recipe) => (
                        <div key={recipe.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: spacing(2), padding: `${spacing(1)} 0`, borderBottom: `1px solid ${palette.border}`, fontSize: typography.size.sm }}>
                          <span>{getPartName(recipe.partId)}</span><b>x {Number(recipe.qty || 0)}</b><button type="button" onClick={() => removeRecipeFromGroup(recipe)} style={{ padding: "3px 8px", border: `1px solid ${palette.danger}`, borderRadius: spacing(1), background: "#fff5f5", color: palette.danger, cursor: "pointer", fontSize: typography.size.xs, fontWeight: 700 }}>{t.delete}</button>
                        </div>
                      ))}
                      {group.recipes.length === 0 && <span style={{ color: palette.textMuted, fontSize: typography.size.sm }}>{t.dropHere}</span>}
                    </div>
                  </div>
                ))}
                {productGroups.length === 0 && <p style={{ color: palette.textMuted }}>{t.noGroups}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {editMode === "table" && (
        <section style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: 820 }}>
            <div style={{ ...tableGridStyle, padding: `${spacing(2)} ${spacing(3)}`, background: palette.surfaceAlt, borderBottom: `1px solid ${palette.border}`, fontWeight: 700 }}>{COLUMNS.map((column) => <div key={column.key}>{column.label}</div>)}<div style={{ textAlign: "center" }}>{t.operation}</div></div>
            {recipes.map((recipe) => {
              const partMissing = Boolean(recipe.partId) && !partMap.has(recipe.partId);
              const productMissing = Boolean(recipe.productId) && !productMap.has(recipe.productId);
              return <div key={recipe.id} style={{ ...tableGridStyle, padding: `${spacing(2)} ${spacing(3)}`, borderBottom: `1px solid ${palette.border}`, background: partMissing || productMissing ? "#fff7ed" : palette.surface }}>
                {COLUMNS.map((column) => {
                  if (!column.editable) return <div key={column.key}>{column.key === "partName" ? getPartName(recipe.partId) : recipe[column.key] || "-"}</div>;
                  const datalistId = column.key === "productId" ? "recipe-product-options" : column.key === "partId" ? "recipe-part-options" : undefined;
                  const hasError = (column.key === "partId" && partMissing) || (column.key === "productId" && productMissing);
                  return <input key={column.key} type={column.type || "text"} defaultValue={recipe[column.key] ?? ""} list={datalistId} onBlur={(event) => updateRecipe(recipe.id, column.key, event.target.value)} style={inputStyle(hasError)} />;
                })}
                <div style={{ display: "flex", justifyContent: "center", gap: spacing(1) }}><button onClick={() => duplicateRecipe(recipe)} style={{ padding: "6px 10px", border: `1px solid ${palette.primaryDark}`, borderRadius: spacing(1.5), background: palette.primarySoft, color: palette.primaryDark, cursor: "pointer" }}>{t.duplicate}</button><button onClick={() => deleteRecipe(recipe)} style={{ padding: "6px 10px", border: `1px solid ${palette.danger}`, borderRadius: spacing(1.5), background: "#fee2e2", color: palette.danger, cursor: "pointer" }}>{t.delete}</button></div>
              </div>;
            })}
            {recipes.length === 0 && <div style={{ padding: spacing(5), textAlign: "center", color: palette.textMuted }}>{t.emptyRecipes}</div>}
          </div></div>
        </section>
      )}

      <datalist id="recipe-product-options">{productOptions.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="recipe-part-options">{partOptions.map((option) => <option key={option} value={option} />)}</datalist>
    </div>
  );
}
