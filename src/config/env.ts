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
    : z.string().default(""),
  SHORTCUT_WEBHOOK_SECRET: isTest
    ? z.string().default("test-secret")
    : z.string().default(""),
  SHORTCUT_BASE_URL: z
    .string()
    .url()
    .default("https://api.app.shortcut.com/api/v3"),
  SHORTCUT_WORKSPACE_SLUG: isTest
    ? z.string().default("test-workspace")
    : z.string().default(""),

  // Anthropic
  ANTHROPIC_API_KEY: isTest
    ? z.string().default("test-key")
    : z.string().default(""),

  // Git / worktree
  GIT_REPO_PATH: isTest
    ? z.string().default("/tmp/test-repo")
    : z.string().default(""),
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
    : z.string().default(""),
  GITHUB_REPO_OWNER: isTest
    ? z.string().default("test-owner")
    : z.string().default(""),
  GITHUB_REPO_NAME: isTest
    ? z.string().default("test-repo")
    : z.string().default(""),
  GITHUB_DEFAULT_BASE_BRANCH: z.string().default("main"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const DEMO_MODE =
  !parsed.data.SHORTCUT_API_TOKEN ||
  !parsed.data.ANTHROPIC_API_KEY ||
  !parsed.data.GITHUB_TOKEN ||
  !parsed.data.GIT_REPO_PATH;

export const config = Object.freeze({ ...parsed.data, DEMO_MODE });
export type Config = typeof config;
