/**
 * Seed script — inserts mock runs into the local SQLite database.
 * Idempotent: clears existing runs before inserting.
 *
 * Usage: npm run seed
 */
import "dotenv/config";
import { db } from "../src/db/client.js";
import { initDb } from "../src/db/index.js";
import { MOCK_RUNS } from "../src/fixtures/runs.js";

initDb();

db.prepare("DELETE FROM runs").run();

const insert = db.prepare(`
  INSERT INTO runs (
    external_ticket_id, tool, status,
    branch_name, worktree_path,
    pr_target_branch, pr_url, story_url,
    summary, error_message,
    created_at, updated_at
  ) VALUES (
    @external_ticket_id, @tool, @status,
    @branch_name, @worktree_path,
    @pr_target_branch, @pr_url, @story_url,
    @summary, @error_message,
    @created_at, @updated_at
  )
`);

const insertMany = db.transaction(() => {
  for (const run of MOCK_RUNS) {
    insert.run(run);
  }
});

insertMany();

console.log(`Seeded ${MOCK_RUNS.length} runs.`);
