/**
 * Minimal GitHub REST API client — only what the orchestrator needs.
 * Uses the built-in fetch; no SDK dependency.
 */

import { config } from "../config/env.js";

export interface PullRequestInput {
  owner: string;
  repo: string;
  title: string;
  head: string; // source branch
  base: string; // target branch
  body?: string;
}

export interface PullRequest {
  number: number;
  html_url: string;
  title: string;
  head: string;
  base: string;
}

export class GitHubClient {
  private readonly baseUrl = "https://api.github.com";

  constructor(private readonly token: string) {}

  async createPullRequest(input: PullRequestInput): Promise<PullRequest> {
    const url = `${this.baseUrl}/repos/${input.owner}/${input.repo}/pulls`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        head: input.head,
        base: input.base,
        body: input.body ?? "",
        draft: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`GitHub API error ${res.status} creating PR: ${text}`);
    }

    const data = (await res.json()) as {
      number: number;
      html_url: string;
      title: string;
      head: { ref: string };
      base: { ref: string };
    };

    return {
      number: data.number,
      html_url: data.html_url,
      title: data.title,
      head: data.head.ref,
      base: data.base.ref,
    };
  }
}

export const githubClient = new GitHubClient(config.GITHUB_TOKEN);
