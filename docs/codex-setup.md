# KittingFlowをCodexから操作する

部品とレシピの検索・追加、部品価格の編集を、使用中のブラウザのデータに対して行えます。登録時の重複チェック、再送による二重登録の防止、一括登録の取り消しに対応しています。価格編集は `kitting_update_part_prices` を使い、検索で取得した現在価格を照合して一括保存します。

## 起動と接続

1. Node.js 22以降で、このリポジトリの `npm install` を実行します。
2. `npm run dev` で画面を起動し、`http://localhost:5173` を開きます。既に利用しているブラウザプロファイル・URLで開いてください。localhostと127.0.0.1も異なる保存領域です。
3. CodexにMCPサーバーを登録します。登録済みならこの手順は不要です。

```powershell
codex mcp add kittingflow -- node "C:\Users\tatuy\Documents\work\KittingFlow\mcp\server.mjs"
```

4. CodexでMCP設定を再読み込みするか、新しいチャットを開き、「KittingFlowの接続情報を取得して」と依頼します。
5. 返された接続先と接続コードを、KittingFlow画面の「Codex接続」に貼り付けて「接続する」を押します。コードは5分間有効で、一度使うと失効します。
6. Codexに部品名・ID・初期在庫、テンプレートID、必要数を指定して追加を依頼します。

依頼の例: 「部品SENSOR001、名称は温度センサー、初期在庫100を追加して。テンプレートP002、名称センサーボードを作って、この部品を2個使うレシピを登録して」

サーバーはCodexが起動します。通常 `npm run mcp` を別途起動する必要はありません。既定の中継ポートは17321。他のチャットで使用中なら空きポートを使うため、必ず接続情報に表示されたURLを使用します。設定で固定する場合は `KITTINGFLOW_BRIDGE_PORT` を指定します。

## 保存先と接続解除

画面に表示されたオリジンとworkspaceIdが対象です。ブラウザを閉じたり「接続を解除」を押したりすると、追加操作はできなくなります。再接続にはCodexで新しい接続コードを取得します。CSVインポート・Gist復元時も保存領域の識別子を更新して切断します。

HTTPSの公開サイトにも、ローカルWSS中継で接続できます。データの正本は公開サイトのオリジンに属するブラウザDBのままです。クラウドへDBを移す処理や、別オリジンのDBを自動コピーする処理はありません。

公開サイトへ接続するには、まず今回のアプリ変更を公開先へデプロイします。次にWindowsのPowerShellで、実際のサイトURLを指定して以下を実行します。

```powershell
powershell.exe -NoProfile -File scripts/setup-public-bridge.ps1 -SiteOrigin https://YOUR-SITE.example -Trust
```

`-Trust` は127.0.0.1専用の自己署名サーバー証明書を現在のWindows利用者の信頼ストアに登録します。他の証明書を発行するCAではありません。有効期間は1年です。証明書と秘密鍵は `%LOCALAPPDATA%\KittingFlow` に保存し、現在の利用者とSYSTEMだけが読めるようにします。`-Trust` を省略するとファイルと設定の準備だけを行い、Windowsの信頼設定は変更しません。

その後MCPを再起動して接続情報を取得し、公開サイトの「Codex接続」に `wss://127.0.0.1:...` の接続先とコードを入力します。公開サイトを開いたブラウザとMCPは同じPCで動かしてください。必要に応じてブラウザを再起動し、ローカルネットワークへの接続許可が表示されたら対象を確認して許可します。証明書確認には接続情報のhealthUrlを利用できます。証明書エラーを無視する設定は通常利用で行わないでください。

Windowsの証明書一覧から削除する場合は、セットアップが表示した拇印と一致する「KittingFlow local bridge」の証明書だけを対象にします。MCPを停止し、専用フォルダーのbridge.jsonと証明書ファイルを取り除くと、ローカルHTTP接続へ戻せます。

HTTPS動作は独立したテストDBで検証済みです。実公開サイトのCSP・ブラウザの権限・Windowsの証明書信頼は実環境での確認が必要です。TLSテストはそのテスト証明書だけをブラウザ起動時に許可しており、Windowsの信頼ストアは変更しません。

既定の許可オリジンは `http://localhost:5173` と `http://127.0.0.1:5173` です。開発ポートを変更する場合は `KITTINGFLOW_ALLOWED_ORIGINS` に正確なオリジンをカンマ区切りで設定します。ワイルドカードは使いません。接続コードやトークンは設定ファイルやGitへ書き込みません。

## 操作の仕様

最初に `kitting_get_connection` からworkspaceIdとsessionIdを取得し、以降のツールに渡します。書き込みごとに固有のrequestIdを指定します。タイムアウト時は同じrequestIdを使って `kitting_get_request` で照会または再送してください。新しいIDでやり直すと別操作になります。

`kitting_create_parts` は部品追加、`kitting_add_recipe` はレシピ行追加、`kitting_create_bundle` は部品とレシピの一括追加です。いずれも `dryRun: true` で保存前の検証ができます。既存レシピの同じ部品は数量加算せず、エラーで返します。必要数は小数も利用できます。レシピ追加による在庫減算や製品個体・進捗の作成はありません。

入力スキーマは `src/api/schema.mjs`、保存ロジックは `src/api/catalog.mjs` にあります。IndexedDBはバージョン6へ移行し、既存データを維持したまま要求履歴と保存領域識別子を追加します。古いタブが開いている場合は閉じて再読み込みしてください。

## 検証

```powershell
npm test
npm run test:e2e
npm run build
```

ブラウザ試験はMicrosoft Edgeの独立したテスト用プロファイルを使用します。実際の利用者のデータは使いません。Edgeがない環境では `playwright.config.mjs` のchannelを変更するか、PlaywrightのChromiumをインストールしてchannel設定を外してください。
