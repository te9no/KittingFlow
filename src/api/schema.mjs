import { z } from 'zod';

const id = z.string().trim().min(1).max(128).regex(/^[^\x00-\x1f\x7f]+$/);
const partId = id.refine(v => !v.startsWith('__tmp_part__'));
const name = z.string().trim().min(1).max(256);
const number = z.number().finite().nonnegative();
const part = z.object({
  partId, name, stock: number.default(0), supplier: z.string().max(256).default(''),
  imageUrl: z.string().max(2048).refine(v => !v || /^https?:\/\//i.test(v) && URL.canParse(v)).default(''),
  purchaseAmount: number.default(0), purchaseQuantity: number.default(0),
  manualUnitPrice: number.nullable().default(null), usageQuantity: number.default(1)
}).strict();
const template = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('existing'), templateId: id }).strict(),
  z.object({ mode: z.literal('new'), templateId: id, name }).strict()
]);
const parts = z.array(part).min(1).max(200);
const lines = z.array(z.object({ partId, qty: z.number().finite().positive() }).strict()).min(1).max(200);
const context = { workspaceId: id, sessionId: id };
const write = { ...context, requestId: id, dryRun: z.boolean().default(false) };
const list = { ...context, query: z.string().max(256).default(''), cursor: z.string().max(4096).optional(), limit: z.number().int().min(1).max(200).default(50) };
export const toolSchemas = {
  kitting_get_connection: z.object({}).strict(),
  kitting_list_parts: z.object(list).strict(),
  kitting_list_templates: z.object(list).strict(),
  kitting_get_recipe: z.object({ ...context, templateId: id }).strict(),
  kitting_create_parts: z.object({ ...write, parts }).strict(),
  kitting_add_recipe: z.object({ ...write, template, lines }).strict(),
  kitting_create_bundle: z.object({ ...write, parts, template, lines }).strict(),
  kitting_get_request: z.object({ ...context, requestId: id }).strict()
};
export const descriptions = {
  kitting_get_connection: '接続中のKittingFlowの保存領域とセッションを確認します。最初に実行してください。',
  kitting_list_parts: '部品をID・名称で検索します。',
  kitting_list_templates: 'レシピの製品テンプレートを検索します。個別製品IDとは異なります。',
  kitting_get_recipe: 'テンプレートの既存レシピ行を取得します。',
  kitting_create_parts: '部品を追加します。既存IDは上書きしません。同じrequestIdで安全に再送できます。',
  kitting_add_recipe: '新規または既存テンプレートにレシピ行を追加します。既存行の数量加算はしません。',
  kitting_create_bundle: '部品とレシピを全件まとめて追加します。失敗時は全件取り消します。',
  kitting_get_request: 'requestIdの保存済み結果を照会します。not_foundは実行中の可能性があります。'
};
export const isWrite = name => ['kitting_create_parts', 'kitting_add_recipe', 'kitting_create_bundle'].includes(name);
export function fail(code, message, details = []) { throw Object.assign(new Error(message), { code, details }); }
export function errorResult(error, requestId) {
  return { ok: false, ...(requestId ? { requestId } : {}), error: {
    code: error.code || (error.issues ? 'VALIDATION_ERROR' : 'STORAGE_ERROR'),
    message: error.code ? error.message : error.issues ? '入力を確認してください。' : '保存処理に失敗しました。',
    retryable: error.code === 'RESULT_UNKNOWN',
    details: error.details || error.issues?.map(i => ({ path: i.path.join('.'), message: i.message })) || []
  } };
}
