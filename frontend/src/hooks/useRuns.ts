import { useEffect, useRef, useState } from "react";
import type { Filters, RunsResponse } from "../types.ts";

const POLL_INTERVAL_MS = 10_000;

export function useRuns(filters: Filters) {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchRuns() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (filters.date !== "all") params.set("date", filters.date);
    if (filters.target_branch !== "all")
      params.set("target_branch", filters.target_branch);
    if (filters.status !== "all") params.set("status", filters.status);

    try {
      const res = await fetch(`/api/runs?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json: RunsResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchRuns();
    const interval = setInterval(fetchRuns, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [filters.date, filters.target_branch, filters.status]);

  return { data, loading, error, refetch: fetchRuns };
}
