/**
 * Prompt builder for Claude ticket implementation runs.
 *
 * Kept in its own module so the prompt text can be iterated independently of
 * the agent service wiring. All functions here are pure — no I/O.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ImplementationPromptInput {
  /** Ticket title / story name */
  title: string;
  /** Full ticket description (may include @codemeai and other prose) */
  description: string;
  /** Acceptance criteria extracted from the ticket, if present */
  acceptanceCriteria?: string;
  /** Branch name — included so Claude can write a good commit message */
  branchName: string;
  /** Build command for the target repo (default: npm run build) */
  buildCmd?: string;
  /** Lint command for the target repo (default: npm run lint) */
  lintCmd?: string;
}

// ---------------------------------------------------------------------------
// Output schema (what Claude is required to return)
// ---------------------------------------------------------------------------

/** Typed representation of the JSON block Claude must produce. */
export interface AgentOutput {
  /** Machine-readable outcome */
  outcome: "success" | "no_changes" | "error";
  /** One or two sentences describing what was done */
  summary: string;
  /** Every file that was created or modified, relative to the repo root */
  files_changed: string[];
  /** Results of each validation command that was run */
  validation: Array<{
    command: string;
    passed: boolean;
    notes?: string;
  }>;
  /**
   * Any ambiguities or unresolved questions encountered.
   * Empty array when everything was clear.
   */
  open_questions: string[];
  /** Suggested PR title — imperative mood, ≤72 chars */
  suggested_pr_title: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a strict, production-oriented implementation prompt.
 *
 * The prompt is structured into four sections:
 *   1. Ticket — what needs to be done
 *   2. Constraints — what must NOT happen
 *   3. Required Workflow — ordered steps Claude must follow
 *   4. Output Format — the exact JSON schema Claude must produce
 */
export function buildImplementationPrompt(
  input: ImplementationPromptInput,
): string {
  const criteria = input.acceptanceCriteria
    ? `\n\n**Acceptance Criteria**\n${input.acceptanceCriteria}`
    : "";

  const buildCmd = input.buildCmd ?? "npm run build";
  const lintCmd = input.lintCmd ?? "npm run lint";

  return `\
You are a careful, production-aware software engineer working inside an isolated \
git worktree. Your job is to implement exactly what the ticket describes — nothing more, \
nothing less — and leave the codebase in a better state than you found it.

Working branch: \`${input.branchName}\`

---

## 1. Ticket

**Title:** ${input.title}

**Description:**
${input.description}${criteria}

---

## 2. Constraints

- **Scope lock.** Touch only the files required by this ticket. Do not refactor \
unrelated code, rename symbols, or reorganise imports outside the changed files.
- **No speculative work.** If the ticket does not ask for tests, don't add them. \
If it does not ask for documentation, don't add it.
- **No remote operations.** Do not push branches, open pull requests, or make \
network calls to external services.
- **Explain assumptions.** If you make a judgement call (e.g. choosing a file \
location, picking an interface shape), state it clearly in \`open_questions\` or \
the summary so a human reviewer can verify.
- **Stop on ambiguity.** If you cannot determine the correct change with \
confidence, set \`outcome\` to \`"error"\` and describe the ambiguity in \
\`open_questions\`.

---

## 3. Required Workflow

You MUST complete all steps in order before producing output.

### Step 1 — Inspect before editing
Use \`Read\`, \`Glob\`, and \`Grep\` to locate relevant files and understand the \
surrounding code. Do not edit any file until you have read it first.

### Step 2 — Plan the minimal change
Identify the exact set of files to create or modify. If more than three files need \
changes, verify you have not misread the scope. List your plan as a short \
comment in your reasoning before you start editing.

### Step 3 — Implement
Make the changes. After each file edit, re-read the changed section to confirm \
correctness.

### Step 4 — Run validation
After all edits are complete, run the following commands in order and record \
each result:

1. \`${buildCmd}\` — compilation must pass with zero errors.
2. \`${lintCmd}\` — linter must pass with zero errors (warnings are acceptable).

If either command fails, fix the issue and re-run before proceeding. Do NOT \
skip or ignore failures.

### Step 5 — Commit
Stage all changed files and commit with a message in this format:

\`\`\`
<type>: <imperative description>

Implements: ${input.title}
Branch: ${input.branchName}
\`\`\`

Where \`<type>\` is one of: feat, fix, chore, refactor, docs, test.

### Step 6 — Summarise changed files
List every file you created or modified, relative to the repo root.

---

## 4. Output Format

After completing all steps, output ONLY the following JSON block as your final message. \
Do not output it before finishing — it signals that you are done.

\`\`\`json
{
  "outcome": "success",
  "summary": "<one or two sentences: what was changed and why>",
  "files_changed": ["relative/path/to/file.ts"],
  "validation": [
    { "command": "${buildCmd}", "passed": true },
    { "command": "${lintCmd}", "passed": true, "notes": "<optional>" }
  ],
  "open_questions": [],
  "suggested_pr_title": "<imperative, ≤72 chars>"
}
\`\`\`

**outcome values:**
- \`"success"\` — changes were made and validation passed
- \`"no_changes"\` — the codebase already satisfies the ticket; nothing was changed
- \`"error"\` — you could not complete the task; describe why in \`summary\` and \`open_questions\`

Output nothing after the JSON block.
`;
}

// ---------------------------------------------------------------------------
// Output parser — extracts and validates the JSON block from agent output
// ---------------------------------------------------------------------------

export type ParsedAgentOutput =
  | { ok: true; data: AgentOutput }
  | { ok: false; reason: string; rawJson?: string };

export function parseAgentOutput(rawOutput: string): ParsedAgentOutput {
  // Find the LAST ```json block — Claude may emit intermediate JSON before the
  // final result block.  Using a global match and taking the last entry is more
  // robust than anchoring to end-of-string.
  const allMatches = [...rawOutput.matchAll(/```json\s*([\s\S]*?)```/g)];
  const match = allMatches.at(-1);
  if (!match) {
    return { ok: false, reason: "No JSON result block found in agent output" };
  }

  const rawJson = match[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, reason: "JSON result block could not be parsed", rawJson };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "JSON result is not an object", rawJson };
  }

  const obj = parsed as Record<string, unknown>;

  const validOutcomes = ["success", "no_changes", "error"] as const;
  if (!validOutcomes.includes(obj.outcome as never)) {
    return {
      ok: false,
      reason: `Invalid outcome value: ${String(obj.outcome)}`,
      rawJson,
    };
  }

  return {
    ok: true,
    data: {
      outcome: obj.outcome as AgentOutput["outcome"],
      summary: typeof obj.summary === "string" ? obj.summary : "No summary provided.",
      files_changed: Array.isArray(obj.files_changed)
        ? (obj.files_changed as unknown[]).filter((f): f is string => typeof f === "string")
        : [],
      validation: Array.isArray(obj.validation)
        ? (obj.validation as unknown[]).filter(
            (v): v is AgentOutput["validation"][number] =>
              typeof v === "object" && v !== null && "command" in v && "passed" in v,
          )
        : [],
      open_questions: Array.isArray(obj.open_questions)
        ? (obj.open_questions as unknown[]).filter((q): q is string => typeof q === "string")
        : [],
      suggested_pr_title:
        typeof obj.suggested_pr_title === "string" ? obj.suggested_pr_title : "",
    },
  };
}
