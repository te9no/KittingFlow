import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { db, initSampleDataIfEmpty, PROGRESS_STATE_DONE } from "./db";
import PartsTable from "./components/PartsTable";
import PickingUI from "./components/PickingUI";
import ImportExportPanel from "./components/ImportExportPanel";
import RecipeTable from "./components/RecipeTable";
import ProgressTable from "./components/ProgressTable";
import RequirementSummarySelect from "./components/RequirementSummarySelect";
import { buttonStyles, hoverStyles, createHoverHandlers } from "./styles/buttons";
import { applyGlobalTheme, card, layout, palette, spacing, typography } from "./styles/theme";
import "./styles/responsive.css";

const text = {
  appName: "KittingFlow",
  tagline: "\u90e8\u54c1\u30fb\u30ec\u30b7\u30d4\u30fb\u30d4\u30c3\u30ad\u30f3\u30b0\u9032\u6357\u3092\u3072\u3068\u3064\u306b\u307e\u3068\u3081\u308b\u8efd\u91cf\u30c4\u30fc\u30eb",
  home: "\u30db\u30fc\u30e0",
  picking: "\u30d4\u30c3\u30ad\u30f3\u30b0",
  parts: "\u90e8\u54c1",
  recipes: "\u30ec\u30b7\u30d4",
  progress: "\u9032\u6357\u7ba1\u7406",
  csv: "\u30c7\u30fc\u30bf",
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
    <div className="app-logo" style={logoStyle} aria-label={text.appName}>
      <svg className="app-logo__mark" style={markStyle} viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
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
        <span className="app-logo__tagline" style={{ color: "#cbd5e1", fontSize: typography.size.xs, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text.tagline}</span>
      </span>
    </div>
  );
}

const navIconPaths = {
  home: ["M3 11.5 12 4l9 7.5", "M5 10.5V20h5v-6h4v6h5v-9.5"],
  picking: ["M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z", "m8 3v9m-8-4.5 8 4.5 8-4.5", "m9 16 2 2 4-4"],
  parts: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  recipes: ["M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Z", "M9 2h6v4H9zM8 11h8M8 15h8"],
  progress: ["M4 19V9M10 19V5M16 19v-7M22 19H2"],
  io: ["M5 7c0 2 3.1 3.5 7 3.5S19 9 19 7s-3.1-3.5-7-3.5S5 5 5 7Z", "M5 7v5c0 2 3.1 3.5 7 3.5M19 7v5c0 2-3.1 3.5-7 3.5", "M8 20h8m-2-2 2 2-2 2"],
  requirementSelect: ["M5 3h14v18H5z", "M8 7h8M8 11h2m3 0h3M8 15h2m3 0h3"]
};

function NavIcon({ name }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {(navIconPaths[name] || []).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function HomePage({ onNavigate }) {
  const [metrics, setMetrics] = useState({ parts: 0, stock: 0, active: 0, recipes: 0, lowStock: 0 });

  useEffect(() => {
    let mounted = true;
    const loadMetrics = async () => {
      await initSampleDataIfEmpty();
      const [parts, products, recipes, progress] = await Promise.all([
        db.parts.toArray(),
        db.products.toArray(),
        db.recipes.toArray(),
        db.progress.toArray()
      ]);
      if (!mounted) return;
      const progressMap = new Map(progress.map((item) => [item.productId, item]));
      const activeProducts = products.filter((product) => product.status !== "template" && progressMap.get(product.id)?.state !== PROGRESS_STATE_DONE);
      setMetrics({
        parts: parts.length,
        stock: parts.reduce((sum, part) => sum + Number(part.stock || 0), 0),
        active: activeProducts.length,
        recipes: new Set(recipes.map((recipe) => recipe.productId)).size,
        lowStock: parts.filter((part) => Number(part.stock || 0) <= 10).length
      });
    };
    loadMetrics().catch((error) => console.error("Dashboard metrics failed", error));
    return () => { mounted = false; };
  }, []);

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
  const dashboardItems = [
    { key: "parts", label: "部品マスター", value: `${metrics.parts} 種`, detail: `総在庫 ${metrics.stock.toLocaleString()} 個`, target: "parts", tone: "blue" },
    { key: "active", label: "稼働中の製品", value: `${metrics.active} 件`, detail: "ピッキング対象", target: "picking", tone: "cyan" },
    { key: "recipes", label: "登録レシピ", value: `${metrics.recipes} 件`, detail: "製品グループ", target: "recipes", tone: "violet" },
    { key: "lowStock", label: "在庫アラート", value: `${metrics.lowStock} 件`, detail: metrics.lowStock ? "在庫10個以下" : "問題ありません", target: "requirementSelect", tone: metrics.lowStock ? "amber" : "green" }
  ];

  return (
    <div className="home-page" style={{ display: "grid", gap: spacing(6) }}>
      <section className="home-dashboard" aria-label="オペレーション概要">
        <div className="home-dashboard__heading">
          <div><span>OPERATION OVERVIEW</span><h2>今日のオペレーション</h2></div>
          <span className="home-dashboard__status"><i />ローカルDB 接続中</span>
        </div>
        <div className="home-dashboard__grid">
          {dashboardItems.map((item) => (
            <button className={`dashboard-metric dashboard-metric--${item.tone}`} key={item.key} type="button" onClick={() => onNavigate(item.target)}>
              <span className="dashboard-metric__icon"><NavIcon name={item.target} /></span>
              <span className="dashboard-metric__copy"><small>{item.label}</small><strong>{item.value}</strong><em>{item.detail}</em></span>
              <span className="dashboard-metric__arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-hero" style={heroStyle}>
        <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
          <div style={{ color: "#7dd3fc", fontWeight: 900, marginBottom: spacing(3), letterSpacing: "0.08em" }}>{text.appName}</div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 4.4rem)", lineHeight: 1.02, letterSpacing: "-0.05em" }}>{text.homeTitle}</h1>
          <p style={{ margin: `${spacing(4)} 0`, color: "#dbeafe", fontSize: typography.size.lg, maxWidth: 680 }}>{text.homeLead}</p>
          <div className="home-actions" style={{ display: "flex", gap: spacing(3), flexWrap: "wrap" }}>
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
    applyGlobalTheme();
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab]);

  const renderTabButton = useCallback(
    (key, label, mobileLabel) => {
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
          aria-current={active ? "page" : undefined}
          {...hoverHandlers}
        >
          <NavIcon name={key} />
          <span className="nav-label nav-label--desktop">{label}</span>
          <span className="nav-label nav-label--mobile">{mobileLabel}</span>
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
        <div className="app-header__inner" style={headerInnerStyle}>
          <Logo />
          <nav className="app-nav" style={navStyle} aria-label="メインナビゲーション">
            {renderTabButton("home", text.home, "ホーム")}
            {renderTabButton("picking", text.picking, "作業")}
            {renderTabButton("parts", text.parts, "部品")}
            {renderTabButton("recipes", text.recipes, "レシピ")}
            {renderTabButton("progress", text.progress, "進捗")}
            {renderTabButton("io", text.csv, "データ")}
            {renderTabButton("requirementSelect", text.requirements, "集計")}
          </nav>
          <div className="desktop-sidebar-footer">
            <span>LOCAL WORKSPACE</span>
            <strong><i /> Browser Database</strong>
            <small>データはこの端末に保存されます</small>
          </div>
        </div>
      </header>

      <main className="app-main" style={mainStyle}>
        <div className="app-content" style={contentStyle}>
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
