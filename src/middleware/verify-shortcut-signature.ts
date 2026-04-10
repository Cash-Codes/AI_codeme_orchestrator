import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";

/**
 * Verifies the `Shortcut-Signature` HMAC-SHA256 header.
 *
 * Requires the raw request body to be available on `req.rawBody` (set via the
 * `verify` callback on `express.json()` in app.ts).
 *
 * Responds 401 on missing or invalid signature; calls next() on success.
 */
export function verifyShortcutSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const signature = req.headers["shortcut-signature"];

  if (typeof signature !== "string" || !signature) {
    res.status(401).json({ error: "Missing Shortcut-Signature header" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody) {
    res.status(400).json({ error: "Raw body unavailable for signature verification" });
    return;
  }

  const expected = `sha256=${createHmac("sha256", config.SHORTCUT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  const valid =
    sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    console.warn("[webhook] rejected — invalid Shortcut-Signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}
