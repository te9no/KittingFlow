import Papa from 'papaparse';
import { db } from './db';

export async function exportCSV() {
  const parts = await db.parts.toArray();
  const progressRows = [
    { key: 'state', value: (await db.progress.get('state'))?.value ?? '準備中' },
    { key: 'currentIndex', value: (await db.progress.get('currentIndex'))?.value ?? 0 },
    { key: 'productId', value: (await db.progress.get('productId'))?.value ?? 'MK-Local-0001' }
  ];
  const settingsRows = await db.settings.toArray();

  const partsCsv = Papa.unparse(parts);
  const progressCsv = Papa.unparse(progressRows);
  const settingsCsv = Papa.unparse(settingsRows);

  download('parts.csv', partsCsv);
  download('progress.csv', progressCsv);
  download('settings.csv', settingsCsv);
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importCSV(file, target) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          if (target === 'parts') {
            const normalized = rows.map(r => ({
              id: r.id || r['部品ID'] || r['id'],
              name: r.name || r['部品名'] || '',
              qty: Number(r.qty ?? r['必要数'] ?? 0),
              stock: Number(r.stock ?? r['在庫'] ?? 0),
              imageUrl: r.imageUrl || r['画像URL'] || ''
            }));
            await db.parts.clear();
            await db.parts.bulkAdd(normalized);
          } else if (target === 'progress') {
            await db.progress.clear();
            for (const r of rows) {
              await db.progress.put({ key: r.key, value: isNaN(Number(r.value)) ? r.value : Number(r.value) });
            }
          } else if (target === 'settings') {
            await db.settings.clear();
            for (const r of rows) {
              await db.settings.put({ key: r.key, value: r.value });
            }
          }
          resolve(true);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err)
    });
  });
}
