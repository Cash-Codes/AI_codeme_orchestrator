/**
 * Push a branch to GitHub using a token-embedded remote URL.
 *
 * No credential storage — the token is embedded directly in the push URL and
 * never written to disk or to the repo's git config.
 */

import { execFileSync } from "node:child_process";

export interface PushBranchInput {
  /** Absolute path to the git worktree (or repo) to push from. */
  cwd: string;
  /** Branch name to push (local and remote name will match). */
  branchName: string;
  /** GitHub owner (user or org). */
  owner: string;
  /** GitHub repository name (without owner prefix). */
  repo: string;
  /** Personal access token or fine-grained token with contents:write scope. */
  token: string;
}

/**
 * Pushes `branchName` to `origin` using an ephemeral token-embedded URL.
 * The remote is added temporarily, used once, then removed — leaving the
 * worktree's git config clean.
 *
 * Throws if the push fails.
 */
export function pushBranch(input: PushBranchInput): void {
  const remoteUrl = `https://x-access-token:${input.token}@github.com/${input.owner}/${input.repo}.git`;
  const remoteName = `codemeai-push-${Date.now()}`;

  const opts = { cwd: input.cwd, stdio: "pipe" as const };

  try {
    execFileSync("git", ["remote", "add", remoteName, remoteUrl], opts);
    execFileSync(
      "git",
      ["push", remoteName, `${input.branchName}:${input.branchName}`],
      opts,
    );
  } finally {
    // Always remove the temporary remote — even if push failed.
    try {
      execFileSync("git", ["remote", "remove", remoteName], opts);
    } catch {
      // Ignore — remote may not have been added if the add step failed.
    }
  }
}
