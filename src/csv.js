import Papa from "papaparse";
import { db } from "./db";

export async function exportAllCSV() {
  const [parts, recipes, products, progress] = await Promise.all([
    db.parts.toArray(),
    db.recipes.toArray(),
    db.products.toArray(),
    db.progress.toArray()
  ]);

  download("Parts.csv", Papa.unparse(parts));
  download("Recipe.csv", Papa.unparse(recipes));
  download("Products.csv", Papa.unparse(products));
  download("Progress.csv", Papa.unparse(progress));
}

export function download(name, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importCSV(file, target) {
  const rows = await parseCSV(file);
  if (target === "parts") {
    await db.parts.clear();
    await db.parts.bulkAdd(
      rows.map((r) => {
        const id = readCell(r, ["id", "Id", "ID", "Part ID", "PartID", "\u90e8\u54c1ID"]);
        if (!id) throw new Error("Parts.csv \u306b ID \u304c\u3042\u308a\u307e\u305b\u3093");
        return {
          id,
          name: readCell(r, ["name", "Name", "Part Name", "PartName", "\u90e8\u54c1\u540d"], id),
          stock: num(readCell(r, ["stock", "Stock", "Qty", "Quantity", "\u5728\u5eab", "Inventory", "InventoryNum"], "0")),
          imageUrl: readCell(r, ["imageUrl", "Image URL", "ImageURL", "\u753b\u50cfURL"], "")
        };
      })
    );
    return;
  }
  if (target === "recipes") {
    await db.recipes.clear();
    await db.recipes.bulkAdd(
      rows.map((r) => {
        const productId = readCell(r, [
          "productId",
          "Product ID",
          "RecipeId",
          "RecipeID",
          "Internal ID",
          "\u30ec\u30b7\u30d4ID",
          "\u5185\u90e8ID"
        ]);
        const partId = readCell(r, ["partId", "Part ID", "\u90e8\u54c1ID"]);
        if (!productId || !partId) throw new Error("Recipe.csv \u306b Product ID \u307e\u305f\u306f Part ID \u304c\u3042\u308a\u307e\u305b\u3093");
        return {
          productId,
          productName: readCell(r, ["productName", "ProductName", "Product Name", "\u88fd\u54c1\u540d"], "") || undefined,
          partId,
          qty: num(readCell(r, ["qty", "Qty", "Quantity", "\u6570\u91cf", "\u5fc5\u8981\u6570", "\u5fc5\u8981\u6570"], "0"))
        };
      })
    );
    return;
  }
  if (target === "products") {
    await db.products.clear();
    await db.products.bulkAdd(
      rows.map((r) => {
        const id = readCell(r, ["id", "Id", "ID", "Product ID", "\u88fd\u54c1ID"]);
        if (!id) throw new Error("Products.csv \u306b Product ID \u304c\u3042\u308a\u307e\u305b\u3093");
        const internalId = readCell(r, ["internalId", "Internal ID", "RecipeId", "RecipeID", "\u30ec\u30b7\u30d4ID"], "");
        return {
          id,
          name: readCell(r, ["name", "Name", "Product Name", "\u88fd\u54c1\u540d"], id),
          status: readCell(r, ["status", "Status"], "active") || "active",
          internalId: internalId || undefined
        };
      })
    );
    return;
  }
  if (target === "progress") {
    await db.progress.clear();
    if (rows.length && (("productId" in rows[0]) || ("Product ID" in rows[0]))) {
      for (const r of rows) {
        const pid = readCell(r, ["productId", "Product ID"]);
        if (!pid) throw new Error("Progress.csv \u306b Product ID \u304c\u3042\u308a\u307e\u305b\u3093");
        await db.progress.put({
          productId: pid,
          state: readCell(r, ["state", "State"], "\u6e96\u5099\u4e2d") || "\u6e96\u5099\u4e2d",
          currentIndex: num(readCell(r, ["currentIndex", "Current Index", "Index"], "0"))
        });
      }
      return;
    }
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const pid = readCell(map, ["productId", "Product ID"], "PRD-000");
    await db.progress.put({
      productId: pid,
      state: readCell(map, ["state", "State"], "\u6e96\u5099\u4e2d") || "\u6e96\u5099\u4e2d",
      currentIndex: num(readCell(map, ["currentIndex"], "0"))
    });
    return;
  }
  throw new Error("Unknown target: " + target);
}

function num(value) {
  if (typeof value === "string") {
    const normalized = value.replace(/[\s,]/g, "").trim();
    if (normalized === "") return 0;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err)
    });
  });
}

function readCell(row, keys, fallback = "") {
  if (!row || typeof row !== "object") {
    return typeof fallback === "string" ? fallback : fallback ?? "";
  }
  for (const key of keys) {
    if (key in row) {
      const value = row[key];
      if (value == null) continue;
      const str = typeof value === "string" ? value.trim() : String(value).trim();
      if (str) return str;
    }
  }
  if (typeof fallback === "string") return fallback;
  return fallback ?? "";
}
