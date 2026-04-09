import express from "express";
import webhooksRouter from "./routes/webhooks.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(webhooksRouter);

export default app;
