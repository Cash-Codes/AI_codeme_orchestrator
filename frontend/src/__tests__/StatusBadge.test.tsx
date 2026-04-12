import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../components/StatusBadge.tsx";

describe("StatusBadge", () => {
  it.each([
    ["running", "Running"],
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["pending", "Pending"],
  ] as const)("renders correct label for %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies blink animation only for running status", () => {
    const { rerender } = render(<StatusBadge status="running" />);
    const dot = document.querySelector<HTMLSpanElement>("span > span");
    expect(dot?.style.animation).toMatch(/blink/);

    rerender(<StatusBadge status="completed" />);
    const dotCompleted = document.querySelector<HTMLSpanElement>("span > span");
    expect(dotCompleted?.style.animation).toBeFalsy();
  });
});
