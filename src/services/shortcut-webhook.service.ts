import { shouldProcessPayload } from "../utils/shortcut-filter.js";
import type { ShortcutWebhookPayload } from "../types/shortcut.js";

/**
 * Entry point for processing a Shortcut webhook payload.
 *
 * Currently: filters the payload and logs the outcome.
 * TODO: orchestrate AI code change when shouldProcess is true.
 */
export async function handleShortcutWebhook(
  payload: ShortcutWebhookPayload,
): Promise<void> {
  const result = shouldProcessPayload(payload);

  if (!result.shouldProcess) {
    console.log(`[shortcut-webhook] ignored — ${result.reason}`);
    return;
  }

  const { context } = result;
  console.log(
    `[shortcut-webhook] processing story ${context!.storyId} "${context!.name}"`,
  );

  // TODO: fetch full story via Shortcut API, run AI orchestration, post comment.
}
