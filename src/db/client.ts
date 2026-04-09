import Database from "better-sqlite3";
import { config } from "../config/env.js";

// DATABASE_URL is stored as "file:./data/app.db" (Drizzle convention).
// better-sqlite3 wants a plain file path, so strip the prefix.
const dbPath = config.DATABASE_URL.replace(/^file:/, "");

export const db = new Database(dbPath);

// WAL mode gives better concurrent read performance with no downside for SQLite.
db.pragma("journal_mode = WAL");
