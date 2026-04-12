import type { RunStats } from "../types.ts";

interface Props {
  stats: RunStats;
}

interface CardConfig {
  label: string;
  value: number;
  color: string;
  iconBg: string;
  icon: string;
  sub: string;
}

export function StatsCards({ stats }: Props) {
  const successRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const cards: CardConfig[] = [
    {
      label: "Total Runs",
      value: stats.total,
      color: "var(--text)",
      iconBg: "var(--accent-bg)",
      icon: "◈",
      sub: "all time",
    },
    {
      label: "Running",
      value: stats.running,
      color: "var(--amber)",
      iconBg: "var(--amber-bg)",
      icon: "◉",
      sub: "active now",
    },
    {
      label: "Completed",
      value: stats.completed,
      color: "var(--green)",
      iconBg: "var(--green-bg)",
      icon: "✓",
      sub: `${successRate}% success rate`,
    },
    {
      label: "Failed",
      value: stats.failed,
      color: "var(--red)",
      iconBg: "var(--red-bg)",
      icon: "✕",
      sub: stats.failed > 0 ? "needs review" : "all clear",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14,
        padding: "0 32px 24px",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "18px 20px",
            boxShadow: "var(--shadow)",
            transition: "all 0.15s",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}
            >
              {card.label}
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: card.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              {card.icon}
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-1.5px",
              lineHeight: 1,
              color: card.color,
            }}
          >
            {card.value}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--dim)",
              marginTop: 5,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
