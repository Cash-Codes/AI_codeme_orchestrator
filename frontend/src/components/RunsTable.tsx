import type { Run } from "../types.ts";
import { RunRow } from "./RunRow.tsx";

interface Props {
  runs: Run[];
  total: number;
  loading: boolean;
}

const GRID = "68px 1fr 190px 120px 120px 32px";

export function RunsTable({ runs, total, loading }: Props) {
  return (
    <div
      style={{
        margin: "0 32px 32px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-subtle)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          Recent Runs
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--muted)",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {loading ? "loading…" : `${total} result${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          alignItems: "center",
          padding: "9px 20px",
          background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--muted)",
          letterSpacing: "0.03em",
        }}
      >
        <span>Run</span>
        <span>Story</span>
        <span>Pull Request</span>
        <span>Started</span>
        <span>Status</span>
        <span />
      </div>

      {/* Rows */}
      {runs.length === 0 && !loading ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13,
            background: "var(--surface)",
          }}
        >
          No runs match the current filters.
        </div>
      ) : (
        runs.map((run) => <RunRow key={run.id} run={run} />)
      )}
    </div>
  );
}
