/**
 * Claude Agent Service
 *
 * Integrates the Anthropic Claude Agent SDK to run implementation tasks
 * inside an isolated git worktree. The Agent SDK reads ANTHROPIC_API_KEY
 * from process.env automatically — the key is validated at server startup
 * in src/config/env.ts, so by the time this service is called it is present.
 *
 * Swap strategy: to run Claude Code CLI as a subprocess instead of the SDK,
 * replace runImplementationTask() with a child_process.execFile() call and
 * parse stdout. AgentResult and ImplementationTaskInput stay the same.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentOutput } from "../prompts/implementation.js";
import {
  buildImplementationPrompt,
  parseAgentOutput,
} from "../prompts/implementation.js";

// ---------------------------------------------------------------------------
// Public interface — stable contract regardless of backend (SDK vs CLI)
// ---------------------------------------------------------------------------

export interface ImplementationTaskInput {
  /** Ticket title / story name */
  title: string;
  /** Full ticket description — must include @codemeai tag */
  description: string;
  /** Optional acceptance criteria extracted from the ticket */
  acceptanceCriteria?: string;
  /** Absolute path to the isolated worktree where changes should be made */
  worktreePath: string;
  /** Branch already created in the worktree */
  branchName: string;
  /** Override for the build command (defaults to npm run build) */
  buildCmd?: string;
  /** Override for the lint command (defaults to npm run lint) */
  lintCmd?: string;
}

export interface AgentResult {
  /** Machine-readable outcome */
  outcome: AgentOutput["outcome"];
  /** Human-readable summary of what was done */
  summary: string;
  /** Structured output from Claude if parsing succeeded */
  structured?: AgentOutput;
  /** Full raw agent output for debugging */
  rawOutput: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs a Claude agent to implement the ticket inside the given worktree.
 *
 * ANTHROPIC_API_KEY is consumed by the Agent SDK from process.env.
 * It is validated at server startup — if missing the server refuses to start.
 */
export async function runImplementationTask(
  input: ImplementationTaskInput,
): Promise<AgentResult> {
  const prompt = buildImplementationPrompt({
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    branchName: input.branchName,
    buildCmd: input.buildCmd,
    lintCmd: input.lintCmd,
  });

  const outputChunks: string[] = [];

  console.log(
    `[claude-agent] starting run branch=${input.branchName} cwd=${input.worktreePath}`,
  );

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: input.worktreePath,
        // ANTHROPIC_API_KEY is consumed here by the Agent SDK from process.env.
        tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        permissionMode: "acceptEdits",
        maxTurns: 40,
      },
    })) {
      if ("result" in message) {
        // Surface SDK-level errors reported in the result message.
        if (
          "errors" in message &&
          Array.isArray(message.errors) &&
          message.errors.length > 0
        ) {
          const errorDetail = (message.errors as unknown[])
            .map((e) =>
              typeof e === "object" && e !== null && "message" in e
                ? (e as { message: string }).message
                : String(e),
            )
            .join("; ");
          console.error(`[claude-agent] SDK result errors: ${errorDetail}`);
          return {
            outcome: "error",
            summary: `Agent SDK reported errors: ${errorDetail}`,
            rawOutput: outputChunks.join("\n"),
          };
        }
        outputChunks.push(message.result);
        console.log(
          `[claude-agent] result received (${message.result.length} chars)`,
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[claude-agent] SDK error: ${msg}`);
    return {
      outcome: "error",
      summary: `Agent SDK error: ${msg}`,
      rawOutput: outputChunks.join("\n"),
    };
  }

  const rawOutput = outputChunks.join("\n");
  const parsed = parseAgentOutput(rawOutput);

  if (!parsed.ok) {
    console.warn(
      `[claude-agent] could not parse structured output: ${parsed.reason}`,
    );
    return {
      outcome: "error",
      summary: `Agent completed but output could not be parsed: ${parsed.reason}`,
      rawOutput,
    };
  }

  const { data } = parsed;

  const validationSummary = data.validation
    .map(
      (v) =>
        `${v.passed ? "✓" : "✗"} ${v.command}${v.notes ? ` (${v.notes})` : ""}`,
    )
    .join(", ");

  console.log(
    `[claude-agent] finished outcome=${data.outcome} files=${data.files_changed.length} validation=[${validationSummary}]`,
  );

  if (data.open_questions.length > 0) {
    console.warn(
      `[claude-agent] open questions: ${data.open_questions.join(" | ")}`,
    );
  }

  return {
    outcome: data.outcome,
    summary: data.summary,
    structured: data,
    rawOutput,
  };
}
