KittingFlow (Netlify + Google Apps Script)

概要
- フロントエンドを Netlify で配信し、バックエンドは Netlify Functions から Google Apps Script(GAS) の Web アプリ(`/exec`)へプロキシします。
- 在庫・進捗は Google スプレッドシートで管理します。UI はブラウザから操作でき、製品選択→ピッキング開始→次へ/中断 を行えます。

構成
- フロント: `index.html`
  - 製品のプルダウン表示、開始/現在の状態/次へ/中断ボタン
  - API コール先は `/.netlify/functions/api`
- Functions: `netlify/functions/api.js`
  - リクエストを GAS(`/exec`) へ JSON POST。非 JSON/HTML 応答は `html-from-gas`/`non-json-from-gas` として返却
  - 構造化ログを出力し、`X-Request-Id` と `X-Handler-Time` をレスポンスヘッダに付与
- GAS: `src/webapp.js`, `src/label.js`, `src/appsscript.json`
  - doPost でアクションを受け取り、シートを読み書きして JSON を返却
  - ログは Logger と（任意で）スプレッドシートへ記録可能

シート構造（推奨名称とヘッダ）
- Products
  - 例: [FancyID, ProductName, Status, RegisterDate, Assigned, RecipeID, ProgPartID, LastUpdate]
  - FancyID からレシピIDを解決。進捗部品ID/最終更新を同期
- Recipe
  - 例: [ProductID, ProductName, PartID, Qty]
  - 製品ID=レシピID の行から 使用部品ID を順序付きで取得（部品の並び順を制御可能）
- Parts
  - 例: [PartID, ProductID, PartName, ImageURL, Qty, InventoryNum, Unit, Memo]
  - 製品ID=レシピID で絞り込み。該当なし時は全件フォールバック
- Progress
  - [Status, PartID, FancyID, RecipeID, LastUpdate]
  - 開始/次へ/中断で更新。

実装済みアクション（GAS doPost）
- `list`     製品一覧を返す（`製品管理`の FancyID/製品名 を抽出）
- `start`    FancyID からピッキングを開始
  - 製品管理のレシピIDを解決→製品レシピの順序で部品IDを取得→`ピッキング進捗`に初期化(B2/C2/D2/E2)
- `snapshot` 現在の状態を返す（製品名/部品ID/部品名/必要数/画像URL）
  - 進捗 B2 が空なら、該当リストの先頭から補完
- `next`     次の部品に進め、`ピッキング進捗` と `製品管理.進捗部品ID` を更新
- `pause`    `ピッキング進捗` のステータスを中断に
- `resume`   既存（Apps Script UI用）

API 例
- POST `/.netlify/functions/api`
  - Body: `{ "action":"start"|"snapshot"|"next"|"pause"|"list", "id":"<FancyID>", "debug": true }`
  - Response: `{ ok: true/false, data?, error?, _debug? }`
  - `debug:true` か Script Properties `DEBUG_RESPONSE=true` で `_debug.log` に `Logger` の内容を同梱

デプロイ（Netlify）
- `netlify.toml` は Functions ディレクトリと CORS を設定済み。`publish = "."` で `index.html` を配信
- 環境変数（Site settings → Environment variables）
  - `GAS_ENDPOINT` … `https://script.google.com/macros/s/.../exec`
  - `API_TOKEN` …（任意）GAS Script Properties の `API_TOKEN` と同じ値
  - `ALLOW_ORIGIN` … 許可オリジン（未設定なら `*`）

GAS デプロイの自動化
- 初回にデプロイID/URLを保存し、以後は同じデプロイIDを更新して URL を固定化
- スクリプト: `scripts/deploy-gas.js`
  - 初期化: `npm run gas:deploy:init`
  - 更新:   `npm run gas:deploy`
  - Netlify の環境変数更新（任意、Netlify CLI 連携時）: `npm run gas:deploy:set-netlify`
- 依存: `@google/clasp`（.clasp.json で `rootDir: src`）。Google アカウントにログインの上で使用

ローカル開発
- Netlify CLI: `netlify dev`
  - `.env.example` を参考に `.env` に `GAS_ENDPOINT` 等を設定
  - ブラウザから `http://localhost:8888` を開く

デバッグ
- フロント
  - `console.debug('[GAS LOG]\n...')` に GAS 側のログを表示（`_debug.log` が付与された場合）
- Netlify Functions
  - すべての呼び出しで JSON 構造ログを出力。`X-Request-Id` と `X-Handler-Time` をレスポンスヘッダに付与
  - GAS が HTML/非 JSON を返した場合は `html-from-gas`/`non-json-from-gas` と `detail` を返却
- GAS（サーバ）
  - `logInfo_`/`logError_`（構造ログ）を内蔵。Script Properties によりシートへのログ保存も可能
  - スプレッドシートにログを書き出す（任意）… `ENABLE_SHEET_LOG=true`, `LOG_SHEET=Logs`

権限とセキュリティ
- `src/appsscript.json` で Web アプリの実行主体は `USER_DEPLOYING`、アクセスは `ANYONE`
- `API_TOKEN` を Netlify Functions 側で自動付与（ブラウザへは露出しません）。GAS 側で照合

よくある症状と対処
- `html-from-gas` / `non-json-from-gas`
  - 最新の `/exec` を `GAS_ENDPOINT` に設定しているか確認
  - doPost が JSON を返しているか確認（`ContentService` + `MimeType.JSON`）
- 部品が「-」のまま
  - `製品管理` に FancyID と レシピID が正しく入っているか
  - `製品レシピ` に該当レシピIDの行があるか（なければ `部品リスト` でフォールバック）
  - `ピッキング進捗` B2（部品ID）が設定されているか（開始時に先頭部品を自動設定）

ファイルガイド
- `index.html`                フロントエンド（セレクト・操作ボタン・結果表示）
- `netlify/functions/api.js`  GAS プロキシ（構造化ログ/CORS/エラーハンドリング）
- `src/webapp.js`             GAS 本体（アクション、シート更新、ログ）
- `src/label.js`              ラベル印刷機能（GAS UI 用）
- `src/appsscript.json`       GAS マニフェスト
- `scripts/deploy-gas.js`     GAS デプロイ自動化（URL固定・Netlify連携）

ライセンス
- 本リポジトリのライセンス条件に従います（記載が無い場合は社内/私用プロジェクト前提）。

主要機能
- 製品一覧・検索・選択
  - 製品管理シートから FancyID/製品名を抽出し、UIにプルダウンで表示
- ピッキング開始（初期化）
  - FancyID→レシピIDを解決し、製品レシピの順序で部品リストを作成
  - ピッキング進捗シートを自動作成/更新（ステータス/部品ID/FancyID/レシピID/最終更新）
  - 製品管理の「進捗部品ID」「最終更新」も同期（該当列があれば）
- 現在の状態（スナップショット）
  - 製品名、現在の部品ID/部品名/必要数、画像URLをJSONで返却
  - 進捗B2が空でも先頭部品を補完するフォールバックあり
- 次へ（部品の更新）
  - 製品レシピの順序に沿って次の部品へ移動し、進捗/管理シートを更新
- 中断/再開
  - 進捗ステータスと最終更新の記録（resumeは既存のGAS UI想定）
- ラベル印刷
  - `src/label.js` による QR/ID ラベルの印刷UI
- ログとデバッグ
  - フロント: `_debug.log` をコンソールに出力（debug=trueまたはScript Propertiesで有効化）
  - Functions: 構造化ログ + `X-Request-Id` で追跡
  - GAS: Logger出力、任意でシートログ（ENABLE_SHEET_LOG/LOG_SHEET）
