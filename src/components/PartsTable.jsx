import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

const labels = {
  title: "\u90e8\u54c1\u4e00\u89a7\uff08\u30bb\u30eb\u7de8\u96c6\uff09",
  addRow: "+ \u884c\u3092\u8ffd\u52a0",
  actions: "\u64cd\u4f5c",
  params: "\u30d1\u30e9\u30e1\u30fc\u30bf",
  paramsTitle: "\u90e8\u54c1\u30d1\u30e9\u30e1\u30fc\u30bf\u7de8\u96c6",
  save: "\u4fdd\u5b58",
  cancel: "\u30ad\u30e3\u30f3\u30bb\u30eb",
  clone: "\u8907\u88fd",
  delete: "\u524a\u9664",
  empty: "\u90e8\u54c1\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002CSV \u306e\u30a4\u30f3\u30dd\u30fc\u30c8\u3001\u307e\u305f\u306f\u884c\u306e\u8ffd\u52a0\u3092\u884c\u3063\u3066\u304f\u3060\u3055\u3044\u3002",
  idRequired: "\u90e8\u54c1ID\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044",
  updated: "\u90e8\u54c1\u60c5\u5831\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f",
  updateFailed: "\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f",
  numericRequired: "\u6570\u5024\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044",
  rowAdded: "\u7a7a\u884c\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f",
  deleted: "\u90e8\u54c1\u3092\u524a\u9664\u3057\u307e\u3057\u305f",
  cloned: "\u90e8\u54c1\u3092\u8907\u88fd\u3057\u307e\u3057\u305f",
  cloneFailed: "\u90e8\u54c1\u306e\u8907\u88fd\u306b\u5931\u6557\u3057\u307e\u3057\u305f",
  duplicate: "\u305d\u306e\u90e8\u54c1ID\u306f\u65e2\u306b\u5b58\u5728\u3057\u307e\u3059",
  renameFailed: "\u90e8\u54c1ID\u306e\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f"
};

const COLUMNS = [
  { key: "id", label: "\u90e8\u54c1ID", align: "left", width: "minmax(140px, 1fr)" },
  { key: "name", label: "\u540d\u79f0", align: "left", width: "minmax(220px, 1.4fr)" },
  { key: "stock", label: "\u5728\u5eab", align: "right", type: "number", width: "minmax(100px, 0.6fr)" },
  { key: "supplier", label: "\u4ed5\u5165\u308c\u5148", align: "left", width: "minmax(170px, 1fr)" },
  { key: "imageUrl", label: "\u753b\u50cfURL", align: "left", width: "minmax(220px, 1.2fr)" }
];

const PARAM_COLUMNS = [
  { key: "purchaseAmount", label: "\u4ed5\u5165\u91d1\u984d", type: "number" },
  { key: "purchaseQuantity", label: "\u4ed5\u5165\u308c\u6570", type: "number" },
  { key: "unitPrice", label: "\u9069\u7528\u5358\u4fa1", type: "number", readOnly: true },
  { key: "manualUnitPrice", label: "\u5358\u4fa1\uff08\u624b\u5165\u529b\uff09", type: "number" },
  { key: "usageQuantity", label: "\u4f7f\u7528\u6570\u91cf", type: "number" },
  { key: "amount", label: "\u91d1\u984d", type: "number", readOnly: true },
  { key: "supplier", label: "\u4ed5\u5165\u308c\u5148" }
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);
const NUMERIC_FIELDS = new Set(["stock", "purchaseAmount", "purchaseQuantity", "manualUnitPrice", "usageQuantity"]);
const PLACEHOLDER_PREFIX = "__tmp_part__";
const PART_ID_DATALIST_ID = "parts-id-options";

