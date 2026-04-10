import express from "express";
import type { Request } from "express";
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

app.use(webhooksRouter);

export default app;
