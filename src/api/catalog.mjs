import { toolSchemas, isWrite, fail, errorResult } from './schema.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
async function hash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
function unique(values, code) {
  if (new Set(values).size !== values.length) fail(code, '同じIDを複数回指定しています。');
}
function templates(products, recipes) {
  const ids = new Set([...products.map(p => p.internalId || p.id), ...recipes.map(r => r.productId)].filter(Boolean));
  return [...ids].map(templateId => {
    const exact = products.filter(p => p.status === 'template' && (p.internalId || p.id) === templateId);
    const candidates = exact.length ? exact.map(p => p.name) : [
      ...products.filter(p => (p.internalId || p.id) === templateId).map(p => p.name),
      ...recipes.filter(r => r.productId === templateId).map(r => r.productName)
    ];
    const names = [...new Set(candidates.filter(Boolean))];
    return { templateId, name: names[0] || templateId, ambiguous: names.length > 1 };
  });
}
function resolveTemplate(all, id) {
  const t = all.find(t => t.templateId === id);
  if (!t) fail('TEMPLATE_NOT_FOUND', 'テンプレートが見つかりません。');
  if (t.ambiguous) fail('AMBIGUOUS_TEMPLATE', 'テンプレートの名称が一致していません。');
  return t;
}
function paginate(rows, input, tool) {
  let after = '';
  if (input.cursor) {
    try {
      const c = JSON.parse(decodeURIComponent(input.cursor));
      if (c.tool !== tool || c.query !== input.query || c.workspaceId !== input.workspaceId || typeof c.after !== 'string') throw Error();
      after = c.after;
    } catch { fail('VALIDATION_ERROR', '検索カーソルが不正です。'); }
  }
  const key = row => row.partId || row.templateId;
  const query = input.query.toLocaleLowerCase();
  const filtered = rows.filter(r => key(r) > after && `${key(r)}\n${r.name}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  const items = filtered.slice(0, input.limit);
  const nextCursor = filtered.length > input.limit ? encodeURIComponent(JSON.stringify({ tool, query: input.query, workspaceId: input.workspaceId, after: key(items.at(-1)) })) : null;
  return { items, nextCursor };
}

export async function executeCatalog(db, tool, raw, sessionId) {
  try {
    if (new TextEncoder().encode(JSON.stringify(raw)).length > 1048576) fail('VALIDATION_ERROR', '要求が1MiBを超えています。');
    if (!toolSchemas[tool] || tool === 'kitting_get_connection') fail('VALIDATION_ERROR', '未対応の操作です。');
    const input = toolSchemas[tool].parse(raw);
    if (input.sessionId !== sessionId) fail('SESSION_MISMATCH', '接続を確認してください。');
    const { requestId, dryRun, sessionId: ignoredSession, workspaceId, ...payload } = input;
    const digest = isWrite(tool) ? await hash({ tool, payload }) : null;
    return await db.transaction(isWrite(tool) ? 'rw' : 'r', db.parts, db.products, db.recipes, db.apiMeta, db.apiRequests, async () => {
      if ((await db.apiMeta.get('workspace'))?.value !== workspaceId) fail('SESSION_MISMATCH', '保存領域が変更されています。再接続してください。');
      const key = `${workspaceId}:${requestId}`;
      if (tool === 'kitting_get_request') {
        const saved = await db.apiRequests.get(key);
        return { ok: true, data: saved ? { status: 'completed', result: saved.result } : { status: 'not_found' } };
      }
      if (isWrite(tool) && !dryRun) {
        const saved = await db.apiRequests.get(key);
        if (saved) {
          if (saved.hash !== digest) fail('IDEMPOTENCY_CONFLICT', '同じrequestIdの内容が異なります。');
          return { ...saved.result, replayed: true };
        }
      }
      if (tool === 'kitting_list_parts') {
        const rows = (await db.parts.toArray()).filter(p => p.id && !p.id.startsWith('__tmp_part__'))
          .map(({ id, ...p }) => ({ ...p, partId: id, manualUnitPrice: p.manualUnitPrice === '' ? null : p.manualUnitPrice ?? null }));
        return { ok: true, data: paginate(rows, input, tool) };
      }
      if (tool === 'kitting_update_part_prices') {
        unique(input.updates.map(u => u.partId), 'VALIDATION_ERROR');
        const changes = [];
        for (const update of input.updates) {
          const part = await db.parts.get(update.partId);
          if (!part) fail('PART_NOT_FOUND', `部品 ${update.partId} がありません。`);
          const before = {
            purchaseAmount: Number(part.purchaseAmount ?? part.purchasePrice ?? 0),
            purchaseQuantity: Number(part.purchaseQuantity || 0),
            manualUnitPrice: part.manualUnitPrice === '' || part.manualUnitPrice == null ? null : Number(part.manualUnitPrice)
          };
          if (JSON.stringify(canonical(before)) !== JSON.stringify(canonical(update.expected))) fail('PRICE_CONFLICT', '価格が変更されています。再取得してください。', [{ partId: update.partId, current: before }]);
          const after = update.prices;
          if (after.manualUnitPrice === null && after.purchaseAmount > 0 && after.purchaseQuantity === 0) fail('VALIDATION_ERROR', '仕入金額から単価を計算するには仕入れ数が必要です。');
          const unitPrice = after.manualUnitPrice ?? (after.purchaseQuantity ? after.purchaseAmount / after.purchaseQuantity : 0);
          if (!Number.isFinite(unitPrice)) fail('VALIDATION_ERROR', '計算単価が大きすぎます。');
          changes.push({ partId: update.partId, before, after, unitPrice });
        }
        if (dryRun) return { ok: true, requestId, workspaceId, preview: { wouldUpdate: changes } };
        for (const { partId, after } of changes) await db.parts.update(partId, { ...after, manualUnitPrice: after.manualUnitPrice ?? '' });
        const result = { ok: true, requestId, workspaceId, replayed: false, data: { updated: changes } };
        await db.apiRequests.add({ key, hash: digest, tool, createdAt: new Date().toISOString(), result });
        return result;
      }
      const products = await db.products.toArray();
      const recipes = await db.recipes.toArray();
      const allTemplates = templates(products, recipes);
      if (tool === 'kitting_list_templates') return { ok: true, data: paginate(allTemplates, input, tool) };
      if (tool === 'kitting_get_recipe') return { ok: true, data: {
        template: resolveTemplate(allTemplates, input.templateId),
        lines: recipes.filter(r => r.productId === input.templateId).sort((a, b) => a.id - b.id).map(r => ({ recipeLineId: r.id, partId: r.partId, qty: r.qty }))
      } };
      const newParts = input.parts || [];
      const newLines = input.lines || [];
      unique(newParts.map(p => p.partId), 'ALREADY_EXISTS');
      unique(newLines.map(p => p.partId), 'RECIPE_LINE_EXISTS');
      const partMap = new Map((await db.parts.toArray()).map(p => [p.id, p]));
      for (const p of newParts) {
        if (partMap.has(p.partId)) fail('ALREADY_EXISTS', `部品 ${p.partId} は登録済みです。`);
        partMap.set(p.partId, p);
      }
      const t = input.template;
      let templateName;
      if (t?.mode === 'new') {
        if (allTemplates.some(p => p.templateId === t.templateId) || products.some(p => p.id === t.templateId)) fail('ALREADY_EXISTS', 'テンプレートIDは使用済みです。');
        templateName = t.name;
      } else if (t) templateName = resolveTemplate(allTemplates, t.templateId).name;
      newLines.forEach((line, index) => {
        if (!partMap.has(line.partId)) fail('PART_NOT_FOUND', '部品が登録されていません。', [{ path: `lines[${index}].partId`, value: line.partId }]);
        if (recipes.some(r => r.productId === t.templateId && r.partId === line.partId)) fail('RECIPE_LINE_EXISTS', '部品は既にレシピに登録されています。');
      });
      const created = { parts: newParts.length, templates: t?.mode === 'new' ? 1 : 0, recipeLines: newLines.length };
      if (dryRun) return { ok: true, requestId, workspaceId, preview: { wouldCreate: created } };
      for (const { partId, manualUnitPrice, ...p } of newParts) await db.parts.add({ ...p, id: partId, manualUnitPrice: manualUnitPrice ?? '' });
      if (t?.mode === 'new') await db.products.add({ id: t.templateId, internalId: t.templateId, name: t.name, status: 'template', salePrice: 0 });
      const recipeLines = [];
      for (const line of newLines) {
        const recipeLineId = await db.recipes.add({ productId: t.templateId, productName: templateName, partId: line.partId, partName: partMap.get(line.partId).name, qty: line.qty });
        recipeLines.push({ recipeLineId, ...line });
      }
      const result = { ok: true, requestId, workspaceId, replayed: false, data: { partIds: newParts.map(p => p.partId), templateId: t?.templateId || null, recipeLines, created } };
      await db.apiRequests.add({ key, hash: digest, tool, createdAt: new Date().toISOString(), result });
      return result;
    });
  } catch (error) { return errorResult(error, raw?.requestId); }
}
