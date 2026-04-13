import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "../config/env.js";
import { createRun } from "../db/index.js";
import { buildImplementationPrompt } from "../prompts/implementation.js";
import { shortcutService } from "../services/shortcut.service.js";
import { ticketProcessor } from "../services/ticket-processor.js";

const router = Router();

// Belt-and-suspenders: this router is only mounted in non-production (see
// app.ts), but return 403 if it is somehow reached in production.
router.use((_req, res, next) => {
  if (config.NODE_ENV === "production") {
    res
      .status(403)
      .json({ error: "Debug endpoints are disabled in production" });
    return;
  }
  next();
});

/**
 * POST /api/debug/trigger
 *
 * Manually trigger processing for a Shortcut story.
 *
 * Body:
 *   storyId  number   — Shortcut story ID to process
 *   dryRun   boolean  — (default false) when true, fetch + build prompt only;
 *                       no run record created, no code changes made
 *
 * Response (dryRun=true):
 *   { dryRun: true, storyId, story: { id, name, description }, prompt }
 *
 * Response (dryRun=false):
 *   { dryRun: false, runId, storyId }
 */
router.post("/trigger", async (req: Request, res: Response) => {
  const { storyId, dryRun = false } = req.body as {
    storyId?: unknown;
    dryRun?: unknown;
  };

  if (!Number.isInteger(storyId) || (storyId as number) <= 0) {
    res.status(400).json({ error: "storyId must be a positive integer" });
    return;
  }

  const id = storyId as number;
  const isDryRun = dryRun === true;
  const tag = `[debug storyId=${id}]`;

  console.log(`${tag} trigger received dryRun=${isDryRun}`);

  // ── Step 1: fetch story ─────────────────────────────────────────────────
  console.log(`${tag} fetching story from Shortcut...`);
  let story: Awaited<ReturnType<typeof shortcutService.getStoryById>>;
  try {
    story = await shortcutService.getStoryById(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} story fetch failed: ${msg}`);
    res.status(502).json({ error: `Failed to fetch story: ${msg}` });
    return;
  }
  console.log(`${tag} story fetched: "${story.name}" (sc-${story.id})`);

  const context = {
    storyId: story.id,
    name: story.name,
    description: story.description,
    baseBranch: config.GITHUB_DEFAULT_BASE_BRANCH,
  };

  // ── Dry-run path ────────────────────────────────────────────────────────
  if (isDryRun) {
    console.log(`${tag} dry-run: building prompt only, no code changes`);
    const branchName = `feat/sc-${story.id}-dry-run`;
    const prompt = buildImplementationPrompt({
      title: story.name,
      description: story.description,
      branchName,
      buildCmd: config.TARGET_REPO_BUILD_CMD,
      lintCmd: config.TARGET_REPO_LINT_CMD,
    });
    console.log(
      `${tag} dry-run complete — prompt built (${prompt.length} chars)`,
    );
    res.json({
      dryRun: true,
      storyId: story.id,
      story: {
        id: story.id,
        name: story.name,
        description: story.description,
      },
      prompt,
    });
    return;
  }

  // ── Full run path ───────────────────────────────────────────────────────
  console.log(`${tag} creating run record...`);
  const run = createRun({
    external_ticket_id: String(story.id),
    tool: "shortcut",
    pr_target_branch: config.GITHUB_DEFAULT_BASE_BRANCH,
    story_url: config.SHORTCUT_WORKSPACE_SLUG
      ? `https://app.shortcut.com/${config.SHORTCUT_WORKSPACE_SLUG}/story/${story.id}`
      : undefined,
  });
  console.log(`${tag} run created id=${run.id}`);

  console.log(`${tag} handing off to ticket processor (fire-and-forget)`);
  ticketProcessor
    .process(run, context)
    .catch((err) =>
      console.error(`${tag} unhandled processor error for run=${run.id}:`, err),
    );

  res.json({ dryRun: false, runId: run.id, storyId: story.id });
});

export default router;
