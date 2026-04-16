import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsCards } from "../components/StatsCards.tsx";
import type { RunStats } from "../types.ts";

const baseStats: RunStats = { total: 10, running: 2, completed: 7, failed: 1 };

describe("StatsCards", () => {
  it("renders all four stat values", () => {
    render(<StatsCards stats={baseStats} />);
    expect(screen.getByText("10")).toBeInTheDocument(); // total
    expect(screen.getByText("2")).toBeInTheDocument(); // running
    expect(screen.getByText("7")).toBeInTheDocument(); // completed
    expect(screen.getByText("1")).toBeInTheDocument(); // failed
  });

  it("shows correct success rate", () => {
    render(<StatsCards stats={baseStats} />);
    // 7/10 = 70%
    expect(screen.getByText("70% success rate")).toBeInTheDocument();
  });

  it("shows 0% success rate when total is 0", () => {
    render(
      <StatsCards stats={{ total: 0, running: 0, completed: 0, failed: 0 }} />,
    );
    expect(screen.getByText("0% success rate")).toBeInTheDocument();
  });

  it("shows 'needs review' when there are failures", () => {
    render(<StatsCards stats={baseStats} />);
    expect(screen.getByText("needs review")).toBeInTheDocument();
  });

  it("shows 'all clear' when there are no failures", () => {
    render(<StatsCards stats={{ ...baseStats, failed: 0 }} />);
    expect(screen.getByText("all clear")).toBeInTheDocument();
  });
});
