interface Props {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Toggle dark mode"
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        background: isDark ? "var(--accent)" : "var(--border-2)",
        border: `1px solid ${isDark ? "var(--accent)" : "var(--border-2)"}`,
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
          transform: isDark ? "translateX(14px)" : "translateX(0)",
          display: "block",
        }}
      />
    </button>
  );
}
