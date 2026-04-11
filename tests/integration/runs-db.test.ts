import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock db/client before any module that imports it loads.
// vi.mock is hoisted by Vitest's transform to before all imports.
// ---------------------------------------------------------------------------

vi.mock("../../src/db/client.js", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { CREATE_RUNS_TABLE } = await import("../../src/db/schema.js");
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_RUNS_TABLE);
  return { db };
});

// These imports resolve to the mocked module / modules that use the mock.
import { db as testDb } from "../../src/db/client.js";
import {
  createRun,
  getRunByExternalTicketId,
  updateRunStatus,
  updateRunWorktree,
  saveRunResult,
} from "../../src/db/runs.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runs repository", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM runs");
  });

  describe("createRun", () => {
    it("inserts a row and returns the full Run object", () => {
      const run = createRun({ external_ticket_id: "42", tool: "shortcut" });
      expect(run.id).toBeTypeOf("number");
      expect(run.external_ticket_id).toBe("42");
      expect(run.tool).toBe("shortcut");
      expect(run.status).toBe("pending");
      expect(run.branch_name).toBeNull();
      expect(run.worktree_path).toBeNull();
      expect(run.summary).toBeNull();
      expect(run.error_message).toBeNull();
      expect(run.created_at).toBeTruthy();
    });
  });

  describe("getRunByExternalTicketId", () => {
    it("returns the most recent run for a ticket id", () => {
      createRun({ external_ticket_id: "42", tool: "shortcut" });
      const second = createRun({ external_ticket_id: "42", tool: "shortcut" });
      const found = getRunByExternalTicketId("42");
      expect(found?.id).toBe(second.id);
    });

    it("returns undefined when no run exists for the ticket id", () => {
      expect(getRunByExternalTicketId("999")).toBeUndefined();
    });
  });

  describe("updateRunStatus", () => {
    it("updates the status field", () => {
      const run = createRun({ external_ticket_id: "1", tool: "shortcut" });
      updateRunStatus(run.id, "running");
      expect(getRunByExternalTicketId("1")?.status).toBe("running");
    });
  });

  describe("updateRunWorktree", () => {
    it("writes branch_name and worktree_path", () => {
      const run = createRun({ external_ticket_id: "1", tool: "shortcut" });
      updateRunWorktree(run.id, "codemeai/shortcut-1", "/tmp/wt/shortcut-1");
      const updated = getRunByExternalTicketId("1");
      expect(updated?.branch_name).toBe("codemeai/shortcut-1");
      expect(updated?.worktree_path).toBe("/tmp/wt/shortcut-1");
    });
  });

  describe("saveRunResult", () => {
    it("writes summary and status on success", () => {
      const run = createRun({ external_ticket_id: "1", tool: "shortcut" });
      saveRunResult(run.id, { summary: "All done", status: "completed" });
      const updated = getRunByExternalTicketId("1");
      expect(updated?.summary).toBe("All done");
      expect(updated?.status).toBe("completed");
      expect(updated?.error_message).toBeNull();
    });

    it("writes error_message and failed status", () => {
      const run = createRun({ external_ticket_id: "2", tool: "shortcut" });
      saveRunResult(run.id, { error_message: "Build failed", status: "failed" });
      const updated = getRunByExternalTicketId("2");
      expect(updated?.error_message).toBe("Build failed");
      expect(updated?.status).toBe("failed");
    });
  });

  describe("dedup scenario", () => {
    it("getRunByExternalTicketId returns the latest when two runs share a ticket id", () => {
      const first = createRun({ external_ticket_id: "5", tool: "shortcut" });
      updateRunStatus(first.id, "running");
      const second = createRun({ external_ticket_id: "5", tool: "shortcut" });
      expect(getRunByExternalTicketId("5")?.id).toBe(second.id);
    });
  });
});
