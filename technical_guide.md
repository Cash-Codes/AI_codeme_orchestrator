# codemeai Orchestrator - Technical Guide

---

## Table of Contents

1. [What the app does](#1-what-the-app-does)
2. [Project structure](#2-project-structure)
3. [Full request flow (diagram)](#3-full-request-flow-diagram)
4. [Backend walkthrough](#4-backend-walkthrough)
   - 4.1 [Entry point — `server.ts`](#41-entry-point--serverts)
   - 4.2 [Express app — `app.ts`](#42-express-app--appts)
   - 4.3 [Configuration — `config/env.ts`](#43-configuration--configenvts)
5. [Database layer](#5-database-layer)
   - 5.1 [Schema — `db/schema.ts`](#51-schema--dbschemats)
   - 5.2 [Client — `db/client.ts`](#52-client--dbclientts)
   - 5.3 [Run repository — `db/runs.ts`](#53-run-repository--dbrunsts)
6. [Routes and request handling](#6-routes-and-request-handling)
   - 6.1 [Webhook route — `routes/webhooks.ts`](#61-webhook-route--routeswebhooksts)
   - 6.2 [API route — `routes/api.ts`](#62-api-route--routesapits)
   - 6.3 [Debug route — `routes/debug.ts`](#63-debug-route--routesdebugts)
7. [Middleware](#7-middleware)
   - 7.1 [Signature verification — `middleware/verify-shortcut-signature.ts`](#71-signature-verification--middlewareverify-shortcut-signaturets)
8. [Services — core business logic](#8-services--core-business-logic)
   - 8.1 [Webhook service — `services/shortcut-webhook.service.ts`](#81-webhook-service--servicesshortcut-webhookservicets)
   - 8.2 [Ticket processor — `services/ticket-processor.ts`](#82-ticket-processor--servicesticket-processorts)
   - 8.3 [Claude agent — `services/claude-agent.service.ts`](#83-claude-agent--servicesclaude-agentservicets)
   - 8.4 [Shortcut service — `services/shortcut.service.ts`](#84-shortcut-service--servicesshortcutservicets)
   - 8.5 [Comment builder — `services/shortcut-comment.builder.ts`](#85-comment-builder--servicesshortcut-commentbuilderts)
9. [Clients — external API wrappers](#9-clients--external-api-wrappers)
   - 9.1 [Shortcut client — `clients/shortcut.client.ts`](#91-shortcut-client--clientsshortcutclientts)
   - 9.2 [GitHub client — `clients/github.client.ts`](#92-github-client--clientsgithubclientts)
10. [Utilities](#10-utilities)
    - 10.1 [Git worktree — `utils/git-worktree.ts`](#101-git-worktree--utilsgit-worktreets)
    - 10.2 [Git push — `utils/git-push.ts`](#102-git-push--utilsgit-pushts)
    - 10.3 [Shortcut filter — `utils/shortcut-filter.ts`](#103-shortcut-filter--utilsshortcut-filterts)
11. [Prompts and structured output](#11-prompts-and-structured-output)
    - 11.1 [Prompt builder — `prompts/implementation.ts`](#111-prompt-builder--promptsimplementationts)
    - 11.2 [Output parser](#112-output-parser)
12. [Types](#12-types)
13. [Frontend walkthrough](#13-frontend-walkthrough)
    - 13.1 [Entry point — `App.tsx`](#131-entry-point--apptsx)
    - 13.2 [Data fetching — `hooks/useRuns.ts`](#132-data-fetching--hooksuserunsts)
    - 13.3 [Components](#133-components)
14. [Docker and deployment](#14-docker-and-deployment)
    - 14.1 [Dockerfile — multi-stage build](#141-dockerfile--multi-stage-build)
    - 14.2 [Entrypoint script](#142-entrypoint-script)
    - 14.3 [Bundled plugins and skills](#143-bundled-plugins-and-skills)
    - 14.4 [Claude Code settings and agents](#144-claude-code-settings-and-agents)
15. [Testing strategy](#15-testing-strategy)
16. [Security model](#16-security-model)
17. [Key design decisions and trade-offs](#17-key-design-decisions-and-trade-offs)

---

## 1. What the app does

A developer adds `@codemeai` to a Shortcut story description and saves it. The app:

1. Receives a webhook from Shortcut with the story details
2. Verifies the webhook signature (HMAC-SHA256)
3. Filters the payload — only stories containing `@codemeai` proceed
4. Creates a database record to track the run
5. Creates an isolated git worktree and branch in the target repository
6. Spawns a Claude Code CLI process with a structured prompt
7. The Claude agent reads the codebase, implements the change, runs build and lint and commits
8. Pushes the branch to GitHub
9. Opens a pull request with a generated title and description
10. Posts a detailed completion comment back on the Shortcut story
11. Cleans up the worktree

The entire pipeline is fire-and-forget — the webhook endpoint returns immediately while the background work continues. A React dashboard polls the API every 10 seconds to display run status in real time.

When credentials are not configured, the app runs in **demo mode** — the dashboard shows fixture data and webhooks are acknowledged but not processed.

---

## 2. Project structure

```
codemeai-orchestrator/
├── src/
│   ├── server.ts                 Bootstrap: load env, init DB, start Express
│   ├── app.ts                    Express app factory + middleware
│   ├── config/
│   │   └── env.ts                Zod schema for all environment variables
│   ├── db/
│   │   ├── schema.ts             CREATE TABLE statement for runs
│   │   ├── client.ts             SQLite connection singleton (WAL mode)
│   │   ├── runs.ts               Prepared-statement CRUD for runs
│   │   └── index.ts              Re-exports + initDb()
│   ├── routes/
│   │   ├── webhooks.ts           POST /webhooks/shortcut
│   │   ├── api.ts                GET /api/runs (dashboard data)
│   │   └── debug.ts              POST /api/debug/trigger (non-prod)
│   ├── middleware/
│   │   └── verify-shortcut-signature.ts   HMAC-SHA256 webhook guard
│   ├── services/
│   │   ├── shortcut-webhook.service.ts    Filter → dedup → enqueue
│   │   ├── ticket-processor.ts            Orchestration pipeline (6 steps)
│   │   ├── claude-agent.service.ts        Claude Code CLI subprocess
│   │   ├── shortcut.service.ts            Shortcut API normalisation layer
│   │   └── shortcut-comment.builder.ts    Markdown comment formatter
│   ├── clients/
│   │   ├── shortcut.client.ts    Raw HTTP client for Shortcut API
│   │   └── github.client.ts      Raw HTTP client for GitHub API
│   ├── utils/
│   │   ├── git-worktree.ts       Create + cleanup git worktrees
│   │   ├── git-push.ts           Push via ephemeral remote (token never on disk)
│   │   └── shortcut-filter.ts    Payload validation + @codemeai detection
│   ├── prompts/
│   │   └── implementation.ts     Prompt builder + JSON output parser
│   ├── types/
│   │   └── shortcut.ts           Webhook payload interfaces
│   └── fixtures/
│       └── runs.ts               15 mock runs for demo mode
├── frontend/
│   └── src/
│       ├── App.tsx               Root layout: sidebar + stats + filters + table
│       ├── hooks/useRuns.ts      Fetch + poll + abort logic
│       ├── components/
│       │   ├── Sidebar.tsx       Navigation + theme toggle
│       │   ├── StatsCards.tsx    4-card summary row
│       │   ├── FiltersBar.tsx    Date / branch / status dropdowns
│       │   ├── RunsTable.tsx     Table header + row grid
│       │   ├── RunRow.tsx        Expandable row with details panel
│       │   └── StatusBadge.tsx   Colour-coded status indicator
│       └── types.ts              Shared Run / Filters / RunStats types
├── docker/
│   ├── entrypoint.sh             Login check → start server
│   └── claude/
│       ├── plugins/              Superpowers plugin (bundled at build time)
│       └── skills/               frontend-design skill (bundled at build time)
├── tests/
│   ├── unit/                     Pure function tests (no I/O)
│   ├── integration/              HTTP + database tests
│   └── helpers/                  Payload builders + signature utilities
├── scripts/
│   └── seed.ts                   Load fixture data into local DB
├── Dockerfile                    3-stage build: frontend → backend → runtime
├── biome.json                    Linter + formatter config
├── tsconfig.json                 Strict TypeScript (ES2022, NodeNext)
└── vitest.config.ts              Test runner (Node env, V8 coverage)
```

**Why this layout?** Each directory has exactly one job. `routes/` handles HTTP. `services/` holds business logic with no HTTP awareness. `clients/` wraps external APIs. `utils/` provides pure or near-pure helpers. A service never imports from a route; a utility never imports from a service. This makes each module independently testable.

---

## 3. Full request flow (diagram)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant SC as Shortcut
    participant MW as Signature Middleware
    participant WH as Webhook Service
    participant DB as SQLite
    participant TP as Ticket Processor
    participant WT as Git Worktree
    participant Claude as Claude Code CLI
    participant GH as GitHub API
    participant Dash as React Dashboard

    Dev->>SC: Adds @codemeai to story description, saves
    SC->>MW: POST /webhooks/shortcut (HMAC signed)
    MW->>MW: Verify Clubhouse-Signature header
    MW->>WH: Payload passes → enqueueShortcutWebhook()
    WH->>WH: shouldProcessPayload() — check for @codemeai
    WH->>DB: createRun(storyId, status=pending)
    WH-->>SC: 200 OK { received: true, runId: 1 }

    Note over TP: fire-and-forget — runs in background

    WH->>TP: ticketProcessor.process(run, context)
    TP->>WT: prepareWorktreeForTicket()
    WT->>WT: git worktree add -b codemeai/shortcut-123
    TP->>DB: updateRunWorktree(id, branch, path)
    TP->>DB: updateRunStatus(id, "running")
    TP->>Claude: spawn claude --print --max-turns 80
    Note over Claude: Reads code, plans, implements,<br/>runs build + lint, commits
    Claude-->>TP: stdout JSON { outcome, summary, files_changed, ... }
    TP->>DB: saveRunResult(id, summary, status)

    alt outcome = success
        TP->>GH: pushBranch() via ephemeral remote
        TP->>GH: createPullRequest(title, body)
        TP->>DB: updateRunPr(id, prUrl)
        TP->>SC: createStoryComment(success markdown)
    else outcome = error
        TP->>SC: createStoryComment(failure markdown)
    end

    TP->>WT: cleanupWorktree() — always runs (finally block)

    loop Every 10 seconds
        Dash->>DB: GET /api/runs
        DB-->>Dash: Runs list + stats
        Dash->>Dash: Re-render table
    end
```

---

## 4. Backend walkthrough

### 4.1 Entry point — `server.ts`

**File:** `src/server.ts`

The application bootstrap. Four lines of meaningful work:

```typescript
import "dotenv/config";       // 1. Load .env into process.env
import app from "./app.js";
import { config } from "./config/env.js";
import { initDb } from "./db/index.js";

initDb();                     // 2. Create tables if they don't exist

app.listen(config.PORT, () => {
  if (config.DEMO_MODE) {    // 3. Warn if running without real credentials
    console.warn("⚠️  DEMO MODE — credentials not configured...");
  }
  console.log(`Server listening on port ${config.PORT}`);  // 4. Ready
});
```

`import "dotenv/config"` is a side-effect import — it runs immediately and populates `process.env` before anything else imports `config`. This ordering matters because `env.ts` reads `process.env` at import time through Zod's `safeParse`.

---

### 4.2 Express app — `app.ts`

**File:** `src/app.ts`

Creates the Express application and wires up all middleware and routes.

```typescript
const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;     // capture the raw bytes for HMAC
    },
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", apiRouter);          // GET /api/runs, POST /api/debug/trigger
app.use(webhooksRouter);             // POST /webhooks/shortcut

// Serve the built React SPA — must be AFTER all API routes
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});
```

**Why capture `rawBody`?** Express's `json()` middleware parses the body into a JavaScript object, but HMAC verification needs the exact bytes that were sent over the wire. The `verify` callback fires before parsing and stores the raw `Buffer` on the request object. The signature middleware reads it back later.

**Why is the SPA catch-all last?** The `*` route matches every path. If it were before the API routes, `GET /api/runs` would serve `index.html` instead of JSON. Express evaluates routes in registration order, so API routes must be registered first.

---

### 4.3 Configuration — `config/env.ts`

**File:** `src/config/env.ts`

Every environment variable is declared in a single Zod schema. Zod validates the type, applies defaults and throws a readable error if anything is wrong — the server refuses to start rather than failing later with a confusing `undefined` somewhere deep in the code.

```typescript
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  SHORTCUT_API_TOKEN: isTest ? z.string().default("test-token") : z.string().default(""),
  // ... more fields
});
```

**Test defaults:** When `NODE_ENV=test`, every credential field gets a safe default value. This means tests never need a `.env` file or real tokens.

**Demo mode:**

```typescript
const DEMO_MODE =
  !parsed.data.SHORTCUT_API_TOKEN ||
  !parsed.data.GITHUB_TOKEN ||
  !parsed.data.GIT_REPO_PATH;
```

If any of these three are empty, `DEMO_MODE` is `true`. The API returns fixture data and webhooks are acknowledged but not processed. This lets the UI work completely standalone.

---

## 5. Database layer

### 5.1 Schema — `db/schema.ts`

**File:** `src/db/schema.ts`

A single table tracks every run from creation to completion:

```sql
CREATE TABLE IF NOT EXISTS runs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  external_ticket_id TEXT    NOT NULL,
  tool               TEXT    NOT NULL DEFAULT 'shortcut',
  status             TEXT    NOT NULL DEFAULT 'pending',
  branch_name        TEXT,
  worktree_path      TEXT,
  pr_target_branch   TEXT,
  pr_url             TEXT,
  story_url          TEXT,
  summary            TEXT,
  error_message      TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

**Why SQLite?** The app is single-process and single-node. SQLite eliminates the need for a database server, connection pools, or network latency. Reads are effectively free (microseconds). Writes go through a single writer lock, which is fine because runs are infrequent (one every few minutes at most).

**Status lifecycle:**

```
pending → running → completed
                  → failed
```

A run starts as `pending` when the webhook is received, transitions to `running` when the agent starts and ends as `completed` or `failed`.

---

### 5.2 Client — `db/client.ts`

**File:** `src/db/client.ts`

Creates a single `better-sqlite3` database instance with WAL (Write-Ahead Logging) enabled:

```typescript
import Database from "better-sqlite3";
import { config } from "../config/env.js";

export const db = new Database(config.DATABASE_URL.replace("file:", ""));
db.pragma("journal_mode = WAL");
```

**What is WAL?** SQLite's default journal mode locks the entire database during writes. WAL mode allows readers and writers to operate concurrently — readers see a consistent snapshot while a write is in progress. This matters because the frontend polls `GET /api/runs` every 10 seconds while the ticket processor may be writing status updates.

---

### 5.3 Run repository — `db/runs.ts`

**File:** `src/db/runs.ts`

Every database query is a pre-compiled **prepared statement**. Prepared statements are parsed once when the module loads and executed many times with different parameters. This is faster than re-parsing SQL on every call and prevents SQL injection — parameters are always bound, never interpolated into the query string.

```typescript
const insertRun = db.prepare<[string, string, string, string]>(`
  INSERT INTO runs (external_ticket_id, tool, pr_target_branch, story_url)
  VALUES (?, ?, ?, ?)
`);

export function createRun(input: CreateRunInput): Run {
  const info = insertRun.run(
    input.external_ticket_id,
    input.tool,
    input.pr_target_branch,
    input.story_url,
  );
  return getRunById(Number(info.lastInsertRowid))!;
}
```

**Why return the full row after insert?** The caller needs the `id` (auto-generated), `created_at` (auto-generated) and `status` (defaulted). Rather than constructing these in JavaScript, we read them back from the database — the single source of truth.

**Key functions:**

| Function | SQL | Purpose |
|---|---|---|
| `createRun()` | INSERT | Create a new run, return full record |
| `getRunById(id)` | SELECT WHERE id = ? | Fetch one run |
| `getRunByExternalTicketId(ticketId)` | SELECT WHERE external_ticket_id = ? ORDER BY id DESC LIMIT 1 | Duplicate guard — find the latest run for a story |
| `updateRunStatus(id, status)` | UPDATE SET status, updated_at | Transition lifecycle |
| `updateRunWorktree(id, branch, path)` | UPDATE SET branch_name, worktree_path | Record git details after worktree creation |
| `saveRunResult(id, result)` | UPDATE SET summary, error_message, status | Record final outcome |
| `updateRunPr(id, prUrl)` | UPDATE SET pr_url | Link the GitHub PR |
| `listRuns()` | SELECT * ORDER BY id DESC | Dashboard query |

---

## 6. Routes and request handling

### 6.1 Webhook route — `routes/webhooks.ts`

**File:** `src/routes/webhooks.ts`

A single endpoint that receives Shortcut webhooks:

```typescript
router.post(
  "/webhooks/shortcut",
  verifyShortcutSignature,          // middleware: reject unsigned requests
  async (req: Request, res: Response) => {
    const payload = req.body as ShortcutWebhookPayload;
    const result = await enqueueShortcutWebhook(payload);

    if (result.skipped) {
      res.json({ received: true, skipped: true, reason: result.reason });
      return;
    }
    res.json({ received: true, runId: result.runId });
  },
);
```

**Why respond before processing?** Shortcut expects a response within seconds. The actual implementation can take minutes. The webhook handler validates, filters and persists a run record, then hands off to the ticket processor as a fire-and-forget `Promise`. The response goes back to Shortcut immediately.

---

### 6.2 API route — `routes/api.ts`

**File:** `src/routes/api.ts`

Serves the dashboard data:

```
GET /api/runs?date=today&status=completed&target_branch=main
```

**Query parameters:**

| Parameter | Values | Default |
|---|---|---|
| `date` | `all`, `today`, `7d`, `30d` | `all` |
| `status` | `all`, `pending`, `running`, `completed`, `failed` | `all` |
| `target_branch` | `all`, or any branch name | `all` |

**Response shape:**

```typescript
{
  runs: Run[],                    // filtered list
  total: number,                  // count of filtered runs
  stats: {                        // UNFILTERED stats (always full picture)
    total: number,
    running: number,
    completed: number,
    failed: number,
  },
  targetBranches: string[],       // distinct branches for the dropdown
}
```

**Why are stats unfiltered?** The stats cards at the top of the dashboard should always show the global picture. If you filter to "failed only", you still want to see how many runs are running or completed. Only the table rows change when filters are applied.

**Demo mode:** When `DEMO_MODE` is true, this endpoint returns `MOCK_RUNS` from the fixtures module instead of querying the database. The fixture data contains 15 runs with realistic timestamps, statuses, branches and summaries.

---

### 6.3 Debug route — `routes/debug.ts`

**File:** `src/routes/debug.ts`

Only mounted when `NODE_ENV !== "production"`. Two modes:

**Dry run** (`dryRun: true`):
1. Fetches the story from Shortcut API
2. Builds the implementation prompt
3. Returns the prompt text as JSON
4. No database record, no agent, no code changes

This is useful for inspecting and iterating on the prompt without spending Claude turns.

**Full run** (`dryRun: false` or omitted):
1. Fetches the story
2. Creates a run record
3. Hands off to the ticket processor (same path as a real webhook)
4. Returns immediately with the run ID

---

## 7. Middleware

### 7.1 Signature verification — `middleware/verify-shortcut-signature.ts`

**File:** `src/middleware/verify-shortcut-signature.ts`

Every Shortcut webhook is signed with an HMAC-SHA256 hash. The middleware verifies this to ensure the request genuinely came from Shortcut and was not tampered with in transit.

```typescript
export function verifyShortcutSignature(req, res, next) {
  // 1. Read the signature header (Shortcut sends "Clubhouse-Signature")
  const signature =
    req.headers["shortcut-signature"] ?? req.headers["clubhouse-signature"];

  if (!signature) {
    res.status(401).json({ error: "Missing Shortcut-Signature header" });
    return;
  }

  // 2. Compute what the signature SHOULD be
  const expected = createHmac("sha256", config.SHORTCUT_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  // 3. Compare using timing-safe equality
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}
```

**Why `timingSafeEqual` instead of `===`?** A regular string comparison returns `false` as soon as it hits the first mismatched character. An attacker could measure how long the comparison takes to determine how many leading characters they got right. `timingSafeEqual` always takes the same amount of time regardless of where the mismatch occurs — it prevents timing attacks.

**Why check both header names?** Shortcut was previously called Clubhouse. Their API still sends the signature under `Clubhouse-Signature`. Checking both headers ensures compatibility regardless of when they update.

---

## 8. Services — core business logic

### 8.1 Webhook service — `services/shortcut-webhook.service.ts`

**File:** `src/services/shortcut-webhook.service.ts`

The decision layer between receiving a webhook and starting work. It answers: "Should we process this webhook and if so, how?"

```typescript
export async function enqueueShortcutWebhook(
  payload: ShortcutWebhookPayload,
): Promise<EnqueueResult> {
  // Gate 1: Demo mode
  if (config.DEMO_MODE) return { skipped: true, reason: "Demo mode" };

  // Gate 2: Payload has actions
  if (!payload.actions?.length) return { skipped: true, reason: "No actions" };

  // Gate 3: Contains @codemeai in description
  let filter = shouldProcessPayload(payload);

  // Gate 3b: If description not in payload, fetch from API
  if (!filter.shouldProcess && filter.reason.includes("API fetch required")) {
    const story = await shortcutService.getStoryById(storyAction.id);
    if (!story.description.includes("@codemeai")) {
      return { skipped: true, reason: "No trigger tag (fetched from API)" };
    }
    // Re-evaluate with enriched context
    filter = { shouldProcess: true, context: enrichedContext };
  }

  // Gate 4: Duplicate guard
  const existing = getRunByExternalTicketId(String(context.storyId));
  if (existing) {
    return { skipped: true, reason: `Run ${existing.id} already ${existing.status}` };
  }

  // All gates passed — create run and start processing
  const run = createRun({ ... });
  ticketProcessor.process(run, context).catch(console.error);
  return { skipped: false, runId: run.id };
}
```

**Four gates, evaluated in order:**

| Gate | What it checks | Why |
|---|---|---|
| Demo mode | Are credentials configured? | Don't process webhooks without real API access |
| Actions present | Does the payload contain any story actions? | Shortcut sends many event types (comments, epics, etc.) — most are irrelevant |
| Trigger tag | Does the story description contain `@codemeai`? | Only stories explicitly tagged should trigger agent runs |
| Duplicate guard | Is there already a run for this story? | Prevent processing the same story multiple times |

**Description fallback:** When a developer moves a story to a different column (a state change), Shortcut sends a webhook with the story ID but not the description. The filter detects this (`"API fetch required"`) and fetches the full story from the Shortcut API to check for the trigger tag.

**Fire-and-forget:** `ticketProcessor.process()` returns a `Promise`, but the webhook service does not `await` it. The `.catch(console.error)` prevents unhandled rejection crashes. The ticket processor manages its own error handling and status updates internally.

---

### 8.2 Ticket processor — `services/ticket-processor.ts`

**File:** `src/services/ticket-processor.ts`

The orchestration engine. This is the longest service and the most important — it coordinates every step from receiving a filtered webhook to posting the result on Shortcut.

**Pipeline overview:**

```typescript
class TicketProcessor {
  async process(run: Run, context: StoryContext): Promise<void> {
    try {
      // Step 1: Create isolated workspace
      const { branchName, worktreePath } = prepareWorktreeForTicket("shortcut", context.storyId);
      updateRunWorktree(run.id, branchName, worktreePath);
      updateRunStatus(run.id, "running");

      // Step 2: Run the Claude agent
      const result = await runImplementationTask({
        title: context.name,
        description: context.description,
        worktreePath,
        branchName,
      });

      // Step 3: Save outcome to DB
      saveRunResult(run.id, {
        summary: result.summary,
        status: result.outcome === "success" ? "completed" : "failed",
        error_message: result.outcome === "error" ? result.summary : null,
      });

      // Step 4: Post comment to Shortcut
      const comment = result.outcome === "success"
        ? buildSuccessComment({ ... })
        : buildFailureComment({ reason: result.summary });
      await shortcutService.createStoryComment(context.storyId, comment);

      // Step 5: Push branch and open PR (success only)
      if (result.outcome === "success") {
        pushBranch({ worktreePath, branchName, ... });
        const pr = await githubClient.createPullRequest({ ... });
        updateRunPr(run.id, pr.html_url);
      }
    } finally {
      // Step 6: Always clean up
      cleanupWorktree(worktreePath, branchName);
    }
  }
}
```

**Why a class?** The `TicketProcessor` is a singleton that holds injected dependencies (the Shortcut service, the GitHub client). This makes it testable — integration tests mock the processor entirely, avoiding real API calls and file system changes.

**Why `finally`?** If the agent crashes, the push fails, or the PR creation throws — the worktree must still be cleaned up. The `finally` block runs regardless of how the `try` block exits. Without it, failed runs would leave orphaned worktrees and branches accumulating on disk.

**Comment structure (success):**

```markdown
✅ Implementation complete

Scaffolded a React + TypeScript project and implemented a login page...

**Files touched**
- src/components/LoginPage.tsx
- src/components/Input.tsx

**Validation**
- ✓ npm run build
- ✓ npm run lint

**Branch:** `codemeai/shortcut-26`
**PR:** https://github.com/org/repo/pull/42

— codemeai
```

---

### 8.3 Claude agent — `services/claude-agent.service.ts`

**File:** `src/services/claude-agent.service.ts`

Spawns the Claude Code CLI as a child process and collects its output.

```typescript
export async function runImplementationTask(
  input: ImplementationTaskInput,
): Promise<AgentResult> {
  const prompt = buildImplementationPrompt({ ... });

  return new Promise((resolve) => {
    const proc = spawn(
      "claude",
      [
        "--print",                              // non-interactive mode
        "--max-turns", "80",                    // safety limit
        "--allowedTools", "Read,Write,Edit,Glob,Grep,Bash",  // pre-approved tools
      ],
      { cwd: input.worktreePath, env: process.env },
    );

    // Pipe the prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Collect output
    const stdoutChunks: string[] = [];
    proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk.toString()));

    proc.on("close", (code) => {
      const rawOutput = stdoutChunks.join("");
      if (code !== 0) {
        resolve({ outcome: "error", summary: `CLI exited with code ${code}`, rawOutput });
        return;
      }
      const parsed = parseAgentOutput(rawOutput);
      if (!parsed.ok) {
        resolve({ outcome: "error", summary: parsed.reason, rawOutput });
        return;
      }
      resolve({ outcome: parsed.data.outcome, summary: parsed.data.summary, structured: parsed.data, rawOutput });
    });
  });
}
```

**Key CLI flags:**

| Flag | Purpose |
|---|---|
| `--print` | Non-interactive mode — no terminal UI, output goes to stdout |
| `--max-turns 80` | Safety limit — prevents infinite loops if the agent gets stuck |
| `--allowedTools` | Pre-approves these tools so the agent doesn't ask for permission interactively |

**Why pass the prompt via stdin?** Claude Code CLI accepts a prompt as a command-line argument or via stdin. The implementation prompt can be thousands of characters long — exceeding shell argument length limits on some systems. Piping via stdin has no length limit.

**Why `--allowedTools`?** Without this flag, the CLI would prompt for permission before each tool use. In `--print` mode there is no terminal to prompt — the agent would simply fail. Pre-approving the tools lets it work headlessly.

**Auth:** The CLI reads credentials from `/root/.claude/.credentials.json` (OAuth token) or the `ANTHROPIC_API_KEY` environment variable. The service does not handle auth — it relies on the CLI's own credential resolution.

---

### 8.4 Shortcut service — `services/shortcut.service.ts`

**File:** `src/services/shortcut.service.ts`

A thin normalisation layer between the raw Shortcut HTTP client and the rest of the app.

The Shortcut API returns `snake_case` fields like `workflow_state_id` and `story_type`. The service maps these to `camelCase` TypeScript interfaces (`workflowStateId`, `storyType`) so the rest of the codebase uses a single naming convention.

```typescript
class ShortcutService {
  constructor(private client: ShortcutClient) {}

  async getStoryById(storyId: number): Promise<Story> {
    const raw = await this.client.getStory(storyId);
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      storyType: raw.story_type,
      workflowStateId: raw.workflow_state_id,
      appUrl: raw.app_url,
    };
  }

  async createStoryComment(storyId: number, text: string): Promise<Comment> {
    const raw = await this.client.createComment(storyId, text);
    return {
      id: raw.id,
      storyId: raw.story_id,
      text: raw.text,
      createdAt: raw.created_at,
    };
  }
}
```

**Why a separate service and client?** The client deals with HTTP (headers, URLs, status codes). The service deals with domain mapping (field names, types). If Shortcut changes their API response format, only the service changes — the client and the rest of the app stay the same.

---

### 8.5 Comment builder — `services/shortcut-comment.builder.ts`

**File:** `src/services/shortcut-comment.builder.ts`

Pure functions that format Markdown comments for Shortcut stories. Three templates:

**`buildSuccessComment`** — agent completed successfully:
- Summary of what was done
- List of files touched
- Validation results (build ✓, lint ✓)
- Open questions from the agent
- Branch name and PR link

**`buildFailureComment`** — agent encountered an error:
- Error reason
- Branch name (for manual inspection)

**`buildNoChangesComment`** — agent determined no code changes were needed:
- Explanation
- Branch name

Each function takes a typed parameter object and returns a string. No I/O, no side effects — easy to test and preview.

---

## 9. Clients — external API wrappers

### 9.1 Shortcut client — `clients/shortcut.client.ts`

**File:** `src/clients/shortcut.client.ts`

Low-level HTTP client for the Shortcut API. Handles authentication and error responses.

```typescript
class ShortcutClient {
  constructor(private baseUrl: string, private token: string) {}

  async getStory(storyId: number): Promise<ShortcutStoryRaw> {
    const res = await fetch(`${this.baseUrl}/stories/${storyId}`, {
      headers: { "Shortcut-Token": this.token },
    });
    if (!res.ok) throw new Error(`Shortcut API ${res.status}`);
    return res.json();
  }

  async createComment(storyId: number, text: string): Promise<ShortcutCommentRaw> {
    const res = await fetch(`${this.baseUrl}/stories/${storyId}/comments`, {
      method: "POST",
      headers: {
        "Shortcut-Token": this.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Shortcut API ${res.status}`);
    return res.json();
  }
}
```

**Auth:** The `Shortcut-Token` header carries the API token. This is Shortcut's standard authentication mechanism — simpler than OAuth, appropriate for server-to-server calls.

---

### 9.2 GitHub client — `clients/github.client.ts`

**File:** `src/clients/github.client.ts`

Creates pull requests via the GitHub REST API:

```typescript
class GitHubClient {
  constructor(private token: string) {}

  async createPullRequest(input: PullRequestInput): Promise<PullRequest> {
    const res = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: input.title,
          head: input.head,      // source branch
          base: input.base,      // target branch
          body: input.body,      // PR description
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    return res.json();
  }
}
```

**Why `X-GitHub-Api-Version`?** GitHub's REST API is versioned. Pinning to a specific version prevents breaking changes from affecting the app when GitHub releases a new API version.

**Token scope:** The `GITHUB_TOKEN` must have the `repo` scope to push branches and create pull requests. A token with only read access will fail with a 403 at push time.

---

## 10. Utilities

### 10.1 Git worktree — `utils/git-worktree.ts`

**File:** `src/utils/git-worktree.ts`

**What is a git worktree?** A worktree is a separate working directory linked to the same repository. It has its own branch and index (staging area), but shares the same `.git` history. Changes in one worktree don't affect another.

**Why use worktrees?** The agent modifies files, runs build commands and commits. If it worked directly on the main checkout, it would interfere with any other work in progress. A worktree provides complete isolation — the main branch is never touched.

```typescript
export function prepareWorktreeForTicket(tool: string, ticketId: number) {
  const branchName = `codemeai/${tool}-${ticketId}`;
  const worktreePath = path.join(config.WORKTREE_BASE_DIR, `${tool}-${ticketId}`);

  execSync(
    `git worktree add --no-track -b ${branchName} ${worktreePath} HEAD`,
    { cwd: config.GIT_REPO_PATH },
  );

  return { branchName, worktreePath };
}
```

**`--no-track`** prevents the new branch from tracking a remote. The agent works locally; pushing is handled separately.

**`-b`** creates the branch. If a branch with that name already exists (from a previous failed run that wasn't cleaned up), the command fails. The ticket processor catches this and reports the error.

**Cleanup:**

```typescript
export function cleanupWorktree(worktreePath: string, branchName: string) {
  try {
    execSync(`git worktree remove --force ${worktreePath}`, { cwd: config.GIT_REPO_PATH });
  } catch { /* log and continue */ }
  try {
    execSync(`git branch -D ${branchName}`, { cwd: config.GIT_REPO_PATH });
  } catch { /* log and continue */ }
}
```

Both operations are wrapped in `try/catch` because cleanup runs in a `finally` block — it must never throw or it would mask the original error.

---

### 10.2 Git push — `utils/git-push.ts`

**File:** `src/utils/git-push.ts`

Pushes a branch to GitHub using an ephemeral remote. The GitHub token is embedded in the remote URL and the remote is deleted immediately after the push.

```typescript
export function pushBranch(input: PushBranchInput) {
  const remoteName = `codemeai-push-${Date.now()}`;
  const remoteUrl = `https://x-access-token:${input.token}@github.com/${input.owner}/${input.repo}.git`;

  try {
    execSync(`git remote add ${remoteName} ${remoteUrl}`, { cwd: input.worktreePath });
    execSync(`git push ${remoteName} ${input.branch}:${input.branch}`, { cwd: input.worktreePath });
  } finally {
    try {
      execSync(`git remote remove ${remoteName}`, { cwd: input.worktreePath });
    } catch { /* swallow — best effort cleanup */ }
  }
}
```

**Why an ephemeral remote?** The token must never be written to `~/.gitconfig` or the repository's `.git/config` — that would leak credentials to the worktree. Using a temporary remote with a unique name (timestamp-based) ensures the token exists only for the duration of the push and is deleted in the `finally` block regardless of success or failure.

**`x-access-token`** is GitHub's convention for authenticating HTTPS git operations with a personal access token. The username `x-access-token` is arbitrary — GitHub ignores it and uses only the password (the token).

---

### 10.3 Shortcut filter — `utils/shortcut-filter.ts`

**File:** `src/utils/shortcut-filter.ts`

Pure functions that inspect a Shortcut webhook payload and decide whether to process it. No I/O, no database calls — fully testable in isolation.

**`shouldProcessPayload(payload)`** — the main decision function:

```typescript
export function shouldProcessPayload(payload): FilterResult {
  // Rule 1: Must have a non-delete story action
  const storyAction = findStoryAction(payload);
  if (!storyAction) return { shouldProcess: false, reason: "No story action" };

  // Rule 2: Must be able to extract context (id + name + description)
  const context = extractStoryContext(storyAction, payload.references);
  if (!context) return { shouldProcess: false, reason: "API fetch required" };

  // Rule 3: Description must contain the trigger tag
  if (!context.description.includes("@codemeai")) {
    return { shouldProcess: false, reason: "No trigger tag" };
  }

  return { shouldProcess: true, reason: "Trigger tag found", context };
}
```

**`extractStoryContext(action, references)`** — resolves the story description from the webhook payload:

Shortcut webhooks have two places where the description might be:
- `action.description` — present on **create** events
- `action.changes.description.new` — present on **update** events that modified the description

If neither is present (e.g. a workflow state change), the function returns `undefined` and the caller falls back to the Shortcut API.

**`parseBaseBranch(description)`** — extracts an optional directive from the story:

```
base-branch: develop
```

If present, the PR will target that branch instead of the default (`main`). This lets developers control the PR target from within the Shortcut story itself.

---

## 11. Prompts and structured output

### 11.1 Prompt builder — `prompts/implementation.ts`

**File:** `src/prompts/implementation.ts`

The prompt is the contract between the orchestrator and the Claude agent. It tells the agent exactly what to implement, what constraints to follow and what format to return.

**Structure:**

| Section | Purpose |
|---|---|
| **1. Ticket** | Title, description, acceptance criteria |
| **2. Constraints** | Scope lock, no speculative work, no remote ops, explain assumptions, stop on ambiguity |
| **3. Required Workflow** | Inspect → Plan → Implement → Validate → Commit → Summarise |
| **4. Output Format** | Exact JSON schema the agent must produce |

**Constraints section — why each rule exists:**

- **Scope lock:** Without this, the agent tends to "improve" unrelated code it encounters while reading. This creates noisy PRs that mix the requested change with unsolicited refactoring.
- **No speculative work:** The agent will add tests, documentation and CI config if not told not to. This wastes turns and produces changes the developer didn't ask for.
- **No remote operations:** The agent should never push or make API calls. The orchestrator handles all remote operations after the agent finishes.
- **Stop on ambiguity:** If the ticket is unclear, it's better to report the ambiguity than to guess. The agent sets `outcome: "error"` and describes the problem in `open_questions`.

**Validation step:**

```
### Step 4 — Run validation
1. npm run build — compilation must pass with zero errors.
2. npm run lint — linter must pass with zero errors.

If either command fails, fix the issue and re-run before proceeding.
```

This is the most important constraint. Without it, the agent would commit code that doesn't compile. The prompt instructs the agent to fix failures iteratively until both commands pass.

---

### 11.2 Output parser

The agent's last message must contain a JSON block:

```json
{
  "outcome": "success",
  "summary": "Implemented login page with email/password validation",
  "files_changed": ["src/LoginPage.tsx", "src/Input.tsx"],
  "validation": [
    { "command": "npm run build", "passed": true },
    { "command": "npm run lint", "passed": true }
  ],
  "open_questions": [],
  "suggested_pr_title": "feat: add login page with form validation"
}
```

**`parseAgentOutput(rawOutput)`** finds the last `` ```json `` block in the output (the agent may emit intermediate JSON during its work), parses it and validates the structure:

```typescript
export function parseAgentOutput(rawOutput: string): ParsedAgentOutput {
  const allMatches = [...rawOutput.matchAll(/```json\s*([\s\S]*?)```/g)];
  const match = allMatches.at(-1);  // last block = final result
  if (!match) return { ok: false, reason: "No JSON result block found" };

  const parsed = JSON.parse(match[1].trim());

  // Validate outcome is one of the expected values
  if (!["success", "no_changes", "error"].includes(parsed.outcome)) {
    return { ok: false, reason: `Invalid outcome: ${parsed.outcome}` };
  }

  return { ok: true, data: parsed };
}
```

**Why the last block?** The agent often emits JSON snippets during planning or debugging. The prompt instructs it to output the final result block only when all work is complete. Taking the last block ensures we get the final answer, not an intermediate plan.

---

## 12. Types

**File:** `src/types/shortcut.ts`

Defines the TypeScript interfaces for Shortcut webhook payloads.

**Key interfaces:**

```typescript
interface ShortcutWebhookPayload {
  id: string;                          // unique event ID
  changed_at: string;                  // ISO 8601 timestamp
  version: string;                     // always "v1"
  actions: ShortcutAction[];           // what changed
  references?: ShortcutReference[];    // linked entities (workflow states, etc.)
}

interface ShortcutAction {
  id: number;                          // entity ID (story, comment, etc.)
  entity_type: string;                 // "story", "story-comment", "epic"
  action: "create" | "update" | "delete";
  name?: string;                       // entity name
  description?: string;                // present on create events
  changes?: {                          // present on update events
    description?: { new?: string; old?: string };
    workflow_state_id?: { new?: number; old?: number };
    name?: { new?: string; old?: string };
  };
}

interface StoryContext {
  storyId: number;
  name: string;
  description: string;
  workflowStateId?: number;
  workflowStateName?: string;
  baseBranch?: string;                 // parsed from description if present
}
```

**Why both `description` and `changes.description.new`?** Shortcut's webhook format differs between create and update events. On a create event, the description is a top-level field. On an update event, only the changed fields appear under `changes` — each with `new` and `old` values. The filter logic checks both locations.

---

## 13. Frontend walkthrough

### 13.1 Entry point — `App.tsx`

**File:** `frontend/src/App.tsx`

The root component. Manages global state (theme, filters) and composes the layout.

```tsx
function App() {
  const [isDark, setIsDark] = useState(() =>
    localStorage.getItem("theme") === "dark"
  );
  const [filters, setFilters] = useState<Filters>({
    date: "all",
    target_branch: "all",
    status: "all",
  });

  const { data, loading } = useRuns(filters);

  return (
    <div className={isDark ? "dark" : ""}>
      <Sidebar isDark={isDark} onToggle={() => setIsDark(!isDark)} runningCount={...} />
      <main>
        <StatsCards stats={data?.stats} />
        <FiltersBar filters={filters} onChange={setFilters} branches={data?.targetBranches} />
        <RunsTable runs={data?.runs} total={data?.total} loading={loading} />
      </main>
    </div>
  );
}
```

**Theme persistence:** The dark mode preference is stored in `localStorage`. On first load, the component reads it back with a lazy initialiser — `useState(() => ...)` runs only once, avoiding a read on every re-render.

---

### 13.2 Data fetching — `hooks/useRuns.ts`

**File:** `frontend/src/hooks/useRuns.ts`

A custom React hook that fetches dashboard data and polls for updates.

```typescript
export function useRuns(filters: Filters) {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      const params = new URLSearchParams();
      if (filters.date !== "all") params.set("date", filters.date);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.target_branch !== "all") params.set("target_branch", filters.target_branch);

      const res = await fetch(`/api/runs?${params}`, { signal: controller.signal });
      const json = await res.json();
      setData(json);
      setLoading(false);
    }

    fetchData();                                           // initial fetch
    const interval = setInterval(fetchData, 10_000);       // poll every 10s

    return () => {
      controller.abort();                                  // cancel in-flight request
      clearInterval(interval);                             // stop polling
    };
  }, [filters]);     // re-run when filters change

  return { data, loading };
}
```

**Why poll instead of WebSockets?** Runs are infrequent (minutes apart) and the payload is small (a few KB). Polling every 10 seconds is simple, reliable and adds negligible load. WebSockets would add complexity (connection management, reconnection, state sync) for no measurable improvement.

**Why `AbortController`?** When the user changes a filter, the effect re-runs. If the previous fetch hasn't completed yet, the `AbortController` cancels it — preventing a race condition where the old response arrives after the new one and overwrites it.

---

### 13.3 Components

**`StatsCards`** — four cards showing total runs, running, completed and failed. Includes a success rate percentage. Each card has a colour-coded icon.

**`FiltersBar`** — three dropdown selectors for date range, target branch and status. An active-filter counter badge appears when any filter is not set to "all". A "clear" button resets all filters.

**`RunsTable`** — a header row with column labels and a scrollable list of `RunRow` components. Shows "No runs found" when the filtered list is empty.

**`RunRow`** — each run is a row that can be expanded by clicking. The collapsed view shows:
- Run ID (#1, #2, ...)
- Story ID with a badge linking to the Shortcut story
- PR branch name, or a link to the GitHub PR if created
- Relative timestamp ("just now", "2m ago", "1h ago")
- Status badge

The expanded view shows additional details:
- Summary text (success) or error message (failure)
- Target branch badge
- Animated expand/collapse via Framer Motion

**`StatusBadge`** — a small colour-coded label:

| Status | Colour | Indicator |
|---|---|---|
| running | amber | blinking dot |
| completed | green | solid dot |
| failed | red | solid dot |
| pending | grey | solid dot |

---

## 14. Docker and deployment

### 14.1 Dockerfile — multi-stage build

The Dockerfile uses three stages to keep the final image small:

**Stage 1: Frontend builder** (`node:22-slim`)
```dockerfile
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /app/dist/frontend (Vite builds to ../dist/frontend)
```

**Stage 2: Backend builder** (`node:22-slim` + build tools)
```dockerfile
RUN apt-get install -y python3 make g++   # needed for better-sqlite3 native bindings
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npx tsc                               # compile TypeScript to dist/
RUN npm prune --omit=dev                  # remove devDependencies
```

**Stage 3: Runtime** (`node:22-slim`)
```dockerfile
RUN apt-get install -y git ca-certificates
RUN npm install -g @anthropic-ai/claude-code

# Bundle plugins and skills
COPY docker/claude/plugins /root/.claude/plugins
COPY docker/claude/skills  /root/.claude/skills

# Write settings.json, agent configs
RUN cat > /root/.claude/settings.json << 'EOF' ...

# Copy compiled app from builder stages
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist/frontend ./dist/frontend
COPY package.json ./

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
```

**Why multi-stage?** Each stage produces intermediate images that are discarded. The final runtime image contains only what is needed to run: compiled JavaScript, production `node_modules` (with pre-built native bindings), the frontend bundle and the Claude Code CLI. TypeScript compiler, build tools, frontend dev dependencies and source files are all excluded.

**Why `node:22-slim`?** The slim variant excludes man pages, documentation and development headers. It is about 60% smaller than the full `node:22` image.

**Why `npm prune --omit=dev`?** After TypeScript compilation, devDependencies (TypeScript, Vitest, Biome, etc.) are no longer needed. Pruning them reduces the `node_modules` copied to the runtime stage. The `better-sqlite3` native bindings (compiled by `g++` during `npm ci`) survive the prune because they are a production dependency.

---

### 14.2 Entrypoint script

**File:** `docker/entrypoint.sh`

```bash
#!/bin/sh
set -e

if [ ! -f /root/.claude/.credentials.json ]; then
  echo "[entrypoint] No stored Claude credentials — running claude login"
  claude login
else
  echo "[entrypoint] Using stored Claude credentials"
fi

exec node dist/server.js
```

**Two paths:**

1. **Credentials exist** (normal runtime): skip login, start the server immediately.
2. **No credentials** (first run or expired token): run `claude login`, which opens a browser for OAuth. After login completes, the credentials are written to `/root/.claude/.credentials.json` and the server starts.

`exec` replaces the shell process with the Node process. This ensures that signals (SIGTERM from Docker stop) are delivered directly to Node, enabling graceful shutdown.

---

### 14.3 Bundled plugins and skills

Claude Code plugins and skills are Markdown files that extend the agent's capabilities. In a production container, there is no marketplace access — plugins must be bundled at build time.

**Directory structure inside the image:**

```
/root/.claude/
├── .credentials.json                     ← mounted at runtime (OAuth token)
├── settings.json                         ← permissions (written at build time)
├── agents/
│   ├── frontend-specialist.md            ← subagent for UI work
│   └── superpower-implementer.md         ← subagent for backend work
├── plugins/
│   ├── installed_plugins.json            ← registry pointing to cache paths
│   └── cache/claude-plugins-official/
│       └── superpowers/5.0.7/            ← full plugin (skills, agents, hooks)
└── skills/
    └── frontend-design/                  ← UI-focused implementation skill
```

The `installed_plugins.json` tells Claude Code where to find the superpowers plugin by pointing to its absolute path inside the container. No marketplace authentication or network access is needed at runtime.

---

### 14.4 Claude Code settings and agents

**`settings.json`** — defines which Bash commands the agent is allowed to run:

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(mkdir *)", "Bash(mv *)", "Bash(cp *)",
      "Bash(ls *)", "Bash(cat *)", "Bash(find *)",
      "Bash(grep *)", "Bash(touch *)", "Bash(chmod *)"
    ],
    "deny": [
      "Bash(git push*)",
      "Bash(rm -rf /*)",
      "Bash(curl *)", "Bash(wget *)",
      "Bash(ssh *)", "Bash(sudo *)"
    ]
  }
}
```

**Key denials:**

| Denied command | Reason |
|---|---|
| `git push*` | The orchestrator handles pushing — the agent must not push directly |
| `rm -rf /*` | Prevents catastrophic filesystem deletion (note: `rm` on specific files is still allowed) |
| `curl`, `wget` | No network exfiltration from inside the agent |
| `ssh`, `sudo` | No privilege escalation |

**Subagent definitions:** Two agent specs are baked into the image:

- **`frontend-specialist`** — invokes the `frontend-design` skill for UI work (HTML, CSS, accessibility)
- **`superpower-implementer`** — invokes `superpowers:using-superpowers` for backend work (Express, DB, pipeline)

The orchestrator does not select which subagent to use — the Claude agent itself decides based on the ticket content and available skills.

---

## 15. Testing strategy

**Test runner:** Vitest (compatible with Jest syntax, but faster with native ESM support).

**Directory structure:**

```
tests/
├── unit/
│   └── shortcut-filter.test.ts       Pure function tests
├── integration/
│   └── webhooks.test.ts              HTTP route + DB tests
└── helpers/
    └── shortcut-payload.ts           Payload builders + HMAC signing
```

**Unit tests** — no mocks, no I/O:

```typescript
describe("shouldProcessPayload", () => {
  it("returns shouldProcess=true when @codemeai is in description", () => {
    const payload = makePayload({
      actions: [{
        id: 1, entity_type: "story", action: "update",
        changes: { description: { new: "implement login @codemeai" } },
      }],
    });
    const result = shouldProcessPayload(payload.payload);
    expect(result.shouldProcess).toBe(true);
  });
});
```

**Integration tests** — real SQLite, mocked external services:

```typescript
vi.mock("../../src/db/client.js", async () => {
  const db = new Database(":memory:");   // in-memory SQLite
  db.exec(CREATE_RUNS_TABLE);
  return { db };
});

vi.mock("../../src/services/ticket-processor.js", () => ({
  ticketProcessor: { process: vi.fn().mockResolvedValue(undefined) },
}));
```

The database is real (in-memory SQLite) so SQL queries are tested against the actual schema. External services (ticket processor, Shortcut API) are mocked because:
- The ticket processor would spawn Claude and modify the filesystem
- The Shortcut API would require real credentials and network access

**Test helper — `signBody()`:**

```typescript
export function signBody(body: string, secret = "test-secret"): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
```

Generates a valid HMAC signature for test payloads. The secret matches the Zod test default in `env.ts`, so the signature middleware passes during tests.

---

## 16. Security model

| Layer | Mechanism | Protects against |
|---|---|---|
| **Webhook authentication** | HMAC-SHA256 signature verification | Forged or tampered webhooks |
| **Timing-safe comparison** | `timingSafeEqual()` for HMAC check | Timing attacks that leak valid signature bytes |
| **Credential isolation** | Ephemeral git remote (token in URL, remote deleted after push) | Token persistence on disk |
| **Agent sandboxing** | `settings.json` allow/deny lists | Agent running destructive or exfiltration commands |
| **Scope lock** | Prompt constraints ("touch only required files") | Agent making unwanted changes outside the ticket scope |
| **No remote operations** | Prompt constraint ("do not push or make network calls") | Agent bypassing the orchestrator's push/PR flow |
| **Environment secrets** | `.env` excluded from Docker build context | Secrets baked into image layers |
| **Credentials file** | `claude-credentials.json` excluded from git and Docker | OAuth token committed to repository |

---

## 17. Key design decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **Claude Code CLI over Agent SDK** | CLI supports OAuth login (Team/Max plan) — no API key or credits needed | Subprocess spawning is slower than in-process SDK; output parsing required |
| **SQLite over PostgreSQL** | Zero infrastructure — no database server, connection pool, or network | Single-writer lock; not horizontally scalable (fine for one agent at a time) |
| **Fire-and-forget webhook response** | Shortcut expects fast responses; agent runs take minutes | Dashboard polling is the only way to track progress; no WebSocket push |
| **Git worktree isolation** | Agent can freely modify files without affecting the main checkout | Worktrees must be cleaned up; stale branches accumulate on failure |
| **Ephemeral remote for push** | Token never written to disk | A new remote is created and deleted on every push |
| **HMAC verification** | Industry standard for webhook security; Shortcut signs every payload | Requires raw body capture (extra middleware in Express) |
| **10-second polling** | Simple, reliable, no WebSocket complexity | 10-second latency on status updates; minor extra server load |
| **Bundled plugins at build time** | No marketplace auth in containers; deterministic builds | Must rebuild image to update plugins |
| **Prompt-constrained agent** | Reproducible, auditable behavior; prevents scope creep | Agent cannot adapt to truly ambiguous situations without human input |
| **Demo mode with fixtures** | UI testable without any real credentials | Fixture data is static and may drift from real data shape |

---

Good luck and feel free to reach out if you need any clarification or would like to contribute further. Always happy to help. Thanks!

---

**Document Version:** 1.0
**Last Updated:** April, 2026
**Maintainer:** Cashley <cashley.dps@gmail.com>
