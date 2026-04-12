export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface Run {
  id: number;
  external_ticket_id: string;
  tool: string;
  status: RunStatus;
  branch_name: string | null;
  worktree_path: string | null;
  pr_target_branch: string | null;
  pr_url: string | null;
  story_url: string | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

export interface RunsResponse {
  runs: Run[];
  total: number;
  stats: RunStats;
  targetBranches: string[];
}

export interface Filters {
  date: "all" | "today" | "7d" | "30d";
  target_branch: string; // "all" or a specific branch
  status: "all" | RunStatus;
}
