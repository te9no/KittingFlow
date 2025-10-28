const palette = {
  background: "#f4f6fb",
  backgroundSoft: "#e9edf5",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  header: "#0f172a",
  text: "#1f2937",
  textMuted: "#64748b",
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  primarySoft: "#dbeafe",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  border: "#e2e8f0"
};

const typography = {
  fontFamily: "'Inter', 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Helvetica Neue', Arial, sans-serif",
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.25rem"
  },
  lineHeight: 1.6,
  headingWeight: 600,
  bodyWeight: 400
};

const radii = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 9999
};

const shadows = {
  sm: "0 2px 8px rgba(15, 23, 42, 0.08)",
  md: "0 10px 30px rgba(15, 23, 42, 0.12)"
};

const spacing = (factor) => `${factor * 4}px`;

const layout = {
  maxWidth: 1100
};

function applyGlobalTheme() {
  const { body } = document;
  if (!body) return;
  body.style.margin = "0";
  body.style.fontFamily = typography.fontFamily;
  body.style.fontSize = typography.size.md;
  body.style.lineHeight = String(typography.lineHeight);
  body.style.background = palette.background;
  body.style.color = palette.text;
  body.style.minHeight = "100vh";
  body.style.transition = "background 0.3s ease";
}

const card = (overrides = {}) => ({
  background: palette.surface,
  borderRadius: `${radii.md}px`,
  border: `1px solid ${palette.border}`,
  boxShadow: shadows.sm,
  padding: spacing(5),
  ...overrides
});

export {
  palette,
  typography,
  radii,
  shadows,
  spacing,
  layout,
  card,
  applyGlobalTheme
};
