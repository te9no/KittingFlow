import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

const COLUMNS = [
  { key: "productId", label: "製品ID", editable: true },
  { key: "productName", label: "製品名", editable: true },
  { key: "partId", label: "部品ID", editable: true },
  { key: "partName", label: "部品名", editable: false },
  { key: "qty", label: "必要数", editable: true, type: "number" }
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
        return { error: "必要数には 1 以上の数値を入力してください。" };
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
      if (!part && value) return { error: `部品ID「${value}」は登録されていません。` };
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
      setMessage("レシピを更新しました。");
      await load();
    } catch (error) {
      console.error(error);
      setMessage("レシピの更新に失敗しました。");
    }
  };

  const addEmptyRow = async () => {
    await db.recipes.add({ productId: "", productName: "", partId: "", partName: "", qty: 1 });
    setMessage("空のレシピ行を追加しました。");
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
    setMessage("レシピを複製しました。");
    await load();
  };

  const deleteRecipe = async (recipe) => {
    const label = `${recipe.productId || "?"} / ${recipe.partId || "?"}`;
    if (!window.confirm(`レシピ「${label}」を削除しますか？`)) return;
    await db.recipes.delete(recipe.id);
    setMessage("レシピを削除しました。");
    await load();
  };

  const removeRecipeFromGroup = async (recipe) => {
    await db.recipes.delete(recipe.id);
    setMessage(`${getPartName(recipe.partId)} を製品グループから削除しました。`);
    await load();
  };

  const addProductGroup = async () => {
    const productId = newGroupId.trim();
    const productName = newGroupName.trim() || productId;

    if (!productId) {
      setMessage("製品グループIDを入力してください。");
      return;
    }

    if (productGroups.some((group) => group.productId === productId)) {
      setMessage(`製品グループ「${productId}」は既にあります。`);
      return;
    }

    if (await db.products.get(productId)) {
      setMessage(`製品ID「${productId}」は既に使われています。別のIDを指定してください。`);
      return;
    }

    await db.products.add({
      id: productId,
      name: productName,
      internalId: productId,
      status: "template"
    });
    setNewGroupId("");
    setNewGroupName("");
    setMessage(`製品グループ「${productName}」を追加しました。`);
    await load();
  };

  const deleteProductGroup = async (group) => {
    const count = group.recipes.length;
    const suffix = count ? `関連するレシピ ${count} 件も削除されます。` : "空のグループを削除します。";
    if (!window.confirm(`製品グループ「${group.productName}」を削除しますか？\n${suffix}`)) return;

    await db.transaction("rw", db.products, db.recipes, async () => {
      const relatedRecipes = await db.recipes.where("productId").equals(group.productId).toArray();
      await db.recipes.bulkDelete(relatedRecipes.map((recipe) => recipe.id));

      const templateProducts = products.filter(
        (product) =>
          product.status === "template" &&
          (product.id === group.productId || product.internalId === group.productId)
      );
      if (templateProducts.length) {
        await db.products.bulkDelete(templateProducts.map((product) => product.id));
      }
    });

    setMessage(`製品グループ「${group.productName}」を削除しました。`);
    await load();
  };

  const addPartToProduct = async (productId, partId) => {
    if (!productId || !partId) return;

    const part = partMap.get(partId);
    if (!part) {
      setMessage(`部品ID「${partId}」は登録されていません。`);
      return;
    }

    const group = productGroups.find((item) => item.productId === productId);
    const existing = recipes.find((recipe) => recipe.productId === productId && recipe.partId === partId);

    if (existing) {
      await db.recipes.update(existing.id, {
        qty: Number(existing.qty || 0) + 1,
        partName: part.name || part.id
      });
      setMessage(`${group?.productName || productId} の「${part.name || partId}」を +1 しました。`);
    } else {
      await db.recipes.add({
        productId,
        productName: group?.productName || productId,
        partId,
        partName: part.name || part.id,
        qty: 1
      });
      setMessage(`${group?.productName || productId} に「${part.name || partId}」を追加しました。`);
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
    const partId =
      event.dataTransfer.getData("application/x-kittingflow-part-id") ||
      event.dataTransfer.getData("text/plain") ||
      draggingPartId ||
      selectedPartId;
    setDraggingPartId("");
    addPartToProduct(productId, partId);
  };

  const containerStyle = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing(4)
  };

  const toolbarStyle = {
    position: "sticky",
    top: 88,
    zIndex: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing(3),
    padding: `${spacing(2)} 0`,
    marginBottom: spacing(3),
    background: palette.background
  };

  const buttonStyle = {
    padding: "8px 14px",
    borderRadius: spacing(2),
    border: `1px solid ${palette.primaryDark}`,
    background: palette.primary,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  };

  const modeToggleStyle = {
    display: "inline-flex",
    padding: 4,
    border: `1px solid ${palette.border}`,
    borderRadius: spacing(2.5),
    background: palette.surface,
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.08)"
  };

  const modeButtonStyle = (active) => ({
    padding: "7px 12px",
    border: 0,
    borderRadius: spacing(2),
    background: active ? palette.primary : "transparent",
    color: active ? "#fff" : palette.textMuted,
    fontWeight: 700,
    cursor: "pointer"
  });

  const quickEditLayoutStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: spacing(4),
    alignItems: "start"
  };

  const partChipStyle = {
    display: "grid",
    gap: spacing(0.5),
    padding: `${spacing(2)} ${spacing(3)}`,
    border: `1px solid ${palette.border}`,
    borderRadius: spacing(2),
    background: palette.surfaceAlt,
    cursor: "grab"
  };

  const selectedPartChipStyle = {
    borderColor: palette.primary,
    background: palette.primarySoft,
    boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.12)"
  };

  const smallInputStyle = {
    padding: "7px 9px",
    border: `1px solid ${palette.border}`,
    borderRadius: spacing(1.5),
    background: palette.surfaceAlt,
    color: palette.text
  };

  const secondaryButtonStyle = {
    padding: "7px 11px",
    border: `1px solid ${palette.primaryDark}`,
    borderRadius: spacing(1.5),
    background: palette.primarySoft,
    color: palette.primaryDark,
    cursor: "pointer",
    fontWeight: 700
  };

  const productGroupStyle = (isActive = false) => ({
    border: `1px dashed ${isActive ? palette.primary : palette.border}`,
    borderRadius: spacing(3),
    padding: spacing(3),
    background: isActive ? "#eff6ff" : "#fbfdff",
    minHeight: 130
  });

  const tableGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(110px, 1fr) minmax(140px, 1.1fr) minmax(110px, 1fr) minmax(140px, 1.1fr) minmax(80px, 0.5fr) minmax(120px, 0.7fr)",
    gap: spacing(2),
    alignItems: "center"
  };

  return (
    <div style={containerStyle}>
      <header style={toolbarStyle}>
        <div>
          <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>レシピ編集</h3>
          <p style={{ margin: `${spacing(1)} 0 0`, color: palette.textMuted, fontSize: typography.size.sm }}>
            ドラッグで追加し、細かい数値は下の表で直接編集できます。
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing(2), flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={modeToggleStyle} aria-label="レシピ編集方式">
            <button
              type="button"
              onClick={() => setEditMode("drag")}
              style={modeButtonStyle(editMode === "drag")}
              aria-pressed={editMode === "drag"}
            >
              ドラッグ編集
            </button>
            <button
              type="button"
              onClick={() => setEditMode("table")}
              style={modeButtonStyle(editMode === "table")}
              aria-pressed={editMode === "table"}
            >
              表編集
            </button>
          </div>
          <button onClick={addEmptyRow} style={buttonStyle}>+ 行を追加</button>
        </div>
      </header>

      {message && (
        <div style={{ marginBottom: spacing(3), padding: `${spacing(2)} ${spacing(3)}`, background: "#fef3c7", border: `1px solid ${palette.warning}55`, borderRadius: spacing(2), color: "#92400e" }}>
          {message}
        </div>
      )}

      {editMode === "drag" && <section style={{ ...card(), marginBottom: spacing(4) }}>
        <h4 style={{ margin: 0, fontSize: typography.size.lg }}>ドラッグでレシピに追加</h4>
        <p style={{ margin: `${spacing(1)} 0 ${spacing(4)}`, color: palette.textMuted }}>
          左の部品を右の製品グループへドラッグしてください。既に登録済みの部品は必要数を +1 します。
        </p>

        <div style={quickEditLayoutStyle}>
          <div>
            <b>部品リスト</b>
            <div style={{ display: "grid", gap: spacing(2), marginTop: spacing(2), maxHeight: 380, overflowY: "auto" }}>
              {parts.map((part) => (
                <div
                  key={part.id}
                  draggable
                  onClick={() => setSelectedPartId(part.id)}
                  onDragStart={(event) => handleDragStart(event, part.id)}
                  onDragEnd={() => setDraggingPartId("")}
                  style={{
                    ...partChipStyle,
                    ...(selectedPartId === part.id ? selectedPartChipStyle : {})
                  }}
                  title="クリックで選択、またはドラッグで追加"
                >
                  <span style={{ fontWeight: 700 }}>{part.name || part.id}</span>
                  <span style={{ color: palette.textMuted, fontSize: typography.size.sm }}>{part.id} / 在庫 {Number(part.stock || 0)}</span>
                </div>
              ))}
              {parts.length === 0 && <p style={{ color: palette.textMuted }}>部品データがありません。</p>}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing(2), flexWrap: "wrap" }}>
              <b>製品グループ</b>
              <div style={{ display: "flex", gap: spacing(2), flexWrap: "wrap" }}>
                <input
                  value={newGroupId}
                  onChange={(event) => setNewGroupId(event.target.value)}
                  placeholder="製品ID"
                  style={{ ...smallInputStyle, width: 120 }}
                />
                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="製品名"
                  style={{ ...smallInputStyle, width: 150 }}
                />
                <button type="button" onClick={addProductGroup} style={secondaryButtonStyle}>
                  グループ追加
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: spacing(3), marginTop: spacing(2) }}>
              {productGroups.map((group) => (
                <div key={group.productId} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, group.productId)} style={productGroupStyle(Boolean(draggingPartId))}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing(2) }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{group.productName}</div>
                      <div style={{ color: palette.textMuted, fontSize: typography.size.sm, marginBottom: spacing(2) }}>{group.productId}</div>
                    </div>
                    <div style={{ display: "grid", gap: spacing(1), justifyItems: "end" }}>
                      <button
                        type="button"
                        onClick={() => addPartToProduct(group.productId, selectedPartId)}
                        disabled={!selectedPartId}
                        style={{
                          padding: "5px 9px",
                          border: `1px solid ${selectedPartId ? palette.primaryDark : palette.border}`,
                          borderRadius: spacing(1.5),
                          background: selectedPartId ? palette.primarySoft : palette.surfaceAlt,
                          color: selectedPartId ? palette.primaryDark : palette.textMuted,
                          cursor: selectedPartId ? "pointer" : "not-allowed",
                          fontWeight: 700,
                          whiteSpace: "nowrap"
                        }}
                      >
                        選択部品を追加
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProductGroup(group)}
                        style={{
                          padding: "5px 9px",
                          border: `1px solid ${palette.danger}`,
                          borderRadius: spacing(1.5),
                          background: "#fee2e2",
                          color: palette.danger,
                          cursor: "pointer",
                          fontWeight: 700,
                          whiteSpace: "nowrap"
                        }}
                      >
                        グループ削除
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: spacing(1) }}>
                    {group.recipes.map((recipe) => (
                      <div key={recipe.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing(2), fontSize: typography.size.sm }}>
                        <span>{getPartName(recipe.partId)}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: spacing(1) }}>
                          <b>x {Number(recipe.qty || 0)}</b>
                          <button
                            type="button"
                            onClick={() => removeRecipeFromGroup(recipe)}
                            style={{
                              padding: "2px 7px",
                              border: `1px solid ${palette.danger}`,
                              borderRadius: spacing(1),
                              background: "#fee2e2",
                              color: palette.danger,
                              cursor: "pointer",
                              fontSize: typography.size.xs
                            }}
                          >
                            削除
                          </button>
                        </span>
                      </div>
                    ))}
                    {group.recipes.length === 0 && <span style={{ color: palette.textMuted, fontSize: typography.size.sm }}>ここに部品をドロップ</span>}
                  </div>
                </div>
              ))}
              {productGroups.length === 0 && <p style={{ color: palette.textMuted }}>製品グループがありません。製品またはレシピ行を先に追加してください。</p>}
            </div>
          </div>
        </div>
      </section>}

      {editMode === "table" && <section style={card({ padding: 0, overflow: "hidden" })}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ ...tableGridStyle, padding: `${spacing(2)} ${spacing(3)}`, background: palette.surfaceAlt, borderBottom: `1px solid ${palette.border}`, fontWeight: 700 }}>
              {COLUMNS.map((column) => <div key={column.key}>{column.label}</div>)}
              <div style={{ textAlign: "center" }}>操作</div>
            </div>

            {recipes.map((recipe) => {
              const partMissing = Boolean(recipe.partId) && !partMap.has(recipe.partId);
              const productMissing = Boolean(recipe.productId) && !productMap.has(recipe.productId);
              return (
                <div key={recipe.id} style={{ ...tableGridStyle, padding: `${spacing(2)} ${spacing(3)}`, borderBottom: `1px solid ${palette.border}`, background: partMissing || productMissing ? "#fff7ed" : palette.surface }}>
                  {COLUMNS.map((column) => {
                    if (!column.editable) {
                      return <div key={column.key}>{column.key === "partName" ? getPartName(recipe.partId) : recipe[column.key] || "-"}</div>;
                    }
                    const datalistId = column.key === "productId" ? "recipe-product-options" : column.key === "partId" ? "recipe-part-options" : undefined;
                    const hasError = (column.key === "partId" && partMissing) || (column.key === "productId" && productMissing);
                    return (
                      <input
                        key={column.key}
                        type={column.type || "text"}
                        defaultValue={recipe[column.key] ?? ""}
                        list={datalistId}
                        onBlur={(event) => updateRecipe(recipe.id, column.key, event.target.value)}
                        style={inputStyle(hasError)}
                      />
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "center", gap: spacing(1) }}>
                    <button onClick={() => duplicateRecipe(recipe)} style={{ padding: "6px 10px", border: `1px solid ${palette.primaryDark}`, borderRadius: spacing(1.5), background: palette.primarySoft, color: palette.primaryDark, cursor: "pointer" }}>複製</button>
                    <button onClick={() => deleteRecipe(recipe)} style={{ padding: "6px 10px", border: `1px solid ${palette.danger}`, borderRadius: spacing(1.5), background: "#fee2e2", color: palette.danger, cursor: "pointer" }}>削除</button>
                  </div>
                </div>
              );
            })}

            {recipes.length === 0 && (
              <div style={{ padding: spacing(5), textAlign: "center", color: palette.textMuted }}>
                レシピデータがありません。CSV のインポート、または行の追加を行ってください。
              </div>
            )}
          </div>
        </div>
      </section>}

      <datalist id="recipe-product-options">
        {productOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
      <datalist id="recipe-part-options">
        {partOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
    </div>
  );
}
