import { saveRunResult, updateRunStatus } from "../db/index.js";
import type { Run } from "../db/index.js";
import type { StoryContext } from "../types/shortcut.js";
import {
  cleanupWorktree,
  prepareWorktreeForTicket,
} from "../utils/git-worktree.js";

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
      console.log(`${tag} worktree ready branch=${branchName}`);

      // TODO: fetch full story from Shortcut API
      // TODO: call Claude to generate code change inside worktreePath
      // TODO: commit changes, open PR
      // TODO: post comment back to Shortcut story
      console.log(`${tag} processing not yet implemented`);

      saveRunResult(run.id, {
        summary: "Worktree prepared; full processing not yet implemented",
        status: "completed",
      });
      console.log(`${tag} completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${tag} failed — ${message}`);
      saveRunResult(run.id, {
        error_message: message,
        status: "failed",
      });
    } finally {
      // Always clean up the worktree, even on failure.
      if (branchName && worktreePath) {
        cleanupWorktree(worktreePath, branchName);
      }
    }
  }
}

export const ticketProcessor = new TicketProcessor();
