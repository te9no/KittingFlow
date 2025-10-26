import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initSampleDataIfEmpty } from "./db";
import PartsTable from "./components/PartsTable";
import PickingUI from "./components/PickingUI";
import ImportExportPanel from "./components/ImportExportPanel";
import RecipeTable from "./components/RecipeTable";
import ProgressTable from "./components/ProgressTable";
import RequirementSummarySelect from "./components/RequirementSummarySelect";
import { buttonStyles, hoverStyles, createHoverHandlers } from "./styles/buttons";

function App() {
  const [tab, setTab] = useState("picking");

  useEffect(() => {
    initSampleDataIfEmpty();
  }, []);

  const renderTabButton = useCallback(
    (key, label) => {
      const active = tab === key;
      const hoverHandlers = createHoverHandlers(
        () => buttonStyles.tab(active),
        hoverStyles.tab,
        () => !active
      );
      return (
        <button
          key={key}
          onClick={() => setTab(key)}
          style={buttonStyles.tab(active)}
          {...hoverHandlers}
        >
          {label}
        </button>
      );
    },
    [tab]
  );

  return (
    <div>
      <header style={{ position: "sticky", top: 0, background: "#0f172a", color: "#fff", padding: "12px 16px", zIndex: 100, boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontWeight: 700 }}>KittingFlow Local Edition v1.5</div>
          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {renderTabButton("picking", "ピッキング")}
            {renderTabButton("parts", "部品")}
            {renderTabButton("recipes", "レシピ")}
            {renderTabButton("progress", "製造管理")}
            {renderTabButton("io", "CSV入出力")}
            {renderTabButton("requirementSelect", "🧮 部品集計（製品選択）")}
          </nav>
        </div>
      </header>

      <main style={{ paddingTop: 16 }}>
        {tab === "picking" && <PickingUI />}
        {tab === "parts" && <PartsTable />}
        {tab === "recipes" && <RecipeTable />}
        {tab === "progress" && <ProgressTable />}
        {tab === "io" && <ImportExportPanel />}
        {tab === "requirementSelect" && <RequirementSummarySelect />}
      </main>

      <footer style={{ textAlign: "center", padding: "16px", color: "#666" }}>© KittingFlow Local</footer>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
