export const buttonStyles = {
  primary: (enabled = true) => ({
    minWidth: 140,
    padding: "10px 20px",
    borderRadius: 9999,
    border: "none",
    background: enabled
      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
      : "linear-gradient(135deg, #dbeafe, #bfdbfe)",
    color: enabled ? "#fff" : "#4b5563",
    fontSize: "1rem",
    fontWeight: 600,
    boxShadow: enabled ? "0 8px 16px rgba(37, 99, 235, 0.25)" : "none",
    transition: "all 0.2s ease",
    cursor: enabled ? "pointer" : "not-allowed",
    transform: "translateY(0)"
  }),
  secondary: {
    minWidth: 120,
    padding: "8px 18px",
    borderRadius: 9999,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontSize: "0.95rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s ease, color 0.2s ease, border 0.2s ease"
  },
  subtle: {
    padding: "8px 16px",
    borderRadius: 9999,
    border: "none",
    background: "#f3f4f6",
    color: "#111827",
    fontSize: "0.95rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s ease, color 0.2s ease"
  },
  danger: (enabled = true) => ({
    minWidth: 120,
    padding: "8px 18px",
    borderRadius: 9999,
    border: "none",
    background: enabled
      ? "linear-gradient(135deg, #ef4444, #b91c1c)"
      : "linear-gradient(135deg, #fecaca, #fca5a5)",
    color: enabled ? "#fff" : "#7f1d1d",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: enabled ? "0 8px 16px rgba(239, 68, 68, 0.25)" : "none",
    transition: "all 0.2s ease",
    transform: "translateY(0)"
  }),
  tab: (active = false) => ({
    padding: "8px 14px",
    borderRadius: 9999,
    border: "none",
    background: active ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s ease, transform 0.2s ease",
    transform: active ? "translateY(-1px)" : "translateY(0)"
  })
};

export const hoverStyles = {
  primary: {
    boxShadow: "0 12px 20px rgba(37, 99, 235, 0.35)",
    transform: "translateY(-1px)"
  },
  secondary: {
    background: "#f3f4f6",
    border: "1px solid #cbd5f5"
  },
  subtle: {
    background: "#e5e7eb"
  },
  danger: {
    boxShadow: "0 12px 20px rgba(239, 68, 68, 0.35)",
    transform: "translateY(-1px)"
  },
  tab: {
    background: "rgba(255,255,255,0.22)",
    transform: "translateY(-1px)"
  }
};

export function createHoverHandlers(styleFactory, hoverStyle, enabled = true) {
  const resolveStyle =
    typeof styleFactory === "function"
      ? styleFactory
      : () => styleFactory;
  const resolveEnabled =
    typeof enabled === "function"
      ? enabled
      : () => enabled;
  return {
    onMouseEnter: (event) => {
      if (!resolveEnabled()) return;
      Object.assign(event.currentTarget.style, hoverStyle);
    },
    onMouseLeave: (event) => {
      Object.assign(event.currentTarget.style, resolveStyle(resolveEnabled()));
    }
  };
}
