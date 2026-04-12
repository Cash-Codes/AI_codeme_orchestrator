import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../components/ThemeToggle.tsx";

describe("ThemeToggle", () => {
  it("renders a button", () => {
    render(<ThemeToggle isDark={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /toggle dark mode/i }),
    ).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<ThemeToggle isDark={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("knob is shifted right when isDark is true", () => {
    const { rerender } = render(
      <ThemeToggle isDark={true} onToggle={vi.fn()} />,
    );
    const knob = document.querySelector<HTMLSpanElement>("button > span")!;
    expect(knob.style.transform).toBe("translateX(14px)");

    rerender(<ThemeToggle isDark={false} onToggle={vi.fn()} />);
    expect(knob.style.transform).toBe("translateX(0)");
  });
});
