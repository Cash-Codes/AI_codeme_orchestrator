import "dotenv/config";
import { config } from "./config/env.js";
import { initDb } from "./db/index.js";
import app from "./app.js";

initDb();

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});
