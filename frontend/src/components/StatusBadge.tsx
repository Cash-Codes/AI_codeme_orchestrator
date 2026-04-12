import type { RunStatus } from "../types.ts";

interface Props {
  status: RunStatus;
}

const config: Record<
  RunStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  running: {
    label: "Running",
    bg: "var(--amber-bg)",
    color: "var(--amber)",
    border: "var(--amber-border)",
  },
  completed: {
    label: "Completed",
    bg: "var(--green-bg)",
    color: "var(--green)",
    border: "var(--green-border)",
  },
  failed: {
    label: "Failed",
    bg: "var(--red-bg)",
    color: "var(--red)",
    border: "var(--red-border)",
  },
  pending: {
    label: "Pending",
    bg: "var(--surface-2)",
    color: "var(--muted)",
    border: "var(--border)",
  },
};

export function StatusBadge({ status }: Props) {
  const c = config[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: 5,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.color,
          flexShrink: 0,
          animation: status === "running" ? "blink 1.2s infinite" : undefined,
        }}
      />
      {c.label}
      <style>
        {"@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }"}
      </style>
    </span>
  );
}
