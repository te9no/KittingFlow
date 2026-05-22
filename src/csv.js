import Papa from "papaparse";
import { db } from "./db";

export async function exportAllCSV() {
  const [parts, recipes, products, progress] = await Promise.all([
    db.parts.toArray(),
    db.recipes.toArray(),
    db.products.toArray(),
    db.progress.toArray()
  ]);

  download("Parts.csv", Papa.unparse(parts.map((part) => ({
    ...part,
    unitPrice: effectiveUnitPrice(part),
    amount: calculatedAmount(part)
  }))));
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
          purchaseAmount: num(readCell(r, ["purchaseAmount", "purchasePrice", "Purchase Amount", "Purchase Price", "\u4ed5\u5165\u91d1\u984d", "\u4ed5\u5165\u308c\u5024"], "0")),
          purchaseQuantity: num(readCell(r, ["purchaseQuantity", "Purchase Quantity", "Purchase Qty", "\u4ed5\u5165\u308c\u6570"], "0")),
          manualUnitPrice: readCell(r, ["manualUnitPrice", "Manual Unit Price", "\u5358\u4fa1\uff08\u624b\u5165\u529b\uff09", "\u624b\u5165\u529b\u5358\u4fa1"], ""),
          usageQuantity: num(readCell(r, ["usageQuantity", "Usage Quantity", "Usage Qty", "\u4f7f\u7528\u6570\u91cf"], "0")),
          supplier: readCell(r, ["supplier", "Supplier", "\u4ed5\u5165\u308c\u5148"], ""),
          imageUrl: readCell(r, ["imageUrl", "Image URL", "ImageURL", "ImgURL", "\u753b\u50cfURL"], "")
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
          salePrice: num(readCell(r, ["salePrice", "Sale Price", "\u8ca9\u58f2\u91d1\u984d"], "0")),
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

function calculatedUnitPrice(part) {
  const purchaseAmount = Number(part?.purchaseAmount ?? part?.purchasePrice ?? 0);
  const purchaseQuantity = Number(part?.purchaseQuantity || 0);
  if (!purchaseAmount || !purchaseQuantity) return 0;
  return Math.round((purchaseAmount / purchaseQuantity) * 100) / 100;
}

function calculatedAmount(part) {
  return Math.round(effectiveUnitPrice(part) * Number(part?.usageQuantity || 0) * 100) / 100;
}

function effectiveUnitPrice(part) {
  if (part?.manualUnitPrice !== "" && part?.manualUnitPrice != null) {
    return num(part.manualUnitPrice);
  }
  return calculatedUnitPrice(part);
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
