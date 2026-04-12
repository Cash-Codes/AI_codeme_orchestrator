import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FiltersBar } from "../components/FiltersBar.tsx";
import type { Filters } from "../types.ts";

const defaultFilters: Filters = {
  date: "all",
  target_branch: "all",
  status: "all",
};

describe("FiltersBar", () => {
  it("renders the three filter selects", () => {
    render(
      <FiltersBar
        filters={defaultFilters}
        targetBranches={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("All time")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All branches")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All statuses")).toBeInTheDocument();
  });

  it("renders target branch options from props", () => {
    render(
      <FiltersBar
        filters={defaultFilters}
        targetBranches={["main", "develop"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: "main" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "develop" })).toBeInTheDocument();
  });

  it("calls onChange with updated date when date select changes", async () => {
    const onChange = vi.fn();
    render(
      <FiltersBar
        filters={defaultFilters}
        targetBranches={[]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByDisplayValue("All time"),
      "today",
    );
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, date: "today" });
  });

  it("calls onChange with updated status when status select changes", async () => {
    const onChange = vi.fn();
    render(
      <FiltersBar
        filters={defaultFilters}
        targetBranches={[]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByDisplayValue("All statuses"),
      "failed",
    );
    expect(onChange).toHaveBeenCalledWith({
      ...defaultFilters,
      status: "failed",
    });
  });

  it("does not show clear button when no filters are active", () => {
    render(
      <FiltersBar
        filters={defaultFilters}
        targetBranches={[]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /clear/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button and filter count when a filter is active", () => {
    render(
      <FiltersBar
        filters={{ ...defaultFilters, status: "failed" }}
        targetBranches={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("1 filter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  it("shows plural 'filters' for multiple active filters", () => {
    render(
      <FiltersBar
        filters={{ date: "today", target_branch: "main", status: "all" }}
        targetBranches={["main"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("2 filters")).toBeInTheDocument();
  });

  it("clear button resets all filters to 'all'", async () => {
    const onChange = vi.fn();
    render(
      <FiltersBar
        filters={{ ...defaultFilters, status: "failed" }}
        targetBranches={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({
      date: "all",
      target_branch: "all",
      status: "all",
    });
  });
});
