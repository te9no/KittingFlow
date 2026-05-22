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
import { applyGlobalTheme, card, layout, palette, spacing, typography } from "./styles/theme";

const text = {
  appName: "KittingFlow",
  tagline: "\u90e8\u54c1\u30fb\u30ec\u30b7\u30d4\u30fb\u30d4\u30c3\u30ad\u30f3\u30b0\u9032\u6357\u3092\u3072\u3068\u3064\u306b\u307e\u3068\u3081\u308b\u8efd\u91cf\u30c4\u30fc\u30eb",
  home: "\u30db\u30fc\u30e0",
  picking: "\u30d4\u30c3\u30ad\u30f3\u30b0",
  parts: "\u90e8\u54c1",
  recipes: "\u30ec\u30b7\u30d4",
  progress: "\u9032\u6357\u7ba1\u7406",
  csv: "CSV",
  requirements: "\u5fc5\u8981\u6570\u96c6\u8a08",
  startPicking: "\u30d4\u30c3\u30ad\u30f3\u30b0\u3092\u59cb\u3081\u308b",
  editRecipes: "\u30ec\u30b7\u30d4\u3092\u7de8\u96c6\u3059\u308b",
  homeTitle: "\u30ad\u30c3\u30c6\u30a3\u30f3\u30b0\u4f5c\u696d\u3092\u3001\u8ff7\u308f\u305a\u9032\u3081\u308b",
  homeLead: "\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u306b\u90e8\u54c1\u3092\u767b\u9332\u3057\u3001\u5728\u5eab\u3068\u9032\u6357\u3092\u78ba\u8a8d\u3057\u306a\u304c\u3089\u30d4\u30c3\u30ad\u30f3\u30b0\u3067\u304d\u307e\u3059\u3002\u30c7\u30fc\u30bf\u306f\u30d6\u30e9\u30a6\u30b6\u306e IndexedDB \u306b\u4fdd\u5b58\u3055\u308c\u307e\u3059\u3002",
  quickStart: "\u7c21\u5358\u306a\u4f7f\u3044\u65b9",
  flowTitle: "\u57fa\u672c\u306e\u6d41\u308c",
  tipsTitle: "\u64cd\u4f5c\u306e\u30b3\u30c4",
  dataTitle: "\u30c7\u30fc\u30bf\u306e\u7ba1\u7406"
};

function Logo() {
  const logoStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing(2.5),
    color: "#fff",
    textDecoration: "none",
    minWidth: 0
  };
  const markStyle = {
    width: 52,
    height: 52,
    flex: "0 0 auto",
    filter: "drop-shadow(0 16px 24px rgba(34, 211, 238, 0.22))"
  };
  const wordStyle = {
    fontSize: "1.18rem",
    fontWeight: 950,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    textTransform: "uppercase"
  };
  const accentStyle = {
    display: "inline-block",
    marginLeft: 6,
    color: "#67e8f9",
    letterSpacing: "-0.08em"
  };
  return (
    <div style={logoStyle} aria-label={text.appName}>
      <svg style={markStyle} viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="logo-core" x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#67e8f9" />
            <stop offset="0.48" stopColor="#2563eb" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="logo-stroke" x1="14" y1="16" x2="52" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e0f2fe" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z" fill="url(#logo-core)" />
        <path d="M32 8.5 52.2 20.2v23.6L32 55.5 11.8 43.8V20.2L32 8.5Z" fill="rgba(15,23,42,0.42)" stroke="rgba(224,242,254,0.26)" strokeWidth="1.2" />
        <path d="M21 21h10.5c6.4 0 10.5 3.5 10.5 8.8 0 5.5-4.1 8.9-10.5 8.9H27v8.1h-6V21Z" fill="none" stroke="url(#logo-stroke)" strokeWidth="4.6" strokeLinejoin="round" />
        <path d="M28.5 31.7h15.2M43.7 31.7l-5.8-5.4M43.7 31.7l-5.8 5.4" fill="none" stroke="#a5f3fc" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20.8" cy="21" r="3.1" fill="#ecfeff" />
        <circle cx="46.3" cy="31.7" r="3.1" fill="#22d3ee" />
        <circle cx="27" cy="46.9" r="2.6" fill="#93c5fd" />
      </svg>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={wordStyle}>Kitting<span style={accentStyle}>Flow</span></span>
        <span style={{ color: "#cbd5e1", fontSize: typography.size.xs, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text.tagline}</span>
      </span>
    </div>
  );
}

