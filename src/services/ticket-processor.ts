import { saveRunResult, updateRunStatus } from "../db/index.js";
import type { Run } from "../db/index.js";
import type { StoryContext } from "../types/shortcut.js";

export class TicketProcessor {
  async process(run: Run, context: StoryContext): Promise<void> {
    const tag = `[ticket-processor run=${run.id} story=${context.storyId}]`;

    updateRunStatus(run.id, "running");
    console.log(`${tag} started — story="${context.name}"`);

    try {
      // TODO: fetch full story from Shortcut API
      // TODO: call Claude to generate code change
      // TODO: create git worktree, apply changes, open PR
      // TODO: post comment back to Shortcut story
      console.log(`${tag} processing not yet implemented`);

      saveRunResult(run.id, {
        summary: "Processing not yet implemented",
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
    }
  }
}

export const ticketProcessor = new TicketProcessor();
