export const CREATE_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS runs (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    external_ticket_id TEXT    NOT NULL,
    tool               TEXT    NOT NULL,
    status             TEXT    NOT NULL DEFAULT 'pending',
    branch_name        TEXT,
    worktree_path      TEXT,
    pr_target_branch   TEXT,
    pr_url             TEXT,
    story_url          TEXT,
    summary            TEXT,
    error_message      TEXT,
    created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
` as const;

export type RunStatus = "pending" | "running" | "completed" | "failed";
