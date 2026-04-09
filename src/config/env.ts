import { z } from "zod";

const isTest = process.env.NODE_ENV === "test";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  // Shortcut (Clubhouse) integration
  SHORTCUT_API_TOKEN: isTest
    ? z.string().default("test-token")
    : z.string().min(1, "SHORTCUT_API_TOKEN is required"),
  SHORTCUT_WEBHOOK_SECRET: isTest
    ? z.string().default("test-secret")
    : z.string().min(1, "SHORTCUT_WEBHOOK_SECRET is required"),
  SHORTCUT_BASE_URL: z
    .string()
    .url()
    .default("https://api.app.shortcut.com/api/v3"),

  // Anthropic
  ANTHROPIC_API_KEY: isTest
    ? z.string().default("test-key")
    : z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // Git / worktree
  GIT_REPO_PATH: isTest
    ? z.string().default("/tmp/test-repo")
    : z.string().min(1, "GIT_REPO_PATH is required"),
  WORKTREE_BASE_DIR: z.string().default("/tmp/handleai-worktrees"),

  // Database
  DATABASE_URL: z.string().default("file:./data/app.db"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const config = Object.freeze(parsed.data);
export type Config = typeof config;
