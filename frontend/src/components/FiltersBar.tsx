import type { Filters, RunStatus } from "../types.ts";

interface Props {
  filters: Filters;
  targetBranches: string[];
  onChange: (f: Filters) => void;
}

const selectStyle: React.CSSProperties = {
  height: 32,
  padding: "0 28px 0 10px",
  borderRadius: 7,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "'Geist', sans-serif",
  boxShadow: "var(--shadow)",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

export function FiltersBar({ filters, targetBranches, onChange }: Props) {
  const activeCount = [
    filters.date !== "all",
    filters.target_branch !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  function update(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div
      style={{
        margin: "0 32px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* Date filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            whiteSpace: "nowrap",
          }}
        >
          Date
        </span>
        <select
          style={{ ...selectStyle, width: 130 }}
          value={filters.date}
          onChange={(e) => update({ date: e.target.value as Filters["date"] })}
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: "var(--border)",
          margin: "0 4px",
        }}
      />

      {/* Target branch filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            whiteSpace: "nowrap",
          }}
        >
          Target branch
        </span>
        <select
          style={{ ...selectStyle, width: 150 }}
          value={filters.target_branch}
          onChange={(e) => update({ target_branch: e.target.value })}
        >
          <option value="all">All branches</option>
          {targetBranches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: "var(--border)",
          margin: "0 4px",
        }}
      />

      {/* Status filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            whiteSpace: "nowrap",
          }}
        >
          Status
        </span>
        <select
          style={{ ...selectStyle, width: 130 }}
          value={filters.status}
          onChange={(e) =>
            update({ status: e.target.value as "all" | RunStatus })
          }
        >
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Active count + clear */}
      {activeCount > 0 && (
        <>
          <div
            style={{
              height: 20,
              padding: "0 7px",
              borderRadius: 10,
              background: "var(--accent-bg)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "'Geist Mono', monospace",
              display: "flex",
              alignItems: "center",
            }}
          >
            {activeCount} {activeCount === 1 ? "filter" : "filters"}
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({ date: "all", target_branch: "all", status: "all" })
            }
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 12,
              fontFamily: "'Geist', sans-serif",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
