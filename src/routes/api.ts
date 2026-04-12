import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "../config/env.js";
import { listRuns } from "../db/index.js";
import type { RunStatus } from "../db/schema.js";
import { MOCK_RUNS } from "../fixtures/runs.js";

const router = Router();

router.get("/runs", (_req: Request, res: Response) => {
  const { date, target_branch, status } = _req.query as Record<
    string,
    string | undefined
  >;

  let runs = config.DEMO_MODE ? [...MOCK_RUNS] : listRuns();

  // Date filter
  if (date && date !== "all") {
    const cutoff = new Date();
    if (date === "today") {
      cutoff.setHours(0, 0, 0, 0);
    } else if (date === "7d") {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (date === "30d") {
      cutoff.setDate(cutoff.getDate() - 30);
    } else {
      cutoff.setTime(0); // unknown value — include all
    }
    runs = runs.filter((r) => new Date(r.created_at) >= cutoff);
  }

  // Target branch filter
  if (target_branch && target_branch !== "all") {
    runs = runs.filter((r) => r.pr_target_branch === target_branch);
  }

  // Status filter
  if (status && status !== "all") {
    runs = runs.filter((r) => r.status === (status as RunStatus));
  }

  const all = config.DEMO_MODE ? MOCK_RUNS : listRuns();
  const stats = {
    total: all.length,
    running: all.filter((r) => r.status === "running").length,
    completed: all.filter((r) => r.status === "completed").length,
    failed: all.filter((r) => r.status === "failed").length,
  };

  // Distinct target branches for the filter dropdown
  const targetBranches = [
    ...new Set(
      all.map((r) => r.pr_target_branch).filter((b): b is string => b !== null),
    ),
  ].sort();

  res.json({ runs, total: runs.length, stats, targetBranches });
});

export default router;
