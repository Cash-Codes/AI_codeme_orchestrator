import type { AgentOutput } from "../prompts/implementation.js";

export interface SuccessCommentParams {
  summary: string;
  files_changed: string[];
  validation: AgentOutput["validation"];
  open_questions: string[];
  branchName: string;
  prUrl: string | null;
}

export interface FailureCommentParams {
  reason: string;
  branchName: string | undefined;
}

export interface NoChangesCommentParams {
  branchName: string;
}

export function buildSuccessComment(params: SuccessCommentParams): string {
  const lines: string[] = ["✅ Implementation complete", "", params.summary];

  if (params.files_changed.length > 0) {
    lines.push("", "**Files touched**");
    for (const f of params.files_changed) {
      lines.push(`- \`${f}\``);
    }
  }

  if (params.validation.length > 0) {
    lines.push("", "**Validation**");
    for (const v of params.validation) {
      const symbol = v.passed ? "✓" : "✗";
      const notes = v.notes ? ` (${v.notes})` : "";
      lines.push(`- ${symbol} ${v.command}${notes}`);
    }
  }

  if (params.open_questions.length > 0) {
    lines.push("", "**Open questions**");
    for (const q of params.open_questions) {
      lines.push(`- ${q}`);
    }
  }

  lines.push("", `**Branch:** \`${params.branchName}\``);

  if (params.prUrl) {
    lines.push(`**PR:** ${params.prUrl}`);
  }

  lines.push("", "— codemeai");

  return lines.join("\n");
}

export function buildFailureComment(params: FailureCommentParams): string {
  const lines: string[] = ["❌ Implementation failed", "", params.reason];

  if (params.branchName !== undefined) {
    lines.push("", `**Branch:** \`${params.branchName}\``);
  }

  lines.push("", "— codemeai");

  return lines.join("\n");
}

export function buildNoChangesComment(params: NoChangesCommentParams): string {
  return [
    "ℹ️ No changes needed",
    "",
    "The codebase already satisfies the requirements described in this ticket.",
    "",
    `**Branch:** \`${params.branchName}\``,
    "",
    "— codemeai",
  ].join("\n");
}
