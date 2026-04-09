import { Router } from "express";
import type { Request, Response } from "express";
import { handleShortcutWebhook } from "../services/shortcut-webhook.service.js";
import type { ShortcutWebhookPayload } from "../types/shortcut.js";

const router = Router();

router.post("/webhooks/shortcut", async (req: Request, res: Response) => {
  const payload = req.body as ShortcutWebhookPayload;

  const eventType = payload.actions?.[0]?.action ?? "unknown";
  const storyAction = payload.actions?.find((a) => a.entity_type === "story");
  const storyId = storyAction?.id ?? null;

  console.log(
    `[webhook] shortcut event=${eventType} storyId=${storyId ?? "n/a"} hasStory=${storyAction != null}`,
  );

  // Delegate — fire-and-forget intentional at this stage.
  handleShortcutWebhook(payload).catch((err) =>
    console.error("[webhook] unhandled error in shortcut handler:", err),
  );

  res.json({ received: true });
});

export default router;
