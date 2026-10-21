import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolSchemas, descriptions, isWrite, errorResult } from '../src/api/schema.mjs';
import { createBridge } from './bridge.mjs';
import { bridgeOptions } from './config.mjs';

const options = bridgeOptions();
let bridge;
try { bridge = await createBridge(options); }
catch (error) {
  if (error.code !== 'EADDRINUSE' || process.env.KITTINGFLOW_BRIDGE_PORT) throw error;
  bridge = await createBridge({ ...options, port: 0 });
}
const server = new McpServer({ name: 'kittingflow', version: '1.0.0' }, {
  instructions: '最初にkitting_get_connectionで対象を確認してください。未接続なら利用者にKittingFlowのCodex接続画面で一回限りのコードを入力してもらいます。部品・レシピの追加と部品価格の編集に対応。書き込みのrequestIdは再送時も同じ値を使い、RESULT_UNKNOWN時は結果を照会してください。テンプレートIDと個別製品IDを混同しないでください。'
});
for (const [name, schema] of Object.entries(toolSchemas)) {
  server.registerTool(name, { description: descriptions[name], inputSchema: schema,
    annotations: { readOnlyHint: !isWrite(name), destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async args => {
    let result;
    try {
      if (new TextEncoder().encode(JSON.stringify(args)).length > 1048576) throw Object.assign(Error('要求が大きすぎます。'), { code: 'VALIDATION_ERROR' });
      result = name === 'kitting_get_connection' ? bridge.getConnection() : await bridge.call(name, args);
    } catch (error) { result = errorResult(error, args.requestId); }
    return { isError: !result.ok, content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  });
}
const transport = new StdioServerTransport();
await server.connect(transport);
let closing = false;
async function close() { if (closing) return; closing = true; await bridge.close(); await server.close(); }
process.stdin.on('end', () => { void close(); });
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });
