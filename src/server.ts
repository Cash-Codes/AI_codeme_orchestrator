import "dotenv/config";
import app from "./app.js";
import { config } from "./config/env.js";
import { initDb } from "./db/index.js";

initDb();

app.listen(config.PORT, () => {
  if (config.DEMO_MODE) {
    console.warn(
      "⚠️  DEMO MODE — credentials not configured, serving fixture data. Set SHORTCUT_API_TOKEN, ANTHROPIC_API_KEY, GITHUB_TOKEN, and GIT_REPO_PATH to enable full functionality.",
    );
  }
  console.log(`Server listening on port ${config.PORT}`);
});
