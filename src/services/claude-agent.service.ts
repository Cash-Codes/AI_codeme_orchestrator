/**
 * Claude Agent Service
 *
 * Integrates the Anthropic Claude Agent SDK to run implementation tasks
 * inside an isolated git worktree. The Agent SDK uses the ANTHROPIC_API_KEY
 * environment variable automatically — no explicit key passing needed here.
 * The key is loaded from config/env.ts at server startup and validated there.
 *
 * The Agent SDK gives Claude built-in file/shell tools so it can:
 *   - Read and explore the codebase (Read, Glob, Grep)
 *   - Run validation commands: tests, lint, type-check (Bash)
 *   - Create or edit files (Write, Edit)
 *
 * Swap strategy: if you later want to run Claude Code CLI as a subprocess
 * instead of the SDK, replace runImplementationTask() with a child_process
 * call and parse stdout. The AgentResult interface stays the same.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// ---------------------------------------------------------------------------
// Interface — stable contract regardless of backend (SDK vs CLI)
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
  /** Branch already created in the worktree (for logging / commit message) */
  branchName: string;
}

export interface AgentResult {
  /** Short machine-readable outcome: "success" | "no_changes" | "error" */
  outcome: "success" | "no_changes" | "error";
  /** Human-readable summary of what was done */
  summary: string;
  /** Full agent output text for debugging */
  rawOutput: string;
}

// ---------------------------------------------------------------------------
// Prompt builder — pure function, easy to test
// ---------------------------------------------------------------------------

export function buildTaskPrompt(input: ImplementationTaskInput): string {
  const criteria = input.acceptanceCriteria
    ? `\n\n**Acceptance Criteria:**\n${input.acceptanceCriteria}`
    : "";

  return `You are an AI software engineer implementing a code change inside a git worktree.
Your working directory is the project root of this repository.
You are on branch: ${input.branchName}

---

## Ticket

**Title:** ${input.title}

**Description:**
${input.description}${criteria}

---

## Your Task

Work through these steps in order:

1. **Analyse the ticket.** Understand what change is needed. Read relevant files. Identify the minimal set of files to touch.

2. **Inspect the codebase.** Use Read, Glob, and Grep to find the right locations. Do not guess file paths.

3. **Make the minimum correct change.** Edit or create only what the ticket requires. No refactoring beyond scope. No speculative improvements.

4. **Run validation.** After making changes, run the relevant commands (type-check, lint, existing tests if any). Fix any errors before finishing.

5. **Commit your work.** Stage and commit all changed files with a clear commit message that references the ticket title.

6. **Produce a summary.** Output a JSON block as your final message using this exact format:

\`\`\`json
{
  "outcome": "success" | "no_changes" | "error",
  "summary": "<one or two sentences describing what was done or why nothing changed>"
}
\`\`\`

Do not output the JSON block until all work is complete.

---

## Rules

- Work only inside the current working directory.
- Do not push to remote or open PRs — that is handled externally.
- If the ticket is ambiguous or you cannot determine the correct change, set outcome to "error" and explain in the summary.
- If the codebase already satisfies the ticket requirements with no changes needed, set outcome to "no_changes".
`;
}

// ---------------------------------------------------------------------------
// Result parser — extracts the JSON block from agent output
// ---------------------------------------------------------------------------

function parseAgentOutput(rawOutput: string): Pick<AgentResult, "outcome" | "summary"> {
  const match = rawOutput.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    return {
      outcome: "error",
      summary: "Agent did not produce a structured JSON result block.",
    };
  }

  try {
    const parsed = JSON.parse(match[1]) as {
      outcome?: string;
      summary?: string;
    };

    const outcome =
      parsed.outcome === "success" || parsed.outcome === "no_changes"
        ? (parsed.outcome as "success" | "no_changes")
        : "error";

    return {
      outcome,
      summary: parsed.summary ?? "No summary provided.",
    };
  } catch {
    return {
      outcome: "error",
      summary: "Agent produced a malformed JSON result block.",
    };
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs a Claude agent to implement the ticket inside the given worktree.
 *
 * The ANTHROPIC_API_KEY is read by the Agent SDK from process.env automatically.
 * It is validated at server startup in src/config/env.ts — if it's missing the
 * server will refuse to start before this function is ever called.
 */
export async function runImplementationTask(
  input: ImplementationTaskInput,
): Promise<AgentResult> {
  const prompt = buildTaskPrompt(input);
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
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        permissionMode: "acceptEdits",
        maxTurns: 30,
      },
    })) {
      if ("result" in message) {
        outputChunks.push(message.result);
        console.log(`[claude-agent] agent result received (${message.result.length} chars)`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[claude-agent] SDK error: ${message}`);
    return {
      outcome: "error",
      summary: `Agent SDK error: ${message}`,
      rawOutput: outputChunks.join("\n"),
    };
  }

  const rawOutput = outputChunks.join("\n");
  const parsed = parseAgentOutput(rawOutput);

  console.log(
    `[claude-agent] finished outcome=${parsed.outcome} summary="${parsed.summary}"`,
  );

  return { ...parsed, rawOutput };
}
