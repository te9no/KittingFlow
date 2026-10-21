# KittingFlow 部品とレシピの追加API設計

Codexから部品登録、新しい製品テンプレートの作成、既存テンプレートへのレシピ行追加を行う。外部向けの入口はMCPとし、ブラウザ内の共通サービスが入力検証とIndexedDBへの保存を担当する。ローカルHTTP接続とHTTPS画面向けのWSS中継を実装済み。接続手順は [Codex接続ガイド](codex-setup.md) を参照。

## 現行構造と設計方針

実装の根拠は `src/db.js`、`src/components/PartsTable.jsx`、`src/components/RecipeTable.jsx`。保存先はDexieの `kittingflow_local`、スキーマバージョン5。静的サイトであり、現状はサーバーAPIがない。Node.jsにAPIを追加するだけでは、利用中ブラウザのIndexedDBを操作できない。

| APIでの名称 | 現在の保存先 | 意味 |
| --- | --- | --- |
| partId | parts.id | 部品ID |
| templateId | recipes.productId、products.internalId | 部品構成を共有する製品テンプレートID |
| productInstanceId | products.id | 個別の製品ID。今回の追加APIでは作成しない |
| recipeLineId | recipes.id | 自動採番されるレシピ行ID |

新規テンプレートは既存画面と同じく `products` に `{id: templateId, internalId: templateId, name, status: "template", salePrice: 0}` を保存する。レシピ行にはテンプレートIDを保存し、製品個体IDからの暗黙変換は行わない。

対象は検索・追加・部品価格の編集・結果の照会。在庫加算、削除、ピッキング実行、CSV全置換、Gist送信は公開しない。部品の登録時に指定する `stock` は初期在庫であり、レシピ登録や価格編集では在庫を変更しない。

## 接続方式

```text
Codex
  ↓ MCP stdio
ローカルMCPサーバー
  ↓ 認証済みブラウザ接続へコマンドを中継
KittingFlowを開いているブラウザ
  ↓ 共通登録サービス
Dexieトランザクション → 既存のIndexedDB
```

