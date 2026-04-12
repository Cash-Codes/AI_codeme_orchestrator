import { githubClient } from "../clients/github.client.js";
import { config } from "../config/env.js";
import {
  saveRunResult,
  updateRunPr,
  updateRunStatus,
  updateRunWorktree,
} from "../db/index.js";
import type { Run } from "../db/index.js";
import type { StoryContext } from "../types/shortcut.js";
import { pushBranch } from "../utils/git-push.js";
import {
  cleanupWorktree,
  prepareWorktreeForTicket,
} from "../utils/git-worktree.js";
import { runImplementationTask } from "./claude-agent.service.js";
import { shortcutService } from "./shortcut.service.js";

export class TicketProcessor {
  async process(run: Run, context: StoryContext): Promise<void> {
    const tag = `[ticket-processor run=${run.id} story=${context.storyId}]`;

    updateRunStatus(run.id, "running");
    console.log(`${tag} started — story="${context.name}"`);

    let branchName: string | undefined;
    let worktreePath: string | undefined;

    try {
      // Step 1: prepare isolated git worktree.
      ({ branchName, worktreePath } = prepareWorktreeForTicket(
        "shortcut",
        String(context.storyId),
      ));

      // Persist branch and worktree path so they survive restarts / debugging.
      updateRunWorktree(run.id, branchName, worktreePath);
      console.log(`${tag} worktree ready branch=${branchName}`);

      // Step 2: run Claude agent inside the worktree.
      const result = await runImplementationTask({
        title: context.name,
        description: context.description,
        worktreePath,
        branchName,
        buildCmd: config.TARGET_REPO_BUILD_CMD,
        lintCmd: config.TARGET_REPO_LINT_CMD,
      });

      const status = result.outcome === "error" ? "failed" : "completed";

      saveRunResult(run.id, {
        summary: result.summary,
        error_message: result.outcome === "error" ? result.summary : undefined,
        status,
      });

      console.log(`${tag} ${status} — ${result.summary}`);

      if (result.outcome === "success") {
        const baseBranch =
          context.baseBranch ?? config.GITHUB_DEFAULT_BASE_BRANCH;
        const prTitle = result.structured?.suggested_pr_title ?? context.name;

        // Step 3: push the branch to GitHub.
        try {
          pushBranch({
            cwd: worktreePath,
            branchName,
            owner: config.GITHUB_REPO_OWNER,
            repo: config.GITHUB_REPO_NAME,
            token: config.GITHUB_TOKEN,
          });
          console.log(`${tag} branch pushed branch=${branchName}`);
        } catch (pushErr) {
          const msg =
            pushErr instanceof Error ? pushErr.message : String(pushErr);
          console.error(`${tag} failed to push branch: ${msg}`);
          // Non-fatal for the comment — post what we can without a PR link.
          await postShortcutComment(context.storyId, result, null, tag);
          return;
        }

        // Step 4: open a pull request.
        let prUrl: string | null = null;
        try {
          const pr = await githubClient.createPullRequest({
            owner: config.GITHUB_REPO_OWNER,
            repo: config.GITHUB_REPO_NAME,
            title: prTitle,
            head: branchName,
            base: baseBranch,
            body: buildPrBody(context, result.summary, result.structured),
          });
          prUrl = pr.html_url;
          updateRunPr(run.id, prUrl);
          console.log(`${tag} PR opened #${pr.number} ${prUrl}`);
        } catch (prErr) {
          const msg = prErr instanceof Error ? prErr.message : String(prErr);
          console.error(`${tag} failed to create PR: ${msg}`);
        }

        // Step 5: post Shortcut comment (with or without PR link).
        await postShortcutComment(context.storyId, result, prUrl, tag);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${tag} failed — ${message}`);
      saveRunResult(run.id, {
        error_message: message,
        status: "failed",
      });
    } finally {
      // Always clean up the worktree.
      if (branchName && worktreePath) {
        cleanupWorktree(worktreePath, branchName);
      }
    }
  }
}

export const ticketProcessor = new TicketProcessor();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrBody(
  context: StoryContext,
  summary: string,
  structured: import("../prompts/implementation.js").AgentOutput | undefined,
): string {
  const lines: string[] = [
    "## Summary",
    summary,
    "",
    `Implements Shortcut story [#${context.storyId}](https://app.shortcut.com/${config.SHORTCUT_WORKSPACE_SLUG}/story/${context.storyId}) — _${context.name}_`,
  ];

  if (structured?.files_changed?.length) {
    lines.push("", "## Files changed");
    for (const f of structured.files_changed) {
      lines.push(`- \`${f}\``);
    }
  }

  if (structured?.open_questions?.length) {
    lines.push("", "## Open questions");
    for (const q of structured.open_questions) {
      lines.push(`- ${q}`);
    }
  }

  lines.push(
    "",
    "---",
    `_Opened automatically by [codemeai](https://github.com/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME})_`,
  );

  return lines.join("\n");
}

async function postShortcutComment(
  storyId: number,
  result: import("./claude-agent.service.js").AgentResult,
  prUrl: string | null,
  tag: string,
): Promise<void> {
  const lines = ["**codemeai:** Implementation complete.", result.summary];

  if (prUrl) {
    lines.push("", `Pull request: ${prUrl}`);
  }

  if (result.structured?.files_changed?.length) {
    lines.push(
      "",
      `Files changed:\n${result.structured.files_changed.map((f) => `- ${f}`).join("\n")}`,
    );
  }

  try {
    await shortcutService.createStoryComment(storyId, lines.join("\n"));
    console.log(`${tag} Shortcut comment posted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} failed to post Shortcut comment: ${msg}`);
  }
}
