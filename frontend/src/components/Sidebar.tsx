import { ThemeToggle } from "./ThemeToggle.tsx";

interface Props {
  isDark: boolean;
  onToggle: () => void;
  runningCount: number;
}

export function Sidebar({ isDark, onToggle, runningCount }: Props) {
  return (
    <aside
      style={{
        width: 224,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        background: "var(--sidebar-bg)",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Gradient accent bar */}
      <div
        style={{ height: 3, background: "var(--topbar-accent)", flexShrink: 0 }}
      />

      {/* Logo */}
      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.3px",
                color: "var(--text)",
              }}
            >
              codemeai
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                fontFamily: "'Geist Mono', monospace",
                marginTop: 1,
              }}
            >
              orchestrator
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--dim)",
            padding: "0 10px",
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Monitor
        </div>

        {/* Active nav item — Runs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "7px 10px",
            borderRadius: 6,
            background: "var(--accent-bg)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 1,
            cursor: "default",
          }}
        >
          <span style={{ fontSize: 14 }}>◫</span>
          Runs
          {runningCount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 600,
                fontFamily: "'Geist Mono', monospace",
                padding: "2px 7px",
                borderRadius: 4,
                background: "var(--amber-bg)",
                color: "var(--amber)",
                border: "1px solid var(--amber-border)",
              }}
            >
              {runningCount}
            </span>
          )}
        </div>

        {/* Placeholder nav items */}
        {[{ icon: "◎", label: "Health" }].map(({ icon, label }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 10px",
              borderRadius: 6,
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 1,
              cursor: "default",
              opacity: 0.5,
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
          </div>
        ))}

        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--dim)",
            padding: "0 10px",
            marginBottom: 4,
            marginTop: 12,
          }}
        >
          Config
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "7px 10px",
            borderRadius: 6,
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "default",
            opacity: 0.5,
          }}
        >
          <span style={{ fontSize: 14 }}>⊞</span>
          Settings
        </div>
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--muted)",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 5px var(--green)",
              animation: "blink 2s infinite",
              display: "inline-block",
            }}
          />
          <style>
            {"@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }"}
          </style>
          live
        </div>
        <ThemeToggle isDark={isDark} onToggle={onToggle} />
      </div>
    </aside>
  );
}
