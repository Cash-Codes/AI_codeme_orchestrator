import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRuns } from "../hooks/useRuns.ts";
import type { Filters, RunsResponse } from "../types.ts";

const defaultFilters: Filters = {
  date: "all",
  target_branch: "all",
  status: "all",
};

const mockResponse: RunsResponse = {
  runs: [],
  total: 0,
  stats: { total: 0, running: 0, completed: 0, failed: 0 },
  targetBranches: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useRuns", () => {
  it("fetches on mount and sets data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }),
    );

    const { result } = renderHook(() => useRuns(defaultFilters));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const { result } = renderHook(() => useRuns(defaultFilters));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("API error 500");
  });

  it("omits 'all' values from query params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => mockResponse });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useRuns(defaultFilters));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/runs?");
  });

  it("includes active filter values in query params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => mockResponse });
    vi.stubGlobal("fetch", fetchMock);

    const filters: Filters = {
      date: "today",
      target_branch: "main",
      status: "failed",
    };
    renderHook(() => useRuns(filters));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("date=today");
    expect(url).toContain("target_branch=main");
    expect(url).toContain("status=failed");
  });

  it("polls every 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => mockResponse });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useRuns(defaultFilters));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborts in-flight requests on unmount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }),
    );

    const { result, unmount } = renderHook(() => useRuns(defaultFilters));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    unmount();
    expect(abortSpy).toHaveBeenCalledOnce();
  });
});
