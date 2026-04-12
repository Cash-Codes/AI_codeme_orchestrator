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
import {
  buildFailureComment,
  buildNoChangesComment,
  buildSuccessComment,
} from "./shortcut-comment.builder.js";
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

      if (result.outcome === "error") {
        await postComment(
          context.storyId,
          buildFailureComment({ reason: result.summary, branchName }),
          tag,
        );
        return;
      }

      if (result.outcome === "no_changes") {
        if (!branchName)
          throw new Error("branchName unexpectedly undefined at no_changes");
        await postComment(
          context.storyId,
          buildNoChangesComment({ branchName }),
          tag,
        );
        return;
      }

      // outcome === "success" from here.
      const baseBranch =
        context.baseBranch ?? config.GITHUB_DEFAULT_BASE_BRANCH;
      const prTitle = result.structured?.suggested_pr_title ?? context.name;

      const successParams = {
        summary: result.summary,
        files_changed: result.structured?.files_changed ?? [],
        validation: result.structured?.validation ?? [],
        open_questions: result.structured?.open_questions ?? [],
        branchName,
      };

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
        // Run is already saved as "completed" — no prUrl means push failed.
        // Post the success comment without a PR link and exit.
        await postComment(
          context.storyId,
          buildSuccessComment({ ...successParams, prUrl: null }),
          tag,
        );
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

      // Step 5: post Shortcut comment.
      await postComment(
        context.storyId,
        buildSuccessComment({ ...successParams, prUrl }),
        tag,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${tag} failed — ${message}`);
      saveRunResult(run.id, {
        error_message: message,
        status: "failed",
      });
      await postComment(
        context.storyId,
        buildFailureComment({ reason: message, branchName }),
        tag,
      );
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

async function postComment(
  storyId: number,
  text: string,
  tag: string,
): Promise<void> {
  try {
    await shortcutService.createStoryComment(storyId, text);
    console.log(`${tag} Shortcut comment posted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} failed to post Shortcut comment: ${msg}`);
  }
}
