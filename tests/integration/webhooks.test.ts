import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports by Vitest.
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
// Imports — resolved after mocks are in place.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../../src/app.js";
import { db as testDb } from "../../src/db/client.js";
import { ticketProcessor } from "../../src/services/ticket-processor.js";
import { shortcutService } from "../../src/services/shortcut.service.js";
import { makePayload, signBody } from "../helpers/shortcut-payload.js";

const mockProcess = vi.mocked(ticketProcessor.process);
// Used in the description-fallback tests below.
const mockGetStory = vi.mocked(shortcutService.getStoryById);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function post(body: string, signature?: string) {
  const req = request(app)
    .post("/webhooks/shortcut")
    .set("Content-Type", "application/json");
  if (signature !== undefined) req.set("Shortcut-Signature", signature);
  return req.send(body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /webhooks/shortcut", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM runs");
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when Shortcut-Signature header is missing", async () => {
    const { body } = makePayload();
    const res = await post(body);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    const { body } = makePayload();
    const res = await post(body, "sha256=badhash");
    expect(res.status).toBe(401);
  });

  // --- Filtering ---

  it("returns 200 skipped when payload has no actions", async () => {
    const { body, signature } = makePayload({ actions: [] });
    const res = await post(body, signature);
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBeTruthy();
  });

  it("returns 200 skipped when story action has no trigger tag", async () => {
    const { body, signature } = makePayload({
      actions: [{
        id: 1,
        entity_type: "story",
        action: "update",
        name: "My Story",
        changes: { description: { new: "no trigger here" } },
      }],
    });
    const res = await post(body, signature);
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
  });

  // --- Happy path ---

  it("returns 200 with runId and fires processor when @codemeai present", async () => {
    const { body, signature } = makePayload();
    const res = await post(body, signature);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.runId).toBeTypeOf("number");
    // Verify a run was created in the DB.
    const rows = testDb.prepare("SELECT * FROM runs").all();
    expect(rows).toHaveLength(1);
    // Processor fired (fire-and-forget — not awaited by route).
    expect(mockProcess).toHaveBeenCalledOnce();
  });

  // --- Dedup ---

  it("skips when a run for the same story is already running", async () => {
    const { body, signature } = makePayload(); // storyId = 101
    // First request — creates the run.
    await post(body, signature);
    // Manually set status to running (simulates processor having started).
    testDb.exec("UPDATE runs SET status = 'running'");
    // Second request — same story, should be skipped.
    const { body: body2, signature: sig2 } = makePayload();
    const res2 = await post(body2, sig2);
    expect(res2.status).toBe(200);
    expect(res2.body.skipped).toBe(true);
    // Processor was only called once (for the first request).
    expect(mockProcess).toHaveBeenCalledOnce();
    // Still only one DB row.
    expect(testDb.prepare("SELECT COUNT(*) as c FROM runs").get()).toMatchObject({ c: 1 });
  });

  it("skips when a run for the same story is already completed", async () => {
    const { body, signature } = makePayload();
    await post(body, signature);
    testDb.exec("UPDATE runs SET status = 'completed'");
    const { body: body2, signature: sig2 } = makePayload();
    const res2 = await post(body2, sig2);
    expect(res2.status).toBe(200);
    expect(res2.body.skipped).toBe(true);
    expect(mockProcess).toHaveBeenCalledOnce();
    expect(testDb.prepare("SELECT COUNT(*) as c FROM runs").get()).toMatchObject({ c: 1 });
  });

  // --- Description fallback (API fetch) ---

  it("fetches story from API when description is absent from payload and queues run", async () => {
    mockGetStory.mockResolvedValue({
      id: 1,
      name: "My Story",
      description: "@codemeai implement OAuth",
      storyType: "feature",
      workflowStateId: 500,
      appUrl: "https://app.shortcut.com/story/1",
    });
    // Payload has a story action but no description (state-change-only update).
    const rawPayload = {
      id: "e1",
      changed_at: "2026-04-10T00:00:00Z",
      version: "v1",
      actions: [{ id: 1, entity_type: "story", action: "update", name: "My Story" }],
    };
    const body = JSON.stringify(rawPayload);
    const res = await post(body, signBody(body));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockGetStory).toHaveBeenCalledWith(1);
    expect(mockProcess).toHaveBeenCalledOnce();
  });

  it("skips when API-fetched description has no trigger tag", async () => {
    mockGetStory.mockResolvedValue({
      id: 1,
      name: "My Story",
      description: "no trigger tag here",
      storyType: "feature",
      workflowStateId: 500,
      appUrl: "https://app.shortcut.com/story/1",
    });
    const rawPayload = {
      id: "e1",
      changed_at: "2026-04-10T00:00:00Z",
      version: "v1",
      actions: [{ id: 1, entity_type: "story", action: "update", name: "My Story" }],
    };
    const body = JSON.stringify(rawPayload);
    const res = await post(body, signBody(body));
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
  });

  it("skips gracefully when API fetch throws", async () => {
    mockGetStory.mockRejectedValue(new Error("Shortcut API is down"));
    const rawPayload = {
      id: "e1",
      changed_at: "2026-04-10T00:00:00Z",
      version: "v1",
      actions: [{ id: 1, entity_type: "story", action: "update", name: "My Story" }],
    };
    const body = JSON.stringify(rawPayload);
    const res = await post(body, signBody(body));
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toContain("API fetch failed");
  });
});
