import { saveRunResult, updateRunStatus } from "../db/index.js";
import type { Run } from "../db/index.js";
import type { StoryContext } from "../types/shortcut.js";
import {
  cleanupWorktree,
  prepareWorktreeForTicket,
} from "../utils/git-worktree.js";
import { runImplementationTask } from "./claude-agent.service.js";

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

      // Step 2: run Claude agent inside the worktree.
      const result = await runImplementationTask({
        title: context.name,
        description: context.description,
        worktreePath,
        branchName,
      });

      const status = result.outcome === "error" ? "failed" : "completed";

      saveRunResult(run.id, {
        summary: result.summary,
        error_message: result.outcome === "error" ? result.summary : undefined,
        status,
      });

      console.log(`${tag} ${status} — ${result.summary}`);

      // TODO: if outcome === "success", open PR and post comment to Shortcut story.
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
