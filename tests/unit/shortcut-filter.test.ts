import { describe, it, expect } from "vitest";
import {
  findStoryAction,
  extractStoryContext,
  parseBaseBranch,
  shouldProcessPayload,
} from "../../src/utils/shortcut-filter.js";
import type { ShortcutWebhookPayload } from "../../src/types/shortcut.js";

const BASE_PAYLOAD: ShortcutWebhookPayload = {
  id: "e1",
  changed_at: "2026-04-10T00:00:00Z",
  version: "v1",
  actions: [],
};

describe("findStoryAction", () => {
  it("returns the story action when present", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{ id: 1, entity_type: "story", action: "update" as const, name: "Foo" }],
    };
    expect(findStoryAction(payload)?.id).toBe(1);
  });

  it("skips delete actions and returns undefined", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{ id: 1, entity_type: "story", action: "delete" as const }],
    };
    expect(findStoryAction(payload)).toBeUndefined();
  });

  it("returns undefined when no story action is present", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{ id: 2, entity_type: "epic", action: "update" as const }],
    };
    expect(findStoryAction(payload)).toBeUndefined();
  });
});

describe("extractStoryContext", () => {
  it("reads description from changes.description.new (update event)", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "update" as const,
      name: "My Story",
      changes: { description: { new: "Updated desc" } },
    };
    expect(extractStoryContext(action, undefined)?.description).toBe("Updated desc");
  });

  it("falls back to action.description for create events", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "create" as const,
      name: "New Story",
      description: "Created desc",
    };
    expect(extractStoryContext(action, undefined)?.description).toBe("Created desc");
  });

  it("returns undefined when name is missing", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "update" as const,
      description: "some desc",
    };
    expect(extractStoryContext(action, undefined)).toBeUndefined();
  });

  it("returns undefined when description cannot be resolved", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "update" as const,
      name: "Story",
      // no description, no changes.description
    };
    expect(extractStoryContext(action, undefined)).toBeUndefined();
  });
});

describe("parseBaseBranch", () => {
  it("parses base-branch directive", () => {
    expect(parseBaseBranch("Some text\nbase-branch: develop")).toBe("develop");
  });

  it("parses target-branch directive", () => {
    expect(parseBaseBranch("target-branch: main")).toBe("main");
  });

  it("is case-insensitive", () => {
    expect(parseBaseBranch("BASE-BRANCH: Staging")).toBe("Staging");
  });

  it("handles no space after colon", () => {
    expect(parseBaseBranch("base-branch:release")).toBe("release");
  });

  it("returns undefined when directive is absent", () => {
    expect(parseBaseBranch("just a normal description")).toBeUndefined();
  });
});

describe("shouldProcessPayload", () => {
  it("returns shouldProcess false when no non-delete story action exists", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{ id: 1, entity_type: "story", action: "delete" as const }],
    };
    const result = shouldProcessPayload(payload);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toContain("No non-delete");
  });

  it("returns shouldProcess false with 'API fetch required' when description absent", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{ id: 1, entity_type: "story", action: "update" as const, name: "Story" }],
    };
    const result = shouldProcessPayload(payload);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toContain("API fetch required");
  });

  it("returns shouldProcess false when trigger tag is absent", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{
        id: 1,
        entity_type: "story",
        action: "update" as const,
        name: "Story",
        changes: { description: { new: "no trigger here" } },
      }],
    };
    expect(shouldProcessPayload(payload).shouldProcess).toBe(false);
  });

  it("returns shouldProcess true when @codemeai is present", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{
        id: 1,
        entity_type: "story",
        action: "update" as const,
        name: "Story",
        changes: { description: { new: "implement this @codemeai please" } },
      }],
    };
    const result = shouldProcessPayload(payload);
    expect(result.shouldProcess).toBe(true);
    expect(result.context?.storyId).toBe(1);
  });

  it("populates context.baseBranch from base-branch directive", () => {
    const payload = {
      ...BASE_PAYLOAD,
      actions: [{
        id: 1,
        entity_type: "story",
        action: "update" as const,
        name: "Story",
        changes: { description: { new: "@codemeai\nbase-branch: develop" } },
      }],
    };
    expect(shouldProcessPayload(payload).context?.baseBranch).toBe("develop");
  });
});

describe("resolveWorkflowStateName (via extractStoryContext)", () => {
  it("resolves workflow state name when reference matches stateId", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "update" as const,
      name: "Story",
      changes: {
        description: { new: "desc" },
        workflow_state_id: { new: 42 },
      },
    };
    const references = [{ id: 42, entity_type: "workflow-state", name: "In Progress" }];
    const ctx = extractStoryContext(action, references);
    expect(ctx?.workflowStateName).toBe("In Progress");
    expect(ctx?.workflowStateId).toBe(42);
  });

  it("returns undefined workflowStateName when no reference matches", () => {
    const action = {
      id: 10,
      entity_type: "story",
      action: "update" as const,
      name: "Story",
      changes: {
        description: { new: "desc" },
        workflow_state_id: { new: 99 },
      },
    };
    const references = [{ id: 42, entity_type: "workflow-state", name: "In Progress" }];
    const ctx = extractStoryContext(action, references);
    expect(ctx?.workflowStateName).toBeUndefined();
  });
});
