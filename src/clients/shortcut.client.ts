import { config } from "../config/env.js";

// ---------------------------------------------------------------------------
// Raw API shapes (subset of what Shortcut actually returns)
// ---------------------------------------------------------------------------

export interface ShortcutStoryRaw {
  id: number;
  name: string;
  description: string;
  story_type: string;
  workflow_state_id: number;
  labels: Array<{ id: number; name: string }>;
  external_id: string | null;
  app_url: string;
}

export interface ShortcutCommentRaw {
  id: number;
  story_id: number;
  text: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

export class ShortcutClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  async getStory(storyId: number): Promise<ShortcutStoryRaw> {
    return this.request<ShortcutStoryRaw>("GET", `/stories/${storyId}`);
  }

  async createComment(
    storyId: number,
    text: string,
  ): Promise<ShortcutCommentRaw> {
    return this.request<ShortcutCommentRaw>(
      "POST",
      `/stories/${storyId}/comments`,
      { text },
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Shortcut-Token": this.token,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Shortcut API ${method} ${path} returned ${res.status}: ${detail}`,
      );
    }

    return res.json() as Promise<T>;
  }
}

// Singleton — constructed from config at module load time.
// Swap this reference in tests by reassigning shortcutService (see below).
export const shortcutClient = new ShortcutClient(
  config.SHORTCUT_BASE_URL,
  config.SHORTCUT_API_TOKEN,
);
