import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db";
import { card, layout, palette, spacing, typography } from "../styles/theme";

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
  const [toolbarOffset, setToolbarOffset] = useState("0px");
  const [scrollAreaHeight, setScrollAreaHeight] = useState(null);
  const [tableHeaderOffset, setTableHeaderOffset] = useState("0px");
  const cellRefs = useRef({});
  const tableScrollRef = useRef(null);
  const toolbarRef = useRef(null);

  const load = useCallback(async () => {
    setParts(await db.parts.toArray());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const updateLayoutMetrics = useCallback(() => {
    if (typeof document === "undefined") return;
    const GAP = 12;
    const appHeader = document.querySelector("[data-app-header='true']");
    const headerHeight = appHeader?.getBoundingClientRect().height ?? 0;
    const nextToolbarTop = `${Math.round(headerHeight + GAP)}px`;
    setToolbarOffset((prev) => (prev === nextToolbarTop ? prev : nextToolbarTop));

    const toolbarHeight = toolbarRef.current?.getBoundingClientRect().height ?? 0;
    const toolbarGap = 8;
    const nextHeaderTop = `${Math.round(headerHeight + GAP + toolbarHeight + toolbarGap)}px`;
    setTableHeaderOffset((prev) => (prev === nextHeaderTop ? prev : nextHeaderTop));

    if (tableScrollRef.current) {
      const rect = tableScrollRef.current.getBoundingClientRect();
      const footerGap = 32;
      const available = Math.floor(window.innerHeight - rect.top - footerGap);
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

  useEffect(() => {
    updateLayoutMetrics();
  }, [parts.length, message, updateLayoutMetrics]);

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

  const incrementPartId = (value) => {
    const match = String(value ?? "").match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const digits = match[2];
      const next = String(Number(digits) + 1).padStart(digits.length, "0");
      return `${prefix}${next}`;
    }
    return `${value || ""}1`;
  };

  const generateUniquePartId = useCallback(
    (baseId) => {
      const existing = new Set(parts.map((part) => part.id));
      let candidate = incrementPartId(baseId);
      let guard = 0;
      while (existing.has(candidate) && guard < 1000) {
        candidate = incrementPartId(candidate);
        guard += 1;
      }
      return candidate;
    },
    [parts]
  );

  const displayValue = (id, field) => {
    const draft = drafts[id]?.[field];
    if (draft !== undefined) return draft;
    const original = findOriginal(id);
    if (!original) return "";
    if (field === "stock") {
      return original.stock == null ? "" : String(original.stock);
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
        const rowDraft = { ...(next[currentId] || {}) };
        delete rowDraft.id;
        delete next[currentId];
        if (Object.keys(rowDraft).length > 0) {
          next[trimmed] = { ...(next[trimmed] || {}), ...rowDraft };
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

  const clonePart = async (id) => {
    const original = findOriginal(id);
    if (!original) return;
    try {
      const newId = generateUniquePartId(original.id);
      await db.parts.add({
        id: newId,
        name: original.name ?? "",
        stock: Number(original.stock ?? 0),
        imageUrl: original.imageUrl ?? ""
      });
      setMessage(`部品「${original.name || id}」を複製しました`);
      await load();
      setPendingFocus({ id: newId, field: "name" });
    } catch (error) {
      console.error(error);
      setMessage("部品の複製に失敗しました");
    }
  };

  const containerStyle = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing(4)
  };

  const tableContainerStyle = {
    ...card({ padding: "0" })
  };

  const toolbarStyle = useMemo(
    () => ({
      position: "sticky",
      top: toolbarOffset,
      zIndex: 50,
      background: palette.background,
      padding: `${spacing(2)} 0`,
      marginBottom: spacing(3),
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }),
    [toolbarOffset]
  );

  const gridTemplateColumns = useMemo(
    () =>
      [
        "minmax(140px, 1fr)",
        "minmax(180px, 1.1fr)",
        "minmax(110px, 0.7fr)",
        "minmax(200px, 1.3fr)",
        "minmax(90px, 0.5fr)"
      ].join(" "),
    []
  );

  const headerRowStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns,
      gap: spacing(2),
      background: palette.surfaceAlt,
      padding: `${spacing(2)} ${spacing(3)}`,
      borderBottom: `1px solid ${palette.border}`,
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
      position: "sticky",
      top: tableHeaderOffset,
      zIndex: 40
    }),
    [gridTemplateColumns, tableHeaderOffset]
  );

  const rowStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns,
      gap: spacing(2),
      alignItems: "center",
      padding: `${spacing(2)} ${spacing(3)}`,
      borderBottom: `1px solid ${palette.border}`
    }),
    [gridTemplateColumns]
  );

  const scrollAreaStyle = useMemo(
    () => ({
      position: "relative",
      maxHeight: scrollAreaHeight ? `${scrollAreaHeight}px` : "60vh",
      overflowY: "auto",
      overflowX: "hidden"
    }),
    [scrollAreaHeight]
  );

  const gridWrapperStyle = useMemo(
    () => ({
      minWidth: 720
    }),
    []
  );

  const emptyStateStyle = {
    padding: spacing(4),
    textAlign: "center",
    color: palette.textMuted
  };

  const cellPaddingStyle = {
    display: "flex",
    flexDirection: "column",
    gap: spacing(1),
    minHeight: "40px",
    justifyContent: "center"
  };

  return (
    <div style={containerStyle}>
      <header ref={toolbarRef} style={toolbarStyle}>
        <h3 style={{ margin: 0, fontWeight: typography.headingWeight }}>🧩 部品一覧（セル編集）</h3>
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
        <div
          style={{
            marginBottom: spacing(3),
            padding: `${spacing(2)} ${spacing(3)}`,
            background: palette.primarySoft,
            border: `1px solid ${palette.primaryDark}1a`,
            borderRadius: spacing(2),
            color: palette.primaryDark
          }}
        >
          {message}
        </div>
      )}

      <div style={tableContainerStyle}>
        <div style={{ overflowX: "auto" }}>
          <div style={gridWrapperStyle}>
            <div style={headerRowStyle}>
              {COLUMNS.map((column) => (
                <div key={column.key} style={{ fontWeight: 600, fontSize: typography.size.sm, textAlign: column.align }}>
                  {column.label}
                </div>
              ))}
              <div style={{ fontWeight: 600, fontSize: typography.size.sm, textAlign: "center" }}>操作</div>
            </div>
          </div>

          <div ref={tableScrollRef} style={scrollAreaStyle}>
            <div style={gridWrapperStyle}>
              {parts.map((part, rowIndex) => (
                <div key={part.id} style={rowStyle}>
                  {COLUMNS.map((column, columnIndex) => (
                    <div key={column.key} style={{ ...cellPaddingStyle, textAlign: column.align }}>
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
                          border: `1px solid ${palette.border}`,
                          borderRadius: spacing(1.5),
                          fontSize: typography.size.sm,
                          textAlign: column.align,
                          background: palette.surfaceAlt
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "center", gap: spacing(1) }}>
                    <button
                      onClick={() => clonePart(part.id)}
                      style={{
                        padding: "6px 12px",
                        border: `1px solid ${palette.primaryDark}`,
                        borderRadius: spacing(1.5),
                        background: palette.primarySoft,
                        color: palette.primaryDark,
                        cursor: "pointer"
                      }}
                    >
                      複製
                    </button>
                    <button
                      onClick={() => deleteRow(part.id)}
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
                  </div>
                </div>
              ))}

              {parts.length === 0 && <div style={emptyStateStyle}>部品データがありません。CSV のインポートまたは行の追加を行ってください。</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
