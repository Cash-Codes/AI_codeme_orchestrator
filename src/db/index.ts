import { db } from "./client.js";
import { CREATE_RUNS_TABLE } from "./schema.js";

/**
 * Creates required tables if they don't exist yet.
 * Call once at server startup before accepting requests.
 */
export function initDb(): void {
  db.exec(CREATE_RUNS_TABLE);
  console.log("[db] tables ready");
}

// Re-export the repository so consumers import from a single place.
export {
  createRun,
  getRunByExternalTicketId,
  updateRunStatus,
  saveRunResult,
} from "./runs.js";
export type { Run, CreateRunInput } from "./runs.js";
export type { RunStatus } from "./schema.js";
