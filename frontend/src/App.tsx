import { useState } from "react";
import { FiltersBar } from "./components/FiltersBar.tsx";
import { RunsTable } from "./components/RunsTable.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { StatsCards } from "./components/StatsCards.tsx";
import { useRuns } from "./hooks/useRuns.ts";
import type { Filters } from "./types.ts";

const DEFAULT_FILTERS: Filters = {
  date: "all",
  target_branch: "all",
  status: "all",
};

export default function App() {
  const [isDark, setIsDark] = useState(
    () => (localStorage.getItem("theme") ?? "light") === "dark",
  );

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const { data, loading, refetch } = useRuns(filters);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIsDark(!isDark);
  }

  const stats = data?.stats ?? {
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  const runs = data?.runs ?? [];
  const targetBranches = data?.targetBranches ?? [];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        isDark={isDark}
        onToggle={toggleTheme}
        runningCount={stats.running}
      />

      <main
        style={{
          flex: 1,
          overflow: "auto",
          background: "var(--bg)",
          transition: "background 0.2s",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 32px 0",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.5px",
                color: "var(--text)",
                margin: 0,
              }}
            >
              Agent Runs
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 2,
                marginBottom: 0,
              }}
            >
              Shortcut stories processed by codemeai
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 7,
              border: "1px solid var(--border-2)",
              background: "var(--surface)",
              color: "var(--muted)",
              fontSize: 12,
              fontFamily: "'Geist', sans-serif",
              cursor: "pointer",
              boxShadow: "var(--shadow)",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        <StatsCards stats={stats} />
        <FiltersBar
          filters={filters}
          targetBranches={targetBranches}
          onChange={setFilters}
        />
        <RunsTable runs={runs} total={data?.total ?? 0} loading={loading} />
      </main>
    </div>
  );
}
