import Papa from 'papaparse';
import { db } from './db';

export async function exportAllCSV() {
  const [parts, recipes, products, progress] = await Promise.all([
    db.parts.toArray(),
    db.recipes.toArray(),
    db.products.toArray(),
    db.progress.toArray()
  ]);

  download('Parts.csv', Papa.unparse(parts));
  download('Recipe.csv', Papa.unparse(recipes));
  download('Products.csv', Papa.unparse(products));
  download('Progress.csv', Papa.unparse(progress));
}

export function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importCSV(file, target) {
  const rows = await parseCSV(file);
  if (target === 'parts') {
    await db.parts.clear();
    await db.parts.bulkAdd(rows.map(r => ({
      id: r.id || r['Part ID'] || r['部品ID'],
      name: r.name || r['Part Name'] || r['部品名'] || '',
      stock: num(r.stock ?? r['Stock'] ?? r['在庫'] ?? 0),
      imageUrl: r.imageUrl || r['Image URL'] || r['画像URL'] || ''
    })));
    return;
  }
  if (target === 'recipes') {
    await db.recipes.clear();
    await db.recipes.bulkAdd(rows.map(r => ({
      productId: r.productId || r['Product ID'],
      partId: r.partId || r['Part ID'],
      qty: num(r.qty ?? r['Quantity'] ?? r['必要数'] ?? 0)
    })));
    return;
  }
  if (target === 'products') {
    await db.products.clear();
    await db.products.bulkAdd(rows.map(r => ({
      id: r.id || r['Product ID'],
      name: r.name || r['Product Name'] || '',
      status: r.status || r['Status'] || 'active'
    })));
    return;
  }
  if (target === 'progress') {
    await db.progress.clear();
    if (rows.length && (('productId' in rows[0]) || ('Product ID' in rows[0]))) {
      for (const r of rows) {
        const pid = r.productId || r['Product ID'];
        await db.progress.put({
          productId: pid,
          state: r.state || r['State'] || '準備中',
          currentIndex: num(r.currentIndex ?? r['Current Index'] ?? 0)
        });
      }
      return;
    }
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    await db.progress.put({
      productId: 'PRD-000',
      state: map.state ?? '準備中',
      currentIndex: num(map.currentIndex ?? 0)
    });
    return;
  }
  throw new Error('Unknown target: ' + target);
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: res => resolve(res.data),
      error: err => reject(err)
    });
  });
}
