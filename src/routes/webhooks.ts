import { Router } from "express";
import type { Request, Response } from "express";
import { enqueueShortcutWebhook } from "../services/shortcut-webhook.service.js";
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

  const result = await enqueueShortcutWebhook(payload);

  if (result.skipped) {
    res.json({ received: true, skipped: true, reason: result.reason });
    return;
  }

  res.json({ received: true, runId: result.runId });
});

export default router;
