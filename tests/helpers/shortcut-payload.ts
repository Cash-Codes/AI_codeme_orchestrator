import { createHmac } from "node:crypto";
import type { ShortcutWebhookPayload } from "../../src/types/shortcut.js";

export interface PayloadBundle {
  payload: ShortcutWebhookPayload;
  /** JSON string — send this as the raw request body so the HMAC matches. */
  body: string;
  /** Value for the Shortcut-Signature header. */
  signature: string;
}

/**
 * Compute sha256=<hex> HMAC for a raw body string.
 * Default secret matches the env.ts test default for SHORTCUT_WEBHOOK_SECRET.
 */
export function signBody(body: string, secret = "test-secret"): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Build a valid webhook payload with @codemeai in the description.
 * Pass top-level overrides to replace any field (e.g. { actions: [...] }).
 */
export function makePayload(
  overrides?: Partial<ShortcutWebhookPayload>,
): PayloadBundle {
  const payload: ShortcutWebhookPayload = {
    id: "evt-1",
    changed_at: "2026-04-10T00:00:00Z",
    version: "v1",
    actions: [
      {
        id: 101,
        entity_type: "story",
        action: "update",
        name: "Add login feature",
        changes: {
          description: {
            new: "Implement OAuth login. @codemeai\n\nbase-branch: develop",
          },
        },
      },
    ],
    ...overrides,
  };
  const body = JSON.stringify(payload);
  const signature = signBody(body);
  return { payload, body, signature };
}