function HomePage({ onNavigate }) {
  const heroStyle = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    padding: "42px",
    color: "#f8fafc",
    background: "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.44), transparent 28%), linear-gradient(135deg, #0f172a 0%, #164e63 54%, #1e293b 100%)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)"
  };
  const primaryAction = {
    ...buttonStyles.primary(),
    padding: "12px 18px",
    fontSize: typography.size.md
  };
  const secondaryAction = {
    ...buttonStyles.secondary,
    padding: "12px 18px",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.28)"
  };
  const cards = [
    {
      title: "1. \u90e8\u54c1\u3092\u767b\u9332",
      body: "\u90e8\u54c1ID\u3001\u540d\u524d\u3001\u5728\u5eab\u6570\u3001\u4ed5\u5165\u308c\u5024\u3084\u4ed5\u5165\u308c\u5148\u3092\u7ba1\u7406\u3057\u307e\u3059\u3002CSV\u304b\u3089\u306e\u53d6\u308a\u8fbc\u307f\u3082\u53ef\u80fd\u3067\u3059\u3002"
    },
    {
      title: "2. \u30ec\u30b7\u30d4\u3092\u4f5c\u6210",
      body: "\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u306b\u5fc5\u8981\u306a\u90e8\u54c1\u3092\u8ffd\u52a0\u3057\u3001\u5fc5\u8981\u6570\u3092 +/- \u3067\u8abf\u6574\u3057\u307e\u3059\u3002"
    },
    {
      title: "3. \u30d4\u30c3\u30ad\u30f3\u30b0",
      body: "\u88fd\u54c1\u3092\u9078\u3073\u3001\u8868\u793a\u3055\u308c\u305f\u90e8\u54c1\u3092\u9806\u756a\u306b\u30d4\u30c3\u30ad\u30f3\u30b0\u3057\u307e\u3059\u3002\u5b8c\u4e86\u6642\u306b\u5728\u5eab\u304c\u6e1b\u7b97\u3055\u308c\u307e\u3059\u3002"
    }
  ];
  const tips = [
    "\u30ec\u30b7\u30d4\u7de8\u96c6\u3067\u306f\u3001\u90e8\u54c1\u3092\u30af\u30ea\u30c3\u30af\u9078\u629e\u3057\u3066\u304b\u3089\u88fd\u54c1\u30b0\u30eb\u30fc\u30d7\u306b\u8ffd\u52a0\u3067\u304d\u307e\u3059\u3002",
    "\u30c9\u30e9\u30c3\u30b0\u304c\u4e0d\u5b89\u5b9a\u306a\u74b0\u5883\u3067\u306f\u3001\u300c\u9078\u629e\u90e8\u54c1\u3092\u8ffd\u52a0\u300d\u30dc\u30bf\u30f3\u3092\u4f7f\u3063\u3066\u304f\u3060\u3055\u3044\u3002",
    "\u30c7\u30fc\u30bf\u79fb\u884c\u3084\u30d0\u30c3\u30af\u30a2\u30c3\u30d7\u306f CSV \u753b\u9762\u304b\u3089\u884c\u3048\u307e\u3059\u3002"
  ];

  return (
    <div style={{ display: "grid", gap: spacing(6) }}>
      <section style={heroStyle}>
        <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
          <div style={{ color: "#7dd3fc", fontWeight: 900, marginBottom: spacing(3), letterSpacing: "0.08em" }}>{text.appName}</div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 4.4rem)", lineHeight: 1.02, letterSpacing: "-0.05em" }}>{text.homeTitle}</h1>
          <p style={{ margin: `${spacing(4)} 0`, color: "#dbeafe", fontSize: typography.size.lg, maxWidth: 680 }}>{text.homeLead}</p>
          <div style={{ display: "flex", gap: spacing(3), flexWrap: "wrap" }}>
            <button type="button" onClick={() => onNavigate("picking")} style={primaryAction}>{text.startPicking}</button>
            <button type="button" onClick={() => onNavigate("recipes")} style={secondaryAction}>{text.editRecipes}</button>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing(4) }}>
        {cards.map((item) => (
          <div key={item.title} style={card({ minHeight: 150 })}>
            <h3 style={{ marginTop: 0 }}>{item.title}</h3>
            <p style={{ color: palette.textMuted }}>{item.body}</p>
          </div>
        ))}
      </section>

      <section style={card({ display: "grid", gap: spacing(3) })}>
        <h3 style={{ margin: 0 }}>{text.tipsTitle}</h3>
        {tips.map((tip) => <div key={tip} style={{ color: palette.textMuted }}>- {tip}</div>)}
      </section>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("home");

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
        <button key={key} onClick={() => setTab(key)} style={buttonStyles.tab(active)} {...hoverHandlers}>
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
    padding: `${spacing(3)} ${spacing(5)}`,
    zIndex: 100,
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.22)"
  }), []);

  const headerInnerStyle = useMemo(() => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(4),
    maxWidth: "min(1500px, calc(100vw - 24px))",
    margin: "0 auto"
  }), []);

  const navStyle = useMemo(() => ({ display: "flex", gap: spacing(2), flexWrap: "wrap", justifyContent: "flex-end" }), []);
  const mainStyle = useMemo(() => ({ padding: `${spacing(6)} ${spacing(5)}`, background: palette.background }), []);
  const contentStyle = useMemo(() => ({ maxWidth: tab === "recipes" ? "min(1600px, calc(100vw - 24px))" : layout.maxWidth, margin: "0 auto" }), [tab]);
  const footerStyle = useMemo(() => ({ textAlign: "center", padding: spacing(6), color: palette.textMuted, fontSize: typography.size.sm }), []);

  return (
    <div>
      <header style={headerStyle} data-app-header="true">
        <div style={headerInnerStyle}>
          <Logo />
          <nav style={navStyle}>
            {renderTabButton("home", text.home)}
            {renderTabButton("picking", text.picking)}
            {renderTabButton("parts", text.parts)}
            {renderTabButton("recipes", text.recipes)}
            {renderTabButton("progress", text.progress)}
            {renderTabButton("io", text.csv)}
            {renderTabButton("requirementSelect", text.requirements)}
          </nav>
        </div>
      </header>

      <main style={mainStyle}>
        <div style={contentStyle}>
          {tab === "home" && <HomePage onNavigate={setTab} />}
          {tab === "picking" && <PickingUI />}
          {tab === "parts" && <PartsTable />}
          {tab === "recipes" && <RecipeTable />}
          {tab === "progress" && <ProgressTable />}
          {tab === "io" && <ImportExportPanel />}
          {tab === "requirementSelect" && <RequirementSummarySelect />}
        </div>
      </main>

      <footer style={footerStyle}>{"\u00a9 KittingFlow"}</footer>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
