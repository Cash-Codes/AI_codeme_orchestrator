import { db } from "./client.js";
import type { RunStatus } from "./schema.js";

export interface Run {
  id: number;
  external_ticket_id: string;
  tool: string;
  status: RunStatus;
  branch_name: string | null;
  worktree_path: string | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRunInput {
  external_ticket_id: string;
  tool: string;
  branch_name?: string;
  worktree_path?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const stmts = {
  insert: db.prepare<
    [string, string, string | undefined, string | undefined],
    { id: number }
  >(
    `INSERT INTO runs (external_ticket_id, tool, branch_name, worktree_path)
     VALUES (?, ?, ?, ?)
     RETURNING id`,
  ),

  findByTicketId: db.prepare<[string], Run>(
    `SELECT * FROM runs WHERE external_ticket_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
  ),

  updateStatus: db.prepare<[RunStatus, number], void>(
    `UPDATE runs SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ),

  saveResult: db.prepare<[string | null, string | null, RunStatus, number], void>(
    `UPDATE runs
     SET summary = ?, error_message = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ),

  updateWorktree: db.prepare<[string, string, number], void>(
    `UPDATE runs
     SET branch_name = ?, worktree_path = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ),

  findById: db.prepare<[number], Run>(`SELECT * FROM runs WHERE id = ?`),
} as const;

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export function createRun(input: CreateRunInput): Run {
  const row = stmts.insert.get(
    input.external_ticket_id,
    input.tool,
    input.branch_name,
    input.worktree_path,
  )!;
  return getRunById(row.id)!;
}

export function getRunByExternalTicketId(ticketId: string): Run | undefined {
  return stmts.findByTicketId.get(ticketId);
}

export function updateRunStatus(id: number, status: RunStatus): void {
  stmts.updateStatus.run(status, id);
}

export function updateRunWorktree(
  id: number,
  branchName: string,
  worktreePath: string,
): void {
  stmts.updateWorktree.run(branchName, worktreePath, id);
}

export function saveRunResult(
  id: number,
  result: { summary?: string; error_message?: string; status: RunStatus },
): void {
  stmts.saveResult.run(
    result.summary ?? null,
    result.error_message ?? null,
    result.status,
    id,
  );
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function getRunById(id: number): Run | undefined {
  return stmts.findById.get(id);
}
