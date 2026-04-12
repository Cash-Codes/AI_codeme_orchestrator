import { describe, expect, it } from "vitest";
import {
  buildFailureComment,
  buildNoChangesComment,
  buildSuccessComment,
} from "../../src/services/shortcut-comment.builder.js";

describe("buildSuccessComment", () => {
  const base = {
    summary: "Added rate limiting to all API endpoints.",
    files_changed: ["src/middleware/rate-limit.ts", "src/app.ts"],
    validation: [
      { command: "npm run build", passed: true },
      { command: "npm run lint", passed: true, notes: "2 warnings" },
    ],
    open_questions: [],
    branchName: "feat/sc-1458-rate-limiting",
    prUrl: "https://github.com/org/repo/pull/85",
  };

  it("includes success header", () => {
    expect(buildSuccessComment(base)).toContain("✅ Implementation complete");
  });

  it("includes summary", () => {
    expect(buildSuccessComment(base)).toContain(
      "Added rate limiting to all API endpoints.",
    );
  });

  it("includes files touched section", () => {
    const out = buildSuccessComment(base);
    expect(out).toContain("**Files touched**");
    expect(out).toContain("- `src/middleware/rate-limit.ts`");
    expect(out).toContain("- `src/app.ts`");
  });

  it("omits files touched section when empty", () => {
    const out = buildSuccessComment({ ...base, files_changed: [] });
    expect(out).not.toContain("**Files touched**");
  });

  it("includes validation section with pass/fail symbols", () => {
    const out = buildSuccessComment(base);
    expect(out).toContain("**Validation**");
    expect(out).toContain("- ✓ npm run build");
    expect(out).toContain("- ✓ npm run lint (2 warnings)");
  });

  it("shows ✗ for failed validation steps", () => {
    const params = {
      ...base,
      validation: [{ command: "npm run build", passed: false, notes: "exit 1" }],
    };
    expect(buildSuccessComment(params)).toContain("- ✗ npm run build (exit 1)");
  });

  it("omits validation section when empty", () => {
    const out = buildSuccessComment({ ...base, validation: [] });
    expect(out).not.toContain("**Validation**");
  });

  it("includes PR link", () => {
    expect(buildSuccessComment(base)).toContain(
      "**PR:** https://github.com/org/repo/pull/85",
    );
  });

  it("omits PR line when prUrl is null", () => {
    const out = buildSuccessComment({ ...base, prUrl: null });
    expect(out).not.toContain("**PR:**");
  });

  it("branch appears before PR link", () => {
    const out = buildSuccessComment(base);
    expect(out.indexOf("**Branch:**")).toBeLessThan(out.indexOf("**PR:**"));
  });

  it("includes branch", () => {
    expect(buildSuccessComment(base)).toContain(
      "**Branch:** `feat/sc-1458-rate-limiting`",
    );
  });

  it("omits open questions section when empty", () => {
    const out = buildSuccessComment({ ...base, open_questions: [] });
    expect(out).not.toContain("**Open questions**");
  });

  it("includes open questions section when non-empty", () => {
    const out = buildSuccessComment({
      ...base,
      open_questions: ["Should rate limit apply to /health?"],
    });
    expect(out).toContain("**Open questions**");
    expect(out).toContain("- Should rate limit apply to /health?");
  });

  it("ends with codemeai signature", () => {
    expect(buildSuccessComment(base)).toContain("— codemeai");
  });
});

describe("buildFailureComment", () => {
  it("includes failure header", () => {
    expect(
      buildFailureComment({
        reason: "Build failed: exit 1",
        branchName: "feat/sc-1463-bulk-export",
      }),
    ).toContain("❌ Implementation failed");
  });

  it("includes reason", () => {
    expect(
      buildFailureComment({
        reason: "Build failed: exit 1",
        branchName: "feat/sc-1463-bulk-export",
      }),
    ).toContain("Build failed: exit 1");
  });

  it("includes branch when provided", () => {
    const out = buildFailureComment({
      reason: "Something went wrong",
      branchName: "feat/sc-1463-bulk-export",
    });
    expect(out).toContain("**Branch:** `feat/sc-1463-bulk-export`");
  });

  it("omits branch line when branchName is undefined", () => {
    const out = buildFailureComment({
      reason: "Something went wrong",
      branchName: undefined,
    });
    expect(out).not.toContain("**Branch:**");
  });

  it("ends with codemeai signature", () => {
    expect(
      buildFailureComment({ reason: "err", branchName: undefined }),
    ).toContain("— codemeai");
  });
});

describe("buildNoChangesComment", () => {
  it("includes no-changes header", () => {
    expect(
      buildNoChangesComment({ branchName: "feat/sc-100-already-done" }),
    ).toContain("ℹ️ No changes needed");
  });

  it("includes branch", () => {
    expect(
      buildNoChangesComment({ branchName: "feat/sc-100-already-done" }),
    ).toContain("**Branch:** `feat/sc-100-already-done`");
  });

  it("includes body text", () => {
    expect(
      buildNoChangesComment({ branchName: "feat/sc-100-already-done" }),
    ).toContain("The codebase already satisfies the requirements described in this ticket.");
  });

  it("ends with codemeai signature", () => {
    expect(
      buildNoChangesComment({ branchName: "feat/sc-100-already-done" }),
    ).toContain("— codemeai");
  });
});
