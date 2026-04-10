import { createRun, getRunByExternalTicketId } from "../db/index.js";
import type { ShortcutWebhookPayload, StoryContext } from "../types/shortcut.js";
import { findStoryAction, shouldProcessPayload } from "../utils/shortcut-filter.js";
import { shortcutService } from "./shortcut.service.js";
import { ticketProcessor } from "./ticket-processor.js";

export type EnqueueResult =
  | { skipped: true; reason: string }
  | { skipped: false; runId: number };

/**
 * Validate → filter → persist → hand off to background processor.
 * Fast-path: only DB writes happen before returning; all heavy work is async.
 *
 * Duplicate-run guard: if a run for the same story is already running or
 * completed, the new webhook is ignored (idempotency for retries).
 *
 * Description fallback: when the payload lacks a description (e.g. state-change
 * update events), the full story is fetched from the Shortcut API to check for
 * the trigger tag and populate the story context.
 */
export async function enqueueShortcutWebhook(
  payload: ShortcutWebhookPayload,
): Promise<EnqueueResult> {
  // Defensive: treat missing or empty actions as a no-op.
  if (!Array.isArray(payload.actions) || payload.actions.length === 0) {
    const reason = "Payload has no actions";
    console.log(`[shortcut-webhook] ignored — ${reason}`);
    return { skipped: true, reason };
  }

  let filter = shouldProcessPayload(payload);

  // If description is absent from the payload, attempt to fetch the full story.
  if (
    !filter.shouldProcess &&
    filter.reason.includes("API fetch required")
  ) {
    const storyAction = findStoryAction(payload);
    if (storyAction) {
      try {
        const story = await shortcutService.getStoryById(storyAction.id);
        // Re-evaluate with the fetched description injected.
        const enrichedContext: StoryContext = {
          storyId: story.id,
          name: story.name,
          description: story.description,
          workflowStateId: story.workflowStateId,
        };
        const TRIGGER_TAG = "@codemeai";
        if (!story.description.includes(TRIGGER_TAG)) {
          return {
            skipped: true,
            reason: `Story ${story.id}: description does not contain ${TRIGGER_TAG} (fetched from API)`,
          };
        }
        filter = { shouldProcess: true, reason: "trigger tag found (fetched from API)", context: enrichedContext };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[shortcut-webhook] failed to fetch story ${storyAction.id} from API: ${msg}`,
        );
        return { skipped: true, reason: `API fetch failed: ${msg}` };
      }
    }
  }

  if (!filter.shouldProcess) {
    console.log(`[shortcut-webhook] ignored — ${filter.reason}`);
    return { skipped: true, reason: filter.reason };
  }

  const { context } = filter;

  // Duplicate-run guard: skip if we already have an active or finished run.
  const existing = getRunByExternalTicketId(String(context!.storyId));
  if (existing && (existing.status === "running" || existing.status === "completed")) {
    const reason = `Story ${context!.storyId}: run ${existing.id} already ${existing.status}`;
    console.log(`[shortcut-webhook] ignored — ${reason}`);
    return { skipped: true, reason };
  }

  const run = createRun({
    external_ticket_id: String(context!.storyId),
    tool: "shortcut",
  });

  console.log(
    `[shortcut-webhook] queued run=${run.id} story=${context!.storyId} "${context!.name}"`,
  );

  // Fire-and-forget — the route responds before this resolves.
  // The processor manages its own error handling and status updates.
  ticketProcessor.process(run, context!).catch((err) =>
    console.error(
      `[shortcut-webhook] unhandled processor error for run=${run.id}:`,
      err,
    ),
  );

  return { skipped: false, runId: run.id };
}
