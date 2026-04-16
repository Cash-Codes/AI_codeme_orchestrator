import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports.
// ---------------------------------------------------------------------------

vi.mock("../../src/db/client.js", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { CREATE_RUNS_TABLE } = await import("../../src/db/schema.js");
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_RUNS_TABLE);
  return { db };
});

vi.mock("../../src/services/ticket-processor.js", () => ({
  ticketProcessor: {
    process: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/services/shortcut.service.js", () => ({
  shortcutService: {
    getStoryById: vi.fn(),
    createStoryComment: vi.fn().mockResolvedValue({}),
  },
}));

// ---------------------------------------------------------------------------
// Imports — resolved after mocks.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../../src/app.js";
import { ticketProcessor } from "../../src/services/ticket-processor.js";
import { shortcutService } from "../../src/services/shortcut.service.js";

const mockGetStory = vi.mocked(shortcutService.getStoryById);
const mockProcess = vi.mocked(ticketProcessor.process);

const STORY = {
  id: 99,
  name: "Add Google OAuth",
  description: "Implement Google OAuth login @codemeai",
  storyType: "feature",
  workflowStateId: 1,
  appUrl: "https://app.shortcut.com/acme/story/99",
};

describe("POST /api/debug/trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStory.mockResolvedValue(STORY);
  });

  describe("input validation", () => {
    it("returns 400 when storyId is missing", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/storyId/);
    });

    it("returns 400 when storyId is a string", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: "99" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/storyId/);
    });

    it("returns 400 when storyId is zero", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 0 });
      expect(res.status).toBe(400);
    });

    it("returns 400 when storyId is negative", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: -5 });
      expect(res.status).toBe(400);
    });
  });

  describe("dry-run mode", () => {
    it("fetches the story and returns the prompt without creating a run", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99, dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.storyId).toBe(99);
      expect(res.body.story).toMatchObject({ id: 99, name: "Add Google OAuth" });
      expect(typeof res.body.prompt).toBe("string");
      expect(res.body.prompt.length).toBeGreaterThan(100);
    });

    it("does not invoke the processor in dry-run mode", async () => {
      await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99, dryRun: true });
      expect(mockProcess).not.toHaveBeenCalled();
    });

    it("returns 502 when Shortcut API fails", async () => {
      mockGetStory.mockRejectedValue(new Error("connection timeout"));
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99, dryRun: true });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/connection timeout/);
    });
  });

  describe("full run mode", () => {
    it("creates a run and fires the processor, returning runId", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99 });

      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(false);
      expect(typeof res.body.runId).toBe("number");
      expect(res.body.storyId).toBe(99);
    });

    it("passes correct run and context to the processor", async () => {
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99 });

      expect(mockProcess).toHaveBeenCalledOnce();
      const [runArg, contextArg] = mockProcess.mock.calls[0];
      expect(runArg.id).toBe(res.body.runId);
      expect(contextArg.storyId).toBe(99);
      expect(contextArg.name).toBe("Add Google OAuth");
      expect(contextArg.description).toBe(STORY.description);
    });

    it("returns 502 when Shortcut API fails", async () => {
      mockGetStory.mockRejectedValue(new Error("not found"));
      const res = await request(app)
        .post("/api/debug/trigger")
        .send({ storyId: 99 });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/not found/);
    });
  });
});
