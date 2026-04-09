import { createRun } from "../db/index.js";
import type { ShortcutWebhookPayload } from "../types/shortcut.js";
import { shouldProcessPayload } from "../utils/shortcut-filter.js";
import { ticketProcessor } from "./ticket-processor.js";

export type EnqueueResult =
  | { skipped: true; reason: string }
  | { skipped: false; runId: number };

/**
 * Validate → filter → persist → hand off to background processor.
 * Fast-path: only DB writes happen before returning; all heavy work is async.
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

  const filter = shouldProcessPayload(payload);

  if (!filter.shouldProcess) {
    console.log(`[shortcut-webhook] ignored — ${filter.reason}`);
    return { skipped: true, reason: filter.reason };
  }

  const { context } = filter;

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
