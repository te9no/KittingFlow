import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { initSampleDataIfEmpty } from "./db";
import PartsTable from "./components/PartsTable";
import PickingUI from "./components/PickingUI";
import ImportExportPanel from "./components/ImportExportPanel";
import RecipeTable from "./components/RecipeTable";
import ProgressTable from "./components/ProgressTable";
import RequirementSummarySelect from "./components/RequirementSummarySelect";
import { buttonStyles, hoverStyles, createHoverHandlers } from "./styles/buttons";
import { applyGlobalTheme, layout, palette, spacing, typography } from "./styles/theme";

function App() {
  const [tab, setTab] = useState("picking");

  useEffect(() => {
    initSampleDataIfEmpty();
  }, []);

  useEffect(() => {
    applyGlobalTheme();
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

  const headerStyle = useMemo(() => ({
    position: "sticky",
    top: 0,
    background: palette.header,
    color: "#fff",
    padding: `${spacing(4)} ${spacing(5)}`,
    zIndex: 100,
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.22)"
  }), []);

  const headerInnerStyle = useMemo(() => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: layout.maxWidth,
    margin: "0 auto"
  }), []);

  const navStyle = useMemo(() => ({
    display: "flex",
    gap: spacing(2),
    flexWrap: "wrap"
  }), []);

  const mainStyle = useMemo(() => ({
    padding: `${spacing(6)} ${spacing(5)}`,
    background: palette.background
  }), []);

  const contentStyle = useMemo(() => ({
    maxWidth: layout.maxWidth,
    margin: "0 auto"
  }), []);

  const footerStyle = useMemo(() => ({
    textAlign: "center",
    padding: spacing(6),
    color: palette.textMuted,
    fontSize: typography.size.sm
  }), []);

  return (
    <div>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <div style={{ fontWeight: typography.headingWeight, letterSpacing: "0.02em" }}>KittingFlow</div>
          <nav style={navStyle}>
            {renderTabButton("picking", "📦 ピッキング")}
            {renderTabButton("parts", "🧩 部品")}
            {renderTabButton("recipes", "📜 レシピ")}
            {renderTabButton("progress", "⚙️ 進捗管理")}
            {renderTabButton("io", "💾 CSV")}
            {renderTabButton("requirementSelect", "🧮 必要数集計")}
          </nav>
        </div>
      </header>

      <main style={mainStyle}>
        <div style={contentStyle}>
          {tab === "picking" && <PickingUI />}
          {tab === "parts" && <PartsTable />}
          {tab === "recipes" && <RecipeTable />}
          {tab === "progress" && <ProgressTable />}
          {tab === "io" && <ImportExportPanel />}
          {tab === "requirementSelect" && <RequirementSummarySelect />}
        </div>
      </main>

      <footer style={footerStyle}>© KittingFlow</footer>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