MCPはCodexにツール名、用途、入力スキーマを提示する。対応する接続方式は[OpenAI公式MCPドキュメント](https://developers.openai.com/codex/mcp)を参照。以下のブラウザ中継方式はKittingFlow側の設計であり、Codexの標準機能ではない。

HTTP画面はloopback WebSocket、HTTPS画面は証明書を設定したloopback WSSへ接続する。MCPプロセスが127.0.0.1のみに中継口を開き、ブラウザが接続する。ポート番号は設定可能とし、APIは任意のJavaScript実行や任意のURLへの中継を受け付けない。

既存のHTTPS公開サイトから接続する場合は、信頼された証明書を使うWSS中継などの追加構成と、対象ブラウザのローカル接続権限・CSPの確認が必要。公開サイトでの動作確認を別の受入条件とする。開発用URLと公開URLでは保存領域が異なるため、開発用画面から公開サイトの在庫を操作できるとは扱わない。本番データを扱うときは、実際にそのデータを保存したオリジン・ブラウザプロファイルを接続する。

接続時にアプリ画面へ接続先と権限を表示し、短時間有効な一回限りのペアリングコードで結び付ける。中継サーバーはWebSocketのOriginを許可リストと照合し、認証完了までデータを送らない。長期トークンやコードをURL・ログ・Gitに保存しない。UIから接続を解除すると、その接続資格を失効させる。

ブラウザDBに永続的な `workspaceId` を発行し、接続ごとに一時的な `sessionId` を発行する。全データツールは両方を必須とする。同一workspaceで複数タブを開いても、書き込み先はペアリングした1セッションに固定する。切断時は別タブに勝手に切り替えない。画面が閉じているときは `APP_NOT_CONNECTED` を返す。

## 公開するMCPツール

全入力オブジェクトは未知のキーを拒否する。読み取り系には `readOnlyHint: true`、追加系には `readOnlyHint: false` を指定する。権限検証はサーバー・ブラウザ側で実施し、ツールの注釈だけに依存しない。

| ツール | 固有の入力 | 結果 |
| --- | --- | --- |
| kitting_get_connection | なし | 接続状態、workspaceId、sessionId、origin、apiVersion |
| kitting_list_parts | query、cursor、limit | 部品一覧、nextCursor |
| kitting_list_templates | query、cursor、limit | テンプレートIDと名称、nextCursor |
| kitting_get_recipe | templateId | テンプレートと既存のレシピ行 |
| kitting_create_parts | requestId、dryRun、parts | 追加部品、件数 |
| kitting_update_part_prices | requestId、dryRun、updates | 変更前後の価格、計算単価 |
| kitting_add_recipe | requestId、dryRun、template、lines | テンプレートと追加レシピ行 |
| kitting_create_bundle | requestId、dryRun、parts、template、lines | 部品とレシピを一括登録した結果 |
| kitting_get_request | requestId | 保存済みの登録結果、またはnot_found |

`kitting_get_connection` 以外は `workspaceId` と `sessionId` を共通入力とする。追加系の `dryRun` は省略時false。trueなら検証と予定件数のみを返し、DBも再送記録も変更しない。実行時にも全検証を行い直す。単純な追加のたびに別の承認操作を必須にはしない。

検索はquery省略時に全件を対象とし、ID・名称の部分一致。limitは既定50、範囲1〜200。カーソルは対象・検索条件・最後のIDに結び付け、別条件で再利用したら拒否する。一覧はID昇順。レシピ行は既存の採番ID昇順で返す。1要求のparts・linesはそれぞれ最大200件、要求全体は最大1MiBとする。

## 登録データの契約

価格編集の `updates` は最大200件。各要素は `partId`、`expected`、`prices` を持ち、後二者は `purchaseAmount`、`purchaseQuantity`、`manualUnitPrice` の3項目を必須とする。金額と数は非負数、手入力単価は非負数またはnull。未設定の既存金額・数は0、手入力単価はnullとして照合する。現在値がexpectedと違えば `PRICE_CONFLICT` を返し全件を取り消す。nullの単価は仕入金額÷仕入れ数で算出し、正の仕入金額には正の仕入れ数が必要。在庫・名称・レシピ数量は変更しない。dryRunとrequestIdによる再送にも対応する。

### 部品

| 項目 | 型と規則 | 省略時 |
| --- | --- | --- |
| partId | 文字列、前後空白除去後1〜128文字、制御文字禁止、`__tmp_part__` 接頭辞禁止 | 必須 |
| name | 文字列、前後空白除去後1〜256文字 | 必須 |
| stock | 有限の数値、0以上 | 0 |
| supplier | 文字列、最大256文字 | 空文字 |
| imageUrl | httpまたはhttpsのURL、最大2048文字、空文字可 | 空文字 |
| purchaseAmount | 有限の数値、0以上 | 0 |
| purchaseQuantity | 有限の数値、0以上 | 0 |
| manualUnitPrice | 有限の数値、0以上、またはnull | null |
| usageQuantity | 有限の数値、0以上 | 1 |

APIの `partId` をDBの `id` に写す。`manualUnitPrice: null` は既存画面に合わせDBでは空文字で保存する。数値文字列は受け付けない。小数は既存の数量表現に合わせ許可し、整数に丸めない。計算項目 `unitPrice` と `amount` は入力不可。imageUrlは文字列として保存するのみで、中継サーバーは画像を取得しない。

部品IDは大文字小文字を区別する。同じ要求内の重複ID、既存の部品IDは `ALREADY_EXISTS`。既存レコードを上書きしない。

### テンプレートとレシピ行

`template` は次のいずれか。両モードともtemplateIdは部品IDと同じ文字数・制御文字規則とする。

```json
{"mode":"existing","templateId":"P001"}
```

```json
{"mode":"new","templateId":"P002","name":"センサーボード"}
```

newではnameを必須とし、部品nameと同じ規則にする。テンプレートIDが既存の `products.id`、`products.internalId`、`recipes.productId` のいずれかに存在すると競合として拒否する。

existingでは `products.internalId || products.id` または `recipes.productId` に一致するテンプレートを解決する。statusがtemplateの製品レコードを優先して名称を取得し、それがなければ一致する製品・レシピの名称を参照する。候補の名称が矛盾する場合は `AMBIGUOUS_TEMPLATE` を返し、恣意的に名称を選ばない。候補なしは `TEMPLATE_NOT_FOUND`。個別製品のIDをinternalIdの代わりに解釈しない。

`lines` は1〜200件の `{partId, qty}`。qtyは有限の数値で0より大きいこと。partIdは既存部品、または同じbundleで追加する部品を参照する。名称はマスターから取得し、呼出元からpartName・productName・recipeLineIdを受け付けない。

同一テンプレート内の同一partIdは追加を拒否する。現行画面のドラッグ操作は既存行のqtyを1増やすが、このAPIでは加算しない。既存DBに重複行がある場合も該当部品の追加を拒否する。既存レシピを置換せず、新規行は入力順に採番して末尾へ追加する。

## 一括登録の例

`kitting_create_bundle` の入力。workspaceIdとsessionIdは接続照会の戻り値を利用する。

```json
{
  "workspaceId": "workspace-example",
  "sessionId": "session-example",
  "requestId": "register-sensor-kit-001",
  "dryRun": false,
  "parts": [
    {"partId":"SENSOR001","name":"温度センサー","stock":100},
    {"partId":"PCB003","name":"センサー基板","stock":20}
  ],
  "template": {"mode":"new","templateId":"P002","name":"センサーボード"},
  "lines": [
    {"partId":"PCB003","qty":1},
    {"partId":"SENSOR001","qty":2}
  ]
}
```

成功時の構造化結果。recipeLineIdはDBによる採番値の例。

```json
{
  "ok": true,
  "requestId": "register-sensor-kit-001",
  "workspaceId": "workspace-example",
  "replayed": false,
  "data": {
    "partIds": ["SENSOR001","PCB003"],
    "templateId": "P002",
    "recipeLines": [
      {"recipeLineId":101,"partId":"PCB003","qty":1},
      {"recipeLineId":102,"partId":"SENSOR001","qty":2}
    ],
    "created": {"parts":2,"templates":1,"recipeLines":2}
  }
}
```

単独追加系も `data` を同じ形にし、対象外の配列は空、templateIdはnull、件数は0とする。dryRun成功時は `data` の代わりに `preview: {wouldCreate: {parts, templates, recipeLines}}` を返す。採番IDは確約しない。MCPのtextには短い件数の要約、structuredContentには完全な結果を返す。

## 原子性と再送

requestIdは1〜128文字の非空文字列。成功済み要求について、workspaceIdとrequestIdをキーに操作名・正規化した入力のハッシュ・結果を保存する。入力ハッシュには操作内容を含め、sessionId、requestId、dryRunを含めない。同じrequestIdを異なる操作や異なる内容に使うと `IDEMPOTENCY_CONFLICT`。同じ内容なら新規登録せず、以前の結果を `replayed: true` で返す。

スキーマバージョン6で `apiRequests: '&key'`、`apiMeta: '&key'` を追加し、既存の4テーブル定義を維持する。新しい一意インデックスを既存レシピへ直ちに強制せず、重複チェックと挿入を同じreadwriteトランザクション内で行う。

部品、テンプレート、レシピ、apiRequestsへの成功結果保存を一つのトランザクションで確定する。途中で1件でも失敗すれば全件をロールバックする。トランザクション内で通信・UI待機・ハッシュ計算を行わない。入力の正規化・ハッシュ計算は開始前、DBを参照する存在確認はトランザクション内で行う。

成功記録は自動期限切れにせず、そのDBの存続期間中保持する。通信タイムアウトは失敗確定とは扱わない。Codexは同じrequestIdで結果照会または再送し、新しいrequestIdでやり直さない。結果照会のnot_foundは「未保存」であり、処理中の要求が後で確定する可能性を排除しない。同じIDによる再送はトランザクションで直列化する。

既存のCSV/Gist復元で業務データのみを巻き戻すと要求履歴と不一致になる。復元処理は新workspaceIdの発行・apiRequestsの消去・接続解除を一括で行い、旧workspaceIdへの要求を拒否するよう変更する。API用の監査情報・資格情報はCSV/Gistへ出力しない。

## エラー契約

```json
{
  "ok": false,
  "requestId": "register-sensor-kit-001",
  "error": {
    "code": "PART_NOT_FOUND",
    "message": "指定された部品が登録されていません。",
    "retryable": false,
    "details": [{"path":"lines[1].partId","value":"SENSOR001"}]
  }
}
```

| code | 意味と対応 |
| --- | --- |
| VALIDATION_ERROR | 型、必須項目、数量、件数制限を修正 |
| ALREADY_EXISTS | 部品IDまたは新規テンプレートIDが既存と競合 |
| RECIPE_LINE_EXISTS | 同じ部品のレシピ行が既にある。自動加算しない |
| PART_NOT_FOUND / TEMPLATE_NOT_FOUND | 参照先を検索し直す |
| AMBIGUOUS_TEMPLATE | 既存の名称不整合を解消 |
| IDEMPOTENCY_CONFLICT | 同じrequestIdに異なる内容を指定している |
| UNAUTHORIZED / SESSION_MISMATCH | 再接続し、対象workspaceとsessionを確認 |
| APP_NOT_CONNECTED | 対象のブラウザ画面を開いて接続 |
| RESULT_UNKNOWN | タイムアウトや切断。同じrequestIdで照会・再送 |
| STORAGE_ERROR | 容量不足など。ロールバック確定後に返す |

業務エラーはMCPのisErrorもtrueにする。RESULT_UNKNOWNのみretryableをtrueにし、同じIDでの再送を指示する。他は原因解消前の自動再試行をしない。保存前に切断したと証明できなければAPP_NOT_CONNECTEDではなくRESULT_UNKNOWNとする。

## 実装箇所と受入条件

実装は `src/api/catalog.mjs`（APIの共通登録）、`src/api/schema.mjs`（入力スキーマ）、`src/components/CodexConnection.jsx`（ブラウザ接続）、`mcp/`（stdioサーバーと中継）。既存UIの空行編集・数量加算は従来の画面操作として維持する。

部品・レシピ画面はDexieの変更購読で再読み込みする。未保存のセル入力は保持し、API追加のために編集中の値を上書きしない。新しい登録履歴はrequestId・操作・時刻・追加したIDを記録し、ペアリング秘密やGistトークンは含めない。

現行initDBはUpgradeError時にDBを削除するため、API用の移行導入前にこの処理を非破壊のエラー表示へ変更する。バージョン5から6への移行で既存部品・製品・レシピ・進捗が保持されることを確認する。Service Workerの旧コードが新DBへ接続しないよう、更新と旧タブの再読み込みを案内する。

実装完了の条件は以下とする。

1. 新規部品・新規レシピ・既存テンプレートへの行追加が、元のブラウザ画面に反映される。
2. 未登録部品、重複ID、不正数量、同一レシピ行の追加が拒否され、一括登録が部分保存されない。
3. 同時呼出しと応答消失後の再送でも、同じrequestIdの処理が一度だけ保存される。
4. 複数タブ・異なるオリジン・不正な接続資格から、誤ったDBへ書き込まれない。
5. dryRunでデータが増えず、レシピ登録で在庫や進捗が変更されない。
6. DB移行・CSV/Gist復元・アプリ更新後に、旧接続や旧要求結果を誤利用しない。
7. ローカル環境で実接続を確認する。HTTPS公開サイト対応を提供する場合は、そのオリジンの既存DBを使って別途接続・再送試験を行う。

REST APIの公開やクラウドDB移行は初期実装の前提にしない。将来ブラウザを閉じたまま操作する要件が加わったら、正本データをサーバーに移す設計を別途行う。
