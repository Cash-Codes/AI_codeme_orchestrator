/**
 * Claude Agent Service
 *
 * Runs implementation tasks by spawning the Claude Code CLI as a subprocess
 * inside an isolated git worktree. Auth is handled by the CLI via stored
 * OAuth credentials (/root/.claude/.credentials.json) — no ANTHROPIC_API_KEY
 * required.
 */

import { spawn } from "node:child_process";
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
 * Runs the Claude Code CLI to implement the ticket inside the given worktree.
 *
 * Auth is handled by the CLI itself — it reads stored OAuth credentials from
 * /root/.claude/.credentials.json. No API key needed.
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

  console.log(
    `[claude-agent] starting run branch=${input.branchName} cwd=${input.worktreePath}`,
  );

  return new Promise((resolve) => {
    const proc = spawn(
      "claude",
      [
        "--print",
        "--max-turns",
        "80",
        "--allowedTools",
        "Read,Write,Edit,Glob,Grep,Bash",
      ],
      {
        cwd: input.worktreePath,
        env: process.env,
      },
    );

    proc.stdin.write(prompt);
    proc.stdin.end();

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      process.stdout.write(`[claude-agent] ${text}`);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      process.stderr.write(`[claude-agent:err] ${text}`);
    });

    proc.on("error", (err) => {
      console.error(
        `[claude-agent] failed to spawn claude CLI: ${err.message}`,
      );
      resolve({
        outcome: "error",
        summary: `Failed to spawn claude CLI: ${err.message}`,
        rawOutput: "",
      });
    });

    proc.on("close", (code) => {
      const rawOutput = stdoutChunks.join("");

      if (code !== 0) {
        const errDetail = stderrChunks.join("").trim().slice(0, 300);
        console.error(
          `[claude-agent] CLI exited with code ${code}: ${errDetail}`,
        );
        resolve({
          outcome: "error",
          summary: `Claude CLI exited with code ${code}: ${errDetail}`,
          rawOutput,
        });
        return;
      }

      const parsed = parseAgentOutput(rawOutput);

      if (!parsed.ok) {
        console.warn(
          `[claude-agent] could not parse structured output: ${parsed.reason}`,
        );
        resolve({
          outcome: "error",
          summary: `Agent completed but output could not be parsed: ${parsed.reason}`,
          rawOutput,
        });
        return;
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

      resolve({
        outcome: data.outcome,
        summary: data.summary,
        structured: data,
        rawOutput,
      });
    });
  });
}