function parseNumber(value) {
  if (value === "" || value == null) return 0;
  const normalized = typeof value === "string" ? value.replace(/[\s,]/g, "").trim() : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function calculatedUnitPrice(part) {
  const purchaseAmount = Number(part.purchaseAmount || 0);
  const purchaseQuantity = Number(part.purchaseQuantity || 0);
  if (!purchaseAmount || !purchaseQuantity) return 0;
  return purchaseAmount / purchaseQuantity;
}

function effectiveUnitPrice(part) {
  if (part.manualUnitPrice !== "" && part.manualUnitPrice != null) {
    const manual = parseNumber(part.manualUnitPrice);
    if (manual != null) return manual;
  }
  return calculatedUnitPrice(part);
}

function calculatedAmount(part) {
  return effectiveUnitPrice(part) * Number(part.usageQuantity || 0);
}

function normalizePart(part = {}) {
  return {
    id: part.id || "",
    name: part.name || "",
    stock: Number(part.stock || 0),
    purchaseAmount: Number(part.purchaseAmount ?? part.purchasePrice ?? 0),
    purchaseQuantity: Number(part.purchaseQuantity || 0),
    manualUnitPrice: part.manualUnitPrice === "" || part.manualUnitPrice == null ? "" : Number(part.manualUnitPrice || 0),
    usageQuantity: Number(part.usageQuantity || 0),
    supplier: part.supplier || "",
    imageUrl: part.imageUrl || ""
  };
}

export default function PartsTable() {
  const [parts, setParts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [pendingFocus, setPendingFocus] = useState(null);
  const [paramEditorId, setParamEditorId] = useState("");
  const [paramDraft, setParamDraft] = useState({});
  const [toolbarOffset, setToolbarOffset] = useState("0px");
  const [scrollAreaHeight, setScrollAreaHeight] = useState(null);
  const [tableHeaderOffset, setTableHeaderOffset] = useState("0px");
  const cellRefs = useRef({});
  const tableScrollRef = useRef(null);
  const toolbarRef = useRef(null);

  const load = useCallback(async () => {
    setParts((await db.parts.toArray()).map(normalizePart));
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
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const updateLayoutMetrics = useCallback(() => {
    if (typeof document === "undefined") return;
    const gap = 12;
    const appHeader = document.querySelector("[data-app-header='true']");
    const headerHeight = appHeader?.getBoundingClientRect().height ?? 0;
    const nextToolbarTop = `${Math.round(headerHeight + gap)}px`;
    setToolbarOffset((prev) => (prev === nextToolbarTop ? prev : nextToolbarTop));

    const toolbarHeight = toolbarRef.current?.getBoundingClientRect().height ?? 0;
    const nextHeaderTop = `${Math.round(headerHeight + gap + toolbarHeight + 8)}px`;
    setTableHeaderOffset((prev) => (prev === nextHeaderTop ? prev : nextHeaderTop));

    if (tableScrollRef.current) {
      const rect = tableScrollRef.current.getBoundingClientRect();
      const available = Math.floor(window.innerHeight - rect.top - 32);
      if (Number.isFinite(available) && available > 200) {
        setScrollAreaHeight((prev) => (prev === available ? prev : available));
      }
    }
  }, []);

  useEffect(() => {
    updateLayoutMetrics();
    window.addEventListener("resize", updateLayoutMetrics);
    return () => window.removeEventListener("resize", updateLayoutMetrics);
  }, [updateLayoutMetrics]);

  useEffect(() => { updateLayoutMetrics(); }, [parts.length, message, updateLayoutMetrics]);

  const findOriginal = (id) => parts.find((part) => part.id === id);

  const setDraftValue = (id, field, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const clearDraft = (id, field) => {
    setDrafts((prev) => {
      const next = { ...(prev || {}) };
      if (!next[id]) return next;
      const row = { ...next[id] };
      delete row[field];
      if (Object.keys(row).length === 0) delete next[id];
      else next[id] = row;
      return next;
    });
  };

  const partIdOptions = useMemo(() => parts.filter((part) => part.id && !part.id.startsWith(PLACEHOLDER_PREFIX)).map((part) => part.id), [parts]);

  const displayValue = (id, field) => {
    const original = findOriginal(id);
    const draft = drafts[id]?.[field];
    if (draft !== undefined) return draft;
    if (!original) return "";
    if (field === "id" && original.id.startsWith(PLACEHOLDER_PREFIX)) return "";
    if (field === "unitPrice") return formatNumber(effectiveUnitPrice(original));
    if (field === "amount") return formatNumber(calculatedAmount(original));
    if (NUMERIC_FIELDS.has(field)) return original[field] == null ? "" : String(original[field]);
    return original[field] ?? "";
  };

  const buildPartPatch = (updates) => {
    const patch = {};
    for (const [field, raw] of Object.entries(updates)) {
      if (raw === undefined) continue;
      if (field === "id") {
        patch.id = String(raw).trim();
      } else if (field === "name" || field === "supplier" || field === "imageUrl") {
        patch[field] = String(raw).trim();
      } else if (NUMERIC_FIELDS.has(field)) {
        const num = parseNumber(raw);
        if (num == null) return { error: labels.numericRequired };
        patch[field] = field === "manualUnitPrice" && String(raw).trim() === "" ? "" : num;
      }
    }
    return { patch };
  };

  const renamePart = async (currentId, nextId, additionalPatch = {}) => {
    const trimmed = String(nextId).trim();
    const original = findOriginal(currentId);
    if (!original) return;
    if (!trimmed) {
      setMessage(labels.idRequired);
      return;
    }

    try {
      if (trimmed === currentId) {
        if (Object.keys(additionalPatch).length) await db.parts.update(currentId, additionalPatch);
      } else {
        await db.transaction("rw", db.parts, db.recipes, async () => {
          if (await db.parts.get(trimmed)) {
            const err = new Error("duplicate");
            err.code = "duplicate";
            throw err;
          }
          const fresh = await db.parts.get(currentId);
          if (!fresh) return;
          await db.parts.delete(currentId);
          await db.parts.add({ ...fresh, ...additionalPatch, id: trimmed });
          await db.recipes.where({ partId: currentId }).modify({ partId: trimmed });
        });
      }
      setMessage(labels.updated);
      await load();
      setDrafts((prev) => {
        const next = { ...(prev || {}) };
        const rowDraft = { ...(next[currentId] || {}) };
        delete rowDraft.id;
        delete next[currentId];
        if (Object.keys(rowDraft).length > 0) next[trimmed] = { ...(next[trimmed] || {}), ...rowDraft };
        return next;
      });
      setPendingFocus({ id: trimmed, field: "id" });
    } catch (error) {
      if (error?.code === "duplicate") setMessage(labels.duplicate);
      else {
        console.error(error);
        setMessage(labels.renameFailed);
      }
    }
  };

  const handleBlur = async (id, field) => {
    const rowDraft = drafts[id];
    if (!rowDraft || !(field in rowDraft)) return;
    if (field === "unitPrice" || field === "amount") return;

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
    const original = findOriginal(id);
    if (!original) {
      clearDraft(id, field);
      return;
    }
    const nextValue = patch[field];
    const same = NUMERIC_FIELDS.has(field)
      ? Number(original[field] || 0) === Number(nextValue || 0)
      : String(original[field] ?? "") === String(nextValue ?? "");
    if (same) {
      clearDraft(id, field);
      return;
    }
    try {
      await db.parts.update(id, patch);
      setMessage(labels.updated);
      await load();
    } catch (error) {
      console.error(error);
      setMessage(labels.updateFailed);
    }
    clearDraft(id, field);
  };

  const handleKeyDown = (event, rowIndex, columnIndex) => {
    const { key, shiftKey } = event;
    const navigate = (nextRow, nextCol) => {
      if (nextCol < 0 || nextCol >= COLUMN_KEYS.length) return;
      const row = parts[nextRow];
      if (!row) return;
      const node = cellRefs.current[`${row.id}:${COLUMN_KEYS[nextCol]}`];
      if (node) {
        event.preventDefault();
        node.focus();
        node.select();
      }
    };
    if (key === "Enter") navigate(rowIndex + (shiftKey ? -1 : 1), columnIndex);
    else if (key === "ArrowDown") navigate(rowIndex + 1, columnIndex);
    else if (key === "ArrowUp") navigate(rowIndex - 1, columnIndex);
    else if (key === "ArrowLeft") navigate(rowIndex, columnIndex - 1);
    else if (key === "ArrowRight") navigate(rowIndex, columnIndex + 1);
  };

  const addRow = async () => {
    const placeholderId = `${PLACEHOLDER_PREFIX}${Date.now()}`;
    await db.parts.add(normalizePart({ id: placeholderId }));
    await load();
    setDrafts((prev) => ({ ...prev, [placeholderId]: { id: "", name: "", stock: "0" } }));
    setPendingFocus({ id: placeholderId, field: "id" });
    setMessage(labels.rowAdded);
  };

  const deleteRow = async (id) => {
    const original = findOriginal(id);
    if (!original) return;
    if (!window.confirm(`\u90e8\u54c1\u300c${original.name || id}\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f`)) return;
    await db.transaction("rw", db.parts, db.recipes, async () => {
      await db.parts.delete(id);
      await db.recipes.where({ partId: id }).delete();
    });
    setMessage(labels.deleted);
    await load();
    setDrafts((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
  };

  const incrementPartId = (value) => {
    const match = String(value ?? "").match(/^(.*?)(\d+)$/);
    if (!match) return `${value || ""}1`;
    return `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, "0")}`;
  };

  const generateUniquePartId = useCallback((baseId) => {
    const existing = new Set(parts.map((part) => part.id));
    let candidate = incrementPartId(baseId);
    let guard = 0;
    while (existing.has(candidate) && guard < 1000) {
      candidate = incrementPartId(candidate);
      guard += 1;
    }
    return candidate;
  }, [parts]);

  const clonePart = async (id) => {
    const original = findOriginal(id);
    if (!original) return;
    try {
      const newId = generateUniquePartId(original.id);
      await db.parts.add({ ...normalizePart(original), id: newId });
      setMessage(labels.cloned);
      await load();
      setPendingFocus({ id: newId, field: "name" });
    } catch (error) {
      console.error(error);
      setMessage(labels.cloneFailed);
    }
  };

  const openParamEditor = (id) => {
    const original = findOriginal(id);
    if (!original) return;
    setParamEditorId(id);
    setParamDraft({
      purchaseAmount: original.purchaseAmount ?? 0,
      purchaseQuantity: original.purchaseQuantity ?? 0,
      manualUnitPrice: original.manualUnitPrice ?? "",
      usageQuantity: original.usageQuantity ?? 0,
      supplier: original.supplier ?? ""
    });
  };

  const closeParamEditor = () => {
    setParamEditorId("");
    setParamDraft({});
  };

  const saveParamEditor = async () => {
    if (!paramEditorId) return;
    const { patch, error } = buildPartPatch(paramDraft);
    if (error) {
      setMessage(error);
      return;
    }
    try {
      await db.parts.update(paramEditorId, patch);
      setMessage(labels.updated);
      closeParamEditor();
      await load();
    } catch (error) {
      console.error(error);
      setMessage(labels.updateFailed);
    }
  };

  const gridTemplateColumns = useMemo(() => [...COLUMNS.map((column) => column.width), "minmax(220px, 1fr)"].join(" "), []);

  const toolbarStyle = useMemo(() => ({
    position: "sticky",
    top: toolbarOffset,
    zIndex: 50,
    background: palette.background,
    padding: `${spacing(2)} 0`,
    marginBottom: spacing(3),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing(3)
  }), [toolbarOffset]);

  const rowGridStyle = useMemo(() => ({
    display: "grid",
    gridTemplateColumns,
    gap: spacing(2),
    alignItems: "center"
  }), [gridTemplateColumns]);

  const headerRowStyle = useMemo(() => ({
    ...rowGridStyle,
    background: palette.surfaceAlt,
    padding: `${spacing(2)} ${spacing(3)}`,
    borderBottom: `1px solid ${palette.border}`,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
    position: "sticky",
    top: tableHeaderOffset,
    zIndex: 40
  }), [rowGridStyle, tableHeaderOffset]);

  const rowStyle = useMemo(() => ({
    ...rowGridStyle,
    padding: `${spacing(2)} ${spacing(3)}`,
    borderBottom: `1px solid ${palette.border}`
  }), [rowGridStyle]);

  const scrollAreaStyle = useMemo(() => ({
    position: "relative",
    maxHeight: scrollAreaHeight ? `${scrollAreaHeight}px` : "60vh",
    overflowY: "auto",
    overflowX: "hidden"
  }), [scrollAreaHeight]);

  const inputStyle = (column, hasError) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    border: `1px solid ${hasError ? palette.danger : palette.border}`,
    borderRadius: spacing(1.5),
    fontSize: typography.size.sm,
    textAlign: column.align,
    background: column.readOnly ? "#e2e8f0" : hasError ? "#fff1f2" : palette.surfaceAlt,
    color: column.readOnly ? palette.textMuted : palette.text
  });

  const modalPart = paramEditorId ? findOriginal(paramEditorId) : null;
  const modalValues = modalPart ? { ...modalPart, ...paramDraft } : {};
  const modalComputed = {
    unitPrice: formatNumber(effectiveUnitPrice(modalValues)),
    amount: formatNumber(calculatedAmount(modalValues))
  };

  return (
    <div style={{ maxWidth: layout.maxWidth, margin: "0 auto", padding: spacing(4) }}>
      <header ref={toolbarRef} style={toolbarStyle}>
        <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>{labels.title}</h3>
        <button onClick={addRow} style={{ padding: "8px 16px", borderRadius: spacing(2), border: `1px solid ${palette.primaryDark}`, background: palette.primary, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          {labels.addRow}
        </button>
      </header>

      {message && <div style={{ marginBottom: spacing(3), padding: `${spacing(2)} ${spacing(3)}`, background: palette.primarySoft, border: `1px solid ${palette.primaryDark}1a`, borderRadius: spacing(2), color: palette.primaryDark }}>{message}</div>}

      <div style={card({ padding: "0" })}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 980 }}>
            <div style={headerRowStyle}>
              {COLUMNS.map((column) => <div key={column.key} style={{ fontWeight: 700, fontSize: typography.size.sm, textAlign: column.align }}>{column.label}</div>)}
              <div style={{ fontWeight: 700, fontSize: typography.size.sm, textAlign: "center" }}>{labels.actions}</div>
            </div>
          </div>
          <div ref={tableScrollRef} style={scrollAreaStyle}>
            <div style={{ minWidth: 980 }}>
              {parts.map((part, rowIndex) => {
                const liveId = displayValue(part.id, "id").trim();
                const liveName = displayValue(part.id, "name").trim();
                const stockRaw = displayValue(part.id, "stock").trim();
                const rowValidation = {
                  id: liveId.length === 0,
                  name: liveName.length === 0,
                  stock: stockRaw === "" || parseNumber(stockRaw) == null
                };
                const rowHasError = Object.values(rowValidation).some(Boolean);
                return (
                  <div key={part.id} style={{ ...rowStyle, background: rowHasError ? "#fff5f5" : "transparent", borderLeft: rowHasError ? `3px solid ${palette.danger}` : "3px solid transparent" }}>
                    {COLUMNS.map((column, columnIndex) => {
                      const columnError = (column.key === "id" && rowValidation.id) || (column.key === "name" && rowValidation.name) || (column.key === "stock" && rowValidation.stock);
                      return (
                        <div key={column.key} style={{ minHeight: 40, display: "flex", alignItems: "center" }}>
                          <input
                            ref={(node) => {
                              const key = `${part.id}:${column.key}`;
                              if (node) cellRefs.current[key] = node;
                              else delete cellRefs.current[key];
                            }}
                            type={column.type === "number" ? "number" : "text"}
                            value={displayValue(part.id, column.key)}
                            onChange={(event) => !column.readOnly && setDraftValue(part.id, column.key, event.target.value)}
                            onBlur={() => handleBlur(part.id, column.key)}
                            onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                            list={column.key === "id" ? PART_ID_DATALIST_ID : undefined}
                            readOnly={column.readOnly}
                            aria-invalid={columnError || undefined}
                            style={inputStyle(column, columnError)}
                          />
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "center", gap: spacing(1) }}>
                      <button onClick={() => openParamEditor(part.id)} style={{ padding: "6px 12px", border: `1px solid ${palette.border}`, borderRadius: spacing(1.5), background: "#ecfeff", color: "#0e7490", cursor: "pointer" }}>{labels.params}</button>
                      <button onClick={() => clonePart(part.id)} style={{ padding: "6px 12px", border: `1px solid ${palette.primaryDark}`, borderRadius: spacing(1.5), background: palette.primarySoft, color: palette.primaryDark, cursor: "pointer" }}>{labels.clone}</button>
                      <button onClick={() => deleteRow(part.id)} style={{ padding: "6px 12px", border: `1px solid ${palette.danger}`, borderRadius: spacing(1.5), background: "#fee2e2", color: palette.danger, cursor: "pointer" }}>{labels.delete}</button>
                    </div>
                  </div>
                );
              })}
              {parts.length === 0 && <div style={{ padding: spacing(4), textAlign: "center", color: palette.textMuted }}>{labels.empty}</div>}
            </div>
          </div>
        </div>
      </div>
      {modalPart && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={labels.paramsTitle}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15, 23, 42, 0.54)",
            display: "grid",
            placeItems: "center",
            padding: spacing(4)
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeParamEditor();
          }}
        >
          <div style={{ width: "min(720px, 100%)", ...card({ padding: spacing(5) }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: spacing(3), alignItems: "start", marginBottom: spacing(4) }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>{labels.paramsTitle}</h3>
                <div style={{ color: palette.textMuted, marginTop: spacing(1) }}>{modalPart.id} / {modalPart.name || "-"}</div>
              </div>
              <button onClick={closeParamEditor} style={{ border: `1px solid ${palette.border}`, background: palette.surfaceAlt, borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>x</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing(3) }}>
              {PARAM_COLUMNS.map((column) => {
                const value = column.key === "unitPrice" ? modalComputed.unitPrice : column.key === "amount" ? modalComputed.amount : paramDraft[column.key] ?? "";
                return (
                  <label key={column.key} style={{ display: "grid", gap: spacing(1), fontSize: typography.size.sm, color: palette.textMuted }}>
                    <span>{column.label}</span>
                    <input
                      type={column.type === "number" ? "number" : "text"}
                      value={value}
                      readOnly={column.readOnly}
                      onChange={(event) => setParamDraft((prev) => ({ ...prev, [column.key]: event.target.value }))}
                      style={{
                        padding: "10px 12px",
                        border: `1px solid ${palette.border}`,
                        borderRadius: spacing(2),
                        background: column.readOnly ? "#e2e8f0" : palette.surfaceAlt,
                        color: column.readOnly ? palette.textMuted : palette.text,
                        fontSize: typography.size.md,
                        textAlign: column.type === "number" ? "right" : "left"
                      }}
                    />
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing(2), marginTop: spacing(5) }}>
              <button onClick={closeParamEditor} style={{ padding: "10px 16px", border: `1px solid ${palette.border}`, borderRadius: spacing(2), background: palette.surfaceAlt, cursor: "pointer" }}>{labels.cancel}</button>
              <button onClick={saveParamEditor} style={{ padding: "10px 18px", border: `1px solid ${palette.primaryDark}`, borderRadius: spacing(2), background: palette.primary, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{labels.save}</button>
            </div>
          </div>
        </div>
      )}
      <datalist id={PART_ID_DATALIST_ID}>{partIdOptions.map((option) => <option key={`parts-option-${option}`} value={option} />)}</datalist>
    </div>
  );
}
