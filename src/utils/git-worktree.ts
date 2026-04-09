import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config/env.js";

export interface WorktreeResult {
  branchName: string;
  worktreePath: string;
}

/**
 * Create a git worktree for a single orchestration run.
 *
 * - Validates that GIT_REPO_PATH is an existing git repository.
 * - Creates WORKTREE_BASE_DIR if it doesn't exist.
 * - Checks out a new branch `codemeai/<tool>-<ticketId>` in an isolated worktree.
 * - Never modifies the main checkout.
 *
 * Throws with a clear message on any git error or invalid config.
 */
export function prepareWorktreeForTicket(
  tool: string,
  ticketId: string,
): WorktreeResult {
  const repoPath = config.GIT_REPO_PATH;
  const baseDir = config.WORKTREE_BASE_DIR;

  // Validate repo path.
  if (!existsSync(repoPath)) {
    throw new Error(
      `GIT_REPO_PATH does not exist: ${repoPath}`,
    );
  }

  git(repoPath, ["rev-parse", "--git-dir"]); // throws if not a git repo

  // Ensure worktree base dir exists.
  mkdirSync(baseDir, { recursive: true });

  const branchName = `codemeai/${tool}-${ticketId}`;
  const worktreePath = join(baseDir, `${tool}-${ticketId}`);

  console.log(
    `[git-worktree] creating branch=${branchName} path=${worktreePath}`,
  );

  git(repoPath, [
    "worktree",
    "add",
    "--no-track",
    "-b",
    branchName,
    worktreePath,
    "HEAD",
  ]);

  console.log(`[git-worktree] ready at ${worktreePath}`);
  return { branchName, worktreePath };
}

/**
 * Remove a worktree and delete its branch.
 * Safe to call even if the worktree or branch no longer exists.
 */
export function cleanupWorktree(
  worktreePath: string,
  branchName: string,
): void {
  const repoPath = config.GIT_REPO_PATH;

  console.log(`[git-worktree] cleaning up path=${worktreePath}`);

  try {
    git(repoPath, ["worktree", "remove", "--force", worktreePath]);
  } catch (err) {
    console.warn(
      `[git-worktree] worktree remove skipped (may already be gone): ${errorMessage(err)}`,
    );
  }

  try {
    git(repoPath, ["branch", "-D", branchName]);
  } catch (err) {
    console.warn(
      `[git-worktree] branch delete skipped (may already be gone): ${errorMessage(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch (err) {
    const stderr =
      err instanceof Error && "stderr" in err
        ? String((err as NodeJS.ErrnoException & { stderr?: Buffer }).stderr ?? "")
        : "";
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${stderr || errorMessage(err)}`,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
