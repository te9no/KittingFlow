function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🧩 KittingFlow")
    .addItem("✨ FancyIDを生成", "uiGenerateID")
    .addItem("🏷️ QRラベル印刷", "uiPrintLabel")
    .addSeparator()
    .addItem("📦 ピッキング開始", "uiStartPicking")
    .addItem("✅ 作業完了", "completePicking")
    .addSeparator()
    .addItem("🧾 在庫チェック", "uiCheckStock")
    .addToUi();
}
