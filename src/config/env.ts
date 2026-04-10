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

  // Target repo validation commands — override when the target repo uses
  // different scripts (e.g. "yarn build" or "make lint").
  TARGET_REPO_BUILD_CMD: z.string().default("npm run build"),
  TARGET_REPO_LINT_CMD: z.string().default("npm run lint"),

  // GitHub — used to push branches and open pull requests.
  GITHUB_TOKEN: isTest
    ? z.string().default("test-github-token")
    : z.string().min(1, "GITHUB_TOKEN is required"),
  GITHUB_REPO_OWNER: isTest
    ? z.string().default("test-owner")
    : z.string().min(1, "GITHUB_REPO_OWNER is required"),
  GITHUB_REPO_NAME: isTest
    ? z.string().default("test-repo")
    : z.string().min(1, "GITHUB_REPO_NAME is required"),
  GITHUB_DEFAULT_BASE_BRANCH: z.string().default("main"),
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
