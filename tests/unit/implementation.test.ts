import { describe, it, expect } from "vitest";
import {
  parseAgentOutput,
  buildImplementationPrompt,
} from "../../src/utils/prompts/implementation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidBlock(outcome = "success"): string {
  return JSON.stringify({
    outcome,
    summary: "Added the feature",
    files_changed: ["src/foo.ts"],
    validation: [{ command: "npm run build", passed: true }],
    open_questions: [],
    suggested_pr_title: "feat: add feature",
  });
}

function wrap(json: string): string {
  return `\`\`\`json\n${json}\n\`\`\``;
}

// ---------------------------------------------------------------------------
// parseAgentOutput
// ---------------------------------------------------------------------------

describe("parseAgentOutput", () => {
  it("returns ok:false when no JSON block found", () => {
    const result = parseAgentOutput("plain text with no code block");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("No JSON result block");
  });

  it("returns ok:false when JSON is malformed", () => {
    const result = parseAgentOutput(wrap("{ bad json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("could not be parsed");
  });

  it("returns ok:false when outcome value is invalid", () => {
    const result = parseAgentOutput(
      wrap(JSON.stringify({
        outcome: "unknown_value",
        summary: "",
        files_changed: [],
        validation: [],
        open_questions: [],
        suggested_pr_title: "",
      })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Invalid outcome");
  });

  it("returns ok:true and parses all fields from a valid block", () => {
    const result = parseAgentOutput(wrap(makeValidBlock()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("success");
      expect(result.data.summary).toBe("Added the feature");
      expect(result.data.files_changed).toEqual(["src/foo.ts"]);
      expect(result.data.suggested_pr_title).toBe("feat: add feature");
    }
  });

  it("picks the last JSON block when multiple blocks are present", () => {
    const firstBlock = wrap(makeValidBlock("error"));
    const secondBlock = wrap(makeValidBlock("success"));
    const raw = `${firstBlock}\n\nSome intermediate text.\n\n${secondBlock}`;
    const result = parseAgentOutput(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.outcome).toBe("success");
  });

  it("returns ok:false when JSON is valid but not an object", () => {
    const result = parseAgentOutput(wrap('"just a string"'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not an object");
  });

  it("returns empty arrays for missing optional fields", () => {
    const minimal = wrap(JSON.stringify({ outcome: "no_changes", summary: "nothing to do" }));
    const result = parseAgentOutput(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files_changed).toEqual([]);
      expect(result.data.open_questions).toEqual([]);
      expect(result.data.validation).toEqual([]);
      expect(result.data.suggested_pr_title).toBe("");
    }
  });

  it("accepts no_changes as a valid outcome", () => {
    expect(parseAgentOutput(wrap(makeValidBlock("no_changes"))).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildImplementationPrompt
// ---------------------------------------------------------------------------

describe("buildImplementationPrompt", () => {
  it("uses custom buildCmd and lintCmd when provided", () => {
    const prompt = buildImplementationPrompt({
      title: "Test ticket",
      description: "Do something @codemeai",
      branchName: "codemeai/shortcut-42",
      buildCmd: "yarn build",
      lintCmd: "yarn lint",
    });
    expect(prompt).toContain("yarn build");
    expect(prompt).toContain("yarn lint");
    expect(prompt).not.toContain("npm run build");
    expect(prompt).not.toContain("npm run lint");
  });

  it("defaults to npm run build and npm run lint", () => {
    const prompt = buildImplementationPrompt({
      title: "Test ticket",
      description: "Do something @codemeai",
      branchName: "codemeai/shortcut-42",
    });
    expect(prompt).toContain("npm run build");
    expect(prompt).toContain("npm run lint");
    expect(prompt).toContain("codemeai/shortcut-42");
    expect(prompt).toContain("Test ticket");
  });

  it("includes acceptance criteria when provided", () => {
    const prompt = buildImplementationPrompt({
      title: "Test ticket",
      description: "Do something @codemeai",
      branchName: "codemeai/shortcut-42",
      acceptanceCriteria: "Must work offline without network",
    });
    expect(prompt).toContain("Must work offline without network");
    expect(prompt).toContain("Acceptance Criteria");
  });

  it("omits the Acceptance Criteria section when not provided", () => {
    const prompt = buildImplementationPrompt({
      title: "Test ticket",
      description: "Do something @codemeai",
      branchName: "codemeai/shortcut-42",
    });
    expect(prompt).not.toContain("Acceptance Criteria");
  });
});
