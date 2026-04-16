import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request } from "express";
import { config } from "./config/env.js";
import apiRouter from "./routes/api.js";
import debugRouter from "./routes/debug.js";
import webhooksRouter from "./routes/webhooks.js";

const app = express();

// Save the raw body buffer so HMAC verification middleware can access it.
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);

if (config.NODE_ENV !== "production") {
  app.use("/api/debug", debugRouter);
}

app.use(webhooksRouter);

// Serve built React SPA — must be after all API routes so /api/* and /webhooks/* are not swallowed.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../dist/frontend");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
